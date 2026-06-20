import type { Layout, Shape, Tier } from "@/lib/brand/dwiggins-badge-engine";
import type { ProfileBadge } from "@/lib/profile/mock-profile";

// ===========================================================================
// BADGE RULES — single source of truth for achievements (profile-tabs-spec §5)
// ===========================================================================
//
// Every badge's "délai" (its unlock threshold), its family, its art finish
// (rarity), and the scoring signal it watches live HERE — not scattered across
// the mock and the board component.
//
// Spec: docs/ui/profile-tabs-spec.md §5 — families Progression · Streak · Speed ·
// Exploration · Mastery. Per spec, badges unlock on REAL scoring events
// (scoring-and-selection-math.md §5.7 / §16), not invented counters. Today the
// values are fed by the mock (`MOCK_BADGE_METRICS`); tomorrow `/api/profile/*`
// returns the same `BadgeMetrics` shape and these rules light the badges
// unchanged (scoring-implementation-contract.md §7).
// ---------------------------------------------------------------------------

export type BadgeFamily = "Progression" | "Streak" | "Speed" | "Exploration" | "Mastery";

// The scoring signals a badge can watch. Each maps to a number the scoring
// engine already tracks (or will). Add a key here when you add a metric source.
export type BadgeMetric =
  | "paliersLit" // lit paliers across the eye (from buildEyeProfile → litPalierCount)
  | "axesLit" // lit axes (from buildEyeProfile → litAxisCount); 8 = DWIGGINS complete
  | "roundsWon" // rounds won across all modes
  | "typefacesSeen" // distinct typefaces encountered (catalog.seen)
  | "bestSessionAccuracy" // best single-session accuracy, in %
  | "streakDays" // consecutive days played
  | "fastAnswers" // answers given under the "fast" threshold (math §2.1)
  | "displayMastered"; // display-family faces brought to mastery

export type BadgeMetrics = Record<BadgeMetric, number>;

export type BadgeRule = {
  key: string;
  label: string;
  family: BadgeFamily;
  hint: string; // human-readable condition, surfaced on the card
  metric: BadgeMetric; // which scoring signal this badge watches
  threshold: number; // the "délai" — value of `metric` required to unlock
  unit?: string; // for clarity only (days, %, typefaces…)
  icon: string; // legacy icon key (kept for ProfileBadge compat)
  art: { tier: Tier; shape: Shape; layout: Layout; glyph?: string }; // Dwiggins finish — rarity carried by the tier
};

