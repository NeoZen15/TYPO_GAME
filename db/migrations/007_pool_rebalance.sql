-- ============================================================
-- MIGRATION 007 — rebalance descendant du pool ("redescendre")
-- JEUX DE TYPO
-- Requiert : migrations 001..006 appliquees
-- ============================================================
--
-- POURQUOI. Le niveau declare en onboarding n'est qu'un prior de cold-start. Un
-- joueur qui se declare avance ("Quite familiar" / "Designer") mais dont la
-- precision reelle est basse sur la fenetre de debut se retrouve coince sur des
-- specimens trop durs (tous ses etats demarrent a mastery 0). Le moteur Leitner
-- fait deja redescendre le mastery et raccourcir les intervalles ; ce complement
-- ADDITIF lui redonne en plus de la matiere accessible : on AJOUTE des typos
-- faciles au pool. Le declenchement (fenetre de debut, precision < 0.40, niveau
-- declare avance) est decide cote applicatif (provider maybeRebalancePool) ; cette
-- fonction ne fait que l'ajout, borne par la taille cible du pool.
--
-- INVARIANT I-06. Une typo n'est JAMAIS retiree ni desactivee du pool. Cette
-- fonction est STRICTEMENT ADDITIVE : uniquement des INSERT ... ON CONFLICT DO
-- NOTHING. Aucun DELETE, aucun UPDATE qui retire (in_active_pool passe seulement
-- de false a true sur des lignes nouvellement inserees, jamais l'inverse).
--
-- IDEMPOTENCE. CREATE OR REPLACE de la fonction ; le corps est idempotent : sur
-- un pool deja plein (slots <= 0) elle ne fait rien et retourne 0 ; ON CONFLICT
-- protege les reappels. Sans effet tant que le provider ne l'appelle pas.
--
-- SELECTION. Typos AJOUTEES : activation_status = true, dreyfus_tier = 'N',
-- rarity_tag = 'common', difficulty_base = 'easy' (le plus bas), pas deja dans
-- l'etat de l'utilisateur, diversifiees par primary_category (round-robin), et
-- limitees au nombre de slots libres pour ne jamais depasser la taille cible du
-- pool (spec §7.1 : N/D=30, C=32, A=34, E=36 selon le niveau global visible).

CREATE OR REPLACE FUNCTION rebalance_user_pool(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  v_count   int := 0;
  v_rows    int := 0;
  v_slug    text;
  v_target  int;
  v_active  int;
  v_slots   int;
BEGIN
  -- Taille cible selon le niveau global visible de l'utilisateur (spec §7.1).
  SELECT CASE dreyfus_level
           WHEN 'N' THEN 30
           WHEN 'D' THEN 30
           WHEN 'C' THEN 32
           WHEN 'A' THEN 34
           WHEN 'E' THEN 36
           ELSE 30
         END
    INTO v_target
    FROM users
    WHERE user_id = p_user_id;

  -- Utilisateur introuvable : rien a faire.
  IF v_target IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)
    INTO v_active
    FROM user_typeface_state
    WHERE user_id = p_user_id
      AND in_active_pool = true;

  v_slots := v_target - v_active;

  -- Pool deja plein (ou au-dela) : aucun ajout, on respecte la taille cible.
  IF v_slots <= 0 THEN
    RETURN 0;
  END IF;

  FOR v_slug IN
    WITH candidates AS (
      SELECT
        tc.typeface_slug,
        ROW_NUMBER() OVER (
          PARTITION BY tc.primary_category
          ORDER BY tc.difficulty_base, tc.typeface_slug
        ) AS category_rank
      FROM typefaces_core tc
      WHERE tc.activation_status = true
        AND tc.dreyfus_tier = 'N'
        AND tc.rarity_tag = 'common'
        AND tc.difficulty_base = 'easy'
        AND NOT EXISTS (
          SELECT 1
          FROM user_typeface_state uts
          WHERE uts.user_id = p_user_id
            AND uts.typeface_slug = tc.typeface_slug
        )
    )
    SELECT typeface_slug
    FROM candidates
    ORDER BY category_rank, typeface_slug
    LIMIT v_slots
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
