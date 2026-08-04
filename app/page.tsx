import LandingExperience from "@/features/landing/components/LandingExperience";
import { HERO_SPECIMEN_SLUGS } from "@/features/landing/hero-specimens";
import {
  getTrainingFontFaceCss,
  getTrainingFontPreloadHrefs,
} from "@/lib/game/training/catalog";

export default function Home() {
  // Inject the real training @font-face rules once, so the game board
  // (teaser + later live rounds) renders catalog typefaces (JDT__<slug>).
  const fontFaceCss = getTrainingFontFaceCss();

  // The hero cycles its single word through seven faces, one every 2.4 s, so all
  // seven are needed inside the first 16.8 seconds and the first one is needed
  // immediately. Declaring @font-face does not schedule a fetch: the browser
  // waits until the family is actually painted, which is why the word used to
  // appear in a fallback and then swap, seven times. These preloads move the
  // requests to the top of the document. Only the faces the hero really paints
  // are listed; preloading the other 15 declared families would be wasted bytes
  // and a console warning.
  const heroFontHrefs = getTrainingFontPreloadHrefs(HERO_SPECIMEN_SLUGS);

  return (
    <main className="w-full">
      {heroFontHrefs.map((href) => (
        <link
          key={href}
          rel="preload"
          as="font"
          type="font/woff2"
          href={href}
          crossOrigin="anonymous"
        />
      ))}
      {fontFaceCss ? <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} /> : null}
      <LandingExperience />
    </main>
  );
}
