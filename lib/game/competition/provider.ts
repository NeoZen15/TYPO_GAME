import "server-only";

import crypto from "node:crypto";

import {
  COMPETITION_ENGINE_VERSION,
  COMPETITION_FAST_BONUS_THRESHOLD_MS,
  COMPETITION_TOTAL_DURATION_MS,
  getCompetitionDisplayWord,
} from "@/lib/game/competition/catalog";
import {
  getRuntimeFontFace,
  getRuntimeFontFamily,
} from "@/lib/game/fonts/runtime-catalog";
import {
  type CompetitionAnswerResponse,
  type CompetitionSessionAnswerPoint,
  type CompetitionQuestion,
  type CompetitionSessionCategorySummary,
  type CompetitionSessionSummary,
  type CompetitionSessionSpeedBucket,
  type CompetitionStartResponse,
  type CompetitionStats,
  type CompetitionTimeoutResponse,
} from "@/lib/game/competition/contracts";
import {
  createQuestionToken,
  verifyQuestionToken,
  type TrainingQuestionTokenPayload,
} from "@/lib/game/training/question-token";
import { type Locale } from "@/lib/game/training/contracts";
import {
  RUNTIME_ALLOWED_LICENSE_TYPES,
  UFL_LEGACY_SLUGS,
} from "@/lib/game/license-guard";
import { LATIN_UNREADY_SLUGS } from "@/lib/game/latin-coverage-guard";
import { sql } from "@/lib/server/neon";

type CompetitionPoolRow = {
  typeface_slug: string;
  display_name: string;
  primary_category: string;
  visual_cluster_id: string;
  mastery_level: number;
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
  correct_count: number;
  score: number;
  status: string;
  started_global_q_index: number;
  started_at: string;
  locale: Locale;
};

type CompetitionAnswerEventRow = {
  global_q_index: number;
  correct_slug: string;
  correct_label: string;
  guessed_slug: string;
  guessed_label: string;
  correct_category: string;
  is_correct: boolean;
  response_time_ms: number;
  display_word: string;
};

const GUEST_USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const queryRows = async <T>(query: Promise<unknown>) => (await query) as T[];

const hashScore = (seed: string, salt: number, slug: string) => {
  const hex = crypto
    .createHash("sha256")
    .update(`${seed}:${salt}:${slug}`)
    .digest("hex")
    .slice(0, 8);

  return Number.parseInt(hex, 16);
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

// The competition pool is BOTH the answer set and the distractor set, so this is
// the single place where a typeface becomes visible to a competition player. The
// licence clause therefore belongs here and not in the screen: see
// lib/game/license-guard.ts for why it is an allowlist compared as text.
const getCompetitionPoolRows = async (userId: string) =>
  queryRows<CompetitionPoolRow>(sql`
    SELECT
      tc.typeface_slug,
      tc.display_name,
      tc.primary_category::text AS primary_category,
      tc.visual_cluster_id,
      COALESCE(uts.mastery_level, 0) AS mastery_level
    FROM typefaces_core tc
    LEFT JOIN user_typeface_state uts
      ON uts.user_id = ${userId}::uuid
     AND uts.typeface_slug = tc.typeface_slug
    WHERE tc.activation_status = true
      AND tc.min_mode IN ('training', 'competition')
      AND (
        tc.license_type::text = ANY(${[...RUNTIME_ALLOWED_LICENSE_TYPES]}::text[])
        OR tc.typeface_slug = ANY(${[...UFL_LEGACY_SLUGS]}::text[])
      )
      AND tc.typeface_slug <> ALL(${[...LATIN_UNREADY_SLUGS]}::text[])
      AND EXISTS (
        SELECT 1
        FROM font_runtime_assets fra
        WHERE fra.typeface_slug = tc.typeface_slug
          AND fra.runtime_status = 'ready'
      )
    ORDER BY tc.display_name ASC
  `);

const buildStats = (session: SessionRow): CompetitionStats => {
  const deadlineMs =
    new Date(session.started_at).getTime() + COMPETITION_TOTAL_DURATION_MS;
  const remainingMs = Math.max(0, deadlineMs - Date.now());

  return {
    answeredCount: session.question_count,
    correctCount: session.correct_count,
    score: session.score,
    totalDurationMs: COMPETITION_TOTAL_DURATION_MS,
    remainingMs,
    deadlineUtc: new Date(deadlineMs).toISOString(),
  };
};

const getCompetitionAnswerRows = async (sessionId: string) =>
  queryRows<CompetitionAnswerEventRow>(sql`
    SELECT
      uef.global_q_index,
      uef.typeface_slug AS correct_slug,
      COALESCE(tc.display_name, uef.typeface_slug) AS correct_label,
      COALESCE(uef.answer_slug, '') AS guessed_slug,
      COALESCE(answer_tc.display_name, uef.answer_slug, 'Unknown') AS guessed_label,
      COALESCE(tc.primary_category::text, 'other') AS correct_category,
      uef.is_correct,
      uef.response_time_ms,
      uef.display_word
    FROM user_event_fact uef
    LEFT JOIN typefaces_core tc
      ON tc.typeface_slug = uef.typeface_slug
    LEFT JOIN typefaces_core answer_tc
      ON answer_tc.typeface_slug = uef.answer_slug
    WHERE uef.session_id = ${sessionId}::uuid
      AND uef.event_type = 'answer'
    ORDER BY uef.global_q_index ASC
  `);

const toFixedRate = (value: number) => Number(value.toFixed(1));

const toPercent = (value: number, total: number) =>
  total > 0 ? toFixedRate((value / total) * 100) : 0;

const toPerMinute = (value: number) =>
  toFixedRate(value / (COMPETITION_TOTAL_DURATION_MS / 60_000));

const toAverageMs = (values: number[]) =>
  values.length > 0
    ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length)
    : null;

