#!/usr/bin/env node

import fs from "node:fs";

// The typography migration is over. The 14 bridges this check used to police, plus
// XHeightWordSplit.tsx which no check ever watched, were single line re-exports
// from components/typography/* and lib/typography/* to the dev lab. Every
// importer was already pointing at the real target under components/dev/typography
// or lib/dev/typography, so all 15 had zero consumers and they were deleted.
//
// The list is empty and the check stays in the gate: a bridge that comes back
// must come back as a thin re-export and be declared here, which is what makes
// the temporary nature of the pattern enforceable rather than aspirational.
const BRIDGES = [];

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

console.log(
  BRIDGES.length === 0
    ? "Compatibility bridges verified: none declared, the typography migration is finished."
    : `Compatibility bridges verified: ${BRIDGES.length} wrappers remain thin re-export shims.`
);
