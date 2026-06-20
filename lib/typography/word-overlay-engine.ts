import type { LayoutBox, StageGuides } from "@/lib/typography/anatomy-metrics";
import {
  browserTypographyRuntime,
  buildCanvasFontString,
} from "@/lib/typography/anatomy-metrics";
import type { TypographyProjectionRuntime } from "@/lib/typography/measurement-runtime";

export type WordGuideKey = "x" | "cap" | "ascender" | "baseline" | "descender";
export type WordChipKey = WordGuideKey | "width" | "aperture" | "terminal" | "stroke";
export type GuideTone = "default" | "subtle";

export type WordGuideLine = {
  key: WordGuideKey;
  label: string;
  valueText?: string;
  x1: number;
  x2: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
  labelX: number;
  labelY: number;
  tone?: GuideTone;
};

export type WordMetricChip = {
  key: WordChipKey;
  label: string;
  value: string;
};

export type WordVerticalMeasure = {
  key: "left" | "right" | "center" | "width";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tone?: "primary" | "secondary";
};

export type WordLetterRegion = {
  index: number;
  glyph: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

export type WordFocusZone = {
  key: "aperture" | "counter" | "terminal" | "thickStroke" | "thinStroke";
  tone: "primary" | "secondary";
  shape: "capsule" | "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  ry: number;
  label?: string;
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "middle" | "end";
  connectorX: number;
  connectorY: number;
  targetGlyphIndex: number;
};

export type WordPlacementRejectionReason = "outOfBounds" | "inkCollision" | "occupiedCollision";

export type WordPlacementCandidateDebug = {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
  accepted: boolean;
  reason?: WordPlacementRejectionReason | "fallback";
};

export type WordGuidePlacementDebug = {
  key: WordGuideKey;
  text: string;
  chosenX: number;
  chosenY: number;
  chosenAnchor: "start" | "middle" | "end";
  usedFallback: boolean;
  candidates: WordPlacementCandidateDebug[];
};

export type WordOverlayDebug = {
  guidePlacements: WordGuidePlacementDebug[];
};

export type WordBand = {
  key: "lowercaseBody";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "middle" | "end";
};

export type WordOverlayMetrics = StageGuides & {
  panelWidth: number;
  panelHeight: number;
  fontString: string;
  layout: LayoutBox;
  rawWordWidth: number;
  bounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    centerX: number;
    centerY: number;
    width: number;
    height: number;
  };
  frame: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  composition: {
    leftGap: number;
    rightGap: number;
    topGap: number;
    bottomGap: number;
    centeredXDelta: number;
    centeredYDelta: number;
  };
  letterRegions: WordLetterRegion[];
};

export type WordOverlayModel = {
  guideLines: WordGuideLine[];
  metricChips: WordMetricChip[];
  verticalMeasures: WordVerticalMeasure[];
  bands: WordBand[];
  focusZones: WordFocusZone[];
  debug: WordOverlayDebug;
};

export type WordGuideAnchors = {
  x: number;
  baseline: number;
  cap: number;
  ascender: number;
  descender: number;
  showCapGuide: boolean;
  showAscenderGuide: boolean;
  showDescenderGuide: boolean;
};

export type WordWitnessPlan = {
  x: string[];
  baseline: string[];
  ascender: string[];
  descender: string[];
  cap: string[];
};

const GUIDE_MARGIN = 28;
const LABEL_HEIGHT = 14;
const LABEL_PAD = 12;
const LINE_LABEL_GAP = 6;
const LOWER_LINE_LABEL_GAP = 14;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatPixelLabel = (value: number) => `${Math.round(value)}px`;

type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const getCompositionInset = (width: number, height: number) => {
  const side = clamp(width * 0.055, 24, 40);
  const top = clamp(height * 0.1, 24, 42);
  const bottom = clamp(height * 0.1, 24, 42);

  return {
    left: side,
    right: side,
    top,
    bottom,
    innerWidth: Math.max(width - side * 2, 1),
    innerHeight: Math.max(height - top - bottom, 1),
  };
};

const hasAscenderGlyph = (word: string) => /[bdfhklt]/i.test(word);
const hasDescenderGlyph = (word: string) => /[gjpqy]/i.test(word);
const hasUppercaseGlyph = (word: string) => /[A-Z]/.test(word);

const DEFAULT_WITNESS_PLAN: WordWitnessPlan = {
  x: ["x", "n", "m", "u", "a"],
  baseline: ["x", "n", "m", "u", "a", "i", "r", "t", "l", "h", "c", "e", "s", "o"],
  ascender: ["b", "d", "f", "h", "k", "l", "t"],
  descender: ["g", "j", "p", "q", "y"],
  cap: [],
};

const WORD_WITNESS_PLANS: Record<string, Partial<WordWitnessPlan>> = {
  access: {
    x: ["a"],
    baseline: ["a", "c", "e", "s"],
    ascender: [],
    descender: [],
  },
  minimum: {
    x: ["n", "m", "u"],
    baseline: ["m", "i", "n", "u"],
    ascender: [],
    descender: [],
  },
};

