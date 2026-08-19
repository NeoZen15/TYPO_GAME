#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const copyFile = path.join(repoRoot, "content", "copy.ts");
const copySource = fs.readFileSync(copyFile, "utf8");

// Every `*Copy` block is inspected, not just the first one. CLAUDE.md states that
// interface text is centralised here and that this check verifies declared copy
// is actually used, so a block that escaped the scan would make that claim false
// and let dead keys accumulate silently.
const copyBlocks = [
  ...copySource.matchAll(/export const (\w*Copy) = \{([\s\S]*?)\} as const;/g),
].map(([, name, body]) => ({
  name,
  keys: [...body.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map(([, key]) => key),
}));

if (copyBlocks.length === 0) {
  console.error("Could not locate any `*Copy` object in content/copy.ts.");
  process.exit(1);
}

const emptyBlocks = copyBlocks.filter((block) => block.keys.length === 0);

if (emptyBlocks.length > 0) {
  console.error("No keys found in these copy objects:");
  emptyBlocks.forEach((block) => console.error(`- ${block.name}`));
  process.exit(1);
}

// `docs` used to be searched too, which made a key cited in a markdown file count
// as used even when no component rendered it. A key nobody renders is dead copy,
// whether or not the documentation mentions it, so only code is searched here.
const searchTargets = ["app", "components", "features", "lib", "content"];
const SOURCE_EXTENSIONS = /\.(ts|tsx|mjs|mts|js|jsx)$/;
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".next", ".git", "tmp"]);

// Pure Node traversal, on the model of collectFiles in check-dev-routes.mjs. The
// previous version shelled out to `rg`, which is neither a dependency of this
// repo nor vendored: on a machine without ripgrep the script threw instead of
// reporting, and the whole quality gate failed for a reason unrelated to copy.
function collectFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  return fs.readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) return [];
      return collectFiles(resolved);
    }
    if (!entry.isFile()) return [];
    if (!SOURCE_EXTENSIONS.test(entry.name)) return [];
    return [resolved];
  });
}

// content/copy.ts declares the keys, so a reference inside it proves nothing.
const sources = searchTargets
  .flatMap((target) => collectFiles(path.join(repoRoot, target)))
  .filter((filePath) => path.resolve(filePath) !== copyFile)
  .map((filePath) => fs.readFileSync(filePath, "utf8"));

const unusedKeys = [];

for (const block of copyBlocks) {
  for (const key of block.keys) {
    // Same expression as the previous ripgrep call: `blockName.key` on a word
    // boundary, so `errorCopy.title` is not matched by `errorCopy.titleSuffix`.
    const usage = new RegExp(`${block.name}\\.${key}\\b`);

    if (!sources.some((source) => usage.test(source))) {
      unusedKeys.push(`${block.name}.${key}`);
    }
  }
}

if (unusedKeys.length > 0) {
  console.error("Unused copy keys detected:");
  unusedKeys.forEach((key) => console.error(`- ${key}`));
  process.exit(1);
}

const summary = copyBlocks
  .map((block) => `${block.name} (${block.keys.join(", ")})`)
  .join("; ");

console.log(`All copy keys are used: ${summary}.`);
