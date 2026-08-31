-- Retour arriere de la 019. Rend l'etat exact d'avant : les seize polices
-- reviennent en `easy` et les deux arites de init_user_pool retrouvent le tri
-- alphabetique, copie mot pour mot depuis pg_get_functiondef le 2026-08-31.

BEGIN;

UPDATE typefaces_core
SET difficulty_base = 'easy'
WHERE typeface_slug IN (
  'eurostile', 'franklin_gothic', 'gill_sans_nova', 'itc_avant_garde_gothic_pro',
  'neue_frutiger_world', 'optima_lt_pro', 'univers_next_pro',
  'adobe_caslon_pro', 'baskerville_urw', 'bodoni_std', 'clarendon_urw',
  'copperplate', 'linotype_didot', 'rockwell', 'superclarendon', 'trajan_pro_3'
)
  AND font_source::text = 'adobe'
  AND difficulty_base = 'medium';

CREATE OR REPLACE FUNCTION public.init_user_pool(p_user_id uuid, p_familiarity text)
RETURNS integer
LANGUAGE plpgsql AS $function$
DECLARE
  v_count      int := 0;
  v_rows       int := 0;
  v_slug       text;
  v_easy_q     int;
  v_med_q      int;
  v_hard_q     int;
  v_allow_hard boolean;
BEGIN
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
          (rarity_tag = 'common' AND dreyfus_tier IN ('N', 'D'))
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
$function$;

CREATE OR REPLACE FUNCTION public.init_user_pool(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql AS $function$
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
$function$;

COMMIT;
