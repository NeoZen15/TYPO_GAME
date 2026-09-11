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

export type SessionShape = {
  mode: string;
  n: number;
  completed: number;
  abandoned: number;
  open: number;
  stillborn: number;
  median_questions: number | null;
  median_seconds: number | null;
};

/**
 * La forme d'une seance, par mode.
 *
 * MEDIANE ET PAS MOYENNE. Une poignee de seances tres longues tire une moyenne
 * vers le haut et fait croire que tout le monde joue longtemps. La mediane dit ce
 * que vit la personne du milieu, qui est la question.
 *
 * LES MEDIANES NE PORTENT QUE SUR LES SEANCES TERMINEES, et cette restriction est
 * la mesure elle meme. Mesure du 2026-09-11 en production : la mediane de duree
 * toutes seances confondues valait 101 ms en competition et 141 ms en
 * entrainement, parce que 473 seances abandonnees ont une mediane de 81 ms. Une
 * seance nee et refermee en moins d'une seconde n'est pas une seance courte,
 * c'est une seance qui n'a jamais commence : la melanger aux autres remplacait
 * « une partie dure deux minutes » par « une partie dure un dixieme de seconde ».
 *
 * `stillborn` compte ces seances mortes-nees separement, parce qu'elles disent
 * quelque chose de vrai sur le produit : des centaines de seances ouvertes puis
 * refermees aussitot signalent un demarrage qui se rejoue, pas des joueurs qui
 * renoncent.
 */
export const sessionShapes = () =>
  rows<SessionShape>(sql`
    SELECT
      mode,
      count(*)::int AS n,
      count(*) FILTER (WHERE status = 'completed')::int AS completed,
      count(*) FILTER (WHERE status = 'abandoned')::int AS abandoned,
      count(*) FILTER (WHERE status = 'active')::int AS open,
      count(*) FILTER (WHERE duration_ms IS NOT NULL AND duration_ms < 1000)::int AS stillborn,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY question_count)
        FILTER (WHERE status = 'completed')::int AS median_questions,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms)
        FILTER (WHERE status = 'completed' AND duration_ms IS NOT NULL) / 1000.0)::int AS median_seconds
    FROM sessions
    GROUP BY mode
    ORDER BY n DESC
  `);

export type Arrival = { day: string; accounts: number };

