// Mock player profile.
//
// There is no auth yet, so the profile page reads from this typed mock.
// The shape is intentionally close to what the game engine already produces
// (see `CompetitionSessionSummary` in lib/game/competition/contracts.ts) so it
// can be swapped for a real API payload later without touching the UI.

import { buildBadges, type BadgeMetrics } from "@/lib/profile/badge-rules";

export type ProfileMode = "training" | "competition" | "expert";

export type ProfileKpi = {
  key: string;
  label: string;
  value: string;
  helper: string;
};

export type ProfileCategoryStat = {
  key: string;
  label: string;
  accuracy: number; // 0..100
  seen: number;
};

export type ProfileSession = {
  id: string;
  mode: ProfileMode;
  modeLabel: string;
  accuracy: number; // 0..100
  detail: string; // mode-appropriate result line
  when: string; // relative label
};

export type ProfileMilestone = {
  key: string;
  label: string;
  sub: string;
  state: "done" | "current" | "locked";
};

export type ProfileBadge = {
  key: string;
  label: string;
  hint: string;
  icon: string;
  earned: boolean;
  progress?: { current: number; total: number };
};

// The progression "board" — a serpentine learning path (react.gg-inspired,
// rendered strictly cream-on-black). Numbered chapters punctuate the track;
// the short uppercase `tiles` are the individual notions/faces written into
// the cases between the numbered nodes.
export type ProfileBoardChapter = {
  n: number;
  title: string;
  state: "done" | "current" | "locked";
  roadmap?: boolean; // shown as "Roadmap" instead of "Locked" — mechanic not built yet
  blurb: string;
  accuracy: number | null; // 0..100, null when not started
  seen: number;
  cleared: number; // paliers (sub-steps) mastered so far, <= tiles.length
  tiles: string[]; // the paliers / sub-categories of this axis (board cases)
};

export type ProfileBoard = {
  currentChapter: number; // matches a chapter `n`
  chapters: ProfileBoardChapter[];
};

export type PlayerProfile = {
  name: string;
  handle: string;
  initials: string;
  memberSince: string;
  rankTitle: string;
  level: number;
  xpInLevel: number;
  xpForNext: number;
  kpis: ProfileKpi[];
  modes: { training: number; competition: number; expert: number }; // games per mode
  board: ProfileBoard;
  catalog: { seen: number; mastered: number; total: number };
  categories: ProfileCategoryStat[];
  recentSessions: ProfileSession[];
  activity: number[]; // sessions per day, oldest -> newest (last 30 days)
  streak: number;
  dailyGoal: { done: number; target: number };
  milestones: ProfileMilestone[];
  badges: ProfileBadge[];
};

