// The time vocabulary of the teacher space. One file, because three screens
// were about to say the same thing three ways.
//
// TeacherHome and TeacherExercises had each declared their own `dueLabel` and
// `urgencyOf`, identical today and free to drift tomorrow — which is exactly
// how the profile ended up with a "variant" of its own stats board (see the
// header of features/profile/components/board-system.ts). A teacher reading
// "9 h left" on one page and "9 hours remaining" on the next has no way to know
// it is the same fact.
//
// Two DIFFERENT durations live here and must never be confused: the deadline
// (until when) and the length of the exercise itself (how long), which is a
// question count and is never phrased in time at all.

import type { TeacherExercise } from "@/lib/teacher/mock-teacher";

/**
 * How pressing something is. Cream only, no hue: red already means "wrong
 * answer" in the game and green means "correct", so pressure is said with
 * contour strength and ink weight. Placeholder until the owner decides how
 * urgency should look.
 */
export type Urgency = "calm" | "soon" | "now" | "past";

export function urgencyOf(hours: number): Urgency {
  if (hours < 0) return "past";
  if (hours < 12) return "now";
  if (hours < 48) return "soon";
  return "calm";
}

/** The DEADLINE: until when a student may still do it. */
export function dueLabel(hours: number): string {
  if (hours < 0) return "closed";
  if (hours < 1) return "under an hour";
  if (hours < 24) return `${Math.round(hours)} h left`;
  if (hours < 48) return "tomorrow";
  return `${Math.round(hours / 24)} days left`;
}

/** When a scheduled one opens: the only time that matters before it starts. */
export function opensLabel(hours: number): string {
  if (hours <= 0) return "opening";
  if (hours < 24) return `opens in ${Math.round(hours)} h`;
  if (hours < 48) return "opens tomorrow";
  return `opens in ${Math.round(hours / 24)} days`;
}

/**
 * How LONG the window is, which is never the same fact as when it closes.
 * "Open for a week" and "9 h left" are both true of the same exercise, and the
 * space says them in different words on purpose.
 */
export function windowLabel(hours: number): string {
  if (hours < 48) return `${Math.round(hours)} hours`;
  const days = Math.round(hours / 24);
  if (days % 7 !== 0) return `${days} days`;
  const weeks = days / 7;
  return weeks === 1 ? "a week" : `${weeks} weeks`;
}

/** How long ago it closed. The same reading, pointing backwards. */
export function closedLabel(hours: number): string {
  const past = Math.abs(hours);
  if (past < 24) return `closed ${Math.round(past)} h ago`;
  if (past < 48) return "closed yesterday";
  if (past < 14 * 24) return `closed ${Math.round(past / 24)} days ago`;
  return `closed ${Math.round(past / (24 * 7))} weeks ago`;
}

/** Share of the class that has finished. Participation, never success. */
export function participation(ex: TeacherExercise): number {
  return ex.assigned === 0 ? 0 : Math.round((ex.finished / ex.assigned) * 100);
}
