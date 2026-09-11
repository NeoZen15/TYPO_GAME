"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CREAM } from "@/features/profile/components/board-system";
import {
  DUE_SHORTCUTS,
  OPENS_SHORTCUTS,
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
// ONE CALENDAR, PICKED AS A RANGE. First click sets the opening, second click
// sets the closing, a click before the opening starts a new range. That is the
// gesture every flight and hotel calendar has taught people, and the first
// version did not have it: it edited ONE end at a time, so a second click had
// to be preceded by a trip back up to the other field button to say "now I mean
// the closing one". The owner called that nonsense, and it was.
//
// A consequence worth stating, because it is what makes the grid readable: the
// filled cell is ALWAYS the opening and the ringed cell is ALWAYS the closing.
// They no longer trade places with a mode, so the legend under the grid is true
// at every moment, and the only days greyed out are days in the past.
//
// THE HOURS SIT BESIDE THE CALENDAR, BOTH OF THEM, for the same reason. An hour
// field that belongs to whichever end was last touched is a mode, and the mode
// is exactly what we just removed. Two labelled pairs, no mode left anywhere.
//
// DA: nothing is invented here. The field is '.st-select' worn by a button, the
// shortcuts are '.st-filter__btn', the hours are real drop-downs, and the
// duration takes the ink of '.st-kpi__value', the site's treatment for a number
// that carries a decision.
// ---------------------------------------------------------------------------

type End = "opens" | "due";

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
   * Null until the composer has a clock. `/teacher` is prerendered static, so a
   * window computed during render would bake the BUILD time into the HTML; the
   * panel paints its furniture first and its values on mount.
   */
  value: WhenWindow | null;
  now: number;
  onChange: (next: WhenWindow) => void;
}) {
  const [open, setOpen] = useState(false);
  /** What the next click on the grid means. The whole gesture is this one bit. */
  const [next, setNext] = useState<End>("opens");
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
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

  const cursor = month ?? (value === null ? null : monthCursorOf(value.opens.day));

  const reveal = (end: End) => {
    setOpen(true);
    setNext(end);
    setMonth(null);
    setFocused(value ? value[end].day : null);
  };

  /**
   * THE CYCLE, and it is one expression on purpose: a range picker that spreads
   * this over three handlers is how "click before the start" ends up doing
   * nothing. A day at or after the opening that can still hold a deadline
   * closes the window and hands the next click back to the opening. Anything
   * else opens a new one.
   */
  const pickDay = (day: string) => {
    if (!value || !opensDayAllowed(day, todayKey)) return;
    const closes = next === "due" && day >= value.opens.day && dueDayAllowed(day, value.opens);
    onChange(closes ? setDueDay(value, day) : setOpens(value, withDay(value.opens, day)));
    setNext(closes ? "opens" : "due");
    setMonth(monthCursorOf(day));
    setFocused(day);
    setHover(null);
  };

  const jump = (end: End, moment: LocalMoment) => {
    if (!value) return;
    onChange(end === "opens" ? setOpens(value, moment) : setDueDay({ ...value, due: moment }, moment.day));
    setNext(end === "opens" ? "due" : "opens");
    setMonth(monthCursorOf(moment.day));
    setFocused(moment.day);
  };

  const pickTime = (end: End, time: string) => {
    if (!value) return;
    onChange(end === "opens" ? setOpens(value, withTime(value.opens, time)) : setDueTime(value, time));
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      e.preventDefault();
      return;
    }
    const by = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, PageUp: -28, PageDown: 28 }[e.key];
    if (by === undefined || !value || !cursor) return;
    const [y, m, d] = (focused ?? value.opens.day).split("-").map(Number);
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
  // While the closing is the one being aimed at, the band follows the cursor:
  // the range is drawn before it is committed, which is what tells a teacher
  // their next click lands on the far end and not on a new start.
  const bandEnd =
    value === null
      ? null
      : next === "due" && hover !== null && hover > value.opens.day
        ? hover
        : value.due.day;

  return (
    <section className="st-panel st-sec" aria-label="When">
      <style dangerouslySetInnerHTML={{ __html: WHEN_CSS }} />
      <h2 className="st-panel__title">When</h2>

      <div className="tc-new__grid">
        <MomentField
          label="It opens"
          moment={value?.opens ?? null}
          note={immediate ? "right away" : undefined}
          aiming={open && next === "opens"}
          onToggle={() => (open && next === "opens" ? setOpen(false) : reveal("opens"))}
          shortcuts={OPENS_SHORTCUTS}
          onShortcut={(s) => value && jump("opens", s.resolve(value, now))}
          shortcutOff={() => false}
        />
        <MomentField
          label="It closes"
          moment={value?.due ?? null}
          note={value && value.due.day === value.opens.day ? "same day" : undefined}
          aiming={open && next === "due"}
          onToggle={() => (open && next === "due" ? setOpen(false) : reveal("due"))}
          shortcuts={DUE_SHORTCUTS}
          onShortcut={(s) => value && jump("due", s.resolve(value, now))}
          shortcutOff={(s) => (value === null ? true : stampOf(s.resolve(value, now)) <= stampOf(value.opens))}
        />
      </div>

      {value !== null && cursor !== null && open && (
        <div className="tw-editor" id="tw-editor">
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
              onMouseLeave={() => setHover(null)}
            >
              {chunk(monthGrid(cursor.year, cursor.month), 7).map((week) => (
                <div className="tw-grid__row" role="row" key={week[0].day}>
                  {week.map((cell) => {
                    const isOpens = cell.day === value.opens.day;
                    const isDue = cell.day === value.due.day || cell.day === bandEnd;
                    const off = !opensDayAllowed(cell.day, todayKey);
                    return (
                      <span role="gridcell" aria-selected={isOpens || isDue} key={cell.day}>
                        <button
                          type="button"
                          data-day={cell.day}
                          className={[
                            "tw-day",
                            cell.inMonth ? "" : "is-out",
                            cell.day === todayKey ? "is-today" : "",
                            bandEnd !== null && cell.day > value.opens.day && cell.day < bandEnd
                              ? "is-band"
                              : "",
                            isOpens ? "is-opens" : isDue ? "is-due" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          tabIndex={cell.day === (focused ?? value.opens.day) ? 0 : -1}
                          aria-label={spellDay(cell.day, thisYear)}
                          aria-disabled={off || undefined}
                          onMouseEnter={() => setHover(cell.day)}
                          onClick={() => pickDay(cell.day)}
                        >
                          {cell.label}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>

            <p className="tw-say">
              {next === "opens"
                ? "Click a day to open on."
                : "Now the day it closes. An earlier day starts again."}
            </p>

            {/* Four marks, four meanings, and they no longer trade places: the
                filled cell is the opening whatever you are about to click. */}
            <ul className="tw-key">
              <li>
                <span className="tw-key__mark is-opens" aria-hidden="true" />
                opens
              </li>
              <li>
                <span className="tw-key__mark is-due" aria-hidden="true" />
                closes
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
            <HourBlock
              label="Opens at"
              day={spellDay(value.opens.day, thisYear)}
              time={value.opens.time}
              onPick={(t) => pickTime("opens", t)}
            />
            <HourBlock
              label="Closes at"
              day={spellDay(value.due.day, thisYear)}
              time={value.due.time}
              blocked={(hour, minute) => dueTimeBlocked(value, hour, minute)}
              onPick={(t) => pickTime("due", t)}
            />
            <button type="button" className="st-filter__btn tw-done" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      <div className="tc-set tw-span">
        <div className="tc-set__main">
          <span className="st-field__label">Open for</span>
          <strong className="tw-span__value">{value === null ? "—" : spanLabel(minutes)}</strong>
          {value !== null && (
            <span className="tw-span__gloss">
              {immediate ? "Opens right away" : `Opens ${spellMoment(value.opens, thisYear)}`}, closes{" "}
              {spellMoment(value.due, thisYear)}.
            </span>
          )}
        </div>
        <p className="tc-set__say">
          The window is what makes a reading possible: half the class finished
          says nothing until you know how much of the time has gone.
        </p>
      </div>
    </section>
  );
}

function HourBlock({
  label,
  day,
  time,
  blocked,
  onPick,
}: {
  label: string;
  day: string;
  time: string;
  /** Only the closing has unreachable hours, and only on the opening's own day. */
  blocked?: (hour: number, minute?: number) => boolean;
  onPick: (time: string) => void;
}) {
  const hour = time.slice(0, 2);
  const minute = time.slice(3);
  return (
    <div className="tw-hour">
      <span className="st-field__label">{label}</span>
      <span className="tw-hour__day">{day}</span>
      <span className="tw-hour__pair">
        <span className="st-selectwrap">
          <select
            className="st-select"
            aria-label={`${label}, hour`}
            value={hour}
            onChange={(e) => onPick(`${e.target.value}:${minute}`)}
          >
            {HOURS.map((h) => (
              <option key={h} value={h} disabled={blocked?.(Number(h))}>
                {h}
              </option>
            ))}
          </select>
          <span className="st-select__caret" aria-hidden="true">
            ▾
          </span>
        </span>
        <span className="tw-hour__colon" aria-hidden="true">
          :
        </span>
        <span className="st-selectwrap">
          <select
            className="st-select"
            aria-label={`${label}, minute`}
            value={minute}
            onChange={(e) => onPick(`${hour}:${e.target.value}`)}
          >
            {MINUTES.map((m) => (
              <option key={m} value={m} disabled={blocked?.(Number(hour), Number(m))}>
                {m}
              </option>
            ))}
          </select>
          <span className="st-select__caret" aria-hidden="true">
            ▾
          </span>
        </span>
      </span>
    </div>
  );
}

function MomentField({
  label,
  moment,
  note,
  aiming,
  onToggle,
  shortcuts,
  onShortcut,
  shortcutOff,
}: {
  label: string;
  moment: LocalMoment | null;
  note?: string;
  /** True when the next click on the grid lands on this end. */
  aiming: boolean;
  onToggle: () => void;
  shortcuts: ReadonlyArray<Shortcut>;
  onShortcut: (shortcut: Shortcut) => void;
  shortcutOff: (shortcut: Shortcut) => boolean;
}) {
  return (
    <div className="st-field">
      <span className="st-field__label">{label}</span>
      <span className={`st-selectwrap${aiming ? " is-open" : ""}`}>
        <button
          type="button"
          className={`st-select tw-field__btn${aiming ? " is-aiming" : ""}`}
          aria-expanded={aiming}
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
  /* The end the next click will move, said on the field it will move. */
  .tw-field__btn.is-aiming { border-color: rgb(${CREAM} / 0.7); background: rgb(${CREAM} / 0.1); }
  .st-select__caret { transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1); }
  .st-selectwrap.is-open .st-select__caret { transform: translateY(-50%) rotate(180deg); }
  .tw-field__note { margin-top: 0.35rem; font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(${CREAM} / 0.42); }
  .tw-field__shortcuts { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.55rem; }
  .st-filter__btn:disabled { cursor: default; opacity: 0.35; }

  .tw-editor { margin-top: 1.4rem; padding-top: 1.3rem; border-top: 1px solid rgb(${CREAM} / 0.1); display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1.1rem clamp(1.4rem, 4vw, 2.8rem); align-items: start; }
  @media (max-width: 720px) { .tw-editor { grid-template-columns: 1fr; } }

  .tw-cal { display: grid; gap: 0.4rem; justify-items: start; }
  .tw-months { display: inline-flex; align-items: center; gap: 0.25rem; }
  .tw-months__name { min-width: 7.6rem; text-align: center; font-family: var(--pf-mono); font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pf-cream); }
  .tw-step { appearance: none; border: 1px solid rgb(${CREAM} / 0.18); background: transparent; color: rgb(${CREAM} / 0.6); cursor: pointer; width: 1.3rem; height: 1.3rem; border-radius: var(--radius-pill); line-height: 1; font-size: 0.7rem; transition: border-color 140ms ease, color 140ms ease; }
  .tw-step:hover { border-color: rgb(${CREAM} / 0.45); color: var(--pf-cream); }
  .tw-step:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: 2px; }

  /* NO GAP BETWEEN THE CELLS, so the days inside the window join into one
     continuous band. Separated pills read as chosen days; a band reads as a
     range, which is what it is. */
  .tw-week, .tw-grid__row { display: grid; grid-template-columns: repeat(7, 1.95rem); }
  .tw-grid { display: grid; }
  .tw-week__day { text-align: center; padding-bottom: 0.2rem; font-family: var(--pf-mono); font-size: 0.52rem; letter-spacing: 0.06em; color: rgb(${CREAM} / 0.35); }

  .tw-day {
    position: relative; appearance: none; cursor: pointer; width: 100%; height: 1.75rem; padding: 0;
    border: 1px solid transparent; border-radius: var(--radius-pill);
    background: transparent; color: rgb(${CREAM} / 0.72);
    font-family: var(--pf-mono); font-size: 0.64rem; font-variant-numeric: tabular-nums;
    transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
  }
  .tw-day:hover:not([aria-disabled]) { background: rgb(${CREAM} / 0.14); color: var(--pf-cream); }
  .tw-day:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: -1px; z-index: 1; }
  .tw-day.is-out { color: rgb(${CREAM} / 0.26); }
  .tw-day[aria-disabled] { cursor: default; color: rgb(${CREAM} / 0.14); }

  .tw-day.is-band { background: rgb(${CREAM} / 0.06); border-radius: 0; color: rgb(${CREAM} / 0.8); }
  /* Fixed meanings: filled is the opening, ringed is the closing, always. */
  .tw-day.is-due { border-color: rgb(${CREAM} / 0.55); color: var(--pf-cream); }
  .tw-day.is-opens { background: var(--pf-cream); border-color: transparent; color: var(--pf-bg); font-weight: 700; }
  .tw-day.is-opens:hover:not([aria-disabled]) { background: rgb(${CREAM} / 0.86); color: var(--pf-bg); }
  /* Today is a POSITION and not a choice, so it is a dot and never a ring: a
     ring is what the closing already wears. */
  .tw-day.is-today::after {
    content: ""; position: absolute; left: 50%; bottom: 0.2rem; width: 3px; height: 3px;
    margin-left: -1.5px; border-radius: 50%; background: rgb(${CREAM} / 0.55);
  }
  .tw-day.is-opens::after { background: var(--pf-bg); }

  .tw-say { margin: 0.35rem 0 0; max-width: 17rem; font-size: 0.72rem; line-height: 1.4; color: rgb(${CREAM} / 0.5); }
  .tw-key { display: flex; flex-wrap: wrap; gap: 0.25rem 0.8rem; margin: 0.1rem 0 0; padding: 0; list-style: none; }
  .tw-key li { display: inline-flex; align-items: center; gap: 0.3rem; font-family: var(--pf-mono); font-size: 0.5rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.42); }
  .tw-key__mark { width: 0.65rem; height: 0.65rem; border-radius: var(--radius-pill); border: 1px solid transparent; }
  .tw-key__mark.is-opens { background: var(--pf-cream); }
  .tw-key__mark.is-due { border-color: rgb(${CREAM} / 0.55); }
  .tw-key__mark.is-band { background: rgb(${CREAM} / 0.12); border-radius: 0; }
  .tw-key__mark.is-today { position: relative; }
  .tw-key__mark.is-today::after { content: ""; position: absolute; left: 50%; top: 50%; width: 3px; height: 3px; margin: -1.5px 0 0 -1.5px; border-radius: 50%; background: rgb(${CREAM} / 0.55); }

  /* The two hours, side by side. An hour that belonged to whichever end was
     last touched would be a mode, and the mode is what we just removed. */
  .tw-side { display: grid; grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr)); gap: 0.9rem 1.2rem; align-items: start; }
  .tw-hour { display: grid; gap: 0.28rem; min-width: 0; }
  .tw-hour__day { font-size: 0.82rem; line-height: 1.2; color: var(--pf-cream); }
  .tw-hour__pair { display: flex; align-items: center; gap: 0.35rem; }
  .tw-hour__pair .st-selectwrap { flex: 0 0 4.3rem; }
  .tw-hour__pair .st-select { padding: 0.42rem 1.6rem 0.42rem 0.75rem; font-size: 0.84rem; font-variant-numeric: tabular-nums; }
  .tw-hour__pair .st-select__caret { right: 0.65rem; }
  .tw-hour__colon { font-family: var(--pf-mono); font-size: 0.8rem; color: rgb(${CREAM} / 0.4); }
  .tw-done { align-self: end; justify-self: start; }

  .tw-span { margin-top: 1.3rem; padding-top: 1.1rem; border-top: 1px solid rgb(${CREAM} / 0.1); }
  .tw-span .tc-set__main { gap: 0.2rem; }
  .tw-span__value { font-size: clamp(1.2rem, 2.2vw, 1.55rem); font-weight: 660; letter-spacing: -0.03em; line-height: 1.1; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .tw-span__gloss { max-width: 46ch; text-wrap: pretty; font-size: 0.8rem; line-height: 1.5; color: rgb(${CREAM} / 0.5); }

  @media (max-width: 420px) {
    .tw-week, .tw-grid__row { grid-template-columns: repeat(7, 1fr); }
    .tw-cal { justify-items: stretch; width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tw-day, .tw-step, .st-select__caret { transition: none; }
  }
`;
