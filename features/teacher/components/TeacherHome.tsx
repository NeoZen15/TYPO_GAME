"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BOARD_SYSTEM_CSS, CREAM } from "@/features/profile/components/board-system";
import type { TeacherProfile } from "@/lib/teacher/mock-teacher";
import { familiesInPlay, paceOfOpen, topConfusions } from "@/lib/teacher/teacher-derive";
import { dueLabel } from "@/lib/teacher/teacher-time";

// ---------------------------------------------------------------------------
// Teacher — Home. A cockpit, not a smaller copy of the other two tabs.
//
// WHAT IT DELIBERATELY NO LONGER DOES. The first version listed the running
// exercises and their progress bars, which is now the Exercises tab's whole
// job, and it did it worse. Once Classes and Exercises existed properly, the
// home was repeating both. Four zones, four different jobs, and none of them is
// a list you can already read better elsewhere:
//
//   1. What your classes have in front of them, as real specimens.
//   2. What needs you now — the triage ACROSS classes, which no other page can
//      do, capped at four with a way through to the detail.
//   3. What DWIGGINS would give next, already composed.
//   4. What your students keep mixing up, shown in the actual letterforms.
//
// Motion is borrowed, never invented: the reveal every board uses, the landing
// hero's 2.4 s specimen interval, the profile heatmap's per-index delay, and
// the landing mode cards' pointer tilt on ONE card so it stays a gesture rather
// than a tic. All of it off under prefers-reduced-motion.
// ---------------------------------------------------------------------------

const SPECIMEN_MS = 2400; // the landing hero's interval, unchanged

/** "Three things" reads as a sentence; "3 things" reads as a dashboard. */
function countWord(n: number): string {
  const words = ["Nothing", "One thing", "Two things", "Three things"];
  return words[n] ?? `${n} things`;
}

