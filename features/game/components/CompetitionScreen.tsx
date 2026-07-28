"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import { isDevRuntime } from "@/lib/dev-mode";
import {
  COMPETITION_FEEDBACK_DELAY_MS,
  COMPETITION_FEEDBACK_PERSIST_MS,
} from "@/lib/game/competition/catalog";
import {
  type CompetitionAnswerResponse,
  type CompetitionFontFace,
  type CompetitionQuestion,
  type CompetitionSessionSummary,
  type CompetitionStartResponse,
  type CompetitionStats,
  type CompetitionTimeoutResponse,
} from "@/lib/game/competition/contracts";

declare global {
  interface Window {
    advanceTime?: (ms: number) => void;
    render_game_to_text?: () => string;
  }
}

type InlineFeedback = {
  kind: "correct" | "wrong";
  text: string;
} | null;

const CARD_COLORS = ["#8EA2FF", "#67D6B6", "#F5BF6A", "#F39AB1"] as const;

const getPreferredLocale = () =>
  typeof document !== "undefined" && document.documentElement.lang.startsWith("en")
    ? "en"
    : "fr";

const COMPETITION_FONT_FACE_STYLE_ID = "competition-font-faces";
// Tracks families already injected so we never emit a duplicate @font-face. The
// backing <style> lives in document.head, so this persists across remounts.
const injectedCompetitionFontFaces = new Set<string>();

// Injects the @font-face for a single face on demand, right before it is shown,
// instead of shipping all runtime faces up front. SSR-safe (no-op without a
// document) and idempotent. font-display: swap keeps the fallback rendering
// until the woff2 loads, so nothing ever renders unstyled.
const ensureCompetitionFontFace = (fontFace: CompetitionFontFace | null | undefined) => {
  if (!fontFace || typeof document === "undefined") {
    return;
  }
  if (injectedCompetitionFontFaces.has(fontFace.family)) {
    return;
  }
  injectedCompetitionFontFaces.add(fontFace.family);

  let styleElement = document.getElementById(
    COMPETITION_FONT_FACE_STYLE_ID
  ) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = COMPETITION_FONT_FACE_STYLE_ID;
    document.head.appendChild(styleElement);
  }

  styleElement.appendChild(
    document.createTextNode(
      `@font-face{font-family:"${fontFace.family}";src:url("${fontFace.src}") format("woff2");font-weight:${fontFace.weight};font-style:${fontFace.style};font-display:swap;}`
    )
  );
};

const formatRemaining = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const formatClickTime = (responseTimeMs: number) => `${(responseTimeMs / 1000).toFixed(2)}s`;

