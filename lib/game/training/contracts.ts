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

export type TrainingStartResponse = {
  sessionId: string;
  userId: string;
  question: TrainingQuestion;
  progress: {
    resolvedCount: number;
    totalRounds: number;
  };
};

export type TrainingAnswerResponse = {
  result: "correct" | "wrong";
  questionResolved: boolean;
  feedbackText: string;
  progress: {
    resolvedCount: number;
    totalRounds: number;
  };
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
