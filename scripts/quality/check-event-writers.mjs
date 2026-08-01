#!/usr/bin/env node

// Event writer atomicity guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. The engine runs on autocommit statements through the
// HTTP driver, so a guard row and its event written as two statements can end
// up divorced: the guard says the event was ingested and the event is not
// there, or the reverse. H2, proven by execution on 2026-07-31, says the CTE
// form (WITH g AS (INSERT INTO event_ingestion_guard ... ON CONFLICT DO NOTHING
// RETURNING 1) INSERT INTO user_event_fact ... SELECT ... FROM g) is atomic:
// one guard row, one event, never a divorce, in a single statement.
//
// WHY NOT ON CONFLICT ON user_event_fact ITSELF. That table is PARTITIONED BY
// RANGE (event_ts_utc), and Postgres requires a unique index on a partitioned
// table to carry the partition key: the only one is uq_event_id (event_id,
// event_ts_utc). There is no unique constraint on idempotency_key alone, so
// `ON CONFLICT (idempotency_key)` raises 42P10. Verified on a throwaway Neon
// branch on 2026-07-29. The uniqueness therefore has to live in
// event_ingestion_guard, whose primary key IS (user_id, session_id,
// idempotency_key), db/migrations/001_user_event_fact.sql:13-23.
//
// FIX ROUND 1, applied before this guard was ever shipped naive (same lesson
// check-session-sweep.mjs paid for on task 4). A first draft of this guard, the
// one the brief spelled out verbatim, tested the PRESENCE of a few substrings
// across the WHOLE writer body: `body.includes("event_ingestion_guard")`,
// `body.includes("ON CONFLICT (user_id, session_id, idempotency_key) DO
// NOTHING")`, `/WHERE NOT EXISTS/.test(body)`. Every one of those strings also
// legitimately appears in the prose comments this very fix requires (H2's
// rationale names the guard table, the 42P10 explanation names the impossible
// conflict target, the old comment being replaced literally contained "NOT
// EXISTS"). A presence check that scans comments and code together is
// satisfied by a comment alone, or defeated by a comment alone, in either
// direction. So every content rule below is scored against the extracted SQL
// STATEMENT text specifically (between `sql\`` and its closing backtick), never
// against the writer's full body, which is comments-and-code mixed. SQL line
// comments (`-- ...`) inside that statement text are stripped before scoring,
// same helper and same reasoning as check-session-sweep.mjs, in case a
// predicate is ever silenced with `--` instead of deleted. The ON CONFLICT
// target and DO NOTHING are matched with a whitespace-tolerant regex, not a
// literal block string, so reformatting the same SQL across lines cannot
// defeat a rule that is supposed to track meaning, not layout.
//
// FIX ROUND 2. A review defeated round 1 eight times, all exit 0. Five used
// BLOCK comments (`/* ... */`): stripSqlComments only ever cut at `--`, so
// `/* AND status = 'active' */`, `/* FROM g */`, `/* ON CONFLICT ... DO
// NOTHING */`, a real `DO UPDATE` with the required text parked inside a
// `/* */`, and `status IN ('active','abandoned') /* AND status = 'active' */`
// all left the REQUIRED substring sitting in the file while the REAL statement
// no longer did what it claimed. One fix closes all five: stripSqlComments now
// strips `/* ... */` first, then `-- ...` per line, same statement-only scope
// as before. The other three were gaps, not typos: `closedByThisCall =
// closedRows.length > 0 || wasActive` satisfied both "not literally
// closedByThisCall: wasActive" and "the UPDATE has a RETURNING somewhere"
// while still lying exactly like the old code; a second, unguarded `INSERT
// INTO user_event_fact` right after the atomic one duplicated the event
// because only the FIRST `sql\`` statement in each writer was ever scored; and
// nothing compared the idempotency key used in the guard's own VALUES to the
// one used in the event's own SELECT, so the two could silently diverge and
// stop referring to the same logical event. A sixth, separate report (not a
// defeat: a false POSITIVE) showed `AND status = 'active'` demanded a literal
// leading `AND`, so reordering the compare-and-set predicates alone, with no
// change in meaning, turned the guard red. Fixed by scoring the WHERE clause's
// two predicates independently of order and of which one comes first.
//
// This script is standalone on purpose: it guards the two training event
// writers and nothing else.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PROVIDER = "lib/game/training/provider.ts";
const failures = [];

