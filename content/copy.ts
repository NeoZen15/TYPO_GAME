export const gateCopy = {
  scrollLabel: "Scroll",
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
