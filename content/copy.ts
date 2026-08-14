export const gateCopy = {
  scrollLabel: "Scroll",
} as const;

/**
 * What the Training mode states about itself, rendered by the unified rules
 * page (`ModeRulesPage`, behind the three `/play/*_/rules` doors).
 *
 * The four statements come from `docs/game/vision-produit-dwiggins.md` §2.1,
 * which requires the philosophy of the mode to be stated rather than deduced
 * from playing. Order is the order of that section.
 *
 * Was `trainingIntroCopy`, named after the static entrance at
 * `app/play/training/page.tsx`. That entrance was retired on 2026-08-15 (D5):
 * it restated the rules a second time, so the mode's Play button landed on a
 * rules screen instead of the game. Eight keys went with it and are recorded in
 * the checklist, since a few were good sentences and belong to the owner to
 * revive inside the rules page, not to me to delete quietly.
 */
export const trainingModeCopy = {
  pointsTitle: "How this mode thinks",
  points: [
    "There is no score to beat and no clock to race.",
    "Every correct answer pushes a typeface further away. Every mistake brings it back sooner.",
    "Your path is built for you alone. A typeface returns just before your eye would forget it.",
    "The goal is not to finish a session. It is a visual skill that lasts.",
  ],
} as const;

/** 404 screen (`app/not-found.tsx`). */
export const notFoundCopy = {
  kicker: "Error 404",
  title: "This page does not exist",
  description:
    "The address may be wrong, or the page has moved. Head back home, or go straight to the modes.",
  homeLabel: "Back home",
  modesLabel: "See the modes",
} as const;

/** Render error screens (`app/error.tsx` and `app/global-error.tsx`). */
export const errorCopy = {
  kicker: "Unexpected error",
  title: "Something went wrong",
  description:
    "This screen stopped working. Try again, and if it keeps failing head back home.",
  retryLabel: "Try again",
  homeLabel: "Back home",
} as const;
