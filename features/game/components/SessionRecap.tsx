"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import StarField from "@/features/profile/components/StarField";
import { BOARD_SYSTEM_CSS } from "@/features/profile/components/board-system";
import { sessionEndCopy } from "@/content/copy";
import type { RecapPanel, RecapView } from "@/lib/game/recap-view";

// The end of a session, for every mode. One screen, no scrolling.
//
// NO ART DIRECTION IS DECLARED HERE. The root carries `st` and the page composes
// the profile's own boards, class for class, from board-system.ts. If it looks
// different from the Stats tab, that is a bug in this file's structure, never a
// value to tune. An earlier attempt copied the Stats tab's values under a prefix
// of its own and the owner named it for what it was: a variant.
//
// NO MODE KNOWLEDGE EITHER. It receives a RecapView and renders it. What each
// mode measures, and what it calls those measures, lives in its own adapter
// (lib/game/<mode>/recap-view.ts). That is what lets competition show a score
// and training show mastery movement on the same frame without either one
// borrowing the other's vocabulary.
//
// THE FRAME. Four figures answer the questions of the first three seconds, then
// two panels side by side, then two actions, all inside the viewport. A player
// who has to scroll to reach the buttons has lost the thread.

const Figures = ({ figures }: { figures: NonNullable<RecapPanel["figures"]> }) => (
  <div className="st-arena__grid">
    {figures.map((figure) => (
      <div key={figure.label} className="st-arena__stat">
        <span className="st-arena__num">{figure.value}</span>
        <span className="st-arena__lbl">{figure.label}</span>
      </div>
    ))}
  </div>
);

const Foot = ({ foot }: { foot: NonNullable<RecapPanel["foot"]> }) => (
  // Under a rule, qualifying the figures above: a fast average means nothing
  // until you know whether the speed went into the right answers or the wrong.
  <div className="st-eye__foot">
    {foot.map((figure) => (
      <span key={figure.label} className="st-eye__stat">
        <em>{figure.value}</em> {figure.label}
      </span>
    ))}
  </div>
);

const Rows = ({ rows }: { rows: NonNullable<RecapPanel["rows"]> }) => (
  <ul className="st-sessions">
    {rows.map((row) => (
      // Cells are dropped when empty rather than rendered blank, and the row
      // drops the column with them: training confusions carry no category, and
      // an empty first cell still reserved its 8rem, pushing the text 166px into
      // the panel.
      <li key={row.key} className={`st-session${row.chip ? "" : " st-session--nochip"}`}>
        {row.chip ? <span className="st-session__mode">{row.chip}</span> : null}
        <span className="st-session__detail">{row.detail}</span>
        {row.value ? <span className="st-session__acc">{row.value}</span> : null}
        {row.aside ? <span className="st-session__when">{row.aside}</span> : null}
      </li>
    ))}
  </ul>
);

const Panel = ({ panel, arena }: { panel: RecapPanel; arena?: boolean }) => {
  const hasContent = Boolean(panel.figures?.length || panel.rows?.length);

  return (
    <div className={`st-panel${arena ? " st-arena" : ""}`}>
      {panel.tag ? (
        <div className="st-arena__head">
          <h2 className="st-panel__title">{panel.title}</h2>
          <span className="st-arena__tag">{panel.tag}</span>
        </div>
      ) : (
        <h2 className="st-panel__title">{panel.title}</h2>
      )}

      {panel.figures?.length ? <Figures figures={panel.figures} /> : null}
      {panel.rows?.length ? <Rows rows={panel.rows} /> : null}
      {!hasContent && panel.empty ? <span className="st-panel__meta">{panel.empty}</span> : null}
      {hasContent && panel.foot?.length ? <Foot foot={panel.foot} /> : null}
    </div>
  );
};

const Actions = ({ onPlayAgain }: { onPlayAgain?: () => void }) => (
  // Two actions, owner's brief: start again, or go and read the whole history.
  // It lands on the STATS board, not on the profile's front page: the button
  // says statistics, so it owes the numbers. Made possible by the profile's
  // views becoming addressable on 2026-08-15.
  //
  // A mode with nothing to replay keeps two actions rather than one. Expert is
  // the only such mode today, and dropping its first action left a single
  // button and no way back to the board: a dead end. The mode board takes that
  // slot instead, and never sits beside "Play again".
  <div className="st-actions st-sec">
    {onPlayAgain ? (
      <button type="button" className="st-action st-action--primary" onClick={onPlayAgain}>
        {sessionEndCopy.replayLabel}
      </button>
    ) : (
      <Link href="/play" className="st-action st-action--primary">
        {sessionEndCopy.otherModesLabel}
      </Link>
    )}
    <Link href="/profile?view=stats" className="st-action">
      {sessionEndCopy.statsLabel}
    </Link>
  </div>
);

export default function SessionRecap({
  view,
  onPlayAgain,
}: {
  view: RecapView;
  onPlayAgain?: () => void;
}) {
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

  return (
    // The mode's colour travels as a custom property rather than a class, so the
    // accent panel reads it wherever it sits and the system keeps one rule for
    // all three modes instead of one per mode.
    <div
      ref={rootRef}
      className="st st--screen pf-page"
      style={{ ["--st-accent" as string]: view.accent }}
    >
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />

      {/* Fixed top right by its own rule in globals, so it costs no layout. */}
      <ThemeSwitch />

      <div className="st-bg" aria-hidden="true">
        <StarField />
      </div>

      <header className="st-intro st-sec">
        <span className="st-kicker">{view.kicker}</span>
        {/* h1, not h2. On the profile the same board is a tab under the page's
            own title, here the recap IS the page, and the accessibility contract
            asks every page for exactly one h1. The styling rides on the class,
            so the element changes and nothing moves. */}
        <h1 className="st-title">{view.title}</h1>
        <p className="st-lede">{view.lede}</p>
      </header>

      {view.kpis.length > 0 ? (
        <section className="st-kpis st-kpis--four st-sec" aria-label="Session figures">
          {view.kpis.map((kpi) => (
            <div key={kpi.key} className="st-kpi">
              <span className="st-kpi__value">{kpi.value}</span>
              <span className="st-kpi__label">{kpi.label}</span>
              <span className="st-kpi__helper">{kpi.helper}</span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="st-cols st-sec" aria-label="Session detail">
        <Panel panel={view.left} arena />
        <Panel panel={view.right} />
      </section>

      <Actions onPlayAgain={onPlayAgain} />
    </div>
  );
}
