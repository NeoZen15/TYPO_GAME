# DWIGGINS — Vision produit figée

Date : 2026-07-29.
Statut : **vision figée par le propriétaire du projet. Document de rang supérieur.**

## Comment lire ce document

Ce document dit **ce qu'est le produit** et **ce qui n'est pas négociable**. Il ne dit pas comment le construire : l'architecture backend, le modèle de données détaillé et le séquencement vivent dans un document séparé, à écrire ensuite.

En cas de contradiction entre ce document et un autre document du repo, **c'est celui-ci qui fait foi**. La section « Ce que ce document rend caduc » liste les passages devenus faux ailleurs.

Il ne remplace pas `docs/game/training-engine-spec-v2-clean.md` : cette spec reste la source de vérité du **fonctionnement** du moteur (invariants I-01 à I-14, fenêtres d'intervalle, sélection, cooldowns). Le présent document ajoute les invariants **I-15 à I-23** et tranche ce qui restait ambigu.

## 1. Ce qu'est DWIGGINS

DWIGGINS n'est pas un jeu de quiz. C'est un **moteur d'entraînement du regard**.

Le backend n'est pas une API au service d'écrans : **c'est le cœur du produit**. C'est lui qui décide quoi montrer, quand le montrer, pourquoi le montrer, comment adapter la difficulté, comment espacer les rappels, comment mesurer la progression et comment personnaliser le parcours de chaque personne.

**L'interface n'est qu'une représentation de cette intelligence.** Elle n'a aucune décision pédagogique à prendre, ce que l'invariant I-10 de la spec moteur formule déjà pour la sélection et les distracteurs, et que ce document étend à toute la lecture de la progression.

Conséquence de méthode, tirée de cette vision : le frontend se construit **au-dessus** d'un moteur pensé, jamais l'inverse. Un écran ne fait pas évoluer le moteur, il expose ce que le moteur sait déjà faire.

## 2. Le mode Entraînement : une séance, pas une partie

Le mode Entraînement est le cœur de DWIGGINS.

**Une séance est temporaire. La progression est permanente.** C'est la phrase à retenir, et elle a des conséquences précises.

- L'élève répond à **autant de questions qu'il le souhaite**. Aucune limite artificielle, aucun compteur de manches, aucune fin imposée. **Décision produit validée le 2026-07-29** : le plafond automatique de huit questions du code actuel (`TRAINING_TOTAL_ROUNDS`) doit disparaître. Ce n'est plus un point à arbitrer, il est incompatible avec le mode Entraînement.
- **Il décide quand s'arrêter.** L'arrêt est un geste volontaire.
- À l'arrêt, on lui présente un **bilan de séance** : durée, nombre de réponses, précision, typographies renforcées, nouvelles typographies découvertes, principales confusions, évolution de son pool.
- **La progression pédagogique ne s'arrête jamais.** Quand il revient demain, dans une semaine ou dans un mois, le moteur reprend exactement où il s'était arrêté. Cooldowns, mastery, intervalles et travail de répétition espacée continuent de vivre en arrière-plan, indépendamment des séances.

Le bilan de séance est donc un **agrégat borné à la séance**, calculé à la demande. Il ne clôt rien, il ne remet rien à zéro, il raconte seulement ce qui vient de se passer. La spec moteur §8.3 en décrit déjà la forme (`session_summary`).

### 2.1 Expliquer la philosophie à l'entrée du mode

L'élève ne vient pas « jouer une partie », il vient **entraîner son regard**. Cela doit être dit à l'entrée du mode Entraînement, pas déduit.

Ce qu'il faut lui faire comprendre :

- il n'y a **ni score à battre, ni temps à respecter** ;
- **chaque bonne réponse espace les rappels, chaque erreur les rapproche** ;
- le moteur construit un parcours **entièrement personnalisé**, pour présenter chaque typographie au moment où le cerveau est le plus susceptible de l'oublier ;
- l'objectif n'est pas de terminer une session, mais de **développer une compétence visuelle durable**.

## 3. Une seule vérité pédagogique

**Les faits stockés, et eux seuls :**

- le **mastery par couple (utilisateur, typographie)**, avec son état de répétition espacée (niveau, intervalle, prochaine échéance, compteurs) ;
- le **journal d'événements**, une ligne par réponse, append-only.

**Tout le reste est une vue dérivée, recalculée à la lecture** : niveau visible, carte DWIGGINS, axes, paliers, statistiques, indicateurs de progression, bilans de séance, vues professeur.

Règle d'or, déjà énoncée dans `docs/game/scoring-implementation-contract.md` et ici promue en invariant : **on stocke les faits, on recalcule les dérivés.** Aucun compteur pédagogique parallèle, car un compteur stocké finit toujours par diverger de la réalité qu'il prétend résumer.

Un cache de dérivé reste permis pour des raisons de performance, à condition qu'il soit reconstructible intégralement depuis les faits et jamais traité comme une source.

## 4. Vie privée : l'entraînement libre appartient à l'élève

C'est une décision produit forte, et elle est structurante.

**Le compte élève est un espace entièrement personnel.** Il contient son pool actif, ses niveaux de maîtrise, ses erreurs, ses confusions, ses intervalles de répétition, ses statistiques, sa régularité, l'ensemble de sa progression.

**Ces données ne sont consultables par aucun tiers, quel que soit son rôle.** Ni professeur, ni administrateur d'école. Le professeur ne doit pas savoir combien de temps un élève s'est entraîné, combien de séances il a faites, quelles sont ses erreurs personnelles, ni s'il ne s'est pas entraîné pendant plusieurs jours.

**Le pourquoi** : l'élève doit pouvoir venir s'entraîner librement, sans se sentir surveillé ni évalué en permanence. L'entraînement garde ainsi son caractère volontaire et sans pression. C'est ce qui fait la différence entre un outil qu'on ouvre par envie et un outil qu'on subit.

**Aucun agrégat de l'entraînement libre n'est exposé, même anonymisé.** À l'échelle d'une classe, une moyenne plus deux recoupements réidentifient une personne : l'anonymat n'est pas atteignable sur des cohortes de cette taille. La règle est donc zéro lecture, pas « lecture agrégée ».

**Cette étanchéité doit être garantie par l'architecture, pas par l'interface.** Une promesse portée par des écrans est violée le premier jour où quelqu'un ajoute un écran. Le repo a déjà le bon patron avec le garde-fou de licence, posé dans la **seule** requête qui expose une typographie à un joueur et donc impossible à contourner : la lecture professeur doit être une porte unique, qui n'a physiquement aucun chemin vers l'état pédagogique personnel.

## 5. Le professeur travaille par sessions assignées

Le professeur ne consulte pas, il **assigne**.

Il prépare une **session pédagogique** : un exercice, un devoir, un contrôle, une activité ciblée. Il en choisit les typographies, le niveau de difficulté, le mode de jeu, le nombre de questions, éventuellement une durée ou une date limite. Puis il la publie à une classe.

**Dans ce contexte, et seulement dans ce contexte**, il consulte les résultats de ses élèves : qui a commencé, qui a terminé, la réussite, les erreurs principales, les confusions observées, les compétences travaillées, le temps passé sur cette session.

Il ne voit **jamais** de données issues de l'entraînement libre.

Effet de bord voulu et important : puisque c'est le professeur qui choisit les typographies d'un devoir, **le jeu de questions ne révèle rien de l'état personnel de l'élève**, contrairement à une sélection faite par le moteur sur le pool personnel. L'étanchéité est donc préservée en amont, dans la construction même du devoir.

## 6. Mode, contexte et politique de progression : trois axes distincts

Point d'architecture tranché tout de suite, parce que le confondre coûterait cher plus tard.

Une session porte **trois dimensions indépendantes** :

- **le mode**, c'est-à-dire la façon de jouer : `training`, `competition`, `expert`. Le schéma actuel le porte déjà (`sessions.mode`).
- **le contexte**, c'est-à-dire à qui la session appartient et donc qui peut la lire : `personal` (l'élève pour lui-même) ou `teacher_assignment` (publiée par un professeur à une classe). Le schéma actuel **ne le porte pas** et doit le recevoir.
- **la politique de progression**, c'est-à-dire si les réponses modifient l'état pédagogique personnel : `update_mastery` ou `observe_only`. Le schéma actuel **ne la porte pas** et doit la recevoir.

