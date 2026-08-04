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
// THE LIMIT OF THE GUARANTEE, so nobody reads more into it than it says.
// Convergence holds while the shared identifier points at an ACTIVE row or at
// NOTHING. It does not hold when the shared identifier points at a NON-ACTIVE
// row: two concurrent starts replaying yesterday's uuid, two tabs at once, both
// lose the insert, both re-read a closed row, both mint their own fresh uuid,
// and the sweep's thirty minute age floor stops them abandoning each other. Two
// active sessions result. That is step 6 of the brief behaving as written, not a
// defect: a closed session must never be resurrected, and the alternative would
// be to serve one tab a session the other tab owns. The sequential form of that
// case is measured (scenario C of tmp/prove-convergence.mjs); the concurrent
// form is stated here rather than measured, and it is the honest boundary of
// "one attempt equals one identifier".
//
// FIX ROUND 1. A review defeated the first version of this guard five times, all
// compiling, two of them reintroducing exactly the defects the header above
// claims to protect. Every rule marked "round 1" below closes one of them:
//   D1  `if (candidate && candidate.status === "active")` reduced to
//       `if (candidate)`, which resurrects a completed or abandoned session and
//       deletes step 6 of the brief in silence. No rule required the gate.
//   D2  the in-loop `effectiveAttemptId = crypto.randomUUID()` deleted, so the
//       single re-entry replays the SAME identifier and is useless. The rule
//       only required the string crypto.randomUUID() somewhere, and the
//       initialiser already satisfied it.
//   D3  MAX_START_REENTRIES raised to 10000. The constant sits BEFORE
//       `export const startTrainingSession`, therefore outside the inspected
//       slice: 10001 inserts, invisible.
//   D5  `session.seed = seed;` inserted before getPoolRows. The loser then
//       serves a word and a signed token derived from a seed that was never
//       written, and the resulting fact row's display_word and seed contradict
//       each other. Rule 10 only checked that session.seed was PRESENT, which
//       stays true after an overwrite.
//   D8  in the route, `normalizeAttemptId(body.attemptId)` becomes
//       `normalizeAttemptId(undefined)`: convergence removed on the wire while
//       the word attemptId still appears in the file.
// The same review also found rule 7 firing through the WRONG rule on the very
// case it was written for: with the sweep moved above the re-read, the first
// `sql` template after the insert IS the sweep, so `reReadOpen` pointed at it,
// `reReadOpen > sweepAt` could never hold, and rule 6 reported "no re-read by
// session_id after the ON CONFLICT", which is false, the re-read exists and is
// merely misplaced. reReadOpen is now computed on the template that actually
// contains the re-read's WHERE clause, whichever position it occupies.
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
// WHAT THIS GUARD DELEGATES, AND TO WHOM. Stated because a guard that silently
// leans on a neighbour is a guard whose scope nobody can know. An attacker found
// eight further mutations that defeat THIS file and are all caught by siblings,
// which is defence in depth working, not a hole, but only if the boundary is
// written down. Do not add those rules here; they would drift out of step with
// the file that owns them.
//   - The inactivity sweep's six predicates, its position after the insert, its
//     exclusion by identifier and its try/catch: owned by
//     scripts/quality/check-session-sweep.mjs. This file asserts only WHERE the
//     sweep sits relative to the insert and the re-read (assertion F below),
//     because that ordering is the convergence's own business.
//   - The session_start and session_end writers, their event_ingestion_guard CTE,
//     its conflict target and the idempotency keys: owned by
//     scripts/quality/check-event-writers.mjs. This file asserts only that the
//     start writer is called once, with the row's own identifier, and only by the
//     call that created the row.
//   - init_user_pool, the per-user advisory lock and the stuck-pool path: owned by
//     scripts/quality/check-pool-serialisation.mjs. This file asserts only that
//     ensureUserPool is called exactly once and before the insert.
//   - The client's minting of one identifier per attempt: owned by
//     scripts/quality/check-client-attempt-contract.mjs.
// All seven guards of this plan are wired into `npm run quality` since
// 2026-08-04; this one is step 16 of 25. A red here means the convergence
// contract; a red there means its neighbours.
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
  // ROUND 1, defeat D8. The rule above is satisfied by
  // `normalizeAttemptId(undefined)`, which validates a value that never came
  // from anywhere: every start then mints a fresh identifier, the convergence is
  // gone on the wire, and the word attemptId is still in the file. The argument
  // has to come from the REQUEST BODY, literally, because that is the only place
  // the client's identifier can enter the process.
} else if (!/normalizeAttemptId\(body\.attemptId\)/.test(route)) {
  failures.push(
    `${ROUTE}: normalizeAttemptId is not called on body.attemptId. Validating a value that did ` +
      "not come from the request body (undefined, a constant, a variable that is never assigned) " +
      "leaves every start minting a fresh identifier: the convergence is removed on the wire " +
      "while the word attemptId stays in the file."
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
  // ROUND 1, defeat D3. The slice starts at the RE-ENTRY BOUND when the bound is
  // declared just above the function, not at the export. The bound is a module
  // constant, so a slice that began at `export const startTrainingSession` left
  // it outside every rule below: raising it to 10000 made 10001 inserts possible
  // and the guard never looked. Nothing else changes, the constant declaration is
  // the only code between the two offsets and it adds no statement, no call and
  // no SQL that any count or position rule could be thrown off by.
  const boundAt = provider.lastIndexOf("const MAX_START_REENTRIES", startAt);
  const regionStart = boundAt === -1 ? startAt : boundAt;
  const fn = provider.slice(regionStart, nextExport === -1 ? provider.length : nextExport);

  // -------------------------------------------------------------------------
  // ROUND 2. THE VALUE LAYER. Everything below this point stops matching shapes
  // and starts asserting properties, because round 1 was defeated five times by
  // an attacker who simply moved one notch over from each hole that had been
  // closed for one specific instance: a rule that pinned `.seed` was walked
  // around with `.status`, a rule that pinned how a flag is DERIVED was walked
  // around by REASSIGNING it, a rule that proved a correct gate EXISTS was
  // walked around by appending a second, ungated one. Enumerating instances
  // cannot win that game. Four assertions about the value now replace eleven
  // rules about the text.
  //
  // fnCode is the slice with every SQL template blanked. The assignment analysis
  // has to run on it and not on fn: the sweep's WHERE clause contains
  // `AND s.status = 'active'`, which is a comparison in SQL and would read as a
  // field assignment in JavaScript. Blanking the templates is what lets one
  // assertion forbid writes to every field of the row without turning red on the
  // SQL that legitimately compares those same fields.
  // -------------------------------------------------------------------------
  const fnCode = fn.replace(/sql`[^`]*`/g, "sql``");

  // The two row variables are found BY STRUCTURE, never by name: the served
  // session by its type annotation, the candidate row by the anchor expression
  // the whole re-read is built around. A pure rename of either local, which
  // changes no behaviour, turned round 1's guard red on four rules; probe P08
  // now holds that line.
  const sessionVarMatch = fnCode.match(/let\s+(\w+)\s*:\s*SessionRow\s*\|\s*undefined/);
  const rowVarMatch = fnCode.match(/let\s+(\w+)\s*=\s*insertedSessions\[0\]/);
  const SESSION = sessionVarMatch ? sessionVarMatch[1] : null;
  const ROW = rowVarMatch ? rowVarMatch[1] : null;

  if (!SESSION) {
    failures.push(
      `${PROVIDER}: no \`let <name>: SessionRow | undefined\` declaration in startTrainingSession. ` +
        "The served session must be a single declared slot, filled once, so that every rule below " +
        "can follow the value instead of guessing at a name."
    );
  }
  if (!ROW) {
    failures.push(
      `${PROVIDER}: no \`let <name> = insertedSessions[0]\` in startTrainingSession. That ` +
        "expression is the anchor of the whole re-read: it is where the winner's row is taken and " +
        "where the loser's zero rows are detected."
    );
  }

  // Every assignment to a bare identifier, with its right-hand side. Excludes
  // ==, ===, => and the compound operators, which are not assignments of a new
  // value from outside.
  const assignmentsTo = (name) => {
    const matches = [...fnCode.matchAll(new RegExp(`\\b${name}\\s*=(?!=|>)([^;\\n]*)`, "g"))];
    return matches.map((match) => match[1].trim());
  };
  const ROW_SOURCE = /^[A-Za-z_$][\w$]*\[0\]$/;

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
  // The re-read is extracted as a WHOLE TAGGED TEMPLATE, and its SQL comments are
  // stripped before anything is looked for inside it. Slicing a raw window out of
  // the function instead let `-- AND mode = 'training'` keep a presence check
  // green while the predicate no longer ran; the harness proved that.
  //
  // ROUND 1. It is the template that CONTAINS the re-read's WHERE clause, not the
  // first template after the insert. Taking the first one was a real defect, and
  // it disabled the one rule this guard exists for: with the sweep moved above
  // the re-read, the first template after the insert IS the sweep, so reReadOpen
  // pointed at the sweep, `reReadOpen > sweepAt` could never hold, rule 7 stayed
  // silent, and rule 6 reported "no re-read by session_id after the ON CONFLICT",
  // which is false. The re-read existed; it was in the wrong place, which is a
  // different failure with a different fix. Scanning every template and keeping
  // the one that actually holds `WHERE session_id = ` makes reReadOpen the true
  // position wherever it sits.
  const sqlTemplates = [];
  let cursor = insertEnd === -1 ? 0 : insertEnd;
  while (cursor < fn.length) {
    const open = fn.indexOf("sql`", cursor);
    if (open === -1) break;
    const close = fn.indexOf("`", open + 4);
    const end = close === -1 ? fn.length : close;
    sqlTemplates.push({ open, text: stripSqlComments(fn.slice(open, end)) });
    cursor = end + 1;
  }
  const reReadTemplate = sqlTemplates.find((template) => template.text.includes("WHERE session_id = "));
  const reReadOpen = reReadTemplate ? reReadTemplate.open : -1;
  const afterConflict = reReadTemplate ? reReadTemplate.text : "";
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
    // The two branches are EXCLUSIVE, and the "before the insert" case is tested
    // first: a sweep moved above the insert is also above the re-read, so a
    // non-exclusive pair would report both, and the second, vaguer diagnosis
    // would bury the precise one.
    const sweepAt = fn.indexOf("UPDATE sessions");
    if (sweepAt !== -1 && sweepAt < insertAt) {
      failures.push(
        `${PROVIDER}: the sweep runs BEFORE the insert, so it cannot exclude the current session ` +
          "and abandons the very row the re-read is about to rejoin. A page reload would then " +
          "mint a second session, which is the duplicate this task removes."
      );
    } else if (sweepAt !== -1 && reReadOpen > sweepAt) {
      failures.push(
        `${PROVIDER}: the S4 re-read sits AFTER the inactivity sweep. The loser of ` +
          "ON CONFLICT (session_id) DO NOTHING returns zero rows, so the sweep's exclusion " +
          "clause would read session.session_id off an undefined row and throw a TypeError " +
          "before the re-read ever runs. The re-read belongs exactly where the code takes the " +
          "inserted row, insertedSessions[0], which is before the sweep."
      );
    }
    // -----------------------------------------------------------------------
    // ASSERTION A, one acceptance and one only. Round 1 proved that a CORRECT
    // gate existed; it never proved that no OTHER branch accepts. Defeat E1
    // appended an ungated `session = candidate;` after the gate and walked
    // straight through. The property is not "a good gate is present" but "the
    // served slot is written exactly once, from the row that passed the gate":
    // a single exit, which is what makes the gate the only way in.
    //
    // This also closes defeat B2, where a fallback object made the re-read dead
    // code and the loser fabricated its own row: the source of the served slot
    // has to be the candidate variable, never a literal.
    // -----------------------------------------------------------------------
    if (SESSION && ROW) {
      const sessionWrites = assignmentsTo(SESSION);
      if (sessionWrites.length !== 1) {
        failures.push(
          `${PROVIDER}: the served session slot is written ${sessionWrites.length} time(s), ` +
            "expected exactly 1. More than one write means a second branch can accept a row the " +
            "status gate never approved, which is how a completed session gets resurrected while " +
            "a correct gate sits right above, still passing its own rule. Zero means nothing is " +
            "ever served."
        );
      } else if (sessionWrites[0].replace(/;$/, "").trim() !== ROW) {
        failures.push(
          `${PROVIDER}: the served session is assigned from \`${sessionWrites[0]}\` instead of the ` +
            `candidate row \`${ROW}\`. Anything else, and above all an object literal, hands the ` +
            "player a row the database never returned: a fabricated seed, a fabricated status, and " +
            "a re-read that has become dead code."
        );
      }
      if (
        !new RegExp(`\\.status === "active"\\s*\\)\\s*\\{\\s*${SESSION}\\s*=`).test(fnCode)
      ) {
        failures.push(
          `${PROVIDER}: the rejoined row is not gated on status === "active" before it becomes the ` +
            "served session. Without that gate a replayed identifier resurrects a completed or " +
            "abandoned session instead of minting a new one, and the re-entry of step 6 never runs."
        );
      }

      // ASSERTION B, the candidate row always comes out of a query result.
      // Every write to it must be `<something>[0]`, the first row of a result
      // set. That is what makes the re-read the only alternative to the insert,
      // and it is the general form of defeat B2.
      const rowWrites = assignmentsTo(ROW);
      if (rowWrites.length !== 2) {
        failures.push(
          `${PROVIDER}: the candidate row is written ${rowWrites.length} time(s), expected exactly ` +
            "2: once from the insert's RETURNING, once from the S4 re-read. Fewer means one of the " +
            "two paths is gone; more means a third source of truth nobody arbitrated."
        );
      }
      for (const write of rowWrites) {
        const rhs = write.replace(/;$/, "").trim();
        if (!ROW_SOURCE.test(rhs)) {
          failures.push(
            `${PROVIDER}: the candidate row is assigned from \`${rhs}\`, which is not the first row ` +
              "of a query result. A fallback object, a default, or anything computed locally makes " +
              "the S4 re-read dead code and lets the loser serve a row it invented, with a seed the " +
              "database never stored."
          );
        }
      }

      // ASSERTION C, the row objects are READ-ONLY on this path. One assertion
      // instead of the two instance rules round 1 shipped (`.seed =` and the
      // spread rebuild), and it covers `.status`, `.question_count`,
      // `.session_id` and every field this type has yet to grow. Defeat G1
      // forced `.status` to "active" precisely because only `.seed` was named.
      const FIELD_WRITE = new RegExp(`\\b(?:${SESSION}|${ROW})\\.(\\w+)\\s*=(?!=)`);
      const fieldWrite = fnCode.match(FIELD_WRITE);
      if (fieldWrite) {
        failures.push(
          `${PROVIDER}: something assigns to \`.${fieldWrite[1]}\` on a row the database returned. ` +
            "Those rows are read-only here. Overwriting a field is the whole defect this task " +
            "removes, whichever field it is: forced to 'active' it resurrects a closed session, " +
            "and a rewritten seed makes the served word and the signed token disagree with the " +
            "fact row the answer path records."
        );
      }
      // The same property reached from the other side, keyed on the row's own
      // columns rather than on the two locals, so mutating an array element in
      // place (insertedSessions[0].status = ...) is caught too.
      const columnWrite = fnCode.match(/\.(session_id|user_id|seed|question_count|status)\s*=(?!=)/);
      if (columnWrite) {
        failures.push(
          `${PROVIDER}: something assigns to the row column \`.${columnWrite[1]}\`. Every value the ` +
            "start serves must be the one the write returned; assigning into the result set is the " +
            "same defect as assigning into the row variable, taken one step earlier."
        );
      }
      if (new RegExp(`\\{\\s*\\.\\.\\.\\s*(?:${SESSION}|${ROW})\\b`).test(fnCode)) {
        failures.push(
          `${PROVIDER}: a row returned by the database is rebuilt by spread. Same defect as an ` +
            "assignment into it: the served values stop being the ones the database kept."
        );
      }
      if (new RegExp(`Object\\.assign\\(\\s*(?:${SESSION}|${ROW})\\b`).test(fnCode)) {
        failures.push(
          `${PROVIDER}: Object.assign writes into a row the database returned. Same defect as a ` +
            "field assignment, spelled differently."
        );
      }
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
  // ASSERTION D, round 2, defeat G2. Deriving a value correctly is worth nothing
  // if the same value can be REASSIGNED two lines later: the attacker set
  // `wonTheInsert = true;` immediately under its own guarded derivation and
  // restored M38 with the derivation rule still passing. So the property is the
  // whole life of the flag, not the one line that computes it: it is written
  // exactly twice, once to false at its declaration and once from the insert's
  // own RETURNING row count, and never again.
  const flagWrites = assignmentsTo("wonTheInsert");
  const derivations = flagWrites.filter(
    (write) => write.replace(/;$/, "").trim() === "insertedSessions.length > 0"
  );
  const initialisers = flagWrites.filter((write) => write.replace(/;$/, "").trim() === "false");
  if (derivations.length !== 1 || initialisers.length !== 1 || flagWrites.length !== 2) {
    failures.push(
      `${PROVIDER}: the winner flag is written ${flagWrites.length} time(s) ` +
        `(${initialisers.length} initialiser(s) to false, ${derivations.length} derivation(s) from ` +
        "insertedSessions.length > 0), expected exactly one of each and nothing else. A flag " +
        "derived correctly and then reassigned is a flag that lies: any value taken from a read, " +
        "or forced to true afterwards, is true for the loser as well, because by then the row " +
        "exists either way, and the loser rewrites a journal line the winner already wrote."
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
  // ASSERTION E, round 2, defeat C2. THE LOOP IS SIMULATED, not pattern matched.
  // Changing the step from `-= 1` to `-= 2` left every token the round 1 rules
  // searched for exactly where it was, and killed the re-entry outright: the
  // first pass mints a fresh identifier, the counter jumps past the condition,
  // the second pass never runs, and the whole mechanism is silently dead. No
  // amount of token matching sees that. Counting the passes does.
  //
  // The header is parsed, the bound is resolved to its numeric value, and the
  // loop is executed arithmetically here. The property asserted is the one the
  // brief states: exactly TWO passes, exactly ONE mint, and the mint on the pass
  // that is NOT the last, which together are what "one extra attempt, and the
  // retry actually runs" means.
  //
  // A deliberate and disclosed constraint follows: the re-entry must be a
  // counted `for` loop whose passes can be decided statically. That is what
  // makes the assertion possible, so `while (true)`, `for (;;)` and any header
  // this parser cannot read are refused BY THIS RULE rather than by a separate
  // ban on unbounded loops. It also subsumes the bound-value rule, since a bound
  // of 10000 simply counts 10001 passes.
  // -------------------------------------------------------------------------
  const header = fnCode.match(/for \(let (\w+) = ([^;]+); ([^;]+); ([^)]+)\)/);
  const loopFailure = (why) =>
    failures.push(
      `${PROVIDER}: the re-entry loop ${why}. It must be a counted for loop that runs exactly two ` +
        "passes and mints exactly one fresh identifier, on the first pass: one attempt, one extra " +
        "attempt, then an explicit error. A loop this rule cannot count is refused on purpose, " +
        "because a bound nobody can evaluate is not a bound."
    );
  if (!header) {
    loopFailure("is not a `for (let <counter> = <bound>; <test>; <step>)` header this rule can read");
  } else {
    const [, counter, initExpr, condExpr, stepExpr] = header.map((part) => part.trim());
    const literal = /^-?\d+$/.test(initExpr)
      ? Number(initExpr)
      : (() => {
          const declared = fnCode.match(new RegExp(`\\b${initExpr}\\s*=\\s*(-?\\d+)`));
          return declared ? Number(declared[1]) : null;
        })();
    const cond = condExpr.match(new RegExp(`^${counter}\\s*(>=|>|<=|<)\\s*(-?\\d+)$`));
    const step =
      stepExpr === `${counter}--`
        ? 1
        : (stepExpr.match(new RegExp(`^${counter}\\s*-=\\s*(\\d+)$`)) ??
            stepExpr.match(new RegExp(`^${counter}\\s*=\\s*${counter}\\s*-\\s*(\\d+)$`)))?.[1];
    const mint = fnCode.match(new RegExp(`if \\(${counter}\\s*(>=|>)\\s*(-?\\d+)\\)`));

    if (literal === null) loopFailure(`starts from \`${initExpr}\`, which resolves to no numeric bound`);
    else if (!cond) loopFailure(`tests \`${condExpr}\`, which this rule cannot evaluate`);
    else if (step === undefined) loopFailure(`steps by \`${stepExpr}\`, which is not a decrement of a fixed size`);
    else if (!mint) loopFailure("has no `if (counter > n)` branch around the fresh-identifier mint");
    else {
      const compare = (left, operator, right) =>
        operator === ">=" ? left >= right : operator === ">" ? left > right : operator === "<=" ? left <= right : left < right;
      let value = literal;
      let passes = 0;
      let mints = 0;
      let mintedOnLastPass = false;
      while (compare(value, cond[1], Number(cond[2])) && passes < 100) {
        passes += 1;
        const mintsHere = compare(value, mint[1], Number(mint[2]));
        if (mintsHere) mints += 1;
        value -= Number(step);
        mintedOnLastPass = mintsHere;
      }
      if (passes !== 2 || mints !== 1 || mintedOnLastPass) {
        loopFailure(
          `runs ${passes >= 100 ? "100 or more" : passes} pass(es) and mints ${mints} fresh ` +
            `identifier(s)${mintedOnLastPass ? ", the last of them on its final pass" : ""}, ` +
            "expected 2 passes and 1 mint on the first of them. One pass means the retry never " +
            "executes and the whole re-entry is dead code while every token still reads correctly; " +
            "more than two means one start hammers the same primary key that many times; a mint on " +
            "the last pass means an identifier is minted and then never used"
        );
      }
    }
  }
  // ROUND 1, defeat D2. Counting, not presence. The server mints an identifier
  // in TWO places, and they are not interchangeable: once in the initialiser,
  // when the client sends none or a malformed one, and once inside the loop, so
  // that the single re-entry contends for a DIFFERENT key. Deleting the second
  // one leaves the first satisfying a presence check while the re-entry replays
  // the identifier that just failed, which makes the whole retry a no-op. The
  // assignment form is required as well as the count, because it is the one that
  // says the fresh identifier actually replaces the old one.
  const mintCount = countOf(fn, "crypto.randomUUID()");
  if (mintCount !== 2) {
    failures.push(
      `${PROVIDER}: startTrainingSession mints ${mintCount} identifier(s) with ` +
        "crypto.randomUUID(), expected exactly 2: one in the initialiser, for a client that sent " +
        "none or a malformed one, and one inside the loop, so the single re-entry contends for a " +
        "different key. Zero means the server can never mint; one means the re-entry replays the " +
        "identifier that just failed and is a no-op."
    );
  }
  if (!/effectiveAttemptId = crypto\.randomUUID\(\)/.test(fn)) {
    failures.push(
      `${PROVIDER}: the re-entry does not assign a freshly minted identifier to ` +
        "effectiveAttemptId. Re-entering the insert with the same identifier disputes the same " +
        "primary key a second time and loses again, for nothing."
    );
  }
  // The three rules that stood here in round 1 are GONE, deleted rather than
  // kept alongside: the bound's numeric value, the loop counter's initialisation
  // from that bound, and the ban on unbounded loops. Assertion E decides all
  // three by counting passes, and it decides them better, because it also catches
  // the step size that no value check could see. A smaller guard that asserts the
  // property beats a larger one that enumerates its symptoms.
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
  // The three rules below name the SERVED SLOT through the variable discovered by
  // structure, never through the string "session". A pure rename of that local,
  // which changes nothing at all, turned four rules of round 1 red at once. The
  // two rules that used to sit under these three, forbidding `.seed =` and
  // `{ ...session }`, are DELETED: assertion C above forbids writes to every
  // field of both rows, by variable and by column name, which is the class those
  // two were one instance each of.
  if (SESSION) {
    if (!new RegExp(`sessionId:\\s*${SESSION}\\.session_id`).test(fnCode)) {
      failures.push(
        `${PROVIDER}: the payload's sessionId is not read off the session row. It must be the ` +
          "effective identifier the database arbitrated, not the one the client asked for."
      );
    }
    if (!new RegExp(`insertSessionStartEvent\\(\\s*${SESSION}\\.session_id`).test(fnCode)) {
      failures.push(
        `${PROVIDER}: insertSessionStartEvent is not called with the session row's own session_id. ` +
          "Writing the requested identifier instead would point the journal at a session row that " +
          "may not exist."
      );
    }
    if (!new RegExp(`buildQuestion\\([^)]*${SESSION}\\.seed`).test(fnCode)) {
      failures.push(
        `${PROVIDER}: the question is not built from the session row's own seed. The local seed ` +
          "variable is the one the LOSER generated and never wrote; only the returned row carries " +
          "the seed the database kept."
      );
    }
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
