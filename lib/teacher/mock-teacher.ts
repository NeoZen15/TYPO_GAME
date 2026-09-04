// ---------------------------------------------------------------------------
// Teacher space — typed mock.
//
// Same move the profile made: every screen is built against a typed mock first,
// and the source is swapped later without the pages moving (see
// lib/profile/mock-profile.ts, whose types the whole profile still consumes and
// whose MOCK_ARENA still runs in production today).
//
// THE RULE THIS FILE MUST NEVER BREAK. Everything a teacher reads is derived
// from the exercises THEY assigned. Never from free training, never from a
// student's global mastery, never from their personal pool, and never an
// aggregate of those. That is the frozen product vision, and it is also the
// selling point: a student can train without being watched.
//
// So there is no `masteryLevel` on a student here, and there never will be.
// What exists is `recognised` / `resisting` / `confusions`, all three scoped to
// what the teacher's own exercises revealed.
// ---------------------------------------------------------------------------

import { dueLabel } from "@/lib/teacher/teacher-time";

/**
 * A typeface family the product can actually paint: the slug is the manifest
 * slug, so `JDT__<slug>` is a face the browser really loads.
 */
export type Family = { slug: string; name: string };

/** Read by the clock, not stored: what the countdown says about an exercise. */
export type ExerciseState = "scheduled" | "running" | "done";

export type TeacherClass = {
  id: string;
  name: string;
  /** The year and course this group belongs to. Shown on the class page so a
      teacher with four groups of the same year can tell them apart at a glance. */
  level: string;
  studentCount: number;
  /**
   * What a student types once to join. The joining flow itself is parked, and
   * NOTHING DISPLAYS THIS YET — it belongs to the class page.
   */
  joinCode: string;
  archived: boolean;
  /** See ClassConfusion: stated, not derived, and only where exercises closed. */
  confusions: ClassConfusion[];
};

/**
 * Someone in a class. Nothing but an identity: a student's mastery, pool and
 * personal training are unreadable by a teacher, so they cannot live here even
 * as a field. What a teacher sees about a person is computed from the exercises
 * that teacher gave, and from nothing else.
 */
export type TeacherStudent = {
  id: string;
  classId: string;
  name: string;
};

/**
 * A class's activity line, DERIVED and never stored.
 *
 * It used to be a hand-written string on each class ("yesterday", "2 weeks
 * ago"), which drifted the moment an exercise moved: one class read "2 weeks
 * ago" while its only exercise had closed a month before. A teacher only ever
 * sees what their own exercises produced, so the exercises ARE the activity,
 * and anything else would be a second version of the truth.
 */
export function classActivityLabel(classId: string, exercises: TeacherExercise[]): string {
  const mine = exercises.filter((e) => e.classId === classId);
  if (mine.length === 0) return "no exercise yet";

  // When something is running, the useful time is when it closes. Saying
  // "running now" here only repeated the badge sitting next to it, and a column
  // that repeats its neighbour is a column carrying nothing.
  const running = mine
    .filter((e) => e.state === "running")
    .sort((a, b) => a.dueInHours - b.dueInHours)[0];
  if (running) return dueLabel(running.dueInHours);

  const closed = mine.filter((e) => e.state === "done").sort((a, b) => b.dueInHours - a.dueInHours)[0];
  if (!closed) return "waiting to open";
  const past = Math.abs(closed.dueInHours);
  if (past < 48) return "closed yesterday";
  if (past < 14 * 24) return `${Math.round(past / 24)} days ago`;
  return `${Math.round(past / (24 * 7))} weeks ago`;
}