Les trois sont orthogonaux, et chacun répond à une question différente : le mode dit **comment on joue**, le contexte dit **à qui appartiennent les données**, la politique dit **quel effet pédagogique la session produit**.

Pourquoi trois et pas deux : un professeur peut publier un devoir en mode compétition, et un élève peut jouer une compétition pour lui seul, donc le mode ne détermine pas le contexte. Et surtout, **un entraînement assigné et un contrôle assigné partagent le même contexte mais n'ont pas le même effet** : le premier est un véritable apprentissage et doit nourrir la mémoire de l'élève, le second observe une compétence sans la déplacer. Le contexte est donc incapable de décider de l'effet pédagogique, il faut un axe pour lui.

**La règle de confidentialité s'attache au contexte, jamais au mode.** Tout ce qui est `personal` est privé, quel que soit le mode. Tout ce qui est `teacher_assignment` est lisible par le professeur qui l'a publiée, quel que soit le mode.

**L'effet pédagogique s'attache à la politique, jamais au contexte.** La politique est une donnée explicite de la session, décidée à sa création, jamais déduite du contexte et **jamais décidée par le frontend**.

Le contexte se propage de la session vers chaque événement, comme `mode` le fait déjà, pour qu'une lecture n'ait jamais besoin d'une jointure pour connaître ses droits.

