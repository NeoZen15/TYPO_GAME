#!/usr/bin/env node

// Monthly partition check for user_event_fact. No database, no network: it reads
// the SQL files of db/migrations and nothing else.
//
// user_event_fact is partitioned by RANGE (event_ts_utc). Migration 001 declared
// three months of 2026 plus the uef_default catch all, and nothing declared the
// months that followed, so every event since June 2026 landed in uef_default
// without a single warning anywhere. That is not a functional outage, it is worse
// in the long run: PostgreSQL refuses to create a partition whose range overlaps
// rows already sitting in the default partition, so the later the fix, the more
// rows have to be moved first.
//
// What this check enforces: the current month has a declared partition, and there
// is no hole between the first declared month and the current one. What it cannot
// know: whether the migration was applied. It therefore reports the files it read
// and repeats their own "NON APPLIQUEE" marker rather than pretending.

import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const MIGRATIONS_DIR = "db/migrations";
const PARTITIONED_TABLE = "user_event_fact";

const failures = [];
const declaredBy = new Map();
const unappliedFiles = new Set();

const PARTITION_PATTERN = new RegExp(
  `CREATE TABLE (?:IF NOT EXISTS )?(uef_(\\d{4})_(\\d{2}))\\s+PARTITION OF ${PARTITIONED_TABLE}`,
  "g"
);

const migrationFiles = fs
  .readdirSync(path.join(PROJECT_ROOT, MIGRATIONS_DIR))
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const name of migrationFiles) {
  const source = fs.readFileSync(path.join(PROJECT_ROOT, MIGRATIONS_DIR, name), "utf8");

  for (const match of source.matchAll(PARTITION_PATTERN)) {
    const [, partitionName, year, month] = match;
    const key = `${year}-${month}`;

    if (!declaredBy.has(key)) declaredBy.set(key, { partitionName, file: name });

    // The migrations say themselves whether they have been run. This check has no
    // database access, so it repeats that marker instead of guessing.
    if (source.includes("NON APPLIQUEE")) unappliedFiles.add(name);
  }
}

if (declaredBy.size === 0) {
  failures.push(
    `${MIGRATIONS_DIR}: no monthly partition of ${PARTITIONED_TABLE} is declared anywhere`
  );
}

const toKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

const now = new Date();
const currentKey = toKey(now.getUTCFullYear(), now.getUTCMonth() + 1);

const sortedKeys = [...declaredBy.keys()].sort();
const firstKey = sortedKeys[0];

if (firstKey !== undefined) {
  const [firstYear, firstMonth] = firstKey.split("-").map(Number);
  let year = firstYear;
  let month = firstMonth;
  const missing = [];

  // Walk month by month from the first declared month up to the current one. A
  // hole in the middle is the same defect as a missing current month: those rows
  // are in uef_default and cannot be reattached without being moved first.
  while (toKey(year, month) <= currentKey) {
    const key = toKey(year, month);
    if (!declaredBy.has(key)) missing.push(key);

    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }

  if (missing.length > 0) {
    failures.push(
      `${MIGRATIONS_DIR}: no partition declared for ${missing.join(", ")}, so those events land in uef_default (current month is ${currentKey}). Write a numbered migration that moves the rows out of uef_default first, then attaches the partitions.`
    );
  }
}

if (failures.length > 0) {
  console.error("Event partition violations detected:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

const coverage = `${sortedKeys[0]} to ${sortedKeys[sortedKeys.length - 1]}`;

console.log(
  `Event partitions verified: ${declaredBy.size} monthly partitions of ${PARTITIONED_TABLE} declared, ${coverage}, current month ${currentKey} covered.`
);

if (unappliedFiles.size > 0) {
  console.log(
    `Note: partitions are declared by files marked NON APPLIQUEE (${[...unappliedFiles].join(", ")}), so those partitions do not exist in the database yet and the rows keep going to uef_default until the owner runs them.`
  );
}
