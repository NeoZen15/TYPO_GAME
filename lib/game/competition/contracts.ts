export type CompetitionQuestionOption = {
  slug: string;
  label: string;
};

export type CompetitionFontFace = {
  family: string;
  src: string;
  weight: number;
  style: string;
};

export type CompetitionQuestion = {
  id: string;
  token: string;
  displayWord: string;
  typefaceSlug: string;
  typefaceLabel: string;
  fontFamily: string;
  fontFace: CompetitionFontFace | null;
  options: CompetitionQuestionOption[];
};

export type CompetitionStats = {
  answeredCount: number;
  correctCount: number;
  score: number;
  totalDurationMs: number;
  remainingMs: number;
  deadlineUtc: string;
};

export type CompetitionSessionCategorySummary = {
  category: string;
  answeredCount: number;
  correctCount: number;
  accuracyRate: number;
};

export type CompetitionSessionConfusion = {
  correctSlug: string;
  correctLabel: string;
  guessedSlug: string;
  guessedLabel: string;
  count: number;
};

export type CompetitionSessionMiss = {
  correctSlug: string;
  correctLabel: string;
  guessedSlug: string;
  guessedLabel: string;
  responseTimeMs: number;
  displayWord: string;
  category: string;
};

export type CompetitionSessionAnswerPoint = {
  answerIndex: number;
  responseTimeMs: number;
  isCorrect: boolean;
  awardedPoints: number;
};

export type CompetitionSessionSpeedBucket = {
  label: string;
  count: number;
  percentage: number;
  tone: "positive" | "neutral" | "warning" | "negative";
};

export type CompetitionSessionSummary = {
  wrongCount: number;
  accuracyRate: number;
  fastAnswerCount: number;
  answersPerMinute: number;
  pointsPerMinute: number;
  averagePointsPerAnswer: number;
  averageResponseTimeMs: number | null;
  averageCorrectResponseTimeMs: number | null;
  averageWrongResponseTimeMs: number | null;
  fastestResponseTimeMs: number | null;
  slowestResponseTimeMs: number | null;
  bestCorrectStreak: number;
  uniqueTypefacesSeenCount: number;
  categoryPerformance: CompetitionSessionCategorySummary[];
  strongestCategories: CompetitionSessionCategorySummary[];
  weakestCategories: CompetitionSessionCategorySummary[];
  commonConfusions: CompetitionSessionConfusion[];
  recentMisses: CompetitionSessionMiss[];
  answerTimeline: CompetitionSessionAnswerPoint[];
  speedBuckets: CompetitionSessionSpeedBucket[];
};

export type CompetitionStartResponse = {
  sessionId: string;
  userId: string;
  question: CompetitionQuestion;
  stats: CompetitionStats;
};

export type CompetitionAnswerResponse = {
  result: "correct" | "wrong";
  awardedPoints: number;
  responseTimeMs: number;
  feedbackText: string;
  stats: CompetitionStats;
  nextQuestion?: CompetitionQuestion;
  sessionComplete?: boolean;
  summary?: CompetitionSessionSummary;
};

export type CompetitionTimeoutResponse = {
  sessionComplete: true;
  feedbackText: string;
  stats: CompetitionStats;
  summary: CompetitionSessionSummary;
};
