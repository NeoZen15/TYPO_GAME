import "server-only";

import { sql } from "@/lib/server/neon";

// LA PORTE DE LECTURE PROFESSEUR. Une seule.
//
// POURQUOI UNE SEULE FONCTION D'ENTREE PAR QUESTION, ET PAS UNE REQUETE PAR
// ECRAN. L'etancheite eleve / professeur est une promesse produit gelee (I-15,
// I-16, I-23) : le professeur ne lit QUE ce que ses propres exercices ont
// produit, jamais l'entrainement libre, jamais la maitrise, jamais le pool,
// jamais le deplacement que sa session a produit. Une promesse pareille ne tient
// pas si dix ecrans ecrivent dix requetes : il suffit qu'une seule oublie un
// filtre. Ici, tout ce qui est destine a un professeur passe par ce fichier, et
// chaque requete porte les deux memes bornes :
//
//   a.teacher_id = <le professeur qui demande>
//   f.context    = 'teacher_assignment'
//
// La premiere borne dit « tes assignations », la seconde dit « pas la vie privee
// de l'eleve ». Le garde check:teacher-read-gate echoue si une requete de ce
// fichier perd l'une des deux, et si un module destine au professeur mentionne la
// table d'etat personnel ou importe quelque chose qui la mentionne.
//
// CE FICHIER N'A DONC AUCUN DROIT DE LIRE L'ETAT PEDAGOGIQUE PERSONNEL, et c'est
// verifiable : il n'en nomme jamais la table, et sa seule dependance de donnees
// est le client SQL.
//
// CE QU'IL LIT, ET D'OU. Le journal des reponses, borne aux assignations du
// professeur, plus les tables du monde scolaire (migration 021). Rien d'autre.
//
// LA DEFINITION D'UN RESULTAT, UNE FOIS POUR TOUTES (spec section 16). En
// entrainement, le curseur n'avance que sur une bonne reponse : l'eleve reprend
// une question jusqu'a la reussir, donc un pourcentage brut vaudrait TOUJOURS
// 100. Un resultat est donc la justesse AU PREMIER ESSAI, `attempt_index = 1 AND
// is_correct`, et tous les ecrans ecrivent « au premier essai » a cote du chiffre.

const rows = async <T>(query: Promise<unknown>) => (await query) as T[];

export type TeacherClassRow = {
  class_id: string;
  name: string;
  level: string | null;
  join_code: string;
  archived: boolean;
  student_count: number;
  open_assignments: number;
};

/**
 * Les classes de ce professeur.
 *
 * Bornees a celles qu'il a creees, et non a celles de son etablissement : une
 * vue d'etablissement est une autre question, avec ses propres droits, et elle
 * n'existe pas en V1. Le compte d'eleves vient des appartenances, le compte
 * d'exercices ouverts des assignations, jamais d'une colonne stockee qui
 * deriverait.
 */
export const teacherClasses = (teacherId: string) =>
  rows<TeacherClassRow>(sql`
    SELECT
      c.class_id,
      c.name,
      c.level,
      c.join_code,
      c.archived,
      (SELECT count(*)::int FROM class_members m WHERE m.class_id = c.class_id) AS student_count,
      (SELECT count(*)::int FROM assignments a
        WHERE a.class_id = c.class_id
          AND a.teacher_id = ${teacherId}::uuid
          AND a.state = 'open') AS open_assignments
    FROM classes c
    WHERE c.created_by = ${teacherId}::uuid
    ORDER BY c.archived, c.name
  `);

export type TeacherAssignmentRow = {
  assignment_id: string;
  class_id: string;
  class_name: string;
  title: string;
  kind: string;
  exigence: string;
  adaptive: boolean;
  question_count: number | null;
  duration_ms: number | null;
  available_from: string;
  due_at: string;
  state: string;
  origin: string;
  assigned: number;
  started: number;
  finished: number;
  first_try_pct: number | null;
};

