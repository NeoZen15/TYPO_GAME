# Catalogue Automation Roadmap

Ce document fixe la stratégie d'automatisation du catalogue typographique JEUX DE TYPO.

Il existe pour éviter deux écueils:

1. oublier pourquoi on a choisi une approche progressive,
2. reconstruire le raisonnement à chaque fois qu'on reparle du catalogue `1000+`.

Le sujet ici n'est pas le gameplay, ni le backend training pur.
Le sujet ici est:

- comment produire un catalogue massif propre,
- comment automatiser le plus possible sans se mentir,
- et dans quel ordre le faire sans ralentir le projet.

## 1) Problème à résoudre

Aujourd'hui, le système technique sait déjà:

- stocker un catalogue en base,
- importer des typos,
- importer des assets runtime,
- servir les fonts côté front,
- utiliser les données dans le mode Training.

Le vrai goulot n'est donc plus l'infrastructure.

Le vrai goulot est:

- passer de `28` typos de test à `1000+`,
- sans faire `1000` lignes à la main dans un fichier fragile,
- sans casser la qualité,
- sans perdre la logique pédagogique.

## 2) Objectif

Construire un pipeline qui permette de produire un catalogue `1000+`:

- versionné,
- relançable,
- auditable,
- compatible avec la DB,
- compatible avec le runtime,
- compatible avec le moteur pédagogique,
- et réaliste à maintenir.

Le point clé:

Le but n'est pas d'avoir “1000 lignes”.

Le but est d'avoir `1000+ typos runtime-ready`, c'est-à-dire:

- connues par le système,
- techniquement exploitables,
- propres côté licences,
- et prêtes à être intégrées dans le moteur.

## 3) Pourquoi on ne veut pas un gros workbook comme source principale

Un workbook Excel est utile comme vue éditoriale, mais devient vite peu pratique à grande échelle.

### 3.1 Limites d'un workbook comme source canonique

1. Les sheets dérivent facilement:
- notes,
- légendes,
- couleurs,
- lignes décoratives,
- formules ambiguës.

2. Le versioning est faible:
- difficile de comprendre les changements ligne par ligne,
- difficile de relire proprement les diffs.

3. L'import devient fragile:
- les scripts doivent deviner ce qui est une vraie ligne ou non.

4. Plus le catalogue grossit, plus l'outil devient lourd:
- lent à lire,
- lent à corriger,
- difficile à maintenir à plusieurs.

### 3.2 Ce qu'un workbook peut encore très bien faire

1. servir de vue de travail,
2. servir d'export humain,
3. servir de support de review,
4. servir de snapshot éditorial.

### 3.3 Conclusion

Le workbook peut rester utile.

Mais il ne doit plus être la seule réponse au problème du catalogue massif.

## 4) La recommandation retenue

La stratégie recommandée est:

### V1
Pipeline d'automatisation simple, relançable, honnête

### V2
Pipeline assisté avec suggestions automatiques sur les champs métier

### V3
Backoffice intelligent de review et d'approbation

L'idée n'est pas d'abandonner V2/V3.

L'idée est de ne pas commencer par la marche la plus lourde.

## 5) V1 — Pipeline automatique simple

### 5.1 But

Automatiser toute la plomberie fiable dès maintenant.

### 5.2 Ce qu'on automatise en V1

Champs techniques et robustes:

- `typeface_slug`
- `display_name`
- `display_name_ascii`
- `font_source`
- `is_variable_font`
- `runtime_path`
- `file_size_bytes`
- `sha256_hash`
- `asset_origin`
- `runtime_status`
- `expert_answer_keys` de base
- `activation_status=false` par défaut pour les nouvelles entrées
- `qa_status=draft` par défaut

### 5.3 Ce qu'on ne prétend pas automatiser totalement en V1

Champs éditoriaux/pédagogiques:

- `primary_category`
- `sub_category`
- `visual_cluster_id`
- `dreyfus_tier`
- `difficulty_base`
- `rarity_tag`
- `structural_signature_json`
- `reading_cards`
- `confusion_families`
- `misread_cards`

