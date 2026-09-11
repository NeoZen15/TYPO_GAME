import "server-only";

import { sql } from "@/lib/server/neon";

// LE POSTE D'OBSERVATION DU PRODUIT.
//
// Ce module ne rend visible QUE ce que le systeme collecte deja : le journal des
// reponses, les seances, les comptes et l'etat de repetition espacee. Rien n'est
// estime, rien n'est extrapole, et aucune vue ne s'invente une donnee qui
// n'existe pas encore.
//
// REGIME DES ANALYSES INTERNES (I-24). Ces lectures sont celles de l'OPERATEUR du
// produit, pas celles d'un professeur : la confidentialite interdit la lecture
// institutionnelle de l'entrainement personnel, elle n'interdit pas d'ameliorer
// le produit avec ses propres donnees. Deux consequences tenues ici : aucune
// lecture ne nomme un utilisateur, tout est agrege ; et les petites cohortes sont
// **masquees**, ce qui sur un produit jeune est la regle et non l'exception.
//
// POURQUOI LE SEUIL EST AFFICHE ET NON CACHE. Mesure du 2026-09-11 en production :
// 885 premiers essais repartis sur 333 polices, donc moins de trois essais par
// police en moyenne, et seulement 16 polices depassent dix essais. Un classement
// des polices les plus ratees calcule la dessus serait du bruit presente comme un
// resultat. Chaque chiffre sort donc avec son effectif, et ce qui n'atteint pas le
// seuil n'est pas classe du tout.

const rows = async <T>(query: Promise<unknown>) => (await query) as T[];

/** En dessous, on ne classe pas. Un chiffre sans effectif suffisant est du bruit. */
export const SEUIL_POLICE = 10;
export const SEUIL_PAIRE = 3;

export type ProductHealth = {
  accounts: number;
  accounts_30d: number;
  active_30d: number;
  active_7d: number;
  sessions: number;
  sessions_completed: number;
  sessions_open: number;
  answers: number;
  first_tries: number;
  first_try_right_pct: number | null;
  median_answer_ms: number | null;
  questions_per_session: number | null;
  by_mode: { mode: string; n: number }[];
};

/**
 * La sante du produit, en une requete.
 *
 * LA QUESTION A LAQUELLE ELLE REPOND, et c'est la seule qui compte au debut :
 * est ce que les gens jouent, ou est ce qu'ils creent un compte et disparaissent ?
 * D'ou la presence, cote a cote, des comptes crees, des comptes actifs, des
 * seances ouvertes et des seances terminees.
 */
export const productHealth = async (): Promise<ProductHealth> => {
  const [health] = await rows<Omit<ProductHealth, "by_mode">>(sql`
    SELECT
      (SELECT count(*)::int FROM users) AS accounts,
      (SELECT count(*)::int FROM users WHERE created_at > now() - interval '30 days') AS accounts_30d,
      (SELECT count(DISTINCT user_id)::int FROM user_event_fact
        WHERE event_ts_utc > now() - interval '30 days') AS active_30d,
      (SELECT count(DISTINCT user_id)::int FROM user_event_fact
        WHERE event_ts_utc > now() - interval '7 days') AS active_7d,
      (SELECT count(*)::int FROM sessions) AS sessions,
      (SELECT count(*)::int FROM sessions WHERE status = 'completed') AS sessions_completed,
      (SELECT count(*)::int FROM sessions WHERE status = 'active') AS sessions_open,
      (SELECT count(*)::int FROM user_event_fact WHERE event_type = 'answer') AS answers,
      (SELECT count(*)::int FROM user_event_fact
        WHERE event_type = 'answer' AND attempt_index = 1) AS first_tries,
      (SELECT CASE WHEN count(*) = 0 THEN NULL
                   ELSE round(100.0 * count(*) FILTER (WHERE is_correct) / count(*))::int END
         FROM user_event_fact WHERE event_type = 'answer' AND attempt_index = 1) AS first_try_right_pct,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY response_time_ms)::int
         FROM user_event_fact WHERE event_type = 'answer' AND attempt_index = 1) AS median_answer_ms,
      (SELECT round(avg(question_count))::int FROM sessions WHERE question_count > 0) AS questions_per_session
  `);

  const by_mode = await rows<{ mode: string; n: number }>(sql`
    SELECT mode, count(*)::int AS n FROM sessions GROUP BY mode ORDER BY n DESC
  `);

  return { ...health, by_mode };
};

