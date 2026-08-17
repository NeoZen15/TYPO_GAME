// ============================================================================
// check:competition-integrity
//
// WHY THIS SCRIPT EXISTS, and why it is not five edits to five other scripts.
//
// The competition mode was written before the double start plan of 2026-07-31
// and never repassed over it. Five guards enforce, on the TRAINING provider,
// the properties that plan established: check-session-convergence,
// check-session-sweep, check-session-counters, check-event-writers and
// check-client-attempt-contract. Every one of them names a
// `lib/game/training/*` path at the top and reads it as text. So the gate was
// entirely green on a competition mode that had none of those properties, and
// nothing in the gate could ever have said so.
//
// Audited on 2026-08-17 and MEASURED, not deduced. Two identical answer POST
// fired together on one competition question wrote TWO rows into
// user_event_fact and left the session row at question_count 1, score 2: the
// journal and the session row described different rounds. Two starts fired
// together opened TWO rounds where training opened one. And 121 competition
// sessions sat in status 'active', the oldest from 2026-03-21, because the
// training sweep carries `AND s.mode = 'training'` and nothing else ever swept.
//
// The four mechanics were ported the same day. This script is what stops them
// being unported. It is one new file rather than five widened ones because
// those five are 4638 lines that are green today on the launch-critical
// training path, and the cheapest way to protect a second mode is not to risk
// the first.
//
// WHAT IT DOES NOT DO. It reads source text. It cannot prove the SQL is
// correct, only that the shapes whose absence was measured as a defect are
// still present. The proof by execution lives in the audit note of
// docs/process/checklist.md.
// ============================================================================

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PROVIDER = "lib/game/competition/provider.ts";
const ROUTE = "app/api/competition/session/start/route.ts";
const SCREEN = "features/game/components/CompetitionScreen.tsx";

const failures = [];
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

// Strips SQL line comments (`-- ...` to end of line). A predicate typed then
// commented out does not run, and must not be able to satisfy a rule that is
// checking whether it runs.
const stripSqlComments = (text) =>
  text
    .split("\n")
    .map((line) => {
      const at = line.indexOf("--");
      return at === -1 ? line : line.slice(0, at);
    })
    .join("\n");

// Strips whole-line JS comments, and this one was learned the hard way. The
// first version of this script checked `AND status = 'active'` inside
// finalizeCompetitionSession and PASSED with the predicate deleted, because the
// comment above the statement quotes the predicate by name to explain why it is
// there. Caught by mutation testing the guard itself on 2026-08-17, which is the
// only way that class of hole ever shows up: the rule looked correct, it was
// green before and after the defect, and it protected nothing.
//
// Whole lines only, never a trailing `//` on a line of code: an inline strip
// would cut a `https://` inside a string and change what the rules read. Every
// rule here therefore reads CODE, and prose that happens to quote the code it
// describes can no longer satisfy it.
const stripJsComments = (text) =>
  text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");

// Code only: JS prose out first, then SQL prose.
const codeOf = (text) => stripSqlComments(stripJsComments(text));

// The body of a top-level `const NAME = ` or `export const NAME = `, up to the
// next top-level declaration. Bounding every rule to one function is what stops
// a needle being satisfied by an unrelated statement elsewhere in the file.
const functionBody = (source, name) => {
  const at = source.search(new RegExp(`^(export )?const ${name} = `, "m"));
  if (at === -1) return null;
  const rest = source.slice(at + 10);
  const next = rest.search(/^(export )?const [A-Za-z]/m);
  return next === -1 ? source.slice(at) : source.slice(at, at + 10 + next);
};

const provider = read(PROVIDER);
const route = read(ROUTE);
const screen = read(SCREEN);

const requireIn = (haystack, needle, where, why) => {
  if (!haystack.includes(needle)) {
    failures.push(`${where}: missing \`${needle}\`. ${why}`);
  }
};