export const resolveWordWitnessPlan = (word: string): WordWitnessPlan => {
  const override = WORD_WITNESS_PLANS[word.toLowerCase()] ?? {};
  return {
    x: override.x ?? DEFAULT_WITNESS_PLAN.x,
    baseline: override.baseline ?? DEFAULT_WITNESS_PLAN.baseline,
    ascender: override.ascender ?? DEFAULT_WITNESS_PLAN.ascender,
    descender: override.descender ?? DEFAULT_WITNESS_PLAN.descender,
    cap: override.cap ?? DEFAULT_WITNESS_PLAN.cap,
  };
};

const findWitnessRegions = ({
  planGlyphs,
  regions,
}: {
  planGlyphs: string[];
  regions: WordLetterRegion[];
}) => {
  if (!planGlyphs.length) return [];
  const normalizedPlan = planGlyphs.map((glyph) => glyph.toLowerCase());
  const matches = regions.filter((region) => normalizedPlan.includes(region.glyph.toLowerCase()));
  if (matches.length) return matches;
  return [];
};

export const resolveWordGuideAnchors = ({
  word,
  metrics,
}: {
  word: string;
  metrics: WordOverlayMetrics;
}): WordGuideAnchors => {
  const wordLower = word.toLowerCase();
  const showAscenderGuide = hasAscenderGlyph(wordLower);
  const showDescenderGuide = hasDescenderGlyph(wordLower);
  const showCapGuide = hasUppercaseGlyph(word);
  const witnessPlan = resolveWordWitnessPlan(word);
  const xWitnesses = findWitnessRegions({ planGlyphs: witnessPlan.x, regions: metrics.letterRegions });
  const baselineWitnesses = findWitnessRegions({ planGlyphs: witnessPlan.baseline, regions: metrics.letterRegions });
  const ascenderWitnesses = findWitnessRegions({ planGlyphs: witnessPlan.ascender, regions: metrics.letterRegions });
  const descenderWitnesses = findWitnessRegions({ planGlyphs: witnessPlan.descender, regions: metrics.letterRegions });
  const capWitnesses = metrics.letterRegions.filter((region) => /[A-Z]/.test(region.glyph));

  const xAnchor =
    xWitnesses.length > 0 ? Math.min(...xWitnesses.map((region) => region.top)) : metrics.xHeight;
  const baselineAnchor =
    baselineWitnesses.length > 0 ? Math.max(...baselineWitnesses.map((region) => region.bottom)) : metrics.baseline;
  const ascenderAnchor =
    ascenderWitnesses.length > 0 ? Math.min(...ascenderWitnesses.map((region) => region.top)) : metrics.ascender;
  const descenderAnchor =
    descenderWitnesses.length > 0 ? Math.max(...descenderWitnesses.map((region) => region.bottom)) : metrics.descender;
  const capAnchor = capWitnesses.length > 0 ? Math.min(...capWitnesses.map((region) => region.top)) : metrics.capHeight;

  return {
    x: xAnchor,
    baseline: baselineAnchor,
    cap: capAnchor,
    ascender: ascenderAnchor,
    descender: descenderAnchor,
    showCapGuide: showCapGuide && capWitnesses.length > 0,
    showAscenderGuide: showAscenderGuide && ascenderWitnesses.length > 0,
    showDescenderGuide: showDescenderGuide && descenderWitnesses.length > 0,
  };
};

const resolveLabelPosition = ({
  panelWidth,
  preferredX,
  fallbackX,
  y,
}: {
  panelWidth: number;
  preferredX: number;
  fallbackX: number;
  y: number;
}) => {
  const safeRight = panelWidth - 18;
  if (preferredX <= safeRight) {
    return {
      x: preferredX,
      y,
      anchor: "start" as const,
    };
  }

  return {
    x: Math.max(fallbackX, 18),
    y,
    anchor: "end" as const,
  };
};

const estimateLabelWidth = (text: string) => Math.max(text.length * 6.4 + 8, 42);

const buildRect = ({
  x,
  y,
  width,
  height,
  textAnchor,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  textAnchor: "start" | "middle" | "end";
}): Rect => {
  if (textAnchor === "middle") {
    return { left: x - width / 2, right: x + width / 2, top: y, bottom: y + height };
  }
  if (textAnchor === "end") {
    return { left: x - width, right: x, top: y, bottom: y + height };
  }
  return { left: x, right: x + width, top: y, bottom: y + height };
};

const rectsIntersect = (a: Rect, b: Rect) =>
  !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

const expandRect = (rect: Rect, padding: number): Rect => ({
  left: rect.left - padding,
  right: rect.right + padding,
  top: rect.top - padding,
  bottom: rect.bottom + padding,
});