export const MOCK_PROFILE: PlayerProfile = {
  name: "Marion Launay",
  handle: "@marionl",
  initials: "ML",
  memberSince: "Member since March 2026",
  rankTitle: "Trained eye",
  level: 7,
  xpInLevel: 320,
  xpForNext: 500,
  kpis: [
    { key: "games", label: "Games played", value: "142", helper: "across all modes" },
    { key: "accuracy", label: "Overall accuracy", value: "78%", helper: "all answers" },
    { key: "best-score", label: "Best score", value: "286", helper: "competition mode" },
    { key: "streak", label: "Best streak", value: "19", helper: "correct in a row" },
    { key: "typefaces", label: "Typefaces seen", value: "412", helper: "of 2000+" },
    { key: "time", label: "Time trained", value: "6h 40m", helper: "total" },
  ],
  modes: { training: 78, competition: 44, expert: 20 }, // 142 games total
  board: {
    currentChapter: 4,
    chapters: [
      {
        n: 1,
        title: "Seeing Shape",
        state: "done",
        blurb: "You stop reading the word and start seeing its shape.",
        accuracy: 86,
        seen: 210,
        cleared: 4,
        tiles: ["WEIGHT", "ROUNDNESS", "WIDTH", "ASCENDERS & DESCENDERS"],
      },
      {
        n: 2,
        title: "Seeing Families",
        state: "done",
        blurb: "Type isn't chaos — it falls into a few clear families.",
        accuracy: 81,
        seen: 168,
        cleared: 5,
        tiles: ["SERIF OR SANS", "MONOSPACE", "SCRIPT", "TEXT OR DISPLAY", "SERIF CLASS", "SANS CLASS"],
      },
      {
        n: 3,
        title: "Seeing Structure",
        state: "done",
        blurb: "You stop seeing whole letters and start seeing how they're built.",
        accuracy: 74,
        seen: 132,
        cleared: 6,
        tiles: ["APERTURE", "CONTRAST", "STRESS", "TERMINALS", "X-HEIGHT", "SET-WIDTH"],
      },
      {
        n: 4,
        title: "Seeing Rhythm",
        state: "current",
        blurb: "From the letter to the line — you start to hear the type's rhythm.",
        accuracy: 63,
        seen: 58,
        cleared: 1,
        tiles: ["CADENCE", "TYPE COLOUR", "TRACKING", "KERNING"],
      },
      {
        n: 5,
        title: "Seeing Signatures",
        state: "locked",
        blurb: "From the general to the singular: every face has its tells.",
        accuracy: null,
        seen: 0,
        cleared: 0,
        tiles: ["STOREYS", "LEG, TAIL & SPUR", "DOT & BAR"],
      },
      {
        n: 6,
        title: "Seeing Confusion",
        state: "locked",
        blurb: "You learn why you slip — and the one detail that splits two look-alikes.",
        accuracy: null,
        seen: 0,
        cleared: 0,
        tiles: ["GROTESQUE TWINS", "OLD-STYLE TWINS", "GEOMETRIC TWINS"],
      },
      {
        n: 7,
        title: "Seeing Intention",
        state: "locked",
        roadmap: true,
        blurb: "Not just how a face is built, but why it exists and what it says.",
        accuracy: null,
        seen: 0,
        cleared: 0,
        tiles: ["TEXT FACES", "SIGNAGE", "DIDONES", "NEUTRAL GROTESQUES", "HUMANIST"],
      },
      {
        n: 8,
        title: "Seeing Like a Designer",
        state: "locked",
        roadmap: true,
        blurb: "You spot the micro-variations the public never will.",
        accuracy: null,
        seen: 0,
        cleared: 0,
        tiles: ["WEIGHTS", "OPTICAL SIZES", "REVIVALS", "FOUNDRY"],
      },
    ],
  },
  catalog: { seen: 412, mastered: 168, total: 2000 },
  categories: [
    { key: "sans_serif", label: "Sans serif", accuracy: 84, seen: 180 },
    { key: "serif", label: "Serif", accuracy: 72, seen: 142 },
    { key: "mono", label: "Monospace", accuracy: 88, seen: 46 },
    { key: "display", label: "Display", accuracy: 61, seen: 44 },
  ],
  recentSessions: [
    { id: "s1", mode: "competition", modeLabel: "Competition", accuracy: 81, detail: "212 pts", when: "2h ago" },
    { id: "s2", mode: "training", modeLabel: "Training", accuracy: 88, detail: "7 / 8 rounds", when: "Yesterday" },
    { id: "s3", mode: "competition", modeLabel: "Competition", accuracy: 74, detail: "168 pts", when: "Yesterday" },
    { id: "s4", mode: "expert", modeLabel: "Expert", accuracy: 60, detail: "12 named", when: "2 days ago" },
    { id: "s5", mode: "training", modeLabel: "Training", accuracy: 100, detail: "8 / 8 rounds", when: "3 days ago" },
  ],
  // 30 days, oldest -> newest. The last 4 days are non-zero (matches streak: 4),
  // the day before them is 0 (so the current streak is exactly 4).
  activity: [
    1, 0, 2, 1, 0, 1, 2, 0, 0, 1, 3, 1, 0, 2, 1,
    0, 1, 2, 1, 0, 2, 1, 3, 1, 0, 2, 1, 1, 2, 1,
  ],
  streak: 4,
  dailyGoal: { done: 2, target: 3 },
  milestones: [
    { key: "sans", label: "Sans-serif basics", sub: "Grotesques & humanists", state: "done" },
    { key: "serif", label: "Serif structure", sub: "Old-style to modern", state: "done" },
    { key: "mono", label: "Monospace & numerals", sub: "Fixed-width tells", state: "done" },
    { key: "contrast", label: "Contrast & axis", sub: "Where the weight sits", state: "current" },
    { key: "display", label: "Display & character", sub: "High-personality faces", state: "locked" },
    { key: "expert", label: "Expert eye", sub: "Name it, no options", state: "locked" },
  ],
  badges: [], // filled below from MOCK_BADGE_METRICS (needs MOCK_EYE, defined later)
};

