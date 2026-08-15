// Formatters shared by the competition screen and its end of session recap.
//
// They were local to CompetitionScreen while the recap lived inside it. The
// recap is its own component now (2026-08-15), and the playing screen still
// prints click times in its feedback line, so the two would have drifted into
// two ways of writing the same number. One place.

export const formatClickTime = (responseTimeMs: number) =>
  `${(responseTimeMs / 1000).toFixed(2)}s`;

export const formatRate = (value: number) =>
  `${Number.isInteger(value) ? value : value.toFixed(1)}%`;

export const formatMetric = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

export const formatCategoryLabel = (category: string) =>
  category.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
