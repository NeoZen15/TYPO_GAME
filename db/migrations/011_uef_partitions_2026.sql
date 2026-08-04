-- ============================================================
-- MIGRATION 011 — partitions mensuelles manquantes de user_event_fact
-- JEUX DE TYPO
-- Requiert : migration 001 appliquee (table partitionnee + uef_default)
-- PostgreSQL 13+ (Neon)
-- ============================================================
--
-- NON APPLIQUEE. Ce fichier n'a PAS ete execute. La base Neon est en production,
-- l'application demande le feu vert explicite du proprietaire du projet.
--
-- POURQUOI. user_event_fact est partitionnee par RANGE (event_ts_utc) et la
-- migration 001 ne declare que uef_2026_03, uef_2026_04, uef_2026_05, plus la
-- partition fourre tout uef_default. Nous sommes en juillet 2026 : tous les
-- evenements depuis le 1er juin 2026 tombent dans uef_default. Rien n'est casse,
-- les ecritures et les lectures fonctionnent, ce n'est pas une urgence
-- fonctionnelle.
--
-- POURQUOI MAINTENANT MALGRE TOUT. La dette a une propriete desagreable :
-- PostgreSQL refuse de creer une partition dont la plage recouvre des lignes deja
-- presentes dans la partition par defaut. Il faut donc sortir ces lignes de
-- uef_default avant, dans la meme transaction. Plus on attend, plus le
-- deplacement porte sur des lignes nombreuses.
--
-- ORDRE D'EXECUTION IMPERATIF, c'est le coeur de ce fichier.
--   1. Sortir de uef_default les lignes de juin 2026 a decembre 2026.
--   2. Creer les sept partitions mensuelles.
--   3. Reinserer les lignes sorties, que le routage envoie dans la bonne
--      partition.
-- Les trois etapes tiennent dans UNE SEULE transaction, volontairement : entre
-- l'etape 1 et l'etape 3, ces evenements n'existent nulle part. Ne pas decouper
-- ce fichier, ne pas l'executer instruction par instruction.
--
-- CE QUI N'EST PAS TOUCHE. uef_default reste en place, elle est le filet des mois
-- futurs non declares. Les index sont declares sur la table partitionnee
-- (migration 001), donc chaque nouvelle partition herite automatiquement de
-- uq_event_id, idx_uef_user_time, idx_uef_session, idx_uef_typeface et
-- idx_uef_mode_user : rien a creer a la main ici.
--
-- IDEMPOTENCE. CREATE TABLE IF NOT EXISTS, et un DELETE qui ne trouve plus rien a
-- deplacer au second passage. Reappliquer la migration est sans effet.
--
-- APRES 2026. Ce fichier s'arrete a decembre 2026 pour rester lisible. Le check
-- scripts/quality/check-event-partitions.mjs echoue des que le mois courant n'a
-- plus de partition declaree, donc la porte reclamera une migration 0xx pour 2027
-- au lieu de laisser la dette revenir en silence.

BEGIN;

-- ============================================================
-- 0. Verrou. Le temps du deplacement, personne d'autre n'ecrit.
-- ============================================================

LOCK TABLE user_event_fact IN ACCESS EXCLUSIVE MODE;

-- ============================================================
-- 1. Sortie des lignes de uef_default couvertes par les nouvelles plages
--    Table temporaire : elle disparait a la fin de la session, et de toute
--    facon la transaction est atomique.
-- ============================================================

CREATE TEMP TABLE uef_moved_011 AS
WITH moved AS (
  DELETE FROM uef_default
  WHERE event_ts_utc >= '2026-06-01'
    AND event_ts_utc <  '2027-01-01'
  RETURNING *
)
SELECT * FROM moved;

-- ============================================================
-- 2. Partitions mensuelles, juin 2026 a decembre 2026
--    Meme style de declaration que la migration 001.
-- ============================================================

CREATE TABLE IF NOT EXISTS uef_2026_06 PARTITION OF user_event_fact
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS uef_2026_07 PARTITION OF user_event_fact
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS uef_2026_08 PARTITION OF user_event_fact
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS uef_2026_09 PARTITION OF user_event_fact
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS uef_2026_10 PARTITION OF user_event_fact
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS uef_2026_11 PARTITION OF user_event_fact
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS uef_2026_12 PARTITION OF user_event_fact
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- ============================================================
-- 3. Reinsertion. Le routage de la table partitionnee place chaque ligne dans
--    sa partition mensuelle.
-- ============================================================

-- La liste de colonnes est OBLIGATOIRE ici, et son absence etait un defaut
-- bloquant. `uef_moved_011` vient d'un DELETE ... RETURNING *, elle porte donc
-- les 24 colonnes de user_event_fact, `is_retry` comprise. Or `is_retry` est
-- GENERATED ALWAYS AS (...) STORED depuis 001b_event_type.sql, et PostgreSQL
-- refuse toute valeur non DEFAULT sur une colonne generee. Un SELECT * aurait
-- donc fait echouer l'etape 3 a l'interieur de la transaction, apres que les
-- lignes ont ete retirees de uef_default : rollback complet, aucune perte, mais
-- aucune partition creee non plus, et la dette continuait de grossir.
-- `is_retry` est volontairement absente de la liste : la base la recalcule
-- depuis attempt_index, a l'identique.
-- Les 23 colonnes inscriptibles, dans l'ordre du catalogue, releve en base le
-- 2026-08-01. La 24e, `is_retry`, est la colonne generee et n'apparait donc ni
-- ici ni dans le SELECT.
INSERT INTO user_event_fact (
  event_id, idempotency_key, event_ts_utc, ingested_at_utc,
  user_id, session_id, mode, global_q_index,
  question_id, attempt_index, typeface_slug, answer_slug, is_correct,
  response_time_ms, mastery_before, mastery_after,
  misread_shown, reading_shown, display_word, reason_code,
  seed, engine_version, event_type
)
SELECT
  event_id, idempotency_key, event_ts_utc, ingested_at_utc,
  user_id, session_id, mode, global_q_index,
  question_id, attempt_index, typeface_slug, answer_slug, is_correct,
  response_time_ms, mastery_before, mastery_after,
  misread_shown, reading_shown, display_word, reason_code,
  seed, engine_version, event_type
FROM uef_moved_011;

DROP TABLE uef_moved_011;

COMMIT;

-- ============================================================
-- 4. Verification manuelle apres application (aucune ecriture)
-- ============================================================

-- Compte par partition, uef_default doit ne plus rien porter pour 2026-06 et apres :
-- SELECT tableoid::regclass AS partition, count(*)
-- FROM user_event_fact
-- GROUP BY 1
-- ORDER BY 1;

-- Liste des partitions attachees :
-- SELECT c.relname
-- FROM pg_class c
-- JOIN pg_inherits i ON i.inhrelid = c.oid
-- JOIN pg_class p ON p.oid = i.inhparent
-- WHERE p.relname = 'user_event_fact'
-- ORDER BY c.relname;
