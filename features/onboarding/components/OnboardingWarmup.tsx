"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { getTypefaceFontFamily } from "@/lib/game/training/catalog";

// ---------------------------------------------------------------------------
// Adaptive warm-up — "A first look" (Duolingo-style branch on declared level).
//
// The friend's feedback: a beginner literally cannot answer "Serif / Sans-serif?"
// — that's naming, not seeing. So the warm-up is now:
//   • "Not at all"  → a GHOST-CURSOR demo (same look as the landing's
//                     GhostCursorDemo): the cursor plays the round, the player
//                     just watches. Can't-fail, teaches the concept.
//   • "A little" / "Quite familiar" → the SAME seeing question, but playable
//                     ("which word has little feet?") — we name "serif" AFTER.
//   • "Designer"    → a real, subtle placement item (x-height comparison),
//                     data-backed from the catalog's structural_signature.
//
// Real catalog faces (JDT__<slug>, loaded by app/onboarding/page.tsx). Reuses
// the lp-demo-* board styling and respects prefers-reduced-motion.
// ---------------------------------------------------------------------------

type WarmupCard = { word: string; family: string; color: string };

type WarmupConfig = {
  tier: "discover" | "compare" | "placement";
  prompt: string;
  cards: [WarmupCard, WarmupCard];
  correctIndex: 0 | 1;
  feedbackCorrect: string;
  feedbackWrong: string;
  ghostWrong: string;
  ghostCorrect: string;
};

const fam = (slug: string, name: string) => getTypefaceFontFamily(slug, name);

function buildConfig(familiarity: string): WarmupConfig {
  if (familiarity === "Designer") {
    // Subtle, real distinction → a placement read. Both are bracketed serifs,
    // so the only thing that moves is the x-height (Merriweather = large,
    // Libre Baskerville = medium in the catalog's structural_signature).
    return {
      tier: "placement",
      prompt: "Which lowercase rides higher — the bigger x-height?",
      cards: [
        { word: "hamburg", family: fam("merriweather", "Merriweather"), color: "#8ea2ff" },
        { word: "hamburg", family: fam("libre_baskerville", "Libre Baskerville"), color: "#f5bf6a" },
      ],
      correctIndex: 0,
      feedbackCorrect: "Right — that lowercase sits taller. Bigger x-height.",
      feedbackWrong: "Compare the lowercase height — the other one is taller.",
      ghostWrong: "",
      ghostCorrect: "",
    };
  }

  // "Not at all" (watch) and "A little"/"Quite familiar" (play) share the
  // serif/sans seeing question. Left = serif (has feet), right = sans.
  const cards: [WarmupCard, WarmupCard] = [
    { word: "Hamburg", family: fam("libre_baskerville", "Libre Baskerville"), color: "#67d6b6" },
    { word: "Hamburg", family: fam("inter", "Inter"), color: "#8ea2ff" },
  ];

  return {
    tier: familiarity === "Not at all" ? "discover" : "compare",
    prompt: "Which word has little feet at the ends of the letters?",
    cards,
    correctIndex: 0,
    feedbackCorrect: "Yes — those little feet are serifs. The other is sans-serif (without).",
    feedbackWrong: "Look again — the other word has the little feet (serifs).",
    ghostWrong: "No feet here — that's sans-serif.",
    ghostCorrect: "See the little feet? Those are serifs.",
  };
}

type Props = {
  familiarity: string;
  onResolvedChange: (resolved: boolean) => void;
};

