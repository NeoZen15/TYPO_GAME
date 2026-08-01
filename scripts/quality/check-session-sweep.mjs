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
// FIX ROUND 1. A first version of this guard tested the PRESENCE of four
// strings in the WHERE clause and nothing about their MEANING. A review
// defeated it nine times, all exit 0, three of them plausible rather than
// contrived: commenting the three added predicates out with `--` (a banal
// debugging gesture, which restores the original defect exactly); a second,
// differently-aliased `UPDATE sessions` statement added before the insert
// (invisible to a position rule that only ever looks for the FIRST `UPDATE
// sessions AS s`); and flipping `) < now()` to `) > now()` on the inactivity
// predicate, which closes sessions WITH recent activity, the opposite of what
// the rule claims to enforce. The other six: narrowing one of the two
// `interval '30 minutes'` bounds to something else while the OTHER clause's
// genuine 30 minutes kept a naive presence check green (inactivity window to 1
// second, or age floor to 0 minutes); excluding a constant uuid instead of the
// inserted session's own id; `s.session_id <> s.session_id`, always false,
// which matches no row at all; and dropping `s.mode = 'training'` or
// `s.status = 'active'` outright. Every rule below exists to close one of
// these nine, and the mutation harness in tmp/verify-task4 replays all nine.
//
// This guard also requires the sweep to run inside a try/catch: after task 4
// moved it AFTER the insert, it sits on the critical path with a committed
// sessions row behind it. A throw there, on a lock wait, a statement timeout,
// or a CHECK violation, must not take insertSessionStartEvent down with it: an
// orphan active session with no session_start event is a hole in the journal,
// exactly what this plan exists to close, and the sweep's own comment already
// argues it carries no pedagogical consequence, which is the argument for it
// being unable to break the request.
//
// This script is standalone on purpose: it guards the sweep inside
// startTrainingSession and nothing else.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PROVIDER = "lib/game/training/provider.ts";
const failures = [];

const provider = fs.readFileSync(path.join(ROOT, PROVIDER), "utf8");

