#!/usr/bin/env node

// Session sweep guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. A training session no longer closes itself on a round
// counter, so one left open stays open for ever: 73 were measured in that
// state on 2026-07-29, every one 'active'. The sweep that closes them is necessary,
// but as written it runs BEFORE the insert and matches every active training
// session of the user with no other predicate, which makes it a demolition
// charge: once one attempt equals one identifier (task 6), a plain page reload
// sends the same identifier back, the sweep marks that very session 'abandoned',
// the ON CONFLICT insert returns zero rows, the re-read sees a status that is
// not 'active', and the server mints a second session. The convergence would
// produce the duplicate it exists to remove, sequentially, with no concurrency
// at all.
//
// Three cumulative predicates, and the sweep AFTER the insert so the current
// session id exists to be excluded. Without all three, two concurrent starts
// abandon each other and leave ZERO active sessions, which is worse than the
// original defect.
//
// This script is standalone on purpose: it guards the sweep inside
// startTrainingSession and nothing else.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PROVIDER = "lib/game/training/provider.ts";
const failures = [];

const provider = fs.readFileSync(path.join(ROOT, PROVIDER), "utf8");

const startAt = provider.indexOf("export const startTrainingSession");
if (startAt === -1) {
  failures.push(`${PROVIDER}: no longer exports startTrainingSession.`);
} else {
  const nextExport = provider.indexOf("\nexport const ", startAt + 33);
  const fn = provider.slice(startAt, nextExport === -1 ? provider.length : nextExport);

  const sweepAt = fn.indexOf("UPDATE sessions AS s");
  const insertAt = fn.indexOf("INSERT INTO sessions");

  if (sweepAt === -1) {
    failures.push(`${PROVIDER}: startTrainingSession no longer contains the sweep (UPDATE sessions AS s).`);
  } else if (insertAt === -1) {
    failures.push(`${PROVIDER}: startTrainingSession no longer contains INSERT INTO sessions.`);
  } else {
    // 1. Position. The sweep must run after the insert, because the only sound
    //    way not to close the current session is to name it, and its id does not
    //    exist before the insert resolves.
    if (sweepAt < insertAt) {
      failures.push(
        `${PROVIDER}: the sweep runs BEFORE INSERT INTO sessions. It cannot exclude the current ` +
          "session because that session does not exist yet, so it abandons the very row the next " +
          "step is about to converge on."
      );
    }

    // 2. Content, bounded to the statement. Slicing to end of file would let
    //    `session_id <> ` be satisfied by the answer path at :1311 and the guard
    //    would be green before any fix.
    const end = provider.indexOf("`;", startAt + sweepAt);
    const sweep = provider.slice(startAt + sweepAt, end === -1 ? startAt + sweepAt : end);

    // Narrowed further, to the WHERE clause. The SET clause already computes
    // MAX(uef.event_ts_utc) to date ended_at, and has done so all along, so a
    // rule looking for it anywhere in the statement would be green before the
    // fix and could never fail. The inactivity predicate is a SECOND read of
    // that same maximum, in the WHERE.
    const whereAt = sweep.indexOf("WHERE s.user_id");
    const where = whereAt === -1 ? "" : sweep.slice(whereAt);

    const NEEDLES = [
      ["session_id <> ", "it can close the session that was just created or joined"],
      ["started_at < now() - interval", "it can close a session that is only seconds old"],
      ["30 minutes", "it has no age floor and no inactivity window"],
      ["MAX(uef.event_ts_utc)", "its WHERE clause never looks at the last answer, so it closes a session that is still being played in another tab"],
    ];
    for (const [needle, why] of NEEDLES) {
      if (!where.includes(needle)) {
        failures.push(`${PROVIDER}: the sweep's WHERE clause lacks ${needle}: ${why}.`);
      }
    }
  }

  // 3. The old justification is now false and must not survive as a comment: it
  //    claims safety comes from ordering, when it now comes from an explicit
  //    exclusion.
  if (fn.includes("before the new row exists so the new one is never caught by its own sweep")) {
    failures.push(
      `${PROVIDER}: the sweep still carries its old justification. Safety no longer comes from ` +
        "running before the insert, it comes from naming the current session in an exclusion."
    );
  }
}

if (failures.length > 0) {
  console.error("check:session-sweep FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  "check:session-sweep OK : the sweep runs after the insert, excludes the current session by id, " +
    "and closes only sessions older than 30 minutes with no event in the last 30 minutes."
);
