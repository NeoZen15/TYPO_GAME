#!/usr/bin/env node

// Pool serialisation guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. Under overlap, two pool initialisations for the same
// user fill the pool twice: measured at 47 rows instead of 30, 5 runs out of 5,
// zero variance, because the loser waits, then inserts the 17 rows of its own
// selection that are missing. No SQLSTATE is raised, ON CONFLICT DO NOTHING
// absorbs the merge in silence, and ensureUserPool's count guard is proven
// inoperative under concurrency. Migration 012 serialises the five pool bodies
// on a per-user advisory lock, which is the only thing that closes it.
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

const migration = readOrNull(MIGRATION);

if (migration === null) {
  failures.push(`${MIGRATION} does not exist.`);
} else {
  // The two arities are both called (provider.ts:279 and :289) and both must be
  // replaced. The closing parenthesis in the needle is what keeps the
  // one-argument signature from matching the two-argument one.
  const BODIES = [
    "init_user_pool(p_user_id uuid)",
    "init_user_pool(p_user_id uuid, p_familiarity text)",
    "rebalance_user_pool",
    "try_unlock_one_typeface",
    "register_mastery_unlock",
  ];
  for (const fn of BODIES) {
    if (!migration.includes(fn)) {
      failures.push(`${MIGRATION}: does not replace ${fn}. All five pool bodies take the lock, or none of them serialises anything.`);
    }
  }
  if (!migration.includes("try_unlock_if_pool_stuck")) {
    failures.push(`${MIGRATION}: does not create try_unlock_if_pool_stuck.`);
  }
  if (!migration.includes("pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0))")) {
    failures.push(`${MIGRATION}: no per-user advisory lock. The lock key must be derived from p_user_id, identically in every body, or two bodies serialise on different keys and nothing is serialised at all.`);
  }
  if (migration.includes("boolean DEFAULT")) {
    failures.push(`${MIGRATION}: introduces a default-parameter overload. The one-argument call at 008_pool_growth.sql:191 would become ambiguous, error 42725. Use a new function name.`);
  }

  // Review round 2. Measured on a throwaway Neon branch (tmp/prove-pool.mjs,
  // Test C): the advisory lock alone does not close the merge. It only makes
  // the two init_user_pool calls take turns; the loser still wakes up and
  // runs its OWN selection loop to completion. The two arities select
  // DIFFERENTLY by design (tier N and D easy first, against quotas that open
  // tier C for confident/designer players), so ON CONFLICT DO NOTHING only
  // skips the rows both sides happen to pick, not the rest: measured at 47
  // rows instead of 30, tier C included, even after the lock. Only an
  // internal re-check, taken AFTER the lock and BEFORE the selection, makes
  // the second caller a clean no-op once the first has already seeded the
  // pool, the same shape try_unlock_if_pool_stuck already uses.
  const PRECONDITION_NEEDLE = "SELECT 1 FROM user_typeface_state WHERE user_id = p_user_id";
  const extractBody = (signature) => {
    const start = migration.indexOf(`CREATE OR REPLACE FUNCTION ${signature}`);
    if (start === -1) return null;
    const end = migration.indexOf("\n$$;", start);
    return migration.slice(start, end === -1 ? migration.length : end);
  };

  for (const signature of [
    "init_user_pool(p_user_id uuid)",
    "init_user_pool(p_user_id uuid, p_familiarity text)",
  ]) {
    const body = extractBody(signature);
    if (body === null) continue; // already reported by the BODIES loop above
    const loopAt = body.indexOf("FOR v_slug IN");
    const preconditionAt = body.indexOf(PRECONDITION_NEEDLE);
    if (preconditionAt === -1 || (loopAt !== -1 && preconditionAt > loopAt)) {
      failures.push(
        `${MIGRATION}: ${signature} has the lock but no early-return re-check before its ` +
          "selection. A lock that only serialises lets the loser wake up and insert the rows " +
          "of its own selection that the winner's selection did not contain: the two arities " +
          "select differently by design (tier N and D easy first against quotas that open tier " +
          "C), so ON CONFLICT DO NOTHING does not absorb that gap, only the rows both sides " +
          `picked. Add "IF EXISTS (${PRECONDITION_NEEDLE}) THEN RETURN 0; END IF;" immediately ` +
          "after the lock, before any selection."
      );
    }
  }

  const rebalanceBody = extractBody("rebalance_user_pool(p_user_id uuid)");
  if (rebalanceBody !== null && rebalanceBody.includes(PRECONDITION_NEEDLE)) {
    failures.push(
      `${MIGRATION}: rebalance_user_pool must stay add-only. Its whole purpose is to inject ` +
        "easier faces into a pool that is already seeded; an already-seeded early return would " +
        "disable it entirely."
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
}

if (failures.length > 0) {
  console.error("check:pool-serialisation FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  "check:pool-serialisation OK : 012 replaces the five pool bodies with a per-user advisory lock, " +
    "creates try_unlock_if_pool_stuck under a new name, and recoverPoolIfStuck calls it with a 42883 " +
    "fallback onto try_unlock_one_typeface."
);