const buildCompetitionSessionSummary = async (
  session: SessionRow
): Promise<CompetitionSessionSummary> => {
  const rows = await getCompetitionAnswerRows(session.session_id);
  const answeredCount = session.question_count;
  const correctCount = session.correct_count;
  const wrongCount = Math.max(0, answeredCount - correctCount);
  const responseTimes = rows.map((row) => row.response_time_ms);
  const correctTimes = rows
    .filter((row) => row.is_correct)
    .map((row) => row.response_time_ms);
  const wrongTimes = rows
    .filter((row) => !row.is_correct)
    .map((row) => row.response_time_ms);
  const fastAnswerCount = rows.filter(
    (row) =>
      row.is_correct &&
      row.response_time_ms < COMPETITION_FAST_BONUS_THRESHOLD_MS
  ).length;

  let currentCorrectStreak = 0;
  let bestCorrectStreak = 0;
  for (const row of rows) {
    if (row.is_correct) {
      currentCorrectStreak += 1;
      bestCorrectStreak = Math.max(bestCorrectStreak, currentCorrectStreak);
    } else {
      currentCorrectStreak = 0;
    }
  }

  const categoryMap = new Map<string, CompetitionSessionCategorySummary>();
  for (const row of rows) {
    const key = row.correct_category || "other";
    const current = categoryMap.get(key) ?? {
      category: key,
      answeredCount: 0,
      correctCount: 0,
      accuracyRate: 0,
    };
    current.answeredCount += 1;
    current.correctCount += row.is_correct ? 1 : 0;
    categoryMap.set(key, current);
  }

  const categoryPerformance = [...categoryMap.values()]
    .map((entry) => ({
      ...entry,
      accuracyRate: toPercent(entry.correctCount, entry.answeredCount),
    }))
    .sort((left, right) => {
      if (right.answeredCount !== left.answeredCount) {
        return right.answeredCount - left.answeredCount;
      }
      if (right.accuracyRate !== left.accuracyRate) {
        return right.accuracyRate - left.accuracyRate;
      }
      return left.category.localeCompare(right.category);
    });

  const rankedByAccuracy = [...categoryPerformance].sort((left, right) => {
    if (right.accuracyRate !== left.accuracyRate) {
      return right.accuracyRate - left.accuracyRate;
    }
    if (right.answeredCount !== left.answeredCount) {
      return right.answeredCount - left.answeredCount;
    }
    return left.category.localeCompare(right.category);
  });

  const strongestCategories = rankedByAccuracy.slice(0, 3);
  const weakestCategories = [...rankedByAccuracy].reverse().slice(0, 3);

  const confusionMap = new Map<
    string,
    {
      correctSlug: string;
      correctLabel: string;
      guessedSlug: string;
      guessedLabel: string;
      count: number;
    }
  >();

  for (const row of rows.filter((entry) => !entry.is_correct && entry.guessed_slug)) {
    const key = `${row.correct_slug}__${row.guessed_slug}`;
    const current = confusionMap.get(key) ?? {
      correctSlug: row.correct_slug,
      correctLabel: row.correct_label,
      guessedSlug: row.guessed_slug,
      guessedLabel: row.guessed_label,
      count: 0,
    };
    current.count += 1;
    confusionMap.set(key, current);
  }

  const commonConfusions = [...confusionMap.values()]
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.correctLabel.localeCompare(right.correctLabel);
    })
    .slice(0, 5);

  const recentMisses = rows
    .filter((row) => !row.is_correct && row.guessed_slug)
    .slice(-5)
    .reverse()
    .map((row) => ({
      correctSlug: row.correct_slug,
      correctLabel: row.correct_label,
      guessedSlug: row.guessed_slug,
      guessedLabel: row.guessed_label,
      responseTimeMs: row.response_time_ms,
      displayWord: row.display_word,
      category: row.correct_category,
    }));

  const answerTimeline: CompetitionSessionAnswerPoint[] = rows.map((row, index) => ({
    answerIndex: index + 1,
    responseTimeMs: row.response_time_ms,
    isCorrect: row.is_correct,
    awardedPoints: row.is_correct
      ? row.response_time_ms < COMPETITION_FAST_BONUS_THRESHOLD_MS
        ? 2
        : 1
      : 0,
  }));

  const speedBucketDefinitions = [
    {
      label: "<1s",
      matches: (responseTimeMs: number) => responseTimeMs < 1000,
      tone: "positive" as const,
    },
    {
      label: "1-2s",
      matches: (responseTimeMs: number) =>
        responseTimeMs >= 1000 && responseTimeMs < 2000,
      tone: "neutral" as const,
    },
    {
      label: "2-3s",
      matches: (responseTimeMs: number) =>
        responseTimeMs >= 2000 && responseTimeMs < 3000,
      tone: "warning" as const,
    },
    {
      label: "3s+",
      matches: (responseTimeMs: number) => responseTimeMs >= 3000,
      tone: "negative" as const,
    },
  ];

  const speedBuckets: CompetitionSessionSpeedBucket[] = speedBucketDefinitions.map(
    (definition) => {
      const count = rows.filter((row) => definition.matches(row.response_time_ms)).length;
      return {
        label: definition.label,
        count,
        percentage: answeredCount > 0 ? toPercent(count, answeredCount) : 0,
        tone: definition.tone,
      };
    }
  );

  return {
    wrongCount,
    accuracyRate: toPercent(correctCount, answeredCount),
    fastAnswerCount,
    answersPerMinute: toPerMinute(answeredCount),
    pointsPerMinute: toPerMinute(session.score),
    averagePointsPerAnswer:
      answeredCount > 0 ? toFixedRate(session.score / answeredCount) : 0,
    averageResponseTimeMs: toAverageMs(responseTimes),
    averageCorrectResponseTimeMs: toAverageMs(correctTimes),
    averageWrongResponseTimeMs: toAverageMs(wrongTimes),
    fastestResponseTimeMs:
      responseTimes.length > 0 ? Math.min(...responseTimes) : null,
    slowestResponseTimeMs:
      responseTimes.length > 0 ? Math.max(...responseTimes) : null,
    bestCorrectStreak,
    uniqueTypefacesSeenCount: new Set(rows.map((row) => row.correct_slug)).size,
    categoryPerformance,
    strongestCategories,
    weakestCategories,
    commonConfusions,
    recentMisses,
    answerTimeline,
    speedBuckets,
  };
};

