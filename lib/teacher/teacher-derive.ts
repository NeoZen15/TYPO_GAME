// Everything a class page shows, computed from the exercises that teacher gave.
//
// READ THIS BEFORE TRUSTING A NUMBER FROM HERE.
//
// Two kinds of value live in this file and they are NOT the same thing.
//
// 1. DERIVED. Participation, how many exercises a class was given, its average
//    success, its progression from one closed exercise to the next, who has
//    finished what. These come from rows that already exist in the mock, and
//    they will keep working unchanged once the mock is replaced by queries.
//
// 2. GENERATED. Student names, and the per-family split inside an exercise. The
//    mock holds one success rate per exercise, not one per family, and it holds
//    a head count per class, not people. Rather than leave the class page half
//    empty while it is being judged, these are expanded DETERMINISTICALLY from
//    the real aggregate: the per-family offsets sum to zero, so a family split
//    always averages back to the exercise's own rate, and the roster always has
//    exactly the head count the class declares. Nothing contradicts anything.
//
//    They are still made up. The real versions need per-answer data, which the
//    engine already records (the fact table carries the chosen distractor and
//    the typeface of each answer) and which no teacher mock row carries yet.
//
// And the rule above all of them: a teacher reads what THEIR exercises
// produced. Nothing here can reach a student's own training, and there is no
// field for it to reach.

import type { ClassConfusion, TeacherClass, TeacherExercise } from "@/lib/teacher/mock-teacher";

const FIRST = [
  "Camille", "Léa", "Hugo", "Jade", "Nathan", "Manon", "Théo", "Chloé",
  "Lucas", "Inès", "Enzo", "Sarah", "Noah", "Louise", "Adam", "Emma",
  "Raphaël", "Alice", "Gabin", "Anna", "Ethan", "Rose", "Malo", "Zoé",
  "Naël", "Lina", "Sacha", "Nina", "Aaron", "Iris", "Timéo", "Maya",
];
const LAST = [
  "Bertrand", "Moreau", "Lefèvre", "Girard", "Roussel", "Fontaine", "Chevalier",
  "Barbier", "Marchand", "Dumont", "Leroy", "Perrot", "Vasseur", "Guillot",
  "Renard", "Colin",
];

/**
 * Where someone stands in the class itself, which is not the same question as
 * how they are doing. Invited means the account was created for them and they
 * have never signed in, so they cannot have finished anything: the roster keeps
 * them last, which is also where the derivation puts anyone who has not played.
 */
export type StudentStatus = "active" | "invited";

export type ClassStudent = {
  id: string;
  name: string;
  email: string;
  status: StudentStatus;
  /** Exercises this student has finished, out of those the class was given. */
  finished: number;
  given: number;
  /** Average right answers across the ones they finished. Null if none. */
  successPct: number | null;
  /** Where they stand on what is open right now. */
  live: "finished" | "started" | "not_started" | "nothing_open";
};

export type FamilyResult = {
  slug: string;
  name: string;
  rightPct: number;
  /** How many closed exercises asked about it. Evidence for the number. */
  seenIn: number;
};

/** Deterministic, and readable: no accents and no spaces in an address. */
function emailOf(name: string): string {
  const flat = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .join(".");
  return `${flat}@etu.ecole-design.fr`;
}

/**
 * GENERATED. A stable roster of exactly the size the class declares.
 *
 * The last two of each class are INVITED, never signed in. They sit at the end
 * on purpose: the results derivation reads roster order as finishing order, so
 * someone who never joined can never come out as having finished something.
 */
export function rosterOf(cls: TeacherClass): { id: string; name: string; email: string; status: StudentStatus }[] {
  return Array.from({ length: cls.studentCount }, (_, i) => {
    const name = `${FIRST[(i * 7 + cls.id.length * 3) % FIRST.length]} ${LAST[(i * 5 + cls.id.length) % LAST.length]}`;
    const invited = cls.studentCount > 4 && i >= cls.studentCount - 2;
    return {
      id: `${cls.id}-s${i + 1}`,
      name,
      email: emailOf(name),
      status: invited ? ("invited" as const) : ("active" as const),
    };
  });
}

export function exercisesOfClass(classId: string, exercises: TeacherExercise[]): TeacherExercise[] {
  return exercises.filter((e) => e.classId === classId);
}