const buildExpandedLabelRect = ({
  x,
  y,
  text,
  textAnchor,
  padding = 4,
}: {
  x: number;
  y: number;
  text: string;
  textAnchor: "start" | "middle" | "end";
  padding?: number;
}) =>
  expandRect(
    buildRect({
      x,
      y,
      width: estimateLabelWidth(text),
      height: LABEL_HEIGHT,
      textAnchor,
    }),
    padding
  );

const placeWordGuideLabel = ({
  text,
  guideKey,
  guideY,
  metrics,
  occupiedRects,
}: {
  text: string;
  guideKey: WordGuideKey;
  guideY: number;
  metrics: WordOverlayMetrics;
  occupiedRects: Rect[];
}) => {
  const textWidth = estimateLabelWidth(text);
  const inkBounds = expandRect(
    {
      left: metrics.bounds.left,
      right: metrics.bounds.right,
      top: metrics.bounds.top,
      bottom: metrics.bounds.bottom,
    },
    8
  );
  const centerX = (metrics.bounds.left + metrics.bounds.right) / 2;
  const rightX = Math.min(metrics.panelWidth - GUIDE_MARGIN - textWidth, metrics.bounds.right + LABEL_PAD);
  const leftX = Math.max(GUIDE_MARGIN, metrics.bounds.left - LABEL_PAD - textWidth);
  const upperLeftX = Math.max(GUIDE_MARGIN, leftX - 14);
  const lowerRightX = Math.min(metrics.panelWidth - GUIDE_MARGIN - textWidth, rightX + 18);
  const topY = Math.max(8, metrics.bounds.top - LABEL_HEIGHT - LABEL_PAD);
  const bottomY = Math.min(metrics.panelHeight - LABEL_HEIGHT - 8, metrics.bounds.bottom + LABEL_PAD);
  const lineAboveY = clamp(guideY - LABEL_HEIGHT - LINE_LABEL_GAP, 8, metrics.panelHeight - LABEL_HEIGHT - 8);
  const lowerLineAboveY = clamp(guideY - LABEL_HEIGHT - LOWER_LINE_LABEL_GAP, 8, metrics.panelHeight - LABEL_HEIGHT - 8);
  const lineBelowY = clamp(guideY + LOWER_LINE_LABEL_GAP, 8, metrics.panelHeight - LABEL_HEIGHT - 8);
  const middleY = clamp(guideY - LABEL_HEIGHT / 2, 8, metrics.panelHeight - LABEL_HEIGHT - 8);

  const candidates =
    guideKey === "baseline" || guideKey === "descender"
      ? [
          { x: lowerRightX, y: lowerLineAboveY, textAnchor: "start" as const },
          { x: leftX + textWidth, y: lowerLineAboveY, textAnchor: "end" as const },
          { x: lowerRightX, y: lineBelowY, textAnchor: "start" as const },
          { x: centerX, y: bottomY, textAnchor: "middle" as const },
        ]
      : guideKey === "x"
        ? [
            // Keep the x-height label tied to the guide itself before we fall back
            // to the generic upper-left escape hatch.
            { x: rightX, y: lineAboveY, textAnchor: "start" as const },
            { x: centerX, y: topY, textAnchor: "middle" as const },
            { x: centerX, y: lineAboveY, textAnchor: "middle" as const },
            { x: upperLeftX + textWidth, y: lineAboveY, textAnchor: "end" as const },
            { x: upperLeftX + textWidth, y: middleY, textAnchor: "end" as const },
          ]
        : guideKey === "ascender"
          ? [
              { x: upperLeftX + textWidth, y: lineAboveY, textAnchor: "end" as const },
              { x: rightX, y: lineAboveY, textAnchor: "start" as const },
              { x: centerX, y: lineAboveY, textAnchor: "middle" as const },
              { x: upperLeftX + textWidth, y: middleY, textAnchor: "end" as const },
              { x: centerX, y: topY, textAnchor: "middle" as const },
            ]
          : [
              { x: rightX, y: lineAboveY, textAnchor: "start" as const },
              { x: leftX + textWidth, y: lineAboveY, textAnchor: "end" as const },
              { x: centerX, y: lineAboveY, textAnchor: "middle" as const },
              { x: centerX, y: topY, textAnchor: "middle" as const },
            ];

  const candidateDebug: WordPlacementCandidateDebug[] = [];

  for (const candidate of candidates) {
    const rect = buildRect({
      x: candidate.x,
      y: candidate.y,
      width: textWidth,
      height: LABEL_HEIGHT,
      textAnchor: candidate.textAnchor,
    });
    const outOfBounds = rect.left < 4 || rect.right > metrics.panelWidth - 4 || rect.top < 4 || rect.bottom > metrics.panelHeight - 4;
    if (outOfBounds) {
      candidateDebug.push({ x: candidate.x, y: candidate.y, textAnchor: candidate.textAnchor, accepted: false, reason: "outOfBounds" });
      continue;
    }
    if (rectsIntersect(rect, inkBounds)) {
      candidateDebug.push({ x: candidate.x, y: candidate.y, textAnchor: candidate.textAnchor, accepted: false, reason: "inkCollision" });
      continue;
    }
    if (occupiedRects.some((occupiedRect) => rectsIntersect(rect, occupiedRect))) {
      candidateDebug.push({ x: candidate.x, y: candidate.y, textAnchor: candidate.textAnchor, accepted: false, reason: "occupiedCollision" });
      continue;
    }

    candidateDebug.push({ x: candidate.x, y: candidate.y, textAnchor: candidate.textAnchor, accepted: true });
    return { x: candidate.x, y: candidate.y, textAnchor: candidate.textAnchor, rect, usedFallback: false, candidateDebug };
  }

  const fallback = {
    x: guideKey === "baseline" || guideKey === "descender" ? lowerRightX : upperLeftX + textWidth,
    y: guideKey === "baseline" || guideKey === "descender" ? lowerLineAboveY : lineAboveY,
    textAnchor: (guideKey === "baseline" || guideKey === "descender" ? "start" : "end") as "start" | "end",
  };

  return {
    ...fallback,
    rect: buildRect({
      x: fallback.x,
      y: fallback.y,
      width: textWidth,
      height: LABEL_HEIGHT,
      textAnchor: fallback.textAnchor,
    }),
    usedFallback: true,
    candidateDebug: [
      ...candidateDebug,
      { x: fallback.x, y: fallback.y, textAnchor: fallback.textAnchor, accepted: true, reason: "fallback" as const },
    ],
  };
};

