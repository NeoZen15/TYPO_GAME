import "server-only";

import { sql } from "@/lib/server/neon";
import { buildBadges, type BadgeMetrics } from "@/lib/profile/badge-rules";
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
  mode: ProfileMode;
  question_count: number;
  correct_count: number;
  score: number;
  started_at: string | Date;
};
type CatRow = { cat: string; seen: number; accuracy: number };
type DayRow = { d: string | Date };
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

function streakFromDays(days: number[]): number {
  let i = days.length - 1;
  if (i >= 0 && days[i] === 0) i -= 1; // today not played yet — don't break it
  let streak = 0;
  for (; i >= 0 && days[i] > 0; i -= 1) streak += 1;
  return streak;
}

function longestRun(dayKeys: string[]): number {
  const set = new Set(dayKeys);
  let best = 0;
  for (const key of set) {
    const prev = new Date(`${key}T00:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    if (set.has(prev.toISOString().slice(0, 10))) continue; // not a run start
    let run = 0;
    const cur = new Date(`${key}T00:00:00Z`);
    while (set.has(cur.toISOString().slice(0, 10))) {
      run += 1;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    best = Math.max(best, run);
  }
  return best;
}

const dayKey = (d: string | Date): string =>
  (typeof d === "string" ? d : d.toISOString()).slice(0, 10);

export async function loadRealProfile(
  userId: string,
): Promise<{ profile: PlayerProfile; eye: EyeProfile } | null> {
  const [
    modeRows,
    answerAgg,
    bestStreakRow,
    bestAccRow,
    catRows,
    masteryRow,
    recentRows,
    activityRows,
    activeDayRows,
    perTfAnswers,
    states,
    attrs,
    userRows,
  ] = await Promise.all([
    queryRows<ModeRow>(sql`
      SELECT mode, COUNT(*)::int AS games, COALESCE(MAX(score),0)::int AS best_score,
             COALESCE(SUM(duration_ms),0)::bigint AS time_ms
      FROM sessions WHERE user_id = ${userId}::uuid AND status <> 'invalid'
      GROUP BY mode`),
    queryRows<{ answers: number; correct: number; typefaces_seen: number; fast: number }>(sql`
      SELECT COUNT(*)::int AS answers, COUNT(*) FILTER (WHERE is_correct)::int AS correct,
             COUNT(DISTINCT typeface_slug)::int AS typefaces_seen,
             COUNT(*) FILTER (WHERE is_correct AND response_time_ms < 2000)::int AS fast
      FROM user_event_fact WHERE user_id = ${userId}::uuid AND event_type = 'answer'`),
    queryRows<{ best_streak: number }>(sql`
      WITH ordered AS (
        SELECT is_correct,
          ROW_NUMBER() OVER (ORDER BY event_ts_utc) -
          ROW_NUMBER() OVER (PARTITION BY is_correct ORDER BY event_ts_utc) AS grp
        FROM user_event_fact WHERE user_id = ${userId}::uuid AND event_type = 'answer')
      SELECT COALESCE(MAX(cnt),0)::int AS best_streak FROM (
        SELECT COUNT(*) AS cnt FROM ordered WHERE is_correct GROUP BY grp) s`),
    queryRows<{ best_acc: number }>(sql`
      SELECT COALESCE(MAX(ROUND(100.0*correct_count/question_count)),0)::int AS best_acc
      FROM sessions WHERE user_id = ${userId}::uuid AND question_count > 0`),
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
    queryRows<SessionRow>(sql`
      SELECT mode, question_count, correct_count, score, started_at
      FROM sessions WHERE user_id = ${userId}::uuid AND question_count > 0
      ORDER BY started_at DESC LIMIT 5`),
    queryRows<{ d: string | Date; n: number }>(sql`
      SELECT started_at::date AS d, COUNT(*)::int AS n
      FROM sessions WHERE user_id = ${userId}::uuid AND started_at >= now() - interval '30 days'
      GROUP BY started_at::date`),
    queryRows<DayRow>(sql`
      SELECT DISTINCT started_at::date AS d FROM sessions WHERE user_id = ${userId}::uuid`),
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

  const agg = answerAgg[0] ?? { answers: 0, correct: 0, typefaces_seen: 0, fast: 0 };
  const totals = masteryRow[0] ?? { mastered: 0, catalog_total: 2000 };
  const totalGames = modeRows.reduce((s, r) => s + r.games, 0);

  // No play history at all → let the UI fall back to the mock so the page never
  // reads as broken for someone who literally hasn't played.
  if (totalGames === 0 && agg.answers === 0) return null;

  const modeGames = (m: ProfileMode) => modeRows.find((r) => r.mode === m)?.games ?? 0;
  const bestScore = Math.max(0, ...modeRows.map((r) => r.best_score));
  const totalTimeMs = modeRows.reduce((s, r) => s + Number(r.time_ms), 0);

  // 30-day activity, oldest → newest (index 29 = today, UTC).
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const activity = new Array<number>(30).fill(0);
  for (const row of activityRows) {
    const d = new Date(`${dayKey(row.d)}T00:00:00Z`);
    const idx = 29 - Math.round((today.getTime() - d.getTime()) / 86_400_000);
    if (idx >= 0 && idx < 30) activity[idx] = row.n;
  }
  const streak = streakFromDays(activity);
  const streakRecord = Math.max(streak, longestRun(activeDayRows.map((r) => dayKey(r.d))));

  const now = new Date();
  const recentSessions: ProfileSession[] = recentRows.map((r, i) => {
    const acc = r.question_count > 0 ? Math.round((100 * r.correct_count) / r.question_count) : 0;
    const detail =
      r.mode === "competition"
        ? `${r.score} pts`
        : r.mode === "expert"
          ? `${r.correct_count} named`
          : `${r.correct_count} / ${r.question_count} rounds`;
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

  const overallAccuracy = agg.answers > 0 ? Math.round((100 * agg.correct) / agg.answers) : 0;

  const { eye, displayMastered } = buildEye(perTfAnswers, states, attrs);
  const todaySessions = activity[29] ?? 0;
  eye.streak = streak;
  eye.streakRecord = streakRecord;
  eye.dailyGoal = { done: todaySessions, target: 3 };

  const badgeMetrics: BadgeMetrics = {
    paliersLit: eye.axes
      .filter((a) => !a.roadmap)
      .reduce((s, a) => s + a.paliers.filter((p) => !p.roadmap && p.state === "lit").length, 0),
    axesLit: eye.axes.filter((a) => !a.roadmap && a.state === "lit").length,
    roundsWon: totalGames,
    typefacesSeen: agg.typefaces_seen,
    bestSessionAccuracy: bestAccRow[0]?.best_acc ?? 0,
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
      { key: "accuracy", label: "Overall accuracy", value: `${overallAccuracy}%`, helper: "all answers" },
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
    dailyGoal: { done: todaySessions, target: 3 },
    milestones: MOCK_PROFILE.milestones,
    badges: buildBadges(badgeMetrics),
  };

  return { profile, eye };
}
