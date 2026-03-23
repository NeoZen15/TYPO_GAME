# Site System Overview

Ce document sert de fiche de transmission rapide pour JEUX DE TYPO.

Il répond à 4 questions:

1. qu'est-ce que le site fait aujourd'hui,
2. comment il est structuré,
3. où vivent les données typographiques,
4. comment une nouvelle typo entre dans le système.

## 1) Résumé en une phrase

JEUX DE TYPO est un site d'entraînement à la reconnaissance typographique avec:
- un front Next.js,
- un moteur `training` branché à une vraie base PostgreSQL,
- un mode `competition` V1 branché à la base et validé en local,
- un pipeline catalogue séparé qui prépare, valide et importe les typos.

## 2) Ce qui existe aujourd'hui

### Produit

Le site comporte actuellement:
- une landing page,
- un onboarding,
- une page de sélection de mode,
- un mode `training` réellement branché,
- un mode `competition` réellement branché,
- une page `expert` encore au stade placeholder / règles.

### Data

Le projet possède aujourd'hui:
- un catalogue principal importable,
- une base PostgreSQL réelle,
- un pipeline d'automatisation du catalogue,
- une source massive de candidates issue d'un snapshot `google/fonts`.

## 3) Architecture produit simplifiée

### Front

Routes principales:
- `/` -> landing
- `/onboarding` -> calibration d'entrée
- `/play` -> sélection du mode
- `/game` -> training réel
- `/play/competition` -> competition réel
- `/play/expert` -> placeholder actuel

Implémentation principale:
- `app/`
- `features/landing/`
- `features/onboarding/`
- `features/modes/`
- `features/game/`

### API / logique de jeu

Le mode training passe par deux endpoints:
- `app/api/training/session/start/route.ts`
- `app/api/training/answer/route.ts`

Le mode competition passe par trois endpoints:
- `app/api/competition/session/start/route.ts`
- `app/api/competition/answer/route.ts`
- `app/api/competition/session/timeout/route.ts`

La logique de training vit ici:
- `lib/game/training/contracts.ts`
- `lib/game/training/catalog.ts`
- `lib/game/training/provider.ts`
- `lib/game/training/question-token.ts`

La logique de competition vit ici:
- `lib/game/competition/contracts.ts`
- `lib/game/competition/catalog.ts`
- `lib/game/competition/provider.ts`
- `features/game/components/CompetitionScreen.tsx`

Le feedback Competition affiche maintenant:
- le résultat correct / wrong,
- le score gagné (`+2`, `+1`, `+0`),
- le temps de clic exact de la réponse.

L'écran de fin Competition expose maintenant un résumé de session plus riche:
- score final, précision, erreurs, fast answers,
- cadence (`answers/min`, `points/min`, `points/answer`),
- profil vitesse (moyenne, plus rapide, plus lente, vitesse sur correct/wrong),
- meilleure série,
- catégories fortes / faibles,
- confusions fréquentes,
- erreurs récentes.

### Base de données

Les migrations principales sont:
- `db/migrations/001_user_event_fact.sql`
- `db/migrations/001b_event_type.sql`
- `db/migrations/002_catalog_tables.sql`
- `db/migrations/003_users_sessions_pool.sql`

En pratique, la base stocke:
- les utilisateurs,
- les sessions,
- l'état de progression par typo,
- le catalogue typographique,
- les événements utilisateur.

## 4) Vue simple du catalogue

Le catalogue a 3 niveaux.

### Niveau A — catalogue principal

Dossier:
- `content/catalog/`

C'est la source principale importable en base.

Fichiers principaux:
- `typefaces-core.json`
- `font-runtime-assets.json`
- `expert-answer-keys.json`

Ces fichiers ne doivent pas être édités à la main.
Ils sont produits par le pipeline.

### Niveau B — candidates

Dossier:
- `content/catalog/candidates/`

C'est la file d'attente brute des typos découvertes mais pas encore promues.

Exemple actuel:
- `content/catalog/candidates/google-fonts-snapshot/`

Ce dossier contient:
- les candidates issues du snapshot massif Google Fonts,
- leurs premiers champs automatiques,
- mais pas encore un état prêt pour import DB principal.

### Niveau C — batches

Dossier:
- `content/catalog/batches/`

Un batch est un petit lot de review entre les candidates massives et le catalogue principal.

Exemples actuels:
- `google-fonts-batch-001` -> lot large de 50 familles
- `google-fonts-pilot-top-10` -> lot pilote réduit pour valider le workflow

## 5) Pipeline catalogue actuel

Le pipeline V1 actuel est:

1. `generate_catalog_seed.py`
2. `build_catalog.py`
3. `import_catalog_json.py`
4. `generate_catalog_candidates.py`
5. `import_massive_font_source.py`
6. `build_candidate_batch.py`
7. `audit_catalog_promotion.py`
8. `prepare_catalog_runtime.py`
9. `stage_catalog_promotion.py`
10. `generate_editorial_review_template.py`
11. `build_reviewed_promotion.py`
12. `run_catalog_promotion_pipeline.py`
13. `mass_catalog_candidates.py`
14. `merge_catalog_override_fragment.py`
15. `run_catalog_v1_pipeline.py`

