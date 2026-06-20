# Catalogue Workbook 1000+ Spec

Ce document définit la cible exacte du workbook catalogue pour faire passer JEUX DE TYPO de `28` typos de test à un catalogue `1000+` prêt pour le lancement.

Il doit servir de référence avant toute demande à Claude, avant tout travail Excel massif, et avant tout import en base.

Pour la stratégie d'automatisation progressive associée, voir aussi:
- `docs/catalog/catalog-automation-roadmap.md`

## 1) Objectif

Construire un workbook unique qui permet de produire un catalogue typo:
- massif (`1000+`),
- cohérent,
- vérifiable automatiquement,
- exploitable par la base PostgreSQL,
- compatible avec le moteur pédagogique `training`,
- extensible à `competition` et `expert`.

Le vrai objectif n'est pas juste d'avoir `1000 lignes`.

Le vrai objectif est d'avoir `1000+ typos runtime-ready`, c'est-à-dire:
- cataloguées proprement,
- activables,
- servables côté front,
- traçables côté licences,
- compatibles avec le moteur et les réponses Expert.

## 2) Principe de structure

On sépare le problème en trois couches:

1. `Catalogue éditorial`
- identité typo,
- classification,
- signature visuelle,
- niveau pédagogique,
- gouvernance.

2. `Assets runtime`
- fichiers `.woff2`,
- chemins runtime,
- hash,
- taille,
- état de disponibilité.

3. `Réponses et pédagogie`
- réponses Expert,
- cartes Reading,
- cartes Misread,
- familles de confusion.

## 3) Ce qui compte dans le total 1000+

On suit quatre chiffres différents:

1. `catalog_total`
- nombre total de lignes typo présentes.

2. `catalog_active`
- nombre de typos activées produit.

3. `runtime_ready_total`
- nombre de typos actives avec au moins un asset runtime `ready`.

4. `expert_ready_total`
- nombre de typos `expert_enabled=true` avec réponse canonique validée.

La cible avant démarrage est:
- `catalog_total >= 1000`
- `runtime_ready_total >= 1000`
- QA bloquante = `0`

## 4) Règle de comptage d'une typo “launch-ready”

Une typo compte réellement dans l'objectif seulement si:

1. elle existe dans `typefaces_core`,
2. son `typeface_slug` est unique,
3. sa `structural_signature_json` est valide,
4. ses profils (`contrast_profile`, `aperture_profile`) sont cohérents,
5. si `activation_status=true`, elle possède au moins un asset runtime `ready`,
6. sa licence est renseignée,
7. si `expert_enabled=true`, elle possède une réponse canonique validée.

Sinon, elle peut exister dans le workbook, mais elle ne compte pas dans le vrai total de lancement.

## 5) Sheets obligatoires du workbook

Le workbook cible doit contenir au minimum ces sheets:

1. `meta_versioning`
2. `typefaces_core`
3. `font_runtime_assets_source`
4. `expert_answer_keys`
5. `reading_cards`
6. `confusion_families`
7. `misread_cards`
8. `enums_reference`
9. `qa_rules`
10. `qa_report`
11. `versioning_notes`

## 6) Sheet `meta_versioning`

Rôle:
- tracer la version du workbook,
- tracer les sources,
- éviter les ambiguïtés.

Colonnes minimales:
- `catalog_version`
- `spec_version`
- `created_at_utc`
- `updated_at_utc`
- `owner`
- `source_excel_name`
- `source_fonts_dir`
- `status`
- `change_note`

## 7) Sheet `typefaces_core`

Rôle:
- source de vérité éditoriale de chaque typo.

### 7.1 Colonnes minimales obligatoires

- `typeface_slug`
- `display_name`
- `display_name_ascii`
- `primary_category`
- `sub_category`
- `visual_cluster_id`
- `dreyfus_tier`
- `difficulty_base`
- `rarity_tag`
- `activation_status`
- `font_source`
- `is_variable_font`
- `year_tag`
- `weight_structure`
- `contrast_profile`
- `aperture_profile`
- `structural_signature_json`
- `release_year`
- `designer`
- `foundry`
- `license_type`
- `license_url`
- `fallback_stack`
- `expert_enabled`
- `min_mode`
- `qa_status`
- `updated_at_utc`

