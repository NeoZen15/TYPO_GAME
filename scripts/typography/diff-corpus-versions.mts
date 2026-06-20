import fs from "node:fs/promises";
import path from "node:path";

type CorpusManifest = {
  generatedAt: string;
  runtime: string;
  version: string;
  profileCount: number;
  fontIds: string[];
  files: Array<{
    fontId: string;
    familyName: string;
    file: string;
  }>;
};

type TypefaceProfile = {
  fontId: string;
  familyName: string;
  confidence: string;
  provenance?: {
    kind: string;
    runtime: string;
    sourceFile?: string;
    metricsFile?: string;
  };
  metrics: Record<string, { value: number; confidence: string; status: string } | undefined>;
  audit: {
    status: string;
    confidence: string;
    score: number;
    issueCounts: Record<string, number>;
    issues: Array<{ id: string; severity: string; message: string }>;
  };
  ambiguityFlags: string[];
};

type CliOptions = {
  leftVersion: string;
  rightVersion: string;
  corpusRoot: string;
  outFile?: string;
  markdownFile?: string;
};

const cwd = process.cwd();

const printUsage = () => {
  console.log(`Usage:
  node --experimental-strip-types --loader ./scripts/typography/alias-loader.mjs ./scripts/typography/diff-corpus-versions.mts --left dev-v1 --right dev-v2 [--corpus-root data/typography-profiles/corpus] [--out-file data/typography-profiles/diffs/dev-v1-vs-dev-v2.json] [--markdown-file data/typography-profiles/diffs/dev-v1-vs-dev-v2.md]
`);
};

