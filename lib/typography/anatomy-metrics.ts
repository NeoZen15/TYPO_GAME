type FontMeasurement = {
  capAscent: number;
  xAscent: number;
  ascenderAscent: number;
  descenderDepth: number;
};

type RawFontMetrics = {
  baseline: number;
  capHeight: number;
  xHeight: number;
  ascender: number;
  descender: number;
};

type BoxMeasurement = {
  left: number;
  right: number;
  width: number;
  ascent: number;
  descent: number;
};

type StageGuides = {
  top: number;
  baseline: number;
  descender: number;
  xHeight: number;
  capHeight: number;
  ascender: number;
};

type LayoutBox = {
  fontSize: number;
  drawX: number;
  left: number;
  right: number;
  ascent: number;
  descent: number;
};

type NormalizedFontMetrics = {
  capRatio: number;
  xRatio: number;
  ascenderRatio: number;
  descenderRatio: number;
};

export type FallbackFontPreset = {
  capRatio: number;
  xRatio: number;
  ascenderRatio: number;
  descenderRatio: number;
  defaultWidthFactor: number;
  uppercaseWidthFactor: number;
  roundWidthFactor: number;
  narrowWidthFactor: number;
  wideWidthFactor: number;
};

type ProjectionDebug = {
  calibrationSize: number;
  frame: StageFrame & {
    key: keyof typeof STAGE_FRAMES;
  };
  fontMetrics: FontMeasurement;
  normalizedMetrics: NormalizedFontMetrics;
  sampleBox: BoxMeasurement;
  fittingBox: BoxMeasurement;
  availableBox: {
    width: number;
    height: number;
    topPadding: number;
    bottomPadding: number;
    horizontalPadding: number;
  };
  scale: {
    byWidth: number;
    byHeight: number;
    applied: number;
  };
  scaledSampleBox: BoxMeasurement;
  placement: {
    baseline: number;
    drawX: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
};

type ProjectionResult = {
  guides: StageGuides;
  layout: LayoutBox;
  debug: ProjectionDebug;
};

type StageFrame = {
  topPaddingRatio: number;
  bottomPaddingRatio: number;
  horizontalPaddingRatio: number;
};

export const CALIBRATION_SIZE = 1000;
const FONT_METRIC_REFERENCE_GLYPHS = {
  capHeight: "S",
  baseline: "n",
  xHeight: "x",
  descender: "p",
  ascender: "h",
} as const;

const STAGE_FRAMES = {
  comparisonGlyph: {
    topPaddingRatio: 0.14,
    bottomPaddingRatio: 0.12,
    horizontalPaddingRatio: 0.05,
  },
  comparisonWord: {
    topPaddingRatio: 0.18,
    bottomPaddingRatio: 0.14,
    horizontalPaddingRatio: 0.04,
  },
  testerGlyph: {
    topPaddingRatio: 0.18,
    bottomPaddingRatio: 0.08,
    horizontalPaddingRatio: 0.08,
  },
} satisfies Record<string, StageFrame>;

export const DEFAULT_FALLBACK_PRESET: FallbackFontPreset = {
  capRatio: 0.72,
  xRatio: 0.5,
  ascenderRatio: 0.76,
  descenderRatio: 0.2,
  defaultWidthFactor: 0.44,
  uppercaseWidthFactor: 0.58,
  roundWidthFactor: 0.47,
  narrowWidthFactor: 0.28,
  wideWidthFactor: 0.72,
};

export const FALLBACK_FONT_PRESETS: Record<string, FallbackFontPreset> = {
  helveticaneue: {
    capRatio: 0.718,
    xRatio: 0.522,
    ascenderRatio: 0.756,
    descenderRatio: 0.214,
    defaultWidthFactor: 0.448,
    uppercaseWidthFactor: 0.586,
    roundWidthFactor: 0.474,
    narrowWidthFactor: 0.276,
    wideWidthFactor: 0.734,
  },
  inter: {
    capRatio: 0.73,
    xRatio: 0.545,
    ascenderRatio: 0.776,
    descenderRatio: 0.216,
    defaultWidthFactor: 0.462,
    uppercaseWidthFactor: 0.592,
    roundWidthFactor: 0.482,
    narrowWidthFactor: 0.284,
    wideWidthFactor: 0.742,
  },
  arial: {
    capRatio: 0.714,
    xRatio: 0.518,
    ascenderRatio: 0.748,
    descenderRatio: 0.212,
    defaultWidthFactor: 0.454,
    uppercaseWidthFactor: 0.582,
    roundWidthFactor: 0.478,
    narrowWidthFactor: 0.28,
    wideWidthFactor: 0.736,
  },
  georgia: {
    capRatio: 0.694,
    xRatio: 0.482,
    ascenderRatio: 0.742,
    descenderRatio: 0.228,
    defaultWidthFactor: 0.506,
    uppercaseWidthFactor: 0.624,
    roundWidthFactor: 0.532,
    narrowWidthFactor: 0.306,
    wideWidthFactor: 0.768,
  },
  timesnewroman: {
    capRatio: 0.676,
    xRatio: 0.452,
    ascenderRatio: 0.726,
    descenderRatio: 0.236,
    defaultWidthFactor: 0.472,
    uppercaseWidthFactor: 0.612,
    roundWidthFactor: 0.516,
    narrowWidthFactor: 0.294,
    wideWidthFactor: 0.75,
  },
  librebaskerville: {
    capRatio: 0.686,
    xRatio: 0.464,
    ascenderRatio: 0.736,
    descenderRatio: 0.24,
    defaultWidthFactor: 0.514,
    uppercaseWidthFactor: 0.632,
    roundWidthFactor: 0.538,
    narrowWidthFactor: 0.31,
    wideWidthFactor: 0.774,
  },
};

const ROUND_FALLBACK_CHARS = new Set("acegosqubdop".split(""));
const NARROW_FALLBACK_CHARS = new Set("fijlrtI1".split(""));
const WIDE_FALLBACK_CHARS = new Set("mwMWQ@%".split(""));
const ASCENDER_FALLBACK_CHARS = new Set("bdfhkltABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
const DESCENDER_FALLBACK_CHARS = new Set("gjpqyQJ".split(""));

let sharedCanvas: HTMLCanvasElement | null = null;
let lastSettledFontsReady: Promise<FontFaceSet> | null = null;

class FontMetricsService {
  private cache = new Map<string, RawFontMetrics>();

  measure(cacheKey: string, fontString: string, ctx: CanvasRenderingContext2D): RawFontMetrics {
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const metrics = getFontMetrics(fontString, ctx);
    this.cache.set(cacheKey, metrics);
    return metrics;
  }

  invalidate() {
    this.cache.clear();
  }
}

const fontMetricsService = new FontMetricsService();

export const normalizeFallbackFamilyKey = (family: string) => family.replace(/['"\s_-]+/g, "").toLowerCase();

export const resolveFallbackFontPreset = (family: string): FallbackFontPreset =>
  FALLBACK_FONT_PRESETS[normalizeFallbackFamilyKey(family)] ?? DEFAULT_FALLBACK_PRESET;

export const registerFallbackFontPresets = (entries: Record<string, FallbackFontPreset>) => {
  for (const [family, preset] of Object.entries(entries)) {
    FALLBACK_FONT_PRESETS[normalizeFallbackFamilyKey(family)] = preset;
  }
};

const extractFamilyFromFontString = (fontString: string) => {
  const match = fontString.match(/\d+(?:\.\d+)?px\s+(.+)$/);
  return match ? match[1].trim() : fontString.trim();
};

const buildFallbackFontMetrics = (family: string): FontMeasurement => {
  const preset = resolveFallbackFontPreset(family);
  return {
    capAscent: CALIBRATION_SIZE * preset.capRatio,
    xAscent: CALIBRATION_SIZE * preset.xRatio,
    ascenderAscent: CALIBRATION_SIZE * preset.ascenderRatio,
    descenderDepth: CALIBRATION_SIZE * preset.descenderRatio,
  };
};

const estimateFallbackGlyphWidth = (char: string, preset: FallbackFontPreset) => {
  if (WIDE_FALLBACK_CHARS.has(char)) return CALIBRATION_SIZE * preset.wideWidthFactor;
  if (NARROW_FALLBACK_CHARS.has(char)) return CALIBRATION_SIZE * preset.narrowWidthFactor;
  if (ROUND_FALLBACK_CHARS.has(char.toLowerCase())) return CALIBRATION_SIZE * preset.roundWidthFactor;
  if (char >= "A" && char <= "Z") return CALIBRATION_SIZE * preset.uppercaseWidthFactor;
  return CALIBRATION_SIZE * preset.defaultWidthFactor;
};

const buildFallbackVisualBox = (family: string, sample: string): BoxMeasurement => {
  const preset = resolveFallbackFontPreset(family);
  const text = sample || "H";
  const width = Math.max(
    text.split("").reduce((total, char) => total + estimateFallbackGlyphWidth(char, preset), 0),
    CALIBRATION_SIZE * 0.5
  );
  const hasAscender = text.split("").some((char) => ASCENDER_FALLBACK_CHARS.has(char));
  const hasDescender = text.split("").some((char) => DESCENDER_FALLBACK_CHARS.has(char));
  const hasUppercase = text.split("").some((char) => char >= "A" && char <= "Z");
  const ascentRatio = hasUppercase
    ? Math.max(preset.capRatio, hasAscender ? preset.ascenderRatio : preset.capRatio)
    : hasAscender
      ? preset.ascenderRatio
      : preset.xRatio;

  return {
    left: 0,
    right: width,
    width,
    ascent: CALIBRATION_SIZE * ascentRatio,
    descent: CALIBRATION_SIZE * (hasDescender ? preset.descenderRatio : 0.06),
  };
};

const getBrowserMeasureContext = () => {
  if (typeof document === "undefined") return null;

  if (!sharedCanvas) {
    sharedCanvas = document.createElement("canvas");
  }

  return sharedCanvas.getContext("2d");
};

const createBrowserScratchContext = (width: number, height: number, willReadFrequently = false) => {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(Math.ceil(width), 1);
  canvas.height = Math.max(Math.ceil(height), 1);
  return canvas.getContext("2d", willReadFrequently ? { willReadFrequently: true } : undefined);
};

export const buildCanvasFontString = ({
  family,
  size,
  weight = 500,
}: {
  family: string;
  size: number;
  weight?: number;
}) => `${weight} ${size}px ${family}`;

const buildFontMetricsCacheKey = ({
  family,
  size,
  weight = 500,
  variationSettings,
}: {
  family: string;
  size: number;
  weight?: number;
  variationSettings?: string;
}) => [buildCanvasFontString({ family, size, weight }), variationSettings ?? "normal"].join(" | ");

export const getFontMetrics = (fontString: string, ctx: CanvasRenderingContext2D): RawFontMetrics => {
  const fontSizeMatch = fontString.match(/(\d+(?:\.\d+)?)px/);
  const fontSize = fontSizeMatch ? Number.parseFloat(fontSizeMatch[1]) : CALIBRATION_SIZE;
  const padding = fontSize * 0.5;
  const canvas = ctx.canvas;

  canvas.width = Math.max(Math.ceil(fontSize * 2), 1);
  canvas.height = Math.max(Math.ceil(fontSize * 2 + padding), 1);
  ctx.font = fontString;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";

  const measureRasterBounds = (sample: string) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(sample, canvas.width / 2, padding, canvas.width);

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let first = -1;
    let last = -1;

    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) {
        first = (index - 3) / 4;
        break;
      }
    }

    for (let index = pixels.length - 1; index >= 3; index -= 4) {
      if (pixels[index] > 0) {
        last = index / 4;
        break;
      }
    }

    const top = first >= 0 ? Math.round(first / canvas.width) - padding : 0;
    const bottom = last >= 0 ? Math.round(last / canvas.width) - padding : 0;

    return { top, bottom };
  };

  const baselineBounds = measureRasterBounds(FONT_METRIC_REFERENCE_GLYPHS.baseline);
  const capBounds = measureRasterBounds(FONT_METRIC_REFERENCE_GLYPHS.capHeight);
  const xBounds = measureRasterBounds(FONT_METRIC_REFERENCE_GLYPHS.xHeight);
  const ascenderBounds = measureRasterBounds(FONT_METRIC_REFERENCE_GLYPHS.ascender);
  const descenderBounds = measureRasterBounds(FONT_METRIC_REFERENCE_GLYPHS.descender);
  const baseline = baselineBounds.bottom;

  return {
    baseline: 0,
    xHeight: baseline - xBounds.top || fontSize * 0.5,
    capHeight: baseline - capBounds.top || fontSize * 0.72,
    ascender: baseline - ascenderBounds.top || fontSize * 0.76,
    descender: descenderBounds.bottom - baseline || fontSize * 0.2,
  };
};

export const invalidateTypographyMeasurementCaches = () => {
  fontMetricsService.invalidate();
};

export const waitForTypographyFonts = async () => {
  if (typeof document === "undefined" || !("fonts" in document) || !document.fonts) return;

  const readyPromise = document.fonts.ready;
  await readyPromise;

  if (lastSettledFontsReady !== readyPromise) {
    invalidateTypographyMeasurementCaches();
    lastSettledFontsReady = readyPromise;
  }
};

const measureBox = (ctx: CanvasRenderingContext2D, sample: string): BoxMeasurement => {
  // Visual-box sampling must always use the left text origin, otherwise
  // any previous centered metric probe corrupts the projected word bounds.
  ctx.textAlign = "left";
  const metrics = ctx.measureText(sample);
  const left = metrics.actualBoundingBoxLeft || 0;
  const right = metrics.actualBoundingBoxRight || metrics.width || CALIBRATION_SIZE * 0.5;
  const ascent = metrics.actualBoundingBoxAscent || CALIBRATION_SIZE * 0.7;
  const descent = metrics.actualBoundingBoxDescent || CALIBRATION_SIZE * 0.2;
  const width = Math.max(left + right, metrics.width || CALIBRATION_SIZE * 0.5);

  return {
    left,
    right,
    width,
    ascent,
    descent,
  };
};

const normalizeFontMetrics = (fontMetrics: FontMeasurement): NormalizedFontMetrics => ({
  capRatio: fontMetrics.capAscent / CALIBRATION_SIZE,
  xRatio: fontMetrics.xAscent / CALIBRATION_SIZE,
  ascenderRatio: fontMetrics.ascenderAscent / CALIBRATION_SIZE,
  descenderRatio: fontMetrics.descenderDepth / CALIBRATION_SIZE,
});

const scaleBox = (box: BoxMeasurement, scale: number): BoxMeasurement => ({
  left: box.left * scale,
  right: box.right * scale,
  width: box.width * scale,
  ascent: box.ascent * scale,
  descent: box.descent * scale,
});

export const measureFontMetrics = (family: string, weight = 500): FontMeasurement => {
  const ctx = getBrowserMeasureContext();

  if (!ctx) {
    return buildFallbackFontMetrics(family);
  }

  const fontString = buildCanvasFontString({
    family,
    size: CALIBRATION_SIZE,
    weight,
  });
  const metrics = fontMetricsService.measure(
    buildFontMetricsCacheKey({
      family,
      size: CALIBRATION_SIZE,
      weight,
    }),
    fontString,
    ctx
  );

  return {
    capAscent: metrics.capHeight,
    xAscent: metrics.xHeight,
    ascenderAscent: metrics.ascender,
    descenderDepth: metrics.descender,
  };
};

export const measureVisualBox = (family: string, sample: string, weight = 500): BoxMeasurement => {
  const ctx = getBrowserMeasureContext();

  if (!ctx) {
    return buildFallbackVisualBox(family, sample);
  }

  ctx.font = `${weight} ${CALIBRATION_SIZE}px ${family}`;
  ctx.textBaseline = "alphabetic";

  return measureBox(ctx, sample);
};

export const measureVisualBoxForFontString = (fontString: string, sample: string): BoxMeasurement => {
  const ctx = getBrowserMeasureContext();

  if (!ctx) {
    return buildFallbackVisualBox(extractFamilyFromFontString(fontString), sample);
  }

  ctx.font = fontString;
  ctx.textBaseline = "alphabetic";

  return measureBox(ctx, sample);
};

export const measureAdvanceWidthForFontString = (fontString: string, sample: string): number => {
  const ctx = getBrowserMeasureContext();

  if (!ctx) {
    return buildFallbackVisualBox(extractFamilyFromFontString(fontString), sample).width;
  }

  ctx.font = fontString;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  return ctx.measureText(sample).width || 0;
};

export const measureFontMetricsForFontString = (fontString: string): FontMeasurement => {
  const ctx = getBrowserMeasureContext();

  if (!ctx) {
    return buildFallbackFontMetrics(extractFamilyFromFontString(fontString));
  }

  const metrics = fontMetricsService.measure(fontString, fontString, ctx);

  return {
    capAscent: metrics.capHeight,
    xAscent: metrics.xHeight,
    ascenderAscent: metrics.ascender,
    descenderDepth: metrics.descender,
  };
};

export const getStageFrame = (frame: keyof typeof STAGE_FRAMES): StageFrame => STAGE_FRAMES[frame];

const buildProjection = ({
  family,
  sample,
  fittingBox,
  width,
  height,
  frame,
  weight = 500,
}: {
  family: string;
  sample: string;
  fittingBox: BoxMeasurement;
  width: number;
  height: number;
  frame: keyof typeof STAGE_FRAMES;
  weight?: number;
}): ProjectionResult => {
  const frameConfig = getStageFrame(frame);
  const fontMetrics = measureFontMetrics(family, weight);
  const normalizedMetrics = normalizeFontMetrics(fontMetrics);
  const sampleBox = measureVisualBox(family, sample, weight);
  const topPadding = height * frameConfig.topPaddingRatio;
  const bottomPadding = height * frameConfig.bottomPaddingRatio;
  const horizontalPadding = width * frameConfig.horizontalPaddingRatio;
  const availableWidth = Math.max(width - horizontalPadding * 2, 1);
  const availableHeight = Math.max(height - topPadding - bottomPadding, 1);
  const scaleByWidth = availableWidth / Math.max(fittingBox.width, 1);
  const scaleByHeight = availableHeight / Math.max(fittingBox.ascent + fittingBox.descent, 1);
  const scale = Math.min(scaleByWidth, scaleByHeight);
  const scaledSampleBox = scaleBox(sampleBox, scale);
  const baseline = topPadding + fittingBox.ascent * scale;
  const drawX = width / 2 - (sampleBox.width * scale) / 2 + sampleBox.left * scale;

  return {
    guides: {
      top: topPadding,
      baseline,
      descender: baseline + normalizedMetrics.descenderRatio * CALIBRATION_SIZE * scale,
      capHeight: baseline - normalizedMetrics.capRatio * CALIBRATION_SIZE * scale,
      xHeight: baseline - normalizedMetrics.xRatio * CALIBRATION_SIZE * scale,
      ascender: baseline - normalizedMetrics.ascenderRatio * CALIBRATION_SIZE * scale,
    } satisfies StageGuides,
    layout: {
      fontSize: CALIBRATION_SIZE * scale,
      drawX,
      left: drawX - scaledSampleBox.left,
      right: drawX + scaledSampleBox.right,
      ascent: scaledSampleBox.ascent,
      descent: scaledSampleBox.descent,
    } satisfies LayoutBox,
    debug: {
      calibrationSize: CALIBRATION_SIZE,
      frame: {
        key: frame,
        ...frameConfig,
      },
      fontMetrics,
      normalizedMetrics,
      sampleBox,
      fittingBox,
      availableBox: {
        width: availableWidth,
        height: availableHeight,
        topPadding,
        bottomPadding,
        horizontalPadding,
      },
      scale: {
        byWidth: scaleByWidth,
        byHeight: scaleByHeight,
        applied: scale,
      },
      scaledSampleBox,
      placement: {
        baseline,
        drawX,
        left: drawX - scaledSampleBox.left,
        right: drawX + scaledSampleBox.right,
        top: baseline - scaledSampleBox.ascent,
        bottom: baseline + scaledSampleBox.descent,
      },
    } satisfies ProjectionDebug,
  };
};

export const projectSampleToFrame = ({
  family,
  sample,
  width,
  height,
  frame,
  weight = 500,
}: {
  family: string;
  sample: string;
  width: number;
  height: number;
  frame: keyof typeof STAGE_FRAMES;
  weight?: number;
}): ProjectionResult => {
  const sampleBox = measureVisualBox(family, sample, weight);

  return buildProjection({
    family,
    sample,
    fittingBox: sampleBox,
    width,
    height,
    frame,
    weight,
  });
};

export const projectSampleToFrameAfterFontsReady = async ({
  family,
  sample,
  width,
  height,
  frame,
  weight = 500,
}: {
  family: string;
  sample: string;
  width: number;
  height: number;
  frame: keyof typeof STAGE_FRAMES;
  weight?: number;
}) => {
  await waitForTypographyFonts();
  return projectSampleToFrame({
    family,
    sample,
    width,
    height,
    frame,
    weight,
  });
};

export const browserTypographyRuntime: TypographyProjectionRuntime = {
  getMeasureContext: getBrowserMeasureContext,
  createScratchContext: createBrowserScratchContext,
  waitForFontsReady: waitForTypographyFonts,
  measureFontMetrics,
  measureVisualBox,
  measureVisualBoxForFontString,
  measureAdvanceWidthForFontString,
  projectSampleToFrame,
  projectSampleToFrameAfterFontsReady,
};

export const fallbackTypographyRuntime: TypographyProjectionRuntime = {
  getMeasureContext: () => null,
  createScratchContext: () => null,
  waitForFontsReady: async () => {},
  measureFontMetrics,
  measureVisualBox,
  measureVisualBoxForFontString,
  measureAdvanceWidthForFontString,
  projectSampleToFrame,
  projectSampleToFrameAfterFontsReady,
};

export const headlessTypographyRuntime: TypographyProjectionRuntime = {
  ...fallbackTypographyRuntime,
};

export const projectSamplesToFrame = ({
  family,
  samples,
  width,
  height,
  frame,
  weight = 500,
}: {
  family: string;
  samples: string[];
  width: number;
  height: number;
  frame: keyof typeof STAGE_FRAMES;
  weight?: number;
}): ProjectionResult => {
  const visualBoxes = samples.map((sample) => measureVisualBox(family, sample, weight));
  const fittingBox = visualBoxes.reduce(
    (widest, current) => (current.width > widest.width ? current : widest),
    visualBoxes[0] ?? {
      left: 0,
      right: CALIBRATION_SIZE * 0.5,
      width: CALIBRATION_SIZE * 0.5,
      ascent: CALIBRATION_SIZE * 0.72,
      descent: CALIBRATION_SIZE * 0.2,
    }
  );
  const tallestAscent = Math.max(...visualBoxes.map((box) => box.ascent), fittingBox.ascent);
  const deepestDescent = Math.max(...visualBoxes.map((box) => box.descent), fittingBox.descent);

  return buildProjection({
    family,
    sample: samples[0] ?? "H",
    fittingBox: {
      ...fittingBox,
      ascent: tallestAscent,
      descent: deepestDescent,
    },
    width,
    height,
    frame,
    weight,
  });
};

export const getGuidePercents = ({
  family,
  frame,
  sample = "H",
  weight = 500,
}: {
  family: string;
  frame: keyof typeof STAGE_FRAMES;
  sample?: string;
  weight?: number;
}) => {
  const projected = projectSampleToFrame({
    family,
    sample,
    width: 100,
    height: 100,
    frame,
    weight,
  });

  return {
    capHeight: projected.guides.capHeight,
    xHeight: projected.guides.xHeight,
    baseline: projected.guides.baseline,
  };
};

export type {
  BoxMeasurement,
  FontMeasurement,
  LayoutBox,
  NormalizedFontMetrics,
  ProjectionDebug,
  ProjectionResult,
  StageFrame,
  StageGuides,
};
import type { TypographyProjectionRuntime } from "@/lib/typography/measurement-runtime";
