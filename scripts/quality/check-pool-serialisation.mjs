#!/usr/bin/env node

// Pool serialisation guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. Under overlap, two pool initialisations for the same
// user fill the pool twice: measured at 47 rows instead of 30, 5 runs out of 5,
// zero variance, because the loser waits, then inserts the 17 rows of its own
// selection that are missing. No SQLSTATE is raised, ON CONFLICT DO NOTHING
// absorbs the merge in silence, and ensureUserPool's count guard is proven
// inoperative under concurrency. Migration 012 serialises the five pool bodies
// on a per-user advisory lock, and gives init_user_pool's two arities and
// try_unlock_if_pool_stuck a genuine early-return precondition, which is what
// actually closes the merge (the lock alone only takes turns, it does not
// deduplicate; measured, round 2 of this task).
//
// THE PRECONDITION MUST NOT LIVE IN try_unlock_one_typeface. That function is
// also the I-07 growth primitive, called by register_mastery_unlock at the
// three-stabilisation threshold, a moment when the pool almost always has an
// eligible face. A precondition there would disable growth in silence and
// pending_unlock_count would climb for ever. Hence a NEW name,
// try_unlock_if_pool_stuck, and never an overload with a default parameter:
// CREATE OR REPLACE cannot change a signature, and
// try_unlock_one_typeface(uuid, boolean DEFAULT false) would make the
// one-argument call at 008_pool_growth.sql:191 ambiguous, error 42725.
//
// THE PRECONDITION MUST SEE WHAT THE PLAYER SEES, NOT A SUPERSET. Round 3.
// try_unlock_if_pool_stuck's precondition and provider.ts's getPoolRows are
// two halves of one decision (is there an eligible face, and is it actually
// servable), and they drifted apart once already: the precondition read only
// user_typeface_state/users, while getPoolRows additionally filters
// activation_status, the licence allowlist (with its UFL legacy fallback),
// and the latin coverage exclusion. A row invisible to getPoolRows but
// counted "eligible" by the precondition is not a rare miss: it is permanent,
// because an invisible row is never served, so never rescheduled, so its
// next_due_after_q never moves off its seeded 0, so the precondition answers
// "eligible" for that user for ever and the §4.5 unlock never fires again.
// Measured on a copy of production: one real user already carries four such
// rows. The two rule families below (VISIBILITY_MARKERS) keep the two halves
// from drifting apart again silently.
//
// WHY EVERY RULE BELOW IS SCOPED TO AN EXTRACTED FUNCTION BODY, NEVER TO THE
// WHOLE FILE. Round 2 review defeated the previous version of this guard
// three times while it still printed its success message: gutting the
// migration to its header comments alone (every function name and the lock
// expression already appear in prose there); deleting every
// PERFORM pg_advisory_xact_lock(...) line while leaving all six
// CREATE OR REPLACE untouched (the lock text still appeared once, in this
// file's own header comment); and injecting the precondition into
// try_unlock_one_typeface (nothing checked its absence there). All three
// exploited the same shape, a `migration.includes(x)` test satisfied by
// ANYTHING anywhere in the file, comments included, matched once instead of
// inside the specific body it was meant to guard. Every rule below extracts
// the exact function body first (from a LINE-INITIAL
// `CREATE OR REPLACE FUNCTION <signature>` header to its own closing `$$;` or
// `END $$;` line) and only ever searches inside that slice. A missing body is
// ALWAYS reported by the loop that extracts it, never silently assumed to be
// someone else's problem.
//
// WHAT ROUND 3 REVIEW DEFEATED, AND WHAT REPLACED IT. Four more holes, all in
// this file, none in the SQL. (1) The lock was only tested for PRESENCE while
// the failure message already claimed "as its own first statement": moving it
// to just before RETURN v_count; kept the guard green and brought the 47-row
// merge straight back, so position is now verified, comments and blank lines
// skipped. (2) Extraction by bare indexOf sliced the wrong body when a decoy
// comment naming another signature sat earlier in the file, and ran to end of
// file for try_unlock_if_pool_stuck, whose terminator is `END $$;` and not a
// line-initial `$$;`: both anchors are fixed above extractBody. (3)
// rebalance_user_pool was tested against one precondition marker out of two,
// so the other could be injected while the success message still claimed it
// carried neither: both markers are now tested on both bodies. (4) The three
// text[] arguments of try_unlock_if_pool_stuck were passed positionally, so a
// swapped pair was invisible to Postgres and to this guard: the call site now
// passes all four BY NAME and a rule requires it.
//
// This guard is a tripwire, not a proof. What actually proves the migration is
// the execution recorded in
// .superpowers/sdd/plan-double-demarrage-2026-07-31/task-3-report.md, on a
// throwaway Neon branch, five concurrent attempts per scenario. The rules here
// only keep a future edit from undoing it silently.
//
// This script is standalone on purpose: it guards
// db/migrations/012_pool_serialisation.sql and the single call site in
// lib/game/training/provider.ts, nothing else, so it stays green on its own.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATION = "db/migrations/012_pool_serialisation.sql";
const PROVIDER = "lib/game/training/provider.ts";

