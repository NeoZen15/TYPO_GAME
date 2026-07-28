"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { getTypefaceFontFamily } from "@/lib/game/training/catalog";
import { getWarmupRound, type WarmupRound } from "@/features/onboarding/warmup-rounds";

// ---------------------------------------------------------------------------
// Adaptive warm-up — "A first look", built on the LANDING demo's exact recipe
// (GhostCursorDemo + lp-demo stage): a big hero specimen + two crafted option
// cards on a lit, tilting stage. Branches on the declared familiarity:
//   • "Not at all"  → GHOST-CURSOR demo: the cursor plays the round, you watch.
//   • "A little" / "Quite familiar" / "Designer" → playable read; the exact
//     question climbs a difficulty ladder (round data in warmup-rounds.ts).
//
// The cards are NAMED (Serif / Sans-serif…) but carry a plain-language hint
// ("little feet" / "clean ends") so a beginner can answer by LOOKING at the
// hero — no vocabulary required. Real catalog faces (JDT__<slug>).
// ---------------------------------------------------------------------------

type Props = {
  familiarity: string;
  // `resolved` gates the Continue button (unchanged). `correct` carries whether
  // the played round was answered correctly, so an advanced declarer who fails
  // the warm-up can be redescended one notch by the seeding (see provider
  // effectiveFamiliarity). `null` = not answered / auto ghost-demo (no downgrade).
  onResolvedChange: (resolved: boolean, correct: boolean | null) => void;
};

export default function OnboardingWarmup({ familiarity, onResolvedChange }: Props) {
  const auto = familiarity === "Not at all";
  // Round is generated once per mount (the parent remounts on familiarity change).
  const [round] = useState<WarmupRound>(() => getWarmupRound(familiarity));
  const family = useMemo(() => getTypefaceFontFamily(round.familySlug, round.familyName), [round]);

  const rootRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    if (auto) {
      // Ghost-cursor demo (beginner): nothing to grade, and beginners are never
      // downgraded, so correctness is null.
      onResolvedChange(true, null);
      return;
    }
    onResolvedChange(picked !== null, picked === null ? null : picked === round.correctIndex);
  }, [auto, picked, round.correctIndex, onResolvedChange]);

  // Pointer tilt + studio light — GARDÉ uniquement pour le mode débutant (auto :
  // on le regarde, pas de clic), RETIRÉ sur les modes jouables où les cartes
  // doivent lire comme des boutons à cliquer. Skipped under reduced-motion.
  useEffect(() => {
    if (!auto) return;
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const stage = root.parentElement; // the .lp-demo-stagewrap (holds --gx/--gy)
    const tiltX = gsap.quickTo(root, "rotationX", { duration: 0.5, ease: "power3" });
    const tiltY = gsap.quickTo(root, "rotationY", { duration: 0.5, ease: "power3" });

    const onTilt = (event: PointerEvent) => {
      const r = root.getBoundingClientRect();
      const px = (event.clientX - r.left) / r.width - 0.5;
      const py = (event.clientY - r.top) / r.height - 0.5;
      tiltX(-py * 12);
      tiltY(px * 12);
      if (stage) {
        stage.style.setProperty("--gx", `${50 + px * 22}%`);
        stage.style.setProperty("--gy", `${42 + py * 22}%`);
      }
    };
    const onLeave = () => {
      tiltX(0);
      tiltY(0);
      if (stage) {
        stage.style.setProperty("--gx", "50%");
        stage.style.setProperty("--gy", "42%");
      }
    };

    root.addEventListener("pointermove", onTilt);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      gsap.killTweensOf(root);
      root.removeEventListener("pointermove", onTilt);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [auto]);

  // Ghost-cursor auto-demo (discover tier) — mirrors the landing GhostCursorDemo.
  useEffect(() => {
    if (!auto) return;
    const root = rootRef.current;
    const cursor = cursorRef.current;
    const fb = feedbackRef.current;
    if (!root || !cursor) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const correct = round.correctIndex;
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
      setFeedback(round.reveal, "correct");
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
      gsap.set(cursor, { x: root.clientWidth * 0.5, y: root.clientHeight * 0.94, autoAlpha: 0, scale: 1 });

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
            setFeedback(round.ghostWrong, "wrong");
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
            setFeedback(round.reveal, "correct");
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
  }, [auto, round]);

  const interactiveCardClass = (idx: number) => {
    if (picked === null) return "";
    if (idx === round.correctIndex) return "is-correct";
    if (idx === picked) return "is-wrong";
    return "";
  };

  const interactiveFeedback =
    picked === null ? " " : picked === round.correctIndex ? round.reveal : "Look again at the letters, then pick.";
  const interactiveState =
    picked === null ? "idle" : picked === round.correctIndex ? "correct" : "wrong";

  return (
    <div className="onboarding-warmup">
      <div className="lp-demo-stagewrap onboarding-warmup-stagewrap">
        <div className="lp-demo-stage" aria-hidden="true" />
        <div className="lp-demo-board onboarding-warmup-board" ref={rootRef} data-tier={auto ? "discover" : "play"}>
          <p className="lp-demo-board__prompt">{round.prompt}</p>

          <div className="lp-demo-board__word" style={{ fontFamily: family }}>
            {round.word}
          </div>

          <div className="lp-demo-board__options">
            {round.options.map((opt, i) => (
              <div
                key={opt.key}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                className={`lp-demo-opt ${auto ? "" : interactiveCardClass(i)}`}
                style={{ ["--card-color" as string]: opt.color }}
                role={auto ? undefined : "button"}
                tabIndex={auto ? undefined : 0}
                aria-label={auto ? undefined : opt.label}
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
                <span className="lp-demo-opt__label">{opt.label}</span>
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
      </div>

      {auto ? (
        <p className="onboarding-warmup-hint">Watch one round play out — then start your own.</p>
      ) : (
        <p className="onboarding-warmup-hint">
          {picked === null
            ? "Your turn — tap the answer you think fits."
            : "Hit Continue when you're ready."}
        </p>
      )}
    </div>
  );
}
