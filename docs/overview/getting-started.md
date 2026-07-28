# Jeux de Typo V2 — guide débutant

Ce document est un **guide d'entrée** pour une personne qui ne connaît ni le projet, ni le code, ni même très bien le vocabulaire technique.

Il **ne remplace pas** les autres README ou les specs.
Il sert à répondre à la question simple :

> "C'est quoi ce projet, à quoi il sert, comment il marche, et où regarder quand on est perdu ?"

---

## 1. Le projet, expliqué très simplement

**Jeux de Typo** est un site pour apprendre à **reconnaître des polices de caractères**.

Une "police", c'est par exemple :
- Helvetica
- Inter
- Garamond
- Futura

Le but du site n'est pas juste de montrer de jolies lettres.
Le but est d'entraîner l'œil à voir les différences entre les typographies :

- la forme des lettres,
- l'ouverture des contre-formes,
- l'épaisseur,
- le contraste,
- les terminaisons,
- la hauteur des lettres,
- l'espacement,
- le rythme visuel.

Autrement dit :

- on **regarde** une police,
- on **compare**,
- on **apprend**,
- puis on **joue** pour vérifier si on la reconnaît.

---

## 2. À quoi sert le site aujourd'hui

Aujourd'hui, le projet contient plusieurs parties.

### Côté utilisateur

Le site a :

- une page d'accueil,
- un onboarding (une entrée guidée),
- une page pour choisir un mode de jeu,
- un mode d'entraînement,
- un mode compétition,
- un mode expert encore inachevé / en attente.

### Côté équipe / fabrication

Le repo contient aussi :

- des outils internes pour mesurer et calibrer l'affichage typographique,
- un catalogue de polices,
- des scripts qui préparent les données,
- de la documentation produit et technique,
- des archives et sauvegardes de travail.

Donc ce repo n'est pas seulement "le site".
C'est aussi **l'atelier** qui sert à fabriquer, tester et organiser le contenu typographique.

---

## 3. Comment imaginer le projet sans jargon

Tu peux imaginer le projet comme une petite machine en 4 étages :

### Étage 1 — ce que voit le joueur

C'est l'interface du site :

- les pages,
- les boutons,
- les écrans de jeu,
- les textes,
- les animations,
- les cartes de réponses.

### Étage 2 — la logique du jeu

C'est la partie qui décide :

- quelle question afficher,
- quelles réponses proposer,
- si la réponse est correcte,
- quand montrer une police à nouveau,
- comment suivre la progression d'un joueur.

### Étage 3 — les données typographiques

C'est la mémoire du projet :

- quelles polices existent dans le catalogue,
- leur nom,
- leur catégorie,
- leurs propriétés,
- les informations utilisées pour comparer les typographies.

### Étage 4 — les outils internes

C'est ce que l'équipe utilise pour construire le reste :

- mesurer les lettres,
- vérifier des écarts,
- préparer le catalogue,
- tester,
- corriger,
- documenter.

---

## 4. Le but pédagogique du projet

Le projet ne cherche pas seulement à faire un quiz.

Son ambition est de développer une compétence visuelle :

- apprendre à ralentir,
- observer des détails,
- différencier des formes proches,
- construire une mémoire visuelle des polices.

Le mode principal est donc pensé comme un **entraînement du regard**.

Ce n'est pas juste :

> "Trouve la bonne réponse le plus vite possible"

C'est plutôt :

> "Apprends à voir pourquoi cette police n'est pas une autre"

---

## 5. Quelles sont les pages importantes du site

Voici les routes principales, expliquées en langage simple.

### `/`

La page d'accueil.

C'est la porte d'entrée du projet.
Elle présente l'univers du site et amène l'utilisateur vers l'onboarding.

### `/onboarding`

Une entrée guidée.

Elle sert à :

- poser le ton,
- introduire le projet,
- faire quelques premiers choix,
- proposer une micro-expérience avant de jouer.

### `/play`

La page de sélection de mode.

L'utilisateur choisit ici le type d'expérience qu'il veut lancer.

### `/game`

