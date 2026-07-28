#!/usr/bin/env node

// Question token signing secret check. No build, no database, no network.
//
// The HMAC of lib/game/training/question-token.ts carries typefaceSlug, so it is
// what makes a submitted answer impossible to forge. The module used to fall back
// to DATABASE_URL and then to a literal committed in clear, which meant a
// production deploy that forgot GAME_PROVIDER_SECRET signed its tokens with a
// guessable value and nothing said so.
//
// Reading the file would not prove much, so the four cases below run the real
// module in a subprocess, with node type stripping, and assert behaviour:
//
//   1. production without the secret throws and names GAME_PROVIDER_SECRET.
//   2. production with DATABASE_URL set but no secret still throws, so the old
//      fallback is gone and not merely reordered.
//   3. production with the secret signs a token whose format and signature match
//      an HMAC SHA-256 computed here, round trips through verifyQuestionToken,
//      and refuses a tampered payload.
//   4. development without the secret still works, so a local run with no
//      environment file is not broken by the production guard.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PROJECT_ROOT = process.cwd();
const TOKEN_MODULE = "lib/game/training/question-token.ts";
const MODULE_URL = pathToFileURL(path.join(PROJECT_ROOT, TOKEN_MODULE)).href;
const TEST_SECRET = "check-token-secret-fixture";

const failures = [];

const PAYLOAD_LITERAL = JSON.stringify({
  sessionId: "00000000-0000-0000-0000-000000000001",
  userId: "00000000-0000-0000-0000-000000000002",
  questionId: "00000000-0000-0000-0000-000000000003",
  globalQIndex: 7,
  typefaceSlug: "inter",
  displayWord: "typographie",
  options: ["Inter", "Roboto", "Lato", "Rubik"],
});

// Runs a probe against the real module. NODE_ENV and the two variables under
// test are set explicitly, and the parent environment is passed through so the
// subprocess keeps its module resolution.
const runProbe = (label, env, probeSource) => {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", probeSource],
    {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      env: { ...process.env, GAME_PROVIDER_SECRET: "", DATABASE_URL: "", ...env },
    }
  );

  if (result.error) {
    failures.push(`${label}: could not start the probe (${result.error.message})`);
    return null;
  }

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

const signingProbe = `
import { createQuestionToken } from ${JSON.stringify(MODULE_URL)};

const token = createQuestionToken(${PAYLOAD_LITERAL});
console.log("TOKEN " + token);
`;

const roundTripProbe = `
import crypto from "node:crypto";
import { createQuestionToken, verifyQuestionToken } from ${JSON.stringify(MODULE_URL)};

const payload = ${PAYLOAD_LITERAL};
const json = JSON.stringify(payload);
const token = createQuestionToken(payload);
const [encodedPayload, signature] = token.split(".");

const expectedSignature = crypto
  .createHmac("sha256", process.env.GAME_PROVIDER_SECRET)
  .update(json)
  .digest("base64url");

if (Buffer.from(encodedPayload, "base64url").toString("utf8") !== json) {
  console.error("PROBE payload is not the base64url JSON payload");
  process.exit(1);
}

if (signature !== expectedSignature) {
  console.error("PROBE signature is not an HMAC SHA-256 of the payload in base64url");
  process.exit(1);
}

const verified = verifyQuestionToken(token);

if (verified === null || verified.typefaceSlug !== payload.typefaceSlug) {
  console.error("PROBE verifyQuestionToken refused a token it had just signed");
  process.exit(1);
}

const forged = Buffer.from(
  JSON.stringify({ ...payload, typefaceSlug: "roboto" })
).toString("base64url");

if (verifyQuestionToken(forged + "." + signature) !== null) {
  console.error("PROBE verifyQuestionToken accepted a tampered payload");
  process.exit(1);
}

console.log("ROUND_TRIP ok");
`;

// Case 1: production, no secret at all.
const productionWithoutSecret = runProbe(
  "production without GAME_PROVIDER_SECRET",
  { NODE_ENV: "production" },
  signingProbe
);

if (productionWithoutSecret !== null) {
  if (productionWithoutSecret.status === 0) {
    failures.push(
      `${TOKEN_MODULE}: signed a token with NODE_ENV=production and no GAME_PROVIDER_SECRET, so production still has a guessable fallback`
    );
  } else if (!productionWithoutSecret.stderr.includes("GAME_PROVIDER_SECRET")) {
    failures.push(
      `${TOKEN_MODULE}: failed in production without the secret, but the error never names GAME_PROVIDER_SECRET, so nobody can act on it (stderr: ${productionWithoutSecret.stderr.trim().split("\n").pop()})`
    );
  }
}

// Case 2: production, no secret, but a database URL in the environment. This is
// the removed fallback, and the deploy that forgets the secret is exactly the
// deploy that has DATABASE_URL set.
const productionWithDatabaseUrl = runProbe(
  "production with DATABASE_URL and no GAME_PROVIDER_SECRET",
  {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://user:password@example.neon.tech/db?sslmode=require",
  },
  signingProbe
);

if (productionWithDatabaseUrl !== null && productionWithDatabaseUrl.status === 0) {
  failures.push(
    `${TOKEN_MODULE}: signed a token in production from DATABASE_URL alone, so the connection string is still used as a signing key`
  );
}

// Case 3: production, secret posed. Format, signature and round trip.
const productionWithSecret = runProbe(
  "production with GAME_PROVIDER_SECRET",
  { NODE_ENV: "production", GAME_PROVIDER_SECRET: TEST_SECRET },
  roundTripProbe
);

if (productionWithSecret !== null && !productionWithSecret.stdout.includes("ROUND_TRIP ok")) {
  failures.push(
    `${TOKEN_MODULE}: production run with a secret did not produce a verifiable token (${(
      productionWithSecret.stderr || productionWithSecret.stdout
    )
      .trim()
      .split("\n")
      .pop()})`
  );
}

// Case 4: development, no secret. The local run must keep working.
const developmentWithoutSecret = runProbe(
  "development without GAME_PROVIDER_SECRET",
  { NODE_ENV: "development" },
  signingProbe
);

if (developmentWithoutSecret !== null && !developmentWithoutSecret.stdout.includes("TOKEN ")) {
  failures.push(
    `${TOKEN_MODULE}: development run without a secret no longer signs anything, so a local session cannot start (${(
      developmentWithoutSecret.stderr || developmentWithoutSecret.stdout
    )
      .trim()
      .split("\n")
      .pop()})`
  );
}

if (failures.length > 0) {
  console.error("Question token secret violations detected:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Question token secret verified: production without GAME_PROVIDER_SECRET throws and names it, DATABASE_URL is no longer a fallback, production with the secret signs a verifiable HMAC SHA-256 token and refuses a tampered payload, development without the secret still signs."
);
