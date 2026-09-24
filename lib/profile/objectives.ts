// The player's three objectives on the Path: Light, Fix, Daily mission.
//
// Spec: docs/product/spec-objectifs-joueur.md, sections 2 and 3. The map tells a
// player where they stand; these tell them what to do now, and each one carries
// a button that must keep its promise. So an objective only names a step or
// faces that a training session can actually serve.
//
// PURE, AND IT MUST STAY PURE. No runtime import at all, so Node can strip its
// types and scripts/quality/check-objectives.mjs can exercise it on invented
// profiles, like lib/game/assigned/contract.ts. The caller does the reading and
// hands over plain data: the paliers as buildEye computed them, the faces with
// the paliers they count toward, the confusion pairs, today's personal count.
//
// ITS SOURCES ARE PERSONAL ONLY (I-27). Nothing here reads a class, an
// assignment or a teacher. A player without a school gets exactly the same
// objectives, computed the same way.
//
// NEVER STORED. Computed on read, like the teacher's recommendations
// (spec-creation-exercice.md §4). Only the chosen focus travels to the session.

/** Same bars as lib/profile/profile-stats.ts: a step lights at 0.80 over 5 settled faces. */
const LIT_ACCURACY = 0.8;
const LIT_MASTERED = 5;

/** A focus can only steer toward what the active pool already holds. */
const MIN_FACES_IN_POOL = 5;

/** One slip is noise. A pair counts from its second confusion. */
const MIN_CONFUSIONS = 2;
/** Three pairs, so six faces at most: the cap on faces follows from this one. */
const MAX_PAIRS = 3;

/** Owner's default, project-onboarding-2026-07-30.md. Decision 1 of the spec. */
export const MISSION_TARGET_DEFAULT = 15;

export type PalierState = "dormant" | "emerging" | "lit";

export type ObjectivePalier = {
  id: string; // "2.6"
  label: string;
  state: PalierState;
  a: number; // accuracy 0..1
  mastered: number; // faces in box ≥ 4
};

export type ObjectiveFace = {
  slug: string;
  /** Palier ids this face counts toward (lib/profile/palier-taxonomy.ts predicates). */
  paliers: readonly string[];
  inPool: boolean;
  /** A review is due for it now. */
  due: boolean;
};

/** A wrong answer: the face asked, the face the player chose instead. */
export type ConfusionRow = { asked: string; answered: string; count: number };

/** What a Play it button hands to the training start. Absent = today's session. */
export type TrainingFocus =
  | { kind: "palier"; id: string }
  | { kind: "faces"; slugs: string[] };

export type LightObjective = {
  kind: "light";
  /** "light" an unlit step, or "maintain" a lit one when everything is lit. */
  mode: "light" | "maintain";
  palierId: string | null;
  label: string | null;
  a: number;
  mastered: number;
  masteredTarget: number;
  focus: TrainingFocus | null;
};

export type FixPair = { asked: string; answered: string; count: number };

export type FixObjective = {
  kind: "fix";
  pairs: FixPair[];
  focus: TrainingFocus | null;
};

export type MissionObjective = {
  kind: "mission";
  target: number;
  done: number;
  reached: boolean;
  /** Always false, and written down so no one wires it otherwise (I-17). */
  endsSession: false;
  focus: null;
};

export type Objectives = { light: LightObjective; fix: FixObjective; mission: MissionObjective };

export type ObjectivesInput = {
  paliers: readonly ObjectivePalier[];
  /** Palier ids that have a real predicate today. Anything else is never proposed. */
  derivable: readonly string[];
  faces: readonly ObjectiveFace[];
  confusions: readonly ConfusionRow[];
  /** Correct answers today, Europe/Paris, context 'personal' only. */
  todayCorrectPersonal: number;
  missionTarget?: number;
};

const canonical = (a: string, b: string): number => {
  const [a1, a2] = a.split(".").map(Number);
  const [b1, b2] = b.split(".").map(Number);
  return a1 - b1 || a2 - b2;
};

