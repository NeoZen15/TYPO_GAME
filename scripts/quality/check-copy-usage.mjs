#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const copyFile = path.join(repoRoot, "content", "copy.ts");
const copySource = fs.readFileSync(copyFile, "utf8");

const gateCopyBlockMatch = copySource.match(
  /export const gateCopy = \{([\s\S]*?)\} as const;/
);

if (!gateCopyBlockMatch) {
  console.error("Could not locate `gateCopy` object in content/copy.ts.");
  process.exit(1);
}

const gateCopyKeys = [...gateCopyBlockMatch[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map(
  ([, key]) => key
);

if (gateCopyKeys.length === 0) {
  console.error("No keys found in `gateCopy` object.");
  process.exit(1);
}

const searchTargets = ["app", "components", "lib", "content", "docs"];
const unusedKeys = [];

for (const key of gateCopyKeys) {
  try {
    execFileSync(
      "rg",
      ["-n", `gateCopy\\.${key}\\b`, ...searchTargets, "--glob", "!content/copy.ts"],
      {
        stdio: "pipe",
      }
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 1) {
      unusedKeys.push(key);
      continue;
    }
    throw error;
  }
}

if (unusedKeys.length > 0) {
  console.error("Unused `gateCopy` keys detected:");
  unusedKeys.forEach((key) => console.error(`- ${key}`));
  process.exit(1);
}

console.log(`All gateCopy keys are used (${gateCopyKeys.join(", ")}).`);
