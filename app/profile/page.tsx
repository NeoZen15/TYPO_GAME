import { Suspense } from "react";
import type { Metadata } from "next";
import ProfileExperience from "@/features/profile/components/ProfileExperience";
import { loadBrandArt } from "@/lib/brand/brand-art";
import { getTrainingFontFaceCss } from "@/lib/game/training/catalog";
import { getCurrentUserId } from "@/lib/server/current-user";
import { loadRealProfile } from "@/lib/profile/profile-stats";

export const metadata: Metadata = {
  title: "Profile",
};

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  // `?preview=mock` still shows the demo data, to judge the boards filled.
  const { preview } = await searchParams;
  // Inject the real catalog @font-face rules (JDT__<slug>) so the mastery
  // wall can render specimens, like the landing does.
  const fontFaceCss = getTrainingFontFaceCss();
  // Real Dwiggins artwork (logo paths) for the badge engine — Arena blason +
  // Achievements. Loaded server-side, passed as serializable strings.
  const art = loadBrandArt();

  // Real, per-player stats + eye constellation, derived from the game DB for
  // the current guest (the cookie IS the identity). Without play history the page
  // is the same as everyone's, at zero, under a "nothing here yet" banner.
  // A visitor without a cookie reads the nil uuid: no row matches, so every
  // figure comes back at zero while the catalog total stays the real one.
  const userId = (await getCurrentUserId()) ?? NIL_UUID;
  let real: Awaited<ReturnType<typeof loadRealProfile>> = null;
  if (preview !== "mock") {
    try {
      real = await loadRealProfile(userId);
    } catch (error) {
      console.error("[profile] failed to load real profile, using mock:", error);
    }
  }

  return (
    <>
      {fontFaceCss ? <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} /> : null}
      {/* Suspense because the experience reads ?view= to open on a board, which
          is what lets a session recap link straight to the numbers. */}
      <Suspense fallback={null}>
        <ProfileExperience
          art={art}
          profile={real?.profile}
          eye={real?.eye}
          empty={real ? !real.played : false}
        />
      </Suspense>
    </>
  );
}
