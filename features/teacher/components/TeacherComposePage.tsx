"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BOARD_SYSTEM_CSS, CREAM, MODE_ACCENT } from "@/features/profile/components/board-system";
import TeacherBack from "@/features/teacher/components/TeacherBack";
import type { TeacherExercise, TeacherProfile } from "@/lib/teacher/mock-teacher";
import { confusablePairs, faceGroups, faceOf } from "@/lib/teacher/teacher-faces";

// ---------------------------------------------------------------------------
// Teacher — the composer. The one screen where a teacher writes instead of reads.
//
// THE FAMILIES COME FROM THE MANIFEST, never from a list typed here. Offering a
// family the product cannot serve would produce an exercise whose specimen the
// browser invents, and every pick below is a face `public/fonts` really carries.
// The picks are shown as specimens for the same reason: on a product that
// trains the eye, "what am I asking them" is the letters, not the names.
//
// THE ONE READING IT OFFERS IS MEASURED, NOT INVENTED. The manifest carries a
// visual cluster per face, measured in the files, and two faces from one cluster
// are the ones that actually get confused. So the composer can say whether an
// exercise asks a real question, without pretending to know anything about the
// students. It never scores the exercise and never predicts a result.
//
// Nothing is saved anywhere: there is no backend for this yet, so a new exercise
// is added to the space's own state, exactly as renaming a class or inviting
// students already is on the class page. It shows up in the list and on its own
// page, and it goes when the page is reloaded.
// ---------------------------------------------------------------------------

const COUNTS = [10, 15, 20, 25, 30];
const OPENS: ReadonlyArray<{ hours: number; label: string }> = [
  { hours: 0, label: "right away" },
  { hours: 24, label: "tomorrow" },
  { hours: 72, label: "in three days" },
  { hours: 168, label: "in a week" },
];
const WINDOWS: ReadonlyArray<{ hours: number; label: string }> = [
  { hours: 48, label: "two days" },
  { hours: 72, label: "three days" },
  { hours: 168, label: "a week" },
  { hours: 336, label: "two weeks" },
];

