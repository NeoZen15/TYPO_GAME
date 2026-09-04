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

/** DERIVED. One line per person, from the exercises this teacher gave. */
export function studentRows(cls: TeacherClass, exercises: TeacherExercise[]): ClassStudent[] {
  const roster = rosterOf(cls);
  const closed = closedOfClass(cls.id, exercises);
  const open = exercisesOfClass(cls.id, exercises).find((e) => e.state === "running");

  return roster.map((s, i) => {
    // Roster order IS the order of finishing: the first `finished` people
    // finished, the next `started - finished` opened it, the rest have not.
    let done = 0;
    let sum = 0;
    for (const ex of closed) {
      if (i < ex.finished) {
        done += 1;
        const offsets = spread(ex.finished, 16);
        sum += clamp((ex.successPct ?? 0) + offsets[i]);
      }
    }
    const live: ClassStudent["live"] = !open
      ? "nothing_open"
      : i < open.finished
        ? "finished"
        : i < open.started
          ? "started"
          : "not_started";
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

export function paceOfOpen(exercises: TeacherExercise[]): Pace[] {
  return exercises
    .filter((e) => e.state === "running")
    .map((e) => {
      const donePct = e.assigned === 0 ? 0 : Math.round((e.finished / e.assigned) * 100);
      const elapsed = e.openedForHours - e.dueInHours;
      const elapsedPct = Math.max(
        0,
        Math.min(100, Math.round((elapsed / Math.max(1, e.openedForHours)) * 100)),
      );
      return { exercise: e, donePct, elapsedPct, gap: donePct - elapsedPct };
    })
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
