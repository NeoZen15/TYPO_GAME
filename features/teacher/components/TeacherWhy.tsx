"use client";

import { useId } from "react";
import { CREAM } from "@/features/profile/components/board-system";

// POURQUOI UN REGLAGE EST LA, ET SEULEMENT QUAND ON LE DEMANDE.
//
// Decision du proprietaire, 2026-09-11 : « il y a beaucoup de textes, a mon avis
// ils peuvent etre utiles qu'ils apparaissent que quand on survole ». Le
// compositeur portait une explication permanente sous chaque reglage, ce qui
// faisait d'un formulaire de creation un document a lire. Un professeur presse
// doit pouvoir enchainer les choix sans rien lire ; celui qui hesite sur un mot
// pose le curseur dessus.
//
// LE MARQUEUR EST UN BOUTON, PAS UNE ICONE DECORATIVE, et le texte est lie par
// `aria-describedby`. Une bulle qui n'existe qu'au survol n'existe pas au
// clavier ni au lecteur d'ecran, et c'est le defaut classique de ce motif : ici
// le marqueur se tabule, et `:focus-visible` ouvre la meme bulle que le survol.
//
// AUCUN ETAT REACT. Survol et focus sont des etats CSS ; les porter en state
// obligerait chaque panneau a savoir quelle bulle est ouverte, pour un resultat
// identique.

// `useId` et pas un compteur de module : un compteur rend une valeur sur le
// serveur et une autre a l'hydratation, ce qui casse le lien `aria-describedby`
// exactement sur les pages prerendues, dont celle ci.
export default function Why({ children }: { children: React.ReactNode }) {
  const tipId = useId();
  return (
    <span className="tc-why">
      <button type="button" className="tc-why__mark" aria-label="What this means" aria-describedby={tipId}>
        ?
      </button>
      <span className="tc-why__tip" id={tipId} role="tooltip">
        {children}
      </span>
    </span>
  );
}

export const WHY_CSS = `
  .tc-why { position: relative; display: inline-flex; vertical-align: middle; margin-left: 0.3rem; }
  .tc-why__mark {
    appearance: none; cursor: help; width: 0.95rem; height: 0.95rem; padding: 0;
    display: grid; place-items: center;
    border: 1px solid rgb(${CREAM} / 0.22); border-radius: var(--radius-pill);
    background: transparent; color: rgb(${CREAM} / 0.45);
    font-family: var(--pf-mono); font-size: 0.5rem; font-weight: 700; line-height: 1;
    transition: border-color 140ms ease, color 140ms ease;
  }
  .tc-why__mark:hover, .tc-why__mark:focus-visible { border-color: rgb(${CREAM} / 0.55); color: var(--pf-cream); }
  .tc-why__mark:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: 2px; }

  .tc-why__tip {
    position: absolute; top: calc(100% + 0.45rem); left: -0.5rem; z-index: 20;
    width: max-content; max-width: 24rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid rgb(${CREAM} / 0.18); border-radius: var(--radius);
    background: var(--pf-bg);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
    font-size: 0.76rem; line-height: 1.5; text-wrap: pretty;
    color: rgb(${CREAM} / 0.72); text-transform: none; letter-spacing: 0; font-weight: 400;
    font-family: var(--pf-sans, inherit);
    opacity: 0; visibility: hidden; transform: translateY(-3px);
    transition: opacity 130ms ease, transform 130ms ease, visibility 130ms;
  }
  .tc-why__tip em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .tc-why:hover .tc-why__tip,
  .tc-why__mark:focus-visible + .tc-why__tip {
    opacity: 1; visibility: visible; transform: none;
  }
  /* Près du bord droit d'un panneau la bulle sortirait de la page. */
  .tc-why--end .tc-why__tip { left: auto; right: -0.5rem; }
  @media (max-width: 560px) {
    .tc-why__tip { left: auto; right: -0.5rem; max-width: min(20rem, 78vw); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tc-why__tip { transition: none; }
  }
`;