L'écran de jeu d'entraînement actuel.

On y voit :

- un mot affiché dans une police,
- quatre réponses possibles,
- un retour visuel immédiat quand on clique.

### `/play/competition`

La partie compétition.

Elle existe côté logique / produit, avec une vraie idée de session courte et mesurable.

### `/play/expert`

La partie expert.

Elle est encore en cours de construction conceptuelle / produit.

---

## 6. Comment marche une partie d'entraînement

Le principe de base est simple.

Le joueur voit :

- un mot au centre,
- affiché dans une police donnée,
- avec 4 noms de polices possibles.

Le joueur doit choisir le bon nom.

### Si la réponse est mauvaise

- le choix devient rouge,
- la question reste là,
- le joueur peut réessayer.

### Si la réponse est bonne

- le bon choix devient vert,
- puis le jeu passe à la suite après un délai.

Ce système a une logique pédagogique :

- on laisse le joueur se tromper,
- on lui montre l'erreur,
- puis on l'aide à corriger,
- au lieu de le punir brutalement.

---

## 7. Pourquoi le projet parle de "training", "competition" et "expert"

Parce qu'il y a plusieurs façons d'apprendre.

### Training

C'est le mode principal.

Il sert à progresser.
L'idée n'est pas de performer publiquement, mais de construire sa reconnaissance visuelle.

### Competition

C'est le mode rapide.

Ici on cherche davantage :

- la vitesse,
- le score,
- la précision sous pression,
- une session comparable d'une personne à l'autre.

### Expert

C'est le mode le plus exigeant.

Au lieu d'avoir un QCM, on vise une réponse plus libre, plus stricte, plus avancée.

---

## 8. Le système d'apprentissage du mode training

Le projet essaie de ne pas fonctionner comme un quiz aléatoire bête.

L'idée est :

- si une police est nouvelle ou difficile pour un joueur, elle revient plus souvent ;
- si une police est bien reconnue, elle revient moins souvent ;
- mais elle ne disparaît jamais totalement.

En arrière-plan, chaque typographie a une sorte de "niveau de maîtrise".

Version simplifiée :

- niveau 0 = jamais vue
- niveau 1 = vue mais ratée
- niveau 2 = reconnue une fois
- niveau 3 = reconnue plusieurs fois
- niveau 4 = assez bien maîtrisée

Donc le système essaye d'apprendre :

- ce que le joueur connaît,
- ce qu'il confond,
- ce qu'il doit revoir bientôt,
- ce qu'il peut revoir plus tard.

On parle ici de **répétition espacée** :

- les choses difficiles reviennent plus tôt,
- les choses acquises reviennent plus tard.

---

## 9. Pourquoi les mots affichés sont importants

Le mot affiché n'est pas décoratif.

Il sert à révéler la structure de la police.

Le mot doit aider à voir :

- la forme du `a`,
- l'ouverture du `e`,
- le dessin du `o`,
- le rythme des lettres,
- les contrastes,
- les proportions.

Donc le choix des mots a une vraie importance pédagogique.

Le mot n'est pas là pour qu'on lise son sens.
Il est là pour qu'on **observe des formes**.

---

## 10. Ce que veut dire "catalogue" dans ce repo

Le mot "catalogue" revient beaucoup.

Ici, le catalogue est la grande base d'information sur les polices.

Il contient notamment :

- les familles typographiques,
- des métadonnées,
- des fichiers préparés pour le runtime,
- des listes de réponses,
- des candidats pas encore validés.

On peut l'imaginer comme une grande bibliothèque :

- certaines polices sont déjà prêtes,
- d'autres sont encore à vérifier,
- d'autres encore sont en cours de préparation.

Important :

les fichiers du catalogue final ne sont pas pensés pour être modifiés à la main n'importe comment.
Souvent, ils sont **produits par un pipeline**.

Un pipeline, très simplement, c'est :

> une suite d'étapes automatiques qui transforme des données brutes en données propres et utilisables.

---

## 11. Pourquoi il y a autant de docs

Parce que le projet mélange plusieurs sujets :

