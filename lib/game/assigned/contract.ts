// Le CONTRAT d'un devoir, et la frontiere avec l'ADAPTATION.
//
// Toute cette architecture tient sur une distinction, et c'est celle que
// l'invariant I-25 inscrit dans la vision. Le CONTRAT est ce que le professeur
// donne, et il est identique pour toute la classe : perimetre, faces imposees,
// mix, cran d'exigence, nombre de questions, mode, politique, fenetre.
// L'ADAPTATION est ce que le moteur fait A L'INTERIEUR : quelles faces du
// perimetre reviennent, dans quel ordre, et a quel point les mauvaises reponses
// sont proches. Elle ne peut jamais sortir du perimetre, changer les proportions,
// ni changer le nombre de questions.
//
// CE FICHIER EST PUR, et il le reste : aucun import de runtime, aucune requete,
// aucune lecture de base. C'est ce qui permet a un garde de l'exercer pour de
// vrai plutot que de relire son intention (meme raison que question-shape.ts).

import type { Proximity } from "@/lib/game/training/question-shape";

/** Les quatre crans que le professeur choisit, tels que la base les stocke. */
export type Exigence = "accessible" | "balanced" | "challenging" | "expert";

/** Les trois types de devoir, tels que la base les stocke. */
export type AssignmentKind = "exercise" | "control" | "competition";

/**
 * Le cran, traduit en proximite de leurres.
 *
 * C'est toute la traduction : « la difficulte du QCM augmente uniquement par la
 * similarite visuelle des mauvaises reponses » (spec moteur). Le professeur ne
 * voit jamais ces valeurs, et le moteur ne voit jamais les mots du professeur.
 */
export const PROXIMITY_OF: Record<Exigence, Proximity> = {
  accessible: "far",
  balanced: "family",
  challenging: "cluster",
  expert: "micro",
};

/** L'echelle, du plus facile au plus dur. Sert a se deplacer d'un cran. */
const LADDER: Proximity[] = ["far", "family", "cluster", "micro"];

/**
 * La politique de progression que le type de devoir impose.
 *
 * JAMAIS DEDUITE DU CONTEXTE (I-22), et jamais choisie par le client : elle vient
 * du type, ici, et la base refuse de toute facon une competition qui ecrirait la
 * maitrise. Le controle mesure, la competition fait performer, et seul l'exercice
 * fait progresser.
 */
export const POLICY_OF: Record<AssignmentKind, "update_mastery" | "observe_only"> = {
  exercise: "update_mastery",
  control: "observe_only",
  competition: "observe_only",
};

/**
 * L'adaptation, et ses deux limites.
 *
 * Le cran du professeur est le CENTRE d'une bande d'un cran de part et d'autre.
 * Un eleve qui tient une face la recoit un cran plus dur, un eleve qui la rate la
 * recoit un cran plus doux, et personne ne sort de la bande. Sans adaptation, le
 * cran est rendu tel quel : deux eleves recoivent alors exactement la meme
 * difficulte de leurres, ce qui est la definition d'un controle.
 *
 * `mastery` est l'etat PERSONNEL de l'eleve sur la face demandee, que le moteur a
 * le droit de consulter pour adapter un devoir (I-25) et que le professeur ne voit
 * jamais (I-23).
 */
export const proximityFor = (
  exigence: Exigence,
  adaptive: boolean,
  mastery: number | null
): Proximity => {
  const centre = PROXIMITY_OF[exigence];
  if (!adaptive || mastery === null) return centre;

  const at = LADDER.indexOf(centre);
  const shift = mastery >= 3 ? 1 : mastery <= 1 ? -1 : 0;
  const next = Math.min(LADDER.length - 1, Math.max(0, at + shift));
  return LADDER[next];
};
