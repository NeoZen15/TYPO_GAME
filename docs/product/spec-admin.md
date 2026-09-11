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

## 3. La barre de navigation : dix-sept entrées, quatre groupes

**Posée le 2026-09-11, dans l'ordre décidé par le propriétaire.** Navigation permanente à gauche, jamais repliée : un espace où l'on navigue par la barre doit toujours montrer où l'on est. Beaucoup d'entrées bien rangées valent mieux qu'un écran dense, parce que la question « où est cette information » ne doit jamais se poser. Chaque entrée porte **une question**, et cette question sert à la fois de description dans la barre et de sous-titre de la page : les deux ne peuvent pas diverger, elles sont écrites une seule fois dans `features/admin/components/admin-nav.ts`.

**Vue d'ensemble** — le cockpit, pas une page d'analyse. Ce qui demande un geste, puis six signes vitaux, puis des liens. Le temps de réponse médian n'y est pas : intéressant n'est pas vital, et un accueil qui montre tout ne montre rien.

| Groupe | Entrées |
| --- | --- |
| **Administration** | Demandes d'accès · Établissements · Classes · Enseignants · Élèves et comptes |
| **Produit et activité** | Activité · Utilisateurs · Sessions · Audience et acquisition |
| **Pédagogie** | Progression · Confusions · Typographies · Devoirs |
| **Système** | Moteur · Données et qualité · Paramètres |

**Deux couches qu'on ne mélange jamais.** Les comptes, les joueurs et les séances viennent de DWIGGINS : le journal les connaît ligne par ligne. Les visiteurs, les sources de trafic et la conversion visite vers inscription viennent d'ailleurs, et DWIGGINS n'en sait rien. Les mélanger produirait un taux de conversion dont le numérateur et le dénominateur ne parlent pas de la même population. La place d'Audience est prête, sa donnée n'est pas inventée.

**La porte est posée une fois**, dans `app/admin/layout.tsx`, avec son exception qui se referme toute seule : on n'ouvre sans compte que si Clerk n'est pas configuré **et** qu'aucune demande n'existe. Dix-sept pages qui répètent leur propre contrôle d'accès, ce sont dix-sept occasions d'en oublier un.

## 3 bis. Élèves : gestion et dépannage, jamais analyse pédagogique

**Correction explicite du propriétaire, 2026-09-11**, et elle annule une partie de son message précédent : *« je ne cherche pas à analyser individuellement si un élève est bon ou mauvais, ni à consulter sa progression pédagogique détaillée. Ça, c'est pertinent pour le professeur dans son espace, pas pour moi en tant qu'opérateur. »*

La page **Élèves et comptes** sert donc à ouvrir un compte parce que quelqu'un est bloqué : il ne voit pas sa classe, son invitation n'est pas arrivée, son compte invité n'a pas été repris. Elle montre un **état** (rôle, rattachement, activité, dates), jamais un niveau. **Aucun taux de réussite, aucun classement, aucun tri par performance** : un tri par performance transformerait ce répertoire en palmarès.

**Ce que la base ne sait pas, et la page le dit.** `users` ne porte ni nom ni adresse : l'identité vit chez Clerk et `clerk_id` est le seul fil. Un compte se reconnaît à son identifiant court, son rôle et son rattachement.

**Ce qui intéresse l'opérateur est l'agrégé**, et il a priorité : typographies les plus et les moins reconnues, taux de reconnaissance, répétitions avant stabilisation, paires les plus confondues, familles et groupes visuels les plus difficiles, évolution de la reconnaissance après plusieurs expositions, abandons, efficacité de la répétition espacée. But affiché : **une vraie cartographie de la reconnaissance typographique issue de l'usage réel**.

## 4. Les six familles de vues, et où elles en sont

### 4.1 Comptes, établissements, demandes — FAIT

Les demandes d'accès en Pending / Approved / Rejected, une fiche par demande, les doublons signalés, les établissements **proposés et jamais identifiés**, l'aperçu de ce qui sera créé. Voir `spec-creation-exercice.md` pour le vocabulaire et §2.3 de l'architecture pour le flux. Établissements, Classes et Enseignants ont leur page : elles lisent les vraies tables et disent ce qui les remplira tant qu'elles sont vides.

**Manque** : le provisionnement derrière Accepter, qui attend les clés de Clerk.

### 4.2 Usage réel — FAIT