// The catalogue. PROVISIONAL thresholds — they are placeholders to be calibrated
// against real telemetry (math §13), never tuned by hand. The streak ladder
// (7 / 30 / 100 / 365) and the progression badges (1st palier · 1st axis · the
// 8 axes = DWIGGINS complete) are spec-mandated (profile-tabs-spec §5); the rest
// are v1 targets that read as credible milestones. Rarity (art.tier) climbs with
// how hard the badge is to earn — DWIGGINS complete is the lone `mythic`.
//
// Order = the on-brand narrative: the galaxy/progression badges first (native to
// the eye), then exploration/mastery/speed, the full streak ladder, and the
// ultimate DWIGGINS badge as the finale.
export const BADGE_RULES: BadgeRule[] = [
  {
    key: "first-palier",
    label: "First spark",
    family: "Progression",
    hint: "Light your first palier",
    metric: "paliersLit",
    threshold: 1,
    icon: "spark",
    art: { tier: "common", shape: "circle", layout: "symbol" },
  },
  {
    key: "first-axis",
    label: "First galaxy",
    family: "Progression",
    hint: "Light a full axis",
    metric: "axesLit",
    threshold: 1,
    icon: "orbit",
    art: { tier: "rare", shape: "hexagon", layout: "symbol" },
  },
  {
    key: "first-win",
    label: "First win",
    family: "Progression",
    hint: "Win a round",
    metric: "roundsWon",
    threshold: 1,
    icon: "flag",
    art: { tier: "common", shape: "circle", layout: "symbol" },
  },
  {
    key: "sharp-eye",
    label: "Sharp eye",
    family: "Mastery",
    hint: "85% on a session",
    metric: "bestSessionAccuracy",
    threshold: 85,
    unit: "%",
    icon: "eye",
    art: { tier: "rare", shape: "circle", layout: "symbol" },
  },
  {
    key: "speed",
    label: "Speed demon",
    family: "Speed",
    hint: "20 fast answers",
    metric: "fastAnswers",
    threshold: 20,
    icon: "bolt",
    art: { tier: "rare", shape: "square", layout: "mono", glyph: "W" },
  },
  {
    key: "centurion",
    label: "Centurion",
    family: "Exploration",
    hint: "100 typefaces seen",
    metric: "typefacesSeen",
    threshold: 100,
    unit: "typefaces",
    icon: "layers",
    art: { tier: "epic", shape: "circle", layout: "symbol" },
  },
  {
    key: "display-master",
    label: "Display master",
    family: "Mastery",
    hint: "Master 30 display faces",
    metric: "displayMastered",
    threshold: 30,
    unit: "faces",
    icon: "star",
    art: { tier: "epic", shape: "shield", layout: "symFull" },
  },
  {
    key: "week-streak",
    label: "Week streak",
    family: "Streak",
    hint: "7 days in a row",
    metric: "streakDays",
    threshold: 7,
    unit: "days",
    icon: "calendar",
    art: { tier: "rare", shape: "shield", layout: "symFull" },
  },
  {
    key: "month-streak",
    label: "Month streak",
    family: "Streak",
    hint: "30 days in a row",
    metric: "streakDays",
    threshold: 30,
    unit: "days",
    icon: "calendar",
    art: { tier: "epic", shape: "shield", layout: "symFull" },
  },
  {
    key: "streak-100",
    label: "Hundred days",
    family: "Streak",
    hint: "100 days in a row",
    metric: "streakDays",
    threshold: 100,
    unit: "days",
    icon: "calendar",
    art: { tier: "legendary", shape: "shield", layout: "symFull" },
  },
  {
    key: "streak-365",
    label: "A full year",
    family: "Streak",
    hint: "365 days in a row",
    metric: "streakDays",
    threshold: 365,
    unit: "days",
    icon: "calendar",
    art: { tier: "mythic", shape: "shield", layout: "symFull" },
  },
  {
    key: "dwiggins-complete",
    label: "DWIGGINS complete",
    family: "Progression",
    hint: "Light all 8 axes",
    metric: "axesLit",
    threshold: 8,
    unit: "axes",
    icon: "trophy",
    art: { tier: "mythic", shape: "rosette", layout: "seal" },
  },
];

const RULE_BY_KEY: Record<string, BadgeRule> = Object.fromEntries(
  BADGE_RULES.map((r) => [r.key, r]),
);

export function badgeRule(key: string): BadgeRule | undefined {
  return RULE_BY_KEY[key];
}

// Evaluate one rule against the player's current metric value. Earned once the
// value reaches the threshold; otherwise we expose a progress fraction for the
// card's bar. This is the function the scoring layer calls — swap the mock
// metrics for real ones and badges light themselves.
export function evaluateBadge(rule: BadgeRule, value: number): ProfileBadge {
  const earned = value >= rule.threshold;
  return {
    key: rule.key,
    label: rule.label,
    hint: rule.hint,
    icon: rule.icon,
    earned,
    ...(earned ? {} : { progress: { current: value, total: rule.threshold } }),
  };
}

// Build the full `ProfileBadge[]` (what the page renders) from a metrics bag.
export function buildBadges(metrics: BadgeMetrics): ProfileBadge[] {
  return BADGE_RULES.map((rule) => evaluateBadge(rule, metrics[rule.metric]));
}
