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

type LegalSection = {
  readonly title: string;
  readonly body: string;
};

type LegalPageProps = {
  kicker: string;
  title: string;
  updated: string;
  intro: string;
  sections: readonly LegalSection[];
};

export default function LegalPage({ kicker, title, updated, intro, sections }: LegalPageProps) {
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

      {sections.map((section) => (
        <section className="st-panel st-sec" key={section.title} aria-label={section.title}>
          <h2 className="st-panel__title">{section.title}</h2>
          <p className="st-lede">{section.body}</p>
        </section>
      ))}

      <div className="st-actions st-sec">
        <Link href="/" className="st-action st-action--primary">
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
