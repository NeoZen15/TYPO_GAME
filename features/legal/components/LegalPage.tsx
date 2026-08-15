"use client";

import Link from "next/link";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import StarField from "@/features/profile/components/StarField";
import { BOARD_SYSTEM_CSS } from "@/features/profile/components/board-system";

// Les trois pages légales, sur un seul gabarit.
//
// AUCUNE DIRECTION ARTISTIQUE N'EST DÉCLARÉE ICI. La page porte `st` et compose
// les boards du profil, classe pour classe, depuis board-system.ts : même
// intro, mêmes panneaux, même champ d'étoiles. Un document légal est la
// dernière page où il faudrait inventer une esthétique, et la seule où un
// lecteur doit pouvoir lire longtemps sans fatigue.
//
// Elle défile, contrairement au récap : `st--screen` tiendrait dans l'écran, ce
// qui n'a aucun sens pour un texte de plusieurs pages.

// Les trois documents, déclarés une fois. Ajouter un document, c'est ajouter une
// ligne ici, et les deux autres pages le lient aussitôt.
const OTHER_DOCUMENTS = [
  { href: "/legal/confidentialite", label: "Confidentialité" },
  { href: "/legal/mentions-legales", label: "Mentions légales" },
  { href: "/legal/cgu", label: "CGU" },
] as const;

type LegalSection = {
  readonly title: string;
  readonly body: string;
};

type LegalPageProps = {
  /** Chemin de la page rendue, pour qu'elle ne se lie pas elle même. */
  current: string;
  kicker: string;
  title: string;
  updated: string;
  intro: string;
  sections: readonly LegalSection[];
};

export default function LegalPage({ current, kicker, title, updated, intro, sections }: LegalPageProps) {
  return (
    <main className="st pf-page">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />

      <ThemeSwitch />

      <div className="st-bg" aria-hidden="true">
        <StarField />
      </div>

      <header className="st-intro st-sec">
        <span className="st-kicker">{kicker}</span>
        <h1 className="st-title">{title}</h1>
        <p className="st-lede">{intro}</p>
        <span className="st-panel__meta">{updated}</span>
      </header>

      {/* Un seul bloc de texte, centré, sans panneaux. Décision du propriétaire :
          onze cadres pour onze paragraphes faisaient onze boîtes là où il faut
          un document qui se lit d'un trait. */}
      <div className="st-prose st-sec">
        {sections.map((section) => (
          <section key={section.title} aria-label={section.title}>
            <h2 className="st-panel__title">{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>

      {/* Les trois documents se lient entre eux. La loi demande qu'ils soient
          accessibles en permanence, et le pied de page de l'accueil est
          aujourd'hui la seule porte : arrivé sur l'un d'eux par un lien direct
          ou un moteur de recherche, un visiteur ne devait pas repasser par
          l'accueil pour lire les deux autres. */}
      <nav className="st-actions st-sec" aria-label="Autres documents légaux">
        {OTHER_DOCUMENTS.filter((document) => document.href !== current).map((document) => (
          <Link key={document.href} href={document.href} className="st-action">
            {document.label}
          </Link>
        ))}
        <Link href="/" className="st-action st-action--primary">
          Retour à l&apos;accueil
        </Link>
      </nav>
    </main>
  );
}
