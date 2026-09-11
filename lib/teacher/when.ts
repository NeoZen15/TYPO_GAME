// The two moments of an exercise, and the arithmetic a picker needs to let a
// teacher choose them to the minute.
//
// WHY THIS FILE EXISTS. The composer used to ask the window as two drop-downs
// of offsets, "tomorrow" and "a week", and that is not a plan: a teacher who
// says "for Friday, before the class" cannot express it, and nothing on the
// screen told them which Friday they had just bought. Spec section 18 closes
// the question the other way round: two moments, entered and shown in local
// time, stored in UTC downstream, with the resolved date written in clear so
// nobody discovers a shift after the fact.
//
// A MOMENT IS A DAY PLUS A WALL CLOCK, not an instant, because that is what a
// teacher edits. "Friday at 23:59" survives being moved a week later; an
// instant would drift by an hour across a daylight saving change and land at
// 22:59 without anyone touching it. The instant is derived at the last moment,
// by `stampOf`.
//
// THE MONTH AND WEEKDAY NAMES ARE WRITTEN OUT HERE, not asked of Intl. The
// teacher space is in English throughout, and a formatter that follows the
// visitor's locale renders one string on the server and another after
// hydration, which is the exact defect the header of mock-teacher.ts warns
// about for countdowns.
//
// Day keys are "YYYY-MM-DD" and times are "HH:MM", so both compare correctly
// as plain strings. Every comparison below relies on that.

/** A moment as a teacher writes it: a local calendar day, a local wall clock. */
export type LocalMoment = { day: string; time: string };

/** The window itself. Its only invariant: `due` is strictly after `opens`. */
export type WhenWindow = { opens: LocalMoment; due: LocalMoment };

const pad = (n: number) => String(n).padStart(2, "0");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Monday first: the product is made for European school weeks. */
export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

export const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const momentOf = (stamp: number): LocalMoment => {
  const d = new Date(stamp);
  return { day: dayOf(d), time: timeOf(d) };
};

const partsOf = (m: LocalMoment) => {
  const [year, month, day] = m.day.split("-").map(Number);
  const [hour, minute] = m.time.split(":").map(Number);
  return { year, month, day, hour, minute };
};

/**
 * The instant a moment names. `new Date(y, m, d, h, min)` reads its arguments as
 * local time, which is the whole point: the teacher types local, the window
 * travels as an instant.
 */
export const stampOf = (m: LocalMoment): number => {
  const { year, month, day, hour, minute } = partsOf(m);
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
};

/** Same wall clock, n days later. Through Date, so a month end or a daylight
    saving change is the calendar's problem and not ours. */
export const shiftDays = (m: LocalMoment, days: number): LocalMoment => {
  const { year, month, day } = partsOf(m);
  return { day: dayOf(new Date(year, month - 1, day + days)), time: m.time };
};

export const withDay = (m: LocalMoment, day: string): LocalMoment => ({ day, time: m.time });
export const withTime = (m: LocalMoment, time: string): LocalMoment => ({ day: m.day, time });

/** The next given weekday, never today: "next Monday" said on a Monday means
    the one after this one. */
const nextWeekday = (m: LocalMoment, weekday: number): LocalMoment => {
  const { year, month, day } = partsOf(m);
  const from = new Date(year, month - 1, day).getDay();
  return shiftDays(m, ((weekday - from + 7) % 7) || 7);
};

export const minutesBetween = (from: number, to: number) => Math.round((to - from) / 60_000);
export const hoursBetween = (from: number, to: number) => Math.round((to - from) / 3_600_000);

// ---------------------------------------------------------------------------
// Reading a window out loud
// ---------------------------------------------------------------------------

/**
 * How long the window is, to the minute: "7 days · 10 hours".
 *
 * NOT the same job as `windowLabel` in teacher-time.ts, which rounds a window
 * into prose ("a week") for the reading screens. Here the teacher is deciding,
 * so the number has to be the one they will get. Minutes are dropped once the
 * window is a day or more: at that scale they are noise, not precision.
 */