const refuseIn = (haystack, needle, where, why) => {
  if (haystack.includes(needle)) {
    failures.push(`${where}: found \`${needle}\`, which must not be there. ${why}`);
  }
};

// ---------------------------------------------------------------------------
// 1. The answer is written by ONE atomic statement, through the guard table.
// ---------------------------------------------------------------------------
const answer = functionBody(provider, "submitCompetitionAnswer");
if (!answer) {
  failures.push(`${PROVIDER}: no longer exports submitCompetitionAnswer.`);
} else {
  const sql = codeOf(answer);

  requireIn(
    sql,
    "INSERT INTO event_ingestion_guard",
    `${PROVIDER} submitCompetitionAnswer`,
    "the answer fact and its uniqueness must be written by one statement. Without the guard row, " +
      "two submissions in flight both write a fact: measured on 2026-08-17, two rows for one question."
  );

  requireIn(
    sql,
    "ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING",
    `${PROVIDER} submitCompetitionAnswer`,
    "that primary key IS the arbitration. user_event_fact is partitioned by event_ts_utc, so it " +
      "carries no unique index on idempotency_key alone and cannot arbitrate anything itself."
  );

  requireIn(
    sql,
    "FROM g",
    `${PROVIDER} submitCompetitionAnswer`,
    "the fact must be selected FROM the guard CTE. An INSERT ... VALUES beside the guard, rather " +
      "than fed by it, writes the event whether or not the guard row was won: the divorce between " +
      "the two is exactly what the CTE exists to make impossible."
  );

  // The duplicate branch. Winning nothing must return a read, never fall through
  // to the counters.
  requireIn(
    answer,
    "if (written.length === 0)",
    `${PROVIDER} submitCompetitionAnswer`,
    "the guard is only half the fix. A submission that wrote no fact must stop before the counter " +
      "UPDATE, or it adds a point and an answered question for a word it did not record."
  );

  // BOUNDED TO THE BRANCH, and the bound is the rule. Looking for the name
  // anywhere in the function passed with the guard branch throwing again, because
  // the stale-token branch above also calls it: one call site satisfied a rule
  // meant to protect two. Found by mutation testing on 2026-08-17.
  const duplicateBranchAt = answer.indexOf("if (written.length === 0)");
  const duplicateBranch =
    duplicateBranchAt === -1 ? "" : answer.slice(duplicateBranchAt, duplicateBranchAt + 300);
  requireIn(
    duplicateBranch,
    "return duplicateCompetitionAnswerResponse",
    `${PROVIDER} submitCompetitionAnswer, the written.length === 0 branch`,
    "a submission that won nothing must be answered with what the database recorded, not with an " +
      "error. Throwing here is what made a replayed token a 500 in a round that was working."
  );

  const staleBranchAt = answer.indexOf("payload.globalQIndex !== expectedGlobalQIndex");
  const staleBranch = staleBranchAt === -1 ? "" : answer.slice(staleBranchAt, staleBranchAt + 700);
  requireIn(
    staleBranch,
    "return duplicateCompetitionAnswerResponse",
    `${PROVIDER} submitCompetitionAnswer, the stale index branch`,
    "a token carrying an earlier index is a replay, not an attack: buildQuestion never issues two " +
      "tokens for one index. Throwing turned an ordinary retry into a 500."
  );

  // 2. Counters increment in the statement.
  for (const [needle, why] of [
    [
      "question_count = question_count + 1",
      "computed in JavaScript from a row read before the write, two answers landing together both " +
        "start from the same value and the second erases the first",
    ],
    [
      "correct_count = correct_count + ",
      "same lost update as question_count, and chk_correct_lte_total makes the pair meaningless " +
        "if only one of them is atomic",
    ],
    ["score = score + ", "the score is the whole point of this mode; a lost increment is a lost point"],
  ]) {
    requireIn(sql, needle, `${PROVIDER} submitCompetitionAnswer`, `Set absolutely instead, ${why}.`);
  }

  // The absolute forms, refused by name. Presence of the incremental form does
  // not prove absence of the absolute one: both can sit in the same statement.
  for (const needle of [
    "SET question_count = ${",
    "correct_count = ${correctCount}",
    "score = ${score}",
  ]) {
    refuseIn(
      sql,
      needle,
      `${PROVIDER} submitCompetitionAnswer`,
      "a counter assigned from a JavaScript value cannot survive two concurrent answers."
    );
  }

  // 3. ended_at is the database clock, compared against a database started_at.
  refuseIn(
    sql,
    "ended_at = ${shouldComplete ? new Date() : null}",
    `${PROVIDER} submitCompetitionAnswer`,
    "started_at comes from the database and chk_ended_after_started compares the two, so a JS Date " +
      "puts a CHECK violation one clock skew away. It also blanked ended_at on every answer that " +
      "did not end the round, which now undoes the sweep."
  );
}

