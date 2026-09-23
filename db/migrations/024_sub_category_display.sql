-- ============================================================
-- MIGRATION 024 : une case honnete pour les polices dessinees
-- Genere par scripts/build_adobe_mass_catalog_migration.py le 2026-09-15
-- APPLIQUEE EN PRODUCTION le 2026-09-23, sur feu vert explicite du proprietaire.
-- TESTEE le 2026-09-23 sur la branche jetable br-broad-bar-abxfygwz, avec la 025.
-- A appliquer AVANT la 025, et dans sa propre transaction.
-- Retour arriere : 024_sub_category_display.rollback.sql
-- ============================================================
--
-- POURQUOI UNE VALEUR DE PLUS. app.sub_category_enum porte neuf valeurs, toutes
-- issues de la classification Vox : aucune ne dit "dessinee". Les familles
-- qu'Adobe classe en decorative ou en blackletter n'ont donc aucune case juste.
-- Les ranger en 'script' serait faux pour un blackletter et pour une decorative
-- sur deux, et ce champ n'est pas decoratif : il decide du visual_cluster_id, donc
-- des mauvaises reponses proposees au joueur. Une valeur de plus coute moins cher
-- qu'une donnee fausse crue par le jeu.
--
-- POURQUOI ELLE EST SEULE DANS SON FICHIER. PostgreSQL interdit d'utiliser une
-- valeur d'enum neuve dans la transaction qui l'ajoute. La 025, qui insere
-- 526 lignes en sub_category 'display', ne peut donc pas porter cet ALTER.

BEGIN;

ALTER TYPE app.sub_category_enum ADD VALUE IF NOT EXISTS 'display';

COMMIT;
