#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const DEV_ROUTE_ROOTS = [
  path.join(PROJECT_ROOT, "app", "dev"),
  path.join(PROJECT_ROOT, "app", "api", "dev"),
];

const EXPECTED_IMPORT = 'import { isDevRuntime } from "@/lib/dev-mode";';
const PAGE_GUARD_PATTERN = /if\s*\(!isDevRuntime\(\)\)\s*\{\s*notFound\(\);\s*\}/m;
const API_GUARD_PATTERN =
  /if\s*\(!isDevRuntime\(\)\)\s*\{\s*return\s+NextResponse\.json\(\{\s*error:\s*"Not found"\s*\},\s*\{\s*status:\s*404\s*\}\);\s*\}/m;

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

const failures = [];

for (const rootDir of DEV_ROUTE_ROOTS) {
  for (const filePath of collectFiles(rootDir)) {
    const contents = fs.readFileSync(filePath, "utf8");
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    const isApiDevRoute = filePath.includes(`${path.sep}app${path.sep}api${path.sep}dev${path.sep}`);

    if (!contents.includes(EXPECTED_IMPORT)) {
      failures.push(`${relativePath}: missing ${EXPECTED_IMPORT}`);
      continue;
    }

    if (isApiDevRoute) {
      if (!contents.includes('import { NextResponse } from "next/server";')) {
        failures.push(`${relativePath}: missing NextResponse import for guarded API route`);
        continue;
      }

      if (!API_GUARD_PATTERN.test(contents)) {
        failures.push(`${relativePath}: missing executable API dev-runtime guard`);
      }
      continue;
    }

    if (!contents.includes('import { notFound } from "next/navigation";')) {
      failures.push(`${relativePath}: missing notFound import for guarded dev page`);
      continue;
    }

    if (!PAGE_GUARD_PATTERN.test(contents)) {
      failures.push(`${relativePath}: missing executable page dev-runtime guard`);
    }
  }
}

if (failures.length > 0) {
  console.error("Dev route guard violations detected:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("All dev routes import and use the dev-runtime guard.");