const buildQuestion = (
  session: SessionRow,
  userId: string,
  pool: CompetitionPoolRow[]
): CompetitionQuestion => {
  if (pool.length < 4) {
    throw new Error("Competition pool requires at least 4 runtime-ready typefaces.");
  }

  const questionIndex = session.question_count;
  const globalQIndex = session.started_global_q_index + questionIndex;
  const orderedPool = [...pool].sort((left, right) => {
    const scoreDelta =
      hashScore(session.seed, 0, left.typeface_slug) -
      hashScore(session.seed, 0, right.typeface_slug);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.typeface_slug.localeCompare(right.typeface_slug);
  });

  const correct = orderedPool[questionIndex % orderedPool.length];
  if (!correct) {
    throw new Error("Unable to select a competition typeface.");
  }

  const distractors = pool
    .filter((row) => row.typeface_slug !== correct.typeface_slug)
    .map((row) => {
      let weight = 1000;
      if (row.primary_category === correct.primary_category) {
        weight -= 220;
      }
      if (row.visual_cluster_id === correct.visual_cluster_id) {
        weight -= 320;
      }

      weight += hashScore(session.seed, globalQIndex + 17, row.typeface_slug) % 131;
      return { row, weight };
    })
    .sort((left, right) => left.weight - right.weight)
    .slice(0, 3)
    .map((entry) => entry.row);

  const optionRows = [correct, ...distractors].sort((left, right) => {
    const scoreDelta =
      hashScore(session.seed, globalQIndex + 31, left.typeface_slug) -
      hashScore(session.seed, globalQIndex + 31, right.typeface_slug);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.typeface_slug.localeCompare(right.typeface_slug);
  });

  const payload: TrainingQuestionTokenPayload = {
    sessionId: session.session_id,
    userId,
    questionId: crypto.randomUUID(),
    globalQIndex,
    typefaceSlug: correct.typeface_slug,
    displayWord: getCompetitionDisplayWord(session.seed, questionIndex),
    options: optionRows.map((option) => option.typeface_slug),
  };

  return {
    id: payload.questionId,
    token: createQuestionToken(payload),
    displayWord: payload.displayWord,
    typefaceSlug: correct.typeface_slug,
    typefaceLabel: correct.display_name,
    fontFamily: getRuntimeFontFamily(correct.typeface_slug, correct.display_name),
    fontFace: getRuntimeFontFace(correct.typeface_slug),
    options: optionRows.map((option) => ({
      slug: option.typeface_slug,
      label: option.display_name,
    })),
  };
};

