"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import ParticleField from "@/features/landing/components/ParticleField";
import GhostCursorDemo from "@/features/landing/components/GhostCursorDemo";
import LetterAnatomy from "@/features/landing/components/LetterAnatomy";
import CompareTeaser from "@/features/landing/components/CompareTeaser";
import TypefaceRail from "@/features/landing/components/TypefaceRail";
import MasteryClimb from "@/features/landing/components/MasteryClimb";

/**
 * New main landing page — built section by section.
 * Reference universe: Bramus's modern-CSS Google Antigravity rework,
 * adapted strictly to the JEUX DE TYPO validated design system
 * (see docs/ui-palette-reference.md):
 *   - colour lives on contours/halos, never on button fills or text
 *   - yellow #ffd213 = brand chrome only (borders, focus, progress)
 *   - validated primary CTA = soft white pill / dark text
 *   - titles are solid neutral colour, Inter (self-hosted) UI stack `--ui-sans`
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

// Header nav — anchors to the on-page sections.
const NAV = [
  { id: "how", label: "How it works" },
  { id: "compare", label: "Compare" },
  { id: "typefaces", label: "Typefaces" },
  { id: "modes", label: "Modes" },
] as const;

// The 3 game modes — accent stays on the contour only (validated /play).
const MODES = [
  {
    key: "training",
    label: "Training",
    meta: "Core mode",
    title: "Learn at your pace",
    desc: "No timer. Confused faces come back sooner, mastered ones later.",
    accent: "#40d38f",
  },
  {
    key: "competition",
    label: "Competition",
    meta: "Timed",
    title: "Race the clock",
    desc: "Score on speed and accuracy. Every second counts.",
    accent: "#ff934a",
  },
  {
    key: "expert",
    label: "Expert",
    meta: "Advanced",
    title: "For trained eyes",
    desc: "No hints, rarer faces, tighter calls. Prove the eye.",
    accent: "#58a9ff",
  },
] as const;

// Runtime-ready catalog faces for the typefaces rail (family = JDT__<slug>).
const TYPEFACE_SPECIMENS = [
  { slug: "montserrat", name: "Montserrat", cat: "Geometric sans" },
  { slug: "libre_baskerville", name: "Libre Baskerville", cat: "Transitional serif" },
  { slug: "dm_sans", name: "DM Sans", cat: "Low-contrast sans" },
  { slug: "pt_serif", name: "PT Serif", cat: "Slab-ish serif" },
  { slug: "poppins", name: "Poppins", cat: "Geometric sans" },
  { slug: "roboto", name: "Roboto", cat: "Neo-grotesque" },
  { slug: "ibm_plex_sans", name: "IBM Plex Sans", cat: "Grotesque" },
  { slug: "raleway", name: "Raleway", cat: "Display sans" },
] as const;

export default function LandingExperience() {
  const [specimenIndex, setSpecimenIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);
  const modesRef = useRef<HTMLDivElement>(null);

  // Cycle the hero word through real typefaces (the live specimen).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setSpecimenIndex((prev) => (prev + 1) % HERO_SPECIMENS.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  // Scroll-spy: highlight the nav link of the section in view.
  useEffect(() => {
    const sections = NAV.map((n) => document.getElementById(n.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (sections.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  // Condense the header once the page is scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Staggered reveal of the mode cards (visible-by-default; armed only when
  // motion is allowed, then triggered by IntersectionObserver).
  useEffect(() => {
    const grid = modesRef.current;
    if (!grid) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    grid.classList.add("lp-modes--armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          grid.classList.add("lp-modes--in");
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(grid);
    return () => io.disconnect();
  }, []);

  const specimen = HERO_SPECIMENS[specimenIndex];

  return (
    <div className="lp">
      {/* Floating pill nav — mirrors the validated `compare-site-nav` DA. */}
      <header className={`lp-header${scrolled ? " is-scrolled" : ""}`}>
        <span className="lp-header__field" aria-hidden="true">
          R K T S Æ Q ßMTO · LKHDQV ✶@X&amp; W M nø WCT +UNZ · ÷ÐQZ YB ßOA ∗∗− MUME X·R OP
          NKO · AZIU · UF DVS S · LKHDQV ✶@X&amp; M nø WCT +UN · YB ßOA ∗∗ R K T S Æ Q ßMTO ·
          LKHDQV ✶@X&amp; W M nø WCT +UNZ · ÷ÐQZ YB ßOA ∗∗− MUME X·R OP NKO · AZIU · UF DVS S
        </span>
        <Link href="/" className="lp-header__brand" aria-label="Dwiggins — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="lp-header__figures"
            src="/brand/dwiggins-figures-dark.svg"
            alt=""
            aria-hidden="true"
            width={182}
            height={122}
          />
          <Image
            src="/brand/dwiggins-wordmark-full-black.svg"
            alt="Dwiggins"
            className="lp-header__logo"
            width={812}
            height={200}
            priority
          />
        </Link>
        <nav className="lp-header__nav" aria-label="Sections">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`lp-header__link${activeSection === item.id ? " is-active" : ""}`}
              aria-current={activeSection === item.id ? "true" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="lp-header__actions">
          <Link href="/onboarding" className="lp-header__cta">
            Start training
          </Link>
          <ThemeSwitch />
        </div>
      </header>

      {/* ── Block 1 — Hero ───────────────────────────────────────── */}
      <section id="top" className="lp-hero" aria-label="Typeface recognition game">
        {/* Calm monochrome dot field with a soft pointer halo. */}
        <ParticleField />

        <div className="lp-hero__inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="lp-hero__symbol"
            src="/brand/dwiggins-figures-cream.svg"
            alt=""
            aria-hidden="true"
          />
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
      <section id="how" className="lp-section lp-demo" aria-label="How the game works">
        <div className="lp-demo__text">
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

        <div className="lp-demo-stagewrap">
          <div className="lp-demo-stage" aria-hidden="true" />
          <GhostCursorDemo />
        </div>
      </section>

      {/* ── Block 3 — Read the structure (letter anatomy) ────────── */}
      <section className="lp-section lp-anatomy" aria-label="Read the structure">
        <div className="lp-anatomy__head">
          <h2 className="lp-section__title">It&apos;s built, not guessed.</h2>
          <p className="lp-section__lede">
            Proportions, axis, contrast — the construction is what gives a
            typeface away. Watch a letter take shape, and learn to see its bones.
          </p>
        </div>

        <LetterAnatomy />
      </section>

      {/* ── Block 4 — Compare (/compare): how to look — we built a tool ── */}
      <section id="compare" className="lp-section lp-feature" aria-label="Compare typefaces">
        <div className="lp-feature__text">
          <p className="lp-kicker">How to look</p>
          <h2 className="lp-section__title">So we built a tool to teach your eye.</h2>
          <p className="lp-section__lede">
            Seeing the difference is a skill — and the fastest way to learn a
            face is to see what it isn&apos;t. Put two side by side and the tells
            jump out: the contrast, the axis, the shape of a single letter.
          </p>
          <Link href="/compare" className="lp-btn lp-btn--ghost lp-feature__cta">
            Open compare →
          </Link>
        </div>

        <CompareTeaser />
      </section>

      {/* ── Block 5 — Typefaces (/type) ──────────────────────────── */}
      <section id="typefaces" className="lp-section lp-typefaces" aria-label="Typefaces">
        <div className="lp-typefaces__head">
          <h2 className="lp-section__title">A library to train your eye on.</h2>
          <p className="lp-section__lede">
            Hundreds of faces — and any of them can turn up in a round. Open one
            to resize it, set your own words, and study its anatomy.
          </p>
        </div>

        <TypefaceRail specimens={TYPEFACE_SPECIMENS} />
      </section>

      {/* ── Block 6 — The 3 modes ────────────────────────────────── */}
      <section id="modes" className="lp-section lp-modes" aria-label="Game modes">
        <div className="lp-modes__head">
          <h2 className="lp-section__title">Three ways to play.</h2>
          <p className="lp-section__lede">
            Start gentle, race the clock, or go expert — same eye, rising stakes.
          </p>
        </div>

        <div className="lp-modes__grid" ref={modesRef}>
          {MODES.map((m) => (
            <Link
              key={m.key}
              href="/play"
              className="lp-mode-card"
              style={{ ["--mode-accent" as string]: m.accent }}
              onPointerMove={(event) => {
                const el = event.currentTarget;
                const r = el.getBoundingClientRect();
                const px = (event.clientX - r.left) / r.width - 0.5;
                const py = (event.clientY - r.top) / r.height - 0.5;
                el.style.setProperty("--rx", `${(-py * 7).toFixed(2)}deg`);
                el.style.setProperty("--ry", `${(px * 7).toFixed(2)}deg`);
              }}
              onPointerLeave={(event) => {
                const el = event.currentTarget;
                el.style.setProperty("--rx", "0deg");
                el.style.setProperty("--ry", "0deg");
              }}
            >
              <span className="lp-mode-card__chip">{m.label}</span>
              <h3 className="lp-mode-card__title">{m.title}</h3>
              <p className="lp-mode-card__desc">{m.desc}</p>
              <span className="lp-mode-card__meta">
                {m.meta}
                <span className="lp-mode-card__arrow">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Block 7 — Progress climax ("watch your eye sharpen") ──── */}
      <MasteryClimb />

      {/* ── Footer — the whole bar IS the cream "dossier" (full-width) ── */}
      <footer className="lp-footer">
        {/* Folder tab — one vector path: rounded top-left, flat high top, then
            an S-shoulder (convex corner → concave fillet, tangent so they meet
            smoothly with no spike) stepping down to the footer's top edge.
            One shape ⇒ no seam, no gradient feathering (crisp, not blurry).
            `bottom:100%` (CSS) self-aligns its bottom edge to the footer top at
            any width; the right of the SVG sits flush on the body's flat top.
            Geometry: convex r = concave r = 11, and 11+11 = 22 (the drop), so
            the two arcs join with a common vertical tangent — a clean S. */}
        <svg
          className="lp-footer__tab"
          viewBox="0 0 250 22"
          aria-hidden="true"
        >
          <path
            d="M0,14 A14,14 0 0 1 14,0 H150 A11,11 0 0 1 161,11 A11,11 0 0 0 172,22 H250 L0,22 Z"
            fill="var(--foreground)"
          />
        </svg>

        <div className="lp-footer__inner">
          <span className="lp-footer__copyright" aria-hidden="true">©</span>

          <div className="lp-footer__main">
            <div className="lp-footer__brand">
              <div className="lp-footer__mark">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="lp-footer__figures"
                  src="/brand/dwiggins-figures-dark.svg"
                  alt=""
                  aria-hidden="true"
                />
                <Link href="/" className="lp-footer__wordmark-link" aria-label="Dwiggins — home">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="lp-footer__wordmark"
                    src="/brand/dwiggins-wordmark-full-black.svg"
                    alt="Dwiggins"
                  />
                </Link>
              </div>
              <p className="lp-footer__tagline">
                A game for reading type. Train your eye to recognize typefaces.
              </p>
              <Link href="/onboarding" className="lp-footer__cta">
                Start training →
              </Link>
            </div>

            <nav className="lp-footer__cols" aria-label="Footer">
              <div className="lp-footer__col">
                <h3 className="lp-footer__col-title">Play</h3>
                <a href="#modes" className="lp-footer__link">All modes</a>
                <Link href="/play" className="lp-footer__link">Training</Link>
                <Link href="/play" className="lp-footer__link">Competition</Link>
                <Link href="/play" className="lp-footer__link">Expert</Link>
              </div>
              <div className="lp-footer__col">
                <h3 className="lp-footer__col-title">Explore</h3>
                <a href="#how" className="lp-footer__link">How it works</a>
                <Link href="/compare" className="lp-footer__link">Compare</Link>
                <a href="#typefaces" className="lp-footer__link">Typefaces</a>
              </div>
              <div className="lp-footer__col">
                <h3 className="lp-footer__col-title">Get started</h3>
                <Link href="/onboarding" className="lp-footer__link">Onboarding</Link>
                <Link href="/play" className="lp-footer__link">Modes</Link>
              </div>
            </nav>
          </div>

          <div className="lp-footer__strip">
            <span>Form recognition</span>
            <span className="lp-footer__rule" />
            <span>© 2026 Dwiggins · Jeux de Typo</span>
            <span className="lp-footer__rule" />
            <span>Structure system</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
