"use client";

import { useEffect, useMemo, useRef } from "react";
import { BLUE, BOARD_SYSTEM_CSS, CREAM, MODE_ACCENT } from "@/features/profile/components/board-system";
import TeacherBack from "@/features/teacher/components/TeacherBack";
import type { TeacherClass, TeacherProfile } from "@/lib/teacher/mock-teacher";
import { studentDetail } from "@/lib/teacher/teacher-derive";
import { closedLabel, dueLabel } from "@/lib/teacher/teacher-time";

// ---------------------------------------------------------------------------
// Teacher — one student.
//
// NOT A SMALLER PROFILE, and everything on this page follows from that.
//
// The profile is the student's own room: free training, their pool, mastery of
// the catalogue, badges, the constellation. A teacher cannot see any of it and
// nothing here reaches for it. What this page reads is what THIS teacher's
// exercises produced, plus the one thing the profile never says: where this
// person sits against their class.
//
// It is also built to be opened twenty four times in a row. Four numbers, what
// is open right now, the history as one shape, and what they read family by
// family. No dashboard, no tabs, no second level.
//
// WHAT IS DELIBERATELY ABSENT. The pairs a student keeps swapping, which is the
// single most useful thing a teacher could read here. Nothing in the product
// produces it per person yet, and the owner's rule is that an interface is not
// filled with invented data. The shape is declared in teacher-derive, the panel
// renders the day something real fills it, and until then the page says nothing
// rather than something made up.
// ---------------------------------------------------------------------------

