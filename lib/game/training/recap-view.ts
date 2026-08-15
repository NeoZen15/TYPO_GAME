import { MODE_ACCENT } from "@/features/profile/components/board-system";
import { labelFromSlug, type RecapView } from "@/lib/game/recap-view";
import type { TrainingSessionSummary } from "@/lib/game/training/contracts";

// Training's own reading of a finished session.
//
// IT BORROWS NOTHING FROM COMPETITION'S VOCABULARY, ON PURPOSE. The mode states
// it in its own rules: there is no score to beat and no clock to race. So there
// is no score figure, no "time is up", no points. What training has and
// competition does not is mastery: it is the only mode that writes
// user_typeface_state, so it is the only one that can say your eye moved.
//
// The four figures answer what a training player asks when they stop: did I
// move, did I see right the first time, how much did I do, was I quick. Then
// what moved on the left, and what you confused on the right, which is the only
// thing on the page that teaches anything.
//
// Left out here, because a single session says little about them: the pool size
// and the mastered count, which are the profile's business.

/**
 * When the session closes without figures. The end route answers with a summary,
 * but a body that fails to parse still closes the run, and the page says so
 * rather than waiting on nothing.
 */
export const TRAINING_RECAP_UNAVAILABLE: RecapView = {
  accent: MODE_ACCENT.training,
  kicker: "Training · session closed",
  title: "Session closed.",
  lede:
    "Your answers are recorded, question by question, as you gave them. The figures for this session did not come back, so there is nothing to read here. Your profile still has the whole history.",
  kpis: [],
  left: { title: "What moved", tag: "This session", empty: "No figures for this session." },
  right: { title: "What you confused", empty: "No figures for this session." },
};

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

export const buildTrainingRecapView = (summary: TrainingSessionSummary): RecapView => {
  const moved = summary.masteryNet;
  const accuracy = Math.round(summary.firstTryAccuracy * 100);

  return {
    accent: MODE_ACCENT.training,
    kicker: "Training · session closed",
    // No clock ran out here: the session ends when the player stops. The title
    // reports what the session did to the eye, which is the mode's whole point.
    title: moved > 0 ? "Your eye moved." : "Session closed.",
    lede:
      summary.retryCount > 0
        ? `${summary.questionsResolved} typefaces resolved, ${summary.firstTryCorrect} right on the first look, ${summary.retryCount} found on a second try.`
        : `${summary.questionsResolved} typefaces resolved, ${summary.firstTryCorrect} right on the first look.`,
    kpis: [
      {
        key: "mastery",
        value: signed(moved),
        label: "Mastery",
        helper: "net movement",
      },
      {
        key: "accuracy",
        value: `${accuracy}%`,
        label: "Accuracy",
        helper: "first attempts",
      },
      {
        key: "resolved",
        value: String(summary.questionsResolved),
        label: "Resolved",
        helper: "this session",
      },
      {
        key: "median",
        value: seconds(summary.medianResponseMs),
        label: "Median click",
        helper: "typical answer",
      },
    ],
    left: {
      title: "What moved",
      tag: "This session",
      figures: [
        { value: String(summary.typefacesDiscovered.length), label: "discovered" },
        { value: String(summary.typefacesReinforced.length), label: "reinforced" },
        { value: String(summary.typefacesWeakened.length), label: "weakened" },
      ],
      foot: [
        { value: seconds(summary.fastestResponseMs), label: "fastest" },
        { value: seconds(summary.slowestResponseMs), label: "slowest" },
        { value: String(summary.typefacesSeen), label: "faces seen" },
      ],
    },
    right: {
      title: "What you confused",
      // Aggregated pairs with a count, where competition lists single events
      // with a time. Three at most, same reason.
      rows: summary.confusions.slice(0, 3).map((entry, index) => ({
        key: `${entry.shown}-${entry.chosen ?? "none"}-${index}`,
        chip: "",
        detail: entry.chosen
          ? `${labelFromSlug(entry.chosen)} instead of ${labelFromSlug(entry.shown)}`
          : `No answer on ${labelFromSlug(entry.shown)}`,
        value: entry.count > 1 ? `${entry.count}×` : "",
        aside: "",
      })),
      empty: "Nothing confused twice. Your eye held.",
    },
  };
};
