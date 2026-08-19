// A refused request is not a broken server.
//
// Every provider path used to signal every refusal with a bare `new Error`, and
// the routes caught all of them into one 500. Measured on 2026-08-17 against the
// running server: an expired session, a token that belongs to another round, a
// question already answered and a session id that does not exist all answered
// `500 { error: "..._failed" }`. Two consequences, and the second is the one that
// bites after a launch.
//
// For the player, nothing: the screens turn any non-ok response into the same
// banner, so the status code was invisible. For whoever watches production, a
// steady stream of 500s produced by people clicking after a round expired, which
// is ordinary behaviour, not an incident. A monitor that cries wolf on normal use
// stops being read, and the real 500 arrives inside that noise.
//
// So the distinction is drawn HERE, in the provider, because the provider is the
// only place that knows which it is. A GameRequestError says "this request cannot
// be served, and that is a fact about the request". Anything else thrown stays a
// 500, deliberately: an unexpected failure must never be dressed up as a client
// mistake, that is how a real defect gets filed as user error.
//
// The `code` travels to the client in the body, unchanged in spirit from the
// existing `{ error: "..." }` shape the screens already read. The `message` is
// for the server log and is never sent, because a refusal message can describe
// state belonging to somebody else.

export type GameRequestErrorCode =
  | "invalid_question_token"
  | "invalid_answer_option"
  | "session_not_found"
  | "session_not_active"
  | "identity_mismatch";

const STATUS_BY_CODE: Record<GameRequestErrorCode, number> = {
  // The token failed its HMAC, or names a session other than the one posted.
  // 400: the request is malformed. Not 403, which would suggest that a correct
  // credential exists for this caller, and not 401, there being nothing to log in to.
  invalid_question_token: 400,
  // The answer is not one of the four options the signed token carries.
  invalid_answer_option: 400,
  // No such session, or none this caller may play.
  session_not_found: 404,
  // The session exists and is closed. 409 rather than 404: the resource is real,
  // its state refuses the operation, and that difference is exactly what a client
  // needs to tell "you already finished" from "that never existed".
  session_not_active: 409,
  // The signed token names a different player than the session does.
  identity_mismatch: 403,
};

export class GameRequestError extends Error {
  readonly code: GameRequestErrorCode;
  readonly status: number;

  constructor(code: GameRequestErrorCode, message: string) {
    super(message);
    this.name = "GameRequestError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export const isGameRequestError = (error: unknown): error is GameRequestError =>
  error instanceof GameRequestError;