/** Les arrivees, jour par jour, sur trente jours. Le detail d'une croissance. */
export const arrivals = () =>
  rows<Arrival>(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS accounts
    FROM users
    WHERE created_at > now() - interval '30 days'
    GROUP BY 1
    ORDER BY 1
  `);

export type MasteryDistribution = { mastery_level: number; n: number };

/**
 * La distribution des niveaux internes, tous utilisateurs confondus.
 *
 * C'est la mesure la plus directe de « est ce que la repetition espacee fait son
 * travail » : une population entiere bloquee au niveau 1 dit une chose, une
 * pyramide qui monte en dit une autre.
 */
export const masteryDistribution = () =>
  rows<MasteryDistribution>(sql`
    SELECT mastery_level, count(*)::int AS n
    FROM user_typeface_state
    GROUP BY mastery_level
    ORDER BY mastery_level
  `);

export type ExposureCurve = { exposure: number; first_tries: number; right_pct: number };

/**
 * LA COURBE QUI DIT SI LE PRODUIT APPREND QUELQUE CHOSE A QUELQU'UN.
 *
 * Pour chaque couple (personne, police), on numerote ses premiers essais dans
 * l'ordre : la premiere fois qu'elle voit cette police, la deuxieme, la
 * troisieme. Puis on regarde le taux de reussite a chaque rang. Si la
 * reconnaissance progresse avec l'exposition, la courbe monte. Si elle ne monte
 * pas, le moteur occupe les gens sans leur apprendre quoi que ce soit.
 *
 * Bornee aux rangs qui ont assez d'observations : au dela, la courbe ne repose
 * plus que sur quelques acharnes et ne dit plus rien de general.
 */
export const exposureCurve = (limit = 6) =>
  rows<ExposureCurve>(sql`
    WITH essais AS (
      SELECT
        user_id,
        typeface_slug,
        is_correct,
        row_number() OVER (
          PARTITION BY user_id, typeface_slug ORDER BY event_ts_utc, global_q_index
        ) AS exposure
      FROM user_event_fact
      WHERE event_type = 'answer' AND attempt_index = 1
    )
    SELECT
      exposure::int AS exposure,
      count(*)::int AS first_tries,
      round(100.0 * count(*) FILTER (WHERE is_correct) / count(*))::int AS right_pct
    FROM essais
    WHERE exposure <= ${limit}
    GROUP BY exposure
    HAVING count(*) >= ${SEUIL_POLICE}
    ORDER BY exposure
  `);

export type FamilyDifficulty = { sub_category: string; first_tries: number; right_pct: number };

/** Quelles familles resistent, tous utilisateurs confondus. */
export const familyDifficulty = () =>
  rows<FamilyDifficulty>(sql`
    SELECT
      tc.sub_category::text AS sub_category,
      count(*)::int AS first_tries,
      round(100.0 * count(*) FILTER (WHERE f.is_correct) / count(*))::int AS right_pct
    FROM user_event_fact f
    JOIN typefaces_core tc ON tc.typeface_slug = f.typeface_slug
    WHERE f.event_type = 'answer' AND f.attempt_index = 1
    GROUP BY tc.sub_category
    HAVING count(*) >= ${SEUIL_POLICE}
    ORDER BY right_pct ASC
  `);

/** Combien de polices jouables n'ont jamais ete demandees a personne. */
export const unseenFaces = async () => {
  const [row] = await rows<{ playable: number; seen: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM typefaces_core WHERE activation_status) AS playable,
      (SELECT count(DISTINCT typeface_slug)::int FROM user_event_fact WHERE event_type = 'answer') AS seen
  `);
  return { playable: row.playable, seen: row.seen, unseen: row.playable - row.seen };
};

export type ContextSplit = { context: string; sessions: number; answers: number };

/**
 * Entrainement personnel d'un cote, devoirs de l'autre.
 *
 * LES DEUX MONDES NE SE MELANGENT PAS, et c'est la premiere chose a verifier
 * quand une moyenne surprend : un devoir de controle et une seance libre ne
 * produisent pas la meme courbe, les additionner efface la difference.
 */
export const contextSplit = () =>
  rows<ContextSplit>(sql`
    SELECT
      s.context::text AS context,
      count(DISTINCT s.session_id)::int AS sessions,
      (SELECT count(*)::int FROM user_event_fact f
        WHERE f.context = s.context AND f.event_type = 'answer') AS answers
    FROM sessions s
    GROUP BY s.context
    ORDER BY sessions DESC
  `);

export type DailyActivity = { day: string; answers: number; players: number };

/** Ce qui se joue, jour par jour, sur trente jours. */
export const dailyActivity = () =>
  rows<DailyActivity>(sql`
    SELECT
      to_char(date_trunc('day', event_ts_utc), 'YYYY-MM-DD') AS day,
      count(*)::int AS answers,
      count(DISTINCT user_id)::int AS players
    FROM user_event_fact
    WHERE event_type = 'answer' AND event_ts_utc > now() - interval '30 days'
    GROUP BY 1
    ORDER BY 1
  `);

export type Retention = { cohort_size: number; came_back: number; came_back_7d: number };

/**
 * Est ce qu'ils reviennent.
 *
 * `came_back` compte les comptes dont l'activite s'etale sur au moins DEUX jours
 * differents. C'est la definition la plus severe et la plus honnete du retour :
 * une longue premiere visite reste une premiere visite.
 */
