import {
  buildAggregateIssues,
  collectAggregateAmbiguityFlags,
  collectAggregateOvershoots,
  pickAggregateMetric,
  pickAggregateWitnessSet,
  resolveAverageConfidence,
} from "@/lib/typography/measurement-aggregation-core";
import { CONFIDENCE_SCORE } from "@/lib/typography/measurement-core";
import type {
  AuditSummary,
  ConfidenceLevel,
  GlyphMeasurementProfile,
  MeasurementProvenanceKind,
  RenderContextProfile,
  TypefaceMeasurementProfile,
  TypefaceSourceDescriptor,
  WordMeasurementProfile,
} from "@/lib/typography/measurement-profile-contracts";

export type BuildTypefaceMeasurementProfileParams = {
  source: TypefaceSourceDescriptor;
  glyphProfiles: Record<string, GlyphMeasurementProfile>;
  wordProfiles: Record<string, WordMeasurementProfile>;
  renderContexts: RenderContextProfile[];
  provenance?: TypefaceMeasurementProfile["provenance"];
  version?: string;
  generatedAt?: string;
  measurementEngineVersion?: string;
  notes?: string[];
};

const buildAuditSummary = ({
  glyphProfiles,
  wordProfiles,
  metrics,
  witnesses,
}: {
  glyphProfiles: Record<string, GlyphMeasurementProfile>;
  wordProfiles: Record<string, WordMeasurementProfile>;
  metrics: TypefaceMeasurementProfile["metrics"];
  witnesses: TypefaceMeasurementProfile["witnesses"];
}): AuditSummary => {
  const issues = buildAggregateIssues({ glyphProfiles, wordProfiles, metrics, witnesses });
  const issueCounts = {
    info: issues.filter((issue) => issue.severity === "info").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    minor: issues.filter((issue) => issue.severity === "minor").length,
    major: issues.filter((issue) => issue.severity === "major").length,
    blocking: issues.filter((issue) => issue.severity === "blocking").length,
  };

  const glyphConfidenceValues = Object.values(glyphProfiles).map((profile) => CONFIDENCE_SCORE[profile.confidence]);
  const wordConfidenceValues = Object.values(wordProfiles).map((profile) => CONFIDENCE_SCORE[profile.confidence]);
  const allConfidenceValues = [...glyphConfidenceValues, ...wordConfidenceValues];
  const averageConfidenceScore = allConfidenceValues.length
    ? allConfidenceValues.reduce((sum, value) => sum + value, 0) / allConfidenceValues.length
    : 1;

  const structure = Math.max(0, 100 - issueCounts.warning * 8 - issueCounts.major * 18 - issueCounts.blocking * 30);
  const witnessReliability = Math.max(0, Math.round((averageConfidenceScore / 2) * 100) - issueCounts.warning * 6);
  const overshootHandling = Math.max(
    0,
    100 - Object.values(glyphProfiles).filter((profile) => profile.overshoots.some((overshoot) => !overshoot.expected)).length * 12
  );
  const renderingStability = Math.max(0, 100 - issueCounts.minor * 6 - issueCounts.major * 15);
  const pedagogicalReadability = Math.max(
    0,
    100 -
      Object.values(glyphProfiles).reduce((sum, profile) => sum + profile.ambiguityFlags.length, 0) -
      Object.values(wordProfiles).reduce((sum, profile) => sum + profile.ambiguityFlags.length, 0)
  );
  const score = Math.round((structure + witnessReliability + overshootHandling + renderingStability + pedagogicalReadability) / 5);
  const confidence: ConfidenceLevel = resolveAverageConfidence({ glyphProfiles, wordProfiles });
  const status = issueCounts.blocking || issueCounts.major ? "fail" : issueCounts.warning || issueCounts.minor ? "review" : "pass";

  return {
    status,
    confidence,
    score,
    dimensions: {
      structure,
      witnessReliability,
      overshootHandling,
      renderingStability,
      pedagogicalReadability,
    },
    issueCounts,
    issues,
    reviewedGlyphCount: Object.keys(glyphProfiles).length,
    reviewedWordCount: Object.keys(wordProfiles).length,
    notes: [
      "Aggregate audit derived from current glyph and word dev profiles.",
      "Scores are conservative heuristics intended for comparison during engine stabilization.",
    ],
  };
};

export const buildTypefaceMeasurementProfile = ({
  source,
  glyphProfiles,
  wordProfiles,
  renderContexts,
  provenance = {
    kind: "preset-derived" satisfies MeasurementProvenanceKind,
    runtime: "fallback",
    note: "No explicit provenance supplied by the builder.",
  },
  version = "dev-0.1.0",
  generatedAt = new Date().toISOString(),
  measurementEngineVersion = "dev-current",
  notes = [],
}: BuildTypefaceMeasurementProfileParams): TypefaceMeasurementProfile => {
  const metrics: TypefaceMeasurementProfile["metrics"] = {
    baseline: pickAggregateMetric({ metricKey: "baseline", glyphProfiles, wordProfiles }),
    xHeight: pickAggregateMetric({ metricKey: "xHeight", glyphProfiles, wordProfiles }),
    capHeight: pickAggregateMetric({ metricKey: "capHeight", glyphProfiles, wordProfiles }),
    ascender: pickAggregateMetric({ metricKey: "ascender", glyphProfiles, wordProfiles }),
    descender: pickAggregateMetric({ metricKey: "descender", glyphProfiles, wordProfiles }),
    advanceWidth: pickAggregateMetric({ metricKey: "advanceWidth", glyphProfiles, wordProfiles }),
  };

  const witnesses: TypefaceMeasurementProfile["witnesses"] = {
    baseline: pickAggregateWitnessSet({ role: "baseline", wordProfiles }),
    xHeight: pickAggregateWitnessSet({ role: "xHeight", wordProfiles }),
    ascender: pickAggregateWitnessSet({ role: "ascender", wordProfiles }),
    descender: pickAggregateWitnessSet({ role: "descender", wordProfiles }),
    capHeight: pickAggregateWitnessSet({ role: "capHeight", wordProfiles }),
  };

  const overshoots = collectAggregateOvershoots({ glyphProfiles, wordProfiles });

  const ambiguityFlags = collectAggregateAmbiguityFlags({ glyphProfiles, wordProfiles });

  const audit = buildAuditSummary({
    glyphProfiles,
    wordProfiles,
    metrics,
    witnesses,
  });

  return {
    fontId: source.fontId,
    familyName: source.familyName,
    version,
    script: "latin",
    source,
    provenance,
    measurementConventions: {
      fontMetrics:
        "Baseline, x-height, and cap-height are treated as font-level structural metrics projected into the stage.",
      inkMetrics:
        "Advance width and ink-bound driven values reflect visible projected bounds rather than only font table metrics.",
      witnessMetrics:
        "Ascender and descender may be reinforced by word witnesses and measured letter regions when the corpus exposes them.",
    },
    engine: {
      measurementEngineVersion,
      generatedAt,
      renderContexts,
    },
    metrics,
    witnesses,
    overshoots,
    glyphProfiles,
    wordProfiles,
    audit,
    ambiguityFlags,
    confidence: audit.confidence,
    notes: [
      "Typeface aggregate built from current dev glyph and word measurement profiles.",
      ...notes,
    ],
  };
};
