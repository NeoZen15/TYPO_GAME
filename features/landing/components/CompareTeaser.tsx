"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import MeasuredGlyphSplit from "@/components/typography/MeasuredGlyphSplit";

/**
 * Block 4 teaser for /compare. A ghost cursor (block-2 technique) auto-drives
 * the REAL compare view modes — Split → Overlay → Measure — on one pair, so it
 * reads like a live demo of the tool. Overlay reuses the page's superimposed
 * layers; Measure reuses the real measurement engine (MeasuredGlyphSplit).
 * Plays only while in view; respects reduced-motion. Faces use the runtime
 * catalog families (JDT__<slug>), injected once in app/page.tsx.
 */
const PAIR = {
  left: { slug: "libre_baskerville", name: "Libre Baskerville" },
  right: { slug: "montserrat", name: "Montserrat" },
};
const GLYPH = "a";

const MODES = [
  { key: "split", label: "Split" },
  { key: "overlay", label: "Overlay" },
  { key: "measure", label: "Measure" },
] as const;

const family = (slug: string) => `JDT__${slug}`;

export default function CompareTeaser() {
  const [mode, setMode] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const root = rootRef.current;
    const cursor = cursorRef.current;
    if (!root || !cursor) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(cursor, { autoAlpha: 0 });
      return;
    }

    const centerOf = (i: number) => {
      const el = tabRefs.current[i];
      const rr = root.getBoundingClientRect();
      if (!el) return { x: rr.width / 2, y: rr.height / 2 };
      const r = el.getBoundingClientRect();
      return { x: r.left - rr.left + r.width / 2, y: r.top - rr.top + r.height / 2 };
    };

    let tl: gsap.core.Timeline | null = null;
    const build = () => {
      tl?.kill();
      gsap.set(cursor, { x: root.clientWidth * 0.5, y: root.clientHeight * 0.7, autoAlpha: 0, scale: 1 });
      tl = gsap.timeline({ repeat: -1 });
      tl.to(cursor, { autoAlpha: 1, duration: 0.3 });
      [1, 2, 0].forEach((i) => {
        const c = centerOf(i);
        tl!
          .to(cursor, { x: c.x, y: c.y, duration: 0.7, ease: "power2.inOut" })
          .to(cursor, { scale: 0.82, duration: 0.1, yoyo: true, repeat: 1, onStart: () => setMode(i) })
          .to({}, { duration: 2.4 });
      });
    };

    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
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
      { threshold: 0.35 }
    );
    io.observe(root);

    return () => {
      io.disconnect();
      tl?.kill();
      gsap.killTweensOf(cursor);
    };
  }, []);

  const current = MODES[mode].key;
  const shellStyle = {
    "--compare-left-family": family(PAIR.left.slug),
    "--compare-right-family": family(PAIR.right.slug),
  } as CSSProperties;

  return (
    <div className="lp-compare-vis" ref={rootRef} aria-hidden="true">
      <div className="lp-compare-head">
        <span className="lp-compare-kicker">
          {PAIR.left.name} <span className="lp-compare-vs">vs</span> {PAIR.right.name}
        </span>
        <div className="lp-compare-tabs">
          {MODES.map((m, i) => (
            <span
              key={m.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              className={`lp-compare-tab ${i === mode ? "is-active" : ""}`}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <div className="compare-stage-shell lp-compare-shell" style={shellStyle}>
        {/* All three modes stay mounted (stacked); only opacity crossfades, so
            the Measure engine measures once and is always ready. */}
        <div className="lp-compare-modes">
          <div className={`lp-compare-mode ${current === "split" ? "is-active" : ""}`}>
            <div className="lp-compare-split">
              <div className="lp-compare-split__pane">
                <span className="lp-compare-split__glyph" style={{ fontFamily: family(PAIR.left.slug) }}>
                  {GLYPH}
                </span>
                <span className="lp-compare-split__name">{PAIR.left.name}</span>
              </div>
              <span className="lp-compare-split__rule" />
              <div className="lp-compare-split__pane">
                <span className="lp-compare-split__glyph" style={{ fontFamily: family(PAIR.right.slug) }}>
                  {GLYPH}
                </span>
                <span className="lp-compare-split__name">{PAIR.right.name}</span>
              </div>
            </div>
          </div>

          <div className={`lp-compare-mode ${current === "overlay" ? "is-active" : ""}`}>
            <div className="compare-stage-overlay lp-compare-overlay">
              <p className="compare-stage-layer compare-stage-layer--left">{GLYPH}</p>
              <p className="compare-stage-layer compare-stage-layer--right lp-compare-ghost">{GLYPH}</p>
            </div>
          </div>

          <div className={`lp-compare-mode ${current === "measure" ? "is-active" : ""}`}>
            <MeasuredGlyphSplit
              glyph={GLYPH}
              feature="aperture"
              guideLabel="x-height"
              left={{ label: PAIR.left.name, family: family(PAIR.left.slug) }}
              right={{ label: PAIR.right.name, family: family(PAIR.right.slug) }}
              showMeasurements
            />
          </div>
        </div>
      </div>

      <div className="lp-ghost-cursor" ref={cursorRef} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="23" height="23">
          <path d="M4.5 2.5l15 8.4-6.6 1.4-3.4 6.7-5-16.5z" />
        </svg>
      </div>
    </div>
  );
}
