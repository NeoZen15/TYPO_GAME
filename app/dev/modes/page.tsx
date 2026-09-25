import { notFound } from "next/navigation";
import ModeSelectPreview from "@/features/modes/components/ModeSelectPreview";
import { HERO_SPECIMEN_SLUGS } from "@/features/landing/hero-specimens";
import { isDevRuntime } from "@/lib/dev-mode";
import {
  getTrainingFontFaceCss,
  getTrainingFontPreloadHrefs,
  getTypefaceFontFamily,
} from "@/lib/game/training/catalog";
import { loadModeSelectStats } from "@/lib/modes/mode-select-stats";
import { getCurrentUserId } from "@/lib/server/current-user";

// Proposal for the modes page, dev only. Same data as /play.
export default async function ModesProposalPage() {
  if (!isDevRuntime()) notFound();

  const userId = await getCurrentUserId();
  const stats = userId ? await loadModeSelectStats(userId).catch(() => null) : null;

  // The landing hero's seven faces: already preloaded there, known to render.
  const families = HERO_SPECIMEN_SLUGS.map((slug) => getTypefaceFontFamily(slug, slug));
  const fontHrefs = getTrainingFontPreloadHrefs(HERO_SPECIMEN_SLUGS);
  const fontFaceCss = getTrainingFontFaceCss();

  return (
    <>
      {fontHrefs.map((href) => (
        <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
      ))}
      {fontFaceCss ? <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} /> : null}
      <ModeSelectPreview stats={stats} families={families} />
    </>
  );
}
