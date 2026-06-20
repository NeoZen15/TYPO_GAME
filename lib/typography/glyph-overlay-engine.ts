import type { StageGuides } from "@/lib/typography/anatomy-metrics";
import { browserTypographyRuntime, buildCanvasFontString } from "@/lib/typography/anatomy-metrics";
import type { TypographyProjectionRuntime } from "@/lib/typography/measurement-runtime";

export type GuideTone = "default" | "subtle";

export type GuideLabelPlacement = {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
};

export type GuideLineSegment = {
  x1: number;
  x2: number;
};

export type GuideLine = {
  key: string;
  label: string;
  y: number;
  ratio?: number;
  valueText?: string;
  tone?: GuideTone;
  placement: GuideLabelPlacement;
  segments: GuideLineSegment[];
};

type GuideContact = {
  spans: InkSpan[];
  rowY: number | null;
  envelopeLeft?: number;
  envelopeRight?: number;
};

export type VerticalMeasure = {
  key: string;
  x: number;
  y1: number;
  y2: number;
  tone?: "primary" | "secondary";
};

export type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type InkSpan = {
  left: number;
  right: number;
  width: number;
};

export type InkMeasurement = {
  bounds: Rect;
  rowOffset: number;
  rows: InkSpan[][];
};

export type GlyphMetrics = StageGuides & {
  fontSize: number;
  drawX: number;
  offsetX: number;
  offsetY: number;
  scaleFactor: number;
  left: number;
  right: number;
  glyphAscent: number;
  glyphDescent: number;
  ascent: number;
  descent: number;
  xRatio: number;
  capRatio: number;
  ascenderRatio: number;
  descenderRatio: number;
  widthRatio: number;
  top: number;
  bottom: number;
  centerX: number;
  sourceGuides: StageGuides;
  sourceInk: InkMeasurement;
};

export type MetricChip = {
  key: string;
  label: string;
  value: string;
};

type GuideSpec = {
  key: string;
  label: string;
  y: number;
  ratio?: number;
  tone?: GuideTone;
};

type GlyphClassification = {
  isLowercase: boolean;
  isCapLike: boolean;
  hasAscenderCandidate: boolean;
  hasDescender: boolean;
};

export type GuideContactProjection = {
  y: number;
  width: number;
};

type GlyphGuideContext = {
  projectedInkBounds: Rect;
  xHeightContact: GuideContactProjection | null;
  capContact: GuideContactProjection | null;
  hasAscenderZone: boolean;
  hasMeaningfulXHeight: boolean;
  xHeightY: number;
};

export type GlyphOverlayModel = {
  guideLines: GuideLine[];
  metricChips: MetricChip[];
  verticalMeasures: VerticalMeasure[];
};

const CALIBRATION_SIZE = 1000;
const GUIDE_MARGIN = 18;
const LABEL_PAD = 12;
const LABEL_HEIGHT = 14;
const LINE_LABEL_GAP = 5;
const LOWER_LINE_LABEL_GAP = 14;
const LOWER_LABEL_SIDE_GAP = 28;
const UPPER_LABEL_SIDE_GAP = 16;
const ASCENDER_LOWERCASE_GLYPHS = new Set(["b", "d", "f", "h", "k", "l", "t"]);

export const formatRatioLabel = (value: number) => `${(value * 100).toFixed(1)}%`;
export const formatPixelLabel = (value: number) => `${Math.round(value)}px`;

const isLowercaseGlyph = (glyph: string) => glyph.length === 1 && glyph === glyph.toLowerCase() && glyph !== glyph.toUpperCase();
const isUppercaseGlyph = (glyph: string) => glyph.length === 1 && glyph === glyph.toUpperCase() && glyph !== glyph.toLowerCase();
const isNumericGlyph = (glyph: string) => /^[0-9]$/.test(glyph);

