import "server-only";

import { sql } from "@/lib/server/neon";

// LE MONDE SCOLAIRE, VU DE L'ADMINISTRATION.
//
// Ce module sert la GESTION et le DEPANNAGE : qui est rattache a quoi, qu'est ce
// qui a ete cree, qu'est ce qui tourne. Il ne sert pas a juger un regard. Savoir
// si un eleve progresse regarde son professeur, dans l'espace professeur, et la
// porte de lecture de `lib/teacher/read-gate.ts` dit deja a quelles conditions.
//
// CE QUE LA BASE NE SAIT PAS, ET IL FAUT LE DIRE ICI. La table `users` ne porte
// ni nom ni adresse : l'identite vit chez Clerk, et `clerk_id` est le seul fil
// entre les deux. Un repertoire de comptes ne peut donc pas afficher « Camille
// Durand » aujourd'hui, seulement un compte, son role, son rattachement et son
// activite. C'est une limite reelle, pas une pudeur, et elle se dit a l'ecran
// plutot que de se combler avec un identifiant maquille en nom.

const rows = async <T>(query: Promise<unknown>) => (await query) as T[];

export type SchoolRow = {
  school_id: string;
  name: string;
  teachers: number;
  classes: number;
  students: number;
  assignments: number;
  created_at: string;
  last_seen_at: string | null;
};

/** Les etablissements, avec de quoi comprendre lequel vit et lequel dort. */
export const schoolsOverview = () =>
  rows<SchoolRow>(sql`
    SELECT
      s.school_id::text,
      s.name,
      (SELECT count(*)::int FROM school_members m WHERE m.school_id = s.school_id) AS teachers,
      (SELECT count(*)::int FROM classes c WHERE c.school_id = s.school_id) AS classes,
      (SELECT count(DISTINCT cm.user_id)::int FROM classes c
         JOIN class_members cm ON cm.class_id = c.class_id
        WHERE c.school_id = s.school_id) AS students,
      (SELECT count(*)::int FROM classes c
         JOIN assignments a ON a.class_id = c.class_id
        WHERE c.school_id = s.school_id) AS assignments,
      to_char(s.created_at, 'YYYY-MM-DD') AS created_at,
      (SELECT to_char(max(u.last_seen_at), 'YYYY-MM-DD') FROM classes c
         JOIN class_members cm ON cm.class_id = c.class_id
         JOIN users u ON u.user_id = cm.user_id
        WHERE c.school_id = s.school_id) AS last_seen_at
    FROM schools s
    ORDER BY s.created_at DESC
  `);

export type ClassRow = {
  class_id: string;
  name: string;
  level: string | null;
  school_name: string;
  members: number;
  assignments: number;
  published: number;
  archived: boolean;
  created_at: string;
};

/** Les classes, et ce qu'elles ont reellement recu. */
export const classesOverview = () =>
  rows<ClassRow>(sql`
    SELECT
      c.class_id::text,
      c.name,
      c.level,
      s.name AS school_name,
      (SELECT count(*)::int FROM class_members cm WHERE cm.class_id = c.class_id) AS members,
      (SELECT count(*)::int FROM assignments a WHERE a.class_id = c.class_id) AS assignments,
      (SELECT count(*)::int FROM assignments a
        WHERE a.class_id = c.class_id AND a.published_at IS NOT NULL) AS published,
      c.archived,
      to_char(c.created_at, 'YYYY-MM-DD') AS created_at
    FROM classes c
    JOIN schools s ON s.school_id = c.school_id
    ORDER BY c.archived, c.created_at DESC
  `);

export type TeacherRow = {
  user_id: string;
  has_account: boolean;
  role: string;
  school_name: string;
  classes: number;
  assignments: number;
  joined_at: string;
  last_seen_at: string;
};

/**
 * Les enseignants. Pas de nom : voir l'entete de ce fichier. Ce qui les
 * distingue ici est ce qui sert au depannage, c'est a dire leur rattachement,
 * ce qu'ils ont cree et quand on les a vus pour la derniere fois.
 */
export const teachersOverview = () =>
  rows<TeacherRow>(sql`
    SELECT
      m.user_id::text,
      (u.clerk_id IS NOT NULL) AS has_account,
      m.role::text,
      s.name AS school_name,
      (SELECT count(*)::int FROM classes c WHERE c.created_by = m.user_id) AS classes,
      (SELECT count(*)::int FROM assignments a WHERE a.teacher_id = m.user_id) AS assignments,
      to_char(m.created_at, 'YYYY-MM-DD') AS joined_at,
      to_char(u.last_seen_at, 'YYYY-MM-DD') AS last_seen_at
    FROM school_members m
    JOIN schools s ON s.school_id = m.school_id
    JOIN users u ON u.user_id = m.user_id
    ORDER BY m.created_at DESC
  `);

export type AccountsSummary = {
  total: number;
  guests: number;
  players: number;
  admins: number;
  with_clerk: number;
  in_a_class: number;
  seen_7d: number;
  never_played: number;
  deleted: number;
};