- produit,
- pédagogie,
- interface,
- logique de jeu,
- typographie,
- données,
- scripts,
- organisation du repo.

Un seul README ne suffit pas pour tout porter proprement.

C'est pour ça qu'il y a plusieurs zones de documentation.

### Les docs de vue d'ensemble

Dans `docs/overview/`

Elles servent à comprendre :

- ce qu'est le projet,
- son intention,
- sa structure générale.

### Les docs de jeu

Dans `docs/game/`

Elles servent à comprendre :

- les modes,
- les règles,
- la progression,
- le scoring,
- la logique pédagogique.

### Les docs typographiques

Dans `docs/typography/`

Elles servent à comprendre :

- la logique des comparaisons,
- les métriques,
- les couches de données,
- les contrats du système typo.

### Les docs UI

Dans `docs/ui/`

Elles servent à comprendre :

- les pages,
- les comportements visuels,
- les règles de cohérence,
- la motion,
- le langage d'interface.

### Les docs process

Dans `docs/process/`

Elles servent à comprendre :

- comment travailler proprement,
- comment tester,
- comment éviter de casser le repo.

---

## 12. Comment est rangé le repo

Voici une carte simple du repo.

### `app/`

C'est là que vivent les pages et les routes principales du site.

Si tu veux savoir :

- quelles pages existent,
- quels endpoints existent,
- quelles routes sont accessibles,

tu commences souvent ici.

### `features/`

Ici, le code est rangé par grandes parties produit.

Par exemple :

- landing,
- onboarding,
- modes,
- game.

C'est souvent plus facile à lire que de chercher partout.

### `components/`

Ici, on trouve des morceaux d'interface réutilisables.

Par exemple :

- boutons,
- cartes,
- blocs d'affichage,
- composants typo,
- composants internes de dev.

### `lib/`

Ici, on trouve la logique partagée.

Souvent, ce sont des fonctions, des règles, des contrats, des utilitaires.

Si `components/` montre **comment ça s'affiche**,
`lib/` aide souvent à comprendre **comment ça pense**.

### `content/`

Ici vivent des contenus structurés.

Dans ce projet, on y trouve notamment le catalogue.

### `data/`

Ici vivent des données de travail, des snapshots, des profils, des résultats de mesures.

### `docs/`

La documentation de référence.

### `backups/`

Des archives de secours.

Ce n'est pas l'endroit normal pour développer une fonctionnalité.

---

## 13. La différence entre le produit et le "dev lab"

C'est un point très important.

Le repo contient à la fois :

- le produit visible par l'utilisateur,
- et un labo interne de mesure typographique.

Le labo sert à :

- inspecter des lettres,
- comparer des comportements visuels,
- calibrer des systèmes,
- vérifier des métriques,
- faire des validations internes.

En gros :

- le **produit** sert au joueur,
- le **lab** sert à l'équipe.

Dans le repo, le lab est surtout rangé dans :

- `app/dev/`
- `app/api/dev/`
- `components/dev/typography/`
- `lib/dev/typography/`

Si tu vois `dev` dans le chemin, méfiance :
ce n'est pas forcément quelque chose que l'utilisateur final verra.

---

## 14. Les mots techniques, expliqués sans supposer de connaissances

### "Next.js"

C'est l'outil principal qui sert à construire le site web.

Tu peux l'imaginer comme l'ossature du projet web :

- il gère les pages,
- les routes,
- une partie du serveur,
- le build,
- le développement local.

### "React"

C'est la manière de fabriquer l'interface en petits morceaux réutilisables.

Par exemple :

- un bouton,
- une carte de réponse,
- une zone de score,
- une page complète.

### "Route"

Une route, c'est une adresse du site.

Exemple :

- `/`
- `/onboarding`
- `/game`

### "API endpoint"

C'est une adresse utilisée par le site pour demander ou envoyer des données.

Par exemple :

- démarrer une session,
- envoyer une réponse,
- récupérer un résultat.

### "PostgreSQL"

C'est la base de données.

C'est là que l'on peut stocker durablement :