const projectSourceY = (rowY: number, rowOffset: number, offsetY: number, scaleFactor: number) =>
  offsetY + (rowY - rowOffset) * scaleFactor;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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
    return {
      left: x - width / 2,
      right: x + width / 2,
      top: y,
      bottom: y + height,
    };
  }

  if (textAnchor === "end") {
    return {
      left: x - width,
      right: x,
      top: y,
      bottom: y + height,
    };
  }

  return {
    left: x,
    right: x + width,
    top: y,
    bottom: y + height,
  };
};

const expandRect = (rect: Rect, padding: number): Rect => ({
  left: rect.left - padding,
  right: rect.right + padding,
  top: rect.top - padding,
  bottom: rect.bottom + padding,
});

const rectsIntersect = (a: Rect, b: Rect) =>
  !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

const estimateLabelWidth = (text: string) => Math.max(text.length * 6.4 + 8, 42);

const measureCalibrationInk = ({
  family,
  glyph,
  fontSize,
  weight,
  glyphLeft,
  glyphWidth,
  fittingTop,
  fittingBottom,
  runtime,
}: {
  family: string;
  glyph: string;
  fontSize: number;
  weight: number;
  glyphLeft: number;
  glyphWidth: number;
  fittingTop: number;
  fittingBottom: number;
  runtime: TypographyProjectionRuntime;
}): InkMeasurement => {
  const padding = Math.ceil(fontSize * 0.18);
  const canvasWidth = Math.max(Math.ceil(glyphWidth + padding * 2), 1);
  const canvasHeight = Math.max(Math.ceil(fittingTop + fittingBottom + padding * 2), 1);
  const ctx = runtime.createScratchContext(canvasWidth, canvasHeight, true);
  if (!ctx) {
    return {
      bounds: {
        left: 0,
        right: glyphWidth,
        top: Math.max(fittingTop - fontSize * 0.7, 0),
        bottom: fittingTop,
      },
      rowOffset: padding,
      rows: [],
    };
  }

  const canvas = ctx.canvas;

  const drawX = padding + glyphLeft;
  const baseline = padding + fittingTop;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.font = buildCanvasFontString({
    family,
    size: fontSize,
    weight,
  });
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.fillText(glyph, drawX, baseline);

  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight).data;
  const rowCount = canvasHeight;
  const rows: InkSpan[][] = new Array(rowCount).fill(null).map(() => []);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < canvas.height; y += 1) {
    let segmentStart = -1;

    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = imageData[(y * canvas.width + x) * 4 + 3];
      const isInk = alpha >= 16;

      if (isInk) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        if (segmentStart < 0) segmentStart = x;
      }

      const reachedSegmentEnd = segmentStart >= 0 && (!isInk || x === canvasWidth - 1);
      if (reachedSegmentEnd) {
        const segmentEnd = isInk && x === canvasWidth - 1 ? x : x - 1;
        rows[y].push({
          left: segmentStart - padding,
          right: segmentEnd - padding,
          width: Math.max(segmentEnd - segmentStart, 0),
        });
        segmentStart = -1;
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return {
      bounds: {
        left: 0,
        right: glyphWidth,
        top: Math.max(fittingTop - fontSize * 0.7, 0),
        bottom: fittingTop,
      },
      rowOffset: padding,
      rows: [],
    };
  }

  return {
    bounds: {
      left: minX - padding,
      right: maxX - padding,
      top: minY - padding,
      bottom: maxY - padding,
    },
    rowOffset: padding,
    rows,
  };
};