const formatRate = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)}%`;

const formatMetric = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const buildLinePath = (points: { x: number; y: number }[]) =>
  points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

const LINE_CHART_X_GUIDES = [22, 40, 58, 76];
const LINE_CHART_Y_GUIDES = [5, 15.67, 26.33, 37];

const formatCategoryLabel = (category: string) =>
  category
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const competitionScreenStyles = `
  .game-v1-page.game-v2-page {
    --competition-page-bg: #f6f3ee;
    --competition-shell-bg: rgba(255, 252, 248, 0.92);
    --competition-shell-border: rgba(58, 38, 48, 0.1);
    --competition-ink: #2a1a20;
    --competition-muted: rgba(58, 38, 48, 0.58);
    --competition-subtle: rgba(58, 38, 48, 0.46);
    --competition-info: #455cc7;
    --competition-info-soft: rgba(142, 162, 255, 0.13);
    --competition-info-line: rgba(72, 111, 255, 0.22);
    --competition-positive: #21785e;
    --competition-positive-soft: rgba(103, 214, 182, 0.13);
    --competition-positive-line: rgba(66, 186, 147, 0.24);
    --competition-warning: #9b5c0e;
    --competition-warning-soft: rgba(245, 191, 106, 0.14);
    --competition-warning-line: rgba(242, 167, 68, 0.24);
    --competition-negative: #b33636;
    --competition-negative-soft: rgba(179, 54, 54, 0.08);
    --competition-negative-line: rgba(179, 54, 54, 0.24);
    min-height: 100svh;
    width: 100%;
    display: grid;
    place-items: center;
    padding: clamp(0.72rem, 2vw, 1.4rem);
    background: var(--competition-page-bg);
    color: var(--competition-ink);
  }

  :root[data-theme="dark"] .game-v1-page.game-v2-page {
    --competition-page-bg: #111114;
    --competition-shell-bg: rgba(17, 17, 20, 0.86);
    --competition-shell-border: rgba(244, 243, 238, 0.12);
    --competition-ink: #f4f3ee;
    --competition-muted: rgba(244, 243, 238, 0.62);
    --competition-subtle: rgba(244, 243, 238, 0.48);
    --competition-info: #b9c4ff;
    --competition-info-soft: rgba(142, 162, 255, 0.14);
    --competition-info-line: rgba(142, 162, 255, 0.34);
    --competition-positive: #9ef0d4;
    --competition-positive-soft: rgba(103, 214, 182, 0.14);
    --competition-positive-line: rgba(103, 214, 182, 0.34);
    --competition-warning: #ffd79a;
    --competition-warning-soft: rgba(245, 191, 106, 0.15);
    --competition-warning-line: rgba(245, 191, 106, 0.36);
    --competition-negative: #fca5a5;
    --competition-negative-soft: rgba(248, 113, 113, 0.12);
    --competition-negative-line: rgba(248, 113, 113, 0.38);
  }

  .game-v1-shell.competition-v1-shell {
    width: min(96vw, 68rem);
    height: min(94svh, 48rem);
    display: grid;
    grid-template-rows: auto 1fr auto auto;
    gap: 0.76rem;
    padding: clamp(0.82rem, 1.8vw, 1.1rem);
    border-radius: 1.2rem;
    border: 1px solid color-mix(in srgb, var(--competition-shell-border) 72%, transparent);
    background: color-mix(in srgb, var(--competition-shell-bg) 58%, transparent);
    box-shadow: 0 0.85rem 2rem rgba(42, 26, 32, 0.045);
    overflow: hidden;
  }

  :root[data-theme="dark"] .game-v1-shell.competition-v1-shell {
    box-shadow: 0 0.85rem 2rem rgba(0, 0, 0, 0.22);
  }

  .game-v1-shell.competition-v1-shell[data-state="complete"] {
    position: relative;
    width: min(96vw, 74rem);
    height: auto;
    min-height: 0;
    align-content: start;
    padding: clamp(1.1rem, 2.4vw, 1.85rem);
    border-radius: 1.4rem;
    border: 1px solid rgba(255, 210, 19, 0.22);
    background:
      radial-gradient(circle at top, rgba(255, 210, 19, 0.05), transparent 30%),
      color-mix(in srgb, var(--competition-shell-bg) 58%, transparent);
    box-shadow: 0 0.85rem 2rem rgba(42, 26, 32, 0.05);
    overflow: hidden;
  }

  :root[data-theme="dark"] .game-v1-shell.competition-v1-shell[data-state="complete"] {
    background:
      radial-gradient(circle at top, rgba(255, 210, 19, 0.045), transparent 28%),
      color-mix(in srgb, var(--competition-shell-bg) 58%, transparent);
    box-shadow: 0 0.85rem 2rem rgba(0, 0, 0, 0.24);
  }

  .competition-v1-top {
    width: min(100%, 48rem);
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .game-v1-chip {
    margin: 0;
    min-width: 0;
    width: 100%;
    text-align: center;
    padding: 0.34rem 0.62rem;
    border-radius: 999px;
    border: 1px solid rgba(58, 38, 48, 0.16);
    background: rgba(244, 243, 238, 0.66);
    box-shadow: 0 0.12rem 0.3rem rgba(42, 26, 32, 0.04);
    font-size: 0.72rem;
    line-height: 1;
    font-weight: 560;
  }

  .competition-v1-chip--time {
    border-color: var(--competition-info-line);
    background: var(--competition-info-soft);
    color: var(--competition-info);
  }

  .competition-v1-chip--score {
    border-color: var(--competition-positive-line);
    background: var(--competition-positive-soft);
    color: var(--competition-positive);
  }

  .competition-v1-chip--answered {
    border-color: var(--competition-warning-line);
    background: var(--competition-warning-soft);
    color: var(--competition-warning);
  }

  .competition-v1-chip--urgent {
    border-color: var(--competition-negative-line);
    background: var(--competition-negative-soft);
    color: var(--competition-negative);
  }

  .game-v2-word-wrap {
    display: grid;
    align-content: center;
    justify-items: center;
    width: 100%;
    min-height: 0;
  }

  .game-v1-shell.competition-v1-shell[data-state="complete"] .game-v2-word-wrap {
    display: block;
    align-self: stretch;
  }

  .game-v2-word,
  .competition-v1-word {
    margin: 0;
    color: var(--competition-ink);
    text-align: center;
    text-wrap: balance;
  }

  .game-v2-word {
    font-family: Iowan Old Style, Palatino, "Times New Roman", serif;
    font-size: clamp(4rem, 9vw, 6.4rem);
    line-height: 0.92;
    letter-spacing: -0.05em;
    font-weight: 500;
  }

  .competition-v1-complete-wrap {
    width: min(100%, 68rem);
    margin: 0 auto;
    padding: 0.4rem 0 0.9rem;
  }

  .competition-v1-complete {
    display: grid;
    gap: 0.82rem;
  }

  .competition-v1-complete-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding-top: 0.85rem;
  }

  .competition-v1-complete-hero {
    display: grid;
    justify-items: center;
    gap: 0.28rem;
    width: min(100%, 42rem);
    margin: 0 auto;
    padding: 0.35rem 0 0.72rem;
  }

  .competition-v1-complete-eyebrow {
    margin: 0;
    font-size: 0.68rem;
    line-height: 1;
    font-weight: 720;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--competition-subtle);
  }

  .competition-v1-complete-title {
    font-size: clamp(2.3rem, 4.3vw, 3.45rem);
    line-height: 0.9;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .competition-v1-complete-deck {
    margin: 0;
    font-size: clamp(0.88rem, 1.08vw, 0.98rem);
    line-height: 1.34;
    font-weight: 520;
    color: var(--competition-muted);
    text-align: center;
  }

  .competition-v1-complete-deck-emphasis {
    font-weight: 650;
    color: var(--competition-ink);
  }

  .competition-v1-complete-score-rule {
    margin: 0.12rem 0 0;
    font-size: 0.76rem;
    line-height: 1.34;
    color: var(--competition-muted);
    text-align: center;
  }

  .competition-v1-complete-score-rule strong {
    color: var(--competition-ink);
    font-weight: 700;
  }

  .competition-v1-summary {
    display: grid;
    gap: 0.82rem;
  }

  .competition-v1-summary-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.56rem;
  }

  .competition-v1-summary-card {
    --card-line: rgba(58, 38, 48, 0.11);
    --card-base: rgba(244, 243, 238, 0.82);
    --card-fill: transparent;
    --card-glow: transparent;
    position: relative;
    isolation: isolate;
    overflow: hidden;
    border-radius: 1.02rem;
    border: 1px solid var(--card-line);
    background: linear-gradient(180deg, var(--card-fill), transparent 58%), var(--card-base);
    padding: 0.72rem 0.8rem 0.78rem;
  }

  /* Colour rides the full border + a soft corner glow (like .mode-select-card) — no hard top bar. */
  .competition-v1-summary-card::before {
    content: "";
    position: absolute;
    z-index: -1;
    top: -34%;
    right: -18%;
    width: 5rem;
    height: 5rem;
    border-radius: 999px;
    background: var(--card-glow);
    filter: blur(28px);
    pointer-events: none;
  }

  .competition-v1-summary-card[data-tone="positive"] {
    --card-line: var(--competition-positive-line);
    --card-fill: var(--competition-positive-soft);
    --card-glow: var(--competition-positive-soft);
  }

  .competition-v1-summary-card[data-tone="negative"] {
    --card-line: var(--competition-negative-line);
    --card-fill: var(--competition-negative-soft);
    --card-glow: var(--competition-negative-soft);
  }

  .competition-v1-summary-card[data-tone="warning"] {
    --card-line: var(--competition-warning-line);
    --card-fill: var(--competition-warning-soft);
    --card-glow: var(--competition-warning-soft);
  }

  .competition-v1-summary-card[data-tone="neutral"] {
    --card-line: var(--competition-info-line);
    --card-fill: var(--competition-info-soft);
    --card-glow: var(--competition-info-soft);
  }

  :root[data-theme="dark"] .competition-v1-summary-card {
    --card-base: rgba(18, 18, 23, 0.74);
  }

  .competition-v1-summary-label {
    margin: 0;
    font-size: 0.64rem;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--competition-subtle);
  }

  .competition-v1-summary-value {
    margin: 0.28rem 0 0;
    font-size: clamp(1.08rem, 1.42vw, 1.22rem);
    line-height: 1.02;
    font-weight: 650;
    color: var(--competition-ink);
  }

  .competition-v1-summary-helper {
    margin: 0.26rem 0 0;
    font-size: 0.7rem;
    line-height: 1.22;
    color: var(--competition-muted);
  }

  /* Tone rides the card contour + top rule only; values stay neutral (palette §12). */

  .competition-v1-summary-columns {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.64rem;
    align-items: stretch;
  }

  .competition-v1-panel {
    --panel-line: rgba(58, 38, 48, 0.11);
    --panel-base: rgba(244, 243, 238, 0.78);
    --panel-glow: transparent;
    position: relative;
    isolation: isolate;
    overflow: hidden;
    border-radius: 1.02rem;
    border: 1px solid var(--panel-line);
    background: var(--panel-base);
    padding: 0.82rem 0.9rem;
    display: flex;
    flex-direction: column;
    min-height: 13.6rem;
  }

  /* Family colour rides the border + a soft corner glow (like .mode-select-card) — no hard top bar. */
  .competition-v1-panel::before {
    content: "";
    position: absolute;
    z-index: -1;
    top: -26%;
    right: -12%;
    width: 7rem;
    height: 7rem;
    border-radius: 999px;
    background: var(--panel-glow);
    filter: blur(34px);
    pointer-events: none;
  }

  .competition-v1-panel--speed,
  .competition-v1-panel--timeline {
    --panel-line: var(--competition-info-line);
    --panel-glow: var(--competition-info-soft);
  }

  .competition-v1-panel--category,
  .competition-v1-panel--distribution {
    --panel-line: var(--competition-positive-line);
    --panel-glow: var(--competition-positive-soft);
  }

  .competition-v1-panel--misses {
    --panel-line: var(--competition-negative-line);
    --panel-glow: var(--competition-negative-soft);
  }

  :root[data-theme="dark"] .competition-v1-panel {
    --panel-base: rgba(18, 18, 23, 0.72);
  }

  .competition-v1-panel-header {
    display: grid;
    gap: 0.24rem;
    margin-bottom: 0.76rem;
  }

  .competition-v1-panel-header--compact {
    margin-bottom: 0.92rem;
  }

  .competition-v1-panel-title {
    margin: 0;
    font-size: 0.96rem;
    line-height: 1.2;
    font-weight: 700;
    color: var(--competition-ink);
  }

  /* Panel titles stay neutral; the family colour rides the top-rule contour (palette §12). */

  .competition-v1-panel-caption {
    margin: 0;
    font-size: 0.76rem;
    line-height: 1.42;
    color: var(--competition-muted);
  }

  .competition-v1-speed-graph {
    margin: 0 0 0.78rem;
    display: grid;
    gap: 0.34rem;
  }

  .competition-v1-speed-track {
    position: relative;
    height: 0.42rem;
    border-radius: 999px;
    background: rgba(17, 17, 20, 0.08);
  }

  .competition-v1-speed-marker {
    position: absolute;
    top: 50%;
    width: 0.52rem;
    height: 0.52rem;
    border-radius: 999px;
    transform: translate(-50%, -50%);
    border: 2px solid #f4f3ee;
    background: #111114;
  }

  :root[data-theme="dark"] .competition-v1-speed-track {
    background: rgba(244, 243, 238, 0.12);
  }

  :root[data-theme="dark"] .competition-v1-speed-marker {
    border-color: #121217;
    background: #f4f3ee;
  }

  .competition-v1-speed-legend {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.66rem;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--competition-subtle);
  }

  .competition-v1-detail-list {
    margin: 0;
    display: grid;
    gap: 0.34rem;
  }

  .competition-v1-detail-list > div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.8rem;
    padding-bottom: 0.34rem;
    border-bottom: 1px solid rgba(58, 38, 48, 0.08);
  }

  .competition-v1-detail-list > div:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .competition-v1-detail-list dt,
  .competition-v1-detail-list dd {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.32;
  }

  .competition-v1-detail-list dt {
    color: var(--competition-muted);
  }

  .competition-v1-detail-list dd {
    font-weight: 650;
    color: var(--competition-ink);
  }

  .competition-v1-stack-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.34rem;
  }

  .competition-v1-stack-list li {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.8rem;
    font-size: 0.8rem;
    line-height: 1.32;
    padding-bottom: 0.34rem;
    border-bottom: 1px solid rgba(58, 38, 48, 0.08);
  }

  .competition-v1-stack-list li:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .competition-v1-stack-list span,
  .competition-v1-stack-list small {
    color: var(--competition-muted);
  }

  .competition-v1-stack-list strong {
    color: var(--competition-ink);
    font-weight: 650;
    text-align: right;
  }

  /* Miss values stay neutral; the red signal rides the panel top-rule contour (palette §12). */

  .competition-v1-stack-list div,
  .competition-v1-mix-meta {
    display: grid;
    gap: 0.08rem;
  }

  .competition-v1-mix-meta {
    justify-items: end;
  }

  .competition-v1-mix-meta small {
    font-size: 0.72rem;
    line-height: 1.2;
    color: var(--competition-subtle);
  }

  .competition-v1-empty {
    margin: 0;
    font-size: 0.76rem;
    line-height: 1.3;
    color: var(--competition-muted);
  }

  .competition-v1-graphs-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.64rem;
    align-items: start;
  }

  .competition-v1-line-chart {
    display: grid;
    gap: 0.54rem;
  }

  .competition-v1-line-chart-svg {
    width: 100%;
    height: 13rem;
    overflow: visible;
    shape-rendering: geometricPrecision;
  }

  .competition-v1-line-grid line {
    stroke: rgba(58, 38, 48, 0.14);
    stroke-width: 0.26;
  }

  :root[data-theme="dark"] .competition-v1-line-grid line {
    stroke: rgba(244, 243, 238, 0.14);
  }

  .competition-v1-line-grid--vertical line {
    stroke-dasharray: 0.75 1.5;
  }

  .competition-v1-line-axis-strokes line {
    stroke: rgba(58, 38, 48, 0.76);
    stroke-width: 0.34;
  }

  :root[data-theme="dark"] .competition-v1-line-axis-strokes line {
    stroke: rgba(244, 243, 238, 0.76);
  }

  .competition-v1-line-path {
    fill: none;
    stroke: currentColor;
    stroke-width: 0.54;
    stroke-linecap: butt;
    stroke-linejoin: miter;
  }

  .competition-v1-line-path--pace,
  .competition-v1-line-path--score {
    color: #111114;
  }

  :root[data-theme="dark"] .competition-v1-line-path--pace,
  :root[data-theme="dark"] .competition-v1-line-path--score {
    color: #f4f3ee;
  }

  .competition-v1-line-point {
    stroke: currentColor;
    stroke-width: 0.42;
    stroke-linecap: square;
    color: #111114;
  }

  :root[data-theme="dark"] .competition-v1-line-point {
    color: #f4f3ee;
  }

  .competition-v1-line-axis {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.66rem;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--competition-subtle);
  }

  .game-v2-options {
    width: min(100%, 34rem);
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.72rem;
  }

  .game-v2-option {
    position: relative;
    min-height: 5.2rem;
    border-radius: 1.08rem;
    border: 1px solid rgba(58, 38, 48, 0.12);
    background: rgba(244, 243, 238, 0.86);
    box-shadow: 0 0.3rem 0.9rem rgba(42, 26, 32, 0.08);
    cursor: pointer;
    transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease;
  }

  .game-v2-option::before {
    content: "";
    position: absolute;
    left: 0.7rem;
    top: 0.72rem;
    bottom: 0.72rem;
    width: 0.22rem;
    border-radius: 999px;
    background: var(--card-color, #8ea2ff);
  }

  .game-v2-option:hover,
  .game-v2-option:focus-visible {
    transform: translateY(-1px);
    border-color: rgba(58, 38, 48, 0.2);
    box-shadow: 0 0.45rem 1rem rgba(42, 26, 32, 0.1);
  }

  .game-v2-option.is-selected,
  .game-v2-option.is-correct,
  .game-v2-option.is-wrong {
    border-color: color-mix(in srgb, var(--card-color, #8ea2ff) 44%, rgba(58, 38, 48, 0.14));
  }

  .game-v2-option-label {
    display: grid;
    place-items: center;
    min-height: 100%;
    padding: 1rem 1.2rem 1rem 1.6rem;
    text-align: center;
    font-size: 1.05rem;
    line-height: 1.16;
    font-weight: 620;
    color: var(--competition-ink);
  }

  .game-v2-feedback {
    margin: 0;
    min-height: 1.4rem;
    text-align: center;
    font-size: 0.86rem;
    line-height: 1.35;
    color: var(--competition-muted);
  }

  .game-v2-feedback[data-state="correct"] {
    color: var(--competition-positive);
  }

  .game-v2-feedback[data-state="wrong"] {
    color: var(--competition-negative);
  }

  .game-v2-actions {
    margin-top: 0.25rem;
    display: grid;
    justify-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .game-v2-validate {
    border: none;
    background: transparent;
    color: #3a2630;
    text-decoration: underline;
    text-underline-offset: 0.2rem;
    text-transform: lowercase;
    font-family: Iowan Old Style, Palatino, "Times New Roman", serif;
    font-style: italic;
    font-size: clamp(1.05rem, 2vw, 1.44rem);
    font-weight: 600;
    padding: 0.2rem 0.4rem;
    cursor: pointer;
  }

  :root[data-theme="dark"] .game-v2-validate {
    color: #f4f3ee;
  }

  .game-v2-validate:disabled {
    opacity: 0.34;
    cursor: not-allowed;
  }

  .game-link {
    justify-self: start;
    margin-top: 0.2rem;
    padding: 0.56rem 0.94rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    text-decoration: none;
    color: currentColor;
    font-size: 0.86rem;
    line-height: 1;
    font-weight: 600;
  }

  /* Validated button pair (matches .onboarding-btn): same geometry, primary = white pill, secondary = ghost. */
  .competition-v1-cta,
  .competition-v1-complete-actions .game-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 9.4rem;
    min-height: 2.95rem;
    padding: 0.82rem 1.75rem;
    border-radius: 999px;
    font-family: inherit;
    font-style: normal;
    font-size: 0.92rem;
    font-weight: 620;
    line-height: 1;
    text-decoration: none;
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
  }

  .competition-v1-cta {
    border: 1px solid rgba(244, 243, 238, 0.12);
    color: #0d1018;
    background: linear-gradient(180deg, rgba(244, 243, 238, 0.9), rgba(244, 243, 238, 0.92)), #f4f3ee;
    box-shadow: inset 0 1px 0 rgba(244, 243, 238, 0.92), 0 0.2rem 0.5rem rgba(0, 0, 0, 0.16);
  }

  .competition-v1-cta:hover,
  .competition-v1-cta:focus-visible {
    transform: translateY(-1px);
    box-shadow: inset 0 1px 0 rgba(244, 243, 238, 1), 0 0.32rem 0.75rem rgba(0, 0, 0, 0.18);
  }

  .competition-v1-complete-actions .game-link {
    justify-self: auto;
    margin-top: 0;
    border: 1px solid var(--line-strong);
    background: var(--surface-strong);
    color: var(--ink-strong);
  }

  .competition-v1-complete-actions .game-link:hover,
  .competition-v1-complete-actions .game-link:focus-visible {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--ink-strong) 38%, transparent);
  }

  @media (max-width: 900px) {
    .competition-v1-summary-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .competition-v1-summary-columns {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .competition-v1-panel--speed {
      grid-column: 1 / -1;
      min-height: auto;
    }
  }

  @media (max-width: 640px) {
    .game-v1-page.game-v2-page {
      padding: 0.68rem;
    }

    .game-v1-shell.competition-v1-shell {
      width: min(96vw, 32rem);
      height: min(95svh, 42rem);
      padding: 0.88rem 0.74rem;
      gap: 0.72rem;
    }

    .competition-v1-top,
    .competition-v1-summary-grid,
    .competition-v1-summary-columns,
    .competition-v1-graphs-grid,
    .game-v2-options {
      grid-template-columns: 1fr;
    }

    .game-v2-word {
      font-size: clamp(3rem, 16vw, 4.4rem);
    }
  }
`;

const buildPreviewSummary = (): CompetitionSessionSummary => ({
  wrongCount: 7,
  accuracyRate: 65,
  fastAnswerCount: 6,
  answersPerMinute: 9.5,
  pointsPerMinute: 6,
  averagePointsPerAnswer: 0.6,
  averageResponseTimeMs: 1480,
  averageCorrectResponseTimeMs: 1280,
  averageWrongResponseTimeMs: 1870,
  fastestResponseTimeMs: 620,
  slowestResponseTimeMs: 2890,
  bestCorrectStreak: 4,
  uniqueTypefacesSeenCount: 19,
  categoryPerformance: [
    { category: "sans_serif", answeredCount: 8, correctCount: 6, accuracyRate: 75 },
    { category: "serif", answeredCount: 7, correctCount: 4, accuracyRate: 57.1 },
    { category: "mono", answeredCount: 4, correctCount: 3, accuracyRate: 75 },
    { category: "display", answeredCount: 1, correctCount: 0, accuracyRate: 0 },
  ],
  strongestCategories: [
    { category: "sans_serif", answeredCount: 8, correctCount: 6, accuracyRate: 75 },
    { category: "mono", answeredCount: 4, correctCount: 3, accuracyRate: 75 },
  ],
  weakestCategories: [
    { category: "display", answeredCount: 1, correctCount: 0, accuracyRate: 0 },
    { category: "serif", answeredCount: 7, correctCount: 4, accuracyRate: 57.1 },
  ],
  commonConfusions: [
    {
      correctSlug: "ibmplexmono",
      correctLabel: "IBM Plex Mono",
      guessedSlug: "firacode",
      guessedLabel: "Fira Code",
      count: 2,
    },
    {
      correctSlug: "spectral",
      correctLabel: "Spectral",
      guessedSlug: "tinos",
      guessedLabel: "Tinos",
      count: 2,
    },
    {
      correctSlug: "publicsans",
      correctLabel: "Public Sans",
      guessedSlug: "inter",
      guessedLabel: "Inter",
      count: 1,
    },
  ],
  recentMisses: [
    {
      correctSlug: "spectral",
      correctLabel: "Spectral",
      guessedSlug: "tinos",
      guessedLabel: "Tinos",
      responseTimeMs: 1680,
      displayWord: "contraste",
      category: "serif",
    },
    {
      correctSlug: "ibmplexmono",
      correctLabel: "IBM Plex Mono",
      guessedSlug: "firacode",
      guessedLabel: "Fira Code",
      responseTimeMs: 1140,
      displayWord: "epaisseur",
      category: "mono",
    },
    {
      correctSlug: "playfair_display",
      correctLabel: "Playfair Display",
      guessedSlug: "ebgaramond",
      guessedLabel: "EB Garamond",
      responseTimeMs: 2220,
      displayWord: "ligne",
      category: "serif",
    },
  ],
  answerTimeline: [
    { answerIndex: 1, responseTimeMs: 1820, isCorrect: false, awardedPoints: 0 },
    { answerIndex: 2, responseTimeMs: 890, isCorrect: true, awardedPoints: 2 },
    { answerIndex: 3, responseTimeMs: 1430, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 4, responseTimeMs: 1190, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 5, responseTimeMs: 2260, isCorrect: false, awardedPoints: 0 },
    { answerIndex: 6, responseTimeMs: 980, isCorrect: true, awardedPoints: 2 },
    { answerIndex: 7, responseTimeMs: 1340, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 8, responseTimeMs: 1510, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 9, responseTimeMs: 2720, isCorrect: false, awardedPoints: 0 },
    { answerIndex: 10, responseTimeMs: 640, isCorrect: true, awardedPoints: 2 },
    { answerIndex: 11, responseTimeMs: 830, isCorrect: true, awardedPoints: 2 },
    { answerIndex: 12, responseTimeMs: 1570, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 13, responseTimeMs: 1710, isCorrect: false, awardedPoints: 0 },
    { answerIndex: 14, responseTimeMs: 1280, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 15, responseTimeMs: 760, isCorrect: true, awardedPoints: 2 },
    { answerIndex: 16, responseTimeMs: 1450, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 17, responseTimeMs: 2890, isCorrect: false, awardedPoints: 0 },
    { answerIndex: 18, responseTimeMs: 1030, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 19, responseTimeMs: 920, isCorrect: true, awardedPoints: 2 },
    { answerIndex: 20, responseTimeMs: 1680, isCorrect: false, awardedPoints: 0 },
  ],
  speedBuckets: [
    { label: "<1s", count: 6, percentage: 30, tone: "positive" },
    { label: "1-2s", count: 9, percentage: 45, tone: "neutral" },
    { label: "2-3s", count: 5, percentage: 25, tone: "warning" },
    { label: "3s+", count: 0, percentage: 0, tone: "negative" },
  ],
});

export default function CompetitionScreen() {
  const searchParams = useSearchParams();
  const previewMode = searchParams.get("preview");
  const isCompletePreview = previewMode === "complete";
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<CompetitionQuestion | null>(null);
  const [stats, setStats] = useState<CompetitionStats | null>(null);
  const [summary, setSummary] = useState<CompetitionSessionSummary | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [isComplete, setIsComplete] = useState(false);
  const [isRoundLocked, setIsRoundLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inlineFeedback, setInlineFeedback] = useState<InlineFeedback>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const advanceTimerRef = useRef<number | null>(null);
  const feedbackClearTimerRef = useRef<number | null>(null);
  const pendingAdvanceRef = useRef<(() => void) | null>(null);
  const clockOffsetRef = useRef(0);
  const attemptStartedAtRef = useRef<number>(Date.now());
  const timeoutTriggeredRef = useRef(false);

  const getNowMs = useCallback(() => Date.now() + clockOffsetRef.current, []);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    pendingAdvanceRef.current = null;
  }, []);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackClearTimerRef.current !== null) {
      window.clearTimeout(feedbackClearTimerRef.current);
      feedbackClearTimerRef.current = null;
    }
  }, []);

  const scheduleFeedbackClear = useCallback((delayMs: number) => {
    clearFeedbackTimer();
    feedbackClearTimerRef.current = window.setTimeout(() => {
      setInlineFeedback(null);
      feedbackClearTimerRef.current = null;
    }, delayMs);
  }, [clearFeedbackTimer]);

  const beginQuestion = useCallback((nextQuestion: CompetitionQuestion) => {
    ensureCompetitionFontFace(nextQuestion.fontFace);
    setQuestion(nextQuestion);
    setSelectedId("");
    setResult("idle");
    setIsRoundLocked(false);
    attemptStartedAtRef.current = getNowMs();
  }, [getNowMs]);

  const flushAdvance = useCallback(() => {
    if (!pendingAdvanceRef.current) return;
    const next = pendingAdvanceRef.current;
    clearAdvanceTimer();
    next();
  }, [clearAdvanceTimer]);

  const queueAdvance = useCallback(
    (nextStep: () => void, delayMs: number) => {
      clearAdvanceTimer();
      pendingAdvanceRef.current = nextStep;
      advanceTimerRef.current = window.setTimeout(() => {
        flushAdvance();
      }, delayMs);
    },
    [clearAdvanceTimer, flushAdvance]
  );

  const startSession = useCallback(async () => {
    clearAdvanceTimer();
    timeoutTriggeredRef.current = false;
    clockOffsetRef.current = 0;
    setClockNow(Date.now());
    setIsLoading(true);
    setError(null);
    setIsComplete(false);
    setSessionId(null);
    setQuestion(null);
    setStats(null);
    setSummary(null);
    setSelectedId("");
    setResult("idle");
    setInlineFeedback(null);
    setIsRoundLocked(false);

    try {
      const response = await fetch("/api/competition/session/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locale: getPreferredLocale() }),
      });

      if (!response.ok) {
        throw new Error("competition_session_start_failed");
      }

      const payload = (await response.json()) as CompetitionStartResponse;
      setSessionId(payload.sessionId);
      setStats(payload.stats);
      beginQuestion(payload.question);
      setClockNow(getNowMs());
    } catch (sessionError) {
      console.error(sessionError);
      setError("Unable to start the competition session.");
    } finally {
      setIsLoading(false);
    }
  }, [beginQuestion, clearAdvanceTimer, getNowMs]);

  useEffect(() => {
    if (isCompletePreview) {
      const totalDurationMs = 120_000;
      setSessionId("competition-preview-complete");
      setQuestion(null);
      setStats({
        answeredCount: 20,
        correctCount: 13,
        score: 12,
        totalDurationMs,
        remainingMs: 0,
        deadlineUtc: new Date(Date.now() - totalDurationMs).toISOString(),
      });
      setSummary(buildPreviewSummary());
      setSelectedId("");
      setResult("idle");
      setInlineFeedback(null);
      setError(null);
      setIsRoundLocked(false);
      setIsComplete(true);
      setIsLoading(false);
      timeoutTriggeredRef.current = true;
      return () => {
        clearAdvanceTimer();
        clearFeedbackTimer();
      };
    }

    void startSession();

    return () => {
      clearAdvanceTimer();
      clearFeedbackTimer();
    };
  }, [clearAdvanceTimer, clearFeedbackTimer, isCompletePreview, startSession]);

  useEffect(() => {
    if (!sessionId || !stats || isComplete) {
      return;
    }

    const timer = window.setInterval(() => {
      setClockNow(getNowMs());
    }, 200);

    return () => {
      window.clearInterval(timer);
    };
  }, [getNowMs, isComplete, sessionId, stats]);

  const remainingMs = useMemo(() => {
    if (!stats) return 0;
    return Math.max(0, new Date(stats.deadlineUtc).getTime() - clockNow);
  }, [clockNow, stats]);

  useEffect(() => {
    // Automation hooks, development only. `advanceTime` moves the competition
    // clock, so production must never install them.
    if (!isDevRuntime()) return;

    window.render_game_to_text = () =>
      JSON.stringify({
        mode: "competition",
        status: isLoading ? "loading" : error ? "error" : isComplete ? "complete" : "playing",
        sessionId,
        stats: stats
          ? {
              ...stats,
              remainingMs,
            }
          : null,
        question: question
          ? {
              id: question.id,
              displayWord: question.displayWord,
              typefaceSlug: question.typefaceSlug,
              options: question.options,
            }
          : null,
        summary,
        inlineFeedback,
        selectedId,
        result,
      });

    window.advanceTime = (ms: number) => {
      clockOffsetRef.current += ms;
      setClockNow(getNowMs());
      if (ms >= COMPETITION_FEEDBACK_DELAY_MS) {
        flushAdvance();
      }
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [error, flushAdvance, getNowMs, inlineFeedback, isComplete, isLoading, question, remainingMs, result, selectedId, sessionId, stats, summary]);

  useEffect(() => {
    if (
      !sessionId ||
      !stats ||
      isComplete ||
      isLoading ||
      error ||
      isRoundLocked ||
      timeoutTriggeredRef.current ||
      remainingMs > 0
    ) {
      return;
    }

    timeoutTriggeredRef.current = true;

    void (async () => {
      try {
        const response = await fetch("/api/competition/session/timeout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          throw new Error("competition_timeout_failed");
        }

        const payload = (await response.json()) as CompetitionTimeoutResponse;
        setStats(payload.stats);
        setSummary(payload.summary);
        setQuestion(null);
        setSelectedId("");
        setResult("idle");
        setInlineFeedback({ kind: "wrong", text: payload.feedbackText });
        setIsComplete(true);
      } catch (timeoutError) {
        console.error(timeoutError);
        setError("Unable to close the competition session.");
      }
    })();
  }, [error, isComplete, isLoading, isRoundLocked, remainingMs, sessionId, stats]);

  const handleSelect = useCallback(
    async (optionId: string) => {
      if (!sessionId || !question || isComplete || isLoading || isRoundLocked) {
        return;
      }

      setSelectedId(optionId);
      setError(null);
      clearFeedbackTimer();
      setInlineFeedback(null);
      setIsRoundLocked(true);

      try {
        const response = await fetch("/api/competition/answer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            questionToken: question.token,
            answerSlug: optionId,
            responseTimeMs: Math.max(0, Math.round(getNowMs() - attemptStartedAtRef.current)),
          }),
        });

        if (!response.ok) {
          throw new Error("competition_answer_failed");
        }

        const payload = (await response.json()) as CompetitionAnswerResponse | CompetitionTimeoutResponse;
        setStats(payload.stats);

        if (!("result" in payload)) {
          setSummary(payload.summary);
          setQuestion(null);
          setSelectedId(optionId);
          setResult("idle");
          setInlineFeedback({ kind: "wrong", text: payload.feedbackText });
          setIsRoundLocked(false);
          setIsComplete(true);
          return;
        }

        if (payload.sessionComplete) {
          setSummary(payload.summary ?? null);
          setQuestion(null);
          setSelectedId(optionId);
          setResult("idle");
          setInlineFeedback({
            kind: payload.result,
            text: `${payload.feedbackText} · ${formatClickTime(payload.responseTimeMs)}`,
          });
          setIsRoundLocked(false);
          setIsComplete(true);
          return;
        }

        setResult(payload.result);
        setInlineFeedback({
          kind: payload.result,
          text: `${payload.feedbackText} · ${formatClickTime(payload.responseTimeMs)}`,
        });
        scheduleFeedbackClear(COMPETITION_FEEDBACK_PERSIST_MS);

        // Inject the next face now so its woff2 has a head start during the
        // short feedback delay before beginQuestion renders it.
        ensureCompetitionFontFace(payload.nextQuestion?.fontFace);

        queueAdvance(() => {
          if (payload.nextQuestion) {
            beginQuestion(payload.nextQuestion);
            return;
          }

          setIsComplete(true);
          setQuestion(null);
          setSelectedId("");
          setResult("idle");
          setInlineFeedback(null);
          setIsRoundLocked(false);
        }, COMPETITION_FEEDBACK_DELAY_MS);
      } catch (submitError) {
        console.error(submitError);
        setError("Unable to submit this answer.");
        setIsRoundLocked(false);
      }
    },
    [
      beginQuestion,
      clearFeedbackTimer,
      getNowMs,
      isComplete,
      isLoading,
      isRoundLocked,
      question,
      queueAdvance,
      scheduleFeedbackClear,
      sessionId,
    ]
  );

  const currentQuestion = question;
  const summaryCards = summary
    ? [
        {
          label: "Score",
          value: String(stats?.score ?? 0),
          helper: "competition points",
          tone: "positive",
        },
        {
          label: "Fast answers",
          value: String(summary.fastAnswerCount),
          helper: "under 2 seconds",
          tone: "positive",
        },
        {
          label: "Avg. click",
          value:
            summary.averageResponseTimeMs === null
              ? "—"
              : formatClickTime(summary.averageResponseTimeMs),
          helper: "all answers",
          tone: "neutral",
        },
        {
          label: "Best streak",
          value: String(summary.bestCorrectStreak),
          helper: "correct in a row",
          tone: "positive",
        },
        {
          label: "Unique typefaces",
          value: String(summary.uniqueTypefacesSeenCount),
          helper: "shown in session",
          tone: "warning",
        },
      ]
    : [];

  const speedGraph =
    summary &&
    summary.fastestResponseTimeMs !== null &&
    summary.slowestResponseTimeMs !== null &&
    summary.averageResponseTimeMs !== null
      ? {
          fastest: 0,
          average:
            summary.slowestResponseTimeMs === summary.fastestResponseTimeMs
              ? 50
              : clampPercent(
                  ((summary.averageResponseTimeMs - summary.fastestResponseTimeMs) /
                    (summary.slowestResponseTimeMs - summary.fastestResponseTimeMs)) *
                    100
                ),
          slowest: 100,
        }
      : null;

  const responseLineChart = summary
    ? (() => {
        const minX = 4;
        const maxX = 96;
        const minY = 5;
        const maxY = 37;
        const minResponse = Math.min(
          ...summary.answerTimeline.map((entry) => entry.responseTimeMs)
        );
        const maxResponse = Math.max(
          ...summary.answerTimeline.map((entry) => entry.responseTimeMs)
        );

        const points = summary.answerTimeline.map((entry, index) => {
          const x =
            summary.answerTimeline.length === 1
              ? 50
              : minX + (index / (summary.answerTimeline.length - 1)) * (maxX - minX);
          const normalized =
            maxResponse === minResponse
              ? 0.5
              : (entry.responseTimeMs - minResponse) / (maxResponse - minResponse);
          const y = minY + normalized * (maxY - minY);
          return {
            ...entry,
            x,
            y,
            tone: entry.isCorrect ? "positive" : "negative",
          };
        });

        return {
          path: buildLinePath(points),
          points,
        };
      })()
    : null;

  const scoreLineChart = summary
    ? (() => {
        const minX = 4;
        const maxX = 96;
        const minY = 5;
        const maxY = 37;
        let runningScore = 0;
        const maxRunningScore = Math.max(
          1,
          summary.answerTimeline.reduce((total, entry) => total + entry.awardedPoints, 0)
        );

        const points = summary.answerTimeline.map((entry, index) => {
          runningScore += entry.awardedPoints;
          const x =
            summary.answerTimeline.length === 1
              ? 50
              : minX + (index / (summary.answerTimeline.length - 1)) * (maxX - minX);
          const normalized = runningScore / maxRunningScore;
          const y = maxY - normalized * (maxY - minY);
          return {
            ...entry,
            cumulativeScore: runningScore,
            x,
            y,
            tone:
              entry.awardedPoints >= 2
                ? "positive"
                : entry.awardedPoints === 1
                  ? "neutral"
                  : "negative",
          };
        });

        return {
          path: buildLinePath(points),
          points,
        };
      })()
    : null;

  const categoryMixTotal = summary
    ? summary.categoryPerformance.reduce((total, entry) => total + entry.answeredCount, 0)
    : 0;

  return (
    <main className="game-v1-page game-v2-page">
      <ThemeSwitch />
      <section
        className="game-v1-shell game-v2-shell competition-v1-shell"
        data-state={isComplete ? "complete" : "playing"}
        aria-label="Competition mode"
        aria-busy={isLoading || isRoundLocked}
      >
        {stats && !isComplete ? (
          <div className="game-v1-top competition-v1-top">
            <p
              className={`game-v1-chip competition-v1-chip competition-v1-chip--time${
                remainingMs <= 30_000 ? " competition-v1-chip--urgent" : ""
              }`}
            >
              Time {formatRemaining(remainingMs)}
            </p>
            <p className="game-v1-chip competition-v1-chip competition-v1-chip--score">
              Score {stats.score}
            </p>
            <p className="game-v1-chip competition-v1-chip competition-v1-chip--answered">
              Answered {stats.answeredCount}
            </p>
          </div>
        ) : null}

        <div className="game-v2-word-wrap">
          {isLoading ? (
            <h1 className="game-v2-word competition-v1-word">Loading competition</h1>
          ) : isComplete ? (
            <div className="competition-v1-complete-wrap">
              <div className="competition-v1-complete">
                <div className="competition-v1-complete-hero">
                  <p className="competition-v1-complete-eyebrow">Competition summary</p>
                  <h1 className="game-v2-word competition-v1-word competition-v1-complete-title">
                    Time is up
                  </h1>
                  {stats && summary ? (
                    <>
                      <p className="competition-v1-complete-deck">
                        <span className="competition-v1-complete-deck-emphasis competition-v1-complete-deck-emphasis--score">
                          {stats.correctCount}/{stats.answeredCount} correct
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span className="competition-v1-complete-deck-emphasis competition-v1-complete-deck-emphasis--accuracy">
                          {formatRate(summary.accuracyRate)} accuracy
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span className="competition-v1-complete-deck-emphasis competition-v1-complete-deck-emphasis--review">
                          {stats.answeredCount} answers reviewed
                        </span>
                      </p>
                      <p className="competition-v1-complete-score-rule">
                        Scoring: <strong>+2</strong> fast, <strong>+1</strong> correct,{" "}
                        <strong>0</strong> wrong
                      </p>
                    </>
                  ) : null}
                </div>

                {summary ? (
                  <div className="competition-v1-summary">
                    <section className="competition-v1-summary-grid" aria-label="Competition summary metrics">
                      {summaryCards.map((card) => (
                        <article
                          key={card.label}
                          className="competition-v1-summary-card"
                          data-tone={card.tone}
                        >
                          <p className="competition-v1-summary-label">{card.label}</p>
                          <p className="competition-v1-summary-value">{card.value}</p>
                          <p className="competition-v1-summary-helper">{card.helper}</p>
                        </article>
                      ))}
                    </section>

                    <div className="competition-v1-summary-columns">
                      <section className="competition-v1-panel competition-v1-panel--speed">
                        <div className="competition-v1-panel-header competition-v1-panel-header--compact">
                          <div>
                            <h2 className="competition-v1-panel-title">Speed profile</h2>
                            <p className="competition-v1-panel-caption">
                              Timing landmarks across this run.
                            </p>
                          </div>
                        </div>
                        {speedGraph ? (
                          <div className="competition-v1-speed-graph" aria-hidden="true">
                            <div className="competition-v1-speed-track">
                              <span
                                className="competition-v1-speed-marker competition-v1-speed-marker--fast"
                                style={{ left: `${speedGraph.fastest}%` }}
                              />
                              <span
                                className="competition-v1-speed-marker competition-v1-speed-marker--avg"
                                style={{ left: `${speedGraph.average}%` }}
                              />
                              <span
                                className="competition-v1-speed-marker competition-v1-speed-marker--slow"
                                style={{ left: `${speedGraph.slowest}%` }}
                              />
                            </div>
                            <div className="competition-v1-speed-legend">
                              <span>fast</span>
                              <span>avg</span>
                              <span>slow</span>
                            </div>
                          </div>
                        ) : null}
                        <dl className="competition-v1-detail-list">
                          <div>
                            <dt>Average click</dt>
                            <dd>
                              {summary.averageResponseTimeMs === null
                                ? "—"
                                : formatClickTime(summary.averageResponseTimeMs)}
                            </dd>
                          </div>
                          <div>
                            <dt>Fastest click</dt>
                            <dd>
                              {summary.fastestResponseTimeMs === null
                                ? "—"
                                : formatClickTime(summary.fastestResponseTimeMs)}
                            </dd>
                          </div>
                          <div>
                            <dt>Slowest click</dt>
                            <dd>
                              {summary.slowestResponseTimeMs === null
                                ? "—"
                                : formatClickTime(summary.slowestResponseTimeMs)}
                            </dd>
                          </div>
                          <div>
                            <dt>Average on correct</dt>
                            <dd>
                              {summary.averageCorrectResponseTimeMs === null
                                ? "—"
                                : formatClickTime(summary.averageCorrectResponseTimeMs)}
                            </dd>
                          </div>
                          <div>
                            <dt>Average on wrong</dt>
                            <dd>
                              {summary.averageWrongResponseTimeMs === null
                                ? "—"
                                : formatClickTime(summary.averageWrongResponseTimeMs)}
                            </dd>
                          </div>
                          <div>
                            <dt>Points / answer</dt>
                            <dd>{formatMetric(summary.averagePointsPerAnswer)}</dd>
                          </div>
                        </dl>
                      </section>

                      <section className="competition-v1-panel competition-v1-panel--category">
                        <div className="competition-v1-panel-header competition-v1-panel-header--compact">
                          <div>
                            <h2 className="competition-v1-panel-title">Category mix</h2>
                            <p className="competition-v1-panel-caption">
                              Families encountered in this run.
                            </p>
                          </div>
                        </div>
                        {summary.categoryPerformance.length > 0 ? (
                          <ul className="competition-v1-stack-list">
                            {summary.categoryPerformance.slice(0, 6).map((entry) => {
                              const share =
                                categoryMixTotal === 0
                                  ? 0
                                  : Math.round((entry.answeredCount / categoryMixTotal) * 100);

                              return (
                                <li key={entry.category}>
                                  <span>{formatCategoryLabel(entry.category)}</span>
                                  <div className="competition-v1-mix-meta">
                                    <strong>
                                      {entry.answeredCount}{" "}
                                      {entry.answeredCount === 1 ? "answer" : "answers"}
                                    </strong>
                                    <small>{share}% of run</small>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="competition-v1-empty">No category data yet.</p>
                        )}
                      </section>

                      <section className="competition-v1-panel competition-v1-panel--misses">
                        <div className="competition-v1-panel-header competition-v1-panel-header--compact">
                          <div>
                            <h2 className="competition-v1-panel-title">Recent misses</h2>
                            <p className="competition-v1-panel-caption">
                              Latest incorrect calls from the session.
                            </p>
                          </div>
                        </div>
                        {summary.recentMisses.length > 0 ? (
                          <ul className="competition-v1-stack-list">
                            {summary.recentMisses.map((entry) => (
                              <li key={`${entry.correctSlug}-${entry.guessedSlug}-${entry.displayWord}`}>
                                <div>
                                  <span>{entry.guessedLabel} instead of {entry.correctLabel}</span>
                                  <small>
                                    {entry.displayWord} · {formatCategoryLabel(entry.category)}
                                  </small>
                                </div>
                                <strong>{formatClickTime(entry.responseTimeMs)}</strong>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="competition-v1-empty">No misses on this run.</p>
                        )}
                      </section>
                    </div>

                    <div className="competition-v1-graphs-grid">
                      <section className="competition-v1-panel competition-v1-panel--timeline">
                        <div className="competition-v1-panel-header">
                          <div>
                            <h2 className="competition-v1-panel-title">Response pace</h2>
                            <p className="competition-v1-panel-caption">
                              Click time across the run. Each cross marks one answer.
                            </p>
                          </div>
                        </div>
                        {responseLineChart ? (
                          <div className="competition-v1-line-chart" aria-label="Response pace chart">
                            <svg
                              className="competition-v1-line-chart-svg"
                              viewBox="0 0 100 42"
                              preserveAspectRatio="none"
                            >
                              <g
                                className="competition-v1-line-grid competition-v1-line-grid--horizontal"
                                aria-hidden="true"
                              >
                                {LINE_CHART_Y_GUIDES.map((y) => (
                                  <line key={`pace-y-${y}`} x1="4" y1={y} x2="96" y2={y} />
                                ))}
                              </g>
                              <g
                                className="competition-v1-line-grid competition-v1-line-grid--vertical"
                                aria-hidden="true"
                              >
                                {LINE_CHART_X_GUIDES.map((x) => (
                                  <line key={`pace-x-${x}`} x1={x} y1="5" x2={x} y2="37" />
                                ))}
                              </g>
                              <g className="competition-v1-line-axis-strokes" aria-hidden="true">
                                <line x1="4" y1="5" x2="4" y2="37" />
                                <line x1="4" y1="37" x2="96" y2="37" />
                              </g>
                              <path
                                className="competition-v1-line-path competition-v1-line-path--pace"
                                d={responseLineChart.path}
                              />
                              {responseLineChart.points.map((point) => (
                                <g
                                  key={`pace-${point.answerIndex}`}
                                  className="competition-v1-line-point"
                                  data-tone={point.tone}
                                >
                                  <line x1={point.x - 0.88} y1={point.y} x2={point.x + 0.88} y2={point.y} />
                                  <line x1={point.x} y1={point.y - 0.88} x2={point.x} y2={point.y + 0.88} />
                                </g>
                              ))}
                            </svg>
                            <div className="competition-v1-line-axis">
                              <span>Fast</span>
                              <span>Answer index</span>
                              <span>Slow</span>
                            </div>
                          </div>
                        ) : (
                          <p className="competition-v1-empty">No response pace data yet.</p>
                        )}
                      </section>

                      <section className="competition-v1-panel competition-v1-panel--distribution">
                        <div className="competition-v1-panel-header">
                          <div>
                            <h2 className="competition-v1-panel-title">Score trajectory</h2>
                            <p className="competition-v1-panel-caption">
                              Cumulative score across the run.
                            </p>
                          </div>
                        </div>
                        {scoreLineChart ? (
                          <div className="competition-v1-line-chart" aria-label="Score trajectory chart">
                            <svg
                              className="competition-v1-line-chart-svg"
                              viewBox="0 0 100 42"
                              preserveAspectRatio="none"
                            >
                              <g
                                className="competition-v1-line-grid competition-v1-line-grid--horizontal"
                                aria-hidden="true"
                              >
                                {LINE_CHART_Y_GUIDES.map((y) => (
                                  <line key={`score-y-${y}`} x1="4" y1={y} x2="96" y2={y} />
                                ))}
                              </g>
                              <g
                                className="competition-v1-line-grid competition-v1-line-grid--vertical"
                                aria-hidden="true"
                              >
                                {LINE_CHART_X_GUIDES.map((x) => (
                                  <line key={`score-x-${x}`} x1={x} y1="5" x2={x} y2="37" />
                                ))}
                              </g>
                              <g className="competition-v1-line-axis-strokes" aria-hidden="true">
                                <line x1="4" y1="5" x2="4" y2="37" />
                                <line x1="4" y1="37" x2="96" y2="37" />
                              </g>
                              <path
                                className="competition-v1-line-path competition-v1-line-path--score"
                                d={scoreLineChart.path}
                              />
                              {scoreLineChart.points.map((point) => (
                                <g
                                  key={`score-${point.answerIndex}`}
                                  className="competition-v1-line-point"
                                  data-tone={point.tone}
                                >
                                  <line x1={point.x - 0.88} y1={point.y} x2={point.x + 0.88} y2={point.y} />
                                  <line x1={point.x} y1={point.y - 0.88} x2={point.x} y2={point.y + 0.88} />
                                </g>
                              ))}
                            </svg>
                            <div className="competition-v1-line-axis">
                              <span>Start</span>
                              <span>Score growth</span>
                              <span>{stats?.score ?? 0} pts</span>
                            </div>
                          </div>
                        ) : (
                          <p className="competition-v1-empty">No score trajectory data yet.</p>
                        )}
                      </section>
                    </div>

                    <div className="competition-v1-complete-actions">
                      <button type="button" className="competition-v1-cta" onClick={() => void startSession()}>
                        Play again
                      </button>
                      <Link href="/play" className="game-link">
                        Back to modes
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : currentQuestion ? (
            <h1 className="game-v2-word competition-v1-word" style={{ fontFamily: currentQuestion.fontFamily }}>
              {currentQuestion.displayWord}
            </h1>
          ) : (
            <h1 className="game-v2-word competition-v1-word">Competition unavailable</h1>
          )}
        </div>

        {error ? (
          <div className="game-v2-actions">
            <p className="game-v2-feedback" data-state="wrong" aria-live="polite">
              {error}
            </p>
            <button type="button" className="game-v2-validate" onClick={() => void startSession()}>
              Retry session
            </button>
            <Link href="/play" className="game-link">
              Back to modes
            </Link>
          </div>
        ) : null}

        {!error && !isLoading && !isComplete && currentQuestion ? (
          <>
            <section className="game-v2-options" role="radiogroup" aria-label="Competition options">
              {currentQuestion.options.map((option, index) => {
                const selected = selectedId === option.slug;
                const isCorrect = result === "correct" && selected;
                const isWrong = result === "wrong" && selected;

                return (
                  <button
                    key={`${currentQuestion.id}-${option.slug}`}
                    type="button"
                    className={`game-v2-option${selected ? " is-selected" : ""}${isCorrect ? " is-correct" : ""}${isWrong ? " is-wrong" : ""}`}
                    style={{ ["--card-color" as string]: CARD_COLORS[index] ?? CARD_COLORS[0] }}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => void handleSelect(option.slug)}
                    disabled={isRoundLocked}
                  >
                    <span className="game-v2-option-label">{option.label}</span>
                  </button>
                );
              })}
            </section>

            <p className="game-v2-feedback" data-state={inlineFeedback?.kind ?? "idle"} aria-live="polite">
              {inlineFeedback?.text ?? "\u00A0"}
            </p>
          </>
        ) : null}

        <style jsx global>{competitionScreenStyles}</style>
      </section>
    </main>
  );
}
