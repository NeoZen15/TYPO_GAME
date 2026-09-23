import { CREAM } from "@/features/profile/components/board-system";

// L'ETAGE DE L'ESPACE PROFESSEUR : DES ETAPES, PAS DES CARTES.
//
// Decision du proprietaire, 2026-09-11 : « des blocs dans des blocs dans des
// blocs, c'est un enfer », et « sur la page principale il n'y a pas de bloc,
// mais on a la sensation qu'il y en a ». C'est verifiable dans le code de la
// landing : `.lp-section` n'a ni bordure, ni fond, ni rayon. Elle separe avec
// un grand pas vertical et un grand titre, rien d'autre.
//
// CE FICHIER EXISTE PARCE QUE LA REGLE A QUITTE UN SEUL ECRAN. Elle est nee
// dans le compositeur, qui la declarait pour lui meme et pour ses deux enfants.
// Des que la fiche Exercice l'a prise a son tour, la garder la bas revenait a
// la dupliquer, et deux copies d'un rythme vertical divergent au premier
// ajustement. Tout ecran professeur qui deboite ses panneaux importe d'ici.
//
// CE QUE LA CARTE APPORTAIT VRAIMENT RESTE : la largeur et le centrage, qui
// sont dans `.tc-step`. Ce qu'elle ajoutait, un contour et une surface autour
// de grilles qui contenaient elles memes des groupes, est parti.

export const TEACHER_STEPS_CSS = `
  /* Le pas entre deux etapes, qui remplace a lui seul les contours. */
  .tc-steps { gap: clamp(2.5rem, 6vh, 4rem); }
  .tc-step { width: min(98%, 66rem); margin: 0 auto; }

  .tc-step__head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.4rem 1.2rem; flex-wrap: wrap; margin-bottom: 1.15rem; }
  .tc-step__title { margin: 0; font-size: clamp(1.15rem, 2.2vw, 1.5rem); font-weight: 650; letter-spacing: -0.03em; line-height: 1.1; color: var(--pf-cream); }
  .tc-step__meta { font-family: var(--pf-mono); font-size: 0.62rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.42); font-variant-numeric: tabular-nums; }
  .tc-step__meta em { font-style: normal; font-weight: 640; color: var(--pf-cream); }

  /* UN SOUS TITRE N'EST PAS UN TITRE D'ETAPE. Quand un ensemble se divise a
     l'interieur d'une etape, il porte ce niveau la et non le gros titre, sinon
     on retrouve deux fois la meme voix dans le meme bloc et on ne sait plus
     lequel commande. */
  .tc-step__sub { display: block; font-family: var(--pf-mono); font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgb(${CREAM} / 0.55); margin-bottom: 0.7rem; }

  /* Un reglage : un libelle, son controle sur toute la largeur, rien d'autre.
     L'explication attend sous le marqueur de survol (voir TeacherWhy). */
  .tc-set { display: grid; gap: 0.5rem; justify-items: start; min-width: 0; }
  .tc-set + .tc-set { margin-top: 1.5rem; }
  .tc-set > .st-choice { margin: 0; }
  .tc-set--wide { justify-items: stretch; }
  .tc-set__row { display: flex; align-items: baseline; gap: 0.1rem; }
  @media (max-width: 460px) {
    .tc-set > .st-choice { max-width: 100%; flex-wrap: wrap; border-radius: var(--radius); }
  }
`;