const getGuideContact = ({
  guideKey,
  guideY,
  ink,
  fontSize,
}: {
  guideKey: string;
  guideY: number;
  ink: InkMeasurement;
  fontSize: number;
}): GuideContact => {
  if (!ink.rows.length) return { spans: [], rowY: null };

  const searchRange = Math.max(Math.round(fontSize * 0.016), 14);

  if (guideKey !== "baseline" && guideKey !== "descender") {
    const origin = clamp(Math.round(guideY + ink.rowOffset), 0, ink.rows.length - 1);
    const upwardRange = Math.max(Math.round(fontSize * 0.006), 4);
    const downwardRange = Math.max(Math.round(fontSize * 0.04), 24);
    const candidates: Array<{ rowY: number; spans: InkSpan[]; totalWidth: number; distance: number }> = [];

    for (let row = Math.max(origin - upwardRange, 0); row <= Math.min(origin + downwardRange, ink.rows.length - 1); row += 1) {
      const spans = ink.rows[row];
      if (!spans.length) continue;
      const totalWidth = spans.reduce((sum, span) => sum + span.width, 0);
      candidates.push({ rowY: row, spans, totalWidth, distance: Math.abs(row - origin) });
    }

    if (candidates.length) {
      const maxWidth = Math.max(...candidates.map((candidate) => candidate.totalWidth));
      const stableThreshold = maxWidth * 0.75;
      const stableCandidates = candidates.filter((candidate) => candidate.totalWidth >= stableThreshold);
      const bestCandidate = stableCandidates.reduce((best, candidate) => {
        if (!best) return candidate;
        if (candidate.distance !== best.distance) return candidate.distance < best.distance ? candidate : best;
        return candidate.rowY < best.rowY ? candidate : best;
      }, null as (typeof candidates)[number] | null);

      if (bestCandidate) {
        const envelopeLeft = Math.min(...stableCandidates.map((candidate) => candidate.spans[0]?.left ?? Number.POSITIVE_INFINITY));
        const envelopeRight = Math.max(
          ...stableCandidates.map((candidate) => candidate.spans[candidate.spans.length - 1]?.right ?? Number.NEGATIVE_INFINITY)
        );
        return {
          spans: bestCandidate.spans,
          rowY: bestCandidate.rowY,
          envelopeLeft: Number.isFinite(envelopeLeft) ? envelopeLeft : undefined,
          envelopeRight: Number.isFinite(envelopeRight) ? envelopeRight : undefined,
        };
      }
    }
  }

  const origin = guideY + ink.rowOffset;
  const start = clamp(Math.floor(origin - searchRange * 0.5), 0, ink.rows.length - 1);
  const end = clamp(Math.ceil(origin + searchRange * 0.5), 0, ink.rows.length - 1);
  let best: GuideContact = { spans: [], rowY: null };
  let bestWidth = -1;

  for (let row = start; row <= end; row += 1) {
    const spans = ink.rows[row];
    if (!spans.length) continue;
    const totalWidth = spans.reduce((sum, span) => sum + span.width, 0);
    if (totalWidth > bestWidth) {
      best = { spans, rowY: row };
      bestWidth = totalWidth;
    }
  }

  return best;
};