export type TeacherExercise = {
  id: string;
  title: string;
  /**
   * How it is played. The site already has one colour per mode and uses them
   * everywhere a mode appears (the picker, the rules pages, the profile's
   * session chips), so carrying the mode is what lets this space take the same
   * colours for the same meaning instead of inventing a palette of its own.
   */
  mode: "training" | "competition";
  classId: string;
  className: string;
  state: ExerciseState;
  /**
   * Hours until the due date. Negative once it has passed.
   *
   * A NUMBER AND NOT A DATE, on purpose, and only while this is a mock: a
   * countdown computed from Date.now() renders one string on the server and
   * another at hydration the moment it crosses a boundary. With real data the
   * server sends an ISO date and the live countdown is computed client-side
   * after mount. Nothing else in this file changes.
   */
  dueInHours: number;
  /** How long the exercise itself takes. NEVER the same thing as the due date:
      one says until when, the other says how long. Two words in the UI. */
  questionCount: number;
  assigned: number;
  started: number;
  finished: number;
  /** Scheduled only: hours until it opens. A scheduled exercise's useful time
      is when it starts, not when it ends. */
  opensInHours?: number;
  /**
   * How long the window is, from the moment it went out to its deadline.
   *
   * WITHOUT THIS, NOTHING IS COMPARABLE. "Half the class has finished" says
   * nothing until you know whether half the time has gone or nine tenths of it.
   * The real product will store a date; this is the same fact as a length, and
   * it is what lets a three-day exercise for 22 students sit next to a
   * two-week one for 31 and still mean something.
   */
  openedForHours: number;
  /** Done only: share of right answers across everyone who played it. The one
      number worth carrying in a list; everything else belongs to its page. */
  successPct?: number;
  /**
   * What the exercise asked about.
   *
   * SLUGS FROM THE FONT MANIFEST, not names picked for flavour. The teacher
   * space shows real specimens now, and a specimen composed in a family the
   * product cannot serve is a letterform invented by the browser — the exact
   * fault the project already caught once on the typeface pages. If it is
   * named here, `public/fonts` can serve it.
   */
  typefaces: Family[];
};

/**
 * A pair the class keeps mixing up, on the exercises this teacher gave.
 *
 * THE ONE THING THE MOCK STATES RATHER THAN DERIVES. Everything else on a class
 * page is computed from the exercises and the roster; a confusion needs the
 * answer chosen next to the answer expected, which no mock row carries. The
 * real engine already logs it (the fact table holds the chosen distractor), so
 * this is a shape waiting for a query, not a number waiting for an invention.
 */
export type ClassConfusion = {
  seen: Family;
  chosen: Family;
  times: number;
};

/** A sentence the teacher should read, with the reason and the way out. */
export type TeacherSignal = {
  id: string;
  /** The claim, in plain words. */
  headline: string;
  /** Why we are saying it. Never a signal without its evidence. */
  because: string;
  actionLabel: string;
  classId: string;
};

export type TeacherProfile = {
  name: string;
  classes: TeacherClass[];
  exercises: TeacherExercise[];
  signals: TeacherSignal[];
};