// ===========================================================================
// EYE PROFILE — the non-linear "map of seeing" model
// ===========================================================================
//
// Source of truth: docs/game/perceptual-progression-spec.md (§3, §4·B, §6.3) and
// docs/game/scoring-and-selection-math.md (§2, §4, §6). This SUPERSEDES the linear
// `ProfileBoard`/`chapters` model above (done/current/locked + single pawn),
// which is kept only as a fallback for the legacy snake board.
//
// Key shift — NON-LINEAR:
//   • States are dormant / emerging / lit (+ needsRefresh, a display-only flag).
//     There is NO "locked": an axis never depends on the previous one.
//   • An axis lights when ITS OWN thresholds are met, in the player's personal
//     order — several axes can be `emerging` at once, there is no "you are here".
//   • The eye only goes up: `lit` never turns off (it's what distinguishes the
//     Eye layer from the volatile Arena rank — kept in `ArenaProfile`, separate).
//
// Lighting thresholds (provisional — tuned later from telemetry, never here):
//   • palier `lit`  ⟺ accuracy a ≥ 0.80 GENERALISED over ≥ 5 DISTINCT
//     typefaces — proof the concept transfers, NOT memorising 5 specific faces.
//     (The per-typeface Leitner boxes only drive spaced-repetition planning.)
//   • axis  `lit`   ⟺ ≥ 70% of its non-roadmap paliers are `lit`
//
// A palier NEVER names a typeface. Confusion is by FAMILY (grotesque / old-style
// / geometric twins), never "Helvetica vs Arial" — typeface names are data
// (the confusion pairs), never palier labels.
//
// Axes/paliers ARE DERIVED from per-typo mastery — never hand-incremented. Here
// the palier state is authored consistently with its (a, mastered), and the
// axis state / litRatio are COMPUTED from the paliers (see `buildAxis`).

export type PerceptualAxisId =
  | "shape"
  | "families"
  | "structure"
  | "rhythm"
  | "signatures"
  | "confusion"
  | "intention"
  | "designer";

// Monotone: never "locked" (which would regress). The eye does not recede.
export type AxisState = "dormant" | "emerging" | "lit";

export type PerceptualPalier = {
  id: string; // ex. "3.1"
  label: string; // player-facing game name, ex. "OPEN OR CLOSED"
  state: AxisState;
  // Accuracy 0..1 over EVERY answer recorded on this step's typefaces, not a
  // recent window: buildEye sums totAnswers / totCorrect with no time bound
  // (lib/profile/profile-stats.ts). The word "recent" lived here and got copied
  // into a player-facing label on the map, where it promised a window the maths
  // does not have. Say what it is, so the next label cannot inherit the lie.
  a: number;
  mastered: number; // typos in Leitner box ≥ 4
  needsRefresh?: boolean; // display-only, never turns off `lit`
  roadmap?: boolean; // mechanic not built yet (axes 7-8)
};

