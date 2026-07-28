-- ============================================================
-- MIGRATION 009 — niveau global visible N.1..E.5 (I-08, N-22, P-04)
-- JEUX DE TYPO — Training Engine v2
-- Requiert : migrations 001..008 appliquees
-- PostgreSQL 13+ (Neon)
-- ============================================================
--
-- POURQUOI. users.dreyfus_level (le palier N/D/C/A/E) etait une colonne MORTE :
-- jamais ecrite, elle restait a 'N'. Consequence directe sur la migration 008 :
-- try_unlock_one_typeface filtre les nouvelles typos par users.dreyfus_level et
-- POOL_TARGET_BY_TIER fait grandir la cible du pool selon ce meme palier. Comme
-- le palier ne montait jamais, le pool ne grandissait QUE dans le tier N et ne
-- gagnait jamais en DIFFICULTE. Cette migration fait vivre le niveau global
-- visible : il est recalcule apres CHAQUE reponse (N-22) comme AGREGATION des
-- mastery_level (compte des typos maitrisees, spec ligne 708, invariant I-08),
-- il MONTE avec la performance et fait donc grimper le tier passe a 008 -> le
-- pool grandit en difficulte. C'est l'aboutissement naturel de « le joueur
-- n'est jamais bloque et continue de progresser ».
--
-- INVARIANT I-08. Le niveau global visible NE REMPLACE JAMAIS le moteur de
-- repetition espacee : il en est la LECTURE agregee. recompute_visible_level ne
-- LIT que user_typeface_state.mastery_level et n'ECRIT que les colonnes derivees
-- users.dreyfus_level / dreyfus_sub. Il ne touche jamais au mastery_level, aux
-- intervalles, au next_due ni au pool. Aucune sortie de pool (I-06 respecte).
--
-- INVARIANT P-04. La regression est BORNEE : a chaque appel le niveau peut
-- MONTER librement vers sa cible mais ne peut DESCENDRE que d'AU PLUS un
-- sous-niveau. Il ne « chute jamais de plusieurs sous-niveaux d'un coup ».
--
-- FORMULE (calibration parametrique, source de verite unique). La spec fixe la
-- NATURE du calcul mais PAS les seuils : I-08 (« agregation des mastery_level »,
-- ligne 708) et I7 (le niveau n'utilise JAMAIS l'XP ni la competition). Lecture
-- retenue = EXPERTISE ACCUMULEE : le niveau visible est pilote par le NOMBRE de
-- typos vraiment maitrisees, un COMPTE et non une fraction.
--   n4 = |{ user_typeface_state du user : mastery_level >= 4 }|   (compte total)
-- On projette n4 sur 25 crans (index 0..24 = 5 tiers x 5 sous-niveaux) via une
-- table de seuils ASCENDANTS = le n4 MINIMUM pour ENTRER dans chaque cran :
--   cran :   0  1  2  3   4    5   6   7   8   9    10  11  12  13  14   15   16   17   18   19   20   21   22   23   24
--   n4 min:  0  3  6  9  12   15  20  25  30  35   40  52  64  76  88  100  130  160  190  220  250  320  400  500  650
--   cran = plus haut index dont le seuil <= n4 (clamp 0..24)
--   tier = ['N','D','C','A','E'][ floor(cran / 5) ]
--   sub  = (cran % 5) + 1
-- Reperes : N.1 a n4=0, D.1 a n4=15, C.1 a 40, A.1 a 100, E.1 a 250, E.5 a
-- n4>=650. Monotone : n4 ne fait que croitre quand une typo atteint mastery 4,
-- donc la cible ne peut que monter. Les seuils sont des PARAMETRES de game-design
-- ajustables (ce bloc + la table du doc = source de verite unique) ; calibres
-- pour une courbe d'expertise qui atteint E.5 vers 650 typos maitrisees et passe
-- a l'echelle du catalogue 1000+ (la fraction du pool saturait trop vite).
-- Voir docs/game/global-level-progression.md.
--
-- IDEMPOTENCE. ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION.
-- Reappliquer la migration est sans effet.

-- ============================================================
-- 1. Colonnes du niveau visible (deja definies en 003, garde defensive)
--    003 cree deja users.dreyfus_level (app.dreyfus_level_enum, defaut 'N') et
--    users.dreyfus_sub (smallint 1..5, defaut 1). Ces ADD ... IF NOT EXISTS sont
--    des no-op sur un schema a jour ; ils rendent 009 auto-suffisante si 003
--    n'avait pas la colonne dreyfus_sub.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dreyfus_sub smallint NOT NULL DEFAULT 1;

-- ============================================================
-- 2. recompute_visible_level — recalcul + persistance du niveau visible (N-22)
--
--    Appelee par le provider apres CHAQUE reponse. Compte les typos vraiment
--    maitrisees (mastery_level >= 4, formule ci-dessus), applique la regression
--    bornee (P-04), ecrit
--    users.dreyfus_level / dreyfus_sub et retourne l'ancien + le nouveau niveau
--    ainsi qu'un booleen `changed` pour piloter le toast (N-24 / N-25).
--    LECTURE seule du moteur (I-08) : n'ecrit QUE les colonnes derivees.
-- ============================================================

