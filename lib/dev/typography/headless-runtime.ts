import {
  buildCanvasFontString,
  CALIBRATION_SIZE,
  type FallbackFontPreset,
  headlessTypographyRuntime,
  normalizeFallbackFamilyKey,
  registerFallbackFontPresets,
} from "@/lib/typography/anatomy-metrics";
import type { TypographyProjectionRuntime } from "@/lib/typography/measurement-runtime";

/**
 * Sample-level metrics expressed as ratios of the font's em (1.0 = unitsPerEm).
 * The runtime scales these to the requested font size when serving a measurement.
 */
export type HeadlessSampleMetricsRatio = {
  advanceWidthRatio: number;
  leftRatio: number;
  rightRatio: number;
  ascentRatio: number;
  descentRatio: number;
};

export type HeadlessFontMetricsOverride = {
  fontId: string;
  familyName: string;
  preset: FallbackFontPreset;
  sourceFile?: string;
  sampleCounts?: {
    glyphsExtracted: number;
    wordsExtracted: number;
    missingGlyphs: string[];
    missingWords: string[];
  };
  samples?: {
    glyphs?: Record<string, HeadlessSampleMetricsRatio>;
    words?: Record<string, HeadlessSampleMetricsRatio>;
  };
};

export type HeadlessFontMetricsFile = {
  generatedAt?: string;
  source?: string;
  overrides: HeadlessFontMetricsOverride[];
};

const PRESET_KEYS = [
  "capRatio",
  "xRatio",
  "ascenderRatio",
  "descenderRatio",
  "defaultWidthFactor",
  "uppercaseWidthFactor",
  "roundWidthFactor",
  "narrowWidthFactor",
  "wideWidthFactor",
] as const satisfies readonly (keyof FallbackFontPreset)[];

const isPreset = (value: unknown): value is FallbackFontPreset =>
  !!value &&
  typeof value === "object" &&
  PRESET_KEYS.every((key) => typeof (value as Record<string, unknown>)[key] === "number");

const SAMPLE_RATIO_KEYS = [
  "advanceWidthRatio",
  "leftRatio",
  "rightRatio",
  "ascentRatio",
  "descentRatio",
] as const satisfies readonly (keyof HeadlessSampleMetricsRatio)[];

const isSampleRatio = (value: unknown): value is HeadlessSampleMetricsRatio =>
  !!value &&
  typeof value === "object" &&
  SAMPLE_RATIO_KEYS.every((key) => typeof (value as Record<string, unknown>)[key] === "number");

const parseSampleMap = (
  raw: unknown,
  context: string
): Record<string, HeadlessSampleMetricsRatio> | undefined => {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object") {
    throw new Error(`${context}: expected an object keyed by sample.`);
  }
  const out: Record<string, HeadlessSampleMetricsRatio> = {};
  for (const [sample, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSampleRatio(value)) {
      throw new Error(
        `${context}: sample "${sample}" is missing one of the required ratio keys (${SAMPLE_RATIO_KEYS.join(", ")}).`
      );
    }
    out[sample] = value;
  }
  return out;
};

