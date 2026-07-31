import GameScreen from "@/features/game/components/GameScreen";

// No static @font-face block here on purpose.
//
// This page used to emit the 23 faces of content/typefaces/font-manifest-v4.json,
// while the training pool is drawn from the full catalogue (1172 active faces).
// Every face outside those 23 rendered in a fallback font, so the question asked
// the player to name a typeface that was not on screen.
//
// Each question now carries its own font descriptor and GameScreen declares that
// face just before showing it (lib/game/fonts/runtime-catalog plus
// lib/game/fonts/inject-font-face), which covers the whole catalogue instead of a
// fixed subset. The other pages that show a fixed set of specimens (landing,
// profile, onboarding) keep their own static block; they are not question screens.
export default function GamePageRoute() {
  return <GameScreen />;
}