Ces champs peuvent recevoir une valeur vide, `draft`, `unknown`, ou une suggestion brute.
Mais ils doivent rester identifiés comme nécessitant validation.

### 5.4 Livrables V1

1. format canonique dans le repo,
2. script de génération de drafts,
3. génération automatique de:
- `typefaces_core_draft`
- `font_runtime_assets`
- `expert_answer_keys`
4. QA structurelle automatique,
5. import DB relançable.

### 5.4.1 Implémentation actuelle dans le repo

Les premiers éléments V1 vivent ici:

- `content/catalog/README.md`
- `content/catalog/catalog-meta.json`
- `content/catalog/typefaces-core.seed.json`
- `content/catalog/font-runtime-assets.seed.json`
- `content/catalog/expert-answer-keys.seed.json`
- `content/catalog/overrides/README.md`
- `content/catalog/overrides/typefaces-core.overrides.json`
- `content/catalog/overrides/font-runtime-assets.overrides.json`
- `content/catalog/overrides/expert-answer-keys.overrides.json`
- `content/catalog/catalog-build-meta.json`
- `content/catalog/typefaces-core.json`
- `content/catalog/font-runtime-assets.json`
- `content/catalog/expert-answer-keys.json`
- `content/catalog/candidates/README.md`
- `content/catalog/candidates/candidate-scan-meta.json`
- `content/catalog/candidates/typefaces-core.candidates.json`
- `content/catalog/candidates/font-runtime-assets.candidates.json`
- `content/catalog/candidates/expert-answer-keys.candidates.json`
- `content/catalog/batches/README.md`
- `content/catalog/batches/google-fonts-batch-001.selection.json`
- `content/catalog/batches/google-fonts-batch-001/`
- `scripts/generate_catalog_seed.py`
- `scripts/build_catalog.py`
- `scripts/import_catalog_json.py`
- `scripts/generate_catalog_candidates.py`
- `scripts/run_catalog_v1_pipeline.py`
- `scripts/build_candidate_batch.py`
- `scripts/audit_catalog_promotion.py`
- `scripts/prepare_catalog_runtime.py`
- `scripts/stage_catalog_promotion.py`
- `scripts/generate_editorial_review_template.py`
- `scripts/build_reviewed_promotion.py`
- `scripts/run_catalog_promotion_pipeline.py`

Ces fichiers constituent le premier socle canonique local pour sortir du mode workbook-only:

- les `*.seed.json` restent relançables et purement machine,
- les `overrides/*.json` portent les corrections humaines,
- les fichiers sans suffixe `.seed` sont les sorties finales importables,
- l'import DB se fait directement depuis ces sorties finales,
- les `candidates/*.json` servent de file d'attente éditoriale pour les fontes découvertes hors catalogue courant,
- les `batches/` servent à sélectionner un lot fini et vraiment revu avant toute promotion plus forte.

Le flux de promotion est maintenant plus précis:

1. `audit`
2. `runtime prep`
3. `promotion staging`
4. `editorial review template`
5. `reviewed promotion validation`

Ce point est important: la promotion n'est plus un geste flou.
Elle est désormais bloquée automatiquement tant que la review éditoriale n'est
pas réellement terminée.

### 5.4.3 Premier batch réel

Un premier lot réel a été extrait du gros snapshot Google Fonts:

- batch id: `google-fonts-batch-001`
- taille: `50` familles

Positionnement:

- ce batch est bien sélectionné et "promu" dans le flux de review,
- mais il n'est pas encore importé dans le catalogue principal,
- car il manque encore les champs éditoriaux lourds et la préparation runtime.

Depuis, deux validations supplémentaires ont été faites:

- le lot pilote de `10` a passé tout le pipeline technique jusqu'au template de review,
- le lot de `50` a lui aussi passé le pipeline technique jusqu'au template de review.

Puis la montée en charge a été validée pour de vrai:

- le lot pilote de `10` a été relu, promu, rebuildé et sync en base,
- le lot de `50` a reçu une review éditoriale structurée,
- `40` nouvelles typos de ce lot ont ensuite été promues dans le catalogue principal,
- les `10` restantes étaient déjà présentes et ont été filtrées avant merge.