function chooseLight(input: ObjectivesInput): LightObjective {
  const derivable = new Set(input.derivable);
  const inPoolCount = new Map<string, number>();
  const dueCount = new Map<string, number>();
  for (const f of input.faces) {
    if (!f.inPool) continue;
    for (const id of f.paliers) {
      inPoolCount.set(id, (inPoolCount.get(id) ?? 0) + 1);
      if (f.due) dueCount.set(id, (dueCount.get(id) ?? 0) + 1);
    }
  }

  const proposable = input.paliers
    .filter((p) => derivable.has(p.id) && (inPoolCount.get(p.id) ?? 0) >= MIN_FACES_IN_POOL)
    .slice()
    .sort((x, y) => canonical(x.id, y.id));

  const missing = (p: ObjectivePalier) => Math.max(0, LIT_MASTERED - p.mastered);
  const gap = (p: ObjectivePalier) => Math.max(0, LIT_ACCURACY - p.a);

  const emerging = proposable
    .filter((p) => p.state === "emerging")
    .sort((x, y) => missing(x) - missing(y) || gap(x) - gap(y) || canonical(x.id, y.id));
  const dormant = proposable.filter((p) => p.state === "dormant");
  const lit = proposable
    .filter((p) => p.state === "lit")
    .sort((x, y) => (dueCount.get(y.id) ?? 0) - (dueCount.get(x.id) ?? 0) || canonical(x.id, y.id));

  const pick = emerging[0] ?? dormant[0] ?? null;
  const chosen = pick ?? lit[0] ?? null;

  if (!chosen) {
    return {
      kind: "light",
      mode: "light",
      palierId: null,
      label: null,
      a: 0,
      mastered: 0,
      masteredTarget: LIT_MASTERED,
      focus: null,
    };
  }
  return {
    kind: "light",
    mode: pick ? "light" : "maintain",
    palierId: chosen.id,
    label: chosen.label,
    a: chosen.a,
    mastered: chosen.mastered,
    masteredTarget: LIT_MASTERED,
    focus: { kind: "palier", id: chosen.id },
  };
}

function chooseFix(input: ObjectivesInput): FixObjective {
  // A pair is unordered: asking Helvetica and hearing Arial, or the reverse, is
  // the same confusion. Both directions add up.
  const merged = new Map<string, FixPair>();
  for (const row of input.confusions) {
    if (!row.asked || !row.answered || row.asked === row.answered) continue;
    const [lo, hi] = row.asked < row.answered ? [row.asked, row.answered] : [row.answered, row.asked];
    const key = `${lo}|${hi}`;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { asked: row.asked, answered: row.answered, count: row.count });
      continue;
    }
    // The pair is shown in its most frequent direction.
    const total = prev.count + row.count;
    const leader = row.count > prev.count ? row : prev;
    merged.set(key, { asked: leader.asked, answered: leader.answered, count: total });
  }

  const pairs = [...merged.values()]
    .filter((p) => p.count >= MIN_CONFUSIONS)
    .sort((x, y) => y.count - x.count || (x.asked < y.asked ? -1 : x.asked > y.asked ? 1 : 0))
    .slice(0, MAX_PAIRS);

  const slugs: string[] = [];
  for (const p of pairs) {
    for (const s of [p.asked, p.answered]) {
      if (!slugs.includes(s)) slugs.push(s);
    }
  }

  return {
    kind: "fix",
    pairs,
    focus: slugs.length > 0 ? { kind: "faces", slugs } : null,
  };
}

function chooseMission(input: ObjectivesInput): MissionObjective {
  const target = input.missionTarget ?? MISSION_TARGET_DEFAULT;
  const done = Math.max(0, Math.floor(input.todayCorrectPersonal));
  return { kind: "mission", target, done, reached: done >= target, endsSession: false, focus: null };
}

export function buildObjectives(input: ObjectivesInput): Objectives {
  return { light: chooseLight(input), fix: chooseFix(input), mission: chooseMission(input) };
}
