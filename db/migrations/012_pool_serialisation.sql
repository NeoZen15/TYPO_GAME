-- ============================================================
-- MIGRATION 012 — serialisation du pool par utilisateur
-- JEUX DE TYPO — Training Engine v2
-- Requiert : migrations 001..011 appliquees
-- PostgreSQL 13+ (Neon)
-- ============================================================
--
-- ATOMICITE. Le driver HTTP (@neondatabase/serverless en mode neon()) ouvre
-- une transaction par requete : appliquer ce fichier avec ce driver rendrait
-- le BEGIN/COMMIT ci-dessous inoperant. Ce fichier doit etre applique par
-- psql (ou tout client qui tient une session, comme le Client en WebSocket
-- deja utilise pour les preuves de concurrence de cette tache), jamais par le
-- driver HTTP.
--
-- POURQUOI. Mesure le 2026-07-31 (tache 0) : sous recouvrement, deux
-- initialisations de pool pour le meme utilisateur remplissent le pool DEUX
-- FOIS, 47 lignes au lieu de 30, cinq tentatives sur cinq, variance nulle, les
-- 12 faces tier C hard incluses. Le mecanisme : le perdant d'un
-- INSERT ... ON CONFLICT DO NOTHING bloque puis, a son reveil, execute quand
-- meme sa PROPRE boucle de selection jusqu'au bout : les lignes deja posees
-- par le gagnant sont absorbees par ON CONFLICT DO NOTHING (aucun SQLSTATE),
-- mais les lignes de sa propre selection qui n'y figurent pas s'inserent
-- normalement, d'ou la fusion des deux pools plutot qu'une deduplication.
-- L'interblocage entre les deux arites de init_user_pool, hypothese initiale
-- de cette tache, s'est revele NON reproductible (5 tentatives, aucun 40P01,
-- observation d'une attente unidirectionnelle et jamais d'un cycle) : ce
-- fichier ne le traite donc plus comme le defaut a corriger, seulement la
-- fusion mesuree ci-dessus.
--
-- MECANISME DU CORRECTIF. Chaque corps qui ecrit dans le pool prend, en
-- PREMIERE instruction, un verrou consultatif transactionnel derive de
-- p_user_id : PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0)).
-- Le second appelant concurrent bloque sur ce verrou jusqu'au COMMIT (ou
-- ROLLBACK) du premier, puis reprend avec un snapshot FRAIS (fait H5, prouve
-- le 2026-07-31 : une requete qui suit un blocage sur pg_advisory_xact_lock
-- dans une fonction plpgsql VOLATILE voit la ligne que l'appel concurrent
-- vient de valider). C'est ce snapshot frais qui rend la reevaluation de
-- try_unlock_if_pool_stuck reellement deduplicante et pas seulement
-- serialisante : sans elle, le second appelant repeterait le travail du
-- premier au lieu de constater qu'il n'y a plus rien a faire.
--
-- PORTEE. Cinq corps remplaces, pas quatre : init_user_pool existe en DEUX
-- arites (005 pour l'arite a un argument, 006 pour l'arite a deux arguments,
-- la derniere a avoir fait CREATE OR REPLACE dessus), toutes deux appelees
-- par lib/game/training/provider.ts (seedUserPool), et le defaut mesure se
-- produit precisement entre elles quand un cold-start recouvre un autre. Les
-- cinq corps sont, hors l'ajout de cette unique ligne de verrou en tete,
-- des CREATE OR REPLACE a l'identique de leur derniere definition :
--   1. init_user_pool(p_user_id uuid)                 (dernier corps : 005)
--   2. init_user_pool(p_user_id uuid, p_familiarity text) (dernier corps : 006)
--   3. rebalance_user_pool(p_user_id uuid)             (dernier corps : 007)
--   4. try_unlock_one_typeface(p_user_id uuid)          (dernier corps : 008)
--   5. register_mastery_unlock(p_user_id uuid)          (dernier corps : 008)
--
-- NOUVELLE FONCTION, NOM NEUF, PAS DE SURCHARGE A PARAMETRE PAR DEFAUT.
-- try_unlock_if_pool_stuck(uuid, text[], text[], text[]) est ajoutee pour le
-- chemin §4.5 (pool sans eligible) de
-- lib/game/training/provider.ts::recoverPoolIfStuck. Les trois text[] sont les
-- listes de visibilite decrites au round 3 plus bas ; les rounds 1 et 2 de
-- cette tache avaient une version a un seul argument, jamais appliquee nulle
-- part (voir le paragraphe de remede juste apres). Elle ne
-- remplace PAS try_unlock_one_typeface : cette derniere est aussi la
-- primitive de croissance I-07, appelee par register_mastery_unlock au seuil
-- des trois stabilisations, un moment ou le pool a presque toujours une face
-- eligible. Y placer la precondition "le pool a-t-il deja une face eligible"
-- desactiverait silencieusement la croissance et pending_unlock_count ne
-- redescendrait jamais. D'ou une fonction a part, jamais une surcharge de
-- try_unlock_one_typeface a deux arguments dont le second serait un flag
-- optionnel : CREATE OR REPLACE ne peut pas changer une signature, et cette
-- surcharge rendrait ambigu l'appel a un seul argument de
-- 008_pool_growth.sql:191, erreur 42725.
--
-- A FAIRE AVANT D'APPLIQUER CE FICHIER, SI UNE VERSION A UN SEUL ARGUMENT DE
-- try_unlock_if_pool_stuck A DEJA ETE POSEE QUELQUE PART.
-- CREATE OR REPLACE ne la remplacerait PAS : les deux signatures different,
-- donc Postgres AJOUTERAIT une seconde surcharge et les deux coexisteraient.
-- Tout appel a un seul argument continuerait alors de resoudre vers l'ancien
-- corps, dont la precondition est justement le SURENSEMBLE corrige au round 3
-- plus bas, celui qui tue le deblocage §4.5 de facon permanente pour les
-- comptes portant au moins une ligne invisible. Remede, dans cet ordre :
--   DROP FUNCTION IF EXISTS try_unlock_if_pool_stuck(uuid);
-- puis, apres application, verifier qu'il ne reste que l'identite a quatre
-- arguments :
--   SELECT pg_get_function_identity_arguments(oid)
--     FROM pg_proc
--    WHERE proname = 'try_unlock_if_pool_stuck';
-- La seule ligne attendue est :
--   uuid, text[], text[], text[]
-- Deux lignes signifient que la surcharge fantome est encore la, et le chemin
-- §4.5 reste casse tant qu'elle y est.
--
-- CE DROP EST SANS RISQUE AUJOURD'HUI. Aucune base persistante n'a jamais
-- porte cette fonction : les trois rounds de preuve de cette tache sont restes
-- sur branche Neon jetable, et la migration 012 n'a ete appliquee sur aucune
-- base. Le DROP ne peut donc rien detruire et ne casse aucun appelant, il
-- existe uniquement pour l'operateur qui aurait rejoue un round anterieur a la
-- main. Le seul appelant du produit,
-- lib/game/training/provider.ts::recoverPoolIfStuck, appelle la version a
-- quatre arguments en NOTATION NOMMEE (p_allowed_license_types => ...), ce qui
-- rend une inversion des trois text[] impossible a ecrire silencieusement et
-- garantit qu'il ne peut pas resoudre par accident vers une surcharge a un
-- argument.
--
-- INVARIANT I-06. Aucun des six corps ne retire ni ne desactive une typo du
-- pool : uniquement des INSERT ... ON CONFLICT DO NOTHING, comme avant cette
-- migration. Le verrou ne change que l'ORDRE des acces, jamais la logique
-- d'ecriture.
--
-- CORRECTIF ROUND 2 (2026-08-01) : PRECONDITION AJOUTEE AUX DEUX ARITES DE
-- init_user_pool, MEME FORME QUE try_unlock_if_pool_stuck.
--
-- Mesure round 1 (preuve tmp/prove-pool.mjs, branche jetable) : le verrou
-- seul ne fermait PAS le defaut. Deux appels concurrents aux deux arites de
-- init_user_pool sur le MEME utilisateur neuf atterrissaient toujours a 47
-- lignes, tier C inclus, meme en enveloppant l'appel dans le garde de
-- comptage exact de ensureUserPool (provider.ts:358-387) : ce garde lit le
-- compte AVANT de prendre le verrou, donc les deux appels le voient a zero et
-- decident tous les deux de seeder ; une fois decide, un verrou qui ne fait
-- que serialiser laisse le perdant reveille inserer les lignes de SA PROPRE
-- selection, differente par construction de l'autre arite (tier N+D neutre
-- contre quotas easy/medium/hard qui ouvrent le tier C). Meme lecon que celle
-- deja tiree pour try_unlock_if_pool_stuck plus haut, appliquee cette fois a
-- init_user_pool : serialiser n'est pas dedupliquer.
--
-- Correctif : chaque arite de init_user_pool recoit desormais, juste apres le
-- verrou et avant toute selection, la meme reevaluation que
-- try_unlock_if_pool_stuck :
--   IF EXISTS (SELECT 1 FROM user_typeface_state WHERE user_id = p_user_id)
--   THEN RETURN 0; END IF;
-- Fait H5 (prouve le 2026-07-31) garantit que cette lecture, prise apres un
-- blocage sur pg_advisory_xact_lock, voit les lignes que l'appel concurrent
-- vient de valider pendant l'attente : le perdant sort donc proprement sans
-- jamais lancer sa propre boucle de selection.
--
-- PAS SUR rebalance_user_pool. Cette fonction est ADDITIVE PAR CONCEPTION :
-- son role est d'ajouter des faces plus faciles a un pool DEJA seede (spec,
-- redescente). Une precondition "deja seede => sortir" y desactiverait la
-- fonction entierement. rebalance_user_pool garde son propre garde de taille
-- cible (v_slots <= 0 => RETURN 0), inchange, et pas la precondition
-- ci-dessus : verifie par une regle dediee du garde qui echoue si jamais
-- cette precondition y apparaissait.
--
-- VERIFICATION DE seedUserPool (lib/game/training/provider.ts:271-290).
-- Essaie l'arite a deux arguments en premier quand la familiarite est
-- connue, se replie sur l'arite a un argument sur N'IMPORTE QUELLE exception.
-- Avant ce correctif, un repli qui s'executait APRES qu'un premier appel a
-- deja reussi (scenario purement SEQUENTIEL, aucune concurrence necessaire)
-- fusionnait quand meme jusqu'a 17 lignes en plus. Avec la precondition, ce
-- repli devient un no-op propre : verifie (pas suppose) par le test D de
-- tmp/prove-pool.mjs, appel sequentiel arite 2 puis arite 1 sur le meme
-- utilisateur, le second appel insere 0 ligne.
--
-- PREUVE. tmp/prove-pool.mjs, branche jetable, round 2 : test C (deux appels
-- concurrents, une arite chacune, sur un utilisateur neuf) repete cinq fois,
-- 30 lignes exactement les cinq fois, tier C absent les cinq fois (avant ce
-- correctif : 47 lignes les cinq fois, meme mesure, meme script). Test D
-- (repli sequentiel arite 2 puis arite 1) : la deuxieme insertion ajoute 0
-- ligne et laisse le pool inchange. Tests A et B (deduplication de
-- try_unlock_if_pool_stuck et de register_mastery_unlock) inchanges et
-- toujours au vert.
--
-- CORRECTIF ROUND 3 (2026-08-01) : LA PRECONDITION DE try_unlock_if_pool_stuck
-- VOYAIT UN SURENSEMBLE DU POOL DU JOUEUR, ET LE DEBLOCAGE §4.5 MOURAIT DE
-- FACON PERMANENTE POUR CERTAINS JOUEURS.
--
-- Mesure du relecteur sur une copie de production : l'utilisateur
-- f2fca162-f6cf-4f82-91f2-f2ed1855bfb8 porte quatre lignes in_active_pool =
-- true, next_due_after_q = 0, alors que global_q_index = 1 (arial, georgia,
-- courier_new, times_new_roman), toutes les quatre activation_status = false
-- et license_type = 'proprietary'. La precondition round 2 de
-- try_unlock_if_pool_stuck ne lisait que user_typeface_state et users
-- (in_active_pool, next_due_after_q, global_q_index) : ces quatre lignes la
-- satisfont, donc elle repondait "une face eligible existe" alors qu'aucune
-- des quatre n'est jamais servie au joueur. lib/game/training/provider.ts,
-- getPoolRows, la requete qui decide reellement ce qui est SERVI, filtre en
-- plus tc.activation_status = true, l'allowlist de licence (avec le repli
-- UFL_LEGACY_SLUGS) et l'exclusion de couverture latine. La precondition
-- voyait donc un SURENSEMBLE du pool du joueur.
--
-- POURQUOI C'EST PERMANENT ET PAS SEULEMENT FAUX UNE FOIS. Une ligne
-- invisible n'est jamais servie, donc jamais reprogrammee : son
-- next_due_after_q reste a sa valeur de seed (0) pour toujours, donc
-- next_due_after_q <= global_q_index reste vrai a tout jamais. Sur un compte
-- qui porte au moins une telle ligne, la precondition repond "eligible"
-- a CHAQUE appel futur, et try_unlock_one_typeface n'est plus jamais atteint :
-- le chemin §4.5 est mort pour ce joueur, pas seulement retarde. Le relecteur
-- a mesure 36 typos activation_status = true mais neanmoins invisibles
-- (licence non eclaircie ou hors couverture latine), donc ce n'est pas un
-- defaut a quatre lignes : le catalogue continuera d'en produire.
--
-- CORRECTIF. La precondition de try_unlock_if_pool_stuck rejoint desormais
-- typefaces_core et applique EXACTEMENT les quatre memes filtres que
-- getPoolRows (activation_status, allowlist de licence, repli UFL,
-- exclusion latine), les trois listes passees en parametres depuis
-- provider.ts (les memes constantes deja importees pour getPoolRows,
-- RUNTIME_ALLOWED_LICENSE_TYPES, UFL_LEGACY_SLUGS, LATIN_UNREADY_SLUGS), pas
-- recopiees en dur ici : une recopie figerait un instantane qui redivergerait
-- au premier changement de ces listes cote JS, exactement le defaut que ce
-- correctif ferme. Nouvelle signature a quatre arguments : cette fonction n'a
-- jamais ete appliquee sur aucune base (rounds 1 et 2 restes sur branche
-- jetable), donc changer sa signature ne casse aucun appelant existant, a la
-- difference de try_unlock_one_typeface plus haut. Chaque cote de la
-- decision porte desormais un commentaire qui nomme l'autre comme son jumeau
-- (getPoolRows et cette precondition), et scripts/quality/check-pool-serialisation.mjs
-- porte une regle dediee qui echoue si un filtre existe d'un cote sans
-- exister de l'autre.
--
-- PAS DE CHANGEMENT A try_unlock_one_typeface. Sa propre selection de
-- candidat ne filtre deja que activation_status (migration 008), sans
-- licence ni couverture latine : une typo qu'elle debloquerait pourrait donc
-- rester invisible au sens de getPoolRows. Ce n'est pas traite ici. Le
-- rappel JS existant s'en sort deja correctement sans aucun changement :
-- recoverPoolIfStuck relit le pool via getPoolRows (visibility-filtree)
-- apres l'unlock (provider.ts, `const refreshed = await getPoolRows(userId)`)
-- et retombe sur le saut de curseur si la face injectee n'y apparait pas.
-- Elargir try_unlock_one_typeface aux memes quatre filtres serait un
-- changement supplementaire, hors du perimetre de cette tache et non demande
-- par le relecteur, qui ne cible que la precondition.
--
-- AUCUN CHANGEMENT DE SCHEMA. Pas de colonne, pas d'index, pas d'ALTER TABLE.
-- Cette migration ne contient que des corps de fonctions.
--
-- IDEMPOTENCE. CREATE OR REPLACE FUNCTION uniquement. Reappliquer ce fichier
-- est sans effet au-dela de reposer les memes six definitions.

