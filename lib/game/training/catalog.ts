import manifest from "@/content/typefaces/font-manifest-v4.json";

export const TRAINING_TOTAL_ROUNDS = 8;
export const TRAINING_CORRECT_DELAY_MS = 2000;
export const TRAINING_ENGINE_VERSION = "training-provider-v1";

export const TRAINING_WORD_POOL = [
  "alphabet",
  "typographie",
  "structure",
  "regular",
  "baseline",
  "contraste",
  "lecture",
  "espace",
  "ligne",
  "courbe",
  "hauteur",
  "epaisseur",
  "glyphes",
  "famille",
  "alignement",
  "rythme",
  "design",
  "caractere",
  "forme",
  "proportion",
] as const;

type ManifestFont = (typeof manifest.fonts)[number];

const LOCAL_FONT_FAMILIES: Record<string, string> = {
  arial: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  courier_new: '"Courier New", Courier, monospace',
  georgia: 'Georgia, "Times New Roman", serif',
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  times_new_roman: '"Times New Roman", Times, serif',
};

const manifestBySlug = new Map<string, ManifestFont>(
  manifest.fonts.map((font) => [font.slug, font])
);

export const getManifestFont = (slug: string) => manifestBySlug.get(slug) ?? null;

export const getTrainingDisplayWord = (seed: string | number, globalQIndex: number) => {
  const seedNumber = Number.parseInt(String(seed).slice(-6), 10) || 0;
  const wordIndex =
    (Math.floor(globalQIndex / 5) + seedNumber) % TRAINING_WORD_POOL.length;
  return TRAINING_WORD_POOL[wordIndex] ?? TRAINING_WORD_POOL[0];
};

export const getTypefaceFontFamily = (slug: string, displayName: string) => {
  const font = getManifestFont(slug);
  if (!font) return `"${displayName}", serif`;

  if (font.runtimePath) {
    return `"JDT__${slug}"`;
  }

  if (font.fontSource === "local") {
    return LOCAL_FONT_FAMILIES[slug] ?? `"${displayName}", serif`;
  }

  return `"${displayName}", serif`;
};

export const getTrainingFontFaceCss = () => {
  const lines = manifest.fonts.flatMap((font) => {
    if (!font.runtimePath) return [];

    return [
      `@font-face {`,
      `  font-family: "JDT__${font.slug}";`,
      `  src: url("${font.runtimePath}") format("woff2");`,
      `  font-weight: 400;`,
      `  font-style: normal;`,
      `  font-display: swap;`,
      `}`,
    ];
  });

  return lines.join("\n");
};
