"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * Block 2 demo — the game board, auto-played by a ghost cursor:
 * it moves to a wrong option (flashes red), then to the correct one
 * (turns green), looping. Demonstrates the mechanic without the user
 * having to play. Plays only while in view; respects reduced-motion.
 */

const OPTIONS = ["Playfair Display", "PT Serif", "Libre Baskerville", "Lora"];
const CORRECT = 2;
const WRONG = 0;
const CARD_COLORS = ["#8ea2ff", "#67d6b6", "#f5bf6a", "#f39ab1"];

export default function GhostCursorDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const root = rootRef.current;
    const cursor = cursorRef.current;
    const fb = feedbackRef.current;
    if (!root || !cursor) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const clearStates = () =>
      optionRefs.current.forEach((el) => el?.classList.remove("is-wrong", "is-correct"));
    const mark = (idx: number, cls: string) => optionRefs.current[idx]?.classList.add(cls);
    const setFeedback = (text: string, state: string) => {
      if (!fb) return;
      fb.textContent = text;
      fb.dataset.state = state;
    };

    if (reduced) {
      mark(CORRECT, "is-correct");
      setFeedback("Correct — Libre Baskerville", "correct");
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
      const wrong = centerOf(WRONG);
      const correct = centerOf(CORRECT);
      gsap.set(cursor, { x: root.clientWidth * 0.52, y: root.clientHeight * 0.94, autoAlpha: 0, scale: 1 });

      tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
      tl.to(cursor, { autoAlpha: 1, duration: 0.3 })
        .to(cursor, { x: wrong.x, y: wrong.y, duration: 0.85, ease: "power2.inOut" })
        .to(cursor, {
          scale: 0.86,
          duration: 0.11,
          yoyo: true,
          repeat: 1,
          onStart: () => {
            mark(WRONG, "is-wrong");
            setFeedback("Not quite — look again.", "wrong");
          },
        })
        .to({}, { duration: 0.95 })
        .add(() => {
          clearStates();
          setFeedback(" ", "idle");
        })
        .to(cursor, { x: correct.x, y: correct.y, duration: 0.7, ease: "power2.inOut" })
        .to(cursor, {
          scale: 0.86,
          duration: 0.11,
          yoyo: true,
          repeat: 1,
          onStart: () => {
            mark(CORRECT, "is-correct");
            setFeedback("Correct — Libre Baskerville.", "correct");
          },
        })
        .to({}, { duration: 1.6 })
        .to(cursor, { autoAlpha: 0, duration: 0.35 })
        .add(() => {
          clearStates();
          setFeedback(" ", "idle");
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
  }, []);

  return (
    <div className="lp-demo-board" ref={rootRef}>
      <p className="lp-demo-board__prompt">Which typeface is this?</p>
      <div className="lp-demo-board__word" style={{ fontFamily: "JDT__libre_baskerville" }}>
        Aperture
      </div>
      <div className="lp-demo-board__options">
        {OPTIONS.map((label, i) => (
          <div
            key={label}
            ref={(el) => {
              optionRefs.current[i] = el;
            }}
            className="lp-demo-opt"
            style={{ ["--card-color" as string]: CARD_COLORS[i] }}
          >
            <span className="lp-demo-opt__label">{label}</span>
          </div>
        ))}
      </div>
      <p className="lp-demo-board__feedback" ref={feedbackRef} data-state="idle">
        &nbsp;
      </p>

      <div className="lp-ghost-cursor" ref={cursorRef} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="23" height="23">
          <path d="M4.5 2.5l15 8.4-6.6 1.4-3.4 6.7-5-16.5z" />
        </svg>
      </div>
    </div>
  );
}
