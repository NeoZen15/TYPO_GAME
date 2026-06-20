"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ThemeSwitch from "@/components/ui/ThemeSwitch";

// ---------------------------------------------------------------------------
// Onboarding — a short, honest "first look", NOT a settings survey.
//
// The product thesis is "we train your eye, the engine adapts" (see
// docs/perceptual-progression-spec.md, scoring-and-selection-math.md). So we do
// NOT ask the player to hand-pick a difficulty — the adaptive engine owns that.
// We ask one thing the engine can't infer cold (familiarity = the cold-start
// prior), then let them FEEL one round (a warm-up that is never pass/fail), then
// launch. Voice matches the rest of the site (English, calm, "teach your eye").
// ---------------------------------------------------------------------------

type StepId = "welcome" | "familiarity" | "micro" | "launch";

type StepConfig = {
  id: StepId;
  title: string;
  body: string;
  options?: readonly string[];
};

// The only answer we keep: a cold-start prior for the difficulty/Leitner seeding.
// Written here, read by the engine when seeding the first round.
// TODO(engine): consume `familiarity` in /play to seed initial Leitner boxes
// (today it is captured honestly but the seeding wiring is not in place yet).
type StoredOnboardingAnswers = {
  familiarity?: string;
};

type MicroChoice = "left" | "right";

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

type MicroProfile = {
  leftLabel: string;
  rightLabel: string;
  leftClass: string;
  rightClass: string;
};

// Decorative word shown in the warm-up. The task is "serif or sans-serif?", so
// the word's meaning is irrelevant — these just read well set large, in English
// to match the rest of the UI.
const MICRO_WORD_POOL = [
  "ALPHABET",
  "STRUCTURE",
  "CHARACTER",
  "CONTRAST",
  "RHYTHM",
  "PROPORTION",
] as const;

