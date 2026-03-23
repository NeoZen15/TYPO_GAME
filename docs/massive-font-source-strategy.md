# Massive Font Source Strategy

Ce document fixe la stratégie concrète pour faire grandir le catalogue typographique
au-delà du petit corpus local actuel.

Objectif:

- arrêter de dépendre d'un corpus de test trop petit,
- préparer une vraie source `1000+`,
- rester propre côté licences,
- et brancher cette source sur le pipeline V1 déjà en place.

## 1) État actuel

Le pipeline catalogue est prêt:

- génération seed
- overrides humains
- build final
- import DB
- scan de candidates

Le blocage actuel n'est plus technique.

Le blocage actuel est le corpus source.

Résultat observé au moment de cette passe:

- `174` fichiers scannés
- `24` familles détectées
- `1` seule nouvelle candidate inconnue du catalogue courant
- cette candidate n'est pas runtime-ready

Conclusion:

Le code est prêt à grossir.
Le corpus local actuel ne l'est pas.

## 2) Source massive recommandée

### 2.1 Source primaire

La source primaire recommandée est le dépôt officiel `google/fonts`.

Pourquoi:

1. grand volume de familles
2. structure cohérente
3. métadonnées de famille disponibles
4. licences explicites par famille
5. cohérence forte avec le web et le self-hosting

## 3) Pourquoi Google Fonts est le bon point de départ

Le repo officiel `google/fonts` contient:

- les fichiers de fontes servis par Google Fonts,
- les métadonnées de famille,
- les descriptions de familles,
- et les licences associées par dossier de famille.

Il peut être récupéré:

- en ZIP complet,
- ou synchronisé avec Git pour éviter de re-télécharger tout à chaque fois.

Cette source est la meilleure base réaliste pour un grand catalogue initial.

## 4) Ce qu'on ne doit pas faire

1. Ne pas utiliser des dumps aléatoires de fonts sans licence claire.
2. Ne pas mélanger des fontes propriétaires avec les fontes libres dans la même
   stratégie runtime sans les marquer explicitement.
3. Ne pas mettre tout le corpus massif directement dans `public/fonts/`.
4. Ne pas considérer "téléchargé" comme "runtime-ready".

## 5) Architecture de stockage recommandée

Le corpus massif doit vivre dans les assets, pas dans le code applicatif runtime.

Base recommandée:

- `02_TYPO_ASSETS/07_google_fonts/`

Structure recommandée:

1. `00_inbox_downloads/`
- zips bruts téléchargés

2. `06_repo_snapshot/google-fonts-main/`
- snapshot ou clone du dépôt officiel `google/fonts`

3. `07_candidates_exports/`
- exports intermédiaires de scan / QA si besoin

4. `01_woff2/`
- sous-ensemble runtime réellement retenu pour le projet

Règle:

- le gros corpus source reste hors du runtime web,
- seul le sous-ensemble validé est mirroré pour l'app.

## 6) Stratégie exacte recommandée

### Phase A — Acquisition de la source

Choix recommandé:

1. récupérer le ZIP complet du repo `google/fonts`
ou
2. cloner/synchroniser le repo si on veut les mises à jour incrémentales

Décision pratique:

- si on veut aller vite: ZIP
- si on veut maintenir la source dans le temps: Git

### Phase B — Scan large

Une fois la source posée localement:

1. scanner toutes les familles
2. produire des `candidates`
3. ne pas les injecter directement en base comme catalogue actif

Sortie attendue:

- une grande file de review
- pas encore un gros import “brut”

### Phase C — Promotion contrôlée

Ensuite seulement:

1. review éditoriale ciblée
2. sélection des familles à promouvoir
3. conversion/mirroring runtime des familles retenues
4. ajout aux overrides ou à un batch validé
5. import DB

## 7) Règle clé: séparer source massive et runtime réel

Il faut bien distinguer:

1. `source massive`
- énorme
- pas forcément prête pour le web runtime

2. `catalogue validé`
- structuré
- relu
- propre

3. `runtime-ready`
- mirroré
- servi par l'app
- hashé
- validé

Le piège serait de vouloir rendre tout le corpus massif disponible dans le
runtime web d'un coup.

Ce n'est ni nécessaire, ni souhaitable.

## 8) Remplacements libres recommandés pour les 5 system fonts

Ces remplacements sont des **recommandations de travail** pour sortir les typos
locales du statut `system_local`.

### 8.1 Arial

Recommandation de départ:

- `Arimo`

Pourquoi:

