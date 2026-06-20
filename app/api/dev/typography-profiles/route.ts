import { NextResponse } from "next/server";
import { isDevRuntime } from "@/lib/dev-mode";
import { buildAllTypefaceDevProfiles } from "@/lib/dev/typography/typeface-profile-dev-builder";

export async function GET() {
  if (!isDevRuntime()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const profiles = await buildAllTypefaceDevProfiles({
    runtimeKind: "fallback",
    devicePixelRatio: 1,
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    runtime: "fallback",
    profileCount: profiles.length,
    fontIds: profiles.map((profile) => profile.fontId),
    profiles,
  });
}