/**
 * Le repertoire, en volumes. La gestion commence par savoir combien.
 *
 * `never_played` INTERROGE LE JOURNAL ET PAS `users.global_q_index`. Ce compteur
 * porte l'ordonnancement de la repetition espacee, pas un total de reponses :
 * mesure du 2026-09-11, 40 comptes qui ont repondu l'avaient encore a zero, et
 * 80 comptes sur 99 etaient en desaccord avec le journal. Il annoncait donc 212
 * personnes n'ayant jamais joue la ou il y en a 172.
 */
export const accountsSummary = async (): Promise<AccountsSummary> => {
  const [row] = await rows<AccountsSummary>(sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE role = 'guest')::int AS guests,
      count(*) FILTER (WHERE role = 'player')::int AS players,
      count(*) FILTER (WHERE role = 'admin')::int AS admins,
      count(*) FILTER (WHERE clerk_id IS NOT NULL)::int AS with_clerk,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM class_members cm WHERE cm.user_id = users.user_id))::int AS in_a_class,
      count(*) FILTER (WHERE last_seen_at > now() - interval '7 days')::int AS seen_7d,
      count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM user_event_fact f
         WHERE f.user_id = users.user_id AND f.event_type = 'answer'))::int AS never_played,
      count(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS deleted
    FROM users
  `);
  return row;
};

export type AccountRow = {
  user_id: string;
  role: string;
  has_account: boolean;
  classes: number;
  questions: number;
  sessions: number;
  created_at: string;
  last_seen_at: string;
  deleted: boolean;
};

/**
 * Les derniers comptes, pour ouvrir celui qu'on cherche.
 *
 * LE NOMBRE DE QUESTIONS VIENT DU JOURNAL, pour la meme raison que ci dessus :
 * `users.global_q_index` est le compteur d'ordonnancement du moteur, il ne
 * compte pas les reponses et se trompait sur 80 comptes sur 99.
 *
 * VOLONTAIREMENT COURT ET NON CLASSABLE PAR PERFORMANCE. On vient ici parce que
 * quelqu'un est bloque, pas pour comparer des eleves entre eux. L'ordre est donc
 * l'ordre d'arrivee, et les colonnes disent l'etat d'un compte, jamais un taux
 * de reussite.
 */
export const recentAccounts = (limit = 40) =>
  rows<AccountRow>(sql`
    SELECT
      u.user_id::text,
      u.role::text,
      (u.clerk_id IS NOT NULL) AS has_account,
      (SELECT count(*)::int FROM class_members cm WHERE cm.user_id = u.user_id) AS classes,
      (SELECT count(*)::int FROM user_event_fact f
        WHERE f.user_id = u.user_id AND f.event_type = 'answer') AS questions,
      (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.user_id) AS sessions,
      to_char(u.created_at, 'YYYY-MM-DD') AS created_at,
      to_char(u.last_seen_at, 'YYYY-MM-DD') AS last_seen_at,
      (u.deleted_at IS NOT NULL) AS deleted
    FROM users u
    ORDER BY u.created_at DESC
    LIMIT ${limit}
  `);

export type AssignmentRow = {
  assignment_id: string;
  title: string;
  kind: string;
  state: string;
  exigence: string;
  adaptive: boolean;
  class_name: string;
  school_name: string;
  recipients: number;
  opened: number;
  finished: number;
  due_at: string;
};

/**
 * Les devoirs donnes, et ce qu'ils ont produit.
 *
 * `opened` et `finished` comptent des SEANCES de contexte `teacher_assignment`,
 * jamais l'entrainement personnel : les deux mondes ne se melangent pas, et le
 * comptage le dit dans sa clause WHERE plutot que dans un commentaire.
 */
export const assignmentsOverview = (limit = 50) =>
  rows<AssignmentRow>(sql`
    SELECT
      a.assignment_id::text,
      a.title,
      a.kind::text,
      a.state::text,
      a.exigence::text,
      a.adaptive,
      c.name AS class_name,
      s.name AS school_name,
      (SELECT count(*)::int FROM assignment_recipients r WHERE r.assignment_id = a.assignment_id) AS recipients,
      (SELECT count(*)::int FROM sessions ss
        WHERE ss.assignment_id = a.assignment_id AND ss.context = 'teacher_assignment') AS opened,
      (SELECT count(*)::int FROM sessions ss
        WHERE ss.assignment_id = a.assignment_id AND ss.context = 'teacher_assignment'
          AND ss.status = 'completed') AS finished,
      to_char(a.due_at, 'YYYY-MM-DD') AS due_at
    FROM assignments a
    JOIN classes c ON c.class_id = a.class_id
    JOIN schools s ON s.school_id = c.school_id
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `);

export type WorldCounts = {
  schools: number;
  classes: number;
  teachers: number;
  students: number;
  assignments: number;
  assignments_published: number;
};

/** Les volumes du monde scolaire, pour la vue d'ensemble. */
export const worldCounts = async (): Promise<WorldCounts> => {
  const [row] = await rows<WorldCounts>(sql`
    SELECT
      (SELECT count(*)::int FROM schools) AS schools,
      (SELECT count(*)::int FROM classes WHERE NOT archived) AS classes,
      (SELECT count(*)::int FROM school_members) AS teachers,
      (SELECT count(DISTINCT user_id)::int FROM class_members) AS students,
      (SELECT count(*)::int FROM assignments) AS assignments,
      (SELECT count(*)::int FROM assignments WHERE published_at IS NOT NULL) AS assignments_published
  `);
  return row;
};
