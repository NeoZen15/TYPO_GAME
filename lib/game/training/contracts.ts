import { type GameFontFace } from "@/lib/game/fonts/contracts";

export type Locale = "fr" | "en";

export type QuestionOption = {
  slug: string;
  label: string;
};

// fontFamily is the family to apply to the specimen; fontFace is the descriptor
// the client injects just before showing it. They are produced together by
// lib/game/fonts/runtime-catalog: when fontFace is null, fontFamily has fallen
// back and the specimen would NOT be rendered in its own typeface, which makes
// the question unanswerable. The provider refuses to build such a question.
export type TrainingQuestion = {
  id: string;
  token: string;
  displayWord: string;
  typefaceSlug: string;
  typefaceLabel: string;
  fontFamily: string;
  fontFace: GameFontFace | null;
  options: QuestionOption[];
};

// Progress carried to the client. resolvedCount is how many questions this
// session has resolved so far; there is no total, because a training session has
// no planned length (I-17: it ends when the player decides, never on a counter).
// The optional aggregate feeds the unobtrusive in-game progression indicator
// (reused from profile-stats loadTrainingProgress). The aggregate is present on
// session start and on each RESOLVED question, and omitted on a wrong (non-
// advancing) turn where mastery has not moved.
//
// visibleLevel / levelChanged carry the global visible Dreyfus level (N.1..E.5,
// spec I-08). It is the aggregated READ of mastery_level (NOT the XP-based
// eyeLevel above, which is a separate volume system). visibleLevel is recomputed
// after EACH answer (N-22) and levelChanged is true only when the persisted level
// moved, so the client can raise a one-off toast (N-24 / N-25) and never a
// continuous level display. levelChanged is present only on answer responses.
export type TrainingProgress = {
  resolvedCount: number;
  eyeLevel?: number;
  facesMastered?: number;
  poolSize?: number;
  visibleLevel?: string;
  levelChanged?: boolean;
};

export type TrainingStartResponse = {
  sessionId: string;
  userId: string;
  question: TrainingQuestion;
  progress: TrainingProgress;
};

// No sessionComplete here any more: answering can never end a session. A session
// is closed only by an explicit call to the end path (I-17), so a correct answer
// always carries the next question.
export type TrainingAnswerResponse = {
  result: "correct" | "wrong";
  questionResolved: boolean;
  feedbackText: string;
  progress: TrainingProgress;
  nextQuestion?: TrainingQuestion;
};

// Bilan of one session. Pure data: how long, how many, what moved, what was
// confused. It carries no wording and no ordering intent; presentation is decided
// by the interface, not here.
export type TrainingSessionSummary = {
  durationMs: number;
  questionsResolved: number;
  answersSubmitted: number;
  firstTryCorrect: number;
  /** Share of first attempts that were correct, 0 to 1. Retries excluded. */
  firstTryAccuracy: number;
  retryCount: number;
  typefacesSeen: number;
  /** Slugs answered for the first time ever during this session. */
  typefacesDiscovered: string[];
  /** Slugs whose mastery went up during this session. */
  typefacesReinforced: string[];
  /** Slugs whose mastery went down during this session. */
  typefacesWeakened: string[];
  /** Net mastery movement over first attempts, can be negative. */
  masteryNet: number;
  /**
   * Shown face against the name picked instead, most frequent first. `chosen` is
   * null for a timeout or an invalid answer (answer_slug is nullable on
   * user_event_fact, see lib/game/training/session-summary.ts).
   */
  confusions: { shown: string; chosen: string | null; count: number }[];
  medianResponseMs: number;
  fastestResponseMs: number;
  slowestResponseMs: number;
  poolSize?: number;
  facesMastered?: number;
};

export type TrainingEndResponse = {
  sessionId: string;
  summary: TrainingSessionSummary;
  /** True when the session row was closed by this call, false when it already was. */
  closedByThisCall: boolean;
};

// Cold-start prior collected at onboarding. The engine cannot infer it before
// the first round, so it is the one signal we carry from onboarding into the
// training pool seeding (see init_user_pool overload, migration 004).
export const FAMILIARITY_VALUES = [
  "Not at all",
  "A little",
  "Quite familiar",
  "Designer",
] as const;

export type Familiarity = (typeof FAMILIARITY_VALUES)[number];

export const normalizeFamiliarity = (value: unknown): Familiarity | null =>
  typeof value === "string" && (FAMILIARITY_VALUES as readonly string[]).includes(value)
    ? (value as Familiarity)
    : null;
