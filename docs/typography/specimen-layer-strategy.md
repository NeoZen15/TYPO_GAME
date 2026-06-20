# Specimen Layer Strategy

Ce document met de côté une piste stratégique importante pour JEUX DE TYPO:
ajouter une vraie couche `specimen` autour du jeu.

But du document:

1. ne pas oublier cette opportunité,
2. clarifier pourquoi elle est très intéressante,
3. éviter une mauvaise intégration technique trop tôt,
4. garder une direction claire pour le moment où on voudra la reprendre.

## 1) Déclencheur

Référence observée:

- `https://github.com/markboulton/specimen-builder`

D'après le README du projet, Specimen Builder est un outil pour produire des
spécimens numériques de typographie, basé sur Eleventy, à partir de fichiers
`woff2`, avec une architecture de page pensée pour:

- présenter une typo,
- la tester,
- montrer ses glyphes,
- montrer ses langues supportées,
- et fournir une vraie couche éditoriale autour de la fonte.

Ce repo n'est pas le moteur du jeu.
Mais il est très pertinent comme inspiration produit et éditoriale.

## 2) Pourquoi c'est très intéressant pour JEUX DE TYPO

JEUX DE TYPO n'est pas seulement un quiz.
Le projet tourne autour de:

- l'observation typographique,
- la reconnaissance visuelle,
- la culture de la forme,
- la comparaison entre familles,
- et l'apprentissage du regard.

Une couche `specimen` bien faite peut renforcer tout ça.

### 2.1 Valeur produit

Le jeu entraîne l'oeil.
Le specimen permet de prolonger l'observation.

Le jeu répond à:

- "reconnais-tu cette typo ?"

Le specimen répond à:

- "qu'est-ce qui fait que cette typo ressemble à ça ?"
- "quels sont ses signes distinctifs ?"
- "avec quoi la confond-on ?"
- "comment l'observer correctement ?"

### 2.2 Valeur pédagogique

Une page specimen peut devenir:

- une fiche de révision,
- une page d'apprentissage,
- une page de comparaison,
- une passerelle entre le jeu et la compréhension visuelle.

### 2.3 Valeur SEO

C'est probablement la dimension la plus forte à long terme.

Une vraie couche specimen peut produire:

- des pages indexables par typo,
- des pages comparatives,
- des pages pédagogiques,
- des pages longues et riches en contenu utile,
- une profondeur sémantique beaucoup plus grande que le jeu seul.

Exemples de pages futures:

- `/typefaces/inter`
- `/typefaces/playfair-display`
- `/compare/inter-vs-roboto`
- `/learn/what-is-a-humanist-sans`
- `/learn/how-to-spot-didone-contrast`

### 2.4 Valeur interne

Même avant publication, une couche specimen peut servir comme outil interne:

- revue QA des nouvelles fontes,
- inspection des glyphes,
- vérification du rendu,
- comparaison visuelle,
- support de décision avant activation dans le catalogue.

## 3) Pourquoi on ne l'intègre pas "tel quel"

Le point important n'est pas de rejeter l'idée.
Le point important est d'éviter une mauvaise intégration.

### 3.1 Ce repo n'est pas construit autour de notre architecture

Aujourd'hui, notre stack est centrée sur:

- Next.js
- Neon/Postgres
- catalogue JSON + DB
- provider training
- pages applicatives existantes

Le repo `specimen-builder` repose sur une logique autonome de site specimen,
basée sur Eleventy.

Si on l'intègre directement:

- on ajoute une deuxième stack,
- un deuxième système de génération,
- une autre logique de contenu,
- une autre source potentielle de vérité,
- et donc de la dette.

### 3.2 Le risque

Le risque n'est pas "ça ne marche pas".

Le risque est:

- duplication de données,
- incohérence de design,
- incohérence de routing,
- incohérence SEO,
- et maintenance inutilement lourde.

### 3.3 La bonne posture

La bonne posture est:

1. s'inspirer très fortement de la structure,
2. réutiliser les bonnes idées,
3. garder notre propre architecture et notre propre source de vérité.

En clair:

- on reprend les concepts,
- pas forcément le repo comme dépendance produit directe.

## 4) Ce qu'on veut reprendre de l'idée

Le README de `specimen-builder` décrit une architecture de page intéressante.
Pour JEUX DE TYPO, les blocs les plus utiles sont:

1. `Masthead`
2. `Interactive controls`
3. `Specimen`
4. `Setting`
5. `Character grid`
6. `Language`

Ces blocs sont très pertinents pour nous.

## 5) Ce qu'on ferait concrètement chez nous

### 5.1 Une couche publique branchée au catalogue

