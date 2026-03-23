import runtimeCatalog from "@/content/catalog/font-runtime-assets.json";
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

export const getCompetitionFontFaceCss = () => {
  const lines = [...runtimeBySlug.values()].flatMap((record) => [
    "@font-face {",
    `  font-family: "JDT__${record.typeface_slug}";`,
    `  src: url("${record.runtime_path}") format("woff2");`,
    `  font-weight: ${record.weight ?? 400};`,
    `  font-style: ${record.style ?? "normal"};`,
    "  font-display: swap;",
    "}",
  ]);

  return lines.join("\n");
};
