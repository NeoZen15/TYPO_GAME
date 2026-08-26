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

// LA COULEUR TIENT UN TEMPS FIXE DEPUIS LE CLIC, meme correction qu'en entrainement.
//
// Avant : la couleur n'etait posee qu'au retour de /api/competition/answer, mesure a
// 103 ms en mediane sur un build de production, puis le mot suivant partait 80 ms plus
// tard. La couleur n'etait donc visible que ces 80 ms, et le joueur voyait surtout un
// quart de seconde ou rien ne bougeait apres son clic.
//
// POURQUOI 180 ET PAS LES 250 DE L'ENTRAINEMENT. La competition est chronometree, deux
// minutes fixes : allonger la couleur retarde le mot suivant et retire des mots a la
// manche. La meme mesure donne 183 ms du clic au mot suivant aujourd'hui. Le palier est
// donc cale sur cette valeur : la couleur devient immediate et deterministe, et le
// nombre de mots par manche ne change pas. Ce n'est pas un reglage de gout, c'est la
// conservation d'un equilibre deja mesure.
export const COMPETITION_COLOR_HOLD_MS = 180;
export const COMPETITION_FAST_BONUS_THRESHOLD_MS = 2_000;

// How much longer than the player's own claim the SERVER is willing to have
// waited before it stops believing a fast answer was fast.
//
// THE PROBLEM. responseTimeMs arrives in the request body, and the fast bonus
// reads it. A body that claims nought earns two points on every word, verified
// against the running server on 2026-08-17. The server can now check that claim,
// because the question token carries the instant the server built the question
// (question-token.ts, issuedAtMs), so it knows how long the whole exchange took.
//
// WHY THE TOLERANCE IS THIS WIDE, AND WHY WIDE IS THE RIGHT DIRECTION. The
// server's elapsed time is not the player's thinking time. It also contains the
// response travelling out, the screen rendering, the woff2 of a face never seen
// before downloading, the player's click travelling back. Measured in a real
// browser against the local server: 86 ms median over eight answers. On a phone
// on a bad connection, with a cold font, seconds is entirely possible.
//
// So the two errors are not symmetric, and that decides the number. Refusing a
// bonus to an honest player on a slow connection is a wrong score for someone
// playing properly. Granting one to somebody who edited their own request body
// inflates a personal best on a page only they see: there is no ranking between
// players, so a faked score fools nobody but its author. When the two are that
// unequal, the bound belongs far away from honest play.
//
// WHAT IT ACTUALLY BUYS, stated plainly rather than oversold. The bonus is
// refused when the whole exchange took more than seven seconds, so "claim nought
// on every word" stops working for any word the player dwelt on. Someone
// answering quickly and lying about it still gets the bonus they would mostly
// have earned anyway. This bounds the abuse, it does not close it, and closing it
// properly means recording the server's own measurement next to the claim, which
// is a new column in user_event_fact and therefore a migration.
export const COMPETITION_OVERHEAD_TOLERANCE_MS = 5_000;
export const COMPETITION_ENGINE_VERSION = "competition-provider-v1";
