import type { GlyphAuditEvaluation } from "@/lib/dev/typography/glyph-audit-spec";
import { evaluateGlyphAudit, getGlyphAuditExpectation } from "@/lib/dev/typography/glyph-audit-spec";
import {
  buildMeasurementBounds,
  buildMetricValuePx,
  formatUnicodeCodepoint,
  inferScriptForText,
} from "@/lib/typography/measurement-core";
import {
  buildGuideSupport,
  buildUnsupportedGuideFlags,
  resolveGuideConfidence,
  resolveGuideMetricStatus,
  resolveProfileConfidenceFromAudit,
} from "@/lib/typography/measurement-profile-core";
import type { GlyphMetrics, GlyphOverlayModel } from "@/lib/typography/glyph-overlay-engine";
import { getProjectedGuideContact } from "@/lib/typography/glyph-overlay-engine";
import type {
  ConfidenceLevel,
  GlyphMeasurementProfile,
  MeasurementScript,
  MetricKey,
  OvershootMeasurement,
  OvershootDirection,
  WitnessRole,
} from "@/lib/typography/measurement-profile-contracts";

const SUPPORT_MAP = {
  baseline: "baseline",
  x: "xHeight",
  cap: "capHeight",
  ascender: "ascender",
  descender: "descender",
} as const satisfies Record<string, MetricKey>;

const WITNESS_ROLE_MAP = {
  baseline: "baseline",
  x: "xHeight",
  cap: "capHeight",
  ascender: "ascender",
  descender: "descender",
} as const satisfies Record<string, WitnessRole>;

type SupportedGuideKey = keyof typeof SUPPORT_MAP;

export type BuildGlyphMeasurementProfileParams = {
  fontId: string;
  renderContextId: string;
  glyph: string;
  metrics: GlyphMetrics;
  overlayModel: GlyphOverlayModel;
  script?: MeasurementScript;
  auditEvaluation?: GlyphAuditEvaluation | null;
};

const resolveProfileConfidence = (auditEvaluation: GlyphAuditEvaluation | null): ConfidenceLevel => {
  if (!auditEvaluation) return "medium";
  return resolveProfileConfidenceFromAudit({
    pass: auditEvaluation.pass,
    partialPass: auditEvaluation.structuralPass || auditEvaluation.geometryPass,
  });
};

const isSupportedGuideKey = (guideKey: string): guideKey is SupportedGuideKey => guideKey in SUPPORT_MAP;

const buildOvershootEntries = ({
  glyph,
  metrics,
  overlayModel,
  expectationAllowsOvershoot,
}: {
  glyph: string;
  metrics: GlyphMetrics;
  overlayModel: GlyphOverlayModel;
  expectationAllowsOvershoot: boolean;
}): OvershootMeasurement[] => {
  const overshoots: OvershootMeasurement[] = [];

  for (const guide of overlayModel.guideLines) {
    if (!isSupportedGuideKey(guide.key) || guide.key === "baseline") continue;

    const contact = getProjectedGuideContact(guide.key, guide.y, metrics);
    if (!contact) continue;

    const deltaPx = contact.y - guide.y;
    const relatedMetric = SUPPORT_MAP[guide.key];
    let direction: OvershootDirection | null = null;
    let amountPx = 0;

    if ((guide.key === "x" || guide.key === "cap" || guide.key === "ascender") && deltaPx < 0) {
      direction = "top";
      amountPx = Math.abs(deltaPx);
    } else if (guide.key === "descender" && deltaPx > 0) {
      direction = "bottom";
      amountPx = deltaPx;
    }

    if (!direction || amountPx < 0.5) continue;

    const expected = expectationAllowsOvershoot && (guide.key === "x" || guide.key === "cap" || guide.key === "descender");
    overshoots.push({
      glyph,
      direction,
      amountPx,
      expected,
      confidence: expected ? "high" : "medium",
      relatedMetric,
      note: `Derived from current ${guide.key} guide contact without modifying overlay geometry.`,
    });
  }

  return overshoots;
};

const buildAmbiguityFlags = ({
  support,
  auditEvaluation,
}: {
  support: ReturnType<typeof buildGuideSupport>;
  auditEvaluation: GlyphAuditEvaluation | null;
}) => {
  const flags = buildUnsupportedGuideFlags(support);

  if (!auditEvaluation) {
    flags.add("audit_not_run");
    return [...flags];
  }

  if (auditEvaluation.missingGuides.length) {
    for (const guideKey of auditEvaluation.missingGuides) {
      flags.add(`missing_guide_${guideKey}`);
    }
  }

  if (auditEvaluation.forbiddenGuidesPresent.length) {
    for (const guideKey of auditEvaluation.forbiddenGuidesPresent) {
      flags.add(`unexpected_guide_${guideKey}`);
    }
  }

  if (auditEvaluation.chipMismatch) flags.add("metric_chip_mismatch");
  if (auditEvaluation.axisMismatch) flags.add("vertical_measure_mismatch");

  for (const [guideKey, geometry] of Object.entries(auditEvaluation.geometry)) {
    if (!geometry || geometry.deltaPx === null) {
      flags.add(`missing_contact_${guideKey}`);
      continue;
    }

    if (Math.abs(geometry.deltaPx) > geometry.tolerancePx) {
      flags.add(`geometry_drift_${guideKey}`);
    }
  }

  return [...flags];
};