export const spanLabel = (minutes: number): string => {
  if (minutes <= 0) return "no time at all";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes - days * 1440) / 60);
  const rest = minutes - days * 1440 - hours * 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (days === 0 && rest > 0) parts.push(`${rest} ${rest === 1 ? "minute" : "minutes"}`);
  return parts.length > 0 ? parts.join(" · ") : "under a minute";
};

/** "Friday 12 September". The year only when it is not the current one: a
    school window almost never crosses one, and printing it always would put a
    number nobody reads in front of the one they do. */
export const spellDay = (day: string, thisYear?: number): string => {
  const [year, month, date] = day.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, date).getDay()];
  const tail = thisYear !== undefined && year !== thisYear ? ` ${year}` : "";
  return `${weekday} ${date} ${MONTHS[month - 1]}${tail}`;
};

/** "Friday 12 September at 23:59". What the field writes in clear underneath. */
export const spellMoment = (m: LocalMoment, thisYear?: number) =>
  `${spellDay(m.day, thisYear)} at ${m.time}`;

/** "Fri 12 Sep · 23:59". The value on the field's own button. */
export const shortMoment = (m: LocalMoment): string => {
  const { year, month, day } = partsOf(m);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()].slice(0, 3);
  return `${weekday} ${day} ${MONTHS[month - 1].slice(0, 3)} · ${m.time}`;
};

export const monthTitle = (year: number, month: number) => `${MONTHS[month]} ${year}`;

// ---------------------------------------------------------------------------
// The calendar grid
// ---------------------------------------------------------------------------

export type GridCell = { day: string; label: number; inMonth: boolean };

/**
 * Six weeks of seven days, Monday first, the month always whole inside them.
 *
 * ALWAYS 42 CELLS, even when the month fits in five weeks: a grid that changes
 * height moves the time selector and the duration under it every time the
 * teacher steps a month, and a control that jumps under the cursor is a control
 * people stop trusting.
 */
export const monthGrid = (year: number, month: number): GridCell[] => {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first offset
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - lead + i);
    return { day: dayOf(d), label: d.getDate(), inMonth: d.getMonth() === month };
  });
};

/** The month a day key belongs to, for the grid's cursor. */
export const monthCursorOf = (day: string) => {
  const [year, month] = day.split("-").map(Number);
  return { year, month: month - 1 };
};

