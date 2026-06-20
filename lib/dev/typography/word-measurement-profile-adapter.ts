import type { WordAuditEvaluation } from "@/lib/dev/typography/word-audit-spec";
import {
  buildMeasurementBounds,
  buildMetricValuePx,
  formatUnicodeCodepoint,
  inferScriptForText,
} from "@/lib/typography/measurement-core";
import {
  buildGuideSupport,
  buildUnsupportedGuideFlags,
  buildWordFeatureSupport,
  resolveGuideConfidence,
  resolveGuideMetricStatus,
  resolveProfileConfidenceFromAudit,
} from "@/lib/typography/measurement-profile-core";
import { buildWitnessSet } from "@/lib/typography/measurement-witness-core";
import type {
  ConfidenceLevel,
  MeasurementScript,
  MetricKey,
  OvershootMeasurement,
  WitnessMeasurement,
  WitnessRole,
  WitnessSet,
  WordLetterMeasurement,
  WordMeasurementProfile,
} from "@/lib/typography/measurement-profile-contracts";
import type { WordGuideKey, WordOverlayMetrics, WordOverlayModel } from "@/lib/typography/word-overlay-engine";
import { resolveWordGuideAnchors, resolveWordWitnessPlan } from "@/lib/typography/word-overlay-engine";

const GUIDE_TO_METRIC = {
  baseline: "baseline",
  x: "xHeight",
  cap: "capHeight",
  ascender: "ascender",
  descender: "descender",
} as const satisfies Record<WordGuideKey, MetricKey>;

const GUIDE_TO_ROLE = {
  baseline: "baseline",
  x: "xHeight",
  cap: "capHeight",
  ascender: "ascender",
  descender: "descender",
} as const satisfies Record<WordGuideKey, WitnessRole>;

export type BuildWordMeasurementProfileParams = {
  fontId: string;
  renderContextId: string;
  word: string;
  metrics: WordOverlayMetrics;
  model: WordOverlayModel;
  auditEvaluation?: WordAuditEvaluation | null;
  script?: MeasurementScript;
};

const resolveConfidenceFromAudit = (auditEvaluation: WordAuditEvaluation | null): ConfidenceLevel => {
  if (!auditEvaluation) return "medium";
  return resolveProfileConfidenceFromAudit({
    pass: auditEvaluation.pass,
    partialPass: auditEvaluation.structuralPass || auditEvaluation.geometryPass || auditEvaluation.compositionPass,
  });
};

const findWitnessMeasurements = ({
  word,
  metrics,
  script,
}: {
  word: string;
  metrics: WordOverlayMetrics;
  script: MeasurementScript;
}) => {
  const anchors = resolveWordGuideAnchors({ word, metrics });
  const witnessPlan = resolveWordWitnessPlan(word);
  const measurements = new Map<WitnessRole, WitnessMeasurement[]>();
  const chosenGlyphs = new Map<WitnessRole, string[]>();

  const roleGuidePairs: Array<{ guideKey: WordGuideKey; glyphs: string[] }> = [
    { guideKey: "x", glyphs: witnessPlan.x },
    { guideKey: "baseline", glyphs: witnessPlan.baseline },
    { guideKey: "ascender", glyphs: witnessPlan.ascender },
    { guideKey: "descender", glyphs: witnessPlan.descender },
    { guideKey: "cap", glyphs: witnessPlan.cap },
  ];

  for (const { guideKey, glyphs } of roleGuidePairs) {
    const role = GUIDE_TO_ROLE[guideKey];
    const metricKey = GUIDE_TO_METRIC[guideKey];
    const anchorValue = anchors[guideKey];
    const matches = metrics.letterRegions.filter((region) => glyphs.includes(region.glyph.toLowerCase()));
    const witnessEntries = matches.map((region) => {
      const contactPosition = guideKey === "baseline" || guideKey === "descender" ? region.bottom : region.top;
      const deltaFromMetric = contactPosition - anchorValue;
      const expectedOvershoot =
        (guideKey === "x" || guideKey === "cap") && deltaFromMetric < -0.5
          ? true
          : guideKey === "descender" && deltaFromMetric > 0.5;

      return {
        glyph: region.glyph,
        unicode: formatUnicodeCodepoint(region.glyph),
        role,
        confidence: "high" as const,
        script,
        measuredBounds: buildMeasurementBounds(region.left, region.right, region.top, region.bottom),
        contactLine: metricKey,
        contactPosition,
        deltaFromMetric,
        overshootPx: expectedOvershoot ? Math.abs(deltaFromMetric) : undefined,
        expectedOvershoot,
        note: "Derived from the current word witness plan and measured letter regions.",
      } satisfies WitnessMeasurement;
    });

    measurements.set(role, witnessEntries);
    chosenGlyphs.set(role, witnessEntries.map((entry) => entry.glyph));
  }

  return {
    anchors,
    witnessPlan,
    measurements,
    chosenGlyphs,
  };
};

