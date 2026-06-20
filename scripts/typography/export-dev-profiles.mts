import fs from "node:fs/promises";
import path from "node:path";
import {
  DEV_TYPEFACE_FAMILIES,
  buildAllTypefaceDevProfiles,
  getDevTypefaceRuntime,
  type DevTypefaceFamily,
} from "@/lib/dev/typography/typeface-profile-dev-builder";
import {
  createHeadlessTypographyRuntime,
  parseHeadlessFontMetricsFile,
  type HeadlessFontMetricsOverride,
} from "@/lib/dev/typography/headless-runtime";
import type { TypefaceMeasurementProfile } from "@/lib/typography/measurement-profile-contracts";

type CliOptions = {
  outDir: string;
  combinedFile?: string;
  versionTag: string;
  families: DevTypefaceFamily[];
  familiesFile?: string;
  runtimeKind: "fallback" | "headless";
  metricsFile?: string;
  metricsOverrides: HeadlessFontMetricsOverride[];
};

const cwd = process.cwd();

const printUsage = () => {
  console.log(`Usage:
  npm run profiles:export:dev -- [--out-dir data/typography-profiles/corpus/dev-v1] [--combined-file data/typography-profiles/dev-profiles.json] [--version dev-v1] [--runtime fallback|headless] [--metrics-file data/typography-profiles/metrics.headless.json] [--families-file data/typography-profiles/families.dev.json] [--family font-id=Family Name]...

Examples:
  npm run profiles:export:dev
  npm run profiles:export:dev -- --version dev-v2
  npm run profiles:export:dev -- --families-file data/typography-profiles/families.dev.json
  npm run profiles:export:dev -- --family inter=Inter --family helvetica-neue="Helvetica Neue"
`);
};

const slugifyVersion = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "dev-fallback";

const parseFamily = (value: string): DevTypefaceFamily => {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new Error(`Invalid --family value "${value}". Expected font-id=Family Name.`);
  }

  return {
    fontId: value.slice(0, separatorIndex).trim(),
    familyName: value.slice(separatorIndex + 1).trim(),
  };
};

const parseFamiliesFile = async (filePath: string): Promise<DevTypefaceFamily[]> => {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid families file "${filePath}". Expected a JSON array.`);
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid families file "${filePath}" at index ${index}. Expected an object.`);
    }

    const fontId = "fontId" in entry && typeof entry.fontId === "string" ? entry.fontId.trim() : "";
    const familyName = "familyName" in entry && typeof entry.familyName === "string" ? entry.familyName.trim() : "";

    if (!fontId || !familyName) {
      throw new Error(`Invalid families file "${filePath}" at index ${index}. Expected { fontId, familyName }.`);
    }

    return { fontId, familyName };
  });
};

const parseArgs = async (argv: string[]): Promise<CliOptions> => {
  const familyArgs: DevTypefaceFamily[] = [];
  let outDirArg: string | undefined;
  let combinedFileArg: string | undefined;
  let versionArg = "dev-fallback";
  let familiesFileArg: string | undefined;
  let runtimeKind: "fallback" | "headless" = "fallback";
  let metricsFileArg: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--out-dir") {
      outDirArg = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--combined-file") {
      combinedFileArg = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--version") {
      versionArg = argv[index + 1] ?? versionArg;
      index += 1;
      continue;
    }

    if (arg === "--families-file") {
      familiesFileArg = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--metrics-file") {
      metricsFileArg = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--runtime") {
      const value = argv[index + 1];
      if (value === "fallback" || value === "headless") {
        runtimeKind = value;
        index += 1;
        continue;
      }
      throw new Error(`Invalid --runtime value "${value}". Expected "fallback" or "headless".`);
    }

    if (arg === "--family") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value after --family.");
      }
      familyArgs.push(parseFamily(value));
      index += 1;
      continue;
    }

    if (arg.startsWith("--family=")) {
      familyArgs.push(parseFamily(arg.slice("--family=".length)));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const versionTag = slugifyVersion(versionArg);
  const outDir = path.resolve(cwd, outDirArg ?? `data/typography-profiles/corpus/${versionTag}`);
  const combinedFile = combinedFileArg ? path.resolve(cwd, combinedFileArg) : undefined;
  const familiesFile = familiesFileArg ? path.resolve(cwd, familiesFileArg) : undefined;
  const fileFamilies = familiesFile ? await parseFamiliesFile(familiesFile) : [];
  const metricsFile = metricsFileArg ? path.resolve(cwd, metricsFileArg) : undefined;
  const metricsOverrides = metricsFile
    ? parseHeadlessFontMetricsFile(JSON.parse(await fs.readFile(metricsFile, "utf8")))
    : [];

  if (metricsOverrides.length && runtimeKind !== "headless") {
    throw new Error("--metrics-file requires --runtime headless.");
  }

  return {
    outDir,
    combinedFile,
    versionTag,
    familiesFile,
    runtimeKind,
    metricsFile,
    metricsOverrides,
    families: familyArgs.length ? familyArgs : fileFamilies.length ? fileFamilies : [...DEV_TYPEFACE_FAMILIES],
  };
};