export const parseHeadlessFontMetricsFile = (raw: unknown): HeadlessFontMetricsOverride[] => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Headless metrics file must be a JSON object with an 'overrides' array.");
  }

  const overrides = (raw as { overrides?: unknown }).overrides;
  if (!Array.isArray(overrides)) {
    throw new Error("Headless metrics file is missing an 'overrides' array.");
  }

  return overrides.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Headless metrics override at index ${index} must be an object.`);
    }

    const fontId = (entry as { fontId?: unknown }).fontId;
    const familyName = (entry as { familyName?: unknown }).familyName;
    const preset = (entry as { preset?: unknown }).preset;
    const sourceFile =
      (entry as { sourceFile?: unknown }).sourceFile ??
      (entry as { meta?: { sourceFile?: unknown } }).meta?.sourceFile;
    const sampleCountsRaw =
      (entry as { sampleCounts?: unknown }).sampleCounts ??
      (entry as { meta?: { sampleCounts?: unknown } }).meta?.sampleCounts;

    if (typeof fontId !== "string" || !fontId.trim()) {
      throw new Error(`Headless metrics override at index ${index} is missing a string 'fontId'.`);
    }
    if (typeof familyName !== "string" || !familyName.trim()) {
      throw new Error(`Headless metrics override at index ${index} is missing a string 'familyName'.`);
    }
    if (!isPreset(preset)) {
      throw new Error(
        `Headless metrics override "${fontId}" is missing a complete 'preset' object (expected keys: ${PRESET_KEYS.join(", ")}).`
      );
    }

    let sampleCounts: HeadlessFontMetricsOverride["sampleCounts"];
    if (sampleCountsRaw !== undefined) {
      if (!sampleCountsRaw || typeof sampleCountsRaw !== "object") {
        throw new Error(`Headless metrics override "${fontId}" has an invalid 'sampleCounts' field.`);
      }
      const glyphsExtracted = (sampleCountsRaw as { glyphsExtracted?: unknown }).glyphsExtracted;
      const wordsExtracted = (sampleCountsRaw as { wordsExtracted?: unknown }).wordsExtracted;
      const missingGlyphs = (sampleCountsRaw as { missingGlyphs?: unknown }).missingGlyphs;
      const missingWords = (sampleCountsRaw as { missingWords?: unknown }).missingWords;

      if (
        typeof glyphsExtracted !== "number" ||
        typeof wordsExtracted !== "number" ||
        !Array.isArray(missingGlyphs) ||
        !Array.isArray(missingWords) ||
        !missingGlyphs.every((value) => typeof value === "string") ||
        !missingWords.every((value) => typeof value === "string")
      ) {
        throw new Error(`Headless metrics override "${fontId}" has an invalid sampleCounts payload.`);
      }

      sampleCounts = {
        glyphsExtracted,
        wordsExtracted,
        missingGlyphs,
        missingWords,
      };
    }

    const samplesRaw = (entry as { samples?: unknown }).samples;
    let samples: HeadlessFontMetricsOverride["samples"];
    if (samplesRaw !== undefined) {
      if (!samplesRaw || typeof samplesRaw !== "object") {
        throw new Error(`Headless metrics override "${fontId}" has an invalid 'samples' field.`);
      }
      const glyphs = parseSampleMap(
        (samplesRaw as { glyphs?: unknown }).glyphs,
        `Headless metrics override "${fontId}".samples.glyphs`
      );
      const words = parseSampleMap(
        (samplesRaw as { words?: unknown }).words,
        `Headless metrics override "${fontId}".samples.words`
      );
      if (glyphs || words) {
        samples = { ...(glyphs ? { glyphs } : {}), ...(words ? { words } : {}) };
      }
    }

    return {
      fontId: fontId.trim(),
      familyName: familyName.trim(),
      preset,
      sourceFile: typeof sourceFile === "string" && sourceFile.trim() ? sourceFile.trim() : undefined,
      sampleCounts,
      samples,
    };
  });
};

type SampleLookup = Map<string, HeadlessSampleMetricsRatio>;

const sampleKey = (familyOrKey: string, sample: string) =>
  `${normalizeFallbackFamilyKey(familyOrKey)}|${sample}`;

const buildSampleLookup = (overrides: HeadlessFontMetricsOverride[]): SampleLookup => {
  const lookup: SampleLookup = new Map();
  for (const entry of overrides) {
    const samples = entry.samples;
    if (!samples) continue;
    const aliases = [entry.familyName, entry.fontId];
    for (const alias of aliases) {
      if (samples.glyphs) {
        for (const [glyph, ratio] of Object.entries(samples.glyphs)) {
          lookup.set(sampleKey(alias, glyph), ratio);
        }
      }
      if (samples.words) {
        for (const [word, ratio] of Object.entries(samples.words)) {
          lookup.set(sampleKey(alias, word), ratio);
        }
      }
    }
  }
  return lookup;
};

const parseFontSizePx = (fontString: string): number => {
  const match = fontString.match(/(\d+(?:\.\d+)?)px/);
  return match ? Number.parseFloat(match[1]) : CALIBRATION_SIZE;
};

const extractFamilyFromFontString = (fontString: string): string => {
  const match = fontString.match(/\d+(?:\.\d+)?px\s+(.+)$/);
  return match ? match[1].trim() : fontString.trim();
};

const scaleSampleToBox = (ratio: HeadlessSampleMetricsRatio, sizePx: number) => ({
  left: ratio.leftRatio * sizePx,
  right: ratio.rightRatio * sizePx,
  width: Math.max((ratio.leftRatio + ratio.rightRatio) * sizePx, ratio.advanceWidthRatio * sizePx),
  ascent: ratio.ascentRatio * sizePx,
  descent: ratio.descentRatio * sizePx,
});

export const createHeadlessTypographyRuntime = (
  overrides: HeadlessFontMetricsOverride[] = []
): TypographyProjectionRuntime => {
  if (overrides.length) {
    registerFallbackFontPresets(
      Object.fromEntries(overrides.flatMap((entry) => [
        [entry.familyName, entry.preset],
        [entry.fontId, entry.preset],
      ]))
    );
  }

  const sampleLookup = buildSampleLookup(overrides);

  if (sampleLookup.size === 0) {
    return headlessTypographyRuntime;
  }

  return {
    ...headlessTypographyRuntime,
    measureVisualBox: (family, sample, weight) => {
      const ratio = sampleLookup.get(sampleKey(family, sample));
      if (ratio) return scaleSampleToBox(ratio, CALIBRATION_SIZE);
      return headlessTypographyRuntime.measureVisualBox(family, sample, weight);
    },
    measureVisualBoxForFontString: (fontString, sample) => {
      const family = extractFamilyFromFontString(fontString);
      const ratio = sampleLookup.get(sampleKey(family, sample));
      if (ratio) return scaleSampleToBox(ratio, parseFontSizePx(fontString));
      return headlessTypographyRuntime.measureVisualBoxForFontString(fontString, sample);
    },
    measureAdvanceWidthForFontString: (fontString, sample) => {
      const family = extractFamilyFromFontString(fontString);
      const ratio = sampleLookup.get(sampleKey(family, sample));
      if (ratio) return ratio.advanceWidthRatio * parseFontSizePx(fontString);
      return headlessTypographyRuntime.measureAdvanceWidthForFontString(fontString, sample);
    },
  };
};

// Silence unused-import warnings while keeping the canvas-string helper available for future use.
void buildCanvasFontString;