const parseArgs = (argv: string[]): CliOptions => {
  let leftVersion = "";
  let rightVersion = "";
  let corpusRoot = path.resolve(cwd, "data/typography-profiles/corpus");
  let outFile: string | undefined;
  let markdownFile: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--left") {
      leftVersion = argv[index + 1] ?? leftVersion;
      index += 1;
      continue;
    }

    if (arg === "--right") {
      rightVersion = argv[index + 1] ?? rightVersion;
      index += 1;
      continue;
    }

    if (arg === "--corpus-root") {
      corpusRoot = path.resolve(cwd, argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--out-file") {
      outFile = path.resolve(cwd, argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--markdown-file") {
      markdownFile = path.resolve(cwd, argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!leftVersion || !rightVersion) {
    throw new Error("Both --left and --right are required.");
  }

  return {
    leftVersion,
    rightVersion,
    corpusRoot,
    outFile,
    markdownFile,
  };
};

const readJson = async <T,>(filePath: string): Promise<T> => JSON.parse(await fs.readFile(filePath, "utf8")) as T;

const buildProfileMap = async (corpusRoot: string, version: string) => {
  const manifestPath = path.join(corpusRoot, version, "manifest.json");
  const manifest = await readJson<CorpusManifest>(manifestPath);
  const profiles = await Promise.all(
    manifest.files.map(async (entry) => {
      const profile = await readJson<TypefaceProfile>(path.join(corpusRoot, version, entry.file));
      return [entry.fontId, profile] as const;
    })
  );

  return {
    manifest,
    profiles: Object.fromEntries(profiles) as Record<string, TypefaceProfile>,
  };
};

const metricDelta = (left?: { value: number }, right?: { value: number }) => {
  if (!left || !right) return null;
  return Number((right.value - left.value).toFixed(4));
};

const buildIssueMap = (issues: TypefaceProfile["audit"]["issues"]) => new Map(issues.map((issue) => [issue.id, issue]));

async function writeJson(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function writeText(filePath: string, payload: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, payload, "utf8");
}

const formatMetricDelta = (value: number | null) => {
  if (value === null) return "n/a";
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `${value}`;
};

const buildMarkdownReport = (diff: {
  generatedAt: string;
  left: { version: string; generatedAt: string; runtime: string };
  right: { version: string; generatedAt: string; runtime: string };
  fontCount: number;
    fonts: Array<{
      fontId: string;
      familyName: string;
      provenance: {
        leftKind: string | null;
        rightKind: string | null;
        changed: boolean;
      };
      confidence: { left: string | null; right: string | null; changed: boolean };
      audit: {
      leftStatus: string | null;
      rightStatus: string | null;
      scoreDelta: number | null;
      confidenceChanged: boolean;
      issueCountDelta: number | null;
    };
    metrics: Record<string, number | null>;
    ambiguityFlags: { added: string[]; removed: string[] };
    issues: {
      added: Array<{ id: string; severity: string; message: string } | undefined>;
      removed: Array<{ id: string; severity: string; message: string } | undefined>;
      changed: Array<{
        id: string;
        left: { id: string; severity: string; message: string } | undefined;
        right: { id: string; severity: string; message: string } | undefined;
      }>;
    };
  }>;
}) => {
  const changedFonts = diff.fonts.filter(
    (entry) =>
      entry.audit.scoreDelta !== 0 ||
      entry.provenance.changed ||
      entry.confidence.changed ||
      Object.values(entry.metrics).some((value) => value !== 0 && value !== null) ||
      entry.issues.added.length ||
      entry.issues.removed.length ||
      entry.issues.changed.length ||
      entry.ambiguityFlags.added.length ||
      entry.ambiguityFlags.removed.length
  );

  const lines: string[] = [];
  lines.push(`# Typography Corpus Diff`);
  lines.push("");
  lines.push(`- Generated at: ${diff.generatedAt}`);
  lines.push(`- Left: \`${diff.left.version}\` (${diff.left.runtime}, ${diff.left.generatedAt})`);
  lines.push(`- Right: \`${diff.right.version}\` (${diff.right.runtime}, ${diff.right.generatedAt})`);
  lines.push(`- Fonts compared: ${diff.fontCount}`);
  lines.push(`- Changed fonts: ${changedFonts.length}`);
  lines.push("");

  if (!changedFonts.length) {
    lines.push(`No profile changes detected between \`${diff.left.version}\` and \`${diff.right.version}\`.`);
    lines.push("");
    return `${lines.join("\n")}\n`;
  }

  for (const font of changedFonts) {
    lines.push(`## ${font.familyName} (\`${font.fontId}\`)`);
    lines.push("");
    lines.push(`- Provenance: ${font.provenance.leftKind ?? "n/a"} -> ${font.provenance.rightKind ?? "n/a"}`);
    lines.push(`- Confidence: ${font.confidence.left ?? "n/a"} -> ${font.confidence.right ?? "n/a"}`);
    lines.push(`- Audit status: ${font.audit.leftStatus ?? "n/a"} -> ${font.audit.rightStatus ?? "n/a"}`);
    lines.push(`- Audit score delta: ${font.audit.scoreDelta ?? "n/a"}`);
    lines.push(`- Audit issue count delta: ${font.audit.issueCountDelta ?? "n/a"}`);
    lines.push("");
    lines.push(`### Metric Deltas`);
    lines.push("");
    for (const [metricKey, value] of Object.entries(font.metrics)) {
      lines.push(`- ${metricKey}: ${formatMetricDelta(value)}`);
    }
    lines.push("");

    if (font.ambiguityFlags.added.length || font.ambiguityFlags.removed.length) {
      lines.push(`### Ambiguity Flags`);
      lines.push("");
      if (font.ambiguityFlags.added.length) {
        lines.push(`- Added: ${font.ambiguityFlags.added.join(", ")}`);
      }
      if (font.ambiguityFlags.removed.length) {
        lines.push(`- Removed: ${font.ambiguityFlags.removed.join(", ")}`);
      }
      lines.push("");
    }

    if (font.issues.added.length || font.issues.removed.length || font.issues.changed.length) {
      lines.push(`### Issues`);
      lines.push("");
      for (const issue of font.issues.added) {
        if (!issue) continue;
        lines.push(`- Added \`${issue.id}\` [${issue.severity}]: ${issue.message}`);
      }
      for (const issue of font.issues.removed) {
        if (!issue) continue;
        lines.push(`- Removed \`${issue.id}\` [${issue.severity}]: ${issue.message}`);
      }
      for (const issue of font.issues.changed) {
        lines.push(`- Changed \`${issue.id}\``);
        lines.push(`  left: ${issue.left?.severity ?? "n/a"} · ${issue.left?.message ?? "n/a"}`);
        lines.push(`  right: ${issue.right?.severity ?? "n/a"} · ${issue.right?.message ?? "n/a"}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const left = await buildProfileMap(options.corpusRoot, options.leftVersion);
  const right = await buildProfileMap(options.corpusRoot, options.rightVersion);
  const fontIds = [...new Set([...Object.keys(left.profiles), ...Object.keys(right.profiles)])].sort();

  const diff = {
    generatedAt: new Date().toISOString(),
    left: {
      version: left.manifest.version,
      generatedAt: left.manifest.generatedAt,
      runtime: left.manifest.runtime,
    },
    right: {
      version: right.manifest.version,
      generatedAt: right.manifest.generatedAt,
      runtime: right.manifest.runtime,
    },
    fontCount: fontIds.length,
    fonts: fontIds.map((fontId) => {
      const leftProfile = left.profiles[fontId];
      const rightProfile = right.profiles[fontId];
      const leftIssues = buildIssueMap(leftProfile?.audit.issues ?? []);
      const rightIssues = buildIssueMap(rightProfile?.audit.issues ?? []);
      const issueIds = [...new Set([...leftIssues.keys(), ...rightIssues.keys()])].sort();

      return {
        fontId,
        familyName: rightProfile?.familyName ?? leftProfile?.familyName ?? fontId,
        provenance: {
          leftKind: leftProfile?.provenance?.kind ?? null,
          rightKind: rightProfile?.provenance?.kind ?? null,
          changed: (leftProfile?.provenance?.kind ?? null) !== (rightProfile?.provenance?.kind ?? null),
        },
        confidence: {
          left: leftProfile?.confidence ?? null,
          right: rightProfile?.confidence ?? null,
          changed: leftProfile?.confidence !== rightProfile?.confidence,
        },
        audit: {
          leftStatus: leftProfile?.audit.status ?? null,
          rightStatus: rightProfile?.audit.status ?? null,
          scoreDelta:
            leftProfile && rightProfile ? rightProfile.audit.score - leftProfile.audit.score : null,
          confidenceChanged: (leftProfile?.audit.confidence ?? null) !== (rightProfile?.audit.confidence ?? null),
          issueCountDelta:
            leftProfile && rightProfile
              ? (rightProfile.audit.issues?.length ?? 0) - (leftProfile.audit.issues?.length ?? 0)
              : null,
        },
        metrics: {
          baseline: metricDelta(leftProfile?.metrics.baseline, rightProfile?.metrics.baseline),
          xHeight: metricDelta(leftProfile?.metrics.xHeight, rightProfile?.metrics.xHeight),
          capHeight: metricDelta(leftProfile?.metrics.capHeight, rightProfile?.metrics.capHeight),
          ascender: metricDelta(leftProfile?.metrics.ascender, rightProfile?.metrics.ascender),
          descender: metricDelta(leftProfile?.metrics.descender, rightProfile?.metrics.descender),
          advanceWidth: metricDelta(leftProfile?.metrics.advanceWidth, rightProfile?.metrics.advanceWidth),
        },
        ambiguityFlags: {
          added: (rightProfile?.ambiguityFlags ?? []).filter((flag) => !(leftProfile?.ambiguityFlags ?? []).includes(flag)),
          removed: (leftProfile?.ambiguityFlags ?? []).filter((flag) => !(rightProfile?.ambiguityFlags ?? []).includes(flag)),
        },
        issues: {
          added: issueIds.filter((id) => !leftIssues.has(id) && rightIssues.has(id)).map((id) => rightIssues.get(id)),
          removed: issueIds.filter((id) => leftIssues.has(id) && !rightIssues.has(id)).map((id) => leftIssues.get(id)),
          changed: issueIds
            .filter((id) => leftIssues.has(id) && rightIssues.has(id))
            .filter((id) => {
              const leftIssue = leftIssues.get(id);
              const rightIssue = rightIssues.get(id);
              return JSON.stringify(leftIssue) !== JSON.stringify(rightIssue);
            })
            .map((id) => ({
              id,
              left: leftIssues.get(id),
              right: rightIssues.get(id),
            })),
        },
      };
    }),
  };

  if (options.outFile) {
    await writeJson(options.outFile, diff);
  }

  if (options.markdownFile) {
    await writeText(options.markdownFile, buildMarkdownReport(diff));
  }

  console.log(
    JSON.stringify(
      {
        left: diff.left.version,
        right: diff.right.version,
        fontCount: diff.fontCount,
        outFile: options.outFile ?? null,
        markdownFile: options.markdownFile ?? null,
        changedFonts: diff.fonts.filter(
          (entry) =>
            entry.audit.scoreDelta !== 0 ||
            entry.provenance.changed ||
            entry.confidence.changed ||
            Object.values(entry.metrics).some((value) => value !== 0 && value !== null) ||
            entry.issues.added.length ||
            entry.issues.removed.length ||
            entry.issues.changed.length
        ).map((entry) => entry.fontId),
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
