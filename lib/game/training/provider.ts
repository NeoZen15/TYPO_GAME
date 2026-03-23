import "server-only";

import crypto from "node:crypto";

import {
  getTrainingDisplayWord,
  getTypefaceFontFamily,
  TRAINING_ENGINE_VERSION,
  TRAINING_TOTAL_ROUNDS,
} from "@/lib/game/training/catalog";
import {
  type Locale,
  type TrainingAnswerResponse,
  type TrainingQuestion,
  type TrainingStartResponse,
} from "@/lib/game/training/contracts";
import {
  createQuestionToken,
  verifyQuestionToken,
  type TrainingQuestionTokenPayload,
} from "@/lib/game/training/question-token";
import { sql } from "@/lib/server/neon";

type PoolRow = {
  state_id: string;
  typeface_slug: string;
  mastery_level: number;
  next_due_after_q: number;
  session_errors: number;
  consecutive_session_errors: number;
  adaptive_coef: number;
  primary_category: string;
  visual_cluster_id: string;
  display_name: string;
};

type UserRow = {
  user_id: string;
  locale: Locale;
  global_q_index: number;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  seed: string;
  question_count: number;
  status: string;
};

type CountRow = {
  count: string;
};

const GUEST_USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const queryRows = async <T>(query: Promise<unknown>) => (await query) as T[];

const hashScore = (seed: string, globalQIndex: number, slug: string) => {
  const hex = crypto
    .createHash("sha256")
    .update(`${seed}:${globalQIndex}:${slug}`)
    .digest("hex")
    .slice(0, 8);

  return Number.parseInt(hex, 16);
};

const pickEligibleTypeface = (pool: PoolRow[], globalQIndex: number, seed: string) => {
  const eligible = pool.filter((row) => row.next_due_after_q <= globalQIndex);
  const source = eligible.length > 0 ? eligible : pool;

  return [...source].sort((left, right) => {
    if (left.next_due_after_q !== right.next_due_after_q) {
      return left.next_due_after_q - right.next_due_after_q;
    }
    if (left.mastery_level !== right.mastery_level) {
      return left.mastery_level - right.mastery_level;
    }

    return (
      hashScore(seed, globalQIndex, left.typeface_slug) -
      hashScore(seed, globalQIndex, right.typeface_slug)
    );
  })[0];
};

const pickDistractors = (
  pool: PoolRow[],
  correct: PoolRow,
  globalQIndex: number,
  seed: string
) => {
  const others = pool.filter((row) => row.typeface_slug !== correct.typeface_slug);

  return others
    .map((row) => {
      let score = 1000;

      if (correct.mastery_level <= 1) {
        score -= row.primary_category === correct.primary_category ? 125 : 0;
        score -= row.visual_cluster_id === correct.visual_cluster_id ? 250 : 0;
      } else if (correct.mastery_level === 2) {
        score -= row.primary_category === correct.primary_category ? 225 : 0;
        score -= row.visual_cluster_id === correct.visual_cluster_id ? 175 : 0;
      } else {
        score -= row.primary_category === correct.primary_category ? 325 : 0;
        score -= row.visual_cluster_id === correct.visual_cluster_id ? 350 : 0;
      }

      score += hashScore(seed, globalQIndex, row.typeface_slug) % 97;

      return { row, score };
    })
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((item) => item.row);
};

const buildQuestion = (
  sessionId: string,
  user: UserRow,
  sessionSeed: string,
  pool: PoolRow[]
): TrainingQuestion => {
  const correct = pickEligibleTypeface(pool, user.global_q_index, sessionSeed);
  if (!correct) {
    throw new Error("No training typeface available in active pool.");
  }

  const distractors = pickDistractors(pool, correct, user.global_q_index, sessionSeed);
  const optionRows = [correct, ...distractors].sort(
    (left, right) =>
      hashScore(sessionSeed, user.global_q_index, left.typeface_slug) -
      hashScore(sessionSeed, user.global_q_index, right.typeface_slug)
  );

  const options = optionRows.map((row) => ({
    slug: row.typeface_slug,
    label: row.display_name,
  }));

  const payload: TrainingQuestionTokenPayload = {
    sessionId,
    userId: user.user_id,
    questionId: crypto.randomUUID(),
    globalQIndex: user.global_q_index,
    typefaceSlug: correct.typeface_slug,
    displayWord: getTrainingDisplayWord(sessionSeed, user.global_q_index),
    options: options.map((option) => option.slug),
  };

  return {
    id: payload.questionId,
    token: createQuestionToken(payload),
    displayWord: payload.displayWord,
    typefaceSlug: correct.typeface_slug,
    typefaceLabel: correct.display_name,
    fontFamily: getTypefaceFontFamily(correct.typeface_slug, correct.display_name),
    options,
  };
};