const buildWitnessSets = ({
  word,
  metrics,
  support,
  script,
}: {
  word: string;
  metrics: WordOverlayMetrics;
  support: ReturnType<typeof buildGuideSupport>;
  script: MeasurementScript;
}) => {
  const { witnessPlan, measurements, chosenGlyphs } = findWitnessMeasurements({ word, metrics, script });
  const result: Partial<Record<WitnessRole, WitnessSet>> = {};

  const roleConfigs: Array<{
    role: WitnessRole;
    supported: boolean;
    primaryGlyphs: string[];
    rationale: string;
  }> = [
    { role: "xHeight", supported: support.x, primaryGlyphs: witnessPlan.x, rationale: "Uses the current x-height witness plan for this word." },
    { role: "baseline", supported: support.baseline, primaryGlyphs: witnessPlan.baseline, rationale: "Uses letters whose bottoms currently define the perceived baseline." },
    { role: "ascender", supported: support.ascender, primaryGlyphs: witnessPlan.ascender, rationale: "Uses current ascender witness letters when the word exposes that zone." },
    { role: "descender", supported: support.descender, primaryGlyphs: witnessPlan.descender, rationale: "Uses current descender witness letters when the word exposes that zone." },
    { role: "capHeight", supported: support.cap, primaryGlyphs: witnessPlan.cap, rationale: "Uses uppercase witness letters when the current word exposes cap height." },
  ];

  for (const config of roleConfigs) {
    if (!config.supported) continue;
    const roleMeasurements = measurements.get(config.role) ?? [];
    result[config.role] = buildWitnessSet({
      role: config.role,
      primaryGlyphs: config.primaryGlyphs,
      fallbackGlyphs: [],
      chosenGlyphs: chosenGlyphs.get(config.role) ?? [],
      measurements: roleMeasurements,
      rationale: config.rationale,
    });
  }

  return result;
};

const buildOvershoots = (witnesses: Partial<Record<WitnessRole, WitnessSet>>): OvershootMeasurement[] => {
  const overshoots: OvershootMeasurement[] = [];

  for (const witnessSet of Object.values(witnesses)) {
    if (!witnessSet) continue;

    for (const measurement of witnessSet.measurements) {
      if (!measurement.expectedOvershoot || !measurement.overshootPx || measurement.overshootPx < 0.5) continue;

      overshoots.push({
        glyph: measurement.glyph,
        direction:
          measurement.role === "descender"
            ? "bottom"
            : measurement.role === "baseline"
              ? "bottom"
              : "top",
        amountPx: measurement.overshootPx,
        expected: true,
        confidence: measurement.confidence,
        relatedMetric: measurement.contactLine,
        note: `Derived from ${measurement.role} witness contact in the current word overlay.`,
      });
    }
  }

  return overshoots;
};

const buildLetters = (metrics: WordOverlayMetrics): WordLetterMeasurement[] =>
  metrics.letterRegions.map((region) => ({
    index: region.index,
    glyph: region.glyph,
    bounds: buildMeasurementBounds(region.left, region.right, region.top, region.bottom),
    roles: [],
  }));

const buildAmbiguityFlags = ({
  model,
  support,
  auditEvaluation,
}: {
  model: WordOverlayModel;
  support: ReturnType<typeof buildGuideSupport>;
  auditEvaluation: WordAuditEvaluation | null;
}) => {
  const flags = buildUnsupportedGuideFlags(support);

  if (!model.focusZones.length) {
    flags.add("no_local_focus_zone");
  }

  if (!auditEvaluation) {
    flags.add("audit_not_run");
    return [...flags];
  }

  if (!auditEvaluation.structuralPass) flags.add("structural_review");
  if (!auditEvaluation.geometryPass) flags.add("geometry_review");
  if (!auditEvaluation.compositionPass) flags.add("composition_review");

  for (const issue of auditEvaluation.issues) {
    if (issue.includes("Missing guides")) flags.add("missing_guides");
    if (issue.includes("Forbidden guides")) flags.add("forbidden_guides");
    if (issue.includes("Expected chips")) flags.add("chip_mismatch");
    if (issue.includes("focus zone")) flags.add("focus_zone_issue");
    if (issue.includes("band")) flags.add("band_issue");
    if (issue.includes("aligned")) flags.add("guide_alignment_issue");
    if (issue.includes("width measure")) flags.add("width_alignment_issue");
    if (issue.includes("margin")) flags.add("margin_issue");
    if (issue.includes("frame center")) flags.add("centering_issue");
  }

  return [...flags];
};

