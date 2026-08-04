// Competition timing and scoring constants.
//
// These live apart from ./catalog on purpose. CompetitionScreen is a client
// component and needs two of them, while ./catalog resolves runtime font assets
// from an ~800 kB manifest that must never reach a browser bundle. Keeping the
// plain values here lets the screen import what it needs without dragging the
// catalogue in with it.
export const COMPETITION_TOTAL_DURATION_MS = 2 * 60 * 1000;
// Competition should feel almost immediate; keep only a tiny handoff before the next word.
export const COMPETITION_FEEDBACK_DELAY_MS = 80;
export const COMPETITION_FEEDBACK_PERSIST_MS = 900;
export const COMPETITION_FAST_BONUS_THRESHOLD_MS = 2_000;
export const COMPETITION_ENGINE_VERSION = "competition-provider-v1";
