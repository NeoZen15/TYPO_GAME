import type { Metadata } from "next";
import Link from "next/link";

import AdminSidebar from "@/features/admin/components/AdminSidebar";
import { BOARD_SYSTEM_CSS, CREAM } from "@/features/profile/components/board-system";
import { isAdminAccessAllowed } from "@/lib/admin/gate";

export const metadata: Metadata = {
  title: "Administration",
};

// LA COQUILLE DE L'ADMINISTRATION : la porte une fois, la barre une fois.
//
// LA PORTE EST ICI ET PAS DANS CHAQUE PAGE. Dix sept pages qui repetent leur
// propre controle d'acces, c'est dix sept occasions d'en oublier un. Le jour ou
// une page est ajoutee, elle est gardee parce qu'elle est sous ce dossier, sans
// que personne ait a y penser.
//
// LA REGLE ELLE MEME A DEMENAGE, dans `lib/admin/gate.ts`, et elle y est ecrite
// une seule fois : la page garde la lecture, la route de decision garde
// l'ecriture, et toutes deux posent maintenant la meme question au meme endroit.
// Depuis l'audit du 2026-09-18, l'exception « sans Clerk et sans aucune demande »
// ne s'ouvre plus qu'en dehors de la production. Une page gardee derriere une
// route ouverte ne garde rien, donc les deux appellent la fonction.

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const allowed = await isAdminAccessAllowed();

  if (!allowed) {
    return (
      <main className="pf-page">
        <div className="st">
          <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
          <section className="st-panel st-sec">
            <h1 className="st-panel__title">Réservé à l&apos;administration</h1>
            <p className="st-empty">
              Cet espace lit l&apos;usage réel du produit et des demandes d&apos;accès,
              donc des noms et des adresses. Il ne s&apos;ouvre qu&apos;à un compte
              administrateur.
            </p>
            <Link href="/" className="st-action st-action--compact">Retour à l&apos;accueil</Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <div className="pf-page ad-shell">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: SHELL_CSS }} />
      <AdminSidebar />
      <main className="ad-main">{children}</main>
    </div>
  );
}

