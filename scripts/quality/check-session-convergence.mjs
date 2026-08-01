#!/usr/bin/env node

// Session convergence guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. One attempt equals one identifier. The client mints a
// uuid per attempt and the server uses it as sessions.session_id, whose primary
// key already exists, so the database arbitrates the race and no schema
// changes. H1, proven by execution on 2026-07-31: the loser of
// INSERT ... ON CONFLICT (session_id) DO NOTHING blocks on the winner's
// transaction, returns zero rows, and its next read sees the committed row WITH
// THE WINNER'S SEED. H1b: if the winner rolls back, the loser inserts and
// becomes the winner. Self-healing both ways.
//
// THE SEED IS NOT OPTIONAL IN THE RE-READ. buildQuestion reads session.seed and
// the answer path writes it back into the fact, so a loser that kept its own
// seed would serve a word and a token that disagree.
//
// THE SHARP EDGE, which the first draft of this guard did not test at all. The
// re-read must sit exactly where the code takes the inserted row, therefore
// BEFORE the sweep. The loser returns zero rows, so a re-read placed after the
// sweep leaves the sweep's own exclusion clause reading session.session_id on
// an undefined value: a TypeError on every losing start, before anything useful
// happens. Rule 7 below is the only rule that catches that ordering, and it is
// the one defect the review of task 4 asked for by name.
//
// WHY EVERY RULE HERE STRIPS COMMENTS AND COUNTS. This repo has shipped guards
// that certified an empty migration file, that stayed green while the predicate
// they protected was commented out with `--`, and that stayed green while it
// was commented out with `/* ... */`. Worse, on this very path the provider's
// own documentation quotes the SQL it documents: the comment above
// startTrainingSession's insert literally contains the words
// "ON CONFLICT (session_id) DO NOTHING", so a presence check run over the raw
// file is green before a line of the implementation exists. Every rule below
// therefore runs on comment-stripped text, tests operators and literal
// identifiers rather than substrings, and counts occurrences.
//
// This script is standalone on purpose: it guards startTrainingSession, the
// start route and the start contract, nothing else.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PROVIDER = "lib/game/training/provider.ts";
const ROUTE = "app/api/training/session/start/route.ts";
const CONTRACTS = "lib/game/training/contracts.ts";
const failures = [];

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

// Strips JS comments, both forms. Block comments go first because they span
// lines, then line comments. Applied to a whole TypeScript region before any
// rule runs on it: without this pass, a rule that looks for the SQL it protects
// is satisfied by the prose that documents that SQL, and a field deleted from a
// type but left behind in a `/* attemptId?: string */` note still answers a
// presence check. The SQL inside these files lives in tagged templates and
// contains no `//` and no `/*`, so nothing load-bearing is removed.
const stripJsComments = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const at = line.indexOf("//");
      return at === -1 ? line : line.slice(0, at);
    })
    .join("\n");

// Strips SQL comments, both forms, from an already extracted statement only,
// never from surrounding TypeScript. A predicate typed then commented out does
// not run and must not be able to satisfy a rule that is checking whether it
// runs.
const stripSqlComments = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const at = line.indexOf("--");
      return at === -1 ? line : line.slice(0, at);
    })
    .join("\n");

const countOf = (haystack, needle) => haystack.split(needle).length - 1;

const provider = stripJsComments(read(PROVIDER));
const route = stripJsComments(read(ROUTE));
const contracts = stripJsComments(read(CONTRACTS));