const getSession = async (sessionId: string) => {
  const sessionRows = await queryRows<SessionRow>(sql`
    SELECT
      session_id,
      user_id,
      seed,
      question_count,
      correct_count,
      score,
      status,
      started_global_q_index,
      started_at,
      locale
    FROM sessions
    WHERE session_id = ${sessionId}::uuid
    LIMIT 1
  `);

  return sessionRows[0] ?? null;
};

const getUser = async (userId: string) => {
  const userRows = await queryRows<UserRow>(sql`
    SELECT user_id, locale, global_q_index
    FROM users
    WHERE user_id = ${userId}::uuid
    LIMIT 1
  `);

  return userRows[0] ?? null;
};

const insertSessionStartEvent = async (session: SessionRow) => {
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
      ${`${session.session_id}:session_start`},
      ${session.user_id}::uuid,
      ${session.session_id}::uuid,
      'competition',
      ${session.started_global_q_index},
      'session_start',
      ${COMPETITION_ENGINE_VERSION}
    )
  `;
};

const insertSessionEndEventIfMissing = async (session: SessionRow) => {
  const endedGlobalQIndex = session.started_global_q_index + session.question_count;

  await sql`
    INSERT INTO user_event_fact (
      idempotency_key,
      user_id,
      session_id,
      mode,
      global_q_index,
      event_type,
      engine_version
    )
    SELECT
      ${`${session.session_id}:session_end`},
      ${session.user_id}::uuid,
      ${session.session_id}::uuid,
      'competition',
      ${endedGlobalQIndex},
      'session_end',
      ${COMPETITION_ENGINE_VERSION}
    WHERE NOT EXISTS (
      SELECT 1
      FROM user_event_fact
      WHERE session_id = ${session.session_id}::uuid
        AND event_type = 'session_end'
    )
  `;
};

const finalizeCompetitionSession = async (
  session: SessionRow
): Promise<CompetitionTimeoutResponse> => {
  if (session.status === "active") {
    await sql`
      UPDATE sessions
      SET status = 'completed'::app.session_status_enum,
          ended_at = COALESCE(ended_at, now())
      WHERE session_id = ${session.session_id}::uuid
    `;
  }

  const refreshed = (await getSession(session.session_id)) ?? session;
  await insertSessionEndEventIfMissing(refreshed);
  const summary = await buildCompetitionSessionSummary(refreshed);

  return {
    sessionComplete: true,
    feedbackText: "Time is up.",
    stats: {
      ...buildStats(refreshed),
      remainingMs: 0,
    },
    summary,
  };
};

export const startCompetitionSession = async ({
  locale = "fr",
  guestUserId,
}: {
  locale?: Locale;
  guestUserId?: string | null;
}): Promise<{
  payload: CompetitionStartResponse;
  guestUserId: string;
  guestWasCreated: boolean;
}> => {
  const { user, created } = await getGuestUser(locale, guestUserId);
  const pool = await getCompetitionPoolRows(user.user_id);

  if (pool.length < 4) {
    throw new Error("Competition mode needs at least 4 active runtime-ready typefaces.");
  }

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
      started_global_q_index,
      score
    ) VALUES (
      ${user.user_id}::uuid,
      'competition',
      'active',
      ${user.locale},
      ${seed},
      ${COMPETITION_ENGINE_VERSION},
      ${user.global_q_index},
      0
    )
    RETURNING
      session_id,
      user_id,
      seed,
      question_count,
      correct_count,
      score,
      status,
      started_global_q_index,
      started_at,
      locale
  `);

  const session = insertedSessions[0];
  await insertSessionStartEvent(session);

  return {
    payload: {
      sessionId: session.session_id,
      userId: user.user_id,
      question: buildQuestion(session, user.user_id, pool),
      stats: buildStats(session),
    },
    guestUserId: user.user_id,
    guestWasCreated: created,
  };
};

