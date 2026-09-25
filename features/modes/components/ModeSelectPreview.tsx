"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import { type ModeSelectStats } from "@/lib/modes/mode-select-stats";
import { prefersReducedMotion } from "@/lib/motion";

// PROPOSITION, 2026-09-23, served on /dev/modes only. /play is untouched until
// Marion says go.
//
// The idea: each card shows its mode instead of describing it. A stage at the top
// of the card plays the word the way the mode does. Training changes face slowly,
// Competition changes fast with a bar that drains, Expert holds a word it will not
// name. Under it, the one live figure is set large, since it is what decides which
// mode you open. Everything else stays as arbitrated: black cards, the mode colour
// on the chip and the contour only, the cream button.
//
// The specimen is the game's own question, so it carries no typographic property
// but its family and its size: weight, spacing and shape come from the font file.

type ModeKey = "training" | "competition" | "expert";

type ModeChoice = {
  key: ModeKey;
  label: string;
  title: string;
  desc: string;
  accent: string;
  // Milliseconds between two faces on the stage, null when the stage holds.
  tempo: number | null;
};

const MODES: readonly ModeChoice[] = [
  {
    key: "training",
    label: "Training",
    title: "Learn at your pace",
    desc: "No timer. Confused faces come back sooner, mastered ones later.",
    accent: "#40d38f",
    tempo: 2400,
  },
  {
    key: "competition",
    label: "Competition",
    title: "Race the clock",
    desc: "Score on speed and accuracy. Every second counts.",
    accent: "#ff934a",
    tempo: 900,
  },
  {
    key: "expert",
    label: "Expert",
    title: "For trained eyes",
    desc: "No hints, rarer faces, tighter calls. Prove the eye.",
    accent: "#58a9ff",
    tempo: null,
  },
];

// The figure that pulls, split into the number and what it counts, so the number
// can be set large and the words stay at reading size.
const figureFor = (key: ModeKey, stats: ModeSelectStats | null): { value: string; label: string } => {
  if (key === "expert") return { value: "5", label: "keys to unlock it" };
  if (key === "training") {
    if (!stats || stats.trainingPoolSize === 0) return { value: "30", label: "faces to start with" };
    if (stats.trainingDueNow === 0) return { value: String(stats.trainingPoolSize), label: "faces resting" };
    return { value: String(stats.trainingDueNow), label: stats.trainingDueNow === 1 ? "face due now" : "faces due now" };
  }
  if (!stats || stats.competitionRounds === 0) return { value: "New", label: "no score yet, set the first one" };
  return { value: String(stats.competitionBest), label: "points, your best to beat" };
};

function Stage({ mode, word, families }: { mode: ModeChoice; word: string; families: readonly string[] }) {
  const [index, setIndex] = useState(0);
  const [still, setStill] = useState(true);

  useEffect(() => {
    if (mode.tempo === null || prefersReducedMotion()) return;
    setStill(false);
    const id = window.setInterval(() => setIndex((i) => (i + 1) % families.length), mode.tempo);
    return () => window.clearInterval(id);
  }, [mode.tempo, families.length]);

  return (
    <div className="pm2-stage" data-mode={mode.key} aria-hidden="true">
      <span className="pm2-stage__word" style={{ fontFamily: families[index] }}>
        {word}
      </span>
      {mode.key === "competition" && !still ? (
        // Restarted on every face, so the bar reads as the time left on it.
        <span key={index} className="pm2-stage__clock" style={{ animationDuration: `${mode.tempo}ms` }} />
      ) : null}
      {mode.key === "expert" ? <span className="pm2-stage__lock">Which face is this?</span> : null}
    </div>
  );
}

type ModeSelectPreviewProps = {
  stats: ModeSelectStats | null;
  families: readonly string[];
};

export default function ModeSelectPreview({ stats, families }: ModeSelectPreviewProps) {
  return (
    <main className="pf-page">
      <header className="pf-top">
        <Link href="/" className="pf-top__brand" aria-label="Dwiggins — home">
          <Image
            src="/brand/dwiggins-wordmark-full-black.svg"
            alt="Dwiggins"
            className="pf-top__logo mark--on-light"
            width={812}
            height={200}
            priority
          />
          <Image
            src="/brand/dwiggins-wordmark-full-ivory.svg"
            alt="Dwiggins"
            className="pf-top__logo mark--on-dark"
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

      <div className="pm pm2">
        <div className="pb-intro">
          <h1 className="pb-title">Pick how you want to play.</h1>
          <p className="pb-lede">Same eye, rising stakes. Only training moves your progression.</p>
        </div>

        <div className="pm2-grid">
          {MODES.map((mode) => {
            const figure = figureFor(mode.key, stats);
            return (
              <article
                key={mode.key}
                className="lp-mode-card pm2-card"
                style={{ ["--mode-accent" as string]: mode.accent }}
              >
                <Stage mode={mode} word="rythme" families={families} />
                <span className="lp-mode-card__chip">{mode.label}</span>
                <h2 className="lp-mode-card__title">{mode.title}</h2>
                <p className="lp-mode-card__desc">{mode.desc}</p>
                <p className="pm2-figure">
                  <span className="pm2-figure__value">{figure.value}</span>
                  <span className="pm2-figure__label">{figure.label}</span>
                </p>
                <div className="pm2-actions">
                  <Link href={`/play/${mode.key}`} className="lp-btn lp-btn--primary">
                    {mode.key === "expert" ? "Preview" : "Play"}
                  </Link>
                  <Link href={`/play/${mode.key}/rules`} className="pm2-rules">
                    How it plays
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
