-- ============================================================
-- MIGRATION 019 -- la notoriete passe devant l'alphabet
-- Requiert : 013, 016, 017 appliquees
-- ============================================================
--
-- CE QUI ETAIT CASSE, mesure le 2026-08-31. Le premier pool d'un joueur
-- contenait 8 polices Adobe sur 30, et les 22 autres etaient la lettre A de
-- Google Fonts : ABeeZee, Abel, Acme, Actor, Advent Pro, Alata, Albert Sans,
-- Alegreya, Aleo, Alumni Sans, Amiri, Andada Pro, Antic Slab, Anton, Arvo, Asap.
-- Ce n'est pas un hasard : init_user_pool trie par `typeface_slug`, donc par
-- ordre alphabetique, et le debutant recevait le debut du dictionnaire.
--
-- DEUX CAUSES, ET LA PREMIERE N'EST PAS L'ORDRE.
--
-- 1. LES TRENTE POLICES ADOBE `common` SONT TOUTES EN `easy`. Le pool par
--    defaut ("A little") demande 12 easy et 18 medium, et le seau medium ne
--    contenait AUCUNE police Adobe. Dix-huit des trente places etaient donc
--    hors d'atteinte quel que soit le tri. Corriger l'ordre seul faisait passer
--    de 8 a 11, mesure.
--
-- 2. L'ALPHABET SERT DE DEPARTAGE. A egalite de tier et de rarete, c'est le
--    slug qui tranche, ce qui n'a aucun rapport avec ce qu'un joueur doit
--    apprendre en premier.
--
-- CE QUE CETTE MIGRATION FAIT. Elle reclasse seize classiques en `medium` et
-- met la notoriete devant l'alphabet dans les deux arites de init_user_pool.
-- Resultat mesure en simulation avant ecriture : 23 polices Adobe sur 30, et
-- les quatre categories toujours representees.
--
-- POURQUOI SEIZE ET PAS TRENTE. `easy` garde ce qu'un non-designer voit tous
-- les jours sur un ecran ou ne peut pas confondre : Arial, Times New Roman,
-- Courier New, Comic Sans, Georgia, Verdana, Tahoma, Impact, Papyrus, Brush
-- Script, Cooper Black, Helvetica, Futura, Adobe Garamond. Passent en `medium`
-- les caracteres qui demandent un oeil forme : personne ne distingue Bodoni de
-- Didot, ni Optima d'Univers, sans entrainement. Les annoncer `easy` etait une
-- erreur de donnee, pas un choix pedagogique.
--
-- CE QU'ELLE NE FAIT PAS. Aucune police ne quitte le catalogue et aucune ne
-- change de rarete. Les sept places qui restent non-Adobe sont toutes en `mono`
-- et `display`, ou le kit Adobe n'a qu'une et deux entrees `common`. Cela se
-- comble en ajoutant des familles au projet web, pas en tordant ce tri.

BEGIN;

-- ---------- 1. Seize classiques passent en medium ----------

UPDATE typefaces_core
SET difficulty_base = 'medium'
WHERE typeface_slug IN (
  'eurostile', 'franklin_gothic', 'gill_sans_nova', 'itc_avant_garde_gothic_pro',
  'neue_frutiger_world', 'optima_lt_pro', 'univers_next_pro',
  'adobe_caslon_pro', 'baskerville_urw', 'bodoni_std', 'clarendon_urw',
  'copperplate', 'linotype_didot', 'rockwell', 'superclarendon', 'trajan_pro_3'
)
  AND font_source::text = 'adobe'
  AND difficulty_base = 'easy';

-- ---------- 2. La notoriete devant l'alphabet, arite a deux ----------

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
        -- LA NOTORIETE D'ABORD. `font_source = 'adobe'` est le seul signal de
        -- notoriete que porte le catalogue : les 108 familles du projet web ont
        -- ete choisies une par une pour leur celebrite, alors qu'aucune colonne
        -- ne classe les 1171 Google. Le slug reste, en dernier, pour que le
        -- resultat soit deterministe et donc testable.
        ROW_NUMBER() OVER (
          PARTITION BY difficulty_base, primary_category
          ORDER BY (font_source::text = 'adobe') DESC, dreyfus_tier, rarity_tag, typeface_slug
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
$function$;

-- ---------- 3. Meme correction sur l'arite a un ----------
-- Elle n'est plus appelee par le jeu, ensureUserPool passant toujours la
-- familiarite, mais la laisser trier par alphabet ferait mentir la garde
-- check:pool-serialisation, qui verifie les deux arites.

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
          ORDER BY (font_source::text = 'adobe') DESC, difficulty_base ASC, dreyfus_tier, typeface_slug
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

-- ---------- 4. Garde : le compte doit etre exact, sinon tout est annule ----------
-- Une transaction qui leve annule tout, donc cette verification ne peut pas
-- arriver trop tard. Le patron vient de la 013, ou une prevision fausse de 14
-- lignes avait justement ete arretee ici.

DO $$
DECLARE
  v_reclassees int;
  v_adobe      int;
  v_taille     int;
  v_categories int;
BEGIN
  SELECT count(*) INTO v_reclassees
  FROM typefaces_core
  WHERE font_source::text = 'adobe' AND rarity_tag = 'common'
    AND dreyfus_tier IN ('N','D') AND difficulty_base = 'medium';

  IF v_reclassees <> 16 THEN
    RAISE EXCEPTION 'attendu 16 polices Adobe en medium, trouve %', v_reclassees;
  END IF;

  WITH eligible AS (
    SELECT typeface_slug, primary_category, difficulty_base, font_source::text AS src,
           ROW_NUMBER() OVER (
             PARTITION BY difficulty_base, primary_category
             ORDER BY (font_source::text = 'adobe') DESC, dreyfus_tier, rarity_tag, typeface_slug
           ) AS cat_rank
    FROM typefaces_core
    WHERE activation_status AND rarity_tag = 'common' AND dreyfus_tier IN ('N','D')
  ),
  pe AS (SELECT * FROM eligible WHERE difficulty_base = 'easy'
         ORDER BY cat_rank, primary_category, typeface_slug LIMIT 12),
  pm AS (SELECT * FROM eligible WHERE difficulty_base = 'medium'
         ORDER BY cat_rank, primary_category, typeface_slug LIMIT 18),
  pool AS (SELECT * FROM pe UNION ALL SELECT * FROM pm)
  SELECT count(*), count(*) FILTER (WHERE src = 'adobe'), count(DISTINCT primary_category)
  INTO v_taille, v_adobe, v_categories
  FROM pool;

  IF v_taille <> 30 THEN
    RAISE EXCEPTION 'le pool par defaut doit faire 30 polices, il en fait %', v_taille;
  END IF;
  IF v_adobe <> 23 THEN
    RAISE EXCEPTION 'attendu 23 polices Adobe dans le pool par defaut, trouve %', v_adobe;
  END IF;
  IF v_categories <> 4 THEN
    RAISE EXCEPTION 'les quatre categories doivent rester representees, trouve %', v_categories;
  END IF;

  RAISE NOTICE '019 OK : 16 reclassees, pool par defaut 23 Adobe sur 30, 4 categories.';
END $$;

COMMIT;
