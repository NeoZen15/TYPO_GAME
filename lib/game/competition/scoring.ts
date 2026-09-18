import {
  COMPETITION_FAST_BONUS_THRESHOLD_MS,
  COMPETITION_OVERHEAD_TOLERANCE_MS,
} from "@/lib/game/competition/constants";

// LE CALCUL DU SCORE DE COMPETITION, PUR ET ISOLE.
//
// Sorti de `provider.ts` le 2026-09-18 pour une raison de securite et une de
// testabilite, qui n'en font qu'une : le bonus de vitesse ne doit dependre que de
// l'horloge du serveur, et un garde doit pouvoir le PROUVER en exercant la vraie
// fonction. Le provider porte `server-only` et traine tout le catalogue de
// polices ; une fonction pure, sans import lourd, se teste seule. Voir
// `scripts/quality/check-competition-timing.mjs`.

/**
 * Les points d'une reponse : 0 si fausse, +2 si juste ET rapide, +1 sinon.
 *
 * LE BONUS SE DECIDE SUR L'HORLOGE DU SERVEUR, la seule qu'un client ne peut pas
 * regler. Durci le 2026-09-18 apres l'auto-pentest.
 *
 * AVANT : le +2 se decidait sur le `responseTimeMs` DECLARE par le navigateur.
 * Envoyer `responseTimeMs: 0` suffisait a empocher le bonus a chaque bonne
 * reponse ; l'horloge du serveur ne servait qu'a plafonner a +1 au dela de sept
 * secondes. Un joueur qui reflechissait cinq secondes touchait donc +1 honnete
 * et +2 en mentant, un point vole par mot.
 *
 * MAINTENANT : quand une mesure serveur existe, le `responseTimeMs` declare
 * n'entre PLUS dans le calcul. Mentir dessus ne change rien, le resultat ne
 * dependant que de `serverElapsedMs`, le temps entre l'emission de la question et
 * la reception de la reponse, que le client ne peut pas falsifier. Ce temps porte
 * deux trajets reseau, le rendu et la reflexion : on garde le seuil rapide PLUS
 * la meme tolerance large qu'avant, pour qu'une reponse vraiment rapide sur une
 * ligne lente garde son bonus. Au dela, +1.
 *
 * EFFET DE BORD ASSUME, a l'attention du proprietaire : le bonus recompense une
 * vitesse reelle et non une declaration, donc un joueur rapide qui annoncait un
 * temps modeste ne perd plus son +2, et il y aura un peu plus de +2 qu'avant.
 * Pour en donner moins, baisser `COMPETITION_OVERHEAD_TOLERANCE_MS` : une seule
 * constante, et c'est une decision de regle du jeu.
 */
export const awardPointsFor = (
  isCorrect: boolean,
  responseTimeMs: number,
  serverElapsedMs: number | null = null,
) => {
  if (!isCorrect) return 0;

  if (serverElapsedMs !== null) {
    return serverElapsedMs <=
      COMPETITION_FAST_BONUS_THRESHOLD_MS + COMPETITION_OVERHEAD_TOLERANCE_MS
      ? 2
      : 1;
  }

  // Pas de mesure serveur : jeton emis avant que `issuedAtMs` existe et encore en
  // vol au moment du deploiement, ou chemin de doublon en lecture seule qui ne
  // sert qu'a formuler le feedback. Repli sur la declaration du client, l'ancien
  // comportement, sans consequence de securite : les jetons neufs portent tous la
  // mesure serveur.
  return responseTimeMs < COMPETITION_FAST_BONUS_THRESHOLD_MS ? 2 : 1;
};

/**
 * Le temps que le SERVEUR a attendu entre construire la question et lire sa
 * reponse. Pas le temps de reflexion du joueur : il porte aussi deux trajets
 * reseau, le rendu et un eventuel telechargement de police. Null quand le jeton
 * est anterieur au tampon `issuedAtMs`.
 */
export const serverElapsedFor = (issuedAtMs: number | undefined) =>
  typeof issuedAtMs === "number" ? Math.max(0, Date.now() - issuedAtMs) : null;
