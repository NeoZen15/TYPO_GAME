"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import OnboardingWarmup from "@/features/onboarding/components/OnboardingWarmup";
import ParticleField from "@/features/landing/components/ParticleField";

// ---------------------------------------------------------------------------
// Onboarding — a short, honest "first look", NOT a settings survey.
//
// All steps are centred single-column EXCEPT "A first look" (the warm-up), which
// uses a two-column split — teaching text on the LEFT, the live example board on
// the RIGHT — because that step pairs a paragraph with a big interactive board.
//
// The product thesis is "we train your eye, the engine adapts": we do NOT ask
// the player to hand-pick difficulty. We ask the one thing the engine can't
// infer cold (familiarity = cold-start prior + the warm-up branch), let them
// FEEL one round, then launch.
// ---------------------------------------------------------------------------

type StepId = "welcome" | "familiarity" | "micro" | "launch";

type StepConfig = {
  id: StepId;
  title: string;
  body: string;
  teach?: string; // left-column voice — only used on the split "micro" step
  options?: readonly string[];
};

// `familiarity` is read back by GameScreen and sent to /api/training/session/start,
// which seeds the initial Leitner pool via init_user_pool(uuid, familiarity)
// (migration 004). It also still drives the warm-up branch below.
type StoredOnboardingAnswers = {
  familiarity?: string;
  // Whether the warm-up round was answered correctly. Read back by GameScreen and
  // sent to /api/training/session/start; an advanced declarer who got it WRONG is
  // redescended one familiarity notch before the pool is seeded. Omitted (missing)
  // when the round was not graded (beginner ghost-demo / unanswered) = no downgrade.
  warmupCorrect?: boolean;
};

const ONBOARDING_STORAGE_KEY = "jdt-onboarding-v1";

const FAMILIARITY_OPTIONS = [
  "Not at all",
  "A little",
  "Quite familiar",
  "Designer",
] as const;
type FamiliarityOption = (typeof FAMILIARITY_OPTIONS)[number];

type OptionDetail = {
  label: string;
  title: string;
  description: string;
  meta: string;
};

const FAMILIARITY_DETAILS: Record<FamiliarityOption, OptionDetail> = {
  "Not at all": {
    label: "Not at all",
    title: "Start from observation",
    description: "We keep the language simple and foreground structure over terminology.",
    meta: "Beginner",
  },
  "A little": {
    label: "A little",
    title: "Some vocabulary, still training the eye",
    description: "A middle ground for people who know a few terms but want visual stability.",
    meta: "Growing confidence",
  },
  "Quite familiar": {
    label: "Quite familiar",
    title: "You know the terrain",
    description: "Less explanation, more emphasis on subtle distinctions and consistency.",
    meta: "Comfortable",
  },
  Designer: {
    label: "Designer",
    title: "You already read type structurally",
    description: "A sharper starting point for practiced eyes and stronger recognition habits.",
    meta: "Advanced eye",
  },
};

const STEPS: readonly StepConfig[] = [
  {
    id: "welcome",
    title: "Before we start.",
    body: "This is visual training, not a knowledge test. Observe first, then decide.",
  },
  {
    id: "familiarity",
    title: "How familiar are you with typography?",
    body: "Pick what's closest — it only sets where your eye begins. The game adapts from there.",
    options: FAMILIARITY_OPTIONS,
  },
  {
    id: "micro",
    // Landing block sizes kept 1:1 (title line 2 ≈ 22 chars, lede ≈ 147) so the
    // wrap is identical — only the discourse is adapted to the onboarding voice
    // ("first look", no score, observe). The board copy stays the landing's for now.
    title: "You see a word. You learn to read it.",
    body:
      "No score here — just notice the letters. Look where the strokes end — the bowls, the terminals, the contrast. Wrong turns red, right turns green.",
  },
  {
    id: "launch",
    title: "You're ready to train.",
    body: "Here's your setup. The game adapts from your very first round, and you can switch modes anytime.",
  },
];

const clampStep = (value: number) =>
  Math.min(STEPS.length - 1, Math.max(0, value));

