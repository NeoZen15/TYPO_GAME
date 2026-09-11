# Spécification produit — l'espace Administration

**Rang 4.** Applique la vision, la spec moteur et l'architecture backend (le flux d'accès enseignant est figé en `game/architecture-backend.md` §2.3). Écrit le 2026-09-11.

## 1. Ce que l'Admin est, et ce qu'il n'est pas

L'Admin n'est pas seulement l'endroit où l'on accepte des établissements et où l'on gère des comptes. C'est le **poste d'observation du produit** : l'endroit où l'on apprend, sur des faits, comment les gens reconnaissent la typographie et si le moteur pédagogique fait ce qu'il promet.

**Le piège nommé par le propriétaire, et la règle qui en découle : ne pas transformer l'Admin en usine à gaz avant d'avoir des utilisateurs.** On ne dessine donc aucun panneau pour une donnée qui n'existe pas encore. Une maquette de donnée absente coûte deux fois : on la construit, puis on la reconstruit quand la vraie donnée arrive avec une autre forme.

**L'ordre de construction, décidé.** 1. Comptes, établissements, demandes. 2. Usage réel. 3. Apprentissage et confusions. 4. Diagnostic moteur. 5. Qualité et incidents. 6. Tendances.

## 2. Le régime de lecture

Ces vues sont celles de **l'opérateur du produit**, jamais celles d'un professeur. L'invariant I-24 l'autorise explicitement : la confidentialité interdit la lecture institutionnelle de l'entraînement personnel, elle n'interdit pas d'améliorer le produit avec ses propres données. Deux conséquences tenues partout :

- **aucune vue générale ne nomme un utilisateur**, tout est agrégé ;
- **les petites cohortes sont masquées**, et sur un produit jeune c'est la règle et non l'exception. Mesuré le 2026-09-11 en production : 885 premiers essais répartis sur 333 polices, donc moins de trois essais par police, et **seulement 16 polices dépassent dix essais**. Un classement calculé là dessus serait du bruit présenté comme un résultat. Chaque chiffre sort donc avec son effectif, et ce qui n'atteint pas le seuil n'est pas classé.

Le mot « anonymisé » reste proscrit tant que les événements sont rattachables à un compte : c'est de la **pseudonymisation**.

## 3. Les six vues, et ce que chacune demande

### 3.1 Comptes, établissements, demandes — FAIT

Les demandes d'accès en Pending / Approved / Rejected, une fiche par demande, les doublons signalés, les établissements proposés et jamais identifiés, l'aperçu de ce qui sera créé. Voir `spec-creation-exercice.md` pour le vocabulaire et §2.3 de l'architecture pour le flux.

**Manque** : le provisionnement derrière Accepter, qui attend les clés de Clerk.

### 3.2 Usage réel — FAIT, sur ce qui existe déjà

Actifs 7 et 30 jours, comptes créés, séances lancées, terminées, encore ouvertes, questions par séance, justesse au premier essai, temps de réponse médian, répartition par mode.

**La question à laquelle cette vue répond, et c'est la seule qui compte au début** : est ce que les gens jouent, ou est ce qu'ils créent un compte et disparaissent ? Premier relevé, 2026-09-11 : 271 comptes, 177 actifs sur 30 jours, **1 sur 7 jours**, 595 séances dont **92 terminées**, 6 questions par séance, 59 % de justes au premier essai, 1,1 s de médiane.

**Manque pour aller plus loin** : la part entraînement / contrôle / compétition **assignée**, qui demande des devoirs joués ; et les établissements actifs, qui demandent des établissements.

### 3.3 Apprentissage et confusions — COMMENCÉ

Ce qui résiste (justesse par police au premier essai, à partir de dix essais), ce que les gens confondent (paires réelles, à partir de trois occurrences), polices stabilisées, rechutes après stabilisation.

**Ce qui existe déjà et qu'on ne soupçonne pas** : la réponse **choisie** est enregistrée à côté de la réponse attendue depuis le premier jour. Les confusions n'ont jamais demandé une colonne de plus, seulement du volume.

**Manque** : le temps pour faire passer une police de 0 à 4, qui se calcule sur les transitions de maîtrise du journal et demande surtout assez de polices stabilisées (19 aujourd'hui) ; et la vitesse comparée par sous catégorie (« les géométriques 1,4× plus vite que les néo-grotesques »), qui demande la même chose.

### 3.4 Établissements et classes — À CONSTRUIRE

Ouvrir une école, voir ses enseignants, ses classes, ses effectifs, les exercices envoyés, participation, complétion, et **la distribution plutôt que la moyenne** : une moyenne cache une classe coupée en deux. Plus les confusions dominantes de la classe et l'évolution entre deux contrôles.

**Manque** : des établissements, des classes et des devoirs joués. Les requêtes, elles, existent déjà côté professeur (`lib/teacher/read-gate.ts`) et diront la même chose un cran au dessus.

### 3.5 Diagnostic moteur — À CONSTRUIRE, et réservé à l'opérateur

Combien de fois une police est sélectionnée, quels leurres sortent avec elle, si certains clusters sont surexploités, si des polices n'apparaissent jamais, si le moteur tourne en boucle, si une règle adaptative produit un comportement étrange.

**Ce qui manque n'est pas la donnée mais la trace** : le journal dit la police demandée et la réponse choisie, **pas les quatre options proposées**. Sans elles, on ne peut pas mesurer quels leurres sortent. Deux façons d'y remédier, à trancher le jour venu : enregistrer les options sur le fait, ou les recalculer depuis la graine et l'index de question, que le journal porte déjà. La seconde ne coûte aucune colonne.

### 3.6 Qualité, incidents, tendances — PLUS TARD

Comptes bloqués, invitations non acceptées, doublons d'établissements, erreurs techniques, exercices non générés, polices qui ne chargent pas, séances interrompues. Puis les tendances, qui sont la seule vue qui fabrique une connaissance que personne n'a : « cette semaine, 38 % confondent Inter et Roboto ».

**Manque** : un journal d'incidents. Aujourd'hui les erreurs partent dans la console du serveur et nulle part ailleurs.

## 4. Ce qui n'a aucune donnée aujourd'hui, et qu'il ne faut pas dessiner

**Les Type Cards.** Le registre des contradictions de la vision le dit déjà : ni Reading Card ni Misread n'existent dans le runtime, et `content/type-cards/` est absent. Mesurer « une carte est elle suivie d'une meilleure réponse » n'est donc pas une vue en attente de données, c'est une vue en attente d'une fonctionnalité. Elle se spécifiera quand les cartes existeront, et pas avant.