// ---------------------------------------------------------------------------
// 4. The start converges on sessions_pkey, exactly as training does.
// ---------------------------------------------------------------------------
const start = functionBody(provider, "startCompetitionSession");
if (!start) {
  failures.push(`${PROVIDER}: no longer exports startCompetitionSession.`);
} else {
  const sql = codeOf(start);

  requireIn(
    sql,
    "ON CONFLICT (session_id) DO NOTHING",
    `${PROVIDER} startCompetitionSession`,
    "without it two starts open two rounds, two timers and two rows nothing will ever close."
  );

  // BOUNDED TO THE INSERT. Looking for the identifier anywhere in the function
  // passed with it deleted from the VALUES list, because the re-read below
  // matches on the same expression: the SELECT satisfied a rule about the INSERT.
  // Found by mutation testing on 2026-08-17.
  const insertFrom = sql.indexOf("INSERT INTO sessions (");
  const insertTo = sql.indexOf("ON CONFLICT (session_id)");
  const insertStmt =
    insertFrom === -1 || insertTo === -1 || insertTo < insertFrom
      ? ""
      : sql.slice(insertFrom, insertTo);
  requireIn(
    insertStmt,
    "${effectiveAttemptId}::uuid",
    `${PROVIDER} startCompetitionSession, the INSERT INTO sessions statement`,
    "session_id must be supplied explicitly IN THE INSERT. The column defaults to " +
      "gen_random_uuid(), so an insert that omits it can never collide and the ON CONFLICT clause " +
      "becomes unreachable syntax while every start keeps writing its own row."
  );
  requireIn(
    insertStmt,
    "session_id,",
    `${PROVIDER} startCompetitionSession, the INSERT INTO sessions column list`,
    "the column has to be named for the value above to land in it."
  );

  requireIn(
    sql,
    "AND mode = 'competition'",
    `${PROVIDER} startCompetitionSession`,
    "the re-read must be scoped by mode as well as by the key, or a training row is served as a " +
      "competition round."
  );

  requireIn(
    sql,
    "AND user_id = ${user.user_id}::uuid",
    `${PROVIDER} startCompetitionSession`,
    "the re-read must be scoped by user, or a guessed identifier hands somebody else's round to " +
      "whoever asked for it."
  );

  requireIn(
    start,
    "isPlayableRound(candidate)",
    `${PROVIDER} startCompetitionSession`,
    "a competition round dies of its own clock two minutes in, so 'active' is not the whole " +
      "question here as it is in training. Rejoining an expired round serves a question against a " +
      "deadline already past."
  );

  requireIn(
    start,
    "if (wonTheInsert)",
    `${PROVIDER} startCompetitionSession`,
    "only the call that created the row writes its session_start. A rejoin that wrote one too " +
      "would duplicate the journal entry the creator already wrote."
  );

  // 5. The sweep, and its position.
  requireIn(
    start,
    "sweepAbandonedCompetitionSessions",
    `${PROVIDER} startCompetitionSession`,
    "nothing else closes a round the player walked out of. Measured on 2026-08-17: 121 competition " +
      "sessions still 'active', the oldest five months old."
  );

  const sweepAt = start.indexOf("sweepAbandonedCompetitionSessions(user.user_id");
  const insertAt = start.indexOf("INSERT INTO sessions");
  if (sweepAt !== -1 && insertAt !== -1 && sweepAt < insertAt) {
    failures.push(
      `${PROVIDER}: the sweep is called BEFORE INSERT INTO sessions. It cannot exclude the current ` +
        "round because that row does not exist yet, so a reload sending the same identifier back " +
        "abandons the very session it is about to rejoin."
    );
  }
}