export const submitCompetitionAnswer = async ({
  sessionId,
  questionToken,
  answerSlug,
  responseTimeMs,
}: {
  sessionId: string;
  questionToken: string;
  answerSlug: string;
  responseTimeMs: number;
}): Promise<CompetitionAnswerResponse | CompetitionTimeoutResponse> => {
  const resolvedResponseTimeMs = Math.max(0, Math.round(responseTimeMs));
  const payload = verifyQuestionToken(questionToken);
  if (!payload || payload.sessionId !== sessionId) {
    throw new Error("Invalid competition question token.");
  }

  if (!payload.options.includes(answerSlug)) {
    throw new Error("Invalid competition answer option.");
  }

  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("Competition session not found.");
  }

  const user = await getUser(session.user_id);
  if (!user || payload.userId !== user.user_id) {
    throw new Error("Competition user not found for session.");
  }

  if (session.status !== "active") {
    return finalizeCompetitionSession(session);
  }

  const expectedGlobalQIndex = session.started_global_q_index + session.question_count;
  if (payload.globalQIndex !== expectedGlobalQIndex) {
    throw new Error("Competition question is stale.");
  }

  const deadlineMs =
    new Date(session.started_at).getTime() + COMPETITION_TOTAL_DURATION_MS;
  if (Date.now() >= deadlineMs) {
    return finalizeCompetitionSession(session);
  }

  const previousAttemptRows = await queryRows<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count
    FROM user_event_fact
    WHERE session_id = ${sessionId}::uuid
      AND event_type = 'answer'
      AND question_id = ${payload.questionId}::uuid
  `);

  const previousAttempts = Number.parseInt(previousAttemptRows[0]?.count ?? "0", 10);
  if (previousAttempts > 0) {
    throw new Error("Competition question already answered.");
  }

  const masteryRows = await queryRows<{ mastery_level: number }>(sql`
    SELECT COALESCE(uts.mastery_level, 0) AS mastery_level
    FROM typefaces_core tc
    LEFT JOIN user_typeface_state uts
      ON uts.user_id = ${user.user_id}::uuid
     AND uts.typeface_slug = tc.typeface_slug
    WHERE tc.typeface_slug = ${payload.typefaceSlug}
    LIMIT 1
  `);

  const masteryLevel = masteryRows[0]?.mastery_level ?? 0;
  const isCorrect = answerSlug === payload.typefaceSlug;
  const awardedPoints = isCorrect
    ? Math.max(0, Math.round(responseTimeMs)) < COMPETITION_FAST_BONUS_THRESHOLD_MS
      ? 2
      : 1
    : 0;

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
      ${`${sessionId}:${payload.questionId}:1`},
      ${user.user_id}::uuid,
      ${sessionId}::uuid,
      'competition',
      ${payload.globalQIndex},
      ${payload.questionId}::uuid,
      1,
      'answer',
      ${payload.typefaceSlug},
      ${answerSlug},
      ${isCorrect},
      ${resolvedResponseTimeMs},
      ${masteryLevel},
      ${masteryLevel},
      false,
      false,
      ${payload.displayWord},
      ${isCorrect ? 'correct_first_try' : 'wrong_first_try'}::app.reason_code_enum,
      ${session.seed},
      ${COMPETITION_ENGINE_VERSION}
    )
  `;

  const answeredCount = session.question_count + 1;
  const correctCount = session.correct_count + (isCorrect ? 1 : 0);
  const score = session.score + awardedPoints;
  const shouldComplete = Date.now() >= deadlineMs;

  const updatedRows = await queryRows<SessionRow>(sql`
    UPDATE sessions
    SET question_count = ${answeredCount},
        correct_count = ${correctCount},
        score = ${score},
        status = ${shouldComplete ? 'completed' : 'active'}::app.session_status_enum,
        ended_at = ${shouldComplete ? new Date() : null}
    WHERE session_id = ${sessionId}::uuid
    RETURNING
      session_id,
      user_id,
      seed,
      question_count,
      correct_count,
      score,
      status,
      started_global_q_index,
      started_at,
      locale
  `);

  await sql`
    UPDATE users
    SET last_seen_at = now()
    WHERE user_id = ${user.user_id}::uuid
  `;

  const updatedSession = updatedRows[0];

  if (shouldComplete) {
    await insertSessionEndEventIfMissing(updatedSession);
    const summary = await buildCompetitionSessionSummary(updatedSession);
    return {
      sessionComplete: true,
      responseTimeMs: resolvedResponseTimeMs,
      result: isCorrect ? "correct" : "wrong",
      awardedPoints,
      feedbackText: isCorrect
        ? awardedPoints === 2
          ? "Fast and correct."
          : "Correct."
        : "Wrong answer.",
      stats: {
        ...buildStats(updatedSession),
        remainingMs: 0,
      },
      summary,
    };
  }

  const pool = await getCompetitionPoolRows(user.user_id);
  return {
    result: isCorrect ? "correct" : "wrong",
    awardedPoints,
    responseTimeMs: resolvedResponseTimeMs,
    feedbackText: isCorrect
      ? awardedPoints === 2
        ? "+2 fast"
        : "+1 correct"
      : "+0 wrong",
    stats: buildStats(updatedSession),
    nextQuestion: buildQuestion(updatedSession, user.user_id, pool),
    sessionComplete: false,
  };
};

export const timeoutCompetitionSession = async ({
  sessionId,
}: {
  sessionId: string;
}): Promise<CompetitionTimeoutResponse> => {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("Competition session not found.");
  }

  return finalizeCompetitionSession(session);
};
