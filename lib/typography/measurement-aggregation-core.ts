import { CONFIDENCE_SCORE, dedupeBy } from "@/lib/typography/measurement-core";
import type {
  AuditIssue,
  ConfidenceLevel,
  GlyphMeasurementProfile,
  MetricKey,
  MetricValue,
  OvershootMeasurement,
  TypefaceMeasurementProfile,
  WitnessRole,
  WitnessSet,
  WordMeasurementProfile,
} from "@/lib/typography/measurement-profile-contracts";

const METRIC_PREFERENCES: Partial<Record<MetricKey, string[]>> = {
  baseline: ["x", "H", "minimum"],
  xHeight: ["x", "minimum", "access"],
  capHeight: ["H", "E", "T", "I", "O"],
  ascender: ["l", "h", "d", "b", "terminals"],
  descender: ["p", "q", "g", "y"],
};

const WITNESS_PREFERENCES: Partial<Record<WitnessRole, string[]>> = {
  xHeight: ["minimum", "access", "contrast"],
  baseline: ["minimum", "access", "terminals", "contrast"],
  ascender: ["terminals", "contrast"],
  descender: [],
  capHeight: [],
};

const sortMetricCandidates = (metricKey: MetricKey, candidates: Array<{ ownerKey: string; metric: MetricValue }>) => {
  const preferredOwners = METRIC_PREFERENCES[metricKey] ?? [];

  return [...candidates].sort((left, right) => {
    const leftConfidence = CONFIDENCE_SCORE[left.metric.confidence];
    const rightConfidence = CONFIDENCE_SCORE[right.metric.confidence];
    if (leftConfidence !== rightConfidence) return rightConfidence - leftConfidence;

    const leftPreferredIndex = preferredOwners.indexOf(left.ownerKey);
    const rightPreferredIndex = preferredOwners.indexOf(right.ownerKey);
    const leftRank = leftPreferredIndex === -1 ? Number.POSITIVE_INFINITY : leftPreferredIndex;
    const rightRank = rightPreferredIndex === -1 ? Number.POSITIVE_INFINITY : rightPreferredIndex;
    if (leftRank !== rightRank) return leftRank - rightRank;

    return left.ownerKey.localeCompare(right.ownerKey);
  });
};

export const pickAggregateMetric = ({
  metricKey,
  glyphProfiles,
  wordProfiles,
}: {
  metricKey: MetricKey;
  glyphProfiles: Record<string, GlyphMeasurementProfile>;
  wordProfiles: Record<string, WordMeasurementProfile>;
}) => {
  const candidates: Array<{ ownerKey: string; metric: MetricValue }> = [];

  for (const [glyph, profile] of Object.entries(glyphProfiles)) {
    const metric = profile.metrics[metricKey];
    if (metric && metric.status !== "missing" && metric.status !== "unsupported") {
      candidates.push({ ownerKey: glyph, metric });
    }
  }

  for (const [wordKey, profile] of Object.entries(wordProfiles)) {
    const metric = profile.metrics[metricKey];
    if (metric && metric.status !== "missing" && metric.status !== "unsupported") {
      candidates.push({ ownerKey: profile.word || wordKey, metric });
    }
  }

  if (!candidates.length) return undefined;

  const winner = sortMetricCandidates(metricKey, candidates)[0];
  return {
    ...winner.metric,
    note: winner.metric.note
      ? `${winner.metric.note} Aggregate source: ${winner.ownerKey}.`
      : `Aggregate source: ${winner.ownerKey}.`,
  } satisfies MetricValue;
};

export const pickAggregateWitnessSet = ({
  role,
  wordProfiles,
}: {
  role: WitnessRole;
  wordProfiles: Record<string, WordMeasurementProfile>;
}) => {
  const preferredWords = WITNESS_PREFERENCES[role] ?? [];
  const candidates = Object.values(wordProfiles)
    .map((profile) => ({ word: profile.word, witness: profile.witnesses[role] }))
    .filter((entry): entry is { word: string; witness: WitnessSet } => Boolean(entry.witness));

  if (!candidates.length) return undefined;

  return [...candidates]
    .sort((left, right) => {
      const leftConfidence = CONFIDENCE_SCORE[left.witness.confidence];
      const rightConfidence = CONFIDENCE_SCORE[right.witness.confidence];
      if (leftConfidence !== rightConfidence) return rightConfidence - leftConfidence;

      const leftRank = preferredWords.includes(left.word) ? preferredWords.indexOf(left.word) : Number.POSITIVE_INFINITY;
      const rightRank = preferredWords.includes(right.word) ? preferredWords.indexOf(right.word) : Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) return leftRank - rightRank;

      return left.word.localeCompare(right.word);
    })
    .map((entry) => entry.witness)[0];
};

