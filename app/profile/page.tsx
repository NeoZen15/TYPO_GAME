import type { Metadata } from "next";
import ProfileExperience from "@/features/profile/components/ProfileExperience";
import { loadBrandArt } from "@/lib/brand/brand-art";
import { getTrainingFontFaceCss } from "@/lib/game/training/catalog";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  // Inject the real catalog @font-face rules (JDT__<slug>) so the mastery
  // wall can render specimens, like the landing does.
  const fontFaceCss = getTrainingFontFaceCss();
  // Real Dwiggins artwork (logo paths) for the badge engine — Arena blason +
  // Achievements. Loaded server-side, passed as serializable strings.
  const art = loadBrandArt();

  return (
    <>
      {fontFaceCss ? <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} /> : null}
      <ProfileExperience art={art} />
    </>
  );
}
