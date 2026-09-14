import "server-only";

import type { DataHealth } from "@/lib/admin/quality";

// DEUX LISTES QU'ON NE MELANGE JAMAIS : CE QU'ON FAIT, CE QU'ON REGARDE.
//
// Regle posee par le proprietaire le 2026-09-12, et elle est plus fine qu'elle
// n'en a l'air. « Ce qui vous attend » ne contient que des ACTIONS : une demande
// a trancher, une cle a poser, une invitation a relancer, un rapprochement a
// confirmer. Une anomalie technique n'y a pas sa place, meme urgente : on ne la
// « fait » pas, on va la comprendre. Melanger les deux transforme une liste de
// taches en liste de soucis, et une liste de soucis ne se vide jamais, donc on
// arrete de la lire.
//
// ---------------------------------------------------------------------------
// LES SEUILS SONT PROVISOIRES, ET C'EST ECRIT EXPRES.
//
// Ils sortent de mon jugement du 2026-09-12, sur un produit qui compte 99
// personnes ayant joue. Personne ne sait encore ce qui est normal. Le
// proprietaire a explicitement refuse qu'ils deviennent une regle metier : « dans
// six mois vous aurez une regle sortie de nulle part qui affichera des alertes
// rouges parce qu'un chiffre arbitraire decide aujourd'hui a ete depasse ».
//
// Trois consequences tenues ici :
//   1. ils vivent dans UN objet, modifiable en une ligne ;
//   2. chaque ligne affiche SON RATIO, donc rien ne se cache derriere le seuil ;
//   3. l'ecran dit qu'ils sont provisoires, il ne les presente pas comme un fait.
// A revoir quand le produit aura quelques milliers de seances derriere lui.
// ---------------------------------------------------------------------------
export const SEUILS_PROVISOIRES = {
  /**
   * Part des parties TERMINEES EXPLICITEMENT qui n'ont recu aucune reponse.
   * Quelqu'un a lance, est reste, et a ferme proprement sans repondre : ca ne
   * s'explique par aucun mecanisme connu. 62 % le 2026-09-14.
   */
  partiesTermineesSansReponse: 20,
} as const;

export type Ligne = { key: string; text: string; href: string };

export type ActionsInput = {
  demandesEnAttente: number;
  rapprochementsAConfirmer: number;
  invitationsARelancer: number;
  clerkBranche: boolean;
};

/**
 * CE QUI VOUS ATTEND : uniquement ce que l'operateur peut faire maintenant.
 *
 * Chaque ligne est une condition vraie au moment du rendu, et la liste vide est
 * un bon jour, pas un ecran a remplir.
 */
export const actions = (input: ActionsInput): Ligne[] => {
  const lignes: Ligne[] = [];

  if (input.demandesEnAttente > 0) {
    lignes.push({
      key: "demandes",
      text: `${input.demandesEnAttente} demande${input.demandesEnAttente > 1 ? "s" : ""} d'accès à trancher`,
      href: "/admin/demandes",
    });
  }
  if (input.rapprochementsAConfirmer > 0) {
    lignes.push({
      key: "rapprochements",
      text: `${input.rapprochementsAConfirmer} établissement${input.rapprochementsAConfirmer > 1 ? "s" : ""} à confirmer : un nom déjà connu, à rapprocher ou à créer`,
      href: "/admin/demandes",
    });
  }
  if (input.invitationsARelancer > 0) {
    lignes.push({
      key: "invitations",
      text: `${input.invitationsARelancer} invitation${input.invitationsARelancer > 1 ? "s" : ""} expirée${input.invitationsARelancer > 1 ? "s" : ""} à relancer`,
      href: "/admin/classes",
    });
  }
  if (!input.clerkBranche) {
    lignes.push({
      key: "clerk",
      text: "Brancher l'authentification : sans ses clés, aucune demande ne peut être acceptée",
      href: "/admin/parametres",
    });
  }

  return lignes;
};

export type InvestigationsInput = {
  data: DataHealth;
  partiesTerminees: number;
  partiesTermineesSansReponse: number;
};

/**
 * A INVESTIGUER : ce qui ne se repare pas d'un clic, et qu'il faut comprendre.
 *
 * CE QUI N'Y EST PLUS, ET POURQUOI. Deux lignes y figuraient et n'avaient rien a
 * y faire : « 75 % des seances n'ont recu aucune question » et « 99 personnes ont
 * lance sans jamais repondre ». L'enquete du 2026-09-14 a montre que ce sont les
 * consequences MECANIQUES du demarrage au montage : charger la page du jeu cree
 * une seance et un compte. Presenter une consequence de conception comme une
 * anomalie apprend a ne plus lire le bloc. Ces deux nombres restent affiches
 * ailleurs, comme des faits d'entonnoir : dans Sessions et dans Utilisateurs.
 *
 * ET CE QUI Y EST ENTRE A LEUR PLACE : les parties terminees explicitement sans
 * une seule reponse. Celles la ne s'expliquent par aucun mecanisme connu.
 *
 * J'Y AVAIS AUSSI MIS « 66 % des seances refermees en moins d'une seconde ».
 * Verification demandee par le proprietaire le 2026-09-12 : ce chiffre mesurait
 * la latence entre deux ecritures du serveur. Un signal faux coute plus cher
 * qu'un signal absent : on enquete pour rien, puis on cesse de croire l'ecran.
 */
export const investigations = (input: InvestigationsInput): Ligne[] => {
  const lignes: Ligne[] = [];
  const { data, partiesTerminees, partiesTermineesSansReponse } = input;

  const partMuettes =
    partiesTerminees === 0 ? 0 : Math.round((100 * partiesTermineesSansReponse) / partiesTerminees);
  if (
    partiesTermineesSansReponse > 0 &&
    partMuettes >= SEUILS_PROVISOIRES.partiesTermineesSansReponse
  ) {
    lignes.push({
      key: "muettes",
      text: `${partiesTermineesSansReponse} parties terminées explicitement sans une seule réponse (${partMuettes} % des parties terminées)`,
      href: "/admin/sessions",
    });
  }

  // Les anomalies de donnees : elles se comprennent, elles ne se cliquent pas.
  if (data.events_default_partition > 0) {
    lignes.push({
      key: "partition",
      text: `${data.events_default_partition} réponses rangées dans la partition par défaut : des mois manquent au journal`,
      href: "/admin/donnees",
    });
  }
  if (data.sessions_mismatch > 0) {
    lignes.push({
      key: "ecart",
      text: `${data.sessions_mismatch} séances dont le compteur ne correspond pas au journal`,
      href: "/admin/donnees",
    });
  }
  if (data.sessions_stuck > 0) {
    lignes.push({
      key: "coincees",
      text: `${data.sessions_stuck} séances ouvertes depuis plus de 24 h`,
      href: "/admin/donnees",
    });
  }

  return lignes;
};
