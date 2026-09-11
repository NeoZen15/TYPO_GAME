"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CREAM } from "@/features/profile/components/board-system";
import {
  DUE_SHORTCUTS,
  OPENS_SHORTCUTS,
  QUICK_TIMES,
  WEEKDAY_INITIALS,
  dayOf,
  dueDayAllowed,
  dueTimeBlocked,
  minutesBetween,
  monthCursorOf,
  monthGrid,
  monthTitle,
  opensDayAllowed,
  setDueDay,
  setDueTime,
  setOpens,
  shortMoment,
  spanLabel,
  spellDay,
  spellMoment,
  stampOf,
  stepMonth,
  withDay,
  withTime,
  type LocalMoment,
  type Shortcut,
  type WhenWindow,
} from "@/lib/teacher/when";

// ---------------------------------------------------------------------------
// Teacher — WHEN. The two moments of an exercise, chosen to the minute.
//
// It replaces two drop-downs of offsets ("tomorrow", "a week"), which could not
// express the only thing a teacher ever says about a deadline: a day and an
// hour. Spec section 18 settles the shape, `lib/teacher/when.ts` holds every
// rule, and this file is the surface: it decides nothing and computes nothing.
//
// ONE CALENDAR, NOT TWO. Both fields open the same grid, the field being edited
// deciding what a click means. That is what makes the constraint visible rather
// than merely enforced: the days a deadline cannot take are greyed IN PLACE,
// under the opening the teacher has just chosen, and the days already inside
// the window are washed, so the window reads as a shape and not as two strings.
//
// A pop-over would have been the reflex, and it costs an anchor, a click-away
// trap and a focus cage for nothing: this panel has the width.
//
// DA: nothing is invented here. The field is '.st-select' worn by a button, the
// shortcuts and the quick hours are '.st-filter__btn', the hour and the minute
// are two real drop-downs, and the duration takes the ink of '.st-kpi__value',
// the site's treatment for a number that carries a decision.
// ---------------------------------------------------------------------------

type Field = "opens" | "due";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

