import runtimeCatalog from "@/content/catalog/font-runtime-assets.json";
import { type CompetitionFontFace } from "@/lib/game/competition/contracts";
import { TRAINING_WORD_POOL } from "@/lib/game/training/catalog";

const LOCAL_FONT_FAMILIES: Record<string, string> = {
  arial: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  courier_new: '"Courier New", Courier, monospace',
  georgia: 'Georgia, "Times New Roman", serif',
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  times_new_roman: '"Times New Roman", Times, serif',
};

type RuntimeRecord = (typeof runtimeCatalog.records)[number];

const runtimeBySlug = new Map<string, RuntimeRecord>(
  runtimeCatalog.records
    .filter(
      (record) =>
        record.runtime_status === "ready" &&
        record.file_role === "primary" &&
        record.font_format === "woff2" &&
        typeof record.runtime_path === "string"
    )
    .map((record) => [record.typeface_slug, record])
);

export const COMPETITION_TOTAL_DURATION_MS = 2 * 60 * 1000;
// Competition should feel almost immediate; keep only a tiny handoff before the next word.
export const COMPETITION_FEEDBACK_DELAY_MS = 80;
export const COMPETITION_FEEDBACK_PERSIST_MS = 900;
export const COMPETITION_FAST_BONUS_THRESHOLD_MS = 2_000;
export const COMPETITION_ENGINE_VERSION = "competition-provider-v1";

export const getCompetitionDisplayWord = (seed: string | number, questionIndex: number) => {
  const seedNumber = Number.parseInt(String(seed).slice(-6), 10) || 0;
  const wordIndex = (questionIndex + seedNumber) % TRAINING_WORD_POOL.length;
  return TRAINING_WORD_POOL[wordIndex] ?? TRAINING_WORD_POOL[0];
};

export const getCompetitionFontFamily = (slug: string, displayName: string) => {
  if (runtimeBySlug.has(slug)) {
    return `"JDT__${slug}"`;
  }

  return LOCAL_FONT_FAMILIES[slug] ?? `"${displayName}", serif`;
};

// Descriptor for a single runtime face, used to inject its @font-face on demand
// (client-side, just before the face is shown) instead of shipping all faces.
export const getCompetitionFontFace = (slug: string): CompetitionFontFace | null => {
  const record = runtimeBySlug.get(slug);
  if (!record) {
    return null;
  }

  return {
    family: `JDT__${record.typeface_slug}`,
    src: String(record.runtime_path),
    weight: record.weight ?? 400,
    style: record.style ?? "normal",
  };
};

const buildFontFaceRule = (record: RuntimeRecord) =>
  [
    "@font-face {",
    `  font-family: "JDT__${record.typeface_slug}";`,
    `  src: url("${record.runtime_path}") format("woff2");`,
    `  font-weight: ${record.weight ?? 400};`,
    `  font-style: ${record.style ?? "normal"};`,
    "  font-display: swap;",
    "}",
  ].join("\n");

// Emits @font-face rules for the given slugs, or for every runtime face when no
// slugs are passed (backward-compatible default). The competition page no longer
// ships the full set; faces are injected on demand from the per-question descriptor.
export const getCompetitionFontFaceCss = (slugs?: readonly string[]) => {
  const records = slugs
    ? slugs
        .map((slug) => runtimeBySlug.get(slug))
        .filter((record): record is RuntimeRecord => record !== undefined)
    : [...runtimeBySlug.values()];

  return records.map(buildFontFaceRule).join("\n");
};
