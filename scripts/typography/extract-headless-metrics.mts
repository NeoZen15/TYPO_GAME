import fs from "node:fs/promises";
import path from "node:path";
import { openSync, type Font, type FontCollection } from "fontkit";
import { GLYPH_AUDIT_EXPECTATIONS } from "@/lib/dev/typography/glyph-audit-spec";
import { WORD_AUDIT_EXPECTATIONS } from "@/lib/dev/typography/word-audit-spec";
import type { HeadlessSampleMetricsRatio } from "@/lib/dev/typography/headless-runtime";

type CliOptions = {
  fontsDir: string;
  outFile: string;
  familiesFile: string;
};

const cwd = process.cwd();

const printUsage = () => {
  console.log(`Usage:
  npm run profiles:metrics:extract -- [--fonts-dir public/fonts] [--families-file data/typography-profiles/families.dev.json] [--out-file data/typography-profiles/metrics.headless.real.json]

Reads each font listed in the families file, attempts to locate its primary file under <fonts-dir>/<fontId>/, and produces a metrics override file consumable by export-dev-profiles via --metrics-file.

Fonts without a discoverable file are skipped (they fall back to their built-in preset at export time).
`);
};

const parseArgs = (argv: string[]): CliOptions => {
  let fontsDir = path.resolve(cwd, "public/fonts");
  let outFile = path.resolve(cwd, "data/typography-profiles/metrics.headless.real.json");
  let familiesFile = path.resolve(cwd, "data/typography-profiles/families.dev.json");

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--fonts-dir") {
      fontsDir = path.resolve(cwd, argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--out-file") {
      outFile = path.resolve(cwd, argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--families-file") {
      familiesFile = path.resolve(cwd, argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { fontsDir, outFile, familiesFile };
};

const readFamilies = async (filePath: string): Promise<{ fontId: string; familyName: string }[]> => {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Families file ${filePath} must contain a JSON array.`);
  }
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Families file entry at index ${index} must be an object.`);
    }
    const fontId = String((entry as { fontId?: unknown }).fontId ?? "").trim();
    const familyName = String((entry as { familyName?: unknown }).familyName ?? "").trim();
    if (!fontId || !familyName) {
      throw new Error(`Families file entry at index ${index} is missing fontId or familyName.`);
    }
    return { fontId, familyName };
  });
};

const FONT_EXTENSIONS = new Set([".ttf", ".otf", ".woff", ".woff2"]);

const AUDIT_GLYPHS_FOR_PICKER = [...new Set(GLYPH_AUDIT_EXPECTATIONS.map((entry) => entry.glyph))];

const countGlyphCoverage = (font: Font): number => {
  let count = 0;
  for (const glyph of AUDIT_GLYPHS_FOR_PICKER) {
    const cp = glyph.codePointAt(0);
    if (cp !== undefined && font.hasGlyphForCodePoint(cp)) count += 1;
  }
  return count;
};

const isLikelyRegular = (font: Font): boolean => {
  const subfamily = (font.subfamilyName ?? "").toLowerCase();
  return subfamily === "regular" || subfamily === "roman" || subfamily === "book";
};

const discoverFontFile = async (fontsDir: string, fontId: string): Promise<string | null> => {
  const dir = path.join(fontsDir, fontId);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }

  const candidatePaths = entries
    .filter((name) => FONT_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(dir, name));

  if (!candidatePaths.length) return null;

  // Score every candidate by audit-corpus coverage, preferring Regular weight.
  // Splits like Google Fonts unicode-range subsets ship many files; we want the
  // one that covers the most of our audit glyphs.
  let best: { filePath: string; coverage: number; regular: boolean } | null = null;
  for (const candidate of candidatePaths) {
    const font = await safeOpen(candidate);
    if (!font) continue;
    const coverage = countGlyphCoverage(font);
    const regular = isLikelyRegular(font);
    if (
      !best ||
      coverage > best.coverage ||
      (coverage === best.coverage && regular && !best.regular)
    ) {
      best = { filePath: candidate, coverage, regular };
    }
  }

  return best?.filePath ?? candidatePaths[0];
};