const chunk = <T,>(list: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

export default function TeacherWhen({
  value,
  now,
  onChange,
}: {
  /**
   * Null until the composer has a clock. A window computed during server render
   * would be a different window one second later at hydration, which is the
   * defect the header of TeacherExercise warns about for countdowns, so the
   * panel paints its furniture first and its values on mount.
   */
  value: WhenWindow | null;
  now: number;
  onChange: (next: WhenWindow) => void;
}) {
  const [editing, setEditing] = useState<Field | null>(null);
  // The month shown is DERIVED from the field being edited, and overridden only
  // when the teacher steps or arrows out of it. Keeping it as plain state would
  // mean an effect to resynchronise it every time a shortcut jumps a month.
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  // Focus follows the arrow keys and nothing else: an effect that focused on
  // every render would steal the caret the moment the editor opened.
  const byKey = useRef(false);
  const [focused, setFocused] = useState<string | null>(null);

  const todayKey = useMemo(() => dayOf(new Date(now)), [now]);
  const thisYear = useMemo(() => new Date(now).getFullYear(), [now]);

  useEffect(() => {
    if (!byKey.current || !focused) return;
    byKey.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
  }, [focused, month]);

  const active: Field = editing ?? "opens";
  const edited = value === null ? null : active === "opens" ? value.opens : value.due;
  const cursor = month ?? (edited === null ? null : monthCursorOf(edited.day));

  const put = (field: Field, moment: LocalMoment) => {
    if (!value) return;
    onChange(
      field === "opens" ? setOpens(value, moment) : setDueDay({ ...value, due: moment }, moment.day),
    );
    setMonth(monthCursorOf(moment.day));
    setFocused(moment.day);
  };

  const toggle = (field: Field) => {
    setEditing((prev) => (prev === field ? null : field));
    setMonth(null);
    setFocused(null);
  };

  const dayAllowed = (day: string) =>
    value === null
      ? false
      : active === "opens"
        ? opensDayAllowed(day, todayKey)
        : dueDayAllowed(day, value.opens);

  const pickTime = (time: string) => {
    if (!value) return;
    onChange(active === "opens" ? setOpens(value, withTime(value.opens, time)) : setDueTime(value, time));
  };

  // A shortcut that would land a deadline before the opening is offered greyed
  // out rather than hidden: a teacher reaching for "end of today" on an
  // exercise that opens tomorrow needs to see why it is not available.
  const shortcutOff = (field: Field, shortcut: Shortcut) =>
    value !== null && field === "due" && stampOf(shortcut.resolve(value, now)) <= stampOf(value.opens);

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setEditing(null);
      e.preventDefault();
      return;
    }
    const by = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, PageUp: -28, PageDown: 28 }[
      e.key
    ];
    if (by === undefined || !edited || !cursor) return;
    const [y, m, d] = (focused ?? edited.day).split("-").map(Number);
    const moved = new Date(y, m - 1, d + by);
    byKey.current = true;
    setFocused(dayOf(moved));
    if (moved.getMonth() !== cursor.month || moved.getFullYear() !== cursor.year) {
      setMonth({ year: moved.getFullYear(), month: moved.getMonth() });
    }
    e.preventDefault();
  };

  const minutes = value === null ? 0 : minutesBetween(stampOf(value.opens), stampOf(value.due));
  const immediate = value !== null && stampOf(value.opens) <= now;

  return (
    <section className="st-panel st-sec" aria-label="When">
      <style dangerouslySetInnerHTML={{ __html: WHEN_CSS }} />
      <h2 className="st-panel__title">When</h2>

      <div className="tc-new__grid">
        <MomentField
          label="It opens"
          moment={value?.opens ?? null}
          note={immediate ? "right away" : undefined}
          open={editing === "opens"}
          onToggle={() => toggle("opens")}
          shortcuts={OPENS_SHORTCUTS}
          onShortcut={(s) => {
            if (!value) return;
            setEditing("opens");
            put("opens", s.resolve(value, now));
          }}
          shortcutOff={(s) => shortcutOff("opens", s)}
        />
        <MomentField
          label="It closes"
          moment={value?.due ?? null}
          note={value && value.due.day === value.opens.day ? "same day" : undefined}
          open={editing === "due"}
          onToggle={() => toggle("due")}
          shortcuts={DUE_SHORTCUTS}
          onShortcut={(s) => {
            if (!value) return;
            setEditing("due");
            put("due", s.resolve(value, now));
          }}
          shortcutOff={(s) => shortcutOff("due", s)}
        />
      </div>

      {value !== null && edited !== null && cursor !== null && editing !== null && (
        <div className="tw-editor" id="tw-editor">
          {/* Left: the month. Right: the hour, and what the month is being
              chosen FOR. The calendar is 7 cells wide and nothing else was, so
              the panel used to run two thirds empty beside it. */}
          <div className="tw-cal">
            <div className="tw-months">
              <button
                type="button"
                className="tw-step"
                onClick={() => setMonth(stepMonth(cursor, -1))}
                aria-label="Previous month"
              >
                ‹
              </button>
              <span className="tw-months__name">{monthTitle(cursor.year, cursor.month)}</span>
              <button
                type="button"
                className="tw-step"
                onClick={() => setMonth(stepMonth(cursor, 1))}
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <div className="tw-week" aria-hidden="true">
              {WEEKDAY_INITIALS.map((initial, i) => (
                <span key={i} className="tw-week__day">
                  {initial}
                </span>
              ))}
            </div>

            <div
              className="tw-grid"
              ref={gridRef}
              role="grid"
              aria-label={monthTitle(cursor.year, cursor.month)}
              onKeyDown={onGridKey}
            >
              {chunk(monthGrid(cursor.year, cursor.month), 7).map((week) => (
                <div className="tw-grid__row" role="row" key={week[0].day}>
                  {week.map((cell) => {
                    const isEdge = cell.day === value.opens.day || cell.day === value.due.day;
                    const isActive = cell.day === edited.day;
                    const off = !dayAllowed(cell.day);
                    return (
                      <span role="gridcell" aria-selected={isActive} key={cell.day}>
                        <button
                          type="button"
                          data-day={cell.day}
                          className={[
                            "tw-day",
                            cell.inMonth ? "" : "is-out",
                            off ? "is-off" : "",
                            cell.day === todayKey ? "is-today" : "",
                            cell.day > value.opens.day && cell.day < value.due.day ? "is-band" : "",
                            isActive ? "is-active" : isEdge ? "is-edge" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          tabIndex={cell.day === (focused ?? edited.day) ? 0 : -1}
                          aria-label={spellDay(cell.day, thisYear)}
                          aria-disabled={off || undefined}
                          onClick={() => {
                            if (off) return;
                            put(active, withDay(edited, cell.day));
                          }}
                        >
                          {cell.label}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Three marks, three meanings. They looked alike until a teacher
                said so: today was a ring and the far end of the window was the
                same ring. */}
            <ul className="tw-key">
              <li>
                <span className="tw-key__mark is-active" aria-hidden="true" />
                {editing === "opens" ? "opens" : "closes"}
              </li>
              <li>
                <span className="tw-key__mark is-edge" aria-hidden="true" />
                {editing === "opens" ? "closes" : "opens"}
              </li>
              <li>
                <span className="tw-key__mark is-band" aria-hidden="true" />
                open
              </li>
              <li>
                <span className="tw-key__mark is-today" aria-hidden="true" />
                today
              </li>
            </ul>
          </div>

          <div className="tw-side">
            <span className="st-field__label">
              {editing === "opens" ? "Choosing the opening" : "Choosing the deadline"}
            </span>
            <p className="tw-side__day">{spellDay(edited.day, thisYear)}</p>

            <div className="tw-time">
              <label className="st-field tw-time__unit">
                <span className="st-field__label">Hour</span>
                <span className="st-selectwrap">
                  <select
                    className="st-select"
                    value={edited.time.slice(0, 2)}
                    onChange={(e) => pickTime(`${e.target.value}:${edited.time.slice(3)}`)}
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h} disabled={editing === "due" && dueTimeBlocked(value, Number(h))}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="st-select__caret" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              <span className="tw-time__colon" aria-hidden="true">
                :
              </span>

              <label className="st-field tw-time__unit">
                <span className="st-field__label">Minute</span>
                <span className="st-selectwrap">
                  <select
                    className="st-select"
                    value={edited.time.slice(3)}
                    onChange={(e) => pickTime(`${edited.time.slice(0, 2)}:${e.target.value}`)}
                  >
                    {MINUTES.map((m) => (
                      <option
                        key={m}
                        value={m}
                        disabled={
                          editing === "due" &&
                          dueTimeBlocked(value, Number(edited.time.slice(0, 2)), Number(m))
                        }
                      >
                        {m}
                      </option>
                    ))}
                  </select>
                  <span className="st-select__caret" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>
            </div>

            <div className="tw-quick">
              {QUICK_TIMES.map((quick) => (
                <button
                  key={quick.time}
                  type="button"
                  className={`st-filter__btn${edited.time === quick.time ? " is-active" : ""}`}
                  disabled={
                    editing === "due" && stampOf(withTime(value.due, quick.time)) <= stampOf(value.opens)
                  }
                  onClick={() => pickTime(quick.time)}
                >
                  {quick.label} <em>{quick.time}</em>
                </button>
              ))}
            </div>

            <button type="button" className="st-action st-action--compact tw-done" onClick={() => setEditing(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <div className="tw-span">
        <span className="st-field__label">Open for</span>
        <strong className="tw-span__value">{value === null ? "—" : spanLabel(minutes)}</strong>
        {value !== null && (
          <span className="tw-span__gloss">
            {immediate ? "Opens right away" : `Opens ${spellMoment(value.opens, thisYear)}`}, closes{" "}
            {spellMoment(value.due, thisYear)}.
          </span>
        )}
      </div>

      <span className="tc-new__hint">
        The window is what makes a reading possible: half the class finished says
        nothing until you know how much of the time has gone.
      </span>
    </section>
  );
}

function MomentField({
  label,
  moment,
  note,
  open,
  onToggle,
  shortcuts,
  onShortcut,
  shortcutOff,
}: {
  label: string;
  moment: LocalMoment | null;
  note?: string;
  open: boolean;
  onToggle: () => void;
  shortcuts: ReadonlyArray<Shortcut>;
  onShortcut: (shortcut: Shortcut) => void;
  shortcutOff: (shortcut: Shortcut) => boolean;
}) {
  return (
    <div className="st-field">
      <span className="st-field__label">{label}</span>
      <span className={`st-selectwrap${open ? " is-open" : ""}`}>
        <button
          type="button"
          className="st-select tw-field__btn"
          aria-expanded={open}
          aria-controls="tw-editor"
          disabled={moment === null}
          onClick={onToggle}
        >
          {moment === null ? "—" : shortMoment(moment)}
        </button>
        <span className="st-select__caret" aria-hidden="true">
          ▾
        </span>
      </span>
      {/* Only what the value on the button cannot say. Spec section 18 wants
          the resolved date in clear, and the button carries it; spelling it a
          second time under every field was two lines of height for nothing. */}
      {note ? <span className="tw-field__note">{note}</span> : null}
      <div className="tw-field__shortcuts">
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut.label}
            type="button"
            className="st-filter__btn"
            disabled={moment === null || shortcutOff(shortcut)}
            onClick={() => onShortcut(shortcut)}
          >
            {shortcut.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const WHEN_CSS = `
  .tw-field__btn { text-align: left; cursor: pointer; font-variant-numeric: tabular-nums; }
  .tw-field__btn:disabled { cursor: default; color: rgb(${CREAM} / 0.3); }
  .st-select__caret { transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1); }
  .st-selectwrap.is-open .st-select__caret { transform: translateY(-50%) rotate(180deg); }
  .tw-field__note { margin-top: 0.35rem; font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(${CREAM} / 0.42); }
  .tw-field__shortcuts { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.55rem; }
  .st-filter__btn:disabled { cursor: default; opacity: 0.35; }

  /* Two columns: the month is seven cells wide and nothing else was, so the
     panel used to run two thirds empty to the right of it. */
  .tw-editor { margin-top: 1.4rem; padding-top: 1.3rem; border-top: 1px solid rgb(${CREAM} / 0.1); display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1.2rem clamp(1.6rem, 4vw, 3rem); align-items: start; }
  @media (max-width: 720px) { .tw-editor { grid-template-columns: 1fr; } }

  .tw-cal { display: grid; gap: 0.5rem; justify-items: start; }
  .tw-months { display: inline-flex; align-items: center; gap: 0.3rem; }
  .tw-months__name { min-width: 8.5rem; text-align: center; font-family: var(--pf-mono); font-size: 0.66rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pf-cream); }
  .tw-step { appearance: none; border: 1px solid rgb(${CREAM} / 0.18); background: transparent; color: rgb(${CREAM} / 0.6); cursor: pointer; width: 1.55rem; height: 1.55rem; border-radius: var(--radius-pill); line-height: 1; font-size: 0.8rem; transition: border-color 140ms ease, color 140ms ease; }
  .tw-step:hover { border-color: rgb(${CREAM} / 0.45); color: var(--pf-cream); }
  .tw-step:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: 2px; }

  /* NO GAP BETWEEN THE CELLS, so the days inside the window join into one
     continuous band. Separated pills read as seven chosen days; a band reads
     as a range, which is what it is. */
  .tw-week, .tw-grid__row { display: grid; grid-template-columns: repeat(7, clamp(2.45rem, 3vw, 3.1rem)); }
  .tw-grid { display: grid; }
  .tw-week__day { text-align: center; padding-bottom: 0.3rem; font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.08em; color: rgb(${CREAM} / 0.35); }

  .tw-day {
    position: relative; appearance: none; cursor: pointer; width: 100%; height: 2.35rem; padding: 0;
    border: 1px solid transparent; border-radius: var(--radius-pill);
    background: transparent; color: rgb(${CREAM} / 0.72);
    font-family: var(--pf-mono); font-size: 0.72rem; font-variant-numeric: tabular-nums;
    transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
  }
  .tw-day:hover:not([aria-disabled]) { background: rgb(${CREAM} / 0.12); color: var(--pf-cream); }
  .tw-day:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: -1px; z-index: 1; }
  .tw-day.is-out { color: rgb(${CREAM} / 0.26); }
  .tw-day[aria-disabled] { cursor: default; color: rgb(${CREAM} / 0.14); }

  /* The days the exercise is open, drawn as one strip and not as buttons. */
  .tw-day.is-band { background: rgb(${CREAM} / 0.06); border-radius: 0; color: rgb(${CREAM} / 0.8); }
  /* The end of the window NOT being edited: outlined, so it stays findable. */
  .tw-day.is-edge { border-color: rgb(${CREAM} / 0.55); color: var(--pf-cream); }
  /* The end being edited: the only filled cell on the grid. */
  .tw-day.is-active { background: var(--pf-cream); border-color: transparent; color: var(--pf-bg); font-weight: 700; }
  .tw-day.is-active:hover:not([aria-disabled]) { background: rgb(${CREAM} / 0.86); color: var(--pf-bg); }
  /* Today is a POSITION and not a choice, so it is a dot and never a ring: a
     ring is what the far end of the window already wears. */
  .tw-day.is-today::after {
    content: ""; position: absolute; left: 50%; bottom: 0.3rem; width: 3px; height: 3px;
    margin-left: -1.5px; border-radius: 50%; background: rgb(${CREAM} / 0.55);
  }
  .tw-day.is-active::after { background: var(--pf-bg); }

  .tw-key { display: flex; flex-wrap: wrap; gap: 0.3rem 0.9rem; margin: 0.55rem 0 0; padding: 0; list-style: none; }
  .tw-key li { display: inline-flex; align-items: center; gap: 0.35rem; font-family: var(--pf-mono); font-size: 0.54rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.42); }
  .tw-key__mark { width: 0.75rem; height: 0.75rem; border-radius: var(--radius-pill); border: 1px solid transparent; }
  .tw-key__mark.is-active { background: var(--pf-cream); }
  .tw-key__mark.is-edge { border-color: rgb(${CREAM} / 0.55); }
  .tw-key__mark.is-band { background: rgb(${CREAM} / 0.12); border-radius: 0; }
  .tw-key__mark.is-today { position: relative; }
  .tw-key__mark.is-today::after { content: ""; position: absolute; left: 50%; top: 50%; width: 3px; height: 3px; margin: -1.5px 0 0 -1.5px; border-radius: 50%; background: rgb(${CREAM} / 0.55); }

  .tw-side { display: grid; justify-items: stretch; gap: 0.55rem; }
  .tw-side__day { margin: 0 0 0.3rem; font-size: clamp(1.05rem, 2vw, 1.3rem); font-weight: 640; letter-spacing: -0.02em; line-height: 1.15; color: var(--pf-cream); }
  .tw-time { display: flex; align-items: flex-end; gap: 0.5rem; }
  .tw-time__unit { width: 5.4rem; }
  .tw-time__colon { padding-bottom: 0.62rem; font-family: var(--pf-mono); font-size: 0.9rem; color: rgb(${CREAM} / 0.4); }
  /* The four hours span the column rather than huddling at its left edge:
     the calendar is a fixed seven cells wide, so whatever is beside it has to
     take the rest of the width or the panel reads as half empty. */
  .tw-quick { display: grid; grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)); gap: 0.4rem; }
  .tw-quick .st-filter__btn { text-align: center; }
  .tw-quick em { font-style: normal; font-variant-numeric: tabular-nums; opacity: 0.55; }
  .tw-done { margin-top: 0.35rem; justify-self: start; }

  .tw-span { display: grid; gap: 0.25rem; margin-top: 1.4rem; padding-top: 1.2rem; border-top: 1px solid rgb(${CREAM} / 0.1); }
  .tw-span__value { font-size: clamp(1.2rem, 2.2vw, 1.55rem); font-weight: 660; letter-spacing: -0.03em; line-height: 1.1; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .tw-span__gloss { max-width: 56ch; text-wrap: pretty; font-size: 0.8rem; line-height: 1.5; color: rgb(${CREAM} / 0.5); }

  @media (max-width: 420px) {
    .tw-week, .tw-grid__row { grid-template-columns: repeat(7, 1fr); }
    .tw-cal { justify-items: stretch; width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tw-day, .tw-step, .st-select__caret { transition: none; }
  }
`;
