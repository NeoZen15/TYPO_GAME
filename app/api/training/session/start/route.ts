import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { normalizeFamiliarity } from "@/lib/game/training/contracts";
import { startTrainingSession } from "@/lib/game/training/provider";

const GUEST_COOKIE_NAME = "jdt_guest_user_id";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      locale?: "fr" | "en";
      familiarity?: string;
      warmupCorrect?: boolean;
    };
    const cookieStore = await cookies();
    const existingGuestUserId = cookieStore.get(GUEST_COOKIE_NAME)?.value ?? null;

    const result = await startTrainingSession({
      locale: body.locale === "en" ? "en" : "fr",
      guestUserId: existingGuestUserId,
      familiarity: normalizeFamiliarity(body.familiarity),
      // Only a real boolean is a signal; anything else means "no downgrade".
      warmupCorrect: typeof body.warmupCorrect === "boolean" ? body.warmupCorrect : null,
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
