export const gateCopy = {
  scrollLabel: "Scroll",
} as const;

/**
 * Training mode entrance (`app/play/training/page.tsx`).
 *
 * The four statements come from `docs/game/vision-produit-dwiggins.md` §2.1,
 * which requires the philosophy of the mode to be stated at its entrance rather
 * than deduced from playing. Order is the order of that section.
 *
 * `progressLine` deliberately mentions no round count. Progress is written
 * answer by answer today, and the round cap is being removed (phase 1 of
 * `docs/game/architecture-backend.md`), so this line stays true either way.
 */
export const trainingIntroCopy = {
  kicker: "Training",
  title: "You are here to train your eye",
  subtitle:
    "Training is a session, not a game. Read this once, then start whenever you want.",
  pointsTitle: "How this mode thinks",
  points: [
    "There is no score to beat and no clock to race.",
    "Every correct answer pushes a typeface further away. Every mistake brings it back sooner.",
    "Your path is built for you alone. A typeface returns just before your eye would forget it.",
    "The goal is not to finish a session. It is a visual skill that lasts.",
  ],
  progressLine:
    "Your progress is saved answer by answer, so stopping costs you nothing.",
  startLabel: "Start training",
  rulesLabel: "Read the rules",
  mascotComment: "No score here. Just your eye getting sharper.",
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
