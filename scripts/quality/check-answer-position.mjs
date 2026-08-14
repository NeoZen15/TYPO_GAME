#!/usr/bin/env node

// Answer position guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. Where the correct answer sits among the four buttons
// must carry no information. The moment the position is predictable, the face
// is nameable without looking at the specimen: the eye is not trained, the
// score is inflated, and user_event_fact records a correct answer that proves
// no recognition at all. This is a data integrity rule before it is a UX one.
//
// WHY IT EXISTS. It did not hold. The engine elected the correct face as the
// pool MINIMUM, last tiebreak `hashScore(seed, qIndex, slug)` ascending, then
// ordered the four buttons by that SAME hashScore ascending. The winner held
// the minimum key by construction, so it opened every question in first place,
// measured at 100 percent. A shuffle existed and looked reassuring, but it was
// keyed on the very quantity that had elected the winner.
//
// The first fix ordered the buttons by a differently salted hash, which removed
// the defect but left the order computable in advance from the seed. The owner
// asked for a real draw, so the order is now drawn with crypto.randomInt and
// this guard checks the draw rather than a key.
//
// It imports lib/game/training/question-shape.ts (Node strips the types) and
// exercises the real selection, distractor and ordering chain, never a
// re-implementation: a re-implementation agrees with itself, which is how the
// original defect went unseen.

const SHAPE = "lib/game/training/question-shape.ts";

// Uniform is 25 percent per position, and since the order became a real draw
// (owner's call, 2026-08-15) this IS a statistical tolerance, so it is set where
// a fair draw cannot trip it. Over 400 questions a position lands 100 times on
// average with a standard deviation near 8.7, so this floor sits six deviations
// below the mean: a false red is about one run in a billion, while the defect
// this guard exists for measured zero. A gate that cries wolf gets ignored, and
// then it protects nothing.
const FLOOR_PCT = 12;
const QUESTIONS = 400;

const CATEGORIES = ["serif", "sans", "slab", "display", "mono", "script"];

const failures = [];
const measured = [];

const makePool = (size, { difficulties, masteryLevel = 0, allDue = true }) =>
  Array.from({ length: size }, (_, index) => ({
    typeface_slug: `face-${index}`,
    next_due_after_q: allDue ? 0 : index % 7,
    mastery_level: masteryLevel,
    difficulty_base: difficulties[index % difficulties.length],
    primary_category: CATEGORIES[index % CATEGORIES.length],
    visual_cluster_id: String(index % 40),
  }));

const SCENARIOS = [
  ["new player, one difficulty", makePool(1172, { difficulties: ["easy"] })],
  [
    "new player, real catalogue shape",
    makePool(1172, { difficulties: ["easy", "medium", "hard"] }),
  ],
  [
    "advanced player, mastery 3",
    makePool(1172, { difficulties: ["easy", "medium", "hard"], masteryLevel: 3 }),
  ],
  [
    "player mid pool, staggered due dates",
    makePool(1172, { difficulties: ["easy", "medium", "hard"], allDue: false }),
  ],
  ["starting pool of 30 faces", makePool(30, { difficulties: ["easy"] })],
];

try {
  const { orderOptionsForDisplay, pickDistractors, pickEligibleTypeface } = await import(
    `../../${SHAPE}`
  );

  // Composes one question exactly as buildQuestion does, and reports where the
  // correct answer landed plus the order it came out in.
  const compose = (pool, seed, globalQIndex) => {
    const correct = pickEligibleTypeface(pool, globalQIndex, seed);
    if (!correct) return null;

    const distractors = pickDistractors(pool, correct, globalQIndex, seed);
    const ordered = orderOptionsForDisplay(correct, distractors);

    return {
      position: ordered.findIndex((row) => row.typeface_slug === correct.typeface_slug),
      slugs: ordered.map((row) => row.typeface_slug),
      size: ordered.length,
    };
  };

  for (const [label, pool] of SCENARIOS) {
    const counts = [0, 0, 0, 0];
    let malformed = 0;
    measured.push({ label, counts });

    for (let question = 0; question < QUESTIONS; question += 1) {
      const shaped = compose(pool, `seed-${question % 23}`, question);

      if (!shaped || shaped.size !== 4 || shaped.position < 0) {
        malformed += 1;
        continue;
      }

      counts[shaped.position] += 1;
    }

    if (malformed > 0) {
      failures.push(
        `${label}: ${malformed} of ${QUESTIONS} questions did not compose four options ` +
          `containing the correct answer.`
      );
      continue;
    }

    const starved = counts
      .map((count, index) => ({ index, pct: (count / QUESTIONS) * 100 }))
      .filter((entry) => entry.pct < FLOOR_PCT);

    if (starved.length > 0) {
      const spread = counts.map((c) => `${((c / QUESTIONS) * 100).toFixed(1)}%`).join(" / ");
      failures.push(
        `${label}: the correct answer is predictable by position. ` +
          `Spread across the four buttons is ${spread}, and position ` +
          `${starved.map((entry) => entry.index + 1).join(", ")} ` +
          `${starved.length > 1 ? "are" : "is"} below the ${FLOOR_PCT}% floor ` +
          `(uniform would be 25% each). A player who always clicks the same slot ` +
          `scores without reading the specimen.`
      );
    }
  }

  // NOT REPRODUCIBLE, ON THE OWNER'S CALL (2026-08-15). An earlier version of
  // this guard demanded the opposite, on the belief that the question token
  // needed the order to be recomputable. It does not: the token CARRIES the
  // slugs it was built with (question-token.ts, `options: string[]`) and the
  // answer path only asks whether the submitted slug is among them
  // (provider.ts, `payload.options.includes(answerSlug)`). Nothing anywhere
  // rebuilds the order to compare against it.
  //
  // So a fixed order buys nothing and costs something real: a same question
  // served twice, on a reload or a resumed session, would show the buttons in
  // the same places, and anything derived from a hash is in principle
  // predictable by whoever knows the seed. The order is drawn at random now, and
  // this asserts it: fifty builds of ONE question must not all come out alike.
  const [, stablePool] = SCENARIOS[1];
  const repeated = new Set(
    Array.from({ length: 50 }, () => JSON.stringify(compose(stablePool, "seed-stability", 41)?.slugs))
  );

  if (repeated.size < 2) {
    failures.push(
      `fifty builds of the same question all came out in the identical option order ` +
        `(${[...repeated][0]}). The order is fixed by a key, so it is predictable by ` +
        `anyone who can compute that key. The owner asked for a real draw.`
    );
  }
} catch (error) {
  failures.push(
    `could not import ${SHAPE} to exercise the question chain: ${error.message}. ` +
      `The module must stay free of runtime imports so Node can strip its types.`
  );
}

if (failures.length > 0) {
  console.error("check:answer-position FAILED\n");
  for (const failure of failures) {
    console.error(`  - ${failure}\n`);
  }
  process.exit(1);
}

// Printing the spread, not just a verdict. A guard that only says OK cannot be
// distinguished from a guard that stopped measuring anything.
console.log(
  "check:answer-position OK : across five pool shapes, the correct answer reaches every one " +
    "of the four buttons, and fifty builds of one question do not all come out alike. " +
    "Percentages below are a real draw, so they move from run to run."
);
for (const { label, counts } of measured) {
  const spread = counts.map((count) => `${((count / QUESTIONS) * 100).toFixed(1)}%`.padStart(6));
  console.log(`  ${label.padEnd(38)} ${spread.join("  ")}`);
}