// ---------------------------------------------------------------------------
// 6. The sweep itself: scoped to this mode, to this user, excluding this round.
// ---------------------------------------------------------------------------
const sweep = functionBody(provider, "sweepAbandonedCompetitionSessions");
if (!sweep) {
  failures.push(`${PROVIDER}: sweepAbandonedCompetitionSessions is gone.`);
} else {
  const sql = codeOf(sweep);
  const whereAt = sql.indexOf("WHERE s.user_id");
  const where = whereAt === -1 ? "" : sql.slice(whereAt);

  for (const [needle, why] of [
    [
      "AND s.mode = 'competition'",
      "without it this sweep abandons training and expert sessions too, which is the mirror of the " +
        "defect it was written to fix",
    ],
    [
      "AND s.status = 'active'",
      "without it the sweep recomputes ended_at on rounds that are already closed",
    ],
    [
      "<> ${currentSessionId}::uuid",
      "the exclusion must name the round this call is about to play, or the start abandons itself",
    ],
    [
      "s.started_at < now() - interval",
      "without an age floor, two starts a few milliseconds apart abandon each other and leave zero " +
        "playable rounds",
    ],
  ]) {
    requireIn(where, needle, `${PROVIDER} sweepAbandonedCompetitionSessions WHERE`, why);
  }

  requireIn(
    sql,
    "MAX(uef.event_ts_utc)",
    `${PROVIDER} sweepAbandonedCompetitionSessions`,
    "ended_at is taken from the last recorded event, never from now(): the player left when they " +
      "stopped answering, not when we noticed."
  );

  refuseIn(
    sweep,
    "session_end",
    `${PROVIDER} sweepAbandonedCompetitionSessions`,
    "no session_end event is written for a swept round, because no end ever happened. The fact " +
      "table must never claim something that did not occur."
  );
}

// ---------------------------------------------------------------------------
// 7. Both other event writers are atomic too, and the close is compare-and-set.
// ---------------------------------------------------------------------------
for (const name of ["insertSessionStartEvent", "insertSessionEndEventIfMissing"]) {
  const body = functionBody(provider, name);
  if (!body) {
    failures.push(`${PROVIDER}: ${name} is gone.`);
    continue;
  }
  const sql = codeOf(body);
  requireIn(
    sql,
    "INSERT INTO event_ingestion_guard",
    `${PROVIDER} ${name}`,
    "every writer into user_event_fact goes through the guard. A NOT EXISTS scan is not a " +
      "deduplication, only a narrower race: two calls arriving together both find nothing and both write."
  );
  // The conflict clause, checked per writer. Without it the guard INSERT raises
  // a duplicate key error on the second call instead of quietly writing nothing,
  // so an idempotent path becomes a 500. It was missing from this loop until
  // mutation testing removed it from one writer and the guard stayed green.
  requireIn(
    sql,
    "ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING",
    `${PROVIDER} ${name}`,
    "the guard insert must swallow its own conflict. Raising instead turns a retry into a 500 and " +
      "leaves the event unwritten."
  );
  requireIn(
    sql,
    "FROM g",
    `${PROVIDER} ${name}`,
    "the event must be selected FROM the guard CTE, not written beside it."
  );
  refuseIn(
    sql,
    "WHERE NOT EXISTS",
    `${PROVIDER} ${name}`,
    "the racy shape this replaced. Its presence means the guard was added without removing what it replaced."
  );
}

