#!/usr/bin/env node

// The window of an assignment, self-tested. No build, no database, no network.
//
// THE RULE IT PROTECTS, and it is a product promise before it is a type: an
// exercise whose deadline sits before its opening is an exercise nobody can
// ever do, and the composer must not be able to produce one. lib/teacher/when.ts
// answers that by REPAIRING rather than reporting: every setter returns a valid
// window, which is why no error message exists anywhere on the screen. That
// design is only safe while the setters really are total, so they are exercised
// here on a sweep rather than read.
//
// It also pins the three decisions that are easy to undo by accident:
//
//   1. A MOMENT IS A WALL CLOCK, not an instant. Shifting "08:00" by seven days
//      across the autumn change must still say 08:00, which means 169 real
//      hours and not 168. An implementation that adds 7 * 86_400_000 passes
//      every other test in this file and fails that one.
//   2. MOVING THE OPENING DOES NOT MOVE A REACHABLE DEADLINE. "For Friday" is
//      an event in a school week, not a length, so a later opening buys the
//      class less time, never a later Friday.
//   3. A DEADLINE ON THE OPENING DAY MEANS THE END OF THAT DAY. 23:59 is what a
//      teacher means by "for Friday" (spec section 18), so a day chosen with an
//      hour that has already passed snaps there instead of being refused.
//
// Europe/Paris is forced below: these are calendar rules, and a guard that
// reads the machine's timezone would go green or red depending on whose laptop
// runs it.

process.env.TZ = "Europe/Paris";

const WHEN = "lib/teacher/when.ts";
const failures = [];

