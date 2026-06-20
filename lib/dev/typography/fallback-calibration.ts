import {
  CALIBRATION_SIZE,
  browserTypographyRuntime,
  fallbackTypographyRuntime,
  normalizeFallbackFamilyKey,
  resolveFallbackFontPreset,
  type FallbackFontPreset,
} from "@/lib/typography/anatomy-metrics";
import { DEV_TYPEFACE_FAMILIES, type DevTypefaceFamily } from "@/lib/dev/typography/typeface-profile-dev-builder";

export type CalibrationSampleKey = "x" | "H" | "play" | "Atlas" | "contrast";

export type RuntimeMetricSnapshot = {
  capAscent: number;
  xAscent: number;
  ascenderAscent: number;
  descenderDepth: number;
};

export type RuntimeBoxSnapshot = {
  width: number;
  ascent: number;
  descent: number;
};

export type CalibrationSampleReport = {
  key: CalibrationSampleKey;
  sample: string;
  browser: RuntimeBoxSnapshot;
  fallback: RuntimeBoxSnapshot;
  delta: RuntimeBoxSnapshot;
};

export type FallbackCalibrationReport = {
  fontId: string;
  familyName: string;
  presetKey: string;
  currentPreset: FallbackFontPreset;
  suggestedPreset: FallbackFontPreset;
  browserMetrics: RuntimeMetricSnapshot;
  fallbackMetrics: RuntimeMetricSnapshot;
  metricDelta: RuntimeMetricSnapshot;
  samples: CalibrationSampleReport[];
};

const CALIBRATION_SAMPLES: Array<{ key: CalibrationSampleKey; sample: string }> = [
  { key: "x", sample: "x" },
  { key: "H", sample: "H" },
  { key: "play", sample: "play" },
  { key: "Atlas", sample: "Atlas" },
  { key: "contrast", sample: "contrast" },
];

const roundPresetValue = (value: number) => Number(value.toFixed(4));

const buildMetricSnapshot = (family: string, runtime: typeof browserTypographyRuntime): RuntimeMetricSnapshot => {
  const metrics = runtime.measureFontMetrics(family);
  return {
    capAscent: roundPresetValue(metrics.capAscent / CALIBRATION_SIZE),
    xAscent: roundPresetValue(metrics.xAscent / CALIBRATION_SIZE),
    ascenderAscent: roundPresetValue(metrics.ascenderAscent / CALIBRATION_SIZE),
    descenderDepth: roundPresetValue(metrics.descenderDepth / CALIBRATION_SIZE),
  };
};

const buildBoxSnapshot = (family: string, sample: string, runtime: typeof browserTypographyRuntime): RuntimeBoxSnapshot => {
  const box = runtime.measureVisualBox(family, sample);
  return {
    width: roundPresetValue(box.width / CALIBRATION_SIZE),
    ascent: roundPresetValue(box.ascent / CALIBRATION_SIZE),
    descent: roundPresetValue(box.descent / CALIBRATION_SIZE),
  };
};

const deltaSnapshot = <T extends Record<string, number>>(browser: T, fallback: T): T =>
  Object.fromEntries(
    Object.keys(browser).map((key) => [key, roundPresetValue(browser[key] - fallback[key])])
  ) as T;

const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

const deriveSuggestedPreset = ({
  familyName,
  browserMetrics,
  sampleReports,
}: {
  familyName: string;
  browserMetrics: RuntimeMetricSnapshot;
  sampleReports: CalibrationSampleReport[];
}): FallbackFontPreset => {
  const currentPreset = resolveFallbackFontPreset(familyName);
  const xSample = sampleReports.find((sample) => sample.key === "x");
  const capSample = sampleReports.find((sample) => sample.key === "H");
  const lowercaseSamples = sampleReports.filter((sample) => sample.key === "play" || sample.key === "contrast");
  const mixedSamples = sampleReports.filter((sample) => sample.key === "Atlas");

  return {
    capRatio: roundPresetValue(browserMetrics.capAscent),
    xRatio: roundPresetValue(browserMetrics.xAscent),
    ascenderRatio: roundPresetValue(browserMetrics.ascenderAscent),
    descenderRatio: roundPresetValue(browserMetrics.descenderDepth),
    defaultWidthFactor: roundPresetValue(average(lowercaseSamples.map((sample) => sample.browser.width / sample.sample.length))),
    uppercaseWidthFactor: roundPresetValue(capSample?.browser.width ?? currentPreset.uppercaseWidthFactor),
    roundWidthFactor: roundPresetValue(
      average(
        [xSample?.browser.width, ...lowercaseSamples.map((sample) => sample.browser.width / Math.max(sample.sample.length, 1))].filter(
          (value): value is number => typeof value === "number"
        )
      )
    ),
    narrowWidthFactor: currentPreset.narrowWidthFactor,
    wideWidthFactor: roundPresetValue(
      average(
        mixedSamples.map((sample) => sample.browser.width / Math.max(sample.sample.length * 0.82, 1))
      ) || currentPreset.wideWidthFactor
    ),
  };
};

export const buildFallbackCalibrationReport = async ({
  families = DEV_TYPEFACE_FAMILIES,
  measurementFamilyResolver,
}: {
  families?: readonly DevTypefaceFamily[];
  measurementFamilyResolver?: (fontId: string, familyName: string) => string;
} = {}): Promise<FallbackCalibrationReport[]> => {
  await browserTypographyRuntime.waitForFontsReady();

  return families.map(({ fontId, familyName }) => {
    const measurementFamily = measurementFamilyResolver?.(fontId, familyName) ?? familyName;
    const browserMetrics = buildMetricSnapshot(measurementFamily, browserTypographyRuntime);
    const fallbackMetrics = buildMetricSnapshot(measurementFamily, fallbackTypographyRuntime);
    const samples = CALIBRATION_SAMPLES.map(({ key, sample }) => {
      const browser = buildBoxSnapshot(measurementFamily, sample, browserTypographyRuntime);
      const fallback = buildBoxSnapshot(measurementFamily, sample, fallbackTypographyRuntime);
      return {
        key,
        sample,
        browser,
        fallback,
        delta: deltaSnapshot(browser, fallback),
      };
    });

    return {
      fontId,
      familyName,
      presetKey: normalizeFallbackFamilyKey(familyName),
      currentPreset: resolveFallbackFontPreset(familyName),
      suggestedPreset: deriveSuggestedPreset({
        familyName,
        browserMetrics,
        sampleReports: samples,
      }),
      browserMetrics,
      fallbackMetrics,
      metricDelta: deltaSnapshot(browserMetrics, fallbackMetrics),
      samples,
    };
  });
};