// ---------------------------------------------------------------------------
// Rule 1 and 2 — the contract. attemptId must be a DECLARED FIELD of the start
// input, and it must have a validator, because the value crosses the network
// and lands on a `::uuid` cast: an unvalidated string raises 22P02 and turns a
// page load into a 500. The brief's own step 3 spells this out, "frappé par le
// serveur s'il est absent ou mal formé, jamais de 500".
// ---------------------------------------------------------------------------
if (!/attemptId\??\s*:/.test(contracts)) {
  failures.push(`${CONTRACTS}: the start input carries no attemptId.`);
}
const normalizerAt = contracts.indexOf("export const normalizeAttemptId");
if (normalizerAt === -1) {
  failures.push(
    `${CONTRACTS}: no exported normalizeAttemptId. The attempt identifier arrives from the ` +
      "client and is cast to ::uuid, so a malformed one raises 22P02 and the start route answers " +
      "500 on a plain page load. Validate it and mint a fresh one instead."
  );
} else {
  const normalizer = contracts.slice(normalizerAt, normalizerAt + 400);
  // The pattern itself is a module constant, so it is looked for in the file
  // rather than inside the function body; the `.test(` call below is what ties
  // the two together.
  if (!/\{8\}/.test(contracts) || !/\{12\}/.test(contracts)) {
    failures.push(
      `${CONTRACTS}: normalizeAttemptId does not check a uuid shape (no {8} / {12} groups in a ` +
        "pattern). A length check or a truthiness check is not a uuid check."
    );
  }
  if (!/\.test\(/.test(normalizer)) {
    failures.push(
      `${CONTRACTS}: normalizeAttemptId never runs a pattern test, so it validates nothing.`
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 3 and 4 — the route. It must forward a VALIDATED attempt identifier, and
// identity must keep coming from the httpOnly cookie and never from the body.
// Identity already does; that rule exists so a future rewrite cannot quietly
// take the user id from the payload while adding attemptId to it.
// ---------------------------------------------------------------------------
if (!/attemptId/.test(route)) {
  failures.push(`${ROUTE}: the start route does not accept an attemptId.`);
} else if (!/attemptId:\s*normalizeAttemptId\(/.test(route)) {
  failures.push(
    `${ROUTE}: the attemptId handed to startTrainingSession is not the output of ` +
      "normalizeAttemptId. Passing the raw body value through reaches a ::uuid cast unvalidated; " +
      "hardcoding null there makes every start mint a fresh identifier and removes the " +
      "convergence entirely while leaving the word attemptId in the file."
  );
}
if (/body\.(userId|guestUserId)/.test(route)) {
  failures.push(
    `${ROUTE}: reads an identity out of the request body. Identity comes from the httpOnly cookie, only the attempt identifier comes from the client.`
  );
}
if (!/cookies\(\)/.test(route) || !/GUEST_COOKIE_NAME/.test(route)) {
  failures.push(
    `${ROUTE}: no longer resolves the guest identity from the cookie store. The attempt ` +
      "identifier is the only thing the client is allowed to choose."
  );
}

// ---------------------------------------------------------------------------
// The provider, bounded to startTrainingSession. Every provider rule below runs
// on this slice and not on the file: endTrainingSession carries its own
// `AND mode = 'training'` and the sweep carries `AND s.mode = 'training'`, so a
// rule tested against the whole file would be green before the implementation
// starts, and a rule that cannot fail asserts nothing.
// ---------------------------------------------------------------------------
const startAt = provider.indexOf("export const startTrainingSession");
if (startAt === -1) {
  failures.push(`${PROVIDER}: no longer exports startTrainingSession.`);
} else {
  const nextExport = provider.indexOf("\nexport const ", startAt + 33);
  const fn = provider.slice(startAt, nextExport === -1 ? provider.length : nextExport);

  // -------------------------------------------------------------------------
  // Rule 5 — the convergence itself. Exactly one INSERT INTO sessions, and that
  // statement must supply session_id FROM THE MINTED IDENTIFIER. Supplying it
  // is the whole mechanism: sessions.session_id has DEFAULT gen_random_uuid(),
  // so an insert that leaves the column out can never collide, ON CONFLICT is
  // then unreachable dead syntax, and two starts still write two rows. That is
  // the defect, with the guard green.
  // -------------------------------------------------------------------------
  const insertCount = countOf(fn, "INSERT INTO sessions");
  if (insertCount !== 1) {
    failures.push(
      `${PROVIDER}: startTrainingSession contains ${insertCount} occurrence(s) of ` +
        '"INSERT INTO sessions", expected exactly 1. A second insert would write the duplicate ' +
        "row this task exists to remove, on a path where the first one converged."
    );
  }
  const insertAt = fn.indexOf("INSERT INTO sessions");
  // The statement ends at the NEXT BACKTICK, which is the closing backtick of
  // its own tagged template: `INSERT INTO sessions` already sits inside the
  // template, so no other backtick can come between. Round 1 of this guard
  // closed the slice on "`;" instead, copied from the sweep guard, where the
  // statement is `await sql`...`;`. This one is `queryRows<SessionRow>(sql`...`)`
  // and ends in "`);", so "`;" was not found until the SWEEP, six hundred
  // characters further down. The insert slice therefore swallowed the re-read
  // and the sweep, and the harness proved it: replacing the minted identifier
  // with a constant uuid stayed GREEN, because ${effectiveAttemptId} was still
  // present in the re-read the slice had absorbed, and dropping status from
  // RETURNING stayed GREEN for the same reason. Bounds are load-bearing.
  const insertEnd = insertAt === -1 ? -1 : fn.indexOf("`", insertAt);
  const insertRaw = insertAt === -1 ? "" : fn.slice(insertAt, insertEnd === -1 ? fn.length : insertEnd);
  const insert = stripSqlComments(insertRaw);

  const conflictCount = countOf(insert, "ON CONFLICT (session_id) DO NOTHING");
  if (conflictCount !== 1) {
    failures.push(
      `${PROVIDER}: startTrainingSession does not converge on sessions_pkey. Two starts still ` +
        "insert two rows, which is the whole defect."
    );
  }
  // Bounded to the column list, between the opening paren and VALUES. Tested
  // against the whole statement it would be satisfied by the RETURNING clause,
  // which names session_id too and always has: green before the fix.
  const valuesAt = insert.indexOf(") VALUES");
  const columnList = valuesAt === -1 ? "" : insert.slice(0, valuesAt);
  // Word-bounded, not comma-terminated: the column may legitimately be listed
  // last, where it carries no trailing comma, and a guard that turns red on a
  // reordered column list is a guard people switch off.
  if (!/\bsession_id\b/.test(columnList)) {
    failures.push(
      `${PROVIDER}: the insert does not name session_id in its column list. sessions.session_id ` +
        "defaults to gen_random_uuid(), so an insert that omits it never collides, the " +
        "ON CONFLICT clause becomes unreachable, and every start writes a new row."
    );
  }
  if (!/\$\{effectiveAttemptId\}::uuid/.test(insert)) {
    failures.push(
      `${PROVIDER}: the insert does not supply the minted identifier as session_id ` +
        "(${effectiveAttemptId}::uuid). Inserting any other value, or the column default, means " +
        "the two concurrent starts never contend for the same primary key and nothing converges."
    );
  }
  const returningAt = insert.indexOf("RETURNING");
  const returning = returningAt === -1 ? "" : insert.slice(returningAt);
  for (const column of ["session_id", "seed", "status", "question_count"]) {
    if (!returning.includes(column)) {
      failures.push(
        `${PROVIDER}: the insert's RETURNING clause does not project ${column}. Every value the ` +
          "start serves must come from the write itself, never from a read taken before it."
      );
    }
  }

  // -------------------------------------------------------------------------
  // Rule 6 — S4, the re-read, bounded to itself. Anything looked for in the
  // whole file would already be satisfied by endTrainingSession or by the sweep.
  // -------------------------------------------------------------------------
  // The re-read is extracted as a WHOLE TAGGED TEMPLATE, the first one after the
  // insert's closing backtick, and its SQL comments are stripped before anything
  // is looked for inside it. Slicing a raw window out of the function instead
  // let `-- AND mode = 'training'` keep a presence check green while the
  // predicate no longer ran; the harness proved that too. reReadOpen is also the
  // absolute position the ordering rule below compares against the sweep.
  const afterInsert = insertEnd === -1 ? -1 : insertEnd;
  const reReadOpen = afterInsert === -1 ? -1 : fn.indexOf("sql`", afterInsert);
  const reReadClose = reReadOpen === -1 ? -1 : fn.indexOf("`", reReadOpen + 4);
  const afterConflict =
    reReadOpen === -1
      ? ""
      : stripSqlComments(fn.slice(reReadOpen, reReadClose === -1 ? fn.length : reReadClose));
  const reReadAt = afterConflict.indexOf("WHERE session_id = ");
  if (reReadAt === -1) {
    failures.push(
      `${PROVIDER}: no re-read by session_id after the ON CONFLICT. The loser of the race returns ` +
        "zero rows and has nothing to serve."
    );
  } else {
    // 200 characters is the whole WHERE clause of that statement and nothing
    // else, so a mode filter belonging to endTrainingSession or to the sweep
    // cannot satisfy this rule by accident.
    const reRead = afterConflict.slice(reReadAt, reReadAt + 200);
    if (!/AND mode = 'training'/.test(reRead)) {
      failures.push(
        `${PROVIDER}: the S4 re-read is not scoped by mode. A competition session sharing the id ` +
          "would be served as a training session."
      );
    }
    if (!/AND user_id = /.test(reRead)) {
      failures.push(
        `${PROVIDER}: the S4 re-read is not scoped by user_id. A client that guesses an id would ` +
          "be handed someone else's session."
      );
    }
    if (!/\$\{effectiveAttemptId\}::uuid/.test(reRead)) {
      failures.push(
        `${PROVIDER}: the S4 re-read does not look the row up by the identifier the insert just ` +
          "contended for. Re-reading anything else rejoins the wrong session, or none."
      );
    }

    // The projection of that same statement, between its SELECT and its WHERE.
    const selectAt = afterConflict.lastIndexOf("SELECT", reReadAt);
    const projection = selectAt === -1 ? "" : afterConflict.slice(selectAt, reReadAt);
    if (!projection.includes("seed")) {
      failures.push(
        `${PROVIDER}: the S4 re-read does not select seed. buildQuestion reads it and the ` +
          "answer path writes it back into the fact, so a loser keeping its own seed serves " +
          "a word and a token that disagree."
      );
    }
    if (!projection.includes("status")) {
      failures.push(
        `${PROVIDER}: the S4 re-read does not select status, so it cannot tell a session it may ` +
          "rejoin from one that is already closed, and it would resurrect a completed session."
      );
    }

    // -----------------------------------------------------------------------
    // Rule 7 — THE ORDERING, the sharp edge. insert, then re-read, then sweep.
    // The sweep excludes the current session BY ID, and the loser of the
    // ON CONFLICT holds zero rows until the re-read fills them in: a re-read
    // placed after the sweep means the exclusion clause dereferences an
    // undefined row and throws a TypeError on every losing start. Positions,
    // not presence, are the only thing that can catch this.
    // -----------------------------------------------------------------------
    const sweepAt = fn.indexOf("UPDATE sessions");
    if (sweepAt !== -1 && reReadOpen > sweepAt) {
      failures.push(
        `${PROVIDER}: the S4 re-read sits AFTER the inactivity sweep. The loser of ` +
          "ON CONFLICT (session_id) DO NOTHING returns zero rows, so the sweep's exclusion " +
          "clause would read session.session_id off an undefined row and throw a TypeError " +
          "before the re-read ever runs. The re-read belongs exactly where the code takes the " +
          "inserted row, insertedSessions[0], which is before the sweep."
      );
    }
    if (sweepAt !== -1 && sweepAt < insertAt) {
      failures.push(
        `${PROVIDER}: the sweep runs BEFORE the insert, so it cannot exclude the current session ` +
          "and abandons the very row the re-read is about to rejoin. A page reload would then " +
          "mint a second session, which is the duplicate this task removes."
      );
    }
    if (!/insertedSessions\[0\]/.test(fn)) {
      failures.push(
        `${PROVIDER}: the inserted row is no longer taken from insertedSessions[0]. That ` +
          "expression is the anchor the re-read must replace, and the position rule above is " +
          "relative to it."
      );
    }
  }

  // -------------------------------------------------------------------------
  // Rule 8 — one converged start writes ONE session_start event. Task 5 made
  // that writer idempotent on (user_id, session_id, idempotency_key), so a
  // second call would be a no-op, but calling it once is what makes the
  // intention legible and saves a round trip on the losing branch.
  // -------------------------------------------------------------------------
  const eventCalls = countOf(fn, "insertSessionStartEvent(");
  if (eventCalls !== 1) {
    failures.push(
      `${PROVIDER}: startTrainingSession calls insertSessionStartEvent ${eventCalls} time(s), ` +
        "expected exactly 1, with the effective identifier. Zero leaves an active session with " +
        "no session_start event, a hole in the append-only journal; two is a pointless round " +
        "trip that only the task 5 CTE saves from writing a duplicate."
    );
  }
  // And that one call belongs to the winner only, gated by a flag taken from the
  // INSERT's OWN RETURNING. Nothing read before or after the write can tell the
  // winner from the loser: after both calls have run, the row simply exists, and
  // a flag derived from "does a row exist now" is true for both. This is the
  // lesson the whole plan keeps paying for, applied to the one flag this task
  // introduces.
  if (!/wonTheInsert\s*=\s*insertedSessions\.length > 0/.test(fn)) {
    failures.push(
      `${PROVIDER}: the winner flag is not derived from the insert's own RETURNING row count ` +
        "(wonTheInsert = insertedSessions.length > 0). Any flag taken from a read instead is true " +
        "for the loser as well, because by then the row exists either way."
    );
  }
  if (!/if \(wonTheInsert\) \{\s*await insertSessionStartEvent\(/.test(fn)) {
    failures.push(
      `${PROVIDER}: insertSessionStartEvent is not gated by wonTheInsert. The loser rejoined a ` +
        "session whose session_start the winner already wrote; writing it again is a round trip " +
        "that only task 5's CTE saves from becoming a duplicate journal line."
    );
  }

  // -------------------------------------------------------------------------
  // Rule 9 — the re-entry must be bounded, and it must re-enter the INSERT
  // ONLY. An unbounded retry on a permanently non-active id spins for ever, and
  // re-entering the identity or the pool step would undo the pinning this task
  // exists to create. Counting the two calls is what proves the pinning: one
  // getGuestUser, one ensureUserPool, both before the insert.
  // -------------------------------------------------------------------------
  if (!/attemptsLeft|reentered|retriedOnce/.test(fn)) {
    failures.push(
      `${PROVIDER}: no visible bound on the re-entry. Mint-once-and-retry must be limited to a ` +
        "single extra attempt, and it must re-enter the insert only, never the identity or the pool."
    );
  }
  if (/while\s*\(\s*true\s*\)/.test(fn) || /for\s*\(\s*;\s*;/.test(fn)) {
    failures.push(
      `${PROVIDER}: startTrainingSession contains an unbounded loop. A start that keeps failing ` +
        "to reach an active row must raise, never spin."
    );
  }
  if (!/crypto\.randomUUID\(\)/.test(fn)) {
    failures.push(
      `${PROVIDER}: the server never mints an identifier of its own. It has to, twice over: when ` +
        "the client sends none or a malformed one, and when the single re-entry needs a fresh id."
    );
  }
  for (const [call, why] of [
    ["getGuestUser(", "identity is resolved once and pinned; a second resolution inside the retry could hand the second attempt a different user"],
    ["ensureUserPool(", "the pool is seeded once, before the session row; re-entering it on a retry re-runs init_user_pool for nothing and re-enters the serialised path task 3 built"],
  ]) {
    const calls = countOf(fn, call);
    if (calls !== 1) {
      failures.push(
        `${PROVIDER}: startTrainingSession calls ${call.slice(0, -1)} ${calls} time(s), expected ` +
          `exactly 1: ${why}.`
      );
    } else if (insertAt !== -1 && fn.indexOf(call) > insertAt) {
      failures.push(
        `${PROVIDER}: ${call.slice(0, -1)} is called AFTER the session insert. Step order is ` +
          "identity, pool, onboarding, then the insert."
      );
    }
  }
  // recordOnboardingFamiliarity is untouched by this task and must stay that
  // way: it writes the onboarding answer, it has nothing to do with the
  // convergence, and a literal implementer following the step list has already
  // deleted it once.
  if (countOf(fn, "recordOnboardingFamiliarity(") !== 1) {
    failures.push(
      `${PROVIDER}: recordOnboardingFamiliarity is no longer called exactly once from ` +
        "startTrainingSession. It is out of scope for the convergence and must keep its place, " +
        "still conditioned on a non-null familiarity."
    );
  }

  // -------------------------------------------------------------------------
  // Rule 10 — everything served comes from the row the write returned, never
  // from the request. If the payload echoed the requested identifier, a start
  // that re-entered on a fresh id, or a loser rejoining a row it did not
  // insert, would hand the client an id that is not the session it is playing.
  // -------------------------------------------------------------------------
  if (!/sessionId:\s*session\.session_id/.test(fn)) {
    failures.push(
      `${PROVIDER}: the payload's sessionId is not read off the session row. It must be the ` +
        "effective identifier the database arbitrated, not the one the client asked for."
    );
  }
  if (!/insertSessionStartEvent\(\s*session\.session_id/.test(fn)) {
    failures.push(
      `${PROVIDER}: insertSessionStartEvent is not called with session.session_id. Writing the ` +
        "requested identifier instead would point the journal at a session row that may not exist."
    );
  }
  if (!/session\.seed/.test(fn)) {
    failures.push(
      `${PROVIDER}: the question is not built from session.seed. The local seed variable is the ` +
        "one the LOSER generated and never wrote; only the returned row carries the seed the " +
        "database kept."
    );
  }
}

if (failures.length > 0) {
  console.error("check:session-convergence FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  "check:session-convergence OK : the start path takes an attemptId, converges on sessions_pkey, " +
    "and its re-read is scoped by session, user and mode, selects the winner's seed, and re-enters " +
    "at most once."
);
