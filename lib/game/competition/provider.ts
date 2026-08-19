import "server-only";

import crypto from "node:crypto";

import {
  COMPETITION_ENGINE_VERSION,
  COMPETITION_FAST_BONUS_THRESHOLD_MS,
  COMPETITION_OVERHEAD_TOLERANCE_MS,
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
import { normalizeAttemptId, type Locale } from "@/lib/game/training/contracts";
import { GameRequestError } from "@/lib/game/request-error";
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

// Scoring, in one place. Both the answer path and the duplicate path below have
// to say what a submission was worth, and a competition round is short enough
// that a player notices two different wordings for the same outcome. Written as
// functions of (isCorrect, awardedPoints) rather than duplicated at each site,
// the same reason the training provider keeps CORRECT_FEEDBACK and
// WRONG_FEEDBACK as shared constants.
// The claim decides the bonus, the server's own clock decides whether the claim
// is believable. `issuedAtMs` is null for a token minted before that stamp
// existed, and null means "no server measurement", which is the old behaviour:
// tokens in flight across a deploy must answer, not crash.
// See COMPETITION_OVERHEAD_TOLERANCE_MS for why the bound is where it is.
const awardPointsFor = (
  isCorrect: boolean,
  responseTimeMs: number,
  serverElapsedMs: number | null = null
) => {
  if (!isCorrect) return 0;
  if (responseTimeMs >= COMPETITION_FAST_BONUS_THRESHOLD_MS) return 1;

  const exchangeWasImplausiblyLong =
    serverElapsedMs !== null &&
    serverElapsedMs >=
      COMPETITION_FAST_BONUS_THRESHOLD_MS + COMPETITION_OVERHEAD_TOLERANCE_MS;

  return exchangeWasImplausiblyLong ? 1 : 2;
};

// How long the SERVER waited between building this question and reading its
// answer. Not the player's thinking time: it also holds two network legs, the
// render and any font download. Null when the token predates the stamp.
const serverElapsedFor = (issuedAtMs: number | undefined) =>
  typeof issuedAtMs === "number" ? Math.max(0, Date.now() - issuedAtMs) : null;

const roundFeedbackText = (isCorrect: boolean, awardedPoints: number) =>
  isCorrect ? (awardedPoints === 2 ? "+2 fast" : "+1 correct") : "+0 wrong";

const finalFeedbackText = (isCorrect: boolean, awardedPoints: number) =>
  isCorrect ? (awardedPoints === 2 ? "Fast and correct." : "Correct.") : "Wrong answer.";

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
    // Stamped here, signed with the rest, read back by the answer path to bound
    // the fast bonus. See COMPETITION_OVERHEAD_TOLERANCE_MS.
    issuedAtMs: Date.now(),
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

// ATOMIC WRITER (H2), same CTE shape as the training provider's two event
// writers. One guard row, one event, never a divorce between the two: the loser's
// INSERT ... ON CONFLICT blocks on the guard's primary key until the winner
// commits, then finds the conflict, RETURNING yields no row, and its
// SELECT ... FROM g writes nothing into user_event_fact either.
const insertSessionStartEvent = async (session: SessionRow) => {
  await sql`
    WITH g AS (
      INSERT INTO event_ingestion_guard (
        idempotency_key, user_id, session_id, ingestion_status
      )
      VALUES (
        ${`${session.session_id}:session_start`},
        ${session.user_id}::uuid,
        ${session.session_id}::uuid,
        'accepted'
      )
      ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING
      RETURNING 1
    )
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
      ${`${session.session_id}:session_start`},
      ${session.user_id}::uuid,
      ${session.session_id}::uuid,
      'competition',
      ${session.started_global_q_index}::int,
      'session_start',
      ${COMPETITION_ENGINE_VERSION}
    FROM g
  `;
};

// The end event, on the guard rather than on a NOT EXISTS scan. That scan was
// not a deduplication, only a narrow race: two finalize calls arriving together
// both found no session_end and both wrote one. Two ways to reach that at once
// exist today, the client's timeout POST and the last answer of the round, and
// the timeout route can be called by anyone holding the identifier.
const insertSessionEndEventIfMissing = async (session: SessionRow) => {
  const endedGlobalQIndex = session.started_global_q_index + session.question_count;

  await sql`
    WITH g AS (
      INSERT INTO event_ingestion_guard (
        idempotency_key, user_id, session_id, ingestion_status
      )
      VALUES (
        ${`${session.session_id}:session_end`},
        ${session.user_id}::uuid,
        ${session.session_id}::uuid,
        'accepted'
      )
      ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING
      RETURNING 1
    )
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
      ${endedGlobalQIndex}::int,
      'session_end',
      ${COMPETITION_ENGINE_VERSION}
    FROM g
  `;
};

const finalizeCompetitionSession = async (
  session: SessionRow
): Promise<CompetitionTimeoutResponse> => {
  // COMPARE AND SET, `AND status = 'active'` in the WHERE. Between the read that
  // produced `session` and this statement, the sweep of another start can have
  // moved this round to 'abandoned' with an honest ended_at taken from its last
  // event. An unconditional UPDATE would flip it back to 'completed' and
  // overwrite that timestamp with the server's own clock, which is the fact table
  // claiming something that did not happen. The JS-side `if` alone never closed
  // that window, it only skipped the statement when the read already said closed.
  await sql`
    UPDATE sessions
    SET status = 'completed'::app.session_status_enum,
        ended_at = COALESCE(ended_at, now())
    WHERE session_id = ${session.session_id}::uuid
      AND status = 'active'
  `;

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

// A second submission for a question this session has already answered, and the
// only honest response to one. Another submission won the event_ingestion_guard
// primary key, so THIS call wrote nothing at all: no fact, no counter, no point.
// It therefore reads, and only reads.
//
// THE RESULT REPORTED IS THE ONE THE DATABASE RECORDED, not the one this call
// happened to carry. Two tabs can answer the same word differently and only one
// of the two answers exists in the journal, so echoing this call's own answerSlug
// would tell the player something the fact table denies. Same reasoning, and the
// same shape, as duplicateAnswerResponse in the training provider.
//
// It serves the next question rather than an error. A competition round lasts two
// minutes: a player who lost a race against their own retry must not spend the
// rest of it looking at a dead screen. The question is rebuilt from the REFRESHED
// session, so it is the one the winner's write moved the round on to.
const duplicateCompetitionAnswerResponse = async (
  session: SessionRow,
  userId: string,
  questionId: string
): Promise<CompetitionAnswerResponse | CompetitionTimeoutResponse> => {
  const refreshed = (await getSession(session.session_id)) ?? session;

  const [recorded] = await queryRows<{
    is_correct: boolean;
    response_time_ms: number;
  }>(sql`
    SELECT is_correct, response_time_ms
    FROM user_event_fact
    WHERE session_id = ${refreshed.session_id}::uuid
      AND question_id = ${questionId}::uuid
      AND event_type = 'answer'
    ORDER BY event_ts_utc ASC
    LIMIT 1
  `);

  // The read is guaranteed to find that row: the loser only reaches this branch
  // after blocking on the winner's transaction until it committed, so the
  // winner's fact is visible to the next statement. The fallbacks exist for the
  // one case that is not a race, a token replayed long after its round, where
  // reporting a wrong answer worth nothing is the conservative reading.
  const isCorrect = recorded?.is_correct === true;
  const responseTimeMs = recorded?.response_time_ms ?? 0;
  // No server measurement here, and none is wanted: the fact table stores the
  // recorded time, not the exchange that produced it, and this call is a read.
  // The number that matters, stats.score, comes from the session row and is
  // exact; this one only words the feedback line, so on the rare answer whose
  // bonus was refused it can read one point high. Storing the awarded points per
  // row would fix it and is a migration.
  const awardedPoints = awardPointsFor(isCorrect, responseTimeMs);

  const deadlineMs =
    new Date(refreshed.started_at).getTime() + COMPETITION_TOTAL_DURATION_MS;
  if (refreshed.status !== "active" || Date.now() >= deadlineMs) {
    return finalizeCompetitionSession(refreshed);
  }

  const pool = await getCompetitionPoolRows(userId);
  return {
    result: isCorrect ? "correct" : "wrong",
    awardedPoints,
    responseTimeMs,
    feedbackText: roundFeedbackText(isCorrect, awardedPoints),
    stats: buildStats(refreshed),
    nextQuestion: buildQuestion(refreshed, userId, pool),
    sessionComplete: false,
  };
};

// A round that nobody closed. The client closes its own on the timeout call, but
// a tab shut mid round, a phone locked, or a network that dropped the last
// request all leave the row 'active' for ever, and until now nothing swept them:
// the training sweep carries `AND s.mode = 'training'` on purpose, so it has
// never touched this mode. Measured on 2026-08-17: 121 competition sessions
// still 'active', the oldest from 2026-03-21.
//
// A COMPETITION ROUND HAS A HARD LENGTH, which is what makes this sweep simpler
// than training's. There is no inactivity to estimate: two minutes after
// started_at the round is over whether or not anyone said so. The window below is
// far wider than that, thirty minutes, purely to leave a late timeout call the
// chance to close its own session properly rather than find it already swept.
//
// NO SCORE CONSEQUENCE, and that is the point: question_count, correct_count and
// score are written answer by answer, so a swept round keeps every point it
// earned. Only its status and its closing time are settled here.
//
// ended_at comes from the LAST RECORDED EVENT of that session, not from now: the
// player left when they stopped answering, not when we noticed. With no event at
// all it falls back to started_at, giving a zero duration. No session_end event is
// written either, because no end ever happened.
//
// FAIL-SAFE: this runs AFTER the session row has committed. If it throws, the
// start must still return a playable round rather than a 500 over housekeeping.
const sweepAbandonedCompetitionSessions = async (
  userId: string,
  currentSessionId: string
) => {
  try {
    await sql`
      UPDATE sessions AS s
      SET status = 'abandoned'::app.session_status_enum,
          ended_at = COALESCE(
            (
              SELECT MAX(uef.event_ts_utc)
              FROM user_event_fact uef
              WHERE uef.session_id = s.session_id
            ),
            s.started_at
          )
      WHERE s.user_id = ${userId}::uuid
        AND s.mode = 'competition'
        AND s.status = 'active'
        AND s.session_id <> ${currentSessionId}::uuid
        AND s.started_at < now() - interval '30 minutes'
    `;
  } catch (error) {
    console.warn(
      "competition sweep failed; continuing without closing stale rounds.",
      error
    );
  }
};

// ---------------------------------------------------------------------------
// ONE ATTEMPT EQUALS ONE IDENTIFIER, ported from the training start path. The
// client mints a uuid per attempt, the server uses it as sessions.session_id, and
// the primary key that already exists arbitrates the race: no schema change, no
// advisory lock, no read before the write.
//
// Measured on 2026-08-17, before this: two competition starts fired together
// returned TWO session ids, where training returned one. Every duplicate round
// opened a second timer nobody was playing and a second row nothing would ever
// close.
//
// REJOINING A ROUND IS NOT RESTARTING IT, and that is the behaviour worth having
// here rather than merely the absence of a duplicate. The deadline is derived from
// the session's own started_at, so a reload rejoins the round with the time it has
// left, and buildQuestion rebuilds the current word from question_count. A reload
// can no longer buy a fresh two minutes.
//
// The single re-entry is NOT for the race. It exists for the one case the race
// cannot fix: an identifier that resolves to a row this client may not play,
// because it is closed, expired, or belongs to another user or another mode.
// ---------------------------------------------------------------------------
const MAX_START_REENTRIES = 1;

const isPlayableRound = (session: SessionRow) =>
  session.status === "active" &&
  Date.now() <
    new Date(session.started_at).getTime() + COMPETITION_TOTAL_DURATION_MS;

export const startCompetitionSession = async ({
  locale = "fr",
  guestUserId,
  attemptId = null,
}: {
  locale?: Locale;
  guestUserId?: string | null;
  attemptId?: string | null;
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

  // Validated again here even though the route already normalises it: the
  // provider is called directly by the proof scripts and by any future caller,
  // and an unvalidated string one line from a ::uuid cast is a 22P02 waiting to
  // become a 500 on a plain page load. An absent or malformed identifier is not
  // an error, it is simply not usable, so the server mints its own.
  let effectiveAttemptId = normalizeAttemptId(attemptId) ?? crypto.randomUUID();
  let reentered = false;
  let session: SessionRow | undefined;
  // Whether THIS call created the session row. Derived from the insert's own
  // RETURNING and from nothing else: a read taken before the write, or the mere
  // fact that a row exists afterwards, cannot tell the winner from the loser, and
  // the loser must not re-write a journal entry the winner already wrote.
  let wonTheInsert = false;

  for (let attemptsLeft = MAX_START_REENTRIES; attemptsLeft >= 0; attemptsLeft -= 1) {
    // session_id is supplied explicitly: the column has DEFAULT gen_random_uuid(),
    // so an insert that omitted it could never collide and the ON CONFLICT clause
    // would be unreachable syntax while every start kept writing its own row.
    const insertedSessions = await queryRows<SessionRow>(sql`
      INSERT INTO sessions (
        session_id,
        user_id,
        mode,
        status,
        locale,
        seed,
        engine_version,
        started_global_q_index,
        score
      ) VALUES (
        ${effectiveAttemptId}::uuid,
        ${user.user_id}::uuid,
        'competition',
        'active',
        ${user.locale},
        ${seed},
        ${COMPETITION_ENGINE_VERSION},
        ${user.global_q_index},
        0
      )
      ON CONFLICT (session_id) DO NOTHING
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

    wonTheInsert = insertedSessions.length > 0;

    let candidate = insertedSessions[0];
    if (!candidate) {
      // The loser holds zero rows until this statement fills them in. Scoped by
      // user_id and mode as well as by the key, because the key alone would hand
      // a guessed identifier to whoever asked, and would serve a training row as
      // a competition round.
      //
      // THE SEED IS THE POINT OF THIS READ, not a convenience: buildQuestion
      // reads session.seed below and the answer path writes it back into the
      // fact, so a loser that kept the seed it generated and never wrote would
      // serve a word and a signed token that disagree with what gets recorded.
      const rejoinedSessions = await queryRows<SessionRow>(sql`
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
        WHERE session_id = ${effectiveAttemptId}::uuid
          AND user_id = ${user.user_id}::uuid
          AND mode = 'competition'
        LIMIT 1
      `);
      candidate = rejoinedSessions[0];
    }

    // An EXPIRED round is not playable either, and that test is what training
    // does not need. A training session has no length, so 'active' is the whole
    // question there; a competition round dies of its own clock two minutes in,
    // and rejoining one would serve a question against a deadline already past.
    if (candidate && isPlayableRound(candidate)) {
      session = candidate;
      break;
    }

    // Nothing to join, or a row this client may not play. Mint a fresh
    // identifier and re-enter the insert, once, then give up with an explicit
    // error rather than spin.
    if (attemptsLeft > 0) {
      effectiveAttemptId = crypto.randomUUID();
      reentered = true;
    }
  }

  if (!session) {
    throw new Error(
      reentered
        ? "Competition start found no playable round after one re-entry on a fresh identifier."
        : "Competition start returned no session row."
    );
  }

  // THE SWEEP RUNS AFTER THE INSERT, and the current round is excluded BY ID.
  // Run before, it would have nothing to exclude: a reload sends the same id back,
  // and a sweep with no exclusion would abandon the round we are about to rejoin.
  await sweepAbandonedCompetitionSessions(user.user_id, session.session_id);

  // Only the call that actually created the row writes its session_start. A call
  // that rejoined is reading a row whose session_start the creator already wrote.
  if (wonTheInsert) {
    await insertSessionStartEvent(session);
  }

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
    throw new GameRequestError(
      "invalid_question_token",
      "Invalid competition question token."
    );
  }

  if (!payload.options.includes(answerSlug)) {
    throw new GameRequestError(
      "invalid_answer_option",
      "Answer slug is not one of the four options this token carries."
    );
  }

  // THREE READS THAT DO NOT DEPEND ON EACH OTHER, so they leave together.
  //
  // They used to run in file: the session, then the session's user, then that
  // user's mastery for this face. Each one waited for the previous, and on a
  // serverless HTTP driver a wait is a network round trip. Measured on a
  // production build on 2026-08-17: one trivial query costs about 18 ms, so the
  // two avoidable waits were about a tenth of the whole answer.
  //
  // WHAT MAKES IT SAFE, and it is the token, not luck. The user is looked up by
  // payload.userId instead of session.user_id, which is what removes the
  // dependency, and the identity check below is the same guarantee written the
  // other way round: it used to fetch the SESSION'S user and compare it to the
  // token's, it now fetches the TOKEN'S user and compares it to the session's.
  // Both refuse exactly when the two disagree. The token is signed, so its
  // userId is no more forgeable than the session id already posted.
  //
  // The pool leaves with them, and that one is the real saving: 1172 rows, about
  // 52 ms, read on EVERY answer to build the NEXT question. It depends on the
  // player and on nothing this call writes, competition never touching mastery,
  // so it has no business sitting on the critical path after the write.
  const poolPromise = getCompetitionPoolRows(payload.userId);
  // Attached immediately: an unawaited rejection is an unhandled rejection, and
  // in a request handler that is a process-level event rather than a 500.
  poolPromise.catch(() => {});

  const [session, user, masteryRows] = await Promise.all([
    getSession(sessionId),
    getUser(payload.userId),
    queryRows<{ mastery_level: number }>(sql`
      SELECT COALESCE(uts.mastery_level, 0) AS mastery_level
      FROM typefaces_core tc
      LEFT JOIN user_typeface_state uts
        ON uts.user_id = ${payload.userId}::uuid
       AND uts.typeface_slug = tc.typeface_slug
      WHERE tc.typeface_slug = ${payload.typefaceSlug}
      LIMIT 1
    `),
  ]);

  if (!session) {
    throw new GameRequestError("session_not_found", "Competition session not found.");
  }

  if (!user || session.user_id !== user.user_id) {
    throw new GameRequestError(
      "identity_mismatch",
      "The signed token names a different player than the session does."
    );
  }

  if (session.status !== "active") {
    return finalizeCompetitionSession(session);
  }

  const expectedGlobalQIndex = session.started_global_q_index + session.question_count;
  if (payload.globalQIndex !== expectedGlobalQIndex) {
    // A token can only carry an earlier index because its question was already
    // answered: buildQuestion never issues two tokens for one index, and the
    // client never holds two. So the overwhelmingly likely reader of this branch
    // is a replay, not an attack, and the honest response is the state the
    // database recorded. It used to throw, which the route turned into a 500 and
    // the screen into "unable to answer" on a round that was working fine.
    return duplicateCompetitionAnswerResponse(session, user.user_id, payload.questionId);
  }

  const deadlineMs =
    new Date(session.started_at).getTime() + COMPETITION_TOTAL_DURATION_MS;
  if (Date.now() >= deadlineMs) {
    return finalizeCompetitionSession(session);
  }

  const masteryLevel = masteryRows[0]?.mastery_level ?? 0;
  const isCorrect = answerSlug === payload.typefaceSlug;
  const awardedPoints = awardPointsFor(
    isCorrect,
    resolvedResponseTimeMs,
    serverElapsedFor(payload.issuedAtMs)
  );

  // ATOMIC WRITER (H2), the same CTE the training provider uses. The guard row
  // and the event are produced by a SINGLE statement: two identical concurrent
  // calls leave exactly one guard row and exactly one event, the loser's INSERT
  // ... ON CONFLICT blocking on the guard's primary key until the winner commits,
  // then finding the conflict, RETURNING nothing, so its SELECT ... FROM g yields
  // zero rows and it writes no event. Never a divorce between the two.
  //
  // IT REPLACES A SELECT COUNT READ BACK INTO JAVASCRIPT, which was racy by
  // construction: two submissions both read zero and both inserted. Measured on
  // 2026-08-17, two parallel POST on one question wrote TWO answer rows while the
  // session row stayed at question_count 1, so the journal and the session row
  // described different rounds. Training, given the same test, wrote one row.
  //
  // WHY NOT ON CONFLICT ON user_event_fact ITSELF: unchanged from training's own
  // note. The table is PARTITIONED BY RANGE (event_ts_utc) and Postgres requires
  // a unique index on a partitioned table to carry the partition key, so no
  // unique constraint exists on idempotency_key alone and `ON CONFLICT
  // (idempotency_key)` raises 42P10. The uniqueness lives in
  // event_ingestion_guard, whose primary key IS (user_id, session_id,
  // idempotency_key).
  //
  // attempt_index is the literal 1, not a count derived inside the statement as
  // training has to do. Competition has no retry: a word is asked once, answered
  // once, and the round moves on. That is what makes the key computable here.
  const written = await queryRows<{ ok: number }>(sql`
    WITH g AS (
      INSERT INTO event_ingestion_guard (
        idempotency_key, user_id, session_id, ingestion_status
      )
      VALUES (
        ${`${sessionId}:${payload.questionId}:1`},
        ${user.user_id}::uuid,
        ${sessionId}::uuid,
        'accepted'
      )
      ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING
      RETURNING idempotency_key
    )
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
    )
    SELECT
      g.idempotency_key,
      ${user.user_id}::uuid,
      ${sessionId}::uuid,
      'competition',
      ${payload.globalQIndex}::int,
      ${payload.questionId}::uuid,
      1,
      'answer',
      ${payload.typefaceSlug},
      ${answerSlug},
      ${isCorrect}::boolean,
      ${resolvedResponseTimeMs}::int,
      ${masteryLevel}::smallint,
      ${masteryLevel}::smallint,
      false,
      false,
      ${payload.displayWord},
      ${isCorrect ? 'correct_first_try' : 'wrong_first_try'}::app.reason_code_enum,
      ${session.seed}::bigint,
      ${COMPETITION_ENGINE_VERSION}
    FROM g
    RETURNING 1 AS ok
  `);

  // Zero rows: another submission for this same question won the guard. It has
  // already written the fact and already moved the counters. Re-running the
  // UPDATE below would add a second point and a second answered question for one
  // word, which is not a harmless duplicate row but a wrong score. Everything
  // that writes sits below this checkpoint.
  if (written.length === 0) {
    return duplicateCompetitionAnswerResponse(session, user.user_id, payload.questionId);
  }

  const shouldComplete = Date.now() >= deadlineMs;

  // THE THREE COUNTERS INCREMENT INSIDE THE STATEMENT and are read back through
  // RETURNING, never computed in JavaScript from a row a prior SELECT saw. The
  // previous version set them absolutely from `session`, read at the top of this
  // call, so two answers landing together both started from the same value and
  // the second erased the first. Measured on 2026-08-17: two answers written,
  // question_count 1 and score 2 instead of 4. `SET col = col + n` cannot lose a
  // concurrent increment, there is no JS read in between.
  //
  // status and ended_at are compare-and-set, not overwritten. The old statement
  // wrote ended_at = null on every answer that did not end the round, which was
  // harmless only while nothing else could close a session mid round. The sweep
  // added above can, so an unconditional write here would resurrect a round it
  // had just abandoned and blank the honest closing time it took from the last
  // event.
  //
  // now(), never a JS Date. started_at comes from the database and
  // chk_ended_after_started compares the two, so mixing the two clocks puts a
  // CHECK violation one skew away. Measured today between this machine and Neon:
  // 20 ms, which is small and is not a guarantee.
  const updatedRows = await queryRows<SessionRow>(sql`
    UPDATE sessions
    SET question_count = question_count + 1,
        correct_count = correct_count + ${isCorrect ? 1 : 0}::int,
        score = score + ${awardedPoints}::int,
        status = CASE WHEN ${shouldComplete}::boolean
                      THEN 'completed'::app.session_status_enum
                      ELSE status END,
        ended_at = CASE WHEN ${shouldComplete}::boolean
                        THEN COALESCE(ended_at, now())
                        ELSE ended_at END
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
      feedbackText: finalFeedbackText(isCorrect, awardedPoints),
      stats: {
        ...buildStats(updatedSession),
        remainingMs: 0,
      },
      summary,
    };
  }

  // Already in flight since the top of this call, so this await is free.
  const pool = await poolPromise;
  return {
    result: isCorrect ? "correct" : "wrong",
    awardedPoints,
    responseTimeMs: resolvedResponseTimeMs,
    feedbackText: roundFeedbackText(isCorrect, awardedPoints),
    stats: buildStats(updatedSession),
    nextQuestion: buildQuestion(updatedSession, user.user_id, pool),
    sessionComplete: false,
  };
};

// IDENTITY COMES FROM THE COOKIE, NEVER FROM THE BODY, and this path did not ask
// for it at all until 2026-08-17. Measured that day: a second player, holding
// only the identifier, closed somebody else's round. It went from 'active' to
// 'completed' on their behalf, which freezes whatever score it had reached and
// ends their two minutes early.
//
// Not remotely exploitable, the identifier being a uuid published nowhere: it
// lives in the player's own memory and their own request bodies. That is a reason
// it never happened, not a reason it may stay open. The training end path has
// been scoped by user and mode since it was written (endTrainingSession), and its
// query is the model followed here.
//
// The lookup itself carries the scope, rather than a read followed by a
// comparison in JavaScript: a row this caller may not play must not be READ at
// all, or the refusal message can end up describing somebody else's round.
export const timeoutCompetitionSession = async ({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}): Promise<CompetitionTimeoutResponse> => {
  const ownedRows = await queryRows<SessionRow>(sql`
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
      AND user_id = ${userId}::uuid
      AND mode = 'competition'
    LIMIT 1
  `);

  const session = ownedRows[0];
  if (!session) {
    throw new GameRequestError(
      "session_not_found",
      "Competition round not found for this player."
    );
  }

  return finalizeCompetitionSession(session);
};