But:

- enrichir l'expérience,
- renforcer le SEO,
- donner une valeur culturelle autour du jeu.

Exemple de structure cible pour `/typefaces/[slug]`:

1. Hero
- nom de la typo
- catégorie
- cluster
- niveau estimé
- signes distinctifs clés
- CTA vers le jeu

2. Grand specimen
- mot unique
- alphabet
- chiffres
- ponctuation
- différentes tailles
- différents poids si disponibles

3. Ce qu'il faut observer
- type de `a`
- ouverture du `e`
- contraste
- axe
- terminaison
- largeur

4. Confusions probables
- typos proches
- pourquoi elles se ressemblent
- quoi regarder pour les départager

5. Lecture longue
- paragraphe
- réglages de taille / interligne
- perception en contexte texte

6. Grille de caractères
- uppercase
- lowercase
- chiffres
- ponctuation
- glyphes spéciaux si disponibles

7. Langues / couverture
- si la donnée existe

8. Pédagogie / jeu
- "entraîne-toi sur cette typo"
- "jouer ce cluster"
- "revoir les typos proches"

### 5.2 Une couche interne QA

But:

- review des typos avant activation,
- contrôle visuel,
- validation du rendu.

Exemple:

- `/lab/specimen/[slug]`
- pages non publiques au début
- branchées au catalogue interne

### 5.3 Une couche éditoriale SEO

Ensuite, on peut dériver:

- pages de comparaison
- pages d'apprentissage
- pages de taxonomie
- pages de clusters visuels

Ce sont probablement ces pages qui auront le plus de valeur SEO organique.

## 6) Comment ça s'articule avec notre data model

La couche specimen doit être branchée sur notre catalogue existant, pas sur un
système parallèle.

Sources de données cibles:

- `typefaces_core`
- `font_runtime_assets`
- `expert_answer_keys`
- plus tard:
  - `reading_cards`
  - `misread_cards`
  - `confusion_families`
  - `confusion_pairs`

Cela veut dire:

- une page specimen peut déjà exister avec le catalogue actuel,
- mais elle deviendra beaucoup plus forte quand le catalogue éditorial sera plus riche.

## 7) Pourquoi c'est cohérent avec le jeu

Le jeu apprend à reconnaître.
Le specimen apprend à observer.

Le jeu est plus performant si l'utilisateur a aussi des points d'ancrage visuels.

Le specimen est plus utile si l'utilisateur peut ensuite s'entraîner dans le jeu.

Donc les deux couches se renforcent mutuellement.

## 8) Ordre recommandé

### Phase 1 — maintenant

Ne pas l'implémenter tout de suite.

Faire seulement:

1. garder cette piste documentée,
2. continuer à finir le jeu,
3. continuer à structurer le catalogue.

### Phase 2 — quand le jeu est plus stable

Créer une première page specimen simple, branchée au catalogue réel.

Cible minimale:

- une route par typo,
- un specimen visuel,
- un bloc "comment la reconnaître",
- un lien vers le jeu.

### Phase 3 — quand le catalogue grossit

Créer la vraie couche SEO / éditoriale:

- pages typo,
- pages compare,
- pages learn,
- pages cluster.

## 9) Ce qu'il faut éviter

1. Cloner le repo externe comme sous-système central du produit.
2. Créer une deuxième source de vérité pour les typos.
3. Faire une section specimen qui ne réutilise pas notre catalogue.
4. Implémenter la couche specimen avant d'avoir stabilisé la logique de jeu minimale.

## 10) Ce qu'on garde en tête pour plus tard

Si un jour on demande:

- "qu'est-ce qu'on peut faire de plus ?"
- "comment enrichir le produit sans casser le moteur ?"
- "comment créer une vraie force SEO autour de la typo ?"

alors cette couche `specimen` doit revenir immédiatement dans la conversation.

C'est une des pistes les plus prometteuses du projet.

## 11) Faut-il garder le zip du repo externe ?

Pas nécessaire maintenant pour avancer.

Mais cela peut devenir utile plus tard si on veut:

1. auditer en détail leur structure de templates,
2. analyser leurs composants specimen,
3. reprendre certaines idées de layout plus précisément,
4. comparer leur architecture à une implémentation Next.js maison.

Donc:

- pas nécessaire maintenant,
- potentiellement utile plus tard comme matériau de référence.

## 12) Décision actuelle

Décision retenue:

- la couche specimen est une opportunité stratégique forte,
- on la documente maintenant,
- on la garde de côté,
- on ne la met pas au coeur de l'implémentation du jeu tout de suite,
- mais on la considère comme une future extension majeure produit + SEO.