const finalize = functionBody(provider, "finalizeCompetitionSession");
if (!finalize) {
  failures.push(`${PROVIDER}: finalizeCompetitionSession is gone.`);
} else {
  requireIn(
    codeOf(finalize),
    "AND status = 'active'",
    `${PROVIDER} finalizeCompetitionSession`,
    "compare and set. Between the read and this UPDATE another start's sweep can have moved the " +
      "round to 'abandoned' with an honest ended_at; an unconditional UPDATE flips it back to " +
      "'completed' and overwrites that timestamp with the server's own clock."
  );
}

// ---------------------------------------------------------------------------
// 8. The client half. Server-side convergence is unreachable without it.
// ---------------------------------------------------------------------------
requireIn(
  route,
  "normalizeAttemptId(body.attemptId)",
  ROUTE,
  "the route must normalise the identifier before it reaches a ::uuid cast. Unvalidated, a " +
    "malformed body is a 22P02 that becomes a 500 on a plain page load."
);

for (const [needle, why] of [
  [
    "takeAttemptId({ fresh })",
    "the screen must send one identifier per round. Two calls that each let the server mint one " +
      "can never collide, so ON CONFLICT (session_id) is unreachable and two rounds open.",
  ],
  [
    "if (inFlightRef.current) return;",
    "a ref, not a piece of state: disabled={isLoading} only becomes true on the next render, so a " +
      "fast double click fires two requests before React has repainted anything.",
  ],
  [
    "adoptAttemptId(payload.sessionId)",
    "when the server could not rejoin what we sent it answered with an identifier of its own. " +
      "Keeping ours would make every later reload open a new round.",
  ],
  [
    "dropAttemptId()",
    "released only once the round is really over. Any earlier and the next load opens a second " +
      "round beside one still running.",
  ],
  [
    "startSession({ fresh: true })",
    '"Play again" must mint a new identifier, or it replays the one belonging to the round that ' +
      "just ended and spends a server round trip discovering it cannot be rejoined.",
  ],
]) {
  requireIn(screen, needle, SCREEN, why);
}

// ---------------------------------------------------------------------------
// 8b. Closing a round is scoped to its owner. Until 2026-08-17 this path asked
//     for no identity at all: a second player holding only the identifier closed
//     somebody else's round, measured, 'active' to 'completed' on their behalf.
// ---------------------------------------------------------------------------
const timeout = functionBody(provider, "timeoutCompetitionSession");
if (!timeout) {
  failures.push(`${PROVIDER}: no longer exports timeoutCompetitionSession.`);
} else {
  const sql = codeOf(timeout);
  requireIn(
    sql,
    "AND user_id = ${userId}::uuid",
    `${PROVIDER} timeoutCompetitionSession`,
    "the lookup itself must carry the scope. A read followed by a comparison in JavaScript still " +
      "READS a round this caller may not play, and a refusal message can then describe it."
  );
  requireIn(
    sql,
    "AND mode = 'competition'",
    `${PROVIDER} timeoutCompetitionSession`,
    "scoped by mode too, or a training session is closed through the competition path."
  );
  refuseIn(
    codeOf(timeout),
    "await getSession(sessionId)",
    `${PROVIDER} timeoutCompetitionSession`,
    "getSession is the unscoped read. Using it here is exactly the hole that was measured."
  );
}

requireIn(
  stripJsComments(read("app/api/competition/session/timeout/route.ts")),
  "await getCurrentUserId()",
  "app/api/competition/session/timeout/route.ts",
  "identity comes from the httpOnly cookie, never from the body. A caller declaring who it is " +
    "about itself is not an identity."
);

