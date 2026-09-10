"use client";

import Link from "next/link";
import { BOARD_SYSTEM_CSS, CREAM, MODE_ACCENT } from "@/features/profile/components/board-system";
import { myNextAssignments, myOpenAssignments } from "@/lib/profile/assigned";
import { dueLabel, opensLabel, urgencyOf } from "@/lib/teacher/teacher-time";

// A devoir, in the student's own space.
//
// THE RETURN TRIP OF THE ONE-WAY WALL. A teacher reads only what their own
// exercises produced and never a student's free training; the student, in
// exchange, has to be told what was set and until when, because a deadline
// nobody sees is not a deadline. That is all that crosses.
//
// IT SITS ON THE PATH TAB AND NOWHERE ELSE, above the map, because that is the
// tab a player lands on and a deadline that has to be hunted for is a deadline
// that is missed. One row, the system's own panel, and it renders NOTHING at all
// when nothing is set: an empty state here would be a permanent reminder that
// you have no homework, which nobody needs.
//
// NO ART DIRECTION OF ITS OWN, the same discipline as ProgressExplainer next
// door: the panel, the mode chip, the countdown pill and the button are the
// shared system's, and the only local values are the row's own columns.
//
// THE BUTTON NOW KEEPS ITS PROMISE, and that day is 2026-09-10. It used to say
// "go and play" and lead to an ordinary session, because the engine could not
// open one on a given exercise's families. It can: the assigned path serves the
// contract's own faces, at the teacher's own exigence. So the label says what it
// starts, and the address is the exercise. As predicted in this comment's first
// version, the label and the href were the only two things that had to change.
export default function AssignedBand() {
  const open = myOpenAssignments();
  const next = myNextAssignments();
  const a = open[0] ?? null;
  const coming = a ? null : next[0] ?? null;
  const shown = a ?? coming;
  if (!shown) return null;

  const ex = shown.exercise;
  const accent = MODE_ACCENT[ex.mode] ?? "var(--pf-cream)";
  const families = ex.typefaces.map((f) => f.name).join(", ");
  const done = shown.standing === "finished";

  return (
    <section className="st pf-devoir" aria-label="Set by your teacher">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: DEVOIR_CSS }} />

      <div className="st-panel">
        <div className="st-panel__head">
          <h2 className="st-panel__title">
            {shown.teacherName} set this for {shown.className}
          </h2>
          {/* The state is said in words, never in a colour: red and green belong
              to the game, right and wrong, and nothing else. */}
          <span className="st-panel__meta">
            {done
              ? "you have finished it"
              : shown.standing === "started"
                ? "you started it"
                : a
                  ? "you have not opened it"
                  : "not open yet"}
          </span>
        </div>

        <div className="pf-devoir__row">
          <span
            className="st-session__mode"
            style={{
              borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
              color: `color-mix(in srgb, ${accent} 62%, var(--pf-cream))`,
            }}
          >
            {ex.mode}
          </span>

          <span className="pf-devoir__text">
            <span className="pf-devoir__name">{ex.title}</span>
            <span className="pf-devoir__meta">
              {ex.questionCount} questions · {families}
            </span>
          </span>

          <span className={`st-time is-${a ? urgencyOf(ex.dueInHours) : "calm"}`}>
            {a ? dueLabel(ex.dueInHours) : opensLabel(ex.opensInHours ?? 0)}
          </span>

          {a && !done && (
            <Link
              className="st-action st-action--compact st-action--primary"
              href={`/assigned/${ex.id}`}
            >
              Play it
            </Link>
          )}
          {done && shown.mine !== null && (
            <span className="pf-devoir__score"><em>{shown.mine}%</em> right</span>
          )}
        </div>
      </div>
    </section>
  );
}

/* Only the row's own columns. Everything else is the shared system. */
const DEVOIR_CSS = `
  /* The band is a single panel, so it drops the board's own stacking padding. */
  .pf-devoir { padding-bottom: 0; gap: 0; }
  .pf-devoir__row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 0.9rem; }
  .pf-devoir__text { display: grid; gap: 0.15rem; min-width: 0; }
  .pf-devoir__name { font-size: 0.95rem; color: var(--pf-cream); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-devoir__meta { font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.42); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-devoir__score { font-family: var(--pf-mono); font-size: 0.6rem; color: rgb(${CREAM} / 0.45); white-space: nowrap; }
  .pf-devoir__score em { font-style: normal; font-weight: 640; font-size: 0.72rem; color: var(--pf-cream); }

  @media (max-width: 720px) {
    .pf-devoir__row { grid-template-columns: auto minmax(0, 1fr); row-gap: 0.5rem; }
    .pf-devoir__text { grid-column: 1 / -1; grid-row: 2; }
    .pf-devoir__row .st-action { grid-column: 1 / -1; grid-row: 3; justify-self: start; }
  }
`;