const placeGuideLabel = ({
  text,
  guideY,
  guideKey,
  size,
  inkBounds,
  occupiedRects,
}: {
  text: string;
  guideY: number;
  guideKey: string;
  size: { width: number; height: number };
  inkBounds: Rect;
  occupiedRects: Rect[];
}): { placement: GuideLabelPlacement; rect: Rect } => {
  const textWidth = estimateLabelWidth(text);
  const safeGlyphBounds = expandRect(inkBounds, 8);
  const centerX = (inkBounds.left + inkBounds.right) / 2;
  const rightX = Math.min(size.width - GUIDE_MARGIN - textWidth, inkBounds.right + LABEL_PAD);
  const lowerRightX = Math.min(size.width - GUIDE_MARGIN - textWidth, inkBounds.right + LABEL_PAD + LOWER_LABEL_SIDE_GAP);
  const leftX = Math.max(GUIDE_MARGIN, inkBounds.left - LABEL_PAD - textWidth);
  const upperLeftX = Math.max(GUIDE_MARGIN, inkBounds.left - LABEL_PAD - textWidth - UPPER_LABEL_SIDE_GAP);
  const topY = Math.max(8, inkBounds.top - LABEL_HEIGHT - LABEL_PAD);
  const bottomY = Math.min(size.height - LABEL_HEIGHT - 8, inkBounds.bottom + LABEL_PAD);
  const lineAboveY = clamp(guideY - LABEL_HEIGHT - LINE_LABEL_GAP, 8, size.height - LABEL_HEIGHT - 8);
  const lowerLineAboveY = clamp(guideY - LABEL_HEIGHT - LOWER_LINE_LABEL_GAP, 8, size.height - LABEL_HEIGHT - 8);
  const lineBelowY = clamp(guideY + LOWER_LINE_LABEL_GAP, 8, size.height - LABEL_HEIGHT - 8);
  const middleY = clamp(guideY - LABEL_HEIGHT / 2, 8, size.height - LABEL_HEIGHT - 8);

  const candidates =
    guideKey === "baseline" || guideKey === "descender"
      ? [
          { x: lowerRightX, y: lowerLineAboveY, textAnchor: "start" as const },
          { x: leftX + textWidth, y: lowerLineAboveY, textAnchor: "end" as const },
          { x: lowerRightX, y: lineBelowY, textAnchor: "start" as const },
          { x: leftX + textWidth, y: lineBelowY, textAnchor: "end" as const },
          { x: centerX, y: bottomY, textAnchor: "middle" as const },
          { x: centerX, y: topY, textAnchor: "middle" as const },
        ]
      : guideKey === "ascender"
        ? [
            { x: upperLeftX + textWidth, y: lineAboveY, textAnchor: "end" as const },
            { x: upperLeftX + textWidth, y: middleY, textAnchor: "end" as const },
            { x: rightX, y: lineAboveY, textAnchor: "start" as const },
            { x: centerX, y: lineAboveY, textAnchor: "middle" as const },
            { x: centerX, y: topY, textAnchor: "middle" as const },
            { x: rightX, y: middleY, textAnchor: "start" as const },
            { x: centerX, y: bottomY, textAnchor: "middle" as const },
          ]
      : guideKey === "x"
        ? [
            { x: upperLeftX + textWidth, y: lineAboveY, textAnchor: "end" as const },
            { x: upperLeftX + textWidth, y: middleY, textAnchor: "end" as const },
            { x: rightX, y: lineAboveY, textAnchor: "start" as const },
            { x: centerX, y: lineAboveY, textAnchor: "middle" as const },
            { x: centerX, y: topY, textAnchor: "middle" as const },
            { x: rightX, y: middleY, textAnchor: "start" as const },
            { x: centerX, y: bottomY, textAnchor: "middle" as const },
          ]
      : [
          { x: rightX, y: lineAboveY, textAnchor: "start" as const },
          { x: leftX + textWidth, y: lineAboveY, textAnchor: "end" as const },
          { x: centerX, y: lineAboveY, textAnchor: "middle" as const },
          { x: centerX, y: topY, textAnchor: "middle" as const },
          { x: rightX, y: middleY, textAnchor: "start" as const },
          { x: leftX + textWidth, y: middleY, textAnchor: "end" as const },
          { x: centerX, y: bottomY, textAnchor: "middle" as const },
        ];

  for (const candidate of candidates) {
    const rect = buildRect({
      x: candidate.x,
      y: candidate.y,
      width: textWidth,
      height: LABEL_HEIGHT,
      textAnchor: candidate.textAnchor,
    });

    const isOutOfBounds = rect.left < 4 || rect.right > size.width - 4 || rect.top < 4 || rect.bottom > size.height - 4;
    if (isOutOfBounds) continue;
    if (rectsIntersect(rect, safeGlyphBounds)) continue;
    if (occupiedRects.some((occupiedRect) => rectsIntersect(rect, occupiedRect))) continue;

    return {
      placement: {
        x: candidate.x,
        y: candidate.y,
        textAnchor: candidate.textAnchor,
      },
      rect,
    };
  }

  const fallbackPlacement = {
    x: Math.min(size.width - GUIDE_MARGIN - textWidth, Math.max(GUIDE_MARGIN, inkBounds.right + LABEL_PAD)),
    y: bottomY,
    textAnchor: "start" as const,
  };

  return {
    placement: fallbackPlacement,
    rect: buildRect({
      x: fallbackPlacement.x,
      y: fallbackPlacement.y,
      width: textWidth,
      height: LABEL_HEIGHT,
      textAnchor: fallbackPlacement.textAnchor,
    }),
  };
};

