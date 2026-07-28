#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const DEV_ROUTE_ROOTS = [
  path.join(PROJECT_ROOT, "app", "dev"),
  path.join(PROJECT_ROOT, "app", "api", "dev"),
];

// Third case, added because nothing caught it: a dev component mounted from the
// product render tree. `components/dev/UiDebugProbe.tsx` was rendered by
// `app/layout.tsx` on every page, in production too. `check:runtime-boundaries`
// forbids `@/components/dev/typography/` imports but not `@/components/dev/`,
// and the two passes above only walk `app/dev` and `app/api/dev`.
const PRODUCT_ROOTS = ["app", "components", "features", "lib"];
const DEV_PREFIXES = ["app/dev/", "app/api/dev/", "components/dev/", "lib/dev/"];
const DEV_COMPONENT_PREFIX = "components/dev/";
const NON_MODULE_EXTENSIONS = /\.(css|scss|json|svg|png|jpg|jpeg|webp|woff2?|otf|ttf)$/;
const IMPORT_SPECIFIER_PATTERN = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;
const RE_EXPORT_ONLY_PATTERN =
  /^export\s+(?:\*|\{\s*default\s*\})\s+from\s+["']([^"']+)["'];$/;

const EXPECTED_IMPORT = 'import { isDevRuntime } from "@/lib/dev-mode";';
const PAGE_GUARD_PATTERN = /if\s*\(!isDevRuntime\(\)\)\s*\{\s*notFound\(\);\s*\}/m;
const API_GUARD_PATTERN =
  /if\s*\(!isDevRuntime\(\)\)\s*\{\s*return\s+NextResponse\.json\(\{\s*error:\s*"Not found"\s*\},\s*\{\s*status:\s*404\s*\}\);\s*\}/m;
// Same idiom as the page guard, with the component contract: render nothing.
const COMPONENT_GUARD_PATTERN =
  /if\s*\(!isDevRuntime\(\)\)\s*(?:\{\s*return\s+null;\s*\}|return\s+null;)/m;

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

const toPosix = (value) => value.split(path.sep).join("/");
const toRelative = (absolutePath) => toPosix(path.relative(PROJECT_ROOT, absolutePath));

function resolveSpecifier(specifier, importerPath) {
  if (specifier.startsWith("@/")) return path.join(PROJECT_ROOT, specifier.slice(2));
  if (specifier.startsWith(".")) return path.resolve(path.dirname(importerPath), specifier);
  return null;
}

function resolveModuleFile(specifier, importerPath) {
  const base = resolveSpecifier(specifier, importerPath);
  if (base === null) return null;
  if (NON_MODULE_EXTENSIONS.test(base)) return null;

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];

  const hit = candidates.find(
    (candidate) =>
      /\.(ts|tsx)$/.test(candidate) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
  );

  return hit ? { status: "file", file: hit } : { status: "unresolved", base };
}

const readShimTarget = (filePath) =>
  RE_EXPORT_ONLY_PATTERN.exec(fs.readFileSync(filePath, "utf8").trim())?.[1] ?? null;

// Follows the compatibility bridges of `components/typography/*`, which are
// single line re-exports of the dev lab. A file reached through a bridge is
// mounted just as much as one imported directly, so the chain is walked instead
// of stopping at the shim.
function resolveThroughShims(specifier, importerPath) {
  let currentSpecifier = specifier;
  let currentImporter = importerPath;

  for (let hop = 0; hop < 6; hop += 1) {
    const resolved = resolveModuleFile(currentSpecifier, currentImporter);
    if (resolved === null) return null;
    if (resolved.status === "unresolved") return resolved;

    const shimTarget = readShimTarget(resolved.file);
    if (shimTarget === null) return resolved;

    currentSpecifier = shimTarget;
    currentImporter = resolved.file;
  }

  return null;
}

function collectProductFiles() {
  return PRODUCT_ROOTS.flatMap((root) => collectFiles(path.join(PROJECT_ROOT, root)))
    .filter((filePath) => !DEV_PREFIXES.some((prefix) => toRelative(filePath).startsWith(prefix)))
    // A one line re-export renders nothing, so it cannot mount anything. Its own
    // importers are scanned, and the chain is followed for them.
    .filter((filePath) => readShimTarget(filePath) === null);
}

const failures = [];

// Case 3, before the two route passes so a mounted probe is reported first.
const reportedMounts = new Set();

for (const importerPath of collectProductFiles()) {
  const importerContents = fs.readFileSync(importerPath, "utf8");
  const importer = toRelative(importerPath);

  for (const match of importerContents.matchAll(IMPORT_SPECIFIER_PATTERN)) {
    const resolved = resolveThroughShims(match[1], importerPath);
    if (resolved === null) continue;

    if (resolved.status === "unresolved") {
      if (!toRelative(resolved.base).startsWith(DEV_COMPONENT_PREFIX)) continue;
      failures.push(
        `${importer}: imports "${match[1]}" from components/dev, which resolves to no file`
      );
      continue;
    }

    const devComponent = toRelative(resolved.file);
    if (!devComponent.startsWith(DEV_COMPONENT_PREFIX)) continue;

    const pairKey = `${importer} -> ${devComponent}`;
    if (reportedMounts.has(pairKey)) continue;
    reportedMounts.add(pairKey);

    const devContents = fs.readFileSync(resolved.file, "utf8");

    if (!devContents.includes(EXPECTED_IMPORT)) {
      failures.push(
        `${devComponent}: reached from ${importer}, missing ${EXPECTED_IMPORT}`
      );
      continue;
    }

    if (!COMPONENT_GUARD_PATTERN.test(devContents)) {
      failures.push(
        `${devComponent}: reached from ${importer}, missing executable dev-runtime guard (if (!isDevRuntime()) { return null; })`
      );
    }
  }
}

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
  console.error("Dev guard violations detected:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `All dev routes import and use the dev-runtime guard, and the ${reportedMounts.size} dev component mount(s) reached from product code guard themselves.`
);
