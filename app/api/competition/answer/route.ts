import { NextResponse } from "next/server";

import { submitCompetitionAnswer } from "@/lib/game/competition/provider";
import { isGameRequestError } from "@/lib/game/request-error";

export async function POST(request: Request) {
  try {
    // A body that is not JSON is a malformed REQUEST, so it answers 400 with the
    // other malformed bodies below. Left uncaught it threw here and the catch at
    // the bottom reported 500, which says "the server is broken" about a request
    // the server understood perfectly well.
    const body = (await request.json().catch(() => ({}))) as {
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
    // A refused request and a broken server are two different events, and only
    // the provider knows which one this is. Its own refusals carry the status
    // they deserve; anything else stays a 500, deliberately, so a real defect can
    // never be filed as a client mistake. The log line keeps the distinction too,
    // warn against error, because a 500 in this file is worth waking up for and a
    // 409 is somebody clicking after their round ended.
    if (isGameRequestError(error)) {
      console.warn(`competition/answer refused: ${error.code}`, error.message);
      return NextResponse.json({ error: error.code }, { status: error.status });
    }

    console.error("competition/answer failed", error);
    return NextResponse.json(
      { error: "competition_answer_failed" },
      { status: 500 }
    );
  }
}