/* La coquille, et rien que la coquille. Les panneaux viennent du système. */
const SHELL_CSS = `
  /* Deux colonnes, la barre fixe et le contenu qui défile. En dessous de
     900px la barre passe au dessus : un outil de bureau reste un outil de
     bureau, mais il ne doit pas devenir illisible sur un écran d'appoint. */
  .ad-shell { display: grid; grid-template-columns: 15rem minmax(0, 1fr); align-items: start; gap: clamp(1.2rem, 3vw, 2.6rem); padding: clamp(1.2rem, 3vw, 2.2rem) clamp(1rem, 4vw, 3rem) clamp(3rem, 8vh, 6rem); }
  @media (max-width: 900px) { .ad-shell { grid-template-columns: 1fr; } }

  .ad-side { position: sticky; top: clamp(1.2rem, 3vw, 2.2rem); display: grid; gap: 1.3rem; align-content: start; }
  .ad-side__group { display: grid; gap: 0.1rem; }
  .ad-side__title { font-family: var(--pf-mono); font-size: 0.52rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(${CREAM} / 0.35); padding: 0 0.6rem 0.35rem; }
  .ad-side__link { display: block; padding: 0.38rem 0.6rem; border-radius: var(--radius-pill); font-size: 0.82rem; line-height: 1.3; color: rgb(${CREAM} / 0.6); text-decoration: none; transition: background-color 140ms ease, color 140ms ease; }
  .ad-side__link:hover { color: var(--pf-cream); background: rgb(${CREAM} / 0.05); }
  .ad-side__link.is-here { color: var(--pf-cream); background: rgb(${CREAM} / 0.1); }
  .ad-side__link--home { font-weight: 620; margin-bottom: 0.2rem; }

  .ad-main { display: grid; gap: clamp(1.1rem, 3vh, 2rem); align-content: start; min-width: 0; }
  .ad-main .st-panel, .ad-main .st-kpis, .ad-main .st-backbar { width: 100%; margin-left: 0; margin-right: 0; }

  .ad-head { display: grid; gap: 0.35rem; }
  .ad-head__title { margin: 0; font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 640; letter-spacing: -0.04em; line-height: 1.05; color: var(--pf-cream); }
  .ad-head__question { margin: 0; max-width: 62ch; text-wrap: pretty; font-size: 0.86rem; line-height: 1.5; color: rgb(${CREAM} / 0.55); }

  /* RANG 1, LE POULS. Le seul endroit de l'espace où un chiffre passe devant le
     titre de la page : 70px contre 32px, et 5 fois la ligne du monde scolaire.
     Trois poids nets valent mieux que six tuiles d'égale importance, parce qu'un
     cockpit se lit dans l'ordre des tailles et pas de gauche à droite. */
  .ad-pulse { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(1rem, 3vw, 2.5rem); padding: clamp(0.4rem, 1.5vh, 1rem) 0 clamp(0.6rem, 2vh, 1.2rem); }
  @media (max-width: 620px) { .ad-pulse { grid-template-columns: 1fr; gap: 1.6rem; } }
  .ad-pulse__cell { display: grid; gap: 0.1rem; align-content: start; min-width: 0; }
  .ad-pulse__head { display: flex; align-items: baseline; gap: 0.45rem; flex-wrap: wrap; }
  .ad-pulse__value { font-size: clamp(2.6rem, 7vw, 4.4rem); font-weight: 660; letter-spacing: -0.05em; line-height: 0.92; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .ad-pulse__unit { font-size: clamp(0.88rem, 1.7vw, 1.1rem); font-weight: 560; letter-spacing: -0.01em; color: var(--pf-cream); }
  .ad-pulse__label { margin-top: 0.45rem; font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.7); }
  .ad-pulse__helper { font-family: var(--pf-mono); font-size: 0.52rem; letter-spacing: 0.03em; color: rgb(${CREAM} / 0.38); }

  /* Rang 3 : une ligne, tant que le sujet est jeune. */
  .ad-facts--line { align-items: baseline; gap: 0.3rem 1.4rem; margin: 0; }
  .ad-facts__title { font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(${CREAM} / 0.35); }

  .ad-note code { font-family: var(--pf-mono); font-size: 0.92em; color: rgb(${CREAM} / 0.65); }

  /* Les mesures : une grille de chiffres, chacun avec son effectif. */
  .ad-kpis { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 760px) { .ad-kpis { grid-template-columns: repeat(2, 1fr); } }

  /* Une suite de faits courts, sur une ligne. */
  .ad-facts { display: flex; flex-wrap: wrap; gap: 0.3rem 1.2rem; margin: 0 0 0.8rem; font-family: var(--pf-mono); font-size: 0.62rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.5); }
  .ad-facts em { font-style: normal; font-weight: 640; font-size: 0.9rem; color: var(--pf-cream); }

  /* Ce qu'il faut savoir pour lire le panneau au dessus. */
  .ad-note { margin: 0; max-width: 62ch; text-wrap: pretty; font-size: 0.8rem; line-height: 1.5; color: rgb(${CREAM} / 0.45); }

  /* Une liste de lignes : un nom, des precisions, une valeur a droite. */
  .ad-rows { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
  .ad-rows > li { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem 1.2rem; flex-wrap: wrap; padding: 0.62rem 0; border-top: 1px solid rgb(${CREAM} / 0.08); font-size: 0.86rem; color: rgb(${CREAM} / 0.6); }
  .ad-rows > li:first-child { border-top: none; padding-top: 0; }
  .ad-rows em { font-style: normal; font-weight: 620; color: var(--pf-cream); }
  .ad-rows b { font-weight: 400; font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.06em; text-transform: uppercase; color: rgb(${CREAM} / 0.38); }
  .ad-rows__name { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; min-width: 0; }
  .ad-rows__value { font-family: var(--pf-mono); font-size: 0.6rem; color: rgb(${CREAM} / 0.45); white-space: nowrap; }
  .ad-rows--flag > li { color: var(--pf-cream); }

  /* Une barre par ligne, quand la comparaison compte plus que le chiffre. */
  .ad-bars { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
  .ad-bars > li { display: grid; grid-template-columns: minmax(7rem, 14rem) minmax(0, 1fr) auto; align-items: center; gap: 0.8rem; font-size: 0.82rem; color: rgb(${CREAM} / 0.6); }
  .ad-bars__track { height: 3px; border-radius: 2px; background: rgb(${CREAM} / 0.1); overflow: hidden; }
  .ad-bars__fill { display: block; height: 100%; background: rgb(${CREAM} / 0.45); }
  .ad-bars__value { font-family: var(--pf-mono); font-size: 0.6rem; color: rgb(${CREAM} / 0.45); white-space: nowrap; }
  @media (max-width: 620px) { .ad-bars > li { grid-template-columns: 1fr auto; } .ad-bars__track { grid-column: 1 / -1; } }

  /* Un lien dans une phrase, et un lien au bout d'une ligne. */
  .ad-link { color: var(--pf-cream); text-decoration: none; border-bottom: 1px solid rgb(${CREAM} / 0.25); }
  .ad-link:hover { border-bottom-color: var(--pf-cream); }
  .ad-go { text-decoration: none; color: rgb(${CREAM} / 0.5); border-bottom: 1px solid rgb(${CREAM} / 0.2); }
  .ad-go:hover { color: var(--pf-cream); border-bottom-color: rgb(${CREAM} / 0.5); }

  /* Ce qui manque, dit en phrases. */
  .ad-gap { display: grid; gap: 0.7rem; padding: clamp(1rem, 2.2vw, 1.4rem); border: 1px dashed rgb(${CREAM} / 0.16); border-radius: var(--radius); }
  .ad-gap__missing { margin: 0; max-width: 62ch; text-wrap: pretty; font-size: 0.9rem; line-height: 1.5; color: rgb(${CREAM} / 0.7); }
  .ad-gap__fills { display: grid; gap: 0.3rem; margin: 0; padding: 0 0 0 1rem; list-style: none; font-size: 0.82rem; line-height: 1.5; color: rgb(${CREAM} / 0.45); }
  .ad-gap__fills li { position: relative; }
  .ad-gap__fills li::before { content: "→"; position: absolute; left: -1rem; color: rgb(${CREAM} / 0.3); }
`;