export type PerceptualAxis = {
  id: PerceptualAxisId;
  n: number; // 1..8, the canonical order (presentation only, NOT a gate)
  label: string; // "Seeing Shape" …
  blurb: string; // the "shift" voice, kept from the board
  state: AxisState; // DERIVED from paliers
  paliers: PerceptualPalier[];
  litRatio: number; // share of non-roadmap paliers lit, 0..1 (DERIVED)
  litAt?: string; // ISO, set once on first reaching "lit"
  needsRefresh?: boolean; // display-only, never turns off "lit"
  roadmap?: boolean; // axes 7-8 (intention / designer)
};

export type EyeProfile = {
  title: string; // derived from the number of `lit` axes
  level: number; // player level (a system of its own)
  xpInLevel: number;
  xpForNext: number; // = 100 × level (math §6.1: cost N→N+1 = S_lvl·N)
  coins: number; // spend-only currency ("jetons", math §16)
  streak: number; // daily streak (days)
  streakRecord: number; // longest daily streak ever — durable (the eye only goes up)
  dailyGoal: { done: number; target: number };
  axes: PerceptualAxis[];
};

export type ArenaRank = "bronze" | "silver" | "gold" | "platinum" | "diamond";

// One row of the division file (the ranked leaderboard, math §7).
export type ArenaStanding = {
  place: number;
  handle: string;
  sr: number; // skill rating (= ELO)
  you?: boolean;
};

// Competition sub-modes (math §1·B): Blitz, Duel, Ligue.
export type RankedMatchMode = "blitz" | "duel" | "ligue";

// A finished ranked match — the match history (W/L + skill-rating delta, math §7.2).
export type RankedMatch = {
  id: string;
  mode: RankedMatchMode;
  result: "win" | "loss";
  srDelta: number; // ELO change for this match
  detail: string; // mode-appropriate result line
  when: string;
};

// The competition layer — volatile (goes up AND down). Kept SEPARATE from the
// eye on purpose (NIVEAU.rtf §8): it must never live inside the path. Typed now,
// surfaced in the UI later (perceptual-spec §11, Phase 3).
export type ArenaProfile = {
  rank: ArenaRank;
  division: number;
  place: number; // position in the 30-player division file (top 7 promote / bottom 5 demote, math §7)
  weeklyPoints: number; // S_week — resets weekly (math §7)
  weekEndsAt: string; // ISO — end of the current weekly window (S_week reset)
  elo: number;
  season: number; // current ranked season (quarterly soft-reset, math §7)
  standings: ArenaStanding[]; // the division file around your place
  rankedMatches: RankedMatch[]; // recent ranked match history
};

const AXIS_LIT_THRESHOLD = 0.7; // ≥ 70% of non-roadmap paliers lit

// Derive an axis's state + litRatio from its paliers (never the other way).
function buildAxis(
  axis: Omit<PerceptualAxis, "state" | "litRatio" | "roadmap"> & {
    roadmap?: boolean;
  },
): PerceptualAxis {
  const roadmap = axis.roadmap ?? axis.paliers.every((p) => p.roadmap);
  const live = axis.paliers.filter((p) => !p.roadmap);
  const litCount = live.filter((p) => p.state === "lit").length;
  const litRatio = live.length ? litCount / live.length : 0;

  let state: AxisState;
  if (roadmap) state = "dormant";
  else if (litRatio >= AXIS_LIT_THRESHOLD) state = "lit";
  else if (axis.paliers.some((p) => p.state !== "dormant")) state = "emerging";
  else state = "dormant";

  return { ...axis, roadmap, state, litRatio };
}

// Count of live axes that are lit — drives the eye title.
export function litAxisCount(eye: EyeProfile): number {
  return eye.axes.filter((a) => !a.roadmap && a.state === "lit").length;
}

// Count of live paliers that are lit across the whole eye — feeds the
// progression badges (badge-rules.ts: "First spark"). Roadmap paliers excluded.
export function litPalierCount(eye: EyeProfile): number {
  return eye.axes
    .filter((a) => !a.roadmap)
    .reduce((sum, a) => sum + a.paliers.filter((p) => !p.roadmap && p.state === "lit").length, 0);
}