Conclusion actuelle:

- le pipeline n'est plus seulement prêt sur le papier,
- il a déjà absorbé une vraie vague de promotion intermédiaire,
- et le prochain goulot n'est plus technique mais éditorial / produit.

Autrement dit:

- étape 1 terminée: sélection utile faite
- étape 2 terminée au sens workflow: promotion en lot de review faite
- étape 3 reste à faire plus tard: promotion importable dans le catalogue principal

### 5.4.2 Réalité actuelle du corpus local

Le pipeline large a aussi été testé contre les fontes locales actuellement disponibles.

Résultat au moment de cette passe:

- `174` fichiers scannés
- `24` familles détectées
- `28` slugs déjà connus par le catalogue courant
- `1` nouvelle famille candidate seulement: `itc_garamond_std`
- cette candidate n'est pas runtime-ready (`ttf` local uniquement, pas de `woff2`)

Conclusion pratique:

Le pipeline est prêt pour grossir.

Mais le corpus local actuellement disponible ne permet pas encore de monter
massivement vers `1000+`.

Le prochain vrai multiplicateur n'est donc plus le code du pipeline.

Le prochain multiplicateur est l'arrivée d'une source de fonts beaucoup plus large.

### 5.5 Définition de Done V1

V1 est réussi si:

1. le pipeline peut générer des drafts sans édition manuelle,
2. les assets runtime sont détectés proprement,
3. les hash et tailles sont calculés automatiquement,
4. les slugs sont stables,
5. le rerun du pipeline ne casse pas l'existant,
6. les champs non fiabilisés restent explicitement en `draft` ou équivalent.

## 6) V2 — Pipeline assisté

### 6.1 But

Réduire la quantité de review manuelle sans prétendre supprimer la validation humaine.

### 6.2 Ce qu'on ajoute en V2

1. suggestions de `primary_category`,
2. suggestions de `sub_category`,
3. suggestions de `contrast_profile`,
4. suggestions de `aperture_profile`,
5. suggestions de `weight_structure`,
6. score de confiance par champ,
7. statut `needs_review`.

### 6.3 Ce que V2 nécessite

1. un petit jeu de données propres déjà validées,
2. des règles explicites de confiance,
3. un format qui distingue:
- `auto_value`
- `reviewed_value`
- `confidence`

### 6.4 Pourquoi on ne commence pas ici

Parce qu'avant de suggérer intelligemment, il faut:

1. avoir une base de référence propre,
2. prouver le pipeline V1,
3. comprendre où la review humaine coûte vraiment du temps.

Sinon, on construit de l'assistance sur des données encore instables.

### 6.5 Définition de Done V2

V2 est réussi si:

1. le système propose des suggestions utiles,
2. les suggestions ne sont jamais confondues avec des valeurs validées,
3. les champs à faible confiance restent visibles comme tels,
4. le temps de review humain diminue réellement.

## 7) V3 — Backoffice intelligent

### 7.1 But

Industrialiser la production éditoriale à grande échelle.

### 7.2 Ce que contient V3

1. interface admin,
2. vues de review par typo,
3. workflow `draft -> review -> approved -> active`,
4. filtres QA,
5. recherche et tri,
6. historique de changements,
7. suggestions automatiques affichées dans l'interface,
8. éventuellement édition directe en base ou via API.

### 7.3 Pourquoi V3 est lourd

Parce qu'il ne s'agit plus seulement d'un script.

Il faut aussi construire:

1. une UI,
2. des permissions,
3. des statuts,
4. des audits,
5. des écrans de validation,
6. une vraie logique d'administration.

Autrement dit:
on construit presque un deuxième produit interne.

### 7.4 Quand V3 devient pertinent

Quand:

1. le catalogue grossit vraiment,
2. plusieurs personnes doivent reviewer,
3. les itérations de review deviennent fréquentes,
4. V1/V2 ont déjà validé le besoin.

## 8) Pourquoi on ne commence pas directement par V3

Ce n'est pas parce que V3 est mauvais.

C'est parce que V3:

