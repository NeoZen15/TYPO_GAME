#!/usr/bin/env node

// Telemetry truthfulness guard for misread_shown. No build, no database, no network.
//
// THE DEFECT. user_event_fact.misread_shown records that a Misread Type Card WAS
// DISPLAYED. The trigger rule was implemented (first error on this face in the
// session, or second consecutive error) and written straight into the column,
// while no card exists anywhere in the runtime: no content/type-cards, no overlay,
// nothing on screen. The fact table therefore claimed displays that never
// happened, and the KPI meant to measure the effect of the cards
// (misread_effectiveness) would have been computed on imaginary events.
//
// THE RULE. While no Type Card content exists, misread_shown is false and only
// false. This guard is SELF-RELEASING: the day content/type-cards exists, the
// literal-false requirement is lifted and the trigger rule may drive the column
// again, because by then the card really is shown.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const CARD_CONTENT_DIR = "content/type-cards";
const WRITERS = ["lib/game/training/provider.ts", "lib/game/competition/provider.ts"];

const cardsExist = fs.existsSync(path.join(ROOT, CARD_CONTENT_DIR));

if (cardsExist) {
  console.log(
    `check:misread-truth OK : ${CARD_CONTENT_DIR} exists, so misread_shown may reflect a real ` +
      `display. This guard steps aside; the trigger rule (spec §6.1) now governs the column.`
  );
  process.exit(0);
}

const failures = [];

for (const relative of WRITERS) {
  const source = read(relative);
  if (!source.includes("misread_shown")) {
    continue;
  }

  // Two shapes are provable, and they cover every writer.
  //
  //   a) no `misreadShown` identifier at all: the column is bound to an inline
  //      literal, so nothing can compute it (this is the competition provider);
  //   b) a `const misreadShown = false` declaration, which must be exactly that.
  //
  // Any other shape means something computes the value, which is how the defect
  // got in: the trigger rule was written straight into the fact table.
  const declaration = source.match(/const\s+misreadShown\s*=\s*([^;]+);/s);

  if (!declaration) {
    if (/misreadShown/.test(source)) {
      failures.push(
        `${relative} uses a misreadShown identifier without declaring it as a const, so this ` +
          `guard cannot prove what value lands in the fact table.`
      );
    }
    continue;
  }

  const value = declaration[1].trim();
  if (value !== "false") {
    failures.push(
      `${relative} computes misread_shown as \`${value.replace(/\s+/g, " ").slice(0, 90)}\`. ` +
        `No Type Card exists (${CARD_CONTENT_DIR} is absent), so the only truthful value is ` +
        `the literal false. Implement the card and its content first, then let the trigger ` +
        `rule drive this column.`
    );
  }
}

if (failures.length > 0) {
  console.error("check:misread-truth FAILED\n");
  for (const failure of failures) {
    console.error(`  - ${failure}\n`);
  }
  process.exit(1);
}

console.log(
  `check:misread-truth OK : no Type Card content yet, and every writer sets misread_shown to ` +
    `a literal false. The fact table claims no display that did not happen.`
);
