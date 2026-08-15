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

export default async function ProfilePage() {
  // Inject the real catalog @font-face rules (JDT__<slug>) so the mastery
  // wall can render specimens, like the landing does.
  const fontFaceCss = getTrainingFontFaceCss();
  // Real Dwiggins artwork (logo paths) for the badge engine — Arena blason +
  // Achievements. Loaded server-side, passed as serializable strings.
  const art = loadBrandArt();

  // Real, per-player stats + eye constellation, derived from the game DB for
  // the current guest (the cookie IS the identity). Falls back to the mock when
  // there is no cookie / no play history yet, or if the DB read fails.
  const userId = await getCurrentUserId();
  let real: Awaited<ReturnType<typeof loadRealProfile>> = null;
  if (userId) {
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
        <ProfileExperience art={art} profile={real?.profile} eye={real?.eye} />
      </Suspense>
    </>
  );
}