1. coûte plus cher à construire,
2. demande plus d'architecture,
3. ne supprime pas la nécessité d'avoir des données propres,
4. risque de ralentir le projet si on n'a pas encore validé le flux simple.

Le bon ordre n'est pas:

1. construire l'usine complète,
2. puis produire.

Le bon ordre est:

1. valider le flux simple,
2. observer les vrais points de friction,
3. industrialiser ensuite.

## 9) Répartition des responsabilités humain / machine

### 9.1 Ce que la machine doit faire

La machine prend en charge:

- lecture des fichiers fonts,
- détection des fichiers disponibles,
- calcul des hash,
- calcul des tailles,
- normalisation des noms,
- création des slugs,
- génération des réponses Expert canoniques de base,
- génération des chemins runtime,
- marquage `draft`,
- génération des brouillons.

### 9.2 Ce que l'humain doit garder

L'humain garde:

- la validation pédagogique,
- la classification fine,
- la difficulté,
- la rareté,
- la vérification des signatures visuelles,
- les cartes Reading,
- les cartes Misread,
- la logique de confusion.

### 9.3 Règle importante

Le pipeline ne doit jamais masquer ce qu'il ne sait pas vraiment.

Il vaut mieux:
- un champ `draft`,
- une suggestion transparente,
- un `needs_review`,

qu'une fausse certitude.

## 10) Format canonique recommandé

La source canonique recommandée pour V1 est:

- fichiers structurés dans le repo,
- idéalement `JSON` ou `CSV`,
- pas un workbook Excel comme vérité unique.

### 10.1 Pourquoi

1. plus propre pour les scripts,
2. plus facile à versionner,
3. plus diffable,
4. plus facile à relancer,
5. plus robuste à grande échelle.

### 10.2 Usage d'Excel dans ce modèle

Excel peut rester:

1. une vue de review,
2. un export,
3. un support humain ponctuel,

mais pas la seule source de vérité.

## 11) Architecture cible de production catalogue

### 11.1 Flux cible

1. Scan des fonts disponibles
2. Génération automatique des drafts
3. QA structurelle
4. Review humaine ciblée
5. Validation
6. Import DB
7. Utilisation runtime

### 11.2 Résultat attendu

On ne remplit plus `1000` lignes à la main.

On produit:

1. une masse de drafts fiables techniquement,
2. puis on ne review que les champs réellement éditoriaux.

## 12) Définition de Done par phase

### 12.1 Done V1

- pipeline relançable
- drafts générés automatiquement
- assets techniques remplis automatiquement
- import DB fonctionnel

### 12.2 Done V2

- suggestions utiles sur les champs métier
- score de confiance présent
- réduction mesurable du travail de review

### 12.3 Done V3

- backoffice utilisable
- workflow d'approbation stable
- audit trail
- review multi-utilisateur possible

## 13) Risques si on saute V1

Si on saute directement vers V2/V3:

1. on risque de sur-construire,
2. on risque de passer plus de temps sur l'outil que sur le catalogue,
3. on risque de bâtir une interface sur des conventions encore mouvantes,
4. on risque de ralentir le projet au lieu de l'accélérer.

## 14) Décision retenue

La décision retenue à ce stade est:

1. commencer par `V1`,
2. garder `V2` comme extension naturelle,
3. considérer `V3` comme objectif long terme si le besoin se confirme.

## 15) Prochaines actions recommandées

Ordre concret:

1. choisir le format canonique repo,
2. écrire le générateur de drafts,
3. produire une première base catalogue auto,
4. identifier les champs à review humaine,
5. seulement ensuite discuter de l'assistance avancée.

## 16) Conclusion

La meilleure automatisation immédiate n'est pas la plus “intelligente”.

La meilleure automatisation immédiate est celle qui:

- enlève le maximum de travail répétitif,
- ne ment pas sur les zones floues,
- reste relançable,
- et débloque rapidement la montée vers `1000+`.

Pour JEUX DE TYPO, cela veut dire:

- `V1 maintenant`,
- `V2 ensuite`,
- `V3 plus tard si nécessaire`.
