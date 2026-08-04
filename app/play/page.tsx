import ModeSelectPage from "@/features/modes/components/ModeSelectPage";
import { loadModeSelectStats } from "@/lib/modes/mode-select-stats";
import { getCurrentUserId } from "@/lib/server/current-user";

// Read here rather than in the component so the page stays the only place that
// touches the request. A visitor with no history gets the generic figures, never
// someone else's.
export default async function PlayModeSelectionPage() {
  const userId = await getCurrentUserId();
  const stats = userId ? await loadModeSelectStats(userId).catch(() => null) : null;

  return <ModeSelectPage stats={stats} />;
}
