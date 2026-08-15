import type { RecapView } from "@/lib/game/recap-view";

// Expert's end of session, before Expert exists.
//
// The mode is a placeholder: `app/play/expert/page.tsx` says the direct naming
// flow, with no multiple choice, comes after competition. So there is no engine,
// no summary, and nothing to measure yet.
//
// This is deliberately NOT filled with invented figures. A recap that shows
// plausible numbers for a mode nobody can play is a lie that survives until
// someone tries to trace where they came from. It shows the frame, names what
// the mode will measure, and says plainly that it is not built. The owner can
// judge the third page against the other two without being shown fiction.

export const EXPERT_RECAP_PREVIEW: RecapView = {
  kicker: "Expert · session over",
  title: "Nothing to report yet.",
  lede:
    "Expert asks you to name the typeface yourself, with no options to choose from. The mode is not built, so this page has the shape of its recap and none of its figures.",
  kpis: [
    { key: "named", value: "—", label: "Named", helper: "typed correctly" },
    { key: "accuracy", value: "—", label: "Accuracy", helper: "first attempts" },
    { key: "resolved", value: "—", label: "Resolved", helper: "this session" },
    { key: "median", value: "—", label: "Median click", helper: "typical answer" },
  ],
  left: {
    title: "What moved",
    tag: "This session",
    empty: "Expert will report the same movement training does, once it exists.",
  },
  right: {
    title: "What you missed",
    empty: "It will list the names you reached for instead of the right one.",
  },
};