export default function TeacherComposePage({
  teacher,
  presetClassId,
  backLabel,
  onBack,
  onCreate,
}: {
  teacher: TeacherProfile;
  presetClassId: string | null;
  backLabel: string;
  onBack: () => void;
  onCreate: (ex: TeacherExercise) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const classes = useMemo(() => teacher.classes.filter((c) => !c.archived), [teacher.classes]);

  const [classId, setClassId] = useState(presetClassId ?? classes[0]?.id ?? "");
  const [mode, setMode] = useState<"training" | "competition">("training");
  const [title, setTitle] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
  const [count, setCount] = useState(20);
  const [opensIn, setOpensIn] = useState(0);
  const [openFor, setOpenFor] = useState(168);

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

  const cls = classes.find((c) => c.id === classId) ?? null;
  const groups = useMemo(() => faceGroups(), []);
  const pairs = useMemo(() => confusablePairs(picks), [picks]);
  const accent = MODE_ACCENT[mode] ?? "var(--pf-cream)";

  // The pair this class keeps getting wrong, if it has one and the product can
  // serve both faces. A shortcut, and the only place the composer looks at what
  // the class has already done.
  const theirPair = useMemo(() => {
    const k = cls?.confusions[0];
    if (!k) return null;
    if (!faceOf(k.seen.slug) || !faceOf(k.chosen.slug)) return null;
    return k;
  }, [cls]);

  const add = (slug: string) => {
    if (!slug || picks.includes(slug)) return;
    setPicks((p) => [...p, slug]);
  };

  const ready = cls !== null && title.trim().length > 0 && picks.length >= 2;
  const missing = !cls
    ? "pick a class"
    : title.trim().length === 0
      ? "give it a name"
      : picks.length < 2
        ? "two families at least, so a question has something to confuse it with"
        : "";

  const give = () => {
    if (!cls || !ready) return;
    const scheduled = opensIn > 0;
    onCreate({
      id: `new-${Date.now()}`,
      title: title.trim(),
      mode,
      classId: cls.id,
      className: cls.name,
      state: scheduled ? "scheduled" : "running",
      // The deadline counts from now, so a scheduled one closes after it opens.
      dueInHours: opensIn + openFor,
      opensInHours: scheduled ? opensIn : undefined,
      openedForHours: openFor,
      questionCount: count,
      assigned: cls.studentCount,
      started: 0,
      finished: 0,
      typefaces: picks.map((slug) => {
        const f = faceOf(slug);
        return { slug, name: f?.name ?? slug };
      }),
    });
  };

  const openLabel = OPENS.find((o) => o.hours === opensIn)?.label ?? "right away";
  const windowLabelText = WINDOWS.find((w) => w.hours === openFor)?.label ?? "a week";

  return (
    <div ref={rootRef} className="st tc--new">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: NEW_CSS }} />

      <TeacherBack label={backLabel} onClick={onBack} />

      <header className="st-intro st-sec">
        <span className="st-kicker">New exercise</span>
        <h1 className="st-title">Give them something to look at.</h1>
        <p className="st-lede">
          Who it is for, which faces it asks about, and until when. Nothing goes
          out until the last button.
        </p>
      </header>

      {/* ── 1. Who, and how it is played ── */}
      <section className="st-panel st-sec" aria-label="Who it is for">
        <h2 className="st-panel__title">Who it is for</h2>
        <div className="tc-new__grid">
          <label className="st-field">
            <span className="st-field__label">Class</span>
            <span className="st-selectwrap">
              <select className="st-select" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.studentCount} students
                  </option>
                ))}
              </select>
              <span className="st-select__caret" aria-hidden="true">▾</span>
            </span>
          </label>

          <label className="st-field">
            <span className="st-field__label">Name it</span>
            <input
              className="st-input"
              type="text"
              value={title}
              placeholder="Transitional serifs, second pass"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="st-field">
            <span className="st-field__label">How it is played</span>
            {/* Two options, so the segmented control rather than a drop-down,
                and it is the one the Preferences board already uses. */}
            <div className="st-choice" role="group" aria-label="Mode">
              <button
                type="button"
                className={`st-choice__btn${mode === "training" ? " is-active" : ""}`}
                aria-pressed={mode === "training"}
                onClick={() => setMode("training")}
              >
                Training
              </button>
              <button
                type="button"
                className={`st-choice__btn${mode === "competition" ? " is-active" : ""}`}
                aria-pressed={mode === "competition"}
                onClick={() => setMode("competition")}
              >
                Competition
              </button>
            </div>
            <span className="tc-new__hint">
              {mode === "training"
                ? "They can retry a question until they read it right."
                : "One answer each, against the clock and against each other."}
            </span>
          </div>

          <label className="st-field">
            <span className="st-field__label">How long</span>
            <span className="st-selectwrap">
              <select
                className="st-select"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {COUNTS.map((n) => (
                  <option key={n} value={n}>{n} questions</option>
                ))}
              </select>
              <span className="st-select__caret" aria-hidden="true">▾</span>
            </span>
          </label>
        </div>
      </section>

      {/* ── 2. The faces. The subject of the exercise, so the subject here. ── */}
      <section className="st-panel st-sec" aria-label="What it asks about">
        <div className="st-panel__head">
          <h2 className="st-panel__title">What it asks about</h2>
          <span className="st-panel__meta">
            <em>{picks.length}</em> chosen · only faces the product can really serve
          </span>
        </div>

        <div className="tc-new__addrow">
          <label className="st-field tc-new__add">
            <span className="st-field__label">Add a family</span>
            <span className="st-selectwrap">
              <select
                className="st-select"
                value=""
                onChange={(e) => {
                  add(e.target.value);
                  e.currentTarget.value = "";
                }}
              >
                <option value="">Choose one…</option>
                {groups.map((g) => (
                  <optgroup key={g.category} label={g.label}>
                    {g.faces.map((f) => (
                      <option key={f.slug} value={f.slug} disabled={picks.includes(f.slug)}>
                        {f.name}
                        {picks.includes(f.slug) ? " · already in" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="st-select__caret" aria-hidden="true">▾</span>
            </span>
          </label>

          {theirPair && (
            <button
              type="button"
              className="st-action st-action--compact tc-new__shortcut"
              onClick={() => {
                add(theirPair.seen.slug);
                add(theirPair.chosen.slug);
              }}
            >
              Add the pair they keep missing
            </button>
          )}
        </div>

        {picks.length === 0 ? (
          <p className="st-empty">
            Nothing chosen yet. Two faces is the minimum, since a question needs
            something to be confused with.
          </p>
        ) : (
          <ul className="st-faces tc-new__picks">
            {picks.map((slug) => {
              const f = faceOf(slug);
              return (
                <li key={slug} className="st-face tc-new__pick">
                  {/* Nothing on this element but a size: every typographic
                      property has to come from the font file. */}
                  <span className="st-face__glyph" style={{ fontFamily: `JDT__${slug}` }}>Aa</span>
                  <span className="st-face__name">{f?.name ?? slug}</span>
                  <span className="tc-new__diff">{f?.difficulty}</span>
                  <button
                    type="button"
                    className="st-del tc-new__rm"
                    aria-label={`Remove ${f?.name ?? slug}`}
                    onClick={() => setPicks((p) => p.filter((s) => s !== slug))}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* MEASURED IN THE FILES, and the only judgement this screen makes. */}
        {picks.length >= 2 && (
          <p className="tc-new__read">
            {pairs.length === 0 ? (
              <>
                None of these look alike, so this asks them to tell apart faces
                that are already far apart. Add two from one family group to make
                it a real question.
              </>
            ) : (
              <>
                <em>{pairs.length}</em> confusable {pairs.length > 1 ? "pairs" : "pair"} in there:{" "}
                {pairs.slice(0, 3).map(([a, b], i) => (
                  <span key={`${a.slug}-${b.slug}`}>
                    {i > 0 ? ", " : ""}
                    {a.name} against {b.name}
                  </span>
                ))}
                {pairs.length > 3 && `, and ${pairs.length - 3} more`}. Same visual
                cluster, measured in the files, which is what makes it worth
                asking.
              </>
            )}
          </p>
        )}
      </section>

      {/* ── 3. When ── */}
      <section className="st-panel st-sec" aria-label="When">
        <h2 className="st-panel__title">When</h2>
        <div className="tc-new__grid">
          <label className="st-field">
            <span className="st-field__label">It opens</span>
            <span className="st-selectwrap">
              <select
                className="st-select"
                value={opensIn}
                onChange={(e) => setOpensIn(Number(e.target.value))}
              >
                {OPENS.map((o) => (
                  <option key={o.hours} value={o.hours}>{o.label}</option>
                ))}
              </select>
              <span className="st-select__caret" aria-hidden="true">▾</span>
            </span>
          </label>

          <label className="st-field">
            <span className="st-field__label">And stays open for</span>
            <span className="st-selectwrap">
              <select
                className="st-select"
                value={openFor}
                onChange={(e) => setOpenFor(Number(e.target.value))}
              >
                {WINDOWS.map((w) => (
                  <option key={w.hours} value={w.hours}>{w.label}</option>
                ))}
              </select>
              <span className="st-select__caret" aria-hidden="true">▾</span>
            </span>
          </label>
        </div>
        <span className="tc-new__hint">
          {/* Two different facts, said in two different words on purpose: until
              when they may still do it, and how long the window is. */}
          The window is what makes a reading possible: half the class finished
          says nothing until you know how much of the time has gone.
        </span>
      </section>

      {/* ── 4. What is about to go out, in one sentence ── */}
      <section className="st-panel st-sec tc-new__recap" aria-label="About to go out">
        <h2 className="st-panel__title">About to go out</h2>
        <p className="tc-new__sentence">
          <em>{count} questions</em> on <em>{picks.length} families</em> for{" "}
          <em>{cls?.name ?? "no class yet"}</em>, {cls ? `${cls.studentCount} students, ` : ""}
          played as{" "}
          <span
            className="st-session__mode tc-new__mode"
            style={{
              borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
              color: `color-mix(in srgb, ${accent} 62%, var(--pf-cream))`,
            }}
          >
            {mode}
          </span>
          . It opens {openLabel} and stays open for {windowLabelText}.
        </p>

        <div className="tc-new__actions">
          <button
            type="button"
            className="st-action st-action--primary"
            disabled={!ready}
            onClick={give}
          >
            {cls ? `Give it to ${cls.name}` : "Give it"}
          </button>
          <button type="button" className="st-action st-action--compact" onClick={onBack}>
            Cancel
          </button>
        </div>
        {!ready && <span className="tc-new__hint">{missing}</span>}
      </section>
    </div>
  );
}

/* Only what belongs to this screen. Everything else reads the site's system. */
const NEW_CSS = `
  /* Two fields a row, one on a narrow screen. The fields, the drop-downs, the
     segmented control and the buttons are all the system's own. */
  .tc-new__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(0.9rem, 2vw, 1.4rem); }
  @media (max-width: 760px) { .tc-new__grid { grid-template-columns: 1fr; } }
  .tc-new__hint { display: block; margin-top: 0.45rem; max-width: 52ch; text-wrap: pretty; font-size: 0.78rem; line-height: 1.5; color: rgb(${CREAM} / 0.45); }

  .tc-new__addrow { display: flex; align-items: flex-end; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 1.2rem; }
  .tc-new__add { flex: 1 1 20rem; }
  .tc-new__shortcut { flex: none; }

  /* The picks, as specimens rather than chips: the letters are the thing being
     chosen. As many columns as fit, so two picks and eight both look composed. */
  .tc-new__picks { grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); }
  .tc-new__pick { position: relative; align-content: start; }
  .tc-new__diff { font-family: var(--pf-mono); font-size: 0.5rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(${CREAM} / 0.32); }
  .tc-new__rm { position: absolute; top: -0.35rem; right: -0.35rem; }

  .tc-new__read { margin: 1.2rem 0 0; max-width: 62ch; text-wrap: pretty; font-size: 0.82rem; line-height: 1.55; color: rgb(${CREAM} / 0.55); }
  .tc-new__read em { font-style: normal; font-weight: 640; color: var(--pf-cream); }

  .tc-new__recap { border-color: rgb(${CREAM} / 0.22); }
  .tc-new__sentence { margin: 0 0 1.1rem; max-width: 62ch; text-wrap: pretty; font-size: 0.95rem; line-height: 1.6; color: rgb(${CREAM} / 0.6); }
  .tc-new__sentence em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .tc-new__mode { display: inline-block; vertical-align: 0.05em; }
  .tc-new__actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
`;
