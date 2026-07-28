export type Locale = "fr" | "en";

export type QuestionOption = {
  slug: string;
  label: string;
};

export type TrainingQuestion = {
  id: string;
  token: string;
  displayWord: string;
  typefaceSlug: string;
  typefaceLabel: string;
  fontFamily: string;
  options: QuestionOption[];
};

// Progress carried to the client. resolvedCount/totalRounds drive the round meter;
// the optional aggregate feeds the unobtrusive in-game progression indicator
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
  totalRounds: number;
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

export type TrainingAnswerResponse = {
  result: "correct" | "wrong";
  questionResolved: boolean;
  feedbackText: string;
  progress: TrainingProgress;
  nextQuestion?: TrainingQuestion;
  sessionComplete?: boolean;
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