### 7.2 Règles obligatoires

1. `typeface_slug` en `snake_case`, unique.
2. `display_name_ascii` = nom normalisé sans accents ni ponctuation forte.
3. `font_source='future'` implique `activation_status=false`.
4. `contrast_profile` doit égaler `structural_signature_json.contrast`.
5. `aperture_profile` doit égaler `structural_signature_json.e_aperture`.
6. `min_mode` doit être dans `training|competition|expert`.

### 7.3 Signature structurelle

`structural_signature_json` doit contenir exactement les clés suivantes:

- `a_type`
- `e_aperture`
- `axis`
- `contrast`
- `terminals`
- `serifs`
- `x_height`
- `fixed_width`
- `width`
- `caps_only`
- `distinctive_w`

Pas plus. Pas moins.

## 8) Sheet `font_runtime_assets_source`

Rôle:
- décrire la source réelle des fichiers de font avant import DB.

Cette sheet sert d'étape de production. Elle n'est pas forcément la table finale SQL, mais elle doit permettre d'alimenter `font_runtime_assets`.

### 8.1 Colonnes minimales

- `typeface_slug`
- `file_role`
- `font_format`
- `weight`
- `style`
- `source_path`
- `runtime_path`
- `file_size_bytes`
- `sha256_hash`
- `runtime_status`
- `asset_origin`
- `verified_at_utc`
- `updated_at_utc`

### 8.2 Règles obligatoires

1. `runtime_path` doit être relatif au projet web ou exprimé comme chemin public (`/fonts/...`).
2. Toute typo `activation_status=true` doit avoir au moins un asset `runtime_status=ready`.
3. `system_local` ne compte pas comme `runtime-ready` pour le lancement production.
4. Toute ligne doit pointer vers un vrai fichier vérifiable.

## 9) Sheet `expert_answer_keys`

Rôle:
- décrire toutes les réponses autorisées en mode Expert.

### 9.1 Colonnes minimales

- `typeface_slug`
- `answer_text`
- `answer_normalized`
- `is_canonical`
- `locale`
- `qa_status`
- `updated_at_utc`

### 9.2 Règles obligatoires

1. `answer_normalized` = lowercase + accents supprimés + espaces supprimés + ponctuation supprimée.
2. Une seule réponse canonique par `typeface_slug`.
3. Pas d'alias libres non validés.
4. Toute typo `expert_enabled=true` doit avoir au moins une réponse canonique `approved`.

## 10) Sheet `reading_cards`

Rôle:
- cartes pédagogiques de lecture/observation.

Colonnes minimales:
- `card_id`
- `typeface_slug`
- `locale`
- `line_identity`
- `line_observe`
- `tone`
- `qa_status`
- `active`

Règle:
- une carte doit rester brève, neutre, actionnable, non punitive.

## 11) Sheet `confusion_families`

Rôle:
- regrouper des erreurs visuelles typiques.

Colonnes minimales:
- `confusion_family_id`
- `label`
- `criteria_signature_json`
- `severity_band`
- `active`
- `owner`

## 12) Sheet `misread_cards`

Rôle:
- contenu déclenché après erreur selon famille de confusion.

Colonnes minimales:
- `card_id`
- `confusion_family_id`
- `locale`
- `line_confusion`
- `line_observe`
- `tone`
- `qa_status`
- `active`

## 13) Sheet `enums_reference`

Rôle:
- figer les valeurs autorisées pour éviter les dérives éditoriales.

Colonnes minimales:
- `field_name`
- `allowed_value`
- `description`
- `status`

Exemples de champs à couvrir:
- `primary_category`
- `sub_category`
- `difficulty_base`
- `rarity_tag`
- `dreyfus_tier`
- `font_source`
- `year_tag`
- `weight_structure`
- `contrast_profile`
- `aperture_profile`
- `license_type`
- `min_mode`
- `qa_status`