### Ce que fait chaque étape

#### Seed

`generate_catalog_seed.py`
- lit les sources locales existantes,
- génère les fichiers seed machine.

#### Overrides

`content/catalog/overrides/`
- contient les corrections humaines ciblées,
- sans casser les seeds machine.

#### Build

`build_catalog.py`
- fusionne `seed + overrides`,
- produit les JSON finaux importables.

#### Import DB

`import_catalog_json.py`
- upsert les fichiers finaux dans PostgreSQL.

#### Discovery candidates

`import_massive_font_source.py`
- scanne un snapshot massif type `google/fonts`,
- génère une file de candidates,
- sans toucher au catalogue principal.

#### External metadata radar

`sync_google_fonts_api.py`
- appelle la Google Fonts Developer API,
- compare le résultat au catalogue local,
- produit des rapports de veille (`new`, `known`, `missing`, `changed`),
- sans toucher au catalogue principal ni au runtime du jeu.
- sert de radar externe, pas de source produit canonique.

#### Curation

`build_candidate_batch.py`
- prend une sélection ciblée,
- construit un batch reviewable,
- prêt pour promotion future.

#### Promotion audit

`audit_catalog_promotion.py`
- classe automatiquement les candidates ou les batches,
- indique ce qui est déjà connu,
- ce qui est bloqué par le runtime,
- et ce qui reste bloqué par l'éditorial.

#### Runtime prep

`prepare_catalog_runtime.py`
- transforme un lot retenu en assets web `woff2`,
- écrit les fichiers sous `public/fonts/staged/...`,
- produit un rapport de préparation.
- dépend de `fonttools` + `brotli` dans `.venv` pour la conversion `ttf -> woff2`.

#### Promotion staging

`stage_catalog_promotion.py`
- remplit automatiquement les champs sûrs,
- produit un dossier de staging,
- laisse visibles les champs éditoriaux encore à revoir.

#### Editorial review template

`generate_editorial_review_template.py`
- génère un template JSON/CSV de review,
- isole uniquement les champs métier restants,
- prépare un support clair pour la validation humaine.

#### Reviewed promotion builder

`build_reviewed_promotion.py`
- relit un template éditorial rempli,
- refuse la promotion si la review est incomplète,
- émet des fragments de promotion prêts à intégrer,
- sans modifier le catalogue principal automatiquement.

#### Promotion orchestrator

`run_catalog_promotion_pipeline.py`
- enchaîne audit + runtime prep + staging,
- permet de traiter un lot sans relancer les scripts un par un.

#### Mass catalog promotion

`mass_catalog_candidates.py`
- prend toutes les candidates restantes d'un snapshot massif,
- les transforme en entrées `typefaces_core` + `expert_answer_keys`,
- les ajoute en mode `catalog-only`,
- les laisse `activation_status=false` et `qa_status=review`,
- ne crée pas de nouveaux runtime assets web dans cette étape,
- dérive désormais `year_tag` depuis `date_added` du snapshot quand disponible.

`merge_catalog_override_fragment.py`
- fusionne un fragment promotionnel dans les overrides principaux,
- évite les merges manuels fragiles,
- protège par défaut les overrides déjà revus,
- permet d'absorber proprement une très grosse vague de catalogue.

## 6) État du catalogue au moment de ce document

### Catalogue principal

D'après `content/catalog/catalog-build-meta.json`:
- `2032` typefaces au total
- `73` typefaces actives
- `73` runtime assets prêts
- `5` runtime assets `system_local`
- `5` typefaces `expert_enabled`
- `5` expert answers approuvées
- `1959` typefaces supplémentaires sont désormais présentes en catalogue mais restent inactives en review

### Source massive Google Fonts

D'après `content/catalog/candidates/google-fonts-snapshot/snapshot-scan-meta.json`:
- `2027` familles détectées dans le snapshot
- `2027` familles déjà connues / absorbées par le catalogue actuel
- `0` candidate nette restante sur ce snapshot
- breakdown licences:
  - `0` OFL candidate restante
  - `0` Apache 2.0 candidate restante
  - `0` unknown candidate restante

### Lot pilote actuel

D'après `content/catalog/batches/google-fonts-pilot-top-10/batch-meta.json`:
- `10` familles sélectionnées
- `4` remplacements runtime prioritaires
- `3` sans prioritaires
- `2` serif prioritaires
- `1` mono prioritaire

Après exécution des nouveaux scripts sur ce lot pilote:
- `10/10` runtime assets préparés en `woff2`
- `10/10` validés après review éditoriale
- `10/10` promus dans les overrides du catalogue principal
- `10/10` runtime assets canonicalisés hors du dossier `staged`
- le catalogue principal intègre maintenant ce lot
- la base PostgreSQL a été resynchronisée dans cette passe