const provider = fs.readFileSync(path.join(ROOT, PROVIDER), "utf8");

// Strips SQL comments, BOTH forms: `/* ... */` (removed first, spans lines)
// and `-- ...` to end of line (removed second, per line). Applied ONLY to an
// extracted SQL statement's own text, never to surrounding TypeScript, so a
// `--` or `/*` inside an unrelated JS comment elsewhere is never at risk of
// being mistaken for one. Without the block-comment pass, `/* AND status =
// 'active' */`, `/* FROM g */` or `/* ON CONFLICT ... DO NOTHING */` would
// each leave the required substring sitting in the statement's raw text while
// the predicate it names no longer actually runs: a presence check would stay
// green on a statement that silently stopped doing what it claims to. Round 2
// of this guard's own review defeated round 1 exactly this way, five times.
const stripSqlComments = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const at = line.indexOf("--");
      return at === -1 ? line : line.slice(0, at);
    })
    .join("\n");

// Strips JS line comments (`// ...` to end of line). Used ONLY when a rule
// must count something across a writer's WHOLE body (comments and code
// together), never when scoring an extracted SQL statement (those already
// exclude surrounding TypeScript comments by construction, since they are
// sliced from between backticks). Without this, a whole-body occurrence count
// would be thrown off by this very file's own documentation: the header
// comments above literally contain the phrases "INSERT INTO user_event_fact"
// and "INSERT INTO event_ingestion_guard" in prose, which would inflate a
// naive count by one before a single real duplicate statement is ever added.
const stripJsLineComments = (text) =>
  text
    .split("\n")
    .map((line) => {
      const at = line.indexOf("//");
      return at === -1 ? line : line.slice(0, at);
    })
    .join("\n");

// Bounded slices. A rule tested against the whole file would be red for ever
// the day an unrelated statement legitimately needs NOT EXISTS.
const sliceBody = (anchor, boundary) => {
  const start = provider.indexOf(anchor);
  if (start === -1) return null;
  const end = provider.indexOf(boundary, start + anchor.length);
  return provider.slice(start, end === -1 ? provider.length : end);
};