const placeFocusZoneLabel = ({
  text,
  preferredX,
  preferredY,
  preferredAnchor,
  alternateX,
  alternateY,
  alternateAnchor,
  metrics,
  occupiedRects,
}: {
  text: string;
  preferredX: number;
  preferredY: number;
  preferredAnchor: "start" | "middle" | "end";
  alternateX: number;
  alternateY: number;
  alternateAnchor: "start" | "middle" | "end";
  metrics: WordOverlayMetrics;
  occupiedRects: Rect[];
}) => {
  const candidates = [
    { x: preferredX, y: preferredY, textAnchor: preferredAnchor },
    { x: alternateX, y: alternateY, textAnchor: alternateAnchor },
  ];

  for (const candidate of candidates) {
    const rect = buildExpandedLabelRect({
      x: candidate.x,
      y: candidate.y,
      text,
      textAnchor: candidate.textAnchor,
    });
    const outOfBounds =
      rect.left < 4 || rect.right > metrics.panelWidth - 4 || rect.top < 4 || rect.bottom > metrics.panelHeight - 4;
    if (outOfBounds) continue;
    if (occupiedRects.some((occupiedRect) => rectsIntersect(rect, occupiedRect))) continue;
    return candidate;
  }

  return candidates[0];
};

const buildLetterRegions = ({
  fontString,
  word,
  drawX,
  xHeight,
  baseline,
  runtime,
}: {
  fontString: string;
  word: string;
  drawX: number;
  xHeight: number;
  baseline: number;
  runtime?: Pick<TypographyProjectionRuntime, "measureAdvanceWidthForFontString" | "measureVisualBoxForFontString">;
}): WordLetterRegion[] => {
  const bodyHeight = Math.max(baseline - xHeight, 1);
  const measurementRuntime = runtime ?? browserTypographyRuntime;

  return Array.from(word).map((glyph, index) => {
    const prefix = word.slice(0, index);
    const advanceBefore = prefix ? measurementRuntime.measureAdvanceWidthForFontString(fontString, prefix) : 0;
    const glyphBox = measurementRuntime.measureVisualBoxForFontString(fontString, glyph);
    const left = drawX + advanceBefore + glyphBox.left;
    const right = drawX + advanceBefore + glyphBox.right;
    const top = baseline - glyphBox.ascent;
    const bottom = baseline + glyphBox.descent;

    return {
      index,
      glyph,
      left,
      right,
      top: Math.max(top, xHeight - bodyHeight * 0.18),
      bottom,
      width: right - left,
      height: bottom - top,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2,
    };
  });
};

