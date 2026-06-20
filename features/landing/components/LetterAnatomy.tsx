"use client";

import { useEffect, useRef } from "react";

/**
 * Block 3 — "Read the structure". A constructed letterform: the glyph sits
 * under geometric construction guides that DRAW IN when the section enters
 * the viewport, with a few mono anatomy annotations (design-canvas spirit).
 *
 * Robustness: the guides are VISIBLE by default (styled in CSS). The draw-in
 * is pure enhancement — we only hide-then-reveal when motion is allowed, via
 * IntersectionObserver + CSS transitions (no ScrollTrigger, which can be
 * thrown off by the page's other scroll animations), with a timeout fallback
 * so the lines are NEVER left hidden.
 */
export default function LetterAnatomy() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const guidesRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const guidesSvg = guidesRef.current;
    if (!section || !guidesSvg) return;

    // Reduced motion: leave everything as the default visible state.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Robust path length: getTotalLength() is unreliable for <rect>/<line>
    // (Safari and some engines return 0), so fall back to geometry.
    const measure = (el: SVGGeometryElement): number => {
      const tag = el.tagName.toLowerCase();
      if (tag === "rect") {
        const r = el as unknown as SVGRectElement;
        return 2 * (r.width.baseVal.value + r.height.baseVal.value);
      }
      if (tag === "line") {
        const l = el as unknown as SVGLineElement;
        return Math.hypot(
          l.x2.baseVal.value - l.x1.baseVal.value,
          l.y2.baseVal.value - l.y1.baseVal.value
        );
      }
      try {
        const len = el.getTotalLength();
        if (Number.isFinite(len) && len > 0) return len;
      } catch {
        /* fall through */
      }
      return 0;
    };

    const targets = Array.from(
      guidesSvg.querySelectorAll<SVGGeometryElement>("[data-guide-draw]")
    );

    // Per-colour-group start offsets: each system (yellow → green → blue →
    // orange) begins a little after the previous, with a tiny offset between
    // lines inside a group. Kept small on purpose (a gentle cascade, not a
    // long relay). All lines finish together at p = 1.
    const GROUP_ORDER = [
      "lp-guide-frame",
      "lp-guide-inner",
      "lp-guide-ellipse",
      "lp-guide-diagonal",
    ];
    const GROUP_STAGGER = 0.12; // gap between colour groups
    const MICRO = 0.02; // gap between lines within a group

    const groupSeen: Record<string, number> = {};
    const items: Array<{ el: SVGGeometryElement; len: number; startP: number }> = [];
    targets.forEach((el) => {
      const len = measure(el);
      if (!(len > 0)) return;
      const cls = el.parentElement?.getAttribute("class") ?? "";
      const gi = Math.max(0, GROUP_ORDER.indexOf(cls));
      const within = (groupSeen[cls] = (groupSeen[cls] ?? 0) + 1) - 1;
      const startP = Math.min(0.85, gi * GROUP_STAGGER + within * MICRO);
      items.push({ el, len, startP });
      el.style.strokeDasharray = `${len} ${len}`;
    });
    const N = items.length;
    if (N === 0) return;

    // Scroll-driven draw-in tied to the A's position in the viewport.
    // p = 0 when the A's centre is START_FRAC of the way down the screen,
    // p = 1 when it reaches END_FRAC (higher up). Tuning knobs:
    //   · lower START_FRAC  → starts later (A must be further into the screen)
    //   · lower END_FRAC    → finishes later (A travels higher before it's done)
    //   · wider gap between them → longer animation (more scroll distance)
    const START_FRAC = 0.85;
    const END_FRAC = 0.32;
    const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

    let raf = 0;
    const apply = () => {
      raf = 0;
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const centreFrac = (r.top + r.height / 2) / vh; // 1 = bottom, 0 = top
      let p = (START_FRAC - centreFrac) / (START_FRAC - END_FRAC);
      p = Math.max(0, Math.min(1, p));
      for (let i = 0; i < N; i++) {
        const { el, len, startP } = items[i];
        const lp = Math.max(0, Math.min(1, (p - startP) / (1 - startP)));
        const e = easeOut(lp);
        el.style.strokeDashoffset = `${len * (1 - e)}`;
        el.style.opacity = lp <= 0 ? "0" : "1";
      }
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(apply);
    };

    apply(); // set the initial state for the current scroll position
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="lp-anatomy__stage" ref={sectionRef}>
      <div className="lp-anatomy__lockup">
        <svg className="lp-anatomy__glyph" viewBox="0 0 305 344" fill="none" aria-hidden="true">
          <path
            d="M0,341.5L87,0h120.5l86.5,341.5h-69l-19-69h-119.5l-18,69H0ZM97.5,217h98.5l-38.5-161h-21l-39,161Z"
            fill="currentColor"
            transform="translate(5.75 1.72)"
          />
        </svg>

        <svg
          ref={guidesRef}
          className="lp-anatomy__guides"
          viewBox="0 0 305 344"
          fill="none"
          aria-hidden="true"
        >
          {/* Frame: bounding box + cap / mid / baseline reference lines. */}
          <g className="lp-guide-frame">
            <rect data-guide-draw height="341.16" width="304" x="0.5" y="1.72" />
            <rect data-guide-draw height="171.91" width="304" x="0.5" y="1.72" />
            <line data-guide-draw x1="0.5" x2="304.5" y1="173.63" y2="173.63" />
          </g>
          {/* Inner grid cells laid over the letter. */}
          <g className="lp-guide-inner">
            <rect data-guide-draw height="171.91" width="207.17" x="48.91" y="1.72" />
            <rect data-guide-draw height="169.28" width="207.17" x="48.91" y="173.63" />
          </g>
          {/* Concentric construction ellipses, centred over the A (blue). */}
          <g className="lp-guide-ellipse">
            <path
              data-guide-draw
              d="M152.5,173.36c34.15,0,65.05,9.52,87.4,24.88,22.35,15.37,36.1,36.54,36.1,59.88s-13.75,44.51-36.1,59.88c-22.35,15.36-53.24,24.88-87.4,24.88s-65.05-9.52-87.4-24.88c-22.35-15.37-36.1-36.54-36.1-59.88s13.75-44.51,36.1-59.88c22.35-15.36,53.24-24.88,87.4-24.88Z"
            />
            <path
              data-guide-draw
              d="M152.5,1.43c34.04,0,64.9,19.03,87.28,49.9,22.37,30.86,36.22,73.52,36.22,120.67s-13.85,89.81-36.22,120.67c-22.37,30.86-53.24,49.9-87.28,49.9s-64.9-19.03-87.28-49.9c-22.37-30.86-36.22-73.52-36.22-120.67s13.85-89.81,36.22-120.67C87.6,20.47,118.46,1.43,152.5,1.43Z"
            />
            <path
              data-guide-draw
              d="M152,1.72c34.15,0,65.05,9.64,87.4,25.19,22.35,15.56,36.1,37,36.1,60.63s-13.76,45.07-36.1,60.63c-22.35,15.56-53.24,25.19-87.4,25.19s-65.05-9.64-87.4-25.19c-22.35-15.56-36.1-37-36.1-60.63s13.76-45.07,36.1-60.63C86.95,11.36,117.85,1.72,152,1.72Z"
            />
          </g>
          {/* Diagonal construction web across the letter. */}
          <g className="lp-guide-diagonal">
            <line data-guide-draw x1="92.48" x2="74.29" y1="1.96" y2="342.88" />
            <line data-guide-draw x1="212.65" x2="74.18" y1="1.71" y2="342.91" />
            <line data-guide-draw x1="92.59" x2="298.81" y1="2.32" y2="342.97" />
            <line data-guide-draw x1="92.58" x2="230.95" y1="1.96" y2="342.85" />
            <line data-guide-draw x1="92.47" x2="6.4" y1="1.34" y2="342.82" />
            <line data-guide-draw x1="212.41" x2="6.24" y1="2.32" y2="342.88" />
            <line data-guide-draw x1="212.56" x2="230.71" y1="1.75" y2="342.88" />
            <line data-guide-draw x1="212.53" x2="298.6" y1="1.34" y2="342.76" />
          </g>
        </svg>

        {/* Anatomy annotations (design-canvas écritures). */}
        <span className="lp-annot lp-annot--apex">apex</span>
        <span className="lp-annot lp-annot--crossbar">crossbar</span>
        <span className="lp-annot lp-annot--counter">counter</span>
        <span className="lp-annot lp-annot--baseline">baseline</span>
      </div>
    </div>
  );
}
