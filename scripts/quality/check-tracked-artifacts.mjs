#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";

const FORBIDDEN_FILENAMES = new Set([".DS_Store", "Thumbs.db"]);
const FORBIDDEN_TRACKED_PREFIXES = [
  "backups/checkpoints/",
  "data/typography-profiles/tmp/",
];

function getTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
  });
  return output.split("\0").filter(Boolean);
}

const trackedFiles = getTrackedFiles();
const forbiddenFiles = trackedFiles.filter((filePath) =>
  FORBIDDEN_FILENAMES.has(path.basename(filePath))
);
const forbiddenTrackedPrefixes = trackedFiles.filter((filePath) =>
  FORBIDDEN_TRACKED_PREFIXES.some((prefix) => filePath.startsWith(prefix)) &&
  path.basename(filePath) !== ".gitignore"
);

if (forbiddenFiles.length > 0) {
  console.error("Forbidden tracked artifacts detected:");
  forbiddenFiles.forEach((filePath) => console.error(`- ${filePath}`));
  process.exit(1);
}

if (forbiddenTrackedPrefixes.length > 0) {
  console.error("Forbidden tracked archive/tmp paths detected:");
  forbiddenTrackedPrefixes.forEach((filePath) => console.error(`- ${filePath}`));
  process.exit(1);
}

console.log("No forbidden tracked artifacts detected.");
