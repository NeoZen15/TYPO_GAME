"use client";

import { Fragment, useEffect, useRef } from "react";

/**
 * Progression block — "Watch your eye sharpen".
 *
 * The page answers "what" (the game) and "why" (learn to look); this block
 * answers "why I'll come back": visible progress. Instead of a generic stats
 * dashboard, it shows the eye-training *itself* — a wall of real catalog
 * specimens (family = JDT__<slug>). The faces you've mastered are crisp and
 * named; the ones you're still learning stay soft and unlabelled. On scroll-in
 * the whole wall snaps from blur into focus — the headline, enacted.
 *
 * Strictly in the page DA: monochrome (cream type on dark), colour stays out,
 * specimen-driven like the validated /compare & /type pages, on the faint
 * design-canvas grid.
 *
 * Robustness (see feedback-scroll-reveal-default-visible): the final state IS
 * the CSS default (crisp / soft as set in CSS). The blur-in is a pure
 * enhancement, armed by JS only when motion is allowed, revealed by a
 * self-contained IntersectionObserver with a timeout fallback — never gated by
 * a shared trigger, never left hidden.
 */

type Glyph = { char: string; slug: string; name: string; focus: boolean };

// A spread of catalog faces — mastered (focus) vs still-learning (soft).
const WALL: Glyph[] = [
  { char: "a", slug: "montserrat", name: "Montserrat", focus: true },
  { char: "g", slug: "libre_baskerville", name: "Libre Baskerville", focus: true },
  { char: "R", slug: "poppins", name: "Poppins", focus: true },
  { char: "Q", slug: "dm_sans", name: "DM Sans", focus: true },
  { char: "e", slug: "pt_serif", name: "PT Serif", focus: false },
  { char: "&", slug: "roboto", name: "Roboto", focus: true },
  { char: "M", slug: "raleway", name: "Raleway", focus: false },
  { char: "g", slug: "ibm_plex_sans", name: "IBM Plex Sans", focus: false },
];

// The climb across difficulty tiers — read as plain type, not bars.
const TIERS = [
  { label: "Everyday", have: 24, total: 24 },
  { label: "Look-alikes", have: 19, total: 34 },
  { label: "Rare & revivals", have: 9, total: 22 },
];

export default function MasteryClimb() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Reduced motion: leave the CSS-default final state untouched.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Arm: blur everything out / hide the names (instant, no transition).
    root.classList.add("lp-climb--armed");

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      root.classList.add("lp-climb--in");
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(root);

    // Fallback: never leave it armed-but-blurred if the observer never fires.
    const fallback = window.setTimeout(reveal, 3500);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <section ref={rootRef} id="progress" className="lp-section lp-climb" aria-label="Your progress">
      <div className="lp-climb__head">
        <h2 className="lp-section__title">Watch your eye sharpen.</h2>
        <p className="lp-section__lede">
          Every round teaches the next. Faces you miss come back; the ones you
          nail step aside. You climb from the everyday to the genuinely tricky —
          and you can feel it happen.
        </p>
      </div>

      <div className="lp-climb__panel">
        <div className="lp-climb__wall" aria-hidden="true">
          {WALL.map((g, i) => (
            <div key={`${g.slug}-${i}`} className="lp-glyph" data-focus={g.focus ? "true" : "false"}>
              <span className="lp-glyph__char" style={{ fontFamily: `JDT__${g.slug}` }}>
                {g.char}
              </span>
              <span className="lp-glyph__name">{g.focus ? g.name : "?"}</span>
            </div>
          ))}
        </div>

        <div className="lp-climb__tiers" aria-hidden="true">
          {TIERS.map((t, i) => (
            <Fragment key={t.label}>
              {i > 0 && <span className="lp-climb-tier__sep" />}
              <span className="lp-climb-tier">
                <span className="lp-climb-tier__label">{t.label}</span>
                <span className="lp-climb-tier__frac">
                  <em>{t.have}</em>/{t.total}
                </span>
              </span>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