const slugify = (value: string) => value.toLowerCase().replace(/\s+/g, "-");

const writeStoredAnswers = (answers: StoredOnboardingAnswers) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(answers));
  } catch {
    // Ignore storage failures silently.
  }
};

export default function OnboardingFlow() {
  const [stepIndex, setStepIndex] = useState(0);
  const [familiarity, setFamiliarity] = useState<FamiliarityOption | "">("");
  const [warmupResolved, setWarmupResolved] = useState(false);
  const [warmupCorrect, setWarmupCorrect] = useState<boolean | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Stable so the warm-up child effect does not re-run every render.
  const handleWarmupResolved = useCallback((resolved: boolean, correct: boolean | null) => {
    setWarmupResolved(resolved);
    setWarmupCorrect(correct);
  }, []);

  const step = STEPS[stepIndex];
  const stepNumber = stepIndex + 1;
  const isSplit = step.id === "micro";

  // Launch recap: turn the raw familiarity answer ("Not at all") into a readable
  // level + a plain explanation, so the final screen actually says what it means.
  const startKey: FamiliarityOption = familiarity || "A little";
  const startDetail = FAMILIARITY_DETAILS[startKey];

  const canContinue = useMemo(() => {
    if (step.id === "familiarity") return familiarity.length > 0;
    if (step.id === "micro") return warmupResolved;
    return true;
  }, [familiarity, warmupResolved, step.id]);

  const helperVisible = Boolean(step.options) && !canContinue;
  const helperId = step.options ? `onboarding-helper-${step.id}` : undefined;

  useEffect(() => {
    writeStoredAnswers({
      familiarity: familiarity || undefined,
      warmupCorrect: typeof warmupCorrect === "boolean" ? warmupCorrect : undefined,
    });
  }, [familiarity, warmupCorrect]);

  useEffect(() => {
    optionRefs.current = [];
  }, [step.id]);

  // The split step ("A first look") reuses the LANDING block classes verbatim
  // (.lp-section__title / .lp-section__lede) so its text renders at EXACTLY the
  // same size as the landing demo/feature sections. Other steps keep the
  // onboarding title/subtitle styles.
  const title = (
    <h1
      id="onboarding-title"
      className={isSplit ? "lp-section__title" : "ui-page-title onboarding-title"}
    >
      {isSplit ? (
        <>
          You see a word.
          <br />
          You learn to read it.
        </>
      ) : (
        step.title
      )}
    </h1>
  );
  const body = (
    <p className={isSplit ? "lp-section__lede" : "ui-page-subtitle onboarding-copy"}>
      {step.body}
    </p>
  );

  return (
    <main className="onboarding-page">
      {/* Same calm dot-field as the landing hero — onboarding shares its DA. */}
      <ParticleField />
      <ThemeSwitch />

      <section
        className="onboarding-shell"
        data-familiarity={familiarity ? slugify(familiarity) : "unset"}
        data-step={step.id}
        data-field-quiet=""
        aria-labelledby="onboarding-title"
      >
        <header className="onboarding-progress-top">
          <div className="onboarding-progress-meta">
            <p className="onboarding-step-counter">
              Step {stepNumber} / {STEPS.length}
            </p>
          </div>
        </header>

        {isSplit ? (
          // "A first look" — the only split step: text left, live board right.
          <div className="onboarding-content onboarding-split" data-step={step.id}>
            <div className="onboarding-col onboarding-col--text">
              {title}
              {body}
              {step.teach ? <p className="onboarding-teach">{step.teach}</p> : null}
            </div>
            <div className="onboarding-col onboarding-col--example">
              <OnboardingWarmup
                key={familiarity || "A little"}
                familiarity={familiarity || "A little"}
                onResolvedChange={handleWarmupResolved}
              />
            </div>
          </div>
        ) : (
          <div className="onboarding-content" data-step={step.id}>
            <div className="onboarding-hero">
              {step.id === "welcome" ? (
                <svg
                  className="onboarding-specimen"
                  viewBox="0 0 440 210"
                  role="img"
                  aria-label="Letterforms with cap-height, x-height and baseline guides"
                >
                  <g className="onboarding-specimen-grid">
                    <line x1="20" y1="61" x2="420" y2="61" />
                    <line x1="20" y1="90" x2="420" y2="90" />
                    <line x1="20" y1="168" x2="420" y2="168" />
                  </g>
                  <g className="onboarding-specimen-tick">
                    <text x="20" y="55">CAP</text>
                    <text x="20" y="84">X-HEIGHT</text>
                    <text x="20" y="162">BASELINE</text>
                  </g>
                  <text
                    className="onboarding-specimen-glyph"
                    x="220"
                    y="168"
                    textAnchor="middle"
                  >
                    Rg
                  </text>
                </svg>
              ) : null}
              <div className="onboarding-header">
                {title}
                {body}
              </div>
            </div>

            {step.options ? (
              <div className="onboarding-stage-card onboarding-stage-card--choices">
                <div
                  className={`onboarding-options onboarding-options--${step.id}`}
                  role="radiogroup"
                  aria-label={step.title}
                  aria-required="true"
                >
                  {step.options.map((option, index) => {
                    const detail = FAMILIARITY_DETAILS[option as FamiliarityOption];
                    const selected = familiarity === option;

                    return (
                      <button
                        key={option}
                        type="button"
                        className="onboarding-option"
                        data-selected={selected ? "true" : "false"}
                        role="radio"
                        aria-checked={selected}
                        aria-describedby={helperId}
                        ref={(element) => {
                          optionRefs.current[index] = element;
                        }}
                        onClick={() => {
                          setFamiliarity(option as FamiliarityOption);
                        }}
                        onKeyDown={(event) => {
                          const options = step.options ?? [];
                          if (options.length === 0) return;

                          const key = event.key;
                          if (
                            key !== "ArrowRight" &&
                            key !== "ArrowLeft" &&
                            key !== "ArrowDown" &&
                            key !== "ArrowUp"
                          ) {
                            return;
                          }

                          event.preventDefault();
                          const direction = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
                          const nextIndex = (index + direction + options.length) % options.length;
                          const nextOption = options[nextIndex];

                          setFamiliarity(nextOption as FamiliarityOption);
                          optionRefs.current[nextIndex]?.focus();
                        }}
                      >
                        <span className="onboarding-option__label">{detail.label}</span>
                        <span className="onboarding-option__title">{detail.title}</span>
                        <span className="onboarding-option__copy">{detail.description}</span>
                        <span className="onboarding-option__meta">{detail.meta}</span>
                      </button>
                    );
                  })}
                </div>

                <p
                  id={helperId}
                  className="onboarding-helper"
                  data-visible={helperVisible ? "true" : "false"}
                  aria-live="polite"
                >
                  {helperVisible ? "Select one option to continue." : " "}
                </p>
              </div>
            ) : null}

            {step.id === "launch" ? (
              <div className="onboarding-stage-card onboarding-stage-card--launch">
                <div className="onboarding-summary" aria-label="Your setup">
                  <article className="onboarding-summary-card">
                    <span className="onboarding-summary-card__label">Where you start</span>
                    <strong className="onboarding-summary-card__value">{startDetail.meta}</strong>
                    <span className="onboarding-summary-card__desc">{startDetail.description}</span>
                  </article>
                  <article className="onboarding-summary-card">
                    <span className="onboarding-summary-card__label">First mode</span>
                    <strong className="onboarding-summary-card__value">Training</strong>
                    <span className="onboarding-summary-card__desc">
                      No timer. The faces you miss come back sooner, the ones you master come back later.
                    </span>
                  </article>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <footer className="onboarding-actions">
          {step.id !== "launch" ? (
            <button
              type="button"
              className="onboarding-btn onboarding-btn--solid"
              onClick={() => {
                setStepIndex((prev) => clampStep(prev + 1));
              }}
              disabled={!canContinue}
            >
              Continue
            </button>
          ) : (
            <Link href="/game" className="onboarding-btn onboarding-btn--solid">
              Start playing
            </Link>
          )}
        </footer>
      </section>
    </main>
  );
}
