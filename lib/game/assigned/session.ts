import "server-only";

import { sql } from "@/lib/server/neon";
import { POLICY_OF, type AssignmentKind, type Exigence } from "@/lib/game/assigned/contract";
import type { Bucket, Candidate } from "@/lib/game/assigned/select";

// LE CYCLE DE VIE D'UNE SEANCE ASSIGNEE : ouvrir, reprendre, refuser, fermer.
//
// CE QUE CE FICHIER FAIT, ET CE QU'IL NE FAIT PAS ENCORE. Il ouvre ou reprend la
// seance d'un eleve sur un devoir, il refuse tout ce qui doit etre refuse, il dit
// ou en est le budget, il ferme. Il NE SERT PAS ENCORE LES QUESTIONS et
// N'ECRIT PAS ENCORE LES REPONSES : ce chemin la doit satisfaire les cinq gardes
// qui protegent l'ecriture d'entrainement (jeton de question, ecrivain atomique,
// convergence, balayage, compteurs de session), exactement comme la competition a
// du le faire apres coup, et c'est une piece a part entiere. Voir la note de
// scripts/quality/check-competition-integrity.mjs : porter un deuxieme ecrivain
// sans porter ses proprietes est ce qui a laisse 121 sessions ouvertes pendant
// cinq mois.
//
// TROIS REFUS, ET ILS NE SONT PAS DES DETAILS.
//   1. Pas destinataire : le devoir n'existe pas pour cet eleve.
//   2. Hors fenetre : avant l'ouverture ou apres l'echeance, aucune question.
//   3. Budget epuise : la seance est finie, on ne la rouvre pas.
//
// UNE SEULE SEANCE PAR ELEVE ET PAR DEVOIR, garantie par un index unique partiel
// en base (migration 022). L'ouverture est donc un « trouver ou creer » et jamais
// un « creer » : sans ca, un eleve qui recharge la page repart de zero et perd son
// avancement, ce que la fenetre rend irrattrapable.
//
// LA POLITIQUE DE PROGRESSION VIENT DU TYPE DE DEVOIR, ici, cote serveur, jamais
// du client (I-22). L'exercice ecrit la maitrise, le controle et la competition
// non.

const rows = async <T>(query: Promise<unknown>) => (await query) as T[];

export type AssignedRefusal =
  | "not_a_recipient"
  | "not_open_yet"
  | "past_due"
  | "budget_spent"
  | "unknown_assignment";

export type AssignedSession = {
  session_id: string;
  assignment_id: string;
  kind: AssignmentKind;
  exigence: Exigence;
  adaptive: boolean;
  question_count: number | null;
  duration_ms: number | null;
  /** Questions deja resolues, donc reussies : le curseur n'avance pas autrement. */
  resolved: number;
  policy: "update_mastery" | "observe_only";
};

type ContractRow = {
  assignment_id: string;
  class_id: string;
  teacher_id: string;
  kind: AssignmentKind;
  exigence: Exigence;
  adaptive: boolean;
  question_count: number | null;
  duration_ms: number | null;
  scope: { kind: "category" | "subcategory"; key: string }[];
  is_recipient: boolean;
  window_state: "before" | "open" | "after";
  resolved: number;
  session_id: string | null;
};

/**
 * Tout ce qu'il faut pour decider, en une seule requete.
 *
 * En une seule, parce que trois allers retours laissent la place a trois etats
 * differents : la fenetre peut se fermer entre la lecture du devoir et celle de la
 * seance, et l'eleve recevrait une question sur un devoir clos.
 */