### Lot de 50

D'après `content/catalog/batches/google-fonts-batch-001/promotion-pipeline-meta.json`:
- `50/50` runtime assets préparés en `woff2`
- `50/50` records staged
- `0` blocage runtime restant
- un template de review éditoriale a été généré
- une review éditoriale structurée a ensuite été appliquée
- `50/50` ont passé le validateur de promotion
- `10` slugs déjà présents dans le catalogue principal ont été filtrés
- `40` nouvelles typos ont été promues dans le catalogue principal
- la base PostgreSQL a été resynchronisée après cette promotion

### Vague massive "catalog-only"

Après les batches validés, une vague massive a été absorbée depuis le même snapshot Google Fonts:
- `1954` nouvelles typefaces ajoutées au catalogue principal
- `1954` nouvelles expert answers canoniques ajoutées
- `0` nouveau runtime asset ajouté dans cette vague
- toutes ces entrées sont:
  - `activation_status=false`
  - `expert_enabled=false`
  - `qa_status=review`
- la base PostgreSQL a été resynchronisée avec cette vague

Cette vague a un objectif précis:
- rendre le catalogue massif tout de suite,
- sans alourdir `public/fonts/` avec des milliers de fontes web non prioritaires,
- et sans activer produit des typos encore non revues.

## 7) Comment une typo entre dans le système

Le parcours cible d'une nouvelle typo est:

1. découverte dans une source massive
2. entrée dans `candidates/`
3. sélection dans un `batch`
4. audit + runtime prep + staging semi-auto
5. génération du template de review éditoriale
6. review éditoriale
7. validation stricte de promotion
8. ajout dans `overrides/` ou promotion vers le catalogue principal
9. rebuild du catalogue
10. import DB
11. activation produit seulement quand le runtime asset est prêt

Autrement dit:
- `candidates` = découvert mais pas validé
- `batch` = petit lot de review
- `catalog principal` = validé et importable

Il existe maintenant aussi une voie parallèle:
- `candidate massive -> mass catalog promotion -> catalogue principal inactif`

Cette voie sert à absorber beaucoup de volume rapidement, tout en gardant:
- l'activation produit à `false`,
- le runtime web inchangé,
- la review éditoriale ouverte.

## 8) Distinction très importante: candidate vs runtime-ready

Une famille détectée n'est pas automatiquement jouable dans le site.

Deux choses différentes:

1. `candidate catalogue`
- on sait qu'elle existe,
- on a son nom, sa licence, ses fichiers source,
- mais elle n'est pas encore prête produit.

2. `runtime-ready`
- elle a un asset web exploitable,
- une place claire dans le catalogue,
- une validation éditoriale minimale,
- et peut entrer dans le jeu.

C'est la raison pour laquelle on peut avoir:
- `2032` typos au catalogue,
- mais seulement `73` réellement activables en jeu aujourd'hui.

## 9) Ce qu'il reste à faire

### Côté catalogue

1. régler les 5 remplacements libres des system fonts dans le catalogue principal
2. décider quelles familles inactives doivent passer du mode `catalog-only` au mode produit
3. préparer les prochains sous-ensembles runtime-ready depuis le gros catalogue
4. décider quand approuver un sous-ensemble Expert plus large

### Côté produit

1. finaliser `competition`
2. finaliser `expert`
3. enrichir le moteur pédagogique
4. brancher plus d'état et de lecture utilisateur

## 10) Où regarder selon la question

Si quelqu'un demande...

### "Comment le jeu marche ?"
Regarder:
- `features/game/`
- `lib/game/training/`
- `app/api/training/`

### "Où est le catalogue principal ?"
Regarder:
- `content/catalog/`

### "Où sont les grosses nouvelles polices détectées ?"
Regarder:
- `content/catalog/candidates/`

### "Quel petit lot on teste en ce moment ?"
Regarder:
- `content/catalog/batches/google-fonts-pilot-top-10/`

### "Comment les données arrivent en base ?"
Regarder:
- `scripts/build_catalog.py`
- `scripts/import_catalog_json.py`
- `db/migrations/`

## 11) Décision de lecture recommandée

Pour quelqu'un qui arrive sur le projet, l'ordre conseillé est:

1. ce document
2. `docs/training-database-master-recap-v7.md`
3. `docs/catalog-automation-roadmap.md`
4. `docs/massive-font-source-strategy.md`
5. ensuite seulement les scripts et le code

## 12) Résumé final

Le projet est structuré en deux grands systèmes qui se rejoignent:

1. le système produit / jeu
2. le système catalogue / données typo

Le site ne dépend plus d'un simple Excel.
Il repose maintenant sur:
- un catalogue repo-first,
- une base réelle,
- un pipeline de promotion avec audit, runtime prep, staging et validation,
- et une réserve massive de candidates pour grandir proprement.

Ce document doit rester à jour à chaque changement important de structure.
