import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { startCompetitionSession } from "@/lib/game/competition/provider";
import { normalizeAttemptId } from "@/lib/game/training/contracts";

const GUEST_COOKIE_NAME = "jdt_guest_user_id";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      locale?: "fr" | "en";
      attemptId?: string;
    };
    const cookieStore = await cookies();
    const existingGuestUserId = cookieStore.get(GUEST_COOKIE_NAME)?.value ?? null;

    const result = await startCompetitionSession({
      locale: body.locale === "en" ? "en" : "fr",
      guestUserId: existingGuestUserId,
      // One round equals one identifier. This is the ONLY value the client is
      // allowed to choose that reaches a primary key, and it is validated as a
      // uuid before it gets there: a malformed one becomes null and the server
      // mints its own, so a stale or hostile body can never answer 500. The
      // identity above stays out of the body, it comes from the httpOnly cookie.
      attemptId: normalizeAttemptId(body.attemptId),
    });

    const response = NextResponse.json(result.payload);
    if (result.guestWasCreated || existingGuestUserId !== result.guestUserId) {
      response.cookies.set(GUEST_COOKIE_NAME, result.guestUserId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("competition/session/start failed", error);
    return NextResponse.json(
      { error: "competition_session_start_failed" },
      { status: 500 }
    );
  }
}