const failures = [];
const readOrNull = (relative) => {
  const full = path.join(ROOT, relative);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
};

// Extracts one function's own body: from the line that BEGINS with
// "CREATE OR REPLACE FUNCTION <startNeedle>" down to that body's own
// terminator line. startNeedle only needs to be long enough to identify ONE
// function: init_user_pool needs its full argument list (two arities, and the
// closing parenthesis right after "uuid" is what keeps the one-argument needle
// from matching the two-argument definition), every other function here has no
// overload, so its bare name plus an opening parenthesis is unambiguous.
//
// ANCHORED AT THE START OF A LINE. Round 3 review defeated the previous
// version, which used a bare indexOf: a decoy comment naming another
// function's signature ("-- CREATE OR REPLACE FUNCTION
// try_unlock_one_typeface(p_user_id uuid)") placed anywhere EARLIER in the
// file made the extractor slice a different, innocent body, and every rule
// scoped to the real body then ran on the wrong text. The defect injected in
// the real body was never looked at, and the guard printed success. A comment
// line starts with "--", so requiring the header at column zero closes that
// whole family in one stroke.
//
// TERMINATED ON "END $$;" AS WELL AS ON A LINE-INITIAL "$$;". Round 3 review
// also exploited the fact that try_unlock_if_pool_stuck closes with "END $$;"
// on a single line: the old search for "\n$$;" never matched, so the extracted
// body ran to the END OF FILE and marker strings pasted into a comment after
// COMMIT; satisfied rules for a body that no longer contained them. Any line
// whose trimmed text ends with "$$;" now closes the body.
//
// A body that is never terminated, and a header that appears TWICE (the second
// CREATE OR REPLACE silently wins at apply time while the guard reads the
// first), are both reported instead of being worked around.
const extractBody = (source, startNeedle, label) => {
  const lines = source.split("\n");
  const header = `CREATE OR REPLACE FUNCTION ${startNeedle}`;
  const headerLines = [];
  lines.forEach((line, index) => {
    if (line.startsWith(header)) headerLines.push(index);
  });
  if (headerLines.length === 0) return null;
  if (headerLines.length > 1) {
    failures.push(
      `${MIGRATION}: ${label} is defined ${headerLines.length} times in this file. The LAST ` +
        "CREATE OR REPLACE is the one Postgres keeps, so a second definition silently overrides " +
        "the first while every rule below reads the first: define each body exactly once."
    );
  }
  const start = headerLines[0];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/\$\$\s*;$/.test(lines[i].trim())) {
      return lines.slice(start, i + 1).join("\n");
    }
  }
  failures.push(
    `${MIGRATION}: ${label}'s body is never closed by a "$$;" or "END $$;" line. An unterminated ` +
      "body would make every rule below read to the end of the file, where a comment placed after " +
      "COMMIT; can satisfy any marker the body itself no longer carries."
  );
  return null;
};

