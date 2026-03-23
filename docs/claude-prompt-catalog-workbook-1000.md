# Claude Prompt — Workbook Catalogue 1000+

Contexte projet

Je construis JEUX DE TYPO, un moteur pédagogique de reconnaissance typographique.
Le backend et la base PostgreSQL existent déjà.
Le front Training commence à être branché à la vraie base.

Le vrai chantier prioritaire maintenant est le catalogue typo.

Je ne veux pas un petit fichier de test.
Je veux un vrai workbook catalogue massif, structuré pour viser 1000+ typos minimum avant lancement.

Le workbook doit être exploitable comme source éditoriale et compatible avec un pipeline d'import vers PostgreSQL.

Objectif exact

Tu dois produire un workbook catalogue conçu pour permettre un catalogue :
- 1000+ typos,
- propres,
- versionnées,
- vérifiables automatiquement,
- compatibles runtime,
- exploitables pour Training, puis Competition et Expert.

Important :
- Le vrai objectif n'est pas juste 1000 lignes.
- Le vrai objectif est 1000+ typos runtime-ready.

Une typo ne compte vraiment dans le lancement que si :
1. elle existe dans typefaces_core,
2. sa signature structurelle est valide,
3. ses profils sont cohérents,
4. si elle est active, elle a au moins un asset runtime ready,
5. sa licence est renseignée,
6. si expert_enabled=true, elle a une réponse canonique validée.

Invariants produit à respecter

1. Une typo ratée ne revient jamais immédiatement.
2. Le pool actif bouge selon la performance utilisateur, pas selon un ordre statique.
3. En Training, le retry sur la même question est autorisé.
4. Le moteur de répétition espacée reste prioritaire.
5. Le catalogue global peut dépasser 1000+ typos sans changer la logique runtime.
6. Le frontend n'a pas le pouvoir décisionnel pédagogique.

Mission

Produire un workbook catalogue massif, structuré, cohérent, prêt à devenir la source éditoriale officielle.

Je veux un résultat ultra précis, pas une réponse floue.
Si une info manque, tu crées une colonne explicite ou une note de QA. Tu n'inventes pas silencieusement.

Structure obligatoire du workbook

Le workbook doit contenir au minimum ces sheets exactes :

1. meta_versioning
2. typefaces_core
3. font_runtime_assets_source
4. expert_answer_keys
5. reading_cards
6. confusion_families
7. misread_cards
8. enums_reference
9. qa_rules
10. qa_report
11. versioning_notes

Spécification détaillée

Sheet meta_versioning
- catalog_version
- spec_version
- created_at_utc
- updated_at_utc
- owner
- source_excel_name
- source_fonts_dir
- status
- change_note

Sheet typefaces_core
Colonnes obligatoires :
- typeface_slug
- display_name
- display_name_ascii
- primary_category
- sub_category
- visual_cluster_id
- dreyfus_tier
- difficulty_base
- rarity_tag
- activation_status
- font_source
- is_variable_font
- year_tag
- weight_structure
- contrast_profile
- aperture_profile
- structural_signature_json
- release_year
- designer
- foundry
- license_type
- license_url
- fallback_stack
- expert_enabled
- min_mode
- qa_status
- updated_at_utc

Contraintes obligatoires :
- typeface_slug en snake_case et unique
- font_source='future' => activation_status=false
- contrast_profile == structural_signature_json.contrast
- aperture_profile == structural_signature_json.e_aperture
- min_mode dans training|competition|expert

Le JSON structural_signature_json doit contenir exactement les clés :
- a_type
- e_aperture
- axis
- contrast
- terminals
- serifs
- x_height
- fixed_width
- width
- caps_only
- distinctive_w

Sheet font_runtime_assets_source
Colonnes obligatoires :
- typeface_slug
- file_role
- font_format
- weight
- style
- source_path
- runtime_path
- file_size_bytes
- sha256_hash
- runtime_status
- asset_origin
- verified_at_utc
- updated_at_utc

Contraintes :
- runtime_path doit être exploitable dans le projet web
- toute typo active doit avoir au moins un runtime_status=ready
- system_local ne compte pas comme runtime-ready pour le lancement

Sheet expert_answer_keys
Colonnes obligatoires :
- typeface_slug
- answer_text
- answer_normalized
- is_canonical
- locale
- qa_status
- updated_at_utc

