import CompetitionScreen from "@/features/game/components/CompetitionScreen";
import { getCompetitionFontFaceCss } from "@/lib/game/competition/catalog";

export default function PlayCompetitionPage() {
  const fontFaceCss = getCompetitionFontFaceCss();

  return (
    <>
      {fontFaceCss ? <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} /> : null}
      <CompetitionScreen />
    </>
  );
}
