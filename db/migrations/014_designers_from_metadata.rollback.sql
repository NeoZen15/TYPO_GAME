-- ============================================================
-- RETOUR ARRIERE de la migration 014
-- Genere le 2026-08-26
-- ============================================================
--
-- La 014 ne remplit que les designers VIDES, jamais elle n'ecrase : chacun de ses
-- 23 ordres porte la clause (designer IS NULL OR designer = ''). Le retour arriere
-- peut donc remettre NULL sans risque de detruire une saisie faite a la main, a la
-- condition d'etre joue AVANT toute autre ecriture sur ces 23 lignes.
--
-- Verifie le 2026-08-26 sur la base : les 23 slugs existent, aucun n'est
-- une ligne Adobe, et les 23 avaient bien un designer vide avant application.

BEGIN;

UPDATE typefaces_core SET
  designer = NULL,
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY['abril_fatface', 'anton', 'bebas_neue', 'dm_sans', 'ibm_plex_sans', 'inter', 'jetbrains_mono', 'lato', 'libre_baskerville', 'merriweather', 'montserrat', 'nunito', 'open_sans', 'oswald', 'playfair_display', 'poppins', 'pt_serif', 'raleway', 'roboto', 'roboto_mono', 'source_code_pro', 'source_sans_3', 'work_sans']);

COMMIT;
