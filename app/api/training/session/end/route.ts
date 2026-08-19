import { NextResponse } from "next/server";

import { isGameRequestError } from "@/lib/game/request-error";
import { endTrainingSession } from "@/lib/game/training/provider";
import { getCurrentUserId } from "@/lib/server/current-user";

// Voluntary end of a training session (I-17). The session is closed and the bilan
// of what just happened is returned. Nothing pedagogical is touched: mastery,
// intervals, cooldowns and the pool are written answer by answer and survive.
//
// Idempotent by design: calling it on an already closed session returns the same
// summary with closedByThisCall false, so a double click or a retry is harmless.
//
// IDENTITY COMES FROM THE COOKIE, NEVER FROM THE BODY. This path used to read
// `userId` out of the JSON payload, which let any caller name whoever it liked.
// The bilan carries personal pedagogical data (confusions, mastery movement,
// response times), and I-15 says that data is readable by no third party, so an
// identity the caller declares about itself cannot be the one we trust. The guest
// cookie is httpOnly and is the only identity this app has (lib/server/current-user).
// A body `userId` is now accepted only to be compared: if it disagrees with the
// cookie, the call is refused rather than silently resolved in favour of one of them.
export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "no_training_identity" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      sessionId?: string;
      userId?: string;
    };

    if (!body.sessionId) {
      return NextResponse.json({ error: "invalid_training_end_payload" }, { status: 400 });
    }

    if (body.userId && body.userId !== userId) {
      return NextResponse.json({ error: "training_identity_mismatch" }, { status: 403 });
    }

    const result = await endTrainingSession({
      sessionId: body.sessionId,
      userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    // Closing a session that does not exist, or one belonging to somebody else,
    // is a fact about the request. It answered 500 until 2026-08-17, which read
    // as a server fault for a caller sending an identifier it should not have.
    if (isGameRequestError(error)) {
      console.warn(`training/session/end refused: ${error.code}`, error.message);
      return NextResponse.json({ error: error.code }, { status: error.status });
    }

    console.error("training/session/end failed", error);
    return NextResponse.json({ error: "training_end_failed" }, { status: 500 });
  }
}