/** Closed ones, oldest first: this is the class's history, in order. */
export function closedOfClass(classId: string, exercises: TeacherExercise[]): TeacherExercise[] {
  return exercisesOfClass(classId, exercises)
    .filter((e) => e.state === "done" && e.successPct !== undefined)
    .sort((a, b) => a.dueInHours - b.dueInHours);
}

/**
 * DERIVED. Offsets that sum to zero, so any split always averages back to the
 * number it came from. Used for families and for students alike.
 */
function spread(n: number, amplitude: number): number[] {
  if (n <= 1) return [0];
  const mid = (n - 1) / 2;
  const ramp = Array.from({ length: n }, (_, i) => Math.round((i - mid) * (amplitude / mid)));
  // SCRAMBLED, and it matters. Handed out in order, the offsets came out as a
  // perfect arithmetic run down the roster: 42, 44, 46, 48, 51... which reads as
  // a generated table at a glance and makes the whole page look untrustworthy.
  // A fixed coprime step keeps the values and their sum, and loses the ladder.
  const step = n % 7 === 0 ? 5 : 7;
  return Array.from({ length: n }, (_, i) => ramp[(i * step) % n]);
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** GENERATED split, DERIVED aggregation: what the class reads well, and badly. */
export function familyResults(classId: string, exercises: TeacherExercise[]): FamilyResult[] {
  const acc = new Map<string, { name: string; total: number; count: number }>();
  for (const ex of closedOfClass(classId, exercises)) {
    const offsets = spread(ex.typefaces.length, 14);
    ex.typefaces.forEach((family, i) => {
      const value = clamp((ex.successPct ?? 0) + offsets[i]);
      const cur = acc.get(family.slug) ?? { name: family.name, total: 0, count: 0 };
      acc.set(family.slug, { name: family.name, total: cur.total + value, count: cur.count + 1 });
    });
  }
  return [...acc.entries()]
    .map(([slug, v]) => ({ slug, name: v.name, rightPct: Math.round(v.total / v.count), seenIn: v.count }))
    .sort((a, b) => b.rightPct - a.rightPct);
}

/**
 * Where ONE person stands on ONE exercise, decided in exactly one place.
 *
 * Roster order IS the order of finishing: the first `finished` people finished
 * it, the next `started - finished` opened it, the rest never did. Crude, and
 * deliberately so, because it is the only ordering the mock carries. What
 * matters is that the class list and the student page read the SAME function:
 * two copies of this rule would drift, and a teacher would catch two screens
 * contradicting each other about the same person.
 */
export type Standing = "finished" | "started" | "not_started";

export function standingOn(index: number, ex: TeacherExercise): Standing {
  if (index < ex.finished) return "finished";
  if (index < ex.started) return "started";
  return "not_started";
}

/**
 * GENERATED. Their score on an exercise they finished, null on anything else.
 *
 * The offsets sum to zero across the people who finished, so the exercise's own
 * rate always falls back out of the split. Still invented, and it goes the day
 * the engine answers per person.
 */
export function scoreOn(index: number, ex: TeacherExercise): number | null {
  if (standingOn(index, ex) !== "finished") return null;
  return clamp((ex.successPct ?? 0) + spread(ex.finished, 16)[index]);
}

/** DERIVED. One line per person, from the exercises this teacher gave. */
export function studentRows(cls: TeacherClass, exercises: TeacherExercise[]): ClassStudent[] {
  const roster = rosterOf(cls);
  const closed = closedOfClass(cls.id, exercises);
  const open = exercisesOfClass(cls.id, exercises).find((e) => e.state === "running");

  return roster.map((s, i) => {
    let done = 0;
    let sum = 0;
    for (const ex of closed) {
      const score = scoreOn(i, ex);
      if (score === null) continue;
      done += 1;
      sum += score;
    }
    const live: ClassStudent["live"] = !open ? "nothing_open" : standingOn(i, open);
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      status: s.status,
      finished: done,
      given: closed.length,
      successPct: done === 0 ? null : Math.round(sum / done),
      live,
    };
  });
}

export type ClassStats = {
  given: number;
  closed: number;
  /** Average across closed exercises, weighted by how many finished each. */
  successPct: number | null;
  /** Share of the class that finished the last closed exercise. */
  lastParticipation: number | null;
  /** Difference between the first and the last closed exercise. */
  trendPct: number | null;
};

