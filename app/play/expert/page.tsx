import ModePlaceholderPage from "@/features/modes/components/ModePlaceholderPage";
import SessionRecap from "@/features/game/components/SessionRecap";
import { EXPERT_RECAP_PREVIEW } from "@/lib/game/expert/recap-view";

// Expert is still a placeholder: the direct naming flow, with no multiple
// choice, comes after competition.
//
// ?preview=complete paints what its end of session will look like, on the same
// frame as the other two modes and with no invented figures, so the three pages
// can be compared before the engine exists. No session is started, nothing is
// written, and the mode entrance is unchanged without the parameter.
export default async function PlayExpertPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;

  if (preview === "complete") {
    return <SessionRecap view={EXPERT_RECAP_PREVIEW} />;
  }

  return (
    <ModePlaceholderPage
      modeLabel="Expert"
      description="Direct naming flow (no QCM) will be implemented after Competition mode."
    />
  );
}