### 6.1 Politique par défaut selon le mode

Le mode **impose ou propose** une politique par défaut. Elle n'est jamais implicite, elle est écrite sur la session.

| Mode | Politique | Nature de la règle |
|---|---|---|
| `training` | `update_mastery` | Défaut, c'est un véritable apprentissage |
| `competition` | `observe_only` | **Imposé, sans exception possible** |
| `expert` | à décider explicitement | Ne pas laisser au hasard |
| Futurs modes professeur (contrôle, évaluation) | à décider explicitement selon leur fonction | Un contrôle observe, il ne déplace pas |

L'interdiction faite à la compétition n'est pas nouvelle : elle formalise l'invariant I-11 existant, vérifié dans le code, où le provider de compétition **lit** le mastery pour calibrer ses distracteurs mais ne l'écrit jamais. Elle vaut désormais **que la compétition soit personnelle ou assignée par un professeur**.

### 6.2 Les trois axes combinés

| Session | Mode | Contexte | Politique | Effet |
|---|---|---|---|---|
| Séance libre de l'élève | `training` | `personal` | `update_mastery` | Nourrit la mémoire, invisible du professeur |
| Compétition jouée seul | `competition` | `personal` | `observe_only` | Ne déplace rien, invisible du professeur |
| Entraînement donné par le professeur | `training` | `teacher_assignment` | `update_mastery` | Nourrit la mémoire **et** produit les résultats de la session, lisibles par ce professeur |
| Contrôle ou évaluation | `training` ou autre | `teacher_assignment` | `observe_only` | Mesure sans déplacer, résultats lisibles par ce professeur |
| Compétition donnée par le professeur | `competition` | `teacher_assignment` | `observe_only` | Ne déplace rien, résultats lisibles par ce professeur |

**Et dans tous les cas, y compris quand une session assignée nourrit la mémoire de l'élève, la frontière de lecture reste absolue.** Le professeur voit les événements et les résultats de la session qu'il a créée. Il ne voit jamais le mastery global de l'élève, ni son pool personnel, ni **les effets de cette session sur la progression privée**, ni quoi que ce soit venant de l'entraînement libre.

