"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollHint from "@/components/ui/ScrollHint";
import ScrollMascot from "@/components/ui/ScrollMascot";
import ThemeSwitch from "@/components/ui/ThemeSwitch";

type ReelFontKind = "sans" | "serif" | "mono" | "display" | "condensed" | "round";

type ReelItem = {
  word: string;
  kind: ReelFontKind;
};

const BLOCK4_REEL_ITEMS: ReelItem[] = [
  { word: "ALPHABET", kind: "sans" },
  { word: "STRUCTURE", kind: "serif" },
  { word: "GLYPHES", kind: "mono" },
  { word: "CONTRASTE", kind: "display" },
  { word: "RHYTHME", kind: "condensed" },
  { word: "PROPORTION", kind: "round" },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function Gate() {
  const choiceActionsRef = useRef<HTMLDivElement>(null);
  const notNowButtonRef = useRef<HTMLButtonElement>(null);
  const block4SectionRef = useRef<HTMLElement>(null);
  const block4TrackRef = useRef<HTMLDivElement>(null);
  const block5SectionRef = useRef<HTMLElement>(null);
  const block5LetterRef = useRef<SVGSVGElement>(null);
  const block5GuidesRef = useRef<SVGSVGElement>(null);
  const [block4Index, setBlock4Index] = useState(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.set(".scroll-hint", { autoAlpha: 1 });
      const hint = document.querySelector<HTMLElement>(".scroll-hint");
      if (hint) {
        hint.classList.remove("scroll-hint--dark");
      }

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reducedMotion) {
        gsap.set(".block-2-copy", { autoAlpha: 1 });
      } else {
        gsap.fromTo(
          ".block-2-copy",
          { autoAlpha: 0, y: 16, filter: "blur(2px)" },
          {
            autoAlpha: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: {
              trigger: ".block-2-copy",
              start: "top 68%",
              toggleActions: "play none none reverse",
              markers: false,
            },
          }
        );
      }
    });

    ScrollTrigger.refresh();

    return () => {
      ctx.revert();
    };
  }, []);

  useEffect(() => {
    const section = block4SectionRef.current;
    const track = block4TrackRef.current;
    if (!section || !track) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    let idleTimeout: number | null = null;
    let settleTimeout: number | null = null;
    let cancelled = false;
    let isActive = false;
    const idleDurationMs = 1500;
    const leadInDurationMs = 420;

    const clearIdleTimeout = () => {
      if (idleTimeout === null) return;
      window.clearTimeout(idleTimeout);
      idleTimeout = null;
    };

    const clearSettleTimeout = () => {
      if (settleTimeout === null) return;
      window.clearTimeout(settleTimeout);
      settleTimeout = null;
    };

    const finalizeSpin = () => {
      if (cancelled) return;
      if (!track.classList.contains("is-spinning")) return;

      clearSettleTimeout();
      // Commit the next pair before resetting transform to avoid a visible snap.
      flushSync(() => {
        setBlock4Index((prev) => (prev + 1) % BLOCK4_REEL_ITEMS.length);
      });
      track.classList.remove("is-spinning");
      if (isActive) {
        queueSpin(idleDurationMs);
      }
    };

    const spin = () => {
      if (cancelled || !isActive) return;
      if (track.classList.contains("is-spinning")) return;

      track.classList.add("is-spinning");
      clearSettleTimeout();
      settleTimeout = window.setTimeout(finalizeSpin, 470);
    };

    const queueSpin = (delayMs: number) => {
      clearIdleTimeout();
      idleTimeout = window.setTimeout(spin, delayMs);
    };

    const handleTransitionEnd = (event: TransitionEvent) => {
      if (cancelled) return;
      if (event.target !== track) return;
      if (!event.propertyName.includes("transform")) return;
      finalizeSpin();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const nextActive = entry.isIntersecting && entry.intersectionRatio >= 0.45;
        if (nextActive === isActive) return;

        isActive = nextActive;

        if (isActive) {
          queueSpin(leadInDurationMs);
          return;
        }

        clearIdleTimeout();
        clearSettleTimeout();
        track.classList.remove("is-spinning");
      },
      {
        threshold: [0, 0.45, 0.9],
      }
    );

    track.addEventListener("transitionend", handleTransitionEnd);
    observer.observe(section);

    return () => {
      cancelled = true;
      clearIdleTimeout();
      clearSettleTimeout();
      observer.disconnect();
      track.removeEventListener("transitionend", handleTransitionEnd);
      track.classList.remove("is-spinning");
    };
  }, []);

  const currentBlock4Item = BLOCK4_REEL_ITEMS[block4Index];
  const nextBlock4Item = BLOCK4_REEL_ITEMS[(block4Index + 1) % BLOCK4_REEL_ITEMS.length];

  useEffect(() => {
    const choiceActions = choiceActionsRef.current;
    const notNowButton = notNowButtonRef.current;
    if (!choiceActions || !notNowButton) return;
    const leaveTarget = (choiceActions.closest(".choice-panel") as HTMLElement | null)
      ?? choiceActions;

    const allowsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!allowsHover || reducedMotion) return;

    const offsets = [
      { x: 132, y: -34, rotation: -3.2 },
      { x: -132, y: 34, rotation: 3.2 },
      { x: 154, y: 10, rotation: -2.2 },
      { x: -154, y: -10, rotation: 2.2 },
    ] as const;
    let offsetIndex = 0;

    const animateTo = (
      x: number,
      y: number,
      rotation: number,
      duration = 0.24,
      withKick = false
    ) => {
      gsap.killTweensOf(notNowButton);

      if (withKick) {
        const kickFactor = 1.14;
        gsap
          .timeline({ defaults: { overwrite: true } })
          .to(notNowButton, {
            x: x * kickFactor,
            y: y * kickFactor,
            rotation: rotation * 1.15,
            duration: duration * 0.48,
            ease: "power4.out",
          })
          .to(notNowButton, {
            x,
            y,
            rotation,
            duration: duration * 0.52,
            ease: "back.out(2.4)",
          });
        return;
      }

      gsap.to(notNowButton, {
        x,
        y,
        rotation,
        duration,
        ease: "power3.out",
        overwrite: true,
      });
    };

    const handlePointerEnter = () => {
      offsetIndex = (offsetIndex + 1) % offsets.length;
      const target = offsets[offsetIndex];
      animateTo(target.x, target.y, target.rotation, 0.24, true);
    };

    const handlePointerDown = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      offsetIndex = (offsetIndex + 1) % offsets.length;
      const target = offsets[offsetIndex];
      animateTo(target.x, target.y, target.rotation, 0.18, true);
    };

    const handleLeave = () => {
      animateTo(0, 0, 0, 0.34, false);
    };

    leaveTarget.addEventListener("pointerleave", handleLeave);
    notNowButton.addEventListener("pointerenter", handlePointerEnter);
    notNowButton.addEventListener("pointerdown", handlePointerDown);

    return () => {
      leaveTarget.removeEventListener("pointerleave", handleLeave);
      notNowButton.removeEventListener("pointerenter", handlePointerEnter);
      notNowButton.removeEventListener("pointerdown", handlePointerDown);
      gsap.set(notNowButton, { x: 0, y: 0, rotation: 0 });
    };
  }, []);

  useEffect(() => {
    const section = block5SectionRef.current;
    const letter = block5LetterRef.current;
    const guidesSvg = block5GuidesRef.current;
    if (!section || !letter || !guidesSvg) return;

    const ctx = gsap.context(() => {
      const targets = Array.from(
        guidesSvg.querySelectorAll<SVGGeometryElement>("[data-guide-draw]")
      );
      if (targets.length === 0) return;

      const drawableTargets: Array<{ target: SVGGeometryElement; length: number }> = [];

      targets.forEach((target) => {
        try {
          const length = target.getTotalLength();
          if (!Number.isFinite(length) || length <= 0) return;
          drawableTargets.push({ target, length });
          gsap.set(target, {
            strokeDasharray: `${length} ${length}`,
            strokeDashoffset: length,
            opacity: 0,
            visibility: "hidden",
          });
        } catch {
          // Ignore rare non-measurable nodes.
        }
      });

      const applyProgress = (progress: number) => {
        const clamped = clamp(progress, 0, 1);
        const visible = clamped > 0.001 ? "visible" : "hidden";

        drawableTargets.forEach(({ target, length }) => {
          gsap.set(target, {
            strokeDashoffset: length * (1 - clamped),
            opacity: clamped,
            visibility: visible,
          });
        });
      };

      let rafId: number | null = null;
      let startScroll = 0;
      let endScroll = 1;

      const computeThresholds = () => {
        const scrollY = window.scrollY;
        const viewportHeight = window.innerHeight;

        const letterRect = letter.getBoundingClientRect();
        const letterTopAbs = scrollY + letterRect.top;
        startScroll = letterTopAbs - viewportHeight * 0.85;

        const letterRectTop = letterRect.top;
        const letterCenterAbs = scrollY + letterRectTop + letterRect.height / 2;
        endScroll = letterCenterAbs - viewportHeight / 2;

        if (endScroll <= startScroll + 1) {
          endScroll = startScroll + 1;
        }
      };

      const syncProgressWithScroll = () => {
        computeThresholds();
        const scrollY = window.scrollY;
        const progress = (scrollY - startScroll) / (endScroll - startScroll);
        applyProgress(progress);
      };

      const scheduleSync = () => {
        if (rafId !== null) return;
        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          syncProgressWithScroll();
        });
      };

      const handleResize = () => {
        scheduleSync();
      };

      computeThresholds();
      window.addEventListener("scroll", scheduleSync, { passive: true });
      window.addEventListener("resize", handleResize);
      scheduleSync();

      return () => {
        window.removeEventListener("scroll", scheduleSync);
        window.removeEventListener("resize", handleResize);
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
        }
      };
    }, section);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <div>
      <svg className="morph-filters" aria-hidden="true" focusable="false">
        <defs>
          <filter id="threshold">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 25 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      <ScrollHint />
      <ThemeSwitch />
      <ScrollMascot />

      <div
        className="block-1"
        style={{
          position: "relative",
          minHeight: "100svh",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          paddingInline: "clamp(0.75rem, 2vw, 2rem)",
        }}
      >
        <h1 className="block-1-hero" aria-label="LOOK CLOSER">
          <span className="block-1-hero__look" aria-hidden="true">LOOK</span>
          <span className="block-1-hero__closer-wrap" aria-hidden="true">
            <span className="block-1-hero__closer">CLOSER</span>
          </span>
        </h1>
      </div>

      <section className="section block-2">
        <div className="section-copy section-copy-centered">
          <h2
            className="section-title block-2-morph"
            aria-label="WHAT TO EXPECT AND HOW TO PLAY"
          >
            <span className="block-2-morph-rotator" aria-hidden="true">
              <span className="block-2-morph-word block-2-morph-word--solid">
                WHAT TO EXPECT
              </span>
              <span className="block-2-morph-word block-2-morph-word--muted">
                HOW TO PLAY
              </span>
              <span className="block-2-morph-word block-2-morph-word--solid">
                WHAT TO EXPECT
              </span>
            </span>
          </h2>
          <p className="block-2-copy">
            <span className="block-2-copy-muted">
              You are shown a typeface sample.
            </span>{" "}
            <span className="block-2-copy-strong">
              Several answers appear on screen.
            </span>
            <br />
            <span className="block-2-copy-muted">
              Some look similar. That&apos;s the point. What matters is reading
              structure, not guessing fast.
            </span>
            <br />
            <span className="block-2-copy-strong">
              Now trust your eye and choose with confidence.
            </span>
          </p>
        </div>
      </section>

      <section className="section block-3">
        <div className="section-copy section-copy-centered choice-panel">
          <h2 className="section-title choice-question">
            Want to see how it works?
          </h2>
          <div
            className="choice-actions"
            role="group"
            aria-label="Experience choice"
            ref={choiceActionsRef}
          >
            <Link href="/onboarding" className="choice-btn choice-btn--yes">
              Yes
            </Link>
            <button
              type="button"
              className="choice-btn choice-btn--no"
              ref={notNowButtonRef}
            >
              Not now
            </button>
          </div>
        </div>
      </section>

      <section className="section block-4" ref={block4SectionRef}>
        <div className="block-4-shell">
          <p className="block-4-copy">
            This reel mirrors the learning loop.
            <br />
            Confused styles return sooner; recognized styles return later.
          </p>
          <div className="block-4-reel" aria-live="polite">
            <div className="block-4-reel-track" ref={block4TrackRef}>
              <div className={`block-4-reel-word block-4-reel-word--${currentBlock4Item.kind}`}>
                <span className="block-4-reel-word-label">{currentBlock4Item.word}</span>
              </div>
              <div className={`block-4-reel-word block-4-reel-word--${nextBlock4Item.kind}`}>
                <span className="block-4-reel-word-label">{nextBlock4Item.word}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section block-5" ref={block5SectionRef}>
        <div className="block-5-shell">
          <p className="block-5-copy">
            The construction of a letter can be read before it is named.
            <br />
            Follow the guides and watch the structure appear.
          </p>

          <div
            className="block-5-lockup"
            role="img"
            aria-label="Letter A with construction guides"
          >
            <svg
              ref={block5LetterRef}
              className="block-5-a"
              fill="none"
              preserveAspectRatio="xMidYMid meet"
              viewBox="0 0 305 344"
            >
              <path
                d="M0,341.5L87,0h120.5l86.5,341.5h-69l-19-69h-119.5l-18,69H0ZM97.5,217h98.5l-38.5-161h-21l-39,161Z"
                fill="currentColor"
                transform="translate(5.75 1.72)"
              />
            </svg>

            <svg
              ref={block5GuidesRef}
              aria-hidden="true"
              className="block-5-guides"
              fill="none"
              preserveAspectRatio="xMidYMid meet"
              viewBox="0 0 305 344"
            >
              <g data-guide-group="frame">
                <rect data-guide-draw="frame" height="341.16" stroke="#f4f3ee" width="304" x="0.5" y="1.72" />
                <rect data-guide-draw="frame" height="171.91" stroke="#f4f3ee" width="304" x="0.5" y="1.72" />
                <line data-guide-draw="frame" stroke="#f4f3ee" x1="0.5" x2="304.5" y1="173.63" y2="173.63" />
              </g>

              <g data-guide-group="inner">
                <rect data-guide-draw="inner" height="171.91" stroke="#e5e5e5" width="207.17" x="48.91" y="1.72" />
                <rect data-guide-draw="inner" height="169.28" stroke="#e5e5e5" width="207.17" x="48.91" y="173.63" />
              </g>

              <g data-guide-group="ellipses">
                <path
                  data-guide-draw="ellipse"
                  d="M152.5,173.36c34.15,0,65.05,9.52,87.4,24.88,22.35,15.37,36.1,36.54,36.1,59.88s-13.75,44.51-36.1,59.88c-22.35,15.36-53.24,24.88-87.4,24.88s-65.05-9.52-87.4-24.88c-22.35-15.37-36.1-36.54-36.1-59.88s13.75-44.51,36.1-59.88c22.35-15.36,53.24-24.88,87.4-24.88Z"
                  stroke="#d4d4d4"
                />
                <path
                  data-guide-draw="ellipse"
                  d="M152.5,1.43c34.04,0,64.9,19.03,87.28,49.9,22.37,30.86,36.22,73.52,36.22,120.67s-13.85,89.81-36.22,120.67c-22.37,30.86-53.24,49.9-87.28,49.9s-64.9-19.03-87.28-49.9c-22.37-30.86-36.22-73.52-36.22-120.67s13.85-89.81,36.22-120.67C87.6,20.47,118.46,1.43,152.5,1.43Z"
                  stroke="#e5e5e5"
                />
                <path
                  data-guide-draw="ellipse"
                  d="M152,1.72c34.15,0,65.05,9.64,87.4,25.19,22.35,15.56,36.1,37,36.1,60.63s-13.76,45.07-36.1,60.63c-22.35,15.56-53.24,25.19-87.4,25.19s-65.05-9.64-87.4-25.19c-22.35-15.56-36.1-37-36.1-60.63s13.76-45.07,36.1-60.63C86.95,11.36,117.85,1.72,152,1.72Z"
                  stroke="#f4f3ee"
                />
              </g>

              <g data-guide-group="diagonal">
                <line data-guide-draw="diagonal" stroke="#f4f3ee" x1="92.48" x2="74.29" y1="1.96" y2="342.88" />
                <line data-guide-draw="diagonal" stroke="#f4f3ee" x1="212.65" x2="74.18" y1="1.71" y2="342.91" />
                <line data-guide-draw="diagonal" stroke="#f4f3ee" x1="92.59" x2="298.81" y1="2.32" y2="342.97" />
                <line data-guide-draw="diagonal" stroke="#f4f3ee" x1="92.58" x2="230.95" y1="1.96" y2="342.85" />
                <line data-guide-draw="diagonal" stroke="#f4f3ee" x1="92.47" x2="6.4" y1="1.34" y2="342.82" />
                <line data-guide-draw="diagonal" stroke="#f4f3ee" x1="212.41" x2="6.24" y1="2.32" y2="342.88" />
                <line data-guide-draw="diagonal" stroke="#f4f3ee" x1="212.56" x2="230.71" y1="1.75" y2="342.88" />
                <line data-guide-draw="diagonal" stroke="#f4f3ee" x1="212.53" x2="298.6" y1="1.34" y2="342.76" />
              </g>
            </svg>
          </div>
        </div>
      </section>

      <div className="page-scroll-runway" aria-hidden="true" />

    </div>
  );
}
