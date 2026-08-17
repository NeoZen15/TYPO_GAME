import { NextResponse } from "next/server";

import { isGameRequestError } from "@/lib/game/request-error";
import { timeoutCompetitionSession } from "@/lib/game/competition/provider";
import { getCurrentUserId } from "@/lib/server/current-user";

export async function POST(request: Request) {
  try {
    // Closing a round is a write on somebody's history, so it needs to know whose.
    // The guest cookie is httpOnly and is the only identity this app has; the body
    // is not asked, because a caller declaring who it is about itself is not an
    // identity. Same rule, same shape as app/api/training/session/end.
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "no_competition_identity" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { sessionId?: string };

    if (!body.sessionId) {
      return NextResponse.json(
        { error: "invalid_competition_timeout_payload" },
        { status: 400 }
      );
    }

    const result = await timeoutCompetitionSession({
      sessionId: body.sessionId,
      userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    // Closing a round that does not exist is a fact about the request, not a
    // fault of the server.
    if (isGameRequestError(error)) {
      console.warn(`competition/session/timeout refused: ${error.code}`, error.message);
      return NextResponse.json({ error: error.code }, { status: error.status });
    }

    console.error("competition/session/timeout failed", error);
    return NextResponse.json(
      { error: "competition_session_timeout_failed" },
      { status: 500 }
    );
  }
}
