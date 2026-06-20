"use client";

import { useEffect, useRef, useState } from "react";
import type { ProfileBoardChapter } from "@/lib/profile/mock-profile";

// ---------------------------------------------------------------------------
// The progression board — a thick board-game track that snakes left↔right and
// finishes at the centre (react.gg reference), drawn strictly cream-on-black in
// the landing's design-canvas language: faint grid, mono annotations, framed
// panel, double-ruled track edges, dense cases, dial-style numbered nodes.
// ---------------------------------------------------------------------------

const VW = 1000;
const MARGIN = 96;
const TURN = 108; // how far the U-turns bulge out
const ROWGAP = 214;
const RIBBON = 58; // track thickness
const Y0 = 138;
// Seven rows — the snake lengthens to carry the 8 axes + their many paliers.
const ROW_Y = [0, 1, 2, 3, 4, 5, 6].map((r) => Y0 + r * ROWGAP);
const XL = MARGIN + TURN;
const XR = VW - MARGIN - TURN;
const X_END = 500; // last run finishes at centre
const VH = ROW_Y[ROW_Y.length - 1] + 160;
const W = XR - XL;

// Organic waypoints: the runs are NOT ruler-straight — they bow and wave, and
// the U-turns are loose loops, not clean semicircles. A Catmull-Rom spline
// through these gives the flowing, hand-laid board-game feel of the reference.
// Built row by row, alternating direction, with a loop-out at each turn.
const WAYPOINTS: ReadonlyArray<{ x: number; y: number }> = (() => {
  const pts: { x: number; y: number }[] = [];
  const rows = ROW_Y.length;
  for (let r = 0; r < rows; r++) {
    const y = ROW_Y[r];
    const leftToRight = r % 2 === 0;
    const isLast = r === rows - 1;
    if (leftToRight) {
      pts.push({ x: XL, y: y + 6 });
      pts.push({ x: XL + W * 0.32, y: y - 18 });
      pts.push({ x: XL + W * 0.64, y: y + 16 });
      pts.push({ x: isLast ? X_END : XR, y: y - 6 });
    } else {
      pts.push({ x: XR, y: y + 12 });
      pts.push({ x: XR - W * 0.32, y: y - 16 });
      pts.push({ x: XR - W * 0.64, y: y + 18 });
      pts.push({ x: isLast ? X_END : XL, y: y - 6 });
    }
    if (!isLast) {
      // loop out: right turn after an L→R row, left turn after an R→L row
      const midY = (ROW_Y[r] + ROW_Y[r + 1]) / 2;
      pts.push(
        leftToRight ? { x: XR + TURN, y: midY - 6 } : { x: XL - TURN, y: midY + 6 },
      );
    }
  }
  return pts;
})();

const BOARD_D = catmullRom(WAYPOINTS);

type CellState = "done" | "current" | "locked";

type Pt = { x: number; y: number; angle: number };
type Divider = Pt & { state: CellState; major: boolean };
type Label = Pt & { text: string; state: CellState };
type Chevron = Pt & { state: CellState };
type NodeMark = Pt & { n: number; state: CellState };

type Measured = {
  total: number;
  dividers: Divider[];
  labels: Label[];
  chevrons: Chevron[];
  nodes: NodeMark[];
  token: Pt;
  start: Pt;
  finish: Pt;
  badges: Pt[];
  progressLen: number;
};

// Editorial blocks sit in the EMPTY bands between runs (the snake's loop
// interiors), on the side away from that band's turn — never over a run.
// One block per axis (8), down the 7-row snake (header + 6 bands + bottom).
const SLOTS: ReadonlyArray<{ top: number; pos: "left" | "right" | "center" }> = [
  { top: 1.2, pos: "center" }, // 01 — header, above row 0
  { top: 11, pos: "left" }, // 02 — band r0–r1 (free left)
  { top: 25, pos: "right" }, // 03 — band r1–r2 (free right)
  { top: 38, pos: "left" }, // 04 — band r2–r3 (free left)
  { top: 52, pos: "right" }, // 05 — band r3–r4 (free right)
  { top: 65, pos: "left" }, // 06 — band r4–r5 (free left)
  { top: 79, pos: "right" }, // 07 — band r5–r6 (free right)
  { top: 90, pos: "right" }, // 08 — below row 6, right (run ends centre-left)
];

