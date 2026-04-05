import manifest from "@/content/typefaces/font-manifest-v4.json";
import specimenData from "@/content/typography/generated/font-specimen-data.json";

type ManifestFont = (typeof manifest.fonts)[number];
type SpecimenRecord = (typeof specimenData.records)[number];
type SpecimenStyle = SpecimenRecord["styles"][number];

const manifestBySlug = new Map<string, ManifestFont>(manifest.fonts.map((font) => [font.slug, font]));
const specimenBySlug = new Map<string, SpecimenRecord>(
  specimenData.records.map((record) => [record.slug, record])
);

const toPrintableChar = (codepoint: number) => {
  if (!Number.isInteger(codepoint) || codepoint < 33 || codepoint === 127) {
    return null;
  }

  try {
    const char = String.fromCodePoint(codepoint);
    return /\s/u.test(char) ? null : char;
  } catch {
    return null;
  }
};

const collectCodepoints = (styles: SpecimenStyle[]) => {
  const seen = new Set<number>();

  styles.forEach((style) => {
    style.sampleCodepoints.forEach((codepoint) => {
      if (Number.isInteger(codepoint)) {
        seen.add(codepoint);
      }
    });
  });

  return [...seen].sort((left, right) => left - right);
};

const fallbackGlyphGroups = [
  { id: "uppercase", label: "Uppercase", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") },
  { id: "lowercase", label: "Lowercase", chars: "abcdefghijklmnopqrstuvwxyz".split("") },
  { id: "numerals", label: "Numerals", chars: "0123456789".split("") },
  { id: "punctuation", label: "Punctuation", chars: [".", ",", ":", ";", "!", "?", "&", "@", "#", "%", "+", "="] },
] as const;

export const getManifestTypefaceBySlug = (slug: string) => manifestBySlug.get(slug) ?? null;

export const getSpecimenRecordBySlug = (slug: string) => specimenBySlug.get(slug) ?? null;

export const getSpecimenPreviewFamily = (slug: string) => {
  const record = getSpecimenRecordBySlug(slug);
  if (!record?.runtimePath) return null;
  return `JDTSPEC__${slug}`;
};

export const getSpecimenFontFaceCss = (slug: string) => {
  const record = getSpecimenRecordBySlug(slug);
  if (!record || record.styles.length === 0 || record.assetStatus !== "mapped") {
    return "";
  }

  return record.styles
    .filter((style) => {
      try {
        return style.file.includes("/public/");
      } catch {
        return false;
      }
    })
    .map((style) => {
      const runtimePath = style.file.split("/public")[1];
      const familyName = `JDTSPEC__${slug}`;

      if (style.isVariable) {
        return [
          "@font-face {",
          `  font-family: "${familyName}";`,
          `  src: url("${runtimePath}") format("woff2");`,
          `  font-weight: 100 900;`,
          `  font-style: ${style.italic ? "italic" : "normal"};`,
          "  font-display: swap;",
          "}",
        ].join("\n");
      }

      return [
        "@font-face {",
        `  font-family: "${familyName}";`,
        `  src: url("${runtimePath}") format("woff2");`,
        `  font-weight: ${style.weight ?? 400};`,
        `  font-style: ${style.italic ? "italic" : "normal"};`,
        "  font-display: swap;",
        "}",
      ].join("\n");
    })
    .join("\n\n");
};

export const getSpecimenGlyphGroups = (slug: string) => {
  const record = getSpecimenRecordBySlug(slug);
  const printableChars = record
    ? collectCodepoints(record.styles)
        .map(toPrintableChar)
        .filter((char): char is string => Boolean(char))
    : [];

  const uniqueChars = [...new Set(printableChars)];
  const groups = [
    { id: "uppercase", label: "Uppercase", chars: uniqueChars.filter((char) => /^[A-Z]$/.test(char)).slice(0, 26) },
    { id: "lowercase", label: "Lowercase", chars: uniqueChars.filter((char) => /^[a-z]$/.test(char)).slice(0, 26) },
    { id: "numerals", label: "Numerals", chars: uniqueChars.filter((char) => /^[0-9]$/.test(char)).slice(0, 10) },
    {
      id: "punctuation",
      label: "Punctuation",
      chars: uniqueChars.filter((char) => /^[!-/:-@[-`{-~]$/u.test(char)).slice(0, 18),
    },
  ].filter((group) => group.chars.length > 0);

  return groups.length > 0 ? groups : fallbackGlyphGroups.map((group) => ({ ...group, chars: [...group.chars] }));
};