async function writeJson(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function updateCorpusIndex({
  corpusRoot,
  manifest,
}: {
  corpusRoot: string;
  manifest: {
    generatedAt: string;
    runtime: string;
    version: string;
    profileCount: number;
    fontIds: string[];
    files: Array<{ fontId: string; familyName: string; file: string }>;
  };
}) {
  const indexPath = path.join(corpusRoot, "index.json");
  const dirEntries = await fs.readdir(corpusRoot, { withFileTypes: true }).catch(() => []);
  const versions = [];

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(corpusRoot, entry.name, "manifest.json");
    try {
      const raw = await fs.readFile(manifestPath, "utf8");
      const parsed = JSON.parse(raw) as {
        generatedAt: string;
        runtime: string;
        version: string;
        profileCount: number;
        fontIds: string[];
      };

      versions.push({
        version: parsed.version,
        generatedAt: parsed.generatedAt,
        runtime: parsed.runtime,
        profileCount: parsed.profileCount,
        fontIds: parsed.fontIds,
        manifest: `${entry.name}/manifest.json`,
      });
    } catch {
      continue;
    }
  }

  versions.sort((left, right) => left.version.localeCompare(right.version));

  await writeJson(indexPath, {
    updatedAt: manifest.generatedAt,
    versions,
  });
}

async function main() {
  const options = await parseArgs(process.argv.slice(2));
  const runtime =
    options.runtimeKind === "headless" && options.metricsOverrides.length
      ? createHeadlessTypographyRuntime(options.metricsOverrides)
      : getDevTypefaceRuntime(options.runtimeKind);
  const overrideByFontId = new Map(options.metricsOverrides.map((override) => [override.fontId, override]));
  const profiles = await buildAllTypefaceDevProfiles({
    runtime,
    runtimeKind: options.runtimeKind,
    devicePixelRatio: 1,
    families: options.families,
    provenanceResolver: (fontId, familyName): TypefaceMeasurementProfile["provenance"] | undefined => {
      if (options.runtimeKind === "fallback") {
        return {
          kind: "preset-derived",
          runtime: "fallback",
          note: "Derived from built-in fallback presets without external font files.",
        };
      }

      const override = overrideByFontId.get(fontId);
      if (!override) {
        return {
          kind: "preset-derived",
          runtime: "headless",
          metricsFile: options.metricsFile ? path.relative(cwd, options.metricsFile) : undefined,
          note: "Headless runtime used its built-in preset because no external override existed for this font.",
        };
      }

      if (override.sampleCounts && (override.sampleCounts.glyphsExtracted > 0 || override.sampleCounts.wordsExtracted > 0)) {
        return {
          kind: "sample-derived",
          runtime: "headless",
          metricsFile: options.metricsFile ? path.relative(cwd, options.metricsFile) : undefined,
          sourceFile: override.sourceFile,
          sampleCoverage: override.sampleCounts,
          note: "Headless runtime used external font-derived global metrics plus sample-level glyph and word boxes.",
        };
      }

      if (override.sourceFile) {
        return {
          kind: "real-file-derived",
          runtime: "headless",
          metricsFile: options.metricsFile ? path.relative(cwd, options.metricsFile) : undefined,
          sourceFile: override.sourceFile,
          sampleCoverage: override.sampleCounts,
          note: "Headless runtime used external font-derived global metrics from a real font file.",
        };
      }

      return {
        kind: "preset-derived",
        runtime: "headless",
        metricsFile: options.metricsFile ? path.relative(cwd, options.metricsFile) : undefined,
        note: `Headless runtime used an injected preset override for ${familyName} without file-derived metadata.`,
      };
    },
  });

  const generatedAt = new Date().toISOString();
  const manifest = {
    generatedAt,
    runtime: options.runtimeKind,
    version: options.versionTag,
    profileCount: profiles.length,
    fontIds: profiles.map((profile) => profile.fontId),
    files: profiles.map((profile) => ({
      fontId: profile.fontId,
      familyName: profile.familyName,
      file: `${profile.fontId}.measurement-profile.json`,
    })),
  };

  await fs.mkdir(options.outDir, { recursive: true });

  await Promise.all(
    profiles.map((profile) =>
      writeJson(path.join(options.outDir, `${profile.fontId}.measurement-profile.json`), profile)
    )
  );

  await writeJson(path.join(options.outDir, "manifest.json"), manifest);
  await updateCorpusIndex({
    corpusRoot: path.dirname(options.outDir),
    manifest,
  });

  if (options.combinedFile) {
    await writeJson(options.combinedFile, {
      generatedAt,
      runtime: options.runtimeKind,
      version: options.versionTag,
      profileCount: profiles.length,
      fontIds: profiles.map((profile) => profile.fontId),
      profiles,
    });
  }

  console.log(
    JSON.stringify(
      {
        outDir: options.outDir,
        combinedFile: options.combinedFile ?? null,
        familiesFile: options.familiesFile ?? null,
        metricsFile: options.metricsFile ?? null,
        metricsOverrideCount: options.metricsOverrides.length,
        runtime: options.runtimeKind,
        version: options.versionTag,
        profileCount: profiles.length,
        fontIds: profiles.map((profile) => profile.fontId),
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
