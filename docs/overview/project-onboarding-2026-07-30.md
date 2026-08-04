# DWIGGINS — Document d'accueil complet

> **Statut : document d'accueil, écrit le 2026-07-30. Aucune autorité normative.**
>
> Ce document **décrit** l'état du projet à cette date, il ne **décide** rien. Il ne remplace ni la vision produit (rang 1), ni la spec moteur (rang 2), ni l'architecture backend (rang 3), ni `docs/process/checklist.md` qui reste la source de vérité de l'avancement. En cas de contradiction avec l'un d'eux, ce sont eux qui font foi et ce document qui a tort.
>
> Il existe pour une seule raison : permettre à quelqu'un qui ne connaît pas DWIGGINS de comprendre le projet en entier, dans l'ordre, sans avoir à ouvrir 58 documents et à deviner lesquels sont encore valables.
>
> **Deux autres documents d'ensemble existent déjà** et ne sont pas remplacés : `project-overview-longform.md` (le concept, écrit en prose longue) et `getting-started.md` (le démarrage technique). Consolider les trois est une décision qui appartient au propriétaire du projet, elle n'est pas prise ici.

---

## Comment lire ce document

**L'ordre est voulu.** Il va du pourquoi vers le comment, jamais l'inverse : ce que le produit cherche à provoquer, puis ce que le joueur apprend à voir, puis la machine qui le lui enseigne, puis ce qu'il touche à l'écran, puis ce qui tourne derrière, puis la matière, puis la façon de travailler dessus. Lu dans cet ordre, chaque partie n'utilise que des notions déjà posées.

**Les statuts sont cités, jamais devinés.** Quand un document du projet déclare lui même être caduc, historique, ou sans autorité, c'est écrit ici avec sa formulation exacte. Quand un document ne déclare rien, c'est écrit aussi, parce que c'est une information.

**Ce qui manque est signalé.** La mention « non documenté » signifie que l'information n'existe pas dans les fichiers du projet, pas qu'elle n'a pas été cherchée.

**Les chiffres provisoires sont marqués comme tels.** Beaucoup de seuils du projet sont explicitement des points de départ à calibrer. Les citer comme définitifs serait une erreur.

### La hiérarchie documentaire, à connaître avant tout le reste

Décidée le 2026-07-29 pour une raison précise, citée : « empêcher que DWIGGINS ne dérive vers deux moteurs concurrents issus de deux documents différents ».

| Rang | Document | Ce qu'il définit |
|---|---|---|
| 1 | `docs/game/vision-produit-dwiggins.md` | les principes, et ce qui n'est pas négociable |
| 2 | `docs/game/training-engine-spec-v2-clean.md` | la traduction des principes en règles pédagogiques |
| 3 | `docs/game/architecture-backend.md` | où ces règles vivent techniquement |
| 4 | contrats d'API, specs d'interface, documents d'exécution | leur application |

« Un document de rang 4 qui contredit un document de rang 1 a tort, sans discussion. »

Les documents de recherche sont volontairement **hors** de cette chaîne : « ils **inspirent** le produit, ils ne le **gouvernent** jamais ». Le chemin de retour d'une idée de recherche vers le produit est obligatoire et sans raccourci : réévaluer au regard de la vision, reformuler si nécessaire, intégrer explicitement dans une spécification vivante de rang 2 ou 3, et alors seulement développer.

### Plan

1. Le produit, la vision, le modèle économique
2. Le système typographique, ce que le joueur apprend à voir
3. Le moteur de jeu
4. L'interface, les écrans et le parcours
5. Le backend, la base de données et l'API
6. Le catalogue et le dossier des licences
7. Comment le projet est fait et comment on y travaille
8. L'état réel au 2026-07-30 : ce qui bloque, ce qui est en suspens, ce qui se contredit

---

# Partie 1 — Le produit, la vision, le modèle économique

> Sources primaires : `docs/game/NIVEAU.rtf`, `docs/game/vision-produit-dwiggins.md`, `docs/overview/brief.md`, `docs/overview/project-overview-longform.md`, `docs/overview/business-model.md`, `docs/overview/partenariat-adobe.md`, `docs/overview/naming.md`.

## 1.1 Ce qu'est DWIGGINS

### Les deux noms du projet

Le projet porte deux noms dans la documentation, et il faut le savoir avant de lire quoi que ce soit.

- **Jeux de Typo V2** : le nom du dépôt et du produit dans les documents de cadrage général (`brief.md`, `project-overview-longform.md`, `business-model.md`).
- **DWIGGINS** : le nom utilisé dans les documents de vision et de jeu (`NIVEAU.rtf`, `vision-produit-dwiggins.md`), ainsi que dans l'expression « carte DWIGGINS ».

L'origine du nom DWIGGINS, sa signification et la décision de le retenir comme nom commercial : **non documenté**. `naming.md` ne traite pas du naming produit, uniquement des conventions de nommage du code (préférer `Gate`, `ScrollHint`, `gateCopy` à des noms génériques) et de la stabilité de l'arborescence.

### La mécanique visible, en une phrase

Le jeu affiche une typographie à l'écran (un mot composé dans cette police) et demande au joueur de reconnaître laquelle c'est, en QCM à quatre propositions.

### Pourquoi cette phrase ne suffit pas

`project-overview-longform.md` insiste : cette formulation ne décrit que « la mécanique visible la plus immédiate ». Deux documents refusent explicitement la réduction du produit à un quiz.

- `vision-produit-dwiggins.md` §1 : « DWIGGINS n'est pas un jeu de quiz. C'est un **moteur d'entraînement du regard**. »
- `NIVEAU.rtf`, préambule : « DWIGGINS n'est pas un cours de typographie. Ce n'est pas une liste de règles à réviser, ni un diplôme à décrocher. C'est un entraînement du regard. »

### Le problème adressé

Le constat de départ : nous vivons entourés de typographie et nous lisons en permanence, mais nous n'apprenons presque jamais à regarder consciemment la forme des lettres. « Nous lisons ce qu'elles disent, mais nous ne regardons presque jamais comment elles le disent. » Nous percevons bien un ton, une époque, une rigueur, une douceur, une tension, une modernité, « mais la plupart du temps sans savoir précisément d'où cela vient ».

`NIVEAU.rtf` donne la version joueur du même problème, avec la cause : « ton cerveau a passé toute ta vie à ignorer la forme des lettres pour aller au sens. C'est cette habitude qu'on va défaire, lentement, niveau après niveau. »

Le postulat qui fonde le produit : il existe un rapport à la typographie **qui peut être appris, exercé et entraîné**.

### Le déplacement d'attention, cœur du concept

Le concept est un **déplacement de l'attention**. Normalement l'œil lit le mot, le cerveau le comprend, on passe à autre chose. Dans le jeu, le mot reste mais change de rôle : « il n'est plus seulement là pour être lu, il devient un support permettant de voir une forme ».

L'identité visible d'une police se lit dans des détails concrets : la forme du a, l'ouverture du e, la largeur d'un o, la tension des courbes, l'axe d'un contraste, la rigidité ou la souplesse d'un dessin, la façon dont les lettres respirent entre elles, la hauteur apparente, les terminaisons, les transitions, la construction d'un rythme. Conclusion : « ce n'est pas seulement un jeu de connaissance, c'est un projet d'attention visuelle ».

### La promesse

Formulée par `NIVEAU.rtf`, c'est la promesse la plus haute du produit et elle est irréversible :

> « À la fin, tu ne pourras plus revenir en arrière. Un menu, une affiche de métro, un générique de film : tu verras des structures, des familles, des intentions, des signatures. Ton œil aura changé. C'est ça, le produit. Pas des points : une transformation. »

`brief.md` en donne la version courte et sobre, en anglais : « Jeux de Typo V2 is a calm, minimal, typographic learning experience », dont le but produit est « to train visual judgment through focused reading and comparison ».

### Pour qui

- `business-model.md` §1 (angle marché) : designers, étudiants en design, type designers, agences, plus « un cercle plus large de curieux créatifs ». Le document qualifie le créneau de **créneau étroit**.
- `project-overview-longform.md` (angle usage) : débutants curieux, étudiants en design, designers juniors, enseignants, écoles, passionnés de typographie, « voire des structures plus professionnelles ».
- `NIVEAU.rtf` §2.2 distingue deux profils à l'entrée : le « total débutant » qui démarre tout en bas de la carte, et « l'œil déjà exercé (designer, étudiant en arts graphiques) » qui voit certains axes préallumés et attaque plus haut.

`vision-produit-dwiggins.md` ajoute deux rôles qui ne sont pas des publics de jeu : **le professeur** (§5) et **l'opérateur du produit** (I-24), tenus juridiquement et techniquement distincts l'un de l'autre.

### Le backend est le produit

Décision structurante, `vision-produit-dwiggins.md` §1 :

- « Le backend n'est pas une API au service d'écrans : **c'est le cœur du produit**. » C'est lui qui décide quoi montrer, quand, pourquoi, comment adapter la difficulté, comment espacer les rappels, comment mesurer la progression, comment personnaliser le parcours.
- « **L'interface n'est qu'une représentation de cette intelligence.** Elle n'a aucune décision pédagogique à prendre. »
- Conséquence de méthode : « le frontend se construit **au-dessus** d'un moteur pensé, jamais l'inverse. Un écran ne fait pas évoluer le moteur, il expose ce que le moteur sait déjà faire. »

## 1.2 La vision pédagogique

### Ce qu'on entraîne exactement : une perception, pas des réponses

`NIVEAU.rtf` §1.1 : « La plupart des apps t'apprennent des réponses. DWIGGINS t'apprend une perception. Une réponse, tu la mémorises et tu l'oublies ; une perception, une fois installée, reste à vie. On ne te demande jamais de "connaître" une typo : on entraîne ton œil à la reconnaître, une compétence physique, presque sportive, du regard. »

`perceptual-progression-spec.md` résume la méthode en cinq mots retenus comme justes par la vision : « **allumé = généralisation, pas mémorisation** ».

### Une carte, pas un escalier

`NIVEAU.rtf` §1.2 : les 8 niveaux ne sont pas des marches numérotées mais « 8 manières de voir qui s'allument sur une carte, au rythme de ton œil ». Deux joueurs ne déverrouillent pas dans le même ordre. « La carte se remplit comme une constellation, pas comme une barre de chargement. »

Principe attaché : « **l'œil ne régresse jamais**. Une fois que tu sais voir une chose, tu la vois pour toujours. La carte ne fait donc que se remplir. »

### Une séance est temporaire, la progression est permanente

`vision-produit-dwiggins.md` §2, avec ses conséquences précises :

- l'élève répond à **autant de questions qu'il le souhaite** : aucune limite artificielle, aucun compteur de manches, aucune fin imposée ;
- **il décide quand s'arrêter**, l'arrêt est un geste volontaire ;
- à l'arrêt, un **bilan de séance** : durée, nombre de réponses, précision, typographies renforcées, nouvelles typographies découvertes, principales confusions, évolution de son pool. Ce bilan est un agrégat borné à la séance, calculé à la demande, qui « ne clôt rien, ne remet rien à zéro » ;
- **la progression pédagogique ne s'arrête jamais** : au retour, demain, dans une semaine ou dans un mois, le moteur reprend exactement où il s'était arrêté. Cooldowns, mastery, intervalles et répétition espacée continuent de vivre en arrière-plan, indépendamment des séances.

### Ce qu'il faut expliquer à l'entrée du mode

`vision-produit-dwiggins.md` §2.1 : l'élève ne vient pas jouer une partie, il vient entraîner son regard, « cela doit être dit à l'entrée du mode Entraînement, pas déduit ». Quatre points à faire comprendre :

1. il n'y a ni score à battre, ni temps à respecter ;
2. chaque bonne réponse espace les rappels, chaque erreur les rapproche ;
3. le moteur construit un parcours entièrement personnalisé, pour présenter chaque typographie au moment où le cerveau est le plus susceptible de l'oublier ;
4. l'objectif n'est pas de terminer une session mais de développer une compétence visuelle durable.

### La répétition espacée, et son pourquoi

`NIVEAU.rtf` §5.2 : « Si on te reposait tout de suite une typo ratée, tu mémoriserais la réponse, pas la forme. Alors on attend : elle revient plus tard, quand l'oubli rend le test honnête. »

Trois règles : une typo ratée ne revient jamais immédiatement, le pool bouge selon la performance et non selon un ordre figé, la répétition espacée prime sur tout le reste.

### La difficulté est perceptive, jamais arbitraire

« La difficulté idéale ne vient pas du bruit, du hasard ou d'un piège gratuit. Elle vient du fait que les mauvaises réponses deviennent de plus en plus proches de la bonne sur le plan visuel. » Trois régimes de distracteurs : très contrastés au début (poser des repères évidents), puis proches en famille, structure ou sensation, puis « réellement troublants » aux niveaux fins.

### Les garde-fous anti-frustration

`NIVEAU.rtf` §5.4, quatre garde-fous :

- une typo ratée déclenche d'abord la carte de confusion (on apprend le « tell ») avant de revenir, « adoucie » ;
- le pool s'ajuste pour ne pas enchaîner les échecs ;
- en cas de manque d'éligibles, la partie continue sans casser, « jamais d'écran vide » ;
- en Entraînement, pas de score visible, donc « pas de honte, pas de pression ».

### Le rôle du mot affiché

Le mot n'est pas là pour faire joli ni pour raconter quelque chose, il sert à montrer la typographie. Un mot trop émotionnel, trop reconnaissable, trop original, trop court ou trop chargé détourne l'attention vers le sens. On cherche donc des mots relativement neutres, portant un maximum d'informations typographiques utiles : le a pour ses contreformes, le e pour son ouverture, le o pour sa rondeur, le n et le i pour leurs verticales, le t pour sa structure, le s pour ses courbes complexes.

Désaccord documentaire tranché : la logique V4 gardait le mot **fixe pendant toute la session** pour éviter le bruit cognitif, des specs plus récentes prévoient une rotation. `vision-produit-dwiggins.md` §11 (contradiction 11) tranche : la spec moteur v2 et le code changent de mot **toutes les 5 questions** en entraînement, et c'est sur la v2 qu'il faut aligner.

### L'onboarding fait partie de l'apprentissage

L'onboarding « ne sert pas seulement à accueillir l'utilisateur ou à remplir une étape marketing », il installe un état d'esprit, un rythme, une première relation au regard. Étapes documentées : **welcome, pace, familiarity, micro, launch**. Deux intérêts : éviter de jeter brutalement l'utilisateur dans une logique de performance, et stocker des éléments de calibration réutilisables à la première carte. Le document précise que cette partie « n'est pas encore la plus profonde ou la plus finalisée ».

Côté joueur, `NIVEAU.rtf` décrit les deux premiers moments :

- §2.1 **les 60 premières secondes** : pas de tutoriel bavard, on montre deux typos volontairement opposées (un sans-serif neutre et un didone à fort contraste) et on demande seulement « laquelle te semble la plus dure, la plus tranchante ? ». C'est le premier « aha » : « tu viens de voir, pas de lire » ;
- §2.2 **le calibrage** : une courte série (provisoire, environ 8 à 12 questions, sans note ni pression) qui balaie les grandes familles et dimensions, pour situer l'œil de départ. « Personne ne perd son temps sur ce qu'il sait déjà. » En coulisses, le calibrage initialise la maîtrise de quelques typos témoins par dimension et positionne le point de départ sur la carte.

### Invité ou compte

`NIVEAU.rtf` §2.3 : on peut essayer en invité, sans inscription, « pour sentir le jeu », mais sans rien sauvegarder. Dès qu'on veut que la carte du regard se construise et se garde dans le temps, il faut un compte : « la progression long terme a besoin de mémoire ».

### Les moments de célébration

`NIVEAU.rtf` §5.5 : « la transformation doit se sentir ». Quand un axe s'allume, ce n'est pas un +1, c'est un **reveal** : la zone de la carte s'illumine et un message nomme ce que l'œil sait voir désormais (« Tu vois maintenant la structure »). « C'est rare, donc mémorable. » Autres moments cités : le passage d'une typo du QCM à l'Expert (« tu ne la reconnais plus, tu la nommes »), les paliers de streak, les badges.

### Vie privée comme choix pédagogique

`vision-produit-dwiggins.md` §4 traite la confidentialité non comme une contrainte légale mais comme une décision produit qui protège la pédagogie.

- Le compte élève est un espace **entièrement personnel** : pool actif, niveaux de maîtrise, erreurs, confusions, intervalles, statistiques, régularité, toute la progression.
- Ces données ne sont consultables **par aucun tiers, quel que soit son rôle**, ni professeur, ni administrateur d'école. Le professeur ne doit pas savoir combien de temps un élève s'est entraîné, combien de séances il a faites, quelles sont ses erreurs personnelles, ni s'il ne s'est pas entraîné pendant plusieurs jours.
- Le pourquoi : « l'élève doit pouvoir venir s'entraîner librement, sans se sentir surveillé ni évalué en permanence », ce qui fait « la différence entre un outil qu'on ouvre par envie et un outil qu'on subit ».
- **Aucun agrégat n'est exposé, même anonymisé** : à l'échelle d'une classe, une moyenne plus deux recoupements réidentifient une personne. « La règle est donc zéro lecture, pas lecture agrégée. »
- L'étanchéité doit être garantie **par l'architecture, pas par l'interface** : « une promesse portée par des écrans est violée le premier jour où quelqu'un ajoute un écran ». Le patron de référence existe déjà dans le repo, le garde-fou de licence posé dans la seule requête qui expose une typographie à un joueur.

### Le professeur assigne, il ne consulte pas

`vision-produit-dwiggins.md` §5 : le professeur prépare une **session pédagogique** (exercice, devoir, contrôle, activité ciblée), en choisit les typographies, le niveau de difficulté, le mode de jeu, le nombre de questions, éventuellement une durée ou une date limite, puis la publie à une classe. Dans ce contexte et seulement dans ce contexte, il consulte les résultats de ses élèves : qui a commencé, qui a terminé, la réussite, les erreurs principales, les confusions observées, les compétences travaillées, le temps passé sur cette session. Il ne voit jamais de données issues de l'entraînement libre.

Effet de bord voulu : puisque c'est le professeur qui choisit les typographies, « le jeu de questions ne révèle rien de l'état personnel de l'élève », contrairement à une sélection faite par le moteur sur le pool personnel.

### Les trois axes d'une session (mode, contexte, politique)

`vision-produit-dwiggins.md` §6, point d'architecture tranché « parce que le confondre coûterait cher plus tard ». Une session porte trois dimensions **indépendantes** :

| Axe | Valeurs | Question à laquelle il répond | État du schéma |
|---|---|---|---|
| **mode** | `training`, `competition`, `expert` | comment on joue | déjà porté (`sessions.mode`) |
| **contexte** | `personal`, `teacher_assignment` | à qui appartiennent les données, donc qui peut les lire | absent, doit être ajouté |
| **politique de progression** | `update_mastery`, `observe_only` | quel effet pédagogique la session produit | absente, doit être ajoutée |

Pourquoi trois et pas deux : un professeur peut publier un devoir en mode compétition et un élève peut jouer une compétition pour lui seul, donc le mode ne détermine pas le contexte. Et surtout, « un entraînement assigné et un contrôle assigné partagent le même contexte mais n'ont pas le même effet ».

Deux règles d'attache :

- « **La règle de confidentialité s'attache au contexte, jamais au mode.** »
- « **L'effet pédagogique s'attache à la politique, jamais au contexte.** » La politique est une donnée explicite de la session, décidée à sa création, jamais déduite du contexte et jamais décidée par le frontend.

Politiques par défaut (§6.1) : `training` en `update_mastery`, `competition` en `observe_only` (**imposé, sans exception possible**), `expert` « à décider explicitement », futurs modes professeur « à décider explicitement selon leur fonction ».

La séparation doit être garantie à trois niveaux, pas un : **le schéma**, **les autorisations**, **les requêtes**.

### Ce que chacun voit

Tableau de `vision-produit-dwiggins.md` §7 :

| Donnée | Élève | Professeur | Moteur |
|---|---|---|---|
| Mastery brut par typographie | Non, uniquement traduit | Non | Oui |
| Pool actif, intervalles, prochaines échéances | Traduit | Non | Oui |
| Confusions issues de l'entraînement libre | Oui | Non | Oui |
| Régularité, temps passé, séances en entraînement libre | Oui | Non | Oui |
| Carte DWIGGINS, axes et paliers | Oui, représentation principale | Non | Vue dérivée |
| Niveau Dreyfus N.1 à E.5 | Non affiché comme note | Non | Oui, variable de commande |
| Résultats d'une session assignée | Oui | Oui, borné à cette session | Oui |
| Confusions observées dans une session assignée | Oui | Oui, borné à cette session | Oui |
| XP, combo, jetons, arène | Oui | Non | Non, jamais consommé |

## 1.3 Les 8 manières de voir (les axes de la carte)

`NIVEAU.rtf` Partie IV décrit huit niveaux, chacun avec un « glissement » qui s'opère dans l'œil du joueur. `perceptual-progression-spec.md` §2 donne l'identifiant technique et la source de données de chaque axe.

| # | `id` | Libellé joueur | Le glissement | Statut data |
|---|---|---|---|---|
| 1 | `shape` | Voir la forme | On arrête de lire le mot, on regarde sa forme : silhouette, masse, profil de hauts et de bas, densité. « Première rupture, la plus difficile, parce qu'elle va contre tout ce que l'école t'a appris. » Indices : ligne des ascendantes (b, d, h, k, l) et des descendantes (g, j, p, q, y), densité générale, rythme des verticales. | live, par proxy |
| 2 | `families` | Voir les familles | Les typos se rangent en familles cohérentes : Sans-serif, Serif (humanes, transitionnelles, didones, mécanes), Scriptes, Monospace, Display. L'axe s'allume quand on classe correctement des typos **jamais vues**, « preuve que tu as compris le système, pas mémorisé des exemples ». | live (`primary_category`, `sub_category`, `visual_cluster_id`) |
| 3 | `structure` | Voir la structure | On voit comment les lettres sont construites : l'ouverture, le contraste, l'axe, les terminaisons, la hauteur d'x et les proportions. Se travaille par comparaisons ciblées isolant un levier à la fois. « Un faisceau de sous-compétences, il s'allume levier par levier. » | live (`structural_signature.*`) |
| 4 | `rhythm` | Voir le rythme | On passe de la lettre à la ligne et au bloc : cadence des verticales (le « peigne » des n, m, i, u), espacement, couleur typographique. S'allume quand on perçoit la couleur et la cadence d'un bloc **sans lire son contenu**. | partiel |
| 5 | `signatures` | Voir les signatures | Du général au singulier : chaque typo a des tics qui la trahissent (a et g à un ou deux étages, g binoculaire de Garamond contre g simple de Futura, queue du Q, jambe du R, oreille du g, barre du e, point du i rond ou carré, éperon du G, apex du A). | live |
| 6 | `confusion` | Voir la confusion | « Le niveau le plus puissant : il transforme tes erreurs en armes. » Le seul détail qui départage deux sosies : Helvetica contre Arial, les géométriques entre elles, les innombrables Garamond. S'allume « quand tu cesses de tomber dans les pièges connus ». | live, cœur moteur |
| 7 | `intention` | Voir l'intention | On ne voit plus seulement comment une typo est faite mais **pourquoi elle existe** : adéquation forme et usage. Mécaniques candidates : « Match the brief », « Quel usage ? ». | **roadmap**, champ usage à ajouter |
| 8 | `designer` | Voir comme un designer | Stade final : micro-variations invisibles au grand public, nommées instantanément. Mécaniques candidates : « Trouve l'intrus », « Original ou révision ? ». | **roadmap** |