const isFontCollection = (value: Font | FontCollection): value is FontCollection =>
  (value as FontCollection).fonts !== undefined;

const safeOpen = async (filePath: string): Promise<Font | null> => {
  try {
    const result = openSync(filePath);
    if (isFontCollection(result)) {
      return result.fonts[0] ?? null;
    }
    return result;
  } catch {
    return null;
  }
};

const ROUND_CHARS = "acegosqubdop";
const NARROW_CHARS = "fijlrtI1";
const WIDE_CHARS = "mwMWQ@%";
const UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz";

const averageAdvanceRatio = (font: Font, chars: string): number | null => {
  const widths: number[] = [];
  for (const char of chars) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) continue;
    if (!font.hasGlyphForCodePoint(codePoint)) continue;
    const glyph = font.glyphForCodePoint(codePoint);
    const advance = glyph.advanceWidth;
    if (!Number.isFinite(advance) || advance <= 0) continue;
    widths.push(advance / font.unitsPerEm);
  }
  if (!widths.length) return null;
  return widths.reduce((total, value) => total + value, 0) / widths.length;
};

const round = (value: number, digits = 4) => Number(value.toFixed(digits));

const buildSampleRatio = (
  unitsPerEm: number,
  advance: number,
  bbox: { minX: number; maxX: number; minY: number; maxY: number }
): HeadlessSampleMetricsRatio => ({
  advanceWidthRatio: round(advance / unitsPerEm),
  leftRatio: round(Math.max(0, -bbox.minX) / unitsPerEm),
  rightRatio: round(Math.max(0, bbox.maxX) / unitsPerEm),
  ascentRatio: round(Math.max(0, bbox.maxY) / unitsPerEm),
  descentRatio: round(Math.max(0, -bbox.minY) / unitsPerEm),
});

const extractGlyphSample = (font: Font, glyph: string): HeadlessSampleMetricsRatio | null => {
  const codePoint = glyph.codePointAt(0);
  if (codePoint === undefined) return null;
  if (!font.hasGlyphForCodePoint(codePoint)) return null;
  const g = font.glyphForCodePoint(codePoint);
  return buildSampleRatio(font.unitsPerEm || 1000, g.advanceWidth, g.bbox);
};

const extractWordSample = (font: Font, word: string): HeadlessSampleMetricsRatio | null => {
  if (!word) return null;
  try {
    const run = font.layout(word);
    if (!run.glyphs.length) return null;
    return buildSampleRatio(font.unitsPerEm || 1000, run.advanceWidth, run.bbox);
  } catch {
    return null;
  }
};

const extractSamples = (font: Font): {
  glyphs: Record<string, HeadlessSampleMetricsRatio>;
  words: Record<string, HeadlessSampleMetricsRatio>;
  missingGlyphs: string[];
  missingWords: string[];
} => {
  const glyphs: Record<string, HeadlessSampleMetricsRatio> = {};
  const words: Record<string, HeadlessSampleMetricsRatio> = {};
  const missingGlyphs: string[] = [];
  const missingWords: string[] = [];

  const uniqueGlyphs = [...new Set(GLYPH_AUDIT_EXPECTATIONS.map((entry) => entry.glyph))];
  for (const glyph of uniqueGlyphs) {
    const sample = extractGlyphSample(font, glyph);
    if (sample) glyphs[glyph] = sample;
    else missingGlyphs.push(glyph);
  }

  const uniqueWords = [...new Set(WORD_AUDIT_EXPECTATIONS.map((entry) => entry.word))];
  for (const word of uniqueWords) {
    const sample = extractWordSample(font, word);
    if (sample) words[word] = sample;
    else missingWords.push(word);
  }

  return { glyphs, words, missingGlyphs, missingWords };
};