// The lock must be the FIRST executable statement of a body, not merely
// present in it. Round 3 review moved it to just before RETURN v_count;, after
// the whole insert loop: two concurrent calls then both read an empty pool,
// both decide to seed, and the merge this migration exists to prevent (47 rows
// instead of 30) comes straight back while the guard stays green. Comments and
// blank lines are skipped, so documenting the lock above itself stays allowed.
const firstExecutableStatement = (body) => {
  const lines = body.split("\n");
  const beginAt = lines.findIndex((line) => line.trim() === "BEGIN");
  if (beginAt === -1) return null;
  for (let i = beginAt + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || trimmed.startsWith("--")) continue;
    return trimmed;
  }
  return "";
};

const LOCK = "PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));";
const SEEDED_PRECONDITION = "SELECT 1 FROM user_typeface_state WHERE user_id = p_user_id";
// Unique to try_unlock_if_pool_stuck's visibility check: no other function in
// this file compares next_due_after_q to global_q_index.
const STUCK_PRECONDITION_MARKER = "uts.next_due_after_q <= u.global_q_index";

// Both halves of the round 3 fix must carry ALL FOUR of these, or none:
// getPoolRows (provider.ts) is what actually gets served, try_unlock_if_pool_stuck's
// precondition (migration) is what decides the pool "looks" stuck. Written as
// the shared prefix of each filter so it matches both the SQL parameter form
// (tc.license_type::text = ANY(p_allowed_license_types)) and the JS
// interpolated form (tc.license_type::text = ANY(${...}::text[])).
const VISIBILITY_MARKERS = [
  "tc.activation_status = true",
  "tc.license_type::text = ANY(",
  "tc.typeface_slug = ANY(",
  "tc.typeface_slug <> ALL(",
];

// try_unlock_if_pool_stuck's four parameters, declared in the migration and
// passed BY NAME at the single call site. Three of them are text[] in a row:
// positionally they are interchangeable, so only the named form makes an
// inversion impossible to write silently. Both halves are checked, the
// declaration in the migration and the named form in provider.ts, so renaming
// a parameter on one side alone is a failure and not a runtime 42883.
const STUCK_PARAMETERS = [
  "p_user_id",
  "p_allowed_license_types",
  "p_ufl_legacy_slugs",
  "p_latin_unready_slugs",
];

const migration = readOrNull(MIGRATION);
// Extracted once, inside the migration block below, and reused by the twin
// comparison against provider.ts: extracting the same body twice would report
// an unterminated or duplicated body twice for one defect.
let stuckBodyForTwins = null;

