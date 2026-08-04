#!/usr/bin/env node

// Training session lifecycle guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. A training session is temporary, the progression is
// permanent (vision §2, invariant I-17). A session therefore has no planned
// length, never ends on a counter, and is closed only by an explicit call. The
// code used to cap a session at 8 resolved questions and close it itself, which
// made the long horizon of the engine unreachable: a face stabilised at mastery 4
// returns after 80 to 150 questions, ten to nineteen sessions later.
//
// Four ways the cap can come back, all four checked.
//
//   1. A round-count constant reappears in the training path.
//   2. Answering writes a terminal session status again.
//   3. The explicit end path disappears, or stops writing its event.
//   4. The bilan stops being derived from the fact table.
//
// The file also SELF-TESTS the pure summary builder on synthetic rows, so the
// arithmetic of a bilan is proven at every gate run without touching a database.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const CATALOG = "lib/game/training/catalog.ts";
const PROVIDER = "lib/game/training/provider.ts";
const CONTRACTS = "lib/game/training/contracts.ts";
const SUMMARY = "lib/game/training/session-summary.ts";
const END_ROUTE = "app/api/training/session/end/route.ts";
const SCREEN = "features/game/components/GameScreen.tsx";

const failures = [];

// ------------------------------------------------- 1. no round cap anywhere
const RETIRED_CAP = "TRAINING_TOTAL_ROUNDS";
for (const relative of [CATALOG, PROVIDER, CONTRACTS, SCREEN]) {
  const source = read(relative);
  // The catalog mentions the name once, inside the comment that explains why it
  // was removed. Anything that looks like a declaration or a read is a regression.
  if (new RegExp(`(export const|const|import)\\s[^\\n]*${RETIRED_CAP}`).test(source)) {
    failures.push(
      `${relative} declares or imports ${RETIRED_CAP}. A training session has no planned ` +
        `length (I-17); a round cap makes the engine's long horizon unreachable.`
    );
  }
}

if (/totalRounds/.test(read(CONTRACTS))) {
  failures.push(
    `${CONTRACTS} still carries totalRounds. There is no total: the contract must not ` +
      `promise a session length that does not exist.`
  );
}

// ------------------------------------ 2. answering never closes a session
const provider = read(PROVIDER);
const submitStart = provider.indexOf("export const submitTrainingAnswer");
const endStart = provider.indexOf("export const endTrainingSession");

if (submitStart === -1) {
  failures.push(`${PROVIDER} no longer exports submitTrainingAnswer.`);
}
if (endStart === -1) {
  failures.push(
    `${PROVIDER} no longer exports endTrainingSession. Closing a session is an explicit ` +
      `action and needs an explicit function (I-17).`
  );
}

// Comments are stripped before scanning: the explanatory block that precedes
// endTrainingSession sits inside submitTrainingAnswer's slice and would otherwise
// read as a violation. A guard that fires on its own documentation is a guard
// people learn to ignore.
const withoutComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

if (submitStart !== -1 && endStart !== -1) {
  const submitBody = withoutComments(
    provider.slice(submitStart, endStart > submitStart ? endStart : provider.length)
  );

  if (/status\s*=\s*[^\n]*completed/.test(submitBody)) {
    failures.push(
      `submitTrainingAnswer in ${PROVIDER} writes a completed session status. Answering a ` +
        `question must never end a session.`
    );
  }
  if (/session_end/.test(submitBody)) {
    failures.push(
      `submitTrainingAnswer in ${PROVIDER} writes a session_end event. That event belongs to ` +
        `the explicit end path only.`
    );
  }

  const endBody = withoutComments(provider.slice(endStart));
  for (const [needle, why] of [
    ["session_end", "the end path must record the session_end event"],
    ["buildTrainingSessionSummary", "the bilan must come from the pure summary builder"],
    ["user_event_fact", "the bilan must be derived from the fact table, not from counters"],
  ]) {
    if (!endBody.includes(needle)) {
      failures.push(`endTrainingSession in ${PROVIDER} does not mention ${needle}: ${why}.`);
    }
  }

  // The end path is a bookkeeping operation. It must not touch pedagogy.
  for (const forbidden of ["user_typeface_state", "mastery_level", "next_due_after_q"]) {
    if (endBody.includes(forbidden)) {
      failures.push(
        `endTrainingSession in ${PROVIDER} touches ${forbidden}. Closing a session must not ` +
          `move any pedagogical state (I-17): mastery is written answer by answer.`
      );
    }
  }
}

// ----------------------------------------------- 3. the end path is reachable
if (!fs.existsSync(path.join(ROOT, END_ROUTE))) {
  failures.push(`${END_ROUTE} is missing: the explicit end path has no HTTP entry.`);
} else if (!read(END_ROUTE).includes("endTrainingSession")) {
  failures.push(`${END_ROUTE} does not call endTrainingSession.`);
}