// Eye title derived from how many axes are lit (perceptual-spec §6.2: the title
// is a function of `lit` axes, in complement of the level — not in its place).
export function eyeTitle(litAxes: number): string {
  const TITLES = [
    "Fresh eyes", // 0
    "Awakening eye", // 1
    "Trained eye", // 2
    "Sharp eye", // 3
    "Keen eye", // 4
    "Discerning eye", // 5
    "Master eye", // 6 — all live axes lit
  ];
  return TITLES[Math.min(litAxes, TITLES.length - 1)];
}

// Potential XP for fully lighting an axis (math §5.7: +100/palier, +500/axis).
export function axisXp(axis: PerceptualAxis): number {
  return axis.paliers.length * 100 + 500;
}

export const MOCK_EYE: EyeProfile = {
  title: "", // filled below from litAxisCount (kept consistent)
  level: 7,
  xpInLevel: 320,
  xpForNext: 700, // = 100 × 7 (fixes the old "320 / 500": level 7→8 is 700)
  coins: 240,
  streak: 4,
  streakRecord: 18,
  dailyGoal: { done: 2, target: 3 },
  axes: [
    buildAxis({
      id: "shape",
      n: 1,
      label: "Seeing Shape",
      blurb: "Read the silhouette before the letters.",
      litAt: "2026-03-18",
      paliers: [
        { id: "1.1", label: "Weight", state: "lit", a: 0.92, mastered: 9 },
        { id: "1.2", label: "Roundness", state: "lit", a: 0.88, mastered: 8 },
        { id: "1.3", label: "Width", state: "lit", a: 0.85, mastered: 7 },
        { id: "1.4", label: "Ascenders & descenders", state: "lit", a: 0.9, mastered: 6 },
      ],
    }),
    buildAxis({
      id: "families",
      n: 2,
      label: "Seeing Families",
      blurb: "Place it in its family.",
      litAt: "2026-04-02",
      paliers: [
        { id: "2.1", label: "Serif or sans", state: "lit", a: 0.9, mastered: 8 },
        { id: "2.2", label: "Monospace", state: "lit", a: 0.86, mastered: 6 },
        { id: "2.3", label: "Script", state: "lit", a: 0.88, mastered: 5 },
        { id: "2.4", label: "Text or display", state: "lit", a: 0.82, mastered: 5 },
        { id: "2.5", label: "Serif class", state: "lit", a: 0.84, mastered: 6 },
        { id: "2.6", label: "Sans class", state: "emerging", a: 0.74, mastered: 3 },
      ],
    }),
    buildAxis({
      id: "structure",
      n: 3,
      label: "Seeing Structure",
      // 3/6 paliers lit (50% < 70%) → EMERGING, not lit. Fixes the old screen,
      // where Structure read "CLEARED" at 74% accuracy (below the 80% palier bar).
      blurb: "The anatomy of a letter.",
      paliers: [
        { id: "3.1", label: "Aperture", state: "lit", a: 0.85, mastered: 6 },
        { id: "3.2", label: "Contrast", state: "lit", a: 0.83, mastered: 5 },
        { id: "3.3", label: "Stress (axis)", state: "emerging", a: 0.72, mastered: 4 },
        { id: "3.4", label: "Terminals", state: "emerging", a: 0.68, mastered: 3 },
        { id: "3.5", label: "x-height", state: "lit", a: 0.81, mastered: 5 },
        { id: "3.6", label: "Set-width", state: "emerging", a: 0.6, mastered: 2 },
      ],
    }),
    buildAxis({
      id: "rhythm",
      n: 4,
      label: "Seeing Rhythm",
      blurb: "The rhythm of a line.",
      paliers: [
        { id: "4.1", label: "Cadence", state: "emerging", a: 0.66, mastered: 3 },
        { id: "4.2", label: "Type colour", state: "lit", a: 0.8, mastered: 5 },
        { id: "4.3", label: "Tracking", state: "emerging", a: 0.58, mastered: 2 },
        { id: "4.4", label: "Kerning", state: "dormant", a: 0, mastered: 0 },
      ],
    }),
    buildAxis({
      id: "signatures",
      n: 5,
      label: "Seeing Signatures",
      // Started early on the easy tells (storeys) while Structure is still
      // emerging — two axes emerging at once, the non-linear point. 3 paliers.
      blurb: "The tells that give a face away.",
      paliers: [
        { id: "5.1", label: "Storeys", state: "lit", a: 0.86, mastered: 6 },
        { id: "5.2", label: "Leg, tail & spur", state: "emerging", a: 0.6, mastered: 2 },
        { id: "5.3", label: "Dot & bar", state: "emerging", a: 0.7, mastered: 3 },
      ],
    }),
    buildAxis({
      id: "confusion",
      n: 6,
      label: "Seeing Confusion",
      // Untouched live axis → fully `dormant` (distinct from roadmap: reachable,
      // just not started). Paliers are by FAMILY (never named typefaces — those
      // live in the confusion-pair data). 3 paliers.
      blurb: "Near-identical twins.",
      paliers: [
        { id: "6.1", label: "Grotesque twins", state: "dormant", a: 0, mastered: 0 },
        { id: "6.2", label: "Old-style twins", state: "dormant", a: 0, mastered: 0 },
        { id: "6.3", label: "Geometric twins", state: "dormant", a: 0, mastered: 0 },
      ],
    }),
    buildAxis({
      id: "intention",
      n: 7,
      label: "Seeing Intention",
      blurb: "What a face is made to do.",
      roadmap: true,
      paliers: [
        { id: "7.1", label: "Text faces", state: "dormant", a: 0, mastered: 0, roadmap: true },
        { id: "7.2", label: "Signage faces", state: "dormant", a: 0, mastered: 0, roadmap: true },
        { id: "7.3", label: "Didones", state: "dormant", a: 0, mastered: 0, roadmap: true },
        { id: "7.4", label: "Neutral grotesques", state: "dormant", a: 0, mastered: 0, roadmap: true },
        { id: "7.5", label: "Humanist faces", state: "dormant", a: 0, mastered: 0, roadmap: true },
      ],
    }),
    buildAxis({
      id: "designer",
      n: 8,
      label: "Seeing Like a Designer",
      blurb: "What only a trained eye catches.",
      roadmap: true,
      paliers: [
        { id: "8.1", label: "Weights", state: "dormant", a: 0, mastered: 0, roadmap: true },
        { id: "8.2", label: "Optical sizes", state: "dormant", a: 0, mastered: 0, roadmap: true },
        { id: "8.3", label: "Revivals", state: "dormant", a: 0, mastered: 0, roadmap: true },
        { id: "8.4", label: "Foundry", state: "dormant", a: 0, mastered: 0, roadmap: true },
      ],
    }),
  ],
};

