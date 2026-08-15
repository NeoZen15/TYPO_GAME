"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import StarField from "@/features/profile/components/StarField";
import { BLUE, BOARD_SYSTEM_CSS } from "@/features/profile/components/board-system";
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
// THE SECOND ATTEMPT, AND WHY. The first rebuilt the Stats tab's look by copying
// its values under a prefix of its own. The owner named it: a variant. So this
// version declares NO art direction at all. It carries `st` on its root and
// composes the profile's own boards, class for class, from
// features/profile/components/board-system.ts: the same intro, the same KPI
// grid, the same panels, the same arena head, the same rows and bars, the same
// session list, the same area chart, the same reveal. Nothing here sets a size,
// a radius, a colour or a weight. If it looks different from the Stats tab, that
// is a bug in this file's structure, not a value to tune.
//
// SAME FIGURES AS BEFORE. Owner's brief: the information was chosen
// deliberately and stays. Score, accuracy, best streak, fast answers, average
// click, typefaces seen, the speed landmarks, the category mix, the recent
// misses, and the two run charts. (The payload also carries commonConfusions,
// speedBuckets, wrongCount and the two per-minute rates that nothing displays.
// Still unused on purpose, still the owner's call, recorded in the checklist.)

// Area chart geometry, identical to the Stats tab's activity chart so the two
// charts are the same object at the same scale.
const AW = 300;
const AH = 78;
const PAD = 6;

const areaPaths = (values: number[]) => {
  if (values.length === 0) return null;

  const max = Math.max(1, ...values);
  const x = (index: number) =>
    values.length === 1 ? AW / 2 : PAD + (index / (values.length - 1)) * (AW - 2 * PAD);
  const y = (value: number) => AH - PAD - (value / max) * (AH - 2 * PAD);

  const lineD = values
    .map((value, index) => `${index ? "L" : "M"} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`)
    .join(" ");

  return {
    lineD,
    areaD: `${lineD} L ${x(values.length - 1).toFixed(1)} ${AH - PAD} L ${x(0).toFixed(1)} ${AH - PAD} Z`,
  };
};

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
  <div className="st-actions st-sec">
    <button type="button" className="st-action st-action--primary" onClick={onPlayAgain}>
      {sessionEndCopy.replayLabel}
    </button>
    <Link href="/profile" className="st-action">
      {sessionEndCopy.statsLabel}
    </Link>
  </div>
);

