"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ThemeSwitch from "@/components/ui/ThemeSwitch";

type StepId = "welcome" | "pace" | "familiarity" | "micro" | "launch";

type StepConfig = {
  id: StepId;
  title: string;
  body: string;
  options?: readonly string[];
};

type StoredOnboardingAnswers = {
  pace?: string;
  familiarity?: string;
};

type MicroChoice = "left" | "right";

const ONBOARDING_STORAGE_KEY = "jdt-onboarding-v1";

const PACE_OPTIONS = ["Relaxed", "Balanced", "Challenging"] as const;
type PaceOption = (typeof PACE_OPTIONS)[number];

const FAMILIARITY_OPTIONS = [
  "Not at all",
  "A little",
  "Quite familiar",
  "Designer",
] as const;
type FamiliarityOption = (typeof FAMILIARITY_OPTIONS)[number];

const PACE_DETAILS: Record<PaceOption, OptionDetail> = {
  Relaxed: {
    label: "Relaxed",
    title: "More guidance, softer tempo",
    description: "A gentler first session with more room to observe before reacting.",
    meta: "Calm start",
  },
  Balanced: {
    label: "Balanced",
    title: "Standard rhythm",
    description: "A clear, steady onboarding pace close to the core game experience.",
    meta: "Default flow",
  },
  Challenging: {
    label: "Challenging",
    title: "Sharper contrasts, less help",
    description: "A more demanding first session with reduced assistance from the start.",
    meta: "Fast track",
  },
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
  prompt: string;
  task: string;
  leftLabel: string;
  rightLabel: string;
  leftClass: string;
  rightClass: string;
};

type OptionDetail = {
  label: string;
  title: string;
  description: string;
  meta: string;
};

const MICRO_WORD_POOL = [
  "ALPHABET",
  "STRUCTURE",
  "GLYPHES",
  "CONTRASTE",
  "RHYTHME",
  "PROPORTION",
] as const;

const MICRO_DEMO: MicroProfile = {
  prompt: "A single word is shown in one typestyle.",
  task: "Task: choose the matching typestyle name below.",
  leftLabel: "Serif",
  rightLabel: "Sans Serif",
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
    id: "pace",
    title: "Choose your learning pace.",
    body: "Select how intense you want your first session to feel.",
    options: PACE_OPTIONS,
  },
  {
    id: "familiarity",
    title: "How familiar are you with typography?",
    body: "Pick the option that best matches your current level.",
    options: FAMILIARITY_OPTIONS,
  },
  {
    id: "micro",
    title: "Mini test (not scored).",
    body: "This quick test just shows how the game works before you start.",
  },
  {
    id: "launch",
    title: "Ready for round one?",
    body: "Your first round is now calibrated from your choices.",
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

const paceImpactCopy = (pace: PaceOption) => {
  if (pace === "Relaxed") {
    return "Relaxed mode active: more guidance and softer pacing from the next step.";
  }
  if (pace === "Challenging") {
    return "Challenging mode active: closer contrasts and reduced assistance from now on.";
  }
  return "Balanced mode active: standard pacing and standard assistance.";
};

const getOptionDetail = (stepId: StepId, option: string): OptionDetail => {
  if (stepId === "pace") {
    return PACE_DETAILS[option as PaceOption];
  }

  return FAMILIARITY_DETAILS[option as FamiliarityOption];
};

export default function OnboardingFlow() {
  const [stepIndex, setStepIndex] = useState(0);
  const [pace, setPace] = useState<PaceOption | "">("");
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
  const microResolved = microResult === "correct";

  const canContinue = useMemo(() => {
    if (step.id === "pace") return pace.length > 0;
    if (step.id === "familiarity") return familiarity.length > 0;
    if (step.id === "micro") return microResolved;
    return true;
  }, [familiarity, microResolved, pace, step.id]);

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
        return "Correct. Great eye.";
      }
      return "Not this one. You can select again, then click Validate.";
    }
    return " ";
  }, [microChecked, microResult]);

  useEffect(() => {
    writeStoredAnswers({
      pace: pace || undefined,
      familiarity: familiarity || undefined,
    });
  }, [familiarity, pace]);

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
        data-pace={pace ? slugify(pace) : "unset"}
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

          {step.id === "familiarity" && pace ? (
            <p className="onboarding-impact-note">{paceImpactCopy(pace)}</p>
          ) : null}


          {step.options ? (
            <div className="onboarding-stage-card onboarding-stage-card--choices">
              <div
                className={`onboarding-options onboarding-options--${step.id}`}
                role="radiogroup"
                aria-label={step.title}
                aria-required="true"
              >
                {step.options.map((option, index) => {
                  const detail = getOptionDetail(step.id, option);
                  const selected =
                    (step.id === "pace" && pace === option) ||
                    (step.id === "familiarity" && familiarity === option);

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
                        if (step.id === "pace") {
                          setPace(option as PaceOption);
                          return;
                        }
                        if (step.id === "familiarity") {
                          setFamiliarity(option as FamiliarityOption);
                        }
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

                        if (step.id === "pace") {
                          setPace(nextOption as PaceOption);
                        } else if (step.id === "familiarity") {
                          setFamiliarity(nextOption as FamiliarityOption);
                        }

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
                {helperVisible ? "Select one option to continue." : "\u00A0"}
              </p>
            </div>
          ) : null}

          {step.id === "micro" ? (
            <section className="onboarding-stage-card onboarding-stage-card--micro">
              <div
                className="onboarding-micro"
                data-pace={pace ? slugify(pace) : "balanced"}
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
                    aria-label="Typestyle options"
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

                <p className="onboarding-micro-feedback" data-state={microResult || "idle"}>
                  {microFeedback}
                </p>
              </div>
            </section>
          ) : null}

          {step.id === "launch" ? (
            <div className="onboarding-stage-card onboarding-stage-card--launch">
              <div className="onboarding-summary" aria-label="Calibration summary">
                <article className="onboarding-summary-card">
                  <span className="onboarding-summary-card__label">Pace</span>
                  <strong className="onboarding-summary-card__value">{pace || "Balanced"}</strong>
                </article>
                <article className="onboarding-summary-card">
                  <span className="onboarding-summary-card__label">Familiarity</span>
                  <strong className="onboarding-summary-card__value">
                    {familiarity || "A little"}
                  </strong>
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
                if (step.id === "micro" && !microResolved) {
                  if (!microChoice) return;
                  const isCorrect = microChoice === microExpected;
                  setMicroChecked(true);
                  setMicroResult(isCorrect ? "correct" : "wrong");
                  return;
                }
                setStepIndex((prev) => clampStep(prev + 1));
              }}
              disabled={step.id === "micro" && !microResolved ? microChoice === "" : !canContinue}
            >
              {step.id === "micro" ? (microResolved ? "Start session" : "Validate") : "Continue"}
            </button>
          ) : (
            <Link
              href="/play"
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
