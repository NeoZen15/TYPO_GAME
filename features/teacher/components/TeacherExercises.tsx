"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BOARD_SYSTEM_CSS, CREAM, MODE_ACCENT } from "@/features/profile/components/board-system";
import { completionByClass, paceOfOpen } from "@/lib/teacher/teacher-derive";
import type { ExerciseState, TeacherProfile } from "@/lib/teacher/mock-teacher";
import { closedLabel, dueLabel, opensLabel, participation, urgencyOf } from "@/lib/teacher/teacher-time";

// ---------------------------------------------------------------------------
// Teacher — Exercises. The list, and only the list: find an exercise, see where
// it stands, get into it. What an exercise IS — what you built, and what it
// produced — belongs to its own page, which is the next screen.
//
// NO DASHBOARD, NO FILLER STATS (owner). Every column here answers a question a
// teacher actually asks while scanning: which class, how far along, how long is
// left. A finished exercise carries one number, how well it went, because that
// is the reason you would open it. Nothing else is carried "because we have it".
//
// Time is the sort key inside every group, never the creation date.
// ---------------------------------------------------------------------------

type Group = ExerciseState;

const GROUPS: ReadonlyArray<{ id: Group; label: string }> = [
  { id: "running", label: "Running" },
  { id: "scheduled", label: "Scheduled" },
  { id: "done", label: "Done" },
];

const isGroup = (value: string | null): value is Group =>
  value !== null && GROUPS.some((g) => g.id === value);

