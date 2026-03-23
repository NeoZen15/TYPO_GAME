import GameScreen from "@/features/game/components/GameScreen";
import { getTrainingFontFaceCss } from "@/lib/game/training/catalog";

export default function GamePageRoute() {
  const fontFaceCss = getTrainingFontFaceCss();

  return (
    <>
      {fontFaceCss ? <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} /> : null}
      <GameScreen />
    </>
  );
}