La séparation doit être garantie à trois niveaux, pas un seul : **le schéma** (contexte et politique existent comme données de premier rang), **les autorisations** (une lecture professeur n'a aucun chemin vers l'état personnel), **les requêtes** (une seule porte de lecture par public, sur le modèle du garde-fou de licence qui vit dans la seule requête exposant une typographie à un joueur).

## 7. Ce que chacun voit

| Donnée | Élève | Professeur | Moteur |
|---|---|---|---|
| Mastery brut par typographie | Non, uniquement traduit | Non | Oui |
| Pool actif, intervalles, prochaines échéances | Traduit (« ce que je travaille en ce moment ») | Non | Oui |
| Confusions issues de l'entraînement libre | Oui | **Non** | Oui |
| Régularité, temps passé, séances en entraînement libre | Oui | **Non** | Oui |
| Carte DWIGGINS, axes et paliers | Oui, représentation principale | Non | Vue dérivée |
| Niveau Dreyfus N.1 à E.5 | Non affiché comme note | Non | Oui, variable de commande |
| Résultats d'une session assignée | Oui | **Oui**, borné à cette session | Oui |
| Confusions observées dans une session assignée | Oui | **Oui**, borné à cette session | Oui |
| XP, combo, jetons, arène | Oui | **Non** | Non, jamais consommé |

## 8. Niveau Dreyfus et carte DWIGGINS : une boîte de vitesses et un miroir

Ce sont deux objets de nature différente, ils ne sont donc pas deux progressions concurrentes. C'est ce qui règle la question.

**Le niveau Dreyfus est une variable de commande interne du moteur**, pas une note. Ce n'est pas une opinion : dans le code actuel, `users.dreyfus_level` **pilote deux mécanismes**. `try_unlock_one_typeface` filtre les nouvelles typographies candidates par `dreyfus_tier <= dreyfus_level`, et la taille cible du pool actif dépend du même palier (30 en N et D, 32 en C, 34 en A, 36 en E). Le supprimer du système casserait le déblocage et la croissance du pool. Il peut donc **disparaître de l'affichage**, il ne peut pas disparaître du moteur.

**La carte DWIGGINS est la représentation principale visible par l'élève.** Elle répond à « qu'est-ce que mon œil sait voir maintenant », par axes et paliers qui s'allument. C'est le cœur émotionnel du produit.

Formulé simplement : le niveau Dreyfus décide **de la difficulté de ce qu'on sert**, la carte montre **ce que le regard a acquis**. Les deux dérivent des mêmes faits, aucun n'est stocké comme une vérité indépendante.

Le libellé `N.1` à `E.5` n'est pas affiché comme une note à l'élève. S'il devait apparaître un jour, ce serait comme une synthèse discrète et secondaire, jamais comme le score de l'élève.

### 8.1 Le moment de franchissement : on le garde, on le transforme

Décidé le 2026-07-29. Le toast de changement de palier n'est ni supprimé, ni conservé tel quel.

Il n'est **pas** un « level up » de jeu vidéo : cela ferait du niveau Dreyfus un objectif visible concurrent de la carte. Mais on ne supprime pas ce moment, parce qu'il porte une vraie récompense émotionnelle et permet de **ressentir** qu'un cap vient d'être franchi.

Le toast célèbre donc **une évolution réelle du regard, pas la montée d'un chiffre**. Formulations qualitatives : « votre regard progresse », « vous venez de franchir un nouveau palier », « votre maîtrise évolue ». Aucun compteur mis en avant, aucune mécanique de gamification classique, et une apparition **rare**.

Répartition finale des trois rôles, complémentaires et non concurrents :

| Élément | Rôle |
|---|---|
| Niveau Dreyfus | pilote le moteur en interne (déblocage, taille du pool) |
| Carte DWIGGINS | montre la progression dans le temps, représentation principale de l'élève |
| Toast de franchissement | célèbre ponctuellement un passage important, qualitativement |

## 9. L'engagement est une couche séparée

