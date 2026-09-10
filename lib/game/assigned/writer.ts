import "server-only";

import { sql } from "@/lib/server/neon";
import {
  createQuestionToken,
  verifyQuestionToken,
} from "@/lib/game/training/question-token";
import {
  orderOptionsForDisplay,
  pickDistractors,
  type QuestionShapeRow,
} from "@/lib/game/training/question-shape";
import { isIndistinguishableFrom } from "@/lib/game/twin-guard";
import { getRuntimeFontFace, getRuntimeFontFamily, hasRuntimeFace } from "@/lib/game/fonts/runtime-catalog";
import { getTrainingDisplayWord } from "@/lib/game/training/catalog";
import { proximityFor } from "@/lib/game/assigned/contract";
import { isBudgetSpent, nextFace, type AskedCount, type Mix } from "@/lib/game/assigned/select";
import { assignedCandidates } from "@/lib/game/assigned/session";
import { GameRequestError } from "@/lib/game/request-error";

// SERVIR UNE QUESTION DE DEVOIR, ET ECRIRE LA REPONSE.
//
// CE FICHIER PORTE LES CINQ PROPRIETES DES ECRIVAINS, DES SA PREMIERE LIGNE, et
// c'est un choix qui vient d'une facture connue. La competition a ete ecrite sans
// elles et repassee dessus six mois plus tard : deux reponses simultanees
// ecrivaient deux faits pour une question, deux ouvertures ouvraient deux
// manches, et 121 sessions sont restees actives pendant cinq mois parce que le
// balayage d'entrainement porte `AND s.mode = 'training'`. Voir la note de
// scripts/quality/check-competition-integrity.mjs. Un troisieme ecrivain qui
// repartirait sans ces proprietes referait exactement la meme dette.
//
//   1. UN SEUL ENONCE ATOMIQUE. L'indice de tentative est derive DANS
//      l'instruction, la ligne de garde d'ingestion arbitre les doublons par sa
//      cle primaire, et le fait est SELECTionne depuis cette CTE. Un INSERT pose a
//      cote plutot qu'alimente par elle ecrirait le fait meme quand la garde est
//      perdue.
//   2. ZERO LIGNE ECRITE VEUT DIRE DOUBLON, ET RIEN D'AUTRE NE TOURNE. On rend ce
//      que la base a enregistre, jamais une erreur : un jeton rejoue est une
//      reprise ordinaire, pas une attaque.
//   3. LES COMPTEURS S'INCREMENTENT DANS L'INSTRUCTION. Calcules en JavaScript
//      depuis une lecture anterieure, deux reponses simultanees partent de la meme
//      valeur et la seconde efface la premiere.
//   4. LA MAITRISE N'EST TOUCHEE QUE SOUS `update_mastery`. Un controle mesure, une
//      competition fait performer : ni l'un ni l'autre ne deplace le pool. La base
//      l'interdit deja pour la competition, ce fichier l'interdit pour le controle.
//   5. LA FENETRE ET LE BUDGET SONT VERIFIES A CHAQUE QUESTION, jamais une seule
//      fois a l'ouverture : une seance peut rester ouverte pendant que l'echeance
//      passe.
//
// CE QUE LE CLIENT NE DECIDE JAMAIS : la face demandee, les options et le mot
// affiche voyagent dans un jeton signe (HMAC SHA-256, meme module que
// l'entrainement). Le corps de la requete ne porte que la reponse choisie.

const rows = async <T>(query: Promise<unknown>) => (await query) as T[];

type ContextRow = {
  session_id: string;
  user_id: string;
  status: string;
  seed: string;
  assignment_id: string;
  kind: "exercise" | "control" | "competition";
  exigence: "accessible" | "balanced" | "challenging" | "expert";
  adaptive: boolean;
  question_count: number | null;
  mix: Mix;
  policy: "update_mastery" | "observe_only";
  window_state: "before" | "open" | "after";
  resolved: number;
  asked: AskedCount;
  global_q_index: number;
};

/**
 * Tout ce qui decide, en une seule lecture.
 *
 * En une seule, et c'est une propriete : entre deux allers retours l'echeance
 * peut passer, et l'eleve recevrait une question sur un devoir clos.
 */