const getGuestUser = async (locale: Locale, existingUserId?: string | null) => {
  if (existingUserId && GUEST_USER_ID_PATTERN.test(existingUserId)) {
    const existingRows = await queryRows<UserRow>(sql`
      SELECT user_id, locale, global_q_index
      FROM users
      WHERE user_id = ${existingUserId}::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `);

    const existing = existingRows[0];
    if (existing) {
      if (existing.locale !== locale) {
        const updatedRows = await queryRows<UserRow>(sql`
          UPDATE users
          SET locale = ${locale}
          WHERE user_id = ${existing.user_id}::uuid
          RETURNING user_id, locale, global_q_index
        `);

        return { user: updatedRows[0], created: false };
      }

      return { user: existing, created: false };
    }
  }

  const insertedRows = await queryRows<UserRow>(sql`
    INSERT INTO users (role, locale, consent_analytics)
    VALUES ('guest', ${locale}, false)
    RETURNING user_id, locale, global_q_index
  `);

  return { user: insertedRows[0], created: true };
};

const ensureUserPool = async (userId: string) => {
  const countRows = await queryRows<CountRow>(sql`
    SELECT COUNT(*)::text AS count
    FROM user_typeface_state
    WHERE user_id = ${userId}::uuid
  `);

  const count = Number.parseInt(countRows[0]?.count ?? "0", 10);
  if (count > 0) {
    return;
  }

  await sql`SELECT init_user_pool(${userId}::uuid)`;

  const refreshedCountRows = await queryRows<CountRow>(sql`
    SELECT COUNT(*)::text AS count
    FROM user_typeface_state
    WHERE user_id = ${userId}::uuid
      AND in_active_pool = true
  `);

  const refreshedCount = Number.parseInt(refreshedCountRows[0]?.count ?? "0", 10);
  if (refreshedCount === 0) {
    throw new Error("Training pool initialization returned no active typefaces.");
  }
};

const getPoolRows = async (userId: string) =>
  queryRows<PoolRow>(sql`
    SELECT
      uts.state_id,
      uts.typeface_slug,
      uts.mastery_level,
      uts.next_due_after_q,
      uts.session_errors,
      uts.consecutive_session_errors,
      uts.adaptive_coef,
      tc.primary_category::text AS primary_category,
      tc.visual_cluster_id,
      tc.display_name
    FROM user_typeface_state uts
    JOIN typefaces_core tc
      ON tc.typeface_slug = uts.typeface_slug
    WHERE uts.user_id = ${userId}::uuid
      AND uts.in_active_pool = true
      AND tc.activation_status = true
    ORDER BY uts.updated_at ASC, tc.display_name ASC
  `);

const computeWrongNextDue = (globalQIndex: number, adaptiveCoef: number) =>
  globalQIndex + Math.max(2, Math.round(2 / adaptiveCoef));

const computeCorrectNextDue = (globalQIndex: number, adaptiveCoef: number) =>
  globalQIndex + Math.max(5, Math.round(10 / adaptiveCoef));

const insertSessionStartEvent = async (
  sessionId: string,
  userId: string,
  globalQIndex: number,
  engineVersion: string
) => {
  await sql`
    INSERT INTO user_event_fact (
      idempotency_key,
      user_id,
      session_id,
      mode,
      global_q_index,
      event_type,
      engine_version
    ) VALUES (
      ${`${sessionId}:session_start`},
      ${userId}::uuid,
      ${sessionId}::uuid,
      'training',
      ${globalQIndex},
      'session_start',
      ${engineVersion}
    )
  `;
};

