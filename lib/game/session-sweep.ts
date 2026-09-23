import "server-only";

import { sql } from "@/lib/server/neon";

// LE BALAYAGE GLOBAL DES SESSIONS RESTEES OUVERTES.
//
// POURQUOI IL A FALLU EN ECRIRE UN SECOND. Un balayage existait deja, dans
// `lib/game/training/provider.ts` et son jumeau competition, et il marche : au
// demarrage d'une partie, il referme les sessions du MEME joueur restees actives
// depuis plus de trente minutes. Il est greffe la parce qu'il est gratuit a cet
// endroit, et c'etait le bon reflexe.
//
// CE QU'IL NE PEUT PAS FAIRE, ET LA MESURE QUI LE PROUVE. Il est borne sur
// `user_id` et ne s'execute qu'au prochain demarrage de ce joueur la. Qui joue une
// fois et ne revient jamais n'a donc pas de prochain demarrage, et sa session
// reste `active` pour toujours. Mesure du 2026-09-21 en production : **30 sessions
// actives, la plus ancienne ouverte depuis le 26 aout**, 21 en competition et 9 en
// entrainement. Ce n'est pas une exception : 219 comptes sur 271 n'ont qu'une
// seule session, donc l'immense majorite des abandons ne sera jamais balayee par
// le chemin existant.
//
// CE QUE CA FAUSSE. `sessions.status` est faux pour ces lignes, et l'Admin les
// compte comme des parties en cours alors que personne ne joue depuis un mois.
// Une mesure fausse sur laquelle on prend des decisions est pire qu'une mesure
// absente.
//
// CE BALAYAGE CI N'EST BORNE SUR PERSONNE. C'est toute sa raison d'etre, et c'est
// aussi pourquoi il ne s'appelle pas depuis une requete de joueur : il tourne
// depuis `/api/cron/sweep`, une fois par jour.
//
// `ended_at` EST HONNETE, comme dans le balayage d'origine : il vaut la date du
// DERNIER EVENEMENT de la session, et la date de debut seulement si la session
// n'a jamais rien journalise. On n'ecrit jamais `now()`, qui daterait la fin au
// moment du balayage et inventerait une duree que personne n'a vecue. C'est la
// meme regle qui fait que `duration_ms` d'une session abandonnee sans reponse
// mesure la latence entre deux INSERT et non un temps reel : le savoir evite de
// relire ce chiffre comme un comportement.

/** Trente minutes sans rien, et la session est consideree abandonnee. */
const SEUIL_MINUTES = 30;

export type ResultatBalayage = {
  fermees: number;
  seuilMinutes: number;
};

/**
 * Referme toutes les sessions actives inactives depuis le seuil, quel que soit
 * leur joueur et leur mode. Idempotent : relance sans effet s'il ne reste rien.
 */
export const balayerSessionsOuvertes = async (): Promise<ResultatBalayage> => {
  const lignes = await sql`
    UPDATE sessions AS s
    SET status = 'abandoned'::app.session_status_enum,
        ended_at = COALESCE(
          (
            SELECT MAX(uef.event_ts_utc)
            FROM user_event_fact uef
            WHERE uef.session_id = s.session_id
          ),
          s.started_at
        )
    WHERE s.status = 'active'
      AND s.started_at < now() - ${`${SEUIL_MINUTES} minutes`}::interval
    RETURNING s.session_id
  `;

  return { fermees: lignes.length, seuilMinutes: SEUIL_MINUTES };
};

/** Combien seraient fermees, sans rien ecrire. */
export const compterSessionsOuvertes = async (): Promise<number> => {
  const [ligne] = (await sql`
    SELECT count(*)::int AS n
    FROM sessions
    WHERE status = 'active'
      AND started_at < now() - ${`${SEUIL_MINUTES} minutes`}::interval
  `) as { n: number }[];

  return ligne?.n ?? 0;
};