export const collectAggregateOvershoots = ({
  glyphProfiles,
  wordProfiles,
}: {
  glyphProfiles: Record<string, GlyphMeasurementProfile>;
  wordProfiles: Record<string, WordMeasurementProfile>;
}): OvershootMeasurement[] =>
  dedupeBy(
    [...Object.values(glyphProfiles).flatMap((profile) => profile.overshoots), ...Object.values(wordProfiles).flatMap((profile) => profile.overshoots)],
    (overshoot) => `${overshoot.glyph}:${overshoot.direction}:${overshoot.relatedMetric}:${Math.round(overshoot.amountPx * 10)}`
  );

export const collectAggregateAmbiguityFlags = ({
  glyphProfiles,
  wordProfiles,
}: {
  glyphProfiles: Record<string, GlyphMeasurementProfile>;
  wordProfiles: Record<string, WordMeasurementProfile>;
}) =>
  dedupeBy(
    [...Object.values(glyphProfiles).flatMap((profile) => profile.ambiguityFlags), ...Object.values(wordProfiles).flatMap((profile) => profile.ambiguityFlags)],
    (flag) => flag
  );

export const buildAggregateIssues = ({
  glyphProfiles,
  wordProfiles,
  metrics,
  witnesses,
}: {
  glyphProfiles: Record<string, GlyphMeasurementProfile>;
  wordProfiles: Record<string, WordMeasurementProfile>;
  metrics: TypefaceMeasurementProfile["metrics"];
  witnesses: TypefaceMeasurementProfile["witnesses"];
}) => {
  const issues: AuditIssue[] = [];
  const requiredMetrics: MetricKey[] = ["baseline", "xHeight", "capHeight", "ascender", "descender"];

  for (const metricKey of requiredMetrics) {
    if (!metrics[metricKey]) {
      issues.push({
        id: `missing-metric-${metricKey}`,
        severity: "warning",
        status: "review",
        scope: "font",
        metric: metricKey,
        message: `Missing aggregate ${metricKey} metric.`,
        expected: "A measured canonical metric from glyph or word profiles.",
        observed: "No compatible profile candidate was available.",
        suggestedAction: "Add a canonical witness glyph or word that exposes this metric.",
      });
    }
  }

  const requiredWitnesses: WitnessRole[] = ["baseline", "xHeight"];
  for (const role of requiredWitnesses) {
    if (!witnesses[role]) {
      issues.push({
        id: `missing-witness-${role}`,
        severity: "warning",
        status: "review",
        scope: "font",
        witnessRole: role,
        message: `Missing aggregate ${role} witness set.`,
        expected: "A witness set from the current word audit corpus.",
        observed: "No compatible witness set was available.",
        suggestedAction: "Add a canonical word sample exposing this witness role.",
      });
    }
  }

  for (const profile of Object.values(glyphProfiles)) {
    if (profile.confidence === "low") {
      issues.push({
        id: `glyph-low-confidence-${profile.glyph}`,
        severity: "minor",
        status: "review",
        scope: "glyph",
        glyph: profile.glyph,
        message: `Low-confidence glyph profile for ${profile.glyph}.`,
        observed: profile.ambiguityFlags.join(", ") || "No specific ambiguity flag provided.",
      });
    }
  }

  for (const profile of Object.values(wordProfiles)) {
    if (profile.confidence === "low") {
      issues.push({
        id: `word-low-confidence-${profile.word}`,
        severity: "minor",
        status: "review",
        scope: "word",
        word: profile.word,
        message: `Low-confidence word profile for ${profile.word}.`,
        observed: profile.ambiguityFlags.join(", ") || "No specific ambiguity flag provided.",
      });
    }
  }

  return issues;
};

export const resolveAverageConfidence = ({
  glyphProfiles,
  wordProfiles,
}: {
  glyphProfiles: Record<string, GlyphMeasurementProfile>;
  wordProfiles: Record<string, WordMeasurementProfile>;
}): ConfidenceLevel => {
  const glyphConfidenceValues = Object.values(glyphProfiles).map((profile) => CONFIDENCE_SCORE[profile.confidence]);
  const wordConfidenceValues = Object.values(wordProfiles).map((profile) => CONFIDENCE_SCORE[profile.confidence]);
  const allConfidenceValues = [...glyphConfidenceValues, ...wordConfidenceValues];
  const averageConfidence = allConfidenceValues.length
    ? allConfidenceValues.reduce((sum, value) => sum + value, 0) / allConfidenceValues.length
    : 1;

  return averageConfidence >= 1.6 ? "high" : averageConfidence >= 0.9 ? "medium" : "low";
};