export const buildWordMeasurementProfile = ({
  fontId,
  renderContextId,
  word,
  metrics,
  model,
  auditEvaluation,
  script,
}: BuildWordMeasurementProfileParams): WordMeasurementProfile => {
  const resolvedScript = script ?? inferScriptForText(word);
  const support = buildGuideSupport(model.guideLines.map((guide) => guide.key));
  const confidence = resolveConfidenceFromAudit(auditEvaluation ?? null);
  const globalBounds = buildMeasurementBounds(metrics.bounds.left, metrics.bounds.right, metrics.bounds.top, metrics.bounds.bottom);
  const witnesses = buildWitnessSets({
    word,
    metrics,
    support,
    script: resolvedScript,
  });
  const overshoots = buildOvershoots(witnesses);

  return {
    word,
    script: resolvedScript,
    fontId,
    renderContextId,
    globalBounds,
    metrics: {
      baseline: buildMetricValuePx({
        key: "baseline",
        value: metrics.baseline,
        status: resolveGuideMetricStatus(support.baseline),
        confidence: resolveGuideConfidence(support.baseline),
        source: "wordWitness",
        note: "Current projected baseline used by the word overlay.",
      }),
      xHeight: buildMetricValuePx({
        key: "xHeight",
        value: metrics.xHeight,
        status: resolveGuideMetricStatus(support.x),
        confidence: resolveGuideConfidence(support.x),
        source: "wordWitness",
      }),
      capHeight: buildMetricValuePx({
        key: "capHeight",
        value: metrics.capHeight,
        status: resolveGuideMetricStatus(support.cap),
        confidence: resolveGuideConfidence(support.cap),
        source: "wordWitness",
      }),
      ascender: buildMetricValuePx({
        key: "ascender",
        value: metrics.ascender,
        status: resolveGuideMetricStatus(support.ascender),
        confidence: resolveGuideConfidence(support.ascender),
        source: "wordWitness",
      }),
      descender: buildMetricValuePx({
        key: "descender",
        value: metrics.descender,
        status: resolveGuideMetricStatus(support.descender),
        confidence: resolveGuideConfidence(support.descender),
        source: "wordWitness",
      }),
      advanceWidth: buildMetricValuePx({
        key: "advanceWidth",
        value: metrics.rawWordWidth,
        status: "measured",
        confidence: "high",
        source: "derived",
        note: "Mirrors the current word width chip and measured raw word width.",
      }),
      leftInk: buildMetricValuePx({
        key: "leftInk",
        value: metrics.bounds.left,
        status: "measured",
        confidence: "high",
        source: "inkBounds",
      }),
      rightInk: buildMetricValuePx({
        key: "rightInk",
        value: metrics.bounds.right,
        status: "measured",
        confidence: "high",
        source: "inkBounds",
      }),
      topInk: buildMetricValuePx({
        key: "topInk",
        value: metrics.bounds.top,
        status: "measured",
        confidence: "high",
        source: "inkBounds",
      }),
      bottomInk: buildMetricValuePx({
        key: "bottomInk",
        value: metrics.bounds.bottom,
        status: "measured",
        confidence: "high",
        source: "inkBounds",
      }),
    },
    witnesses,
    letters: buildLetters(metrics),
    overshoots,
    featureSupport: buildWordFeatureSupport({
      hasXGuide: model.guideLines.some((guide) => guide.key === "x"),
      hasLowercaseBand: model.bands.some((band) => band.key === "lowercaseBody"),
      hasApertureZone: model.focusZones.some((zone) => zone.key === "aperture"),
      hasCounterZone: model.focusZones.some((zone) => zone.key === "counter"),
      hasTerminalZone: model.focusZones.some((zone) => zone.key === "terminal"),
      hasThickStrokeZone: model.focusZones.some((zone) => zone.key === "thickStroke"),
      hasThinStrokeZone: model.focusZones.some((zone) => zone.key === "thinStroke"),
    }),
    ambiguityFlags: buildAmbiguityFlags({
      model,
      support,
      auditEvaluation: auditEvaluation ?? null,
    }),
    confidence,
    notes: [
      "Adapter mirrors the current word overlay output without changing composition, guide placement, or local focus heuristics.",
      "Witnesses are derived from the existing word witness plan and measured letter regions.",
    ],
  };
};
