import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { normalizeAttemptId, normalizeFamiliarity } from "@/lib/game/training/contracts";
import { startTrainingSession } from "@/lib/game/training/provider";

const GUEST_COOKIE_NAME = "jdt_guest_user_id";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      locale?: "fr" | "en";
      familiarity?: string;
      warmupCorrect?: boolean;
      attemptId?: string;
    };
    const cookieStore = await cookies();
    const existingGuestUserId = cookieStore.get(GUEST_COOKIE_NAME)?.value ?? null;

    const result = await startTrainingSession({
      locale: body.locale === "en" ? "en" : "fr",
      guestUserId: existingGuestUserId,
      familiarity: normalizeFamiliarity(body.familiarity),
      // Only a real boolean is a signal; anything else means "no downgrade".
      warmupCorrect: typeof body.warmupCorrect === "boolean" ? body.warmupCorrect : null,
      // One attempt equals one identifier. This is the ONLY value the client is
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
    console.error("training/session/start failed", error);
    return NextResponse.json(
      { error: "training_session_start_failed" },
      { status: 500 }
    );
  }
}
