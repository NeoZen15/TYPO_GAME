#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";

const FORBIDDEN_FILENAMES = new Set([".DS_Store", "Thumbs.db"]);

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

if (forbiddenFiles.length > 0) {
  console.error("Forbidden tracked artifacts detected:");
  forbiddenFiles.forEach((filePath) => console.error(`- ${filePath}`));
  process.exit(1);
}

console.log("No forbidden tracked artifacts detected.");