- libre
- pensée comme alternative web/UI crédible
- disponible dans l'écosystème Google Fonts

### 8.2 Helvetica

Recommandation de départ:

- `TeX Gyre Heros` si on accepte une source libre hors Google Fonts
- sinon `Arimo` en remplacement temporaire de travail

Note:

`Helvetica` est le cas le plus délicat si on veut une alternative libre visuellement
proche sans réutiliser une fonte propriétaire.

### 8.3 Times New Roman

Recommandation de départ:

- `Tinos`

### 8.4 Georgia

Recommandation de départ:

- `Lora`

Note:

`Lora` n'est pas une copie de Georgia. C'est une recommandation de travail pour
retrouver une présence serif web contemporaine, à valider visuellement dans le produit.

### 8.5 Courier New

Recommandation de départ:

- `Cousine` pour une logique proche de la famille Croscore
ou
- `Courier Prime` si on préfère une direction plus explicitement "Courier-like"

Décision produit à trancher plus tard:

- fidélité de substitution
vs
- personnalité éditoriale

## 9) Brique dédiée au snapshot massif

Cette brique existe maintenant dans le repo:

- `scripts/import_massive_font_source.py`

But:

1. lire un snapshot `google/fonts`
2. parcourir les dossiers `ofl/`, `apache/`, `ufl/`
3. extraire un minimum de metadata via `METADATA.pb`
4. générer une grande file `candidates`
5. sans polluer le catalogue principal

Validation déjà faite:

- script testé sur un mini faux snapshot local
- détection des licences `ofl` / `apache2`
- détection des familles
- génération de fichiers `candidates` correcte

Validation réelle ensuite faite sur le snapshot local:

- source root: `02_TYPO_ASSETS/07_google_fonts/06_repo_snapshot/fonts-main`
- `2027` dossiers familles détectés dans le snapshot
- `23` familles déjà connues exclues
  - `10` matchs exacts
  - `13` matchs normalisés (`spacegrotesk` vs `space_grotesk`, etc.)
- `2004` nouvelles familles candidates nettes après déduplication
- breakdown licences:
  - `1952` OFL
  - `47` Apache 2.0
  - `5` unknown / UFL bucket

Point clé observé:

- le snapshot `google/fonts` local contient ici des fichiers `ttf`
- pas de `woff2` directement exploitables dans ce snapshot

Conséquence:

La source massive est maintenant bien là pour la découverte et la review.

Mais la montée en `runtime-ready` demandera ensuite soit:

1. une étape de conversion / préparation runtime,
2. soit un pipeline de téléchargement/mirroring web ciblé par famille retenue.

Mise à jour d'état du 19 mars 2026:

- ce snapshot a depuis été entièrement absorbé dans le catalogue principal en mode `catalog-only`
- il a permis d'ajouter massivement des entrées `typefaces_core` et `expert_answer_keys`
- il ne reste plus de candidates nettes dans `content/catalog/candidates/google-fonts-snapshot/`
- le goulot n'est plus l'acquisition, mais la sélection runtime-ready et l'activation produit

## 10) Checklist d'action

### Étape 1 — acquisition

- récupérer `google/fonts` en ZIP ou en clone
- le ranger dans `02_TYPO_ASSETS/07_google_fonts/06_repo_snapshot/`

### Étape 2 — scan

- pointer le scan candidates vers cette nouvelle source
- générer une vraie file de review large

### Étape 3 — remplacements libres

- valider les 5 remplacements proposés
- mirrorer les remplacements retenus
- retirer le statut `system_local` correspondant

### Étape 4 — promotion

- promouvoir les familles validées vers le catalogue principal
- rebuild
- import DB

### Étape 5 — itération

- répéter par batch
- ne pas attendre une perfection complète avant chaque cycle

## 11) Décision retenue

Décision actuelle:

1. la source massive recommandée = `google/fonts`
2. le gros corpus reste hors runtime app
3. le runtime web ne contient qu'un sous-ensemble validé
4. les 5 system fonts doivent être remplacées par des alternatives libres
5. le prochain gain de volume dépend de la source, plus du code

## 12) Références officielles utiles

1. Google Fonts repository
- `https://github.com/google/fonts`

2. Courier Prime official repository
- `https://github.com/quoteunquoteapps/CourierPrime`

3. Liberation fonts support note (Fedora docs/wiki context)
- `https://fedoraproject.org/wiki/I18N/Liberation_support`
- `https://docs.fedoraproject.org/cs/fedora/f29/release-notes/desktop/I18n/`
