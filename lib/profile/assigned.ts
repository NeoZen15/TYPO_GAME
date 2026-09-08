// The other side of the wall: what a teacher gave ME.
//
// The product's frozen promise is one-way, and this file is the return trip. A
// teacher reads only what their own exercises produced, never a student's free
// training. Symmetrically, a student must see what was assigned to them, with
// its deadline, because a deadline nobody is told about is not a deadline. That
// is the ONLY thing that crosses, in either direction.
//
// MOCK BRIDGE, AND DELIBERATELY A THIN ONE. There is no account system, so the
// profile is treated as one specific person in one specific class: roster index
// 14 of DSAA 1 · Group A. It is not a random pick, it is the useful case, and it
// is also the honest one: on the teacher's side that same person reads "has not
// opened it" on the exercise that closes today, and has finished the four that
// closed before. Both sides of the product therefore tell the same story about
// the same human, which is the whole point of building them against one mock.
//
// The day there is a backend, this becomes one query (the assignments whose
// class is mine, with my own state on each) and no screen moves.

import { MOCK_TEACHER, type TeacherExercise } from "@/lib/teacher/mock-teacher";
import { rosterOf, scoreOn, standingOn, type Standing } from "@/lib/teacher/teacher-derive";

export const MY_CLASS_ID = "c1";
const MY_ROSTER_INDEX = 14;

export type Assignment = {
  exercise: TeacherExercise;
  className: string;
  /** Who set it. A devoir without a name on it is an alarm, not a message. */
  teacherName: string;
  standing: Standing;
  /** My result, and only once I have finished it. */
  mine: number | null;
};

const myClass = () => MOCK_TEACHER.classes.find((c) => c.id === MY_CLASS_ID) ?? null;

/** The name the roster gives me, kept so the two sides never disagree. */
export function myRosterName(): string | null {
  const cls = myClass();
  if (!cls) return null;
  return rosterOf(cls)[MY_ROSTER_INDEX]?.name ?? null;
}

function assignmentOf(exercise: TeacherExercise, className: string): Assignment {
  return {
    exercise,
    className,
    teacherName: MOCK_TEACHER.name,
    standing: standingOn(MY_ROSTER_INDEX, exercise),
    mine: scoreOn(MY_ROSTER_INDEX, exercise),
  };
}

/** Open right now, and mine to do. Soonest deadline first. */
export function myOpenAssignments(): Assignment[] {
  const cls = myClass();
  if (!cls) return [];
  return MOCK_TEACHER.exercises
    .filter((e) => e.classId === cls.id && e.state === "running")
    .sort((a, b) => a.dueInHours - b.dueInHours)
    .map((e) => assignmentOf(e, cls.name));
}

/** Not open yet, so nothing to do about it except know it is coming. */
export function myNextAssignments(): Assignment[] {
  const cls = myClass();
  if (!cls) return [];
  return MOCK_TEACHER.exercises
    .filter((e) => e.classId === cls.id && e.state === "scheduled")
    .sort((a, b) => (a.opensInHours ?? 0) - (b.opensInHours ?? 0))
    .map((e) => assignmentOf(e, cls.name));
}
