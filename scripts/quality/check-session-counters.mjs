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
  // Catches `SET global_q_index = ${someJsValue}`, the shape a JS-computed
  // `user.global_q_index + 1` assignment takes once interpolated into the
  // query. The safe form (`SET global_q_index = global_q_index + 1`) has no
  // `${` right after the `=` and does not match.
  if (/SET\s+global_q_index\s*=\s*\$\{/.test(submitBody)) {
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
