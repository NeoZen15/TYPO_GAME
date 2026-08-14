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
// The two hashes must therefore stay salted differently. This guard imports
// lib/game/training/question-shape.ts (Node strips the types) and exercises the
// real selection, distractor and ordering chain, never a re-implementation: a
// re-implementation agrees with itself, which is how this went unseen.

const SHAPE = "lib/game/training/question-shape.ts";

// Uniform is 25 percent per position. The chain is deterministic, so this is
// not a statistical tolerance, only room for the legitimate skew the selection
// tiebreaks introduce (a face elected on difficulty, not on its hash).
const FLOOR_PCT = 15;
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
    const ordered = orderOptionsForDisplay(correct, distractors, seed, globalQIndex);

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

  // The question token carries the option slugs in their display order, so the
  // order has to be reproducible for the same question. A shuffle fixed by
  // reaching for randomness instead of a second salt would pass the spread
  // check above and break the token here.
  const [, stablePool] = SCENARIOS[1];
  const first = compose(stablePool, "seed-stability", 41);
  const second = compose(stablePool, "seed-stability", 41);

  if (JSON.stringify(first?.slugs) !== JSON.stringify(second?.slugs)) {
    failures.push(
      `option order is not reproducible for the same (seed, question index): ` +
        `${JSON.stringify(first?.slugs)} then ${JSON.stringify(second?.slugs)}. ` +
        `The question token stores the slugs in display order, so it would no longer verify.`
    );
  }

  // Two different questions must not come out in the same order by accident of
  // a constant key, which is what a "shuffle" that ignores the question index
  // would produce.
  const early = compose(stablePool, "seed-stability", 41);
  const later = compose(stablePool, "seed-stability", 42);

  if (early && later && JSON.stringify(early.slugs) === JSON.stringify(later.slugs)) {
    failures.push(
      `two consecutive questions came out in the identical option order, which means ` +
        `the display order ignores the question index.`
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
    "of the four buttons, the order stays reproducible for a given question, and it changes " +
    "from one question to the next."
);
for (const { label, counts } of measured) {
  const spread = counts.map((count) => `${((count / QUESTIONS) * 100).toFixed(1)}%`.padStart(6));
  console.log(`  ${label.padEnd(38)} ${spread.join("  ")}`);
}