const buildApertureFocusZones = ({
  word,
  metrics,
}: {
  word: string;
  metrics: WordOverlayMetrics;
}): WordFocusZone[] => {
  const targetIndex = word.toLowerCase().indexOf("e");
  if (targetIndex < 0) return [];

  const region = metrics.letterRegions[targetIndex];
  if (!region || region.width <= 0) return [];

  const bodyHeight = Math.max(metrics.baseline - metrics.xHeight, 1);
  const apertureZone = {
    x: region.left + region.width * 0.57,
    y: metrics.xHeight + bodyHeight * 0.18,
    width: Math.max(region.width * 0.28, metrics.layout.fontSize * 0.12),
    height: Math.max(bodyHeight * 0.3, metrics.layout.fontSize * 0.12),
  };
  const apertureLabel = resolveLabelPosition({
    panelWidth: metrics.panelWidth,
    preferredX: region.right + metrics.layout.fontSize * 0.05,
    fallbackX: apertureZone.x + apertureZone.width,
    y: Math.max(region.top - metrics.layout.fontSize * 0.18, 18),
  });

  const counterZone = {
    x: region.left + region.width * 0.22,
    y: metrics.xHeight + bodyHeight * 0.24,
    width: Math.max(region.width * 0.24, metrics.layout.fontSize * 0.1),
    height: Math.max(bodyHeight * 0.24, metrics.layout.fontSize * 0.1),
  };
  const counterLabel = {
    x: region.centerX - region.width * 0.18,
    y: Math.max(region.top - metrics.layout.fontSize * 0.24, 18),
  };

  return [
    {
      key: "aperture",
      tone: "primary",
      shape: "capsule",
      x: apertureZone.x,
      y: apertureZone.y,
      width: apertureZone.width,
      height: apertureZone.height,
      rx: metrics.layout.fontSize * 0.09,
      ry: metrics.layout.fontSize * 0.09,
      label: "APERTURE",
      labelX: apertureLabel.x,
      labelY: apertureLabel.y,
      labelAnchor: apertureLabel.anchor,
      connectorX: apertureZone.x + apertureZone.width * 0.62,
      connectorY: apertureZone.y + apertureZone.height * 0.5,
      targetGlyphIndex: targetIndex,
    },
    {
      key: "counter",
      tone: "secondary",
      shape: "ellipse",
      x: counterZone.x,
      y: counterZone.y,
      width: counterZone.width,
      height: counterZone.height,
      rx: metrics.layout.fontSize * 0.08,
      ry: metrics.layout.fontSize * 0.08,
      label: "COUNTER",
      labelX: counterLabel.x,
      labelY: counterLabel.y,
      labelAnchor: "middle",
      connectorX: counterZone.x + counterZone.width * 0.42,
      connectorY: counterZone.y + counterZone.height * 0.45,
      targetGlyphIndex: targetIndex,
    },
  ];
};

const buildTerminalFocusZones = ({
  word,
  metrics,
}: {
  word: string;
  metrics: WordOverlayMetrics;
}): WordFocusZone[] => {
  const letters = [...word.toLowerCase()];
  const targetIndex = letters.findIndex((glyph) => glyph === "a" || glyph === "r" || glyph === "t");
  if (targetIndex < 0) return [];

  const region = metrics.letterRegions[targetIndex];
  if (!region || region.width <= 0) return [];

  const bodyHeight = Math.max(metrics.baseline - metrics.xHeight, 1);
  const zoneWidth = Math.max(region.width * 0.18, metrics.layout.fontSize * 0.09);
  const zoneHeight = Math.max(bodyHeight * 0.24, metrics.layout.fontSize * 0.1);
  const zoneX = region.right - zoneWidth * 0.92;
  const zoneY = region.top + region.height * 0.5;
  const label = resolveLabelPosition({
    panelWidth: metrics.panelWidth,
    preferredX: region.right + metrics.layout.fontSize * 0.06,
    fallbackX: zoneX + zoneWidth,
    y: Math.max(region.top - metrics.layout.fontSize * 0.18, 18),
  });

  return [
    {
      key: "terminal",
      tone: "primary",
      shape: "capsule",
      x: zoneX,
      y: zoneY,
      width: zoneWidth,
      height: zoneHeight,
      rx: metrics.layout.fontSize * 0.08,
      ry: metrics.layout.fontSize * 0.08,
      label: "TERMINAL",
      labelX: label.x,
      labelY: label.y,
      labelAnchor: label.anchor,
      connectorX: zoneX + zoneWidth * 0.6,
      connectorY: zoneY + zoneHeight * 0.45,
      targetGlyphIndex: targetIndex,
    },
  ];
};

const buildContrastFocusZones = ({
  word,
  metrics,
}: {
  word: string;
  metrics: WordOverlayMetrics;
}): WordFocusZone[] => {
  const letters = [...word.toLowerCase()];
  const targetIndex = letters.findIndex((glyph) => glyph === "o" || glyph === "s" || glyph === "n");
  if (targetIndex < 0) return [];

  const region = metrics.letterRegions[targetIndex];
  if (!region || region.width <= 0) return [];

  const thickWidth = Math.max(region.width * 0.22, metrics.layout.fontSize * 0.1);
  const thickHeight = Math.max(region.height * 0.26, metrics.layout.fontSize * 0.12);
  const thickX = region.left + region.width * 0.18;
  const thickY = region.top + region.height * 0.5;

  const thinWidth = Math.max(region.width * 0.14, metrics.layout.fontSize * 0.07);
  const thinHeight = Math.max(region.height * 0.18, metrics.layout.fontSize * 0.09);
  const thinX = region.left + region.width * 0.58;
  const thinY = region.top + region.height * 0.16;

  return [
    {
      key: "thickStroke",
      tone: "primary",
      shape: "ellipse",
      x: thickX,
      y: thickY,
      width: thickWidth,
      height: thickHeight,
      rx: metrics.layout.fontSize * 0.08,
      ry: metrics.layout.fontSize * 0.08,
      label: "THICK STROKE",
      labelX: region.right + metrics.layout.fontSize * 0.06,
      labelY: Math.max(region.top - metrics.layout.fontSize * 0.16, 18),
      labelAnchor: "start",
      connectorX: thickX + thickWidth * 0.52,
      connectorY: thickY + thickHeight * 0.5,
      targetGlyphIndex: targetIndex,
    },
    {
      key: "thinStroke",
      tone: "secondary",
      shape: "ellipse",
      x: thinX,
      y: thinY,
      width: thinWidth,
      height: thinHeight,
      rx: metrics.layout.fontSize * 0.06,
      ry: metrics.layout.fontSize * 0.06,
      label: "THIN STROKE",
      labelX: region.centerX,
      labelY: Math.max(region.top - metrics.layout.fontSize * 0.28, 18),
      labelAnchor: "middle",
      connectorX: thinX + thinWidth * 0.48,
      connectorY: thinY + thinHeight * 0.45,
      targetGlyphIndex: targetIndex,
    },
  ];
};

