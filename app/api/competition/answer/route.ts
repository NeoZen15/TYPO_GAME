import { NextResponse } from "next/server";

import { submitCompetitionAnswer } from "@/lib/game/competition/provider";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      questionToken?: string;
      answerSlug?: string;
      responseTimeMs?: number;
    };

    if (!body.sessionId || !body.questionToken || !body.answerSlug) {
      return NextResponse.json(
        { error: "invalid_competition_answer_payload" },
        { status: 400 }
      );
    }

    const result = await submitCompetitionAnswer({
      sessionId: body.sessionId,
      questionToken: body.questionToken,
      answerSlug: body.answerSlug,
      responseTimeMs: typeof body.responseTimeMs === "number" ? body.responseTimeMs : 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("competition/answer failed", error);
    return NextResponse.json(
      { error: "competition_answer_failed" },
      { status: 500 }
    );
  }
}