const readContext = (sessionId: string, userId: string) =>
  rows<ContextRow>(sql`
    SELECT
      s.session_id::text,
      s.user_id::text,
      s.status::text,
      s.seed::text,
      a.assignment_id::text,
      a.kind::text AS kind,
      a.exigence::text AS exigence,
      a.adaptive,
      a.question_count,
      a.mix,
      s.progression_policy::text AS policy,
      CASE
        WHEN now() < a.available_from THEN 'before'
        WHEN now() >= a.due_at THEN 'after'
        ELSE 'open'
      END AS window_state,
      (
        SELECT count(*)::int FROM user_event_fact f
        WHERE f.session_id = s.session_id AND f.event_type = 'answer' AND f.is_correct
      ) AS resolved,
      COALESCE((
        SELECT jsonb_object_agg(x.typeface_slug, x.n)
        FROM (
          SELECT f.typeface_slug, count(*)::int AS n
          FROM user_event_fact f
          WHERE f.session_id = s.session_id
            AND f.event_type = 'answer'
            AND f.attempt_index = 1
          GROUP BY f.typeface_slug
        ) x
      ), '{}'::jsonb) AS asked,
      (SELECT u.global_q_index FROM users u WHERE u.user_id = s.user_id) AS global_q_index
    FROM sessions s
    JOIN assignments a ON a.assignment_id = s.assignment_id
    WHERE s.session_id = ${sessionId}::uuid
      AND s.user_id = ${userId}::uuid
      AND s.context = 'teacher_assignment'
    LIMIT 1
  `);

/**
 * Les faces parmi lesquelles les leurres sont choisis.
 *
 * TROIS STRATES, ET ELLES SONT LA RAISON D'ETRE DE LA REQUETE. Le cran du
 * professeur peut demander des leurres tres proches comme tres eloignes : un
 * echantillon qui ne contiendrait que le cluster de la bonne reponse rendrait le
 * cran « accessible » impossible, et l'inverse rendrait « expert » impossible. On
 * apporte donc du proche, du moyen et du lointain, et c'est `pickDistractors` qui
 * tranche selon la proximite visee.
 *
 * Les leurres viennent de TOUT le catalogue jouable et jamais du perimetre du
 * devoir : un leurre n'est pas une chose qu'on enseigne, c'est une chose contre
 * laquelle on se trompe.
 */
const distractorPool = (slug: string) =>
  rows<QuestionShapeRow & { display_name: string }>(sql`
    WITH cible AS (
      SELECT primary_category, visual_cluster_id, contrast_profile, aperture_profile
      FROM typefaces_core WHERE typeface_slug = ${slug}
    ),
    jouables AS (
      SELECT tc.typeface_slug, tc.display_name, tc.primary_category::text AS primary_category,
             tc.visual_cluster_id, tc.difficulty_base::text AS difficulty_base,
             tc.rarity_tag::text AS rarity_tag, tc.contrast_profile::text AS contrast_profile,
             tc.aperture_profile::text AS aperture_profile,
             CASE
               WHEN tc.visual_cluster_id = c.visual_cluster_id THEN 0
               WHEN tc.primary_category = c.primary_category THEN 1
               ELSE 2
             END AS strate
      FROM typefaces_core tc, cible c
      WHERE tc.activation_status = true
        AND tc.typeface_slug <> ${slug}
    )
    (SELECT * FROM jouables WHERE strate = 0 LIMIT 20)
    UNION ALL
    (SELECT * FROM jouables WHERE strate = 1 LIMIT 20)
    UNION ALL
    (SELECT * FROM jouables WHERE strate = 2 LIMIT 20)
  `);

export type AssignedQuestion = {
  token: string;
  questionId: string;
  typefaceSlug: string;
  displayWord: string;
  fontFamily: string;
  fontFace: ReturnType<typeof getRuntimeFontFace>;
  options: { slug: string; label: string }[];
  progress: { resolved: number; questionCount: number | null };
};

/**
 * La prochaine question du devoir, ou la fin.
 *
 * Rend null quand il n'y a plus rien a demander : budget epuise ou echeance
 * passee. L'appelant ferme alors la seance et montre le bilan.
 */