const buildGuideSegments = (size: { width: number; height: number }): GuideLineSegment[] => {
  const start = GUIDE_MARGIN;
  const end = Math.max(size.width - GUIDE_MARGIN, GUIDE_MARGIN);
  return [{ x1: start, x2: end }];
};

const getGuideMeasureValue = (guideKey: string, guideY: number, metrics: GlyphMetrics) => {
  switch (guideKey) {
    case "x":
    case "cap":
    case "ascender":
      return Math.abs(metrics.baseline - guideY);
    case "descender":
      return Math.abs(guideY - metrics.baseline);
    default:
      return null;
  }
};

const projectRect = (rect: Rect, offsetX: number, offsetY: number, scaleFactor: number): Rect => ({
  left: offsetX + rect.left * scaleFactor,
  right: offsetX + rect.right * scaleFactor,
  top: offsetY + rect.top * scaleFactor,
  bottom: offsetY + rect.bottom * scaleFactor,
});

const projectSpans = (spans: InkSpan[], offsetX: number, scaleFactor: number): InkSpan[] =>
  spans.map((span) => ({
    left: offsetX + span.left * scaleFactor,
    right: offsetX + span.right * scaleFactor,
    width: span.width * scaleFactor,
  }));

const classifyGlyph = (glyph: string, metrics: GlyphMetrics): GlyphClassification => {
  const normalizedGlyph = glyph.trim();
  const normalizedLowercaseGlyph = normalizedGlyph.toLowerCase();

  return {
    isLowercase: isLowercaseGlyph(normalizedGlyph),
    isCapLike: isUppercaseGlyph(normalizedGlyph) || isNumericGlyph(normalizedGlyph),
    hasAscenderCandidate: ASCENDER_LOWERCASE_GLYPHS.has(normalizedLowercaseGlyph),
    hasDescender: metrics.glyphDescent >= Math.max(metrics.fontSize * 0.06, 8),
  };
};

export const getProjectedGuideContact = (
  guideKey: string,
  guideY: number,
  metrics: GlyphMetrics
): GuideContactProjection | null => {
  const contact = getGuideContact({
    guideKey,
    guideY: (guideY - metrics.offsetY) / metrics.scaleFactor,
    ink: metrics.sourceInk,
    fontSize: CALIBRATION_SIZE,
  });
  if (contact.rowY === null) return null;

  const projectedY = projectSourceY(contact.rowY, metrics.sourceInk.rowOffset, metrics.offsetY, metrics.scaleFactor);
  const projectedSpans = projectSpans(contact.spans, metrics.offsetX, metrics.scaleFactor);

  return {
    y: projectedY,
    width: projectedSpans.reduce((sum, span) => sum + span.width, 0),
  };
};

