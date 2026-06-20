import type {
  ConfidenceLevel,
  MeasurementBounds,
  MeasurementScript,
  MetricKey,
  MetricStatus,
  MetricValue,
} from "@/lib/typography/measurement-profile-contracts";

export const CONFIDENCE_SCORE: Record<ConfidenceLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export const inferScriptForText = (text: string): MeasurementScript => {
  const glyphs = [...text];
  if (!glyphs.length) return "unknown";

  const scripts = new Set<MeasurementScript>();

  for (const glyph of glyphs) {
    const codePoint = glyph.codePointAt(0);
    if (!codePoint) continue;
    if (codePoint <= 0x024f) scripts.add("latin");
    else if (codePoint >= 0x0370 && codePoint <= 0x03ff) scripts.add("greek");
    else if (codePoint >= 0x0400 && codePoint <= 0x04ff) scripts.add("cyrillic");
    else if (codePoint >= 0x0590 && codePoint <= 0x05ff) scripts.add("hebrew");
    else if (codePoint >= 0x0600 && codePoint <= 0x06ff) scripts.add("arabic");
    else if (codePoint >= 0x0900 && codePoint <= 0x097f) scripts.add("devanagari");
    else if (codePoint >= 0x0e00 && codePoint <= 0x0e7f) scripts.add("thai");
    else scripts.add("unknown");
  }

  return scripts.size === 1 ? [...scripts][0] : "unknown";
};

export const formatUnicodeCodepoint = (glyph: string) => {
  const codePoint = glyph.codePointAt(0);
  return codePoint ? `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}` : undefined;
};

export const buildMeasurementBounds = (left: number, right: number, top: number, bottom: number): MeasurementBounds => ({
  left,
  right,
  top,
  bottom,
  width: Math.max(right - left, 0),
  height: Math.max(bottom - top, 0),
});

export const buildMetricValuePx = ({
  key,
  value,
  source,
  status,
  confidence,
  note,
}: {
  key: MetricKey;
  value: number;
  source: MetricValue["source"];
  status: MetricStatus;
  confidence: ConfidenceLevel;
  note?: string;
}): MetricValue => ({
  key,
  value,
  unit: "px",
  status,
  confidence,
  source,
  note,
});

export const resolveAuditConfidence = ({
  pass,
  partialPass,
}: {
  pass?: boolean;
  partialPass?: boolean;
}): ConfidenceLevel => {
  if (pass) return "high";
  if (partialPass) return "medium";
  return "low";
};

export const dedupeBy = <T,>(items: T[], getKey: (item: T) => string) => {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = getKey(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
};
