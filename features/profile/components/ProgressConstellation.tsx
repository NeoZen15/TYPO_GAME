"use client";

import { useEffect, useRef, useState } from "react";
import StarField from "@/features/profile/components/StarField";
import {
  axisXp,
  PALIER_DESC,
  type EyeProfile,
  type PerceptualAxis,
  type PerceptualAxisId,
} from "@/lib/profile/mock-profile";

// ---------------------------------------------------------------------------
// The map of seeing — the DWIGGINS galaxy map (docs/game/handoff-page-parcours.md).
//
// The 8 axes are 8 LETTER-galaxies that spell D·W·I·G·G·I·N·S. Each letter is
// traced by its paliers (stars sampled along the letter's skeleton — the star
// count = the axis's palier count). State is read at a glance:
//   lit → letter drawn & bright · emerging → faint, partly lit · dormant →
//   ghost · roadmap → dashed "uncharted". All 8 lit = the word ignites.
//
// One zoomable screen, the zoom IS the navigation (no vertical scroll):
//   wide  = your progression (the whole word + a compact HUD)
//   zoom  = one galaxy up close (its paliers named, blurb, state, XP)
//
// Non-linear: a lit letter next to a dormant one is normal; the word's order
// (easy→hard) is layout only, lighting is independent.
//
// DA = the landing: cream #e1e1d7 on black, mono labels, visible-by-default
// reveal (armed→in via classList, reduced-motion safe).
// ---------------------------------------------------------------------------

type Pt = [number, number];

// Glyph sampling box. The canvas and the SVG share these numbers 1:1, so a star
// sampled on the rasterised glyph lands exactly on the SVG <text> glyph.
const GX_W = 160; // canvas width (generous so wide caps like W never clip)
const GX_H = 140;
const GX_FS = 112; // glyph font-size (user units / px)
const GX_BASE = 120; // alphabetic baseline (DWIGGINS caps have no descenders)
const GX_CX = 80; // glyph centre x

// axis id → its capital in DWIGGINS (order = the word = difficulty easy→hard).
const AXIS_LETTER: Record<PerceptualAxisId, string> = {
  shape: "D",
  families: "W",
  structure: "I",
  rhythm: "G",
  signatures: "G",
  confusion: "I",
  intention: "N",
  designer: "S",
};

// The whole word is set in ONE real catalog face: Montserrat — the landing
// hero's opening typeface (the first specimen its cycling hero shows at site
// open, HERO_SPECIMENS[0]). Keeps the profile consistent with the main page.
const WORD_FACE = "montserrat";

type GlyphSample = { stars: Pt[]; viewBox: string };

// Farthest-point sampling — picks `n` points spread as widely as possible across
// the candidates, so the palier-stars sit evenly over the whole letterform.
function farthestPoints(pts: Pt[], n: number): Pt[] {
  if (pts.length <= n) return pts.slice();
  // Deterministic start (the topmost point) — stable across renders/SSR.
  let start = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i][1] < pts[start][1]) start = i;
  const chosen: Pt[] = [pts[start]];
  while (chosen.length < n) {
    let best = -1;
    let bestD = -1;
    for (let i = 0; i < pts.length; i++) {
      let d = Infinity;
      for (const c of chosen) {
        const dd = (pts[i][0] - c[0]) ** 2 + (pts[i][1] - c[1]) ** 2;
        if (dd < d) d = dd;
      }
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    chosen.push(pts[best]);
  }
  return chosen;
}

// Rasterise a real glyph and return `n` star positions sitting ON it, plus a
// tight viewBox so the SVG letter keeps its true width (proper word spacing).
function sampleGlyph(letter: string, family: string, n: number): GlyphSample | null {
  const SC = 2; // supersample for a crisp alpha mask
  const w = GX_W * SC;
  const h = GX_H * SC;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#f4f3ee";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${GX_FS * SC}px "${family}"`;
  // Advance width = the glyph's real set width (its own side-bearings included).
  // Cropping the viewBox to it — not to the inked pixels — preserves the font's
  // native spacing, so the letters set as a properly-spaced word.
  const advance = ctx.measureText(letter).width / SC;
  ctx.fillText(letter, GX_CX * SC, GX_BASE * SC);

  const data = ctx.getImageData(0, 0, w, h).data;
  const pts: Pt[] = [];
  const step = 2 * SC;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] > 100) pts.push([x / SC, y / SC]);
    }
  }
  if (!pts.length || !(advance > 0)) return null;
  return {
    stars: farthestPoints(pts, n),
    viewBox: `${(GX_CX - advance / 2).toFixed(1)} 0 ${advance.toFixed(1)} ${GX_H}`,
  };
}

function stateLabel(axis: PerceptualAxis): string {
  if (axis.roadmap) return "Roadmap";
  if (axis.state === "lit") return "Lit";
  if (axis.state === "emerging") return "Emerging";
  return "Dormant";
}
function litCount(axis: PerceptualAxis): number {
  return axis.paliers.filter((p) => p.state === "lit").length;
}
function emergingFocus(eye: EyeProfile): PerceptualAxis | null {
  const e = eye.axes
    .filter((a) => !a.roadmap && a.state === "emerging")
    .sort((a, b) => b.litRatio - a.litRatio);
  return e[0] ?? null;
}
function starR(state: string): number {
  // Sizes kept close to the (well-dosed) roadmap dot so lit/emerging don't shout.
  return state === "lit" ? 2 : state === "emerging" ? 1.9 : state === "roadmap" ? 1.5 : 1.7;
}

