"use client";

import { useEffect, useMemo, useRef } from "react";
import { BOARD_SYSTEM_CSS, CREAM, MODE_ACCENT } from "@/features/profile/components/board-system";
import TeacherBack from "@/features/teacher/components/TeacherBack";
import type { TeacherClass, TeacherExercise, TeacherProfile } from "@/lib/teacher/mock-teacher";
import { exerciseDetail } from "@/lib/teacher/teacher-derive";
import { closedLabel, dueLabel, opensLabel, windowLabel } from "@/lib/teacher/teacher-time";

// ---------------------------------------------------------------------------
// Teacher — one exercise.
//
// The list next door says which one, how far along, how long left. It refuses
// to carry anything else, on purpose. This page carries the two things it left
// out: WHAT IS IN IT, and WHAT CAME BACK.
//
// So the first real panel is the faces themselves. On a product that trains the
// eye, "what did I ask them" is not a list of family names, it is the letters:
// the specimens are the subject of this page, and once it has closed each one
// carries how it went. Every family named here is one the manifest can serve,
// otherwise the browser invents the letterform, which is the fault this project
// already caught once on the typeface pages.
//
// THREE STATES, THREE PAGES, and they are not the same page with numbers
// missing. Scheduled: what you built, and when it opens. Nothing else exists
// yet, so nothing else is drawn. Running: the race against its own deadline,
// and who to chase. Done: what came back, read against what this class usually
// does, because comparing it to another class tells you about the classes.
//
// The names are the way into the student sheet, which is the page that answers
// "and this person, across everything I gave".
// ---------------------------------------------------------------------------

