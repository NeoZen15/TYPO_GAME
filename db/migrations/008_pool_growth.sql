-- ============================================================
-- MIGRATION 008 — croissance du pool actif (I-07 + fallback §4.5)
-- JEUX DE TYPO — Training Engine v2
-- Requiert : migrations 001..007 appliquees
-- PostgreSQL 13+ (Neon)
-- ============================================================
--
-- POURQUOI. Le pool actif etait GELE au seed : aucune nouvelle typo n'entrait
-- jamais, en contradiction directe avec l'invariant I-07 (« une nouvelle typo
-- entre quand 3 typos differentes atteignent mastery_level 4 »). Il manquait :
--   1. le compteur user (spec §7.2 : user_profile.pending_unlock_count) ;
--   2. la fonction de selection d'une nouvelle typo (spec §7.2) ;
--   3. le point d'entree atomique compteur+unlock cote base.
-- Cette migration ajoute les trois. Le cablage applicatif (declencheur I-07 et
-- fallback §4.5) est dans lib/game/training/provider.ts et appelle ces fonctions
-- de facon fail-safe (no-op tant que 008 n'est pas appliquee).
--
-- TABLE user_profile = table `users`. Le doc spec la nomme « user_profile » ;
-- dans ce schema, la ligne au niveau utilisateur vit dans `users` (colonnes
-- dreyfus_level, global_q_index, ...). C'est donc `users` qui recoit le compteur.
--
-- INVARIANT I-06. Strictement ADDITIF : uniquement INSERT ... ON CONFLICT DO
-- NOTHING. Aucun DELETE, aucun passage de in_active_pool a false. Une typo
-- n'est jamais retiree du pool ni du systeme.
--
-- IDEMPOTENCE. ADD COLUMN IF NOT EXISTS, ADD VALUE IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION. Reappliquer la migration est sans effet.

-- ============================================================
-- 1. Compteur d'unlock au niveau utilisateur (spec §7.2)
--    « compteur suivi dans user_profile.pending_unlock_count, reset a 0 apres
--    introduction ». Ici porte par la table `users`.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pending_unlock_count int NOT NULL DEFAULT 0
    CHECK (pending_unlock_count >= 0);

-- ============================================================
-- 2. Valeurs d'evenement pour la reprise silencieuse (fallback §4.5)
--    Table events spec §10.1 : pool_recovered_by_unlock,
--    pool_recovered_by_cursor_jump. 'pool_unlocked' existe deja (001b).
--    ADD VALUE IF NOT EXISTS est idempotent ; ces valeurs ne sont PAS
--    utilisees dans cette migration (aucune contrainte de transaction PG12+).
-- ============================================================

ALTER TYPE app.event_type_enum ADD VALUE IF NOT EXISTS 'pool_recovered_by_unlock';
ALTER TYPE app.event_type_enum ADD VALUE IF NOT EXISTS 'pool_recovered_by_cursor_jump';

-- ============================================================
-- 3. try_unlock_one_typeface — selection d'UNE nouvelle typo (spec §7.2)
--
--    Implemente la selection §7.2 EXACTEMENT :
--      1. Exclure toutes les typos deja presentes dans l'etat de l'utilisateur
--         (NOT EXISTS user_typeface_state). C'est un sur-ensemble de « exclure
--         in_active_pool = TRUE » : sous I-06 (aucune sortie de pool) les deux
--         ensembles sont identiques ; NOT EXISTS garantit en plus que le INSERT
--         ajoute toujours une ligne neuve (jamais un no-op ON CONFLICT).
--      2. Exclure activation_status = FALSE.
--      3. dreyfus_tier <= niveau Dreyfus actuel de l'utilisateur (users.dreyfus_level).
--      4. rarity_tag compatible avec le niveau (table §7.2).
--      5. Choisir la sub_category la MOINS representee dans le pool actif courant.
--      6. Egalite : rarity_tag (common>uncommon>rare), puis dreyfus_tier
--         (N>D>C>A>E), puis random().
--      7. Ajouter UNE SEULE typo : mastery_level=0, next_due_after_q=0,
--         interval_questions=0, in_active_pool=true. ADD-ONLY.
--    Retourne le slug ajoute, ou NULL si aucun candidat (ou conflit).
-- ============================================================

CREATE OR REPLACE FUNCTION try_unlock_one_typeface(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_level      app.dreyfus_level_enum;
  v_level_rank int;
  v_slug       text;
  v_rows       int;
BEGIN
  -- Niveau Dreyfus visible de l'utilisateur (defaut 'N' cote colonne).
  SELECT dreyfus_level INTO v_level FROM users WHERE user_id = p_user_id;
  IF v_level IS NULL THEN
    RETURN NULL;  -- utilisateur inconnu
  END IF;

  v_level_rank := CASE v_level
                    WHEN 'N' THEN 1 WHEN 'D' THEN 2 WHEN 'C' THEN 3
                    WHEN 'A' THEN 4 WHEN 'E' THEN 5 ELSE 1 END;

  WITH pool_sub AS (
    -- Representation de chaque sub_category dans le pool actif courant.
    SELECT tc.sub_category AS sub_category, COUNT(*) AS n
    FROM user_typeface_state uts
    JOIN typefaces_core tc ON tc.typeface_slug = uts.typeface_slug
    WHERE uts.user_id = p_user_id
      AND uts.in_active_pool = true
    GROUP BY tc.sub_category
  ),
  candidates AS (
    SELECT
      tc.typeface_slug,
      COALESCE(ps.n, 0) AS sub_count,
      CASE tc.rarity_tag
        WHEN 'common' THEN 0 WHEN 'uncommon' THEN 1 WHEN 'rare' THEN 2 ELSE 3
      END AS rarity_rank,
      CASE tc.dreyfus_tier
        WHEN 'N' THEN 1 WHEN 'D' THEN 2 WHEN 'C' THEN 3
        WHEN 'A' THEN 4 WHEN 'E' THEN 5 ELSE 9
      END AS tier_rank
    FROM typefaces_core tc
    LEFT JOIN pool_sub ps ON ps.sub_category = tc.sub_category
    WHERE tc.activation_status = true
      -- (1) pas deja dans l'etat de l'utilisateur
      AND NOT EXISTS (
        SELECT 1 FROM user_typeface_state uts
        WHERE uts.user_id = p_user_id
          AND uts.typeface_slug = tc.typeface_slug
      )
      -- (3) dreyfus_tier <= niveau utilisateur
      AND (CASE tc.dreyfus_tier
             WHEN 'N' THEN 1 WHEN 'D' THEN 2 WHEN 'C' THEN 3
             WHEN 'A' THEN 4 WHEN 'E' THEN 5 ELSE 9 END) <= v_level_rank
      -- (4) rarity_tag compatible avec le niveau (table §7.2)
      AND (
        (v_level = 'N' AND tc.rarity_tag = 'common') OR
        (v_level = 'D' AND tc.rarity_tag IN ('common', 'uncommon')) OR
        (v_level IN ('C', 'A', 'E') AND tc.rarity_tag IN ('common', 'uncommon', 'rare'))
      )
  )
  -- (5) sub_category la moins representee ; (6) tie-break rarity, tier, random
  SELECT typeface_slug INTO v_slug
  FROM candidates
  ORDER BY sub_count ASC, rarity_rank ASC, tier_rank ASC, random()
  LIMIT 1;

  IF v_slug IS NULL THEN
    RETURN NULL;  -- aucun candidat eligible
  END IF;

  -- (7) ajout d'UNE SEULE typo, add-only
  INSERT INTO user_typeface_state (
    user_id, typeface_slug, mastery_level, next_due_after_q,
    interval_questions, in_active_pool, unlocked_at
  ) VALUES (p_user_id, v_slug, 0, 0, 0, true, now())
  ON CONFLICT (user_id, typeface_slug) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN NULL;  -- conflit : rien ajoute
  END IF;

  RETURN v_slug;
END;
$$;

-- ============================================================
-- 4. register_mastery_unlock — compteur + unlock atomiques (I-07)
--
--    Appelee par le provider quand une typo franchit mastery_level 3 -> 4
--    (premier passage a 4). Incremente pending_unlock_count ; au 3e (seuil
--    POOL_UNLOCK_THRESHOLD), tente try_unlock_one_typeface et, si une typo a
--    ete introduite, remet le compteur a 0 (« reset apres introduction »).
--    Retourne le slug introduit, sinon NULL.
--
--    Choix : le reset n'a lieu QUE si une introduction a reussi (fidele a
--    « reset a 0 apres introduction »). En cas de catalogue epuise pour le
--    niveau (cas theorique : 746 typos tier N common actives), le compteur
--    reste a 3 et une nouvelle tentative aura lieu au prochain franchissement.
-- ============================================================

CREATE OR REPLACE FUNCTION register_mastery_unlock(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
  v_slug  text;
BEGIN
  UPDATE users
     SET pending_unlock_count = pending_unlock_count + 1
   WHERE user_id = p_user_id
  RETURNING pending_unlock_count INTO v_count;

  IF v_count IS NULL THEN
    RETURN NULL;  -- utilisateur inconnu
  END IF;

  IF v_count < 3 THEN
    RETURN NULL;  -- seuil non atteint
  END IF;

  -- Seuil atteint : introduire une typo puis reset si l'introduction a eu lieu.
  v_slug := try_unlock_one_typeface(p_user_id);

  IF v_slug IS NOT NULL THEN
    UPDATE users SET pending_unlock_count = 0 WHERE user_id = p_user_id;
  END IF;

  RETURN v_slug;
END;
$$;
