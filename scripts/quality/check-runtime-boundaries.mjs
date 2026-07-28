#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const EXCLUDED_PATHS = [
  "app/dev/",
  "app/api/dev/",
  "components/dev/",
  "lib/dev/",
  "scripts/",
  "features/onboarding/",
];

// Empty since the 14 typography compatibility bridges were deleted: they had no
// consumer left, every importer already pointed at the dev lab target. A file
// listed here is allowed to import the dev lab because it exists only to re-export
// it, so the exemption is granted one path at a time, never by prefix.
const ALLOWED_COMPATIBILITY_BRIDGES = new Set([]);

const FORBIDDEN_IMPORTS = [
  '@/components/dev/typography/',
  '@/lib/dev/typography/',
];

const SEARCH_ROOTS = ["app", "components", "features", "lib"];

function collectFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const resolved = path.join(rootDir, entry.name);
    if (entry.isDirectory()) return collectFiles(resolved);
    if (!entry.isFile()) return [];
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [resolved];
  });
}

function getCandidateFiles() {
  return SEARCH_ROOTS.flatMap(collectFiles)
    .map((filePath) => filePath.replace(/\\/g, "/"))
    .filter((filePath) => !EXCLUDED_PATHS.some((prefix) => filePath.startsWith(prefix)))
    .filter((filePath) => !ALLOWED_COMPATIBILITY_BRIDGES.has(filePath));
}

function readViolations(filePath) {
  const content = fs.readFileSync(filePath, "utf8");

  return FORBIDDEN_IMPORTS.filter((prefix) => content.includes(prefix)).map(
    (prefix) => `${filePath}: forbidden dev-lab import (${prefix})`
  );
}

const violations = getCandidateFiles().flatMap(readViolations);

if (violations.length > 0) {
  console.error("Runtime boundary violations detected:");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log("Runtime boundaries verified: no product/runtime files import typography dev-lab modules.");