export const buildGlyphMeasurementProfile = ({
  fontId,
  renderContextId,
  glyph,
  metrics,
  overlayModel,
  script,
  auditEvaluation,
}: BuildGlyphMeasurementProfileParams): GlyphMeasurementProfile => {
  const resolvedScript = script ?? inferScriptForText(glyph);
  const expectation = getGlyphAuditExpectation(glyph);
  const resolvedAuditEvaluation = auditEvaluation ?? (expectation ? evaluateGlyphAudit(expectation, overlayModel, metrics) : null);
  const support = buildGuideSupport(overlayModel.guideLines.map((guide) => guide.key));
  const confidence = resolveProfileConfidence(resolvedAuditEvaluation);
  const inkBounds = buildMeasurementBounds(metrics.left, metrics.right, metrics.top, metrics.bottom);
  const notes = [
    "Adapter mirrors current glyph overlay output without changing guide placement or measurement heuristics.",
    "Current width values reflect projected ink bounds used by the letter overlay.",
  ];

  if (expectation) {
    notes.push(expectation.note);
  }

  const metricMap: GlyphMeasurementProfile["metrics"] = {
    baseline: buildMetricValuePx({
      key: "baseline",
      value: metrics.baseline,
      source: "fontMetric",
      status: resolveGuideMetricStatus(support.baseline),
      confidence: resolveGuideConfidence(support.baseline),
      note: "Projected baseline currently used by the glyph overlay.",
    }),
    xHeight: buildMetricValuePx({
      key: "xHeight",
      value: metrics.xHeight,
      source: "fontMetric",
      status: resolveGuideMetricStatus(support.x),
      confidence: resolveGuideConfidence(support.x),
    }),
    capHeight: buildMetricValuePx({
      key: "capHeight",
      value: metrics.capHeight,
      source: "fontMetric",
      status: resolveGuideMetricStatus(support.cap),
      confidence: resolveGuideConfidence(support.cap),
    }),
    ascender: buildMetricValuePx({
      key: "ascender",
      value: metrics.ascender,
      source: "fontMetric",
      status: resolveGuideMetricStatus(support.ascender),
      confidence: resolveGuideConfidence(support.ascender),
    }),
    descender: buildMetricValuePx({
      key: "descender",
      value: metrics.descender,
      source: "fontMetric",
      status: resolveGuideMetricStatus(support.descender),
      confidence: resolveGuideConfidence(support.descender),
    }),
    advanceWidth: buildMetricValuePx({
      key: "advanceWidth",
      value: inkBounds.width,
      source: "inkBounds",
      status: "measured",
      confidence: "high",
      note: "Mirrors the current letter overlay width chip, which is based on projected ink bounds.",
    }),
    leftInk: buildMetricValuePx({
      key: "leftInk",
      value: inkBounds.left,
      source: "inkBounds",
      status: "measured",
      confidence: "high",
    }),
    rightInk: buildMetricValuePx({
      key: "rightInk",
      value: inkBounds.right,
      source: "inkBounds",
      status: "measured",
      confidence: "high",
    }),
    topInk: buildMetricValuePx({
      key: "topInk",
      value: inkBounds.top,
      source: "inkBounds",
      status: "measured",
      confidence: "high",
    }),
    bottomInk: buildMetricValuePx({
      key: "bottomInk",
      value: inkBounds.bottom,
      source: "inkBounds",
      status: "measured",
      confidence: "high",
    }),
  };

  return {
    glyph,
    unicode: formatUnicodeCodepoint(glyph),
    script: resolvedScript,
    fontId,
    renderContextId,
    metrics: metricMap,
    inkBounds,
    advanceWidthPx: inkBounds.width,
    overshoots: buildOvershootEntries({
      glyph,
      metrics,
      overlayModel,
      expectationAllowsOvershoot: expectation ? expectation.overshoot !== "none" : false,
    }),
    witnessRoles: overlayModel.guideLines.flatMap((guide) => {
      const role = WITNESS_ROLE_MAP[guide.key as keyof typeof WITNESS_ROLE_MAP];
      return role ? [role] : [];
    }),
    ambiguityFlags: buildAmbiguityFlags({
      support,
      auditEvaluation: resolvedAuditEvaluation,
    }),
    confidence,
    notes,
  };
};
