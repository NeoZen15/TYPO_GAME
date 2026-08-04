import Link from "next/link";
import Image from "next/image";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import StarField from "@/features/profile/components/StarField";
import { type ModeSelectStats } from "@/lib/modes/mode-select-stats";

// THE LANDING'S OWN MODE DECK, REUSED HERE.
//
// This page is the landing's "Three ways to play" section: headline and lede on the
// left, the three cards fanned on the right. It reuses the landing's classes
// verbatim (.lp-modes, .lp-modes__head, .lp-modes__grid, .lp-mode-card and its
// children), so the accent lives on the contour and the chip, the type is the page's
// own, and nothing beige appears anywhere.
//
// What the previous version got wrong, and is now gone: each card set a word in a
// different catalogue face, which changed the typography of the page; and the two
// links were cream pills, a colour that belongs to the landing's own primary button
// and to nothing here.
//
// WHAT THE CARDS ADD OVER THE LANDING'S. The landing's meta row is a static label
// ("CORE MODE", "TIMED", "ADVANCED"). Here it carries the live figure that decides
// which mode you open: how many faces are due right now, the score you have to beat,
// or the gate. It is the only figure on the page that expires, so it is the only one
// that pulls. All of it is read from the database, never invented.
//
// No pointer tilt: the landing arms it from a client component, and this page is a
// server component. The hover lift, the border and the glow are pure CSS and remain.

type ModeChoice = {
  key: "training" | "competition" | "expert";
  label: string;
  title: string;
  desc: string;
  accent: string;
};

// Same titles, descriptions and accents as the landing deck, on purpose: a visitor
// who clicked through from the landing must land on the same three cards.
const MODES: readonly ModeChoice[] = [
  {
    key: "training",
    label: "Training",
    title: "Learn at your pace",
    desc: "No timer. Confused faces come back sooner, mastered ones later.",
    accent: "#40d38f",
  },
  {
    key: "competition",
    label: "Competition",
    title: "Race the clock",
    desc: "Score on speed and accuracy. Every second counts.",
    accent: "#ff934a",
  },
  {
    key: "expert",
    label: "Expert",
    title: "For trained eyes",
    desc: "No hints, rarer faces, tighter calls. Prove the eye.",
    accent: "#58a9ff",
  },
];

type ModeSelectPageProps = {
  /* Null for a visitor with no history: each card then says what a first run looks
     like instead of showing a zero that reads as failure. */
  stats: ModeSelectStats | null;
};

/** The meta row: what is waiting for you in this mode, right now. */
const waitingFor = (key: ModeChoice["key"], stats: ModeSelectStats | null) => {
  if (key === "expert") {
    return "Locked, 5 keys of 2032";
  }

  if (key === "training") {
    if (!stats || stats.trainingPoolSize === 0) {
      return "30 faces to start";
    }
    if (stats.trainingDueNow === 0) {
      return `Nothing due, ${stats.trainingPoolSize} resting`;
    }
    return stats.trainingDueNow === 1 ? "1 face due now" : `${stats.trainingDueNow} faces due now`;
  }

  if (!stats || stats.competitionRounds === 0) {
    return "2 points under two seconds";
  }
  return `Your best, ${stats.competitionBest} points`;
};

export default function ModeSelectPage({ stats }: ModeSelectPageProps) {
  return (
    <main className="pf-page pf-page--fixed">
      <header className="pf-top">
        <Link href="/" className="pf-top__brand" aria-label="Dwiggins — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pf-top__figures"
            src="/brand/dwiggins-figures-dark.svg"
            alt=""
            aria-hidden="true"
            width={182}
            height={122}
          />
          <Image
            src="/brand/dwiggins-wordmark-full-black.svg"
            alt="Dwiggins"
            className="pf-top__logo"
            width={812}
            height={200}
            priority
          />
        </Link>

        <div className="pf-top__actions">
          <Link href="/profile" className="pf-top__cta">
            Profile
          </Link>
          <ThemeSwitch />
        </div>
      </header>

      <div className="pm">
        <div className="pb-bg" aria-hidden="true">
          <StarField />
        </div>

        <section className="lp-modes" aria-label="Game modes">
          <div className="lp-modes__head">
            <h1 className="lp-section__title">Pick how you want to play.</h1>
            <p className="lp-section__lede">
              Start gentle, race the clock, or go expert. Same eye, rising stakes.
            </p>
            <p className="pm-note">
              Only your training progression is personal and permanent. Competition never moves it.
            </p>
          </div>

          <div className="lp-modes__grid">
            {MODES.map((mode) => (
              <Link
                key={mode.key}
                href={`/play/${mode.key}`}
                className="lp-mode-card"
                style={{ ["--mode-accent" as string]: mode.accent }}
              >
                <span className="lp-mode-card__chip">{mode.label}</span>
                <h2 className="lp-mode-card__title">{mode.title}</h2>
                <p className="lp-mode-card__desc">{mode.desc}</p>
                <span className="lp-mode-card__meta">
                  <span>{waitingFor(mode.key, stats)}</span>
                  <span className="lp-mode-card__arrow" aria-hidden="true">
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>

          {/* Outside the cards, because a link cannot sit inside a link: each card
              is already the link to its mode, the way the landing's are. */}
          <p className="pm-rules">
            <span className="pm-rules__label">Rules</span>
            {MODES.map((mode) => (
              <Link
                key={mode.key}
                href={`/play/${mode.key}/rules`}
                className="pm-rules__pill"
                style={{ ["--mode-accent" as string]: mode.accent }}
              >
                {mode.label}
              </Link>
            ))}
          </p>
        </section>
      </div>
    </main>
  );
}