export const retention = async (): Promise<Retention> => {
  const [row] = await rows<Retention>(sql`
    WITH jours AS (
      SELECT user_id, count(DISTINCT date_trunc('day', event_ts_utc))::int AS days,
             max(event_ts_utc) AS last_seen
      FROM user_event_fact
      WHERE event_type = 'answer'
      GROUP BY user_id
    )
    SELECT
      count(*)::int AS cohort_size,
      count(*) FILTER (WHERE days >= 2)::int AS came_back,
      count(*) FILTER (WHERE days >= 2 AND last_seen > now() - interval '7 days')::int AS came_back_7d
    FROM jours
  `);
  return row;
};

/** Au dessous, une mediane par police ne repose pas sur assez de personnes. */
export const SEUIL_ETATS = 3;

/**
 * Les polices les MIEUX reconnues, meme seuil et meme regle que les plus ratees.
 * Les deux bouts de la meme mesure : une cartographie qui ne montre que ce qui
 * resiste ne dit pas ou le regard est deja installe.
 */
export const easiestFaces = (limit = 10) =>
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
    ORDER BY right_pct DESC, first_tries DESC
    LIMIT ${limit}
  `);

export type Repetitions = {
  typeface_slug: string;
  display_name: string;
  people: number;
  median_seen: number;
};

/**
 * COMBIEN DE FOIS IL FAUT VOIR UNE POLICE AVANT QU'ELLE TIENNE.
 *
 * Pour chaque police, on ne regarde que les personnes qui l'ont REELLEMENT
 * stabilisee (maitrise 4), et on prend la mediane du nombre de fois qu'elles
 * l'ont vue. Compter les personnes encore en chemin melangerait « difficile » et
 * « pas encore fini », qui ne sont pas la meme chose.
 *
 * C'est la mesure la plus directe du cout d'une police, et elle ne se deduit pas
 * du taux de reussite : une police reussie a 70 % du premier coup et une police
 * reussie a 70 % apres douze expositions demandent le meme effort a l'ecran et
 * un effort tres different au regard.
 */
export const repetitionsToStabilise = (limit = 12) =>
  rows<Repetitions>(sql`
    SELECT
      st.typeface_slug,
      tc.display_name,
      count(*)::int AS people,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY st.total_seen)::int AS median_seen
    FROM user_typeface_state st
    JOIN typefaces_core tc ON tc.typeface_slug = st.typeface_slug
    WHERE st.mastery_level = 4
    GROUP BY st.typeface_slug, tc.display_name
    HAVING count(*) >= ${SEUIL_ETATS}
    ORDER BY median_seen DESC, people DESC
    LIMIT ${limit}
  `);

export type ConfusionDistance = { relation: string; times: number };

/**
 * A QUELLE DISTANCE SE TROMPE-T-ON.
 *
 * Chaque erreur au premier essai est classee par la parente entre la police
 * MONTREE et celle qui a ete CHOISIE : meme groupe visuel, meme sous categorie,
 * meme grande categorie, ou rien de commun.
 *
 * CE QUE CETTE LECTURE DIAGNOSTIQUE VRAIMENT. L'echelle des leurres est censee
 * rapprocher les mauvaises reponses de la bonne a mesure que la maitrise monte.
 * Si la majorite des erreurs tombe dans « rien de commun », ce n'est pas le
 * regard qui echoue, c'est l'echelle qui ne propose pas ce qu'elle croit
 * proposer.
 *
 * CE QU'ELLE NE PEUT PAS DIRE, ET IL FAUT LE SAVOIR EN LA LISANT. Le journal
 * enregistre la reponse choisie, jamais les trois autres propositions. On voit
 * donc quels leurres ont ete PRIS, jamais combien de fois ils ont ete offerts et
 * refuses. Un leurre offert vingt fois et choisi deux fois se lit ici comme un
 * leurre choisi deux fois, ce qui n'est pas la meme phrase.
 */
export const confusionDistance = () =>
  rows<ConfusionDistance>(sql`
    SELECT
      CASE
        WHEN seen.visual_cluster_id IS NOT NULL
         AND seen.visual_cluster_id = chosen.visual_cluster_id THEN 'cluster'
        WHEN seen.sub_category = chosen.sub_category            THEN 'sub'
        WHEN seen.primary_category = chosen.primary_category    THEN 'primary'
        ELSE 'far'
      END AS relation,
      count(*)::int AS times
    FROM user_event_fact f
    JOIN typefaces_core seen ON seen.typeface_slug = f.typeface_slug
    JOIN typefaces_core chosen ON chosen.typeface_slug = f.answer_slug
    WHERE f.event_type = 'answer'
      AND f.attempt_index = 1
      AND f.is_correct = false
      AND f.answer_slug IS NOT NULL
    GROUP BY 1
    ORDER BY times DESC
  `);

export type ClusterDifficulty = {
  visual_cluster_id: string;
  members: number;
  first_tries: number;
  right_pct: number;
  sample: string;
};

/**
 * Les groupes visuels qui resistent.
 *
 * Le groupe visuel est la notion du MOTEUR : c'est lui qui sert a rapprocher les
 * leurres. Mesurer sa difficulte revient donc a mesurer si le moteur groupe ce
 * que le regard confond vraiment, ou seulement ce que la mesure geometrique a
 * rapproche.
 */
export const clusterDifficulty = (limit = 12) =>
  rows<ClusterDifficulty>(sql`
    SELECT
      tc.visual_cluster_id,
      (SELECT count(*)::int FROM typefaces_core m
        WHERE m.visual_cluster_id = tc.visual_cluster_id AND m.activation_status) AS members,
      count(*)::int AS first_tries,
      round(100.0 * count(*) FILTER (WHERE f.is_correct) / count(*))::int AS right_pct,
      min(tc.display_name) AS sample
    FROM user_event_fact f
    JOIN typefaces_core tc ON tc.typeface_slug = f.typeface_slug
    WHERE f.event_type = 'answer' AND f.attempt_index = 1
    GROUP BY tc.visual_cluster_id
    HAVING count(*) >= ${SEUIL_POLICE}
    ORDER BY right_pct ASC
    LIMIT ${limit}
  `);

export type EngineSignals = {
  answers: number;
  timeouts: number;
  invalid: number;
  retries: number;
  misread_shown: number;
  reading_shown: number;
  versions: { engine_version: string; n: number }[];
};

/**
 * CE QUE LE MOTEUR FAIT REELLEMENT SORTIR.
 *
 * Chaque nombre est un comportement du moteur, pas une performance de joueur :
 * un temps expire est une question laissee sans reponse, une reponse invalide est
 * une question mal formee ou un client qui envoie n'importe quoi, une reprise est
 * une deuxieme chance offerte. Si l'un de ces trois derape, ce n'est pas le
 * regard qui a change, c'est le moteur.
 *
 * `versions` compte les reponses par valeur de `engine_version`. ATTENTION A CE
 * QUE CE CHAMP CONTIENT : le nom du composeur ET sa revision, dans une seule
 * chaine (« training-provider-v1 »). Deux valeurs distinctes sont donc l'etat
 * normal, l'entrainement et la competition signant chacune la sienne. Ce qui
 * merite une alerte est deux revisions du MEME composeur, et c'est la page qui
 * fait cette lecture.
 */
export const engineSignals = async (): Promise<EngineSignals> => {
  const [signals] = await rows<Omit<EngineSignals, "versions">>(sql`
    SELECT
      count(*)::int AS answers,
      count(*) FILTER (WHERE reason_code = 'timeout')::int AS timeouts,
      count(*) FILTER (WHERE reason_code = 'invalid_answer')::int AS invalid,
      count(*) FILTER (WHERE attempt_index > 1)::int AS retries,
      count(*) FILTER (WHERE misread_shown)::int AS misread_shown,
      count(*) FILTER (WHERE reading_shown)::int AS reading_shown
    FROM user_event_fact
    WHERE event_type = 'answer'
  `);

  const versions = await rows<{ engine_version: string; n: number }>(sql`
    SELECT engine_version, count(*)::int AS n
    FROM user_event_fact
    WHERE event_type = 'answer'
    GROUP BY engine_version
    ORDER BY n DESC
  `);

  return { ...signals, versions };
};