Activité (séances lancées, terminées, abandonnées, personnel contre devoir, jour par jour), Utilisateurs (arrivées, retour), Sessions (forme d'une séance).

**Premier relevé, 2026-09-11** : 271 comptes, 177 actifs sur 30 jours, **1 sur 7 jours**, 595 séances dont **92 terminées**, 6 questions par séance, 59 % de justes au premier essai, 1,1 s de médiane.

**Mesure qui a changé une page.** La médiane de durée toutes séances confondues valait 101 ms en compétition et 141 ms en entraînement, parce que **391 séances sur 595 sont nées et refermées en moins d'une seconde**. Les médianes ne portent donc plus que sur les séances **terminées** (2 min en compétition, 50 s et 4 questions en entraînement), et les mortes-nées sont comptées à part, comme un signal de démarrage et non de renoncement. **Question ouverte** : d'où viennent ces 391 séances.

**Le retour est défini sévèrement** : une personne est revenue si son activité s'étale sur au moins **deux jours différents**. Une longue première visite reste une première visite. Relevé : 99 personnes ont joué, **2 sont revenues**.

### 4.3 Apprentissage et confusions — FAIT, et c'est la priorité

Progression, Confusions et Typographies portent l'analyse agrégée que le propriétaire demande. Mesures du 2026-09-11 :

- **La courbe d'exposition monte** : 56 % à la première rencontre d'une police, 56 % à la deuxième, 67 % à la troisième, 73 % à la quatrième et à la cinquième. C'est la mesure la plus importante de tout l'espace : un produit qui occupe les gens sans rien leur apprendre produirait exactement les mêmes chiffres d'usage, seule cette courbe les sépare.
- **La distance des erreurs diagnostique l'échelle des leurres** : 37 % des erreurs tombent dans le même groupe visuel, 20 % dans la même sous-catégorie, 40 % dans la même grande catégorie, et **4 % seulement dans « rien de commun »**. L'échelle rapproche donc vraiment.
- **Les familles qui résistent** : géométriques 53 %, transitionnelles 55 %, grotesques 57 %.
- **Couverture** : 333 polices montrées sur 1279 jouables, **946 jamais montrées à personne**.

**Deux bouts demandent assez de milieu.** Seize polices passent le seuil de dix essais, donc deux classements de quinze montraient les mêmes polices à l'endroit puis à l'envers. En dessous du double de la longueur de liste, une seule liste complète, et la page dit pourquoi.

**Manque** : les répétitions avant stabilisation, mesurables mais sans effectif (aucune police n'a été stabilisée par trois personnes, 19 états à 4 en tout).

### 4.4 Établissements et classes — COQUILLE FAITE, DONNÉES ABSENTES

Ouvrir une école, voir ses enseignants, ses classes, ses effectifs, les exercices envoyés, participation, complétion, et **la distribution plutôt que la moyenne** : une moyenne cache une classe coupée en deux.

**Manque** : des établissements, des classes et des devoirs joués. Les requêtes côté professeur (`lib/teacher/read-gate.ts`) diront la même chose un cran au dessus.

### 4.5 Diagnostic moteur — FAIT SUR CE QUI SE MESURE

Temps expirés, réponses invalides, reprises, Misread et Lecture montrés, composeurs en vol, distance des erreurs. Relevé : 0 % de temps expirés, 0 % d'invalides, 12,7 % de reprises, 0 % de cartes montrées (elles n'existent pas), deux composeurs et une seule révision de chacun.

**Attention à `engine_version`** : le champ porte le nom du composeur **et** sa révision dans une seule chaîne. Voir « training-provider-v1 » et « competition-provider-v1 » côte à côte est l'état normal ; ce qui mérite une alerte est deux révisions du **même** composeur.

**Ce qui manque n'est pas la donnée mais la trace** : le journal dit la police demandée et la réponse choisie, **pas les quatre options proposées**. On mesure donc les leurres **pris**, jamais les leurres **offerts et refusés** : le dénominateur manque. Deux façons d'y remédier, à trancher : enregistrer les options sur le fait, ou les recalculer depuis la graine et l'index de question, que le journal porte déjà. La seconde ne coûte aucune colonne.

### 4.6 Qualité et incidents — QUALITÉ FAITE, INCIDENTS PLUS TARD

Sept contrôles, chacun avec sa valeur attendue explicite, parce qu'un contrôle sans valeur attendue ne contrôle rien. Relevé du 2026-09-11, et il a trouvé du vrai :

- **1305 réponses rangées dans la partition par défaut.** La migration 011 déclarait les partitions de juin à décembre 2026 : **elle n'est pas appliquée en production**, qui s'arrête au 2026-06-01. Rien n'est perdu, la partition par défaut accepte tout, mais le découpage ne sert plus à rien depuis juin.
- **26 séances dont le compteur ne correspond pas au journal**, et **30 séances ouvertes depuis plus de 24 h**.
- **1139 clés d'idempotence gardées, la plus ancienne depuis 38 jours.** Rien ne purge cette table.
- **7 polices jouables seules dans leur groupe visuel** : le moteur n'a aucun voisin à leur proposer, leur question sera toujours plus facile qu'elle ne devrait.

**Un contrôle qui signale le fonctionnement normal est pire qu'aucun contrôle**, parce qu'on apprend à ne plus le lire : le contrôle « polices sans fichier déclaré » remontait 108 polices, c'est à dire exactement le kit Adobe, qui se rend par nom de famille et n'a pas de fichier chez nous. Il les exclut maintenant, et retombe à 0.

**Manque** : un journal d'incidents. Aujourd'hui les erreurs partent dans la console du serveur et nulle part ailleurs.

## 5. Ce qui n'a aucune donnée aujourd'hui, et qu'il ne faut pas dessiner

**Les Type Cards.** Le registre des contradictions de la vision le dit déjà : ni Reading Card ni Misread n'existent dans le runtime, et `content/type-cards/` est absent. Mesurer « une carte est elle suivie d'une meilleure réponse » n'est donc pas une vue en attente de données, c'est une vue en attente d'une fonctionnalité. Elle se spécifiera quand les cartes existeront, et pas avant.
