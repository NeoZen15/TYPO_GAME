import "server-only";

import { cookies } from "next/headers";

// Same guest cookie the game routes set on first play
// (app/api/training/session/start/route.ts). The profile reads it to derive
// real, per-player data. No auth yet — the cookie IS the identity.
export const GUEST_COOKIE_NAME = "jdt_guest_user_id";

const GUEST_USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Resolve the current player's id from the guest cookie, or null if none/invalid
// (a fresh visitor who has never played). Server-only.
export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(GUEST_COOKIE_NAME)?.value ?? null;
  return value && GUEST_USER_ID_PATTERN.test(value) ? value : null;
}
