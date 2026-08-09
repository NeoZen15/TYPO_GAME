#!/usr/bin/env node

// Session counter guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. Fixing the double-start bug (plan
// plan-double-demarrage-2026-07-31) made two active sessions for one player a
// SUPPORTED state, not an error case. Any counter that is read in JavaScript
// and then written back (`const next = user.global_q_index + 1; UPDATE ...
// SET global_q_index = ${next}`) loses increments the moment two answers from
// two active sessions land in parallel: both reads see the same starting
// value, both writes land, and one increment vanishes silently. The fix is to
// let Postgres do the read-and-increment atomically inside the UPDATE itself
// (`SET global_q_index = global_q_index + 1 ... RETURNING global_q_index`),
// which cannot lose a concurrent increment because there is no JavaScript
// read in between.
//
// This script is standalone on purpose: it guards
// lib/game/training/provider.ts only, and is not coupled to any other
// module's lifecycle so it stays green on its own, independent of what else
// is or is not in the repo yet.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const PROVIDER = "lib/game/training/provider.ts";

const failures = [];

const provider = read(PROVIDER);

// Both rules below are scoped to submitTrainingAnswer's own body, not to the
// whole file. provider.ts also contains recoverByCursorJump, which legitimately
// writes `SET global_q_index = ${recoveryQ}` outside of submitTrainingAnswer: a
// silent, idempotent cursor jump to an absolute value (spec §4.5), not a
// per-answer "read then write back" increment, and out of this task's scope.
// Testing the two rules against the whole file would flag that unrelated line
// forever and the guard could never go green, which is exactly what
// check-session-lifecycle.mjs already avoids by slicing to a function body
// before scanning it.
const submitStart = provider.indexOf("export const submitTrainingAnswer");
const endStart = provider.indexOf("export const endTrainingSession");