// Title stays consistent with the derived lit-axis count.
MOCK_EYE.title = eyeTitle(litAxisCount(MOCK_EYE));

// Mock scoring signals that drive the badges. The real `/api/profile/*` will
// return this same `BadgeMetrics` shape (scoring-implementation-contract.md §7)
// and `buildBadges` lights the achievements identically. The galaxy metrics are
// DERIVED from MOCK_EYE (exactly as the API will derive them from buildEyeProfile);
// the rest are kept consistent with the mock (catalog.seen 412, streak 4).
const MOCK_BADGE_METRICS: BadgeMetrics = {
  paliersLit: litPalierCount(MOCK_EYE), // 14 lit paliers → "First spark" earned
  axesLit: litAxisCount(MOCK_EYE), // 2 lit axes → "First galaxy" earned · 2/8 to DWIGGINS
  roundsWon: 142, // earned (≥1)
  typefacesSeen: MOCK_PROFILE.catalog.seen, // 412 → earned (≥100)
  bestSessionAccuracy: 88, // earned (≥85%)
  streakDays: MOCK_PROFILE.streak, // 4 → 4/7, 4/30, 4/100, 4/365
  fastAnswers: 14, // 14 / 20
  displayMastered: 9, // 9 / 30
};

// Light the achievements from the metrics now that MOCK_EYE exists (same
// post-assignment pattern as MOCK_EYE.title above).
MOCK_PROFILE.badges = buildBadges(MOCK_BADGE_METRICS);