const readContract = (assignmentId: string, userId: string) =>
  rows<ContractRow>(sql`
    SELECT
      a.assignment_id,
      a.class_id,
      a.teacher_id,
      a.kind::text AS kind,
      a.exigence::text AS exigence,
      a.adaptive,
      a.question_count,
      a.duration_ms,
      a.scope,
      EXISTS (
        SELECT 1 FROM assignment_recipients r
        WHERE r.assignment_id = a.assignment_id AND r.user_id = ${userId}::uuid
      ) AS is_recipient,
      CASE
        WHEN now() < a.available_from THEN 'before'
        WHEN now() >= a.due_at THEN 'after'
        ELSE 'open'
      END AS window_state,
      (
        SELECT count(*)::int FROM user_event_fact f
        WHERE f.assignment_id = a.assignment_id
          AND f.user_id = ${userId}::uuid
          AND f.context = 'teacher_assignment'
          AND f.event_type = 'answer'
          AND f.is_correct
      ) AS resolved,
      (
        SELECT s.session_id::text FROM sessions s
        WHERE s.assignment_id = a.assignment_id AND s.user_id = ${userId}::uuid
        LIMIT 1
      ) AS session_id
    FROM assignments a
    WHERE a.assignment_id = ${assignmentId}::uuid
      AND a.state IN ('open', 'closed')
    LIMIT 1
  `);

/**
 * Ouvre la seance de cet eleve sur ce devoir, ou reprend la sienne.
 *
 * Rend un refus type plutot qu'une exception : chacun de ces trois cas est une
 * situation normale du produit, pas un incident, et l'ecran doit pouvoir dire
 * laquelle.
 */
export const openAssignedSession = async (
  assignmentId: string,
  userId: string,
  engineVersion: string,
  seed: number
): Promise<AssignedSession | { refused: AssignedRefusal }> => {
  const [contract] = await readContract(assignmentId, userId);
  if (!contract) return { refused: "unknown_assignment" };
  if (!contract.is_recipient) return { refused: "not_a_recipient" };
  if (contract.window_state === "before") return { refused: "not_open_yet" };
  if (contract.window_state === "after") return { refused: "past_due" };
  if (
    contract.question_count !== null &&
    contract.resolved >= contract.question_count
  ) {
    return { refused: "budget_spent" };
  }

  const policy = POLICY_OF[contract.kind];
  const mode = contract.kind === "competition" ? "competition" : "training";

  // TROUVER OU CREER, en une instruction. L'index unique partiel de la migration
  // 022 fait le reste : deux ouvertures simultanees ne peuvent pas produire deux
  // seances, et celle qui perd la course retombe sur celle qui gagne.
  const [session] = await rows<{ session_id: string }>(sql`
    WITH ouverture AS (
      INSERT INTO sessions (user_id, mode, seed, engine_version, context, progression_policy, assignment_id)
      VALUES (
        ${userId}::uuid,
        ${mode},
        ${seed}::bigint,
        ${engineVersion},
        'teacher_assignment',
        ${policy}::app.progression_policy_enum,
        ${assignmentId}::uuid
      )
      ON CONFLICT DO NOTHING
      RETURNING session_id
    )
    SELECT session_id::text FROM ouverture
    UNION ALL
    SELECT s.session_id::text FROM sessions s
    WHERE s.assignment_id = ${assignmentId}::uuid
      AND s.user_id = ${userId}::uuid
    LIMIT 1
  `);

  return {
    session_id: session.session_id,
    assignment_id: contract.assignment_id,
    kind: contract.kind,
    exigence: contract.exigence,
    adaptive: contract.adaptive,
    question_count: contract.question_count,
    duration_ms: contract.duration_ms,
    resolved: contract.resolved,
    policy,
  };
};

/**
 * Ferme la seance, et dit pourquoi.
 *
 * `duration_ms` n'est jamais ecrit : c'est une colonne generee que la base
 * calcule depuis `ended_at`, et toute ecriture directe est rejetee par Postgres.
 */
export const closeAssignedSession = (sessionId: string) =>
  rows<{ session_id: string }>(sql`
    UPDATE sessions
       SET status = 'completed', ended_at = now()
     WHERE session_id = ${sessionId}::uuid
       AND status = 'active'
    RETURNING session_id::text
  `);