const buildXHeightBands = ({
  word,
  metrics,
  anchors,
}: {
  word: string;
  metrics: WordOverlayMetrics;
  anchors: WordGuideAnchors;
}): WordBand[] => {
  if (word.toLowerCase() !== "minimum") return [];

  const firstPrimary = metrics.letterRegions.find((region) => region.glyph.toLowerCase() === "m" || region.glyph.toLowerCase() === "n");
  const lastPrimary = [...metrics.letterRegions].reverse().find((region) => region.glyph.toLowerCase() === "m" || region.glyph.toLowerCase() === "n");
  if (!firstPrimary || !lastPrimary) return [];

  const bandLeft = Math.max(firstPrimary.left - metrics.layout.fontSize * 0.04, 18);
  const bandRight = Math.min(lastPrimary.right + metrics.layout.fontSize * 0.04, metrics.panelWidth - 18);
  const bandTop = anchors.x;
  const bandBottom = anchors.baseline;

  return [
    {
      key: "lowercaseBody",
      x: bandLeft,
      y: bandTop,
      width: Math.max(bandRight - bandLeft, 1),
      height: Math.max(bandBottom - bandTop, 1),
      label: "LOWERCASE BODY",
      labelX: bandLeft + (bandRight - bandLeft) * 0.52,
      labelY: Math.max(bandTop - metrics.layout.fontSize * 0.16, 18),
      labelAnchor: "middle",
    },
  ];
};

const makeGuide = ({
  key,
  label,
  valueText,
  x1,
  x2,
  y,
  labelX,
  labelY,
  textAnchor,
  tone,
}: WordGuideLine) => ({
  key,
  label,
  valueText,
  x1,
  x2,
  y,
  labelX,
  labelY,
  textAnchor,
  tone,
});

export async function measureWordOverlay({
  family,
  word,
  width,
  height,
  runtime = browserTypographyRuntime,
}: {
  family: string;
  word: string;
  width: number;
  height: number;
  runtime?: TypographyProjectionRuntime;
}): Promise<WordOverlayMetrics> {
  const compositionInset = getCompositionInset(width, height);
  const projected = await runtime.projectSampleToFrameAfterFontsReady({
    family,
    sample: word,
    width: compositionInset.innerWidth,
    height: compositionInset.innerHeight,
    frame: "comparisonWord",
  });

  const fontString = buildCanvasFontString({
    family,
    size: projected.layout.fontSize,
    weight: 500,
  });
  const sampleBox = runtime.measureVisualBoxForFontString(fontString, word);
  const frameLeft = 0;
  const frameRight = width;
  const frameTop = 0;
  const frameBottom = height;
  const frameCenterX = width / 2;
  const frameCenterY = height / 2;
  const projectedDrawX = compositionInset.left + projected.layout.drawX;
  const projectedWordWidth = sampleBox.width;

  const baseLeft = projectedDrawX + sampleBox.left;
  const baseRight = projectedDrawX + sampleBox.right;
  const baseBaseline = compositionInset.top + projected.guides.baseline;
  const baseCapHeight = compositionInset.top + projected.guides.capHeight;
  const baseXHeight = compositionInset.top + projected.guides.xHeight;
  const baseAscender = compositionInset.top + projected.guides.ascender;
  const baseDescender = compositionInset.top + projected.guides.descender;
  const baseTop = baseBaseline - sampleBox.ascent;
  const baseBottom = baseBaseline + sampleBox.descent;
  const baseCenterY = (baseTop + baseBottom) / 2;

  const desiredShiftY = frameCenterY - baseCenterY;
  const maxShiftUp = frameTop + compositionInset.top - baseTop;
  const maxShiftDown = frameBottom - compositionInset.bottom - baseBottom;
  const shiftY = clamp(desiredShiftY, maxShiftUp, maxShiftDown);

  const baseline = baseBaseline + shiftY;
  const capHeight = baseCapHeight + shiftY;
  const xHeight = baseXHeight + shiftY;
  const ascender = baseAscender + shiftY;
  const descender = baseDescender + shiftY;
  const left = baseLeft;
  const right = baseRight;
  const top = baseTop + shiftY;
  const bottom = baseBottom + shiftY;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  return {
    top: frameTop,
    panelWidth: width,
    panelHeight: height,
    fontString,
    layout: {
      fontSize: projected.layout.fontSize,
      drawX: projectedDrawX,
      left,
      right,
      ascent: sampleBox.ascent,
      descent: sampleBox.descent,
    },
    rawWordWidth: projectedWordWidth,
    baseline,
    capHeight,
    xHeight,
    ascender,
    descender,
    bounds: {
      left,
      right,
      top,
      bottom,
      centerX,
      centerY,
      width: right - left,
      height: bottom - top,
    },
    frame: {
      left: frameLeft,
      right: frameRight,
      top: frameTop,
      bottom: frameBottom,
    },
    composition: {
      leftGap: left - frameLeft,
      rightGap: frameRight - right,
      topGap: top - frameTop,
      bottomGap: frameBottom - bottom,
      centeredXDelta: centerX - frameCenterX,
      centeredYDelta: centerY - frameCenterY,
    },
    letterRegions: buildLetterRegions({
      fontString,
      word,
      drawX: projectedDrawX,
      xHeight,
      baseline,
      runtime,
    }),
  };
}