export const stepMonth = (cursor: { year: number; month: number }, by: number) => {
  const d = new Date(cursor.year, cursor.month + by, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};

// ---------------------------------------------------------------------------
// The rules. Every one of them keeps the window valid rather than reporting it
// invalid: there is no state of this form in which the deadline sits before the
// opening, so there is no error message to write.
// ---------------------------------------------------------------------------

/** Opening in the past is opening now, so today is the earliest day. */
export const opensDayAllowed = (day: string, todayKey: string) => day >= todayKey;

/** A day can hold a deadline only if it has a minute left after the opening.
    23:59 is that last minute, so the test is on the end of the day. */
export const dueDayAllowed = (day: string, opens: LocalMoment) =>
  stampOf({ day, time: "23:59" }) > stampOf(opens);

/** The window a composer opens on: right away, closed at the end of the seventh
    day. 23:59 because that is what a teacher means by "for Friday" (spec 18). */
export const initialWindow = (now: number): WhenWindow => {
  const opens = momentOf(now);
  return { opens, due: withTime(shiftDays(opens, 7), "23:59") };
};

/**
 * Moving the opening does NOT move a deadline that is still reachable. A
 * deadline is an event in a school week, "before Friday's class", not a length:
 * pushing the opening back by a day does not buy the class another day.
 *
 * It moves only when it would land before the opening, and then it keeps the
 * window it had, that length being the only intent left to honour.
 */
export const setOpens = (w: WhenWindow, opens: LocalMoment): WhenWindow => {
  if (stampOf(opens) < stampOf(w.due)) return { opens, due: w.due };
  const kept = Math.max(minutesBetween(stampOf(w.opens), stampOf(w.due)), 60);
  return { opens, due: momentOf(stampOf(opens) + kept * 60_000) };
};

/**
 * Choosing a deadline day keeps the hour when the hour still says something,
 * and falls back to the end of that day when it does not, which is the case of
 * a deadline set on the opening day itself: "opens Monday 14:00, due Monday"
 * can only mean 23:59.
 */
export const setDueDay = (w: WhenWindow, day: string): WhenWindow => {
  const kept = withDay(w.due, day);
  if (stampOf(kept) > stampOf(w.opens)) return { ...w, due: kept };
  const endOfDay = withTime(kept, "23:59");
  if (stampOf(endOfDay) > stampOf(w.opens)) return { ...w, due: endOfDay };
  return w; // that day holds no deadline at all, and the grid already says so
};

export const setDueTime = (w: WhenWindow, time: string): WhenWindow => {
  const wanted = withTime(w.due, time);
  return stampOf(wanted) > stampOf(w.opens) ? { ...w, due: wanted } : w;
};

/** Times the deadline cannot take, so the selector can grey them out instead of
    accepting a choice it will then undo. Only ever the opening day. */
export const dueTimeBlocked = (w: WhenWindow, hour: number, minute?: number) => {
  if (w.due.day !== w.opens.day) return false;
  const { hour: openHour, minute: openMinute } = partsOf(w.opens);
  if (minute === undefined) return hour < openHour;
  return hour === openHour && minute <= openMinute;
};

// ---------------------------------------------------------------------------
// Shortcuts. They fill the precise values in and then get out of the way: what
// a shortcut writes is an ordinary date and an ordinary hour, editable
// afterwards like anything the teacher typed themselves.
// ---------------------------------------------------------------------------

export type Shortcut = {
  label: string;
  /** Both moments are given, because a deadline shortcut counts from the
      opening and not from now: "in one week" on a Monday opening is the
      following Monday. */
  resolve: (w: WhenWindow, now: number) => LocalMoment;
};

export const OPENS_SHORTCUTS: ReadonlyArray<Shortcut> = [
  { label: "Now", resolve: (_w, now) => momentOf(now) },
  { label: "Tomorrow morning", resolve: (_w, now) => withTime(shiftDays(momentOf(now), 1), "08:00") },
  { label: "Next Monday", resolve: (_w, now) => withTime(nextWeekday(momentOf(now), 1), "08:00") },
];

export const DUE_SHORTCUTS: ReadonlyArray<Shortcut> = [
  { label: "End of today", resolve: (_w, now) => withTime(momentOf(now), "23:59") },
  { label: "In three days", resolve: (w) => withTime(shiftDays(w.opens, 3), "23:59") },
  { label: "In one week", resolve: (w) => withTime(shiftDays(w.opens, 7), "23:59") },
];

/** The four hours a school day actually turns on. */
export const QUICK_TIMES: ReadonlyArray<{ time: string; label: string }> = [
  { time: "08:00", label: "Morning" },
  { time: "12:00", label: "Midday" },
  { time: "17:00", label: "After class" },
  { time: "23:59", label: "End of day" },
];

// ---------------------------------------------------------------------------
// Out to the rest of the space
// ---------------------------------------------------------------------------

/**
 * The window, said the way the exercise contract still says it: relative hours.
 *
 * The mock reasons in offsets from now (see the header of TeacherExercise) and
 * the read gate turns real `available_from` / `due_at` columns into the same
 * three numbers. So this is the one place the composer's two moments become
 * that vocabulary, and it is the only thing to rewrite the day the composer
 * writes to the database.
 */
export const windowContract = (w: WhenWindow, now: number) => {
  const opens = stampOf(w.opens);
  const due = stampOf(w.due);
  const scheduled = opens > now;
  return {
    scheduled,
    dueInHours: hoursBetween(now, due),
    opensInHours: scheduled ? hoursBetween(now, opens) : undefined,
    openedForHours: Math.max(1, hoursBetween(opens, due)),
  };
};