## 14) Sheet `qa_rules`

Rôle:
- rendre la QA explicite et automatisable.

Colonnes minimales:
- `rule_id`
- `severity`
- `sheet_name`
- `field_name`
- `rule_text`
- `blocking`
- `active`

Exemples de règles bloquantes:
- slug dupliqué
- JSON invalide
- typo active sans runtime asset
- typo Expert sans réponse canonique
- licence inconnue sur typo active

## 15) Sheet `qa_report`

Rôle:
- recevoir le résultat d'une passe QA.

Colonnes minimales:
- `run_id`
- `checked_at_utc`
- `sheet_name`
- `row_ref`
- `rule_id`
- `severity`
- `status`
- `detail`

## 16) Sheet `versioning_notes`

Rôle:
- journal de changements éditoriaux.

Colonnes minimales:
- `entry_id`
- `changed_at_utc`
- `changed_by`
- `scope`
- `change_summary`
- `impact`

## 17) QA bloquante minimale

Le workbook n'est pas “prêt à importer” si une seule règle bloquante échoue.

### 17.1 Blocants absolus

1. `typeface_slug` dupliqué.
2. `structural_signature_json` invalide.
3. clés de signature manquantes ou en trop.
4. incohérence `contrast_profile`.
5. incohérence `aperture_profile`.
6. typo active sans asset runtime `ready`.
7. typo `expert_enabled=true` sans réponse canonique validée.
8. licence vide ou `unknown` sur typo active de lancement.
9. `runtime_path` manquant pour une typo active comptée dans le lancement.

### 17.2 Warnings importants

1. `designer` manquant.
2. `foundry` manquant.
3. `release_year` manquant.
4. couverture incomplète d'un `visual_cluster_id`.
5. absence de `rare` ou de `A/E` dans la distribution totale.

## 18) Distribution cible recommandée pour 1000+

Le workbook massif ne doit pas être juste gros. Il doit aussi être équilibré.

### 18.1 Répartition par niveau

Recommandation de départ:
- `N` : 30 à 40 %
- `D` : 25 à 30 %
- `C` : 15 à 20 %
- `A` : 10 à 15 %
- `E` : 5 à 10 %

### 18.2 Répartition par rareté

Recommandation de départ:
- `common` : 50 à 60 %
- `uncommon` : 25 à 35 %
- `rare` : 10 à 20 %

### 18.3 Répartition par catégorie

Éviter qu'une seule famille prenne toute la place.

Minimum recommandé:
- `sans_serif`
- `serif`
- `mono`
- `display`

toutes représentées de manière significative.

## 19) Définition de Done “catalogue 1000+”

Le chantier est considéré comme prêt quand:

1. `catalog_total >= 1000`
2. `runtime_ready_total >= 1000`
3. QA bloquante = `0`
4. toutes les typos actives ont un chemin runtime exploitable
5. toutes les typos Expert ont une réponse canonique
6. les distributions Dreyfus et rareté ne sont plus incomplètes
7. le workbook est versionné et traçable

## 20) Ordre recommandé de production

1. Finaliser ce spec workbook.
2. Demander à Claude de produire le workbook massif dans ce format.
3. Contrôler la QA structurelle.
4. Vérifier les assets runtime réels.
5. Importer en base.
6. Vérifier les compteurs `catalog_total`, `runtime_ready_total`, `expert_ready_total`.
7. Ensuite seulement enrichir davantage le moteur et le gameplay.

## 21) Conclusion opérationnelle

Le passage à `1000+` n'est pas un problème d'infrastructure.

C'est un problème de:
- format éditorial,
- qualité des données,
- pipeline de validation,
- disponibilité réelle des assets.

La bonne méthode n'est donc pas de “rajouter des lignes”.

La bonne méthode est de produire un workbook massif, rigoureux, versionné, et directement compatible avec la DB et le runtime.