// ---------------------------------------------------------------------------
// 9. The countdown is a DURATION, not a date. `deadlineUtc - Date.now()` is an
//    instant from the database clock compared against the device's, so a phone
//    two minutes fast saw the round over the second it opened.
// ---------------------------------------------------------------------------
const screenCode = stripJsComments(screen);

requireIn(
  screenCode,
  "anchor.remainingMs - (clockNow - anchor.atMs)",
  SCREEN,
  "the countdown must be the server's remaining duration minus a LOCAL elapsed. Both terms of that " +
    "subtraction come from the same clock, so whatever that clock is set to cancels out."
);

refuseIn(
  screenCode,
  "new Date(stats.deadlineUtc).getTime() - clockNow",
  SCREEN,
  "counting down against an absolute instant reintroduces the device clock. deadlineUtc stays in " +
    "the contract, it is simply not what the screen counts down against."
);

// Every stats write must stamp the anchor with it. A fourth call site setting
// state directly is a countdown quietly running off a stale anchor.
const rawSetStats = (screenCode.match(/setStats\(/g) ?? []).length;
if (rawSetStats !== 1) {
  failures.push(
    `${SCREEN}: ${rawSetStats} direct setStats( call(s), expected exactly 1, the one inside ` +
      "applyStats. Every other site must go through applyStats, or it updates the figures without " +
      "restamping the anchor the countdown reads."
  );
}

// ---------------------------------------------------------------------------
// 10. The fast bonus is bounded by what the SERVER measured. responseTimeMs
//     arrives in the request body: a body claiming nought earned two points on
//     every word, verified against the running server on 2026-08-17.
// ---------------------------------------------------------------------------
const providerCode = stripJsComments(provider);

requireIn(
  providerCode,
  "issuedAtMs: Date.now()",
  `${PROVIDER} buildQuestion`,
  "the question must carry, inside the signed token, the instant the server built it. Without it " +
    "the server has nothing to compare the client's claim against."
);

requireIn(
  providerCode,
  "serverElapsedFor(payload.issuedAtMs)",
  `${PROVIDER} submitCompetitionAnswer`,
  "the awarded points must be computed with the server's own elapsed time, not with the claim alone."
);

requireIn(
  providerCode,
  "COMPETITION_OVERHEAD_TOLERANCE_MS",
  PROVIDER,
  "the bound has to be the named, documented tolerance, not a number typed at the call site."
);

// ---------------------------------------------------------------------------
// 11. Both answer handlers refuse re-entrance on a ref. isRoundLocked is state,
//     so `disabled` only lands on the next render and several clicks in one tick
//     all fire. Measured: three synchronous clicks, three POST, one same token.
// ---------------------------------------------------------------------------
for (const [file, source] of [
  [SCREEN, screen],
  ["features/game/components/GameScreen.tsx", read("features/game/components/GameScreen.tsx")],
]) {
  const code = stripJsComments(source);
  const handlerAt = code.indexOf("const handleSelect = useCallback");
  const handler = handlerAt === -1 ? "" : code.slice(handlerAt);
  requireIn(
    handler,
    "if (answerInFlightRef.current) return;",
    `${file} handleSelect`,
    "the answer path must refuse re-entrance on a ref. The start path has had this guard since the " +
      "double start plan; this one did not."
  );
  requireIn(
    handler,
    "answerInFlightRef.current = false;",
    `${file} handleSelect`,
    "and it must be released in a finally, or one early return leaves a screen that never accepts " +
      "another answer."
  );
}

if (failures.length > 0) {
  console.error("check:competition-integrity FAILED\n");
  for (const failure of failures) {
    console.error(`  - ${failure}\n`);
  }
  process.exit(1);
}

console.log(
  "check:competition-integrity OK (atomic answer writer, incremental counters, start convergence, sweep, client identifier)"
);
