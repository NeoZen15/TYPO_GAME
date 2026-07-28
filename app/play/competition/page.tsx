import { Suspense } from "react";
import CompetitionScreen from "@/features/game/components/CompetitionScreen";

// A single competition session only shows a handful of faces, chosen dynamically
// per session (server-side, from the full runtime pool with a fresh seed). Rather
// than ship an @font-face for every catalog face on every visit, each question
// carries its own font descriptor and CompetitionScreen injects that face's
// @font-face on demand, just before it is shown (font-display: swap keeps a
// fallback until the woff2 loads).
export default function PlayCompetitionPage() {
  return (
    <Suspense fallback={null}>
      <CompetitionScreen />
    </Suspense>
  );
}
