"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BLUE, BOARD_SYSTEM_CSS, CREAM, MODE_ACCENT } from "@/features/profile/components/board-system";
import TeacherBack from "@/features/teacher/components/TeacherBack";
import type { TeacherClass, TeacherProfile } from "@/lib/teacher/mock-teacher";
import {
  classStats,
  closedOfClass,
  distribution,
  exercisesOfClass,
  familyResults,
  needsAttention,
  studentRows,
} from "@/lib/teacher/teacher-derive";
import { closedLabel, dueLabel, opensLabel } from "@/lib/teacher/teacher-time";

// ---------------------------------------------------------------------------
// Teacher — one class.
//
// The page answers two questions in this order: how is this class reading type,
// and who in it needs me. Managing the class (renaming it, the join code,
// archiving) is real work but it is not why you open the page, so it sits at
// the bottom, present and quiet.
//
// EVERYTHING HERE COMES FROM THE EXERCISES THIS TEACHER GAVE. Not one number
// reaches a student's own training, their pool or their mastery, and there is
// no field for it to reach. That is the product's frozen promise, and on this
// page it is also the reason the reading is honest: it only knows what it was
// shown.
// ---------------------------------------------------------------------------

export default function TeacherClassPage({
  teacher,
  cls,
  onBack,
  onOpenStudent,
}: {
  teacher: TeacherProfile;
  cls: TeacherClass;
  onBack: () => void;
  onOpenStudent: (studentId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(cls.name);
  const [draft, setDraft] = useState(cls.name);
  const [adding, setAdding] = useState(false);
  const [paste, setPaste] = useState("");
  const [invited, setInvited] = useState<number | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);

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

  const exercises = useMemo(() => exercisesOfClass(cls.id, teacher.exercises), [cls.id, teacher.exercises]);
  const closed = useMemo(() => closedOfClass(cls.id, teacher.exercises), [cls.id, teacher.exercises]);
  const stats = useMemo(() => classStats(cls, teacher.exercises), [cls, teacher.exercises]);
  const families = useMemo(() => familyResults(cls.id, teacher.exercises), [cls.id, teacher.exercises]);
  const students = useMemo(() => studentRows(cls, teacher.exercises), [cls, teacher.exercises]);
  const signal = teacher.signals.find((s) => s.classId === cls.id);
  const roster = useMemo(() => students.filter((s) => !removed.includes(s.id)), [students, removed]);
  const attention = useMemo(() => needsAttention(roster), [roster]);

  // One address per line, commas tolerated: a teacher pastes from a spreadsheet
  // or from their own mail client, and neither shape should be refused.
  const pastedEmails = paste
    .split(/[\n,;]+/)
    .map((v) => v.trim())
    .filter((v) => v.includes("@"));

  const dist = useMemo(() => distribution(roster, stats.successPct), [roster, stats.successPct]);
  const open = exercises.find((e) => e.state === "running");

  // The history line. Two points is the minimum for a line to mean anything;
  // below that the page keeps the rows and drops the chart.
  //
  // DRAWN TO SCALE, not stretched. The profile's sparkline uses
  // preserveAspectRatio="none" because it carries nothing but a shape; this one
  // carries labels and points, and a non-uniform stretch turns a circle into an
  // ellipse and a letter into a smear. Uniform scaling, wide viewBox.
  const AW = 640;
  const AH = 200;
  const padL = 34;
  const padR = 16;
  const padY = 24;
  const hx = (i: number) => padL + (i / Math.max(1, closed.length - 1)) * (AW - padL - padR);
  // The scale starts at zero on purpose. Cropping the axis to the data is how a
  // three-point rise is made to look like a triumph, and this page is meant to
  // be trusted rather than to flatter. The guides say where good is.
  const hy = (v: number) => AH - padY - (v / 100) * (AH - 2 * padY);
  const lineD = closed.map((e, i) => `${i ? "L" : "M"} ${hx(i).toFixed(1)} ${hy(e.successPct ?? 0).toFixed(1)}`).join(" ");
  const areaD = closed.length > 1
    ? `${lineD} L ${hx(closed.length - 1).toFixed(1)} ${AH - padY} L ${hx(0).toFixed(1)} ${AH - padY} Z`
    : "";

  const behind = students.filter((s) => s.live === "not_started").length;

  return (
    <div ref={rootRef} className="st st--flat tc--class">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: CLASS_CSS }} />

      <TeacherBack label="All classes" onClick={onBack} />

      <header className="st-intro st-sec">
        <span className="st-kicker">{cls.level}</span>
        <h1 className="st-title">{name}</h1>
        <p className="st-lede">
          {roster.length} students. Everything below is what your exercises
          showed. What this class does on its own time stays with them.
        </p>
        <button type="button" className="st-action st-action--primary tc-give">
          New exercise for this class
        </button>
      </header>

      {/* ── The four numbers that describe this class ── */}
      <section className="st-kpis tc-kpis st-sec" aria-label="This class in numbers">
        <div className="st-kpi">
          <span className="st-kpi__value">{stats.given}</span>
          <span className="st-kpi__label">Exercises given</span>
          <span className="st-kpi__helper">{stats.closed} closed</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{stats.successPct === null ? "—" : `${stats.successPct}%`}</span>
          <span className="st-kpi__label">Right answers</span>
          <span className="st-kpi__helper">across closed exercises</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">
            {stats.trendPct === null ? "—" : `${stats.trendPct > 0 ? "+" : ""}${stats.trendPct}`}
          </span>
          <span className="st-kpi__label">Since the first</span>
          <span className="st-kpi__helper">points, first to last</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{stats.lastParticipation === null ? "—" : `${stats.lastParticipation}%`}</span>
          <span className="st-kpi__label">Turned up</span>
          <span className="st-kpi__helper">on the last one closed</span>
        </div>
      </section>

      {/* ── Where the class stands ────────────────────────────────────────
          One panel, three answers, and each one is a question a teacher asks
          out loud: how well does this class read, is it together or pulling
          apart, and is the current exercise actually being done. The ring, the
          segmented bar and the legend are the profile's own devices, unchanged. */}
      <section className="st-panel st-sec" aria-label="Where the class stands">
        <h2 className="st-panel__title">Where the class stands</h2>
        <div className="st-ringwrap">
          <svg className="st-ring" viewBox="0 0 140 140" aria-hidden="true">
            <circle className="st-ring__track" cx="70" cy="70" r="52" />
            <circle
              className="st-ring__arc"
              cx="70"
              cy="70"
              r="52"
              pathLength={100}
              strokeDasharray={`${stats.successPct ?? 0} 100`}
              transform="rotate(-90 70 70)"
            />
            <text className="st-ring__pct" x="70" y="68">{stats.successPct ?? 0}%</text>
            <text className="st-ring__sub" x="70" y="86">right</text>
          </svg>

          <div className="tc-stand">
            <div className="tc-stand__block">
              <span className="st-panel__title">How they are spread</span>
              <span className="st-seg" role="img" aria-label="Class spread">
                <span className="st-seg__part st-seg__part--lit" style={{ flexGrow: dist.ahead }} />
                <span className="st-seg__part st-seg__part--emerging" style={{ flexGrow: dist.with }} />
                <span className="st-seg__part st-seg__part--dormant" style={{ flexGrow: dist.behind }} />
                <span className="st-seg__part st-seg__part--roadmap" style={{ flexGrow: dist.no_data + dist.invited }} />
              </span>
              <ul className="st-legend">
                <li><span className="st-legend__sw st-legend__sw--lit" /><em>{dist.ahead}</em> ahead of the class</li>
                <li><span className="st-legend__sw st-legend__sw--emerging" /><em>{dist.with}</em> with it</li>
                <li><span className="st-legend__sw st-legend__sw--dormant" /><em>{dist.behind}</em> behind</li>
                <li><span className="st-legend__sw st-legend__sw--roadmap" /><em>{dist.no_data + dist.invited}</em> nothing to read yet</li>
              </ul>
            </div>

            <div className="tc-stand__block">
              <span className="st-panel__title">
                {open ? `Doing "${open.title}"` : "Nothing running"}
                {open && (
                  <span className="tc-live__tag" style={{ ["--m" as string]: MODE_ACCENT[open.mode] }}>
                    {open.mode}
                  </span>
                )}
              </span>
              {open ? (
                <>
                  <span
                    className="st-seg tc-live__seg"
                    role="img"
                    aria-label="Participation"
                    style={{ ["--m" as string]: MODE_ACCENT[open.mode] }}
                  >
                    <span className="st-seg__part st-seg__part--lit" style={{ flexGrow: open.finished }} />
                    <span className="st-seg__part st-seg__part--emerging" style={{ flexGrow: open.started - open.finished }} />
                    <span className="st-seg__part st-seg__part--dormant" style={{ flexGrow: open.assigned - open.started }} />
                  </span>
                  <ul className="st-legend">
                    <li>
                      <span
                        className="st-legend__sw st-legend__sw--lit tc-live__sw"
                        style={{ ["--m" as string]: MODE_ACCENT[open.mode] }}
                      />
                      <em>{open.finished}</em> finished
                    </li>
                    <li><span className="st-legend__sw st-legend__sw--emerging" /><em>{open.started - open.finished}</em> started</li>
                    <li><span className="st-legend__sw st-legend__sw--dormant" /><em>{open.assigned - open.started}</em> not opened</li>
                  </ul>
                  <span className="st-panel__meta">{dueLabel(open.dueInHours)}</span>
                </>
              ) : (
                <p className="st-empty">Give them something and this fills up as they play.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── What DWIGGINS sees, and what it would do about it ── */}
      {signal && (
        <section className="st-panel tc-propose st-sec" aria-label="Suggestion">
          <h2 className="st-panel__title">DWIGGINS suggests</h2>
          <p className="tc-propose__head">{signal.headline}</p>
          <p className="tc-propose__why">{signal.because}</p>
          <p className="tc-propose__mix">
            An exercise mixing what they have, what is nearly there, what resists,
            and a little they have never seen. Never only their gaps.
          </p>
          <button type="button" className="st-action st-action--compact">
            {signal.actionLabel}
          </button>
        </section>
      )}

      {/* ── Who to look at first, each line with its reason ── */}
      <section className="st-panel st-sec" aria-label="Students to look at">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Worth a word</h2>
          <span className="st-panel__meta">out of <em>{roster.length}</em></span>
        </div>
        {attention.length === 0 ? (
          <p className="st-empty">
            Nobody is stuck. Everyone has signed in, opened what is running, and
            nobody is trailing the class.
          </p>
        ) : (
          <ul className="tc-att">
            {attention.map((g) => (
              <li key={g.reason} className="tc-att__row">
                <span className="tc-att__count"><em>{g.students.length}</em></span>
                <span className="tc-att__text">
                  <span className="tc-att__why">{g.reason}</span>
                  <span className="tc-att__names">
                    {g.students.slice(0, 4).map((s) => s.name).join(", ")}
                    {g.students.length > 4 && ` and ${g.students.length - 4} more`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── How it has gone, exercise after exercise ── */}
      <section className="st-panel st-sec" aria-label="Progression">
        <div className="st-panel__head">
          <h2 className="st-panel__title">How it has gone</h2>
          <span className="st-panel__meta">oldest first</span>
        </div>
        {closed.length === 0 ? (
          <p className="st-empty">
            Nothing has closed yet. Once a deadline passes, each exercise leaves a
            line here and you can see the class move.
          </p>
        ) : (
          <>
            {/* The line answers "is this class getting better", which is the
                one question a column of percentages cannot answer at a glance.
                The rows stay underneath: the shape is the reading, the rows are
                the evidence. */}
            {closed.length > 1 && (
              <svg className="st-hist__chart" viewBox={`0 0 ${AW} ${AH}`} role="img" aria-label="Right answers, exercise after exercise">
                <defs>
                  <linearGradient id="st-hist-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={`color-mix(in srgb, ${BLUE} 30%, transparent)`} />
                    <stop offset="1" stopColor="transparent" />
                  </linearGradient>
                </defs>

                {/* Where good is. A curve without references is a shape. */}
                {[25, 50, 75].map((v) => (
                  <g key={v}>
                    <line className="st-hist__grid" x1={padL} y1={hy(v)} x2={AW - padR} y2={hy(v)} />
                    <text className="st-hist__gridlabel" x={padL - 8} y={hy(v) + 3}>{v}</text>
                  </g>
                ))}
                <line className="st-hist__base" x1={padL} y1={AH - padY} x2={AW - padR} y2={AH - padY} />

                <path className="st-hist__fill" d={areaD} fill="url(#st-hist-grad)" />
                <path className="st-hist__line" d={lineD} fill="none" />

                {closed.map((e, i) => {
                  const now = i === closed.length - 1;
                  return (
                    <g key={e.id}>
                      <circle
                        className={`st-hist__dot${now ? " is-now" : ""}`}
                        cx={hx(i)}
                        cy={hy(e.successPct ?? 0)}
                        r={now ? 5 : 3.5}
                      />
                      {/* The first label sat on top of the axis figures and the
                          last one ran off the right edge. Ends anchor inward. */}
                      <text
                        className={`st-hist__point${now ? " is-now" : ""}`}
                        x={hx(i)}
                        y={hy(e.successPct ?? 0) - 12}
                        textAnchor={i === 0 ? "start" : now ? "end" : "middle"}
                        dx={i === 0 ? 4 : now ? -4 : 0}
                      >
                        {e.successPct}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            <ul className="st-hist">
              {closed.map((ex, i) => (
                <li key={ex.id} className={`st-hist__row${i === closed.length - 1 ? " is-now" : ""}`}>
                  <span className="st-hist__name">{ex.title}</span>
                  <span className="st-bar" role="img" aria-label={`${ex.successPct}% right`}>
                    <span className="st-bar__fill" style={{ width: `${ex.successPct}%` }} />
                  </span>
                  <span className="st-hist__val"><em>{ex.successPct}%</em> right</span>
                  <span className="st-hist__when">{closedLabel(ex.dueInHours)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ── What they read, and what still resists ────────────────────────
          The profile's axis row, unchanged: a letter, a name, a state, a bar
          and a figure. It was built to answer "where is my eye solid and where
          is it not", which is the same question one level up. A family at 82%
          and one at 44% now differ in weight and not only in digits. */}
      <section className="st-panel st-sec" aria-label="Families">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Family by family</h2>
          <span className="st-panel__meta">best first · from <em>{closed.length}</em> closed</span>
        </div>
        {families.length === 0 ? (
          <p className="st-empty">
            Nothing measured yet. Each closed exercise adds the families it asked
            about, and the picture sharpens as they pile up.
          </p>
        ) : (
          <ul className="st-axes">
            {families.map((f) => {
              const state = f.rightPct >= 75 ? "lit" : f.rightPct >= 55 ? "emerging" : "dormant";
              const label = state === "lit" ? "solid" : state === "emerging" ? "coming" : "resists";
              return (
                <li key={f.name} className={`st-axis st-axis--${state}`}>
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

      {/* ── The pairs they keep swapping ── */}
      <section className="st-panel st-sec" aria-label="Confusions">
        <h2 className="st-panel__title">Pairs they keep swapping</h2>
        {cls.confusions.length === 0 ? (
          <p className="st-empty">
            No pair has come up often enough to mean anything yet. It takes a few
            closed exercises before a confusion is a pattern rather than a slip.
          </p>
        ) : (
          <ul className="tc-conf">
            {cls.confusions.map((c) => (
              <li key={`${c.seen.slug}-${c.chosen.slug}`} className="tc-conf__row">
                <span className="tc-conf__pair">
                  <em>{c.seen.name}</em> read as <em>{c.chosen.name}</em>
                </span>
                {/* Sized against the worst pair, so "fourteen times" and "six
                    times" stop being two numbers and become two lengths. */}
                <span className="st-bar tc-conf__bar" role="img" aria-label={`${c.times} times`}>
                  <span
                    className="st-bar__fill"
                    style={{ width: `${Math.round((c.times / Math.max(...cls.confusions.map((x) => x.times))) * 100)}%` }}
                  />
                </span>
                <span className="tc-conf__times">{c.times} times</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Its exercises: an index, not an analysis ──────────────────────
          THE LINE THIS SECTION MUST NOT CROSS. A class page is the durable
          view: who is in it, how it moves, what keeps resisting. Everything
          about ONE assignment — the brief, the families it asked about, the
          difficulty, who answered what, the confusions it produced, the
          per-question reading — belongs to that exercise's own page. So this
          list carries a name, a state and a time, and nothing else: it is the
          way in, and the way in should not try to be the room. */}
      <section className="st-panel st-sec" aria-label="Exercises for this class">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Exercises</h2>
          <span className="st-panel__meta"><em>{exercises.length}</em> given in all</span>
        </div>
        {exercises.length === 0 ? (
          <p className="st-empty">
            Nothing given yet. The first exercise is what makes every reading on
            this page possible.
          </p>
        ) : (
          <ul className="st-lines tc-exolist">
            {[...exercises]
              .sort((a, b) => a.dueInHours - b.dueInHours)
              .map((ex) => (
                <li key={ex.id}>
                  <button type="button" className="st-line">
                    <span className="st-line__name">{ex.title}</span>
                    <span
                      className="tc-exolist__mode"
                      style={{ ["--m" as string]: MODE_ACCENT[ex.mode] }}
                    >
                      {ex.mode}
                    </span>
                    <span className="tc-exolist__state">
                      {ex.state === "running" && <span className="tc-stu__tag">running</span>}
                      {ex.state === "scheduled" && <span className="st-soon">scheduled</span>}
                      {ex.state === "done" && <span className="tc-stu__quiet">closed</span>}
                    </span>
                    <span className="st-line__when">
                      {ex.state === "running" && dueLabel(ex.dueInHours)}
                      {ex.state === "scheduled" && opensLabel(ex.opensInHours ?? 0)}
                      {ex.state === "done" && closedLabel(ex.dueInHours)}
                    </span>
                    <span className="st-line__arrow" aria-hidden="true">→</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* ── Who is in it. A working list, not a summary. ── */}
      <section className="st-panel st-sec" aria-label="Students">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Students</h2>
          <div className="tc-stu__tools">
            <span className="st-panel__meta">
              <em>{roster.length}</em> in the class
              {behind > 0 && <> · <em>{behind}</em> have not opened what is running</>}
            </span>
            <button type="button" className="st-action st-action--compact" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
              Add students
            </button>
          </div>
        </div>

        {adding && (
          <form
            className="tc-add"
            onSubmit={(e) => {
              e.preventDefault();
              setInvited(pastedEmails.length);
              setPaste("");
              setAdding(false);
            }}
          >
            <label className="st-field">
              <span className="st-field__label">Paste their addresses, one per line</span>
              <textarea
                className="st-textarea"
                value={paste}
                placeholder={"camille.bertrand@etu.ecole-design.fr\nhugo.moreau@etu.ecole-design.fr"}
                onChange={(e) => setPaste(e.target.value)}
              />
            </label>
            <div className="tc-form__actions">
              <button type="submit" className="st-action st-action--compact st-action--primary" disabled={pastedEmails.length === 0}>
                Invite {pastedEmails.length > 0 ? pastedEmails.length : ""}
              </button>
              <button type="button" className="st-action st-action--compact" onClick={() => { setAdding(false); setPaste(""); }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {invited !== null && (
          <p className="tc-add__done">
            {invited} invitation{invited === 1 ? "" : "s"} would go out. Each person
            picks their own password, you never set it for them.
          </p>
        )}

        {/* A header row, because six columns of numbers without one is a puzzle. */}
        <div className="tc-stu__head" aria-hidden="true">
          <span>Name</span>
          <span>Status</span>
          <span>Closed</span>
          <span>Right</span>
          <span>Running</span>
          <span />
        </div>

        <ul className="tc-stus">
          {roster.map((s) => (
            <li key={s.id} className="tc-stu">
              {/* The name is the way in, so the name is the button. The row is
                  not one: it also carries a remove control, and a button inside
                  a button is not markup a browser can make sense of. */}
              <button type="button" className="tc-stu__open" onClick={() => onOpenStudent(s.id)}>
                <span className="tc-stu__name">{s.name}</span>
                <span className="tc-stu__mail">{s.email}</span>
              </button>

              <span className="tc-stu__status">
                {s.status === "invited" ? <span className="st-soon">invited</span> : <span className="tc-stu__quiet">active</span>}
              </span>

              <span className="tc-stu__meta">{s.given === 0 ? "—" : `${s.finished}/${s.given}`}</span>

              <span className="tc-stu__score">
                {s.successPct === null ? <span className="tc-stu__none">—</span> : <em>{s.successPct}%</em>}
              </span>

              <span className="tc-stu__live">
                {s.live === "finished" && <span className="tc-stu__tag">finished</span>}
                {s.live === "started" && <span className="tc-stu__tag is-mid">started</span>}
                {s.live === "not_started" && <span className="st-soon">not started</span>}
                {s.live === "nothing_open" && <span className="tc-stu__quiet">—</span>}
              </span>

              <button
                type="button"
                className="tc-stu__del"
                aria-label={`Remove ${s.name} from the class`}
                onClick={() => setRemoved((prev) => [...prev, s.id])}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Managing the class. Real work, but not why you came. ── */}
      <section className="st-panel tc-admin st-sec" aria-label="Class settings">
        <h2 className="st-panel__title">Class settings</h2>

        {renaming ? (
          <form
            className="tc-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) setName(draft.trim());
              setRenaming(false);
            }}
          >
            <label className="st-field">
              <span className="st-field__label">Class name</span>
              <input
                type="text"
                className="st-input"
                value={draft}
                maxLength={48}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
            <div className="tc-form__actions">
              <button type="submit" className="st-action st-action--compact st-action--primary" disabled={!draft.trim()}>
                Save
              </button>
              <button type="button" className="st-action st-action--compact" onClick={() => { setDraft(name); setRenaming(false); }}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="tc-admin__rows">
            <div className="tc-admin__row">
              <span className="tc-admin__label">Name</span>
              <span className="tc-admin__val">{name}</span>
              <button type="button" className="st-action st-action--compact" onClick={() => setRenaming(true)}>
                Rename
              </button>
            </div>
            <div className="tc-admin__row">
              <span className="tc-admin__label">Join code</span>
              {/* Students type this once, on a computer. How they join for the
                  first time is still open, so nothing here promises a flow. */}
              <span className="tc-admin__val tc-admin__code">{cls.joinCode}</span>
              <span className="st-soon">Joining flow not decided</span>
            </div>
            <div className="tc-admin__row">
              <span className="tc-admin__label">Students</span>
              <span className="tc-admin__val">{roster.length} in the class</span>
              <button type="button" className="st-action st-action--compact" onClick={() => setAdding(true)}>Add students</button>
            </div>
            <div className="tc-admin__row">
              <span className="tc-admin__label">Archive</span>
              <span className="tc-admin__val tc-admin__quiet">
                It stops appearing everywhere else. Its exercises stay readable.
              </span>
              <button type="button" className="st-action st-action--compact">Archive</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* Only what belongs to this screen. Everything above reads the site's system. */
const CLASS_CSS = `
  .tc-give { margin-top: 0.8rem; }
  .tc-kpis { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 760px) { .tc-kpis { grid-template-columns: repeat(2, 1fr); } }

  /* Suggestion — the one accented panel, by contour, as a lit axis is marked. */
  .tc-propose { border-color: rgb(${CREAM} / 0.22); }
  .tc-propose__head { margin: 0 0 0.3rem; font-size: 0.95rem; line-height: 1.35; color: var(--pf-cream); text-wrap: pretty; }
  .tc-propose__why { margin: 0 0 0.7rem; font-family: var(--pf-mono); font-size: 0.6rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.45); }
  .tc-propose__mix { margin: 0 0 1rem; max-width: 60ch; text-wrap: pretty; font-size: 0.82rem; line-height: 1.5; color: rgb(${CREAM} / 0.55); }

  /* Where the class stands.
     Three quiet accents, each one already meaning what it is used for here:
     the running exercise wears its MODE colour exactly as the exercise rows do,
     which is the one usage the profile actually establishes (StatsBoard and
     ActivityBoard both paint a mode with MODE_ACCENT). The RING STAYS NEUTRAL: it
     is the largest shape in the panel, and a large shape carrying a hue is not
     an accent, it is a colour scheme. Colour goes on the small marks.

     RATIOS. The system's published mixes (55% into the ink, 45% contour, 8%
     wash) are calibrated for SMALL TEXT and THIN CONTOURS. Used on a 9px ring
     stroke or a filled bar they come out as a block of colour and the panel
     turns into a dashboard, which is exactly what was asked against. Large
     filled surfaces sit around 22 to 26%, small marks keep 50 to 55%. */
  .tc-live__tag { display: inline-block; margin-left: 0.5rem; font-family: var(--pf-mono); font-size: 0.5rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.12rem 0.42rem; border-radius: var(--radius-pill); border: 1px solid color-mix(in srgb, var(--m) 45%, transparent); color: color-mix(in srgb, var(--m) 62%, var(--pf-cream)); vertical-align: 0.05em; }
  .tc-live__seg .st-seg__part--lit { background: color-mix(in srgb, var(--m) 26%, var(--pf-cream)); }
  .tc-live__sw { background: color-mix(in srgb, var(--m) 26%, var(--pf-cream)) !important; }

  /* Where the class stands */
  .tc-stand { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: clamp(1rem, 2.4vw, 1.8rem); min-width: 0; }
  .tc-stand__block { display: grid; gap: 0.5rem; align-content: start; min-width: 0; }
  .tc-stand__block .st-panel__title { margin: 0; }
  .tc-stand__block .st-seg { margin-bottom: 0.2rem; }
  .tc-stand__block .st-panel__meta { margin-top: 0.2rem; }
  @media (max-width: 900px) {
    .tc-stand { grid-template-columns: 1fr; }
    .st-ringwrap { flex-direction: column; align-items: flex-start; }
  }

  /* Families */
  @media (max-width: 700px) {
    .tc-conf__row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 0.3rem; }
    .tc-conf__bar { grid-column: 1 / -1; }
  }

  /* Confusions */
  .tc-conf { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
  .tc-conf__row { display: grid; grid-template-columns: minmax(0, 1fr) 8rem 5.5rem; align-items: center; gap: 1rem; padding: 0.6rem 0; border-top: 1px solid rgb(${CREAM} / 0.08); }
  .tc-conf__row:first-child { border-top: none; padding-top: 0; }
  .tc-conf__pair { font-size: 0.86rem; color: rgb(${CREAM} / 0.6); }
  .tc-conf__pair em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  /* NEUTRAL, AND WAITING FOR A DECISION. Red was chosen here because a
     confusion is a wrong answer, which is true and is not enough: --error-red is
     painted nowhere in the profile, so no existing usage says a confusion looks
     like that. The bar keeps the system's cream until the owner decides. */
  .tc-conf__bar { align-self: center; }
  .tc-conf__times { text-align: right; font-family: var(--pf-mono); font-size: 0.6rem; letter-spacing: 0.04em; text-transform: uppercase; color: rgb(${CREAM} / 0.42); white-space: nowrap; font-variant-numeric: tabular-nums; }

  /* The exercise index: a way in, three columns, no analysis. */
  .tc--class .tc-exolist .st-line { grid-template-columns: minmax(0, 1fr) 6rem 7rem 8rem 1.2rem; }
  /* The session chip's recipe, verbatim from StatsBoard and ActivityBoard:
     contour at 45%, ink mixed at 62%, NO FILL. It had been built from the arena
     card's ratios instead, which carry an 8% wash the row chips do not. */
  .tc-exolist__mode { justify-self: start; font-family: var(--pf-mono); font-size: 0.54rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.18rem 0.5rem; border-radius: var(--radius-pill); border: 1px solid color-mix(in srgb, var(--m) 45%, transparent); color: color-mix(in srgb, var(--m) 62%, var(--pf-cream)); white-space: nowrap; }
  .tc-exolist__state { justify-self: start; }

  /* Attention list */
  .tc-att { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
  .tc-att__row { display: grid; grid-template-columns: 2.4rem minmax(0, 1fr); align-items: baseline; gap: 0.9rem; padding: 0.7rem 0; border-top: 1px solid rgb(${CREAM} / 0.08); }
  .tc-att__row:first-child { border-top: none; padding-top: 0; }
  .tc-att__count { font-size: 1.1rem; font-weight: 660; line-height: 1; color: var(--pf-cream); font-variant-numeric: tabular-nums; text-align: right; }
  .tc-att__count em { font-style: normal; }
  .tc-att__text { display: grid; gap: 0.2rem; min-width: 0; }
  .tc-att__why { font-size: 0.86rem; color: rgb(${CREAM} / 0.84); }
  .tc-att__names { font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.01em; color: rgb(${CREAM} / 0.4); }

  /* Students — a working list. Six columns, so it gets a header. */
  .tc-stu__tools { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
  .tc-add { display: grid; gap: 0.8rem; margin-bottom: 1.1rem; padding-bottom: 1.1rem; border-bottom: 1px solid rgb(${CREAM} / 0.08); }
  .tc-add__done { margin: 0 0 1rem; font-size: 0.8rem; line-height: 1.5; color: rgb(${CREAM} / 0.55); }

  .tc-stu__head, .tc-stu { display: grid; grid-template-columns: minmax(0, 1fr) 6rem 5rem 4rem 7rem 2rem; align-items: center; gap: 0.9rem; }
  .tc-stu__head { padding: 0 0.5rem 0.5rem; border-bottom: 1px solid rgb(${CREAM} / 0.1); font-family: var(--pf-mono); font-size: 0.52rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgb(${CREAM} / 0.35); }
  .tc-stus { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
  .tc-stu { padding: 0.5rem 0.5rem; border-top: 1px solid rgb(${CREAM} / 0.08); border-radius: var(--radius-pill); transition: background-color 160ms ease; }
  .tc-stu:first-child { border-top: none; }
  .tc-stu:hover { background: rgb(${CREAM} / 0.05); }

  .tc-stu__open { appearance: none; border: none; background: transparent; cursor: pointer; font: inherit; color: inherit; text-align: left; display: grid; gap: 0.1rem; min-width: 0; padding: 0.2rem 0; }
  .tc-stu__open:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: 3px; border-radius: var(--radius-pill); }
  .tc-stu__name { font-size: 0.86rem; color: rgb(${CREAM} / 0.88); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tc-stu__open:hover .tc-stu__name { color: var(--pf-cream); }
  .tc-stu__mail { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.01em; color: rgb(${CREAM} / 0.38); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tc-stu__status { justify-self: start; }
  .tc-stu__meta { font-family: var(--pf-mono); font-size: 0.62rem; color: rgb(${CREAM} / 0.5); font-variant-numeric: tabular-nums; }
  .tc-stu__score { font-family: var(--pf-mono); font-size: 0.66rem; text-align: right; font-variant-numeric: tabular-nums; }
  .tc-stu__score em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .tc-stu__none { color: rgb(${CREAM} / 0.3); }
  .tc-stu__quiet { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.32); }
  .tc-stu__live { justify-self: start; }
  .tc-stu__tag { display: inline-block; font-family: var(--pf-mono); font-size: 0.54rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.18rem 0.5rem; border-radius: var(--radius-pill); border: 1px solid rgb(${CREAM} / 0.34); color: rgb(${CREAM} / 0.85); white-space: nowrap; }
  .tc-stu__tag.is-mid { border-color: rgb(${CREAM} / 0.2); color: rgb(${CREAM} / 0.55); }
  .tc-stu__del { appearance: none; border: none; background: transparent; cursor: pointer; justify-self: end; width: 1.7rem; height: 1.7rem; border-radius: var(--radius-pill); color: rgb(${CREAM} / 0.28); font-size: 1rem; line-height: 1; display: grid; place-items: center; opacity: 0; transition: opacity 160ms ease, color 160ms ease, background-color 160ms ease; }
  .tc-stu:hover .tc-stu__del, .tc-stu__del:focus-visible { opacity: 1; }
  .tc-stu__del:hover { color: var(--pf-cream); background: rgb(${CREAM} / 0.1); }

  @media (max-width: 980px) {
    .tc-stu__head { display: none; }
    .tc-stu { grid-template-columns: minmax(0, 1fr) auto auto; row-gap: 0.3rem; }
    .tc-stu__open { grid-column: 1 / -1; }
    .tc-stu__status { grid-row: 2; }
    .tc-stu__meta { grid-row: 2; }
    .tc-stu__score { grid-row: 2; text-align: left; }
    .tc-stu__live { grid-row: 3; grid-column: 1; }
    .tc-stu__del { grid-row: 3; grid-column: 3; opacity: 1; }
  }

  /* Settings — present, quiet, last. */
  .tc-admin__rows { display: grid; gap: 0; }
  .tc-admin__row { display: grid; grid-template-columns: 7rem minmax(0, 1fr) auto; align-items: center; gap: 0.9rem; padding: 0.7rem 0; border-top: 1px solid rgb(${CREAM} / 0.08); }
  .tc-admin__row:first-child { border-top: none; padding-top: 0; }
  .tc-admin__label { font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgb(${CREAM} / 0.45); }
  .tc-admin__val { font-size: 0.84rem; color: rgb(${CREAM} / 0.84); }
  .tc-admin__quiet { font-size: 0.78rem; color: rgb(${CREAM} / 0.45); }
  .tc-admin__code { font-family: var(--pf-mono); letter-spacing: 0.24em; color: var(--pf-cream); }
  .tc-form { display: flex; align-items: flex-end; gap: 0.8rem; flex-wrap: wrap; }
  .tc-form .st-field { flex: 1 1 18rem; }
  .tc-form__actions { display: flex; gap: 0.5rem; flex: none; }
  .st-action:disabled { opacity: 0.4; cursor: not-allowed; }
  @media (max-width: 700px) {
    .tc-admin__row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 0.2rem; }
    .tc-admin__label { grid-column: 1 / -1; }
  }
`;
