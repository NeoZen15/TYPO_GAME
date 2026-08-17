import "server-only";

import crypto from "node:crypto";

import {
  getTrainingDisplayWord,
  TRAINING_ENGINE_VERSION,
} from "@/lib/game/training/catalog";
import {
  getRuntimeFontFace,
  getRuntimeFontFamily,
  hasRuntimeFace,
} from "@/lib/game/fonts/runtime-catalog";
import {
  type Familiarity,
  type Locale,
  type TrainingAnswerResponse,
  type TrainingEndResponse,
  type TrainingQuestion,
  type TrainingStartInput,
  type TrainingStartResponse,
  normalizeAttemptId,
} from "@/lib/game/training/contracts";
import {
  buildTrainingSessionSummary,
  type SummaryAnswerRow,
} from "@/lib/game/training/session-summary";
import {
  RUNTIME_ALLOWED_LICENSE_TYPES,
  UFL_LEGACY_SLUGS,
} from "@/lib/game/license-guard";
import { LATIN_UNREADY_SLUGS } from "@/lib/game/latin-coverage-guard";
import {
  createQuestionToken,
  verifyQuestionToken,
  type TrainingQuestionTokenPayload,
} from "@/lib/game/training/question-token";
import {
  orderOptionsForDisplay,
  pickDistractors,
  pickEligibleTypeface,
} from "@/lib/game/training/question-shape";
import { GameRequestError } from "@/lib/game/request-error";
import { loadTrainingProgress } from "@/lib/profile/profile-stats";
import { sql } from "@/lib/server/neon";

type PoolRow = {
  state_id: string;
  typeface_slug: string;
  mastery_level: number;
  next_due_after_q: number;
  session_errors: number;
  consecutive_session_errors: number;
  consecutive_correct: number;
  adaptive_coef: number;
  primary_category: string;
  visual_cluster_id: string;
  difficulty_base: string;
  display_name: string;
};

