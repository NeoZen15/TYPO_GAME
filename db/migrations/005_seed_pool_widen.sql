-- ============================================================
-- MIGRATION 005 — élargir le pool de cold-start (tier N + D common)
-- JEUX DE TYPO
-- Requiert : migrations 001..004 appliquées
-- ============================================================
--
-- POURQUOI. Le set éligible « actif · tier N · common » ne compte que 25 typos,
-- alors que init_user_pool en seede 30 → tous les joueurs (et tous les niveaux
-- de familiarité) recevaient le MÊME pool, rendant le skew familiarité inerte.
-- La spec moteur (docs/game/training-engine-spec-v2-clean.md §3) prévoit déjà
-- de compléter avec dreyfus_tier='D' & rarity_tag='common' quand le tier N est
-- insuffisant. On élargit donc l'éligibilité à tier N+D common (~55 actives,
-- spread easy/medium), ce qui rend le skew réel :
--   débutant  → ~16 easy / 14 medium
--   designer  → ~3  easy / 27 medium
--
-- Additif/idempotent (CREATE OR REPLACE). N'affecte que les futurs cold-starts
-- (ensureUserPool ne re-seede pas un pool déjà rempli).

-- 1) Version de base (sans familiarité) : set élargi, ordre neutre facile→difficile.
CREATE OR REPLACE FUNCTION init_user_pool(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  v_count int := 0;
  v_rows  int := 0;
  v_slug  text;
BEGIN
  FOR v_slug IN
    WITH ranked AS (
      SELECT
        typeface_slug,
        primary_category,
        ROW_NUMBER() OVER (
          PARTITION BY primary_category
          ORDER BY difficulty_base ASC, dreyfus_tier, typeface_slug
        ) AS category_rank
      FROM typefaces_core
      WHERE activation_status = true
        AND rarity_tag = 'common'
        AND dreyfus_tier IN ('N', 'D')
    )
    SELECT typeface_slug
    FROM ranked
    ORDER BY category_rank, primary_category, typeface_slug
    LIMIT 30
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

-- 2) Version familiarity-aware : même set élargi, skew easy/hard par familiarité.
CREATE OR REPLACE FUNCTION init_user_pool(p_user_id uuid, p_familiarity text)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  v_count int := 0;
  v_rows  int := 0;
  v_slug  text;
  v_hard  boolean := p_familiarity IN ('Quite familiar', 'Designer');
BEGIN
  FOR v_slug IN
    WITH ranked AS (
      SELECT
        typeface_slug,
        primary_category,
        ROW_NUMBER() OVER (
          PARTITION BY primary_category
          ORDER BY
            CASE WHEN v_hard THEN difficulty_base END DESC NULLS LAST,
            difficulty_base ASC,
            dreyfus_tier,
            typeface_slug
        ) AS category_rank
      FROM typefaces_core
      WHERE activation_status = true
        AND rarity_tag = 'common'
        AND dreyfus_tier IN ('N', 'D')
    )
    SELECT typeface_slug
    FROM ranked
    ORDER BY category_rank, primary_category, typeface_slug
    LIMIT 30
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