export const buildAssignedQuestion = async (
  sessionId: string,
  userId: string
): Promise<AssignedQuestion | null> => {
  const [context] = await readContext(sessionId, userId);
  if (!context) throw new GameRequestError("session_not_found", "Assigned session not found.");
  if (context.status !== "active") return null;
  // 5. La fenetre et le budget, a CHAQUE question.
  if (context.window_state !== "open") return null;
  if (isBudgetSpent(context.resolved, context.question_count)) return null;

  const candidates = await assignedCandidates(context.assignment_id);
  const playable = candidates.filter((candidate) => hasRuntimeFace(candidate.slug));
  const chosen = nextFace(
    playable,
    context.mix,
    context.asked,
    Object.values(context.asked).reduce((sum, n) => sum + n, 0),
    context.seed
  );
  if (!chosen) {
    throw new GameRequestError(
      "session_not_active",
      "This assignment offers no face the product can serve."
    );
  }

  // L'ETAT PERSONNEL N'EST LU QUE SI LE DEVOIR EST ADAPTATIF (I-25), et il ne
  // remonte jamais au professeur (I-23). Sur un controle, cette lecture n'a
  // simplement pas lieu : deux eleves recoivent la meme difficulte, ce qui est la
  // definition d'une mesure.
  let mastery: number | null = null;
  if (context.adaptive) {
    const [state] = await rows<{ mastery_level: number }>(sql`
      SELECT COALESCE(uts.mastery_level, 0) AS mastery_level
      FROM typefaces_core tc
      LEFT JOIN user_typeface_state uts
        ON uts.user_id = ${userId}::uuid AND uts.typeface_slug = tc.typeface_slug
      WHERE tc.typeface_slug = ${chosen.slug}
      LIMIT 1
    `);
    mastery = state?.mastery_level ?? 0;
  }

  const proximity = proximityFor(context.exigence, context.adaptive, mastery);
  const pool = await distractorPool(chosen.slug);
  const [correctRow] = await rows<QuestionShapeRow & { display_name: string }>(sql`
    SELECT tc.typeface_slug, tc.display_name, tc.primary_category::text AS primary_category,
           tc.visual_cluster_id, tc.difficulty_base::text AS difficulty_base,
           tc.rarity_tag::text AS rarity_tag, tc.contrast_profile::text AS contrast_profile,
           tc.aperture_profile::text AS aperture_profile,
           0 AS mastery_level, 0 AS next_due_after_q
    FROM typefaces_core tc WHERE tc.typeface_slug = ${chosen.slug} LIMIT 1
  `);

  const renderable = pool.filter((row) => hasRuntimeFace(row.typeface_slug));
  const distractors = pickDistractors(
    renderable,
    { ...correctRow, mastery_level: mastery ?? 0 },
    context.global_q_index,
    context.seed,
    isIndistinguishableFrom,
    proximity
  );
  const optionRows = orderOptionsForDisplay({ ...correctRow }, distractors);

  const questionId = crypto.randomUUID();
  const displayWord = getTrainingDisplayWord(context.seed, context.global_q_index);
  const options = optionRows.map((row) => ({
    slug: row.typeface_slug,
    label: (row as { display_name?: string }).display_name ?? row.typeface_slug,
  }));

  return {
    token: createQuestionToken({
      sessionId,
      userId,
      questionId,
      globalQIndex: context.global_q_index,
      typefaceSlug: chosen.slug,
      displayWord,
      options: options.map((option) => option.slug),
      issuedAtMs: Date.now(),
    }),
    questionId,
    typefaceSlug: chosen.slug,
    displayWord,
    fontFamily: getRuntimeFontFamily(chosen.slug, correctRow.display_name),
    fontFace: getRuntimeFontFace(chosen.slug),
    options,
    progress: { resolved: context.resolved, questionCount: context.question_count },
  };
};

export type AssignedAnswerResult = {
  attemptIndex: number;
  isCorrect: boolean;
  resolved: number;
  finished: boolean;
  duplicate: boolean;
};

/** Ce que la base a enregistre, quand une soumission n'a rien gagne. */
const duplicateAssignedAnswerResponse = async (
  sessionId: string,
  questionId: string
): Promise<AssignedAnswerResult> => {
  const [recorded] = await rows<{
    attempt_index: number;
    is_correct: boolean;
    resolved: number;
    question_count: number | null;
  }>(sql`
    SELECT
      f.attempt_index,
      f.is_correct,
      (SELECT count(*)::int FROM user_event_fact x
        WHERE x.session_id = ${sessionId}::uuid AND x.event_type = 'answer' AND x.is_correct) AS resolved,
      (SELECT a.question_count FROM assignments a
        JOIN sessions s ON s.assignment_id = a.assignment_id
        WHERE s.session_id = ${sessionId}::uuid) AS question_count
    FROM user_event_fact f
    WHERE f.session_id = ${sessionId}::uuid
      AND f.question_id = ${questionId}::uuid
      AND f.event_type = 'answer'
    ORDER BY f.attempt_index DESC
    LIMIT 1
  `);

  return {
    attemptIndex: recorded?.attempt_index ?? 1,
    isCorrect: recorded?.is_correct ?? false,
    resolved: recorded?.resolved ?? 0,
    finished: isBudgetSpent(recorded?.resolved ?? 0, recorded?.question_count ?? null),
    duplicate: true,
  };
};