export type HardFace = {
  typeface_slug: string;
  display_name: string;
  first_tries: number;
  right_pct: number;
};

/**
 * Les polices les plus ratees au premier essai, et JAMAIS celles qu'on a trop peu
 * vues. L'effectif voyage avec le taux : sans lui, un 0 % sur deux reponses se lit
 * comme un 0 % sur deux cents.
 */
export const hardestFaces = (limit = 10) =>
  rows<HardFace>(sql`
    SELECT
      f.typeface_slug,
      tc.display_name,
      count(*)::int AS first_tries,
      round(100.0 * count(*) FILTER (WHERE f.is_correct) / count(*))::int AS right_pct
    FROM user_event_fact f
    JOIN typefaces_core tc ON tc.typeface_slug = f.typeface_slug
    WHERE f.event_type = 'answer' AND f.attempt_index = 1
    GROUP BY f.typeface_slug, tc.display_name
    HAVING count(*) >= ${SEUIL_POLICE}
    ORDER BY right_pct ASC, first_tries DESC
    LIMIT ${limit}
  `);

export type TopConfusion = {
  seen_name: string;
  chosen_name: string;
  times: number;
};

/**
 * Les paires qui reviennent, tout le produit confondu.
 *
 * LA MATIERE LA PLUS UTILE DU JOURNAL, et elle n'a jamais demande de colonne
 * supplementaire : la reponse choisie est enregistree a cote de la reponse
 * attendue depuis le premier jour. Bornee aux premiers essais, une erreur de
 * reprise etant un tatonnement et pas une confusion.
 */
export const topConfusions = (limit = 8) =>
  rows<TopConfusion>(sql`
    SELECT
      seen.display_name AS seen_name,
      chosen.display_name AS chosen_name,
      count(*)::int AS times
    FROM user_event_fact f
    JOIN typefaces_core seen ON seen.typeface_slug = f.typeface_slug
    JOIN typefaces_core chosen ON chosen.typeface_slug = f.answer_slug
    WHERE f.event_type = 'answer'
      AND f.attempt_index = 1
      AND f.is_correct = false
      AND f.answer_slug IS NOT NULL
    GROUP BY seen.display_name, chosen.display_name
    HAVING count(*) >= ${SEUIL_PAIRE}
    ORDER BY times DESC, seen.display_name
    LIMIT ${limit}
  `);

export type LearningShape = {
  states: number;
  stabilised: number;
  in_pool: number;
  relapses: number;
  faces_seen: number;
  faces_above_threshold: number;
};

/**
 * La forme de l'apprentissage, telle que l'etat de repetition espacee la porte.
 *
 * `relapses` compte les rechutes reelles : une reponse dont la maitrise part de 4
 * et redescend. C'est la seule facon de savoir si une police tient vraiment ou si
 * elle s'effondre des qu'on la revoit, et le journal la porte deja.
 */
export const learningShape = async (): Promise<LearningShape> => {
  const [shape] = await rows<LearningShape>(sql`
    SELECT
      (SELECT count(*)::int FROM user_typeface_state) AS states,
      (SELECT count(*)::int FROM user_typeface_state WHERE mastery_level = 4) AS stabilised,
      (SELECT count(*)::int FROM user_typeface_state WHERE in_active_pool) AS in_pool,
      (SELECT count(*)::int FROM user_event_fact
        WHERE event_type = 'answer' AND mastery_before = 4 AND mastery_after < 4) AS relapses,
      (SELECT count(DISTINCT typeface_slug)::int FROM user_event_fact
        WHERE event_type = 'answer') AS faces_seen,
      (SELECT count(*)::int FROM (
        SELECT typeface_slug FROM user_event_fact
        WHERE event_type = 'answer' AND attempt_index = 1
        GROUP BY typeface_slug HAVING count(*) >= ${SEUIL_POLICE}
      ) x) AS faces_above_threshold
  `);
  return shape;
};
