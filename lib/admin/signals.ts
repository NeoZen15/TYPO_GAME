import "server-only";

import type { DataHealth } from "@/lib/admin/quality";
import type { Pulse } from "@/lib/admin/usage";

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
  /** Part des seances sans une seule question, au dela de laquelle on regarde. */
  seancesSansQuestion: 40,
  /** Part des personnes qui lancent une partie sans jamais repondre. */
  lanceursSansReponse: 30,
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
  pulse: Pulse;
  data: DataHealth;
  seances: number;
  seancesVides: number;
};

/**
 * A INVESTIGUER : ce qui ne se repare pas d'un clic, et qu'il faut comprendre.
 *
 * CE QUI N'Y EST PAS, ET POURQUOI. J'y avais mis « 66 % des seances refermees en
 * moins d'une seconde ». Verification demandee par le proprietaire le 2026-09-12,
 * et il avait raison : ce chiffre mesurait la latence entre deux ecritures du
 * serveur. Les seances abandonnees sont fermees par le balayage, qui prend
 * `ended_at` du dernier evenement journalise ; sans reponse, ce dernier evenement
 * est leur propre `session_start`. Un signal faux dans un tableau de bord coute
 * plus cher qu'un signal absent : on enquete pour rien, puis on cesse de croire
 * l'ecran.
 */
export const investigations = (input: InvestigationsInput): Ligne[] => {
  const lignes: Ligne[] = [];
  const { pulse, data, seances, seancesVides } = input;

  const partVides = seances === 0 ? 0 : Math.round((100 * seancesVides) / seances);
  if (partVides >= SEUILS_PROVISOIRES.seancesSansQuestion) {
    lignes.push({
      key: "vides",
      text: `${partVides} % des séances n'ont reçu aucune question (${seancesVides} sur ${seances})`,
      href: "/admin/sessions",
    });
  }

  const muets = pulse.launched_30d - pulse.answered_30d;
  const partMuets = pulse.launched_30d === 0 ? 0 : Math.round((100 * muets) / pulse.launched_30d);
  if (muets > 0 && partMuets >= SEUILS_PROVISOIRES.lanceursSansReponse) {
    lignes.push({
      key: "muets",
      text: `${muets} personnes ont lancé une partie sans jamais répondre, sur 30 jours (${partMuets} % de celles qui ont lancé)`,
      href: "/admin/utilisateurs",
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
