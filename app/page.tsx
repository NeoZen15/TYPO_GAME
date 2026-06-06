import LandingExperience from "@/features/landing/components/LandingExperience";
import { getTrainingFontFaceCss } from "@/lib/game/training/catalog";

export default function Home() {
  // Inject the real training @font-face rules once, so the game board
  // (teaser + later live rounds) renders catalog typefaces (JDT__<slug>).
  const fontFaceCss = getTrainingFontFaceCss();

  return (
    <main className="w-full">
      {fontFaceCss ? <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} /> : null}
      <LandingExperience />
    </main>
  );
}