/**
 * Les assignations de ce professeur, avec ce qu'elles ont produit.
 *
 * `started` et `finished` sont DERIVES du journal et non stockes : un compteur
 * stocke derive au premier bug d'ecriture, et ces deux chiffres sont ceux sur
 * lesquels le professeur decide de relancer sa classe.
 */
export const teacherAssignments = (teacherId: string, classId?: string) =>
  rows<TeacherAssignmentRow>(sql`
    WITH mine AS (
      SELECT a.*
      FROM assignments a
      WHERE a.teacher_id = ${teacherId}::uuid
        AND (${classId ?? null}::uuid IS NULL OR a.class_id = ${classId ?? null}::uuid)
    ),
    answers AS (
      SELECT
        f.assignment_id,
        f.user_id,
        count(*) FILTER (WHERE f.attempt_index = 1)::int AS first_tries,
        count(*) FILTER (WHERE f.attempt_index = 1 AND f.is_correct)::int AS first_right,
        count(*) FILTER (WHERE f.is_correct)::int AS resolved
      FROM user_event_fact f
      JOIN mine m ON m.assignment_id = f.assignment_id
      WHERE f.context = 'teacher_assignment'
        AND f.event_type = 'answer'
      GROUP BY f.assignment_id, f.user_id
    )
    SELECT
      m.assignment_id,
      m.class_id,
      c.name AS class_name,
      m.title,
      m.kind::text AS kind,
      m.exigence::text AS exigence,
      m.adaptive,
      m.question_count,
      m.duration_ms,
      m.available_from,
      m.due_at,
      m.state::text AS state,
      m.origin,
      (SELECT count(*)::int FROM assignment_recipients r WHERE r.assignment_id = m.assignment_id) AS assigned,
      (SELECT count(*)::int FROM answers x WHERE x.assignment_id = m.assignment_id) AS started,
      (SELECT count(*)::int FROM answers x
        WHERE x.assignment_id = m.assignment_id
          AND m.question_count IS NOT NULL
          AND x.resolved >= m.question_count) AS finished,
      (SELECT CASE WHEN sum(x.first_tries) = 0 THEN NULL
                   ELSE round(100.0 * sum(x.first_right) / sum(x.first_tries))::int END
         FROM answers x WHERE x.assignment_id = m.assignment_id) AS first_try_pct
    FROM mine m
    JOIN classes c ON c.class_id = m.class_id
    ORDER BY m.due_at DESC
  `);

export type AssignmentStudentRow = {
  user_id: string;
  first_tries: number;
  resolved: number;
  first_try_pct: number | null;
  standing: "finished" | "started" | "not_started";
};

/**
 * Une assignation, eleve par eleve.
 *
 * Part des DESTINATAIRES et non des reponses, sinon un eleve qui n'a rien ouvert
 * disparait de la liste, et c'est precisement celui que le professeur cherche.
 */
export const assignmentRoster = (teacherId: string, assignmentId: string) =>
  rows<AssignmentStudentRow>(sql`
    WITH mine AS (
      SELECT a.assignment_id, a.question_count
      FROM assignments a
      WHERE a.teacher_id = ${teacherId}::uuid
        AND a.assignment_id = ${assignmentId}::uuid
    ),
    answers AS (
      SELECT
        f.user_id,
        count(*) FILTER (WHERE f.attempt_index = 1)::int AS first_tries,
        count(*) FILTER (WHERE f.attempt_index = 1 AND f.is_correct)::int AS first_right,
        count(*) FILTER (WHERE f.is_correct)::int AS resolved
      FROM user_event_fact f
      JOIN mine m ON m.assignment_id = f.assignment_id
      WHERE f.context = 'teacher_assignment'
        AND f.event_type = 'answer'
      GROUP BY f.user_id
    )
    SELECT
      r.user_id,
      COALESCE(x.first_tries, 0) AS first_tries,
      COALESCE(x.resolved, 0) AS resolved,
      CASE WHEN COALESCE(x.first_tries, 0) = 0 THEN NULL
           ELSE round(100.0 * x.first_right / x.first_tries)::int END AS first_try_pct,
      CASE
        WHEN x.user_id IS NULL THEN 'not_started'
        WHEN m.question_count IS NOT NULL AND x.resolved >= m.question_count THEN 'finished'
        ELSE 'started'
      END AS standing
    FROM assignment_recipients r
    CROSS JOIN mine m
    LEFT JOIN answers x ON x.user_id = r.user_id
    WHERE r.assignment_id = m.assignment_id
    ORDER BY standing, r.user_id
  `);

