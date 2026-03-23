"use client";

import Link from "next/link";
import InlineMascot from "@/components/ui/InlineMascot";
import ThemeSwitch from "@/components/ui/ThemeSwitch";

type ModeChoice = {
  slug: "training" | "competition" | "expert";
  label: string;
  title: string;
  descriptionLines: readonly string[];
  meta: string;
};

const MODE_CHOICES: readonly ModeChoice[] = [
  {
    slug: "training",
    label: "Training",
    title: "Build visual recognition",
    descriptionLines: ["Learn by repetition and guided correction."],
    meta: "Core mode",
  },
  {
    slug: "competition",
    label: "Competition",
    title: "Two-minute challenge",
    descriptionLines: [
      "Score by speed and accuracy.",
      "Fixed-time round.",
    ],
    meta: "Timed mode",
  },
  {
    slug: "expert",
    label: "Expert",
    title: "Typeface naming",
    descriptionLines: ["No QCM. Enter the typeface name directly."],
    meta: "Advanced format",
  },
];

export default function ModeSelectPage() {
  return (
    <main className="mode-select-page">
      <ThemeSwitch />
      <InlineMascot className="mode-page-mascot mode-page-mascot--select" />

      <section className="mode-select-shell" aria-labelledby="mode-select-title">
        <header className="mode-select-header">
          <h1 id="mode-select-title" className="ui-page-title">
            Choose your game mode
          </h1>
          <p className="ui-page-subtitle">
            Same visual language, different learning format. Pick how you want to
            play now.
          </p>
        </header>

        <nav className="mode-select-grid" aria-label="Game modes">
          {MODE_CHOICES.map((mode) => (
            <article key={mode.slug} className="mode-select-card" data-mode={mode.slug}>
              <Link
                href={`/play/${mode.slug}`}
                className="mode-select-card__main"
                aria-label={`Open ${mode.label} mode`}
              >
                <span className="mode-select-card__sr-only">
                  Open {mode.label} mode
                </span>
              </Link>

              <div className="mode-select-card__body">
                <span className="mode-select-card__label">{mode.label}</span>
                <p className="mode-select-card__title">{mode.title}</p>
                <p className="mode-select-card__copy">
                  {mode.descriptionLines.map((line) => (
                    <span key={line} className="mode-select-card__copy-line">
                      {line}
                    </span>
                  ))}
                </p>
              </div>

              <div className="mode-select-card__footer">
                <span className="mode-select-card__meta">{mode.meta}</span>
                <Link
                  href={`/play/${mode.slug}/rules`}
                  className="mode-select-card__rules"
                  aria-label={`Open ${mode.label} rules`}
                >
                  Rules
                </Link>
              </div>
            </article>
          ))}
        </nav>
      </section>
    </main>
  );
}