// Extracts the raw text of the tagged template following the FIRST `sql` +
// backtick found at or after `from`. Matches both `await sql\`...\`;` and
// `queryRows<T>(sql\`...\`)` shapes: both appear among these writers (the
// compare-and-set UPDATE is now wrapped in queryRows to read RETURNING).
//
// The idempotency key is itself built from a NESTED template literal
// (`${`${sessionId}:session_start`}`), so the closing backtick of the OUTER
// template is not simply the next backtick in the text: the nested pair's own
// backticks come first. A nested template's closing backtick is immediately
// followed by `}` (it closes right before the interpolation hole closes);
// the outer template's real closing backtick is immediately followed by `;`
// or `)` instead. Scanning for a backtick with that lookahead, rather than
// the first backtick of any kind, is what keeps this correct.
const extractStatement = (text, from = 0) => {
  const markerAt = text.indexOf("sql`", from);
  if (markerAt === -1) return null;
  const bodyStart = markerAt + "sql`".length;
  const rest = text.slice(bodyStart);
  const closing = rest.match(/`(?=[;)])/);
  const bodyEnd = closing ? bodyStart + closing.index : -1;
  return {
    raw: text.slice(markerAt, bodyEnd === -1 ? text.length : bodyEnd + 1),
    end: bodyEnd === -1 ? text.length : bodyEnd + 1,
    markerAt,
  };
};

// Returns the first comma-delimited item after `marker` (searched at or after
// `from`), trimmed. Used to pull out the idempotency key expression from the
// guard's own VALUES (...) list and from the event's own SELECT list, so the
// two can be compared for divergence: neither list ever has a comma INSIDE
// its first item's own nested template literal (`${`${sessionId}:...`}` has
// none), so splitting on the first comma is exact here, not approximate.
const firstListValue = (text, marker, from = 0) => {
  const at = text.indexOf(marker, from);
  if (at === -1) return null;
  const start = at + marker.length;
  const commaAt = text.indexOf(",", start);
  if (commaAt === -1) return null;
  return text.slice(start, commaAt).trim();
};

// -----------------------------------------------------------------------
// Shared rules for an atomic event writer's own INSERT statement: guard row
// and event row must live or die together, deduplicated on the guard's own
// primary key, never on the impossible user_event_fact target, never behind
// a non-atomic NOT EXISTS.
const checkAtomicEventInsert = (label, stmtRaw, expectedEventType) => {
  if (stmtRaw === null) {
    failures.push(`${PROVIDER}: ${label} has no sql statement to write its event.`);
    return;
  }
  const stmt = stripSqlComments(stmtRaw);

  const guardAt = stmt.indexOf("INSERT INTO event_ingestion_guard");
  const factAt = stmt.indexOf("INSERT INTO user_event_fact");

  if (guardAt === -1) {
    failures.push(
      `${PROVIDER}: ${label} does not write through event_ingestion_guard. Its event and its ` +
        "idempotency guard would be two separate autocommit statements, so one can land without " +
        "the other."
    );
  }
  if (factAt === -1) {
    failures.push(`${PROVIDER}: ${label} no longer inserts into user_event_fact at all.`);
  }
  if (guardAt !== -1 && factAt !== -1 && factAt < guardAt) {
    failures.push(
      `${PROVIDER}: ${label} inserts into user_event_fact before defining the guard CTE. The ` +
        "guard row must be produced first (WITH g AS (...)) so the event insert can be gated on " +
        "it (SELECT ... FROM g), not the other way around."
    );
  }

  // Whitespace-tolerant, not a literal block: the same SQL reformatted across
  // lines must still satisfy this rule, only its MEANING should be able to
  // defeat it. DO NOTHING is required in the same breath as the conflict
  // target, so DO UPDATE (still deduplicates, but re-inserts the event on
  // every retry once RETURNING starts yielding a row from the UPDATE branch)
  // is rejected too.
  const conflictClause =
    /ON\s+CONFLICT\s*\(\s*user_id\s*,\s*session_id\s*,\s*idempotency_key\s*\)\s*DO\s+NOTHING/;
  if (!conflictClause.test(stmt)) {
    failures.push(
      `${PROVIDER}: ${label} does not deduplicate on the guard's primary key ` +
        "(user_id, session_id, idempotency_key) with ON CONFLICT ... DO NOTHING. Any other " +
        "conflict target raises 42P10 or deduplicates on the wrong thing, and DO UPDATE would " +
        "re-insert the event on every retry instead of no-opping."
    );
  }

  // RETURNING 1 must sit inside the guard's own CTE (between its ON CONFLICT
  // and the next INSERT), not merely appear somewhere in the statement: a CTE
  // with no RETURNING has no rows for the following SELECT to consume, so
  // `g` would be unusable, but a RETURNING copy-pasted onto the wrong
  // statement would satisfy a presence check while gating nothing.
  if (guardAt !== -1) {
    const guardSlice = stmt.slice(guardAt, factAt === -1 ? stmt.length : factAt);
    if (!/RETURNING\s+1\b/.test(guardSlice)) {
      failures.push(
        `${PROVIDER}: ${label}'s guard insert has no RETURNING 1. Without it the following ` +
          "SELECT ... FROM g has no row to key off, so the CTE cannot gate the event insert on " +
          "whether the guard row was actually accepted."
      );
    }
  }

  // The event insert must be gated by `FROM g`, not a bare VALUES/constant
  // SELECT. Without it, the guard's ON CONFLICT DO NOTHING can silently no-op
  // while the event insert underneath still runs unconditionally: the guard
  // becomes decorative, exactly the divorce H2 exists to rule out.
  if (factAt !== -1 && !/FROM\s+g\b/.test(stmt.slice(factAt))) {
    failures.push(
      `${PROVIDER}: ${label}'s event insert is not gated by FROM g. Without it, the event row ` +
        "would be written even when the guard's ON CONFLICT found a duplicate and inserted no " +
        "guard row, which is precisely the divorce this writer exists to prevent."
    );
  }

  // The guard's own idempotency key and the event's own idempotency key must
  // be the SAME expression. Nothing else ties them together: the CTE's ON
  // CONFLICT only deduplicates the guard row on whatever key its own VALUES
  // carries, and FROM g only gates on whether THAT insert produced a row. If
  // the event's SELECT interpolates a different key expression, a retry can
  // still collide on the guard (same key there) while the fact insert (a
  // different key there) is gated by a `g` that has nothing to do with the
  // key it is about to write, so a duplicate event lands on every retry
  // instead of the guard's dedup ever applying to it.
  if (guardAt !== -1 && factAt !== -1) {
    const guardKey = firstListValue(stmt, "VALUES (", guardAt);
    const eventKey = firstListValue(stmt, "SELECT", factAt);
    const normalize = (value) => (value ?? "").replace(/\s+/g, " ").trim();
    if (guardKey === null || eventKey === null) {
      failures.push(
        `${PROVIDER}: ${label}: could not locate both idempotency key expressions (guard VALUES ` +
          "and event SELECT) to compare them."
      );
    } else if (normalize(guardKey) !== normalize(eventKey)) {
      failures.push(
        `${PROVIDER}: ${label}'s guard idempotency key (${normalize(guardKey)}) differs from its ` +
          `event idempotency key (${normalize(eventKey)}). A retry that keys the guard and the ` +
          "event differently can collide with the same guard row every time while still writing a " +
          "fresh event every time, since FROM g never checks which key the event insert is about " +
          "to use."
      );
    }
  }

  if (/WHERE\s+NOT\s+EXISTS/.test(stmt)) {
    failures.push(
      `${PROVIDER}: ${label} still uses the non-atomic WHERE NOT EXISTS. Two concurrent calls ` +
        "both see no row, both insert, and the journal gets a duplicate."
    );
  }

  // The established fact this task was handed: a session_start or session_end
  // event carries neither answer_slug nor reason_code (both nullable only
  // since migration 001b; chk_answer_slug and chk_reason_only_on_answer both
  // constrain them to the 'answer' event type). Inventing either column here
  // trips a CHECK at runtime.
  for (const forbidden of ["answer_slug", "reason_code"]) {
    if (stmt.includes(forbidden)) {
      failures.push(
        `${PROVIDER}: ${label} writes a column named "${forbidden}", which this event type must ` +
          "never carry (chk_answer_slug / chk_reason_only_on_answer restrict it to 'answer' " +
          "events)."
      );
    }
  }

  if (!stmt.includes(`'${expectedEventType}'`)) {
    failures.push(`${PROVIDER}: ${label} no longer writes event_type '${expectedEventType}'.`);
  }
};