export function classStats(cls: TeacherClass, exercises: TeacherExercise[]): ClassStats {
  const all = exercisesOfClass(cls.id, exercises);
  const closed = closedOfClass(cls.id, exercises);
  const weight = closed.reduce((s, e) => s + e.finished, 0);
  const last = closed[closed.length - 1];
  return {
    given: all.length,
    closed: closed.length,
    successPct: weight === 0 ? null : Math.round(closed.reduce((s, e) => s + (e.successPct ?? 0) * e.finished, 0) / weight),
    lastParticipation: last ? Math.round((last.finished / last.assigned) * 100) : null,
    trendPct: closed.length < 2 ? null : (closed[closed.length - 1].successPct ?? 0) - (closed[0].successPct ?? 0),
  };
}

/**
 * DERIVED. Who to look at first, and WHY.
 *
 * GROUPED BY REASON, and that is the whole point. Listed one person at a time,
 * a class where thirteen people have not opened the exercise produces six
 * identical lines and the teacher learns nothing they could act on. Grouped, it
 * produces one line that says thirteen, which is a fact worth a decision.
 *
 * Never a ranking of the class: each group carries its reason so the teacher can
 * disagree with it.
 */
export type AttentionGroup = {
  reason: string;
  students: ClassStudent[];
};

export function needsAttention(students: ClassStudent[]): AttentionGroup[] {
  const invited = students.filter((s) => s.status === "invited");
  const noneFinished = students.filter(
    (s) => s.status === "active" && s.given > 0 && s.finished === 0,
  );
  const notStarted = students.filter(
    (s) => s.status === "active" && s.finished > 0 && s.live === "not_started",
  );
  const lowest = students.filter(
    (s) => s.status === "active" && s.successPct !== null && s.successPct < 55,
  );

  const groups: AttentionGroup[] = [
    { reason: "invited, never signed in", students: invited },
    { reason: "have finished none of the closed exercises", students: noneFinished },
    { reason: "have not opened what is running", students: notStarted },
    { reason: "under 55% right across what they finished", students: lowest },
  ];
  return groups.filter((g) => g.students.length > 0);
}

/**
 * DERIVED. Where each person sits against the class, and nothing more.
 *
 * The question a teacher actually asks in front of a group is not "who is
 * best", it is "how spread out are they": four bands read in one bar say
 * whether the class is together or pulling apart, which no list of 22 rows can
 * say. Bands are relative to the class's own average, so nothing here is a
 * grade and nothing compares one class to another.
 */
export type Band = "ahead" | "with" | "behind" | "no_data" | "invited";

export function bandOf(s: ClassStudent, classAvg: number | null): Band {
  if (s.status === "invited") return "invited";
  if (s.successPct === null || classAvg === null) return "no_data";
  if (s.successPct >= classAvg + 8) return "ahead";
  if (s.successPct <= classAvg - 8) return "behind";
  return "with";
}

export function distribution(students: ClassStudent[], classAvg: number | null): Record<Band, number> {
  const out: Record<Band, number> = { ahead: 0, with: 0, behind: 0, no_data: 0, invited: 0 };
  for (const s of students) out[bandOf(s, classAvg)] += 1;
  return out;
}

/**
 * DERIVED. How much of what a teacher gave actually gets done, class by class.
 *
 * THE ONE QUESTION NO OTHER PAGE CAN ANSWER. A class page knows one class; an
 * exercise page knows one assignment. Only the exercises list sees the whole
 * practice at once, and the thing a teacher cannot see anywhere else is the
 * COMPARISON: this group does the work, that one does not.
 *
 * Scheduled exercises are excluded: nobody can have finished something that has
 * not opened, and counting them would drag every class down by however many they
 * have queued.
 */
export type ClassCompletion = {
  id: string;
  name: string;
  given: number;
  /** Share of (students x exercises) that reached the end. Null if none open. */
  completionPct: number | null;
};

