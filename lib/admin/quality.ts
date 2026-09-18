import "server-only";

import { sql } from "@/lib/admin/guarded-sql";

// CE QUI FAIT DOUTER D'UN CHIFFRE.
//
// Une page d'analyse ne vaut que si l'on sait quand ne PAS la croire. Ce module
// ne mesure donc pas le produit, il mesure la donnee : ce qui est reste coince,
// ce qui est tombe a cote, ce qui ne se recoupe pas. Chaque lecture repond a
// « est ce que ce nombre est encore fiable », et rien d'autre.
//
// CHAQUE CONTROLE EST UNE PHRASE FAUSSE QU'ON CHERCHE A PRENDRE EN DEFAUT. Un
// controle qui ne peut jamais rien trouver ne controle rien : on lui donne donc
// une valeur attendue explicite, et l'ecart est ce qui s'affiche.

const rows = async <T>(query: Promise<unknown>) => (await query) as T[];

export type DataHealth = {
  sessions_stuck: number;
  sessions_no_questions: number;
  sessions_mismatch: number;
  events_orphan: number;
  events_default_partition: number;
  guard_rows: number;
  guard_oldest_days: number | null;
  faces_playable: number;
  faces_without_asset: number;
  faces_alone_in_cluster: number;
  states_orphan: number;
};

/**
 * L'etat de la donnee, en une requete.
 *
 * `sessions_mismatch` est le controle le plus utile des six : il compare le
 * compteur porte par la seance au nombre de premiers essais reellement
 * journalises. Les deux sont ecrits par la meme instruction atomique, donc un
 * ecart ne veut pas dire « approximation », il veut dire qu'une ecriture s'est
 * passee ailleurs que la ou on croit.
 *
 * `events_default_partition` compte les lignes tombees dans la partition par
 * defaut : une date hors des mois declares. Zero aujourd'hui, et le jour ou ce
 * n'est plus zero, les partitions de l'annee suivante manquent.
 *
 * `faces_without_asset` EXCLUT LES POLICES ADOBE, et cette exclusion est le
 * controle lui meme. Une police Adobe se rend par le nom de famille que sa
 * feuille de style declare : elle n'a pas de fichier chez nous, et ne pas
 * l'exclure faisait remonter 108 polices parfaitement saines comme une avarie.
 * Mesure du 2026-09-11 : c'etait exactement le compte du kit. Un controle qui
 * signale le fonctionnement normal est pire qu'aucun controle, parce qu'on
 * apprend a ne plus le lire.
 *
 * `faces_alone_in_cluster` compte les polices jouables SEULES dans leur groupe
 * visuel. Le groupe visuel est ce qui permet au moteur de proposer un leurre
 * proche : une police seule dans le sien n'a aucun voisin a proposer, et sa
 * question sera toujours plus facile qu'elle ne devrait l'etre. Ce n'est pas une
 * corruption de donnee, c'est un trou dans le catalogue, et il se voit ici parce
 * qu'il fausse une mesure ailleurs.
 */
export const dataHealth = async (): Promise<DataHealth> => {
  const [row] = await rows<DataHealth>(sql`
    SELECT
      (SELECT count(*)::int FROM sessions
        WHERE status = 'active' AND started_at < now() - interval '24 hours') AS sessions_stuck,
      (SELECT count(*)::int FROM sessions WHERE question_count = 0) AS sessions_no_questions,
      (SELECT count(*)::int FROM sessions s
        WHERE s.question_count <> (
          SELECT count(*) FROM user_event_fact f
           WHERE f.session_id = s.session_id AND f.event_type = 'answer' AND f.attempt_index = 1
        )) AS sessions_mismatch,
      (SELECT count(*)::int FROM user_event_fact f
        WHERE NOT EXISTS (SELECT 1 FROM sessions s WHERE s.session_id = f.session_id)) AS events_orphan,
      (SELECT count(*)::int FROM uef_default) AS events_default_partition,
      (SELECT count(*)::int FROM event_ingestion_guard) AS guard_rows,
      (SELECT extract(day FROM now() - min(received_at_utc))::int FROM event_ingestion_guard) AS guard_oldest_days,
      (SELECT count(*)::int FROM typefaces_core WHERE activation_status) AS faces_playable,
      (SELECT count(*)::int FROM typefaces_core tc
        WHERE tc.activation_status
          AND tc.font_source::text <> 'adobe'
          AND NOT EXISTS (SELECT 1 FROM font_runtime_assets a
                           WHERE a.typeface_slug = tc.typeface_slug)) AS faces_without_asset,
      (SELECT count(*)::int FROM typefaces_core tc
        WHERE tc.activation_status
          AND NOT EXISTS (SELECT 1 FROM typefaces_core o
                           WHERE o.visual_cluster_id = tc.visual_cluster_id
                             AND o.activation_status
                             AND o.typeface_slug <> tc.typeface_slug)) AS faces_alone_in_cluster,
      (SELECT count(*)::int FROM user_typeface_state st
        WHERE NOT EXISTS (SELECT 1 FROM typefaces_core tc
                           WHERE tc.typeface_slug = st.typeface_slug)) AS states_orphan
  `);
  return row;
};

export type Partition = { name: string; bound: string };

/**
 * Jusqu'a quand le journal a de la place.
 *
 * Les partitions sont declarees a la main, mois par mois. La derniere borne est
 * donc une date d'expiration : passee celle ci, tout tombe dans la partition par
 * defaut, ou plus rien n'est range. Cette lecture existe pour que cette date se
 * voie avant, pas apres.
 *
 * La borne sort TELLE QUELLE, sans expression reguliere dans le SQL : la lire en
 * TypeScript coute une ligne et evite qu'une echappe voyage a travers un gabarit
 * de chaine avant d'arriver a Postgres.
 */
export const partitions = () =>
  rows<Partition>(sql`
    SELECT c.relname::text AS name, pg_get_expr(c.relpartbound, c.oid) AS bound
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    WHERE p.relname = 'user_event_fact'
    ORDER BY c.relname
  `);

/**
 * Le dernier jour couvert par une partition declaree, ou `null` s'il n'y en a
 * aucune. Au dela de cette date, le journal continue d'accepter des lignes mais
 * les range dans la partition par defaut.
 */
export const coverageEnd = (list: Partition[]): string | null => {
  const bounds = list
    .map((partition) => /TO \('([0-9-]+)/.exec(partition.bound)?.[1])
    .filter((day): day is string => day !== undefined)
    .sort();
  return bounds.at(-1) ?? null;
};