// Counts occurrences of `needle` in `body` after stripping BOTH comment
// styles: JS `//` line comments (this is body-level text, comments and code
// mixed, unlike an extracted SQL statement) and, defensively, SQL comments
// too, in case a second statement hides one inside itself. Scored on the
// WHOLE writer body rather than only the first `sql\`` statement, because a
// second, unguarded `INSERT INTO user_event_fact` added right after the
// atomic one is invisible to any rule that only ever looks at the first
// statement it finds: it duplicates the event on every call while the first
// statement, on its own, still passes every rule above.
const countOccurrences = (body, needle) => {
  const stripped = stripJsLineComments(stripSqlComments(body));
  return stripped.split(needle).length - 1;
};

const checkExactlyOneEventInsert = (label, body) => {
  const factCount = countOccurrences(body, "INSERT INTO user_event_fact");
  if (factCount !== 1) {
    failures.push(
      `${PROVIDER}: ${label} contains ${factCount} occurrence(s) of "INSERT INTO ` +
        'user_event_fact", expected exactly 1. A second, unguarded insert anywhere in this ' +
        "writer duplicates the event on every call, even though the first, atomic statement " +
        "still passes every rule on its own."
    );
  }
  const guardCount = countOccurrences(body, "INSERT INTO event_ingestion_guard");
  if (guardCount !== 1) {
    failures.push(
      `${PROVIDER}: ${label} contains ${guardCount} occurrence(s) of "INSERT INTO ` +
        'event_ingestion_guard", expected exactly 1.'
    );
  }
};

// --------------------------------------------------------------- writer 1
const startBody = sliceBody("const insertSessionStartEvent", "\nconst ");
if (startBody === null) {
  failures.push(`${PROVIDER}: cannot locate insertSessionStartEvent.`);
} else {
  const stmt = extractStatement(startBody);
  checkAtomicEventInsert("insertSessionStartEvent", stmt === null ? null : stmt.raw, "session_start");
  checkExactlyOneEventInsert("insertSessionStartEvent", startBody);
}

