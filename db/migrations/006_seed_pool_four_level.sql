-- ============================================================
-- MIGRATION 006 — seed cold-start a 4 niveaux + palier hard (tier C)
-- JEUX DE TYPO
-- Requiert : migrations 001..005 appliquees
-- ============================================================
--
-- POURQUOI. La 005 ne differencie le seed que de facon BINAIRE :
-- v_hard = familiarite IN ('Quite familiar','Designer'). Deux consequences :
--   1. "Not at all" et "A little" produisent le MEME pool (aucune distinction
--      debutant vrai vs debutant qui connait deja quelques termes).
--   2. "Quite familiar" et "Designer" produisent le MEME pool, et surtout
--      SANS aucun specimen hard : le set N+D common ne contient que easy/medium
--      (verifie en base : easy 296, medium 852, hard 0 sur tier N+D common).
-- Le seul reservoir de specimens hard est le tier C (18 typos actives, toutes
-- 'uncommon', toutes runtime-ready woff2, verifie en lecture seule). Il n'existe
-- AUCUNE typo tier C 'common' dans le catalogue : restreindre a "tier C common"
-- n'ajouterait donc zero hard. Pour livrer reellement des specimens hard aux
-- niveaux avances, on inclut le tier C (rarite 'uncommon') UNIQUEMENT pour eux.
--
-- CE QUE FAIT 006. CREATE OR REPLACE de la SEULE surcharge familiarity-aware
-- init_user_pool(uuid, text). Meme signature que 004/005 : aucun changement de
-- code applicatif (provider appelle deja init_user_pool(user_id, familiarite)).
-- La surcharge de base init_user_pool(uuid) (sans familiarite, chemin "aucun
-- signal") reste celle de 005, inchangee.
--
-- MODELE. Quotas explicites easy/medium/hard par niveau (somme = 30), chaque
-- bucket difficulte reparti en round-robin par primary_category (diversite,
-- conforme spec moteur §7.1 : couvrir >= 2 categories ; complement tier D common
-- deja inclus). Les niveaux debutants n'ouvrent jamais le tier C (v_allow_hard
-- reste faux), donc ils ne peuvent structurellement pas recevoir de hard.
--
--   Niveau            easy  medium  hard   (verifie read-only, total 30)
--   Not at all         22      8      0
--   A little           12     18      0
--   Quite familiar      4     20      6
--   Designer            2     16     12
--
-- Comparaison AVANT (005) : Not at all == A little (16/14/0) ;
--   Quite familiar == Designer (1/29/0, aucun hard). 006 rend les 4 distincts
--   et introduit le palier hard en haut de l'echelle.
--
-- DEVIATION ASSUMEE vs §7.2. La table de compatibilite rarity x niveau Dreyfus
-- reserve le tier C 'uncommon' aux utilisateurs de niveau Dreyfus C+. Ici on
-- l'ouvre au SEED de cold-start pour les joueurs qui se declarent avances : la
-- familiarite est un prior de cold-start (le moteur ne peut pas l'inferer avant
-- la 1re manche), et le raffinement "inclure tier C pour obtenir du hard" est
-- explicitement prevu par la checklist. La compatibilite normale continue de
-- s'appliquer aux ENTREES ulterieures dans le pool (regles §7.2 inchangees).
--
-- Additif/idempotent (CREATE OR REPLACE). N'affecte que les futurs cold-starts
-- (ensureUserPool ne re-seede pas un pool deja rempli, cf. note re-seed C3).

CREATE OR REPLACE FUNCTION init_user_pool(p_user_id uuid, p_familiarity text)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  v_count      int := 0;
  v_rows       int := 0;
  v_slug       text;
  v_easy_q     int;
  v_med_q      int;
  v_hard_q     int;
  v_allow_hard boolean;
BEGIN
  -- Quotas par niveau (somme = 30). Le 'ELSE' couvre "A little" ET toute valeur
  -- inconnue : c'est le repli documente (OnboardingFlow / GameScreen retombent
  -- aussi sur "A little"). "Not at all" est plus facile encore que ce repli.
  IF p_familiarity = 'Not at all' THEN
    v_easy_q := 22; v_med_q := 8;  v_hard_q := 0;
  ELSIF p_familiarity = 'Quite familiar' THEN
    v_easy_q := 4;  v_med_q := 20; v_hard_q := 6;
  ELSIF p_familiarity = 'Designer' THEN
    v_easy_q := 2;  v_med_q := 16; v_hard_q := 12;
  ELSE
    v_easy_q := 12; v_med_q := 18; v_hard_q := 0;
  END IF;

  v_allow_hard := v_hard_q > 0;

  FOR v_slug IN
    WITH eligible AS (
      SELECT
        typeface_slug,
        primary_category,
        difficulty_base,
        ROW_NUMBER() OVER (
          PARTITION BY difficulty_base, primary_category
          ORDER BY dreyfus_tier, rarity_tag, typeface_slug
        ) AS cat_rank
      FROM typefaces_core
      WHERE activation_status = true
        AND (
          -- Socle easy/medium : tier N+D common (conforme 005 / spec §7.1).
          (rarity_tag = 'common' AND dreyfus_tier IN ('N', 'D'))
          -- Reservoir hard : tier C, ouvert seulement aux niveaux avances.
          OR (v_allow_hard AND dreyfus_tier = 'C')
        )
    ),
    picked_easy AS (
      SELECT typeface_slug FROM eligible
      WHERE difficulty_base = 'easy'
      ORDER BY cat_rank, primary_category, typeface_slug
      LIMIT v_easy_q
    ),
    picked_medium AS (
      SELECT typeface_slug FROM eligible
      WHERE difficulty_base = 'medium'
      ORDER BY cat_rank, primary_category, typeface_slug
      LIMIT v_med_q
    ),
    picked_hard AS (
      SELECT typeface_slug FROM eligible
      WHERE difficulty_base = 'hard'
      ORDER BY cat_rank, primary_category, typeface_slug
      LIMIT v_hard_q
    )
    SELECT typeface_slug FROM picked_easy
    UNION ALL SELECT typeface_slug FROM picked_medium
    UNION ALL SELECT typeface_slug FROM picked_hard
  LOOP
    INSERT INTO user_typeface_state (
      user_id, typeface_slug, mastery_level, next_due_after_q,
      interval_questions, in_active_pool, unlocked_at
    ) VALUES (p_user_id, v_slug, 0, 0, 0, true, now())
    ON CONFLICT (user_id, typeface_slug) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_count := v_count + v_rows;
  END LOOP;

  RETURN v_count;
END;
$$;