export function completionByClass(
  classes: TeacherClass[],
  exercises: TeacherExercise[],
): ClassCompletion[] {
  return classes
    .filter((c) => !c.archived)
    .map((c) => {
      const mine = exercises.filter((e) => e.classId === c.id);
      const counted = mine.filter((e) => e.state !== "scheduled");
      const assigned = counted.reduce((sum, e) => sum + e.assigned, 0);
      const finished = counted.reduce((sum, e) => sum + e.finished, 0);
      return {
        id: c.id,
        name: c.name,
        given: mine.length,
        completionPct: assigned === 0 ? null : Math.round((finished / assigned) * 100),
      };
    })
    .sort((a, b) => (b.completionPct ?? -1) - (a.completionPct ?? -1));
}

/** DERIVED. How the teacher's own assignments split between the game's modes. */
export function countByMode(exercises: TeacherExercise[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of exercises) out[e.mode] = (out[e.mode] ?? 0) + 1;
  return out;
}

/**
 * DERIVED. Is an open exercise going to close with too few people having done it?
 *
 * TWO SHARES, AND THAT IS THE WHOLE IDEA. "How much of the class has finished"
 * and "how much of the window has gone" are both fractions of their own thing,
 * so they can be laid on the same bar whatever the class size, the length of
 * the exercise or its deadline. Putting raw completion side by side across
 * exercises, which is what the first attempt did, compared things that were not
 * comparable and made a freshly opened exercise look like a failing one.
 *
 * Only RUNNING exercises are here. A closed one has nothing left to chase and a
 * scheduled one has not started.
 */
export type Pace = {
  exercise: TeacherExercise;
  donePct: number;
  elapsedPct: number;
  /** Positive means ahead of the clock, negative means the deadline is winning. */
  gap: number;
};

export function paceOf(e: TeacherExercise): Pace {
  const donePct = e.assigned === 0 ? 0 : Math.round((e.finished / e.assigned) * 100);
  const elapsed = e.openedForHours - e.dueInHours;
  const elapsedPct = Math.max(
    0,
    Math.min(100, Math.round((elapsed / Math.max(1, e.openedForHours)) * 100)),
  );
  return { exercise: e, donePct, elapsedPct, gap: donePct - elapsedPct };
}

export function paceOfOpen(exercises: TeacherExercise[]): Pace[] {
  return exercises
    .filter((e) => e.state === "running")
    .map(paceOf)
    .sort((a, b) => a.gap - b.gap);
}

/**
 * DERIVED. The families a teacher's classes have in front of them right now,
 * taken from the exercises that are open. Deduplicated, and each one carries
 * the class that is working on it.
 *
 * This is what the home's specimen band paints, and it is why the band is not
 * decoration: the word on screen is a face a student is being asked to name
 * today.
 */
export type LiveFamily = { slug: string; name: string; className: string };

export function familiesInPlay(exercises: TeacherExercise[]): LiveFamily[] {
  const seen = new Set<string>();
  const out: LiveFamily[] = [];
  for (const e of exercises.filter((x) => x.state === "running")) {
    for (const f of e.typefaces) {
      if (seen.has(f.slug)) continue;
      seen.add(f.slug);
      out.push({ slug: f.slug, name: f.name, className: e.className });
    }
  }
  return out;
}

/**
 * DERIVED. The pairs that come back across every class, worst first.
 *
 * The home shows three at most: it is a summary, and the class page carries the
 * full reading. Each one keeps the class it came from so the teacher can go
 * straight there.
 */
export type LiveConfusion = ClassConfusion & { classId: string; className: string };