L'XP, les combos, les jetons, l'arène et le classement peuvent exister pour l'élève. Ils sont une **couche d'engagement**, pas une seconde vérité pédagogique.

Trois interdits, sans exception :

- ils **n'influencent jamais** le moteur pédagogique, ni mastery, ni intervalles, ni pool, ni niveau ;
- ils ne sont **jamais une preuve de compétence** ;
- ils ne sont **jamais visibles par le professeur**.

Ils peuvent être stockés séparément si leur fonctionnement l'exige. Cela reste cohérent avec l'invariant I7 de la math spec, qui cantonne déjà l'arène à une XP plafonnée sans effet sur les boîtes ni les axes.

## 10. Invariants ajoutés (liste fermée, suite de I-01 à I-14)

Ces invariants complètent ceux de `training-engine-spec-v2-clean.md` §2. Comme eux, ils doivent être **vérifiables par requête** (au sens du cas P-06) et aucune logique backend ou frontend ne peut les contredire.

| # | Invariant |
|---|-----------|
| I-15 | L'état pédagogique personnel issu d'un contexte `personal` (pool, mastery, intervalles, confusions, régularité, temps passé) n'est lisible par **aucune partie du contexte institutionnel de l'élève** : professeur, administration de l'école, camarades. Aucune exception, aucun agrégat, **même pseudonymisé**. L'opérateur du produit relève d'un régime distinct et borné, défini en I-24. |
| I-24 | **Régime des analyses internes** (opérateur du produit, distinct du professeur). Autorisées pour améliorer le produit et valider la méthode, sous conditions cumulatives : jamais accessibles au professeur ni à l'école ; **jamais utilisées pour évaluer un élève** ; accès nominatif réservé aux seules opérations indispensables (sécurité, support, exercice des droits) ; analyses produit menées **de préférence sous forme pseudonymisée ou agrégée** ; données de test séparées ; **accès journalisés** ; durées de conservation définies. Un tableau de bord général **masque les cohortes trop petites**. En revanche aucune taille de cohorte minimale n'est imposée à toute requête interne : certains diagnostics techniques ou pédagogiques exigent de suivre un cas individuel. Vocabulaire : tant que les événements restent techniquement rattachables à un compte, on écrit **pseudonymisé**, jamais « anonymisé ». |
| I-16 | Toute lecture professeur est bornée aux événements d'une session de contexte `teacher_assignment` que ce professeur a publiée, sur une classe qui est la sienne. |
| I-17 | Une séance d'entraînement se termine par une **décision de l'élève**, jamais par un compteur de questions. Sa fin ne clôt, ne réinitialise et ne suspend aucun état pédagogique. |
| I-18 | Le mastery brut n'est **jamais affiché comme une note**, ni à l'élève ni au professeur. Il n'existe qu'à l'état traduit. |
| I-19 | La couche d'engagement (XP, combo, jetons, arène) n'influence jamais le mastery, les intervalles, le pool ni le niveau. Elle n'est jamais une preuve de compétence, et jamais visible par le professeur. |
| I-20 | Le niveau Dreyfus est une **variable de commande interne** du moteur (filtre de déblocage, taille cible du pool). Ce n'est pas une note destinée à l'élève. |
| I-21 | La sélection des typographies d'une session `teacher_assignment` **ne consulte jamais le pool personnel** de l'élève : elle vient du choix du professeur. |
| I-22 | L'effet d'une session sur la progression pédagogique est déterminé **explicitement par sa politique de progression** (`update_mastery` ou `observe_only`), inscrite sur la session, **indépendamment de son contexte**. Elle n'est jamais déduite du contexte, jamais décidée par le frontend. Le mode `competition` est **toujours** `observe_only` sur le mastery, en personnel comme en assigné. |
| I-23 | Quand une session `teacher_assignment` porte `update_mastery`, l'effet sur la progression privée de l'élève **reste invisible du professeur** : il lit les résultats de sa session, jamais le mastery global, jamais le pool, jamais le déplacement que sa session a produit. |