export default function TeacherHome({
  teacher,
  onOpenClass,
  onOpenExercises,
}: {
  teacher: TeacherProfile;
  onOpenClass: (id: string) => void;
  onOpenExercises: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [specimen, setSpecimen] = useState(0);

  const live = useMemo(() => familiesInPlay(teacher.exercises), [teacher.exercises]);
  const pace = useMemo(() => paceOfOpen(teacher.exercises), [teacher.exercises]);
  const confusions = useMemo(() => topConfusions(teacher.classes, 3), [teacher.classes]);

  // Reveal, same as every board in the profile.
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

  // The specimen band, on the landing hero's own interval.
  useEffect(() => {
    if (live.length < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setSpecimen((i) => (i + 1) % live.length), SPECIMEN_MS);
    return () => window.clearInterval(id);
  }, [live.length]);

  const face = live[specimen % Math.max(1, live.length)];

  // WHAT NEEDS YOU NOW. The deadline risk and the class signals are the same
  // kind of thing — something that will go wrong if nobody looks — so they are
  // one ranked list and not two panels. Behind schedule comes first: it has a
  // clock on it. Four at most; the rest is what the other two tabs are for.
  const late = pace.filter((p) => p.gap < -15);
  const lateClasses = new Set(late.map((p) => p.exercise.classId));
  const alerts = [
    ...late
      .map((p) => ({
        id: p.exercise.id,
        head: `${p.exercise.className} is ${Math.abs(p.gap)} points behind on "${p.exercise.title}".`,
        why: `${p.donePct}% finished · ${p.elapsedPct}% of the time gone · ${dueLabel(p.exercise.dueInHours)}`,
        action: "See exercises",
        go: onOpenExercises,
      })),
    // A class already flagged for a deadline does not need a second line about
    // the same exercise: two rows saying one thing is how a triage list stops
    // being read.
    ...teacher.signals
      .filter((s) => !lateClasses.has(s.classId))
      .map((s) => ({
      id: s.id,
      head: s.headline,
      why: s.because,
      action: s.actionLabel,
      go: () => onOpenClass(s.classId),
    })),
  // Three, not four. This is the list a teacher reads before doing anything
  // else, and a list you scan is not the same object as a list you read.
  ].slice(0, 3);

  // WHAT DWIGGINS WOULD GIVE NEXT. Built from the worst confusion across every
  // class: the pair that keeps coming back, plus what that class already has,
  // plus something new. Never only their gaps — that is the rule the mix exists
  // to enforce.
  const worst = confusions[0];
  const suggestionClass = worst ? teacher.classes.find((c) => c.id === worst.classId) : undefined;
  const suggestionFamilies = useMemo(() => {
    if (!worst) return [];
    const solid = teacher.exercises
      .filter((e) => e.classId === worst.classId && e.state === "done")
      .flatMap((e) => e.typefaces)
      .filter((f) => f.slug !== worst.seen.slug && f.slug !== worst.chosen.slug);
    const seen = new Set<string>();
    const rest = solid.filter((f) => (seen.has(f.slug) ? false : (seen.add(f.slug), true))).slice(0, 2);
    return [worst.seen, worst.chosen, ...rest];
  }, [worst, teacher.exercises]);

  return (
    <div ref={rootRef} className="st tc--home">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: HOME_CSS }} />

      {/* ── 1. What your classes have in front of them, right now ── */}
      <header className="st-intro tc-band st-sec">
        <span className="st-kicker">Your teaching</span>
        {face ? (
          <>
            {/* The family's own name, set in that family. A specimen that
                labels itself, and the caption underneath is the data: someone
                is being asked to name this face today. */}
            <h1 className="tc-band__word" key={face.slug} style={{ fontFamily: `JDT__${face.slug}` }}>
              {face.name}
            </h1>
            <p className="tc-band__note">
              <em>{face.className}</em> has this one in front of them right now
            </p>
          </>
        ) : (
          <>
            <h1 className="st-title">Nothing running.</h1>
            <p className="st-lede">Give an exercise and this page starts telling you what is happening.</p>
          </>
        )}
      </header>

      {/* ── 2. What needs you now ──────────────────────────────────────────
          THE LANDING'S SECTION SHAPE, not a stack of rows. Looked at rather
          than read in the stylesheet, every landing section is the same figure:
          a mono kicker, a big LEFT-ALIGNED statement of two or three lines, a
          lede at 46ch, and the thing itself on the RIGHT. Nothing centred, one
          asymmetry repeated, and a lot of air. That is the composition, and the
          home was missing it entirely.

          Here the statement is written from the data, so the left column is not
          a label: it already tells you how bad today is. */}
      <section className="tc-sec st-sec" aria-label="What needs you now">
        <div className="tc-sec__text">
          <span className="tc-kicker">Needs you now</span>
          <h2 className="tc-h2">
            {alerts.length === 0 ? "Nothing is slipping." : `${countWord(alerts.length)} need you today.`}
          </h2>
          <p className="tc-lede">
            {alerts.length === 0
              ? "Everything open is on pace, and no pattern has come up often enough to be worth your time yet."
              : "Across every class you teach, worst first. The rest is in Exercises."}
          </p>
        </div>

        <ul className="tc-alerts">
          {alerts.map((a) => (
            <li key={a.id} className="tc-alert">
              <span className="tc-alert__head">{a.head}</span>
              <span className="tc-alert__why">{a.why}</span>
              <button type="button" className="st-action st-action--compact" onClick={a.go}>
                {a.action}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 3. What DWIGGINS would give next ── same figure, mirrored use:
          the statement is the suggestion, the object on the right is the four
          faces it would ask about. */}
      {worst && suggestionClass && (
        <section className="tc-sec st-sec" aria-label="What DWIGGINS suggests">
          <div className="tc-sec__text">
            <span className="tc-kicker">DWIGGINS would give this next</span>
            <h2 className="tc-h2">
              {worst.seen.name} against {worst.chosen.name}.
            </h2>
            <p className="tc-lede">
              {suggestionClass.name} has swapped that pair {worst.times} times. Mixed
              with what they already read, never only their gaps.
            </p>
            <div className="tc-next__actions">
              <button type="button" className="st-action st-action--compact st-action--primary">
                Open it
              </button>
              <button type="button" className="st-action st-action--compact">
                Change it
              </button>
            </div>
          </div>

          <ul className="st-faces tc-next__faces">
            {suggestionFamilies.map((f) => (
              <li key={f.slug} className="st-face">
                <span className="st-face__glyph" style={{ fontFamily: `JDT__${f.slug}` }}>
                  Aa
                </span>
                <span className="st-face__name">{f.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* Only what belongs to this screen. Everything above reads the site's system. */
const HOME_CSS = `
  /* THE LANDING'S RHYTHM, in its own values.
     '.lp-section' pads itself clamp(4.5rem, 12vh, 9rem); used as the gap it puts
     the same distance between two moments, and that distance is most of why the
     landing feels simple. */
  .tc--home { gap: clamp(4.5rem, 12vh, 9rem); }

  /* '.lp-feature' and '.lp-demo', identical values: 1.02fr 1fr, centred rows,
     a 5rem gap and a wide shell. Every section of the landing is this figure. */
  .tc-sec {
    display: grid;
    grid-template-columns: 1.02fr 1fr;
    align-items: center;
    gap: clamp(2.2rem, 5.5vw, 5rem);
    width: min(95vw, 82rem);
    margin: 0 auto;
  }
  @media (max-width: 900px) { .tc-sec { grid-template-columns: 1fr; } }
  .tc-sec__text { display: grid; gap: 0; min-width: 0; }

  /* '.lp-kicker' and '.lp-section__title' and '.lp-section__lede', unchanged.
     The only substitution is the ink: this page lives on '.pf-page', so it
     reads the profile's cream rather than the landing's. */
  .tc-kicker { margin: 0 0 0.9rem; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(${CREAM} / 0.42); }
  .tc-h2 { margin: 0; font-size: clamp(2.2rem, 5vw, 3.85rem); font-weight: 650; line-height: 1.02; letter-spacing: -0.04em; text-wrap: balance; color: var(--pf-cream); }
  .tc-lede { margin: 1.05rem 0 0; max-width: 46ch; font-size: clamp(1.06rem, 1.5vw, 1.26rem); line-height: 1.5; text-wrap: pretty; color: rgb(${CREAM} / 0.6); }

  /* 1. The specimen band. Centred like the landing's own hero, and nothing on
     this element but a size: every typographic property must come from the font
     file, so no tracking, no weight, no synthesis. The entrance is the landing's
     own '@keyframes lp-specimen-in', which lives in globals. */
  .tc-band { gap: 0.7rem; text-align: center; display: grid; justify-items: center; max-width: 52rem; margin: 0 auto; }
  .tc-band__word { margin: 0; font-size: clamp(2.6rem, 8vw, 6rem); color: var(--pf-cream); animation: lp-specimen-in 0.6s cubic-bezier(0.4, 0, 0.2, 1) both; }
  .tc-band__note { margin: 0; font-family: var(--pf-mono); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(${CREAM} / 0.42); }
  .tc-band__note em { font-style: normal; color: rgb(${CREAM} / 0.78); }

  /* 2. The alerts, as the object on the right. Stacked blocks, not a table:
     each one is a sentence, its evidence, and the way in. */
  .tc-alerts { display: grid; gap: 1.6rem; margin: 0; padding: 0; list-style: none; min-width: 0; }
  .tc-alert { display: grid; gap: 0.4rem; justify-items: start; padding-left: 1rem; border-left: 1px solid rgb(${CREAM} / 0.14); }
  .tc-alert__head { font-size: 0.95rem; line-height: 1.4; color: rgb(${CREAM} / 0.9); text-wrap: pretty; }
  .tc-alert__why { font-family: var(--pf-mono); font-size: 0.6rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.42); font-variant-numeric: tabular-nums; }
  .tc-alert .st-action { margin-top: 0.35rem; }

  /* 3. The faces, as the object on the right. The cell itself is '.st-face' in
     the system now, since the exercise page shows the same specimens; only the
     two columns are this screen's, because they answer to this column's width. */
  .tc-next__faces { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tc-next__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1.6rem; }

  @media (prefers-reduced-motion: reduce) {
    .tc-band__word { animation: none; }
  }
`;