Point de vocabulaire : le document joueur numérote ces huit entités « niveaux » tout en affirmant qu'elles ne sont pas des marches, et le modèle implémentable les appelle **axes**. C'est le mot « axe » qui gouverne les seuils et le vocabulaire de la carte.

## 1.4 Les concepts propres au projet

**La carte du regard (aussi « carte DWIGGINS », aussi « le serpent »).** Représentation visuelle de la progression personnelle. Huit axes qui s'allument par seuils, dans un ordre personnel à chaque joueur. Elle répond à la question « qu'est-ce que mon œil sait voir maintenant » et la vision la désigne comme **la représentation principale visible par l'élève** et « le cœur émotionnel du produit ». Elle ne fait que se remplir. C'est une **vue dérivée**, jamais une donnée stockée. La progression s'emboîte en **palier vers axe vers œil**.

**Les deux couches : l'Œil et l'Arène.** **L'Œil** est la progression personnelle, « toi contre toi », ça ne fait que monter, « c'est ton identité ». **L'Arène** est la compétition, « toi contre les autres », ça monte et ça descend, « c'est ta rivalité ». Les deux « ne se concurrencent pas, elles se nourrissent : l'œil que tu entraînes devient l'arme que tu amènes dans l'arène ». Elles sont **étanches**.

Le pourquoi de la séparation : « la progression de l'œil est personnelle et non-linéaire, deux joueurs ne sont jamais au même endroit. On ne peut donc pas les faire s'affronter là-dessus. La compétition a besoin d'une échelle commune et normalisée. » Modèles de référence assumés : **Call of Duty** (progression perso plus ranked à MMR caché) et **Duolingo** (parcours perso plus ligues hebdomadaires).

Le **volant d'engagement** : « je m'entraîne, mon œil progresse, je performe mieux dans l'arène, la rivalité me motive, je m'entraîne plus ».

**La maîtrise (mastery).** Niveau invisible, propre à chaque joueur, de fiabilité de sa reconnaissance d'une typographie donnée. Il monte quand on reconnaît correctement, et d'autant plus vite qu'on le fait rapidement et de façon répétée dans le temps : « un coup de chance ne suffit pas ». Échelle **0 à 4** : 0 jamais vue, 1 vue mais ratée, 2 reconnue une fois, 3 reconnue plusieurs fois, 4 mieux installée dans la mémoire récente. Le mastery brut n'est **jamais affiché comme une note**.

**Le pool (pool actif).** Ensemble des typographies actuellement en travail pour un joueur, dimensionné pour que l'apprentissage reste « dense mais pas écrasant ». Taille cible selon le palier Dreyfus : **30 en N et D, 32 en C, 34 en A, 36 en E**. Règle d'entrée (invariant I-07) : une nouvelle typo entre dès que **3 typographies différentes atteignent mastery 4**, une seule à la fois. Une typographie n'est **jamais retirée** du pool ni du système (invariant I-06).

**Misread (carte de mé-lecture, carte de confusion).** Carte pédagogique déclenchée par une erreur, qui montre la paire de confusion et le détail discriminant. Contenu minimal spécifié : `kind`, `typeface_slug`, `display_name`, `visual_instruction` (120 caractères maximum), `display_word`, `confusion_note` (100 caractères maximum). Déclenchement spécifié sur la classification `full_error_first_wrong`.

État réel, essentiel à connaître : **la Misread n'existe pas dans le runtime**. La vision §11 (contradiction 12) qualifie de « factuellement faux » le passage de `game-unified-spec-v1.md` §10.5 qui annonce la Reading Card implémentée, et précise « aucune des deux n'existe dans le runtime, `content/type-cards/` est absent ».

**Type Cards.** La famille de cartes dont Misread fait partie. Deux familles prévues (`reading`, `misread`) mais la spec moteur v2 restreint la V2 aux cartes de correction uniquement. Contenus prévus comme **données statiques versionnées** dans `content/type-cards/*.json`. Durée `TYPE_CARD_DURATION_MS` = 3500 ms. Contradiction ouverte : `game-v4-executable-spec.md` §7.1 dit que la carte bloque le jeu, la spec moteur §6.3 dit non bloquante.

**Le niveau Dreyfus (N.1 à E.5).** « Une **variable de commande interne du moteur**, pas une note. » Ce n'est pas une opinion, c'est une contrainte de code : `users.dreyfus_level` pilote deux mécanismes, le filtre des nouvelles typographies candidates dans `try_unlock_one_typeface` (`dreyfus_tier <= dreyfus_level`) et la taille cible du pool actif. « Le supprimer du système casserait le déblocage et la croissance du pool. Il peut donc disparaître de l'affichage, il ne peut pas disparaître du moteur. » Cinq paliers **N, D, C, A, E** portés par `users.dreyfus_level`, plus un sous-niveau **1 à 5** porté par `users.dreyfus_sub`. Le développement complet des lettres : **non documenté**.

Formule qui règle la question : « le niveau Dreyfus décide **de la difficulté de ce qu'on sert**, la carte montre **ce que le regard a acquis**. Les deux dérivent des mêmes faits, aucun n'est stocké comme une vérité indépendante. »

**Une seule vérité pédagogique.** Les faits stockés, et eux seuls : le **mastery par couple (utilisateur, typographie)** avec son état de répétition espacée, et le **journal d'événements**, une ligne par réponse, append-only. « Tout le reste est une vue dérivée, recalculée à la lecture. » Règle d'or : « **on stocke les faits, on recalcule les dérivés**. Aucun compteur pédagogique parallèle, car un compteur stocké finit toujours par diverger de la réalité qu'il prétend résumer. » Un cache de dérivé reste permis s'il est intégralement reconstructible depuis les faits.

**La couche d'engagement.** XP, combos, jetons, arène et classement peuvent exister pour l'élève, mais comme **couche d'engagement, pas seconde vérité pédagogique**.

**Les trois modes de jeu.**

