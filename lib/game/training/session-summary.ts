// Statement-level `import type` on purpose: it is erased entirely, so this module
// has no runtime import at all and Node can load it directly after stripping types.
// That is what would let a pure, database-free self-test exercise the arithmetic
// below without a bundler or an alias loader. Such a script
// (scripts/quality/check-session-lifecycle.mjs) existed but described a training
// refactor that was not yet in this repository's tracked history; commit 457ab51
// deliberately untracked it for whoever lands that refactor. It is not part of
// this repository at HEAD.
import type { TrainingSessionSummary } from "@/lib/game/training/contracts";

// Session bilan, computed from facts.
//
// A training session is temporary, the progression is permanent (vision §2, I-17).
// This module produces the temporary part: what happened during ONE session. It
// stores nothing and decides nothing about presentation; it reads the answer
// events of a session and returns numbers.
//
// PURE ON PURPOSE. Everything it needs is passed in, so it can be exercised with
// synthetic rows and no database. No such self-test is currently tracked in this
// repository (see the note on the import above). The provider does the reading,
// this does the arithmetic.

/**
 * One answer event of the session, as stored in user_event_fact.
 *
 * answer_slug is nullable: the column allows NULL (db/migrations/001_user_event_fact.sql),
 * and chk_answer_fields_required (db/migrations/001b_event_type.sql) does not
 * require it for event_type = 'answer'. It is NULL exactly when reason_code is
 * 'timeout' or 'invalid_answer' (chk_answer_slug, migration 001). The current
 * provider validates the chosen slug against the option list before writing a row,
 * so its own writes are never null, but a legacy or backfilled row can still be,
 * and this type has to admit that or a real null throws downstream (see the
 * null-safe sort in `confusions` below).
 */
export type SummaryAnswerRow = {
  question_id: string;
  typeface_slug: string;
  answer_slug: string | null;
  is_correct: boolean;
  attempt_index: number;
  response_time_ms: number;
  mastery_before: number;
  mastery_after: number;
};

export type SummaryInput = {
  startedAt: Date;
  endedAt: Date;
  rows: readonly SummaryAnswerRow[];
  /** Slugs this user had already answered BEFORE this session started. */
  previouslySeenSlugs: readonly string[];
  /** Pool figures at closing time, from the existing progression aggregate. */
  poolSize?: number;
  facesMastered?: number;
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
};

export const buildTrainingSessionSummary = (input: SummaryInput): TrainingSessionSummary => {
  const { rows, previouslySeenSlugs } = input;

  // A question can carry several attempts (retry is allowed in training, I-14).
  // First attempts are the graded ones, so accuracy is measured on them only:
  // counting retries would let a player lower their own accuracy by exploring.
  const firstAttempts = rows.filter((row) => row.attempt_index === 1);
  const retries = rows.filter((row) => row.attempt_index > 1);

  const resolvedQuestionIds = new Set(
    rows.filter((row) => row.is_correct).map((row) => row.question_id)
  );

  const firstTryCorrect = firstAttempts.filter((row) => row.is_correct).length;

  const seenSlugs = new Set(rows.map((row) => row.typeface_slug));
  const alreadySeen = new Set(previouslySeenSlugs);

  const reinforced = new Set(
    firstAttempts
      .filter((row) => row.mastery_after > row.mastery_before)
      .map((row) => row.typeface_slug)
  );
  const weakened = new Set(
    firstAttempts
      .filter((row) => row.mastery_after < row.mastery_before)
      .map((row) => row.typeface_slug)
  );

  // Confusion pairs: which face was shown, which name was picked instead. Only
  // first attempts count, for the same reason accuracy does. `chosen` can be
  // null: a timeout or an invalid answer writes answer_slug NULL (see the type
  // above), and that is a real confusion too, just one with no name picked.
  const confusionCounts = new Map<
    string,
    { shown: string; chosen: string | null; count: number }
  >();
  for (const row of firstAttempts) {
    if (row.is_correct) continue;
    const key = `${row.typeface_slug}>${row.answer_slug}`;
    const existing = confusionCounts.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    confusionCounts.set(key, {
      shown: row.typeface_slug,
      chosen: row.answer_slug,
      count: 1,
    });
  }

  // Null-safe on purpose: `chosen` can be null (see above), and
  // `null.localeCompare` throws. Nulls sort after every named slug, since a
  // timeout carries less information than a named confusion.
  const compareChosen = (left: string | null, right: string | null) => {
    if (left === right) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return left.localeCompare(right);
  };

  const confusions = [...confusionCounts.values()].sort(
    (left, right) =>
      right.count - left.count ||
      left.shown.localeCompare(right.shown) ||
      compareChosen(left.chosen, right.chosen)
  );

  const responseTimes = firstAttempts
    .map((row) => row.response_time_ms)
    .filter((value) => Number.isFinite(value) && value >= 0);

  const masteryNet = firstAttempts.reduce(
    (total, row) => total + (row.mastery_after - row.mastery_before),
    0
  );

  return {
    durationMs: Math.max(0, input.endedAt.getTime() - input.startedAt.getTime()),
    questionsResolved: resolvedQuestionIds.size,
    answersSubmitted: rows.length,
    firstTryCorrect,
    firstTryAccuracy:
      firstAttempts.length > 0 ? firstTryCorrect / firstAttempts.length : 0,
    retryCount: retries.length,
    typefacesSeen: seenSlugs.size,
    typefacesDiscovered: [...seenSlugs].filter((slug) => !alreadySeen.has(slug)).sort(),
    typefacesReinforced: [...reinforced].sort(),
    typefacesWeakened: [...weakened].sort(),
    masteryNet,
    confusions,
    medianResponseMs: median(responseTimes),
    fastestResponseMs: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
    slowestResponseMs: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
    poolSize: input.poolSize,
    facesMastered: input.facesMastered,
  };
};