BEGIN;

-- ============================================================
-- 1. init_user_pool(p_user_id uuid) — arite sans familiarite (005)
--    Corps identique a 005, verrou consultatif en premiere instruction.
-- ============================================================

CREATE OR REPLACE FUNCTION init_user_pool(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  v_count int := 0;
  v_rows  int := 0;
  v_slug  text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Reevaluation sous verrou (fait H5) : le second appelant voit ici les
  -- lignes que le premier vient de valider pendant qu'il attendait, et
  -- sort avant de repeter une selection deja faite par l'autre arite.
  IF EXISTS (SELECT 1 FROM user_typeface_state WHERE user_id = p_user_id) THEN
    RETURN 0;
  END IF;

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

-- ============================================================
-- 2. init_user_pool(p_user_id uuid, p_familiarity text) — arite avec
--    familiarite (dernier corps : 006, quatre niveaux + palier hard).
--    Corps identique a 006, verrou consultatif en premiere instruction.
-- ============================================================

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
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Reevaluation sous verrou (fait H5), identique a l'autre arite : le
  -- second appelant sort ici s'il a perdu la course, au lieu d'inserer les
  -- lignes de SA propre selection, qui differe de celle de l'autre arite par
  -- construction (quotas easy/medium/hard vs tier N+D neutre).
  IF EXISTS (SELECT 1 FROM user_typeface_state WHERE user_id = p_user_id) THEN
    RETURN 0;
  END IF;

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

-- ============================================================
-- 3. rebalance_user_pool(p_user_id uuid) — redescente additive (007)
--    Corps identique a 007, verrou consultatif en premiere instruction.
-- ============================================================

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
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

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

-- ============================================================
-- 4. try_unlock_one_typeface(p_user_id uuid) — selection I-07 (008)
--    Corps identique a 008, verrou consultatif en premiere instruction,
--    inchange hors cet ajout : c'est aussi la primitive de croissance
--    consommee par register_mastery_unlock et par try_unlock_if_pool_stuck.
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
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

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
-- 5. register_mastery_unlock(p_user_id uuid) — compteur + unlock I-07 (008)
--    Corps identique a 008, verrou consultatif en premiere instruction. Le
--    verrou consultatif transactionnel est reentrant pour la meme session :
--    l'appel imbrique a try_unlock_one_typeface, qui reprend le meme verrou
--    dans la meme transaction, ne s'auto-bloque pas.
-- ============================================================

CREATE OR REPLACE FUNCTION register_mastery_unlock(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
  v_slug  text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

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

-- ============================================================
-- 6. try_unlock_if_pool_stuck — NOUVELLE fonction, appelee uniquement par
--    recoverPoolIfStuck (spec §4.5, pool sans eligible). Nom neuf, jamais
--    une surcharge : voir la note en tete de fichier.
--
--    Signature a quatre arguments depuis le round 3 (2026-08-01) : les trois
--    listes de visibilite (allowlist de licence, repli UFL, exclusion
--    latine) sont passees par l'appelant, memes valeurs que
--    RUNTIME_ALLOWED_LICENSE_TYPES / UFL_LEGACY_SLUGS / LATIN_UNREADY_SLUGS
--    deja importees dans provider.ts pour getPoolRows, jamais recopiees en
--    dur ici. Fonction jamais appliquee sur aucune base avant ce round,
--    donc ce changement de signature ne casse aucun appelant existant.
-- ============================================================

CREATE OR REPLACE FUNCTION try_unlock_if_pool_stuck(
  p_user_id uuid,
  p_allowed_license_types text[],
  p_ufl_legacy_slugs text[],
  p_latin_unready_slugs text[]
)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- JUMELLE de lib/game/training/provider.ts::getPoolRows. Les deux decident
  -- ce qui est VISIBLE au joueur : getPoolRows pour ce qui est reellement
  -- servi, cette precondition pour si le pool parait assez bloque pour
  -- justifier un unlock. Les quatre filtres ci-dessous doivent rester
  -- identiques a getPoolRows, parametre pour parametre : une ligne invisible
  -- ici mais comptee eligible est une ligne sur laquelle la precondition
  -- s'appuiera pour toujours, puisqu'une ligne invisible n'est jamais servie,
  -- donc jamais reprogrammee, donc son next_due_after_q ne bouge plus jamais
  -- de sa valeur de seed (0). Tenu synchronise par
  -- scripts/quality/check-pool-serialisation.mjs.
  IF EXISTS (
    SELECT 1
    FROM user_typeface_state uts
    JOIN users u ON u.user_id = uts.user_id
    JOIN typefaces_core tc ON tc.typeface_slug = uts.typeface_slug
    WHERE uts.user_id = p_user_id
      AND uts.in_active_pool = true
      AND uts.next_due_after_q <= u.global_q_index
      AND tc.activation_status = true
      AND (
        tc.license_type::text = ANY(p_allowed_license_types)
        OR tc.typeface_slug = ANY(p_ufl_legacy_slugs)
      )
      AND tc.typeface_slug <> ALL(p_latin_unready_slugs)
  ) THEN
    RETURN NULL;
  END IF;

  RETURN try_unlock_one_typeface(p_user_id);
END $$;

COMMIT;
