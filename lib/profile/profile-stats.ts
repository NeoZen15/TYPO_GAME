import "server-only";

import { sql } from "@/lib/server/neon";
import { buildBadges, type BadgeMetrics } from "@/lib/profile/badge-rules";
import { buildActivityWindow, streakFromDayKeys, longestRunFromDayKeys } from "@/lib/profile/day-keys";
import {
  MOCK_EYE,
  MOCK_PROFILE,
  eyeTitle,
  type AxisState,
  type EyeProfile,
  type PerceptualAxis,
  type PerceptualPalier,
  type PlayerProfile,
  type ProfileCategoryStat,
  type ProfileMode,
  type ProfileSession,
} from "@/lib/profile/mock-profile";
import { PALIER_TAXONOMY, type TypefaceAttrs } from "@/lib/profile/palier-taxonomy";

// ---------------------------------------------------------------------------
// Real, per-player profile data, derived live from the game DB.
//
// Shapes match PlayerProfile / EyeProfile exactly so the profile UI renders
// unchanged. Fields with no real backing yet (the linear board, milestones,
// and the whole Arena/ranked layer) keep their mock values — flagged below.
// ---------------------------------------------------------------------------

const queryRows = async <T>(query: Promise<unknown>) => (await query) as T[];

const CATEGORY_LABELS: Record<string, string> = {
  sans_serif: "Sans serif",
  serif: "Serif",
  mono: "Monospace",
  display: "Display",
};

const MODE_LABELS: Record<ProfileMode, string> = {
  training: "Training",
  competition: "Competition",
  expert: "Expert",
};

const AXIS_LIT_THRESHOLD = 0.7; // mirrors buildAxis() in mock-profile.ts
const PALIER_ACCURACY_BAR = 0.8; // lit ⟺ a ≥ 0.80
const PALIER_MASTERED_BAR = 5; // …generalised over ≥ 5 distinct typefaces