export default function OnboardingWarmup({ familiarity, onResolvedChange }: Props) {
  const config = useMemo(() => buildConfig(familiarity), [familiarity]);
  const auto = config.tier === "discover";

  const rootRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const [picked, setPicked] = useState<number | null>(null);

  // Resolution: the watch-only tier is "resolved" immediately (can't-fail);
  // the playable tiers resolve once the player has committed an answer (right
  // OR wrong — never gated on correctness).
  useEffect(() => {
    onResolvedChange(auto ? true : picked !== null);
  }, [auto, picked, onResolvedChange]);

  // Reset when the tier/config changes (e.g. a different familiarity).
  useEffect(() => {
    optionRefs.current = [];
    setPicked(null);
  }, [config]);

  // Ghost-cursor auto-demo (discover tier) — mirrors the landing GhostCursorDemo.
  useEffect(() => {
    if (!auto) return;
    const root = rootRef.current;
    const cursor = cursorRef.current;
    const fb = feedbackRef.current;
    if (!root || !cursor) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const correct = config.correctIndex;
    const wrong = correct === 0 ? 1 : 0;

    const clearStates = () =>
      optionRefs.current.forEach((el) => el?.classList.remove("is-wrong", "is-correct"));
    const mark = (idx: number, cls: string) => optionRefs.current[idx]?.classList.add(cls);
    const setFeedback = (text: string, state: string) => {
      if (!fb) return;
      fb.textContent = text;
      fb.dataset.state = state;
    };

    if (reduced) {
      mark(correct, "is-correct");
      setFeedback(config.ghostCorrect, "correct");
      gsap.set(cursor, { autoAlpha: 0 });
      return;
    }

    const centerOf = (idx: number) => {
      const el = optionRefs.current[idx];
      const rr = root.getBoundingClientRect();
      if (!el) return { x: rr.width / 2, y: rr.height / 2 };
      const r = el.getBoundingClientRect();
      return { x: r.left - rr.left + r.width / 2, y: r.top - rr.top + r.height / 2 };
    };

    let tl: gsap.core.Timeline | null = null;

    const build = () => {
      tl?.kill();
      clearStates();
      const wrongC = centerOf(wrong);
      const correctC = centerOf(correct);
      gsap.set(cursor, { x: root.clientWidth * 0.5, y: root.clientHeight * 0.92, autoAlpha: 0, scale: 1 });

      tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
      tl.to(cursor, { autoAlpha: 1, duration: 0.3 })
        .to(cursor, { x: wrongC.x, y: wrongC.y, duration: 0.85, ease: "power2.inOut" })
        .to(cursor, {
          scale: 0.86,
          duration: 0.11,
          yoyo: true,
          repeat: 1,
          onStart: () => {
            mark(wrong, "is-wrong");
            setFeedback(config.ghostWrong, "wrong");
          },
        })
        .to({}, { duration: 1.0 })
        .add(() => {
          clearStates();
          setFeedback(" ", "idle");
        })
        .to(cursor, { x: correctC.x, y: correctC.y, duration: 0.7, ease: "power2.inOut" })
        .to(cursor, {
          scale: 0.86,
          duration: 0.11,
          yoyo: true,
          repeat: 1,
          onStart: () => {
            mark(correct, "is-correct");
            setFeedback(config.ghostCorrect, "correct");
          },
        })
        .to({}, { duration: 1.8 })
        .to(cursor, { autoAlpha: 0, duration: 0.35 })
        .add(() => {
          clearStates();
          setFeedback(" ", "idle");
        });
    };

    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          if (!started) {
            started = true;
            build();
          } else {
            tl?.play();
          }
        } else {
          tl?.pause();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(root);

    return () => {
      io.disconnect();
      tl?.kill();
      gsap.killTweensOf(cursor);
    };
  }, [auto, config]);

  // Class for a card in the playable tiers (React-driven reveal).
  const interactiveCardClass = (idx: number) => {
    if (picked === null) return "";
    if (idx === config.correctIndex) return "is-correct";
    if (idx === picked) return "is-wrong";
    return "";
  };

  const interactiveFeedback =
    picked === null
      ? " "
      : picked === config.correctIndex
        ? config.feedbackCorrect
        : config.feedbackWrong;
  const interactiveState =
    picked === null ? "idle" : picked === config.correctIndex ? "correct" : "wrong";

  return (
    <div className="onboarding-warmup">
      <div className="lp-demo-board onboarding-warmup-board" ref={rootRef} data-tier={config.tier}>
        <p className="lp-demo-board__prompt">{config.prompt}</p>

        <div className="lp-demo-board__options onboarding-warmup-options">
          {config.cards.map((card, i) => (
            <div
              key={i}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              className={`lp-demo-opt onboarding-warmup-opt ${auto ? "" : interactiveCardClass(i)}`}
              style={{ ["--card-color" as string]: card.color }}
              role={auto ? undefined : "button"}
              tabIndex={auto ? undefined : 0}
              aria-label={auto ? undefined : `Option ${i + 1}`}
              onClick={auto ? undefined : () => setPicked(i)}
              onKeyDown={
                auto
                  ? undefined
                  : (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setPicked(i);
                      }
                    }
              }
            >
              <span
                className="onboarding-warmup-specimen"
                style={{ fontFamily: card.family }}
              >
                {card.word}
              </span>
            </div>
          ))}
        </div>

        {auto ? (
          <p className="lp-demo-board__feedback" ref={feedbackRef} data-state="idle">
            &nbsp;
          </p>
        ) : (
          <p className="lp-demo-board__feedback" data-state={interactiveState} aria-live="polite">
            {interactiveFeedback}
          </p>
        )}

        {auto ? (
          <div className="lp-ghost-cursor" ref={cursorRef} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="23" height="23">
              <path d="M4.5 2.5l15 8.4-6.6 1.4-3.4 6.7-5-16.5z" />
            </svg>
          </div>
        ) : null}
      </div>

      {auto ? (
        <p className="onboarding-warmup-hint">Watch one round play out — then start your own.</p>
      ) : null}
    </div>
  );
}