const expect = (label, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

const expectTrue = (label, actual) => {
  if (actual !== true) failures.push(`${label}: expected true, got ${JSON.stringify(actual)}`);
};

try {
  const {
    DUE_SHORTCUTS,
    OPENS_SHORTCUTS,
    dueDayAllowed,
    dueTimeBlocked,
    hoursBetween,
    initialWindow,
    minutesBetween,
    monthGrid,
    opensDayAllowed,
    setDueDay,
    setDueTime,
    setOpens,
    shiftDays,
    spanLabel,
    spellMoment,
    stampOf,
    windowContract,
    withDay,
    withTime,
  } = await import(`../../${WHEN}`);

  const at = (day, time) => ({ day, time });
  const span = (w) => minutesBetween(stampOf(w.opens), stampOf(w.due));

  // ── 1. The window a composer opens on ────────────────────────────────────
  const noon = stampOf(at("2026-09-10", "14:32"));
  const start = initialWindow(noon);
  expect("initial opening is now", start.opens, at("2026-09-10", "14:32"));
  expect("initial deadline is the end of the seventh day", start.due, at("2026-09-17", "23:59"));
  expect("initial window reads in days and hours", spanLabel(span(start)), "7 days · 9 hours");

  // ── 2. The invariant, on a sweep ─────────────────────────────────────────
  // Every day of a month, at four hours, as an opening; then every day of the
  // same month, at four hours, as a deadline. 15 376 windows, and not one of
  // them may come back with a deadline at or before its opening.
  let swept = 0;
  const days = Array.from({ length: 31 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
  const hours = ["00:00", "08:00", "14:30", "23:59"];
  for (const openDay of days) {
    for (const openTime of hours) {
      let w = setOpens(initialWindow(noon), at(openDay, openTime));
      expectTrue(`opening ${openDay} ${openTime} keeps a reachable deadline`, stampOf(w.due) > stampOf(w.opens));
      for (const dueDay of days) {
        for (const dueTime of hours) {
          const moved = setDueTime(setDueDay(w, dueDay), dueTime);
          swept += 1;
          if (stampOf(moved.due) <= stampOf(moved.opens)) {
            failures.push(
              `deadline landed before its opening: opens ${openDay} ${openTime}, ` +
                `asked ${dueDay} ${dueTime}, got ${moved.due.day} ${moved.due.time}`,
            );
          }
          // A refused move must leave the window it was given, never a third one.
          if (!dueDayAllowed(dueDay, moved.opens)) {
            expect(`refused day ${dueDay} leaves the deadline alone`, setDueDay(w, dueDay).due, w.due);
          }
          w = moved;
        }
      }
    }
  }
  if (swept !== 15376) failures.push(`the sweep covered ${swept} windows, expected 15376`);

  // ── 3. Moving the opening ────────────────────────────────────────────────
  const week = { opens: at("2026-09-10", "08:00"), due: at("2026-09-18", "23:59") };
  expect(
    "a reachable deadline does not move with the opening",
    setOpens(week, at("2026-09-14", "08:00")).due,
    at("2026-09-18", "23:59"),
  );
  const short = { opens: at("2026-09-10", "08:00"), due: at("2026-09-12", "23:59") };
  const pushed = setOpens(short, at("2026-09-20", "08:00"));
  expectTrue("an unreachable deadline is pushed past the opening", stampOf(pushed.due) > stampOf(pushed.opens));
  expect("and it keeps the window it had", span(pushed), span(short));

  // ── 4. The deadline, on the opening day ──────────────────────────────────
  const sameDay = setDueDay({ opens: at("2026-09-10", "14:00"), due: at("2026-09-17", "09:00") }, "2026-09-10");
  expect("a deadline on the opening day snaps to the end of it", sameDay.due, at("2026-09-10", "23:59"));
  expect("and it reads in hours and minutes", spanLabel(span(sameDay)), "9 hours · 59 minutes");
  expect(
    "an hour that still says something is kept",
    setDueDay({ opens: at("2026-09-10", "08:00"), due: at("2026-09-17", "17:00") }, "2026-09-10").due,
    at("2026-09-10", "17:00"),
  );

  // ── 5. A day that holds no deadline at all ───────────────────────────────
  const lastMinute = { opens: at("2026-09-10", "23:59"), due: at("2026-09-11", "23:59") };
  expect("the opening's own last minute holds no deadline", dueDayAllowed("2026-09-10", lastMinute.opens), false);
  expect("the day after does", dueDayAllowed("2026-09-11", lastMinute.opens), true);
  expect("a day before the opening never does", dueDayAllowed("2026-09-09", lastMinute.opens), false);
  expect("and choosing it changes nothing", setDueDay(lastMinute, "2026-09-10"), lastMinute);

  // ── 6. The hours the selector greys out ──────────────────────────────────
  const tight = { opens: at("2026-09-10", "14:30"), due: at("2026-09-10", "23:59") };
  expect("an hour before the opening is blocked", dueTimeBlocked(tight, 13), true);
  expect("the opening's own hour is not, its minutes are", dueTimeBlocked(tight, 14), false);
  expect("a minute at the opening is blocked", dueTimeBlocked(tight, 14, 30), true);
  expect("the minute after is not", dueTimeBlocked(tight, 14, 31), false);
  expect("an hour after the opening is not", dueTimeBlocked(tight, 15), false);
  const nextDay = { opens: at("2026-09-10", "14:30"), due: at("2026-09-11", "08:00") };
  expect("nothing is blocked once the deadline is on another day", dueTimeBlocked(nextDay, 0, 0), false);

  // ── 7. Opening in the past is opening now ────────────────────────────────
  expect("yesterday cannot be an opening", opensDayAllowed("2026-09-09", "2026-09-10"), false);
  expect("today can", opensDayAllowed("2026-09-10", "2026-09-10"), true);
  expect("tomorrow can", opensDayAllowed("2026-09-11", "2026-09-10"), true);

  // ── 8. Out to the exercise contract ──────────────────────────────────────
  const immediate = windowContract({ opens: at("2026-09-10", "14:00"), due: at("2026-09-17", "23:59") }, noon);
  expect("an opening already passed is running", immediate.scheduled, false);
  expect("and carries no opening delay", immediate.opensInHours, undefined);
  expect("its deadline is counted from now", immediate.dueInHours, 177); // 14:32 to 23:59, seven days on
  expect("its window is counted from the opening", immediate.openedForHours, 178);

  const later = windowContract({ opens: at("2026-09-14", "08:00"), due: at("2026-09-18", "23:59") }, noon);
  expect("an opening still ahead is scheduled", later.scheduled, true);
  expect("and carries the hours until it opens", later.opensInHours, hoursBetween(noon, stampOf(at("2026-09-14", "08:00"))));
  expectTrue("a scheduled deadline is further off than its own window", later.dueInHours > later.openedForHours);

  const minutes = windowContract({ opens: at("2026-09-10", "14:00"), due: at("2026-09-10", "14:10") }, noon);
  expect("a ten-minute window still declares an hour, never zero", minutes.openedForHours, 1);

  // ── 9. Reading a duration out loud ───────────────────────────────────────
  expect("seven whole days say only days", spanLabel(7 * 1440), "7 days");
  expect("singulars are singular", spanLabel(1440 + 60), "1 day · 1 hour");
  expect("under a day, minutes are said", spanLabel(90), "1 hour · 30 minutes");
  expect("under an hour, only minutes", spanLabel(45), "45 minutes");
  expect("minutes are noise next to days", spanLabel(7 * 1440 + 10 * 60 + 27), "7 days · 10 hours");
  expect("an empty window says so", spanLabel(0), "no time at all");

  // ── 10. The wall clock survives a daylight saving change ─────────────────
  // 2026-10-25 and 2026-03-29 are the last Sundays of their months, so the
  // weeks that straddle them are 169 and 167 hours long. Same wall clock either
  // way, which is the point: the teacher said 08:00, they get 08:00.
  //
  // THE HOUR HAS TO BE NEAR MIDNIGHT for this to prove anything. An instant
  // implementation ('+ days * 86_400_000') lands an hour off, and an hour off
  // at 08:00 is still the right DAY, so a mid-morning case passes under both.
  // That mutation went undetected until this test was written the other way.
  const week169 = shiftDays(at("2026-10-22", "00:30"), 7);
  expect("a week across the autumn change keeps the day and the hour", week169, at("2026-10-29", "00:30"));
  const week167 = shiftDays(at("2026-03-25", "23:30"), 7);
  expect("and so does a week across the spring change", week167, at("2026-04-01", "23:30"));
  expect(
    "which really is 169 hours in autumn",
    hoursBetween(stampOf(at("2026-10-22", "00:30")), stampOf(week169)),
    169,
  );
  expect(
    "and 167 in spring",
    hoursBetween(stampOf(at("2026-03-25", "23:30")), stampOf(week167)),
    167,
  );
  expect(
    "against 168 on an ordinary week",
    hoursBetween(stampOf(at("2026-09-10", "00:30")), stampOf(shiftDays(at("2026-09-10", "00:30"), 7))),
    168,
  );

  // ── 11. The grid ────────────────────────────────────────────────────────
  for (const [year, month, first, count] of [
    [2026, 8, "2026-08-31", 30], // September 2026 starts on a Tuesday
    [2026, 5, "2026-06-01", 30], // June 2026 starts on a Monday, no lead at all
    [2026, 1, "2026-01-26", 28], // February 2026, the shortest month
  ]) {
    const grid = monthGrid(year, month);
    expect(`the grid of ${year}-${month + 1} is always six weeks`, grid.length, 42);
    expect(`it starts on a Monday (${first})`, grid[0].day, first);
    expect(`it holds the whole month`, grid.filter((c) => c.inMonth).length, count);
  }

  // ── 12. Shortcuts write precise values, and nothing else ─────────────────
  const shortcut = (list, label) => list.find((s) => s.label === label);
  expect(
    "tomorrow morning is a day and an hour",
    shortcut(OPENS_SHORTCUTS, "Tomorrow morning").resolve(start, noon),
    at("2026-09-11", "08:00"),
  );
  expect(
    "next Monday from a Thursday",
    shortcut(OPENS_SHORTCUTS, "Next Monday").resolve(start, noon),
    at("2026-09-14", "08:00"),
  );
  expect(
    "next Monday said on a Monday is the one after",
    shortcut(OPENS_SHORTCUTS, "Next Monday").resolve(start, stampOf(at("2026-09-14", "10:00"))),
    at("2026-09-21", "08:00"),
  );
  expect(
    "one week counts from the opening and not from now",
    shortcut(DUE_SHORTCUTS, "In one week").resolve(week, noon),
    at("2026-09-17", "23:59"),
  );
  for (const s of DUE_SHORTCUTS) {
    const resolved = s.resolve(week, noon);
    const applied = setDueDay({ ...week, due: resolved }, resolved.day);
    expectTrue(`"${s.label}" never breaks the invariant`, stampOf(applied.due) > stampOf(applied.opens));
  }

  // ── 13. What the teacher reads under the field ───────────────────────────
  expect("a resolved moment is spelt in full", spellMoment(at("2026-09-17", "23:59"), 2026), "Thursday 17 September at 23:59");
  expect("another year is named", spellMoment(at("2027-01-04", "08:00"), 2026), "Monday 4 January 2027 at 08:00");
  expect("withDay keeps the hour", withDay(at("2026-09-10", "08:00"), "2026-09-12"), at("2026-09-12", "08:00"));
  expect("withTime keeps the day", withTime(at("2026-09-10", "08:00"), "23:59"), at("2026-09-10", "23:59"));
} catch (error) {
  failures.push(
    `could not import ${WHEN} to self-test the window arithmetic: ${error.message}. ` +
      `The module must stay free of runtime imports so Node can strip its types.`,
  );
}

if (failures.length > 0) {
  console.error("check:when-window FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  "check:when-window OK : 15 376 windows swept without a deadline landing before its opening, " +
    "a reachable deadline held still while the opening moved, an unreachable one pushed with its " +
    "length kept, the opening day snapped to 23:59, the greyed hours, the exercise contract, the " +
    "duration wording, both Paris daylight saving changes on a wall clock near midnight, three month "
    + "grids and the shortcuts.",
);