// One letter-galaxy: the real glyph (a faint→bright "galaxy body" in the axis's
// own catalog typeface) with the palier-stars sitting on it. `sample` carries
// the rasterised star positions + a tight viewBox (computed once, parent-side).
function LetterGalaxy({ axis, sample }: { axis: PerceptualAxis; sample?: GlyphSample }) {
  const face = WORD_FACE;
  const letter = AXIS_LETTER[axis.id];
  const cls = axis.roadmap ? "roadmap" : axis.state;
  return (
    <svg
      className={`dw-gx dw-gx--${cls}`}
      viewBox={sample?.viewBox ?? `0 0 ${GX_W} ${GX_H}`}
      aria-hidden="true"
    >
      <text
        className="dw-gx__glyph"
        x={GX_CX}
        y={GX_BASE}
        fontSize={GX_FS}
        textAnchor="middle"
        style={{ fontFamily: `"JDT__${face}"` }}
      >
        {letter}
      </text>
      {(sample?.stars ?? []).map((p, i) => {
        const pal = axis.paliers[i];
        if (!pal) return null;
        const st = pal.roadmap ? "roadmap" : pal.state;
        return (
          <circle key={pal.id} className={`dw-star dw-star--${st}`} cx={p[0]} cy={p[1]} r={starR(st)} />
        );
      })}
    </svg>
  );
}

