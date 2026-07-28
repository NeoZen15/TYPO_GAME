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

  // The 14 typography compatibility bridges used to be listed here as category B,
  // stabilization work rather than product review. They were deleted once every
  // importer was found to point at the dev lab target directly, so there is no
  // path left to classify.

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
