"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BOARD_SYSTEM_CSS, CREAM } from "@/features/profile/components/board-system";
import { classActivityLabel } from "@/lib/teacher/mock-teacher";
import type { TeacherClass, TeacherProfile } from "@/lib/teacher/mock-teacher";

// ---------------------------------------------------------------------------
// Teacher — Classes. The list, and only the list: creating one, finding one,
// and getting into one. Everything a class IS (its roster, its progression, its
// exercises) belongs to the class page, which is the next screen.
//
// ROWS, NOT CARDS. The owner turned down a card wall: a teacher with fifteen
// classes gets a page they have to scroll to find one name. A row list stays
// readable at any count and puts the names in one column you can scan.
//
// Archived classes are hidden by default and reachable with the segmented
// control — the profile's own `.pr-seg` device, so nothing new is invented.
// ---------------------------------------------------------------------------

type Filter = "active" | "archived";

export default function TeacherClasses({
  teacher,
  onOpenClass,
}: {
  teacher: TeacherProfile;
  onOpenClass: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [filter, setFilter] = useState<Filter>("active");
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  // Local only, and on purpose: this is the mock. Creating a class shows the
  // flow and lets the owner judge the new field; it does not survive a reload,
  // and nothing here writes anywhere.
  const [added, setAdded] = useState<TeacherClass[]>([]);

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

  // Focus the field the moment it appears: opening a form and then asking the
  // teacher to click into it is a step for nothing.
  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const all = useMemo(() => [...added, ...teacher.classes], [added, teacher.classes]);
  const active = all.filter((c) => !c.archived);
  const archived = all.filter((c) => c.archived);
  const shown = filter === "active" ? active : archived;

  // How many exercises each class currently has open. Counted from the
  // exercises themselves rather than stored on the class: one fact, one place.
  const runningByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const ex of teacher.exercises) {
      if (ex.state !== "running") continue;
      map.set(ex.classId, (map.get(ex.classId) ?? 0) + 1);
    }
    return map;
  }, [teacher.exercises]);

  // Which classes have ever been given anything, so an empty row can say which
  // kind of empty it is.
  const gaveAny = useMemo(
    () => new Set(teacher.exercises.map((e) => e.classId)),
    [teacher.exercises],
  );

  function createClass() {
    const name = draftName.trim();
    if (!name) return;
    setAdded((prev) => [
      {
        id: `new-${prev.length + 1}`,
        name,
        level: "Not set",
        studentCount: 0,
        // Six characters, no vowels, so a code can never spell a word. The
        // joining flow itself is parked; this is the code the page displays.
        joinCode: Math.random().toString(36).replace(/[aeiou0-9]/g, "").slice(0, 6).toUpperCase().padEnd(6, "X"),
        archived: false,
        // A class created here has nothing measured yet, and says so.
        confusions: [],
      },
      ...prev,
    ]);
    setDraftName("");
    setCreating(false);
    setFilter("active");
  }

  return (
    <div ref={rootRef} className="st tc--list">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: LIST_CSS }} />

      <header className="st-intro st-sec">
        <span className="st-kicker">Your classes</span>
        <h1 className="st-title">Who you teach.</h1>
        <p className="st-lede">
          A class is a group you give exercises to. Open one to see how it is
          reading type, and who is falling behind.
        </p>
      </header>

      <section className="st-panel st-sec" aria-label="Classes">
        <div className="st-panel__head">
          <h2 className="st-panel__title">
            {filter === "active" ? "Active" : "Archived"}
          </h2>

          <div className="tc-head-tools">
            {/* The profile's segmented control, same geometry and same states. */}
            <div className="st-choice" role="group" aria-label="Show">
              <button
                type="button"
                className={`st-choice__btn${filter === "active" ? " is-active" : ""}`}
                aria-pressed={filter === "active"}
                onClick={() => setFilter("active")}
              >
                Active {active.length}
              </button>
              <button
                type="button"
                className={`st-choice__btn${filter === "archived" ? " is-active" : ""}`}
                aria-pressed={filter === "archived"}
                onClick={() => setFilter("archived")}
              >
                Archived {archived.length}
              </button>
            </div>

            <button
              type="button"
              className="st-action st-action--compact"
              onClick={() => setCreating((v) => !v)}
              aria-expanded={creating}
            >
              New class
            </button>
          </div>
        </div>

        {/* ── The first text field of the whole product. Nothing is invented:
            the contour, the radius, the mono label and the ink steps all come
            from controls that already exist in the profile's Preferences. ── */}
        {creating && (
          <form
            className="tc-form"
            onSubmit={(e) => {
              e.preventDefault();
              createClass();
            }}
          >
            <label className="st-field">
              <span className="st-field__label">Class name</span>
              <input
                ref={inputRef}
                type="text"
                className="st-input"
                value={draftName}
                placeholder="DSAA 1 · Group A"
                maxLength={48}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setCreating(false);
                    setDraftName("");
                  }
                }}
              />
            </label>
            <div className="tc-form__actions">
              <button type="submit" className="st-action st-action--compact st-action--primary" disabled={!draftName.trim()}>
                Create
              </button>
              <button
                type="button"
                className="st-action st-action--compact"
                onClick={() => {
                  setCreating(false);
                  setDraftName("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {shown.length === 0 ? (
          <p className="st-empty">
            {filter === "active"
              ? "No class yet. Create one, add your students, and you can give it an exercise straight away."
              : "Nothing archived. A class you archive stops appearing everywhere else, and its exercises stay readable."}
          </p>
        ) : (
          <ul className="st-lines">
            {shown.map((c) => {
              const running = runningByClass.get(c.id) ?? 0;
              return (
                <li key={c.id}>
                  <button type="button" className="st-line" onClick={() => onOpenClass(c.id)}>
                    <span className="st-line__name">{c.name}</span>
                    <span className="st-line__meta">
                      {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
                    </span>
                    <span className="tc-class__running">
                      {running > 0 ? (
                        <span className="tc-class__badge">{running} running</span>
                      ) : (
                        // "no exercise" was false for a class that has finished
                        // ones. Say which of the two is actually true.
                        <span className="tc-class__idle">
                          {gaveAny.has(c.id) ? "nothing running" : "no exercise yet"}
                        </span>
                      )}
                    </span>
                    <span className="st-line__when">{classActivityLabel(c.id, teacher.exercises)}</span>
                    <span className="st-line__arrow" aria-hidden="true">→</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* Only what belongs to this screen. Everything above reads the site's system. */
const LIST_CSS = `
  .tc-head-tools { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
  .tc-form { display: flex; align-items: flex-end; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 1.1rem; padding-bottom: 1.1rem; border-bottom: 1px solid rgb(${CREAM} / 0.08); }
  .tc-form .st-field { flex: 1 1 18rem; }
  .tc-form__actions { display: flex; gap: 0.5rem; flex: none; }
  .st-action:disabled { opacity: 0.4; cursor: not-allowed; }

  /* This screen's row carries four facts, so it declares its own columns. */
  .tc--list .st-line { grid-template-columns: minmax(0, 1fr) 7rem 8rem 7rem 1.2rem; }
  .tc-class__badge { display: inline-block; font-family: var(--pf-mono); font-size: 0.54rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.18rem 0.5rem; border-radius: var(--radius-pill); border: 1px solid rgb(${CREAM} / 0.34); color: rgb(${CREAM} / 0.85); white-space: nowrap; }
  .tc-class__idle { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.32); }

  @media (max-width: 760px) {
    .tc--list .st-line { grid-template-columns: minmax(0, 1fr) auto; row-gap: 0.25rem; }
    .tc--list .st-line__meta { grid-row: 2; grid-column: 1; }
    .tc--list .tc-class__running { grid-row: 2; grid-column: 2; justify-self: end; }
    .tc--list .st-line__when { grid-column: 1 / -1; text-align: left; }
    .tc--list .st-line__arrow { display: none; }
  }
`;