export default function ProgressConstellation({ eye }: { eye: EyeProfile }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState<PerceptualAxisId | null>(null); // hovered/focused (wide)
  const [zoomId, setZoomId] = useState<PerceptualAxisId | null>(null); // zoomed-in galaxy
  const [samples, setSamples] = useState<Record<string, GlyphSample>>({}); // per-axis glyph + stars

  // Reveal (visible-by-default; arm the dark start only when motion is allowed).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("is-armed");
    const reveal = () => root.classList.add("is-in");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(root);
    const fallback = window.setTimeout(reveal, 2600);

    // The "every galaxy" rows below reveal as they scroll into view.
    const rowIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-shown");
            rowIO.unobserve(e.target);
          }
        });
      },
      { threshold: 0.16 },
    );
    root.querySelectorAll(".dw-row, .dw-stage").forEach((r) => rowIO.observe(r));

    return () => {
      io.disconnect();
      rowIO.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  // Rasterise each galaxy's real glyph once the fonts are ready, then place the
  // palier-stars on it (the letters render via font-swap meanwhile).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (typeof document !== "undefined" && document.fonts) {
          await document.fonts.load(`${GX_FS}px "JDT__${WORD_FACE}"`, "DWIGNS").catch(() => {});
        }
      } catch {
        /* ignore — fall back to font-swap glyphs without stars */
      }
      if (cancelled) return;
      const next: Record<string, GlyphSample> = {};
      for (const a of eye.axes) {
        const s = sampleGlyph(AXIS_LETTER[a.id], `JDT__${WORD_FACE}`, a.paliers.length);
        if (s) next[a.id] = s;
      }
      if (!cancelled) setSamples(next);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [eye]);

  // The left HUD floats over the page on wide screens; as content scrolls under
  // it, fade it to near-transparent so it never hides the text, then back to
  // normal once it clears (Marion: "transparent en fondu quand ça passe sur le
  // texte, normal quand on n'est plus dessus").
  useEffect(() => {
    const hud = hudRef.current;
    const root = rootRef.current;
    if (!hud || !root) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      // Only floats (and can overlap) when not statically stacked.
      if (getComputedStyle(hud).position === "static") {
        hud.classList.remove("is-ghost");
        return;
      }
      const h = hud.getBoundingClientRect();
      let over = false;
      // Test the INK-bearing elements (letters, row text, titles) — NOT the wide
      // centred container boxes, whose empty left margin slides under the HUD and
      // would ghost it over blank starfield.
      root
        .querySelectorAll(
          ".dw-letter, .dw-row__viz, .dw-row__info, .dw-intro__title, .dw-intro__lede, .dw-readout, .dw-list__kicker",
        )
        .forEach((el) => {
          if (over) return;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          const ix = Math.min(h.right, r.right) - Math.max(h.left, r.left);
          const iy = Math.min(h.bottom, r.bottom) - Math.max(h.top, r.top);
          if (ix > 10 && iy > 10) over = true;
        });
      hud.classList.toggle("is-ghost", over);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Escape closes the zoom.
  useEffect(() => {
    if (!zoomId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomId]);

  const totalPaliers = eye.axes.reduce((s, a) => s + a.paliers.length, 0);
  const litPaliers = eye.axes.reduce((s, a) => s + litCount(a), 0);
  const litGalaxies = eye.axes.filter((a) => !a.roadmap && a.state === "lit").length;
  const xpPct = Math.round((eye.xpInLevel / eye.xpForNext) * 100);
  const emerging = emergingFocus(eye);
  const active = activeId ? eye.axes.find((a) => a.id === activeId) ?? null : null;
  const zoomed = zoomId ? eye.axes.find((a) => a.id === zoomId) ?? null : null;

  return (
    <div ref={rootRef} className="dw">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── Starfield ── */}
      <div className="dw-bg" aria-hidden="true">
        <StarField />
      </div>

      {/* ── HUD — discreet beige card, top-left. It lives in a full-height
          absolute rail so it can stick to the scroll WITHOUT reserving flow
          space (which would push the centred intro down). Four lines:
          identity · xp+streak · counts · emerging focus. ── */}
      <div className="dw-hud-rail">
        <div className="dw-hud" ref={hudRef}>
        <span className="dw-hud__row">
          <span className="dw-hud__eye">
            <span className="dw-hud__star" aria-hidden="true">
              ✦
            </span>
            {eye.title}
          </span>
          <span className="dw-hud__sep" aria-hidden="true" />
          <span className="dw-hud__lvl">LVL {eye.level}</span>
        </span>
        <span className="dw-hud__row">
          <span className="dw-hud__xp" role="img" aria-label={`${xpPct}% to level ${eye.level + 1}`}>
            <span className="dw-hud__xp-fill" style={{ width: `${xpPct}%` }} />
          </span>
          <span className="dw-hud__xptext">
            {eye.xpInLevel}/{eye.xpForNext}
          </span>
          <span className="dw-hud__sep" aria-hidden="true" />
          <span className="dw-hud__streak">🔥 {eye.streak}</span>
        </span>
        <span className="dw-hud__row">
          <span className="dw-hud__count">
            <em>{litGalaxies}</em>/8 galaxies
          </span>
          <span className="dw-hud__dot" aria-hidden="true">·</span>
          <span className="dw-hud__count">
            <em>{litPaliers}</em>/{totalPaliers} paliers
          </span>
        </span>
        {emerging && (
          <span className="dw-hud__row">
            <span className="dw-hud__emerge">
              emerging&nbsp;: {emerging.label} {litCount(emerging)}/{emerging.paliers.length}
            </span>
          </span>
        )}
        </div>
      </div>

      {/* ── Hero (first screen): intro + word + readout, centred vertically so
          the map breathes. Being ~one viewport tall, it keeps the galaxy list
          below the fold (not seen until you scroll). ── */}
      <div className="dw-hero">
      {/* ── Intro ── */}
      <header className="dw-intro">
        <span className="dw-intro__kicker">Eight galaxies · easy to hard</span>
        <h2 className="dw-intro__title">The map of seeing.</h2>
        <p className="dw-intro__lede">
          Your eight ways of seeing spell <em>DWIGGINS</em> in the sky. Each letter lights on its
          own, in your order — pick one to travel inside it.
        </p>
      </header>
        <button
          type="button"
          className="dw-scrollhint"
          aria-label="Scroll to your map"
          onClick={() =>
            rootRef.current
              ?.querySelector(".dw-stage")
              ?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        >
          <span>Scroll to your map</span>
          <span className="dw-scrollhint__arrow" aria-hidden="true">↓</span>
        </button>
      </div>

      {/* ── The word — revealed lower, on scroll (NOT a double block at the top:
          the title opens the page, you scroll to discover the word). ── */}
      <div className="dw-stage">
        <div className="dw-word">
          {eye.axes.map((axis) => {
            const cls = axis.roadmap ? "roadmap" : axis.state;
            return (
              <button
                key={axis.id}
                type="button"
                className={`dw-letter dw-letter--${cls}${axis.id === activeId ? " is-active" : ""}`}
                onPointerEnter={() => setActiveId(axis.id)}
                onPointerLeave={() => setActiveId(null)}
                onFocus={() => setActiveId(axis.id)}
                onBlur={() => setActiveId(null)}
                onClick={() => setZoomId(axis.id)}
                aria-label={`${axis.label} — ${stateLabel(axis)}. Open`}
              >
                <LetterGalaxy axis={axis} sample={samples[axis.id]} />
                <span className="dw-letter__num">{String(axis.n).padStart(2, "0")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Readout (hovered letter) + caption ── */}
      <div className="dw-foot">
        <p className="dw-readout" aria-live="polite">
          {active ? (
            <>
              <span className={`dw-readout__state dw-readout__state--${active.roadmap ? "roadmap" : active.state}`}>
                {stateLabel(active)}
              </span>
              <span className="dw-readout__name">{active.label}</span>
              <span className="dw-readout__frac">
                {active.roadmap ? "coming soon" : `${litCount(active)}/${active.paliers.length} paliers lit`}
              </span>
            </>
          ) : (
            <span className="dw-readout__hint">
              Eight galaxies, set as <em>DWIGGINS</em> — the letters that give a typeface away. Hover a
              letter, click to enter.
            </span>
          )}
        </p>
      </div>

      {/* ── Every galaxy, up close — each drawn as its own letter ── */}
      <section className="dw-list" aria-label="Every galaxy, up close">
        <p className="dw-list__kicker">Every galaxy, up close</p>
        {eye.axes.map((axis) => {
          const cls = axis.roadmap ? "roadmap" : axis.state;
          return (
            <article key={axis.id} className={`dw-row dw-row--${cls}`}>
              <button
                type="button"
                className="dw-row__viz"
                onClick={() => setZoomId(axis.id)}
                aria-label={`Open ${axis.label}`}
              >
                <LetterGalaxy axis={axis} sample={samples[axis.id]} />
              </button>
              <div className="dw-row__info">
                <span className="dw-row__eyebrow">
                  <span className="dw-row__lvl">Level {String(axis.n).padStart(2, "0")}</span>
                  <span className="dw-row__state">{stateLabel(axis)}</span>
                </span>
                <h3 className="dw-row__name">
                  <button type="button" className="dw-row__link" onClick={() => setZoomId(axis.id)}>
                    {axis.label}
                  </button>
                </h3>
                <p className="dw-row__blurb">{axis.blurb}</p>
                <ul className="dw-row__paliers">
                  {axis.paliers.map((p) => (
                    <li key={p.id} className={`dw-tag dw-tag--${p.roadmap ? "roadmap" : p.state}`}>
                      {p.label}
                    </li>
                  ))}
                </ul>
                <span className="dw-row__stat">
                  {axis.roadmap ? (
                    "Coming soon"
                  ) : (
                    <>
                      <em>{litCount(axis)}</em>/{axis.paliers.length} paliers lit
                      <span className="dw-row__dot">·</span>
                      <em>+{axisXp(axis)}</em> XP
                    </>
                  )}
                </span>
              </div>
            </article>
          );
        })}
      </section>

      {/* ── Zoom: one galaxy up close (the zoom IS the navigation) ── */}
      {zoomed && (
        <div className="dw-zoom" role="dialog" aria-modal="true" aria-label={zoomed.label}>
          <div className="dw-zoom__bg" aria-hidden="true">
            <StarField />
          </div>

          <div className="dw-zoom__doc">
            <button type="button" className="dw-zoom__back" onClick={() => setZoomId(null)}>
              ← All galaxies
            </button>
            <header className={`dw-zoom__head dw-zoom__head--${zoomed.roadmap ? "roadmap" : zoomed.state}`}>
              <span className="dw-zoom__eyebrow">
                <span className="dw-zoom__lvl">Level {String(zoomed.n).padStart(2, "0")}</span>
                <span className="dw-zoom__state">{stateLabel(zoomed)}</span>
              </span>
              <h3 className="dw-zoom__name">{zoomed.label}</h3>
              <p className="dw-zoom__blurb">{zoomed.blurb}</p>
              <span className="dw-zoom__stat">
                {zoomed.roadmap ? (
                  "Coming soon"
                ) : (
                  <>
                    <em>{litCount(zoomed)}</em>/{zoomed.paliers.length} paliers lit
                    <span className="dw-zoom__dot">·</span>
                    <em>+{axisXp(zoomed)}</em> XP
                  </>
                )}
              </span>
            </header>

            <ol className="dw-zoom__levels">
              {zoomed.paliers.map((p) => {
                const pcls = p.roadmap ? "roadmap" : p.state;
                return (
                  <li key={p.id} className={`dw-plr dw-plr--${pcls}`}>
                    <div className="dw-plr__top">
                      <span className="dw-plr__idx">{p.id}</span>
                      <span className="dw-plr__name">{p.label}</span>
                      <span className="dw-plr__state">{p.roadmap ? "Roadmap" : p.state}</span>
                    </div>
                    <p className="dw-plr__desc">{PALIER_DESC[p.id] ?? p.label}</p>
                    <span className="dw-plr__meta">
                      {p.roadmap
                        ? "Mechanic coming soon"
                        : p.mastered > 0 || p.a > 0
                          ? `${Math.round(p.a * 100)}% recent accuracy · ${p.mastered} typefaces mastered`
                          : "Not started yet"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

const CREAM = "from var(--pf-cream) r g b"; // theme-adaptive ink (flips beige<->warm-noir)
const INK = "20, 16, 25"; // #141019 — dark ink for the (always light/beige) HUD card
const YELLOW = "#ffd213"; // brand accent — progression / "lit" only (palette §12)
const ORANGE = "#ff934a"; // validated accent — "emerging" / in-progress (mode competition)
const BLUE = "#58a9ff"; // validated accent — "roadmap" / to-come (mode expert)

const CSS = `
  .dw {
    position: relative;
    isolation: isolate;
    width: 100%;
    min-height: 84vh;
    display: grid;
    align-content: start;
    gap: clamp(2rem, 5vh, 3.6rem);
    padding: clamp(1.2rem, 3vw, 2.4rem) clamp(1rem, 4vw, 3rem) clamp(4rem, 9vh, 7rem);
  }
  /* Fixed full-viewport starfield — uniform black + stars everywhere (no seam
     where the section starts, no beige glow band). */
  .dw-bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
  .dw-stars { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }

  /* ── HUD ── */
  /* A beige card (ivory fill, dark ink, like the pill header) holding the
     player readout. On wide screens it lives in a full-height absolute RAIL
     pinned top-left and sticks to the scroll — crucially WITHOUT reserving flow
     space, so the centred intro rises to the top instead of being pushed below
     it. Below 1080px the rail drops back into flow (stacked above the intro). */
  /* Beige HUD pinned to the LEFT, sticking while the section scrolls. Anchored
     to the page's safe left inset (clamp, always ≥ 1rem) so it can't clip off
     the edge; capped width keeps it on-screen on any viewport. */
  .dw-hud-rail {
    position: absolute;
    top: clamp(0.6rem, 2vw, 1.4rem);
    bottom: clamp(3rem, 8vh, 6rem);
    left: clamp(0.9rem, 2vw, 1.6rem);
    width: min(32vw, 18rem);
    max-width: calc(100vw - 2rem);
    z-index: 20;
    pointer-events: none;
  }
  /* Below ~1460px the centred canvas would reach the rail — drop the HUD into
     flow, still LEFT-aligned, stacked above the intro. */
  @media (max-width: 1460px) {
    .dw-hud-rail {
      position: static; display: flex; justify-content: flex-start;
      width: 100%; max-width: none; top: auto; bottom: auto; left: auto; pointer-events: auto;
    }
    .dw-hud { position: static; }
  }
  .dw-hud {
    position: sticky;
    top: clamp(5rem, 9vh, 6.5rem);
    pointer-events: auto;
    display: flex; flex-direction: column; align-items: flex-start;
    gap: 0.5rem;
    width: fit-content; max-width: 100%;
    margin: 0;
    padding: 0.85rem 1.1rem;
    border: 1px solid rgba(${INK}, 0.08);
    border-radius: 1rem;
    background: #f4f3ee;
    box-shadow:
      inset 0 1px 0 rgba(244, 243, 238, 0.5),
      0 0.5rem 1.4rem rgba(0, 0, 0, 0.34);
    font-family: var(--pf-mono);
    font-size: 0.72rem; letter-spacing: 0.04em;
    color: rgba(${INK}, 0.62);
    transition: opacity 320ms ease;
  }
  /* Fades out while it floats over scrolling content; back to normal once clear. */
  .dw-hud.is-ghost { opacity: 0.1; }
  .dw-hud.is-ghost:hover { opacity: 1; }
  .dw-hud__row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.55rem; }
  .dw-hud__eye { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #141019; }
  .dw-hud__star { color: #141019; }
  .dw-hud__sep { width: 1px; height: 0.9rem; background: rgba(${INK}, 0.2); }
  .dw-hud__dot { color: rgba(${INK}, 0.36); }
  .dw-hud__lvl { color: rgba(${INK}, 0.72); letter-spacing: 0.08em; }
  .dw-hud__xp { width: 5rem; height: 0.3rem; border-radius: 999px; background: rgba(${INK}, 0.14); overflow: hidden; }
  .dw-hud__xp-fill { display: block; height: 100%; background: color-mix(in srgb, ${YELLOW} 50%, transparent); border-radius: 999px; }
  .dw-hud__xptext { font-variant-numeric: tabular-nums; color: rgba(${INK}, 0.55); }
  .dw-hud__streak { color: rgba(${INK}, 0.74); }
  .dw-hud__count em { font-style: normal; font-weight: 700; color: #141019; }
  .dw-hud__emerge { color: rgba(${INK}, 0.56); }
  @media (max-width: 720px) {
    .dw-hud { align-items: center; }
    .dw-hud__row { justify-content: center; }
  }

  /* ── Hero — first screen. ~One viewport tall and content centred vertically,
     so the map breathes and the galaxy list stays below the fold. ── */
  .dw-hero {
    position: relative;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: clamp(2rem, 5vh, 3.6rem);
    width: 100%;
    min-height: calc(100svh - clamp(7rem, 13vh, 9.5rem));
  }
  .dw-scrollhint {
    position: absolute; bottom: clamp(1rem, 3vh, 2rem); left: 50%; transform: translateX(-50%);
    z-index: 2;
    appearance: none; border: none; background: transparent; cursor: pointer;
    display: inline-flex; align-items: center; gap: 0.55rem;
    font-family: var(--pf-mono); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
    color: rgb(${CREAM} / 0.5);
    transition: color 200ms ease;
  }
  .dw-scrollhint:hover { color: var(--pf-cream); }
  .dw-scrollhint:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: 4px; border-radius: 6px; }
  .dw-scrollhint__arrow { display: inline-block; animation: dw-bob 1.8s ease-in-out infinite; }
  @keyframes dw-bob { 0%, 100% { transform: translateY(0); opacity: 0.5; } 50% { transform: translateY(0.3rem); opacity: 1; } }
  @media (max-width: 720px) { .dw-hero { min-height: auto; } }

  /* ── Intro ── */
  .dw-intro { text-align: center; display: grid; gap: 0.5rem; max-width: 52rem; margin: 0 auto; justify-items: center; }
  .dw-intro__kicker {
    font-family: var(--pf-mono); font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase;
    color: rgb(${CREAM} / 0.5);
  }
  .dw-intro__title {
    margin: 0; font-size: clamp(2.1rem, 5.4vw, 3.6rem); font-weight: 650; letter-spacing: -0.05em; line-height: 0.9;
    text-wrap: balance; color: var(--pf-cream);
  }
  .dw-intro__lede { margin: 0; max-width: 46ch; font-size: 0.98rem; line-height: 1.55; text-wrap: balance; color: rgb(${CREAM} / 0.64); }
  .dw-intro__lede em { font-style: normal; color: var(--pf-cream); letter-spacing: 0.04em; }

  /* ── Hero stage — DWIGGINS clean & big on the starfield, soft radial glow
       behind it (no frame, no grid). Landing-hero energy. ── */
  .dw-stage {
    position: relative; isolation: isolate;
    width: min(96vw, 64rem); margin: 0 auto;
    padding: clamp(1.4rem, 4vw, 3rem) 0;
    display: grid; place-items: center;
  }
  .dw-stage::before {
    content: ""; position: absolute; z-index: -1;
    left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: 78%; height: 150%;
    background: radial-gradient(58% 52% at 50% 50%, rgb(${CREAM} / 0.07), transparent 72%);
    pointer-events: none;
  }

  /* ── The word ── */
  /* Letters set as a word: the SVGs are cropped to each glyph's advance width,
     so a small uniform gap reads as even letter-spacing (real word spacing). */
  .dw-word {
    display: flex; justify-content: center; align-items: flex-end;
    gap: clamp(0.05rem, 0.5vw, 0.4rem);
    width: 100%;
    padding: 0;
  }
  .dw-letter {
    position: relative;
    display: grid; justify-items: center; gap: 0.4rem;
    appearance: none; border: none; background: transparent; cursor: pointer; padding: 0.3rem 0;
    border-radius: 0.8rem;
    transition: transform 200ms ease;
  }
  .dw-letter:hover, .dw-letter.is-active { transform: translateY(-4px); }
  .dw-letter:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: 3px; }
  .dw-gx { display: block; height: clamp(5rem, 16vh, 10.5rem); width: auto; overflow: visible; }
  .dw-letter__num {
    font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.08em;
    color: rgb(${CREAM} / 0.4);
  }
  .dw-letter--lit .dw-letter__num { color: rgb(${CREAM} / 0.8); }
  .dw-letter--dormant .dw-letter__num { color: rgb(${CREAM} / 0.46); }
  .dw-letter--roadmap .dw-letter__num { color: rgb(${CREAM} / 0.4); }

  /* Real glyph (the "galaxy body") + palier-stars by state */
  .dw-gx__glyph { fill: rgb(${CREAM} / 0.16); transition: fill 240ms ease; }
  .dw-gx--lit .dw-gx__glyph { fill: rgb(${CREAM} / 0.86); filter: drop-shadow(0 0 7px rgb(${CREAM} / 0.32)); }
  .dw-gx--emerging .dw-gx__glyph { fill: rgb(${CREAM} / 0.34); }
  /* Ghosts, present not absent — bumped so dormant/roadmap galaxies stay visible
     (were 0.13 / 0.10, which read as blank). */
  .dw-gx--dormant .dw-gx__glyph { fill: rgb(${CREAM} / 0.22); }
  .dw-gx--roadmap .dw-gx__glyph { fill: rgb(${CREAM} / 0.18); }
  .dw-letter:hover .dw-gx__glyph, .dw-letter.is-active .dw-gx__glyph,
  .dw-row__viz:hover .dw-gx__glyph { fill: rgb(${CREAM} / 0.92); }

  .dw-star { transition: opacity 600ms ease; }
  /* The colour lives in the dot's FILL (not just the halo) so it reads against
     its glyph — a near-cream fill vanished on the bright "lit" letter. Each
     state is a saturated point + a soft matching glow. */
  /* Colour pushed almost to nothing: the dots read as plain light points, with
     only a whisper of state colour when you look closely. */
  .dw-star--lit { fill: color-mix(in srgb, ${YELLOW} 22%, rgb(${CREAM} / 0.9)); filter: drop-shadow(0 0 1.5px color-mix(in srgb, ${YELLOW} 20%, transparent)); }
  .dw-star--emerging { fill: color-mix(in srgb, ${ORANGE} 22%, rgb(${CREAM} / 0.82)); filter: drop-shadow(0 0 1.5px color-mix(in srgb, ${ORANGE} 18%, transparent)); }
  .dw-star--dormant { fill: rgb(${CREAM} / 0.45); }
  .dw-star--roadmap { fill: color-mix(in srgb, ${BLUE} 28%, rgb(${CREAM} / 0.62)); filter: drop-shadow(0 0 1.5px color-mix(in srgb, ${BLUE} 24%, transparent)); }

  /* ── Reveal ── */
  .dw.is-armed .dw-letter { opacity: 0; transform: translateY(20px); }
  /* The word reveals when its block scrolls into view (it sits below the fold). */
  .dw.is-armed .dw-stage.is-shown .dw-letter {
    opacity: 1; transform: translateY(0);
    transition: opacity 600ms ease, transform 680ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .dw.is-armed .dw-letter:nth-child(1) { transition-delay: 0ms; }
  .dw.is-armed .dw-letter:nth-child(2) { transition-delay: 70ms; }
  .dw.is-armed .dw-letter:nth-child(3) { transition-delay: 140ms; }
  .dw.is-armed .dw-letter:nth-child(4) { transition-delay: 210ms; }
  .dw.is-armed .dw-letter:nth-child(5) { transition-delay: 280ms; }
  .dw.is-armed .dw-letter:nth-child(6) { transition-delay: 350ms; }
  .dw.is-armed .dw-letter:nth-child(7) { transition-delay: 420ms; }
  .dw.is-armed .dw-letter:nth-child(8) { transition-delay: 490ms; }
  /* Stars settle in just after their letter has faded up. */
  .dw.is-armed .dw-star { opacity: 0; }
  .dw.is-armed .dw-stage.is-shown .dw-star { opacity: 1; transition: opacity 700ms ease 450ms; }

  /* ── Readout + caption ── */
  .dw-foot { text-align: center; min-height: 2.4rem; }
  .dw-readout { margin: 0; display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.6rem; }
  .dw-readout__state {
    font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.14em; text-transform: uppercase;
    padding: 0.16rem 0.55rem; border-radius: 999px; border: 1px solid rgb(${CREAM} / 0.22); color: rgb(${CREAM} / 0.6);
  }
  .dw-readout__state--lit { border-color: color-mix(in srgb, ${YELLOW} 42%, transparent); background: color-mix(in srgb, ${YELLOW} 5%, transparent); color: var(--pf-cream); }
  .dw-readout__state--emerging { border-color: color-mix(in srgb, ${ORANGE} 55%, transparent); background: color-mix(in srgb, ${ORANGE} 8%, transparent); color: var(--pf-cream); }
  .dw-readout__state--roadmap { border-color: color-mix(in srgb, ${BLUE} 50%, transparent); color: rgb(${CREAM} / 0.82); }
  .dw-readout__name { font-size: 1rem; font-weight: 600; letter-spacing: -0.02em; color: var(--pf-cream); }
  .dw-readout__frac { font-family: var(--pf-mono); font-size: 0.74rem; color: rgb(${CREAM} / 0.5); }
  .dw-readout__hint { font-size: 0.86rem; line-height: 1.5; color: rgb(${CREAM} / 0.5); max-width: 48ch; text-wrap: balance; }
  .dw-readout__hint em { font-style: italic; color: var(--pf-cream); }

  /* ── Every galaxy, up close (each drawn as its own letter) ── */
  .dw-list {
    display: grid;
    gap: clamp(3rem, 8vh, 6rem);
    width: min(94%, 64rem);
    margin: clamp(3rem, 7vh, 5.5rem) auto 0;
  }
  .dw-list__kicker {
    margin: 0; text-align: center;
    font-family: var(--pf-mono); font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase;
    color: rgb(${CREAM} / 0.45);
  }
  .dw-row {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1fr);
    align-items: center;
    gap: clamp(1.5rem, 5vw, 4rem);
  }
  .dw-row:nth-child(even) .dw-row__viz { order: 2; }
  .dw-row__viz {
    appearance: none; border: none; background: transparent; cursor: pointer; padding: 0;
    display: grid; place-items: center; border-radius: 0.8rem;
  }
  .dw-row__viz .dw-gx { height: clamp(6rem, 18vh, 11rem); transition: transform 220ms ease; }
  .dw-row__viz:hover .dw-gx { transform: scale(1.05); }
  .dw-row__viz:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: 4px; }
  .dw-row__info { display: grid; gap: 0.7rem; max-width: 32rem; }
  .dw-row__eyebrow { display: flex; align-items: center; gap: 0.7rem; font-family: var(--pf-mono); }
  .dw-row__lvl { font-size: 0.74rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgb(${CREAM} / 0.62); }
  .dw-row__state {
    padding: 0.16rem 0.6rem; border: 1px solid rgb(${CREAM} / 0.22); border-radius: 999px;
    font-size: 0.58rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgb(${CREAM} / 0.6);
  }
  .dw-row--lit .dw-row__state { border-color: color-mix(in srgb, ${YELLOW} 42%, transparent); background: color-mix(in srgb, ${YELLOW} 5%, transparent); color: var(--pf-cream); }
  .dw-row--emerging .dw-row__state { border-color: color-mix(in srgb, ${ORANGE} 55%, transparent); background: color-mix(in srgb, ${ORANGE} 8%, transparent); color: var(--pf-cream); }
  .dw-row--roadmap .dw-row__state { border-color: color-mix(in srgb, ${BLUE} 50%, transparent); color: rgb(${CREAM} / 0.82); }
  .dw-row__name { margin: 0; font-size: clamp(1.6rem, 3.4vw, 2.4rem); font-weight: 640; letter-spacing: -0.04em; line-height: 1.02; color: var(--pf-cream); }
  .dw-row--dormant .dw-row__name, .dw-row--roadmap .dw-row__name { color: rgb(${CREAM} / 0.62); }
  .dw-row__link {
    appearance: none; border: none; background: transparent; padding: 0; margin: 0;
    font: inherit; color: inherit; letter-spacing: inherit; text-align: left; cursor: pointer;
    transition: opacity 160ms ease;
  }
  .dw-row__link:hover { opacity: 0.66; }
  .dw-row__link:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: 3px; border-radius: 4px; }
  .dw-row__blurb { margin: 0; font-size: 1rem; line-height: 1.55; color: rgb(${CREAM} / 0.66); }
  .dw-row__paliers { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.2rem 0 0; padding: 0; list-style: none; }
  .dw-row__stat { font-family: var(--pf-mono); font-size: 0.78rem; color: rgb(${CREAM} / 0.5); font-variant-numeric: tabular-nums; }
  .dw-row__stat em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .dw-row__dot { margin: 0 0.5rem; }
  .dw.is-armed .dw-row { opacity: 0; transform: translateY(40px); }
  .dw.is-armed .dw-row.is-shown {
    opacity: 1; transform: none;
    transition: opacity 700ms ease, transform 760ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  @media (max-width: 760px) {
    .dw-row { grid-template-columns: 1fr; text-align: center; justify-items: center; gap: 1.1rem; }
    .dw-row:nth-child(even) .dw-row__viz { order: 0; }
    .dw-row__viz .dw-gx { height: clamp(5rem, 22vw, 8rem); }
    .dw-row__eyebrow, .dw-row__paliers { justify-content: center; }
    .dw-row__info { justify-items: center; }
  }
  @media (prefers-reduced-motion: reduce) {
    .dw.is-armed .dw-row.is-shown { transition: none; }
  }

  /* ── Zoom ── */
  .dw-zoom {
    position: fixed; inset: 0; z-index: 50;
    overflow-y: auto; overscroll-behavior: contain;
    padding: clamp(4rem, 11vh, 7rem) clamp(1.2rem, 5vw, 4rem) clamp(3rem, 8vh, 6rem);
    background: color-mix(in srgb, var(--pf-bg) 96%, transparent);
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
    animation: dw-zoom-in 360ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes dw-zoom-in { from { opacity: 0; transform: scale(0.94); } }
  .dw-zoom__bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; opacity: 0.6; pointer-events: none; }
  .dw-zoom__back {
    justify-self: start;
    appearance: none; border: none; background: transparent; cursor: pointer;
    font-family: var(--pf-mono); font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgb(${CREAM} / 0.55); padding: 0; margin: 0 0 -0.4rem;
    transition: color 160ms ease;
  }
  .dw-zoom__back:hover { color: var(--pf-cream); }
  .dw-zoom__back:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: 3px; border-radius: 4px; }

  /* The written document */
  .dw-zoom__doc {
    position: relative; z-index: 1;
    width: min(94%, 48rem); margin: 0 auto;
    display: grid; gap: clamp(1.4rem, 3.5vh, 2.2rem);
  }
  .dw-zoom__head { display: grid; gap: 0.55rem; }
  .dw-zoom__eyebrow { display: flex; align-items: center; gap: 0.7rem; font-family: var(--pf-mono); }
  .dw-zoom__lvl { font-size: 0.76rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgb(${CREAM} / 0.62); }
  .dw-zoom__state {
    padding: 0.16rem 0.6rem; border: 1px solid rgb(${CREAM} / 0.22); border-radius: 999px;
    font-size: 0.58rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgb(${CREAM} / 0.6);
  }
  .dw-zoom__head--lit .dw-zoom__state { border-color: color-mix(in srgb, ${YELLOW} 42%, transparent); background: color-mix(in srgb, ${YELLOW} 5%, transparent); color: var(--pf-cream); }
  .dw-zoom__head--emerging .dw-zoom__state { border-color: color-mix(in srgb, ${ORANGE} 55%, transparent); background: color-mix(in srgb, ${ORANGE} 8%, transparent); color: var(--pf-cream); }
  .dw-zoom__head--roadmap .dw-zoom__state { border-color: color-mix(in srgb, ${BLUE} 50%, transparent); color: rgb(${CREAM} / 0.82); }
  .dw-zoom__name { margin: 0; font-size: clamp(1.5rem, 3vw, 2.1rem); font-weight: 640; letter-spacing: -0.035em; line-height: 1.02; color: var(--pf-cream); }
  .dw-zoom__head--roadmap .dw-zoom__name, .dw-zoom__head--dormant .dw-zoom__name { color: rgb(${CREAM} / 0.62); }
  .dw-zoom__blurb { margin: 0; max-width: 62ch; font-size: 0.92rem; line-height: 1.55; color: rgb(${CREAM} / 0.7); }
  .dw-zoom__stat { font-family: var(--pf-mono); font-size: 0.8rem; color: rgb(${CREAM} / 0.5); font-variant-numeric: tabular-nums; }
  .dw-zoom__stat em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .dw-zoom__dot { margin: 0 0.5rem; }

  /* Detailed, written breakdown of every palier in this level */
  .dw-zoom__levels { margin: 0; padding: 0; list-style: none; border-top: 1px solid rgb(${CREAM} / 0.1); }
  .dw-plr { display: grid; gap: 0.35rem; padding: clamp(0.9rem, 2.2vh, 1.4rem) 0; border-bottom: 1px solid rgb(${CREAM} / 0.1); }
  .dw-plr__top { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
  .dw-plr__idx { font-family: var(--pf-mono); font-size: 0.7rem; font-weight: 600; color: rgb(${CREAM} / 0.4); font-variant-numeric: tabular-nums; }
  .dw-plr__name { font-size: 0.98rem; font-weight: 600; letter-spacing: 0.01em; color: var(--pf-cream); }
  .dw-plr--dormant .dw-plr__name, .dw-plr--roadmap .dw-plr__name { color: rgb(${CREAM} / 0.62); }
  .dw-plr__state {
    margin-left: auto;
    font-family: var(--pf-mono); font-size: 0.54rem; letter-spacing: 0.14em; text-transform: uppercase;
    padding: 0.14rem 0.5rem; border-radius: 999px; border: 1px solid rgb(${CREAM} / 0.18); color: rgb(${CREAM} / 0.5);
  }
  .dw-plr--lit .dw-plr__state { border-color: color-mix(in srgb, ${YELLOW} 42%, transparent); background: color-mix(in srgb, ${YELLOW} 5%, transparent); color: var(--pf-cream); }
  .dw-plr--emerging .dw-plr__state { border-color: color-mix(in srgb, ${ORANGE} 52%, transparent); background: color-mix(in srgb, ${ORANGE} 7%, transparent); color: var(--pf-cream); }
  .dw-plr--roadmap .dw-plr__state { border-style: dashed; border-color: color-mix(in srgb, ${BLUE} 50%, transparent); }
  .dw-plr__desc { margin: 0; max-width: 66ch; font-size: 0.86rem; line-height: 1.6; color: rgb(${CREAM} / 0.68); }
  .dw-plr--dormant .dw-plr__desc, .dw-plr--roadmap .dw-plr__desc { color: rgb(${CREAM} / 0.5); }
  .dw-plr__meta { font-family: var(--pf-mono); font-size: 0.68rem; letter-spacing: 0.03em; color: rgb(${CREAM} / 0.42); }

  /* tags (shared with the "every galaxy" rows below the map) */
  .dw-tag {
    font-family: var(--pf-mono); font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 0.24rem 0.55rem; border-radius: 999px; border: 1px solid rgb(${CREAM} / 0.14); color: rgb(${CREAM} / 0.5);
  }
  .dw-tag--lit { border-color: rgb(${CREAM} / 0.28); color: rgb(${CREAM} / 0.9); }
  /* Keep the yellow as a light touch: only the first one or two lit paliers of
     each galaxy get the brand outline, not the whole row. */
  .dw-row__paliers .dw-tag--lit:nth-child(-n + 2) { border-color: color-mix(in srgb, ${YELLOW} 42%, transparent); color: var(--pf-cream); }
  .dw-tag--emerging { border-color: color-mix(in srgb, ${ORANGE} 48%, transparent); background: color-mix(in srgb, ${ORANGE} 6%, transparent); color: var(--pf-cream); }
  .dw-tag--roadmap { border-style: dashed; border-color: color-mix(in srgb, ${BLUE} 45%, transparent); color: rgb(${CREAM} / 0.5); }

  @media (max-width: 760px) {
    .dw-word { flex-wrap: wrap; }
    .dw-gx { height: clamp(3.4rem, 16vw, 6rem); }
    .dw-plr__top { gap: 0.4rem; }
    .dw-plr__state { margin-left: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .dw.is-armed .dw-stage.is-shown .dw-letter { transition: none; }
    .dw.is-armed .dw-stage.is-shown .dw-star { transition: none; }
    .dw-scrollhint__arrow { animation: none; }
    .dw-zoom { animation: none; }
  }
`;