export default function TeacherExercisePage({
  teacher,
  cls,
  ex,
  backLabel,
  onBack,
  onOpenStudent,
}: {
  teacher: TeacherProfile;
  cls: TeacherClass;
  ex: TeacherExercise;
  /** Where the back control goes, NAMED: the class it came from, or the list. */
  backLabel: string;
  onBack: () => void;
  onOpenStudent: (studentId: string) => void;
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

  const detail = useMemo(() => exerciseDetail(ex, cls, teacher.exercises), [ex, cls, teacher.exercises]);

  const accent = MODE_ACCENT[ex.mode] ?? "var(--pf-cream)";
  const families = ex.typefaces.length;
  const notOpened = ex.assigned - ex.started;
  const startedOnly = ex.started - ex.finished;

  // What it is, said with the numbers beside it. Never a claim the rows below
  // cannot back up.
  const lede =
    ex.state === "scheduled"
      ? `${ex.questionCount} questions on ${families} families, waiting for ${ex.assigned} students.`
      : ex.state === "running"
        ? `${ex.questionCount} questions on ${families} families. ${ex.finished} of ${ex.assigned} have finished it.`
        : `${ex.questionCount} questions on ${families} families. ${ex.finished} of ${ex.assigned} finished it.`;

  const when =
    ex.state === "running"
      ? dueLabel(ex.dueInHours)
      : ex.state === "scheduled"
        ? opensLabel(ex.opensInHours ?? 0)
        : closedLabel(ex.dueInHours);

  // The comparison, and the only fair one: this class against itself.
  const diff = ex.successPct !== undefined && detail.otherAvg !== null ? ex.successPct - detail.otherAvg : null;
  const others = detail.otherCount === 1 ? "the one other" : `the ${detail.otherCount} others`;

  return (
    <div ref={rootRef} className="st tc--exop">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: EXOP_CSS }} />

      <TeacherBack label={backLabel} onClick={onBack} />

      <header className="st-intro st-sec">
        <span className="st-kicker">{cls.name}</span>
        <h1 className="st-title">{ex.title}</h1>
        <p className="st-lede">{lede}</p>

        <p className="tc-exop__id">
          {/* The mode chip, the one colour this space takes and the one usage
              the profile establishes: contour at 45%, ink at 62%, no fill. */}
          <span
            className="st-session__mode"
            style={{
              borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
              color: `color-mix(in srgb, ${accent} 62%, var(--pf-cream))`,
            }}
          >
            {ex.mode}
          </span>
          {/* The LENGTH of the window, never the deadline. Two facts, two words. */}
          <span className="tc-exop__meta">open for {windowLabel(ex.openedForHours)}</span>
          <span className="st-time">{when}</span>
        </p>

        <div className="tc-exop__actions">
          {ex.state === "running" && (
            <>
              <button type="button" className="st-action st-action--compact st-action--primary">
                Nudge who has not opened it
              </button>
              <button type="button" className="st-action st-action--compact">Close it now</button>
            </>
          )}
          {ex.state === "scheduled" && (
            <>
              <button type="button" className="st-action st-action--compact st-action--primary">Open it now</button>
              <button type="button" className="st-action st-action--compact">Change it</button>
            </>
          )}
          {ex.state === "done" && (
            <>
              <button type="button" className="st-action st-action--compact st-action--primary">Give it again</button>
              <button type="button" className="st-action st-action--compact">Build one on what resisted</button>
            </>
          )}
        </div>
      </header>

      {/* ── 1. Where it stands, and it is a different question in each state ── */}
      {ex.state === "scheduled" && (
        <section className="st-panel st-sec" aria-label="Waiting to open">
          <h2 className="st-panel__title">Waiting to open</h2>
          <p className="st-empty">
            It {opensLabel(ex.opensInHours ?? 0)} and stays open for{" "}
            {windowLabel(ex.openedForHours)}. {ex.assigned} students will find it
            waiting. Nothing is measured before it opens, so there is nothing
            here to read yet.
          </p>
        </section>
      )}

      {ex.state === "running" && detail.pace && (
        <section className="st-panel st-sec" aria-label="Against its deadline">
          <div className="st-panel__head">
            <h2 className="st-panel__title">Against its deadline</h2>
            <span className="st-panel__meta">the mark is where the time is</span>
          </div>

          {/* TWO SHARES ON ONE BAR, the list's own device: how much of the class
              has finished, and how much of the window has gone. The reading is
              one distance, has the fill reached the mark. */}
          <span
            className="st-pace__track tc-exop__track"
            role="img"
            aria-label={`${detail.pace.donePct}% finished, ${detail.pace.elapsedPct}% of the time gone`}
          >
            <span className="st-pace__fill" style={{ width: `${detail.pace.donePct}%` }} />
            <span className="st-pace__mark" style={{ left: `${detail.pace.elapsedPct}%` }} />
          </span>

          <div className="st-pace__read tc-exop__read">
            <span className="st-pace__verdict">
              {detail.pace.gap >= 0 ? "on pace" : `${Math.abs(detail.pace.gap)} behind`}
            </span>
            <span className="st-pace__nums">
              {detail.pace.donePct}% done · {detail.pace.elapsedPct}% of the time · {dueLabel(ex.dueInHours)}
            </span>
          </div>

          <span
            className="st-seg st-seg--mode tc-exop__seg"
            role="img"
            aria-label="Participation"
            style={{ ["--m" as string]: accent }}
          >
            <span className="st-seg__part st-seg__part--lit" style={{ flexGrow: ex.finished }} />
            <span className="st-seg__part st-seg__part--emerging" style={{ flexGrow: startedOnly }} />
            <span className="st-seg__part st-seg__part--dormant" style={{ flexGrow: notOpened }} />
          </span>
          <ul className="st-legend">
            <li>
              <span className="st-legend__sw st-legend__sw--lit st-legend__sw--mode" style={{ ["--m" as string]: accent }} />
              <em>{ex.finished}</em> finished
            </li>
            <li><span className="st-legend__sw st-legend__sw--emerging" /><em>{startedOnly}</em> started</li>
            <li><span className="st-legend__sw st-legend__sw--dormant" /><em>{notOpened}</em> not opened</li>
          </ul>
        </section>
      )}

      {ex.state === "done" && (
        <section className="st-panel st-sec" aria-label="What came back">
          <h2 className="st-panel__title">What came back</h2>
          <div className="st-ringwrap">
            <svg className="st-ring" viewBox="0 0 140 140" aria-hidden="true">
              <circle className="st-ring__track" cx="70" cy="70" r="52" />
              <circle
                className="st-ring__arc"
                cx="70"
                cy="70"
                r="52"
                pathLength={100}
                strokeDasharray={`${ex.successPct ?? 0} 100`}
                transform="rotate(-90 70 70)"
              />
              <text className="st-ring__pct" x="70" y="68">{ex.successPct ?? 0}%</text>
              <text className="st-ring__sub" x="70" y="86">right</text>
            </svg>

            <div className="tc-exop__block">
              <span className="st-panel__title">Who got to the end</span>
              <span
                className="st-seg st-seg--mode"
                role="img"
                aria-label="Participation"
                style={{ ["--m" as string]: accent }}
              >
                <span className="st-seg__part st-seg__part--lit" style={{ flexGrow: ex.finished }} />
                <span className="st-seg__part st-seg__part--emerging" style={{ flexGrow: startedOnly }} />
                <span className="st-seg__part st-seg__part--dormant" style={{ flexGrow: notOpened }} />
              </span>
              <ul className="st-legend">
                <li>
                  <span className="st-legend__sw st-legend__sw--lit st-legend__sw--mode" style={{ ["--m" as string]: accent }} />
                  <em>{ex.finished}</em> finished
                </li>
                <li><span className="st-legend__sw st-legend__sw--emerging" /><em>{startedOnly}</em> stopped partway</li>
                <li><span className="st-legend__sw st-legend__sw--dormant" /><em>{notOpened}</em> never opened it</li>
              </ul>

              {/* READ AGAINST THIS CLASS AND NOTHING ELSE. Another class's rate
                  would say something about the classes, not about the exercise. */}
              <p className="tc-exop__vs">
                {diff === null || detail.otherAvg === null ? (
                  <>Nothing else has closed for this class yet, so there is nothing to read this against.</>
                ) : Math.abs(diff) <= 2 ? (
                  <>
                    In line with what this class does: <em>{detail.otherAvg}%</em> across{" "}
                    {others} that closed.
                  </>
                ) : (
                  <>
                    <em>{Math.abs(diff)} points</em> {diff > 0 ? "above" : "below"} what this class
                    does, {detail.otherAvg}% across {others} that closed.
                  </>
                )}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── 2. The faces. The subject of the page, not an illustration. ── */}
      <section className="st-panel st-sec" aria-label="What it asked">
        <div className="st-panel__head">
          <h2 className="st-panel__title">What it asked</h2>
          <span className="st-panel__meta">
            {ex.state === "done" ? "in the order you built it" : `${families} families`}
          </span>
        </div>
        <ul className="st-faces tc-exop__faces">
          {detail.families.map((f) => (
            <li key={f.slug} className="st-face tc-exop__face">
              {/* Nothing on this element but a size: every typographic property
                  comes from the font file, or the letter is not that face. */}
              <span className="st-face__glyph" style={{ fontFamily: `JDT__${f.slug}` }}>Aa</span>
              <span className="st-face__name">{f.name}</span>
              {f.rightPct !== null && (
                <>
                  <span className="st-bar" role="img" aria-label={`${f.rightPct}% right`}>
                    <span className="st-bar__fill" style={{ width: `${f.rightPct}%` }} />
                  </span>
                  <span className="tc-exop__facepct"><em>{f.rightPct}</em>% right</span>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ── 3. Who to chase, grouped by reason. Nothing before it opens. ── */}
      {ex.state !== "scheduled" && (
        <section className="st-panel st-sec" aria-label="Worth a word">
          <div className="st-panel__head">
            <h2 className="st-panel__title">Worth a word</h2>
            <span className="st-panel__meta">out of <em>{ex.assigned}</em></span>
          </div>
          {detail.groups.length === 0 ? (
            <p className="st-empty">
              Everyone who has signed in has finished it, and nobody came out
              under 55%. Nothing to chase on this one.
            </p>
          ) : (
            <ul className="st-att">
              {detail.groups.map((g) => (
                <li key={g.reason} className="st-att__row">
                  <span className="st-att__count"><em>{g.students.length}</em></span>
                  <span className="st-att__text">
                    <span className="st-att__why">{g.reason}</span>
                    <span className="st-att__names">
                      {g.students.slice(0, 4).map((s) => s.name).join(", ")}
                      {g.students.length > 4 && ` and ${g.students.length - 4} more`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── 4. Everyone on it, in roster order, each name a way in ── */}
      {ex.state !== "scheduled" && (
        <section className="st-panel st-sec" aria-label="Everyone on it">
          <div className="st-panel__head">
            <h2 className="st-panel__title">Everyone on it</h2>
            {/* ROSTER ORDER, NEVER SORTED BY RESULT. Sorting a class by its
                results is a ranking, and this space does not make one. The
                groups above are how you find who to look at. */}
            <span className="st-panel__meta">roster order</span>
          </div>
          <ul className="st-lines">
            {detail.rows.map((r) => (
              <li key={r.student.id}>
                <button type="button" className="st-line" onClick={() => onOpenStudent(r.student.id)}>
                  <span className="st-line__name">{r.student.name}</span>
                  <span className="st-line__meta">
                    {r.student.status === "invited"
                      ? "invited"
                      : r.standing === "finished"
                        ? "finished"
                        : r.standing === "started"
                          ? "started"
                          : "not opened"}
                  </span>
                  <span className="tc-exop__score">
                    {r.theirs === null ? <span className="tc-exop__none">—</span> : <><em>{r.theirs}</em>%</>}
                  </span>
                  <span className="st-line__arrow" aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* Only what belongs to this screen. Everything else reads the site's system. */
const EXOP_CSS = `
  /* The identity line: mode, how long the window is, and the clock. */
  .tc-exop__id { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 0.5rem 0.8rem; margin: 0.2rem 0 0; }
  .tc-exop__meta { font-family: var(--pf-mono); font-size: 0.6rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.42); }
  .tc-exop__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-top: 0.9rem; }

  /* The race. The track is taller here than in the list: it is the subject of
     the panel rather than one row among six. */
  .tc-exop__track { height: 0.75rem; margin-bottom: 0.7rem; }
  .tc-exop__read { grid-auto-flow: column; justify-content: space-between; align-items: baseline; margin-bottom: 1.3rem; }
  .tc-exop__seg { margin-top: 0.2rem; }

  .tc-exop__block { flex: 1; display: grid; gap: 0.5rem; align-content: start; min-width: 0; }
  .tc-exop__block .st-panel__title { margin: 0; }
  .tc-exop__block .st-seg { margin-bottom: 0.2rem; }
  .tc-exop__vs { margin: 0.5rem 0 0; max-width: 52ch; text-wrap: pretty; font-size: 0.82rem; line-height: 1.5; color: rgb(${CREAM} / 0.55); }
  .tc-exop__vs em { font-style: normal; font-weight: 640; color: var(--pf-cream); }

  /* The faces. As many columns as fit, because an exercise carries two families
     or six and neither should leave a hole. */
  .tc-exop__faces { grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); }
  .tc-exop__face { align-content: start; }
  .tc-exop__face .st-bar { width: 100%; margin-top: 0.15rem; }
  .tc-exop__facepct { font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.45); font-variant-numeric: tabular-nums; }
  .tc-exop__facepct em { font-style: normal; font-weight: 640; font-size: 0.7rem; color: var(--pf-cream); }

  /* The roster: a name, where they got to, what they scored, the way in. */
  .tc--exop .st-line { grid-template-columns: minmax(0, 1fr) 7rem 5rem 1.2rem; }
  .tc-exop__score { font-family: var(--pf-mono); font-size: 0.66rem; text-align: right; font-variant-numeric: tabular-nums; color: rgb(${CREAM} / 0.5); }
  .tc-exop__score em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .tc-exop__none { color: rgb(${CREAM} / 0.3); }

  @media (max-width: 900px) {
    .st-ringwrap { flex-direction: column; align-items: flex-start; }
  }
  @media (max-width: 700px) {
    .tc--exop .st-line { grid-template-columns: minmax(0, 1fr) auto 1.2rem; }
    .tc-exop__score { display: none; }
    .tc-exop__read { grid-auto-flow: row; }
  }
`;