- les utilisateurs,
- les sessions,
- la progression,
- le catalogue,
- les événements.

### "Runtime"

Le runtime, c'est ce qui s'exécute réellement quand le site tourne.

Autrement dit :

- le comportement vivant du projet,
- pas juste les fichiers posés dans le repo.

### "Build"

Le build, c'est l'étape où l'on prépare le projet pour qu'il puisse tourner proprement en version prête à être déployée.

### "Pipeline"

Une suite d'étapes automatiques qui prennent des données et les transforment proprement.

### "Spec"

Une spec, c'est une spécification :

- ce que le système doit faire,
- ce qui est considéré comme correct,
- ce qu'il ne faut pas changer sans réfléchir.

### "Contract"

Un contract, c'est une règle de structure ou de comportement qu'on s'engage à respecter.

Exemple :

- tel objet doit avoir tels champs,
- telle page doit se comporter de telle façon,
- tel système doit suivre telle règle.

---

## 15. Si tu ouvres le repo pour la première fois, quoi lire dans quel ordre

Voici un ordre conseillé pour ne pas te noyer.

### Étape 1 — comprendre le projet en gros

Lis :

- `docs/overview/getting-started.md` (ce document)
- `docs/overview/site-system-overview.md`
- `docs/overview/brief.md`

### Étape 2 — comprendre le produit

Lis :

- `docs/ui/front-ui-master-spec.md`
- `docs/game/game-unified-spec-v1.md`

### Étape 3 — comprendre la logique typographique

Lis :

- `docs/typography/typography-system-contract.md`

### Étape 4 — comprendre comment le repo est rangé

Lis :

- `README.md`
- `docs/overview/repo-organization.md`

---

## 16. Si tu veux juste te repérer très vite dans le code

### Pour voir les pages

Regarde `app/`

### Pour voir le produit par grands blocs

Regarde `features/`

### Pour voir les composants réutilisables

Regarde `components/`

### Pour voir la logique partagée

Regarde `lib/`

### Pour voir le catalogue typo

Regarde `content/catalog/`

### Pour voir la doc

Regarde `docs/`

---

## 17. Ce qu'il faut retenir si tu oublies tout

Si tu devais retenir seulement 7 idées, ce seraient celles-ci :

1. **Jeux de Typo est un site d'entraînement du regard typographique.**
2. Le repo contient à la fois **le produit** et **des outils internes de labo**.
3. Le mode principal est un système d'apprentissage, pas juste un quiz.
4. Le catalogue des polices est une pièce centrale du projet.
5. Beaucoup de fichiers sont liés à des règles de structure, de pipeline et de qualité.
6. `docs/` contient la vraie mémoire du projet.
7. Le README principal actuel est utile pour lancer le repo, mais pas suffisant pour comprendre le projet seul.

---

## 18. Fichiers à connaître tout de suite

- `README.md` — aperçu technique rapide du repo
- `docs/overview/getting-started.md` — guide d'entrée humain et pédagogique
- `docs/README.md` — sommaire de la documentation
- `docs/overview/site-system-overview.md` — vue d'ensemble du système
- `docs/ui/front-ui-master-spec.md` — fonctionnement de l'interface
- `docs/game/game-unified-spec-v1.md` — logique produit et règles de jeu
- `docs/typography/typography-system-contract.md` — contrat du système typo
- `docs/overview/repo-organization.md` — comment le repo est rangé

---

## 19. Limite de ce document

Ce guide est volontairement simple.

Il explique :

- l'intention,
- la structure,
- le vocabulaire,
- les grandes zones du repo.

Il n'explique pas en détail :

- chaque script du pipeline,
- chaque table SQL,
- chaque composant React,
- chaque comportement visuel au pixel près.

Pour ça, il faut aller dans les documents spécialisés.

---

## 20. Une phrase finale pour bien cadrer le repo

Si tu veux résumer ce projet en une phrase vraiment simple :

> Jeux de Typo est un produit d'apprentissage visuel de la typographie, construit comme un site interactif, soutenu par un moteur de jeu, un catalogue de polices et un labo interne de calibration.