## 11. Registre des contradictions documentaires

Relevé exhaustif au 2026-07-29, obtenu en balayant `docs/game`, `docs/process`, `docs/overview` et `docs/ui`. Objectif : qu'il ne reste **qu'une seule vision cohérente** dans le projet. Chaque entrée donne le passage, la nature du conflit, la résolution et l'état.

**Contradictions de vision (le document dit le contraire de ce qui est décidé ici)**

1. `classes-comptes-spec.md`, « Tableau de bord prof » V1 : « le prof voit la progression et la maîtrise de chaque élève, niveau visible, typos maîtrisées, **dernière activité** ». Contredit I-15 et I-16. **Résolution** : section encadrée comme caduque, à réécrire autour des seules sessions assignées. **État : traité le 2026-07-29.**
2. `classes-comptes-spec.md`, même section, V2 et V3 : « faiblesses perceptives **par élève**, par classe, par cohorte », « matrices de confusion », « suivi dans le temps », « vue admin école transverse ». Contredit I-15 dès que la source est l'entraînement libre. **Résolution** : recevable uniquement si la source est restreinte aux sessions assignées. **État : traité, encadré, à réécrire précisément dans le document d'architecture.**
3. `classes-comptes-spec.md`, V2 : « l'assignation, où le prof peut **imposer des axes ou des typos à travailler** ». Si cela injecte des typographies dans le pool personnel, le professeur façonne l'espace privé de l'élève et peut en déduire l'état. Contredit l'esprit du §4 et l'invariant I-21. **Résolution** : une assignation est **une session**, jamais une mutation du pool personnel. **État : à réécrire.**
4. `handoff-page-parcours.md` §87, HUD compact : `TRAINED EYE · LVL 7 · 320/700 XP · streak`. Présente l'XP comme la mesure du regard. Contredit I-18 et I-19. **Résolution** : le HUD ne peut pas faire de l'XP la mesure de la compétence ; la carte est la représentation principale. **État : à réécrire.**
5. `scoring-implementation-contract.md` §1, tableau « A — Faits stockés » : range `xp_total`, `streak`, `coins`, `arena` parmi les faits, au même rang que la maîtrise. Contredit §3 (vérité pédagogique unique) et I-19. **Résolution** : deux stockages distincts, l'engagement explicitement étiqueté comme non pédagogique. **État : à réécrire.**
6. `global-level-progression.md` §160 et le toast implémenté dans `GameScreen` : affichent le niveau `N.1` à `E.5` au joueur lors d'un changement de palier. Contredit I-20 et la décision que la carte est la représentation principale. **Résolution** : le calcul interne reste (il pilote déblocage et taille de pool), le sort du toast est à trancher dans le document d'architecture. **État : à trancher.**
7. `game-unified-spec-v1.md` §54 et `ui/front-ui-master-spec.md` §39 : « `Play again` relance une session locale ». Suppose une partie qui se termine et se rejoue. Contredit I-17. **Résolution** : remplacer par « terminer ma séance » suivi du bilan, puis une nouvelle séance. **État : à réécrire.**
8. `game-v4-executable-spec.md` §3.1 et §9 : « at session start, **front** must derive `activeTypefacePool` (target around 30) », plus tout le « Front-Only Local Contract ». Contredit I-10 et le §1 (le backend décide). C'est un vestige de la phase front-only. **Résolution** : marquer le document comme historique sur ces sections, le moteur serveur fait foi. **État : à marquer.**

**Contradictions entre documents (indépendantes de la vision, mais bloquantes pour implémenter)**

