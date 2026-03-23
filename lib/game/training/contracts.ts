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
