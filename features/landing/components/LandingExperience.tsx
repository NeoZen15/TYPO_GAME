"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import ParticleField from "@/features/landing/components/ParticleField";
import GhostCursorDemo from "@/features/landing/components/GhostCursorDemo";
import LetterAnatomy from "@/features/landing/components/LetterAnatomy";

/**
 * New main landing page — built section by section.
 * Reference universe: Bramus's modern-CSS Google Antigravity rework,
 * adapted strictly to the JEUX DE TYPO validated design system
 * (see docs/ui-palette-reference.md):
 *   - colour lives on contours/halos, never on button fills or text
 *   - yellow #ffd213 = brand chrome only (borders, focus, progress)
 *   - validated primary CTA = soft white pill / dark text
 *   - titles are solid neutral colour, SF Pro stack
 *
 * Block 1 — Hero. The headline is a live type specimen: one word that
 * re-renders across real catalog typefaces, demonstrating the game.
 */

// Runtime-ready faces from the catalog (family = JDT__<slug>).
const HERO_SPECIMENS = [
  { slug: "montserrat", label: "Montserrat" },
  { slug: "libre_baskerville", label: "Libre Baskerville" },
  { slug: "poppins", label: "Poppins" },
  { slug: "pt_serif", label: "PT Serif" },
  { slug: "dm_sans", label: "DM Sans" },
  { slug: "raleway", label: "Raleway" },
  { slug: "roboto", label: "Roboto" },
] as const;

const HERO_WORD = "Character";

export default function LandingExperience() {
  const [specimenIndex, setSpecimenIndex] = useState(0);

  // Cycle the hero word through real typefaces (the live specimen).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setSpecimenIndex((prev) => (prev + 1) % HERO_SPECIMENS.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  const specimen = HERO_SPECIMENS[specimenIndex];

  return (
    <div className="lp">
      <ThemeSwitch />

      {/* ── Block 1 — Hero ───────────────────────────────────────── */}
      <section className="lp-hero" aria-label="Typeface recognition game">
        {/* Calm monochrome dot field with a soft pointer halo. */}
        <ParticleField />

        {/* Light "design canvas" touch: corner label. */}
        <span className="lp-corner-label" aria-hidden="true">
          jeux-de-typo · landing / 01 — hero
        </span>

        <div className="lp-hero__inner">
          <p className="lp-kicker">Typeface recognition game</p>

          <h1 className="lp-hero__title" aria-label={`${HERO_WORD} — a typeface recognition game`}>
            <span
              key={specimenIndex}
              className="lp-hero__word"
              style={{ fontFamily: `JDT__${specimen.slug}` }}
              aria-hidden="true"
            >
              {HERO_WORD}
            </span>
          </h1>

          <p className="lp-hero__specimen" aria-hidden="true">
            set in <span className="lp-hero__specimen-name">{specimen.label}</span>
          </p>

          <p className="lp-hero__lede">
            Every typeface has one. Train your eye to read it.
          </p>

          <div className="lp-hero__cta">
            <Link href="/onboarding" className="lp-btn lp-btn--primary">
              Start training
            </Link>
            <Link href="/play" className="lp-btn lp-btn--ghost">
              See the modes
            </Link>
          </div>
        </div>

        <div className="lp-scrollhint" aria-hidden="true">
          <span>Scroll to play</span>
          <span className="lp-scrollhint__arrow">↓</span>
        </div>
      </section>

      {/* ── Block 2 — Here's the game (ghost-cursor demo) ────────── */}
      <section className="lp-section lp-demo" aria-label="How the game works">
        <div className="lp-demo__text">
          <p className="lp-kicker">How it works / 01</p>
          <h2 className="lp-section__title">
            You see a word.
            <br />
            You name the typeface.
          </h2>
          <p className="lp-section__lede">
            Four answers. Some look almost identical. Don&apos;t rush — read the
            shapes: the bowls, the terminals, the contrast. Wrong turns red,
            right turns green.
          </p>
        </div>

        <GhostCursorDemo />
      </section>

      {/* ── Block 3 — Read the structure (letter anatomy) ────────── */}
      <section className="lp-section lp-anatomy" aria-label="Read the structure">
        <div className="lp-anatomy__head">
          <p className="lp-kicker">Read the structure / 02</p>
          <h2 className="lp-section__title">It&apos;s built, not guessed.</h2>
          <p className="lp-section__lede">
            Proportions, axis, contrast — the construction is what gives a
            typeface away. Watch a letter take shape, and learn to see its bones.
          </p>
        </div>

        <LetterAnatomy />
      </section>
    </div>
  );
}