9. Type Cards, comportement : `game-v4-executable-spec.md` §7.1 dit « **blocks** gameplay interactions while visible », `training-engine-spec-v2-clean.md` §6.3 dit « interaction **non bloquante** ». Il faut trancher avant d'implémenter la Misread (écart 2 de la checklist).
10. Type Cards, familles : la spec v4 et la spec unifiée prévoient `reading` **et** `misread` ; la spec moteur v2 §6.1 restreint à « cartes de correction uniquement (Misread) » en V2. À aligner.
11. Rotation des mots : `game-v4-executable-spec.md` §4.1 et `game-unified-spec-v1.md` §4.1 disent « garder le même mot pour toute la session » ; la spec moteur v2 et le code disent « changement toutes les 5 questions » en entraînement. Le code suit la v2. À aligner sur la v2.
12. `game-unified-spec-v1.md` §10.5 : « Reading Card : implémentée ; Misread : logique backend non finalisée ». Factuellement faux aujourd'hui : **aucune des deux n'existe** dans le runtime, `content/type-cards/` est absent. À corriger comme documentation d'état réel.

**Statut à clarifier, pas une contradiction ponctuelle mais un document entier**

13. `scoring-and-selection-math.md` v3.1 décrit un autre moteur : boîtes 0 à 5, intervalles en **jours**, examen de promotion, bande de confort, valeur d'apprentissage. Le moteur implémenté et conforme est celui de la spec v2, mastery 0 à 4 avec intervalles en **questions**. Ce n'est pas une erreur, c'est une évolution possible non branchée. **Il faut lui donner un statut explicite** : évolution future à réconcilier, ou périmé sur la partie ordonnancement et conservé sur la partie engagement. Décision attendue dans le document d'architecture. Sans statut, chaque développement futur choisira implicitement, et les deux modèles divergeront.

## 12. Arbitrages

**Résolu.** L'effet d'une session assignée : il vient de la politique de progression, jamais du contexte. Voir I-22 et I-23.

**A. Analyses internes : RÉSOLU le 2026-07-29.** Le principe est validé, à condition de distinguer clairement **le professeur** de **l'opérateur du produit**. La confidentialité interdit toute lecture institutionnelle de l'entraînement personnel, elle ne doit pas rendre impossible l'amélioration scientifique et produit de DWIGGINS. Le régime est inscrit en **I-24**. Deux nuances retenues telles quelles : pas de taille de cohorte minimale imposée à **toute** requête interne, car certains diagnostics techniques ou pédagogiques exigent de suivre un cas individuel, mais masquage obligatoire des petites cohortes sur tout tableau de bord général ; et le mot « anonymisé » est proscrit tant que les événements restent rattachables à un compte, c'est de la **pseudonymisation**.

**B. Le moment de franchissement : RÉSOLU le 2026-07-29.** On garde le toast et on le transforme en signal rare, qualitatif et émotionnel. Détail et répartition des trois rôles en **§8.1**.

**C. Statut de la math spec v3.1 : RÉSOLU le 2026-07-29, et plus profondément qu'un statut.** Ce document ne décrit pas un ancien état du moteur, il décrit **une autre philosophie pédagogique** : boîtes, sessions bornées, examens de promotion, progression par niveaux d'XP, contre maîtrise continue, répétition espacée, progression sans fin et séparation compétence / engagement. Les deux ne peuvent pas coexister comme sources de vérité.

Décision : la math spec **change de nature**. Elle devient un document de **recherche et d'exploration**, sort de la hiérarchie documentaire (§13) et perd toute autorité sur l'implémentation. Elle garde son rôle de mémoire du raisonnement et de réserve d'idées. Aucune règle ne peut en être implémentée directement : il faut réévaluer au regard de la vision, reformuler, intégrer explicitement dans une spécification vivante, et alors seulement développer.

Traité au delà de la simple annotation de sections, comme demandé : un bandeau en première page dit ce qu'est devenu le document et pourquoi, avec l'avertissement au lecteur pressé, « une formule bien écrite n'est pas une formule applicable ». **Deux documents perdent leur autorité par ricochet** : `scoring-implementation-contract.md`, qui est le contrat de branchement de la math spec et déclarait lui même que « la math-spec fait foi », et la règle du §0 de `handoff-page-parcours.md` qui disait « en cas de contradiction, la spec maths fait foi », renversée. `perceptual-progression-spec.md` garde son autorité sur le modèle de la carte et perd son alignement déclaré sur la math spec.