export const MOCK_TEACHER: TeacherProfile = {
  name: "Marion",
  classes: [
    {
      id: "c1", name: "DSAA 1 · Group A", level: "DSAA Design graphique · 1re année", studentCount: 24, joinCode: "KLM4TR", archived: false,
      confusions: [
        { seen: { slug: "montserrat", name: "Montserrat" }, chosen: { slug: "poppins", name: "Poppins" }, times: 9 },
        { seen: { slug: "lato", name: "Lato" }, chosen: { slug: "open_sans", name: "Open Sans" }, times: 5 },
      ],
    },
    {
      id: "c2", name: "DSAA 1 · Group B", level: "DSAA Design graphique · 1re année", studentCount: 22, joinCode: "PQ8VDS", archived: false,
      confusions: [
        { seen: { slug: "libre_baskerville", name: "Libre Baskerville" }, chosen: { slug: "playfair_display", name: "Playfair Display" }, times: 14 },
        { seen: { slug: "merriweather", name: "Merriweather" }, chosen: { slug: "pt_serif", name: "PT Serif" }, times: 6 },
      ],
    },
    {
      id: "c3", name: "BTS 2 · Type & Image", level: "BTS Design graphique · 2e année", studentCount: 31, joinCode: "ZR2NHW", archived: false,
      confusions: [
        { seen: { slug: "playfair_display", name: "Playfair Display" }, chosen: { slug: "abril_fatface", name: "Abril Fatface" }, times: 7 },
      ],
    },
    {
      id: "c4", name: "BTS 1 · Foundation", level: "BTS Design graphique · 1re année", studentCount: 28, joinCode: "XT7BQL", archived: false,
      confusions: [
        { seen: { slug: "roboto", name: "Roboto" }, chosen: { slug: "inter", name: "Inter" }, times: 11 },
      ],
    },
    { id: "c5", name: "DSAA 2 · 2025 intake", level: "DSAA Design graphique · 2e année", studentCount: 19, joinCode: "MM3KDP", archived: true, confusions: [] },
  ],
  exercises: [
    {
      id: "e1", title: "Humanist vs geometric sans", mode: "training", openedForHours: 168, classId: "c1", className: "DSAA 1 · Group A",
      state: "running", dueInHours: 9, questionCount: 20, assigned: 24, started: 11, finished: 7,
      typefaces: [{ slug: "lato", name: "Lato" }, { slug: "open_sans", name: "Open Sans" }, { slug: "montserrat", name: "Montserrat" }, { slug: "poppins", name: "Poppins" }]
    },
    {
      id: "e2", title: "Transitional serifs, second pass", mode: "training", openedForHours: 96, classId: "c3", className: "BTS 2 · Type & Image",
      state: "running", dueInHours: 38, questionCount: 15, assigned: 31, started: 26, finished: 19,
      typefaces: [{ slug: "libre_baskerville", name: "Libre Baskerville" }, { slug: "pt_serif", name: "PT Serif" }, { slug: "merriweather", name: "Merriweather" }]
    },
    {
      id: "e3", title: "Reading the terminals", mode: "training", openedForHours: 240, classId: "c2", className: "DSAA 1 · Group B",
      state: "running", dueInHours: 96, questionCount: 25, assigned: 22, started: 4, finished: 1,
      typefaces: [{ slug: "roboto", name: "Roboto" }, { slug: "inter", name: "Inter" }, { slug: "ibm_plex_sans", name: "IBM Plex Sans" }, { slug: "source_sans_3", name: "Source Sans 3" }]
    },
    {
      id: "e4", title: "Mid-term check", mode: "competition", openedForHours: 168, classId: "c3", className: "BTS 2 · Type & Image",
      state: "scheduled", dueInHours: 240, opensInHours: 96, questionCount: 30, assigned: 31, started: 0, finished: 0,
      typefaces: [{ slug: "libre_baskerville", name: "Libre Baskerville" }, { slug: "playfair_display", name: "Playfair Display" }, { slug: "merriweather", name: "Merriweather" }, { slug: "pt_serif", name: "PT Serif" }, { slug: "abril_fatface", name: "Abril Fatface" }]
    },
    {
      id: "e9", title: "Slab serifs, warm-up", mode: "training", openedForHours: 120, classId: "c2", className: "DSAA 1 · Group B",
      state: "scheduled", dueInHours: 180, opensInHours: 12, questionCount: 15, assigned: 22, started: 0, finished: 0,
      typefaces: [{ slug: "pt_serif", name: "PT Serif" }, { slug: "merriweather", name: "Merriweather" }, { slug: "roboto_mono", name: "Roboto Mono" }]
    },
    {
      id: "e5", title: "Grotesques, first look", mode: "training", openedForHours: 240, classId: "c1", className: "DSAA 1 · Group A",
      state: "done", dueInHours: -52, questionCount: 20, assigned: 24, started: 24, finished: 22, successPct: 71,
      typefaces: [{ slug: "roboto", name: "Roboto" }, { slug: "inter", name: "Inter" }, { slug: "work_sans", name: "Work Sans" }, { slug: "source_sans_3", name: "Source Sans 3" }]
    },
    {
      id: "e6", title: "Old-style figures", mode: "training", openedForHours: 168, classId: "c3", className: "BTS 2 · Type & Image",
      state: "done", dueInHours: -190, questionCount: 15, assigned: 31, started: 30, finished: 28, successPct: 84,
      typefaces: [{ slug: "libre_baskerville", name: "Libre Baskerville" }, { slug: "pt_serif", name: "PT Serif" }, { slug: "merriweather", name: "Merriweather" }]
    },
    {
      id: "e7", title: "Baskerville family, close reading", mode: "training", openedForHours: 240, classId: "c2", className: "DSAA 1 · Group B",
      state: "done", dueInHours: -340, questionCount: 25, assigned: 22, started: 20, finished: 16, successPct: 58,
      typefaces: [{ slug: "libre_baskerville", name: "Libre Baskerville" }, { slug: "playfair_display", name: "Playfair Display" }, { slug: "merriweather", name: "Merriweather" }, { slug: "abril_fatface", name: "Abril Fatface" }]
    },
    // A term's worth of closed exercises, so a class has a HISTORY and not a
    // single point. One closed exercise cannot show a class moving, and the
    // whole reading of a class page is movement: three or four of them is what
    // a term actually looks like.
    {
      id: "e10", title: "Reading the axis", mode: "competition", openedForHours: 168, classId: "c1", className: "DSAA 1 · Group A",
      state: "done", dueInHours: -220, questionCount: 18, assigned: 24, started: 23, finished: 20, successPct: 64,
      typefaces: [{ slug: "playfair_display", name: "Playfair Display" }, { slug: "abril_fatface", name: "Abril Fatface" }, { slug: "libre_baskerville", name: "Libre Baskerville" }],
    },
    {
      id: "e11", title: "Sans by proportion", mode: "training", openedForHours: 168, classId: "c1", className: "DSAA 1 · Group A",
      state: "done", dueInHours: -420, questionCount: 20, assigned: 24, started: 22, finished: 18, successPct: 58,
      typefaces: [{ slug: "montserrat", name: "Montserrat" }, { slug: "poppins", name: "Poppins" }, { slug: "work_sans", name: "Work Sans" }],
    },
    {
      id: "e12", title: "First contact", mode: "training", openedForHours: 120, classId: "c1", className: "DSAA 1 · Group A",
      state: "done", dueInHours: -640, questionCount: 12, assigned: 24, started: 24, finished: 23, successPct: 52,
      typefaces: [{ slug: "roboto", name: "Roboto" }, { slug: "open_sans", name: "Open Sans" }, { slug: "montserrat", name: "Montserrat" }],
    },
    {
      id: "e13", title: "Serif or sans", mode: "training", openedForHours: 240, classId: "c2", className: "DSAA 1 · Group B",
      state: "done", dueInHours: -560, questionCount: 20, assigned: 22, started: 21, finished: 19, successPct: 66,
      typefaces: [{ slug: "pt_serif", name: "PT Serif" }, { slug: "work_sans", name: "Work Sans" }, { slug: "bebas_neue", name: "Bebas Neue" }],
    },
    {
      id: "e14", title: "First contact", mode: "training", openedForHours: 120, classId: "c2", className: "DSAA 1 · Group B",
      state: "done", dueInHours: -760, questionCount: 12, assigned: 22, started: 22, finished: 21, successPct: 61,
      typefaces: [{ slug: "roboto", name: "Roboto" }, { slug: "lato", name: "Lato" }, { slug: "montserrat", name: "Montserrat" }],
    },
    {
      id: "e15", title: "Contrast and stress", mode: "competition", openedForHours: 240, classId: "c3", className: "BTS 2 · Type & Image",
      state: "done", dueInHours: -400, questionCount: 20, assigned: 31, started: 30, finished: 27, successPct: 76,
      typefaces: [{ slug: "playfair_display", name: "Playfair Display" }, { slug: "abril_fatface", name: "Abril Fatface" }, { slug: "libre_baskerville", name: "Libre Baskerville" }],
    },
    {
      id: "e16", title: "Opening term test", mode: "competition", openedForHours: 336, classId: "c3", className: "BTS 2 · Type & Image",
      state: "done", dueInHours: -620, questionCount: 25, assigned: 31, started: 31, finished: 29, successPct: 68,
      typefaces: [{ slug: "roboto", name: "Roboto" }, { slug: "lato", name: "Lato" }, { slug: "montserrat", name: "Montserrat" }, { slug: "playfair_display", name: "Playfair Display" }],
    },
    {
      id: "e17", title: "Warm up", mode: "training", openedForHours: 96, classId: "c4", className: "BTS 1 · Foundation",
      state: "done", dueInHours: -900, questionCount: 10, assigned: 28, started: 26, finished: 25, successPct: 74,
      typefaces: [{ slug: "roboto", name: "Roboto" }, { slug: "montserrat", name: "Montserrat" }],
    },
    {
      id: "e8", title: "First week, anything goes", mode: "training", openedForHours: 120, classId: "c4", className: "BTS 1 · Foundation",
      state: "done", dueInHours: -720, questionCount: 10, assigned: 28, started: 27, finished: 27, successPct: 79,
      typefaces: [{ slug: "roboto", name: "Roboto" }, { slug: "montserrat", name: "Montserrat" }, { slug: "pt_serif", name: "PT Serif" }]
    },
  ],
  signals: [
    // EVERY SIGNAL IS BACKED BY A ROW ABOVE, and the numbers in `because` are
    // read off that row. Two earlier ones were not: one claimed a pair missed
    // "in your last 3 exercises" for a class that has one finished exercise,
    // the other claimed a rise "from 61% three weeks ago" that exists nowhere.
    // A signal whose evidence cannot be checked is worse than no signal.
    {
      id: "s1",
      headline: "Half of Group A hasn't started, and it's due today.",
      because: "11 of 24 opened it · 9 hours left",
      actionLabel: "Nudge the class",
      classId: "c1",
    },
    {
      id: "s2",
      headline: "Group B came out lowest on the Baskerville family.",
      because: "58% right · 16 of 22 finished it",
      actionLabel: "Build an exercise on it",
      classId: "c2",
    },
    {
      id: "s3",
      headline: "BTS 2 is clearing what you give them.",
      because: "84% right on old-style figures · 28 of 31 finished",
      actionLabel: "Give them something new",
      classId: "c3",
    },
  ],
};
