import { browserTypographyRuntime, fallbackTypographyRuntime, headlessTypographyRuntime } from "@/lib/typography/anatomy-metrics";
import { GLYPH_AUDIT_EXPECTATIONS, evaluateGlyphAudit } from "@/lib/dev/typography/glyph-audit-spec";
import { buildGlyphMeasurementProfile } from "@/lib/dev/typography/glyph-measurement-profile-adapter";
import { buildGlyphOverlayModel, measureGlyph } from "@/lib/typography/glyph-overlay-engine";
import type {
  MeasurementProvenanceKind,
  RenderContextProfile,
  TypefaceMeasurementProfile,
} from "@/lib/typography/measurement-profile-contracts";
import type { TypographyProjectionRuntime } from "@/lib/typography/measurement-runtime";
import { buildTypefaceMeasurementProfile } from "@/lib/dev/typography/typeface-measurement-profile-builder";
import { WORD_AUDIT_EXPECTATIONS, evaluateWordAudit } from "@/lib/dev/typography/word-audit-spec";
import { buildWordMeasurementProfile } from "@/lib/dev/typography/word-measurement-profile-adapter";
import { buildWordOverlayModel, measureWordOverlay } from "@/lib/typography/word-overlay-engine";

export const DEV_TYPEFACE_FAMILIES = [
  { fontId: "helvetica-neue", familyName: "Helvetica Neue" },
  { fontId: "inter", familyName: "Inter" },
  { fontId: "arial", familyName: "Arial" },
  { fontId: "georgia", familyName: "Georgia" },
  { fontId: "times_new_roman", familyName: "Times New Roman" },
  { fontId: "libre_baskerville", familyName: "Libre Baskerville" },
] as const;

export type DevTypefaceFamily = {
  fontId: string;
  familyName: string;
};

export type DevTypefaceProvenance = TypefaceMeasurementProfile["provenance"];

const GLYPH_STAGE = { width: 520, height: 320 } as const;
const WORD_STAGE = { width: 520, height: 320 } as const;

const buildRenderContexts = ({
  fontId,
  runtimeKind,
  devicePixelRatio,
}: {
  fontId: string;
  runtimeKind: "browser" | "fallback" | "headless";
  devicePixelRatio: number;
}): RenderContextProfile[] => [
  {
    id: `typeface-profile:glyph:${fontId}`,
    environment: runtimeKind === "browser" ? "browser-canvas" : runtimeKind === "headless" ? "server-raster" : "unknown",
    viewport: {
      width: GLYPH_STAGE.width,
      height: GLYPH_STAGE.height,
      devicePixelRatio,
    },
    fontSizePx: 0,
    fontWeight: 500,
    sampleMode: "glyph",
    notes: [`Generated from the glyph audit corpus using the ${runtimeKind} runtime.`],
  },
  {
    id: `typeface-profile:word:${fontId}`,
    environment: runtimeKind === "browser" ? "browser-canvas" : runtimeKind === "headless" ? "server-raster" : "unknown",
    viewport: {
      width: WORD_STAGE.width,
      height: WORD_STAGE.height,
      devicePixelRatio,
    },
    fontSizePx: 0,
    fontWeight: 500,
    sampleMode: "word",
    notes: [`Generated from the word audit corpus using the ${runtimeKind} runtime.`],
  },
];