export function buildWordOverlayModel({
  word,
  metrics,
  feature,
}: {
  word: string;
  metrics: WordOverlayMetrics;
  feature?: string;
}): WordOverlayModel {
  const anchors = resolveWordGuideAnchors({ word, metrics });
  const { showAscenderGuide, showDescenderGuide, showCapGuide } = anchors;
  const guideStartX = Math.max(metrics.bounds.left - metrics.layout.fontSize * 0.04, GUIDE_MARGIN);
  const guideEndX = Math.min(metrics.bounds.right + metrics.layout.fontSize * 0.04, Math.max(metrics.panelWidth - GUIDE_MARGIN, GUIDE_MARGIN));
  const baseFocusZones =
    feature === "aperture"
      ? buildApertureFocusZones({ word, metrics })
      : feature === "terminals"
        ? buildTerminalFocusZones({ word, metrics })
        : feature === "contrast"
          ? buildContrastFocusZones({ word, metrics })
          : [];
  const bands = feature === "xHeight" ? buildXHeightBands({ word, metrics, anchors }) : [];
  const occupiedRects: Rect[] = [];
  const guidePlacements: WordGuidePlacementDebug[] = [];

  bands.forEach((band) => {
    occupiedRects.push(
      buildExpandedLabelRect({
        x: band.labelX,
        y: band.labelY,
        text: band.label,
        textAnchor: band.labelAnchor,
      })
    );
  });

  const guideSpecs: Array<{
    key: WordGuideKey;
    label: string;
    valueText?: string;
    y: number;
    tone?: "default" | "subtle";
  }> = [];

  if (showAscenderGuide) {
    guideSpecs.push({
      key: "ascender",
      label: "ASCENDER",
      valueText: formatPixelLabel(Math.abs(anchors.baseline - anchors.ascender)),
      y: anchors.ascender,
      tone: "subtle",
    });
  }

  if (showCapGuide) {
    guideSpecs.push({
      key: "cap",
      label: "CAP HEIGHT",
      valueText: formatPixelLabel(Math.abs(anchors.baseline - anchors.cap)),
      y: anchors.cap,
      tone: "subtle",
    });
  }

  guideSpecs.push(
    {
      key: "x",
      label: "X-HEIGHT",
      valueText: formatPixelLabel(Math.abs(anchors.baseline - anchors.x)),
      y: anchors.x,
    },
    {
      key: "baseline",
      label: "BASELINE",
      y: anchors.baseline,
    }
  );

  if (showDescenderGuide) {
    guideSpecs.push({
      key: "descender",
      label: "DESCENDER",
      valueText: formatPixelLabel(Math.abs(anchors.descender - anchors.baseline)),
      y: anchors.descender,
      tone: "subtle",
    });
  }

  const guideLines: WordGuideLine[] = guideSpecs.map((spec) => {
    const text = spec.valueText ? `${spec.label} ${spec.valueText}` : spec.label;
    const placement = placeWordGuideLabel({
      text,
      guideKey: spec.key,
      guideY: spec.y,
      metrics,
      occupiedRects,
    });

    occupiedRects.push(expandRect(placement.rect, 4));
    guidePlacements.push({
      key: spec.key,
      text,
      chosenX: placement.x,
      chosenY: placement.y,
      chosenAnchor: placement.textAnchor,
      usedFallback: placement.usedFallback,
      candidates: placement.candidateDebug,
    });

    return makeGuide({
      key: spec.key,
      label: spec.label,
      valueText: spec.valueText,
      x1: guideStartX,
      x2: guideEndX,
      y: spec.y,
      labelX: placement.x,
      labelY: placement.y,
      textAnchor: placement.textAnchor,
      tone: spec.tone,
    });
  });

  const focusZones = baseFocusZones.map((zone) => {
    if (!zone.label) return zone;

    const alternateLabel = placeFocusZoneLabel({
      text: zone.label,
      preferredX: zone.labelX,
      preferredY: zone.labelY,
      preferredAnchor: zone.labelAnchor,
      alternateX: zone.tone === "primary" ? zone.x + zone.width / 2 : zone.labelX,
      alternateY: Math.min(zone.y + zone.height + metrics.layout.fontSize * 0.22, metrics.panelHeight - 18),
      alternateAnchor: zone.tone === "primary" ? "middle" : zone.labelAnchor,
      metrics,
      occupiedRects,
    });

    occupiedRects.push(
      buildExpandedLabelRect({
        x: alternateLabel.x,
        y: alternateLabel.y,
        text: zone.label,
        textAnchor: alternateLabel.textAnchor,
      })
    );

    return {
      ...zone,
      labelX: alternateLabel.x,
      labelY: alternateLabel.y,
      labelAnchor: alternateLabel.textAnchor,
    };
  });

  const metricChips: WordMetricChip[] = [
    {
      key: "x",
      label: "x-height",
      value: formatPixelLabel(Math.abs(anchors.baseline - anchors.x)),
    },
    ...(showCapGuide
      ? [
          {
            key: "cap" as const,
            label: "cap",
            value: formatPixelLabel(Math.abs(anchors.baseline - anchors.cap)),
          },
        ]
      : []),
    ...(showAscenderGuide
      ? [
          {
            key: "ascender" as const,
            label: "ascender",
            value: formatPixelLabel(Math.abs(anchors.baseline - anchors.ascender)),
          },
        ]
      : []),
    ...(showDescenderGuide
      ? [
          {
            key: "descender" as const,
            label: "descender",
            value: formatPixelLabel(Math.abs(anchors.descender - anchors.baseline)),
          },
        ]
      : []),
    {
      key: "width",
      label: "width",
      value: formatPixelLabel(metrics.rawWordWidth),
    },
    ...(feature === "aperture" && focusZones.length
      ? [
          {
            key: "aperture" as const,
            label: "aperture",
            value: formatPixelLabel(
              focusZones.find((zone) => zone.key === "aperture")?.width ?? metrics.layout.fontSize * 0.12
            ),
          },
        ]
      : []),
    ...(feature === "terminals" && focusZones.length
      ? [
          {
            key: "terminal" as const,
            label: "terminal",
            value: formatPixelLabel(
              focusZones.find((zone) => zone.key === "terminal")?.width ?? metrics.layout.fontSize * 0.1
            ),
          },
        ]
      : []),
    ...(feature === "contrast" && focusZones.length
      ? [
          {
            key: "stroke" as const,
            label: "stroke delta",
            value: formatPixelLabel(
              Math.max(
                (focusZones.find((zone) => zone.key === "thickStroke")?.width ?? 0) -
                  (focusZones.find((zone) => zone.key === "thinStroke")?.width ?? 0),
                metrics.layout.fontSize * 0.04
              )
            ),
          },
        ]
      : []),
  ];

  const widthMeasureY = Math.min(anchors.baseline + 32, Math.max(metrics.panelHeight - 16, 20));
  const wordLeftPostTop = Math.max((showAscenderGuide ? anchors.ascender : anchors.x) - 10, 18);
  const wordRightPostTop = Math.max((showCapGuide ? anchors.cap : anchors.x) - 10, 18);
  const wordCenter = metrics.bounds.centerX;
  const verticalMeasures: WordVerticalMeasure[] = [
    { key: "left", x1: metrics.bounds.left, y1: wordLeftPostTop, x2: metrics.bounds.left, y2: widthMeasureY, tone: "secondary" },
    { key: "right", x1: metrics.bounds.right, y1: wordRightPostTop, x2: metrics.bounds.right, y2: widthMeasureY, tone: "secondary" },
    {
      key: "width",
      x1: metrics.bounds.left,
      y1: widthMeasureY,
      x2: metrics.bounds.right,
      y2: widthMeasureY,
      tone: "primary",
    },
    ...(feature === "aperture" || feature === "terminals" || feature === "contrast"
      ? []
      : [
          {
            key: "center" as const,
            x1: wordCenter,
            y1: Math.max(anchors.x - metrics.layout.fontSize * 0.24, 18),
            x2: wordCenter,
            y2: Math.min(anchors.baseline + metrics.layout.fontSize * 0.08, Math.max(metrics.panelHeight - 18, 18)),
            tone: "secondary" as const,
          },
        ]),
  ];

  return {
    guideLines,
    metricChips,
    verticalMeasures,
    bands,
    focusZones,
    debug: {
      guidePlacements,
    },
  };
}
