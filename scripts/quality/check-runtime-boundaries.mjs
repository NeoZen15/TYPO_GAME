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

const ALLOWED_COMPATIBILITY_BRIDGES = new Set([
  "components/typography/AnatomyMetricsValidator.tsx",
  "components/typography/FallbackCalibrationLab.tsx",
  "components/typography/GlyphAuditMatrix.tsx",
  "components/typography/ProjectionCanvas.tsx",
  "components/typography/TypefaceProfileLab.tsx",
  "components/typography/WordAuditMatrix.tsx",
  "lib/typography/fallback-calibration.ts",
  "lib/typography/glyph-audit-spec.ts",
  "lib/typography/glyph-measurement-profile-adapter.ts",
  "lib/typography/headless-runtime.ts",
  "lib/typography/typeface-measurement-profile-builder.ts",
  "lib/typography/typeface-profile-dev-builder.ts",
  "lib/typography/word-audit-spec.ts",
  "lib/typography/word-measurement-profile-adapter.ts",
]);

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
