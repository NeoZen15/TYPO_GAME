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

/**
 * The discreet progression indicator on the training screen (`GameScreen`).
 *
 * Replaced `X / Y faces mastered` on 2026-08-15 (D3, owner's choice). That line
 * counted only faces at the top of the 0 to 4 ladder, so a first session read
 * 0 / 30 and could not move at all. The gauge reads the whole ladder, so every
 * first attempt success shows. Spec §15 / N-24 keeps the global eye level off
 * this screen, and this is not that level: it is the state of the player's own
 * set, and it ranks nobody.
 */
export const trainingProgressCopy = {
  gaugeLabel: "of your set mastered",
} as const;

/**
 * What both game screens offer once a session is over (`GameScreen` for
 * training, `CompetitionScreen` for competition).
 *
 * `statsLabel` added on 2026-08-15 (D2). Neither screen had any route to the
 * profile: a finished session offered replaying or going back to the mode
 * board, so the page that actually holds the statistics was reachable only by
 * knowing the address. Gathered here rather than left hardcoded in the screens,
 * so the end of a session cannot drift in wording from one mode to the next.
 *
 * `modesLabel` ("Back to modes") retired the same day: the owner settled the end
 * of a session on two actions, start again or go and read the whole history. The
 * mode board stays one click away through the profile.
 *
 * `otherModesLabel` is not that label coming back. It exists for a mode with
 * nothing to replay, which today is only Expert: dropping its first action left
 * a single button and no way back, a dead end. It takes the first slot there,
 * and never appears beside "Play again".
 */
export const sessionEndCopy = {
  replayLabel: "Play again",
  statsLabel: "See my statistics",
  otherModesLabel: "Choose another mode",
} as const;

/**
 * What the Path tab says about its own map (`ProgressExplainer`, under the
 * constellation).
 *
 * Every figure here was read out of the code that computes the map, not
 * remembered: a step lights at `PALIER_ACCURACY_BAR` 0.80 and
 * `PALIER_MASTERED_BAR` 5 typefaces, a galaxy at `AXIS_LIT_THRESHOLD` 0.70 of
 * its live steps (`lib/profile/profile-stats.ts`), and the widest interval of
 * the scheduler is the 80 to 150 question window of the top box
 * (`INTERVAL_WINDOW` in `lib/game/training/provider.ts`).
 *
 * Two things are deliberately absent. The mastery ladder is never printed as a
 * number (I-18 forbids the raw mastery as a displayed grade), and the Dreyfus
 * level is never named (I-20 makes it an internal command variable). The block
 * explains the map, which vision §8 makes the main representation of the
 * learner.
 *
 * Flat keys on purpose: `check:copy` collects keys at any depth, so a nested
 * `sections` array would demand `progressionExplainerCopy.title` to appear in a
 * component and fail the gate, which is exactly what happened to the rules page.
 */
export const progressionExplainerCopy = {
  kicker: "Reading your map",
  title: "How the map lights up.",
  lede: "Eight galaxies, one for each way of seeing. Here is what they are made of, and what turns one on.",
  groupsTitle: "The eight galaxies",
  groupsBody:
    "Each galaxy is one way of reading a letterform, and they are laid out from the easiest to see to the hardest. Inside a galaxy, steps cut that way of seeing into things you can point at: the shape of a counter, the cut of a terminal, how far a stroke swells. The numbering is an order of difficulty, not a route. Yours light in the order your eye is ready for, and the ones still dark stay on the map so you can see what is left. A few are marked coming soon: the way of seeing is real, the exercise that trains it is not built yet.",
  methodTitle: "Why a typeface comes back",
  methodBody:
    "Nothing here is won by looking once. Name a typeface right and it moves away, further each time it returns. Miss it and it comes back sooner, while the shape that caught you out is still fresh. Only your first answer on a typeface counts, so a second guess costs you nothing and buys you nothing.",
  climbTitle: "What lights a step",
  climbBody:
    "A step lights when five of its typefaces have settled, which takes several meetings each, and when four of your answers out of five on that step are right. A galaxy lights when more than two thirds of its steps are lit. This is why a step cannot be taken in one sitting: every correct sighting pushes that typeface further out, and the widest gap runs past a hundred questions. The map moves on the days you come back.",
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
