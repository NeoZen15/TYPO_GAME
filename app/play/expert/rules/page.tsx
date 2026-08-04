import ModeRulesPage from "@/features/modes/components/ModeRulesPage";
import { loadTrainingProgress } from "@/lib/profile/profile-stats";
import { getCurrentUserId } from "@/lib/server/current-user";

// A player opens the rules to find out where they stand, so the figures have to be
// theirs. Read here, server side, from the guest cookie. Null for a visitor who has
// never played, and the page then says so rather than showing someone else's number.
export default async function PlayExpertRulesPage() {
  const userId = await getCurrentUserId();
  const progress = userId ? await loadTrainingProgress(userId).catch(() => null) : null;

  return <ModeRulesPage initialMode="expert" progress={progress} />;
}
