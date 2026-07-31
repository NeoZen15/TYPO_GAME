#!/usr/bin/env node

// Day-key arithmetic guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. The daily progression (streak, activity window, best
// record) is counted in ANSWER EVENTS, on a calendar day already resolved to
// Europe/Paris entirely in SQL (`to_char((event_ts_utc AT TIME ZONE
// 'Europe/Paris')::date, 'YYYY-MM-DD')`). lib/profile/day-keys.ts then only
// enumerates consecutive calendar days on that already-resolved text key: it
// must never touch a timezone itself, only Date.UTC on the y/m/d the key
// already carries.
//
// This self-tests that arithmetic on synthetic day keys, including a spring
// DST transition and a year boundary, so a reimplementation that switches to
// a local-timezone Date (which computes a different day depending on the
// machine's own timezone, especially across a DST jump) is caught here rather
// than in a bug report from whoever's laptop is not set to UTC.
//
// This script is standalone on purpose: it guards lib/profile/day-keys.ts
// only, and is not coupled to any other module's lifecycle so it stays green
// on its own, independent of what else is or is not in the repo yet.

const DAY_KEYS = "lib/profile/day-keys.ts";
const failures = [];

const expect = (label, actual, expected) => {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) {
    failures.push(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
};

try {
  const { buildActivityWindow, streakFromDayKeys, longestRunFromDayKeys } = await import(
    "../../lib/profile/day-keys.ts"
  );

  const KEYS = ["2026-07-28", "2026-07-28", "2026-07-29", "2026-07-31"];
  expect("activity window", buildActivityWindow(KEYS, "2026-07-31", 5), [0, 2, 1, 0, 1]);
  expect("streak today counted", streakFromDayKeys(KEYS, "2026-07-31"), 1);
  expect(
    "streak tolerates today unplayed",
    streakFromDayKeys(["2026-07-29", "2026-07-30"], "2026-07-31"),
    2
  );
  expect(
    "longest run",
    longestRunFromDayKeys(["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-05"]),
    3
  );

  // 2026-03-29 is the Paris spring-forward (02:00 -> 03:00 CEST). The key is
  // already a resolved calendar day, so the wall-clock jump inside it must
  // change nothing here: a reimplementation on a local-timezone Date could
  // still lose or repeat a day around it, depending on the runner's own zone.
  expect(
    "streak across the Paris spring DST transition",
    streakFromDayKeys(["2026-03-28", "2026-03-29", "2026-03-30"], "2026-03-30"),
    3
  );

  // Year boundary: Date.UTC must roll December 31 into January 1 of the next
  // year on its own, with no special case in this module.
  expect(
    "longest run across a year boundary",
    longestRunFromDayKeys(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]),
    4
  );
} catch (error) {
  failures.push(
    `could not import ${DAY_KEYS} to self-test the day-key arithmetic: ${error.message}. ` +
      `The module must stay free of runtime imports so Node can strip its types.`
  );
}

if (failures.length > 0) {
  console.error("check:day-keys FAILED\n");
  for (const failure of failures) {
    console.error(`  - ${failure}\n`);
  }
  process.exit(1);
}

console.log(
  "check:day-keys OK : activity window, streak (today counted, today unplayed tolerated), " +
    "longest run, the Paris spring DST transition and a year boundary all verified on " +
    "synthetic day keys."
);