export async function buildTypefaceDevProfile({
  fontId,
  familyName,
  runtime = browserTypographyRuntime,
  runtimeKind = "browser",
  devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  measurementFamilyResolver,
  provenance,
}: {
  fontId: string;
  familyName: string;
  runtime?: TypographyProjectionRuntime;
  runtimeKind?: "browser" | "fallback" | "headless";
  devicePixelRatio?: number;
  measurementFamilyResolver?: (fontId: string, familyName: string) => string;
  provenance?: DevTypefaceProvenance;
}): Promise<TypefaceMeasurementProfile> {
  const measurementFamily = measurementFamilyResolver?.(fontId, familyName) ?? familyName;

  const glyphProfilesEntries = await Promise.all(
    GLYPH_AUDIT_EXPECTATIONS.map(async (expectation) => {
      const metrics = await measureGlyph({
        family: measurementFamily,
        glyph: expectation.glyph,
        width: GLYPH_STAGE.width,
        height: GLYPH_STAGE.height,
        runtime,
      });
      const overlayModel = buildGlyphOverlayModel(expectation.glyph, metrics, GLYPH_STAGE);
      const evaluation = evaluateGlyphAudit(expectation, overlayModel, metrics);

      return [
        expectation.glyph,
        buildGlyphMeasurementProfile({
          fontId,
          renderContextId: `typeface-profile:glyph:${fontId}:${expectation.glyph}`,
          glyph: expectation.glyph,
          metrics,
          overlayModel,
          auditEvaluation: evaluation,
        }),
      ] as const;
    })
  );

  const wordProfilesEntries = await Promise.all(
    WORD_AUDIT_EXPECTATIONS.map(async (expectation) => {
      const metrics = await measureWordOverlay({
        family: measurementFamily,
        word: expectation.word,
        width: WORD_STAGE.width,
        height: WORD_STAGE.height,
        runtime,
      });
      const model = buildWordOverlayModel({
        word: expectation.word,
        metrics,
        feature: expectation.feature,
      });
      const evaluation = evaluateWordAudit(expectation, model, metrics);

      return [
        `${expectation.feature}:${expectation.word}`,
        buildWordMeasurementProfile({
          fontId,
          renderContextId: `typeface-profile:word:${fontId}:${expectation.feature}:${expectation.word}`,
          word: expectation.word,
          metrics,
          model,
          auditEvaluation: evaluation,
        }),
      ] as const;
    })
  );

  return buildTypefaceMeasurementProfile({
    source: {
      fontId,
      familyName,
      styleName: "Regular",
      slug: fontId,
      tags: ["dev-profile", "latin", "compare-stage", runtimeKind],
    },
    provenance:
      provenance ??
      ({
        kind:
          runtimeKind === "browser"
            ? ("browser-derived" satisfies MeasurementProvenanceKind)
            : ("preset-derived" satisfies MeasurementProvenanceKind),
        runtime: runtimeKind,
        note: `Default dev-profile provenance inferred from the ${runtimeKind} runtime.`,
      } as DevTypefaceProvenance),
    glyphProfiles: Object.fromEntries(glyphProfilesEntries),
    wordProfiles: Object.fromEntries(wordProfilesEntries),
    renderContexts: buildRenderContexts({
      fontId,
      runtimeKind,
      devicePixelRatio,
    }),
    notes: [`First dev aggregate profile built directly from the current audit corpus using the ${runtimeKind} runtime.`],
  });
}

export async function buildAllTypefaceDevProfiles({
  runtime = fallbackTypographyRuntime,
  runtimeKind = "fallback",
  devicePixelRatio = 1,
  families = DEV_TYPEFACE_FAMILIES,
  measurementFamilyResolver,
  provenanceResolver,
}: {
  runtime?: TypographyProjectionRuntime;
  runtimeKind?: "browser" | "fallback" | "headless";
  devicePixelRatio?: number;
  families?: readonly DevTypefaceFamily[];
  measurementFamilyResolver?: (fontId: string, familyName: string) => string;
  provenanceResolver?: (fontId: string, familyName: string) => DevTypefaceProvenance | undefined;
} = {}): Promise<TypefaceMeasurementProfile[]> {
  return Promise.all(
    families.map((family) =>
      buildTypefaceDevProfile({
        ...family,
        runtime,
        runtimeKind,
        devicePixelRatio,
        measurementFamilyResolver,
        provenance: provenanceResolver?.(family.fontId, family.familyName),
      })
    )
  );
}

export const getDevTypefaceRuntime = (runtimeKind: "browser" | "fallback" | "headless"): TypographyProjectionRuntime => {
  switch (runtimeKind) {
    case "browser":
      return browserTypographyRuntime;
    case "headless":
      return headlessTypographyRuntime;
    case "fallback":
    default:
      return fallbackTypographyRuntime;
  }
};