// --------------------------------------------------------------- writer 2
const endBody = sliceBody("export const endTrainingSession", "\nexport const ");
if (endBody === null) {
  failures.push(`${PROVIDER}: cannot locate endTrainingSession.`);
} else {
  // Narrowed to the `if (wasActive) { ... }` block: that is where both writes
  // (the event CTE, the compare-and-set UPDATE) live. Bounded on its far end
  // by the next statement the function is known to run afterwards, so a rule
  // scoped here cannot wander into the answers query below and match
  // something unrelated.
  const ifAt = endBody.indexOf("if (wasActive) {");
  const afterIfAt = endBody.indexOf("const answerRows", ifAt === -1 ? 0 : ifAt);
  const ifBlock =
    ifAt === -1 ? null : endBody.slice(ifAt, afterIfAt === -1 ? endBody.length : afterIfAt);

  if (ifBlock === null) {
    failures.push(`${PROVIDER}: endTrainingSession no longer guards its writes behind wasActive.`);
  } else {
    const eventStmt = extractStatement(ifBlock);
    checkAtomicEventInsert(
      "endTrainingSession's session_end writer",
      eventStmt === null ? null : eventStmt.raw,
      "session_end"
    );
    checkExactlyOneEventInsert("endTrainingSession's session_end writer", ifBlock);

    const updateStmt = eventStmt === null ? null : extractStatement(ifBlock, eventStmt.end);

    // The end writer must keep reading global_q_index from the users table.
    // It does not have that value in scope, unlike the start writer which
    // receives it as an argument, so a template that passes it as a
    // parameter cannot be applied here. Scored against the event statement
    // itself, not the whole block, so a stray mention in a comment cannot
    // satisfy it on its own.
    if (eventStmt !== null && !stripSqlComments(eventStmt.raw).includes("SELECT global_q_index FROM users")) {
      failures.push(
        `${PROVIDER}: the session_end writer no longer reads global_q_index from the users ` +
          "table. endTrainingSession has no such value in scope; the subquery is not optional " +
          "here."
      );
    }

    // The status write must be a compare and set. Between the SELECT that
    // read the row and this UPDATE, another tab's sweep can have moved the
    // session to 'abandoned' with an honest ended_at taken from its last
    // event. An unconditional UPDATE then flips it back to 'completed' and
    // overwrites that honest timestamp with the server's own clock, which is
    // the fact table claiming something that did not happen. Task 4's sweep
    // exclusion narrows this window, it does not close it: a second tab is a
    // second session, and the sweep only ever excludes the session of the
    // call it runs in.
    if (updateStmt === null || !/UPDATE\s+sessions\b/.test(updateStmt.raw)) {
      failures.push(`${PROVIDER}: endTrainingSession no longer updates the sessions row.`);
    } else {
      const upd = stripSqlComments(updateStmt.raw);
      // The WHERE clause is located by the keyword itself, not by which
      // predicate happens to come first: `WHERE status = 'active' AND
      // session_id = ...` is semantically IDENTICAL to `WHERE session_id =
      // ... AND status = 'active'`, so a rule anchored to one specific order
      // must not turn red on the other. Every predicate below is checked
      // independently, order-free, inside this same clause.
      const whereAt = upd.search(/\bWHERE\b/);
      const whereClause = whereAt === -1 ? "" : upd.slice(whereAt);

      if (whereAt === -1) {
        failures.push(`${PROVIDER}: the session close's UPDATE has no WHERE clause at all.`);
      } else {
        if (!/session_id\s*=\s*\$\{sessionId\}::uuid/.test(whereClause)) {
          failures.push(
            `${PROVIDER}: the session close's WHERE clause no longer targets session_id = ` +
              "${sessionId}::uuid."
          );
        }
        // Order-insensitive on purpose (see comment above): this checks the
        // predicate's MEANING (status compared to the literal 'active'),
        // never whether an AND happens to sit immediately in front of it.
        if (!/status\s*=\s*'active'/.test(whereClause)) {
          failures.push(
            `${PROVIDER}: the session close is not a compare and set. Its WHERE clause must ` +
              "require status = 'active', in any predicate order, or a concurrent sweep's honest " +
              "'abandoned' is silently overwritten with 'completed' and a wrong ended_at."
          );
        }
        // A predicate can satisfy the substring above while a stray `OR` next
        // to it reopens the condition (`AND status = 'active' OR true`), or
        // while the comparison itself is widened past a single value
        // (`status IN ('active', 'abandoned')`, which this same regex still
        // matches nowhere, since IN is not `=`, but a widened comparison could
        // in principle keep a commented-out `= 'active'` nearby): either way,
        // no OR is allowed anywhere in this clause.
        if (/\bOR\b/.test(whereClause)) {
          failures.push(
            `${PROVIDER}: the session close's WHERE clause contains OR, which can reopen the ` +
              "compare-and-set predicate (e.g. AND status = 'active' OR true) while leaving the " +
              "required substring intact."
          );
        }
      }
      if (!/RETURNING/.test(upd)) {
        failures.push(
          `${PROVIDER}: the session close has no RETURNING. closedByThisCall must be the number ` +
            "of rows this UPDATE actually affected, not the pre-write wasActive flag, or a " +
            "session another tab already closed would be reported as closed by this call too."
        );
      }

      // closedByThisCall must be derived SOLELY from the number of rows THIS
      // UPDATE affected, nothing else. Forbidding the literal `closedByThisCall
      // : wasActive` and requiring merely *a* RETURNING somewhere both leave
      // `closedByThisCall = closedRows.length > 0 || wasActive` untouched: it
      // is not the literal string, and the UPDATE does have a RETURNING. So
      // this locates the identifier that actually captured this UPDATE's own
      // RETURNING (via `const <ident> = await queryRows(...)` immediately
      // before this statement), then requires the assignment's ENTIRE
      // right-hand side to be nothing more than `<that identifier>.length >
      // 0` (or `>= 1`): any additional `|| wasActive` term breaks the exact
      // match, and any OTHER identifier (unrelated to this UPDATE's own
      // RETURNING) fails to satisfy it at all.
      const CAPTURE_WINDOW = 200;
      const before = ifBlock.slice(
        Math.max(0, updateStmt.markerAt - CAPTURE_WINDOW),
        updateStmt.markerAt
      );
      const captureMatch = before.match(/const\s+(\w+)\s*=\s*await\s+queryRows/);
      if (captureMatch === null) {
        failures.push(
          `${PROVIDER}: the session close's UPDATE result is not captured into a const via ` +
            "queryRows, so there is no row array for closedByThisCall to be derived from."
        );
      } else {
        const ident = captureMatch[1];
        const afterUpdate = ifBlock.slice(updateStmt.end);
        const assignMatch = afterUpdate.match(/closedByThisCall\s*=\s*([^;]+);/);
        if (assignMatch === null) {
          failures.push(
            `${PROVIDER}: closedByThisCall is never assigned after the compare-and-set UPDATE.`
          );
        } else {
          const rhs = assignMatch[1].trim();
          const escaped = ident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const expected = new RegExp(`^${escaped}\\.length\\s*(>\\s*0|>=\\s*1)$`);
          if (!expected.test(rhs)) {
            failures.push(
              `${PROVIDER}: closedByThisCall = ${rhs}; is not derived purely from ${ident}.length, ` +
                "the row count of the compare-and-set UPDATE's own RETURNING. Any additional term " +
                "(an OR with wasActive, for instance) lets a session another tab already closed be " +
                "reported as closed by this call too."
            );
          }
        }
      }
    }

    // Regression check on the return value itself: wasActive is read BEFORE
    // the write and must never be echoed back as the answer to "did this call
    // just close it".
    if (/closedByThisCall\s*:\s*wasActive\b/.test(endBody)) {
      failures.push(
        `${PROVIDER}: endTrainingSession returns closedByThisCall: wasActive, computed from the ` +
          "read rather than from the compare-and-set UPDATE's own result. A concurrent sweep that " +
          "closed the session between the read and the write would make this answer false."
      );
    }

    // The old justification explained why ON CONFLICT was impossible ON
    // user_event_fact. Left in place next to a CTE that does use ON CONFLICT,
    // on the guard table, it would read as a contradiction to the next
    // person.
    if (endBody.includes("NOT EXISTS rather than ON CONFLICT")) {
      failures.push(
        `${PROVIDER}: the session_end writer still carries the "NOT EXISTS rather than ON ` +
          'CONFLICT" comment. Rewrite it: the 42P10 measurement stays true about ' +
          "user_event_fact, but the conflict target now legitimately exists on " +
          "event_ingestion_guard."
      );
    }
  }
}

if (failures.length > 0) {
  console.error("check:event-writers FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  "check:event-writers OK : session_start and session_end both write through a single, " +
    "comment-proof event_ingestion_guard CTE (block and line comments both stripped before " +
    "scoring), with matching idempotency keys, exactly one insert into each table, gated by " +
    "FROM g, no NOT EXISTS left, and the session close is an order-insensitive compare-and-set " +
    "whose closedByThisCall is derived purely from its own RETURNING row count."
);
