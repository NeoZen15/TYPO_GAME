import { resolveAuditConfidence } from "@/lib/typography/measurement-core";
import type { ConfidenceLevel, WordMeasurementProfile } from "@/lib/typography/measurement-profile-contracts";

export type GuideSupport = {
  baseline: boolean;
  x: boolean;
  cap: boolean;
  ascender: boolean;
  descender: boolean;
};

export const buildGuideSupport = (guideKeys: string[]): GuideSupport => {
  const keys = new Set(guideKeys);
  return {
    baseline: keys.has("baseline"),
    x: keys.has("x"),
    cap: keys.has("cap"),
    ascender: keys.has("ascender"),
    descender: keys.has("descender"),
  };
};

export const resolveGuideMetricStatus = (isSupported: boolean) => (isSupported ? "measured" : "unsupported");

export const resolveGuideConfidence = (isSupported: boolean): ConfidenceLevel => (isSupported ? "high" : "low");

export const resolveProfileConfidenceFromAudit = ({
  pass,
  partialPass,
}: {
  pass?: boolean;
  partialPass?: boolean;
}) => resolveAuditConfidence({ pass, partialPass });

export const buildUnsupportedGuideFlags = (support: GuideSupport) => {
  const flags = new Set<string>();

  for (const [guideKey, isSupported] of Object.entries(support)) {
    if (!isSupported) {
      flags.add(`unsupported_${guideKey}`);
    }
  }

  return flags;
};

export const buildWordFeatureSupport = ({
  hasXGuide,
  hasLowercaseBand,
  hasApertureZone,
  hasCounterZone,
  hasTerminalZone,
  hasThickStrokeZone,
  hasThinStrokeZone,
}: {
  hasXGuide: boolean;
  hasLowercaseBand: boolean;
  hasApertureZone: boolean;
  hasCounterZone: boolean;
  hasTerminalZone: boolean;
  hasThickStrokeZone: boolean;
  hasThinStrokeZone: boolean;
}): WordMeasurementProfile["featureSupport"] => ({
  xHeight: hasLowercaseBand || hasXGuide ? "high" : "low",
  aperture: hasApertureZone && hasCounterZone ? "high" : "low",
  terminals: hasTerminalZone ? "high" : "low",
  contrast: hasThickStrokeZone && hasThinStrokeZone ? "high" : "low",
});
