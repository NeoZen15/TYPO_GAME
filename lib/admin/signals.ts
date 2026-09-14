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
// AUCUN SEUIL DE COMPORTEMENT N'A SURVECU A L'EXAMEN, ET C'EST LE RESULTAT.
//
// J'en ai propose trois entre le 2026-09-11 et le 2026-09-14, tous presentes
// comme des signaux produit. Les trois decrivaient en fait une CONSEQUENCE DE
// CONCEPTION, et chacun a ete demonte par une mesure :
//
//   « 66 % des seances refermees en moins d'une seconde » mesurait la latence
//   entre deux ecritures du serveur, le balayage prenant `ended_at` du dernier
//   evenement journalise.
//
//   « 75 % des seances sans question » et « 99 personnes ont lance sans
//   repondre » decrivaient le fait que le jeu demarre au chargement de sa page :
//   charger la page cree une seance et un compte.
//
//   « 64 % des parties terminees sans reponse » decrivait le chrono de la
//   competition : 120 secondes a partir de `started_at`, et la route de timeout
//   ferme proprement meme si personne n'a joue. 53 des 57 avaient une duree
//   entre 100 et 200 secondes.
//
// LA LECON, et elle vaut mieux qu'un seuil : sur ce produit, un ratio eleve
// designe presque toujours une decision d'architecture et non un comportement.
// Avant d'ecrire une ligne ici, trouver le MECANISME qui la produit. Un signal
// faux coute plus cher qu'un signal absent : on enquete pour rien, puis on cesse
// de croire l'ecran.
//
// Ne restent donc que des controles d'integrite, dont la valeur attendue est
// zero et qui n'ont besoin d'aucun seuil.
// ---------------------------------------------------------------------------

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

export type InvestigationsInput = { data: DataHealth };

/**
 * A INVESTIGUER : ce qui ne se repare pas d'un clic, et qu'il faut comprendre.
 *
 * TROIS CONTROLES, TOUS ATTENDUS A ZERO. Ce qui releve de la conception et non de
 * l'anomalie vit ailleurs, comme fait d'entonnoir : les ouvertures du jeu sans
 * partie dans Sessions, la part des gens qui ouvrent sans repondre dans
 * Utilisateurs. Voir l'entete de ce fichier pour les trois signaux de
 * comportement qui ont ete essayes et retires.
 */
export const investigations = (input: InvestigationsInput): Ligne[] => {
  const lignes: Ligne[] = [];
  const { data } = input;

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
