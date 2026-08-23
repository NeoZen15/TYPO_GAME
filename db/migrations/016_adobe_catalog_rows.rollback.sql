-- ============================================================
-- RETOUR ARRIERE de la migration 016
-- Genere par scripts/build_adobe_catalog_migration.py le 2026-08-23
-- ============================================================
--
-- Eteint les 104 lignes creees par la 016 et rend aux 4 lignes rallumees
-- l'etat exact qui etait le leur avant : eteintes, source 'local', licence
-- 'proprietary'. Les lignes creees ne sont pas supprimees mais desactivees :
-- user_typeface_state peut deja les referencer, et ses cles etrangeres sont en
-- ON DELETE RESTRICT (003_users_sessions_pool.sql). Une ligne eteinte ne sort
-- plus d'aucun pool, ce qui est le seul effet recherche.
--
-- Les deux valeurs d'enum de la 015 restent en place : PostgreSQL ne sait pas
-- retirer une valeur d'enum, et elles sont inertes des lors qu'aucune ligne
-- active ne les porte.

BEGIN;

UPDATE typefaces_core SET
  activation_status = false,
  qa_status = 'deprecated',
  updated_at_utc = now()
WHERE font_source = 'adobe'
  AND typeface_slug NOT IN ('arial', 'courier_new', 'georgia', 'times_new_roman');

UPDATE typefaces_core SET
  font_source = 'local',
  license_type = 'proprietary',
  activation_status = false,
  fallback_stack = NULL,
  updated_at_utc = now()
WHERE typeface_slug = 'arial';
UPDATE typefaces_core SET
  font_source = 'local',
  license_type = 'proprietary',
  activation_status = false,
  fallback_stack = NULL,
  updated_at_utc = now()
WHERE typeface_slug = 'courier_new';
UPDATE typefaces_core SET
  font_source = 'local',
  license_type = 'proprietary',
  activation_status = false,
  fallback_stack = NULL,
  updated_at_utc = now()
WHERE typeface_slug = 'georgia';
UPDATE typefaces_core SET
  font_source = 'local',
  license_type = 'proprietary',
  activation_status = false,
  fallback_stack = NULL,
  updated_at_utc = now()
WHERE typeface_slug = 'times_new_roman';

COMMIT;