CREATE OR REPLACE FUNCTION recompute_visible_level(p_user_id uuid)
RETURNS TABLE (
  prev_tier app.dreyfus_level_enum,
  prev_sub  smallint,
  new_tier  app.dreyfus_level_enum,
  new_sub   smallint,
  changed   boolean
)
LANGUAGE plpgsql AS $$
DECLARE
  -- Seuils de game-design (source de verite unique, voir en-tete + doc) :
  -- n4 MINIMUM pour ENTRER dans chacun des 25 crans (index 0..24), ascendants.
  v_thresholds constant int[] := ARRAY[
      0,   3,   6,   9,  12,
     15,  20,  25,  30,  35,
     40,  52,  64,  76,  88,
    100, 130, 160, 190, 220,
    250, 320, 400, 500, 650
  ];
  v_n4         int;
  v_target_idx int;
  v_prev_tier  app.dreyfus_level_enum;
  v_prev_sub   smallint;
  v_prev_idx   int;
  v_new_idx    int;
  v_new_tier   app.dreyfus_level_enum;
  v_new_sub    smallint;
  i            int;
BEGIN
  -- Niveau actuellement persiste (defaut colonne 'N'.1).
  SELECT dreyfus_level, dreyfus_sub
    INTO v_prev_tier, v_prev_sub
    FROM users
   WHERE user_id = p_user_id;

  IF v_prev_tier IS NULL THEN
    RETURN;  -- utilisateur inconnu : aucune ligne renvoyee
  END IF;

  -- Expertise accumulee : COUNT des typos vraiment maitrisees (mastery_level >= 4).
  -- LECTURE seule du moteur (I-08) ; jamais d'XP ni de competition (I7). Compte
  -- TOTAL (pas de filtre in_active_pool) : l'expertise ne se perd pas.
  SELECT COUNT(*)::int
    INTO v_n4
    FROM user_typeface_state
   WHERE user_id = p_user_id
     AND mastery_level >= 4;

  -- Cran cible = plus haut index dont le seuil <= n4 (table ascendante).
  -- La borne 0..24 est garantie par la table (25 crans) : v_target_idx reste 0
  -- (aucun seuil > 0 franchi) et plafonne a 24 (dernier cran).
  v_target_idx := 0;
  FOR i IN 0..24 LOOP
    IF v_n4 >= v_thresholds[i + 1] THEN
      v_target_idx := i;
    ELSE
      EXIT;  -- seuils croissants : rien ne peut plus passer au-dela
    END IF;
  END LOOP;

  v_prev_idx := (CASE v_prev_tier
                   WHEN 'N' THEN 0 WHEN 'D' THEN 1 WHEN 'C' THEN 2
                   WHEN 'A' THEN 3 WHEN 'E' THEN 4 ELSE 0 END) * 5
                + (v_prev_sub - 1);

  -- Regression bornee (P-04) : monte librement vers la cible, ne descend que
  -- d'AU PLUS un sous-niveau par appel (jamais plusieurs crans d'un coup).
  IF v_target_idx >= v_prev_idx THEN
    v_new_idx := v_target_idx;
  ELSE
    v_new_idx := GREATEST(v_target_idx, v_prev_idx - 1);
  END IF;

  v_new_tier := (ARRAY['N','D','C','A','E']::app.dreyfus_level_enum[])[(v_new_idx / 5) + 1];
  v_new_sub  := (v_new_idx % 5) + 1;

  -- Persistance du niveau derive (I-08 : seules ces deux colonnes changent).
  UPDATE users
     SET dreyfus_level = v_new_tier,
         dreyfus_sub   = v_new_sub
   WHERE user_id = p_user_id;

  prev_tier := v_prev_tier;
  prev_sub  := v_prev_sub;
  new_tier  := v_new_tier;
  new_sub   := v_new_sub;
  changed   := (v_new_idx <> v_prev_idx);
  RETURN NEXT;
END;
$$;

-- ============================================================
-- 3. Apercu lecture seule (optionnel, ne modifie rien)
--    Niveau visible calcule (sans persistance) pour un echantillon.
--    SELECT * FROM v_user_visible_level LIMIT 5;
-- ============================================================

CREATE OR REPLACE VIEW v_user_visible_level AS
  WITH agg AS (
    SELECT
      u.user_id,
      u.dreyfus_level AS stored_tier,
      u.dreyfus_sub   AS stored_sub,
      COUNT(uts.state_id) FILTER (WHERE uts.mastery_level >= 4)    AS n4
    FROM users u
    LEFT JOIN user_typeface_state uts
           ON uts.user_id = u.user_id
    WHERE u.deleted_at IS NULL
    GROUP BY u.user_id, u.dreyfus_level, u.dreyfus_sub
  ),
  idx AS (
    SELECT
      agg.user_id,
      agg.stored_tier,
      agg.stored_sub,
      agg.n4,
      -- Cran cible = plus haut index (0..24) dont le seuil <= n4 (memes seuils
      -- que recompute_visible_level ; ORDINALITY est 1-base d'ou le -1).
      (SELECT MAX(t.ord) - 1
         FROM unnest(ARRAY[
                 0,   3,   6,   9,  12,
                15,  20,  25,  30,  35,
                40,  52,  64,  76,  88,
               100, 130, 160, 190, 220,
               250, 320, 400, 500, 650
              ]) WITH ORDINALITY AS t(threshold, ord)
        WHERE agg.n4 >= t.threshold)::int AS target_idx
    FROM agg
  )
  SELECT
    user_id,
    stored_tier,
    stored_sub,
    n4,
    (ARRAY['N','D','C','A','E'])[(target_idx / 5) + 1] AS target_tier,
    (target_idx % 5) + 1                               AS target_sub
  FROM idx;