export default function TeacherStudentPage({
  teacher,
  cls,
  studentId,
  onBack,
}: {
  teacher: TeacherProfile;
  cls: TeacherClass;
  studentId: string;
  onBack: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  const detail = useMemo(
    () => studentDetail(cls, studentId, teacher.exercises),
    [cls, studentId, teacher.exercises],
  );

  // An address naming someone who is not in this class renders the way a bad
  // address should: it says so, and it keeps the way out.
  if (!detail) {
    return (
      <div className="st tc--person">
        <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
        <style dangerouslySetInnerHTML={{ __html: PERSON_CSS }} />
        <TeacherBack label={cls.name} onClick={onBack} />
        <section className="st-panel st-sec">
          <p className="st-empty">
            Nobody by that name is in {cls.name}. They may have been removed from
            the class since this link was made.
          </p>
        </section>
      </div>
    );
  }

  const s = detail.student;
  const invited = s.status === "invited";
  const running = detail.rows.filter((r) => r.exercise.state === "running");

  // The sentence under the name says the whole state, and never more than the
  // rows below can back up. Four cases, because a page that only writes the
  // happy one lies on the other three.
  const bandWord =
    detail.band === "ahead" ? "ahead of the class"
      : detail.band === "behind" ? "behind the class"
        : "with the class";
  const lede = invited
    ? "Invited, and has never signed in. Nothing you have given has reached them yet."
    : s.given === 0
      ? "Nothing has closed for this class yet, so there is nothing to read about them."
      : s.finished === 0
        ? `Signed in, but has not finished any of the ${s.given} exercises that have closed.`
        : `Finished ${s.finished} of ${s.given} closed exercises, ${s.successPct}% right. That is ${bandWord}.`;

  // Their line and the class's, on the same axes. Same geometry as the class
  // page's history: uniform scale, axis from zero, guides where good is.
  const AW = 640;
  const AH = 200;
  const padL = 34;
  const padR = 16;
  const padY = 24;
  const pts = detail.history;
  const hx = (i: number) => padL + (i / Math.max(1, pts.length - 1)) * (AW - padL - padR);
  const hy = (v: number) => AH - padY - (v / 100) * (AH - 2 * padY);
  const classD = pts.map((p, i) => `${i ? "L" : "M"} ${hx(i).toFixed(1)} ${hy(p.classPct).toFixed(1)}`).join(" ");
  // THE LINE BREAKS WHERE THEY DID NOT FINISH, rather than joining across the
  // gap. Drawing straight through a missed exercise would invent a result on
  // the one page whose whole job is to say what this person actually did.
  const theirD = pts
    .reduce<string[]>((segs, p, i) => {
      if (p.theirs === null) return segs;
      const started = i > 0 && pts[i - 1].theirs !== null;
      segs.push(`${started ? "L" : "M"} ${hx(i).toFixed(1)} ${hy(p.theirs).toFixed(1)}`);
      return segs;
    }, [])
    .join(" ");
  const lastDone = pts.reduce((last, p, i) => (p.theirs === null ? last : i), -1);
  const drawable = pts.filter((p) => p.theirs !== null).length > 1;

  return (
    <div ref={rootRef} className="st tc--person">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: PERSON_CSS }} />

      <TeacherBack label={cls.name} onClick={onBack} />

      <header className="st-intro st-sec">
        <span className="st-kicker">{cls.name}</span>
        <h1 className="st-title">{s.name}</h1>
        <p className="st-lede">{lede}</p>
        <p className="tc-person__id">
          <span className="tc-person__mail">{s.email}</span>
          {invited ? <span className="st-soon">invited</span> : null}
          {!invited && detail.classAvg !== null ? (
            <span className="tc-person__ev">class average {detail.classAvg}%</span>
          ) : null}
        </p>
        <a className="st-action st-action--compact tc-person__write" href={`mailto:${s.email}`}>
          Write to them
        </a>
      </header>

      {invited ? (
        /* Every panel below reads what they finished, and they have finished
           nothing: four empty panels say less than one sentence. */
        <section className="st-panel st-sec" aria-label="Not signed in yet">
          <p className="st-empty">
            This page reads what a student finished, so there is nothing to
            draw until they open something. Write to them if the invitation went
            astray.
          </p>
        </section>
      ) : (
        <>
          <section className="st-kpis tc-person__kpis st-sec" aria-label="This student in numbers">
            <div className="st-kpi">
              <span className="st-kpi__value">{s.successPct === null ? "—" : `${s.successPct}%`}</span>
              <span className="st-kpi__label">Right answers</span>
              <span className="st-kpi__helper">across what they finished</span>
            </div>
            <div className="st-kpi">
              <span className="st-kpi__value">{s.given === 0 ? "—" : `${s.finished}/${s.given}`}</span>
              <span className="st-kpi__label">Finished</span>
              <span className="st-kpi__helper">of the exercises that closed</span>
            </div>
            <div className="st-kpi">
              <span className="st-kpi__value">
                {s.successPct === null || detail.classAvg === null
                  ? "—"
                  : `${s.successPct - detail.classAvg > 0 ? "+" : ""}${s.successPct - detail.classAvg}`}
              </span>
              <span className="st-kpi__label">Against the class</span>
              <span className="st-kpi__helper">
                {detail.classAvg === null ? "nothing to compare yet" : `points, class is at ${detail.classAvg}%`}
              </span>
            </div>
            <div className="st-kpi">
              <span className="st-kpi__value">
                {detail.trendPct === null ? "—" : `${detail.trendPct > 0 ? "+" : ""}${detail.trendPct}`}
              </span>
              <span className="st-kpi__label">Since their first</span>
              <span className="st-kpi__helper">points, first to last</span>
            </div>
          </section>

          {/* ── What they can still act on, and nothing else in this panel ── */}
        <section className="st-panel st-sec" aria-label="Open right now">
          <div className="st-panel__head">
            <h2 className="st-panel__title">Right now</h2>
            {detail.scheduled > 0 && (
              <span className="st-panel__meta"><em>{detail.scheduled}</em> more scheduled</span>
            )}
          </div>
          {running.length === 0 ? (
            <p className="st-empty">
              Nothing of yours is open for this class. What is here is history until
              you give them the next one.
            </p>
          ) : (
            <ul className="tc-person__live">
              {running.map((r) => (
                <li key={r.exercise.id} className="tc-person__liverow">
                  <span
                    className="st-session__mode"
                    style={{
                      borderColor: `color-mix(in srgb, ${MODE_ACCENT[r.exercise.mode] ?? "var(--pf-cream)"} 45%, transparent)`,
                      color: `color-mix(in srgb, ${MODE_ACCENT[r.exercise.mode] ?? "var(--pf-cream)"} 62%, var(--pf-cream))`,
                    }}
                  >
                    {r.exercise.mode}
                  </span>
                  <span className="tc-person__livename">{r.exercise.title}</span>
                  {r.standing === "not_started" ? (
                    <span className="st-soon">not opened</span>
                  ) : (
                    <span className="tc-person__standing">
                      {r.standing === "finished" ? "finished it" : "started it"}
                    </span>
                  )}
                  <span className="tc-person__when">{dueLabel(r.exercise.dueInHours)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── The history: their line against the class's, then the evidence ── */}
        <section className="st-panel st-sec" aria-label="How it has gone">
          <div className="st-panel__head">
            <h2 className="st-panel__title">How it has gone</h2>
            <span className="st-panel__meta">oldest first</span>
          </div>

          {pts.length === 0 ? (
            <p className="st-empty">
              Nothing has closed yet. Once a deadline passes, each exercise leaves a
              line here, next to what the class did with it.
            </p>
          ) : (
            <>
              {drawable && (
                <>
                  <svg
                    className="st-hist__chart"
                    viewBox={`0 0 ${AW} ${AH}`}
                    role="img"
                    aria-label={`Right answers per exercise, ${s.name} against the class`}
                  >
                    {[25, 50, 75].map((v) => (
                      <g key={v}>
                        <line className="st-hist__grid" x1={padL} y1={hy(v)} x2={AW - padR} y2={hy(v)} />
                        <text className="st-hist__gridlabel" x={padL - 8} y={hy(v) + 3}>{v}</text>
                      </g>
                    ))}
                    <line className="st-hist__base" x1={padL} y1={AH - padY} x2={AW - padR} y2={AH - padY} />

                    {/* The class, BEHIND and in the page's own cream: it is the
                        reference this person is read against, not a second
                        subject. Dashed, so the two lines never need a colour to
                        tell them apart. No fill under either one, unlike the class
                        page: two filled curves crossing is mud. */}
                    <path className="tc-person__ref" d={classD} fill="none" />
                    <path className="st-hist__line" d={theirD} fill="none" />

                    {pts.map((p, i) => {
                      if (p.theirs === null) return null;
                      const now = i === lastDone;
                      return (
                        <g key={p.id}>
                          <circle
                            className={`st-hist__dot${now ? " is-now" : ""}`}
                            cx={hx(i)}
                            cy={hy(p.theirs)}
                            r={now ? 5 : 3.5}
                          />
                          <text
                            className={`st-hist__point${now ? " is-now" : ""}`}
                            x={hx(i)}
                            y={hy(p.theirs) - 12}
                            textAnchor={i === 0 ? "start" : now ? "end" : "middle"}
                            dx={i === 0 ? 4 : now ? -4 : 0}
                          >
                            {p.theirs}%
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  <ul className="st-legend tc-person__legend">
                    <li>
                      <span className="st-legend__sw" style={{ background: BLUE }} />
                      <em>{s.name.split(" ")[0]}</em>
                    </li>
                    <li>
                      <span className="st-legend__sw" style={{ background: `rgb(${CREAM} / 0.28)` }} />
                      the class
                    </li>
                  </ul>
                </>
              )}

              <ul className="st-hist">
                {pts.map((p, i) => (
                  <li key={p.id} className={`st-hist__row${i === lastDone ? " is-now" : ""}`}>
                    <span className="st-hist__name">{p.title}</span>
                    <span className="st-bar" role="img" aria-label={p.theirs === null ? "not finished" : `${p.theirs}% right`}>
                      <span className="st-bar__fill" style={{ width: `${p.theirs ?? 0}%` }} />
                    </span>
                    <span className="st-hist__val">
                      {p.theirs === null ? <em className="tc-person__none">—</em> : <em>{p.theirs}%</em>}
                      {p.theirs === null ? " not finished" : " right"}
                    </span>
                    <span className="tc-person__ref-val">class {p.classPct}%</span>
                    <span className="st-hist__when">
                      {closedLabel(detail.rows.find((r) => r.exercise.id === p.id)?.exercise.dueInHours ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* ── Family by family, the profile's axis row, on one person ── */}
        <section className="st-panel st-sec" aria-label="Families">
          <div className="st-panel__head">
            <h2 className="st-panel__title">Family by family</h2>
            <span className="st-panel__meta">
              best first · from <em>{s.finished}</em> they finished
            </span>
          </div>
          {detail.families.length === 0 ? (
            <p className="st-empty">
              Nothing measured yet. Each exercise they finish adds the families it
              asked about, and the picture sharpens as they pile up.
            </p>
          ) : (
            <ul className="st-axes">
              {detail.families.map((f) => {
                const state = f.rightPct >= 75 ? "lit" : f.rightPct >= 55 ? "emerging" : "dormant";
                const label = state === "lit" ? "solid" : state === "emerging" ? "coming" : "resists";
                return (
                  <li key={f.slug} className={`st-axis st-axis--${state}`}>
                    <span className="st-axis__letter">{f.name.charAt(0)}</span>
                    <span className="st-axis__name">{f.name}</span>
                    <span className="st-axis__state">{label}</span>
                    <span className="st-axis__bar">
                      <span className="st-axis__fill" style={{ width: `${f.rightPct}%` }} />
                    </span>
                    <span className="st-axis__frac"><em>{f.rightPct}</em>%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* The pairs THIS person keeps swapping. Nothing produces them yet, so
            nothing renders: see the note at the top of the file. */}
        {detail.confusions.length > 0 && (
          <section className="st-panel st-sec" aria-label="Confusions">
            <h2 className="st-panel__title">Pairs they keep swapping</h2>
            <ul className="tc-person__conf">
              {detail.confusions.map((k) => (
                <li key={`${k.seen.slug}-${k.chosen.slug}`}>
                  <em>{k.seen.name}</em> read as <em>{k.chosen.name}</em>, {k.times} times
                </li>
              ))}
            </ul>
          </section>
        )}
        </>
      )}
    </div>
  );
}

/* Only what belongs to this screen. Everything else reads the site's system. */
const PERSON_CSS = `
  .tc-person__kpis { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 760px) { .tc-person__kpis { grid-template-columns: repeat(2, 1fr); } }

  /* The identity line: who they are, in one row under the name. */
  .tc-person__id { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 0.5rem 0.8rem; margin: 0.1rem 0 0; }
  .tc-person__mail { font-family: var(--pf-mono); font-size: 0.6rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.42); }
  .tc-person__ev { font-family: var(--pf-mono); font-size: 0.6rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.42); }
  .tc-person__write { margin-top: 0.7rem; }

  /* Right now — one row per open exercise, and usually exactly one. */
  .tc-person__live { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
  .tc-person__liverow { display: grid; grid-template-columns: 7rem minmax(0, 1fr) 8rem 7rem; align-items: center; gap: 0.9rem; padding: 0.6rem 0; border-top: 1px solid rgb(${CREAM} / 0.08); }
  .tc-person__liverow:first-child { border-top: none; padding-top: 0; }
  .tc-person__livename { font-size: 0.86rem; color: rgb(${CREAM} / 0.88); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tc-person__standing { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .tc-person__when { font-family: var(--pf-mono); font-size: 0.6rem; color: rgb(${CREAM} / 0.4); text-align: right; }
  @media (max-width: 760px) {
    .tc-person__liverow { grid-template-columns: auto minmax(0, 1fr); row-gap: 0.35rem; }
    .tc-person__livename { grid-column: 1 / -1; grid-row: 2; }
    .tc-person__when { grid-column: 1 / -1; grid-row: 3; text-align: left; }
  }

  /* The class's line: the page's own cream, dashed, behind. A reference, not a
     second subject, so it takes no colour of its own. */
  .tc-person__ref { stroke: rgb(${CREAM} / 0.28); stroke-width: 1.5; stroke-dasharray: 5 5; stroke-linejoin: round; }
  .st.is-armed .tc-person__ref { opacity: 0; }
  .st.is-armed.is-in .tc-person__ref { opacity: 1; transition: opacity 700ms ease 250ms; }
  .tc-person__legend { justify-content: flex-end; margin: -0.6rem 0 1.2rem; }

  /* The history rows carry one column the class page does not: what the class
     did with the same exercise, right next to what they did. */
  .tc--person .st-hist__row { grid-template-columns: minmax(0, 1fr) 10rem 8rem 6rem 7rem; }
  .tc-person__ref-val { font-family: var(--pf-mono); font-size: 0.6rem; color: rgb(${CREAM} / 0.38); font-variant-numeric: tabular-nums; }
  .tc-person__none { color: rgb(${CREAM} / 0.3); }
  @media (max-width: 820px) {
    .tc--person .st-hist__row { grid-template-columns: minmax(0, 1fr) auto; }
    .tc-person__ref-val { text-align: right; }
  }

  .tc-person__conf { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; font-size: 0.86rem; color: rgb(${CREAM} / 0.6); }
  .tc-person__conf em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
`;
