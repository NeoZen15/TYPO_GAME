#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const copyFile = path.join(repoRoot, "content", "copy.ts");
const copySource = fs.readFileSync(copyFile, "utf8");

// Every `*Copy` block is inspected, not just gateCopy. CLAUDE.md states that
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

const searchTargets = ["app", "components", "features", "lib", "content", "docs"];
const unusedKeys = [];

for (const block of copyBlocks) {
  for (const key of block.keys) {
    try {
      execFileSync(
        "rg",
        [
          "-n",
          `${block.name}\\.${key}\\b`,
          ...searchTargets,
          "--glob",
          "!content/copy.ts",
        ],
        {
          stdio: "pipe",
        }
      );
    } catch (error) {
      if (typeof error === "object" && error !== null && "status" in error && error.status === 1) {
        unusedKeys.push(`${block.name}.${key}`);
        continue;
      }
      throw error;
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