export default function ProgressBoard({
  chapters,
  currentChapter,
}: {
  chapters: ProfileBoardChapter[];
  currentChapter: number;
}) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [m, setM] = useState<Measured | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();

    // NOTE: `at` takes an arc-LENGTH (not a fraction).
    const at = (len: number): Pt => {
      const L = Math.max(0, Math.min(total, len));
      const p = path.getPointAtLength(L);
      const p2 = path.getPointAtLength(Math.min(total, L + 0.6));
      const angle = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
      return { x: p.x, y: p.y, angle };
    };

    // ── The board as discrete CASES (a real game board): each chapter is a
    // numbered station, each sub-step is ONE case the pawn steps through. ──
    type BoardCell =
      | { kind: "node"; n: number; state: CellState }
      | { kind: "step"; label: string; state: CellState };
    const cells: BoardCell[] = [];
    chapters.forEach((ch) => {
      cells.push({ kind: "node", n: ch.n, state: ch.state });
      ch.tiles.forEach((label) => cells.push({ kind: "step", label, state: ch.state }));
    });
    const N = cells.length;
    const cellLen = (i: number) => (total * (i + 0.5)) / N;

    // The pawn ("le petit cheval") sits on the next case to clear in the current
    // chapter (after the paliers already mastered); the track fills up to it.
    const curIdx = Math.max(0, chapters.findIndex((c) => c.n === currentChapter));
    const curNodeCell = Math.max(
      0,
      cells.findIndex((c) => c.kind === "node" && c.n === currentChapter),
    );
    const pawnCell = Math.min(N - 1, curNodeCell + 1 + (chapters[curIdx]?.cleared ?? 0));
    const progressLen = cellLen(pawnCell);
    // Per-case display state: cleared up to the pawn, then the pawn's case, then ahead.
    const cellState = (i: number): CellState =>
      i < pawnCell ? "done" : i === pawnCell ? "current" : "locked";

    // Numbered station nodes (keep their axis state for the dial styling).
    const nodes: NodeMark[] = [];
    cells.forEach((c, i) => {
      if (c.kind === "node") nodes.push({ ...at(cellLen(i)), n: c.n, state: c.state });
    });

    // One label per step case, centred in its case, rotated to the track.
    const labels: Label[] = [];
    cells.forEach((c, i) => {
      if (c.kind === "step") labels.push({ ...at(cellLen(i)), text: c.label, state: cellState(i) });
    });

    // Case dividers at every boundary — these draw the cells of the board.
    // Skip the boundary right beside a station (its circle covers it).
    const dividers: Divider[] = [];
    for (let i = 1; i < N; i++) {
      if (cells[i - 1].kind === "node" || cells[i].kind === "node") continue;
      dividers.push({ ...at((total * i) / N), state: cellState(i), major: false });
    }

    // (badges + chevrons retired for now — the pawn is the piece on the board)
    const badges: Pt[] = [];
    const chevrons: Chevron[] = [];

    setM({
      total,
      dividers,
      labels,
      chevrons,
      nodes,
      token: at(progressLen), // the pawn's case
      start: at(0),
      finish: at(total),
      badges,
      progressLen,
    });
  }, [chapters, currentChapter]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setRevealed(true);
      return;
    }
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setRevealed(true);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { threshold: 0.14 },
    );
    io.observe(el);
    const fallback = window.setTimeout(reveal, 3200);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  const half = (RIBBON - 16) / 2; // divider half-length, inside the inner rule

  return (
    <div ref={panelRef} className={`board-panel${revealed ? " is-revealed" : ""}`}>
      <div className="board-wrap" style={{ aspectRatio: `${VW} / ${VH}` }}>
        <svg
          className="board-svg"
          viewBox={`0 0 ${VW} ${VH}`}
          role="img"
          aria-label="Your progression path across five chapters"
          style={
            m
              ? ({
                  ["--climb-len" as string]: m.progressLen,
                  ["--total-len" as string]: m.total,
                } as React.CSSProperties)
              : undefined
          }
        >
          {/* ── Track body: stacked strokes build a double-ruled paper strip ── */}
          {/* 1. outer edge keyline */}
          <path ref={pathRef} className="trk trk-edge" d={BOARD_D} />
          {/* 2. paper knockout (interior) */}
          <path className="trk trk-paper" d={BOARD_D} />
          {/* 3. inner hairline rule */}
          <path className="trk trk-inner" d={BOARD_D} />
          <path className="trk trk-inner-knock" d={BOARD_D} />

          {/* ── Travelled overlay: brighter, draws in on scroll ── */}
          <path className="trk trk-climb-edge" d={BOARD_D} />
          <path className="trk trk-climb-paper" d={BOARD_D} />
          <path className="trk trk-climb-inner" d={BOARD_D} />
          <path className="trk trk-climb-inner-knock" d={BOARD_D} />

          {m && (
            <>
              {/* case dividers */}
              {m.dividers.map((d, i) => {
                const a = (d.angle * Math.PI) / 180;
                const nx = -Math.sin(a);
                const ny = Math.cos(a);
                const h = d.major ? half + 2 : half;
                return (
                  <line
                    key={`d-${i}`}
                    className={`board-div board-div--${d.state}${d.major ? " is-major" : ""}`}
                    x1={d.x - nx * h}
                    y1={d.y - ny * h}
                    x2={d.x + nx * h}
                    y2={d.y + ny * h}
                  />
                );
              })}

              {/* travel chevrons */}
              {m.chevrons.map((c, i) => (
                <path
                  key={`c-${i}`}
                  className={`board-chevron board-chevron--${c.state}`}
                  d="M -4.5 -5 L 4.5 0 L -4.5 5"
                  transform={`translate(${c.x} ${c.y}) rotate(${c.angle})`}
                />
              ))}

              {/* start tag */}
              <g
                className="board-start"
                transform={`translate(${m.start.x} ${m.start.y}) rotate(${normalizeAngle(m.start.angle)})`}
              >
                <line className="board-start__stem" x1={0} y1={0} x2={0} y2={-46} />
                <g transform="translate(0 -58)">
                  <rect x={-32} y={-13} width={64} height={26} rx={4} />
                  <text x={0} y={1}>
                    START
                  </text>
                </g>
              </g>

              {/* finish flag */}
              <g
                className="board-finish"
                transform={`translate(${m.finish.x} ${m.finish.y})`}
              >
                <circle r={7} />
                <circle r={13} className="board-finish__ring" />
              </g>

              {/* one label per step case, centred + rotated to the track */}
              {m.labels.map((l, i) => (
                <text
                  key={`l-${i}`}
                  className={`board-tile board-tile--${l.state}`}
                  x={l.x}
                  y={l.y}
                  transform={`rotate(${normalizeAngle(l.angle)} ${l.x} ${l.y})`}
                >
                  {l.text}
                </text>
              ))}

              {/* dial-style numbered nodes */}
              {m.nodes.map((n, i) => (
                <g key={`n-${i}`} className={`board-node board-node--${n.state}`}>
                  {/* radial dial ticks */}
                  {Array.from({ length: 24 }, (_, k) => {
                    const ang = (k / 24) * Math.PI * 2;
                    const r1 = 41;
                    const r2 = k % 6 === 0 ? 35 : 38;
                    return (
                      <line
                        key={k}
                        className="board-node__pip"
                        x1={n.x + Math.cos(ang) * r1}
                        y1={n.y + Math.sin(ang) * r1}
                        x2={n.x + Math.cos(ang) * r2}
                        y2={n.y + Math.sin(ang) * r2}
                      />
                    );
                  })}
                  <circle className="board-node__ring" cx={n.x} cy={n.y} r={33} />
                  <circle className="board-node__disc" cx={n.x} cy={n.y} r={27} />
                  <text className="board-node__num" x={n.x} y={n.y + 1}>
                    {String(n.n).padStart(2, "0")}
                  </text>
                </g>
              ))}

              {/* the pawn — "le petit cheval" — on the current case */}
              <g transform={`translate(${m.token.x} ${m.token.y})`}>
                <g className="board-pawn">
                  <ellipse className="board-pawn__base" cx={0} cy={12} rx={10} ry={3.2} />
                  <path className="board-pawn__body" d="M -8 12 Q -7 -3 0 -3 Q 7 -3 8 12 Z" />
                  <circle className="board-pawn__head" cx={0} cy={-9} r={6} />
                </g>
              </g>
            </>
          )}
        </svg>

        {/* editorial blocks in the negative space */}
        <div className="board-overlay">
          {chapters.map((ch, i) => {
            const slot = SLOTS[i] ?? SLOTS[SLOTS.length - 1];
            const sideStyle: React.CSSProperties =
              slot.pos === "center"
                ? { left: "50%", transform: "translateX(-50%)", textAlign: "center" }
                : slot.pos === "left"
                  ? { left: "1%" }
                  : { right: "1%", textAlign: "right" };
            return (
              <div
                key={ch.n}
                className={`board-block board-block--${slot.pos} board-block--${ch.state}`}
                style={{ top: `${slot.top}%`, ...sideStyle }}
              >
                <span className="board-block-eyebrow">
                  <span className="board-block-num">{String(ch.n).padStart(2, "0")}</span>
                  <span className="board-block-state">
                    {ch.roadmap ? "Roadmap" : stateLabel(ch.state)}
                  </span>
                </span>
                <h3 className="board-block-title">{ch.title}</h3>
                <p className="board-block-text">{ch.blurb}</p>
                <span className="board-block-stat">
                  <em>{ch.cleared}</em>/{ch.tiles.length} paliers
                  <span className="board-block-dot">·</span>
                  <em>+{ch.tiles.length * 100 + 500}</em> XP
                </span>
                {ch.accuracy !== null && (
                  <span className="board-block-stat board-block-stat--sub">
                    <em>{ch.accuracy}%</em> accuracy<span className="board-block-dot">·</span>
                    <em>{ch.seen}</em> seen
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx global>{boardStyles}</style>
    </div>
  );
}

// Smooth Catmull-Rom spline through the waypoints → cubic-bezier path string.
function catmullRom(pts: ReadonlyArray<{ x: number; y: number }>): string {
  if (pts.length < 2) return "";
  const d = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(
      `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    );
  }
  return d.join(" ");
}

// Keep labels upright-ish: flip text that would render upside-down.
function normalizeAngle(a: number): number {
  let r = a;
  if (r > 90) r -= 180;
  if (r < -90) r += 180;
  return r;
}

function stateLabel(s: CellState): string {
  if (s === "done") return "Cleared";
  if (s === "current") return "In progress";
  return "Locked";
}

const CREAM = "from var(--pf-cream) r g b"; // theme-adaptive soft ink (page-facing tones)
const BEIGE = "#f4f3ee"; // solid brand beige — the FILLED board "paper" (stays light in both themes)
const PAPER = "#0c0d11"; // page-dark (used for the dark inner rule knockout)
const INK = "18, 18, 22"; // dark ink that sits ON the beige board (writings, rules, numbers)

const boardStyles = `
  /* The board lives bare on the page (no frame, no grid) so it can breathe
     full-width like the landing — bigger, not boxed-in. */
  .board-panel {
    position: relative;
    width: 100%;
  }

  /* ── Board wrap + svg ── */
  .board-wrap {
    position: relative;
    width: 100%;
    margin: 0 auto;
  }
  .board-svg { display: block; width: 100%; height: auto; overflow: visible; }

  /* ── Track: a FILLED beige board (paper = beige), dark ink on top ──
     ahead = medium beige; cleared = bright beige + a thin dark inner rule. */
  .trk { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .trk-edge { stroke: rgb(${CREAM} / 0.46); stroke-width: ${RIBBON}; }
  .trk-paper { stroke: transparent; }
  .trk-inner { stroke: transparent; }
  .trk-inner-knock { stroke: transparent; }

  /* travelled overlay — bright solid beige paper + thin dark inner rule */
  .trk-climb-edge { stroke: ${BEIGE}; stroke-width: ${RIBBON}; }
  .trk-climb-paper { stroke: rgba(${INK}, 0.68); stroke-width: ${RIBBON - 11}; }
  .trk-climb-inner { stroke: ${BEIGE}; stroke-width: ${RIBBON - 15}; }
  .trk-climb-inner-knock { stroke: transparent; }
  .trk-climb-edge, .trk-climb-paper, .trk-climb-inner, .trk-climb-inner-knock {
    stroke-dasharray: var(--climb-len) var(--total-len);
    stroke-dashoffset: var(--climb-len);
  }
  .is-revealed .trk-climb-edge,
  .is-revealed .trk-climb-paper,
  .is-revealed .trk-climb-inner,
  .is-revealed .trk-climb-inner-knock {
    transition: stroke-dashoffset 1700ms cubic-bezier(0.22, 1, 0.36, 1);
    stroke-dashoffset: 0;
  }

  /* ── Case dividers (dark ink on the beige board) ── */
  .board-div { stroke-width: 1.4; stroke-linecap: round; }
  .board-div.is-major { stroke-width: 1.8; }
  .board-div--done { stroke: rgba(${INK}, 0.5); }
  .board-div--current { stroke: rgba(${INK}, 0.5); }
  .board-div--locked { stroke: rgba(${INK}, 0.3); }

  /* ── Travel chevrons ── */
  .board-chevron { fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .board-chevron--done { stroke: rgba(${INK}, 0.5); }
  .board-chevron--current { stroke: rgba(${INK}, 0.5); }
  .board-chevron--locked { stroke: rgba(${INK}, 0.3); }

  /* ── Writings: flow along the track, dark ink ── */
  .board-tile-path { fill: none; stroke: none; }
  .board-tile {
    font-family: var(--profile-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-anchor: middle;
    dominant-baseline: middle;
    text-transform: uppercase;
  }
  .board-tile--done { fill: rgba(${INK}, 0.9); }
  .board-tile--current { fill: rgba(${INK}, 0.92); }
  .board-tile--locked { fill: rgba(${INK}, 0.55); }

  /* ── Dial-style numbered nodes ── */
  .board-node__pip { stroke-width: 1.4; }
  .board-node__ring { fill: none; stroke-width: 2; }
  .board-node__disc { fill: ${BEIGE}; stroke-width: 1; }
  .board-node__num {
    font-family: var(--profile-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 23px;
    font-weight: 600;
    letter-spacing: 0.01em;
    text-anchor: middle;
    dominant-baseline: middle;
  }
  /* done — bright beige disc, dark number/ring */
  .board-node--done .board-node__pip { stroke: rgba(${INK}, 0.4); }
  .board-node--done .board-node__ring { stroke: rgba(${INK}, 0.85); }
  .board-node--done .board-node__disc { fill: ${BEIGE}; stroke: rgba(${INK}, 0.85); }
  .board-node--done .board-node__num { fill: rgba(${INK}, 0.92); }
  /* current — bright beige disc, dark ink, soft glow */
  .board-node--current .board-node__pip { stroke: rgba(${INK}, 0.5); }
  .board-node--current .board-node__ring {
    stroke: rgba(${INK}, 0.9);
    filter: drop-shadow(0 0 7px rgb(${CREAM} / 0.45));
  }
  .board-node--current .board-node__disc { fill: ${BEIGE}; stroke: rgba(${INK}, 0.9); }
  .board-node--current .board-node__num { fill: rgba(${INK}, 0.92); }
  /* locked — dim beige disc keeps the dark number legible */
  .board-node--locked .board-node__pip { stroke: rgba(${INK}, 0.2); }
  .board-node--locked .board-node__ring { stroke: rgba(${INK}, 0.32); }
  .board-node--locked .board-node__disc { fill: rgb(${CREAM} / 0.5); stroke: rgba(${INK}, 0.3); }
  .board-node--locked .board-node__num { fill: rgba(${INK}, 0.5); }

  /* ── The pawn ("le petit cheval") on the current case ── */
  .board-pawn {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    filter: drop-shadow(0 2px 2.5px rgba(0, 0, 0, 0.4));
  }
  .board-pawn__base { fill: rgba(${INK}, 0.28); }
  .board-pawn__body { fill: #141019; }
  .board-pawn__head { fill: #141019; }
  .is-revealed .board-pawn { animation: board-bob 2.6s ease-in-out infinite; }
  @keyframes board-bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  /* ── Start tag + finish (beige tag, dark ink) ── */
  .board-start__stem { stroke: rgb(${CREAM} / 0.5); stroke-width: 1.6; stroke-dasharray: 3 3; }
  .board-start rect { fill: ${BEIGE}; stroke: rgba(${INK}, 0.7); stroke-width: 1.4; }
  .board-start text {
    font-family: var(--profile-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 12px; font-weight: 700; letter-spacing: 0.18em;
    fill: rgba(${INK}, 0.9); text-anchor: middle; dominant-baseline: middle;
  }
  .board-finish circle { fill: rgba(${INK}, 0.4); }
  .board-finish__ring { fill: none; stroke: rgba(${INK}, 0.45); stroke-width: 1.6; }

  /* ── Editorial blocks ── */
  .board-overlay { position: absolute; inset: 0; pointer-events: none; }
  .board-block {
    position: absolute;
    width: clamp(12rem, 25%, 18rem);
    display: grid;
    gap: 0.5rem;
    pointer-events: auto;
    opacity: 0;
    transform: translateY(14px);
    transition: opacity 640ms ease, transform 640ms ease;
  }
  .board-block--center { width: clamp(15rem, 36%, 25rem); }
  .is-revealed .board-block { opacity: 1; transform: translateY(0); }
  .is-revealed .board-block:nth-of-type(2) { transition-delay: 130ms; }
  .is-revealed .board-block:nth-of-type(3) { transition-delay: 230ms; }
  .is-revealed .board-block:nth-of-type(4) { transition-delay: 330ms; }
  .is-revealed .board-block:nth-of-type(5) { transition-delay: 430ms; }
  .board-block--locked { opacity: 0; }
  .is-revealed .board-block--locked { opacity: 0.62; }

  .board-block-eyebrow {
    display: flex; align-items: center; gap: 0.55rem;
    font-family: var(--profile-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  }
  .board-block--right .board-block-eyebrow,
  .board-block--center .board-block-eyebrow { justify-content: flex-end; }
  .board-block--center .board-block-eyebrow { justify-content: center; }
  .board-block-num {
    font-size: 0.78rem; font-weight: 600; letter-spacing: 0.06em;
    color: var(--pf-cream);
  }
  .board-block-state {
    padding: 0.12rem 0.45rem;
    border: 1px solid rgb(${CREAM} / 0.2);
    border-radius: 999px;
    font-size: 0.58rem; letter-spacing: 0.13em; text-transform: uppercase;
    color: rgb(${CREAM} / 0.55);
  }
  .board-block--current .board-block-state {
    border-color: rgb(${CREAM} / 0.55);
    color: var(--pf-cream);
  }
  .board-block-title {
    margin: 0;
    font-size: clamp(1.2rem, 2.3vw, 1.65rem);
    font-weight: 640; letter-spacing: -0.035em; line-height: 1.05;
    color: ${BEIGE};
  }
  .board-block--locked .board-block-title { color: rgb(${CREAM} / 0.5); }
  .board-block-text {
    margin: 0; font-size: 0.9rem; line-height: 1.46;
    color: rgb(${CREAM} / 0.62);
  }
  .board-block-stat {
    font-family: var(--profile-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.72rem; letter-spacing: 0.03em;
    color: rgb(${CREAM} / 0.5);
  }
  .board-block-stat em { font-style: normal; color: ${BEIGE}; }
  .board-block-stat--sub { font-size: 0.66rem; color: rgb(${CREAM} / 0.4); margin-top: 0.05rem; }
  .board-block-stat--sub em { color: rgb(${CREAM} / 0.7); }
  .board-block-dot { margin: 0 0.4rem; }

  @media (max-width: 720px) {
    .board-block-text { display: none; }
    .board-block { width: clamp(8rem, 42%, 13rem); }
  }
  @media (prefers-reduced-motion: reduce) {
    .board-block { transition: none; }
    .is-revealed .trk-climb-edge,
    .is-revealed .trk-climb-paper,
    .is-revealed .trk-climb-inner,
    .is-revealed .trk-climb-inner-knock { transition: none; }
    .is-revealed .board-token__halo { animation: none; }
  }
`;
