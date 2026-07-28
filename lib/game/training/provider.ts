import "server-only";

import crypto from "node:crypto";

import {
  getTrainingDisplayWord,
  getTypefaceFontFamily,
  TRAINING_ENGINE_VERSION,
  TRAINING_TOTAL_ROUNDS,
} from "@/lib/game/training/catalog";
import {
  type Familiarity,
  type Locale,
  type TrainingAnswerResponse,
  type TrainingQuestion,
  type TrainingStartResponse,
} from "@/lib/game/training/contracts";
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

// easy < medium < hard, matching app.difficulty_base_enum order. Used as a
// selection tiebreak so injected easy faces (Stage 4 rebalance, mastery 0)
// surface ahead of harder ties before the per-session seed hash decides.
const DIFFICULTY_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
const difficultyRank = (value: string) => DIFFICULTY_RANK[value] ?? 1;

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
    if (difficultyRank(left.difficulty_base) !== difficultyRank(right.difficulty_base)) {
      return difficultyRank(left.difficulty_base) - difficultyRank(right.difficulty_base);
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

const maybeRebalancePool = async (userId: string) => {
  try {
    const rows = await queryRows<{
      familiarity: string | null;
      answers: number;
      correct: number;
    }>(sql`
      SELECT
        (SELECT onboarding_familiarity FROM users WHERE user_id = ${userId}::uuid) AS familiarity,
        COUNT(*)::int AS answers,
        COUNT(*) FILTER (WHERE is_correct)::int AS correct
      FROM user_event_fact
      WHERE user_id = ${userId}::uuid
        AND event_type = 'answer'
        AND attempt_index = 1
    `);

    const row = rows[0];
    if (!row) return;

    const declaredAdvanced =
      row.familiarity === "Quite familiar" || row.familiarity === "Designer";
    if (!declaredAdvanced) return;

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

  // Step 1 — controlled injection of a new typeface (spec §4.5).
  try {
    const rows = await queryRows<{ slug: string | null }>(
      sql`SELECT try_unlock_one_typeface(${userId}::uuid) AS slug`
    );
    const unlocked = rows[0]?.slug ?? null;
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
    console.warn("try_unlock_one_typeface skipped (migration 008 not applied).", error);
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

export const startTrainingSession = async ({
  locale = "fr",
  guestUserId,
  familiarity = null,
  warmupCorrect = null,
}: {
  locale?: Locale;
  guestUserId?: string | null;
  familiarity?: Familiarity | null;
  warmupCorrect?: boolean | null;
}): Promise<{ payload: TrainingStartResponse; guestUserId: string; guestWasCreated: boolean }> => {
  const { user, created } = await getGuestUser(locale, guestUserId);
  await ensureUserPool(user.user_id, familiarity, warmupCorrect);
  if (familiarity) {
    await recordOnboardingFamiliarity(user.user_id, familiarity);
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
        resolvedCount: session.question_count,
        totalRounds: TRAINING_TOTAL_ROUNDS,
        ...(progressAggregate
          ? {
              eyeLevel: progressAggregate.eyeLevel,
              facesMastered: progressAggregate.facesMastered,
              poolSize: progressAggregate.poolSize,
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
      feedbackText: "Incorrect. Try again.",
      progress: {
        resolvedCount: session.question_count,
        totalRounds: TRAINING_TOTAL_ROUNDS,
        ...levelFields,
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

  // Stage 4 — downward rebalance. Runs before the aggregate + next question so any
  // freshly injected easy faces are reflected in poolSize and eligible to appear
  // next. No-op (fail-safe) until migration 007 is applied.
  await maybeRebalancePool(user.user_id);

  // Stage 5 — progression aggregate for the in-game indicator. Computed after the
  // mastery write so faces mastered / eye level are fresh. Reuses profile-stats
  // (no parallel computation). Absent on wrong turns (handled above).
  const progressAggregate = await safeTrainingProgress(user.user_id);
  const progressFields = progressAggregate
    ? {
        eyeLevel: progressAggregate.eyeLevel,
        facesMastered: progressAggregate.facesMastered,
        poolSize: progressAggregate.poolSize,
      }
    : {};

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
        ...progressFields,
        ...levelFields,
      },
      sessionComplete: true,
    };
  }

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
    feedbackText: "Correct. Good eye.",
    progress: {
      resolvedCount: resolvedCountAfter,
      totalRounds: TRAINING_TOTAL_ROUNDS,
      ...progressFields,
      ...levelFields,
    },
    nextQuestion,
  };
};
