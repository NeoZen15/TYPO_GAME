#!/usr/bin/env node

import fs from "node:fs";

const BRIDGES = [
  {
    filePath: "components/typography/AnatomyMetricsValidator.tsx",
    expected: 'export { default } from "@/components/dev/typography/AnatomyMetricsValidator";',
  },
  {
    filePath: "components/typography/FallbackCalibrationLab.tsx",
    expected: 'export { default } from "@/components/dev/typography/FallbackCalibrationLab";',
  },
  {
    filePath: "components/typography/GlyphAuditMatrix.tsx",
    expected: 'export { default } from "@/components/dev/typography/GlyphAuditMatrix";',
  },
  {
    filePath: "components/typography/ProjectionCanvas.tsx",
    expected: 'export { default } from "@/components/dev/typography/ProjectionCanvas";',
  },
  {
    filePath: "components/typography/TypefaceProfileLab.tsx",
    expected: 'export { default } from "@/components/dev/typography/TypefaceProfileLab";',
  },
  {
    filePath: "components/typography/WordAuditMatrix.tsx",
    expected: 'export { default } from "@/components/dev/typography/WordAuditMatrix";',
  },
  {
    filePath: "lib/typography/fallback-calibration.ts",
    expected: 'export * from "@/lib/dev/typography/fallback-calibration";',
  },
  {
    filePath: "lib/typography/glyph-audit-spec.ts",
    expected: 'export * from "@/lib/dev/typography/glyph-audit-spec";',
  },
  {
    filePath: "lib/typography/glyph-measurement-profile-adapter.ts",
    expected: 'export * from "@/lib/dev/typography/glyph-measurement-profile-adapter";',
  },
  {
    filePath: "lib/typography/headless-runtime.ts",
    expected: 'export * from "@/lib/dev/typography/headless-runtime";',
  },
  {
    filePath: "lib/typography/typeface-measurement-profile-builder.ts",
    expected: 'export * from "@/lib/dev/typography/typeface-measurement-profile-builder";',
  },
  {
    filePath: "lib/typography/typeface-profile-dev-builder.ts",
    expected: 'export * from "@/lib/dev/typography/typeface-profile-dev-builder";',
  },
  {
    filePath: "lib/typography/word-audit-spec.ts",
    expected: 'export * from "@/lib/dev/typography/word-audit-spec";',
  },
  {
    filePath: "lib/typography/word-measurement-profile-adapter.ts",
    expected: 'export * from "@/lib/dev/typography/word-measurement-profile-adapter";',
  },
];

const failures = [];

for (const { filePath, expected } of BRIDGES) {
  if (!fs.existsSync(filePath)) {
    failures.push(`${filePath}: missing compatibility bridge file`);
    continue;
  }

  const actual = fs.readFileSync(filePath, "utf8").trim();
  if (actual !== expected) {
    failures.push(`${filePath}: compatibility bridge must remain a single re-export`);
  }
}

if (failures.length > 0) {
  console.error("Compatibility bridge violations detected:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Compatibility bridges verified: wrappers remain thin re-export shims.");