Règles :
- answer_normalized = lowercase + accents retirés + ponctuation retirée + espaces retirés
- une seule réponse canonique par typeface_slug
- pas d'alias libres non validés
- toute typo expert_enabled=true doit avoir une réponse canonique validée

Sheet reading_cards
Colonnes minimales :
- card_id
- typeface_slug
- locale
- line_identity
- line_observe
- tone
- qa_status
- active

Sheet confusion_families
Colonnes minimales :
- confusion_family_id
- label
- criteria_signature_json
- severity_band
- active
- owner

Sheet misread_cards
Colonnes minimales :
- card_id
- confusion_family_id
- locale
- line_confusion
- line_observe
- tone
- qa_status
- active

Sheet enums_reference
Doit contenir les valeurs autorisées pour au moins :
- primary_category
- sub_category
- difficulty_base
- rarity_tag
- dreyfus_tier
- font_source
- year_tag
- weight_structure
- contrast_profile
- aperture_profile
- license_type
- min_mode
- qa_status

Sheet qa_rules
Colonnes minimales :
- rule_id
- severity
- sheet_name
- field_name
- rule_text
- blocking
- active

Sheet qa_report
Colonnes minimales :
- run_id
- checked_at_utc
- sheet_name
- row_ref
- rule_id
- severity
- status
- detail

Sheet versioning_notes
Colonnes minimales :
- entry_id
- changed_at_utc
- changed_by
- scope
- change_summary
- impact

QA bloquante minimale

Le workbook est refusé si une seule de ces règles échoue :

1. slug dupliqué
2. JSON structural_signature_json invalide
3. clés JSON manquantes ou en trop
4. incohérence contrast_profile
5. incohérence aperture_profile
6. typo active sans asset runtime ready
7. typo expert_enabled=true sans réponse canonique validée
8. licence inconnue ou vide sur typo active
9. runtime_path manquant pour une typo active comptée dans le lancement

Warnings importants à isoler

1. designer manquant
2. foundry manquant
3. release_year manquant
4. couverture incomplète des visual_cluster_id
5. distribution dreyfus_tier incomplète
6. distribution rarity_tag incomplète

Distribution cible recommandée

Le workbook ne doit pas seulement être grand, il doit être équilibré.

Répartition cible Dreyfus :
- N : 30 à 40 %
- D : 25 à 30 %
- C : 15 à 20 %
- A : 10 à 15 %
- E : 5 à 10 %

Répartition cible rareté :
- common : 50 à 60 %
- uncommon : 25 à 35 %
- rare : 10 à 20 %

Les catégories suivantes doivent être réellement représentées :
- sans_serif
- serif
- mono
- display

Livrables attendus

Je veux :

1. la structure exacte du workbook
2. le détail colonne par colonne
3. les contraintes métier
4. les règles QA
5. les distributions cibles
6. un plan de remplissage réaliste pour aller vers 1000+
7. les points qui restent inconnus séparés clairement des points validés

Je veux aussi que tu distingues explicitement :
- catalog_total
- catalog_active
- runtime_ready_total
- expert_ready_total

Definition of Done

Le chantier catalogue 1000+ est considéré prêt quand :
- catalog_total >= 1000
- runtime_ready_total >= 1000
- QA bloquante = 0
- toutes les typos actives ont un runtime_path exploitable
- toutes les typos expert_enabled ont une réponse canonique
- les distributions Dreyfus et rareté ne sont plus incomplètes
- le workbook est versionné et traçable

Important

- Ne réponds pas vaguement.
- Ne simplifie pas en une seule table.
- Ne suppose pas qu'un asset local système suffit pour le lancement.
- Si une information n'est pas disponible, rends ce manque visible dans la structure ou dans la QA.
- Je veux un résultat exploitable par une vraie équipe produit/data, pas une démonstration.
```

## Utilisation recommandée

Ordre conseillé:

1. relire le spec dans [catalog-workbook-1000-spec.md](/Users/launaymarion/Documents/JEUX_DE_TYPO/09_DEV/08_jeux-de-typo-v2./docs/catalog-workbook-1000-spec.md)
2. envoyer ce prompt à Claude
3. récupérer sa proposition
4. me la renvoyer pour audit avant exécution ou adaptation
