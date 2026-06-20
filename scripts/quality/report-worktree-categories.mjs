#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const CATEGORY_LABELS = {
  A: "Category A — Active external work",
  B: "Category B — Repository stabilization and guardrails",
  C: "Category C — Runtime/product review",
  U: "Category U — Unclassified, needs manual review",
};

function getChangedFiles() {
  const output = execFileSync("git", ["status", "--short"], { encoding: "utf8" });
  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const match = line.match(/^(..)\s+(.*)$/);
      if (!match) return null;
      return { status: match[1], filePath: match[2] };
    })
    .filter(Boolean);
}

function categorize(filePath) {
  if (filePath.startsWith("features/onboarding/") || filePath.startsWith("app/onboarding/")) return "A";

  if (
    filePath.startsWith("app/dev/") ||
    filePath.startsWith("app/api/dev/") ||
    filePath.startsWith("components/dev/typography/") ||
    filePath.startsWith("lib/dev/") ||
    filePath === "data/" ||
    filePath.startsWith("data/") ||
    filePath.startsWith("data/typography-profiles/") ||
    filePath.startsWith("lib/dev/typography/") ||
    filePath.startsWith("scripts/quality/") ||
    filePath.startsWith("scripts/typography/") ||
    filePath === "README.md" ||
    filePath === "package.json" ||
    filePath === "package-lock.json" ||
    filePath === "backups/README.md" ||
    filePath === "data/typography-profiles/README.md" ||
    filePath === "data/typography-profiles/tmp/.gitignore" ||
    filePath === "docs/overview/repo-organization.md" ||
    filePath === "docs/process/worktree-stabilization.md" ||
    filePath === "lib/dev-mode.ts"
  ) {
    return "B";
  }

  if (
    filePath === "components/typography/AnatomyMetricsValidator.tsx" ||
    filePath === "components/typography/FallbackCalibrationLab.tsx" ||
    filePath === "components/typography/GlyphAuditMatrix.tsx" ||
    filePath === "components/typography/ProjectionCanvas.tsx" ||
    filePath === "components/typography/TypefaceProfileLab.tsx" ||
    filePath === "components/typography/WordAuditMatrix.tsx" ||
    filePath === "lib/typography/fallback-calibration.ts" ||
    filePath === "lib/typography/glyph-audit-spec.ts" ||
    filePath === "lib/typography/glyph-measurement-profile-adapter.ts" ||
    filePath === "lib/typography/headless-runtime.ts" ||
    filePath === "lib/typography/typeface-measurement-profile-builder.ts" ||
    filePath === "lib/typography/typeface-profile-dev-builder.ts" ||
    filePath === "lib/typography/word-audit-spec.ts" ||
    filePath === "lib/typography/word-measurement-profile-adapter.ts"
  ) {
    return "B";
  }

  if (
    filePath.startsWith("app/") ||
    filePath.startsWith("components/") ||
    filePath.startsWith("lib/") ||
    filePath.startsWith("docs/") ||
    filePath.startsWith("public/")
  ) {
    return "C";
  }

  return "U";
}

const categorized = {
  A: [],
  B: [],
  C: [],
  U: [],
};

for (const file of getChangedFiles()) {
  categorized[categorize(file.filePath)].push(file);
}

for (const category of ["A", "B", "C", "U"]) {
  console.log(CATEGORY_LABELS[category]);
  if (categorized[category].length === 0) {
    console.log("- none");
    console.log("");
    continue;
  }

  categorized[category]
    .sort((left, right) => left.filePath.localeCompare(right.filePath))
    .forEach(({ status, filePath }) => console.log(`- [${status}] ${filePath}`));
  console.log("");
}