function humanizeMs(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "< 1m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function relWhen(started: Date, now: Date): string {
  const hours = Math.floor((now.getTime() - started.getTime()) / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function palierState(a: number, mastered: number): AxisState {
  if (a >= PALIER_ACCURACY_BAR && mastered >= PALIER_MASTERED_BAR) return "lit";
  if (a > 0 || mastered > 0) return "emerging";
  return "dormant";
}

// XP economy is not stored anywhere; derive it transparently from how much of
// the eye is lit (docs §5.7: +100 / lit palier, +500 / lit axis). Level curve:
// cost N→N+1 = 100·N ⟹ cumulative to reach level L = 50·L·(L-1).
function levelFromXp(totalXp: number): number {
  let level = 1;
  while (50 * (level + 1) * level <= totalXp) level += 1;
  return level;
}

type AnswerRow = { typeface_slug: string; answers: number; correct: number };
type StateRow = { typeface_slug: string; mastery_level: number };
type AttrRow = {
  typeface_slug: string;
  primary_category: string;
  sub_category: string;
  aperture_profile: string;
  contrast_profile: string;
};
type ModeRow = { mode: ProfileMode; games: number; best_score: number; time_ms: string };
type SessionRow = {
  session_id: string;
  mode: ProfileMode;
  question_count: number;
  correct_count: number;
  score: number;
  started_at: string | Date;
};
// First-try accuracy per session, from the fact table, not from the sessions
// table: correct_count on `sessions` is incremented on every resolved question
// in training regardless of correctness, so it cannot carry an honest accuracy.
type SessionAccRow = { session_id: string; first_tries: number; first_correct: number };
type CatRow = { cat: string; seen: number; accuracy: number };
// Calendar day already resolved to Europe/Paris by SQL, one row per event
// (buildActivityWindow / streakFromDayKeys / longestRunFromDayKeys do the
// counting), never a JS-side date boundary.
type DayKeyRow = { day_key: string };
type TodayKeyRow = { today_key: string };
type UserRow = { created_at: string | Date };

function buildEye(
  answers: AnswerRow[],
  states: StateRow[],
  attrs: AttrRow[],
): { eye: EyeProfile; displayMastered: number } {
  const answerBySlug = new Map(answers.map((r) => [r.typeface_slug, r]));
  const masteryBySlug = new Map(states.map((r) => [r.typeface_slug, r.mastery_level]));
  const attrBySlug = new Map<string, TypefaceAttrs>(
    attrs.map((r) => [
      r.typeface_slug,
      {
        primary: r.primary_category,
        sub: r.sub_category,
        aperture: r.aperture_profile,
        contrast: r.contrast_profile,
      },
    ]),
  );

  const axes: PerceptualAxis[] = MOCK_EYE.axes.map((axis) => {
    const paliers: PerceptualPalier[] = axis.paliers.map((p) => {
      const predicate = p.roadmap ? undefined : PALIER_TAXONOMY[p.id];
      if (!predicate) {
        // Roadmap or not-yet-derivable → honestly dormant (0 / 0).
        return { id: p.id, label: p.label, state: "dormant", a: 0, mastered: 0, ...(p.roadmap ? { roadmap: true } : {}) };
      }
      let totAnswers = 0;
      let totCorrect = 0;
      let mastered = 0;
      for (const [slug, attr] of attrBySlug) {
        if (!predicate(attr)) continue;
        const ans = answerBySlug.get(slug);
        if (ans) {
          totAnswers += ans.answers;
          totCorrect += ans.correct;
        }
        if ((masteryBySlug.get(slug) ?? 0) >= 4) mastered += 1;
      }
      const a = totAnswers > 0 ? totCorrect / totAnswers : 0;
      return { id: p.id, label: p.label, state: palierState(a, mastered), a, mastered };
    });

    const roadmap = axis.roadmap ?? paliers.every((p) => p.roadmap);
    const live = paliers.filter((p) => !p.roadmap);
    const litCount = live.filter((p) => p.state === "lit").length;
    const litRatio = live.length ? litCount / live.length : 0;
    let state: AxisState;
    if (roadmap) state = "dormant";
    else if (litRatio >= AXIS_LIT_THRESHOLD) state = "lit";
    else if (paliers.some((p) => p.state !== "dormant")) state = "emerging";
    else state = "dormant";

    return { id: axis.id, n: axis.n, label: axis.label, blurb: axis.blurb, paliers, state, litRatio, roadmap };
  });

  const litAxes = axes.filter((a) => !a.roadmap && a.state === "lit").length;
  const litPaliers = axes
    .filter((a) => !a.roadmap)
    .reduce((s, a) => s + a.paliers.filter((p) => !p.roadmap && p.state === "lit").length, 0);

  const totalXp = litPaliers * 100 + litAxes * 500;
  const level = levelFromXp(totalXp);
  const cumToLevel = 50 * level * (level - 1);
  const xpForNext = 100 * level;
  const xpInLevel = Math.max(0, Math.min(xpForNext, totalXp - cumToLevel));

  let displayMastered = 0;
  for (const r of states) {
    if (r.mastery_level >= 4 && attrBySlug.get(r.typeface_slug)?.primary === "display") displayMastered += 1;
  }

  const eye: EyeProfile = {
    title: eyeTitle(litAxes),
    level,
    xpInLevel,
    xpForNext,
    coins: 0, // no currency economy yet
    streak: 0, // set by caller (daily streak)
    streakRecord: 0, // set by caller
    dailyGoal: { done: 0, target: 3 }, // done set by caller
    axes,
  };
  return { eye, displayMastered };
}

export async function loadRealProfile(
  userId: string,
): Promise<{ profile: PlayerProfile; eye: EyeProfile } | null> {
  const [
    modeRows,
    answerAgg,
    bestStreakRow,
    sessionAccRows,
    catRows,
    masteryRow,
    recentRows,
    activityRows,
    activeDayRows,
    todayKeyRows,
    dailyGoalRows,
    perTfAnswers,
    states,
    attrs,
    userRows,
  ] = await Promise.all([
    // Honest existence predicate: a session only counts for Games played, the
    // per-mode breakdown and Time trained once it has at least one answer event,
    // so a session created but never answered (the double-start bug) is silent.
    queryRows<ModeRow>(sql`
      SELECT mode, COUNT(*)::int AS games, COALESCE(MAX(score),0)::int AS best_score,
             COALESCE(SUM(duration_ms),0)::bigint AS time_ms
      FROM sessions s
      WHERE s.user_id = ${userId}::uuid AND s.status <> 'invalid'
        AND EXISTS (SELECT 1 FROM user_event_fact e
                    WHERE e.session_id = s.session_id AND e.event_type = 'answer')
      GROUP BY mode`),
    // Global accuracy KPI, counted on first attempts only, so it stays consistent
    // with the first-attempt-only bestSessionAccuracy below instead of being
    // pulled lower by failed retries sitting in the denominator.
    queryRows<{ first_tries: number; first_correct: number; typefaces_seen: number; fast: number }>(sql`
      SELECT COUNT(*)::int AS first_tries,
             COUNT(*) FILTER (WHERE is_correct)::int AS first_correct,
             COUNT(DISTINCT typeface_slug)::int AS typefaces_seen,
             COUNT(*) FILTER (WHERE is_correct AND response_time_ms < 2000)::int AS fast
      FROM user_event_fact
      WHERE user_id = ${userId}::uuid AND event_type = 'answer' AND attempt_index = 1`),
    queryRows<{ best_streak: number }>(sql`
      WITH ordered AS (
        SELECT is_correct,
          ROW_NUMBER() OVER (ORDER BY event_ts_utc) -
          ROW_NUMBER() OVER (PARTITION BY is_correct ORDER BY event_ts_utc) AS grp
        FROM user_event_fact WHERE user_id = ${userId}::uuid AND event_type = 'answer')
      SELECT COALESCE(MAX(cnt),0)::int AS best_streak FROM (
        SELECT COUNT(*) AS cnt FROM ordered WHERE is_correct GROUP BY grp) s`),
    // Precision, first attempts only, consistent with maybeRebalancePool. One row
    // per session: bestSessionAccuracy is the max ratio below, recentSessions
    // accuracy is the same ratio looked up per session_id.
    queryRows<SessionAccRow>(sql`
      SELECT session_id::text AS session_id,
             COUNT(*)::int AS first_tries,
             COUNT(*) FILTER (WHERE is_correct)::int AS first_correct
      FROM user_event_fact
      WHERE user_id = ${userId}::uuid AND event_type = 'answer' AND attempt_index = 1
      GROUP BY session_id`),
    queryRows<CatRow>(sql`
      SELECT tc.primary_category::text AS cat, COUNT(*)::int AS seen,
             ROUND(100.0*COUNT(*) FILTER (WHERE e.is_correct)/COUNT(*))::int AS accuracy
      FROM user_event_fact e JOIN typefaces_core tc ON tc.typeface_slug = e.typeface_slug
      WHERE e.user_id = ${userId}::uuid AND e.event_type = 'answer'
      GROUP BY tc.primary_category`),
    queryRows<{ mastered: number; catalog_total: number }>(sql`
      SELECT
        (SELECT COUNT(*) FILTER (WHERE mastery_level >= 4) FROM user_typeface_state WHERE user_id = ${userId}::uuid)::int AS mastered,
        (SELECT COUNT(*) FROM typefaces_core)::int AS catalog_total`),
    // Same honest existence predicate as modeRows above: a session with every
    // answer wrong can carry question_count = 0 and must still show up here,
    // exactly as it now shows up in Games played.
    queryRows<SessionRow>(sql`
      SELECT session_id::text AS session_id, mode, question_count, correct_count, score, started_at
      FROM sessions s
      WHERE s.user_id = ${userId}::uuid
        AND EXISTS (SELECT 1 FROM user_event_fact e
                    WHERE e.session_id = s.session_id AND e.event_type = 'answer')
      ORDER BY started_at DESC LIMIT 5`),
    // Activity, in text so no day boundary is computed in JS: one row per answer
    // event, the day already resolved to Europe/Paris. buildActivityWindow does
    // the counting.
    queryRows<DayKeyRow>(sql`
      SELECT to_char((event_ts_utc AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD') AS day_key
      FROM user_event_fact
      WHERE user_id = ${userId}::uuid AND event_type = 'answer'
        AND event_ts_utc >= now() - interval '31 days'`),
    // All-time distinct answer days, for the streak and the all-time record: a
    // streak or a record can outlast the 31-day activity window above.
    queryRows<DayKeyRow>(sql`
      SELECT DISTINCT to_char((event_ts_utc AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD') AS day_key
      FROM user_event_fact
      WHERE user_id = ${userId}::uuid AND event_type = 'answer'`),
    // Today's calendar day, decided by the database, not by the runtime.
    queryRows<TodayKeyRow>(sql`
      SELECT to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD') AS today_key`),
    // Today's goal counts CORRECT FIRST ATTEMPTS only, never every attempt: the
    // activity heat map above counts all attempts because it measures
    // engagement, but the goal is "good answers", so three wrong attempts on the
    // same question must not satisfy a goal of three. Same Paris-day expression
    // as today_key just above, compared inline within this one query so the
    // goal and the heat map always agree on where the day starts.
    queryRows<{ good_first_tries: number }>(sql`
      SELECT COUNT(*)::int AS good_first_tries
      FROM user_event_fact
      WHERE user_id = ${userId}::uuid AND event_type = 'answer'
        AND attempt_index = 1 AND is_correct
        AND to_char((event_ts_utc AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD')
            = to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD')`),
    queryRows<AnswerRow>(sql`
      SELECT typeface_slug, COUNT(*)::int AS answers, COUNT(*) FILTER (WHERE is_correct)::int AS correct
      FROM user_event_fact WHERE user_id = ${userId}::uuid AND event_type = 'answer'
      GROUP BY typeface_slug`),
    queryRows<StateRow>(sql`
      SELECT typeface_slug, mastery_level FROM user_typeface_state WHERE user_id = ${userId}::uuid`),
    queryRows<AttrRow>(sql`
      SELECT typeface_slug, primary_category::text AS primary_category, sub_category::text AS sub_category,
             aperture_profile::text AS aperture_profile, contrast_profile::text AS contrast_profile
      FROM typefaces_core`),
    queryRows<UserRow>(sql`SELECT created_at FROM users WHERE user_id = ${userId}::uuid LIMIT 1`),
  ]);

  const agg = answerAgg[0] ?? { first_tries: 0, first_correct: 0, typefaces_seen: 0, fast: 0 };
  const totals = masteryRow[0] ?? { mastered: 0, catalog_total: 2000 };
  const totalGames = modeRows.reduce((s, r) => s + r.games, 0);

  // No play history at all → let the UI fall back to the mock so the page never
  // reads as broken for someone who literally hasn't played.
  if (totalGames === 0 && agg.first_tries === 0) return null;

  const modeGames = (m: ProfileMode) => modeRows.find((r) => r.mode === m)?.games ?? 0;
  const bestScore = Math.max(0, ...modeRows.map((r) => r.best_score));
  const totalTimeMs = modeRows.reduce((s, r) => s + Number(r.time_ms), 0);

  // Daily progression is counted in ANSWER EVENTS, never in sessions: a page
  // load that creates two sessions must not double the streak or the goal. Day
  // keys are text, already resolved to Europe/Paris by SQL (see day-keys.ts).
  const todayKey = todayKeyRows[0].today_key;
  const playedDayKeys = activeDayRows.map((r) => r.day_key);
  const activity = buildActivityWindow(activityRows.map((r) => r.day_key), todayKey, 30);
  const streak = streakFromDayKeys(playedDayKeys, todayKey);
  const streakRecord = Math.max(streak, longestRunFromDayKeys(playedDayKeys));
  // The goal has its own count, correct first attempts only, on the Paris day.
  // It must NOT come from the last cell of `activity`: that cell counts every
  // attempt, wrong ones included, so three failed attempts on one question
  // would otherwise satisfy a goal of three good answers.
  const todayGoodAnswers = dailyGoalRows[0]?.good_first_tries ?? 0;

  const sessionAccuracyBySession = new Map(
    sessionAccRows.map((r) => [
      r.session_id,
      r.first_tries > 0 ? r.first_correct / r.first_tries : 0,
    ]),
  );
  const bestSessionAccuracy = sessionAccRows.reduce((best, r) => {
    if (r.first_tries <= 0) return best;
    return Math.max(best, Math.round((100 * r.first_correct) / r.first_tries));
  }, 0);

  const now = new Date();
  const recentSessions: ProfileSession[] = recentRows.map((r, i) => {
    const acc = Math.round(100 * (sessionAccuracyBySession.get(r.session_id) ?? 0));
    const detail =
      r.mode === "competition"
        ? `${r.score} pts`
        : r.mode === "expert"
          ? `${r.correct_count} named`
          : `${r.question_count} resolved rounds`;
    return {
      id: `s${i}`,
      mode: r.mode,
      modeLabel: MODE_LABELS[r.mode],
      accuracy: acc,
      detail,
      when: relWhen(new Date(r.started_at), now),
    };
  });

  const categories: ProfileCategoryStat[] = catRows.map((r) => ({
    key: r.cat,
    label: CATEGORY_LABELS[r.cat] ?? r.cat,
    accuracy: r.accuracy,
    seen: r.seen,
  }));

  const overallAccuracy =
    agg.first_tries > 0 ? Math.round((100 * agg.first_correct) / agg.first_tries) : 0;

  const { eye, displayMastered } = buildEye(perTfAnswers, states, attrs);
  eye.streak = streak;
  eye.streakRecord = streakRecord;
  eye.dailyGoal = { done: todayGoodAnswers, target: 3 };

  const badgeMetrics: BadgeMetrics = {
    paliersLit: eye.axes
      .filter((a) => !a.roadmap)
      .reduce((s, a) => s + a.paliers.filter((p) => !p.roadmap && p.state === "lit").length, 0),
    axesLit: eye.axes.filter((a) => !a.roadmap && a.state === "lit").length,
    roundsWon: totalGames,
    typefacesSeen: agg.typefaces_seen,
    bestSessionAccuracy,
    streakDays: streak,
    fastAnswers: agg.fast,
    displayMastered,
  };

  const createdAt = userRows[0]?.created_at ? new Date(userRows[0].created_at) : now;
  const memberSince = `Member since ${createdAt.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`;

  const profile: PlayerProfile = {
    name: "You",
    handle: `@guest-${userId.slice(0, 4)}`,
    initials: "JT",
    memberSince,
    rankTitle: eye.title,
    level: eye.level,
    xpInLevel: eye.xpInLevel,
    xpForNext: eye.xpForNext,
    kpis: [
      { key: "games", label: "Games played", value: String(totalGames), helper: "across all modes" },
      { key: "accuracy", label: "Overall accuracy", value: `${overallAccuracy}%`, helper: "first attempts" },
      { key: "best-score", label: "Best score", value: String(bestScore), helper: "competition mode" },
      { key: "streak", label: "Best streak", value: String(bestStreakRow[0]?.best_streak ?? 0), helper: "correct in a row" },
      { key: "typefaces", label: "Typefaces seen", value: String(agg.typefaces_seen), helper: `of ${totals.catalog_total}` },
      { key: "time", label: "Time trained", value: humanizeMs(totalTimeMs), helper: "total" },
    ],
    modes: { training: modeGames("training"), competition: modeGames("competition"), expert: modeGames("expert") },
    // The linear snake board + milestones have no real backing (the constellation
    // is the live view). Kept from the mock so the legacy fallback still renders.
    board: MOCK_PROFILE.board,
    catalog: { seen: agg.typefaces_seen, mastered: totals.mastered, total: totals.catalog_total },
    categories,
    recentSessions,
    activity,
    streak,
    dailyGoal: { done: todayGoodAnswers, target: 3 },
    milestones: MOCK_PROFILE.milestones,
    badges: buildBadges(badgeMetrics),
  };

  return { profile, eye };
}

// ---------------------------------------------------------------------------
// Lightweight progression aggregate for the in-game indicator (training payload).
//
// This does NOT rebuild any computation: it reuses buildEye (which itself reuses
// levelFromXp) so the eye level is derived EXACTLY as the profile page derives it.
// Faces mastered / pool size / average mastery come straight from
// user_typeface_state. Only 3 reads (vs loadRealProfile's full profile fan-out)
// so it is cheap enough to compute on each resolved question.
// ---------------------------------------------------------------------------

export type TrainingProgressAggregate = {
  eyeLevel: number;
  facesMastered: number;
  poolSize: number;
  avgMastery: number;
};

export async function loadTrainingProgress(
  userId: string,
): Promise<TrainingProgressAggregate> {
  const [perTfAnswers, states, attrs] = await Promise.all([
    queryRows<AnswerRow>(sql`
      SELECT typeface_slug, COUNT(*)::int AS answers, COUNT(*) FILTER (WHERE is_correct)::int AS correct
      FROM user_event_fact WHERE user_id = ${userId}::uuid AND event_type = 'answer'
      GROUP BY typeface_slug`),
    queryRows<StateRow>(sql`
      SELECT typeface_slug, mastery_level FROM user_typeface_state WHERE user_id = ${userId}::uuid`),
    queryRows<AttrRow>(sql`
      SELECT typeface_slug, primary_category::text AS primary_category, sub_category::text AS sub_category,
             aperture_profile::text AS aperture_profile, contrast_profile::text AS contrast_profile
      FROM typefaces_core`),
  ]);

  const { eye } = buildEye(perTfAnswers, states, attrs);
  const poolSize = states.length;
  const facesMastered = states.filter((s) => s.mastery_level >= 4).length;
  const avgMastery = poolSize
    ? Math.round((states.reduce((sum, s) => sum + s.mastery_level, 0) / poolSize) * 100) / 100
    : 0;

  return { eyeLevel: eye.level, facesMastered, poolSize, avgMastery };
}