export default function CompetitionRecap({ summary, stats, onPlayAgain }: RecapProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // The Stats tab's reveal, same observer, same reduced-motion opt out, same
  // 2.6s fallback so a missed intersection never leaves the page invisible.
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
      <div ref={rootRef} className="st pf-page">
        <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
        <ThemeSwitch />
        <div className="st-bg" aria-hidden="true">
          <StarField />
        </div>
        <header className="st-intro st-sec">
          <span className="st-kicker">Competition · session over</span>
          <h2 className="st-title">Time is up.</h2>
          <p className="st-lede">
            The run is closed and your answers are recorded. The figures for this session did not
            come back, so there is nothing to read here. Your profile still has the whole history.
          </p>
        </header>
        <Actions onPlayAgain={onPlayAgain} />
      </div>
    );
  }

  const kpis = [
    { key: "score", value: String(stats?.score ?? 0), label: "Score", helper: "competition points" },
    {
      key: "accuracy",
      value: formatRate(summary.accuracyRate),
      label: "Accuracy",
      helper: `${correctCount} of ${answeredCount}`,
    },
    {
      key: "streak",
      value: String(summary.bestCorrectStreak),
      label: "Best streak",
      helper: "correct in a row",
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
      key: "faces",
      value: String(summary.uniqueTypefacesSeenCount),
      label: "Typefaces",
      helper: "shown in session",
    },
  ];

  const paceChart = areaPaths(summary.answerTimeline.map((entry) => entry.responseTimeMs));

  // Running total without a mutable accumulator in the render body, which the
  // react-hooks/immutability rule refuses. A session is a couple of dozen
  // answers, so the quadratic walk costs nothing and reads plainly.
  const scoreChart = areaPaths(
    summary.answerTimeline.map((_, index) =>
      summary.answerTimeline
        .slice(0, index + 1)
        .reduce((total, entry) => total + entry.awardedPoints, 0)
    )
  );

  const categoryTotal = summary.categoryPerformance.reduce(
    (total, entry) => total + entry.answeredCount,
    0
  );

  return (
    <div ref={rootRef} className="st pf-page">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />

      {/* Fixed top right by its own rule in globals, so it costs no layout. */}
      <ThemeSwitch />

      <div className="st-bg" aria-hidden="true">
        <StarField />
      </div>

      <header className="st-intro st-sec">
        <span className="st-kicker">Competition · session over</span>
        <h2 className="st-title">Time is up.</h2>
        <p className="st-lede">
          {correctCount} of {answeredCount} correct. Two points for a fast answer, one for a
          correct one, none for a miss.
        </p>
      </header>

      <section className="st-kpis st-sec" aria-label="Session figures">
        {kpis.map((kpi) => (
          <div key={kpi.key} className="st-kpi">
            <span className="st-kpi__value">{kpi.value}</span>
            <span className="st-kpi__label">{kpi.label}</span>
            <span className="st-kpi__helper">{kpi.helper}</span>
          </div>
        ))}
      </section>

      <section className="st-cols st-sec" aria-label="Speed and pace">
        {/* The arena panel of the Stats tab, used for what it was made for. */}
        <div className="st-panel st-arena">
          <div className="st-arena__head">
            <h3 className="st-panel__title">Speed profile</h3>
            <span className="st-arena__tag">This run</span>
          </div>
          <div className="st-arena__grid">
            <div className="st-arena__stat">
              <span className="st-arena__num">
                {summary.fastestResponseTimeMs === null
                  ? "—"
                  : formatClickTime(summary.fastestResponseTimeMs)}
              </span>
              <span className="st-arena__lbl">fastest</span>
            </div>
            <div className="st-arena__stat">
              <span className="st-arena__num">
                {summary.averageResponseTimeMs === null
                  ? "—"
                  : formatClickTime(summary.averageResponseTimeMs)}
              </span>
              <span className="st-arena__lbl">average</span>
            </div>
            <div className="st-arena__stat">
              <span className="st-arena__num">
                {summary.slowestResponseTimeMs === null
                  ? "—"
                  : formatClickTime(summary.slowestResponseTimeMs)}
              </span>
              <span className="st-arena__lbl">slowest</span>
            </div>
          </div>
          <div className="st-eye__foot">
            <span className="st-eye__stat">
              <em>
                {summary.averageCorrectResponseTimeMs === null
                  ? "—"
                  : formatClickTime(summary.averageCorrectResponseTimeMs)}
              </em>{" "}
              on correct
            </span>
            <span className="st-eye__stat">
              <em>
                {summary.averageWrongResponseTimeMs === null
                  ? "—"
                  : formatClickTime(summary.averageWrongResponseTimeMs)}
              </em>{" "}
              on wrong
            </span>
            <span className="st-eye__stat">
              <em>{formatMetric(summary.averagePointsPerAnswer)}</em> pts / answer
            </span>
          </div>
        </div>

        <div className="st-panel">
          <h3 className="st-panel__title">Response pace</h3>
          {paceChart ? (
            <>
              <svg
                className="st-area"
                viewBox={`0 0 ${AW} ${AH}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="cr-pace-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={`color-mix(in srgb, ${BLUE} 26%, transparent)`} />
                    <stop offset="1" stopColor="transparent" />
                  </linearGradient>
                </defs>
                <line className="st-area__grid" x1="0" y1={AH / 2} x2={AW} y2={AH / 2} />
                <line className="st-area__base" x1="0" y1={AH - PAD} x2={AW} y2={AH - PAD} />
                <path className="st-area__fill" d={paceChart.areaD} fill="url(#cr-pace-grad)" />
                <path className="st-area__line" d={paceChart.lineD} fill="none" />
              </svg>
              <span className="st-panel__meta">
                Click time, answer after answer<span className="st-dot">·</span>the higher the
                line, the longer you looked
              </span>
            </>
          ) : (
            <span className="st-panel__meta">No answers to plot on this run.</span>
          )}
        </div>
      </section>

      <section className="st-cols st-cols--b st-sec" aria-label="Families and score">
        <div className="st-panel">
          <h3 className="st-panel__title">Category mix</h3>
          <ul className="st-rows">
            {summary.categoryPerformance.slice(0, 6).map((entry) => {
              const share =
                categoryTotal === 0 ? 0 : Math.round((entry.answeredCount / categoryTotal) * 100);

              return (
                <li key={entry.category} className="st-row">
                  <span className="st-row__label">{formatCategoryLabel(entry.category)}</span>
                  <span className="st-bar">
                    <span className="st-bar__fill" style={{ width: `${share}%` }} />
                  </span>
                  <span className="st-row__val">
                    <em>{entry.answeredCount}</em>
                    <span className="st-row__sub">{share}% of run</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <span className="st-panel__meta">
            Families you met here<span className="st-dot">·</span>
            <em>{categoryTotal}</em> answers counted
          </span>
        </div>

        <div className="st-panel">
          <h3 className="st-panel__title">Score trajectory</h3>
          {scoreChart ? (
            <>
              <svg
                className="st-area"
                viewBox={`0 0 ${AW} ${AH}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="cr-score-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={`color-mix(in srgb, ${BLUE} 26%, transparent)`} />
                    <stop offset="1" stopColor="transparent" />
                  </linearGradient>
                </defs>
                <line className="st-area__grid" x1="0" y1={AH / 2} x2={AW} y2={AH / 2} />
                <line className="st-area__base" x1="0" y1={AH - PAD} x2={AW} y2={AH - PAD} />
                <path className="st-area__fill" d={scoreChart.areaD} fill="url(#cr-score-grad)" />
                <path className="st-area__line" d={scoreChart.lineD} fill="none" />
              </svg>
              <span className="st-panel__meta">
                Points as they came<span className="st-dot">·</span>ends at{" "}
                <em>{stats?.score ?? 0}</em>
              </span>
            </>
          ) : (
            <span className="st-panel__meta">No points to plot on this run.</span>
          )}
        </div>
      </section>

      <section className="st-panel st-sec" aria-label="Recent misses">
        <h3 className="st-panel__title">Recent misses</h3>
        {summary.recentMisses.length > 0 ? (
          <ul className="st-sessions">
            {summary.recentMisses.map((entry) => (
              <li
                key={`${entry.correctSlug}-${entry.guessedSlug}-${entry.displayWord}`}
                className="st-session"
              >
                <span className="st-session__mode">{formatCategoryLabel(entry.category)}</span>
                <span className="st-session__detail">
                  {entry.guessedLabel} instead of {entry.correctLabel}
                </span>
                <span className="st-session__acc">{formatClickTime(entry.responseTimeMs)}</span>
                <span className="st-session__when">{entry.displayWord}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="st-panel__meta">No misses on this run. Clean sheet.</span>
        )}
      </section>

      <Actions onPlayAgain={onPlayAgain} />
    </div>
  );
}
