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

const getSigningSecret = () =>
  process.env.GAME_PROVIDER_SECRET ??
  process.env.DATABASE_URL ??
  "jeux-de-typo-dev-secret";

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