const buildGuideContext = (metrics: GlyphMetrics): GlyphGuideContext => {
  const projectedInkBounds = projectRect(metrics.sourceInk.bounds, metrics.offsetX, metrics.offsetY, metrics.scaleFactor);
  const guideWidthThreshold = Math.max(metrics.fontSize * 0.04, (metrics.right - metrics.left) * 0.06, 3);
  const xHeightContact = getProjectedGuideContact("x", metrics.xHeight, metrics);
  const capContact = getProjectedGuideContact("cap", metrics.capHeight, metrics);
  const hasAscenderZone = metrics.top < metrics.xHeight - Math.max(metrics.fontSize * 0.08, 10);
  const hasMeaningfulXHeight =
    Boolean(xHeightContact) &&
    (xHeightContact?.width ?? 0) >= guideWidthThreshold &&
    Math.abs((xHeightContact?.y ?? metrics.xHeight) - metrics.xHeight) <= Math.max(metrics.fontSize * 0.12, 14);

  return {
    projectedInkBounds,
    xHeightContact,
    capContact,
    hasAscenderZone,
    hasMeaningfulXHeight,
    xHeightY: hasAscenderZone ? (xHeightContact?.y ?? metrics.xHeight) : metrics.top,
  };
};

const buildGuideSpecs = (glyph: string, metrics: GlyphMetrics): GuideSpec[] => {
  const guides: GuideSpec[] = [];
  const classification = classifyGlyph(glyph, metrics);
  const context = buildGuideContext(metrics);

  if (classification.isLowercase) {
    guides.push({
      key: "x",
      label: "X-HEIGHT",
      y: context.xHeightY,
      ratio: metrics.xRatio,
    });
  }

  if (
    classification.isLowercase &&
    classification.hasAscenderCandidate &&
    context.hasAscenderZone &&
    context.hasMeaningfulXHeight &&
    context.xHeightY - metrics.top >= Math.max(metrics.fontSize * 0.08, 10)
  ) {
    guides.push({
      key: "ascender",
      label: "ASCENDER",
      y: metrics.top,
      ratio: metrics.ascenderRatio,
      tone: "subtle",
    });
  }

  if (classification.isCapLike && context.capContact) {
    guides.push({
      key: "cap",
      label: "CAP HEIGHT",
      y: metrics.top,
      ratio: metrics.capRatio,
      tone: "subtle",
    });
  }

  if (!guides.length) {
    guides.push({
      key: classification.isCapLike ? "cap" : "x",
      label: classification.isCapLike ? "CAP HEIGHT" : "X-HEIGHT",
      y: metrics.top,
      ratio: classification.isCapLike ? metrics.capRatio : metrics.xRatio,
    });
  }

  guides.push({
    key: "baseline",
    label: "BASELINE",
    y: classification.hasDescender ? metrics.baseline : metrics.bottom,
  });

  if (classification.hasDescender) {
    guides.push({
      key: "descender",
      label: "DESCENDER",
      y: metrics.bottom,
      ratio: metrics.descenderRatio,
      tone: "subtle",
    });
  }

  return guides;
};

const buildGuideLines = (
  guideSpecs: GuideSpec[],
  inkBounds: Rect,
  size: { width: number; height: number },
  metrics: GlyphMetrics
): GuideLine[] => {
  const occupiedRects: Rect[] = [];

  return guideSpecs
    .sort((a, b) => a.y - b.y)
    .map((guide) => {
      const guideValue = getGuideMeasureValue(guide.key, guide.y, metrics);
      const valueText = guideValue === null ? undefined : formatPixelLabel(guideValue);
      const text = valueText ? `${guide.label} ${valueText}` : guide.label;
      const { placement, rect } = placeGuideLabel({
        text,
        guideY: guide.y,
        guideKey: guide.key,
        size,
        inkBounds,
        occupiedRects,
      });
      occupiedRects.push(expandRect(rect, 6));

      return {
        ...guide,
        valueText,
        placement,
        segments: buildGuideSegments(size),
      } satisfies GuideLine;
    });
};