/**
 * Les faces que ce devoir peut demander, chacune avec son panier de mix.
 *
 * DEUX SOURCES, ET AUCUNE N'EST LE POOL PERSONNEL DE L'ELEVE (I-21). Le terrain
 * vient du perimetre du contrat, les passages obliges de ses faces imposees. Le
 * panier, lui, se calcule sur l'HISTORIQUE DES ASSIGNATIONS DE CE PROFESSEUR pour
 * cette classe : « nouveau » veut dire jamais demande dans ses exercices, jamais
 * « jamais vu de sa vie », sinon le mix devient une lecture detournee du prive.
 *
 * Ne rend que des faces actives au catalogue. La forme stockee des confusions
 * retenues est `[{"seen":"<slug>","chosen":"<slug>","times":n}]`, et les deux
 * faces d'une paire retenue tombent dans le panier 'targeted'.
 */
export const assignedCandidates = async (
  assignmentId: string
): Promise<Candidate[]> => {
  const found = await rows<{ slug: string; bucket: Bucket; imposed: boolean }>(sql`
    WITH contrat AS (
      SELECT a.assignment_id, a.class_id, a.teacher_id, a.scope, a.confusions
      FROM assignments a
      WHERE a.assignment_id = ${assignmentId}::uuid
    ),
    perimetre AS (
      SELECT tc.typeface_slug
      FROM contrat c
      JOIN LATERAL jsonb_array_elements(c.scope) AS s(entry) ON true
      JOIN typefaces_core tc
        ON (s.entry->>'kind' = 'category' AND tc.primary_category::text = s.entry->>'key')
        OR (s.entry->>'kind' = 'subcategory' AND tc.sub_category::text = s.entry->>'key')
      WHERE tc.activation_status = true
    ),
    imposees AS (
      SELECT t.typeface_slug
      FROM assignment_targets t
      JOIN contrat c ON c.assignment_id = t.assignment_id
    ),
    candidates AS (
      SELECT typeface_slug, true AS imposed FROM imposees
      UNION
      SELECT typeface_slug, false FROM perimetre
        WHERE typeface_slug NOT IN (SELECT typeface_slug FROM imposees)
    ),
    histoire AS (
      SELECT
        f.typeface_slug,
        count(*) FILTER (WHERE f.attempt_index = 1)::int AS vues,
        count(*) FILTER (WHERE f.attempt_index = 1 AND f.is_correct)::int AS justes
      FROM user_event_fact f
      JOIN assignments a ON a.assignment_id = f.assignment_id
      JOIN contrat c ON c.class_id = a.class_id AND c.teacher_id = a.teacher_id
      WHERE f.context = 'teacher_assignment'
        AND f.event_type = 'answer'
      GROUP BY f.typeface_slug
    ),
    ciblees AS (
      SELECT DISTINCT v.slug
      FROM contrat c
      JOIN LATERAL jsonb_array_elements(c.confusions) AS k(entry) ON true
      CROSS JOIN LATERAL (VALUES (k.entry->>'seen'), (k.entry->>'chosen')) AS v(slug)
      WHERE v.slug IS NOT NULL
    )
    SELECT
      k.typeface_slug AS slug,
      k.imposed,
      CASE
        -- Une paire retenue par le professeur passe devant tout : c'est
        -- exactement ce qu'il a demande a travailler.
        WHEN k.typeface_slug IN (SELECT slug FROM ciblees) THEN 'targeted'
        -- Jamais demandee dans les exercices de CE professeur. Ne dit rien de ce
        -- que l'eleve a vu par ailleurs, et c'est voulu.
        WHEN h.typeface_slug IS NULL THEN 'novelty'
        -- Reussie au premier essai quatre fois sur cinq : c'est de l'entretien.
        WHEN h.vues > 0 AND h.justes::numeric / h.vues >= 0.8 THEN 'upkeep'
        ELSE 'consolidation'
      END AS bucket
    FROM candidates k
    LEFT JOIN histoire h ON h.typeface_slug = k.typeface_slug
    ORDER BY k.imposed DESC, k.typeface_slug
  `);

  return found.map((row) => ({
    slug: row.slug,
    bucket: row.bucket,
    imposed: row.imposed,
  }));
};