if (migration === null) {
  failures.push(`${MIGRATION} does not exist.`);
} else {
  // ---------------------------------------------------------- six bodies, extracted
  const initUuidBody = extractBody(
    migration,
    "init_user_pool(p_user_id uuid)",
    "init_user_pool(p_user_id uuid)"
  );
  const initFamiliarityBody = extractBody(
    migration,
    "init_user_pool(p_user_id uuid, p_familiarity text)",
    "init_user_pool(p_user_id uuid, p_familiarity text)"
  );
  const rebalanceBody = extractBody(
    migration,
    "rebalance_user_pool(p_user_id uuid)",
    "rebalance_user_pool(p_user_id uuid)"
  );
  const tryUnlockOneBody = extractBody(
    migration,
    "try_unlock_one_typeface(p_user_id uuid)",
    "try_unlock_one_typeface(p_user_id uuid)"
  );
  const registerMasteryBody = extractBody(
    migration,
    "register_mastery_unlock(p_user_id uuid)",
    "register_mastery_unlock(p_user_id uuid)"
  );
  const tryUnlockStuckBody = extractBody(
    migration,
    "try_unlock_if_pool_stuck(",
    "try_unlock_if_pool_stuck(...)"
  );
  stuckBodyForTwins = tryUnlockStuckBody;

  const SIX = [
    ["init_user_pool(p_user_id uuid)", initUuidBody],
    ["init_user_pool(p_user_id uuid, p_familiarity text)", initFamiliarityBody],
    ["rebalance_user_pool(p_user_id uuid)", rebalanceBody],
    ["try_unlock_one_typeface(p_user_id uuid)", tryUnlockOneBody],
    ["register_mastery_unlock(p_user_id uuid)", registerMasteryBody],
    ["try_unlock_if_pool_stuck(...)", tryUnlockStuckBody],
  ];

  for (const [label, body] of SIX) {
    if (body === null) {
      failures.push(
        `${MIGRATION}: does not define ${label}. All six pool bodies must exist and each take ` +
          "its own lock, or none of them serialises anything."
      );
      continue; // nothing further to check on a body that does not exist
    }
    if (!body.includes(LOCK)) {
      failures.push(
        `${MIGRATION}: ${label} does not take the per-user advisory lock INSIDE its own body. ` +
          "The lock expression appearing anywhere else in the file (a header comment, another " +
          "function) serialises nothing: each of the six bodies must take it itself, as its own " +
          "first statement."
      );
      continue;
    }
    // PRESENT IS NOT ENOUGH, IT MUST BE FIRST. A lock taken after the work is
    // done serialises nothing that matters: both concurrent callers read the
    // pool before either takes it, both conclude it is empty, and both seed.
    const first = firstExecutableStatement(body);
    if (first === null) {
      failures.push(
        `${MIGRATION}: ${label} has no line containing exactly "BEGIN", so the position of its ` +
          "advisory lock cannot be verified. Keep the plpgsql block opener on its own line."
      );
    } else if (first !== LOCK) {
      failures.push(
        `${MIGRATION}: ${label} takes the per-user advisory lock, but NOT as its first executable ` +
          `statement after BEGIN. Found "${first}" there instead. A lock taken after the ` +
          "precondition or after the insert loop serialises nothing that matters: two concurrent " +
          "callers both read the pool before either holds the lock, both find it empty, and both " +
          "seed, which is exactly the 47-row merge this migration exists to prevent. Comments and " +
          "blank lines before the lock are fine, statements are not."
      );
    }
  }

  // ------------------------------------------------- init_user_pool: already-seeded precondition
  // A lock that only serialises lets the loser wake up and insert the rows of
  // its own selection that the winner's selection did not contain: the two
  // arities select differently by design (tier N and D easy first against
  // quotas that open tier C), so ON CONFLICT DO NOTHING does not absorb that
  // gap, only the rows both sides happened to pick. Measured at 47 rows
  // instead of 30 with the lock alone, round 2 of this task.
  const checkAlreadySeededPrecondition = (label, body) => {
    if (body === null) return; // reported above already
    const loopAt = body.indexOf("FOR v_slug IN");
    const preAt = body.indexOf(SEEDED_PRECONDITION);
    if (preAt === -1 || (loopAt !== -1 && preAt > loopAt)) {
      failures.push(
        `${MIGRATION}: ${label} has the lock but no early-return re-check before its selection. ` +
          `Add "IF EXISTS (${SEEDED_PRECONDITION}) THEN RETURN 0; END IF;" immediately after the ` +
          "lock, before any selection."
      );
      return;
    }
    const endIfAt = body.indexOf("END IF;", preAt);
    const thenBranch = endIfAt === -1 ? body.slice(preAt) : body.slice(preAt, endIfAt);
    if (!thenBranch.includes("RETURN 0;")) {
      failures.push(
        `${MIGRATION}: ${label}'s already-seeded check does not RETURN 0 inside its THEN branch. ` +
          "A no-op branch (THEN NULL; END IF;) would satisfy a bare presence check without " +
          "actually skipping the selection: the THEN branch must genuinely return."
      );
    }
  };
  checkAlreadySeededPrecondition("init_user_pool(p_user_id uuid)", initUuidBody);
  checkAlreadySeededPrecondition(
    "init_user_pool(p_user_id uuid, p_familiarity text)",
    initFamiliarityBody
  );

  // BOTH precondition shapes are forbidden in BOTH of these two bodies, and
  // the success message printed at the bottom claims exactly that. Round 3
  // review injected the STUCK precondition into rebalance_user_pool, which was
  // only ever tested against the SEEDED one, and the guard exited 0 while
  // still printing "rebalance_user_pool and try_unlock_one_typeface carry
  // neither precondition". Four tests now, one per pair, so the sentence is
  // true rather than merely reassuring.
  //
  // WHY EACH ONE IS A REAL DEFECT.
  // rebalance_user_pool is ADD-ONLY BY DESIGN: it tops up an already seeded
  // pool with easier faces on a redescente. An already-seeded early return
  // disables it entirely; a "pool already has an eligible face" early return
  // disables it exactly when the player is playing, which is the only moment
  // it is ever called.
  // try_unlock_one_typeface is the I-07 growth primitive, called by
  // register_mastery_unlock at the three-stabilisation threshold, a moment
  // when the pool almost always has an eligible face: either precondition
  // there disables growth in silence and pending_unlock_count climbs for ever.
  const FORBIDDEN_PRECONDITIONS = [
    [
      SEEDED_PRECONDITION,
      "already-seeded precondition",
      "an early return on a pool that already has rows",
    ],
    [
      STUCK_PRECONDITION_MARKER,
      "stuck-pool visibility precondition",
      "an early return on a pool that already has an eligible face",
    ],
  ];
  const WHY_FORBIDDEN = {
    "rebalance_user_pool":
      "rebalance_user_pool must stay add-only: its whole purpose is to inject easier faces into a " +
      "pool that is ALREADY seeded and being played, so either early return disables it entirely.",
    "try_unlock_one_typeface":
      "try_unlock_one_typeface is also the I-07 growth primitive, called by register_mastery_unlock " +
      "at the three-stabilisation threshold, when the pool almost always already has rows and an " +
      "eligible face: either early return disables growth in silence and pending_unlock_count " +
      "climbs for ever. Preconditions belong to init_user_pool and try_unlock_if_pool_stuck only.",
  };
  for (const [name, body] of [
    ["rebalance_user_pool", rebalanceBody],
    ["try_unlock_one_typeface", tryUnlockOneBody],
  ]) {
    if (body === null) continue; // reported above already
    for (const [marker, shape, effect] of FORBIDDEN_PRECONDITIONS) {
      if (body.includes(marker)) {
        failures.push(
          `${MIGRATION}: ${name} carries the ${shape} ("${marker}"), which is ${effect}. ` +
            WHY_FORBIDDEN[name]
        );
      }
    }
  }

  // --------------------------------------------- try_unlock_if_pool_stuck: visibility precondition
  if (tryUnlockStuckBody !== null) {
    // The call site passes these four by name. A rename here alone would turn
    // the named call into a runtime 42883, at the exact moment the §4.5 path
    // is needed and nowhere else, so the two sides are pinned together.
    for (const parameter of STUCK_PARAMETERS) {
      if (!tryUnlockStuckBody.includes(parameter)) {
        failures.push(
          `${MIGRATION}: try_unlock_if_pool_stuck no longer declares the parameter "${parameter}". ` +
            `${PROVIDER} passes all four by name, so a rename on this side alone turns the call ` +
            "into a runtime 42883 on the one path that exists to keep the game from being stuck."
        );
      }
    }

    const preAt = tryUnlockStuckBody.indexOf(STUCK_PRECONDITION_MARKER);
    if (preAt === -1) {
      failures.push(
        `${MIGRATION}: try_unlock_if_pool_stuck does not compare next_due_after_q to ` +
          "global_q_index. Its precondition must check whether an eligible face already exists."
      );
    } else {
      const endIfAt = tryUnlockStuckBody.indexOf("END IF;", preAt);
      const thenBranch =
        endIfAt === -1 ? tryUnlockStuckBody.slice(preAt) : tryUnlockStuckBody.slice(preAt, endIfAt);
      if (!thenBranch.includes("RETURN NULL;")) {
        failures.push(
          `${MIGRATION}: try_unlock_if_pool_stuck's eligibility check does not RETURN NULL inside ` +
            "its THEN branch. A no-op branch would satisfy a bare presence check without actually " +
            "skipping the unlock."
        );
      }
    }

    // Round 3. The precondition must see EXACTLY what getPoolRows sees, not a
    // superset: matched marker for marker against provider.ts below.
    for (const marker of VISIBILITY_MARKERS) {
      if (!tryUnlockStuckBody.includes(marker)) {
        failures.push(
          `${MIGRATION}: try_unlock_if_pool_stuck's precondition is missing the visibility filter ` +
            `"${marker}". It must apply the SAME filters as getPoolRows (activation_status, the ` +
            "licence allowlist, the UFL legacy fallback, the latin coverage exclusion), or it sees " +
            "a superset of what the player can actually be served, and a row invisible to the " +
            "player but counted eligible here never gets rescheduled: the unlock dies permanently " +
            "for that user."
        );
      }
    }
  }

  // ------------------------------------------------------------- whole-file, but comments stripped
  // "boolean DEFAULT" is a whole-file check by nature (an overload can be
  // introduced on any function, not just one named body), but scanning the
  // raw file already produced a false positive once: a header comment
  // explaining why NOT to add this overload contains the same substring it
  // warns against. Comment lines are stripped before this one check runs, so
  // only actual code can trigger it.
  const codeOnly = migration
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  if (codeOnly.includes("boolean DEFAULT")) {
    failures.push(
      `${MIGRATION}: introduces a default-parameter overload in code. The one-argument call at ` +
        "008_pool_growth.sql:191 would become ambiguous, error 42725. Use a new function name."
    );
  }
}

