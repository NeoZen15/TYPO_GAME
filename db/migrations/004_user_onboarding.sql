-- ============================================================
-- MIGRATION 004 — onboarding familiarity (cold-start difficulty)
-- JEUX DE TYPO
-- Requiert : migrations 001, 001b, 002, 003 appliquees
-- ============================================================

-- 1) Persist the one cold-start signal onboarding collects (the engine cannot
--    infer it before the first round). Nullable: guests created by the game
--    before onboarding simply have no value.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_familiarity text;

-- 2) Familiarity-aware pool initialisation.
--    Additive overload — the original init_user_pool(uuid) is unchanged, so the
--    existing training flow keeps working when no familiarity is known.
--    Same eligible set (tier N, common, active) interleaved by category, but the
--    30 seeded faces skew EASY for novices and HARD for the confident/designers.
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
            typeface_slug
        ) AS category_rank
      FROM typefaces_core
      WHERE activation_status = true
        AND dreyfus_tier = 'N'
        AND rarity_tag = 'common'
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