**D. Type Cards : PARKÉ volontairement le 2026-07-29.** Décision du propriétaire : ne pas trancher maintenant. Le rôle des cartes, leurs familles et leur comportement **font encore partie de la conception produit**, et figer une architecture avant maturité coûterait plus cher que d'attendre. On y revient quand le produit est assez mûr. Ce n'est pas une hésitation, c'est un refus de geler prématurément.

Éléments d'orientation déjà exprimés, à reprendre le jour de la décision sans les considérer comme arrêtés : préférence pour une Misread **courte et bloquante** (une carte non bloquante risque d'être ignorée et de devenir décorative), déclenchement **sélectif** et non après chaque erreur, famille `reading` hors périmètre tant que sa fonction n'est pas prouvée.

Ce que la reprise devra trancher, et qui est plus profond que « bloquant ou non » : la spec moteur affiche la Misread **au premier faux clic, pendant que la question reste ouverte au retry**, ce qui n'a de sens qu'avec une carte non bloquante. Une carte bloquante impose de choisir entre l'afficher **avant** le retry (le plus pédagogique, mais elle souffle la seconde tentative) ou **après** la résolution de la question (le retry reste un vrai second essai, la correction arrive plus tard). Ce choix touche le contrat d'API, les états d'interface et la mesure de `misread_effectiveness`.

**Ce qui ne dépend pas de D et ne doit pas attendre** : la télémétrie mentit déjà. Le déclencheur écrit `misread_shown = true` alors qu'aucune carte n'existe. Le jour où les cartes arriveront, l'historique sera inexploitable pour mesurer leur effet. Corriger la véracité de la trace ne demande aucune décision produit.

## 13. Hiérarchie documentaire

Décidée le 2026-07-29, en même temps que l'arbitrage C. Elle existe pour une raison précise : **empêcher que DWIGGINS ne dérive vers deux moteurs concurrents issus de deux documents différents.**

**La chaîne de décision est unique.**

| Rang | Document | Ce qu'il définit |
|---|---|---|
| 1 | **Vision Produit** (`vision-produit-dwiggins.md`) | les principes, et ce qui n'est pas négociable |
| 2 | **Spec Moteur** (`training-engine-spec-v2-clean.md`) | la traduction des principes en règles pédagogiques |
| 3 | **Architecture Backend** (`architecture-backend.md`) | où ces règles vivent techniquement |
| 4 | Contrats d'API, specs d'interface, documents d'exécution | leur application |

Chaque rang est subordonné à celui du dessus. Un document de rang 4 qui contredit un document de rang 1 a tort, sans discussion.

**Les documents de recherche sont volontairement hors de cette chaîne.** Ils **inspirent** le produit, ils ne le **gouvernent** jamais. Cette séparation nette entre ce qui inspire et ce qui fait autorité est le mécanisme qui protège la cohérence du projet dans le temps.

Sont classés recherche au 2026-07-29 :

- `scoring-and-selection-math.md` (math spec v3.1), qui décrit une autre philosophie pédagogique et non une ancienne version du moteur ;
- `scoring-implementation-contract.md`, par ricochet, puisqu'il est le contrat de branchement de la précédente et déclare lui même que « la math-spec fait foi ».

**Chemin de retour d'une idée de recherche vers le produit**, obligatoire et sans raccourci : réévaluer au regard de la vision, reformuler si nécessaire, intégrer explicitement dans une spécification vivante de rang 2 ou 3, et alors seulement développer. Une formule bien écrite n'est pas une formule applicable.

**Cas particulier des documents mixtes.** `perceptual-progression-spec.md` garde son autorité sur le modèle de la carte du regard, qui est confirmé par le §8, mais perd son alignement déclaré sur la math spec. Quand un document est partiellement valable, on annote le passage devenu faux plutôt que de laisser le lecteur deviner.
