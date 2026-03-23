import { NextResponse } from "next/server";

import { timeoutCompetitionSession } from "@/lib/game/competition/provider";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { sessionId?: string };

    if (!body.sessionId) {
      return NextResponse.json(
        { error: "invalid_competition_timeout_payload" },
        { status: 400 }
      );
    }

    const result = await timeoutCompetitionSession({
      sessionId: body.sessionId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("competition/session/timeout failed", error);
    return NextResponse.json(
      { error: "competition_session_timeout_failed" },
      { status: 500 }
    );
  }
}
