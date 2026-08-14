#!/usr/bin/env node

// In-game progression indicator guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. The indicator on the training screen has to MOVE while
// the player plays. Spec §15 / N-24 keeps the global eye level off that screen
// and asks instead for "un signal de progression qui monte", and the whole
// point of showing anything there is to tell the player their session counted.
//
// WHY IT EXISTS (D3, 2026-08-15). The screen showed `facesMastered / poolSize`,
// counting only faces at mastery_level 4 out of a scale that goes 0 to 4 and
// rises by at most one per FIRST ATTEMPT correct answer, on faces deliberately
// spaced apart by next_due_after_q. Four correct sightings of the same face
// were needed before the number moved by one, so a first session read 0 / 30
// and could not move at all. The figure was honest and rewarded nothing.
//
// The owner chose a set mastery gauge in percent. This guard asserts the
// property the old indicator failed: a single first attempt success moves it,
// a normal session moves it visibly, and it never goes backwards.

const GAUGE = "lib/profile/mastery-gauge.ts";

// mastery_level runs 0..4 (db/migrations/003_users_sessions_pool.sql).
const MAX_MASTERY = 4;
const STARTING_POOL = 30;

const failures = [];

const expect = (label, actual, expected) => {
  if (actual !== expected) {
    failures.push(`${label}: expected ${expected}, got ${actual}`);
  }
};

try {
  const { setMasteryPercent } = await import(`../../${GAUGE}`);

  const levels = (size, level = 0) => Array.from({ length: size }, () => level);

  // Bounds, both ends and the empty case. A player with no pool yet must read
  // zero rather than NaN from a division by zero.
  expect("empty pool reads zero", setMasteryPercent([]), 0);
  expect("untouched pool reads zero", setMasteryPercent(levels(STARTING_POOL)), 0);
  expect(
    "fully mastered pool reads one hundred",
    setMasteryPercent(levels(STARTING_POOL, MAX_MASTERY)),
    100
  );

  // THE REGRESSION THIS GUARD OWES ITS EXISTENCE TO. One face moving from 0 to
  // 1 is one first attempt success. The old indicator did not move here, and
  // would not have moved for the next fourteen either.
  const untouched = levels(STARTING_POOL);
  const oneSuccess = [1, ...levels(STARTING_POOL - 1)];

  if (setMasteryPercent(oneSuccess) <= setMasteryPercent(untouched)) {
    failures.push(
      `a single first attempt success does not move the gauge in the starting pool of ` +
        `${STARTING_POOL} faces (${setMasteryPercent(untouched)} then ` +
        `${setMasteryPercent(oneSuccess)}). This is exactly the defect the indicator had.`
    );
  }

  // A session is worth roughly twenty answers. It has to show on screen for a
  // pool that has grown well past its starting size, or the indicator goes back
  // to rewarding nothing as the player progresses.
  for (const size of [STARTING_POOL, 120, 400]) {
    const before = setMasteryPercent(levels(size));
    const after = setMasteryPercent([...levels(20, 1), ...levels(size - 20)]);

    if (after <= before) {
      failures.push(
        `a session of twenty first attempt successes does not move the gauge in a pool of ` +
          `${size} faces (${before} then ${after}).`
      );
    }
  }

  // Monotonic. Raising any single face must never lower the reading, which is
  // what a percentage computed against a moving denominator would do.
  const climbing = levels(STARTING_POOL);
  let previous = setMasteryPercent(climbing);

  for (let face = 0; face < STARTING_POOL; face += 1) {
    for (let step = 1; step <= MAX_MASTERY; step += 1) {
      climbing[face] = step;
      const current = setMasteryPercent(climbing);

      if (current < previous) {
        failures.push(
          `the gauge went backwards when face ${face} reached mastery ${step} ` +
            `(${previous} then ${current}).`
        );
        face = STARTING_POOL;
        break;
      }

      previous = current;
    }
  }

  expect("a fully climbed pool ends at one hundred", previous, 100);

  // Whole percent on purpose, it is what the screen prints.
  const sample = setMasteryPercent([1, 2, 3, 4, 0]);
  if (!Number.isInteger(sample)) {
    failures.push(`the gauge must read as a whole percent, got ${sample}.`);
  }
} catch (error) {
  failures.push(
    `could not import ${GAUGE} to exercise the progression indicator: ${error.message}. ` +
      `The module must stay free of runtime imports so Node can strip its types.`
  );
}

if (failures.length > 0) {
  console.error("check:mastery-gauge FAILED\n");
  for (const failure of failures) {
    console.error(`  - ${failure}\n`);
  }
  process.exit(1);
}

console.log(
  "check:mastery-gauge OK : the gauge moves on a single first attempt success, moves across a " +
    "session for pools of 30, 120 and 400 faces, never goes backwards, and is bounded 0 to 100."
);