const buildPresetFromFont = (font: Font) => {
  const unitsPerEm = font.unitsPerEm || 1000;
  const capHeight = font.capHeight || 0;
  const xHeight = font.xHeight || 0;
  const ascent = font["OS/2"]?.typoAscender ?? font.ascent ?? 0;
  const descent = Math.abs(font["OS/2"]?.typoDescender ?? font.descent ?? 0);

  const defaultWidth = averageAdvanceRatio(font, LOWERCASE_CHARS) ?? 0.44;
  const uppercaseWidth = averageAdvanceRatio(font, UPPERCASE_CHARS) ?? 0.58;
  const roundWidth = averageAdvanceRatio(font, ROUND_CHARS) ?? defaultWidth;
  const narrowWidth = averageAdvanceRatio(font, NARROW_CHARS) ?? defaultWidth * 0.6;
  const wideWidth = averageAdvanceRatio(font, WIDE_CHARS) ?? defaultWidth * 1.6;

  return {
    capRatio: round(capHeight / unitsPerEm),
    xRatio: round(xHeight / unitsPerEm),
    ascenderRatio: round(ascent / unitsPerEm),
    descenderRatio: round(descent / unitsPerEm),
    defaultWidthFactor: round(defaultWidth),
    uppercaseWidthFactor: round(uppercaseWidth),
    roundWidthFactor: round(roundWidth),
    narrowWidthFactor: round(narrowWidth),
    wideWidthFactor: round(wideWidth),
  };
};

async function writeJson(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const families = await readFamilies(options.familiesFile);

  const overrides: Array<{
    fontId: string;
    familyName: string;
    sourceFile: string;
    fontType: string;
    preset: ReturnType<typeof buildPresetFromFont>;
    samples: {
      glyphs: Record<string, HeadlessSampleMetricsRatio>;
      words: Record<string, HeadlessSampleMetricsRatio>;
    };
    sampleCounts: {
      glyphsExtracted: number;
      wordsExtracted: number;
      missingGlyphs: string[];
      missingWords: string[];
    };
  }> = [];
  const skipped: Array<{ fontId: string; familyName: string; reason: string }> = [];

  for (const { fontId, familyName } of families) {
    const fontFile = await discoverFontFile(options.fontsDir, fontId);
    if (!fontFile) {
      skipped.push({ fontId, familyName, reason: "no font file found in fonts-dir" });
      continue;
    }
    const font = await safeOpen(fontFile);
    if (!font) {
      skipped.push({ fontId, familyName, reason: `failed to open ${path.relative(cwd, fontFile)}` });
      continue;
    }
    const samples = extractSamples(font);
    overrides.push({
      fontId,
      familyName,
      sourceFile: path.relative(cwd, fontFile),
      fontType: font.type,
      preset: buildPresetFromFont(font),
      samples: { glyphs: samples.glyphs, words: samples.words },
      sampleCounts: {
        glyphsExtracted: Object.keys(samples.glyphs).length,
        wordsExtracted: Object.keys(samples.words).length,
        missingGlyphs: samples.missingGlyphs,
        missingWords: samples.missingWords,
      },
    });
  }

  await writeJson(options.outFile, {
    generatedAt: new Date().toISOString(),
    source: `Extracted from font files in ${path.relative(cwd, options.fontsDir)} via fontkit.`,
    fontsDir: path.relative(cwd, options.fontsDir),
    familiesFile: path.relative(cwd, options.familiesFile),
    overrideCount: overrides.length,
    skipped,
    overrides: overrides.map(({ sourceFile, fontType, sampleCounts, ...override }) => ({
      ...override,
      meta: { sourceFile, fontType, sampleCounts },
    })),
  });

  console.log(
    JSON.stringify(
      {
        outFile: path.relative(cwd, options.outFile),
        overrideCount: overrides.length,
        skippedCount: skipped.length,
        overrides: overrides.map(({ fontId, sourceFile, fontType, sampleCounts }) => ({
          fontId,
          sourceFile,
          fontType,
          glyphsExtracted: sampleCounts.glyphsExtracted,
          wordsExtracted: sampleCounts.wordsExtracted,
          missingGlyphs: sampleCounts.missingGlyphs,
          missingWords: sampleCounts.missingWords,
        })),
        skipped,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
