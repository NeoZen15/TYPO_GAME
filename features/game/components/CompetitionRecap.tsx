"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import StarField from "@/features/profile/components/StarField";
import { sessionEndCopy } from "@/content/copy";
import {
  formatCategoryLabel,
  formatClickTime,
  formatMetric,
  formatRate,
} from "@/lib/game/competition/format";
import type {
  CompetitionSessionSummary,
  CompetitionStats,
} from "@/lib/game/competition/contracts";

// End of a competition session.
//
// SAME FIGURES AS BEFORE, NEW ART DIRECTION. Owner's brief, 2026-08-15: the
// information already on this screen was chosen deliberately and stays, only
// the art direction is rebuilt, taking the profile's Stats tab as the exact
// reference. So this file carries no new metric: score, fast answers, average
// click, best streak, unique typefaces, the speed landmarks, the category mix,
// the recent misses and the two run charts are the same fields the previous
// recap read. (The summary payload also carries commonConfusions, speedBuckets
// and four rate fields that nothing displays. They stayed unused here on
// purpose, they are the owner's call, and they are recorded in the checklist.)
//
// HOW IT INHERITS THE PROFILE'S WORLD. globals.css states the contract: any page
// carrying `.pf-page` inherits the profile tokens (--pf-bg, --pf-cream,
// --pf-mono and the dark flip) and can reuse its boards. So this screen wears
// `.pf-page`, and its own classes rebuild the Stats tab's recipes on those
// tokens: mono uppercase micro labels, tabular numerals, hairline panels at
// radius var(--radius), sections at min(98%, 66rem), the starfield canvas
// behind. Values are copied from StatsBoard rather than reinvented, because the
// point is that the two pages read as one hand.
//
// Orange is the validated competition accent in that world, and StatsBoard's
// own arena panel sets the rule it follows here: contour and faint washes,
// never a flat fill.

const CREAM = "from var(--pf-cream) r g b"; // theme-adaptive ink, like StatsBoard
const ORANGE = "#ff934a"; // competition → the arena

const X_GUIDES = [22, 40, 58, 76];
const Y_GUIDES = [5, 15.67, 26.33, 37];

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const buildLinePath = (points: { x: number; y: number }[]) =>
  points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

type RecapProps = {
  // Nullable on purpose. The session can end without a summary: the answer
  // handler sets `summary` from `payload.summary ?? null` and marks the session
  // complete a few lines later, so a payload that arrives without one still
  // ends the run. The page then states that rather than rendering empty panels.
  summary: CompetitionSessionSummary | null;
  stats: CompetitionStats | null;
  onPlayAgain: () => void;
};

const Actions = ({ onPlayAgain }: { onPlayAgain: () => void }) => (
  // Two actions, owner's brief: start again, or go and read the whole history.
  // The stats tab is not addressable yet (the profile switches boards in React
  // state, not in the URL), so this lands on the profile and the deep link
  // comes later.
  <div className="cr-actions cr-sec">
    <button type="button" className="cr-btn cr-btn--primary" onClick={onPlayAgain}>
      {sessionEndCopy.replayLabel}
    </button>
    <Link href="/profile" className="cr-btn">
      {sessionEndCopy.statsLabel}
    </Link>
  </div>
);