export default function TeacherExercises({ teacher }: { teacher: TeacherProfile }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // ADDRESSABLE, for the same reason the profile made its tabs addressable: a
  // group nobody can link to is a group nobody can send. "Look at what the
  // second years finished" has to be a URL. Corrected with replaceState, since
  // changing group is not a navigation and must not stack history entries.
  const requestedGroup = useSearchParams().get("group");
  const [group, setGroupState] = useState<Group>(isGroup(requestedGroup) ? requestedGroup : "running");
  const [classId, setClassId] = useState<string | null>(null);

  const setGroup = useCallback((next: Group) => {
    setGroupState(next);
    if (typeof window === "undefined") return;
    const url = next === "running" ? "/teacher?view=exercises" : `/teacher?view=exercises&group=${next}`;
    window.history.replaceState(null, "", url);
  }, []);

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
      { threshold: 0.05 },
    );
    io.observe(root);
    const fallback = window.setTimeout(reveal, 2200);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  // Counts are computed on the class filter, not on the whole set: a tab that
  // says 4 and then shows 1 is worse than no count at all.
  const scoped = useMemo(
    () => teacher.exercises.filter((e) => (classId ? e.classId === classId : true)),
    [teacher.exercises, classId],
  );

  const counts = useMemo(
    () => ({
      running: scoped.filter((e) => e.state === "running").length,
      scheduled: scoped.filter((e) => e.state === "scheduled").length,
      done: scoped.filter((e) => e.state === "done").length,
    }),
    [scoped],
  );

  const list = useMemo(() => {
    const rows = scoped.filter((e) => e.state === group);
    if (group === "running") return rows.sort((a, b) => a.dueInHours - b.dueInHours);
    if (group === "scheduled") {
      return rows.sort((a, b) => (a.opensInHours ?? 0) - (b.opensInHours ?? 0));
    }
    // Most recently closed first: the one you are most likely to want to read.
    return rows.sort((a, b) => b.dueInHours - a.dueInHours);
  }, [scoped, group]);

  const classes = teacher.classes.filter((c) => !c.archived);


  // The bottom half reads the WHOLE practice, never the current filter: it is
  // there to answer "where do my exercises land", and a picture that changes
  // when you click a tab answers something else.
  const completion = useMemo(
    () => completionByClass(teacher.classes, teacher.exercises),
    [teacher.classes, teacher.exercises],
  );
  // Which open exercises are losing the race against their own deadline.
  const pace = useMemo(() => paceOfOpen(teacher.exercises), [teacher.exercises]);

  return (
    <div ref={rootRef} className="st st--flat tc--exos">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: EXOS_CSS }} />

      <header className="st-intro st-sec">
        <span className="st-kicker">Your exercises</span>
        <h1 className="st-title">Everything you gave.</h1>
        <p className="st-lede">
          What is running, what is waiting to open, and what is done. Open one to
          see what you built and what it showed.
        </p>
      </header>

      <section className="st-panel st-sec" aria-label="Exercises">
        <div className="st-panel__head">
          <div className="st-choice" role="group" aria-label="Show">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`st-choice__btn${group === g.id ? " is-active" : ""}`}
                aria-pressed={group === g.id}
                onClick={() => setGroup(g.id)}
              >
                {g.label} {counts[g.id]}
              </button>
            ))}
          </div>

          <span className="st-panel__meta">
            {group === "running" && "soonest first"}
            {group === "scheduled" && "next to open first"}
            {group === "done" && "most recent first"}
          </span>
        </div>

        {/* Class filter. Only worth showing when there is more than one class,
            and it reuses the segmented control's own values rather than
            inventing a second kind of toggle. */}
        {classes.length > 1 && (
          <div className="st-filter" role="group" aria-label="Filter by class">
            <button
              type="button"
              className={`st-filter__btn${classId === null ? " is-active" : ""}`}
              aria-pressed={classId === null}
              onClick={() => setClassId(null)}
            >
              All classes
            </button>
            {classes.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`st-filter__btn${classId === c.id ? " is-active" : ""}`}
                aria-pressed={classId === c.id}
                onClick={() => setClassId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {list.length === 0 ? (
          <p className="st-empty">
            {group === "running" &&
              "Nothing running. Give an exercise and you will see who has started, who has finished, and how long they have left."}
            {group === "scheduled" &&
              "Nothing scheduled. An exercise can be prepared now and opened later, so a class finds it waiting on the right day."}
            {group === "done" &&
              "Nothing finished yet. Once a deadline passes, the exercise moves here with what it showed."}
          </p>
        ) : (
          <ul className="st-lines">
            {list.map((ex) => {
              const pct = participation(ex);
              return (
                <li key={ex.id}>
                  <button
                    type="button"
                    className={`st-line${ex.state === "running" ? ` is-${urgencyOf(ex.dueInHours)}` : ""}`}
                  >
                    <span className="st-session__mode">{ex.className}</span>

                    <span className="tc-exo__body">
                      <span className="st-line__name">{ex.title}</span>
                      {/* The LENGTH of the exercise. Two different words on
                          purpose: "questions" here, "left" in the countdown. */}
                      <span className="tc-exo__meta">
                        {/* The ONLY colour this page takes, and it is not a
                            choice: StatsBoard and ActivityBoard both paint a
                            session's mode with exactly these two values, 45%
                            into the contour and 62% into the ink, no fill. An
                            exercise has a mode, so it wears the same chip. The
                            class stays neutral beside it: an identity is not a
                            state, and letting both carry colour would flatten
                            the hierarchy instead of building one. */}
                        <span
                          className="tc-exo__mode"
                          style={{
                            borderColor: `color-mix(in srgb, ${MODE_ACCENT[ex.mode]} 45%, transparent)`,
                            color: `color-mix(in srgb, ${MODE_ACCENT[ex.mode]} 62%, var(--pf-cream))`,
                          }}
                        >
                          {ex.mode}
                        </span>
                        <span className="tc-exo__len">{ex.questionCount} questions</span>
                      </span>
                    </span>

                    <span className="tc-exo__part">
                      {/* Nothing to measure yet, and a 0% bar would read as a
                          class that failed rather than one that has not begun. */}
                      {ex.state === "scheduled" && (
                        <span className="tc-exo__waiting">{ex.assigned} students waiting</span>
                      )}

                      {/* THE BAR IS PARTICIPATION, AND ONLY WHILE IT RUNS. On a
                          finished row it sat next to a success percentage with
                          nothing saying which was which, so the same length read
                          as two different things. Once an exercise is closed,
                          progress is not the story any more, the outcome is. */}
                      {ex.state === "running" && (
                        <>
                          <span
                            className="st-bar"
                            role="img"
                            aria-label={`${ex.finished} of ${ex.assigned} finished`}
                          >
                            <span className="st-bar__fill" style={{ width: `${pct}%` }} />
                          </span>
                          <span className="tc-exo__frac">
                            <em>{ex.finished}</em>/{ex.assigned} finished · {ex.started} started
                          </span>
                        </>
                      )}

                      {ex.state === "done" && (
                        <span className="tc-exo__frac">
                          <em>{ex.finished}</em>/{ex.assigned} finished
                          {ex.successPct !== undefined && (
                            <> · <em>{ex.successPct}%</em> right</>
                          )}
                        </span>
                      )}
                    </span>

                    <span className="tc-exo__due">
                      <span className="st-time">
                        {ex.state === "running" && dueLabel(ex.dueInHours)}
                        {ex.state === "scheduled" && opensLabel(ex.opensInHours ?? 0)}
                        {ex.state === "done" && closedLabel(ex.dueInHours)}
                      </span>
                    </span>

                    <span className="st-line__arrow" aria-hidden="true">→</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Below the list: the whole practice at a glance ─────────────────
          NOT a repeat of the class page, which knows one class, nor of an
          exercise page, which knows one assignment. What only this page can
          show is the COMPARISON: who does the work you set, and what kind of
          work you set. Both use devices the profile already has, and the
          per-class rows stay in cream because that is what the stats board does
          with the same kind of list. */}
      {/* ── Below the list: what is at risk, and who does the work ────────
          The first version of this panel put every exercise ever opened on a
          timeline by completion. It compared things that are not comparable —
          different classes, sizes, lengths and deadlines — and worse, the newest
          exercises sat at the bottom simply because nobody could have finished
          them yet, so the picture said "participation is collapsing" when it was
          not. A dataviz that can be read backwards is worse than none.

          What replaces it compares two SHARES on the same bar: how much of the
          class has finished, and how much of the window has gone. Both are
          fractions of their own thing, so a three-day exercise for 22 students
          reads next to a two-week one for 31. The whole reading is one gap: has
          the fill reached the mark. */}
      {pace.length > 0 && (
        <section className="st-panel st-sec" aria-label="Open exercises against their deadline">
          <div className="st-panel__head">
            <h2 className="st-panel__title">Racing the deadline</h2>
            <span className="st-panel__meta">the mark is where the time is · most behind first</span>
          </div>

          <ul className="tc-pace">
            {pace.map(({ exercise: e, donePct, elapsedPct, gap }) => (
              <li key={e.id} className="tc-pace__row">
                <span className="tc-pace__text">
                  <span className="tc-pace__title">{e.title}</span>
                  <span className="tc-pace__class">{e.className}</span>
                </span>

                <span className="tc-pace__track" role="img" aria-label={`${donePct}% finished, ${elapsedPct}% of the time gone`}>
                  <span className="tc-pace__fill" style={{ width: `${donePct}%` }} />
                  {/* The mark, on the same bar and not beside it: the gap has to
                      be a distance the eye measures, not two figures to compare. */}
                  <span className="tc-pace__mark" style={{ left: `${elapsedPct}%` }} />
                </span>

                <span className="tc-pace__read">
                  <span className="tc-pace__verdict">
                    {gap >= 0 ? "on pace" : `${Math.abs(gap)} behind`}
                  </span>
                  <span className="tc-pace__nums">
                    {donePct}% done · {elapsedPct}% of the time
                  </span>
                </span>

                <span className="tc-pace__due">
                  <span className={`st-time is-${urgencyOf(e.dueInHours)}`}>{dueLabel(e.dueInHours)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="st-panel st-sec tc-comp" aria-label="Who does the work">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Who does the work</h2>
          <span className="st-panel__meta">finished, out of everything set</span>
        </div>
        <ul className="st-axes">
          {completion.map((c) => {
            const state = (c.completionPct ?? 0) >= 80 ? "lit" : (c.completionPct ?? 0) >= 55 ? "emerging" : "dormant";
            return (
              <li key={c.id} className={`st-axis st-axis--${c.completionPct === null ? "roadmap" : state}`}>
                {/* No letter column: in the profile it carries the initial of a
                    DWIGGINS axis, which means something. A class initial means
                    nothing, and two classes of one year share it. */}
                <span className="st-axis__name">{c.name}</span>
                <span className="st-axis__state">{c.given} given</span>
                <span className="st-axis__bar">
                  <span className="st-axis__fill" style={{ width: `${c.completionPct ?? 0}%` }} />
                </span>
                <span className="st-axis__frac">
                  {c.completionPct === null ? "—" : <><em>{c.completionPct}</em>%</>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/* Only what belongs to this screen. Everything above reads the site's system. */
const EXOS_CSS = `
  /* Six facts per row: class, title and length, progress, time, way in. */
  .tc--exos .st-line { grid-template-columns: 11rem minmax(0, 1fr) 13rem 8.5rem 1.2rem; }
  .tc--exos .st-session__mode { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  .tc--exos .st-filter { margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgb(${CREAM} / 0.08); }

  .tc-exo__body { display: grid; gap: 0.16rem; min-width: 0; }
  /* Racing the deadline. Monochrome on purpose: no existing usage says what
     "behind schedule" looks like in this product, and the reading does not need
     one — the eye measures the distance between the fill and the mark. */
  .tc-pace { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
  .tc-pace__row { display: grid; grid-template-columns: 14rem minmax(0, 1fr) 10rem 7rem; align-items: center; gap: 1.1rem; padding: 0.9rem 0; border-top: 1px solid rgb(${CREAM} / 0.08); }
  .tc-pace__row:first-child { border-top: none; padding-top: 0; }
  .tc-pace__text { display: grid; gap: 0.14rem; min-width: 0; }
  .tc-pace__title { font-size: 0.86rem; color: rgb(${CREAM} / 0.88); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tc-pace__class { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.06em; text-transform: uppercase; color: rgb(${CREAM} / 0.4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .tc-pace__track { position: relative; display: block; height: 0.6rem; border-radius: var(--radius-pill); background: rgb(${CREAM} / 0.1); overflow: hidden; }
  .tc-pace__fill { display: block; height: 100%; border-radius: var(--radius-pill); background: rgb(${CREAM} / 0.5); }
  .tc-pace__mark { position: absolute; top: -0.22rem; bottom: -0.22rem; width: 2px; border-radius: 1px; background: var(--pf-cream); transform: translateX(-1px); }
  .tc-pace__track { overflow: visible; }
  .st.is-armed .tc-pace__fill { transform: scaleX(0); transform-origin: left; }
  .st.is-armed.is-in .tc-pace__fill { transform: scaleX(1); transition: transform 800ms cubic-bezier(0.22, 1, 0.36, 1) 200ms; }

  .tc-pace__read { display: grid; gap: 0.14rem; }
  .tc-pace__verdict { font-family: var(--pf-mono); font-size: 0.66rem; font-weight: 640; letter-spacing: 0.06em; text-transform: uppercase; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .tc-pace__nums { font-family: var(--pf-mono); font-size: 0.56rem; color: rgb(${CREAM} / 0.42); font-variant-numeric: tabular-nums; }
  .tc-pace__due { justify-self: end; text-align: right; }

  @media (max-width: 980px) {
    .tc-pace__row { grid-template-columns: minmax(0, 1fr) 7rem; row-gap: 0.5rem; }
    .tc-pace__track { grid-column: 1 / -1; }
    .tc-pace__read { grid-column: 1; }
    .tc-pace__due { grid-row: 1; grid-column: 2; }
  }

  .tc-comp .st-axis { grid-template-columns: minmax(0, 1fr) auto minmax(4rem, 6rem) 2.8rem; }
  @media (max-width: 560px) {
    .tc-comp .st-axis { grid-template-columns: minmax(0, 1fr) auto; }
    .tc-comp .st-axis__bar { grid-column: 1 / -1; }
  }
  .tc-exo__meta { display: inline-flex; align-items: center; gap: 0.5rem; min-width: 0; }
  .tc-exo__mode { flex: none; font-family: var(--pf-mono); font-size: 0.5rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.14rem 0.42rem; border: 1px solid; border-radius: var(--radius-pill); white-space: nowrap; }
  .tc-exo__len { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.06em; text-transform: uppercase; color: rgb(${CREAM} / 0.4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tc-exo__part { display: grid; gap: 0.3rem; min-width: 0; }
  .tc-exo__frac { font-family: var(--pf-mono); font-size: 0.58rem; color: rgb(${CREAM} / 0.45); font-variant-numeric: tabular-nums; }
  .tc-exo__frac em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .tc-exo__waiting { font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.04em; text-transform: uppercase; color: rgb(${CREAM} / 0.35); }
  .tc-exo__due { justify-self: end; text-align: right; }
  .st-line.is-now .st-line__name { color: var(--pf-cream); }

  @media (max-width: 1000px) {
    .tc--exos .st-line { grid-template-columns: minmax(0, 1fr) 8.5rem; row-gap: 0.4rem; }
    .tc--exos .st-session__mode { grid-column: 1 / -1; justify-self: start; }
    .tc-exo__part { grid-column: 1 / -1; }
    .tc-exo__due { grid-row: 2; grid-column: 2; }
    .tc--exos .st-line__arrow { display: none; }
  }
`;