- **Entraînement (l'Œil)** : le mode principal. QCM 4 choix, **pas de score visible**, répétition espacée active. C'est là que la carte se construit. « Tu peux réessayer, tu n'es jamais puni. »
- **Compétition (l'Arène)** : durée fixe de **2 minutes**, QCM 4 choix, **pool global** pour que tout le monde soit comparable. Bonne réponse = 1 point, bonne réponse en moins de 2 secondes = 2 points. Le score n'influence pas la progression de l'œil.
- **Expert (la preuve par le mot)** : plus de QCM, le joueur **tape le nom**. « C'est la différence entre reconnaître et nommer. » Jugement : réponse normalisée, casse et accents ignorés, **seuls des alias validés sont acceptés**. Ouverture conditionnelle : une typo passe en Expert quand elle est déjà maîtrisée en reconnaissance, et certaines typos trop proches de sosies restent volontairement hors Expert au début (`expert_enabled` et `min_mode` dans `typefaces_core`).

**Les trois recettes de classement de l'Arène**, cumulables : **Ligues façon Duolingo** (points de la semaine, Bronze à Diamant, reset hebdomadaire, environ 30 joueurs par division, top 7 montent et bottom 5 descendent), **matchmaking ELO façon COD**, **duels sur série identique** (mêmes typos, même ordre).

**Les titres d'œil**, récompense permanente qui mûrit : Œil novice, Œil curieux, Œil exercé, Trained eye, Œil de designer. Le niveau d'XP actuel « se fond dans l'Œil (un titre qui mûrit), plutôt que de devenir un système de plus ».

## 1.5 Lexique

**Alias validés** : liste versionnée des orthographes acceptées pour nommer une typo en mode Expert. Rien hors liste n'est accepté.

**Approche (interlettrage)** : espacement entre les lettres, indice de l'axe Rythme.

**Ascendante / descendante** : partie d'une lettre au-dessus de l'œil (b, d, h) ou sous la ligne de base (g, p, y).

**Axe (au sens carte)** : une des 8 manières de voir, qui s'allume par seuils.

**Axe / stress (au sens typographique)** : inclinaison du contraste, oblique (humanes) ou vertical (didones).

**Bilan de séance (`session_summary`)** : agrégat borné à la séance, calculé à la demande à l'arrêt volontaire de l'élève. Il ne clôt rien et ne remet rien à zéro.

**Blason** : le visuel du rang d'Arène (Bronze à Diamant) sur la page profil, tenu **séparé** du serpent.

**Bouma** : silhouette globale d'un mot, perçue avant la lecture lettre à lettre. Matière de l'axe 1.

**Chasse** : largeur d'une lettre. Identique pour toutes = monospace.

**Cluster visuel (`visual_cluster_id`)** : groupe de sosies, source de données de l'axe Familles.

**Compare-stage** : format d'exercice de comparaison qui isole un levier structurel à la fois.

**Contexte (de session)** : `personal` ou `teacher_assignment`. Dit à qui appartiennent les données et donc qui peut les lire. La confidentialité s'attache au contexte, jamais au mode.

**Contraste / modulation** : écart entre pleins et déliés. Faible = monolinéaire, fort = didone.

**Couleur typographique** : valeur de gris d'un bloc de texte vu en plissant les yeux.

**Cooldown** : délai minimal avant le retour d'une typographie. Valeur provisoire pour une typo ratée : environ 10 questions **et** environ 24 heures, le plus tardif des deux.

**ELO / MMR** : score caché de niveau, utilisé pour opposer des joueurs comparables.

**Empattement (serif)** : petit pied au bout des traits. Absent = sans-serif.

**En coulisses** : nom des encarts de `NIVEAU.rtf` qui expliquent le fonctionnement côté système, par opposition au corps du texte écrit du point de vue du joueur.

**Hauteur d'x (x-height)** : hauteur des minuscules sans ascendante. Grande = allure moderne, lisible en petit.

**Invariant** : règle non négociable, numérotée, qui doit être **vérifiable par requête**. I-01 à I-14 dans la spec moteur, I-15 à I-24 ajoutés par la vision.

**Jetons** : monnaie qu'on **dépense** (et non une jauge de progression), pour geler un streak, prendre un indice, acheter du cosmétique.

**Jour de grâce** : filet anti-rage-quit sur le streak, 1 gratuit par semaine, d'autres achetables en jetons.

**Mode** : `training`, `competition`, `expert`. Dit **comment** on joue, rien d'autre.

**Objectif du jour** : cible quotidienne provisoire, environ 15 bonnes réponses ou environ 5 minutes.

**Ouverture (aperture)** : taille de l'entrée des lettres ouvertes (c, e, s, a). Ouverte = chaleureux, lisible ; refermée = neutre, dense.

**Palier** : subdivision d'un axe, qui s'allume par seuils, et dont l'allumage nourrit celui de l'axe.

**Politique de progression** : `update_mastery` ou `observe_only`. Dit si les réponses modifient l'état pédagogique personnel. Écrite explicitement sur la session, jamais déduite.

**Pool global** : pool commun utilisé en Compétition pour rendre les scores comparables, par opposition au pool actif personnel.

**Répétition espacée** : réapparition différée d'une question « pour graver la perception, pas la réponse ». Intervalles provisoires de style Leitner dans le document joueur : 1 jour, 3 jours, 7 jours, 21 jours, 60 jours. À ne pas confondre avec le moteur implémenté, qui travaille en **intervalles en questions**.

**Reveal** : le moment où une zone de la carte s'illumine et où un message nomme ce que l'œil sait voir désormais.

**Serpent** : le visuel de l'Œil sur la page profil. Il ne fait que se remplir.

**Signature structurelle (`structural_signature`)** : jeu de champs décrivant une typo (`a_type`, `e_aperture`, `axis`, `contrast`, `terminals`, `serifs`, `x_height`, `fixed_width`, `width`, `caps_only`, `distinctive_w`).

**Streak** : nombre de jours consécutifs où l'objectif du jour a été atteint. Paliers fêtés : 3, 7, 30, 100, 365 jours. Appartient à l'Œil : « il récompense l'assiduité, pas la performance ».

**Tell** : le détail unique qui trahit une typo ou départage deux sosies.

**Terminaison** : fin d'un trait : empattement, goutte (ball terminal), coupe nette.

**Toast de franchissement** : signal ponctuel qui célèbre le passage d'un cap.

## 1.6 Le ton et le parti pris éditorial

### Le ton du document joueur

`NIVEAU.rtf` est écrit **du point de vue du joueur**, au tutoiement. Les explications système sont reléguées dans des encarts « En coulisses ». Les valeurs chiffrées sont explicitement signalées « provisoire » et présentées comme « des points de départ à calibrer ».

Marqueurs de ton relevables directement dans le texte : affirmations en négatif pour poser le produit (« n'est pas un cours », « pas un diplôme », « n'est pas un jeu de quiz ») ; vocabulaire physique et sportif (« une compétence physique, presque sportive, du regard ») ; métaphores tenues, jamais décoratives (la carte, la constellation opposée à la barre de chargement, les continents des familles, le peigne pour le rythme, l'arme qu'on amène dans l'arène) ; promesse d'irréversibilité comme argument de vente ; refus explicite de la honte.

### La lucidité comme parti pris

`NIVEAU.rtf` Partie IX est intitulée « La réalité du contenu » et s'ouvre sur « lucidité indispensable ». Chiffres cités : **environ 28 typos validées** aujourd'hui pour une **cible de 1000+**. « Le récit en 8 axes est largement en avance sur le catalogue. »

La règle qui en découle : « **la carte du regard grandit avec le catalogue**. On n'allume un axe que si le catalogue contient assez de typos pour le prouver. Promettre un voyage perceptif complet avec 28 typos sonnerait creux, et tuerait la promesse. **La narration doit suivre le contenu, jamais l'inverse.** »

Le même registre traverse `project-overview-longform.md`, qui décrit l'état du projet comme « un système déjà riche, déjà structuré, déjà très réel, mais encore en cours d'alignement », et énumère quatre risques naturels : **la dispersion**, **la confusion de niveaux** (certains documents parlent du concept, d'autres de l'implémenté, d'autres d'une cible future), **la complexité silencieuse**, **le risque documentaire**.

### Le parti pris visuel

`brief.md` en trois lignes : expérience « calm, minimal, typographic » ; but produit « train visual judgment through focused reading and comparison » ; système visuel qui « favors clarity over decoration, with strict responsive behavior on all screens ».

Le minimalisme est justifié par la pédagogie : « dans un projet centré sur la perception, le bruit visuel affaiblit immédiatement le sens. Si les transitions sont trop décoratives, si les feedbacks sont mal dosés, si la hiérarchie est floue, si les zones d'attention se multiplient, alors le regard se disperse et le projet perd sa force. » Le timing est traité comme pédagogique et non cosmétique : « un feedback trop rapide ne laisse pas le temps de voir ce qui vient de se passer, un feedback trop lent casse le rythme ».

### Ce que le ton refuse

Le toast « célèbre une évolution réelle du regard, pas la montée d'un chiffre ». Formulations qualitatives données en exemple : « votre regard progresse », « vous venez de franchir un nouveau palier », « votre maîtrise évolue ». Interdits attachés : « aucun compteur mis en avant, aucune mécanique de gamification classique, et une apparition **rare** ».

Vocabulaire imposé par I-24 : « tant que les événements restent techniquement rattachables à un compte, on écrit **pseudonymisé**, jamais "anonymisé" ».

## 1.7 Les décisions figées et ce qui reste ouvert

### Le statut du document de vision

`vision-produit-dwiggins.md`, daté du **2026-07-29**, porte le statut « **vision figée par le propriétaire du projet. Document de rang supérieur** ». En cas de contradiction avec un autre document du repo, c'est lui qui fait foi. Il ne remplace pas `training-engine-spec-v2-clean.md`, qui reste la source de vérité du **fonctionnement** du moteur ; la vision ajoute **I-15 à I-24**.

### Les décisions datées

| Date | Décision | Référence |
|---|---|---|
| 2026-07-29 | **Le plafond automatique de huit questions doit disparaître.** Le `TRAINING_TOTAL_ROUNDS` du code actuel est « incompatible avec le mode Entraînement ». « Ce n'est plus un point à arbitrer. » | §2 |
| 2026-07-29 | **Le moment de franchissement : on le garde, on le transforme** (arbitrage B). Le toast n'est ni supprimé ni conservé tel quel. Il n'est pas un « level up » de jeu vidéo, cela ferait du niveau Dreyfus un objectif visible concurrent de la carte, mais on ne le supprime pas parce qu'il porte « une vraie récompense émotionnelle ». Répartition finale : niveau Dreyfus pilote le moteur en interne, carte DWIGGINS montre la progression, toast célèbre ponctuellement et qualitativement. | §8.1 et §12.B |
| 2026-07-29 | **Analyses internes : résolu** (arbitrage A), à condition de distinguer clairement **le professeur** de **l'opérateur du produit**. « La confidentialité interdit toute lecture institutionnelle de l'entraînement personnel, elle ne doit pas rendre impossible l'amélioration scientifique et produit de DWIGGINS. » Régime inscrit en I-24. | §12.A |
| 2026-07-29 | **Statut de la math spec v3.1 : résolu, « et plus profondément qu'un statut »** (arbitrage C). `scoring-and-selection-math.md` « ne décrit pas un ancien état du moteur, il décrit **une autre philosophie pédagogique** » : boîtes, sessions bornées, examens de promotion, progression par niveaux d'XP, contre maîtrise continue, répétition espacée, progression sans fin. « Les deux ne peuvent pas coexister comme sources de vérité. » Décision : la math spec devient un document de recherche, sort de la hiérarchie documentaire et **perd toute autorité sur l'implémentation**. Deux documents perdent leur autorité **par ricochet** : `scoring-implementation-contract.md` et la règle du §0 de `handoff-page-parcours.md`. | §12.C, §13 |
| 2026-07-29 | **Hiérarchie documentaire décidée**, avec chemin de retour obligatoire d'une idée de recherche vers le produit. | §13 |
| 2026-07-29 | **Type Cards : parké volontairement** (arbitrage D). « Ce n'est pas une hésitation, c'est un refus de geler prématurément. » | §12.D |
| 2026-07-29 | **Registre des contradictions documentaires**, 13 entrées, obtenu en balayant `docs/game`, `docs/process`, `docs/overview` et `docs/ui`, avec pour objectif qu'il ne reste « **qu'une seule vision cohérente** dans le projet ». | §11 |

### Ce qui reste ouvert

**Type Cards, parké volontairement.** Éléments d'orientation déjà exprimés, à reprendre le jour de la décision sans les considérer comme arrêtés : préférence pour une Misread **courte et bloquante**, déclenchement **sélectif** et non après chaque erreur, famille `reading` hors périmètre tant que sa fonction n'est pas prouvée.

Ce que la reprise devra trancher : la spec moteur affiche la Misread au premier faux clic, **pendant que la question reste ouverte au retry**, ce qui n'a de sens qu'avec une carte non bloquante. Une carte bloquante impose de choisir entre l'afficher **avant** le retry (le plus pédagogique mais « elle souffle la seconde tentative ») ou **après** la résolution de la question. Ce choix touche le contrat d'API, les états d'interface et la mesure de `misread_effectiveness`.

Ce qui **ne dépend pas** de cet arbitrage et ne doit pas attendre : « la télémétrie mentit déjà. Le déclencheur écrit `misread_shown = true` alors qu'aucune carte n'existe. Le jour où les cartes arriveront, l'historique sera inexploitable pour mesurer leur effet. Corriger la véracité de la trace ne demande aucune décision produit. »

Autres points explicitement ouverts :

- **Le sort du toast de niveau** : le calcul interne reste, « le sort du toast est à trancher dans le document d'architecture ».
- **La politique de progression du mode `expert`** : « à décider explicitement », avec la mention « ne pas laisser au hasard ».
- **Les politiques des futurs modes professeur** : « à décider explicitement selon leur fonction ».
- **Le libellé Dreyfus visible** : « s'il devait apparaître un jour, ce serait comme une synthèse discrète et secondaire, jamais comme le score de l'élève ».
- **Les axes 7 et 8** : sur la roadmap, mécaniques candidates à concevoir, et pour l'axe 7 un champ **usage** reste à ajouter en base.
- **L'axe `structure` agrégé ou décomposé** : question ouverte, avec une recommandation mais pas de décision.
- **Tous les seuils chiffrés** de `NIVEAU.rtf` sont marqués « provisoire, à calibrer ».
- **Passages encore à réécrire** relevés au §11 : `classes-comptes-spec.md`, `handoff-page-parcours.md` §87 (le HUD), `scoring-implementation-contract.md` §1, `game-unified-spec-v1.md` §54 et `ui/front-ui-master-spec.md` §39 (le « Play again »), `game-unified-spec-v1.md` §10.5.
- **Incohérence chiffrée non signalée par les documents** : `NIVEAU.rtf` §5.3 fixe l'allumage d'un palier à environ 80 pour cent de réussite récente **et au moins 5 typos maîtrisées**, tandis que la Partie IX renvoie à « un minimum de **8** typos par dimension en §5.3 ». Les deux chiffres sont dans le même document.

### Seuils provisoires de référence

À connaître, à ne jamais citer comme définitifs.

| Mécanisme | Valeur provisoire |
|---|---|
| Typo « maîtrisée » | cran 4 (réussie plusieurs fois, dont en difficile, sans coup de chance) |
| Un palier s'allume | environ 80 pour cent de réussite récente, et au moins 5 typos maîtrisées |
| Un axe s'allume | quand environ 70 pour cent de ses paliers sont allumés |
| Intervalles de répétition (Leitner, doc joueur) | 1 j, 3 j, 7 j, 21 j, 60 j |
| Retour d'une typo ratée | pas avant environ 10 questions **et** environ 24 h |
| Passage en Expert | typo maîtrisée en reconnaissance, plus aucune ambiguïté de sosie non résolue |
| Objectif du jour | environ 15 bonnes réponses, ou environ 5 minutes |
| Streak | +1 par jour atteint, remis à 0 si un jour est manqué |
| Compétition | 2 min, 1 pt par bonne réponse, 2 pts si moins de 2 s |
| Ligues | environ 30 joueurs par division, top 7 montent, bottom 5 descendent |
| Taille cible du pool | 30 en N et D, 32 en C, 34 en A, 36 en E |

Avertissement de lecture : les intervalles en **jours** viennent du document joueur et du modèle Leitner, alors que le moteur implémenté travaille en **mastery 0 à 4 avec des intervalles en questions**. Ne pas prendre les jours pour le comportement du moteur actuel.

## 1.8 Ce que la vision interdit explicitement

### Les dix interdits de la vision produit

1. **Aucune seconde vérité pédagogique.** L'XP, les combos, les jetons, l'arène et le classement sont une couche d'engagement. Trois interdits « sans exception » (invariant I-19) : ils n'influencent **jamais** le moteur pédagogique, ils ne sont **jamais** une preuve de compétence, ils ne sont **jamais** visibles par le professeur.
2. **Interdiction d'un HUD qui affiche un LVL et une barre d'XP comme mesure du regard.** `handoff-page-parcours.md` §87 propose « TRAINED EYE · LVL 7 · 320/700 XP · streak ». Verdict : cela « présente l'XP comme la mesure du regard », contredit I-18 et I-19. À réécrire.
3. **Interdiction de ranger l'engagement parmi les faits pédagogiques.** `scoring-implementation-contract.md` §1 range `xp_total`, `streak`, `coins`, `arena` parmi les faits stockés, « au même rang que la maîtrise ». Résolution : deux stockages distincts.
4. **Interdiction de tout compteur pédagogique parallèle.** « Un compteur stocké finit toujours par diverger de la réalité qu'il prétend résumer. »
5. **Interdiction d'un compteur de questions qui termine une séance** (invariant I-17). Une séance se termine par une **décision de l'élève**. Conséquences : le plafond `TRAINING_TOTAL_ROUNDS` doit disparaître, et le bouton « Play again » est interdit, à remplacer par « terminer ma séance » suivi du bilan.
6. **Interdiction d'afficher le mastery brut comme une note** (invariant I-18), ni à l'élève ni au professeur.
7. **Interdiction de faire du niveau Dreyfus une note** (invariant I-20).
8. **Interdiction absolue de toute lecture institutionnelle de l'entraînement libre** (invariant I-15). « Aucune exception, aucun agrégat, **même pseudonymisé**. » Corollaires : la lecture professeur est bornée aux événements d'une session assignée qu'il a publiée sur sa propre classe (I-16) ; même quand une session assignée nourrit la mémoire de l'élève, le professeur ne voit ni le mastery global, ni le pool, ni le déplacement produit (I-23) ; les analyses internes de l'opérateur ne sont **jamais** accessibles au professeur ni à l'école et **jamais utilisées pour évaluer un élève** (I-24).
9. **Interdiction pour un professeur de façonner le pool personnel** (invariant I-21). « Une assignation est **une session**, jamais une mutation du pool personnel. »
10. **Interdiction pour le frontend de prendre une décision pédagogique** (I-10 étendu, I-22). `game-v4-executable-spec.md` §3.1 et §9 (« at session start, **front** must derive `activeTypefacePool` ») sont un vestige de la phase front-only, à marquer comme historiques.

Interdit supplémentaire (I-22) : la compétition est **toujours** `observe_only` sur le mastery, « en personnel comme en assigné », imposé sans exception possible.

### Les interdits venus du document joueur

- **Interdiction de reposer immédiatement une typo ratée** : « tu mémoriserais la réponse, pas la forme ».
- **Interdiction d'un score visible en Entraînement.**
- **Interdiction de mélanger l'Œil et l'Arène dans un même visuel**, avec l'argument qui tranche : « le serpent ne fait que se remplir, alors qu'un rang Bronze à Diamant monte **et** descend. Deux dynamiques opposées ne peuvent pas partager le même visuel, sinon ton œil régresserait quand tu perds en compétition, ce qui est absurde. »
- **Interdiction d'empiler les systèmes** : à chaque couche un seul visuel, une seule métrique, un seul sens.
- **Interdiction de la progression linéaire par chapitres.** Note importante : « les titres de chapitres actuels recoupent déjà les axes, c'est surtout la structure linéaire qu'il faut faire sauter, pas le contenu ».
- **Interdiction de fausse jauge sur ce qui n'existe pas.**
- **Interdiction d'allumer un axe que le catalogue ne peut pas prouver.**
- **Interdiction de l'à-peu-près en mode Expert.**
- **Interdiction de l'écran vide** : en cas de manque d'éligibles, « la partie continue sans casser ».
- **Interdiction du tutoriel bavard** : on fait ressentir la différence avant de l'expliquer.
- **Interdiction pour la régression d'exister côté Œil.**

### L'interdit juridique, absolu

`partenariat-adobe.md` §6 : « Règle absolue à tenir en toutes circonstances : **on affiche des images, jamais des fichiers de police non licenciés**. » Plus : « Alphabet complet interdit pour les commerciales, mot-spécimen OK. » Et §1 : « Le fichier de police est un logiciel protégé, interdit de le posséder ou l'héberger sans licence. »

## 1.9 Le modèle économique

Source : `docs/overview/business-model.md`, qui se présente lui-même comme un « document de travail. Première version posée pour cadrer la réflexion, à affiner après la veille marché ». Rien dans ce document n'est présenté comme figé.

### La réalité du créneau

Le créneau est **étroit**. Constat formulé en gras dans le document : « **les jeux de typo connus sont tous gratuits** ».

- **Method of Action** (Kerntype, Shape Type, Type Connection) : outils gratuits, pensés comme acquisition et vitrine.
- **Typewolf**, **I Love Typography**, **Fonts In Use** : monétisent **ailleurs**, par affiliation fontes, guides premium, partenariats foundry, éditorial.

Conclusion : « **personne ne vit d'un jeu de reconnaissance typo vendu en direct au grand public**. Pour faire du chiffre, il faut soit brancher le jeu sur quelque chose de monétisable, soit viser le B2B. »

### Les trois pistes

**Piste A, funnel gratuit plus affiliation fontes.** Le jeu reste gratuit. Chaque typo reconnue devient un point d'entrée « découvrir / acheter cette police » (MyFonts, Adobe Fonts, foundries en affiliation). Logique : « le produit qui apprend à reconnaître les fontes est le meilleur endroit pour en vendre ». Revenu direct faible, friction quasi nulle.

**Piste B, Pro freemium en D2C.** Gratuit : training plus progression. Pro à **environ 4 à 6 euros par mois ou environ 39 euros par an** : mode competition et leaderboards, mode expert, catalogue complet, analytics riches. Risque explicitement posé : « niche potentiellement trop petite pour un abonnement D2C autonome, à valider par la veille ».

**Piste C, B2B éducation, « le vrai moteur de chiffre ».** Écoles de design, bootcamps, agences. Licence par siège, ACV élevé, peu de clients nécessaires. Le document conclut : « c'est le chemin le plus défendable pour monétiser de l'entraînement typo spécifiquement ».

Point de tension à signaler : la formulation de la piste C (« le suivi par joueur, déjà en base », tableau de bord de classe) doit être relue à la lumière de la vision §4 et §5, qui interdisent absolument toute lecture professeur de l'entraînement libre. Le §11 traite ce conflit : les vues par élève, par classe et par cohorte ne sont « recevables **uniquement** si la source est restreinte aux sessions assignées ». `business-model.md`, plus ancien (24 juin), ne porte pas cette restriction. La vision étant de rang 1, c'est elle qui gouverne.

### La recommandation

« **Free (funnel plus affiliation), puis Pro (D2C), puis B2B éducation comme vrai moteur.** » Les trois réutilisent la même base déjà construite : catalogue, sessions, progression, analytics competition.

La priorité dépend d'une décision **d'ambition non tranchée** : « side-project élégant qui s'autofinance » (priorité affiliation plus Pro léger) contre « vraie boîte à faire grossir » (priorité B2B éducation).

### Ce que le build supporte déjà

| Brique existante | Usage business |
|---|---|
| Comptes, sessions, progression par typo (PostgreSQL) | socle d'un Pro et d'un dashboard prof |
| Competition plus analytics de session riches | feature payante quasi prête |
| Mode expert (placeholder) | slot Pro naturel |
| Catalogue 1000+ polices | socle de l'affiliation fontes |

### Ce qui reste à construire

- **Affiliation** : mapping typo vers fiche foundry et lien d'achat, gestion des liens, page « découvrir cette police ».
- **Pro** : paywall, gestion d'abonnement (Stripe), gating des features.
- **B2B** : comptes organisation, gestion de classes et de sièges, dashboard enseignant, facturation par licence.

### La prochaine étape business

Une **veille marché** sur cinq points : comparables directs et leur modèle réel, taille et willingness-to-pay de l'audience, programmes d'affiliation fontes, benchmarks de prix B2B éducation en design, exemples d'apps de learning gamifié niche qui réussissent en abonnement.

À noter : `docs/overview/` contient un PDF `Etude-Marche-B2B-SaaS-Ecoles-de-Design.pdf` (16 juillet) dont le contenu n'est pas résumé ici.

## 1.10 L'état du partenariat Adobe et des fonderies

Source : `docs/overview/partenariat-adobe.md`, « doc de démarche, pas de code », dont la source légale de référence est la section « NOTE HYPER IMPORTANTE » de la checklist. Le document précise lui-même : « ce doc n'est pas un avis légal ».

### État actuel, en une phrase

**Rien n'est signé, rien n'est engagé.** Le document se termine sur des actions toutes non cochées.

### Le principe fondateur : deux droits séparés

- **Droit d'affichage** (juridique). Le fichier de police est un logiciel protégé : interdit de le posséder ou l'héberger sans licence. Ce qui est permis avec une licence desktop : rendre des **images de mots** (spécimen), usage commercial inclus. Interdit : montrer l'alphabet complet d'une commerciale.
- **Monétisation** (affiliation). Commission quand un joueur clique et achète via notre lien.

Point crucial souligné en gras : « **l'affiliation ne donne pas le droit d'affichage**. Ce sont deux contrats. » Le but d'un vrai partenariat est d'obtenir les deux d'un coup, « idéalement avec des **visuels d'aperçu officiels fournis par eux** (ce qui supprime la zone grise) ».

### Les interlocuteurs identifiés

| Interlocuteur | Pour quoi | Comment |
|---|---|---|
| **Adobe (affiliation)** | affiliation Creative Cloud, environ **85 pour cent du 1er mois** | géré par **Partnerize** |
| **Type Network** | boutique officielle Adobe Originals plus fonderies indépendantes | contact direct pour licences desktop perpétuelles |
| **Monotype / MyFonts** | licences desktop d'un large catalogue, plus affiliation environ **10 pour cent** | programme d'affiliation MyFonts |
| **Fontspring** | achat de licences claires (« pay once ») plus affiliation environ **20 pour cent** | programme d'affiliation, taux plus intéressant que Monotype |

Note technique : « Adobe Fonts via Creative Cloud ne convient pas pour posséder les fichiers (abonnement, interdiction d'extraire ou d'héberger, aucune licence perpétuelle). Pour posséder une typo Adobe à vie, passer par un revendeur ou Adobe Font Folio. »

### Ce qu'on leur demande, par priorité

1. Accès au programme d'affiliation.
2. Autorisation explicite d'afficher des **images de mots** dans un contexte de jeu éducatif renvoyant vers l'achat.
3. Fourniture de **visuels d'aperçu officiels**, ce qui supprime la zone grise juridique.
4. Liste des polices éligibles.

### L'argumentaire

On amène des acheteurs **qualifiés**. Montrer leurs polices est de la **pub gratuite**. On respecte strictement leurs droits : **jamais de fichier de police hébergé**. Positionnement : « on est le **haut de funnel**, pas un concurrent ».

### Le séquencement recommandé

1. **Lancer d'abord en 100 pour cent libre** (OFL et Apache, dont Source Sans, Source Serif et Source Code d'Adobe, déjà au catalogue). Zéro risque, mise en ligne possible tout de suite.
2. **Générer du trafic et des chiffres** : « un partenariat se négocie beaucoup mieux avec de l'audience à montrer ».
3. **Approcher les programmes d'affiliation**, Fontspring et MyFonts en premier.
4. **Ouvrir le mode grandes typos commerciales** avec images de mots et liens d'affiliation.
5. **Négocier le partenariat Adobe en dernier**, avec les métriques en main.

### Vigilance légale

« La France protège davantage les dessins de caractères que les US : **avis juridique avant lancement commercial** du mode commerciales. »

### Les prochaines actions, toutes ouvertes

1. Candidater au programme d'affiliation Fontspring.
2. Candidater à l'affiliation MyFonts / Monotype.
3. Repérer le point d'entrée du programme partenaires Adobe via Partnerize.
4. Préparer un one-pager de présentation du produit.
5. Lister 10 à 15 typos iconiques commerciales à mettre en avant.
6. Confirmer auprès d'un juriste le cadre « images de mots plus affiliation » pour la France.

## 1.11 Deux points d'attention pour qui découvre le projet

**Le catalogue est une infrastructure, pas un dossier de noms.** Il est produit, filtré, enrichi et préparé par des pipelines, avec des candidates (typos repérées mais pas encore promues), des batches de revue, des manifests, des imports, des corpus de profils de mesure, des diffs entre versions. « Sans cette infrastructure, le jeu resterait limité. Avec elle, il devient une plateforme potentielle. »

**Le repo mélange le produit et l'atelier, volontairement.** « C'est quelque chose qu'il faut absolument expliquer à toute personne qui découvre le projet, parce que sinon le repo peut sembler étrange ou désordonné. » D'un côté les pages publiques, le jeu, les composants. De l'autre des routes de dev, des outils de mesure, des pages de calibration, des scripts d'audit, des corpus, des snapshots. « Ce labo n'est pas un ajout anecdotique », il « fait partie intégrante de la maturité du projet, même si l'utilisateur final n'en voit pas directement l'existence ».

**La formule de synthèse à retenir**, dernière phrase de `project-overview-longform.md` : le projet « prend la typographie, qui d'habitude reste invisible ou réservée à ceux qui savent déjà la lire visuellement, et qui la transforme en pratique. Une pratique de reconnaissance, de mémoire, d'observation, de progression. » Ni seulement un jeu, ni seulement un outil pédagogique, ni seulement un système de données : « un endroit où quelqu'un peut commencer par cliquer, continuer par comparer, puis finir par voir réellement quelque chose qu'il ne voyait pas avant ».

---

# Partie 2 — Le système typographique, ce que le joueur apprend à voir

C'est la partie la plus technique du projet : la machine qui mesure les lettres, dessine les repères, et transforme une intuition visuelle en preuve mesurable.

## 2.1 Le vocabulaire, pour qui n'est pas typographe

### Les cinq lignes horizontales

Imaginez une lettre posée sur une feuille lignée. Cinq lignes suffisent à décrire sa hauteur.

| Terme | Explication simple |
|---|---|
| **baseline** | La ligne sur laquelle les lettres sont posées, comme les pieds sur le sol. Le `o` la touche, la queue du `p` la traverse. La seule toujours présente. |
| **hauteur d'x** | La hauteur du corps des minuscules, du sol au sommet d'un `x`. Le `x` sert de mètre parce qu'il est **plat en haut et en bas** : pas de courbe pour tricher. |
| **hauteur de capitale** | Du sol au sommet d'un `H`. |
| **ascendante** | La tige verticale qui dépasse au-dessus du corps minuscule, dans `b d f h k l t`. |
| **descendante** | Ce qui passe sous le sol, dans `g j p q y`. |

Une notion dérivée, centrale : le **corps minuscule** est la **bande de papier** comprise entre la baseline et la hauteur d'x. Ce n'est pas une ligne, c'est une surface, et c'est là que se joue presque toute la sensation de densité d'un texte.

**Pourquoi ça compte** : deux polices peuvent avoir la même hauteur de majuscule et paraître complètement différentes, parce que l'une remplit plus vite la bande minuscule.

### Les quatre traits que le jeu enseigne

**L'ouverture.** « How open the glyph is where the eye enters the form. » Regardez un `e`, un `c`, un `s` : la forme n'est pas fermée, il y a une bouche. De combien s'ouvre-t-elle ? Une ouverture large laisse entrer plus d'air, le texte respire aux petites tailles.

**La contreforme**, à ne pas confondre avec l'ouverture. C'est le trou **fermé** à l'intérieur d'une lettre : le trou du `o`, la boucle du `a`. **L'ouverture est une entrée, la contreforme est une pièce.**

**Le contraste.** L'écart d'épaisseur entre les endroits où le trait est gros et ceux où il est fin, **à l'intérieur d'une même lettre**. Le jargon dit « pleins et déliés ». Contraste faible : le texte a une couleur régulière. Contraste fort : le trait pulse, le texte devient nerveux.

**Les terminaisons.** Comment le trait finit : coupé droit, coupé en biais, arrondi, effilé. C'est le détail qui donne le ton alors que la silhouette générale semble identique à une autre. Les lettres utiles sont `a r t f j`, parce que leur trait s'arrête **dans le vide**.

**L'axe** existe comme donnée de fiche mais **n'a pas de stade** : si vous reliez les deux endroits les plus fins d'un `o`, vous obtenez un axe. Vertical, la lettre paraît construite. Incliné, elle garde une trace de l'écriture manuelle.

### Les termes de la machine

**Le débord optique.** Une lettre ronde comme le `o` est dessinée **volontairement plus haute** que le `x`, et descend **volontairement plus bas** que la baseline. Sans ça, à l'œil, elle paraîtrait plus petite que ses voisines plates. C'est une correction intentionnelle du dessinateur. Le système doit donc distinguer un débord **attendu** d'un bug de mesure, et il code trois états pour ça.

**L'encre et sa boîte.** L'encre, ce sont littéralement les pixels noirs. La boîte d'encre est le plus petit rectangle qui les contient, différente de la boîte typographique : un `l` a une boîte d'encre très étroite mais consomme une largeur normale.

**Le glyphe témoin**, concept propre au projet et décisif. Quand on montre une seule lettre, on la mesure directement. Quand on montre un mot, la question devient : **quelle lettre du mot a le droit de définir la ligne ?** Le document tranche : « the word block is not itself a witness glyph ». Pour tracer la hauteur d'x sur `minimum`, on prend le sommet du `n`, du `m` ou du `u`, **pas** le sommet du mot entier.

Témoins à préférer : `x n m u`. Témoins **à éviter comme seule source** : `e c s o`, parce que « they introduce curves, openings or overshoot-like shapes that can look visually close while staying typographically unstable ».

**La taille d'étalonnage.** Toutes les mesures sont d'abord prises à **1000 pixels**, ce qui donne des nombres nets, puis converties en ratios, puis projetées à la taille réelle du panneau. **Le ratio est le seul objet stable.**

**La projection**, le geste central, en cinq étapes citées : mesurer les sondes canoniques une fois, mesurer la boîte réellement affichée, choisir un cadre partagé, y ajuster l'échantillon, et projeter les cinq lignes **avec exactement la même échelle**. La règle qui justifie tout : « **never position guides from arbitrary percentages alone** ». Sa conséquence : « the rendered specimen and the guides are finally driven by the same projection scale ». C'est ce qui empêche les guides de flotter.

### Les quatre primitives d'annotation

Exactement quatre objets graphiques sont autorisés, et rien d'autre : un **guide** (ligne horizontale structurelle), une **bande** (surface entre deux guides), une **zone de focus** (ellipse ou contour qui désigne une région), une **étiquette** (courte, en capitales).

Et une interdiction fondatrice, qui explique la philosophie du projet mieux que le reste : « **do not point to a pixel unless that point is truly measurable and meaningful** », puis « the system must avoid fake precision », puis en conclusion « **the system should feel educational, not forensic** ».

Densité maximale par stade : 4 guides, 1 bande, 2 zones, 3 étiquettes. « If more information is needed, split it into another stage. » Et le test de qualité : « **if the eye lands on labels first, the stage is too noisy** ».

## 2.2 Les stades de comparaison

### Le cadre commun

Une comparaison est une paire de polices avec une liste d'écarts, chacun déclenchant un stade. Trois modes de vue, trois échelles d'échantillon.

**Le choix de l'échantillon n'est pas figé, il est arbitré par le corpus de mesure** : parmi les mots disponibles des deux côtés, le système retient celui dont le **support minimum** des deux polices est le plus haut.

**Le verdict du corpus** a trois modes. `metric` quand il existe une valeur numérique comparable, et **un seul trait est dans ce cas, la hauteur d'x**. `witness` quand on ne peut comparer que le niveau de support des témoins, ce qui est le cas de l'ouverture, des terminaisons et du contraste. `missing` quand le corpus ne sait rien.

**Le widget d'aide** pose cinq questions en français dans un ordre pédagogique volontaire : qu'est-ce que je regarde d'abord, pourquoi cet échantillon, qu'est-ce qui fait pencher, à quel point je peux lui faire confiance (réponse graduée `fiable`, `utile mais à vérifier`, `fragile`), et quel test je fais maintenant, avec un **contre-test explicite** : « si le même signal ne tient plus, ton premier verdict était trop rapide ».

C'est la trace la plus nette de l'intention du produit : **le joueur n'est pas censé croire le verdict, il est censé le vérifier.**

### Le stade hauteur d'x

Le mot `minimum` en grand, dans les deux polices, avec la bande du corps minuscule teintée entre baseline et hauteur d'x.

Comment c'est calculé : le mot est projeté dans son cadre, **recentré verticalement en tant que bloc typographique** et non en tant que boîte DOM, puis **chaque lettre est mesurée individuellement**, la position venant de la chasse cumulée du préfixe et la boîte encrée de la lettre seule. Enfin les lignes visibles sont résolues **depuis les témoins**, pas depuis la boîte globale. Un guide ne s'affiche que si le mot contient vraiment son témoin.

Le critère de réussite est chronométré : « **in the first 2 seconds**, users can identify baseline and x-height ».

**Le piège que ce stade doit désarmer est nommé** : « les deux dessins peuvent sembler proches tant qu'on regarde surtout les capitales. » Le joueur regarde spontanément les majuscules alors que l'information est dans les minuscules. D'où une interdiction dure : une capitale utilisée comme preuve principale du corps minuscule est un usage **invalide**.

Rôle attribué à chaque lettre : `x` preuve du système de guides seulement, `n` preuve principale du corps, `m` preuve de densité, `o` confirmation sur une ronde, `u` confirmation sur une ouverte. Avec cette nuance : « `x` is valid as a height marker, but **weak** as a local body annotation target ».

### Le stade ouverture

La spécification demande de transformer le stade en « local anatomy proof » : montrer où vit l'ouverture, montrer la contreforme comme appui **secondaire**, et « keep the reading centered on **one side** of the glyph, not the whole glyph equally ». La hauteur d'x doit être traitée « as a reading band, **not as the hero** ».

À éviter, cité : des cercles génériques sans relation claire avec l'ouverture, sur-annoter les deux côtés à égalité, trop de guides horizontaux.

Le piège de raisonnement, écrit dans une bibliothèque du projet : « Inter peut sembler simplement plus large que Helvetica Neue, alors que le vrai signal est parfois l'air qui entre plus vite dans la lettre. » Avec sa question de diagnostic : « **si tu caches presque toute la lettre sauf son entrée, vois-tu encore la même différence ?** »

### Le stade terminaisons

La spécification demande une « end-of-stroke anatomy plate », et autorise explicitement l'asymétrie : « favor asymmetry in composition if that makes the ending easier to read ». À éviter : traiter les terminaisons comme un problème de hauteur, marquer trop de fins à la fois, centrer l'attention sur le glyphe entier au lieu de ses points de sortie.

C'est le seul stade dont l'emphase par défaut est **à gauche**, parce que la paire de référence oppose une humaniste à une neutre.

Le piège : « tu peux projeter une personnalité générale sans localiser quelle terminaison produit vraiment cet effet. » Question de diagnostic : « **peux-tu nommer la terminaison exacte qui fait pencher ton jugement ?** »

### Le stade contraste

La spécification demande une « tension map », et pose un point de validation remarquable : « **the two annotations describe a tension pair, not two unrelated spots** ». Les deux marqueurs doivent raconter **une seule** histoire.

## 2.3 Le stade lettre, et le morceau le plus solide du système

Le mode lettre passe par un moteur distinct, plus rigoureux sur un point : il **rasterise réellement le glyphe** au lieu de raisonner sur des boîtes. Il dessine à 1000 px sur un canvas hors écran, lit les pixels, et construit ligne par ligne la liste des segments continus d'encre.

**Le cœur pédagogique** est la détection de **contact stable**. Pour savoir si un guide « touche » vraiment l'encre, on ne regarde pas une seule ligne de pixels : on balaie une fenêtre et on ne garde que les lignes dont la largeur d'encre atteint au moins **75 pour cent** de la largeur maximale rencontrée.

Pourquoi c'est important : **le tout premier pixel du sommet d'un `n` est la pointe d'une courbe, un accident.** La ligne où la lettre est vraiment large est le vrai sommet du corps. Ce filtre est ce qui empêche le système de poser un guide sur un artefact d'antialiasing.

## 2.4 Les deux batteries d'audit

C'est ce qui distingue une maquette d'un système. Chaque stade a un contrat testable.

**Batterie glyphe : 34 glyphes en 4 groupes**, tirés d'un tableau de travail dont le numéro de ligne est conservé. Chaque glyphe porte une note qui dit **pourquoi il est risqué**. Quelques exemples, très éclairants sur le niveau de finesse visé :

- `e` : « lettre critique car ouverture, barre et courbe révèlent vite les faux contacts »
- `t` : « lettre piégeuse car souvent plus basse qu'une vraie ascendante selon les fontes »
- `g` : « lettre très dangereuse car le dessin change beaucoup selon la fonte »
- `A` : « sommet pointu qui peut créer une impression différente du vrai contact »
- `S` : « courbe très optique, **à ne pas utiliser comme seule référence** »

La vérification géométrique compare la position du guide au contact d'encre réellement projeté, avec **deux tolérances asymétriques**. Le mode débord n'est autorisé que pour certains guides et seulement si le glyphe le déclare, et il est asymétrique : **l'encre a le droit de dépasser le guide de plusieurs pixels, c'est le débord attendu, mais elle n'a pas le droit de s'arrêter avant.**

Les messages d'échec nomment la direction : « floating above the ink », « cutting into the ink », « missing the ink contact ».

**Batterie mot : six cas**, chacun choisi pour exposer une situation typographique précise, avec trois passes séparées, structure, géométrie et composition, et des tolérances au demi-pixel sur les guides.

**Cinq boards internes** rendent tout ça inspectable, avec un point remarquable : les trois premiers **montent le composant réellement livré**, pas une réimplémentation. Ce sont des bancs de régression, pas des bacs à sable.

## 2.5 Comment les métriques sortent des fichiers de police

Il n'y a pas une chaîne d'extraction mais **deux pipelines totalement séparés**, plus deux runtimes de mesure. **Ils ne partagent aucune donnée.**

**Pipeline A, corpus de recherche, en TypeScript.** Un seul script du projet ouvre réellement des binaires de police, via `fontkit`. Il produit un préréglage à neuf clés par police, dont cinq **classes de largeur** qui sont une modélisation grossière mais utile : les étroites, les rondes, les larges, les majuscules, le reste. Puis un second script construit le corpus versionné **sans lire aucun binaire**, en consommant le JSON du premier. Un troisième compare deux versions du corpus.

**Pipeline B, données de spécimen, en Python**, via `fontTools`. Il lit les fichiers WOFF2 servis et produit les métadonnées qui alimentent **les pages publiques** : familles, graisses, axes variables, nombre de glyphes. C'est ce qui injecte les déclarations de police pour que la typo à comparer s'affiche vraiment.

**Les deux runtimes de mesure, et la vérité qu'il faut connaître.**

Le runtime **navigateur** est le seul qui mesure vraiment : il dessine la sonde sur un canvas, lit les pixels, trouve le premier et le dernier non nul. Les résultats sont mis en cache et **invalidés quand les polices finissent de charger**, ce qui évite de garder une mesure prise sur une police de secours.

Le runtime **de repli** n'utilise aucun canvas, tout vient de préréglages analytiques. Détail éclairant : l'écart de hauteur d'x entre les deux polices de référence dans ces préréglages, `0,545` contre `0,522`, soit 2,3 pour cent de cadratin, **est exactement la leçon du stade hauteur d'x**. Le préréglage encode la différence qu'on demande au joueur de voir.

Le runtime **« headless » est à ne pas surinterpréter**. Sa définition entière est un étalement du runtime de repli. Donc **il ne rasterise rien et n'ouvre aucune police** : tous les nombres du corpus sont de l'arithmétique de préréglage, enrichie par les ratios de fontkit quand un fichier de métriques avec échantillons est fourni. La provenance le dit honnêtement, mais il faut savoir la lire.

**Un écart à signaler entre document et code, et il n'est pas anodin.** Le document déclare que la sonde de hauteur de capitale est `H`. **Le code utilise `S`.** Or `S` est précisément le glyphe que la batterie d'audit du projet classe en débord attendu, avec la note « courbe très optique, à ne pas utiliser comme seule référence ». **La hauteur de capitale de référence de tout le système est donc prise sur une lettre que le système lui même déclare inapte à servir de référence unique.** Les hampes sont par ailleurs mesurées sur une seule sonde chacune, là où le document en annonce quatre et cinq.

## 2.6 Le contrat du système typo

Objectif déclaré : « pouvoir itérer vite sans casser la logique produit voir, comprendre, apprendre, jouer ».

**Trois couches de données** dans un ordre strict, canonique puis généré puis surcharge, avec la règle qui fait tenir l'ensemble : « **un override enrichit une page, mais ne doit jamais modifier les clés structurelles du système** ».

**Le verrouillage absolu** porte sur l'identité et le routage, la taxonomie technique, et les états canoniques. Trois raisons données : conserver une URL stable, garantir un graphe de liens cohérent, éviter les régressions silencieuses.

C'est la clé de lecture de tout le contrat. Un identifiant de paire a une forme canonique triée. Si une surcharge pouvait le changer, **deux URL différentes pointeraient sur la même comparaison**, le maillage se dédoublerait, et le référencement se casserait **sans qu'aucun test visuel ne le voie**. D'où la sévérité maximale.

Trois niveaux de sévérité, dont quatre codes promus en bloquant en intégration continue stricte.

### Ce que le contrôle vérifie réellement

25 codes émis sur 27 documentés. Deux ne sont pas implémentés. **Trois codes ont une sémantique qui diverge du document**, dont un particulièrement trompeur : le document annonce « comparaison à score faible mais publiée », le code teste seulement que le score est dans l'intervalle, sans plancher et sans condition de statut. **Une comparaison publiée avec un score de zéro passe.**

Nuance de rigueur : la vérification de présence utilise un test d'existence de clé, donc **un champ présent mais nul passe**. Et plusieurs champs ne sont vérifiés qu'en présence, jamais en forme.

**Comportement si la racine de contenu est absente : le contrôle PASSE**, avec un message d'amorçage. C'est un choix délibéré, mais cela veut dire qu'**un contrôle vert ne prouve pas qu'il y a du contenu**.

**Ce qu'il ne fait pas : il valide seulement, il ne génère rien.** Les comparaisons sont lues, jamais produites. Le score est contrôlé en plage, jamais calculé. Les fichiers d'historique de slug étant **absents**, toute la protection contre le changement de slug publié est **inerte aujourd'hui**.

### L'état réel du contenu, à connaître avant tout

**Trois polices, un concept, deux comparaisons dont une seule publiée.** Le seuil de trois comparaisons par police est **mathématiquement inatteignable** avec trois polices, chacune ne pouvant avoir que deux partenaires.

## 2.7 La page spécimen et sa calibration

Le document stratégique sur les calques de spécimen n'est pas une spécification, c'est une **note de décision mise de côté volontairement**. Sa formulation la plus utile explique la place du spécimen à côté du jeu :

> Le jeu répond à : « reconnais-tu cette typo ? »
> Le spécimen répond à : « qu'est-ce qui fait que cette typo ressemble à ça ? »

Et plus loin : « **le jeu apprend à reconnaître, le spécimen apprend à observer** ».

Le raisonnement sur le report est explicite et vaut d'être compris : « le point important n'est pas de rejeter l'idée, le point important est d'éviter une mauvaise intégration ». Le risque nommé n'est pas la panne mais « duplication de données, incohérence de design, incohérence de routing, incohérence SEO, et maintenance inutilement lourde ».

**La calibration de la page typo** définit un gabarit destiné à être répliqué sur des milliers de pages. Son intention : « the goal is not to make a pretty isolated page, the goal is to define **one strict master page** that can later be multiplied ».

Règle implémentée et vérifiée : « **desktop sizing must be calibrated from word length, not by hand per page** ». Trois échelles distinctes sont calculées depuis la longueur du mot et exposées en variables CSS.

Garde-fou de direction artistique : ne réutiliser que les trois rayons canoniques, et l'interdiction « avoid one-off button or rectangle variants ». La formule qui résume : « **the page can become more technical, but never by inventing a second DA** ».

**Une divergence non documentée** : la page d'une police précise est rendue sur fond noir, contrairement aux autres, par une classe conditionnelle sur son slug. La règle du document dit « any divergence should be intentional and documented ». Celle ci est intentionnelle mais **n'est pas consignée**. Décision de direction artistique, donc arbitrage du propriétaire.

## 2.8 Implémenté contre spécifié

### Solide et en production

Le moteur de projection partagé est **complet et unique** : aucun composant ne recalcule sa propre échelle, ce que le document exige. La rasterisation d'encre et la détection de contact stable sont le morceau le plus solide du système. La résolution par témoins est implémentée exactement selon le document. Le placement anti-collision existe dans les deux moteurs, avec liste de candidats et repli tracé. Les deux batteries d'audit sont complètes et exposées sur des boards qui montent les composants réellement livrés. La chaîne de profils est complète, du contrat typé au diff entre versions.

### Trois fragilités honnêtes

**Les annotations locales du stade lettre sont mortes au runtime.** Une constante est déclarée à `null` et **jamais réassignée**, or **tous** les rendus d'annotation locale du stade lettre sont conditionnés par elle. Conséquence : les étiquettes d'ouverture, de contreforme et d'entrée, leurs connecteurs, la zone de contreforme et la cote d'ouverture **ne s'affichent jamais** en mode lettre. Le code de calcul existe et n'est jamais rendu.

Effet direct : les étiquettes **obligatoires** de la spécification du stade ouverture ne sont satisfaites qu'en mode mot, **alors que le mode lettre est précisément l'échantillon par défaut de ce stade**.

**Trois chips de mesure ne mesurent rien.** Les valeurs affichées à côté des zones d'ouverture, de terminaison et de contraste sont des **proportions fixes de la largeur de la lettre visée**, pas des mesures. Le delta de trait vaut mécaniquement un huitième de la largeur de la région, parce que les deux largeurs comparées sont deux pourcentages fixes de la même région.

C'est exactement le travers que le document interdit : « labels that imply local precision when only a general relation is shown ». **La forme visuelle respecte la règle, le chiffre affiché à côté ne la respecte pas.** Les seuls chips reposant sur une mesure réelle sont ceux des cinq lignes horizontales et de la largeur.

**La route des concepts n'existe pas.** Le contrôle réserve son espace de nommage, la page de comparaison rend un lien vers elle, et le seul concept publié a un contenu pédagogique rédigé. **Donc ce lien mène aujourd'hui à un 404, et le seul contenu de concept écrit n'est lisible nulle part.** C'est le trou le plus visible côté joueur.

### Autres écarts à connaître

La bande du corps minuscule **n'existe que pour le mot `minimum`**, alors que le sélecteur par corpus peut choisir un autre mot, auquel cas la preuve visuelle centrale du stade disparaît.

La zone d'ouverture **n'existe que si le mot contient un `e`**, la règle n'étant pas généralisée aux autres lettres d'ouverture que le document désigne comme valides.

Quatre étiquettes exigées par les spécifications de stade **n'existent nulle part dans le code**. Les deux documents se contredisent sur le contraste, et le code suit le document d'annotation : la spécification du stade contraste n'a jamais été implémentée telle qu'écrite.

La position **dans** la lettre des zones de focus est un réglage fixe, pas une détection de l'endroit où le trait est réellement le plus épais. Le moteur glyphe possède pourtant l'outillage pour faire cette détection, mais ne l'utilise pas.

Deux modes de vue ne sont **pas exposés dans l'interface** et ne sont atteignables que par URL. Conséquence : le stade hauteur d'x a une vue recommandée qui **n'est jamais atteinte par un clic**.

### Code écrit, mort, et conservé volontairement

Six fichiers et deux fonctions sont injoignables depuis une route, dont une **bibliothèque de cinq pièges de raisonnement** rédigés avec leur énoncé et leur question de diagnostic.

La raison de la conservation est explicite : le périmètre des pages de comparaison est gelé par décision du propriétaire, et supprimer sept fichiers la semaine où on demande de ne pas y toucher « a raison sur la lettre et tort sur l'esprit ». Cette bibliothèque de pièges est par ailleurs **le meilleur matériau pédagogique écrit du projet**, elle mérite d'être rebranchée plutôt que supprimée.

### La fragilité de données qui compte le plus

Une seule comparaison publiée : **toute la démonstration du système repose sur cette paire**. Et une des trois polices **n'a pas de profil dans le corpus de mesure** : sa comparaison est en brouillon donc sans impact aujourd'hui, mais le jour où elle passera en publié, verdict, explications et widget d'aide **retomberont tous à vide sans qu'aucun contrôle ne le signale**.

**Le vrai bloqueur du système typo n'est pas le code, c'est le contenu.**

---

# Partie 3 — Le moteur de jeu

## 3.1 Cartographie documentaire : qui fait autorité sur quoi

C'est la partie à lire avant toutes les autres. Les documents du moteur ont des statuts différents et parfois contradictoires, et la colonne « date interne » contre « fichier modifié » est l'information la plus instructive du dossier.

| Fichier (`docs/game/`) | Statut déclaré, verbatim | Date interne | Modifié le | Taille | Autorité aujourd'hui |
|---|---|---|---|---|---|
| `vision-produit-dwiggins.md` | « vision figée par le propriétaire du projet. Document de rang supérieur. » | 2026-07-29 | 29 juil | 32 Ko | **Rang 1**, fait foi sur tout |
| `training-engine-spec-v2-clean.md` | **aucun statut, aucune date, aucun bandeau** | non documenté | 20 juin | 45 Ko | **Rang 2**, statut conféré de l'extérieur par la vision et `docs/README.md`, jamais par lui même |
| `architecture-backend.md` | « proposition, en attente de validation. Aucune implémentation avant accord. » | 2026-07-29 | 29 juil | 18 Ko | Rang 3, **non validé** |
| `perceptual-progression-spec.md` | « Statut précisé le 2026-07-29 » plus « Status: draft » plus alignement math barré | 2026-06-16 | 29 juil | 17 Ko | Autorité partielle sur le modèle de la carte |
| `global-level-progression.md` | « Status: implemente (migration 009 ecrite, non appliquee) » | 2026-07-09 | 9 juil | 14 Ko | Décrit l'implémentation réelle, **mais son statut est faux**, 009 est appliquée |
| `pool-growth.md` | « État : 008 EST appliquée (constaté le 2026-07-29) » | non documenté | 29 juil | 8 Ko | Autorité sur la croissance du pool |
| `self-correction-engine.md` | « Status: draft » plus « Etat : APPLIQUEE » pour 007 | 2026-07-07 | 29 juil | 17 Ko | Autorité sur les cinq greffes branchées, se déclare subordonné |
| `game-unified-spec-v1.md` | « **PARTIELLEMENT CADUC depuis le 2026-07-29** » plus « Status: canonical merged spec » | 2026-03-13 | 29 juil | 18 Ko | Résiduelle. Son titre « canonical » est contredit par son propre bandeau |
| `game-v4-executable-spec.md` | « **HISTORIQUE sur tout ce qui concerne le front-only** » | 2026-03-12 | 29 juil | 9 Ko | Quasi nulle sur le moteur |
| `game-mode-normal-spec.md` | « Status: **active draft** », aucun bandeau du 29 juillet | 2026-03-13 | **20 juin** | 8 Ko | **Périmé aux deux tiers**, voir 3.6 |
| `onboarding-game-contract.md` | « Last update: 2026-03-12 », **aucune ligne Status** | 2026-03-12 | **20 juin** | 7 Ko | Résiduelle, timings incompatibles avec la spec v2 |
| `training-database-master-recap-v7.md` | « source unique avant tout prompt Claude », **aucun statut** | non documenté | **20 juin** | 21 Ko | **Autorité auto-proclamée, jamais confirmée**, voir 3.6 |
| `scoring-and-selection-math.md` | « **DOCUMENT DE RECHERCHE, AUCUNE AUTORITÉ SUR L'IMPLÉMENTATION** » | 2026-06-15 | 29 juil | 24 Ko | **Zéro autorité** |
| `scoring-implementation-contract.md` | « AUCUNE AUTORITÉ », « sorti de la hiérarchie le 2026-07-29, par ricochet » | 2026-06-16 | 29 juil | 10 Ko | **Zéro autorité** |
| `handoff-page-parcours.md` | « Point à revoir depuis le 2026-07-29 », règle d'origine renversée | 2026-06-16 | 29 juil | 12 Ko | Rang 4, HUD à réécrire |
| `classes-comptes-spec.md` | Bandeau de section : « CADUC depuis le 2026-07-29 » sur « Tableau de bord prof » seulement | 2026-07-09 | 29 juil | 15 Ko | Valable sur auth et écoles, caduque sur la lecture professeur |

### Le signal caché dans les dates de fichier

Le balayage documentaire du 2026-07-29 se déclare **exhaustif**. Les dates de modification montrent que **quatre fichiers n'ont pas été rouverts ce jour là** : `game-mode-normal-spec.md`, `onboarding-game-contract.md`, `training-database-master-recap-v7.md` et `training-engine-spec-v2-clean.md`, tous restés au 20 juin, plus `global-level-progression.md` au 9 juillet. Trois d'entre eux ne sont **cités nulle part** dans le registre des contradictions.

Le registre est donc exhaustif sur ce qui a été relu, pas sur le répertoire. C'est exactement là que se trouvent les contradictions non enregistrées de 3.5.

## 3.2 Le moteur réel, expliqué à quelqu'un qui arrive

### Deux seules choses sont stockées

Le **mastery par couple utilisateur et typographie**, avec son état de répétition espacée, et le **journal d'événements**, une ligne par réponse, append-only. Tout le reste est recalculé à la lecture.

La table est `user_typeface_state` : `mastery_level` (0 à 4), `correct_streak`, `total_correct`, `total_errors`, `session_errors`, `consecutive_session_errors`, `last_shown_at_q`, `next_due_after_q`, `interval_questions`, `in_active_pool`, `paused_until_q`, `adaptive_coef` (borné 0,5 à 2,0).

**Trois noms diffèrent entre la spec et la base**, et c'est un piège classique : la ligne utilisateur vit dans `users` et non `user_profile`, la colonne est `next_due_after_q` et non `next_due_at_q` comme l'écrit la spec, et le coefficient s'appelle `adaptive_coef` en base et non `adaptive_weight`.

### Comment une question est choisie

Le pool actif fait environ 30 typographies, jamais le catalogue entier : « le moteur ne consulte **jamais** le catalogue global entier à chaque question ».

L'algorithme : récupérer le pool actif, éliminer les inéligibles (désactivées, en pause, en cooldown), partitionner en `overdue` et `due_now`, puis appliquer **sept priorités dans cet ordre exact** : overdue mastery 0, overdue mastery 1, due_now mastery 0, overdue mastery supérieur à 1, due_now mastery 1, due_now mastery supérieur à 1, toute typo éligible. Dans le premier groupe non vide, tirage pondéré par le coefficient adaptatif.

L'idée pédagogique : ce qui est en retard passe avant ce qui est à l'heure, et ce qui est mal su avant ce qui est bien su.

Les **trois distracteurs** sont choisis par le serveur seul, et leur proximité visuelle croît avec la maîtrise. Score de départ 1000, plus bas veut dire choisi en premier :

| `mastery_level` de la bonne réponse | même catégorie | même cluster visuel |
|---|---|---|
| 0 ou 1 | moins 125 | moins 250 |
| 2 | moins 225 | moins 175 |
| 3 ou 4 | moins 325 | moins 350 |

Le mot affiché change **toutes les 5 questions** en entraînement, **à chaque question** en compétition.

### Comment la réponse est notée

| Classe | Définition | Effet |
|---|---|---|
| `correct_first_try` | bonne réponse au premier clic | mastery plus 1 (plafond 4), cooldown de réussite |
| `full_error_first_wrong` | premier clic incorrect | mastery moins 1 (plancher 0, exception 4 vers 3), cooldown d'erreur, Misread éligible |
| `partial_signal` | clic incorrect additionnel sur la même question | **aucun** impact |
| `correct_after_error` | bonne réponse après erreur sur la même question | fin de question, **pas** de mastery plus 1 |

Le retry est illimité en entraînement, et une question affichée ne peut coûter qu'une seule pénalité. Il n'y a **aucun score** en entraînement.

### Comment le rappel s'espace

Fenêtres en **nombre de questions**, pas en jours :

```
niveau 0 : 1 a 3      questions
niveau 1 : 3 a 6      questions
niveau 2 : 10 a 25    questions
niveau 3 : 25 a 50    questions
niveau 4 : 80 a 150   questions
```

Le calcul applique trois étapes dans un ordre non négociable : tirage dans la fenêtre du **nouveau** niveau, division par le poids adaptatif, puis **plancher de cooldown en dernier**. C'est cet ordre qui fait tenir l'invariant I-13 par construction : le poids ne peut jamais casser les cooldowns.

Le poids bouge peu : plus 0,1 seulement après deux erreurs consécutives de séance, moins 0,05 seulement après trois bonnes réponses d'affilée, bornes 0,5 à 2,0.

### Le niveau qui monte, deux objets à ne pas confondre

**Le niveau Dreyfus N.1 à E.5** est une variable de commande interne. La formule réellement en base n'est pas une fraction mais un **compte** : `n4` égale le nombre total de typographies à mastery 4, sans filtre de pool (« l'expertise acquise ne se perd pas »), projeté sur 25 crans par une table de seuils : 0, 3, 6, 9, 12, 15, 20, 25, 30, 35, 40, 52, 64, 76, 88, 100, 130, 160, 190, 220, 250, 320, 400, 500, 650. Repères : N.1 à 0, D.1 à 15, C.1 à 40, A.1 à 100, E.1 à 250, E.5 à partir de 650.

Le motif du choix est écrit : « l'ancienne piste (fraction du pool) saturait beaucoup trop vite sur un catalogue de 1000+ typos ». Recalcul après **chaque** réponse, avec régression bornée à un sous-niveau par appel.

**La carte DWIGGINS** est l'autre objet, celui que l'élève voit : 8 axes, 35 paliers, trois états monotones `dormant`, `emerging`, `lit`. Seuils : palier allumé si réussite supérieure ou égale à 0,80 **et** au moins 5 typos distinctes ; axe allumé si au moins 70 pour cent de ses paliers non-roadmap sont allumés.

### Comment le pool grandit

Déclencheur : une nouvelle typographie entre quand **3 typographies différentes** atteignent mastery 4, une seule à la fois. La sélection filtre par palier Dreyfus et par rareté, puis choisit **la sous-catégorie la moins représentée** dans le pool courant, pour diversifier.

Rien ne sort jamais : « une typographie ne sort **jamais** du pool actif. Son `in_active_pool` reste `TRUE` indéfiniment. Seul son intervalle augmente. » À mastery 4, l'intervalle atteint 80 à 150 questions, donc une typo maîtrisée revient environ toutes les 80 à 150 questions, ce qui maintient la mémoire long terme.

**Le joueur ne peut jamais être bloqué.** Un repli en deux temps, invisible : tentative d'injection d'une nouvelle typographie, sinon avance du curseur du scheduler jusqu'au plus petit `next_due`. Règle stricte : « on déplace le curseur pour satisfaire le cooldown, on ne raccourcit jamais le cooldown lui même ».

État à connaître : la croissance du pool est **allumée mais n'a jamais tourné en conditions réelles**, la base ne contient aucune face à mastery 4.

### Comment le faux expert redescend

C'est l'objet de `self-correction-engine.md` : « comment le niveau declare en onboarding cesse d'etre un prior fige et devient un prior qui S'EFFACE quand la performance reelle le contredit ». Cinq greffes : poids adaptatif réveillé (il était lu mais jamais écrit), intervalles indexés sur le mastery (ils renvoyaient plus 2 et plus 10 fixes), résultat du warm-up d'onboarding exploité au lieu d'être jeté, rebalance descendant du pool (additif seulement), et indicateur de progression en jeu.

### La correction : spécifiée, déclenchée, et inexistante

Le déclencheur est **sélectif** : rien si la classe n'est pas `full_error_first_wrong`, puis une Misread à la première erreur de la séance sur cette typo, ou à la deuxième erreur consécutive.

**Rien de tout cela ne tourne.** `content/type-cards/` est absent, vérifié. Le code écrit désormais la vérité avec un garde dédié : `const misreadShown = false;` avec le commentaire « check:misread-truth fails if anything but a literal false is written here ».

Et la décision est **volontairement suspendue** depuis le 2026-07-29. Le vrai nœud à trancher : la spec affiche la Misread au premier faux clic **pendant que la question reste ouverte au retry**, ce qui n'a de sens qu'avec une carte non bloquante. Une carte bloquante impose de choisir entre l'afficher avant le retry (le plus pédagogique mais « elle souffle la seconde tentative ») ou après la résolution.

## 3.3 Les trois modes

| Dimension | `training` | `competition` | `expert` |
|---|---|---|---|
| Format | QCM 4 choix | QCM 4 choix | saisie texte libre |
| Chrono | aucun | 2 minutes | non documenté |
| Score visible | aucun | 1 point, 2 si moins de 2 s | non documenté |
| Retry | illimité | aucun | non documenté |
| Rotation du mot | toutes les 5 questions | à chaque question | à chaque question |
| Feedback | 800 ms | 500 ms | 650 ms |
| Répétition espacée | oui | non, pool global | non documenté |
| Écrit le mastery | oui | **jamais**, imposé sans exception | « à décider explicitement » |

**Le mode Expert n'est pas jouable** : `app/play/expert/page.tsx` est un placeholder. La table `expert_answer_keys` existe, aucun code produit ne la lit.

## 3.4 Les invariants non négociables

**I-01 à I-14, le fonctionnement du moteur.** Liste fermée : aucune logique backend ou frontend ne peut les contredire.

| # | Invariant |
|---|---|
| I-01 | Une typo ratée ne revient jamais immédiatement, minimum 2 questions d'écart |
| I-02 | Une typo réussie ne revient pas dans les 5 questions suivantes |
| I-03 | Une bonne réponse fait monter d'un niveau, plafond 4 |
| I-04 | Une mauvaise réponse fait descendre d'un niveau, plancher 0. Exception : 4 descend à 3 |
| I-05 | Le mastery est par utilisateur et par typographie, jamais global |
| I-06 | Une typographie n'est jamais supprimée du pool ni du système |
| I-07 | Une nouvelle typo n'entre qu'au moment où 3 typos différentes atteignent mastery 4 |
| I-08 | Le niveau visible ne remplace jamais la répétition espacée, il en est la lecture agrégée |
| I-09 | Le training n'a pas de score visible et pas de limite de temps |
| I-10 | Le frontend ne décide jamais de la typo suivante ni des distracteurs |
| I-11 | Le score de compétition n'influence jamais le mastery |
| I-12 | En mode invité, aucune donnée n'est persistée après fermeture de session |
| I-13 | Le poids adaptatif ne peut jamais casser I-01 ni I-02 |
| I-14 | En cas de retry, une seule pénalité par question affichée |

**I-15 à I-24, les principes produit**, ajoutés par la vision. Ils doivent être « vérifiables par requête ».

| # | Cœur |
|---|---|
| I-15 | L'état pédagogique personnel n'est lisible par aucune partie du contexte institutionnel. Aucun agrégat, même pseudonymisé |
| I-16 | Toute lecture professeur est bornée aux événements d'une session assignée qu'il a publiée sur sa classe |
| I-17 | Une séance se termine par une décision de l'élève, jamais par un compteur |
| I-18 | Le mastery brut n'est jamais affiché comme une note |
| I-19 | La couche d'engagement n'influence jamais le moteur, n'est jamais une preuve de compétence, jamais visible du professeur |
| I-20 | Le niveau Dreyfus est une variable de commande interne, pas une note |
| I-21 | La sélection d'une session assignée ne consulte jamais le pool personnel |
| I-22 | L'effet d'une session vient de sa politique, jamais déduit. La compétition est toujours `observe_only` |
| I-23 | Quand une session assignée écrit le mastery, l'effet reste invisible du professeur |
| I-24 | Régime borné des analyses internes de l'opérateur, distinct du professeur. Vocabulaire : pseudonymisé, jamais anonymisé |

Ce ne sont pas des intentions : le cas pivot P-06 impose que I-01 à I-14 soient « vérifiables en base par requête SQL ». Et la méthode est posée : « cette étanchéité doit être garantie par l'architecture, pas par l'interface. Une promesse portée par des écrans est violée le premier jour où quelqu'un ajoute un écran. »

## 3.5 Les contradictions relevées

**Quatre sont déjà au registre de la vision.**

**Type Card bloquante ou non**, non tranché. `game-v4-executable-spec.md` §7.1 dit « blocks gameplay interactions while visible », la spec v2 §6.3 dit « non bloquante ». Aggravation non enregistrée : le même §6.3 dit « overlay non modal, pas plein écran », alors que deux autres documents disent « full-screen ».

**Familles de cartes** : deux familles prévues (`reading`, `misread`) contre « V2 Training : cartes de correction uniquement ».

**Rotation des mots, et le registre se trompe lui même.** Le registre écrit que `game-unified-spec-v1.md` §4.1 dit de garder le même mot. Ce §4.1 **n'existe pas**, et ce document dit exactement le contraire en §7.2 : « Entraînement : changement toutes les 5 questions ». Le document est donc marqué caduc sur un point où il a raison.

**État d'implémentation des cartes** : la même fausseté existe dans un document marqué et dans un document non marqué.

**Treize autres ne sont pas au registre.** Les plus importantes :

**Sémantique des niveaux de mastery.** Un document dit « 1 : vue mais ratée », alors que tout le monde démarre à 0 et que le niveau 1 vient d'une bonne réponse ou d'une redescente.

**`game-mode-normal-spec.md` se contredit dans le même fichier**, à quatorze lignes d'écart : règle verrouillée numéro 6, « Training changes word every 5 questions », contre §3.2, « that word is reused for all questions in the session ». Et §3.4 argumente activement en faveur de la mauvaise.

**Deux plafonds de Misread différents dans la spec v2 elle même** : « cap à 2 par session » et « maximum 1 Misread toutes 2 questions », chacun présenté comme la règle.

**Le délai de feedback a trois valeurs incompatibles** : 800 ms avec un minimum de 400 dans la spec v2, 640 / 320 / 140 ms dans le contrat d'onboarding (deux valeurs sous le minimum déclaré), et 2000 ms dans le runtime, qui est ce que fait le code.

**Le mode Expert est spécifié trois fois différemment**, sur la porte d'entrée (niveau global contre typo par typo) et sur les réponses acceptées (seul nom officiel, contre table de synonymes, contre set large validé).

**I-12 est contredit par l'implémentation** : l'invariant dit qu'aucune donnée invité n'est persistée, le code crée un cookie anonyme et écrit une trentaine de lignes en base. L'écart n'est nulle part enregistré.

**Le compte de paliers a trois valeurs** pour la même carte : 35 (26 live plus 9 roadmap), 42 (33 live), et 35 à nouveau huit lignes plus loin dans le même document. Le mock du code est calé sur un axe à 8 paliers que la spec n'a jamais eu.

**Le toast de niveau est implémenté à l'opposé de la décision produit** : le code affiche « New level X.Y », la vision dit « aucun compteur mis en avant » et que le libellé n'est pas affiché comme une note.

**Un document vivant tire son autorité d'un document de recherche** : `global-level-progression.md` fonde sa formule sur un invariant de la math spec, laquelle avertit explicitement que ses invariants « I1 à I14 n'ont aucun rapport » avec ceux du projet. Aggravant : la vision commet la même chose en §9.

**Le registre contredit son propre arbitrage** : son entrée 13 dit « décision attendue », son §12.C dit « RÉSOLU le 2026-07-29 ». L'entrée n'a pas été mise à jour.

**La numérotation des invariants est annoncée faux quatre fois** : la vision dit ajouter « I-15 à I-23 » mais liste I-24, l'architecture reprend la même borne, `docs/README.md` aussi, et la checklist écrit une troisième borne, « I-15 à I-21 ».

**Le contrat d'API de rang 2 envoie une information que le code refuse de donner** : la spec §8.1 prévoit un `correct_index` envoyé au frontend, le code n'en contient aucune occurrence et la question est portée par un jeton signé serveur. Le code est ici plus strict que sa propre spec.

## 3.6 Les documents sans bandeau : cohérents ou périmés

**`training-engine-spec-v2-clean.md` : cohérent.** Son absence de statut est un défaut de gouvernance, pas un signe de péremption. Trois arguments : la vision l'adosse explicitement (« cette spec reste la source de vérité du fonctionnement du moteur »), la checklist confirme sa conformité au code fonction par fonction avec l'instruction « le moteur lui même est conforme à la spec et **ne doit pas être réécrit** », et sa philosophie est celle de la vision mot pour mot. Un en-tête doit lui être ajouté, et cinq points annotés : les deux plafonds de Misread, le `correct_index`, le tirage aléatoire abandonné pour un milieu de fenêtre, I-12 contre la persistance invité réelle, et le mot porté par la session contre par la question.

**`game-mode-normal-spec.md` : périmé aux deux tiers.** Son « active draft » est trompeur et doit tomber. Il affirme un état d'implémentation démenti, il verrouille en « Locked Product Rules » un comportement que la vision a explicitement parké, il se contredit lui même sur le mot, et il décrit un `/game` « in front-only mode », exactement le vestige condamné chez son jumeau qui a reçu un bandeau alors que lui non.

Mais **un tiers est à sauver et à transférer** : son §3 est le seul endroit du repo qui explique **pourquoi** le mot existe (« The word is not for reading meaning. The word exists to expose letter structure »), justifie la taille du pool par les deux risques opposés (« moins de 10 : risque de sur-mémorisation, plus de 30 : peu de valeur pédagogique additionnelle »), et liste les lettres discriminantes avec leur raison. Et son §6.5 porte une idée que la spec v2 n'a pas : « une carte Misread peut servir plusieurs polices partageant une confusion visuelle proche », là où la spec v2 indexe une carte par typographie.

**`training-database-master-recap-v7.md` : le cas le plus urgent.** Il se déclare « source unique avant tout prompt Claude » sans qu'aucun rang ne le lui accorde, et il porte une **seconde liste d'invariants**, ce qui donne au projet trois numérotations qui se ressemblent. Trois de ses décisions « validées » contredisent des invariants supérieurs : le merge invité vers compte contre I-12, la logique mixte de progression contre I-19, et la carte « risque de décrochage » visible contre I-15.

Mais c'est **le seul document qui spécifie la couche de faits au niveau colonne** : les 22 colonnes minimales du journal d'événements, l'enum fermé des codes de raison avec ses règles de dérivation, dix KPI en formules dont les deux seules mesures existantes de la qualité pédagogique. Et c'est lui qui rend intelligible la remarque « la télémétrie mentit déjà » : sans sa formule `misread_effectiveness`, on ne comprend pas pourquoi écrire un faux `misread_shown` rend l'historique inexploitable.

### Synthèse pour le propriétaire

| Document | Verdict | À décider |
|---|---|---|
| `training-engine-spec-v2-clean.md` | Cohérent, à doter d'un en-tête qui dit ce qu'il est déjà de fait | Annoter cinq points internes |
| `game-mode-normal-spec.md` | Périmé aux deux tiers, « active draft » à retirer | Sauver §3 et §6.5, déclarer caducs §1.1, §2.7, §3.2, §6.2 |
| `training-database-master-recap-v7.md` | À subordonner d'urgence | Retirer l'autorité de sa liste d'invariants, soumettre ses tableaux de bord à I-24, trancher trois décisions, conserver sa couche de faits |

---

# Partie 4 — L'interface, les écrans et le parcours

## 4.1 Le châssis commun

Toutes les pages passent par `app/layout.tsx`, 45 lignes. Un script de bootstrap de thème est injecté dans le `head` avant tout rendu, pour éviter le flash : il lit `localStorage` sur la clé `jdt-theme`, valide, puis écrit `data-theme` et `colorScheme`.

**Le thème par défaut au boot est `dark`**, y compris dans le `catch`. `front-ui-master-spec.md` §3 écrit encore que le défaut est `light`. Le code dit dark.

`UiDebugProbe` est monté sur **toutes** les pages. C'est le seul composant `components/dev/*` dans l'arbre produit, fermé en production par `isDevRuntime()`. C'est précisément ce composant qui a imposé la troisième passe de `check:dev-routes`.

## 4.2 Inventaire des routes

20 pages, 3 fichiers spéciaux, 7 routes d'API.

| Route | Rend |
|---|---|
| `/` | `LandingExperience` |
| `/onboarding` | `OnboardingFlow` |
| `/play` | `ModeSelectPage` |
| `/play/training` | `TrainingIntro` |
| `/play/competition` | `CompetitionScreen` |
| `/play/expert` | `ModePlaceholderPage` |
| `/play/{mode}/rules` | `ModeRulesPage` |
| `/game` | `GameScreen` |
| `/profile` | `ProfileExperience`, async, lit la base |
| `/compare` | pas d'UI, `redirect()` vers le premier slug publié |
| `/compare/[slug]` | comparaison guidée |
| `/type/[slug]` | fiche spécimen |
| `/dev/*` (6 routes) | labos internes, fermés en production |
| `error.tsx`, `global-error.tsx`, `not-found.tsx` | `ErrorScreen` partagé |

## 4.3 Le parcours du joueur, de bout en bout

### L'arrivée sur `/`

`LandingExperience.tsx`, 444 lignes, est **la référence DA du projet**. Sept blocs :

Un **header flottant** en pastille sticky qui se condense au scroll à `scrollY > 40`, avec un champ de caractères décoratifs, la marque, quatre ancres pilotées par un scroll-spy, et le CTA `Start training`.

Le **héros** : le mot `Character` re-rendu toutes les 2400 ms dans une des sept typographies du catalogue, un champ de particules en fond, la promesse `Every typeface has one. Train your eye to read it.`

Une **démo auto-jouée** : un curseur fantôme en GSAP va d'abord sur une mauvaise option, flash rouge, puis sur la bonne, vert, en boucle.

Une **anatomie de lettre** dont les guides se dessinent au scroll. Robustesse notable : les guides sont **visibles par défaut en CSS**, le dessin est un pur enrichissement, avec un timeout de secours « so the lines are NEVER left hidden ».

Un **teaser de comparaison** qui pilote les vrais modes de la page compare, un **rail de typographies** qui dérive tout seul et se scrolle à la main, **trois cartes de mode** avec parallaxe au pointeur, et un **mur de maîtrise** qui passe du flou au net au scroll.

Le **footer** est le dossier crème pleine largeur, dont l'onglet est un seul chemin vectoriel dont la géométrie est décrite en commentaire, rayon convexe égal au rayon concave, « une seule forme donc aucune couture ».

### `/onboarding`

**Zone déclarée en gel actif** par CLAUDE.md. Sa thèse est écrite en tête du fichier : « a short, honest first look, NOT a settings survey », et « we do NOT ask the player to hand-pick difficulty ». On ne demande que ce que le moteur ne peut pas deviner à froid.

**Quatre étapes** : `welcome`, `familiarity` (quatre options, `Not at all` à `Designer`), `micro` (la seule en deux colonnes, avec un plateau vivant, `Continue` bloqué jusqu'à ce que la manche soit résolue), `launch`.

Persistance : clé `jdt-onboarding-v1`, objet `{ familiarity, warmupCorrect }`. Ces deux valeurs sont relues par `GameScreen` et amorcent le pool. Un joueur qui se déclare avancé mais rate le warm-up est redescendu d'un cran.

**Écart avec la spec** : `front-ui-master-spec.md` décrit **cinq** étapes avec une étape `pace` et une barre de pourcentage. L'étape `pace` n'existe plus, la barre est devenue un compteur.

### `/play`, le choix du mode

Composant serveur, aucun état client. Refonte datée du 2026-07-29 : la page était « its own island », elle porte maintenant `.pf-page`, **le contrat de tokens du profil**, et met en page avec le vocabulaire partagé.

Pied de page qui dit l'essentiel : « Only your training progression is personal and permanent. Competition never moves it. »

**Écart** : `ui-palette-reference.md` §11 décrit les classes `.mode-select-*` comme la référence couleur validée. Ces classes **ne sont plus utilisées**. Le §11 décrit une page qui n'existe plus.

### `/play/training`, l'entrée du mode

Existe pour une raison écrite : « Was a bare redirect to /game, so the player landed on the first question without reading a line about the mode. Vision §2.1 requires the philosophy of Training to be stated at its entrance. »

Toute sa copie vient de `trainingIntroCopy`, avec les quatre énoncés de la vision §2.1 dans l'ordre de cette section.

**C'est le dernier écran du produit qui porte encore le jaune plein interdit** par le contrat de cohérence.

### `/game`, la boucle

`app/game/page.tsx` porte une décision d'architecture importante : la page **n'émet plus de bloc `@font-face` statique**. Elle émettait 23 familles alors que le pool est tiré du catalogue complet de 1172, donc toute famille hors de ces 23 s'affichait en substitution et « the question asked the player to name a typeface that was not on screen ». Chaque question porte désormais son propre descripteur, déclaré juste avant l'affichage.

Le clic est immédiat, sans bouton de validation. Mauvaise réponse : la manche **reste active**, le joueur réessaie. Bonne réponse : avance après 2000 ms. La police de la question suivante est déclarée dès son arrivée : « the feedback delay becomes a preload window ».

Trois éléments propres à cet écran : un compteur discret `{n} / {m} faces mastered`, volontairement le compte de visages maîtrisés et **pas** le niveau global que la spec garde hors de l'écran de jeu ; un toast de niveau qui n'apparaît **jamais en continu**, seulement 3200 ms quand le niveau bouge ; et un bloc de feedback à trois états.

**Le plafond de manches n'existe plus** : « TRAINING_TOTAL_ROUNDS is gone on purpose. A training session had a cap of 8. » Mais **aucune affordance ne déclenche la fin de séance** : la route existe, le bilan existe, et « the affordance that triggers it is a product decision left to the owner ». La branche `isComplete` est du code en attente.

### `/play/competition`

Le plus gros composant du repo, 1955 lignes. Mode jouable complet, avec un mode de prévisualisation par `?preview=complete`. `front-ui-master-spec.md` §2 le liste encore comme « competition placeholder route », ce qui est périmé.

### `/play/{mode}/rules`, la page unique

Reconstruite le 2026-07-30 sur les deux références nommées par le propriétaire, la landing et le profil. Trois changements structurels, chacun avec le défaut qu'il corrige :

**La page défile.** Elle était verrouillée à `100svh` avec les règles dans un panneau à défilement interne, « which cut a section title in half while black space sat below the shell ».

**Les onglets sont dans le header sticky**, pour rester atteignables pendant la lecture.

**Une seule page, cliquée dedans.** Les trois routes restent des liens profonds partageables, mais cliquer un mode ne **navigue** plus : le panneau bascule sur place et l'URL est corrigée par `replaceState`, choisi plutôt qu'un `push` parce que « switching mode is not a journey step, so it must not stack history entries ».

La navigation aux flèches a dû être recodée à la main, parce que les onglets étaient des liens avant et que « the browser gave this for free; buttons do not ».

La section `How this mode thinks` **réutilise `trainingIntroCopy.points`**, donc les règles et l'entrée du mode ne peuvent pas se contredire.

### `/profile`

Trois lectures serveur avant rendu : le CSS des polices du catalogue, les vrais tracés du logo pour le moteur de badges, et le profil réel via le cookie. Le `try/catch` retombe sur le mock s'il n'y a pas de cookie ou pas d'historique.

Deux drapeaux de construction en tête de fichier : `USE_CONSTELLATION = true` avec « Flip this to revisit the snake in 1 line », le plateau linéaire étant conservé volontairement comme repli ; et `SHOW_IDENTITY = false`, « hidden for now per request ».

### Les pages typo

`/compare` n'a aucune interface : elle corrige un bug réel, « the landing links to /compare from the hero call to action and from the footer, but only /compare/[slug] existed, so both links returned a 404 for every visitor ». Elle redirige vers le premier slug publié plutôt qu'un slug codé en dur.

`/compare/[slug]` porte trois modes de vue commandés par l'URL, `Split`, `Overlay`, `Measure`, le dernier utilisant le vrai moteur de mesure. `/type/[slug]` est la fiche spécimen complète avec testeur interactif.

Ces deux pages sont celles que le contrat de cohérence reconnaît explicitement ne pas couvrir : « leur harmonisation DA est un item ouvert ».

### Les impasses

Trois écrans partagent un seul composant dont l'en-tête déclare « Nothing visual is invented here ». Il réutilise les recettes validées et les boutons de la landing. C'est le composant qui **prouve** qu'on peut ajouter un écran sans écrire une ligne de CSS.

`global-error.tsx` **remplace le layout racine**, donc il rend son propre `html` et `body`. Son retour à l'accueil est une balise `a` nue et non un `Link`, avec justification : « the root layout is the thing that failed, so a full document load is the only reliable way back home ».

## 4.4 Le contrat de cohérence UI

`docs/ui/ui-consistency-contract.md`, mis à jour le 2026-07-29. Statut littéral, en gras : **autorité unique en matière de direction artistique**.

### Pourquoi il existe

Le document raconte sa propre cause racine. Il a été réécrit parce que la version précédente datait du 13 mars, « donc d'avant tout le travail DA de juin et juillet, et trois autres documents revendiquaient la même autorité ».

La règle qui gouverne tout : **« La landing tranche. »** Et l'aveu qui explique la dérive : « cette règle venait de l'oral et n'était écrite dans aucun document, ce qui est la cause racine de la dérive : quatre documents se disaient canoniques, aucun ne nommait la landing. »

| Rang | Document | Rôle |
|---|---|---|
| 1 | la landing elle même, dans le navigateur | la référence, elle tranche |
| 2 | `ui-consistency-contract.md` | autorité unique en cas de conflit documentaire |
| 3 | `ui-palette-reference.md` | inventaire descriptif, « ne décide rien » |
| 3 | `front-ui-master-spec.md` | routes et timings, « ne décide pas la DA » |
| 3 | `typography-system-contract.md` | typo des **spécimens**, pas de l'interface |
| 3 | `motion.md`, `gate.md`, `profile-tabs-spec.md` | contrats locaux d'un écran |

Deux documents portent désormais un encart de rétrogradation daté.

### La bichromie

« Le site est en deux couleurs, et ce n'est pas une contrainte subie, c'est l'identité. Le beige est le papier historique de la marque. »

Thème clair : fond beige, encre noire. Thème sombre : fond noir, encre beige. **« Le blanc pur est banni de tout ce que voit un joueur. »**

Vérifié : **zéro occurrence de blanc pur** dans `app/globals.css`, `features/`, `components/ui`, `components/brand`, `components/typography`. Il en reste 34 dans `components/dev` et `app/dev`, et c'est le seul reliquat.

### La typographie

**Une seule famille d'interface**, Inter, auto-hébergée en variable font. « Aucune autre famille n'entre dans l'interface. » Exception unique, **et elle est le produit** : le mot à deviner s'affiche dans la typographie cible.

**Deux régimes d'interlettrage, la signature typographique de la landing.** Grand corps en interlettrage **négatif** et interlignage serré. Petit corps en capitales, interlettrage **large positif**.

La phrase qui explique pourquoi c'est non négociable : « ce contraste, titres compressés contre labels dilatés, est ce qui donne son caractère à la page. Un écran qui pose un titre à interlettrage neutre ne ressemble pas à la landing, même avec les bonnes couleurs. »

Les huit valeurs du contrat ont été vérifiées ligne par ligne dans le CSS : **toutes conformes**.

### Les boutons

Forme pastille, hauteur minimale `2.9rem`, corps `0.96rem`, graisse 620. **Primaire égale l'inverse de la page** : pastille claire et texte sombre sur fond sombre, et l'inverse en thème clair. Et l'interdit : **« aucun jaune en aplat sur un CTA. Sans exception. »**

Vérifié : les cinq valeurs sont exactes, et le primaire s'inverse bien par thème.

### Le jaune de marque `#ffd213`

Son rôle : accent de marque, soulignement, pastille, trait de guide, état actif. Où il est réellement servi : la lueur de fond de tout le site en radial à 6 à 8 pour cent, la sélection de texte, et surtout **le focus clavier**, sur douze cibles via un unique sélecteur groupé.

Et l'écart : une seule règle CSS pose un dégradé jaune plein, utilisée aujourd'hui par le seul `/play/training`.

### La règle de couleur la plus structurante

Titre littéral : **« la couleur vit sur les contours, jamais sur le texte »**. Contours et chips peuvent porter la couleur à 24 à 36 pour cent, les fonds à 3 à 8 pour cent seulement, le texte reste neutre. « Le neutre porte la structure, la couleur ne fait que signaler. » Seule exception : le feedback interactif.

Le jeu applique cette règle **mieux que ne le décrit sa spec** : la spec annonce un aplat vert plein avec label blanc, le CSS servi met la couleur pleine sur le contour, 12 à 14 pour cent en fond, et une encre beige. Le code est conforme au contrat, la spec est périmée.

### Le thème

« Toute page pleine rend ThemeSwitch. » Puis la sanction : **« une page sans commutateur est un bug. »** Vérifié page par page : **aucune page pleine n'en est dépourvue.**

Le composant est le plus soigné techniquement du repo. Il lit le thème comme un **store externe** via `useSyncExternalStore`, pas dans un initialiseur d'état, parce que le défaut naïf faisait rendre `dark` au serveur pendant qu'un visiteur en thème clair rendait `light` au même instant d'hydratation. Et le raisonnement sur le contournement facile : « putting suppressHydrationWarning here would hide the defect instead of fixing it ». Second point subtil : « localStorage is not observable inside the tab that writes to it », donc le composant notifie ses propres écouteurs.

### Les cinq écarts mesurés, et leur état

| Écart | État au 2026-07-30 |
|---|---|
| CTA en jaune plein sur trois familles de pages | **Largement résorbé**, seul `/play/training` reste |
| Titres intérieurs sans règle d'interlettrage | **Partiellement inexact**, l'interlettrage est là, seul le plafond de taille diverge |
| Les trois couleurs de mode portent deux sens | **Ouvert, non tranché** |
| Labos `/dev` encore en blanc pur | **Confirmé**, seul reliquat |
| Le contrat ne couvre pas les pages typo | **Confirmé** |

## 4.5 Motion, et le garde qui protège un mort

### Les règles en service

Changement d'état interactif : **180 ms ease**. Entrée d'un élément : **0,6 s cubic-bezier(0.4, 0, 0.2, 1)**. Survol : élévation d'un pixel plus renforcement de l'ombre, « pas de changement de couleur brutal ».

Sur le mouvement réduit, la mise en œuvre est plus solide que la simple règle CSS : le motif répété est que **l'état final est le défaut CSS**, l'animation étant armée par JS seulement si le mouvement est autorisé. Six composants appliquent ce motif.

### `check:contracts` verrouille 19 valeurs

Le script cherche `Gate.tsx` dans deux emplacements possibles, puis applique 19 vérifications par expression régulière : 8 sur le source (l'ordre des cinq blocs, des durées littérales comme `const idleDurationMs = 1500;`, toute la chaîne de calcul du dessin au scroll, une vérification **négative** qui interdit le retour de l'ancien flux SVG) et 11 sur le CSS.

### Et le point le plus important : `Gate.tsx` n'est plus rendu

**Aucun fichier de `app/`, `features/`, `components/`, `lib/` ou `content/` n'importe `Gate`.** La spec e2e le dit noir sur blanc : « the landing no longer mounts the Gate sequence ».

Conséquences, à connaître avant de toucher quoi que ce soit :

`motion.md` et `gate.md` **décrivent tous les deux un écran mort**. `gate.md` ouvre sur « The Gate is the single-page scroll sequence that introduces the typographic experience ». C'était vrai, ce ne l'est plus.

**`check:contracts` verrouille 19 valeurs sur un composant que personne ne voit.** Le garde passe toujours, parce que le fichier existe et que le CSS n'a pas été purgé. Il est devenu un garde de conservation d'archive, pas un garde de comportement produit.

**`ScrollHint` et `ScrollMascot` sont orphelins par ricochet**, importés seulement par `Gate.tsx`. Et `gateCopy.scrollLabel` passe `check:copy` alors que rien ne le rend : le garde vérifie la référence statique, pas l'atteignabilité depuis une route.

**Tout le CSS de l'univers Gate doit rester** dans `app/globals.css`, sinon `npm run quality` échoue sur un composant mort.

## 4.6 La centralisation de la copie, et la limite du garde

`content/copy.ts` fait **53 lignes et 4 exports**, soit **19 clés pour tout le site** : `gateCopy` (1 clé, consommée par un composant orphelin), `trainingIntroCopy` (8 clés), `notFoundCopy` (5), `errorCopy` (5).

**Le garde est unidirectionnel.** Il vérifie que toute clé **déclarée** est **utilisée**. Il ne vérifie **jamais** l'inverse, qu'une chaîne rendue par un composant soit déclarée. Il ne détecte donc aucun de ces cas, tous présents : la totalité de la landing, la totalité de l'onboarding, la totalité des règles de mode, la totalité du jeu, la totalité du profil, la totalité de la compétition.

Le plan des pages d'explication exigeait trois exports. **Seul `trainingIntroCopy` a été créé.** Le contenu des règles a bien été réécrit de bout en bout, mais il est resté dans le composant.

## 4.7 Le profil, six onglets

| Onglet | Composant | État |
|---|---|---|
| Path | `ProgressConstellation`, 940 lignes | la carte du regard, branchée sur le vrai profil |
| Profile | `ProfileSummary`, 512 lignes | Œil et Arène en deux blocs séparés |
| Stats | `StatsBoard`, 621 lignes | radar des 8 axes, `const WORD = "DWIGGINS"; // axis order = the word` |
| Activity | `ActivityBoard` | série, calendrier de 30 jours, objectif du jour |
| Achievements | `AchievementsBoard` | badges branchés sur `BADGE_RULES` comme source unique |
| Preferences | `PreferencesBoard` | thème, mouvement réduit, objectif, langue |

**Deux écarts avec sa propre spec.**

Le **HUD persistant** est exigé en gras par `profile-tabs-spec.md`. Il est **écrit entièrement** puis désactivé par `SHOW_IDENTITY = false`, et le shell entier est sauté quand il ne s'applique pas.

L'onglet Profile **contredit frontalement l'avertissement de sa spec**. Celle ci écrit « pas de SR ou rang factice, ça contredit l'empty-state ». L'écran affiche un `Skill rating` numérique, un blason, une division et une place. Et comme la page ne passe pas la prop `arena`, ces valeurs sont **toujours** du mock, même pour un joueur avec un historique réel.

## 4.8 Le plan des pages d'explication

Statut déclaré : « plan écrit, rien implémenté ». Il a confronté le contenu des règles **au code du moteur**, pas à la spec, et a trouvé quatre erreurs factuelles dans les règles servies au joueur, toutes corrigées depuis.

| Bloc prévu | État |
|---|---|
| Entrée du mode Entraînement | **Fait** |
| Réécriture du contenu des règles | **Fait**, et la page a même été refondue structurellement, mais la copie n'a pas déménagé dans `copy.ts` |
| Bloc explicatif du profil (`ProgressExplainer`) | **Pas fait**, le fichier n'existe pas |

Deux points d'attention du plan qui restent vrais :

**Ne pas doubler l'onboarding.** « Cet écran est l'entrée du mode, pas une seconde introduction. »

**`/play/training` n'est pas un passage obligé**, et c'est vérifié : le joueur qui suit le parcours principal, landing puis onboarding puis jeu, **ne voit jamais** cet écran. C'est acceptable, mais il faut le savoir.

---

# Partie 5 — Le backend, la base de données et l'API

Neon Postgres via `@neondatabase/serverless`, **pas d'ORM**. Point d'accès unique : `lib/server/neon.ts`, onze lignes, `import "server-only"`, et une erreur si `DATABASE_URL` manque. Les migrations sont du SQL brut numéroté, appliquées à la main : **il n'existe aucun runner de migration dans le repo**.

## 5.1 Le schéma, table par table

Tous les enums vivent dans le schéma `app`, jamais dans `public`.

**`typefaces_core`**, le catalogue. Clé primaire `typeface_slug`, avec `activation_status` par défaut `false` et **`license_type NOT NULL DEFAULT 'unknown'`**. Ce défaut est la raison d'être de tout le garde-fou de licence : une ligne que personne n'a remplie se lit `unknown`. Quatre contraintes de cohérence sont posées **dans la table et non dans le code**, dont deux qui obligent le profil de contraste et d'ouverture à correspondre au JSON de signature structurelle.

**`font_runtime_assets`**, les fichiers réellement chargeables, avec `runtime_status` par défaut `missing` et une unicité par slug, graisse et style.

**`expert_answer_keys`**, les réponses texte du mode Expert, avec un index unique partiel qui rend impossible deux réponses canoniques pour la même typo. **Aucun code produit ne lit cette table.**

**`users`**, 16 colonnes. Trois contraintes intéressantes : un consentement analytique exige un horodatage, un rôle authentifié sans identité tierce est impossible au niveau de la ligne, et l'anonymisation exige une suppression préalable. `clerk_id` est le vestige d'un fournisseur d'auth tiers qu'aucun code n'écrit ni ne lit.

**`sessions`**, 16 colonnes, dont une colonne générée :

```sql
duration_ms int GENERATED ALWAYS AS (...) STORED
```

C'est un cas d'école du principe « stocker les faits, recalculer les dérivés » appliqué par la base elle même. Et **elle a causé un défaut réel** : la fonction de clôture écrivait `duration_ms`, Postgres refuse toute écriture sur une colonne générée, donc la clôture volontaire levait une erreur au premier appel. Constaté en base : **73 sessions d'entraînement, toutes `active`, aucune `completed`**. Un garde de la porte qualité surveille désormais cette règle.

Autre contrainte élégante : `chk_score_only_competition` rend **impossible** un score en entraînement au niveau de la ligne.

**`user_typeface_state`**, 20 colonnes, une ligne par couple utilisateur et typographie. Son index le plus important reproduit exactement la requête de sélection. `paused_until_q` n'est écrit ni lu nulle part.

**`user_event_fact`**, 24 colonnes, le journal append-only, partitionné par mois.

**Point capital : cette table n'a AUCUNE clé étrangère.** Ni vers `users`, ni vers `sessions`, ni vers le catalogue. C'est structurellement inévitable, la migration 001 précède celle qui crée `users`. Conséquence : l'ordre de suppression donné dans CLAUDE.md est de la **prudence applicative**, pas une contrainte imposée par la base.

Cinq contraintes de cohérence, dont la manœuvre centrale de la migration 001b : rendre nullables dix colonnes obligatoires pour accueillir les événements non-réponse, puis **réimposer l'obligation conditionnellement au type d'événement**. Le journal ne peut donc porter ni une réponse incomplète ni un démarrage de session bourré de champs faux.

**L'idempotence est écrite mais pas contraignante.** La clé est renseignée par tous les inserts, mais **il n'existe aucun index unique dessus**. La raison est expliquée en commentaire : sur une table partitionnée, Postgres exige que tout index unique porte la clé de partition. Le code utilise donc un `INSERT ... WHERE NOT EXISTS`.

**`event_ingestion_guard`** est une **table morte** : aucun code ne l'écrit ni ne la lit. `docs/process/backend-todo.md` la présente comme un mécanisme actif, c'est inexact.

## 5.2 Le partitionnement, et sa dette

Quatre partitions sont attachées par la migration 001, jusqu'à mai 2026, plus une partition par défaut. **Rien n'a été déclaré après mai.** Tous les événements depuis le 1er juin tombent donc dans la partition par défaut.

Ce n'est pas une panne, mais la dette a une propriété désagréable : Postgres **refuse de créer une partition dont la plage recouvre des lignes déjà présentes dans la partition par défaut**. Plus on attend, plus le déplacement porte sur des lignes nombreuses.

La migration 011 traite ce cas en **une seule transaction**, dans un ordre impératif, avec un avertissement explicite de ne pas la découper : entre la sortie des lignes et leur réinsertion, ces événements n'existent nulle part.

## 5.3 Les douze migrations et leur statut réel

`CLAUDE.md` affirme que des migrations écrites ne sont pas appliquées. C'est vrai, mais **le périmètre a changé le 2026-07-29 et le CLAUDE.md n'a pas suivi.**

Quatre traces concordantes établissent le statut : la mesure en base du 29 juillet, les marqueurs `NON APPLIQUEE` portés par les fichiers eux mêmes, une **arithmétique de colonnes** (les quatre comptes relevés en lecture seule concordent avec ce que produisent les migrations 001 à 008), et la liste des fonctions vivantes en base.

| Fichier | Ce qu'elle fait | Appliquée |
|---|---|---|
| `001` | schéma `app`, journal d'événements partitionné, 5 index, 3 partitions plus le défaut | **Oui** |
| `001b` | type d'événement, dix colonnes rendues nullables, 4 contraintes conditionnelles | **Oui** |
| `002` | 13 enums catalogue, les trois tables du catalogue, 4 vues QA | **Oui** |
| `003` | `users`, `sessions`, `user_typeface_state`, amorçage du pool, vue de résumé | **Oui** |
| `004` | familiarité d'onboarding, surcharge d'amorçage avec prior | **Oui** |
| `005` | élargit l'éligibilité d'amorçage, 25 typos étaient insuffisantes pour en seeder 30 | **Oui** |
| `006` | quotas explicites facile/moyen/difficile par niveau déclaré, sommant 30 | **Oui** |
| `007` | rebalance du pool, **strictement additive**, aucun `DELETE`, I-06 tenu | **Oui**, constaté |
| `008` | croissance du pool, seuil 3 en dur, compteur d'attente | **Oui**, constaté |
| `009` | recalcul du niveau visible, table de 25 seuils, régression bornée | **Oui**, constaté |
| `010` | ajoute la valeur `ufl`, bascule les 5 Ubuntu, vue QA en liste blanche | **NON** |
| `011` | sept partitions mensuelles de juin à décembre 2026 | **NON** |

Deux pièges d'ordre sur la 010, écrits dans le fichier : Postgres **interdit** d'utiliser une valeur d'enum dans la transaction qui l'ajoute, donc deux transactions distinctes ; et le JSON du catalogue garde volontairement `unknown` sur les cinq slugs, parce qu'écrire `ufl` avant l'étape 1 ferait échouer tout réimport, tandis que ne pas le faire après ferait repousser `unknown` par dessus.

**Nuance d'honnêteté** sur la 011 : l'élément de preuve cité dans la checklist cherche un motif de nom de partition qui ne correspond pas à la convention réelle, donc il manquerait aussi les partitions qui existent. Le statut repose surtout sur le marqueur du fichier. À confirmer en base avant toute affirmation forte.

## 5.4 Les sept routes d'API

Six `POST` de jeu, une `GET` interne. **Aucun middleware, aucune validation par schéma, aucune limitation de débit.**

**`training/session/start`** : tolérant à un corps absent, coerce la locale, n'accepte la familiarité que parmi quatre valeurs, et n'accepte le résultat de warm-up que si c'est un vrai booléen avec le commentaire « only a real boolean is a signal; anything else means no downgrade ». Elle balaie les sessions abandonnées **avant** d'insérer la nouvelle, et pose leur fin sur le dernier événement enregistré et non sur l'heure courante, parce que « the player left when they stopped answering, not when we noticed ».

**`training/answer`** : six vérifications, dont la plus importante est que l'`attempt_index` est **compté côté serveur**, donc le client ne peut pas déclarer son numéro d'essai. Trois branches d'écriture exclusives, dont la troisième matérialise I-14 : une bonne réponse après erreur n'écrit **que** la remise à zéro du compteur d'erreurs consécutives, ni promotion ni nouveau cooldown.

**Aucun contrôle de cookie sur cette route** : l'identité vient exclusivement du jeton signé. Solide contre la forge, mais un jeton et un identifiant de session valides suffisent.

**`training/session/end`** : la route la plus verrouillée, et son commentaire explique pourquoi. « IDENTITY COMES FROM THE COOKIE, NEVER FROM THE BODY. This path used to read userId out of the JSON payload, which let any caller name whoever it liked. The bilan carries personal pedagogical data, and I-15 says that data is readable by no third party. » Un identifiant dans le corps est désormais accepté uniquement pour être comparé.

L'ordre des deux écritures est délibéré et documenté sur trente lignes : les deux instructions ne sont pas dans une transaction, donc l'une peut atterrir sans l'autre. Statut d'abord puis événement **n'est pas récupérable**. Événement d'abord puis statut se répare tout seul.

**`competition/answer`** : trois vérifications propres à la compétition, dont un **anti-rejeu strict** (le jeton n'est valable que pour la position courante exacte) et la vérification serveur de la fenêtre de deux minutes.

**`competition/session/timeout`** : **aucune vérification d'identité, ni cookie, ni jeton.** N'importe qui connaissant un identifiant de session peut la clôturer et lire son bilan complet, confusions et temps de réponse inclus. **C'est le contrôle le plus faible des sept routes.**

**Il n'y a aucune route pour le mode Expert**, ni de profil, ni de leaderboard, ni de merge invité, ni d'endpoint RGPD.

## 5.5 « Le backend décide seul » : comment c'est réellement implémenté

Le principe posé : « un invariant ne doit pas être respecté par le code, il doit être **impossible à enfreindre** ».

**Le jeton de question signé** est la pièce maîtresse. La bonne réponse n'est jamais stockée dans une table de questions, elle est **portée par le jeton**, en HMAC SHA-256 avec comparaison en temps constant. Ce que cela verrouille sans aucune écriture en base : la bonne réponse, les distracteurs, le mot affiché, l'identité, et la position. Le module est **partagé** entre les deux modes.

**Le fail closed sur la chaîne de rendu** : la bonne réponse ne peut être qu'une face que l'écran sait déclarer. Les distracteurs gardent le pool complet, ce ne sont que des libellés.

**Ce que l'architecture demande et qui n'est pas fait.** Le document de rang 3 pose la proposition centrale : « aujourd'hui, la fonction décide en TypeScript d'écrire l'état. Si demain une session assignée en `observe_only` passe par un autre chemin d'appel, rien n'empêche l'écriture. Donc une seule fonction SQL porte l'écriture pédagogique, et c'est **elle** qui lit la politique. »

**Cette fonction n'existe pas.** L'écriture vit toujours dans les branches TypeScript. Le fait que la compétition n'écrive pas le mastery est aujourd'hui garanti **par omission dans le code**, non par une contrainte.

## 5.6 Le garde-fou des licences, le modèle de référence

54 lignes dont 42 de commentaire. **Liste blanche, jamais liste noire** : trois étiquettes passent, et « null, empty string, unknown, proprietary or any label added later all fail closed until somebody decides otherwise ».

**Où le filtre est posé, et pourquoi là** : dans les **deux seules requêtes qui exposent une typo à un joueur**, donc dans la couche d'accès aux données. « A guard applied at display time is a guard somebody can route around. » Point clé : les cinq fonctions d'amorçage et de croissance du pool ne filtrent **aucune** licence. Une typo sous licence inconnue peut donc entrer dans l'état utilisateur. Elle ne pourra jamais en sortir vers un joueur.

**Le détail le plus fin du dispositif**, et un bon exemple de garde pensé contre lui même : le motif de reconnaissance de la clause SQL **inclut les parenthèses**. Sans elles, une réécriture transformerait `A AND (B OR C)` en `(A AND B) OR C`, ce qui servirait les cinq slugs d'exception **même désactivés**, et le contrôle passerait quand même.

Le garde surveille aussi **sa propre péremption** : une exception devenue inutile est signalée, parce que « dead weight in a legal guard is exactly what nobody dares to delete later ».

**Un garde-fou jumeau** suit le même patron pour la couverture latine : 36 slugs qui ne portent aucune des 52 lettres latines de base, mesuré et non supposé, ce qui représentait environ 3,1 pour cent des tirages.

## 5.7 La sécurité

**`GAME_PROVIDER_SECRET`** signe les jetons, donc « whoever knows the secret can mint a token that validates any answer ». Le défaut corrigé est précis : « the fallback chain used to be GAME_PROVIDER_SECRET, then DATABASE_URL, then the literal below. A production deploy that forgot the variable therefore signed its tokens either with the database connection string or with a value committed in clear in this repository. »

Trois décisions : le repli sur la chaîne de connexion est **retiré partout**, parce que « reusing a connection string as a signing key spreads a credential into every token it signs, and it buys nothing » ; le littéral de développement reste, inatteignable en production ; le format est intouché, « changing either would invalidate every session in flight ».

**`isDevRuntime`** fait une seule ligne, et c'est une **négation** : un `NODE_ENV` absent, vide ou mal orthographié est traité comme du développement. Prudent pour le local, à garder en tête pour un déploiement mal configuré.

**La carte des trous d'identité**, route par route :

| Route | Cookie | Jeton | Session scopée par utilisateur |
|---|---|---|---|
| `training/session/start` | lu, validé | émet | sans objet |
| `training/answer` | **non lu** | vérifié | non |
| `training/session/end` | **obligatoire**, 401 et 403 | sans objet | **oui** |
| `competition/session/start` | lu, validé | émet | sans objet |
| `competition/answer` | **non lu** | vérifié, position comparée | non |
| `competition/session/timeout` | **non lu** | **aucun** | **non** |

**Ce qui n'est pas protégé** : l'anti-triche compétition (décidé, non implémenté ; les colonnes existent et ne sont jamais écrites ; le temps de réponse est accepté du client sans borne, et une mesure réelle relève une médiane de 440 ms avec un minimum de 10 ms), le RGPD (aucune route d'effacement, rétention décidée sans purge), la séparation des données de test (un passage de la suite e2e ajoute en production des lignes indiscernables d'un vrai joueur), et aucune politique de sécurité au niveau ligne.

---

# Partie 6 — Le catalogue et le dossier des licences

C'est le sujet le plus sensible du projet, et le seul bloqueur restant avant mise en ligne s'y trouve.

## 6.1 Une seule source

Le dépôt officiel `google/fonts`, dans un instantané versionné hors du repo. Le choix est argumenté : gros volume, structure cohérente, métadonnées de famille, et surtout **licences explicites par dossier**. Le même document **interdit** quatre choses : pas de dumps sans licence claire, pas de mélange propriétaire et libre sans marquage, pas de corpus massif jeté dans le dossier public, et « téléchargé » ne vaut pas « prêt au runtime ».

Distinction structurante : l'API Google Fonts sert de **veille**, la CSS API de Google **n'est pas** le moteur de rendu, et le runtime est **auto-hébergé**. Motif explicite : charger les polices depuis Google transmettrait à Google l'IP du visiteur, l'URL et les en-têtes. L'auto-hébergement est donc aussi une décision de confidentialité, **et c'est précisément elle qui crée l'obligation légale**.

## 6.2 Les cinq chiffres à ne jamais confondre

| Compteur | Valeur |
|---|---|
| Enregistrements au catalogue | **2032** |
| Typos actives | **1172**, toutes Google |
| Descripteurs d'asset runtime | **1177**, dont 1172 prêts |
| Typos **servables** (active plus asset prêt) | **1172** |
| **Typos réellement jouables** | **1136** |

Le chiffre que personne ne devine : **1136**, pas 1172. Le garde-fou latin retire des deux pools les **36 faces qui ne portent aucune des 52 lettres latines de base**. Ces 36 gardent leur place au catalogue : les reclasser est une décision de données, les désactiver serait une migration.

À rapprocher d'une phrase du document joueur, qui cite « environ 28 typos validées aujourd'hui pour une cible de 1000+ ». Ce chiffre correspond à un état antérieur du catalogue de test, pas au catalogue actuel. Le saut réel s'est joué le 2026-06-29 : conversion de toute la vague non-display, **1095 converties, 1091 prêtes, 35 Mo au lieu de 356** grâce au sous-ensemblage latin, pool passé de 81 à 1172.

Décision produit qui explique l'écart entre 2032 et 1172 : ne pas activer les 2027 brutes, parce que beaucoup de Google Fonts sont display ou fantaisie, donc du mauvais matériel pédagogique. **Le goulot n'est pas le code, c'est la curation.**

## 6.3 Comment une typo entre au catalogue

Trois couches, jamais mélangées : la machine génère des fichiers de graine, l'humain corrige dans des surcharges, un build produit les fichiers finaux. **On n'édite jamais un fichier bâti à la main.**

Ce que la machine remplit seule : slug, noms, source, chemin runtime, taille, empreinte, statut, et par défaut **inactif** et **brouillon**. Ce qu'elle ne prétend pas automatiser : catégorie, sous-catégorie, cluster visuel, palier, difficulté, rareté, signature structurelle, cartes de confusion. La règle du pipeline : **« le pipeline ne doit jamais masquer ce qu'il ne sait pas vraiment. »**

## 6.4 Le dossier licences, pour qui n'y connaît rien

### Le point de départ : un fichier de police est un logiciel

C'est la phrase fondatrice, écrite en capitales dans la checklist : « le fichier de police égale logiciel protégé. Le télécharger ou le posséder sans licence est illégal, même sans le servir ». Un précédent réel est cité, chiffré à 2 millions de dollars.

Nuance importante et souvent mal comprise : une licence **desktop** achetée autorise à rendre des **images**, et à les exploiter commercialement, sauf à montrer la totalité des caractères. D'où la stratégie pour les typos commerciales : stocker des **images de mots**, jamais les fichiers.

### Ce qu'autorise OFL

« La licence OFL autorise tout ce que fait le projet, afficher, auto-héberger, sous-ensembler en latin, publier des pages, monétiser, et n'exige aucune mention dans le pied de page du site. Sa seule condition de redistribution est que **le texte de la licence accompagne les fichiers de police**. »

Traduction : le projet peut faire tourner un jeu payant sur des polices OFL sans rien devoir à personne, à une condition mécanique près. Aucune attribution visible n'est due dans l'interface.

À savoir en plus, et que le repo ne dit qu'en passant : l'OFL interdit de vendre les fichiers **seuls**, impose que toute version modifiée reste sous OFL, et impose de **renommer** une version modifiée si la police porte un nom de police réservé. Le sous-ensemblage latin produit des dérivés, ils restent donc sous OFL et sont livrés avec leur texte, ce qui est exactement ce que fait le projet.

Deux familles servies sont sous **OFL 1.0** et non 1.1, ce qui a une conséquence technique : le contrôle ne peut pas exiger la chaîne « version 1.1 ».

### Ce qu'autorise Apache 2.0

Mêmes permissions, et c'est la **section 4** qui exige que la notice accompagne la distribution. Apache ajoute une concession de brevets et l'obligation de signaler les fichiers modifiés. Particularité mesurée et exploitée : le texte Apache **ne porte aucune ligne de copyright par famille** et est identique octet pour octet sur 38 des 41 familles concernées. C'est ce qui a permis de trancher un cas difficile sans inventer un texte.

### Ce qu'est UFL

La licence sous laquelle Canonical publie Ubuntu. **Libre, usage commercial autorisé.** Vérification faite sur l'instantané : le dossier concerné contient **exactement cinq dossiers**. Détail avec conséquence : l'instantané est lui même **incohérent sur le nom de fichier**, livrant la licence sous deux orthographes différentes. Le projet normalise donc de son côté.

### L'obligation, et pourquoi auto-héberger équivaut à redistribuer

**« Auto-héberger, c'est redistribuer. »**

Pourquoi : quand le navigateur d'un visiteur télécharge un fichier de police depuis le serveur du projet, le projet vient de **remettre une copie du logiciel** à un tiers. Ce n'est pas un affichage, c'est une distribution, exactement comme l'envoyer par courriel. Si le projet appelait la police depuis Google, il ne distribuerait rien, mais il paierait le prix de confidentialité. **L'auto-hébergement est donc un choix assumé qui crée l'obligation.**

Trois précisions pour ne pas sur ou sous appliquer la règle : le sous-ensemblage ne change rien, un dossier sans police n'a rien à licencier, et une police non hébergée sort du périmètre.

## 6.5 Le seul bloqueur : PP Frama

Trois fichiers `.otf`, tous datés du 14 juin. La table de noms lue avec `fontTools` confirme au caractère près ce qu'affirme la documentation : copyright Pangram Pangram, **licence déclarée « Pangram Pangram EULA »**, URL de licence vers leur page EULA.

**Il y a en réalité trois problèmes empilés, et la documentation n'en nomme que deux.**

**Un, la licence webfont.** Un EULA de fonderie distingue presque toujours l'usage **desktop** de l'usage **webfont**, et le second se paie séparément, souvent au volume de pages vues.

**Deux, l'absence de texte à livrer.** Contrairement aux trois licences libres, cet EULA **n'est pas distribué avec les fichiers**, il vit sur une page web. Il n'y a donc **rien à recopier**.

**Trois, non écrit dans les documents** : les fichiers servis sont les **`.otf` desktop d'origine**, non convertis, non sous-ensemblés, **publiquement téléchargeables** par n'importe qui puisque le dossier est servi statiquement, et **suivis par git**. Livrer l'OTF original est le pire cas de figure : c'est la distribution du logiciel complet, pas d'un dérivé web.

**Nuance de précision à corriger dans la documentation** : la formule « servie à tous les visiteurs » est plus large que la mesure. Le `@font-face` n'est déclaré que sur les écrans de profil et de badges. En revanche les trois fichiers sont accessibles à qui connaît l'URL, sur toutes les pages. La qualification de bloqueur reste entièrement justifiée, mais pour une raison légèrement différente.

**Les quatre sous-tâches sont toutes non cochées.** Ce qui **a** été fait, et ce n'est pas rien : le sujet a été rendu **impossible à oublier**, avec une note affichée à chaque passage de la porte qualité. C'est le seul bloqueur légal qui bénéficie d'un rappel automatisé.

**Non documenté** : aucune trace d'un devis, d'un tarif, d'un contact avec la fonderie, d'une preuve d'achat antérieure, ni d'un candidat libre de remplacement.

**Trois sorties.** Acheter la licence webfont, puis livrer les fichiers **webfont** fournis par la fonderie et non les OTF desktop. Remplacer par une police libre, ce qui touche à l'identité de marque et relève exclusivement du propriétaire. Ou, piste non écrite dans le repo : **convertir le logo en SVG tracé** et retirer les fichiers de police, un logo tracé n'étant plus une redistribution de logiciel. Le deck de présentation utilise déjà un wordmark en SVG. À confronter à l'EULA réel avant de retenir, la clause de conversion en contours variant d'une fonderie à l'autre.

## 6.6 Ce qui n'est plus un bloqueur : les 23 typos

**C'était un trou de données, pas une police douteuse.** La cause est mécanique : la colonne est déclarée avec `unknown` par défaut, donc une ligne que personne n'a remplie se lit `unknown`. Les 23 concernées étaient les plus anciennes du catalogue, celles du lot d'origine.

Toutes portaient la source Google. Vérification faite contre l'instantané : **les 23 sont dans le dossier OFL**, libre, usage commercial autorisé. **Le risque juridique était nul depuis le début, la donnée seule était muette.**

Tranché le 2026-06-29, commit `0584549`, dont le message dit : « Only the 5 Ubuntu-family faces remain unknown (they are UFL = libre, but the license_type enum has no ufl value). No legal risk. »

**Le point méthodologique à retenir** : la correction est passée par la surcharge **et** par le rebuild, pas seulement par un `UPDATE` en base. Sans cela, un réimport aurait repoussé `unknown` par dessus. C'est exactement le piège qui reste ouvert sur les cinq Ubuntu.

## 6.7 Les 1177 fichiers de licence

**État avant correction, mesuré et non estimé** : 1179 dossiers, **un seul fichier de licence dedans**. Deux autres résultats étaient des faux positifs, deux polices dont le nom contient les lettres du mot.

**1177 fichiers posés** : 1154 OFL, 18 Apache, 5 UFL.

**La règle centrale, la plus importante du dossier** : chaque texte est **recopié octet pour octet depuis l'instantané, jamais rédigé ni reformulé**. « Nothing is generated, so no legal document can be paraphrased by accident. » Un document juridique paraphrasé par accident n'a plus de valeur.

Deuxième règle : **un nom de fichier stable par licence**, parce que l'instantané est incohérent. Troisième : l'appariement se fait sur les seules lettres et chiffres, ce qui apparie **1176 slugs sur 1176, zéro orphelin, zéro collision**.

### Le cas difficile : `robotomono` et ses cinq jumeaux

Le problème : dans l'instantané, cette famille est **dans le dossier OFL avec son texte OFL**, mais sa fiche de catalogue **déclare Apache**. Deux sources primaires se contredisent.

Décision : **OFL, parce que trois sources primaires disent OFL contre une**. La police que nous servons **déclare elle même** l'OFL dans sa table de noms, le texte de l'instantané ouvre sur le copyright exact de cette police, et le catalogue dit OFL. Seule la fiche de catalogue de Google dit Apache.

Puis, et c'est ce qui fait la qualité du traitement, **un balayage des 1176 a cherché les mêmes cas au lieu de traiter le seul cas connu**. Cinq jumeaux trouvés, tous entre deux licences permissives.

**Règle uniforme retenue pour les six : livrer le fichier que Google livre avec la famille**, donc redistribuer sous les termes sous lesquels nous avons reçu la police. Trois qualités : aucun texte n'est fabriqué ; comme les deux licences autorisent ce que fait le projet, la divergence **ne change pas ce qui est permis**, seulement la notice ; et la règle est appliquée par construction, pas par une liste d'exceptions.

### Les deux familles sans aucun fichier de licence

Une source explicite a été désignée pour chacune, avec son raisonnement écrit dans le script. La première reprend le texte d'une autre famille, parce que c'est **la même famille sous l'ancien nom de dossier de Google**, et que sa ligne de copyright est **octet pour octet** celle embarquée dans la police servie. Les six faces de la seconde reprennent un texte Apache, parce qu'elles déclarent Apache, ne portent aucune chaîne de licence, et que ce texte est identique sur presque toutes les familles concernées.

Ces sept sources choisies à la main restent **dans un seul fichier**, avec la raison de chaque choix : les décisions juridiques n'ont **qu'un seul domicile**.

## 6.8 Les garde-fous, et ce qu'ils gardent

Quatre contrôles gardent la légitimité et l'utilité d'un fichier de police, chacun avec une **question distincte** :

| Contrôle | Question |
|---|---|
| `check:license-guard` | la licence est-elle autorisée |
| `check:font-licenses` | le texte de licence est-il livré |
| `check:latin-coverage` | la police a-t-elle l'alphabet latin |
| `check:font-renderable` | l'écran sait-il l'afficher |

Le quatrième est né d'un angle mort trouvé le 2026-07-29 : « trois checks gardaient la légitimité du fichier, aucun ne vérifie que la police est atteignable par l'écran qui en a besoin. **La chaîne était gardée partout sauf au dernier maillon.** »

Comment le contrôle de texte lit une licence, **sans jamais la comparer octet à octet** : un plancher d'octets par licence, volontairement bien sous les tailles réelles ; **deux marqueurs dont le second est la phrase de clôture**, donc un fichier coupé en deux échoue même si ses premières lignes ont l'air correctes ; et un croisement avec le catalogue, un texte Apache dans un dossier déclaré OFL faisant échouer la porte.

**Deux gardes ajoutés parce qu'un fichier de configuration peut mentir là où un littéral ne pouvait pas** : le contrôle **refuse de tourner** si aucune licence ne déclare de bloc de vérification, « the one failure mode a guard must never have », et si un dossier est déclaré hors périmètre sans condition ni note, « a licence exception nobody can see is how the original defect got shipped in the first place ». Le second cas a été trouvé **en le testant**, pas en le supposant.

Quatre contre-épreuves ont été jouées à la création du contrôle, chacune restaurée ensuite.

## 6.9 Les cinq polices système

Ce sont les cinq seuls enregistrements locaux et propriétaires. **Leur statut légal est propre** : toutes désactivées, et surtout **elles n'hébergent aucun fichier**, donc rien n'est redistribué et l'obligation ne les concerne pas. Le projet ne possède pas ces fichiers.

Elles sont bloquées trois fois : le garde-fou refuse `proprietary`, l'inactivation les exclut du pool, et l'importeur saute volontairement leurs lignes.

**Ce qui reste est une décision produit, pas un risque légal** : les remplacer par du libre avant lancement, sinon cinq typographies parmi les plus enseignables du monde manquent au jeu. Des substituts libres sont déjà recommandés pour chacune, la plus délicate étant Helvetica, et la question de fond est posée : fidélité de substitution ou personnalité éditoriale.

## 6.10 Ce qui reste ouvert

**La migration 010**, avec ses deux pièges d'ordre. Effet secondaire heureux de son application : l'exception Ubuntu du garde-fou devient inutile, et le contrôle le signalera de lui même.

**`foundry` et `release_year` laissés vides, choix assumé.** Le raisonnement est un bon exemple de refus de fabriquer de la donnée. Pour la fonderie : le seul champ disponible nomme une **personne** et non une fonderie, et le champ de copyright n'est pas exploitable en masse, sur 2027 enregistrements **1296 disent « The X Project Authors »**, 560 nomment une personne, et **146 seulement** portent une raison sociale noyée dans du texte libre. Un remplissage automatique produirait de la fausse donnée. Pour l'année : le champ disponible est la date de mise en ligne chez Google, pas l'année de dessin, et la renseigner **daterait Libre Baskerville de 2012** au lieu du XVIIIe siècle.

**La proposition de schéma, à trancher** : plutôt que tordre les deux champs, ajouter une colonne honnête pour la date d'ajout chez Google, et finir de remplir le champ de dessinateur, déjà rempli sur 1979 sur 2032, avec **zéro divergence** avec les valeurs en place, ce qui rend l'opération sûre. Constat annexe : **les 23 slugs d'origine sont les seuls à avoir un dessinateur vide** alors que l'instantané en donne un. Le même lot que les 23 licences, ce qui confirme que ce lot n'a jamais reçu de passe de métadonnées.

## 6.11 La contradiction sur la licence posée à la conversion

Il y a bien une contradiction, **et son sens est l'inverse de ce qu'on suppose** : ce n'est pas une case cochée démentie par une note, c'est une **case non cochée démentie par une note qui déclare la chose faite**.

La sous-case dit non fait. La note du même item raye l'énoncé et le déclare **fait le 2026-07-28**. **La note dit vrai, la case dit faux**, et trois corroborations l'établissent, dont la lecture du code : la conversion appelle bien le script de licence en échec fermé, et sort en erreur en nommant les slugs fautifs. Les commits existent et sont sur la branche principale.

**Contradiction secondaire dans la même zone** : la règle de lecture du document dit qu'une ligne avec des sous-cases est cochée quand toutes ses sous-étapes le sont. L'item parent **est coché** alors qu'une de ses sept sous-cases ne l'est pas. Le parent viole donc sa propre règle de lecture.

**Pourquoi ça mérite réparation immédiate.** L'enjeu n'est pas cosmétique. La distinction que porte cette ligne est celle entre un **filet** et une **source** : le contrôle attrape une police livrée sans licence, mais **après coup**, une fois la vague déjà copiée et committable, tandis que la conversion empêche le défaut d'exister. Laisser la case décochée fait croire que le prochain import massif peut encore produire des polices sans licence, ce qui est faux, et pousserait quelqu'un à refaire un travail déjà fait et déjà prouvé.

---

# Partie 7 — Comment le projet est fait et comment on y travaille

## 7.1 La pile technique

Versions figées, sans accent circonflexe, sur les paquets qui comptent : **Next.js 16.1.6**, **React 19.2.3**, `eslint-config-next` aligné sur Next. Puis Tailwind 4 via PostCSS uniquement, sans fichier de configuration, GSAP, et le pilote Neon serverless.

Points de configuration à connaître : **TypeScript strict** avec `noEmit`, Turbopack, et **Playwright installé comme paquet simple** et non comme `@playwright/test`, le lanceur de tests vivant dans un sous-chemin du paquet déjà installé, « so no extra dependency is required ».

`fontkit` ne sert **qu'aux contrôles qualité**. Un environnement Python existe en parallèle pour le pipeline catalogue, avec 24 scripts.

**Aucune version minimale de Node n'est documentée** : pas de champ `engines`, pas de `.nvmrc`. Mais des contrôles utilisent le dépouillement de types expérimental et de l'`await` au niveau racine, ce qui impose un Node récent en pratique.

## 7.2 Démarrer quand on arrive

```bash
npm run dev        # 127.0.0.1:3000, vide .next/dev au passage
npm run dev:clean  # idem mais vide tout .next, quand le cache est suspect
```

**Le piège du port.** Le port canonique est 3000, codé en dur dans les scripts et dans la configuration Playwright. Mais certaines sessions lancent une seconde instance sur le **port 3002**, et le propriétaire regarde souvent celle là. **Vérifier quel port tourne avant de conclure qu'une page est cassée.** Deux instances peuvent tourner en même temps.

**Trois variables d'environnement seulement** sont lues par le code produit : `DATABASE_URL`, obligatoire tout de suite, le module levant à l'import s'il ne la trouve pas ; `GAME_PROVIDER_SECRET`, obligatoire en production seulement ; et `NODE_ENV`, géré par Next.

**Le piège numéro un, et il n'est documenté nulle part** : `.env*` est ignoré par git, donc **une personne qui clone n'a aucun `DATABASE_URL`**, et le module de base lève à l'import. Comme la porte qualité finit par un build qui charge les modules de route, **la porte elle même est concernée**. Ni le README, ni CLAUDE.md, ni le guide de démarrage ne disent comment obtenir un `DATABASE_URL` de départ. **C'est le premier trou d'accueil à combler.**

**Autres pièges.** Le lint est en **tolérance zéro**, un simple avertissement casse la porte. Un script exige un environnement Python **déjà créé**, dont la procédure de création et la liste des paquets **ne sont pas documentées**. Et un hook est configuré : après tout écrit sur un fichier TypeScript, un typecheck se relance en arrière-plan et **bloque** en cas d'erreur.

## 7.3 La porte qualité : 18 étapes, pas 15

Compté sur la valeur réelle : **18 étapes**, soit `lint`, `typecheck`, **15 contrôles maison**, et `build`. `scripts/quality/` contient exactement 15 fichiers de contrôle. **La correspondance est de un pour un : aucun contrôle écrit n'est laissé hors de la porte.**

### L'arbitrage sur l'écart

**CLAUDE.md dit 15, et il avait raison au moment où il a été écrit.** La preuve est dans le diff : les trois contrôles manquants sont ajoutés dans du travail **non commité**, et leurs trois fichiers sont **non suivis par git**.

La chronologie est nette : la porte faisait 15 étapes au dernier commit, et trois contrôles ont été ajoutés dans le répertoire de travail depuis, sans commit ni mise à jour de la documentation. **CLAUDE.md est périmé de trois lignes, pas faux à l'origine.**

**Une deuxième phrase de CLAUDE.md est cassée par le même écart.** Elle décrit « les cinq derniers contrôles avant `build` » en les énumérant. Dans la version à 18, les cinq derniers ne sont plus les mêmes. La désignation positionnelle ne colle plus, même si les cinq règles décrites existent toujours.

**Un troisième endroit est encore plus ancien** : un commentaire de la configuration Playwright parle des « 8 home made checks ». Il y en a 15.

### La culture qui traverse les 15 contrôles

Chaque script porte en tête un commentaire qui nomme **le défaut réel dont il est né**. C'est la convention la plus visible du dépôt : **un contrôle n'est pas une bonne pratique, c'est la cicatrice d'une erreur déjà commise.**

| Contrôle | La règle protégée, et le défaut qui l'a créée |
|---|---|
| `check:artifacts` | Les artefacts de plateforme et les brouillons locaux ne rentrent jamais dans l'historique |
| `check:compat-bridges` | **Ne vérifie rien aujourd'hui, et c'est intentionnel.** La liste est vide et le contrôle reste dans la porte : « a bridge that comes back must come back as a thin re-export and be declared here, which is what makes the temporary nature of the pattern **enforceable rather than aspirational** » |
| `check:dev-routes` | Le labo interne ne fuit jamais en production. **Trois passes, la troisième ajoutée après un défaut réel** : un composant dev monté depuis l'arbre produit, rendu sur toutes les pages, en production aussi. Il suit les chaînes d'import jusqu'à six sauts, « a file reached through a bridge is mounted just as much as one imported directly » |
| `check:runtime-boundaries` | La frontière produit et labo. Une exemption se donne **fichier par fichier, jamais par préfixe** |
| `check:copy` | La copie déclarée est vraiment utilisée. Porte **trois corrections documentées**, dont le retrait de `docs` du périmètre de recherche : « a key nobody renders is dead copy, whether or not the documentation mentions it » |
| `check:contracts` | 19 valeurs de motion verrouillées, dont des durées littérales et une vérification **négative** interdisant le retour de l'ancien flux |
| `check:typography-contract` | Le contrat du corpus typo, à trois sévérités et codes stables. **Un avertissement passe la porte silencieusement** |
| `check:license-guard` | Ne servir que des licences validées, **dans la requête et pas à l'affichage** |
| `check:font-licenses` | Le texte de licence voyage avec les fichiers. Et le **rappel permanent** sur le bloqueur de marque |
| `check:latin-coverage` | Ne jamais poser une question sur une police que le navigateur ne dessine pas. Vérifié **dans les deux sens** |
| `check:font-renderable` | La chaîne entre le moteur et l'écran. Né de l'écart le plus grave : « **answerable only by luck** » |
| `check:session-lifecycle` | Six sections, dont deux découvertes après coup. Il **retire les commentaires avant de scanner**, parce que « a guard that fires on its own documentation is a guard people learn to ignore ». Et il **exécute réellement** la logique de bilan sur des données synthétiques |
| `check:misread-truth` | La table de faits ne déclare jamais un affichage qui n'a pas eu lieu. **Auto-libérant** : le jour où le contenu existe, l'exigence tombe |
| `check:token-secret` | **Exécute le vrai module dans des sous-processus** avec un environnement forcé. Quatre cas, dont un qui vérifie que l'ancien repli est « gone and not merely reordered », parce que « the deploy that forgets the secret is exactly the deploy that has DATABASE_URL set » |
| `check:event-partitions` | Les partitions suivent le calendrier. **Et il est honnête sur sa limite** : « what it cannot know: whether the migration was applied. It therefore reports the files it read and repeats their own marker **rather than pretending** » |

**Un seizième script, hors porte**, ne sort jamais en échec : il **classe** le travail non commité en quatre catégories, avec une règle d'assemblage écrite pour que les commits de rangement ne mélangent pas les natures.

## 7.4 Les tests, et le danger réel

Une seule suite, Playwright de bout en bout, cinq fichiers. Un seul travailleur, pas de parallélisme, parce que « the dev server is a single shared instance and the training journey writes a guest session ». Rapporteur en liste seulement, « on purpose: the HTML reporter would write a report directory into the working tree on every run ».

### Le point capital

**La porte qualité ne lance pas les tests.** Une personne qui arrive doit comprendre que « quality vert » **ne veut pas dire** « le produit marche dans un navigateur ». Les deux garde-fous sont indépendants.

### Le danger, précisément

Trois éléments à tenir ensemble.

**Ce n'est pas une base de test.** La variable pointe aujourd'hui sur la production.

**Les lignes écrites sont indiscernables d'un vrai joueur.** Aucun marqueur, aucun drapeau de test. Une fois écrites, elles polluent les statistiques sans qu'on puisse les retrouver autrement que par leur horodatage.

**Le nettoyage est contraint.** Les clés étrangères imposent un ordre strict de suppression. Le mauvais ordre échoue, ce qui est le bon comportement mais rend le rattrapage laborieux.

### Le double refus, et pourquoi il est double

Sans l'opt-in, le garde lève **et** la configuration **retire le serveur** : « Playwright runs its plugins, the web server among them, before global setup, and a refused run has no reason to spend three minutes on a cold start ».

Détail soigné : le message de refus n'affiche **jamais** la chaîne de connexion brute, seulement l'hôte et le chemin, « never the raw value: it carries a password ».

### Le piège le plus vicieux du dispositif

**Playwright ne lit pas le fichier d'environnement local**, donc une variable absente de votre shell **ne dit rien** de ce que voit le serveur de dev. Votre shell peut n'avoir aucune variable, le message de refus dira « not exported in this shell », et le serveur écrira quand même dans la base du fichier local. **La seule protection fiable est de changer la valeur dans le fichier, pas dans le shell.**

### Ce qui n'est pas testé

**Aucun test unitaire ni d'intégration.** La seule logique produit exécutée par la porte est l'auto-test du bilan de séance. Le mode compétition n'a aucun test de bout en bout. Deux pages sont exclues des tests d'accessibilité parce qu'elles écrivent en base, une troisième par décision du propriétaire.

Et le plan de tests du dossier process **n'est pas un plan de tests automatisés** : c'est un protocole de **test utilisateur**, trois à cinq personnes, dix à quinze minutes, une seule question à valider, « est-ce compris et est-ce que ça donne envie », avec un périmètre explicitement exclu.

## 7.5 Le dépôt et ses trois natures de travail

Le dépôt mélange trois natures, **volontairement**, et « the goal is not to remove that lab surface, but to keep the boundaries explicit **so the repo stays safe to ship** ».

**Le code produit.** Règle : « anything under `app/`, `components/`, `features/`, and `lib/` should be assumed production-facing **unless clearly marked otherwise** ».

**Le labo typo interne.** Sept règles, dont la dernière est la plus importante : « if a dev-only utility becomes part of the product experience, **move it out of the dev tree and remove the dev guard** ». Le raccourci mental donné aux nouveaux : « si tu vois `dev` dans le chemin, méfiance ».

**Les artefacts de recherche.** Le corpus de profils est « a versioned corpus area, **not a scratch directory** ». Le dossier de sauvegardes est « archive-only ». Et pour la documentation : « `docs/` should describe durable system behavior, contracts, or operator workflows. **Temporary notes should not become permanent by default.** »

**Le gel actif** est la frontière la plus dure, répétée dans trois fichiers **et outillée** : le dossier d'onboarding est exclu d'un contrôle et classé en catégorie dédiée par le rapport de répertoire.

**La règle d'arrêt** : « si un fichier n'appartient clairement ni au produit, ni au labo, ni au corpus versionné, **s'arrêter et le classer avant de committer** ».

## 7.6 Les conventions

**Nommage** : noms courts et explicites qui portent le domaine, plutôt que des noms génériques.

**Écart réel à connaître** : la structure de dossiers documentée décrit **partiellement une organisation passée**. Le dossier de composants de section **n'existe plus**, ils vivent maintenant par domaine fonctionnel, et un contrôle porte encore la trace du déménagement en cherchant un fichier dans deux endroits.

**La copie centralisée** est un principe **en cours d'application, pas un état atteint** : quatre blocs seulement, 19 clés pour tout le site.

**Le style d'écriture du code, tel qu'il se pratique.** Ce n'est pas dans une doc, c'est dans les fichiers, et c'est la convention la plus forte du dépôt : **chaque garde-fou, chaque contrat, chaque exception porte en commentaire le défaut qui l'a provoqué et la raison de sa forme.** Les 15 scripts qualité sont écrits comme des dossiers d'instruction.

Cette convention est **opérante** : une personne qui ajoute un garde-fou sans écrire pourquoi produirait du code qui ne ressemble pas au reste.

## 7.7 Les règles de travail du propriétaire

Elles valent pour tout le travail sur ce dépôt.

**Consigner l'avancement.** Chaque action se note dans la checklist **avec une phrase qui explique pourquoi**. « C'est ce qui évite de se perdre entre deux sessions. »

**Pas d'emojis.** Nulle part.

**Pas de tiret comme séparateur** dans les textes rédigés.

**La direction artistique appartient au propriétaire, entièrement.** Règle posée le 2026-07-29, et c'est la plus étendue. Sont de son ressort exclusif : les couleurs et leurs proportions, les espacements, les tailles, les alignements, les rayons, les ombres, les animations, la typographie visuelle, la hiérarchie graphique, le rythme, l'équilibre des masses, l'identité de marque, et **toute décision esthétique**. « On peut signaler un problème ou proposer une piste, on ne la valide jamais et on ne l'implémente jamais sans son accord explicite. »

Ce qui **reste ouvert** sans accord préalable : penser l'interface sous un angle **fonctionnel et systémique**. Organisation, parcours, hiérarchie de l'information, incohérences UX, proposition d'un composant ou d'un comportement qui améliore le produit.

**Référence en cas de doute** : la landing tranche.

**Pas de captures d'écran de vérification.** Le propriétaire regarde le site en live.

**Décider et avancer.** Ne pas demander validation à chaque étape. **Les seules exceptions sont les migrations en base et tout ce qui touche à la DA.**

**Toute migration sur la vraie base demande le feu vert explicite du propriétaire.** La voie à privilégier est une branche de base jetable.

## 7.8 Le workflow de sécurité, et son sinistre fondateur

Le rituel : lancer un checkpoint, créer un commit de checkpoint avant expérimentation majeure, travailler en branche dédiée pour les passes visuelles risquées, et **pousser sur GitHub dès que possible**.

**Ce document contient une affirmation devenue fausse** : il dit que le dépôt n'a aucun remote configuré. Le remote existe, et la branche principale le suit.

À noter aussi la liste de ce qui ne fait pas foi : « what not to trust alone: Cursor history, hot reload state, build output, browser cache ». **Cette liste existe pour une raison.** Le journal du 2026-03-22 raconte que la feuille de style principale s'est effondrée en un template générique et **n'a pu être restaurée ni par git, ni par l'historique de l'éditeur, ni par les caches de build**. Elle a dû être **reconstruite**. C'est le sinistre fondateur de tout le dispositif de sécurité du dépôt.

## 7.9 L'état git

**Trois worktrees actifs.** L'un est vide : même commit que la branche principale, aucune différence, aucun commit propre, répertoire propre. **Il n'y a rien à fusionner.**

L'autre contient **deux commits de travail réel**, et il est 2 commits devant mais **43 commits derrière** la branche principale. Son apport : la direction artistique beige portée sur les pages typo via des composants d'en-tête et de pied de page partagés, plus des blocs « à quoi sert cette page » en français.

**Ce travail n'est pas dans la branche principale, et il a été refait autrement.** Le répertoire de composants qu'il crée **n'existe pas** dans la branche principale, qui a résolu **le même besoin** avec une implémentation différente et un autre nom de fichier.

**Conséquence pratique importante** : cette branche **ne se fusionne pas telle quelle**. Elle est en concurrence frontale sur trois fichiers, et elle réintroduirait un couple de composants là où la branche principale en a un seul. Le seul apport qui semble sans équivalent est le second commit. Elle touche aussi la checklist, **massivement réécrite depuis** : conflit garanti.

### Le travail non commité, et c'est le point le plus important de cette partie

**36 fichiers modifiés, 12 non suivis, 1731 insertions et 849 suppressions.**

Ce qui n'existe **que sur ce disque** :

- le **document de vision produit**, rang 1 de la hiérarchie documentaire
- le **document d'architecture backend**, rang 3
- **la checklist elle même**, source de vérité de l'avancement
- la réparation de la chaîne moteur vers affichage
- la fin de séance explicite, sa route et son bilan
- les **trois nouveaux contrôles** de la porte qualité

**Ce n'est pas un dépôt sale par négligence, c'est un chantier cohérent qui tient debout ensemble.** C'est précisément ce qui rend sa perte coûteuse.

**Trois conséquences documentaires de cet état** : CLAUDE.md annonce 15 étapes parce que les trois nouvelles ne sont pas commitées ; les documents de rang 1 et 3 sont non suivis alors que le sommaire les cite comme faisant autorité ; et la source de vérité de l'avancement **n'existe que sur ce disque**.

---

# Partie 8 — L'état réel au 2026-07-30

Cette partie ne contient rien de nouveau, elle rassemble ce que les sept lectures ont trouvé, classé par ce qu'il faut en faire.

## 8.1 Le risque le plus urgent, et il n'est pas légal

**Tout le chantier en cours existe sur un seul disque, non commité, non poussé.** Voir 7.9. Le remote existe, rien n'empêche de committer, et ce projet a **déjà perdu du travail une fois**.

Rien d'autre dans ce document n'est plus urgent que ça.

## 8.2 Le seul bloqueur de mise en ligne

**PP Frama**, la typographie du logo, servie sans licence webfont vérifiée, sous forme de fichiers desktop d'origine publiquement téléchargeables et suivis par git. Voir 6.5. Quatre sous-tâches ouvertes, aucune trace de devis ni de contact avec la fonderie.

**Et ce qui n'est plus un bloqueur** : les 23 typographies en licence inconnue, réglées depuis le 2026-06-29. Un trou de données, pas un risque légal.

## 8.3 Ce qui est cassé pour le joueur

**Le lien vers un concept mène à un 404.** La route n'existe pas, la page de comparaison y renvoie, et le seul concept publié a un contenu pédagogique rédigé que **personne ne peut lire**. Voir 2.8.

**Les annotations locales du stade lettre ne s'affichent jamais**, alors que le mode lettre est l'échantillon par défaut du stade concerné. Voir 2.8.

**Trois chiffres affichés à côté des zones de focus ne sont pas des mesures**, ce sont des proportions fixes. C'est le seul endroit où le projet enfreint sa propre règle contre la fausse précision.

**Aucune affordance ne déclenche la fin de séance.** La route existe, le bilan existe, le plafond de manches a été retiré, mais rien à l'écran ne permet de terminer une séance. C'est une décision produit explicitement laissée au propriétaire.

## 8.4 Les décisions qui attendent le propriétaire

| Sujet | Nature |
|---|---|
| Statut des deux specs du moteur sans en-tête | documentaire, urgente |
| Type Cards : bloquante ou non, et quand l'afficher | produit, volontairement parkée |
| Écarts 6 et 7 de l'audit du 29 juillet | produit |
| Migrations 010 et 011 | feu vert base, avec pièges d'ordre |
| Collision sémantique des trois couleurs de mode | direction artistique |
| Taille des titres intérieurs contre la landing | direction artistique |
| Le jaune plein restant sur un écran | direction artistique |
| Le fond noir non documenté d'une page spécimen | direction artistique |
| Politique de progression du mode Expert | produit |
| Champs de fonderie et d'année, et la colonne proposée | schéma, donc migration |
| Remplacement des cinq polices système propriétaires | produit |
| Sort de la branche beige non fusionnée | technique |

## 8.5 Les corrections documentaires, sans arbitrage nécessaire

Ces points sont des faits, pas des choix. Ils peuvent être corrigés sans rien décider.

**CLAUDE.md** annonce 15 étapes de porte, il y en a 18, et trois contrôles manquent à sa liste. Sa phrase sur « les cinq derniers contrôles » ne colle plus. Sa phrase sur les migrations non appliquées ne vaut plus que pour deux d'entre elles.

**La checklist** coche un item parent dont une sous-case n'est pas cochée, en violation de sa propre règle de lecture, et cette sous-case est démentie par une note du même item.

**Le document de niveau global** porte un statut faux et une formule périmée.

**Le document de workflow de sécurité** affirme qu'il n'y a aucun remote configuré.

**Le registre des contradictions** contredit son propre arbitrage sur une entrée, se trompe d'attribution sur une autre, et **la numérotation des invariants ajoutés est annoncée fausse dans quatre fichiers**.

**Le document de motion et celui de la séquence d'intro** décrivent tous deux un écran qui n'est plus monté.

**Trois documents d'interface** décrivent des pages ou des classes qui n'existent plus.

**Le document de métriques typo** annonce une sonde de hauteur de capitale différente de celle du code, et la lettre réellement utilisée est celle que le projet déclare inapte à servir de référence unique.

**Le plan de réalisation front** est périmé sur un point, l'écart qu'il décrivait ayant été levé depuis.

**Un document décrit un mécanisme anti-doublon comme actif** alors que la table concernée n'est lue ni écrite par personne.

**La procédure d'obtention d'un accès base pour un nouvel arrivant n'est documentée nulle part**, et c'est ce qui empêche un clone neuf de démarrer.

## 8.6 Ce qui est solide, et qu'il ne faut pas toucher

Il serait malhonnête de finir sur une liste de défauts. Voici ce qui, dans ce projet, est meilleur que la moyenne.

**Le moteur pédagogique est conforme à sa spec, vérifié fonction par fonction, et la consigne est explicite : il ne doit pas être réécrit.**

**Les garde-fous sont posés au bon endroit**, dans la requête et non à l'affichage, ce qui les rend impossibles à contourner même par une fonction d'amorçage qui ne vérifie rien.

**Les contrôles sont pensés contre eux mêmes** : un motif qui inclut les parenthèses SQL pour qu'une réécriture ne puisse pas inverser la logique, un garde qui retire les commentaires avant de scanner, un garde qui refuse de tourner s'il ne trouve rien à vérifier, un garde qui signale sa propre péremption, et un garde qui **exécute le vrai module** au lieu de lire son texte.

**Le système de mesure typographique est rigoureux** : rasterisation réelle, détection de contact stable à 75 pour cent pour ne pas poser un guide sur un artefact d'antialiasing, résolution par glyphes témoins, tolérances asymétriques qui distinguent un débord optique attendu d'une erreur, et des bancs de régression qui montent **le composant réellement livré**.

**La documentation explique ses causes racines.** Le contrat de cohérence UI nomme la sienne. Les scripts nomment le défaut qui les a créés. Les décisions parkées disent pourquoi elles le sont : « ce n'est pas une hésitation, c'est un refus de geler prématurément. »

**Et le projet refuse de fabriquer de la donnée.** Le raisonnement sur les champs laissés vides, mesuré sur 2027 enregistrements avant de conclure, est le meilleur exemple d'une discipline rare : préférer un champ vide à un champ faux.