export type FamilyResultRow = {
  typeface_slug: string;
  display_name: string;
  first_tries: number;
  first_try_pct: number;
};

/**
 * Famille par famille, sur ce que ce professeur a donne a cette classe.
 *
 * Reel, contrairement au mock qui repartissait un taux d'exercice sur ses faces
 * par des ecarts sommant a zero. Ici chaque face porte ses propres reponses.
 */
export const classFamilyResults = (teacherId: string, classId: string) =>
  rows<FamilyResultRow>(sql`
    SELECT
      f.typeface_slug,
      tc.display_name,
      count(*) FILTER (WHERE f.attempt_index = 1)::int AS first_tries,
      round(100.0 * count(*) FILTER (WHERE f.attempt_index = 1 AND f.is_correct)
                  / NULLIF(count(*) FILTER (WHERE f.attempt_index = 1), 0))::int AS first_try_pct
    FROM user_event_fact f
    JOIN assignments a ON a.assignment_id = f.assignment_id
    JOIN typefaces_core tc ON tc.typeface_slug = f.typeface_slug
    WHERE a.teacher_id = ${teacherId}::uuid
      AND a.class_id = ${classId}::uuid
      AND f.context = 'teacher_assignment'
      AND f.event_type = 'answer'
    GROUP BY f.typeface_slug, tc.display_name
    HAVING count(*) FILTER (WHERE f.attempt_index = 1) > 0
    ORDER BY first_try_pct DESC, tc.display_name
  `);

export type ConfusionRow = {
  seen_slug: string;
  seen_name: string;
  chosen_slug: string;
  chosen_name: string;
  times: number;
};

/**
 * Les paires que cette classe confond reellement.
 *
 * LE SIGNAL LE PLUS UTILE DU PRODUIT, et il n'a jamais demande de nouvelle
 * donnee : le journal enregistre depuis le premier jour la reponse CHOISIE a cote
 * de la reponse attendue. Il manquait seulement de quoi savoir a quel devoir une
 * reponse appartient, ce que la migration 022 vient d'ajouter. Bornee aux
 * premiers essais : une erreur de reprise n'est pas une confusion, c'est un
 * ttonnement.
 */
export const classConfusions = (teacherId: string, classId: string, limit = 5) =>
  rows<ConfusionRow>(sql`
    SELECT
      f.typeface_slug AS seen_slug,
      seen.display_name AS seen_name,
      f.answer_slug AS chosen_slug,
      chosen.display_name AS chosen_name,
      count(*)::int AS times
    FROM user_event_fact f
    JOIN assignments a ON a.assignment_id = f.assignment_id
    JOIN typefaces_core seen ON seen.typeface_slug = f.typeface_slug
    JOIN typefaces_core chosen ON chosen.typeface_slug = f.answer_slug
    WHERE a.teacher_id = ${teacherId}::uuid
      AND a.class_id = ${classId}::uuid
      AND f.context = 'teacher_assignment'
      AND f.event_type = 'answer'
      AND f.attempt_index = 1
      AND f.is_correct = false
      AND f.answer_slug IS NOT NULL
    GROUP BY f.typeface_slug, seen.display_name, f.answer_slug, chosen.display_name
    ORDER BY times DESC, seen.display_name
    LIMIT ${limit}
  `);
