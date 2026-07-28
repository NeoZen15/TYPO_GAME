import crypto from "node:crypto";

export type TrainingQuestionTokenPayload = {
  sessionId: string;
  userId: string;
  questionId: string;
  globalQIndex: number;
  typefaceSlug: string;
  displayWord: string;
  options: string[];
};

// Signing secret, fail closed in production.
//
// This HMAC carries typefaceSlug, so it is what makes a submitted answer
// impossible to forge: whoever knows the secret can mint a token that validates
// any answer. The fallback chain used to be GAME_PROVIDER_SECRET, then
// DATABASE_URL, then the literal below. A production deploy that forgot the
// variable therefore signed its tokens either with the database connection
// string or with a value committed in clear in this repository.
//
// The DATABASE_URL fallback is removed in every environment, not just in
// production: reusing a connection string as a signing key spreads a credential
// into every token it signs, and it buys nothing. Production now throws instead,
// which makes GAME_PROVIDER_SECRET a mandatory production environment variable.
// The development literal stays so a local run without an environment file keeps
// working, and it is unreachable once NODE_ENV is production.
//
// The token format and the algorithm are untouched, HMAC SHA-256 over the JSON
// payload in base64url: changing either would invalidate every session in
// flight. Verified by scripts/quality/check-token-secret.mjs.
const DEV_SIGNING_SECRET = "jeux-de-typo-dev-secret";

const getSigningSecret = () => {
  const configured = process.env.GAME_PROVIDER_SECRET?.trim();

  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "GAME_PROVIDER_SECRET is missing: question tokens sign the correct answer, so production has no safe fallback. Set GAME_PROVIDER_SECRET in the deployment environment."
    );
  }

  return DEV_SIGNING_SECRET;
};

const encodeBase64Url = (input: string) => Buffer.from(input).toString("base64url");

const sign = (payload: string) =>
  crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");

export const createQuestionToken = (payload: TrainingQuestionTokenPayload) => {
  const json = JSON.stringify(payload);
  return `${encodeBase64Url(json)}.${sign(json)}`;
};

export const verifyQuestionToken = (token: string) => {
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const payloadJson = Buffer.from(encodedPayload, "base64url").toString("utf-8");
  const expectedSignature = sign(payloadJson);

  const provided = Buffer.from(encodedSignature, "utf-8");
  const expected = Buffer.from(expectedSignature, "utf-8");

  if (provided.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  const payload = JSON.parse(payloadJson) as TrainingQuestionTokenPayload;
  return payload;
};