const MICRO_DEMO: MicroProfile = {
  leftLabel: "Serif",
  rightLabel: "Sans-serif",
  leftClass: "onboarding-micro-word--serif",
  rightClass: "onboarding-micro-word--sans",
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
    title: "A first look.",
    body: "No score here — just notice the letters. This is exactly how a round feels.",
  },
  {
    id: "launch",
    title: "Your eye starts here.",
    body: "Every round lights it up a little more.",
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
  const [microWord, setMicroWord] = useState<(typeof MICRO_WORD_POOL)[number]>("ALPHABET");
  const [microExpected, setMicroExpected] = useState<MicroChoice>("left");
  const [microChoice, setMicroChoice] = useState<MicroChoice | "">("");
  const [microChecked, setMicroChecked] = useState(false);
  const [microResult, setMicroResult] = useState<"" | "correct" | "wrong">("");
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const microOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const step = STEPS[stepIndex];
  const stepNumber = stepIndex + 1;
  // The warm-up is never pass/fail: once the player has checked their answer
  // (right OR wrong), they move on. Gating "continue" on a correct answer would
  // contradict the welcome promise ("not a knowledge test, observe first").
  const microResolved = microChecked;

  const canContinue = useMemo(() => {
    if (step.id === "familiarity") return familiarity.length > 0;
    if (step.id === "micro") return microResolved;
    return true;
  }, [familiarity, microResolved, step.id]);

  const helperVisible = Boolean(step.options) && !canContinue;
  const helperId = step.options ? `onboarding-helper-${step.id}` : undefined;

  const microProfile = MICRO_DEMO;
  const microLeftCorrect =
    microChecked && microResult === "correct" && microChoice === "left";
  const microLeftWrong = microChecked && microResult === "wrong" && microChoice === "left";
  const microRightCorrect =
    microChecked && microResult === "correct" && microChoice === "right";
  const microRightWrong =
    microChecked && microResult === "wrong" && microChoice === "right";

  const microFeedback = useMemo(() => {
    if (microChecked) {
      if (microResult === "correct") {
        return "Yes — those little feet on the strokes are serifs. That's the kind of seeing you'll train.";
      }
      return "Look again at the stroke ends — feet mean serif, clean ends mean sans-serif. No score here, it's just the warm-up.";
    }
    return " ";
  }, [microChecked, microResult]);

  useEffect(() => {
    writeStoredAnswers({
      familiarity: familiarity || undefined,
    });
  }, [familiarity]);

  useEffect(() => {
    optionRefs.current = [];
    microOptionRefs.current = [];
  }, [step.id]);

  useEffect(() => {
    const random =
      MICRO_WORD_POOL[Math.floor(Math.random() * MICRO_WORD_POOL.length)] ??
      MICRO_WORD_POOL[0];
    const randomExpected: MicroChoice = Math.random() < 0.5 ? "left" : "right";
    const frame = window.requestAnimationFrame(() => {
      setMicroWord(random);
      setMicroExpected(randomExpected);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main className="onboarding-page">
      <ThemeSwitch />

      <section
        className="onboarding-shell"
        data-familiarity={familiarity ? slugify(familiarity) : "unset"}
        data-step={step.id}
        aria-labelledby="onboarding-title"
      >
        <header className="onboarding-progress-top">
          <div className="onboarding-progress-meta">
            <p className="onboarding-step-counter">
              Step {stepNumber} / {STEPS.length}
            </p>
          </div>
        </header>

        <div className="onboarding-content">
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
              <h1 id="onboarding-title" className="ui-page-title onboarding-title">
                {step.title}
              </h1>
              <p className="ui-page-subtitle onboarding-copy">{step.body}</p>
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
                {helperVisible ? "Select one option to continue." : " "}
              </p>
            </div>
          ) : null}

          {step.id === "micro" ? (
            <section className="onboarding-stage-card onboarding-stage-card--micro">
              <div
                className="onboarding-micro"
                data-state={microResolved ? "resolved" : "active"}
                aria-label="Micro visual warm-up"
              >
                <div className="onboarding-micro-stage">
                  <div className="onboarding-micro-sample" aria-hidden="true">
                    <svg
                      className="onboarding-micro-specimen"
                      viewBox="0 0 760 200"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <g className="onboarding-micro-guides">
                        <line x1="30" y1="69" x2="730" y2="69" />
                        <line x1="30" y1="140" x2="730" y2="140" />
                      </g>
                      <g className="onboarding-micro-metric">
                        <text x="36" y="64">700</text>
                        <text x="36" y="158">0</text>
                      </g>
                      <text
                        className={`onboarding-micro-glyph ${
                          microExpected === "left"
                            ? microProfile.leftClass
                            : microProfile.rightClass
                        }`}
                        x="380"
                        y="140"
                        textAnchor="middle"
                      >
                        {microWord}
                      </text>
                    </svg>
                  </div>

                  <div
                    className="onboarding-micro-answers"
                    role="radiogroup"
                    aria-label="Does this word have serifs?"
                  >
                    <button
                      type="button"
                      className={`onboarding-option onboarding-micro-answer ${
                        microLeftCorrect ? "onboarding-micro-answer--correct" : ""
                      } ${microLeftWrong ? "onboarding-micro-answer--wrong" : ""}`}
                      data-selected={microChoice === "left" ? "true" : "false"}
                      role="radio"
                      aria-checked={microChoice === "left"}
                      ref={(element) => {
                        microOptionRefs.current[0] = element;
                      }}
                      onClick={() => {
                        setMicroChoice("left");
                        setMicroChecked(false);
                        setMicroResult("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                        event.preventDefault();
                        setMicroChoice("right");
                        setMicroChecked(false);
                        setMicroResult("");
                        microOptionRefs.current[1]?.focus();
                      }}
                      data-correct={microLeftCorrect ? "true" : "false"}
                      data-wrong={microLeftWrong ? "true" : "false"}
                    >
                      <span className="onboarding-micro-answer__name">{microProfile.leftLabel}</span>
                    </button>

                    <button
                      type="button"
                      className={`onboarding-option onboarding-micro-answer ${
                        microRightCorrect ? "onboarding-micro-answer--correct" : ""
                      } ${microRightWrong ? "onboarding-micro-answer--wrong" : ""}`}
                      data-selected={microChoice === "right" ? "true" : "false"}
                      role="radio"
                      aria-checked={microChoice === "right"}
                      ref={(element) => {
                        microOptionRefs.current[1] = element;
                      }}
                      onClick={() => {
                        setMicroChoice("right");
                        setMicroChecked(false);
                        setMicroResult("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                        event.preventDefault();
                        setMicroChoice("left");
                        setMicroChecked(false);
                        setMicroResult("");
                        microOptionRefs.current[0]?.focus();
                      }}
                      data-correct={microRightCorrect ? "true" : "false"}
                      data-wrong={microRightWrong ? "true" : "false"}
                    >
                      <span className="onboarding-micro-answer__name">{microProfile.rightLabel}</span>
                    </button>
                  </div>
                </div>

                <p className="onboarding-micro-feedback" data-state={microResult || "idle"} aria-live="polite">
                  {microFeedback}
                </p>
              </div>
            </section>
          ) : null}

          {step.id === "launch" ? (
            <div className="onboarding-stage-card onboarding-stage-card--launch">
              <div className="onboarding-summary" aria-label="Where you begin">
                <article className="onboarding-summary-card">
                  <span className="onboarding-summary-card__label">Starting point</span>
                  <strong className="onboarding-summary-card__value">
                    {familiarity || "A little"}
                  </strong>
                </article>
                <article className="onboarding-summary-card">
                  <span className="onboarding-summary-card__label">First mode</span>
                  <strong className="onboarding-summary-card__value">Training</strong>
                </article>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="onboarding-actions">
          {step.id !== "launch" ? (
            <button
              type="button"
              className="onboarding-btn onboarding-btn--solid"
              onClick={() => {
                if (step.id === "micro" && !microChecked) {
                  if (!microChoice) return;
                  const isCorrect = microChoice === microExpected;
                  setMicroChecked(true);
                  setMicroResult(isCorrect ? "correct" : "wrong");
                  return;
                }
                setStepIndex((prev) => clampStep(prev + 1));
              }}
              disabled={step.id === "micro" && !microChecked ? microChoice === "" : !canContinue}
            >
              {step.id === "micro" ? (microChecked ? "Continue" : "Check") : "Continue"}
            </button>
          ) : (
            <Link
              href="/game"
              className="onboarding-btn onboarding-btn--solid"
            >
              Start playing
            </Link>
          )}
        </footer>
      </section>
    </main>
  );
}