// ------------------------------------------- 4. self-test of the bilan maths
const SYNTHETIC = [
  // q1: wrong first, then right. Graded on the first attempt only (I-14).
  { question_id: "q1", typeface_slug: "lora", answer_slug: "asap", is_correct: false, attempt_index: 1, response_time_ms: 3000, mastery_before: 2, mastery_after: 1 },
  { question_id: "q1", typeface_slug: "lora", answer_slug: "lora", is_correct: true, attempt_index: 2, response_time_ms: 1200, mastery_before: 1, mastery_after: 1 },
  // q2: right first try, mastery up.
  { question_id: "q2", typeface_slug: "karla", answer_slug: "karla", is_correct: true, attempt_index: 1, response_time_ms: 1000, mastery_before: 0, mastery_after: 1 },
  // q3: wrong first try on a face never answered before, same confusion as q1.
  { question_id: "q3", typeface_slug: "lora", answer_slug: "asap", is_correct: false, attempt_index: 1, response_time_ms: 2000, mastery_before: 1, mastery_after: 0 },
  // q4: right first try on a brand new face.
  { question_id: "q4", typeface_slug: "cabin", answer_slug: "cabin", is_correct: true, attempt_index: 1, response_time_ms: 500, mastery_before: 0, mastery_after: 1 },
];

