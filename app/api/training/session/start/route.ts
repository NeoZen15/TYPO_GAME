import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { startTrainingSession } from "@/lib/game/training/provider";

const GUEST_COOKIE_NAME = "jdt_guest_user_id";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { locale?: "fr" | "en" };
    const cookieStore = await cookies();
    const existingGuestUserId = cookieStore.get(GUEST_COOKIE_NAME)?.value ?? null;

    const result = await startTrainingSession({
      locale: body.locale === "en" ? "en" : "fr",
      guestUserId: existingGuestUserId,
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