const buildMetricChips = (guideLines: GuideLine[], metrics: GlyphMetrics): MetricChip[] => {
  const order = ["x", "cap", "ascender", "descender"];
  const labels: Record<string, string> = {
    x: "x-height",
    cap: "cap",
    ascender: "ascender",
    descender: "descender",
  };

  const guideChips = order
    .map((key) => guideLines.find((guide) => guide.key === key))
    .filter((guide): guide is GuideLine => Boolean(guide && guide.ratio))
    .map((guide) => ({
      key: guide.key,
      label: labels[guide.key] ?? guide.label.toLowerCase(),
      value: guide.valueText ?? "",
    }));

  return [
    ...guideChips,
    {
      key: "width",
      label: "width",
      value: formatPixelLabel(Math.abs(metrics.right - metrics.left)),
    },
  ];
};

const buildVerticalMeasures = (guideLines: GuideLine[], metrics: GlyphMetrics): VerticalMeasure[] => {
  const baselineGuide = guideLines.find((guide) => guide.key === "baseline");
  if (!baselineGuide) return [];

  const xGuide = guideLines.find((guide) => guide.key === "x");
  const capGuide = guideLines.find((guide) => guide.key === "cap");
  const ascGuide = guideLines.find((guide) => guide.key === "ascender");
  const descGuide = guideLines.find((guide) => guide.key === "descender");
  const baseX = Math.max(metrics.left - metrics.fontSize * 0.18, 14);
  const measures: VerticalMeasure[] = [];

  if (ascGuide) {
    measures.push({
      key: "ascender",
      x: Math.max(baseX - metrics.fontSize * 0.12, 12),
      y1: ascGuide.y,
      y2: baselineGuide.y,
      tone: "secondary",
    });
  }

  if (xGuide) {
    measures.push({
      key: "x",
      x: baseX,
      y1: xGuide.y,
      y2: baselineGuide.y,
      tone: "primary",
    });
  }

  if (capGuide) {
    measures.push({
      key: "cap",
      x: baseX,
      y1: capGuide.y,
      y2: baselineGuide.y,
      tone: "primary",
    });
  }

  if (descGuide) {
    measures.push({
      key: "descender",
      x: Math.min(metrics.right + metrics.fontSize * 0.16, metrics.right + 28),
      y1: baselineGuide.y,
      y2: descGuide.y,
      tone: "secondary",
    });
  }

  return measures;
};

export const buildGlyphOverlayModel = (
  glyph: string,
  metrics: GlyphMetrics,
  size: { width: number; height: number }
): GlyphOverlayModel => {
  const context = buildGuideContext(metrics);
  const guideSpecs = buildGuideSpecs(glyph, metrics);
  const guideLines = buildGuideLines(guideSpecs, context.projectedInkBounds, size, metrics);

  return {
    guideLines,
    metricChips: buildMetricChips(guideLines, metrics),
    verticalMeasures: buildVerticalMeasures(guideLines, metrics),
  };
};

