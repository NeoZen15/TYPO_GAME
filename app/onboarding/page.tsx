import OnboardingFlow from "@/features/onboarding/components/OnboardingFlow";
import { getTrainingFontFaceCss } from "@/lib/game/training/catalog";

export default function OnboardingPage() {
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