// Strips SQL line comments (`-- ...` to end of line). Applied ONLY to the
// sweep's own SQL text, never to the surrounding TypeScript, so a `--` typed
// inside an unrelated JS comment elsewhere in the function is never at risk of
// being mistaken for one. Without this, commenting a predicate out leaves its
// literal text sitting in the file, which is enough to satisfy a rule that
// only checks for presence, while the predicate no longer runs at all.
const stripSqlComments = (text) =>
  text
    .split("\n")
    .map((line) => {
      const at = line.indexOf("--");
      return at === -1 ? line : line.slice(0, at);
    })
    .join("\n");

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

    // 1b. Exactly one `UPDATE sessions` statement in the whole function. The
    //     position rule above only ever locates the FIRST `UPDATE sessions AS
    //     s`: a second, earlier, differently-aliased (or unaliased) `UPDATE
    //     sessions` restores the original unconditional abandon while staying
    //     invisible to that rule. Counting is the only check immune to which
    //     copy the position rule happens to find.
    const updateSessionsCount = (fn.match(/UPDATE sessions\b/g) ?? []).length;
    if (updateSessionsCount !== 1) {
      failures.push(
        `${PROVIDER}: startTrainingSession contains ${updateSessionsCount} occurrence(s) of ` +
          '"UPDATE sessions", expected exactly 1. A second sweep statement, aliased ' +
          "differently or not at all, would restore the original defect (abandon every active " +
          "session of the user unconditionally) while a position rule that only ever finds the " +
          "first `UPDATE sessions AS s` never sees it."
      );
    }

    // 2. Content, bounded to the statement. Slicing to end of file would let
    //    `<> ${session.session_id}::uuid` be satisfied by the answer path
    //    elsewhere, and the guard would be green before any fix.
    const stmtEnd = fn.indexOf("`;", sweepAt);
    const sweepRaw = fn.slice(sweepAt, stmtEnd === -1 ? sweepAt : stmtEnd);
    // SQL comments stripped before any content check below: a predicate typed
    // then commented out with `--` does not run, and must not be able to
    // satisfy a rule that is checking whether it runs.
    const sweep = stripSqlComments(sweepRaw);

    // Narrowed further, to the WHERE clause. The SET clause already computes
    // MAX(uef.event_ts_utc) to date ended_at, and has done so all along, so a
    // rule looking for it anywhere in the statement would be green before the
    // fix and could never fail. The inactivity predicate is a SECOND read of
    // that same maximum, in the WHERE.
    const whereAt = sweep.indexOf("WHERE s.user_id");
    const where = whereAt === -1 ? "" : sweep.slice(whereAt);

    const NEEDLES = [
      [
        "AND s.mode = 'training'",
        "without it the sweep would abandon competition and expert sessions too, not only training",
      ],
      [
        "AND s.status = 'active'",
        "without it the sweep recomputes ended_at on sessions that are already closed",
      ],
      [
        "<> ${session.session_id}::uuid",
        "the exclusion must name the identifier the insert just returned: not a constant uuid, " +
          "not the column compared to itself (s.session_id <> s.session_id, which is always " +
          "false and excludes nothing), and not merely the substring 'session_id <> '",
      ],
      [
        "AND s.started_at < now() - interval '30 minutes'",
        "it can close a session that is only seconds old",
      ],
      [
        ") < now() - interval '30 minutes'",
        "the inactivity predicate's comparison must close on an interval BEFORE now: reversing " +
          "the operator (`) > now() - interval '30 minutes'`) closes only sessions WITH recent " +
          "activity, exactly backwards from what this rule exists to forbid",
      ],
    ];
    for (const [needle, why] of NEEDLES) {
      if (!where.includes(needle)) {
        failures.push(`${PROVIDER}: the sweep's WHERE clause lacks ${needle}: ${why}.`);
      }
    }

    // Exactly two occurrences of the 30-minute bound: one for the age floor,
    // one for the inactivity window. Narrowing either one alone (a 1-second
    // inactivity window, or a 0-minute age floor) while the OTHER clause still
    // legitimately carries "30 minutes" passes a simple "contains 30 minutes"
    // check; counting occurrences does not.
    const thirtyMinuteCount = (where.match(/interval '30 minutes'/g) ?? []).length;
    if (thirtyMinuteCount !== 2) {
      failures.push(
        `${PROVIDER}: the sweep's WHERE clause has ${thirtyMinuteCount} occurrence(s) of ` +
          '"interval \'30 minutes\'", expected exactly 2 (the age floor and the inactivity ' +
          "window). One of the two bounds has been narrowed to something else while the OTHER " +
          "clause's genuine 30 minutes kept a naive presence check green."
      );
    }

    // 3. The sweep must run inside a try/catch. It now sits on the critical
    //    path, after the sessions row has already committed: a throw here must
    //    never take insertSessionStartEvent down with it. Located relative to
    //    the statement itself (not searched across the whole function) so an
    //    unrelated try/catch elsewhere in startTrainingSession cannot satisfy
    //    this by accident.
    const beforeSweep = fn.slice(0, sweepAt);
    const tryAt = beforeSweep.lastIndexOf("try {");
    const TRY_WINDOW = 900;
    if (tryAt === -1 || sweepAt - tryAt > TRY_WINDOW) {
      failures.push(
        `${PROVIDER}: the sweep is not wrapped in a nearby try. A throw here (lock wait, ` +
          "statement timeout, chk_ended_after_started) would otherwise take the whole request " +
          "down after the sessions row has already committed, leaving an orphan active session " +
          "with no session_start event."
      );
    } else {
      const afterStmt = stmtEnd === -1 ? "" : fn.slice(stmtEnd, stmtEnd + 300);
      if (!/}\s*catch\s*\(/.test(afterStmt)) {
        failures.push(
          `${PROVIDER}: the sweep's try has no matching catch immediately after the statement.`
        );
      } else if (!/console\.warn/.test(afterStmt)) {
        failures.push(
          `${PROVIDER}: the sweep's catch block does not console.warn, so a failure would be ` +
            "silently swallowed instead of logged, same fail-safe shape as safeTrainingProgress, " +
            "safeReadVisibleLevel and safeRecomputeVisibleLevel."
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error("check:session-sweep FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  "check:session-sweep OK : the sweep runs after the insert inside a try/catch, excludes the " +
    "current session by its own id, and closes only sessions older than 30 minutes with no " +
    "event in the last 30 minutes."
);