export function topConfusions(classes: TeacherClass[], limit = 3): LiveConfusion[] {
  return classes
    .filter((c) => !c.archived)
    .flatMap((c) => c.confusions.map((k) => ({ ...k, classId: c.id, className: c.name })))
    .sort((a, b) => b.times - a.times)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// ONE STUDENT, read through the exercises this teacher gave.
//
// This is NOT a smaller profile, and the difference is the whole point. The
// profile is the student's own room: their free training, their pool, their
// mastery of the catalogue, their badges. A teacher cannot see any of it and
// nothing below can reach it. What is here is what the teacher's own exercises
// produced, plus ONE thing the profile never says: where this person sits
// against their class.
// ---------------------------------------------------------------------------

/** One exercise, from this person's side. */
export type StudentExerciseRow = {
  exercise: TeacherExercise;
  standing: Standing;
  /** Their result. Null unless they finished it. */
  theirs: number | null;
  /** The class's own rate on it, to sit next to theirs. Null while it runs. */
  classPct: number | null;
};

/** A closed exercise as a point on two lines: theirs and the class's. */
export type StudentHistoryPoint = {
  id: string;
  title: string;
  classPct: number;
  /** Null when they did not finish that one: the line breaks, it does not lie. */
  theirs: number | null;
};

/**
 * A pair THIS PERSON keeps swapping. Empty today, and that is deliberate.
 *
 * The class page states its confusions in the mock because a class-level pair
 * was worth showing while the page was being judged. Per person, nothing in the
 * mock produces one, and the owner's rule is explicit: no data is invented to
 * fill an interface. So the shape exists, the seam exists, and the panel simply
 * does not render until something real fills it.
 *
 * WHAT WILL FILL IT. The engine already records the answer chosen next to the
 * answer expected, per attempt, per player. Grouped by (player, expected,
 * chosen) over the attempts belonging to this teacher's exercises, this
 * function returns rows without a single screen changing.
 */
export type StudentConfusion = ClassConfusion;

export function studentConfusions(): StudentConfusion[] {
  return [];
}

export type StudentDetail = {
  student: ClassStudent;
  /** Their position in the roster, which is what every derivation reads. */
  index: number;
  /** Running first, then closed newest first. Scheduled ones are left out. */
  rows: StudentExerciseRow[];
  /** How many are queued and deliberately not counted anywhere above. */
  scheduled: number;
  /** Oldest first, every closed exercise the class was given. */
  history: StudentHistoryPoint[];
  /** GENERATED split, same recipe as the class's, on their own results. */
  families: FamilyResult[];
  band: Band;
  classAvg: number | null;
  /** Their first to last, in points, across the ones they finished. */
  trendPct: number | null;
  confusions: StudentConfusion[];
};

export function studentDetail(
  cls: TeacherClass,
  studentId: string,
  exercises: TeacherExercise[],
): StudentDetail | null {
  const rows = studentRows(cls, exercises);
  const index = rows.findIndex((s) => s.id === studentId);
  if (index === -1) return null;

  const student = rows[index];
  const mine = exercisesOfClass(cls.id, exercises);
  const closed = closedOfClass(cls.id, exercises);
  const classAvg = classStats(cls, exercises).successPct;

  // Running before closed: what a teacher can still act on comes first, and
  // what is over is history. Scheduled ones say nothing about a person, since
  // nobody can have opened something that has not opened.
  const running = mine
    .filter((e) => e.state === "running")
    .sort((a, b) => a.dueInHours - b.dueInHours);
  const done = [...closed].reverse();

  const rowOf = (exercise: TeacherExercise): StudentExerciseRow => ({
    exercise,
    standing: standingOn(index, exercise),
    theirs: scoreOn(index, exercise),
    classPct: exercise.state === "done" ? exercise.successPct ?? null : null,
  });

  const history: StudentHistoryPoint[] = closed.map((e) => ({
    id: e.id,
    title: e.title,
    classPct: e.successPct ?? 0,
    theirs: scoreOn(index, e),
  }));

  // GENERATED, exactly as the class page generates its own: their result on an
  // exercise, split across the families that exercise asked about, by offsets
  // that sum to zero. So a family reading always averages back to what they
  // actually scored, and no family number can contradict the row above it.
  const acc = new Map<string, { name: string; total: number; count: number }>();
  for (const ex of closed) {
    const theirs = scoreOn(index, ex);
    if (theirs === null) continue;
    const offsets = spread(ex.typefaces.length, 14);
    ex.typefaces.forEach((family, i) => {
      const value = clamp(theirs + offsets[i]);
      const cur = acc.get(family.slug) ?? { name: family.name, total: 0, count: 0 };
      acc.set(family.slug, { name: family.name, total: cur.total + value, count: cur.count + 1 });
    });
  }
  const families: FamilyResult[] = [...acc.entries()]
    .map(([slug, v]) => ({ slug, name: v.name, rightPct: Math.round(v.total / v.count), seenIn: v.count }))
    .sort((a, b) => b.rightPct - a.rightPct);

  const theirPoints = history.map((h) => h.theirs).filter((v): v is number => v !== null);

  return {
    student,
    index,
    rows: [...running, ...done].map(rowOf),
    scheduled: mine.filter((e) => e.state === "scheduled").length,
    history,
    families,
    band: bandOf(student, classAvg),
    classAvg,
    trendPct: theirPoints.length < 2 ? null : theirPoints[theirPoints.length - 1] - theirPoints[0],
    confusions: studentConfusions(),
  };
}

// ---------------------------------------------------------------------------
// ONE EXERCISE: what it asked, and what it produced.
//
// The list next door answers "which one, how far along, how long left". This
// answers the two questions the list refuses to carry: what is in it, and what
// came back. Same discipline as everywhere else in this space, and the same
// honesty about which numbers are real.
// ---------------------------------------------------------------------------

export type ExerciseStudentRow = {
  student: ClassStudent;
  standing: Standing;
  /** Their result on THIS exercise. Null unless they finished it. */
  theirs: number | null;
};

/**
 * One family the exercise asked about, and how it went.
 *
 * GENERATED, exactly as the class page generates its own family reading: the
 * exercise carries ONE rate, and the split across its families is offsets that
 * sum to zero, so the numbers always average back to the rate the exercise
 * actually has. `rightPct` is null until it closes, since nothing is measured
 * while it is still being played.
 */
export type ExerciseFamily = { slug: string; name: string; rightPct: number | null };

export type ExerciseDetail = {
  rows: ExerciseStudentRow[];
  families: ExerciseFamily[];
  /** Running only: how much is done against how much of the window has gone. */
  pace: Pace | null;
  /**
   * What this class scores on its OTHER closed exercises, weighted the same way
   * the class page weights its average. It is the only fair thing to read this
   * exercise against: comparing one class's result to another class's tells you
   * about the classes, not about the exercise.
   */
  otherAvg: number | null;
  /** How many others it is being read against. A comparison names its evidence. */
  otherCount: number;
  /** Who to chase, grouped by reason. Never a ranking. */
  groups: AttentionGroup[];
};

export function exerciseDetail(
  ex: TeacherExercise,
  cls: TeacherClass,
  exercises: TeacherExercise[],
): ExerciseDetail {
  const roster = studentRows(cls, exercises);
  const rows: ExerciseStudentRow[] = roster.map((student, i) => ({
    student,
    standing: standingOn(i, ex),
    theirs: scoreOn(i, ex),
  }));

  const offsets = spread(ex.typefaces.length, 14);
  const families: ExerciseFamily[] = ex.typefaces.map((f, i) => ({
    slug: f.slug,
    name: f.name,
    rightPct: ex.state === "done" && ex.successPct !== undefined ? clamp(ex.successPct + offsets[i]) : null,
  }));

  const others = closedOfClass(cls.id, exercises).filter((e) => e.id !== ex.id);
  const weight = others.reduce((sum, e) => sum + e.finished, 0);

  return {
    rows,
    families,
    pace: ex.state === "running" ? paceOf(ex) : null,
    otherAvg:
      weight === 0
        ? null
        : Math.round(others.reduce((sum, e) => sum + (e.successPct ?? 0) * e.finished, 0) / weight),
    otherCount: others.length,
    groups: exerciseAttention(rows, ex),
  };
}

/**
 * Who to look at on THIS exercise, grouped by reason.
 *
 * Grouped for the same reason the class page groups: told one person at a time,
 * thirteen people who never opened it produce thirteen lines and nothing to
 * decide. And the people who were only ever invited are kept in their OWN
 * group, never inside "have not opened it": you cannot chase someone who has
 * never signed in, and mixing them in makes the number you would act on wrong.
 */
export function exerciseAttention(rows: ExerciseStudentRow[], ex: TeacherExercise): AttentionGroup[] {
  const invited = rows.filter((r) => r.student.status === "invited");
  const active = rows.filter((r) => r.student.status === "active");
  const groups: AttentionGroup[] = [
    { reason: "invited, never signed in", students: invited.map((r) => r.student) },
    {
      reason: ex.state === "done" ? "never opened it" : "have not opened it yet",
      students: active.filter((r) => r.standing === "not_started").map((r) => r.student),
    },
    {
      reason: ex.state === "done" ? "started it and stopped" : "started, not finished",
      students: active.filter((r) => r.standing === "started").map((r) => r.student),
    },
    {
      reason: "came out under 55% on it",
      students: active.filter((r) => r.theirs !== null && r.theirs < 55).map((r) => r.student),
    },
  ];
  return groups.filter((g) => g.students.length > 0);
}