if (submitStart === -1) {
  failures.push(`${PROVIDER}: no longer exports submitTrainingAnswer.`);
} else {
  const submitBody = provider.slice(
    submitStart,
    endStart > submitStart ? endStart : provider.length
  );

  // -------------------------------------------- 1. global_q_index increments in SQL
  // Catches `global_q_index = ${someJsValue}`, the shape a JS-computed
  // `user.global_q_index + 1` assignment takes once interpolated into the query.
  // The safe form (`global_q_index = global_q_index + 1`) has no `${` right
  // after the `=` and does not match.
  //
  // NO `SET\s+` PREFIX, AND THAT IS NOT AN OVERSIGHT. This rule used to read
  // /SET\s+global_q_index\s*=\s*\$\{/ and was defeated by writing any other
  // column first: `SET last_seen_at = now(), global_q_index = ${jsNext} ...
  // RETURNING global_q_index` reintroduces the lost-increment bug in full and
  // the guard exited 0. Verified by mutation on 2026-08-04. Rule 2 below never
  // had the prefix and always caught that mutation; this rule now matches it.
  if (/global_q_index\s*=\s*\$\{/.test(submitBody)) {
    failures.push(
      `${PROVIDER}: provider assigns global_q_index from a JS read; increment it in SQL. ` +
        "A JS-computed value can only reflect the row as it stood at the last SELECT: two " +
        "active sessions answering in parallel both read the same starting value, both " +
        "write, and one increment is lost."
    );
  }

  // -------------------------------------------------- 2. question_count increments in SQL
  // Same shape, on the session row's question_count. Written broader than the
  // global_q_index rule (no leading SET\s+ required) because the brief's own
  // guard text uses this exact form, and question_count sits next to
  // correct_count in the same UPDATE, not necessarily first after SET.
  if (/question_count\s*=\s*\$\{/.test(submitBody)) {
    failures.push(
      `${PROVIDER}: provider assigns question_count from a JS read; increment it in SQL. ` +
        "Same race as global_q_index: a resolvedCount computed as " +
        "`session.question_count + 1` in JavaScript and written back loses an increment as " +
        "soon as two answers for the same session (now a supported state) resolve in " +
        "parallel."
    );
  }

  // ------------------------------------------- 3. resolvedCount served from RETURNING
  // The counter fix is only real if the response payload actually carries the
  // database's post-increment value. A provider that increments in SQL but
  // still threads a JS-side `resolvedCountAfter` variable into the response
  // would defeat the point: the client would still be told a locally computed
  // number instead of what the database settled on.
  if (/const\s+resolvedCountAfter\s*=\s*session\.question_count\s*\+\s*1/.test(submitBody)) {
    failures.push(
      `${PROVIDER}: resolvedCount is still computed as session.question_count + 1 in JS. ` +
        "It must be served from the RETURNING clause of the sessions UPDATE, not from a " +
        "value read before the parallel answer could have landed."
    );
  }
  if (!/RETURNING\s+question_count/.test(submitBody)) {
    failures.push(
      `${PROVIDER}: the sessions UPDATE in submitTrainingAnswer has no RETURNING ` +
        "question_count. resolvedCount must be served from that RETURNING, never from a " +
        "JavaScript read taken before the write."
    );
  }
  if (!/RETURNING\s+global_q_index/.test(submitBody)) {
    failures.push(
      `${PROVIDER}: the users UPDATE in submitTrainingAnswer has no RETURNING ` +
        "global_q_index. The next question must be built from the value the database just " +
        "settled on, not from user.global_q_index + 1 computed in JavaScript."
    );
  }

  // ------------------------------------------ 4. correct_count carries a real ratio
  // Gap 9 defect 1 (checklist, 2026-07-30). The wrong-answer branch returns
  // before the sessions UPDATE, so if that UPDATE increments correct_count by a
  // literal 1 next to question_count, the two columns are equal for every
  // training session that ever existed, correct_count carries no information,
  // and `CHECK (correct_count <= question_count)` from migration 003 is
  // satisfied by a tautology. question_count counts questions RESOLVED, so the
  // honest companion is questions resolved on the FIRST attempt: the ratio is
  // then the share of questions the player got without a retry, it can never
  // exceed question_count, and it matches the first-attempt convention that
  // profile-stats.ts already uses everywhere it computes accuracy.
  //
  // Scored on the sessions UPDATE statement alone, with comments removed, so
  // neither a comment nor an unrelated UPDATE elsewhere in the body can satisfy
  // or defeat the rules below.
  const withoutComments = submitBody
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  const sessionUpdates = [...withoutComments.matchAll(/UPDATE\s+sessions\b/g)];
  if (sessionUpdates.length !== 1) {
    failures.push(
      `${PROVIDER}: expected exactly one "UPDATE sessions" in submitTrainingAnswer, found ` +
        `${sessionUpdates.length}. The correct_count rules below are scoped to that single ` +
        "statement; two of them means this guard is reading the wrong one and must be " +
        "rewritten rather than left to pass by accident."
    );
  } else {
    const updateStart = sessionUpdates[0].index;
    const closing = withoutComments.indexOf("`", updateStart);
    const updateSlice = withoutComments.slice(
      updateStart,
      closing > updateStart ? closing : withoutComments.length
    );

    if (!/correct_count\s*=/.test(updateSlice)) {
      failures.push(
        `${PROVIDER}: the sessions UPDATE no longer writes correct_count at all. Leaving the ` +
          "column frozen at 0 while question_count grows is not a fix: the session_ended " +
          "payload of the engine spec carries correct_count, and a column that is always 0 " +
          "misinforms exactly like one that is always equal to question_count."
      );
    } else if (/correct_count\s*=\s*correct_count\s*\+\s*1\b/.test(updateSlice)) {
      failures.push(
        `${PROVIDER}: the sessions UPDATE increments correct_count by a literal 1. The ` +
          "wrong-answer branch returns before this statement, so correct_count would equal " +
          "question_count for every session, carrying no information. Gate it on the " +
          "first-attempt flag instead."
      );
    } else if (!/correct_count\s*=\s*correct_count\s*\+\s*\$\{[^}]*correctFirstTry/.test(updateSlice)) {
      failures.push(
        `${PROVIDER}: correct_count is written by the sessions UPDATE but not from ` +
          "correctFirstTry. It must count questions resolved on the first attempt, so the " +
          "increment has to be bound to that flag and nothing else."
      );
    }

    // The flag itself, or the rule above is satisfiable by defining
    // `const correctFirstTry = true` next to the statement.
    if (!/const\s+correctFirstTry\s*=\s*isCorrect\s*&&\s*attemptCount\s*===\s*1\s*;/.test(withoutComments)) {
      failures.push(
        `${PROVIDER}: correctFirstTry is no longer defined as "isCorrect && attemptCount === 1". ` +
          "The correct_count rule reads that name, so a flag redefined to a constant or to a " +
          "looser predicate would put the tautology back while this guard stayed green."
      );
    }
  }

  // ------------------------------------ 5. the wrong-answer path serves a fresh count
  // Numbered 5, not 4: the brief for this rule called it 4, and by the time it
  // was written rule 4 above already existed for correct_count. Renamed rather
  // than renumbered on top of it.
  //
  // The wrong path writes nothing to sessions, so there is no UPDATE ...
  // RETURNING to serve from, and it used to answer with `session.question_count`
  // read at the very top of the call. Nothing is LOST, a wrong answer increments
  // nothing, which is exactly why the defect was easy to miss. But under the
  // concurrency this plan postulates (two active sessions, a second tab
  // resolving a question) the client is told a number that is already out of
  // date. The fact-insert statement returns the fresh value in the same round
  // trip, by scalar subquery on sessions inside its RETURNING.
  //
  // This is the narrow, named regression check on the exact historical shape.
  // The PROPERTY it stands for (the number served comes from the statement that
  // wrote the fact) is asserted separately, and structurally, by
  // checkAnswerWritePath below, which a rename of the variable cannot dodge.
  if (/resolvedCount:\s*session\.question_count/.test(submitBody)) {
    failures.push(
      `${PROVIDER}: the wrong-answer path serves resolvedCount from the session row read at the ` +
        "start of the call. It must come from the answer statement's RETURNING, like the correct " +
        "path already does."
    );
  }
}

// ---------------------------------------------------------------------------
// 6. THE ANSWER WRITE PATH: derived in SQL, gated on the guard, served fresh.
//
// Written as a function of the source text, not as a straight line of top-level
// regexes, for one reason: it is then EXECUTABLE against synthetic sources, and
// the self-tests at the bottom of this file run it against one compliant source
// and against nine mutants, each of which must not only fail but fail with the
// message that names its own defect. Four guards in this plan shipped vacuous
// or shape-pinned and were beaten by an attacker moving one notch over. A rule
// that can be run on a mutant is a rule whose reach is measured instead of
// assumed.
//
// THE PROPERTY, stated once. Two submissions of the same answer must not both
// take effect. What arbitrates is the primary key of event_ingestion_guard,
// (user_id, session_id, idempotency_key): the loser blocks on the winner's
// transaction, ON CONFLICT DO NOTHING leaves the guard CTE empty, the fact
// insert gated on that CTE writes nothing, and RETURNING yields zero rows.
// Three things therefore have to hold at once, and none of them is sufficient
// alone:
//
//   a) attempt_index is derived INSIDE that statement. Derived in JavaScript,
//      two in-flight submissions read the same count anyway, so the key would
//      be identical by luck rather than by construction, and a retry sent after
//      the first fact committed could still collide with it.
//   b) the guard and the fact are ONE statement, the fact gated on the guard's
//      rows. Two statements can be divorced (guard written, fact missing, or
//      the reverse), and an ungated fact insert makes the guard decorative.
//   c) everything pedagogical sits AFTER a zero-rows early return. Without that
//      checkpoint the duplicate writes no second fact and still applies the
//      same mastery transition twice from the same mastery_before, which is a
//      double penalty or a double promotion for the player. This is the half
//      that actually protects the player, and the one a literal implementer
//      drops first.
//
// Comments are stripped before any of this is scored, BOTH forms (`--` and
// `/* */`) inside SQL and `//` in TypeScript. Three guards in this plan shipped
// vacuous for exactly that reason, one of them certifying an entirely empty
// file, and this file's own prose now contains every string these rules look
// for.
const stripSqlComments = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => {
      const at = line.indexOf("--");
      return at === -1 ? line : line.slice(0, at);
    })
    .join("\n");

const stripJsLineComments = (text) =>
  text
    .split("\n")
    .map((line) => {
      const at = line.indexOf("//");
      return at === -1 ? line : line.slice(0, at);
    })
    .join("\n");

// Extracts the tagged template that follows the FIRST `sql` + backtick at or
// after `from`. The idempotency key is built from a nested template literal in
// some writers, so the outer template's closing backtick is not simply the next
// backtick in the text: a nested pair closes right before its interpolation
// hole, hence a `}` immediately after, while the outer one is followed by `;`
// or `)`. Same reasoning, same shape, as check-event-writers.mjs.
const extractStatement = (text, from = 0) => {
  const markerAt = text.indexOf("sql`", from);
  if (markerAt === -1) return null;
  const bodyStart = markerAt + "sql`".length;
  const rest = text.slice(bodyStart);
  const closing = rest.match(/`(?=[;)])/);
  const bodyEnd = closing ? bodyStart + closing.index : -1;
  return {
    raw: text.slice(markerAt, bodyEnd === -1 ? text.length : bodyEnd + 1),
    start: markerAt,
    end: bodyEnd === -1 ? text.length : bodyEnd + 1,
  };
};

// Every statement of the sliced body, in order, comment-free.
const allStatements = (body) => {
  const out = [];
  let cursor = 0;
  for (;;) {
    const found = extractStatement(body, cursor);
    if (found === null) break;
    out.push({ ...found, sql: stripSqlComments(found.raw) });
    cursor = found.end;
  }
  return out;
};

// Anything that changes the player's state or the session's counters. A
// duplicate submission must reach NONE of these.
const PEDAGOGICAL_WRITES = [
  "UPDATE user_typeface_state",
  "UPDATE users",
  "UPDATE sessions",
  "registerMasteryUnlock(",
  "maybeRebalancePool(",
  "safeRecomputeVisibleLevel(",
];

const checkAnswerWritePath = (source, label = PROVIDER) => {
  const found = [];
  const push = (message) => found.push(`${label}: ${message}`);

  const submitAt = source.indexOf("export const submitTrainingAnswer");
  if (submitAt === -1) {
    push("no longer exports submitTrainingAnswer.");
    return found;
  }
  const nextExport = source.indexOf("\nexport const ", submitAt + 1);
  const body = source.slice(submitAt, nextExport === -1 ? source.length : nextExport);
  const bodyCode = stripJsLineComments(body);
  const statements = allStatements(bodyCode);

  // (a) exactly one of each insert, counted on code only. A second, unguarded
  // `INSERT INTO user_event_fact` anywhere in the body duplicates the fact on
  // every call while the first, atomic statement still passes every rule below
  // on its own.
  for (const [needle, why] of [
    [
      "INSERT INTO user_event_fact",
      "a second insert duplicates the answer fact on every call, even though the atomic one " +
        "still passes every other rule",
    ],
    [
      "INSERT INTO event_ingestion_guard",
      "a second guard insert claims an ingestion the fact insert is not gated on",
    ],
  ]) {
    const count = stripSqlComments(bodyCode).split(needle).length - 1;
    if (count !== 1) {
      push(`expected exactly 1 occurrence of "${needle}" in submitTrainingAnswer, found ${count}: ${why}.`);
    }
  }

  const factStatement = statements.find((statement) =>
    statement.sql.includes("INSERT INTO user_event_fact")
  );
  if (factStatement === undefined) {
    push(
      "submitTrainingAnswer no longer writes the answer fact through a sql statement, so nothing " +
        "here can be proven about its attempt index or its idempotency."
    );
    return found;
  }

  const stmt = factStatement.sql;
  const guardAt = stmt.indexOf("INSERT INTO event_ingestion_guard");
  const factAt = stmt.indexOf("INSERT INTO user_event_fact");

  // (b) one statement, guard first, fact gated on it.
  if (guardAt === -1) {
    push(
      "the answer fact is not written through the event_ingestion_guard CTE. Its fact and its " +
        "idempotency guard would be two separate autocommit statements, so one can land without " +
        "the other, and nothing would arbitrate two submissions of the same attempt."
    );
  } else if (factAt < guardAt) {
    push(
      "the answer statement inserts into user_event_fact before defining the guard CTE. The " +
        "guard row has to be produced first, WITH g AS (...), so the fact insert can be gated on " +
        "it with SELECT ... FROM g."
    );
  }
  if (
    !/ON\s+CONFLICT\s*\(\s*user_id\s*,\s*session_id\s*,\s*idempotency_key\s*\)\s*DO\s+NOTHING/.test(
      stmt
    )
  ) {
    push(
      "the answer statement does not deduplicate on the guard's primary key " +
        "(user_id, session_id, idempotency_key) with ON CONFLICT ... DO NOTHING. Any other " +
        "conflict target raises 42P10 or deduplicates on the wrong thing, and DO UPDATE would " +
        "return a row for the loser too, so the duplicate would write its fact and re-apply its " +
        "mastery transition."
    );
  }
  if (factAt !== -1 && !/FROM\s+(?:[\w.]+\s*,\s*)*g\b/.test(stmt.slice(factAt))) {
    push(
      "the answer fact insert is not gated by a FROM that includes the guard CTE g. Without it " +
        "the fact is written even when ON CONFLICT found a duplicate and inserted no guard row, " +
        "which makes the guard decorative."
    );
  }

  // (a) attempt_index derived in SQL, by the statement's own CTE, with BOTH the
  // idempotency key and the inserted column taken from that same derived value.
  // Deriving it and then writing a JavaScript number into the column would key
  // the guard on one index and record another, so the key would stop describing
  // the attempt it is supposed to arbitrate.
  const cteMatch = stmt.match(/WITH\s+(\w+)\s+AS\s*\(/);
  const cte = cteMatch === null ? null : cteMatch[1];
  if (cte === null || !/COUNT\s*\(/.test(stmt) || !/AS\s+attempt_index/.test(stmt)) {
    push(
      "the answer statement does not derive attempt_index itself (no CTE computing " +
        "COUNT ... AS attempt_index). Derived in JavaScript, two in-flight submissions build the " +
        "same idempotency key by luck of timing rather than by construction, and the index stops " +
        "advancing only on committed facts, which is what makes a genuine retry legitimate."
    );
  } else {
    const guardSlice = stmt.slice(
      guardAt === -1 ? 0 : guardAt,
      factAt === -1 ? stmt.length : factAt
    );
    const factSlice = factAt === -1 ? "" : stmt.slice(factAt);
    const derived = new RegExp(`\\b${cte}\\.attempt_index\\b`);
    if (!derived.test(guardSlice)) {
      push(
        `the idempotency key inserted into the guard is not built from ${cte}.attempt_index, the ` +
          "derived index. Keyed on anything else, the guard stops arbitrating attempts: either two " +
          "submissions of the same attempt no longer collide, or two genuine attempts wrongly do."
      );
    }
    if (!derived.test(factSlice)) {
      push(
        `the fact insert does not write ${cte}.attempt_index. A JavaScript number written into ` +
          "the column while the guard is keyed on the derived one records an index the key does " +
          "not describe."
      );
    }
  }
  if (/\$\{attemptCount\}/.test(stmt)) {
    push(
      "the answer statement still interpolates ${attemptCount}, the JavaScript-computed index " +
        "this fix removed. Two in-flight submissions both read a count of zero and both write it."
    );
  }
  // The OUTER returning, located from the end: the guard CTE has a RETURNING of
  // its own, and a rule anchored on the first one would be satisfied by it.
  const returningAt = stmt.lastIndexOf("RETURNING");
  const returning = returningAt === -1 ? "" : stmt.slice(returningAt);
  if (!/attempt_index/.test(returning)) {
    push(
      "the answer statement's last RETURNING does not project attempt_index. Zero rows returned " +
        "is the signal that another submission won the guard, and the index itself has to come " +
        "back from the write rather than from a read taken before it."
    );
  }

  // The capture identifier: whatever const holds this statement's rows. Every
  // rule below is expressed against it, so renaming it cannot dodge them. The
  // match must be the LAST queryRows capture before this statement AND have no
  // backtick between it and the statement, otherwise an earlier statement's
  // capture would be mistaken for this one's and the rules below would silently
  // measure the wrong variable.
  const before = bodyCode.slice(0, factStatement.start);
  const captures = [...before.matchAll(/const\s+(\w+)\s*=\s*await\s+queryRows/g)];
  const captureMatch = captures[captures.length - 1];
  const cap =
    captureMatch === undefined || before.slice(captureMatch.index).includes("`")
      ? null
      : captureMatch[1];
  if (cap === null) {
    push(
      "the answer statement's rows are not captured into a const via queryRows, so nothing can " +
        "read its RETURNING: neither the derived attempt index, nor the fresh counter, nor the " +
        "zero-rows signal that a duplicate was rejected."
    );
    return found;
  }
  const escaped = cap.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const after = bodyCode.slice(factStatement.end);

  if (!new RegExp(`const\\s+attemptCount\\s*=\\s*${escaped}\\[0\\]\\??\\.attempt_index`).test(after)) {
    push(
      `attemptCount is not read from ${cap}[0].attempt_index. The value the three mastery ` +
        "branches and reason_code decide on must be the index the database derived, not one " +
        "recomputed beside it."
    );
  }

  // (c) the checkpoint. Nothing pedagogical before the write, and a zero-rows
  // early return between the write and the first of them.
  for (const write of PEDAGOGICAL_WRITES) {
    const at = bodyCode.indexOf(write);
    if (at !== -1 && at < factStatement.start) {
      push(
        `"${write}" runs BEFORE the answer statement, so it runs for a duplicate submission too. ` +
          "Every pedagogical write has to sit after the zero-rows checkpoint, which only exists " +
          "once the guard has been consulted."
      );
    }
  }
  const firstWriteAt = PEDAGOGICAL_WRITES.map((write) => after.indexOf(write))
    .filter((at) => at !== -1)
    .sort((left, right) => left - right)[0];
  if (firstWriteAt === undefined) {
    push(
      "submitTrainingAnswer no longer performs any pedagogical write at all, which is not a fix " +
        "either: an answer has to move mastery and the counters."
    );
  } else {
    const gate = after.slice(0, firstWriteAt);
    const zeroRows = new RegExp(
      `if\\s*\\(\\s*(?:${escaped}\\.length\\s*(?:===?\\s*0|<\\s*1)|!\\s*${escaped}\\.length)\\s*\\)`
    );
    if (!zeroRows.test(gate) || !/\breturn\b/.test(gate)) {
      push(
        `nothing between the answer statement and the first pedagogical write returns early on ` +
          `${cap} being empty. Zero rows means another submission won the guard and has already ` +
          "moved mastery: running the branches again applies the same transition twice from the " +
          "same mastery_before, a double penalty or a double promotion for the player. The guard " +
          "on its own only stops the duplicate FACT, not the duplicate pedagogy."
      );
    }
  }

  // The served counter, as a property this time: the fresh number must be
  // projected by the writing statement and reach the wrong-answer response.
  if (!/question_count/.test(returning)) {
    push(
      "the answer statement's RETURNING does not project the session's question_count. The " +
        "wrong-answer path writes nothing to sessions, so this statement is the only place a " +
        "fresh counter can come from without an extra round trip."
    );
  }
  const countMatch = after.match(
    new RegExp(`const\\s+(\\w+)\\s*=\\s*${escaped}\\[0\\]\\??\\.(\\w*count\\w*)`, "i")
  );
  const wrongAt = after.indexOf('result: "wrong"');
  if (wrongAt === -1) {
    push("the wrong-answer response is gone from submitTrainingAnswer.");
  } else {
    // Bounded by the object literal it belongs to, not by a fixed character
    // window: the `return {` that opens it and the `};` that closes it. A fixed
    // window either clips the progress object on a reformat or swallows the
    // correct path's response and reads its counter instead.
    const openAt = after.lastIndexOf("return {", wrongAt);
    const closeAt = after.indexOf("};", wrongAt);
    const wrongReturn = after.slice(
      openAt === -1 ? wrongAt : openAt,
      closeAt === -1 ? after.length : closeAt
    );
    if (/session\.question_count/.test(wrongReturn)) {
      push(
        "the wrong-answer response still reads session.question_count, the value taken at the " +
          "top of the call. Two active sessions being a supported state, a question resolved in " +
          "another tab makes it stale before it is served."
      );
    }
    if (countMatch === null) {
      push(
        `no const in submitTrainingAnswer takes a counter out of ${cap}[0], so the fresh number ` +
          "the statement returns is never used and the wrong-answer path cannot be serving it."
      );
    } else if (!new RegExp(`\\b${countMatch[1]}\\b`).test(wrongReturn)) {
      push(
        `the wrong-answer response does not serve ${countMatch[1]}, the counter read from ` +
          `${cap}[0].${countMatch[2]}. It has to serve the number the writing statement returned, ` +
          "not one read before the write."
      );
    }
  }

  return found;
};

for (const failure of checkAnswerWritePath(provider)) {
  failures.push(failure);
}

// ---------------------------------------------------------------------------
// SELF-TEST. The rules above are RUN, here, against one compliant synthetic
// source and against ten mutants, plus six reformulations that must stay green.
// This is the part that makes the guard measurable rather than hopeful: a rule
// nobody ever fired is a rule nobody knows the reach of, and this plan lost nine
// fix rounds to exactly that. A mutant is only counted as caught when a message
// NAMES its defect, because a wrong diagnosis sends the next reader to the wrong
// line and is a defeat too.
//
// The synthetic source is built from an array of double-quoted lines on purpose:
// backticks and dollar-brace sequences are literal there, so the fixture reads
// like the SQL it stands for instead of like an escaping exercise.
const SYNTH_OK = [
  "export const submitTrainingAnswer = async ({ sessionId }) => {",
  "  const session = await readSession(sessionId);",
  "  const written = await queryRows(sql`",
  "    WITH n AS (",
  "      SELECT COUNT(*)::int + 1 AS attempt_index",
  "      FROM user_event_fact",
  "      WHERE session_id = ${sessionId}::uuid",
  "        AND event_type = 'answer'",
  "    ),",
  "    g AS (",
  "      INSERT INTO event_ingestion_guard (idempotency_key, user_id, session_id, ingestion_status)",
  "      SELECT ${sessionId}::text || ':' || n.attempt_index::text, ${userId}::uuid, ${sessionId}::uuid, 'accepted'",
  "      FROM n",
  "      ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING",
  "      RETURNING idempotency_key",
  "    )",
  "    INSERT INTO user_event_fact (idempotency_key, attempt_index)",
  "    SELECT g.idempotency_key, n.attempt_index",
  "    FROM n, g",
  "    RETURNING attempt_index, (SELECT question_count FROM sessions) AS resolved_count",
  "  `);",
  "  if (written.length === 0) {",
  "    return duplicateAnswerResponse(session);",
  "  }",
  "  const attemptCount = written[0].attempt_index;",
  "  const resolvedCount = written[0].resolved_count;",
  "  if (wrongFirstTry) {",
  "    await sql`UPDATE user_typeface_state SET mastery_level = 1`;",
  "  }",
  "  if (!isCorrect) {",
  "    return {",
  '      result: "wrong",',
  "      progress: { resolvedCount },",
  "    };",
  "  }",
  "  await sql`UPDATE sessions SET question_count = question_count + 1 RETURNING question_count`;",
  '  return { result: "correct" };',
  "};",
  "export const endTrainingSession = async () => {};",
].join("\n");

const selfTest = [];

// A mutation whose anchor no longer exists silently tests nothing, which is how
// a guard certifies an unchanged file and calls it proof. Refusing to build the
// mutant is the only honest response.
const mutate = (name, from, to) => {
  if (!SYNTH_OK.includes(from)) {
    selfTest.push(
      `${name}: the synthetic source no longer contains its anchor, so this mutation tested ` +
        `nothing. Anchor: ${JSON.stringify(from.slice(0, 60))}.`
    );
    return null;
  }
  return SYNTH_OK.replace(from, to);
};

const expectClean = (name, source) => {
  if (source === null) return;
  const found = checkAnswerWritePath(source, "synthetic");
  if (found.length > 0) {
    selfTest.push(`${name}: expected a clean pass, got ${found.length} failure(s). First: ${found[0]}`);
  }
};

const expectCaught = (name, source, needle) => {
  if (source === null) return;
  const found = checkAnswerWritePath(source, "synthetic");
  if (found.length === 0) {
    selfTest.push(`${name}: the mutation was not caught at all.`);
  } else if (!found.some((failure) => failure.includes(needle))) {
    selfTest.push(
      `${name}: caught, but no message names the defect (looked for ${JSON.stringify(needle)}). ` +
        `Got: ${found.join(" | ")}`
    );
  }
};

expectClean("compliant fixture", SYNTH_OK);

expectCaught(
  "M1 attempt_index written from JavaScript",
  mutate("M1", "SELECT g.idempotency_key, n.attempt_index", "SELECT g.idempotency_key, ${attemptCount}"),
  "n.attempt_index"
);
expectCaught(
  "M2 zero-rows checkpoint removed",
  mutate(
    "M2",
    "  if (written.length === 0) {\n    return duplicateAnswerResponse(session);\n  }\n",
    ""
  ),
  "won the guard"
);
expectCaught(
  "M3 ON CONFLICT parked in a block comment",
  mutate(
    "M3",
    "      ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING",
    "      /* ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING */"
  ),
  "ON CONFLICT"
);
expectCaught(
  "M4 DO NOTHING turned into DO UPDATE",
  mutate("M4", "DO NOTHING", "DO UPDATE SET ingestion_status = 'accepted'"),
  "DO NOTHING"
);
expectCaught(
  "M5 wrong path serves the pre-write read",
  mutate(
    "M5",
    "      progress: { resolvedCount },",
    "      progress: { resolvedCount: session.question_count },"
  ),
  "session.question_count"
);
expectCaught(
  "M6 mastery written before the answer statement",
  mutate(
    "M6",
    "  const written = await queryRows(sql`",
    "  await sql`UPDATE user_typeface_state SET mastery_level = 1`;\n  const written = await queryRows(sql`"
  ),
  "BEFORE the answer statement"
);
expectCaught(
  "M7 fact insert no longer gated by the guard CTE",
  mutate("M7", "    FROM n, g", "    FROM n"),
  "FROM"
);
expectCaught(
  "M8 second, unguarded fact insert",
  mutate(
    "M8",
    "  await sql`UPDATE sessions SET question_count = question_count + 1 RETURNING question_count`;",
    "  await sql`INSERT INTO user_event_fact (idempotency_key) VALUES (${key})`;\n" +
      "  await sql`UPDATE sessions SET question_count = question_count + 1 RETURNING question_count`;"
  ),
  "exactly 1 occurrence"
);
expectCaught(
  "M9 attempt index recomputed in JavaScript after the write",
  mutate(
    "M9",
    "  const attemptCount = written[0].attempt_index;",
    "  const attemptCount = Number.parseInt(previous[0].count, 10) + 1;"
  ),
  "attemptCount is not read from"
);
expectCaught(
  "M10 fresh counter dropped from the RETURNING",
  mutate("M10", ", (SELECT question_count FROM sessions) AS resolved_count", ""),
  "question_count"
);

// Reformulations. A guard that turns red on a rename, a reformat or a comment is
// a guard the next author disables, and a false positive is a defeat of the same
// kind as a miss.
expectClean(
  "FP1 ON CONFLICT reformatted across lines",
  mutate(
    "FP1",
    "      ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING",
    "      ON CONFLICT\n        (user_id, session_id, idempotency_key)\n        DO NOTHING"
  )
);
expectClean("FP2 capture identifier renamed", SYNTH_OK.replaceAll("written", "insertedFact"));
expectClean(
  "FP3 checkpoint written as a falsy test",
  mutate("FP3", "if (written.length === 0) {", "if (!written.length) {")
);
expectClean(
  "FP4 SQL line comment inside the statement",
  mutate(
    "FP4",
    "      SELECT COUNT(*)::int + 1 AS attempt_index",
    "      -- derived here, never in JavaScript\n      SELECT COUNT(*)::int + 1 AS attempt_index"
  )
);
expectClean(
  "FP5 the two captured consts swapped",
  mutate(
    "FP5",
    "  const attemptCount = written[0].attempt_index;\n  const resolvedCount = written[0].resolved_count;",
    "  const resolvedCount = written[0].resolved_count;\n  const attemptCount = written[0].attempt_index;"
  )
);
expectClean(
  "FP6 RETURNING broken over several lines",
  mutate(
    "FP6",
    "    RETURNING attempt_index, (SELECT question_count FROM sessions) AS resolved_count",
    "    RETURNING\n      attempt_index,\n      (\n        SELECT question_count\n        FROM sessions\n      ) AS resolved_count"
  )
);

if (selfTest.length > 0) {
  console.error("check:session-counters SELF-TEST FAILED\n");
  for (const failure of selfTest) {
    console.error(`  - ${failure}\n`);
  }
  console.error(
    "  The answer-path rules do not behave as documented, so their verdict on the real provider " +
      "means nothing. Fix the rules before reading anything into their result.\n"
  );
  process.exit(1);
}

// ----------------------------------------------------------------- report
if (failures.length > 0) {
  console.error("check:session-counters FAILED\n");
  for (const failure of failures) {
    console.error(`  - ${failure}\n`);
  }
  process.exit(1);
}

console.log(
  "check:session-counters OK : global_q_index and question_count both increment in SQL " +
    "(no JS-read-then-write), and resolvedCount is served from the sessions RETURNING clause."
);
