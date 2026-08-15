import {
  formatCategoryLabel,
  formatClickTime,
  formatMetric,
  formatRate,
} from "@/lib/game/competition/format";
import type { RecapView } from "@/lib/game/recap-view";
import type { CompetitionSessionSummary, CompetitionStats } from "@/lib/game/competition/contracts";

// Competition's own reading of a finished session.
//
// The four figures answer what a player asks in the three seconds after the
// clock stops: how did I score, did I see right, did I hold it, was I quick.
// Then speed on the left and, on the right, the misses, which are the only
// thing on the page that teaches anything.
//
// What this adapter deliberately leaves out, because one run of twenty answers
// says almost nothing with it while a history says a lot: the category mix, the
// pace and score curves, the count of typefaces seen. The payload also carries
// commonConfusions, speedBuckets, wrongCount and two per-minute rates that have
// never been displayed. All of it stays computed and sent, and is recorded in
// the checklist as the owner's call.

/**
 * When the run ends without figures. Reachable: the answer handler sets the
 * summary from `payload.summary ?? null` and marks the session complete a few
 * lines later, so a payload that arrives without one still ends the run. The
 * page then says so rather than rendering empty panels.
 */
export const COMPETITION_RECAP_UNAVAILABLE: RecapView = {
  kicker: "Competition · session over",
  title: "Time is up.",
  lede:
    "The run is closed and your answers are recorded. The figures for this session did not come back, so there is nothing to read here. Your profile still has the whole history.",
  kpis: [],
  left: { title: "Speed profile", tag: "This run", empty: "No figures for this run." },
  right: { title: "What you missed", empty: "No figures for this run." },
};

export const buildCompetitionRecapView = (
  summary: CompetitionSessionSummary,
  stats: CompetitionStats | null
): RecapView => {
  const answered = stats?.answeredCount ?? 0;
  const correct = stats?.correctCount ?? 0;
  const time = (value: number | null) => (value === null ? "—" : formatClickTime(value));

  return {
    kicker: "Competition · session over",
    title: "Time is up.",
    lede: `${correct} of ${answered} correct. Two points for a fast answer, one for a correct one, none for a miss.`,
    kpis: [
      {
        key: "score",
        value: String(stats?.score ?? 0),
        label: "Score",
        helper: "competition points",
      },
      {
        key: "accuracy",
        value: formatRate(summary.accuracyRate),
        label: "Accuracy",
        helper: `${correct} of ${answered}`,
      },
      {
        key: "streak",
        value: String(summary.bestCorrectStreak),
        label: "Best streak",
        helper: "correct in a row",
      },
      {
        key: "avg",
        value: time(summary.averageResponseTimeMs),
        label: "Avg. click",
        helper: `${summary.fastAnswerCount} under 2s`,
      },
    ],
    left: {
      title: "Speed profile",
      tag: "This run",
      figures: [
        { value: time(summary.fastestResponseTimeMs), label: "fastest" },
        { value: time(summary.averageResponseTimeMs), label: "average" },
        { value: time(summary.slowestResponseTimeMs), label: "slowest" },
      ],
      foot: [
        { value: time(summary.averageCorrectResponseTimeMs), label: "on correct" },
        { value: time(summary.averageWrongResponseTimeMs), label: "on wrong" },
        { value: formatMetric(summary.averagePointsPerAnswer), label: "pts / answer" },
      ],
    },
    right: {
      title: "What you missed",
      // Three at most. A fourth row costs the screen, and nobody studies their
      // fourth mistake here.
      rows: summary.recentMisses.slice(0, 3).map((entry) => ({
        key: `${entry.correctSlug}-${entry.guessedSlug}-${entry.displayWord}`,
        chip: formatCategoryLabel(entry.category),
        detail: `${entry.guessedLabel} instead of ${entry.correctLabel}`,
        value: formatClickTime(entry.responseTimeMs),
        aside: entry.displayWord,
      })),
      empty: "No misses on this run. Clean sheet.",
    },
  };
};