export const submitAssignedAnswer = async (payload: {
  token: string;
  answerSlug: string;
  responseTimeMs: number;
}): Promise<AssignedAnswerResult> => {
  const signed = verifyQuestionToken(payload.token);
  if (!signed) {
    throw new GameRequestError("invalid_question_token", "This question token is not valid.");
  }
  if (!signed.options.includes(payload.answerSlug)) {
    throw new GameRequestError("invalid_answer_option", "That answer was not among the options.");
  }

  const [context] = await readContext(signed.sessionId, signed.userId);
  if (!context) throw new GameRequestError("session_not_found", "Assigned session not found.");

  // Une reponse qui arrive apres l'echeance ne compte pas, et la seance se ferme :
  // les reponses deja donnees restent, aucune nouvelle n'entre.
  if (context.window_state === "after") {
    await closeIfOpen(signed.sessionId);
    return { attemptIndex: 0, isCorrect: false, resolved: context.resolved, finished: true, duplicate: false };
  }

  const isCorrect = payload.answerSlug === signed.typefaceSlug;

  // L'etat personnel de la face, lu une fois : il sert de `mastery_before` sur le
  // fait, et de base a la transition quand la politique autorise l'ecriture.
  const [state] = await rows<{ mastery_level: number }>(sql`
    SELECT COALESCE(uts.mastery_level, 0) AS mastery_level
    FROM typefaces_core tc
    LEFT JOIN user_typeface_state uts
      ON uts.user_id = ${signed.userId}::uuid AND uts.typeface_slug = tc.typeface_slug
    WHERE tc.typeface_slug = ${signed.typefaceSlug}
    LIMIT 1
  `);
  const masteryBefore = state?.mastery_level ?? 0;
  const masteryAfterFirstTry = isCorrect
    ? Math.min(4, masteryBefore + 1)
    : Math.max(0, masteryBefore - 1);
  const writesMastery = context.policy === "update_mastery";

  // 1. UN SEUL ENONCE ATOMIQUE, et 3. LES COMPTEURS DEDANS.
  const written = await rows<{ attempt_index: number; resolved_count: number }>(sql`
    WITH n AS (
      SELECT COUNT(*)::int + 1 AS attempt_index
      FROM user_event_fact
      WHERE session_id = ${signed.sessionId}::uuid
        AND event_type = 'answer'
        AND question_id = ${signed.questionId}::uuid
    ),
    g AS (
      INSERT INTO event_ingestion_guard (idempotency_key, user_id, session_id, ingestion_status)
      SELECT
        ${signed.sessionId}::text || ':' || ${signed.questionId}::text || ':' || n.attempt_index::text,
        ${signed.userId}::uuid,
        ${signed.sessionId}::uuid,
        'accepted'
      FROM n
      ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING
      RETURNING idempotency_key
    ),
    f AS (
      INSERT INTO user_event_fact (
        idempotency_key, user_id, session_id, mode, global_q_index, question_id, attempt_index,
        event_type, typeface_slug, answer_slug, is_correct, response_time_ms,
        mastery_before, mastery_after, misread_shown, reading_shown, display_word,
        reason_code, seed, engine_version, context, progression_policy, assignment_id
      )
      SELECT
        g.idempotency_key,
        ${signed.userId}::uuid,
        ${signed.sessionId}::uuid,
        ${context.kind === "competition" ? "competition" : "training"},
        ${signed.globalQIndex}::int,
        ${signed.questionId}::uuid,
        n.attempt_index,
        'answer',
        ${signed.typefaceSlug},
        ${payload.answerSlug},
        ${isCorrect}::boolean,
        ${Math.max(0, Math.round(payload.responseTimeMs))}::int,
        ${masteryBefore}::smallint,
        CASE WHEN n.attempt_index = 1 AND ${writesMastery}::boolean
             THEN ${masteryAfterFirstTry}::smallint
             ELSE ${masteryBefore}::smallint
        END,
        false,
        false,
        ${signed.displayWord},
        CASE WHEN n.attempt_index = 1
             THEN ${isCorrect ? "correct_first_try" : "wrong_first_try"}::app.reason_code_enum
             ELSE ${isCorrect ? "correct_after_retry" : "wrong_retry"}::app.reason_code_enum
        END,
        ${context.seed}::bigint,
        ${"assigned-provider-v1"},
        'teacher_assignment',
        ${context.policy}::app.progression_policy_enum,
        ${context.assignment_id}::uuid
      FROM n, g
      RETURNING attempt_index, is_correct
    ),
    c AS (
      UPDATE sessions
         SET question_count = question_count + 1,
             correct_count = correct_count + (SELECT CASE WHEN f.is_correct THEN 1 ELSE 0 END FROM f)
       WHERE session_id = ${signed.sessionId}::uuid
         AND EXISTS (SELECT 1 FROM f)
      RETURNING question_count, correct_count
    )
    -- LE COMPTE VIENT DU "RETURNING" DE L'UPDATE, ET C'EST UN DEFAUT REPARE APRES
    -- MESURE. La premiere version comptait les reponses justes par une sous
    -- requete sur le journal dans la meme instruction : une sous requete lit
    -- l'instantane pris au DEBUT de l'instruction, donc jamais la ligne que
    -- l'instruction vient d'ecrire. Mesure sur la branche jetable : une reponse
    -- juste rendait un compte de 0. Le budget se serait donc epuise une question
    -- trop tard, a chaque devoir. La colonne correct_count rendue par l'UPDATE est la
    -- valeur NOUVELLE, et c'est exactement le nombre de questions resolues,
    -- puisqu'une question se resout quand elle est reussie.
    SELECT
      (SELECT attempt_index FROM f) AS attempt_index,
      (SELECT correct_count FROM c) AS resolved_count
    FROM f
  `);

  // 2. ZERO LIGNE VEUT DIRE DOUBLON, ET RIEN D'AUTRE NE TOURNE.
  if (written.length === 0) {
    return duplicateAssignedAnswerResponse(signed.sessionId, signed.questionId);
  }

  const attemptIndex = written[0].attempt_index;
  const resolved = written[0].resolved_count;

  // 4. LA MAITRISE N'EST TOUCHEE QUE SOUS `update_mastery`, et seulement au
  // premier essai : une reussite apres reprise ne fait pas monter, c'est la regle
  // de l'entrainement personnel et elle ne change pas parce qu'un professeur a
  // donne l'exercice.
  if (writesMastery && attemptIndex === 1) {
    // UN UPSERT, ET C'EST UNE FAUTE REPAREE APRES MESURE. Ecrit en UPDATE seul, ce
    // bloc ne trouvait AUCUNE ligne pour une face que l'eleve n'a pas dans son
    // pool, et la maitrise gagnee dans le devoir etait perdue en silence.
    // Verifie sur la branche jetable : l'eleve de test n'avait aucune ligne
    // d'etat, un professeur pouvant parfaitement demander une face que le moteur
    // ne lui a jamais servie. C'est meme le cas normal d'un devoir.
    //
    // ET `in_active_pool` RESTE FAUX A L'INSERTION, ce qui est toute la frontiere
    // decidee le 2026-09-10 : une reponse de devoir ENREGISTRE la maitrise sans
    // faire entrer la face dans le pool personnel. Une ligne d'etat n'est pas une
    // appartenance au pool, la seule porte d'entree reste la regle du moteur, et
    // le professeur ne l'ouvre jamais. Sur conflit, la colonne n'est pas touchee :
    // une face deja dans le pool y reste.
    await sql`
      INSERT INTO user_typeface_state (
        user_id, typeface_slug, mastery_level, in_active_pool,
        total_seen, total_correct, total_wrong, consecutive_correct, first_seen_at, updated_at
      )
      VALUES (
        ${signed.userId}::uuid,
        ${signed.typefaceSlug},
        ${masteryAfterFirstTry}::smallint,
        false,
        1,
        ${isCorrect ? 1 : 0},
        ${isCorrect ? 0 : 1},
        ${isCorrect ? 1 : 0},
        now(),
        now()
      )
      ON CONFLICT (user_id, typeface_slug) DO UPDATE
         SET mastery_level = ${masteryAfterFirstTry}::smallint,
             total_seen = user_typeface_state.total_seen + 1,
             total_correct = user_typeface_state.total_correct + ${isCorrect ? 1 : 0},
             total_wrong = user_typeface_state.total_wrong + ${isCorrect ? 0 : 1},
             consecutive_correct = ${isCorrect ? 1 : 0} * (user_typeface_state.consecutive_correct + 1),
             updated_at = now()
    `;
  }

  const finished = isBudgetSpent(resolved, context.question_count);
  if (finished) {
    await closeIfOpen(signed.sessionId);
  }

  return { attemptIndex, isCorrect, resolved, finished, duplicate: false };
};

/** Ferme la seance si elle est encore ouverte, et n'ecrit jamais `duration_ms`. */
const closeIfOpen = (sessionId: string) => sql`
  UPDATE sessions
     SET status = 'completed', ended_at = now()
   WHERE session_id = ${sessionId}::uuid
     AND status = 'active'
`;