export const measureGlyph = async ({
  family,
  glyph,
  width,
  height,
  weight = 500,
  runtime = browserTypographyRuntime,
}: {
  family: string;
  glyph: string;
  width: number;
  height: number;
  weight?: number;
  runtime?: TypographyProjectionRuntime;
}): Promise<GlyphMetrics> => {
  await runtime.waitForFontsReady();

  const topPadding = height * 0.14;
  const bottomPadding = height * 0.12;
  const horizontalPadding = width * 0.08;
  const fontString = buildCanvasFontString({
    family,
    size: CALIBRATION_SIZE,
    weight,
  });
  const glyphBox = runtime.measureVisualBoxForFontString(fontString, glyph);
  const referenceMetrics = runtime.measureFontMetrics(family, weight);

  const rawLeft = glyphBox.left || 0;
  const rawRight = glyphBox.right || glyphBox.width || CALIBRATION_SIZE * 0.5;
  const rawWidth = Math.max(rawLeft + rawRight, glyphBox.width || CALIBRATION_SIZE * 0.5);
  const rawAscent = glyphBox.ascent || CALIBRATION_SIZE * 0.7;
  const rawDescent = glyphBox.descent || 0;
  const realXHeight = referenceMetrics.xAscent || CALIBRATION_SIZE * 0.5;
  const realCapHeight = referenceMetrics.capAscent || CALIBRATION_SIZE * 0.72;
  const realAscender = referenceMetrics.ascenderAscent || CALIBRATION_SIZE * 0.76;
  const realDescender = referenceMetrics.descenderDepth || CALIBRATION_SIZE * 0.2;
  const fittingTop = Math.max(rawAscent, realAscender);
  const fittingBottom = Math.max(rawDescent, realDescender);
  const availableWidth = Math.max(width - horizontalPadding * 2, 1);
  const availableHeight = Math.max(height - topPadding - bottomPadding, 1);
  const scaleByWidth = availableWidth / Math.max(rawWidth, 1);
  const scaleByHeight = availableHeight / Math.max(fittingTop + fittingBottom, 1);
  const scale = Math.min(scaleByWidth, scaleByHeight);
  const fontSize = CALIBRATION_SIZE * scale;
  const sourceGuides = {
    top: 0,
    baseline: fittingTop,
    descender: fittingTop + realDescender,
    capHeight: fittingTop - realCapHeight,
    xHeight: fittingTop - realXHeight,
    ascender: fittingTop - realAscender,
  } satisfies StageGuides;
  const sourceInk = measureCalibrationInk({
    family,
    glyph,
    fontSize: CALIBRATION_SIZE,
    weight,
    glyphLeft: rawLeft,
    glyphWidth: rawWidth,
    fittingTop,
    fittingBottom,
    runtime,
  });
  const rawInkWidth = sourceInk.bounds.right - sourceInk.bounds.left;
  const localInkWidth = Number.isFinite(rawInkWidth) && rawInkWidth > 0 ? rawInkWidth : Math.max(rawWidth, 1);
  const safeInkLeft = Number.isFinite(sourceInk.bounds.left) ? sourceInk.bounds.left : rawLeft;
  const safeInkRight = Number.isFinite(sourceInk.bounds.right) ? sourceInk.bounds.right : rawLeft + localInkWidth;
  const safeInkTop =
    Number.isFinite(sourceInk.bounds.top) ? sourceInk.bounds.top : Math.max(fittingTop - fontSize * 0.7, 0);
  const safeInkBottom = Number.isFinite(sourceInk.bounds.bottom) ? sourceInk.bounds.bottom : fittingTop;
  const offsetX = width / 2 - (safeInkLeft + localInkWidth / 2) * scale;
  const offsetY = topPadding;
  const baselineY = offsetY + sourceGuides.baseline * scale;
  const drawX = offsetX + rawLeft * scale;
  const left = offsetX + safeInkLeft * scale;
  const right = offsetX + safeInkRight * scale;
  const widthRatio = localInkWidth / CALIBRATION_SIZE;
  const top = offsetY + safeInkTop * scale;
  const bottom = offsetY + safeInkBottom * scale;
  const centerX = (left + right) / 2;

  return {
    top,
    baseline: baselineY,
    descender: offsetY + sourceGuides.descender * scale,
    capHeight: offsetY + sourceGuides.capHeight * scale,
    xHeight: offsetY + sourceGuides.xHeight * scale,
    ascender: offsetY + sourceGuides.ascender * scale,
    fontSize,
    drawX,
    offsetX,
    offsetY,
    scaleFactor: scale,
    left,
    right,
    glyphAscent: baselineY - top,
    glyphDescent: Math.max(bottom - baselineY, 0),
    ascent: rawAscent * scale,
    descent: rawDescent * scale,
    xRatio: realXHeight / CALIBRATION_SIZE,
    capRatio: realCapHeight / CALIBRATION_SIZE,
    ascenderRatio: realAscender / CALIBRATION_SIZE,
    descenderRatio: realDescender / CALIBRATION_SIZE,
    widthRatio,
    bottom,
    centerX,
    sourceGuides,
    sourceInk,
  };
};
