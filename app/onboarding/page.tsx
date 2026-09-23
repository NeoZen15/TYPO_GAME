import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OnboardingFlow from "@/features/onboarding/components/OnboardingFlow";
import { ONBOARDED_COOKIE } from "@/features/onboarding/onboarded-cookie";
import { getTrainingFontFaceCss } from "@/lib/game/training/catalog";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ replay?: string }>;
}) {
  // The onboarding is played once. A returning player goes straight to the game;
  // `?replay=1` still opens it on purpose.
  const { replay } = await searchParams;
  const cookieStore = await cookies();
  if (!replay && cookieStore.get(ONBOARDED_COOKIE)) redirect("/game");

  // Load the real catalog faces (JDT__<slug>) so the warm-up specimens are the
  // actual game typefaces, not system-font stand-ins. Same pattern as /game.
  const fontFaceCss = getTrainingFontFaceCss();
  return (
    <>
      {fontFaceCss ? <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} /> : null}
      <OnboardingFlow />
    </>
  );
}