export const MOCK_ARENA: ArenaProfile = {
  rank: "silver",
  division: 2,
  place: 9, // 9th of 30 — clear of promotion (top 7) and relegation (bottom 5)
  weeklyPoints: 168,
  weekEndsAt: "2026-06-21T23:59:59Z", // next Sunday — weekly S_week reset
  elo: 1240,
  season: 2,
  // The division file around your place (#7 is the last promotion spot).
  standings: [
    { place: 7, handle: "@koutline", sr: 1262 },
    { place: 8, handle: "@marin_b", sr: 1251 },
    { place: 9, handle: "@marionl", sr: 1240, you: true },
    { place: 10, handle: "@pjm", sr: 1228 },
    { place: 11, handle: "@aravel", sr: 1219 },
  ],
  rankedMatches: [
    { id: "m1", mode: "blitz", result: "win", srDelta: 18, detail: "212 pts", when: "2h ago" },
    { id: "m2", mode: "duel", result: "loss", srDelta: -12, detail: "lost 1–2", when: "5h ago" },
    { id: "m3", mode: "blitz", result: "win", srDelta: 15, detail: "168 pts", when: "Yesterday" },
    { id: "m4", mode: "ligue", result: "win", srDelta: 9, detail: "held #9", when: "2 days ago" },
  ],
};

// Detailed, written explanation of every palier (keyed by id) — surfaced in the
// zoomed-in galaxy view. The "what you're learning to see" for each sub-step.
export const PALIER_DESC: Record<string, string> = {
  // 1 — Shape · read the silhouette before the letters
  "1.1": "Heavy or light?",
  "1.2": "Round, or angular?",
  "1.3": "Narrow, or wide?",
  "1.4": "Tall, or short?",
  // 2 — Families · place it in its family
  "2.1": "Feet, or none?",
  "2.2": "Every letter the same width?",
  "2.3": "Drawn by hand, or set in type?",
  "2.4": "To read, or to show off?",
  "2.5": "Old-style, transitional, didone or slab?",
  "2.6": "Grotesque, humanist or geometric?",
  // 3 — Structure · the anatomy of a letter
  "3.1": "Openings open up, or close in?",
  "3.2": "Even strokes, or thick-and-thin?",
  "3.3": "Upright, or leaning?",
  "3.4": "A foot, a ball, or a clean cut?",
  "3.5": "Tall lowercase, or short?",
  "3.6": "Condensed, or extended?",
  // 4 — Rhythm · the rhythm of a line
  "4.1": "A steady beat, or uneven?",
  "4.2": "An even grey, or patchy?",
  "4.3": "Tight, or loose?",
  "4.4": "Spot the badly-fitted pair.",
  // 5 — Signatures · the tells that give a face away
  "5.1": "A one- or two-storey a and g?",
  "5.2": "The R's leg, Q's tail, G's spur.",
  "5.3": "The i's dot, the e's bar.",
  // 6 — Confusion · near-identical twins (by family, never named faces)
  "6.1": "Grotesque sans that mirror each other.",
  "6.2": "Old-style serifs that look alike.",
  "6.3": "Round geometrics, easy to confuse.",
  // 7 — Intention (roadmap) · what a face is made to do
  "7.1": "Drawn for long reading.",
  "7.2": "Read fast, from far.",
  "7.3": "High contrast, made to feel refined.",
  "7.4": "Made to disappear.",
  "7.5": "Made to feel warm.",
  // 8 — Designer (roadmap) · what only a trained eye catches
  "8.1": "Tell neighbouring weights apart.",
  "8.2": "A display cut, or a text cut?",
  "8.3": "The original, or a modern revival?",
  "8.4": "Whose studio drew it?",
};