const provider = readOrNull(PROVIDER);

if (provider === null) {
  failures.push(`${PROVIDER} does not exist.`);
} else {
  const start = provider.indexOf("const recoverPoolIfStuck");
  if (start === -1) {
    failures.push(`${PROVIDER}: no longer defines recoverPoolIfStuck.`);
  } else {
    const next = provider.indexOf("\nconst ", start + 24);
    const body = provider.slice(start, next === -1 ? provider.length : next);

    if (!body.includes("try_unlock_if_pool_stuck")) {
      failures.push(`${PROVIDER}: recoverPoolIfStuck still calls the growth primitive directly. The §4.5 stuck-pool path must go through try_unlock_if_pool_stuck.`);
    }
    // NAMED ARGUMENTS, NOT POSITIONAL. try_unlock_if_pool_stuck takes three
    // text[] parameters in a row, so swapping two of them at the call site is
    // a silent defect: Postgres accepts it (same type), the guard cannot see
    // it, and the precondition then filters slugs against the licence list and
    // licences against the slug list. Nothing raises, the precondition just
    // stops matching what getPoolRows serves and the §4.5 unlock drifts. The
    // "p_name => value" form makes an inversion impossible to write without
    // noticing, because the name travels with the value.
    for (const parameter of STUCK_PARAMETERS) {
      if (!body.includes(`${parameter} =>`)) {
        failures.push(
          `${PROVIDER}: recoverPoolIfStuck does not pass "${parameter}" to ` +
            "try_unlock_if_pool_stuck by NAME. Its three text[] parameters are positionally " +
            "interchangeable, so a swapped pair is invisible to Postgres and to this guard: use " +
            `the named form, ${parameter} => ..., for all four arguments.`
        );
      }
    }
    // The fallback is not optional. Migration 012 is deliberately NOT applied in
    // production, so between this commit and the migration the new function does
    // not exist and the call raises 42883. Without a retry on the old function,
    // the §4.5 path would fall straight to the cursor jump and the silent unlock
    // of a new face would disappear from production, a regression on behaviour
    // that works today.
    if (!body.includes("42883")) {
      failures.push(`${PROVIDER}: recoverPoolIfStuck does not name 42883 in its fallback. Until 012 is applied, try_unlock_if_pool_stuck does not exist and the catch must retry try_unlock_one_typeface before falling to the cursor jump.`);
    }
    const catchAt = body.indexOf("} catch");
    if (catchAt === -1 || !body.slice(catchAt).includes("try_unlock_one_typeface")) {
      failures.push(`${PROVIDER}: the catch of recoverPoolIfStuck does not retry try_unlock_one_typeface. A pre-migration deployment would silently lose the unlock path.`);
    }
    if (body.includes("migration 008 not applied")) {
      failures.push(`${PROVIDER}: the warning still names try_unlock_one_typeface and migration 008. The failing call is try_unlock_if_pool_stuck and the missing migration is 012.`);
    }
  }

  // Round 3. getPoolRows must carry the SAME visibility filters as
  // try_unlock_if_pool_stuck's precondition, marker for marker: the two are
  // twins, and one drifting from the other is exactly the defect this rule
  // exists to catch. Extracted the same way as recoverPoolIfStuck above: from
  // its own "const getPoolRows" to the next top-level "const ".
  const poolRowsStart = provider.indexOf("const getPoolRows");
  if (poolRowsStart === -1) {
    failures.push(`${PROVIDER}: no longer defines getPoolRows.`);
  } else {
    const poolRowsNext = provider.indexOf("\nconst ", poolRowsStart + 1);
    const poolRowsBody = provider.slice(
      poolRowsStart,
      poolRowsNext === -1 ? provider.length : poolRowsNext
    );
    const stuckBody = stuckBodyForTwins;
    if (stuckBody !== null) {
      for (const marker of VISIBILITY_MARKERS) {
        const inProvider = poolRowsBody.includes(marker);
        const inMigration = stuckBody.includes(marker);
        if (inProvider !== inMigration) {
          failures.push(
            `${PROVIDER} and ${MIGRATION} disagree on the visibility filter "${marker}": present ` +
              `in ${inProvider ? "getPoolRows" : "try_unlock_if_pool_stuck"} only. getPoolRows and ` +
              "try_unlock_if_pool_stuck's precondition are twins and must apply exactly the same " +
              "filters, or the precondition sees a different pool than the one actually served."
          );
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error("check:pool-serialisation FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

// Every clause below is a clause that was actually tested above. The previous
// version claimed "rebalance_user_pool and try_unlock_one_typeface carry
// neither precondition" while only ever testing one of the two markers on one
// of the two bodies, and printed the claim over an injected precondition.
console.log(
  "check:pool-serialisation OK : all six pool bodies exist, each defined once, each closed by its " +
    "own terminator, and each takes the per-user advisory lock as its FIRST executable statement " +
    "after BEGIN, init_user_pool's two arities and try_unlock_if_pool_stuck each genuinely return " +
    "on an already-satisfied precondition, rebalance_user_pool and try_unlock_one_typeface carry " +
    "neither of the two precondition shapes, try_unlock_if_pool_stuck's visibility filters match " +
    "getPoolRows marker for marker, and recoverPoolIfStuck calls try_unlock_if_pool_stuck with all " +
    "four arguments passed BY NAME and a 42883 fallback onto try_unlock_one_typeface."
);