export default function CompetitionRecap({ summary, stats, onPlayAgain }: RecapProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Same reveal as the Stats tab, including its reduced-motion opt out and its
  // 2.6s fallback, so a missed intersection never leaves the page invisible.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("is-armed");
    const reveal = () => root.classList.add("is-in");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal();
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(root);
    const fallback = window.setTimeout(reveal, 2600);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  const answeredCount = stats?.answeredCount ?? 0;
  const correctCount = stats?.correctCount ?? 0;

  if (!summary) {
    return (
      <div ref={rootRef} className="cr pf-page">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="cr-bg" aria-hidden="true">
          <StarField />
        </div>
        <header className="cr-intro cr-sec">
          <span className="cr-kicker">Competition · session over</span>
          <h1 className="cr-title">Time is up.</h1>
          <p className="cr-lede">
            The run is closed and your answers are recorded. The figures for this session did not
            come back, so there is nothing to read here. Your profile still has the whole history.
          </p>
        </header>
        <Actions onPlayAgain={onPlayAgain} />
      </div>
    );
  }

  const kpis = [
    {
      key: "score",
      value: String(stats?.score ?? 0),
      label: "Score",
      helper: "competition points",
    },
    {
      key: "fast",
      value: String(summary.fastAnswerCount),
      label: "Fast answers",
      helper: "under 2 seconds",
    },
    {
      key: "avg",
      value:
        summary.averageResponseTimeMs === null
          ? "—"
          : formatClickTime(summary.averageResponseTimeMs),
      label: "Avg. click",
      helper: "all answers",
    },
    {
      key: "streak",
      value: String(summary.bestCorrectStreak),
      label: "Best streak",
      helper: "correct in a row",
    },
    {
      key: "faces",
      value: String(summary.uniqueTypefacesSeenCount),
      label: "Typefaces",
      helper: "shown in session",
    },
  ];

  const speedMarkers =
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

  const speedRows = [
    { label: "Average click", value: summary.averageResponseTimeMs },
    { label: "Fastest click", value: summary.fastestResponseTimeMs },
    { label: "Slowest click", value: summary.slowestResponseTimeMs },
    { label: "Average on correct", value: summary.averageCorrectResponseTimeMs },
    { label: "Average on wrong", value: summary.averageWrongResponseTimeMs },
  ];

  const paceChart =
    summary.answerTimeline.length > 0
      ? (() => {
          const times = summary.answerTimeline.map((entry) => entry.responseTimeMs);
          const min = Math.min(...times);
          const max = Math.max(...times);
          const points = summary.answerTimeline.map((entry, index) => {
            const x =
              summary.answerTimeline.length === 1
                ? 50
                : 4 + (index / (summary.answerTimeline.length - 1)) * 92;
            const normalized = max === min ? 0.5 : (entry.responseTimeMs - min) / (max - min);
            return { ...entry, x, y: 5 + normalized * 32 };
          });
          return { path: buildLinePath(points), points };
        })()
      : null;

  const scoreChart =
    summary.answerTimeline.length > 0
      ? (() => {
          const total = Math.max(
            1,
            summary.answerTimeline.reduce((sum, entry) => sum + entry.awardedPoints, 0)
          );
          let running = 0;
          const points = summary.answerTimeline.map((entry, index) => {
            running += entry.awardedPoints;
            const x =
              summary.answerTimeline.length === 1
                ? 50
                : 4 + (index / (summary.answerTimeline.length - 1)) * 92;
            return { ...entry, x, y: 37 - (running / total) * 32 };
          });
          return { path: buildLinePath(points), points };
        })()
      : null;

  const categoryTotal = summary.categoryPerformance.reduce(
    (total, entry) => total + entry.answeredCount,
    0
  );

  return (
    <div ref={rootRef} className="cr pf-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Fixed top right by its own rule in globals, so it costs no layout. The
          playing screen carries one and every other page does too, the recap
          should not be the one place where the theme cannot be switched. */}
      <ThemeSwitch />

      <div className="cr-bg" aria-hidden="true">
        <StarField />
      </div>

      <header className="cr-intro cr-sec">
        <span className="cr-kicker">Competition · session over</span>
        <h1 className="cr-title">Time is up.</h1>
        <p className="cr-lede">
          {correctCount} of {answeredCount} correct, {formatRate(summary.accuracyRate)} accuracy
          across {answeredCount} {answeredCount === 1 ? "answer" : "answers"}.
        </p>
        <p className="cr-scoring">
          <em>+2</em> fast<span className="cr-dot">·</span>
          <em>+1</em> correct<span className="cr-dot">·</span>
          <em>0</em> wrong
        </p>
      </header>

      <section className="cr-kpis cr-sec" aria-label="Session figures">
        {kpis.map((kpi) => (
          <div key={kpi.key} className="cr-kpi">
            <span className="cr-kpi__value">{kpi.value}</span>
            <span className="cr-kpi__label">{kpi.label}</span>
            <span className="cr-kpi__helper">{kpi.helper}</span>
          </div>
        ))}
      </section>

      <section className="cr-cols cr-sec" aria-label="Speed">
        <div className="cr-panel">
          <h2 className="cr-panel__title">Speed profile</h2>
          {speedMarkers ? (
            <div className="cr-track" aria-hidden="true">
              <span className="cr-track__rail" />
              <span className="cr-track__mark" style={{ left: `${speedMarkers.fastest}%` }} />
              <span
                className="cr-track__mark cr-track__mark--avg"
                style={{ left: `${speedMarkers.average}%` }}
              />
              <span
                className="cr-track__mark cr-track__mark--slow"
                style={{ left: `${speedMarkers.slowest}%` }}
              />
            </div>
          ) : null}
          {speedMarkers ? (
            <ul className="cr-tracklegend">
              <li>fast</li>
              <li>avg</li>
              <li>slow</li>
            </ul>
          ) : null}
          <dl className="cr-rows">
            {speedRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value === null ? "—" : formatClickTime(row.value)}</dd>
              </div>
            ))}
            <div>
              <dt>Points / answer</dt>
              <dd>{formatMetric(summary.averagePointsPerAnswer)}</dd>
            </div>
          </dl>
        </div>

        <div className="cr-panel">
          <h2 className="cr-panel__title">Response pace</h2>
          {paceChart ? (
            <>
              <div className="cr-chart">
                <svg viewBox="0 0 100 42" preserveAspectRatio="none" role="img" aria-label="Click time across the run">
                  <g className="cr-chart__grid" aria-hidden="true">
                    {Y_GUIDES.map((y) => (
                      <line key={`pace-y-${y}`} x1="4" y1={y} x2="96" y2={y} />
                    ))}
                    {X_GUIDES.map((x) => (
                      <line key={`pace-x-${x}`} x1={x} y1="5" x2={x} y2="37" />
                    ))}
                  </g>
                  <g className="cr-chart__axis" aria-hidden="true">
                    <line x1="4" y1="5" x2="4" y2="37" />
                    <line x1="4" y1="37" x2="96" y2="37" />
                  </g>
                  <path className="cr-chart__line" d={paceChart.path} />
                  {paceChart.points.map((point) => (
                    <g
                      key={`pace-${point.answerIndex}`}
                      className="cr-chart__pt"
                      data-tone={point.isCorrect ? "correct" : "wrong"}
                    >
                      <line x1={point.x - 0.9} y1={point.y} x2={point.x + 0.9} y2={point.y} />
                      <line x1={point.x} y1={point.y - 0.9} x2={point.x} y2={point.y + 0.9} />
                    </g>
                  ))}
                </svg>
              </div>
              <span className="cr-panel__meta">
                Fast at the bottom, slow at the top<span className="cr-dot">·</span>each cross is one
                answer, orange when it was wrong
              </span>
            </>
          ) : (
            <p className="cr-empty">No response pace data yet.</p>
          )}
        </div>
      </section>

      <section className="cr-cols cr-cols--b cr-sec" aria-label="Families and score">
        <div className="cr-panel">
          <h2 className="cr-panel__title">Category mix</h2>
          {summary.categoryPerformance.length > 0 ? (
            <ul className="cr-bars">
              {summary.categoryPerformance.slice(0, 6).map((entry) => {
                const share =
                  categoryTotal === 0
                    ? 0
                    : Math.round((entry.answeredCount / categoryTotal) * 100);

                return (
                  <li key={entry.category} className="cr-bar">
                    <span className="cr-bar__name">{formatCategoryLabel(entry.category)}</span>
                    <span className="cr-bar__rail">
                      <span className="cr-bar__fill" style={{ width: `${share}%` }} />
                    </span>
                    <span className="cr-bar__frac">
                      <em>{entry.answeredCount}</em>/{share}%
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="cr-empty">No category data yet.</p>
          )}
          <span className="cr-panel__meta">
            Families encountered in this run<span className="cr-dot">·</span>
            <em>{categoryTotal}</em> answers counted
          </span>
        </div>

        <div className="cr-panel">
          <h2 className="cr-panel__title">Score trajectory</h2>
          {scoreChart ? (
            <>
              <div className="cr-chart">
                <svg viewBox="0 0 100 42" preserveAspectRatio="none" role="img" aria-label="Cumulative score across the run">
                  <g className="cr-chart__grid" aria-hidden="true">
                    {Y_GUIDES.map((y) => (
                      <line key={`score-y-${y}`} x1="4" y1={y} x2="96" y2={y} />
                    ))}
                    {X_GUIDES.map((x) => (
                      <line key={`score-x-${x}`} x1={x} y1="5" x2={x} y2="37" />
                    ))}
                  </g>
                  <g className="cr-chart__axis" aria-hidden="true">
                    <line x1="4" y1="5" x2="4" y2="37" />
                    <line x1="4" y1="37" x2="96" y2="37" />
                  </g>
                  <path className="cr-chart__line cr-chart__line--score" d={scoreChart.path} />
                  {scoreChart.points.map((point) => (
                    <g
                      key={`score-${point.answerIndex}`}
                      className="cr-chart__pt"
                      data-tone={point.awardedPoints >= 2 ? "fast" : point.awardedPoints === 1 ? "correct" : "wrong"}
                    >
                      <line x1={point.x - 0.9} y1={point.y} x2={point.x + 0.9} y2={point.y} />
                      <line x1={point.x} y1={point.y - 0.9} x2={point.x} y2={point.y + 0.9} />
                    </g>
                  ))}
                </svg>
              </div>
              <span className="cr-panel__meta">
                Cumulative score<span className="cr-dot">·</span>ends at <em>{stats?.score ?? 0}</em> points
              </span>
            </>
          ) : (
            <p className="cr-empty">No score trajectory data yet.</p>
          )}
        </div>
      </section>

      <section className="cr-panel cr-sec" aria-label="Recent misses">
        <h2 className="cr-panel__title">Recent misses</h2>
        {summary.recentMisses.length > 0 ? (
          <ul className="cr-misses">
            {summary.recentMisses.map((entry) => (
              <li
                key={`${entry.correctSlug}-${entry.guessedSlug}-${entry.displayWord}`}
                className="cr-miss"
              >
                <span className="cr-miss__pair">
                  <em>{entry.guessedLabel}</em> instead of <em>{entry.correctLabel}</em>
                </span>
                <span className="cr-miss__meta">
                  {entry.displayWord}
                  <span className="cr-dot">·</span>
                  {formatCategoryLabel(entry.category)}
                </span>
                <span className="cr-miss__time">{formatClickTime(entry.responseTimeMs)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cr-empty">No misses on this run. Clean sheet.</p>
        )}
      </section>

      <Actions onPlayAgain={onPlayAgain} />
    </div>
  );
}

const CSS = `
  .cr {
    position: relative; isolation: isolate; width: 100%; min-height: 100svh;
    display: grid; gap: clamp(1.1rem, 3vh, 2rem); align-content: start;
    padding: clamp(1.2rem, 3vw, 2.2rem) clamp(1rem, 4vw, 3rem) clamp(3rem, 8vh, 6rem);
  }
  .cr-bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
  .cr-bg .dw-stars { position: absolute; inset: 0; width: 100%; height: 100%; }

  .cr.is-armed .cr-sec { opacity: 0; transform: translateY(16px); }
  .cr.is-armed.is-in .cr-sec { opacity: 1; transform: none; transition: opacity 600ms ease, transform 700ms cubic-bezier(0.22, 1, 0.36, 1); }

  .cr-intro { text-align: center; display: grid; gap: 0.45rem; justify-items: center; max-width: 52rem; margin: 0 auto; }
  .cr-kicker { font-family: var(--pf-mono); font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .cr-title { margin: 0; font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 640; letter-spacing: -0.04em; line-height: 1.02; color: var(--pf-cream); }
  .cr-lede { margin: 0; max-width: 46ch; font-size: 0.86rem; line-height: 1.5; color: rgb(${CREAM} / 0.6); }
  .cr-scoring { margin: 0.15rem 0 0; font-family: var(--pf-mono); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(${CREAM} / 0.42); }
  .cr-scoring em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .cr-dot { margin: 0 0.45rem; opacity: 0.5; }

  /* KPI grid — StatsBoard recipe, five figures instead of six */
  .cr-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: clamp(0.5rem, 1.2vw, 0.8rem); width: min(98%, 66rem); margin: 0 auto; }
  @media (max-width: 900px) { .cr-kpis { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 540px) { .cr-kpis { grid-template-columns: repeat(2, 1fr); } }
  .cr-kpi {
    display: grid; gap: 0.22rem; padding: clamp(0.7rem, 1.5vw, 0.95rem);
    border: 1px solid rgb(${CREAM} / 0.1); border-radius: var(--radius);
    background: color-mix(in srgb, var(--pf-bg) 90%, transparent);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  }
  .cr-kpi__value { font-size: clamp(1.2rem, 2.2vw, 1.55rem); font-weight: 660; letter-spacing: -0.03em; line-height: 1; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .cr-kpi__label { font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.7); }
  .cr-kpi__helper { font-family: var(--pf-mono); font-size: 0.52rem; letter-spacing: 0.03em; color: rgb(${CREAM} / 0.38); }

  /* Panels + columns */
  .cr-cols { display: grid; grid-template-columns: 1fr 1.4fr; gap: clamp(0.7rem, 1.6vw, 1.1rem); width: min(98%, 66rem); margin: 0 auto; }
  .cr-cols--b { grid-template-columns: 1fr 1.2fr; }
  @media (max-width: 820px) { .cr-cols, .cr-cols--b { grid-template-columns: 1fr; } }
  .cr-panel {
    width: min(98%, 66rem); margin: 0 auto;
    padding: clamp(1rem, 2.2vw, 1.4rem);
    border: 1px solid rgb(${CREAM} / 0.1); border-radius: var(--radius);
    background: color-mix(in srgb, var(--pf-bg) 90%, transparent);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  }
  .cr-cols .cr-panel { width: 100%; margin: 0; }
  .cr-panel__title { margin: 0 0 0.9rem; font-family: var(--pf-mono); font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgb(${CREAM} / 0.58); }
  .cr-panel__meta { display: block; margin-top: 0.8rem; font-family: var(--pf-mono); font-size: 0.64rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.42); font-variant-numeric: tabular-nums; }
  .cr-panel__meta em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .cr-empty { margin: 0; font-family: var(--pf-mono); font-size: 0.66rem; color: rgb(${CREAM} / 0.42); }

  /* Speed landmarks — one rail, three marks. Orange marks the slow end only. */
  .cr-track { position: relative; height: 0.4rem; margin-bottom: 0.5rem; }
  .cr-track__rail { position: absolute; inset: 0; border-radius: var(--radius-pill); background: rgb(${CREAM} / 0.1); }
  .cr-track__mark { position: absolute; top: -0.22rem; width: 2px; height: 0.84rem; margin-left: -1px; border-radius: 1px; background: var(--pf-cream); }
  .cr-track__mark--avg { background: rgb(${CREAM} / 0.55); }
  .cr-track__mark--slow { background: ${ORANGE}; }
  .cr-tracklegend { display: flex; justify-content: space-between; margin: 0 0 1rem; padding: 0; list-style: none; }
  .cr-tracklegend li { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(${CREAM} / 0.42); }

  /* Definition rows — the Stats tab's label/value pairing */
  .cr-rows { display: grid; gap: 0; margin: 0; }
  .cr-rows > div { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: 0.46rem 0; border-bottom: 1px solid rgb(${CREAM} / 0.07); }
  .cr-rows > div:last-child { border-bottom: 0; padding-bottom: 0; }
  .cr-rows dt { font-family: var(--pf-mono); font-size: 0.64rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.55); }
  .cr-rows dd { margin: 0; font-size: 0.86rem; font-weight: 640; color: var(--pf-cream); font-variant-numeric: tabular-nums; }

  /* Category bars — the .st-axis row, trimmed to three columns */
  .cr-bars { display: grid; gap: 0.6rem; margin: 0; padding: 0; list-style: none; }
  .cr-bar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(4rem, 8rem) 4.2rem; align-items: center; gap: 0.5rem 0.8rem; }
  .cr-bar__name { font-size: 0.82rem; color: rgb(${CREAM} / 0.84); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cr-bar__rail { height: 0.4rem; border-radius: var(--radius-pill); background: rgb(${CREAM} / 0.1); overflow: hidden; }
  .cr-bar__fill { display: block; height: 100%; border-radius: var(--radius-pill); background: rgb(${CREAM} / 0.55); }
  .cr-bar__frac { font-family: var(--pf-mono); font-size: 0.66rem; color: rgb(${CREAM} / 0.5); text-align: right; font-variant-numeric: tabular-nums; }
  .cr-bar__frac em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .cr.is-armed .cr-bar__fill { transform: scaleX(0); transform-origin: left; }
  .cr.is-armed.is-in .cr-bar__fill { transform: scaleX(1); transition: transform 800ms cubic-bezier(0.22, 1, 0.36, 1) 200ms; }
  @media (max-width: 560px) {
    .cr-bar { grid-template-columns: minmax(0, 1fr) 4.2rem; row-gap: 0.3rem; }
    .cr-bar__rail { grid-column: 1 / -1; }
  }

  /* Run charts. non-scaling-stroke because the viewBox is stretched: without it
     the 100x42 box distorts every stroke width on a wide panel. */
  .cr-chart { width: 100%; }
  .cr-chart svg { display: block; width: 100%; height: clamp(7rem, 16vh, 10rem); overflow: visible; }
  .cr-chart__grid line { stroke: rgb(${CREAM} / 0.07); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .cr-chart__axis line { stroke: rgb(${CREAM} / 0.18); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .cr-chart__line { fill: none; stroke: rgb(${CREAM} / 0.62); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .cr-chart__line--score { stroke: var(--pf-cream); }
  .cr-chart__pt line { stroke: rgb(${CREAM} / 0.7); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .cr-chart__pt[data-tone="fast"] line { stroke: var(--pf-cream); }
  .cr-chart__pt[data-tone="wrong"] line { stroke: ${ORANGE}; }

  /* Misses — pair, context, time */
  .cr-misses { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
  .cr-miss { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 0.15rem 0.9rem; padding: 0.55rem 0; border-bottom: 1px solid rgb(${CREAM} / 0.07); }
  .cr-miss:last-child { border-bottom: 0; padding-bottom: 0; }
  .cr-miss__pair { font-size: 0.84rem; color: rgb(${CREAM} / 0.6); }
  .cr-miss__pair em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .cr-miss__time { grid-row: 1 / span 2; align-self: center; font-family: var(--pf-mono); font-size: 0.72rem; color: rgb(${CREAM} / 0.55); font-variant-numeric: tabular-nums; }
  .cr-miss__meta { font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.02em; text-transform: uppercase; color: rgb(${CREAM} / 0.38); }

  /* Two actions. Primary is the cream pill, the profile world's inverse of its
     own dark .pf-top__cta, since here the canvas is the dark one. */
  .cr-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.6rem; width: min(98%, 66rem); margin: 0.4rem auto 0; }
  .cr-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 11rem; min-height: 2.8rem; padding: 0.8rem 1.6rem;
    border-radius: var(--radius-pill); border: 1px solid rgb(${CREAM} / 0.22);
    font-family: var(--pf-mono); font-size: 0.66rem; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase; line-height: 1;
    color: var(--pf-cream); background: transparent; text-decoration: none; cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, background-color 160ms ease;
  }
  .cr-btn:hover, .cr-btn:focus-visible { transform: translateY(-1px); border-color: rgb(${CREAM} / 0.5); background: rgb(${CREAM} / 0.06); }
  .cr-btn--primary { border-color: transparent; background: var(--pf-cream); color: var(--pf-bg); }
  .cr-btn--primary:hover, .cr-btn--primary:focus-visible { background: var(--pf-cream); border-color: transparent; opacity: 0.9; }
  .cr-btn:focus-visible { outline: 2px solid rgb(${CREAM} / 0.6); outline-offset: 3px; }

  @media (prefers-reduced-motion: reduce) {
    .cr-sec, .cr-bar__fill { transition: none !important; }
  }
`;
