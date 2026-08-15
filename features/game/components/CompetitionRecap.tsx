"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import StarField from "@/features/profile/components/StarField";
import { BOARD_SYSTEM_CSS } from "@/features/profile/components/board-system";
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

// End of a competition session. One screen, no scrolling.
//
// NO ART DIRECTION IS DECLARED HERE. The root carries `st` and the page composes
// the profile's own boards, class for class, from board-system.ts. If it looks
// different from the Stats tab, that is a bug in this file's structure, never a
// value to tune. The first attempt copied the Stats tab's values under a prefix
// of its own and the owner named it for what it was: a variant.
//
// WHAT IT SHOWS, AND WHY SO LITTLE (owner's brief, 2026-08-15). A recap is a
// verdict read in three seconds, not a report. A player who has to scroll to
// reach the buttons has lost the thread. So the page holds four figures, two
// panels side by side, and the two actions, inside the viewport:
//
//   how did I score, did I see right, did I hold it, was I quick   → the figures
//   how fast was I, at best, on average, at worst                  → left panel
//   WHAT DID I GET WRONG                                           → right panel
//
// The misses sit on the right, where a chart used to be, because they are the
// only thing on this page that teaches anything.
//
// WHAT LEFT, AND WHERE IT BELONGS. The category mix, the response pace chart,
// the score trajectory, the typefaces-seen count, the averages on correct and on
// wrong, and the points per answer are analysis, not verdict: one run of twenty
// answers says little, the same figures across a history say a lot. They belong
// to the profile. Still computed and still sent, along with commonConfusions,
// speedBuckets, wrongCount and the two per-minute rates that were never
// displayed. All of it is recorded in the checklist.

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
      <div ref={rootRef} className="st st--screen pf-page">
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

  // Four figures: how did I score, did I see right, did I hold it, was I quick.
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
      key: "avg",
      value:
        summary.averageResponseTimeMs === null
          ? "—"
          : formatClickTime(summary.averageResponseTimeMs),
      label: "Avg. click",
      helper: `${summary.fastAnswerCount} under 2s`,
    },
  ];

  // Three at most. A fourth row costs the screen, and nobody studies their
  // fourth mistake here.
  const misses = summary.recentMisses.slice(0, 3);

  return (
    <div ref={rootRef} className="st st--screen pf-page">
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

      <section className="st-kpis st-kpis--four st-sec" aria-label="Session figures">
        {kpis.map((kpi) => (
          <div key={kpi.key} className="st-kpi">
            <span className="st-kpi__value">{kpi.value}</span>
            <span className="st-kpi__label">{kpi.label}</span>
            <span className="st-kpi__helper">{kpi.helper}</span>
          </div>
        ))}
      </section>

      <section className="st-cols st-sec" aria-label="Speed and misses">
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
          {/* The foot this panel had before the one-screen cut, put back on the
              owner's call. It carries the three figures that qualify the three
              above: a fast average means nothing until you know whether the
              speed was spent on the answers you got right or the ones you got
              wrong. It also fills a panel that was two thirds empty next to the
              misses list. */}
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
          <h3 className="st-panel__title">What you missed</h3>
          {misses.length > 0 ? (
            <ul className="st-sessions">
              {misses.map((entry) => (
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
        </div>
      </section>

      <Actions onPlayAgain={onPlayAgain} />
    </div>
  );
}