type UserRow = {
  user_id: string;
  locale: Locale;
  global_q_index: number;
  // Read along with the rest of the row rather than by its own query. It is what
  // lets the answer path decide, for free, whether the stage 4 rebalance can
  // possibly apply to this player. See maybeRebalancePool.
  onboarding_familiarity?: string | null;
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

const buildQuestion = (
  sessionId: string,
  user: UserRow,
  sessionSeed: string,
  pool: PoolRow[]
): TrainingQuestion => {
  // FAIL CLOSED on the rendering chain. The correct answer is the face the player
  // must recognise, so it can only be a face the screen can actually declare. A
  // face without a runtime descriptor would render in a fallback font, and the
  // question would ask for a typeface that is not on screen: unanswerable except
  // by luck. Distractors keep the full pool, they are only labels.
  //
  // On today's data this filter removes nothing (1172 active faces, 1172 with a
  // ready descriptor). It exists so that a future import, or a slug renamed on one
  // side only, breaks loudly here instead of silently degrading the question.
  const renderablePool = pool.filter((row) => hasRuntimeFace(row.typeface_slug));

  const correct = pickEligibleTypeface(renderablePool, user.global_q_index, sessionSeed);
  if (!correct) {
    throw new Error(
      pool.length > 0
        ? "No renderable training typeface in active pool (faces present but none has a runtime font descriptor)."
        : "No training typeface available in active pool."
    );
  }

  const distractors = pickDistractors(pool, correct, user.global_q_index, sessionSeed);
  const optionRows = orderOptionsForDisplay(correct, distractors);

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
    fontFamily: getRuntimeFontFamily(correct.typeface_slug, correct.display_name),
    fontFace: getRuntimeFontFace(correct.typeface_slug),
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

// The declared familiarity is only a COLD-START prior. If a player declares an
// advanced level ("Quite familiar" / "Designer") but gets the onboarding warm-up
// WRONG, we treat the declaration as one notch too high and seed accordingly.
// One notch only, only for advanced declarers who fail. Any other case (correct,
// beginner, or missing signal) leaves the declared level untouched.
const downgradeOneNotch = (familiarity: Familiarity): Familiarity => {
  if (familiarity === "Designer") return "Quite familiar";
  if (familiarity === "Quite familiar") return "A little";
  return familiarity;
};

const effectiveFamiliarity = (
  familiarity: Familiarity | null,
  warmupCorrect: boolean | null | undefined
): Familiarity | null => {
  if (!familiarity) return familiarity;
  const declaredAdvanced = familiarity === "Designer" || familiarity === "Quite familiar";
  if (warmupCorrect === false && declaredAdvanced) {
    return downgradeOneNotch(familiarity);
  }
  return familiarity;
};

// Cold-start seeding. When familiarity is known we use the familiarity-aware
// overload (migration 004) so novices skew EASY and confident/designers skew
// HARD. The declared level is first passed through effectiveFamiliarity so a
// mis-declared expert who flunked the warm-up starts one notch lower. If that
// overload is not deployed yet we fall back to base seeding so training never breaks.
const seedUserPool = async (
  userId: string,
  familiarity: Familiarity | null,
  warmupCorrect: boolean | null | undefined
) => {
  const seedFamiliarity = effectiveFamiliarity(familiarity, warmupCorrect);
  if (seedFamiliarity) {
    try {
      await sql`SELECT init_user_pool(${userId}::uuid, ${seedFamiliarity})`;
      return;
    } catch (error) {
      console.warn(
        "init_user_pool(familiarity) unavailable; using default seeding.",
        error
      );
    }
  }

  await sql`SELECT init_user_pool(${userId}::uuid)`;
};

// Record the onboarding signal once (analytics + future re-seeding). Guarded so
// a missing column (migration 004 not applied) does not break session start.
const recordOnboardingFamiliarity = async (userId: string, familiarity: Familiarity) => {
  try {
    await sql`
      UPDATE users
      SET onboarding_familiarity = ${familiarity}
      WHERE user_id = ${userId}::uuid
        AND onboarding_familiarity IS NULL
    `;
  } catch (error) {
    console.warn("Could not persist onboarding_familiarity.", error);
  }
};

// Stage 4 — downward pool rebalance ("redescendre"). After the early window a
// declared-advanced player whose real accuracy is low gets EASIER faces ADDED to
// the pool (never removed: invariant I-06). The heavy lifting is an add-only SQL
// function rebalance_user_pool (migration 007). This is FAIL-SAFE: if 007 is not
// applied yet the SELECT throws (function missing) and we swallow it, so training
// keeps working unchanged. The feature activates the moment 007 is applied.
const EARLY_WINDOW_MIN = 8;
const EARLY_WINDOW_MAX = 12;
const LOW_ACCURACY_THRESHOLD = 0.4;

// TWO FREE REFUSALS BEFORE THE EXPENSIVE ONE, and they are what makes this
// affordable. The query below counts the player's ENTIRE answer history, and it
// ran on every correct answer, for a stage that can fire at most once in a
// player's life, inside a five question window, and only for someone who
// declared themselves advanced. The cost grew with the history and the result
// was thrown away for almost everybody.
//
// Both gates read values the answer path already holds, so they cost nothing:
//
//   1. The declared level now travels on the users row the caller already read,
//      instead of being fetched by the scalar subquery below.
//   2. global_q_index past the window means the window is past. Sound, not
//      approximate: the cursor only advances on a correct answer, every answered
//      question carries exactly one attempt_index = 1 row, so the number of
//      graded first tries is always at least the cursor. A cursor beyond
//      EARLY_WINDOW_MAX therefore proves the count is too.
const maybeRebalancePool = async (user: UserRow) => {
  const declaredAdvanced =
    user.onboarding_familiarity === "Quite familiar" ||
    user.onboarding_familiarity === "Designer";
  if (!declaredAdvanced) return;
  if (user.global_q_index > EARLY_WINDOW_MAX) return;

  const userId = user.user_id;
  try {
    const rows = await queryRows<{
      answers: number;
      correct: number;
    }>(sql`
      SELECT
        COUNT(*)::int AS answers,
        COUNT(*) FILTER (WHERE is_correct)::int AS correct
      FROM user_event_fact
      WHERE user_id = ${userId}::uuid
        AND event_type = 'answer'
        AND attempt_index = 1
    `);

    const row = rows[0];
    if (!row) return;

    const answers = Number(row.answers) || 0;
    // Only act once, inside the early window (first ~8..12 graded first tries).
    if (answers < EARLY_WINDOW_MIN || answers > EARLY_WINDOW_MAX) return;

    const accuracy = answers > 0 ? Number(row.correct) / answers : 1;
    if (accuracy >= LOW_ACCURACY_THRESHOLD) return;

    // Add-only, idempotent (INSERT ... ON CONFLICT DO NOTHING inside the function).
    await sql`SELECT rebalance_user_pool(${userId}::uuid)`;
  } catch (error) {
    console.warn(
      "rebalance_user_pool skipped (migration 007 not applied or read failed).",
      error
    );
  }
};

const ensureUserPool = async (
  userId: string,
  familiarity: Familiarity | null,
  warmupCorrect: boolean | null | undefined
) => {
  const countRows = await queryRows<CountRow>(sql`
    SELECT COUNT(*)::text AS count
    FROM user_typeface_state
    WHERE user_id = ${userId}::uuid
  `);

  const count = Number.parseInt(countRows[0]?.count ?? "0", 10);
  if (count > 0) {
    return;
  }

  await seedUserPool(userId, familiarity, warmupCorrect);

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

// Every training round reads its material here: pickEligibleTypeface takes the
// correct answer from this pool and pickDistractors takes the three wrong labels
// from the same rows. Filtering the licence at this single read is what makes the
// guard impossible to bypass, including for a slug that a pool seeding function
// (init_user_pool, try_unlock_one_typeface, rebalance_user_pool) inserted into
// user_typeface_state without checking. See lib/game/license-guard.ts.
//
// TWIN of db/migrations/012_pool_serialisation.sql::try_unlock_if_pool_stuck.
// That function's precondition decides whether the pool looks stuck enough to
// justify an unlock, and it MUST apply the same four filters as this query
// (activation_status, the licence allowlist, the UFL legacy fallback, the
// latin coverage exclusion), fed the same three arrays as below. A row
// invisible here but counted eligible there dies permanently: an invisible
// row is never served, so never rescheduled, so its next_due_after_q never
// moves off its seeded 0. Kept in sync by
// scripts/quality/check-pool-serialisation.mjs.
const getPoolRows = async (userId: string) =>
  queryRows<PoolRow>(sql`
    SELECT
      uts.state_id,
      uts.typeface_slug,
      uts.mastery_level,
      uts.next_due_after_q,
      uts.session_errors,
      uts.consecutive_session_errors,
      uts.consecutive_correct,
      uts.adaptive_coef,
      tc.primary_category::text AS primary_category,
      tc.visual_cluster_id,
      tc.difficulty_base::text AS difficulty_base,
      tc.display_name
    FROM user_typeface_state uts
    JOIN typefaces_core tc
      ON tc.typeface_slug = uts.typeface_slug
    WHERE uts.user_id = ${userId}::uuid
      AND uts.in_active_pool = true
      AND tc.activation_status = true
      AND (
        tc.license_type::text = ANY(${[...RUNTIME_ALLOWED_LICENSE_TYPES]}::text[])
        OR tc.typeface_slug = ANY(${[...UFL_LEGACY_SLUGS]}::text[])
      )
      AND tc.typeface_slug <> ALL(${[...LATIN_UNREADY_SLUGS]}::text[])
    ORDER BY uts.updated_at ASC, tc.display_name ASC
  `);

// Spec §4.1 — per-box interval windows (in questions). The interval scales with
// the NEXT mastery level, so a face that just dropped to L0/L1 comes back soon
// while a stabilised L4 face waits 80..150 questions. This is what makes a
// mis-declared expert visibly redescend: every miss shortens the interval.
const INTERVAL_WINDOW: Record<number, readonly [number, number]> = {
  0: [1, 3],
  1: [3, 6],
  2: [10, 25],
  3: [25, 50],
  4: [80, 150],
};

// Deterministic point in the window (midpoint) so the scheduler stays testable
// (spec §4.2 uses a uniform draw; a fixed midpoint keeps behaviour reproducible).
// The adaptive coef then shortens (coef > 1) or lengthens (coef < 1) the interval
// (spec §4.2: adjusted = round(base / adaptive_weight)), and the absolute cooldown
// floor (I-01 wrong >= 2, I-02 correct >= 5) is applied LAST so the coef can never
// break the cooldown invariants (I-13).
const intervalForLevel = (
  nextMastery: number,
  adaptiveCoef: number,
  minCooldown: number
) => {
  const [lo, hi] = INTERVAL_WINDOW[nextMastery] ?? INTERVAL_WINDOW[0];
  const base = Math.round((lo + hi) / 2);
  const adjusted = Math.round(base / adaptiveCoef);
  return Math.max(minCooldown, adjusted);
};

const computeWrongNextDue = (
  globalQIndex: number,
  nextMastery: number,
  adaptiveCoef: number
) => globalQIndex + intervalForLevel(nextMastery, adaptiveCoef, 2);

const computeCorrectNextDue = (
  globalQIndex: number,
  nextMastery: number,
  adaptiveCoef: number
) => globalQIndex + intervalForLevel(nextMastery, adaptiveCoef, 5);

// ATOMIC WRITER (H2, proven by execution on 2026-07-31). The guard row and the
// event are produced by a single CTE statement: WITH g AS (INSERT INTO
// event_ingestion_guard ... ON CONFLICT DO NOTHING RETURNING 1) INSERT INTO
// user_event_fact ... SELECT ... FROM g. Two identical concurrent calls leave
// exactly one guard row and exactly one event: the loser's INSERT ... ON
// CONFLICT blocks on the guard's primary key until the winner commits, then
// finds the conflict, RETURNING nothing, so the SELECT ... FROM g on its side
// yields zero rows and it writes no event. Never a divorce between the two.
//
// WHY NOT ON CONFLICT ON user_event_fact ITSELF. That table is PARTITIONED BY
// RANGE (event_ts_utc), and Postgres requires a unique index on a partitioned
// table to carry the partition key: the only one is uq_event_id (event_id,
// event_ts_utc). There is no unique constraint on idempotency_key alone, so
// `ON CONFLICT (idempotency_key)` raises 42P10. Verified on a throwaway Neon
// branch on 2026-07-29. The uniqueness therefore lives in
// event_ingestion_guard instead, whose primary key IS (user_id, session_id,
// idempotency_key) (db/migrations/001_user_event_fact.sql:13-23).
const insertSessionStartEvent = async (
  sessionId: string,
  userId: string,
  globalQIndex: number,
  engineVersion: string
) => {
  await sql`
    WITH g AS (
      INSERT INTO event_ingestion_guard (
        idempotency_key, user_id, session_id, ingestion_status
      )
      VALUES (
        ${`${sessionId}:session_start`}, ${userId}::uuid, ${sessionId}::uuid, 'accepted'
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
      ${`${sessionId}:session_start`},
      ${userId}::uuid,
      ${sessionId}::uuid,
      'training',
      ${globalQIndex}::int,
      'session_start',
      ${engineVersion}
    FROM g
  `;
};

// Append-only trace for the pool-growth / recovery analytics (spec §10.1:
// pool_unlocked, pool_recovered_by_unlock, pool_recovered_by_cursor_jump).
// user_event_fact has no JSONB payload column, so only the stable fields the
// schema exposes are written (event_type + typeface_slug + global_q_index).
// FAIL-SAFE: the two recovery enum values are added by migration 008; before it
// is applied the enum cast throws and we swallow it, so the round never breaks.
const logPoolEvent = async (
  sessionId: string,
  userId: string,
  globalQIndex: number,
  eventType:
    | "pool_unlocked"
    | "pool_recovered_by_unlock"
    | "pool_recovered_by_cursor_jump",
  typefaceSlug: string
) => {
  try {
    await sql`
      INSERT INTO user_event_fact (
        idempotency_key,
        user_id,
        session_id,
        mode,
        global_q_index,
        event_type,
        typeface_slug,
        engine_version
      ) VALUES (
        ${`${sessionId}:${eventType}:${typefaceSlug}:${globalQIndex}`},
        ${userId}::uuid,
        ${sessionId}::uuid,
        'training',
        ${globalQIndex},
        ${eventType}::app.event_type_enum,
        ${typefaceSlug},
        ${TRAINING_ENGINE_VERSION}
      )
    `;
  } catch (error) {
    console.warn(`Could not log ${eventType} event (migration 008 not applied?).`, error);
  }
};

// I-07 growth trigger. Called on the FIRST crossing of a face to mastery 4.
// register_mastery_unlock (migration 008) increments users.pending_unlock_count
// and, on the 3rd distinct crossing (POOL_UNLOCK_THRESHOLD), introduces ONE new
// typeface and resets the counter. FAIL-SAFE: if 008 is not applied the function
// is missing, the call throws, we warn, and training keeps working unchanged.
const registerMasteryUnlock = async (
  userId: string,
  sessionId: string,
  globalQIndex: number
) => {
  try {
    const rows = await queryRows<{ slug: string | null }>(
      sql`SELECT register_mastery_unlock(${userId}::uuid) AS slug`
    );
    const unlocked = rows[0]?.slug ?? null;
    if (unlocked) {
      await logPoolEvent(sessionId, userId, globalQIndex, "pool_unlocked", unlocked);
    }
  } catch (error) {
    console.warn("register_mastery_unlock skipped (migration 008 not applied).", error);
  }
};

// An item is selectable when its cooldown has elapsed (spec §4.3 step 2). Mirrors
// the eligibility test in pickEligibleTypeface so the recovery decision below and
// the actual selection agree on what "no eligible" means.
const isPoolItemEligible = (row: PoolRow, globalQIndex: number) =>
  row.next_due_after_q <= globalQIndex;

// Spec §4.5 step 2 — silent cursor jump. When nothing is eligible, jump the
// scheduler cursor (users.global_q_index) forward to the earliest next_due so
// the least-overdue item becomes selectable. I-01/I-02 are never relaxed: we
// move the cursor to satisfy the cooldown, never shorten the cooldown itself.
const recoverByCursorJump = async (
  userId: string,
  sessionId: string,
  globalQIndex: number,
  pool: PoolRow[]
): Promise<{ pool: PoolRow[]; globalQIndex: number }> => {
  if (pool.length === 0) {
    return { pool, globalQIndex };
  }

  const candidate = pool.reduce(
    (min, row) => (row.next_due_after_q < min.next_due_after_q ? row : min),
    pool[0]
  );
  const recoveryQ = Math.max(globalQIndex, candidate.next_due_after_q);

  if (recoveryQ !== globalQIndex) {
    try {
      await sql`
        UPDATE users
        SET global_q_index = ${recoveryQ}
        WHERE user_id = ${userId}::uuid
      `;
    } catch (error) {
      console.warn("cursor-jump recovery could not advance global_q_index.", error);
      return { pool, globalQIndex };
    }
  }

  await logPoolEvent(
    sessionId,
    userId,
    recoveryQ,
    "pool_recovered_by_cursor_jump",
    candidate.typeface_slug
  );

  return { pool, globalQIndex: recoveryQ };
};

// Spec §4.5 — "pool sans eligible" (invisible cote joueur). Guarantees the game
// is NEVER stuck: (1) try a silent unlock (a fresh face enters with next_due=0,
// immediately eligible), else (2) a silent cursor jump. Both are logged. When at
// least one item is already eligible this is a no-op. FAIL-SAFE on migration 008.
const recoverPoolIfStuck = async (
  userId: string,
  sessionId: string,
  globalQIndex: number,
  pool: PoolRow[]
): Promise<{ pool: PoolRow[]; globalQIndex: number }> => {
  if (pool.some((row) => isPoolItemEligible(row, globalQIndex))) {
    return { pool, globalQIndex };
  }

  // Step 1 — controlled injection of a new typeface (spec §4.5), serialised per
  // user by migration 012. 012 is deliberately NOT applied in production yet, so
  // this call can raise 42883 "function does not exist" for as long as it is not.
  // In that window the OLD primitive is still the correct behaviour: falling
  // straight to the cursor jump would remove an unlock that works today.
  const tryUnlock = async (): Promise<string | null> => {
    try {
      // The three arrays passed here are the SAME visibility lists getPoolRows
      // uses below, so try_unlock_if_pool_stuck's precondition (its SQL twin)
      // can never drift from what actually gets served to the player.
      //
      // NAMED ARGUMENTS, DELIBERATELY. The three list parameters are all
      // text[], so positionally they are interchangeable: swapping two of them
      // raises nothing, Postgres cannot tell, and no static check can either.
      // The precondition would then match slugs against the licence allowlist
      // and licences against the slug lists, drift away from getPoolRows in
      // silence, and the §4.5 unlock would fire or not fire for the wrong
      // reasons. With "p_name => value" the name travels with the value and an
      // inversion cannot be written without seeing it. Required by
      // scripts/quality/check-pool-serialisation.mjs.
      const rows = await queryRows<{ slug: string | null }>(
        sql`SELECT try_unlock_if_pool_stuck(
          p_user_id => ${userId}::uuid,
          p_allowed_license_types => ${[...RUNTIME_ALLOWED_LICENSE_TYPES]}::text[],
          p_ufl_legacy_slugs => ${[...UFL_LEGACY_SLUGS]}::text[],
          p_latin_unready_slugs => ${[...LATIN_UNREADY_SLUGS]}::text[]
        ) AS slug`
      );
      return rows[0]?.slug ?? null;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "42883") throw error;
      console.warn(
        "try_unlock_if_pool_stuck missing (migration 012 not applied); retrying try_unlock_one_typeface.",
        error
      );
      const rows = await queryRows<{ slug: string | null }>(
        sql`SELECT try_unlock_one_typeface(${userId}::uuid) AS slug`
      );
      return rows[0]?.slug ?? null;
    }
  };

  try {
    const unlocked = await tryUnlock();
    if (unlocked) {
      await logPoolEvent(
        sessionId,
        userId,
        globalQIndex,
        "pool_recovered_by_unlock",
        unlocked
      );
      const refreshed = await getPoolRows(userId);
      if (refreshed.some((row) => isPoolItemEligible(row, globalQIndex))) {
        return { pool: refreshed, globalQIndex };
      }
      // New face somehow not eligible: fall through to the cursor jump on it.
      return recoverByCursorJump(userId, sessionId, globalQIndex, refreshed);
    }
  } catch (error) {
    console.warn("pool unlock skipped; falling back to cursor jump.", error);
  }

  // Step 2 — silent cursor jump on the least-overdue item (spec §4.5).
  return recoverByCursorJump(userId, sessionId, globalQIndex, pool);
};

// Progression aggregate for the in-game indicator. Reuses profile-stats
// (loadTrainingProgress -> buildEye -> levelFromXp), never rebuilds the maths.
// Fail-safe: if the read fails, the round still returns without the indicator.
const safeTrainingProgress = async (userId: string) => {
  try {
    return await loadTrainingProgress(userId);
  } catch (error) {
    console.warn("training progress aggregate unavailable.", error);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Global visible Dreyfus level (N.1..E.5) — spec I-08, line 708 ("Agregation
// des mastery_level"), acceptance N-22 (recomputed after EACH answer), N-24/N-25
// (toast on change only, never a continuous display), P-04 (bounded downward
// regression). This is NOT the XP-based eyeLevel (a separate volume system);
// it is the aggregated READ of mastery over the active pool.
//
// recompute_visible_level (migration 009) is a READ of the engine (I-08): it
// only READS user_typeface_state.mastery_level and WRITES the derived
// users.dreyfus_level / dreyfus_sub. It never touches mastery, intervals or the
// pool. Persisting the tier is exactly what lets try_unlock_one_typeface (008)
// reach harder dreyfus_tier faces and grow POOL_TARGET_BY_TIER with difficulty.
//
// FAIL-SAFE: before migration 009 is applied the function is missing; the call
// throws, we warn, and the round returns without the level (training unchanged).
// ---------------------------------------------------------------------------
type VisibleLevelRow = {
  prev_tier: string;
  prev_sub: number;
  new_tier: string;
  new_sub: number;
  changed: boolean;
};

const formatLevel = (tier: string, sub: number) => `${tier}.${sub}`;

// Recompute + persist the visible level after an answer (N-22). Returns the new
// level string plus whether it moved (drives the toast). Fail-safe: null if 009
// is not applied.
const safeRecomputeVisibleLevel = async (
  userId: string
): Promise<{ level: string; changed: boolean } | null> => {
  try {
    const rows = await queryRows<VisibleLevelRow>(
      sql`SELECT * FROM recompute_visible_level(${userId}::uuid)`
    );
    const row = rows[0];
    if (!row) return null;
    return { level: formatLevel(row.new_tier, row.new_sub), changed: row.changed };
  } catch (error) {
    console.warn("recompute_visible_level skipped (migration 009 not applied).", error);
    return null;
  }
};

// Read (never write) the persisted visible level for the session-start baseline.
// Reads only columns defined since migration 003, so it works before 009 too.
const safeReadVisibleLevel = async (userId: string): Promise<string | null> => {
  try {
    const rows = await queryRows<{ dreyfus_level: string; dreyfus_sub: number }>(sql`
      SELECT dreyfus_level, dreyfus_sub
      FROM users
      WHERE user_id = ${userId}::uuid
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    return formatLevel(row.dreyfus_level, row.dreyfus_sub);
  } catch (error) {
    console.warn("visible level read unavailable.", error);
    return null;
  }
};

// Answer feedback wording, shared by the normal answer path and by the
// duplicate path below so the two can never drift apart.
const CORRECT_FEEDBACK = "Correct. Good eye.";
const WRONG_FEEDBACK = "Incorrect. Try again.";

// A duplicate answer submission, and the only honest response to one. Another
// submission for this same question AND this same attempt index won the
// event_ingestion_guard primary key, so THIS call wrote nothing at all: no fact,
// no mastery, no counter, no pool move. It therefore reads, and only reads.
//
// It serves a coherent payload rather than an error, and it serves the next
// question when the recorded answer resolved the question. That is not
// politeness. The question token is not single use, so a client left sitting on
// a question that is already answered submits again, and that later submission,
// sent once the winner has committed, derives attempt_index 2 and gets recorded
// as a genuine retry. Handing the next question back is what keeps a duplicate
// from turning into a fabricated second attempt.
//
// The result reported is the one the DATABASE recorded, not the one this call
// happened to carry. Two tabs can answer the same question differently and only
// one of the two answers exists in the journal, so echoing this call's own
// answerSlug would tell the player something the fact table denies. The read is
// guaranteed to find that row: the loser only reaches this branch after blocking
// on the winner's transaction until it committed (H1), so the winner's fact is
// visible to the next statement.
//
// levelChanged is deliberately absent: N-24 and N-25 toast only when the level
// moved on THIS answer, and this answer moved nothing. The level is read, never
// recomputed, so this path cannot write through recompute_visible_level either.
const duplicateAnswerResponse = async (
  session: SessionRow,
  user: UserRow,
  questionId: string
): Promise<TrainingAnswerResponse> => {
  const [recorded] = await queryRows<{
    recorded_is_correct: boolean | null;
    resolved_count: number;
    global_q_index: number;
  }>(sql`
    SELECT
      (
        SELECT uef.is_correct
        FROM user_event_fact uef
        WHERE uef.session_id = ${session.session_id}::uuid
          AND uef.question_id = ${questionId}::uuid
          AND uef.event_type = 'answer'
        ORDER BY uef.attempt_index DESC
        LIMIT 1
      ) AS recorded_is_correct,
      (
        SELECT s.question_count
        FROM sessions s
        WHERE s.session_id = ${session.session_id}::uuid
      ) AS resolved_count,
      (
        SELECT u.global_q_index
        FROM users u
        WHERE u.user_id = ${user.user_id}::uuid
      ) AS global_q_index
  `);

  const resolved = recorded.recorded_is_correct === true;
  const visibleLevel = await safeReadVisibleLevel(user.user_id);

  let nextQuestion: TrainingQuestion | undefined;
  if (resolved) {
    try {
      // recoverPoolIfStuck is NOT called here: recovery WRITES (a silent unlock
      // or a cursor jump) and this path writes nothing. A frozen pool therefore
      // means no next question rather than a failed request, and the client's
      // next call takes the normal path, which does recover.
      nextQuestion = buildQuestion(
        session.session_id,
        { ...user, global_q_index: recorded.global_q_index },
        session.seed,
        await getPoolRows(user.user_id)
      );
    } catch (error) {
      console.warn("duplicate answer: no next question available.", error);
    }
  }

  return {
    result: resolved ? "correct" : "wrong",
    questionResolved: resolved,
    feedbackText: resolved ? CORRECT_FEEDBACK : WRONG_FEEDBACK,
    progress: {
      resolvedCount: recorded.resolved_count,
      ...(visibleLevel ? { visibleLevel } : {}),
    },
    ...(nextQuestion ? { nextQuestion } : {}),
  };
};

// ---------------------------------------------------------------------------
// ONE ATTEMPT EQUALS ONE IDENTIFIER. The client mints a uuid per attempt, the
// server uses it as sessions.session_id, and the primary key that already
// exists arbitrates the race: no schema change, no advisory lock, no read
// before the write.
//
// H1, proven by execution on a throwaway branch on 2026-07-31: the loser of
// INSERT ... ON CONFLICT (session_id) DO NOTHING BLOCKS on the winner's
// transaction (wait_event_type=Lock, wait_event=transactionid), then returns
// zero rows, and its next read sees the committed row WITH THE WINNER'S SEED.
// H1b: if the winner rolls back, the loser inserts and becomes the winner.
// Self-healing both ways, which is why no retry is needed for the race itself.
//
// The single re-entry below is NOT for the race. It exists for the one case the
// race cannot fix: an identifier that resolves to a row this client may not
// play, because it is already closed (a replay of yesterday's uuid) or belongs
// to another user or another mode. There the server mints a fresh identifier and
// re-enters THE INSERT ONLY, once. Never the identity, never the pool.
// ---------------------------------------------------------------------------
const MAX_START_REENTRIES = 1;

export const startTrainingSession = async ({
  locale = "fr",
  guestUserId,
  familiarity = null,
  warmupCorrect = null,
  attemptId = null,
}: TrainingStartInput): Promise<{
  payload: TrainingStartResponse;
  guestUserId: string;
  guestWasCreated: boolean;
}> => {
  // Step 1 — identity, from the httpOnly cookie only, resolved ONCE here and
  // pinned for the whole call. The re-entry never comes back through this line:
  // a second resolution could hand the second attempt a different user, and the
  // pool seeded at step 2 would then belong to nobody.
  const { user, created } = await getGuestUser(locale, guestUserId);
  // Step 2 — the pool, before the session row, exactly as before.
  await ensureUserPool(user.user_id, familiarity, warmupCorrect);
  // Step 3 — the onboarding answer, unchanged and in its place. It writes the
  // onboarding signal and has nothing to do with the convergence; it is called
  // out here only because a literal reading of an earlier step list removed it.
  if (familiarity) {
    await recordOnboardingFamiliarity(user.user_id, familiarity);
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
  // Whether THIS call is the one that created the session row. Derived from the
  // insert's own RETURNING below and from nothing else: a read taken before the
  // write, or the mere fact that a row exists afterwards, cannot tell the winner
  // from the loser, and the loser must not re-write a journal entry the winner
  // already wrote.
  let wonTheInsert = false;

  for (let attemptsLeft = MAX_START_REENTRIES; attemptsLeft >= 0; attemptsLeft -= 1) {
    // S3 — the insert, converging on sessions_pkey. session_id is supplied
    // explicitly: the column has DEFAULT gen_random_uuid(), so an insert that
    // omitted it could never collide and the ON CONFLICT clause would be
    // unreachable syntax while every start kept writing its own row.
    const insertedSessions = await queryRows<SessionRow>(sql`
      INSERT INTO sessions (
        session_id,
        user_id,
        mode,
        status,
        locale,
        seed,
        engine_version,
        started_global_q_index
      ) VALUES (
        ${effectiveAttemptId}::uuid,
        ${user.user_id}::uuid,
        'training',
        'active',
        ${user.locale},
        ${seed},
        ${TRAINING_ENGINE_VERSION},
        ${user.global_q_index}
      )
      ON CONFLICT (session_id) DO NOTHING
      RETURNING session_id, user_id, seed, question_count, status
    `);

    wonTheInsert = insertedSessions.length > 0;

    let candidate = insertedSessions[0];
    if (!candidate) {
      // S4 — the re-read, placed exactly where the code used to take the
      // inserted row, therefore BEFORE the sweep. That position is not a
      // preference: the loser holds zero rows until this statement fills them
      // in, so a re-read moved below the sweep would leave the sweep's own
      // exclusion clause reading session.session_id off an undefined row and
      // throw a TypeError on every losing start.
      //
      // Scoped by user_id and mode as well as by the key, because the key alone
      // would hand a guessed identifier to whoever asked, and would serve a
      // competition row as a training session.
      //
      // THE SEED IS THE POINT OF THIS READ, not a convenience: buildQuestion
      // reads session.seed below and the answer path writes it back into the
      // fact, so a loser that kept the seed it generated and never wrote would
      // serve a word and a signed token that disagree with what gets recorded.
      const rejoinedSessions = await queryRows<SessionRow>(sql`
        SELECT session_id, user_id, seed, question_count, status
        FROM sessions
        WHERE session_id = ${effectiveAttemptId}::uuid
          AND user_id = ${user.user_id}::uuid
          AND mode = 'training'
        LIMIT 1
      `);
      candidate = rejoinedSessions[0];
    }

    if (candidate && candidate.status === "active") {
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
        ? "Training session start found no active session after one re-entry on a fresh identifier."
        : "Training session start returned no session row."
    );
  }

  // Spec §2.1 step 5 — abandon. A session that no longer closes itself on a round
  // counter stays open for ever if nothing sweeps it: 73 were measured in that
  // state on 2026-07-29, every one 'active', not one 'completed'.
  //
  // THE SWEEP RUNS AFTER THE INSERT, and the current session is excluded BY ID.
  // It used to run before, on the argument that a row that does not exist cannot
  // be caught by its own sweep. That argument dies the moment one attempt equals
  // one identifier: a reload sends the same id back, and a sweep with no
  // exclusion would abandon the session we are about to join.
  //
  // Two more predicates, because excluding the current session is not enough.
  // Without an age floor, two starts a few milliseconds apart abandon each
  // other and leave ZERO active sessions. Without an inactivity window, a
  // player answering in another tab is closed under them.
  //
  // NO PEDAGOGICAL CONSEQUENCE, and that is the point: mastery, intervals and the
  // pool are written answer by answer, so the work done inside an abandoned
  // session is already acquired and nothing here revisits it.
  //
  // ended_at is taken from the LAST RECORDED EVENT of that session, not from now:
  // the player left when they stopped answering, not when we noticed. With no
  // event at all it falls back to started_at, giving a zero duration. No
  // session_end event is written either, because no end ever happened, and phase
  // 2a is precisely about the fact table never claiming something that did not
  // occur.
  //
  // FAIL-SAFE, same shape as safeTrainingProgress, safeReadVisibleLevel and
  // safeRecomputeVisibleLevel below: this statement runs AFTER the sessions row
  // has already committed. If it throws, on a lock wait, a statement timeout, or
  // a CHECK violation, insertSessionStartEvent must still run: the alternative is
  // a 500 to the player, an orphan active session with no session_start event,
  // and a hole in the append-only journal, which is exactly the failure mode
  // this plan exists to close. The comment above already argues the sweep has
  // no pedagogical consequence; that is precisely the argument for it being
  // unable to break the request that follows it.
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
      WHERE s.user_id = ${user.user_id}::uuid
        AND s.mode = 'training'
        AND s.status = 'active'
        AND s.session_id <> ${session.session_id}::uuid
        AND s.started_at < now() - interval '30 minutes'
        AND COALESCE(
              (
                SELECT MAX(uef.event_ts_utc)
                FROM user_event_fact uef
                WHERE uef.session_id = s.session_id
              ),
              s.started_at
            ) < now() - interval '30 minutes'
    `;
  } catch (error) {
    console.warn("session sweep failed; continuing without closing stale sessions.", error);
  }

  // Only the call that actually created the session row writes its session_start.
  // A call that rejoined an existing session is reading a row whose session_start
  // the creator already wrote, and task 5's event_ingestion_guard CTE would turn
  // a second write into a no-op anyway, so the useless round trip is not sent.
  // The trade-off, stated rather than hidden: if a creator committed its session
  // row and then failed before its event write, a later rejoin no longer heals
  // the missing session_start. That hole is a failed request, visible in the
  // logs, not a silent divergence, and healing it here would mean writing an
  // event dated long after the start it claims to record.
  if (wonTheInsert) {
    await insertSessionStartEvent(
      session.session_id,
      user.user_id,
      user.global_q_index,
      TRAINING_ENGINE_VERSION
    );
  }

  const pool = await getPoolRows(user.user_id);
  // Spec §4.5 — never start on a frozen pool. If every item is in cooldown, a
  // silent unlock (or cursor jump) restores a valid question, invisibly.
  const recovery = await recoverPoolIfStuck(
    user.user_id,
    session.session_id,
    user.global_q_index,
    pool
  );
  const recoveredUser: UserRow = { ...user, global_q_index: recovery.globalQIndex };
  const question = buildQuestion(session.session_id, recoveredUser, session.seed, recovery.pool);
  const progressAggregate = await safeTrainingProgress(user.user_id);
  // Baseline visible level (read-only, no recompute) so the client has a value to
  // display and a reference for the first change. levelChanged is deliberately
  // NOT set here: N-24/N-25 toast only on an answer that MOVES the level.
  const visibleLevel = await safeReadVisibleLevel(user.user_id);

  return {
    payload: {
      sessionId: session.session_id,
      userId: user.user_id,
      question,
      progress: {
        // session.question_count is the RIGHT value here, and it is not the
        // stale read the answer path had to stop serving. Judged, not copied:
        // this call never writes question_count (only an answer does), and
        // `session` came either from the session INSERT's own RETURNING above
        // or, for a rejoin, from a SELECT taken inside this same call with no
        // write in between. There is no fresher value to serve and no later
        // RETURNING to serve it from, so a round trip added here would read
        // back exactly what is already in hand.
        resolvedCount: session.question_count,
        ...(progressAggregate
          ? {
              eyeLevel: progressAggregate.eyeLevel,
              facesMastered: progressAggregate.facesMastered,
              poolSize: progressAggregate.poolSize,
              masteryPercent: progressAggregate.masteryPercent,
            }
          : {}),
        ...(visibleLevel ? { visibleLevel } : {}),
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
    throw new GameRequestError(
      "invalid_question_token",
      "Invalid training question token."
    );
  }

  if (!payload.options.includes(answerSlug)) {
    throw new GameRequestError(
      "invalid_answer_option",
      "Answer slug is not one of the four options this token carries."
    );
  }

  const sessionRows = await queryRows<SessionRow>(sql`
    SELECT session_id, user_id, seed, question_count, status
    FROM sessions
    WHERE session_id = ${sessionId}::uuid
    LIMIT 1
  `);

  const session = sessionRows[0];
  if (!session || session.status !== "active") {
    throw new GameRequestError(
      "session_not_active",
      "Training session is missing or already closed."
    );
  }

  const userRows = await queryRows<UserRow>(sql`
    SELECT user_id, locale, global_q_index, onboarding_familiarity
    FROM users
    WHERE user_id = ${session.user_id}::uuid
    LIMIT 1
  `);

  const user = userRows[0];
  if (!user || payload.userId !== user.user_id) {
    throw new GameRequestError(
      "identity_mismatch",
      "The signed token names a different player than the session does."
    );
  }

  const stateRows = await queryRows<PoolRow>(sql`
    SELECT
      uts.state_id,
      uts.typeface_slug,
      uts.mastery_level,
      uts.next_due_after_q,
      uts.session_errors,
      uts.consecutive_session_errors,
      uts.consecutive_correct,
      uts.adaptive_coef,
      tc.primary_category::text AS primary_category,
      tc.visual_cluster_id,
      tc.difficulty_base::text AS difficulty_base,
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

  const isCorrect = answerSlug === payload.typefaceSlug;

  // mastery_after and reason_code both depend on the attempt index, and the
  // attempt index is only known INSIDE the statement below, deriving it in
  // JavaScript being precisely the race this closes. Only two outcomes stay
  // open, so the first-attempt value is computed here and the statement picks
  // between it and "the level does not move" with a two-branch CASE. isCorrect
  // needs no read at all, which is why no third branch exists.
  //
  // Beyond the first attempt the level never moves, and the three branches
  // further down confirm it: correct_after_retry writes no mastery_level and
  // wrong_retry writes nothing whatsoever.
  const masteryAfterFirstTry = isCorrect
    ? Math.min(4, currentState.mastery_level + 1)
    : currentState.mastery_level === 4
      ? 3
      : Math.max(0, currentState.mastery_level - 1);

  // misread_shown records that a Misread Type Card WAS DISPLAYED to the player.
  // No Type Card exists in the runtime (no content/type-cards, no overlay), so the
  // honest value is false and only false. It used to be written from the trigger
  // rule alone, which put "a card was shown" in the fact table for cards that were
  // never shown: the day cards ship, their effect would be measured against a
  // history of imaginary displays.
  //
  // The trigger rule itself is NOT lost, it lives in the spec (§6.1: first error on
  // this face in the session, or second consecutive error). It gets implemented
  // together with the card, and this column starts telling the truth then.
  // check:misread-truth fails if anything but a literal false is written here while
  // no card content exists.
  const misreadShown = false;

  // attempt_index is derived HERE, inside the statement that inserts the fact,
  // never by a COUNT read back into JavaScript. Two submissions for the same
  // question in flight at the same time both read a count of 0, both build the
  // same idempotency key, and the event_ingestion_guard primary key
  // (user_id, session_id, idempotency_key) is what arbitrates: the loser blocks
  // on the winner's transaction, DO NOTHING leaves `g` empty, the outer INSERT
  // writes nothing, and RETURNING yields zero rows. Zero rows means "this
  // submission is a duplicate", and NOTHING else runs. The SQL derivation and
  // the ingestion guard are one correction, not two: derived alone, the count
  // stays racy and both submissions would still build the same key; guarded
  // alone, a JS-computed index would still be the same on both sides only by
  // luck of timing.
  //
  // The derived index is also the correct semantics, not just the pure one: it
  // only advances once the previous fact is COMMITTED, so a genuine retry sent
  // after the first answer resolved derives 2 and never collides.
  //
  // REORDERING TO ASSUME, and it is the same kind already justified for
  // session_end. The fact is now written BEFORE the mastery write, where it used
  // to be written after. That changes none of the values recorded, mastery_before
  // and mastery_after both being decided in JavaScript ahead of either write. It
  // changes the failure mode: an interruption between the fact and the mastery
  // write now leaves the fact written and the mastery one step behind, instead of
  // leaving the mastery written twice from the same mastery_before, which is a
  // double penalty or a double promotion for the player. The new failure mode is
  // strictly better and it is repairable, the fact carrying mastery_after, so a
  // recovery job can recompute; the old one destroyed information.
  const written = await queryRows<{ attempt_index: number; resolved_count: number }>(sql`
    WITH n AS (
      SELECT COUNT(*)::int + 1 AS attempt_index
      FROM user_event_fact
      WHERE session_id = ${sessionId}::uuid
        AND event_type = 'answer'
        AND question_id = ${payload.questionId}::uuid
    ),
    g AS (
      INSERT INTO event_ingestion_guard (
        idempotency_key, user_id, session_id, ingestion_status
      )
      SELECT
        ${sessionId}::text || ':' || ${payload.questionId}::text || ':' || n.attempt_index::text,
        ${user.user_id}::uuid,
        ${sessionId}::uuid,
        'accepted'
      FROM n
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
      'training',
      ${user.global_q_index}::int,
      ${payload.questionId}::uuid,
      n.attempt_index,
      'answer',
      ${payload.typefaceSlug},
      ${answerSlug},
      ${isCorrect}::boolean,
      ${Math.max(0, Math.round(responseTimeMs))}::int,
      ${currentState.mastery_level}::smallint,
      CASE WHEN n.attempt_index = 1
           THEN ${masteryAfterFirstTry}::smallint
           ELSE ${currentState.mastery_level}::smallint
      END,
      ${misreadShown}::boolean,
      false,
      ${payload.displayWord},
      CASE WHEN n.attempt_index = 1
           THEN ${isCorrect ? "correct_first_try" : "wrong_first_try"}::app.reason_code_enum
           ELSE ${isCorrect ? "correct_after_retry" : "wrong_retry"}::app.reason_code_enum
      END,
      ${session.seed}::bigint,
      ${TRAINING_ENGINE_VERSION}
    FROM n, g
    RETURNING
      attempt_index,
      (
        SELECT question_count
        FROM sessions
        WHERE session_id = ${sessionId}::uuid
      ) AS resolved_count
  `);

  // Zero rows: another submission for this same attempt won the guard. It has
  // already moved mastery, already written the fact, already advanced the
  // counters. Re-running any of that here would apply the same transition twice
  // from the same mastery_before, which is a double penalty or a double
  // promotion for the player, not a harmless duplicate row. Everything
  // pedagogical, the three mastery branches, the mastery unlock, the two
  // counter UPDATEs and the pool rebalance, sits below this checkpoint.
  if (written.length === 0) {
    return duplicateAnswerResponse(session, user, payload.questionId);
  }

  // Both values come from the statement that just wrote the fact, never from a
  // read taken before it. resolved_count rides along in the same RETURNING, by
  // scalar subquery on sessions, so the fresh counter costs no extra round trip.
  const attemptCount = written[0].attempt_index;
  const resolvedCount = written[0].resolved_count;
  const wrongFirstTry = !isCorrect && attemptCount === 1;
  const correctFirstTry = isCorrect && attemptCount === 1;
  const correctAfterRetry = isCorrect && attemptCount > 1;

  let nextMastery = currentState.mastery_level;
  let nextDueAfterQ = currentState.next_due_after_q;
  let nextSessionErrors = currentState.session_errors;
  let nextConsecutiveSessionErrors = currentState.consecutive_session_errors;
  // Dormant no longer: the adaptive coef (spec §4.6) is now WRITTEN here. It starts
  // neutral (1.0) and drifts within [0.5, 2.0]. Repeated in-session errors raise it
  // (face comes back sooner); a stable correct streak lowers it (face spaces out).
  let nextAdaptiveCoef = currentState.adaptive_coef;

  if (wrongFirstTry) {
    nextMastery =
      currentState.mastery_level === 4
        ? 3
        : Math.max(0, currentState.mastery_level - 1);
    nextSessionErrors = currentState.session_errors + 1;
    nextConsecutiveSessionErrors = currentState.consecutive_session_errors + 1;
    // Spec §4.6: on repeated in-session errors (>= 2 consecutive) raise the coef.
    if (nextConsecutiveSessionErrors >= 2) {
      nextAdaptiveCoef = Math.min(currentState.adaptive_coef + 0.1, 2.0);
    }
    // Spec §5.2 order: update weight FIRST, then apply cooldown with the new coef.
    nextDueAfterQ = computeWrongNextDue(user.global_q_index, nextMastery, nextAdaptiveCoef);

    await sql`
      UPDATE user_typeface_state
      SET mastery_level = ${nextMastery},
          next_due_after_q = ${nextDueAfterQ},
          last_shown_at_q = ${user.global_q_index},
          interval_questions = ${nextDueAfterQ - user.global_q_index},
          adaptive_coef = ${nextAdaptiveCoef},
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
    nextConsecutiveSessionErrors = 0;
    // Spec §4.6: on a stable correct streak (>= 3 in a row) lower the coef so a
    // mastered face spaces out. consecutive_correct after this answer = prev + 1.
    const nextConsecutiveCorrect = currentState.consecutive_correct + 1;
    if (nextConsecutiveCorrect >= 3) {
      nextAdaptiveCoef = Math.max(currentState.adaptive_coef - 0.05, 0.5);
    }
    nextDueAfterQ = computeCorrectNextDue(user.global_q_index, nextMastery, nextAdaptiveCoef);

    await sql`
      UPDATE user_typeface_state
      SET mastery_level = ${nextMastery},
          next_due_after_q = ${nextDueAfterQ},
          last_shown_at_q = ${user.global_q_index},
          interval_questions = ${nextDueAfterQ - user.global_q_index},
          adaptive_coef = ${nextAdaptiveCoef},
          total_seen = total_seen + 1,
          total_correct = total_correct + 1,
          consecutive_correct = consecutive_correct + 1,
          consecutive_session_errors = 0,
          last_seen_at = now(),
          updated_at = now()
      WHERE state_id = ${currentState.state_id}::uuid
    `;

    // I-07 growth trigger. A face stabilises when it FIRST crosses to mastery 4,
    // i.e. its previous level was exactly 3 (correct_after_error carries no +1, so
    // only correct_first_try can cross, and a face already at 4 stays 4 -> no
    // crossing). This is what avoids double-counting repeated correct answers at 4.
    if (currentState.mastery_level === 3 && nextMastery === 4) {
      await registerMasteryUnlock(user.user_id, sessionId, user.global_q_index);
    }
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

  // N-22: recompute the global visible level after EVERY answer (correct, wrong
  // first try, or retry), not only at end of session. Runs after the mastery
  // write and the I-07 unlock above, so it aggregates the fresh pool. Bounded
  // regression (P-04) lives inside recompute_visible_level (migration 009). Read
  // of the engine only (I-08): it never changes mastery/intervals. Fail-safe.
  const visibleLevel = await safeRecomputeVisibleLevel(user.user_id);
  const levelFields = visibleLevel
    ? { visibleLevel: visibleLevel.level, levelChanged: visibleLevel.changed }
    : {};

  if (!isCorrect) {
    await sql`
      UPDATE users
      SET last_seen_at = now()
      WHERE user_id = ${user.user_id}::uuid
    `;

    return {
      result: "wrong",
      questionResolved: false,
      feedbackText: WRONG_FEEDBACK,
      progress: {
        // Served from the answer statement's own RETURNING, not from the
        // sessions row read at the top of this call. A wrong answer increments
        // nothing, so no increment is LOST by serving the earlier read, and
        // that is exactly why the defect was easy to miss. Two active sessions
        // being a supported state, a question resolved in another tab between
        // that read and now makes the earlier value stale, and the client would
        // be told a number the database has already moved past.
        resolvedCount,
        ...levelFields,
      },
    };
  }

  // Both counters below increment inside the UPDATE itself and are read back
  // via RETURNING, never computed in JS from the row a prior SELECT saw. Two
  // active sessions for one player is a supported state (plan
  // plan-double-demarrage-2026-07-31): a JS-computed `+ 1` written back would
  // lose an increment whenever two answers land in parallel, because both
  // reads would see the same starting value. `SET col = col + 1` cannot lose
  // a concurrent increment, since there is no JS read in between.
  const [updatedUser] = await queryRows<{ global_q_index: number }>(sql`
    UPDATE users
    SET global_q_index = global_q_index + 1,
        last_seen_at = now()
    WHERE user_id = ${user.user_id}::uuid
    RETURNING global_q_index
  `);
  const nextGlobalQIndex = updatedUser.global_q_index;

  // The session stays active no matter how many questions were answered: a
  // training session has no planned length and can only be closed by an explicit
  // call to endTrainingSession (I-17). Answering never writes status or ended_at.
  // correct_count counts questions resolved on the FIRST attempt, not every
  // resolved question. The wrong-answer branch above returns before this
  // statement, so incrementing both columns by 1 made them equal for every
  // training session that ever existed: `CHECK (correct_count <= question_count)`
  // (migration 003) was satisfied by a tautology and the column carried no
  // information (gap 9 defect 1). First attempts are also the convention
  // profile-stats.ts uses everywhere it computes an accuracy, so the ratio
  // question_count over correct_count now means the same thing on the session
  // row as it does on the fact table: the share resolved without a retry.
  const [updatedSession] = await queryRows<{ question_count: number }>(sql`
    UPDATE sessions
    SET question_count = question_count + 1,
        correct_count = correct_count + ${correctFirstTry ? 1 : 0}::int
    WHERE session_id = ${sessionId}::uuid
    RETURNING question_count
  `);
  const resolvedCountAfter = updatedSession.question_count;

  // Stage 4 — downward rebalance. Runs before the aggregate + next question so any
  // freshly injected easy faces are reflected in poolSize and eligible to appear
  // next. No-op (fail-safe) until migration 007 is applied.
  await maybeRebalancePool(user);

  // Stage 5 — progression aggregate for the in-game indicator. Computed after the
  // mastery write so faces mastered / eye level are fresh. Reuses profile-stats
  // (no parallel computation). Absent on wrong turns (handled above).
  const progressAggregate = await safeTrainingProgress(user.user_id);
  const progressFields = progressAggregate
    ? {
        eyeLevel: progressAggregate.eyeLevel,
        facesMastered: progressAggregate.facesMastered,
        poolSize: progressAggregate.poolSize,
        masteryPercent: progressAggregate.masteryPercent,
      }
    : {};

  const pool = await getPoolRows(user.user_id);
  // Spec §4.5 — never advance into a frozen pool. When every item is still in
  // cooldown, a silent unlock (or cursor jump) restores a valid next question.
  const recovery = await recoverPoolIfStuck(
    user.user_id,
    sessionId,
    nextGlobalQIndex,
    pool
  );
  const nextUser: UserRow = {
    ...user,
    global_q_index: recovery.globalQIndex,
  };
  const nextQuestion = buildQuestion(sessionId, nextUser, session.seed, recovery.pool);

  return {
    result: "correct",
    questionResolved: true,
    feedbackText: CORRECT_FEEDBACK,
    progress: {
      resolvedCount: resolvedCountAfter,
      ...progressFields,
      ...levelFields,
    },
    nextQuestion,
  };
};

// Explicit, voluntary end of a training session (I-17).
//
// A session is temporary, the progression is permanent. Closing a session writes
// the session row and the session_end event, and returns the bilan of what just
// happened. It touches NOTHING pedagogical: no mastery, no interval, no cooldown,
// no pool. Mastery is written answer by answer, so a session left open, abandoned
// or closed loses nothing the player earned.
//
// Idempotent: calling it twice returns the same summary and reports
// closedByThisCall false the second time. The session_end event is deduplicated
// by the same event_ingestion_guard CTE as insertSessionStartEvent above (H2),
// on the guard's primary key (user_id, session_id, idempotency_key), not by a
// NOT EXISTS scan.
export const endTrainingSession = async ({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}): Promise<TrainingEndResponse> => {
  const sessionRows = await queryRows<{
    session_id: string;
    user_id: string;
    status: string;
    started_at: string;
    ended_at: string | null;
  }>(sql`
    SELECT session_id, user_id, status::text AS status, started_at, ended_at
    FROM sessions
    WHERE session_id = ${sessionId}::uuid
      AND user_id = ${userId}::uuid
      AND mode = 'training'
    LIMIT 1
  `);

  const session = sessionRows[0];
  if (!session) {
    throw new GameRequestError(
      "session_not_found",
      "Training session not found for this user."
    );
  }

  const wasActive = session.status === "active";
  // COSMETIC DRIFT, never persisted. This endedAt is computed from the SELECT
  // above, before the compare-and-set UPDATE below runs. If a concurrent
  // sweep (task 4) wins the race and closes this session as 'abandoned'
  // first, the UPDATE affects zero rows (closedByThisCall stays false), but
  // this endedAt is still handed to buildTrainingSessionSummary for the
  // bilan returned to the caller. The drift between this value and the
  // sweep's own ended_at (taken from MAX(event_ts_utc), the last real event)
  // is bounded by the sweep's own inactivity window, 30 minutes, not
  // unbounded, since the sweep only ever fires after that much silence.
  // Nothing persists this value: duration_ms is a GENERATED column the
  // database computes on its own from the real ended_at/started_at, never
  // from this JS Date, so the drift stays purely cosmetic in the response.
  const endedAt = session.ended_at ? new Date(session.ended_at) : new Date();
  const startedAt = new Date(session.started_at);
  let closedByThisCall = false;

  if (wasActive) {
    // THE EVENT IS WRITTEN BEFORE THE STATUS, and the order is deliberate. These
    // two statements are not in a single transaction, because the whole engine
    // runs on autocommit statements through the HTTP driver. So one of them can
    // land without the other, and the question is only which half-way state is
    // recoverable. Status first, then event, is NOT: a session already closed
    // makes wasActive false on the retry, so the event is skipped for ever and the
    // journal permanently loses the end of that session. Event first, then status,
    // heals itself: the session stays active, a retry re-runs the CTE below and
    // finds the guard row already accepted (no duplicate, H2), and the compare
    // and set below still gets its chance to close the session properly.
    //
    // ATOMIC WRITER (H2, proven by execution on 2026-07-31), same CTE shape as
    // insertSessionStartEvent above: WITH g AS (INSERT INTO event_ingestion_guard
    // ... ON CONFLICT DO NOTHING RETURNING 1) INSERT INTO user_event_fact ...
    // SELECT ... FROM g. One guard row, one event, never a divorce: the loser's
    // INSERT ... ON CONFLICT blocks on the guard's primary key until the winner
    // commits, then finds the conflict and RETURNING yields no row, so its
    // SELECT ... FROM g inserts nothing into user_event_fact either.
    //
    // WHY NOT ON CONFLICT ON user_event_fact ITSELF. That measurement stays true:
    // user_event_fact is PARTITIONED BY RANGE (event_ts_utc), and Postgres requires
    // a unique index on a partitioned table to carry the partition key: the only
    // one is uq_event_id (event_id, event_ts_utc). There is no unique constraint on
    // idempotency_key alone, so `ON CONFLICT (idempotency_key)` raises 42P10, "there
    // is no unique or exclusion constraint matching the ON CONFLICT specification".
    // Verified on a throwaway Neon branch on 2026-07-29. What is no longer true is
    // the conclusion that used to follow from it: the conflict target DOES exist,
    // it is simply on event_ingestion_guard, whose primary key IS (user_id,
    // session_id, idempotency_key) (db/migrations/001_user_event_fact.sql:13-23),
    // not on user_event_fact itself.
    //
    // RETENTION RULE, written here because task 8 makes it load-bearing: answer
    // events must NEVER enter event_ingestion_guard without partitioning or a TTL,
    // and any TTL adopted must outlive the longest client replay window. Deleting
    // a guard row makes its event re-insertable again: the guard row IS what keeps
    // the write idempotent, so vacuuming it silently un-deduplicates the event.
    await sql`
      WITH g AS (
        INSERT INTO event_ingestion_guard (
          idempotency_key, user_id, session_id, ingestion_status
        )
        VALUES (
          ${`${sessionId}:session_end`}, ${userId}::uuid, ${sessionId}::uuid, 'accepted'
        )
        ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING
        RETURNING 1
      )
      INSERT INTO user_event_fact (
        idempotency_key, user_id, session_id, mode, global_q_index, event_type, engine_version
      )
      SELECT
        ${`${sessionId}:session_end`},
        ${userId}::uuid,
        ${sessionId}::uuid,
        'training',
        (SELECT global_q_index FROM users WHERE user_id = ${userId}::uuid),
        'session_end',
        ${TRAINING_ENGINE_VERSION}
      FROM g
    `;

    // Compare and set: WHERE ... AND status = 'active'. Between the SELECT above
    // and this UPDATE, another tab's sweep can have moved this session to
    // 'abandoned' with an honest ended_at taken from its last event (task 4). An
    // unconditional UPDATE would flip it back to 'completed' here and overwrite
    // that honest timestamp with the server's own clock: exactly the fact table
    // claiming something that did not happen. Task 4's sweep exclusion narrows
    // this window, it does not close it, because the sweep only ever excludes the
    // session of the call that runs it, and a second tab is a second session: its
    // own sweep does not know about this one. Only the compare and set closes the
    // race. RETURNING is what lets us know whether THIS call actually closed it.
    const closedRows = await queryRows<{ session_id: string }>(sql`
      UPDATE sessions
      SET status = 'completed'::app.session_status_enum,
          ended_at = ${endedAt}
      WHERE session_id = ${sessionId}::uuid
        AND status = 'active'
      RETURNING session_id
    `);
    closedByThisCall = closedRows.length > 0;
  }

  const answerRows = await queryRows<SummaryAnswerRow>(sql`
    SELECT
      question_id::text AS question_id,
      typeface_slug,
      answer_slug,
      is_correct,
      attempt_index,
      response_time_ms,
      mastery_before,
      mastery_after
    FROM user_event_fact
    WHERE session_id = ${sessionId}::uuid
      AND event_type = 'answer'
      AND question_id IS NOT NULL
    ORDER BY event_ts_utc ASC
  `);

  // "Discovered" means answered for the first time ever, so it is measured against
  // this user's history OUTSIDE this session, not against the session itself.
  const seenBeforeRows = await queryRows<{ typeface_slug: string }>(sql`
    SELECT DISTINCT typeface_slug
    FROM user_event_fact
    WHERE user_id = ${userId}::uuid
      AND event_type = 'answer'
      AND typeface_slug IS NOT NULL
      AND session_id <> ${sessionId}::uuid
  `);

  const progressAggregate = await safeTrainingProgress(userId);

  const summary = buildTrainingSessionSummary({
    startedAt,
    endedAt,
    rows: answerRows,
    previouslySeenSlugs: seenBeforeRows.map((row) => row.typeface_slug),
    poolSize: progressAggregate?.poolSize,
    facesMastered: progressAggregate?.facesMastered,
  });

  // NAMES, NOT SLUGS, FOR WHAT THE PLAYER READS.
  //
  // The summary is built from user_event_fact, which stores slugs. Played for
  // real, the recap printed "Alumnisansinlineone instead of Alumnisans": most
  // slugs carry no separator, so no client-side prettifier can put the words
  // back. The display name only exists in typefaces_core, so it is resolved
  // here, once, for the handful of faces a confusion mentions.
  //
  // The slugs stay in the payload: they identify, the labels only display.
  const confusedSlugs = [
    ...new Set(
      summary.confusions.flatMap((entry) =>
        entry.chosen ? [entry.shown, entry.chosen] : [entry.shown]
      )
    ),
  ];
  const nameRows = confusedSlugs.length
    ? await queryRows<{ typeface_slug: string; display_name: string }>(sql`
        SELECT typeface_slug, display_name
        FROM typefaces_core
        WHERE typeface_slug = ANY(${confusedSlugs}::text[])
      `)
    : [];
  const nameBySlug = new Map(nameRows.map((row) => [row.typeface_slug, row.display_name]));

  return {
    sessionId,
    summary: {
      ...summary,
      confusions: summary.confusions.map((entry) => ({
        ...entry,
        // Falls back to the slug rather than to nothing: a face missing from
        // the catalogue is a data problem worth seeing, not worth hiding.
        shownLabel: nameBySlug.get(entry.shown) ?? entry.shown,
        chosenLabel: entry.chosen ? (nameBySlug.get(entry.chosen) ?? entry.chosen) : null,
      })),
    },
    closedByThisCall,
  };
};