export const startTrainingSession = async ({
  locale = "fr",
  guestUserId,
}: {
  locale?: Locale;
  guestUserId?: string | null;
}): Promise<{ payload: TrainingStartResponse; guestUserId: string; guestWasCreated: boolean }> => {
  const { user, created } = await getGuestUser(locale, guestUserId);
  await ensureUserPool(user.user_id);

  const seed = `${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;

  const insertedSessions = await queryRows<SessionRow>(sql`
    INSERT INTO sessions (
      user_id,
      mode,
      status,
      locale,
      seed,
      engine_version,
      started_global_q_index
    ) VALUES (
      ${user.user_id}::uuid,
      'training',
      'active',
      ${user.locale},
      ${seed},
      ${TRAINING_ENGINE_VERSION},
      ${user.global_q_index}
    )
    RETURNING session_id, user_id, seed, question_count, status
  `);

  const session = insertedSessions[0];
  await insertSessionStartEvent(
    session.session_id,
    user.user_id,
    user.global_q_index,
    TRAINING_ENGINE_VERSION
  );

  const pool = await getPoolRows(user.user_id);
  const question = buildQuestion(session.session_id, user, session.seed, pool);

  return {
    payload: {
      sessionId: session.session_id,
      userId: user.user_id,
      question,
      progress: {
        resolvedCount: session.question_count,
        totalRounds: TRAINING_TOTAL_ROUNDS,
      },
    },
    guestUserId: user.user_id,
    guestWasCreated: created,
  };
};

export const submitTrainingAnswer = async ({
  sessionId,
  questionToken,
  answerSlug,
  responseTimeMs,
}: {
  sessionId: string;
  questionToken: string;
  answerSlug: string;
  responseTimeMs: number;
}): Promise<TrainingAnswerResponse> => {
  const payload = verifyQuestionToken(questionToken);
  if (!payload || payload.sessionId !== sessionId) {
    throw new Error("Invalid training question token.");
  }

  if (!payload.options.includes(answerSlug)) {
    throw new Error("Invalid training answer option.");
  }

  const sessionRows = await queryRows<SessionRow>(sql`
    SELECT session_id, user_id, seed, question_count, status
    FROM sessions
    WHERE session_id = ${sessionId}::uuid
    LIMIT 1
  `);

  const session = sessionRows[0];
  if (!session || session.status !== "active") {
    throw new Error("Training session is not active.");
  }

  const userRows = await queryRows<UserRow>(sql`
    SELECT user_id, locale, global_q_index
    FROM users
    WHERE user_id = ${session.user_id}::uuid
    LIMIT 1
  `);

  const user = userRows[0];
  if (!user || payload.userId !== user.user_id) {
    throw new Error("Training user not found for session.");
  }

  const stateRows = await queryRows<PoolRow>(sql`
    SELECT
      uts.state_id,
      uts.typeface_slug,
      uts.mastery_level,
      uts.next_due_after_q,
      uts.session_errors,
      uts.consecutive_session_errors,
      uts.adaptive_coef,
      tc.primary_category::text AS primary_category,
      tc.visual_cluster_id,
      tc.display_name
    FROM user_typeface_state uts
    JOIN typefaces_core tc
      ON tc.typeface_slug = uts.typeface_slug
    WHERE uts.user_id = ${user.user_id}::uuid
      AND uts.typeface_slug = ${payload.typefaceSlug}
      AND uts.in_active_pool = true
    LIMIT 1
  `);

  const currentState = stateRows[0];
  if (!currentState) {
    throw new Error("Training state not found for current typeface.");
  }

  const previousAttemptRows = await queryRows<CountRow>(sql`
    SELECT COUNT(*)::text AS count
    FROM user_event_fact
    WHERE session_id = ${sessionId}::uuid
      AND event_type = 'answer'
      AND question_id = ${payload.questionId}::uuid
  `);

  const attemptCount = Number.parseInt(previousAttemptRows[0]?.count ?? "0", 10) + 1;
  const isCorrect = answerSlug === payload.typefaceSlug;
  const wrongFirstTry = !isCorrect && attemptCount === 1;
  const correctFirstTry = isCorrect && attemptCount === 1;
  const correctAfterRetry = isCorrect && attemptCount > 1;

  let nextMastery = currentState.mastery_level;
  let nextDueAfterQ = currentState.next_due_after_q;
  let nextSessionErrors = currentState.session_errors;
  let nextConsecutiveSessionErrors = currentState.consecutive_session_errors;

  if (wrongFirstTry) {
    nextMastery =
      currentState.mastery_level === 4
        ? 3
        : Math.max(0, currentState.mastery_level - 1);
    nextDueAfterQ = computeWrongNextDue(user.global_q_index, currentState.adaptive_coef);
    nextSessionErrors = currentState.session_errors + 1;
    nextConsecutiveSessionErrors = currentState.consecutive_session_errors + 1;

    await sql`
      UPDATE user_typeface_state
      SET mastery_level = ${nextMastery},
          next_due_after_q = ${nextDueAfterQ},
          last_shown_at_q = ${user.global_q_index},
          interval_questions = ${nextDueAfterQ - user.global_q_index},
          total_seen = total_seen + 1,
          total_wrong = total_wrong + 1,
          consecutive_correct = 0,
          session_errors = ${nextSessionErrors},
          consecutive_session_errors = ${nextConsecutiveSessionErrors},
          last_seen_at = now(),
          updated_at = now()
      WHERE state_id = ${currentState.state_id}::uuid
    `;
  } else if (correctFirstTry) {
    nextMastery = Math.min(4, currentState.mastery_level + 1);
    nextDueAfterQ = computeCorrectNextDue(user.global_q_index, currentState.adaptive_coef);
    nextConsecutiveSessionErrors = 0;

    await sql`
      UPDATE user_typeface_state
      SET mastery_level = ${nextMastery},
          next_due_after_q = ${nextDueAfterQ},
          last_shown_at_q = ${user.global_q_index},
          interval_questions = ${nextDueAfterQ - user.global_q_index},
          total_seen = total_seen + 1,
          total_correct = total_correct + 1,
          consecutive_correct = consecutive_correct + 1,
          consecutive_session_errors = 0,
          last_seen_at = now(),
          updated_at = now()
      WHERE state_id = ${currentState.state_id}::uuid
    `;
  } else if (correctAfterRetry) {
    nextConsecutiveSessionErrors = 0;

    await sql`
      UPDATE user_typeface_state
      SET consecutive_session_errors = 0,
          last_seen_at = now(),
          updated_at = now()
      WHERE state_id = ${currentState.state_id}::uuid
    `;
  }

  const reasonCode = isCorrect
    ? attemptCount === 1
      ? "correct_first_try"
      : "correct_after_retry"
    : attemptCount === 1
      ? "wrong_first_try"
      : "wrong_retry";

  const misreadShown =
    wrongFirstTry &&
    (currentState.session_errors === 0 || nextConsecutiveSessionErrors >= 2);

  await sql`
    INSERT INTO user_event_fact (
      idempotency_key,
      user_id,
      session_id,
      mode,
      global_q_index,
      question_id,
      attempt_index,
      event_type,
      typeface_slug,
      answer_slug,
      is_correct,
      response_time_ms,
      mastery_before,
      mastery_after,
      misread_shown,
      reading_shown,
      display_word,
      reason_code,
      seed,
      engine_version
    ) VALUES (
      ${`${sessionId}:${payload.questionId}:${attemptCount}`},
      ${user.user_id}::uuid,
      ${sessionId}::uuid,
      'training',
      ${user.global_q_index},
      ${payload.questionId}::uuid,
      ${attemptCount},
      'answer',
      ${payload.typefaceSlug},
      ${answerSlug},
      ${isCorrect},
      ${Math.max(0, Math.round(responseTimeMs))},
      ${currentState.mastery_level},
      ${nextMastery},
      ${misreadShown},
      false,
      ${payload.displayWord},
      ${reasonCode}::app.reason_code_enum,
      ${session.seed},
      ${TRAINING_ENGINE_VERSION}
    )
  `;

  if (!isCorrect) {
    await sql`
      UPDATE users
      SET last_seen_at = now()
      WHERE user_id = ${user.user_id}::uuid
    `;

    return {
      result: "wrong",
      questionResolved: false,
      feedbackText: "Incorrect. Try again.",
      progress: {
        resolvedCount: session.question_count,
        totalRounds: TRAINING_TOTAL_ROUNDS,
      },
    };
  }

  const resolvedCountAfter = session.question_count + 1;
  const nextGlobalQIndex = user.global_q_index + 1;
  const sessionComplete = resolvedCountAfter >= TRAINING_TOTAL_ROUNDS;

  await sql`
    UPDATE users
    SET global_q_index = ${nextGlobalQIndex},
        last_seen_at = now()
    WHERE user_id = ${user.user_id}::uuid
  `;

  await sql`
    UPDATE sessions
    SET question_count = ${resolvedCountAfter},
        correct_count = correct_count + 1,
        status = ${sessionComplete ? "completed" : "active"}::app.session_status_enum,
        ended_at = ${sessionComplete ? new Date() : null}
    WHERE session_id = ${sessionId}::uuid
  `;

  if (sessionComplete) {
    await sql`
      INSERT INTO user_event_fact (
        idempotency_key,
        user_id,
        session_id,
        mode,
        global_q_index,
        event_type,
        engine_version
      ) VALUES (
        ${`${sessionId}:session_end`},
        ${user.user_id}::uuid,
        ${sessionId}::uuid,
        'training',
        ${nextGlobalQIndex},
        'session_end',
        ${TRAINING_ENGINE_VERSION}
      )
    `;

    return {
      result: "correct",
      questionResolved: true,
      feedbackText: "Correct. Good eye.",
      progress: {
        resolvedCount: resolvedCountAfter,
        totalRounds: TRAINING_TOTAL_ROUNDS,
      },
      sessionComplete: true,
    };
  }

  const nextUser: UserRow = {
    ...user,
    global_q_index: nextGlobalQIndex,
  };
  const pool = await getPoolRows(user.user_id);
  const nextQuestion = buildQuestion(sessionId, nextUser, session.seed, pool);

  return {
    result: "correct",
    questionResolved: true,
    feedbackText: "Correct. Good eye.",
    progress: {
      resolvedCount: resolvedCountAfter,
      totalRounds: TRAINING_TOTAL_ROUNDS,
    },
    nextQuestion,
  };
};
