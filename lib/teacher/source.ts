import "server-only";

import { getCurrentUserId } from "@/lib/server/current-user";
import { MOCK_TEACHER, type TeacherClass, type TeacherExercise, type TeacherProfile } from "@/lib/teacher/mock-teacher";
import {
  classConfusions,
  teacherAssignments,
  teacherClasses,
} from "@/lib/teacher/read-gate";

// D'OU VIENNENT LES DONNEES DE L'ESPACE PROFESSEUR. Un seul endroit, et c'est
// tout l'objet de ce fichier.
//
// LES QUATRE ECRANS N'ONT PAS A SAVOIR. Ils consomment les memes formes qu'au
// premier jour (`TeacherProfile`, `TeacherClass`, `TeacherExercise`), qu'elles
// viennent du mock ou de la porte de lecture. C'est le meme chemin que le profil
// a pris : `mock-profile.ts` a servi les ecrans jusqu'a ce que la base existe, et
// `MOCK_ARENA` en sert encore une partie aujourd'hui.
//
// LE DEFAUT EST LE MOCK, ET IL DOIT LE RESTER JUSQU'A LA MIGRATION EN PRODUCTION.
// Les tables du monde scolaire vivent aujourd'hui sur une branche Neon jetable et
// nulle part ailleurs (decision du proprietaire : aucune migration en production
// avant que toute l'architecture soit validee). Basculer sur la porte sans ces
// tables ferait planter les quatre ecrans sur une erreur de relation absente.
// D'ou une variable d'environnement et non une constante : le jour de la
// migration, `JDT_TEACHER_SOURCE=live` suffit, et aucun ecran ne bouge.
//
// L'IDENTITE DU PROFESSEUR, EN ATTENDANT LES COMPTES. Elle vient du meme cookie
// que le reste du produit. C'est la seule identite qui existe, et c'est aussi la
// raison pour laquelle le mode direct reste hors production : sans comptes, il
// n'y a pas de professeur a authentifier.

export const teacherSource = () =>
  process.env.JDT_TEACHER_SOURCE === "live" ? "live" : "mock";

/** Les heures qui restent, la forme que le mock a toujours portee. */
const hoursUntil = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);

const stateOf = (state: string, availableFrom: string): TeacherExercise["state"] => {
  if (state === "closed") return "done";
  return new Date(availableFrom).getTime() > Date.now() ? "scheduled" : "running";
};

/**
 * Le profil professeur, dans la forme que les ecrans consomment.
 *
 * En mode direct, tout vient de la porte de lecture, donc **de ce que ses
 * exercices ont produit** et de rien d'autre. Les confusions, elles, cessent
 * d'etre ecrites a la main dans un mock : elles sortent du journal.
 */
export const teacherProfile = async (): Promise<TeacherProfile> => {
  if (teacherSource() === "mock") return MOCK_TEACHER;

  const teacherId = await getCurrentUserId();
  if (!teacherId) return { ...MOCK_TEACHER, classes: [], exercises: [], signals: [] };

  const [classRows, assignmentRows] = await Promise.all([
    teacherClasses(teacherId),
    teacherAssignments(teacherId),
  ]);

  const confusionsByClass = await Promise.all(
    classRows.map(async (row) => ({
      classId: row.class_id,
      pairs: await classConfusions(teacherId, row.class_id),
    })),
  );

  const classes: TeacherClass[] = classRows.map((row) => ({
    id: row.class_id,
    name: row.name,
    level: row.level ?? "",
    studentCount: row.student_count,
    joinCode: row.join_code,
    archived: row.archived,
    confusions: (confusionsByClass.find((c) => c.classId === row.class_id)?.pairs ?? []).map((pair) => ({
      seen: { slug: pair.seen_slug, name: pair.seen_name },
      chosen: { slug: pair.chosen_slug, name: pair.chosen_name },
      times: pair.times,
    })),
  }));

  const exercises: TeacherExercise[] = assignmentRows.map((row) => ({
    id: row.assignment_id,
    title: row.title,
    mode: row.kind === "competition" ? "competition" : "training",
    classId: row.class_id,
    className: row.class_name,
    state: stateOf(row.state, row.available_from),
    dueInHours: hoursUntil(row.due_at),
    opensInHours:
      new Date(row.available_from).getTime() > Date.now() ? hoursUntil(row.available_from) : undefined,
    openedForHours: Math.max(
      1,
      Math.round(
        (new Date(row.due_at).getTime() - new Date(row.available_from).getTime()) / 3_600_000,
      ),
    ),
    questionCount: row.question_count ?? 0,
    assigned: row.assigned,
    started: row.started,
    finished: row.finished,
    // Au premier essai, et c'est la seule definition de cette spec (section 16) :
    // en entrainement le curseur n'avance que sur une bonne reponse, donc un
    // pourcentage brut vaudrait toujours 100.
    successPct: row.state === "closed" ? row.first_try_pct ?? undefined : undefined,
    typefaces: row.target_slugs.map((slug, index) => ({
      slug,
      name: row.target_names[index] ?? slug,
    })),
    scope: row.scope,
  }));

  return {
    name: MOCK_TEACHER.name,
    classes,
    exercises,
    // Les signaux sont encore ecrits a la main dans le mock : ils demandent le
    // moteur de recommandation, qui est un chantier a lui seul (spec section 4).
    // Vide plutot que faux : un signal dont la preuve n'existe pas est pire que
    // pas de signal.
    signals: [],
  };
};
