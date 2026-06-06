"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Block 3 — "Read the structure". A constructed letterform: the glyph sits
 * under geometric construction guides that DRAW IN as the section scrolls
 * into view, with a few mono anatomy annotations (design-canvas spirit).
 */
export default function LetterAnatomy() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const guidesRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const guidesSvg = guidesRef.current;
    if (!section || !guidesSvg) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const targets = Array.from(
        guidesSvg.querySelectorAll<SVGGeometryElement>("[data-guide-draw]")
      );

      const drawable: Array<{ el: SVGGeometryElement; len: number }> = [];
      targets.forEach((el) => {
        let len = 0;
        try {
          len = el.getTotalLength();
        } catch {
          len = 0;
        }
        if (!Number.isFinite(len) || len <= 0) return;
        drawable.push({ el, len });
        gsap.set(el, {
          strokeDasharray: `${len} ${len}`,
          strokeDashoffset: reduced ? 0 : len,
          opacity: reduced ? 1 : 0,
        });
      });

      const annots = gsap.utils.toArray<HTMLElement>(".lp-annot");
      if (reduced) {
        gsap.set(annots, { opacity: 1, y: 0 });
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 78%",
          end: "center 52%",
          scrub: 0.8,
        },
      });

      tl.to(
        drawable.map((d) => d.el),
        { strokeDashoffset: 0, opacity: 1, duration: 1, ease: "none", stagger: 0.04 },
        0
      );

      gsap.from(annots, {
        opacity: 0,
        y: 8,
        duration: 0.5,
        stagger: 0.12,
        scrollTrigger: { trigger: section, start: "top 60%" },
      });
    }, section);

    return () => ctx.revert();
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
          <g className="lp-guide-frame">
            <rect data-guide-draw height="341.16" width="304" x="0.5" y="1.72" />
            <line data-guide-draw x1="0.5" x2="304.5" y1="173.63" y2="173.63" />
            <line data-guide-draw x1="0.5" x2="304.5" y1="1.72" y2="1.72" />
            <line data-guide-draw x1="0.5" x2="304.5" y1="342.88" y2="342.88" />
          </g>
          <g className="lp-guide-circle">
            <path
              data-guide-draw
              d="M152.5,1.43c34.04,0,64.9,19.03,87.28,49.9,22.37,30.86,36.22,73.52,36.22,120.67s-13.85,89.81-36.22,120.67c-22.37,30.86-53.24,49.9-87.28,49.9s-64.9-19.03-87.28-49.9c-22.37-30.86-36.22-73.52-36.22-120.67s13.85-89.81,36.22-120.67C87.6,20.47,118.46,1.43,152.5,1.43Z"
            />
          </g>
          <g className="lp-guide-diagonal">
            <line data-guide-draw x1="92.48" x2="74.29" y1="1.96" y2="342.88" />
            <line data-guide-draw x1="212.65" x2="230.95" y1="1.71" y2="342.85" />
            <line data-guide-draw x1="92.59" x2="298.81" y1="2.32" y2="342.97" />
            <line data-guide-draw x1="212.41" x2="6.24" y1="2.32" y2="342.88" />
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
