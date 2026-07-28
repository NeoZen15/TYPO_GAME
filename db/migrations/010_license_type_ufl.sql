-- ============================================================
-- MIGRATION 010 — licence UFL dans l'enum + vue QA alignee sur le garde-fou
-- JEUX DE TYPO
-- Requiert : migrations 001..002 appliquees (au moins 002 pour le catalogue)
-- PostgreSQL 13+ (Neon)
-- ============================================================
--
-- NON APPLIQUEE. Ce fichier n'a PAS ete execute. La base Neon est en production,
-- l'application demande le feu vert explicite du proprietaire du projet.
--
-- POURQUOI. app.license_type_enum (migration 002) ne connait que 'ofl',
-- 'apache2', 'proprietary' et 'unknown'. Les cinq polices de la famille Ubuntu
-- sont publiees sous Ubuntu Font Licence 1.0 (libre, usage commercial autorise)
-- et n'ont donc AUCUNE valeur juste dans cet enum : elles restent a 'unknown',
-- c'est a dire indistinguables d'un trou de donnee. Verification faite sur le
-- snapshot du projet 02_ASSETS_TYPO/google_fonts/06_repo_snapshot/fonts-main :
-- le dossier ufl/ contient exactement ces cinq dossiers, chacun avec un
-- LICENCE.txt titre "UBUNTU FONT LICENCE Version 1.0" et un METADATA.pb portant
-- license: "UFL". Aucune autre police du catalogue n'est dans ufl/.
--
-- CE QUE CA DEBLOQUE. Le garde-fou runtime (lib/game/license-guard.ts) refuse de
-- servir une typo dont la licence n'est pas etablie. Il porte aujourd'hui une
-- exception par slug pour ces cinq polices, precisement parce que l'enum ne peut
-- pas dire la verite sur elles. Apres cette migration l'exception devient inutile
-- et la liste UFL_LEGACY_SLUGS peut etre videe.
--
-- ORDRE D'EXECUTION IMPERATIF. PostgreSQL interdit d'UTILISER une valeur d'enum
-- dans la meme transaction que celle qui l'ajoute. L'etape 1 et l'etape 2 doivent
-- donc etre deux transactions distinctes. Executees telles quelles via psql sans
-- BEGIN explicite, chaque instruction est sa propre transaction : c'est correct.
-- Ne pas envelopper ce fichier dans un BEGIN / COMMIT unique.
--
-- ORDRE AVEC LE CATALOGUE JSON. content/catalog/typefaces-core.json garde
-- volontairement license_type = 'unknown' sur ces cinq slugs, parce qu'ecrire
-- 'ufl' dans le JSON avant cette migration ferait echouer tout reimport (valeur
-- absente de l'enum). Apres application de l'etape 1, le JSON peut passer a
-- 'ufl' sans risque. Tant que ce n'est pas fait, un reimport du catalogue
-- REPOUSSERAIT 'unknown' par dessus le 'ufl' ecrit par l'etape 2.
--
-- IDEMPOTENCE. ADD VALUE IF NOT EXISTS, UPDATE conditionnel, CREATE OR REPLACE
-- VIEW. Reappliquer la migration est sans effet.

-- ============================================================
-- 1. Ajout du label 'ufl' a l'enum de licence
--    A executer seul, puis committer, avant l'etape 2.
-- ============================================================

ALTER TYPE app.license_type_enum ADD VALUE IF NOT EXISTS 'ufl';

-- ============================================================
-- 2. Les cinq polices Ubuntu passent de 'unknown' a 'ufl'
--    Transaction SEPAREE de l'etape 1 (contrainte PostgreSQL sur les enums).
--    Le WHERE ne touche que des lignes encore a 'unknown' : aucune decision
--    editoriale ecrasee si quelqu'un a deja tranche autrement.
-- ============================================================

UPDATE typefaces_core
SET license_type = 'ufl',
    license_url = COALESCE(license_url, 'https://canonical.com/legal/font-licence'),
    updated_at_utc = now()
WHERE typeface_slug IN (
  'ubuntu',
  'ubuntucondensed',
  'ubuntumono',
  'ubuntusans',
  'ubuntusansmono'
)
  AND license_type = 'unknown';

-- ============================================================
-- 3. Vue QA alignee sur le garde-fou runtime
--    v_qa_unknown_license (migration 002) ne signalait que license_type =
--    'unknown'. Le garde-fou runtime raisonne en LISTE BLANCHE : tout ce qui
--    n'est pas une licence libre connue est refuse, y compris 'proprietary' et
--    tout label ajoute plus tard. La vue QA dit maintenant la meme chose que le
--    moteur, sinon la QA declare conforme un lot que le runtime refusera.
--    Nom et colonnes inchanges pour rester compatible CREATE OR REPLACE VIEW.
-- ============================================================

CREATE OR REPLACE VIEW v_qa_unknown_license AS
  SELECT tc.typeface_slug, 'license_type_not_runtime_cleared' AS rule
  FROM typefaces_core tc
  WHERE tc.activation_status = true
    AND tc.license_type::text NOT IN ('ofl', 'apache2', 'ufl');

-- ============================================================
-- 4. Verification manuelle apres application (aucune ecriture)
-- ============================================================

-- SELECT license_type, count(*) FROM typefaces_core
--   WHERE activation_status = true GROUP BY 1 ORDER BY 1;
-- Attendu apres application : ofl 1149, apache2 18, ufl 5, aucune 'unknown'.
--
-- SELECT * FROM v_qa_unknown_license;
-- Attendu apres application : 0 ligne.