const expect = (label, actual, expected) => {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) {
    failures.push(
      `summary self-test, ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
};

try {
  const { buildTrainingSessionSummary } = await import(
    "../../lib/game/training/session-summary.ts"
  );

  const summary = buildTrainingSessionSummary({
    startedAt: new Date("2026-07-29T10:00:00Z"),
    endedAt: new Date("2026-07-29T10:04:00Z"),
    rows: SYNTHETIC,
    previouslySeenSlugs: ["lora", "karla"],
    poolSize: 30,
    facesMastered: 3,
  });

  expect("durationMs", summary.durationMs, 240000);
  expect("answersSubmitted", summary.answersSubmitted, 5);
  // q1, q2 and q4 reached a correct answer; q3 never did.
  expect("questionsResolved", summary.questionsResolved, 3);
  // Four first attempts, two of them correct.
  expect("firstTryCorrect", summary.firstTryCorrect, 2);
  expect("firstTryAccuracy", summary.firstTryAccuracy, 0.5);
  expect("retryCount", summary.retryCount, 1);
  expect("typefacesSeen", summary.typefacesSeen, 3);
  // cabin is the only face not answered before this session.
  expect("typefacesDiscovered", summary.typefacesDiscovered, ["cabin"]);
  expect("typefacesReinforced", summary.typefacesReinforced, ["cabin", "karla"]);
  expect("typefacesWeakened", summary.typefacesWeakened, ["lora"]);
  // First attempts only: lora 2->1 (-1), karla 0->1 (+1), lora 1->0 (-1),
  // cabin 0->1 (+1). Net zero: two faces gained, one lost twice.
  expect("masteryNet", summary.masteryNet, 0);
  expect("confusions", summary.confusions, [{ shown: "lora", chosen: "asap", count: 2 }]);
  // First-attempt times only: 3000, 1000, 2000, 500 -> median of four = 1500.
  expect("medianResponseMs", summary.medianResponseMs, 1500);
  expect("fastestResponseMs", summary.fastestResponseMs, 500);
  expect("slowestResponseMs", summary.slowestResponseMs, 3000);
  expect("poolSize", summary.poolSize, 30);
} catch (error) {
  failures.push(
    `could not import ${SUMMARY} to self-test the bilan maths: ${error.message}. ` +
      `The module must stay free of runtime imports so Node can strip its types.`
  );
}

// ------------------------------- 5. no runtime write to a generated column
//
// WHY THIS EXISTS. The end path shipped with `UPDATE sessions SET ... duration_ms
// = $x`, and `sessions.duration_ms` is declared `GENERATED ALWAYS AS ... STORED`
// in migration 003. Postgres refuses any write to such a column, so the voluntary
// end of a session raised an error on its very first call. Everything above passed
// while that was true, because none of it executes SQL. Measured read-only on
// 2026-07-29: `is_generated=ALWAYS` on that column, and 73 training sessions in
// the database, all of them still 'active', not one 'completed'.
//
// The rule is therefore general, not a special case for one column name: the
// generated columns are read from the migrations, and no runtime SQL may assign
// to any of them. A generated column is computed by the database from other
// columns, so writing to it is always a mistake, never a preference.
const generatedColumns = new Set();
const migrationsDir = path.join(ROOT, "db", "migrations");

if (fs.existsSync(migrationsDir)) {
  for (const file of fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"))) {
    const lines = read(path.join("db", "migrations", file)).split("\n");
    lines.forEach((line, index) => {
      if (!/GENERATED\s+ALWAYS\s+AS/i.test(line)) return;

      // The column name sits either before GENERATED on this line, or on an
      // earlier one when the definition wraps. Reading this line whole would
      // capture the word GENERATED itself as the column name, which is how the
      // first version of this parser reported a column that does not exist and
      // therefore guarded nothing.
      // `ADD COLUMN x` and `CREATE TABLE` lines put SQL keywords where a column
      // name would otherwise be, so the keyword set below is what keeps a word
      // like ADD out of the list. A bogus entry is worse than none: it makes the
      // summary line read as if something were protected.
      const KEYWORDS = new Set([
        "add", "alter", "column", "constraint", "create", "table", "primary",
        "unique", "foreign", "check", "default", "not", "references",
      ]);

      const columnFrom = (text) => {
        const stripped = text.replace(/^\s*ADD\s+(COLUMN\s+)?/i, " ");
        // The declaration is `name type`, and on a single-line definition it is
        // the LAST such pair before the keyword, not the first one on the line.
        // \b on both sides matters: without it the scan restarts inside a word and
        // pulls fragments like OT out of NOT NULL.
        const matches = [...stripped.matchAll(/\b([a-z_][a-z0-9_]*)\s+\b[a-z][a-z0-9_]*\b/gi)];
        for (const match of matches.reverse()) {
          const name = match[1].toLowerCase();
          if (!KEYWORDS.has(name)) return match[1];
        }
        return null;
      };

      const sameLine = columnFrom(line.split(/GENERATED\s+ALWAYS/i)[0]);
      if (sameLine) {
        generatedColumns.add(sameLine);
        return;
      }

      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const found = columnFrom(lines[cursor]);
        if (found) {
          generatedColumns.add(found);
          return;
        }
      }
    });
  }
}

if (generatedColumns.size === 0) {
  failures.push(
    "no GENERATED ALWAYS column was found in db/migrations. Either the schema changed or this " +
      "guard stopped parsing it; a guard that silently finds nothing protects nothing."
  );
}

const RUNTIME_SQL_DIRS = ["lib", "app/api"];
const collectSources = (dir) => {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSources(relative);
    return /\.(ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
};

for (const relative of RUNTIME_SQL_DIRS.flatMap(collectSources)) {
  const source = withoutComments(read(relative));
  for (const column of generatedColumns) {
    // `column =` is an assignment in SQL. A type declaration reads `column:`, so
    // the shapes that describe a row are not caught.
    if (new RegExp(`\\b${column}\\s*=\\s*\\$\\{|\\b${column}\\s*=\\s*[^=]`).test(source)) {
      failures.push(
        `${relative} assigns to ${column}, which migration 003 declares GENERATED ALWAYS. ` +
          `Postgres rejects the statement at runtime: let the database compute it.`
      );
    }
  }
}

// ---------------------------- 6. the end path trusts the cookie, not the body
//
// The bilan carries personal pedagogical data: confusions, mastery movement,
// response times. I-15 says no third party reads that, whatever its role. The end
// path first shipped reading `userId` out of the JSON body, so a caller declared
// who it was and was believed. The only identity this app has is the httpOnly
// guest cookie (lib/server/current-user.ts), which a caller cannot choose.
if (fs.existsSync(path.join(ROOT, END_ROUTE))) {
  const endRoute = read(END_ROUTE);
  if (!endRoute.includes("getCurrentUserId")) {
    failures.push(
      `${END_ROUTE} does not resolve the player from the guest cookie. The bilan exposes ` +
        `personal pedagogical state (I-15), so identity cannot come from the request body.`
    );
  }
  if (/userId:\s*body\.userId/.test(withoutComments(endRoute))) {
    failures.push(
      `${END_ROUTE} forwards a body-supplied userId to endTrainingSession. A caller must not ` +
        `be able to name whose session it closes and whose bilan it reads (I-15).`
    );
  }
}

// ----------------------------------------------------------------- report
if (failures.length > 0) {
  console.error("check:session-lifecycle FAILED\n");
  for (const failure of failures) {
    console.error(`  - ${failure}\n`);
  }
  process.exit(1);
}

console.log(
  "check:session-lifecycle OK : no round cap, answering never closes a session, " +
    "explicit end path present and pedagogy-free, no write to a generated column " +
    `(${[...generatedColumns].join(", ")}), identity read from the cookie, ` +
    "bilan maths verified on 5 synthetic rows."
);
