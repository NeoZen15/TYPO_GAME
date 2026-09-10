# Spécification produit — la création d'exercice

**Rang 4, fermée.** Applique la vision (`game/vision-produit-dwiggins.md`), la spec moteur (`game/training-engine-spec-v2-clean.md`) et l'architecture backend (`game/architecture-backend.md`). Ne redéfinit rien au dessus d'elle. Chaque point porte une **règle tranchée** : il n'y a plus de question produit ouverte dans ce document, seulement une liste courte d'arbitrages en section 20, chacun avec sa recommandation.

Remplace le brief du 2026-09-10, même chemin, même sujet, refermé. Écrit le 2026-09-10. Tout ce qui est affirmé sur l'existant a été mesuré dans le code, pas supposé.

---

## 1. Le principe, et les deux couches

Le professeur exprime une **intention pédagogique**. DWIGGINS conseille, explique, préremplit. Le professeur peut tout modifier.

Toute la spécification tient sur une distinction, et c'est elle qu'il faut retenir avant tout le reste.

**LE CONTRAT** est ce que le professeur donne, et il est **commun à toute la classe** : le périmètre (familles et typographies visées), le mix, la bande d'exigence, le nombre de questions, le mode, la politique de progression, la fenêtre d'ouverture. Deux élèves d'une même classe reçoivent le même contrat, toujours.

**L'ADAPTATION** est ce que le moteur fait **à l'intérieur** du contrat, élève par élève : quelles faces du périmètre reviennent, dans quel ordre, et à quel point les mauvaises réponses sont proches. Elle consulte l'état personnel de l'élève. Elle ne peut jamais sortir du périmètre, ni changer les proportions, ni changer le nombre de questions.

**Et rien de l'état personnel ne remonte jamais au professeur.** Il lit ce que ses exercices ont produit, jamais l'entraînement libre, jamais le mastery, jamais le pool. C'est la règle inscrite en **I-25** dans la vision le 2026-09-10, sur décision du propriétaire.

Trois choses qu'on ne veut pas, parce que c'est vers elles que ce genre d'écran glisse tout seul : un générateur automatique opaque, un formulaire à programmer, un tunnel de sept écrans.

---

## 2. Les objets

| Objet | Ce qu'il porte | Durée de vie |
|---|---|---|
| `assignments` | le **contrat** : classe, professeur, périmètre, mix, exigence, adaptation, nombre de questions, mode, politique, fenêtre, provenance | permanent |
| `assignment_recipients` | qui l'a reçu, figé à la publication | permanent |
| `sessions` | une tentative d'un élève sur une assignation, `context = teacher_assignment` | permanent |
| `user_event_fact` | chaque réponse, avec la face demandée, la réponse choisie, la justesse, le temps | permanent |
| `user_typeface_state` | l'état de répétition espacée de l'élève, **jamais lisible par un professeur** | permanent |

La table `assignments` et les trois axes de session (`context`, `progression_policy`, `assignment_id`) sont **déjà spécifiés** dans l'architecture backend. Cette spec les remplit, elle ne les invente pas.

**Un exercice n'est pas une liste de questions.** Le frontend n'a aucun pouvoir décisionnel pédagogique : le compositeur enregistre un contrat, et le moteur compose les questions au moment où l'élève joue. Conséquence assumée et non négociable : **on ne prévisualisera jamais les vingt questions exactes**.

---

## 3. Le parcours, en entier

Une seule page. Quatre moments. Rien n'est ouvert par défaut.

| Moment | Au premier regard | Ce qui s'ouvre |
|---|---|---|
| 1. D'où on part | trois recommandations et une porte vide | rien, on choisit |
| 2. Ce qu'on travaille | le périmètre prérempli, en spécimens | familles, typographies, confusions détectées |
| 3. Comment | une bande d'exigence, un mix | les quatre crans, le curseur, l'adaptation |
| 4. Pour qui, jusqu'à quand | classe, longueur, échéance | les élèves un par un |

Puis le **preview**, puis **Assign**.

Un professeur pressé fait trois gestes : une recommandation, un coup d'œil au preview, assigner. Un professeur qui sort d'un cours sur les didones ouvre tout et compose.

---

## 4. Les recommandations DWIGGINS

**Ce que le code sait faire.** Rien encore côté données réelles. Le catalogue porte en revanche tout ce qu'il faut pour raisonner : 1 279 typographies actives sur 2 136 lignes, 4 catégories, 9 sous catégories, 42 clusters visuels mesurés dans les fichiers, plus `contrast_profile`, `aperture_profile`, `rarity_tag`, `difficulty_base` et une `structural_signature` de onze champs. Le journal `user_event_fact` porte déjà, par réponse, la face demandée, **la réponse choisie**, la justesse et le temps.

**Ce qui manque.** Le lien entre une réponse et une assignation (`context`, `assignment_id` sur la session et sur le fait). Sans lui, aucune recommandation ne peut être calculée sans lire l'entraînement personnel, ce qui est interdit.

**Règle.** Trois recommandations, **jamais plus**, toujours de trois natures différentes, chacune avec sa phrase de justification et sa preuve chiffrée à côté.

1. **Consolider** une famille ou une sous catégorie que la classe reconnaît sans la stabiliser.
2. **Séparer** deux ou trois voisines que la classe confond réellement.
3. **Pousser** un regard déjà solide vers des formes très proches.

Elles sont calculées **uniquement** sur les assignations de ce professeur pour cette classe. Elles sont recalculées à chaque ouverture de l'écran, jamais stockées. Si deux recommandations désignent le même périmètre, la seconde est remplacée par la suivante de sa nature ; si une nature n'a pas de matière, elle laisse sa place et l'écran n'en affiche que deux. **Une recommandation sans preuve vérifiable ne s'affiche pas.**

À côté d'elles, une quatrième porte de même poids visuel : **partir de zéro**.

**Conséquence.** Une vue de lecture professeur unique, bornée aux assignations du professeur, comme l'exige la porte de lecture de l'architecture. Aucune requête de recommandation ne touche `user_typeface_state`, et le garde `check:teacher-read-gate` prévu par l'architecture doit échouer si un module de recommandation le mentionne.

---

## 5. La classe sans historique

**Ce que le code sait faire.** Le catalogue est complet et n'a besoin d'aucun élève pour être décrit.

**Ce qui manque.** Rien.

**Règle.** Une classe neuve n'a produit aucune réponse : les trois recommandations deviennent trois **entrées catalogue**, qui décrivent les polices et pas les élèves. Les grandes familles, un couple d'un même cluster visuel, une entrée par la rareté. Leur phrase de justification change de nature et le dit : « cette classe n'a encore rien rendu, voilà par où on commence d'habitude ». Le mix, lui, se replie comme décrit en section 12.

**Conséquence.** Aucune. C'est du calcul sur un fichier déjà versionné, et c'est ce qui rend l'écran bon le jour de la rentrée.

---

## 6. La création libre

**Ce que le code sait faire.** Le compositeur en maquette existe, avec classe, nom, familles, longueur et fenêtre.

**Ce qui manque.** Il lit `content/typefaces/font-manifest-v4.json`, la liste de départ du projet : 28 polices dont 23 servables. Le vrai catalogue est `content/catalog/typefaces-core.json`.

**Règle.** Le sélecteur raisonne sur le **catalogue actif**, filtré sur `activation_status = true` **et** sur la présence d'un asset de runtime prêt, sans exception. Une face que le produit ne sait pas servir n'est jamais proposée : le navigateur inventerait la lettre, et c'est le seul défaut que ce produit ne peut pas se permettre. Les faces désactivées par le garde des jumelles restent invisibles, y compris à la recherche.

**Conséquence.** Un module de lecture catalogue partagé par le compositeur et par le moteur, pour que la liste offerte au professeur soit exactement celle que le moteur peut jouer. Correction à faire **avant** tout le reste, sinon aucune recommandation n'a de matière.

---

## 7. La sélection par familles

**Ce que le code sait faire.** `primary_category` (813 sans serif, 406 serif, 55 mono, 5 display sur les actives) et `sub_category` (9 valeurs, humanist, neo_grotesk, geometric, grotesk, old_style, transitional, didone, slab, autres) sont sur chaque ligne du catalogue.

**Ce qui manque.** Rien côté donnée. Côté écran, l'arbre à deux niveaux.

**Règle.** Le professeur choisit à deux niveaux, catégorie ou sous catégorie, et jamais plus fin : le troisième niveau utile n'est pas une famille, c'est le cluster visuel, et il appartient au moteur. Choisir « serif » veut dire « le moteur peut demander n'importe quelle serif active », pas « les 406 seront demandées ». Le nombre de faces disponibles derrière chaque choix est affiché, parce que « serif » et « didone » ne pèsent pas la même chose.

**Conséquence.** Aucune sur le moteur. Le périmètre est stocké comme une liste de sélecteurs (`category:serif`, `subcategory:didone`) et non comme la liste développée des faces : développer à la publication figerait le catalogue de ce jour là dans l'assignation.

---

## 8. La sélection de typographies précises

**Ce que le code sait faire.** Rien de plus qu'une liste déroulante groupée, dans la maquette.

**Ce qui manque.** Une recherche : 1 279 faces ne se parcourent pas dans un menu.

**Règle.** Un champ de recherche par nom, plus le filtre par famille de la section 7. Chaque face choisie s'affiche en **spécimen**, jamais en étiquette de texte. Une face nommée explicitement est **garantie demandée au moins une fois** à chaque élève : c'est la différence entre choisir une famille et choisir une face, et sans cette garantie « je veux absolument Univers » ne veut rien dire.

**Conséquence.** Le moteur reçoit deux ensembles distincts et doit les traiter différemment : les **faces imposées**, qui entrent dans la séquence de chaque élève, et le **périmètre**, où il pioche le reste. C'est la seule contrainte forte que le compositeur pose sur la sélection.

---

## 9. La combinaison des deux

**Ce que le code sait faire.** Rien : la maquette ne connaît qu'une liste de faces, sans notion de périmètre.

**Ce qui manque.** La distinction entre le terrain et les passages obligés, qui n'existe ni dans l'écran ni dans le moteur.

**Règle.** « Travaille les grotesques, mais je veux absolument Helvetica LT Pro, Univers Next Pro et Arial » est le cas normal, pas un cas limite. Le périmètre donne le terrain, les faces imposées donnent les passages obligés. Si une face imposée sort du périmètre choisi, on ne bloque pas et on ne corrige pas en silence : l'écran le dit en une phrase, et la face reste, parce que le professeur a raison sur son propre cours.

**Une vérification qui corrige un exemple de la conversation.** Le trio Helvetica / Univers / Akzidenz-Grotesk n'est pas composable : `helvetica` en version système est **désactivée** (garde des jumelles, migration 020) et **Akzidenz-Grotesk n'est pas au catalogue**, faute de licence. Le trio réel et jouable est **Helvetica LT Pro, Univers Next Pro et Arial**, tous actifs, servis par le projet Adobe, et **tous les trois dans le même cluster visuel** (`cluster_sans_serif_neo_grotesk_00`, 121 faces actives). L'exemple tient, il change de noms.

**Conséquence.** Le compositeur doit savoir dire « cette face n'est pas disponible » et proposer la plus proche du même cluster. C'est une requête sur le catalogue, pas une intelligence à écrire.

---

## 10. Le ciblage des difficultés et des confusions détectées

**Ce que le code sait faire.** Le journal enregistre `answer_slug` à côté de `typeface_slug` sur chaque réponse fausse. Une confusion récurrente est donc un `GROUP BY (typeface_slug, answer_slug)` et rien de plus.

**Ce qui manque.** Le lien vers l'assignation, encore lui.

**Règle.** Quand une recommandation vient des faiblesses de la classe, le professeur **voit la liste avant d'assigner** : trois ou quatre confusions, chacune avec son compte et la période. Il coche, il décoche, il ajoute ce qu'il vient d'enseigner. Une confusion décochée n'est pas supprimée de la donnée, elle est retirée **de cet exercice**. Rien n'est jamais ciblé sans que le professeur l'ait vu.

**Conséquence.** Les confusions retenues sont stockées dans le contrat, en couples de slugs. C'est ce qui permet au moteur de les servir comme paires et au preview de dire « 3 confusions récurrentes traitées ».

---

## 11. La modification manuelle d'une proposition

**Ce que le code sait faire.** Rien, il n'y a pas de recommandation à modifier.

**Ce qui manque.** La trace de la provenance, qui est ce qui permettra de savoir si les recommandations servent.

**Règle.** Tout est modifiable, à tout moment, avant publication. Une proposition modifiée reste une proposition : l'assignation garde sa **provenance** (`recommendation:consolidate`, `recommendation:separate`, `recommendation:push`, `from_scratch`, `duplicate:<assignment_id>`) et un drapeau `edited`. Aucune modification ne bloque, aucune ne demande de confirmation.

**Conséquence.** Deux colonnes sur `assignments`. Elles ne servent pas au moteur, elles servent à savoir plus tard si les recommandations sont utilisées et si elles produisent de meilleurs résultats que les exercices composés à la main. Sans elles, on ne pourra jamais le mesurer.

---

## 12. Le mix

**Ce que le code sait faire.** Rien. Aujourd'hui la sélection d'une session personnelle est pilotée par la répétition espacée seule.

**Ce qui manque.** Les quatre paniers, et le calcul qui les remplit.

**Règle.** Quatre paniers, définis **sur l'historique des assignations de ce professeur** et jamais sur l'état personnel de l'élève.

| Panier | Définition | Part de départ |
|---|---|---|
| Consolidation | faces déjà demandées dans vos exercices, réussies de façon instable | 45 % |
| Entretien | faces déjà demandées et régulièrement réussies | 20 % |
| Difficultés ciblées | faces des confusions retenues en section 10 | 20 % |
| Nouveauté | faces du périmètre jamais demandées dans vos exercices | 15 % |

**Nouveau veut dire jamais demandé dans vos exercices, pas jamais vu de sa vie.** C'est ce qui empêche le mix de devenir une lecture détournée du pool privé.

Ces quatre parts sont une **hypothèse de V1 à tester**, pas une règle scientifique. Le professeur les déplace avec **un seul curseur**, plus de renforcement contre plus de découverte, qui bouge les quatre parts ensemble le long d'un axe. Il ne voit jamais un coefficient.

**Repli quand un panier est vide**, et c'est le cas le plus fréquent au début : les parts manquantes sont redistribuées **au prorata** des paniers restants, et l'écran le dit en mots. Le jour 1, tout est nouveauté et la phrase est « cette classe n'a encore rien rendu, ces vingt questions leur seront toutes nouvelles ».

**Conséquence.** Le mix est stocké en parts sur le contrat. Le moteur reçoit des cibles, pas des questions : il doit savoir classer une face du périmètre dans un panier au moment de composer, ce qui demande une vue « historique d'assignation par classe » et rien d'autre. Le mix est **commun à la classe**, donc calculé une fois pour l'assignation, jamais par élève.

---

## 13. Le niveau d'exigence

**Ce que le code sait faire.** `pickDistractors` choisit les trois mauvaises réponses en marquant la proximité : même catégorie retire 125 à 325 points, même cluster visuel 175 à 350, et le plus petit score gagne. Trois paliers existent, pilotés par le mastery de la face demandée.

**Ce qui manque, et c'est le seul vrai chantier moteur de cette spec.** Les trois paliers actuels **préfèrent tous les faces les plus proches** : ils ne font que réordonner l'importance de la catégorie contre celle du cluster. Le cran « mauvaises réponses franchement différentes » de la spec moteur **n'existe pas dans le code**.

**Règle.** Quatre crans, nommés pour le professeur, traduits par le moteur.

| Cran | Ce que le professeur lit | Ce que le moteur fait |
|---|---|---|
| Accessible | les mauvaises réponses sont franchement différentes | hors catégorie, contraste opposé |
| Balanced | même grande famille, différences visibles | même catégorie, cluster différent |
| Challenging | typographies très proches | même cluster visuel |
| Expert | reconnaissance très fine | même cluster, micro variations d'ouverture et de contraste |

**Conséquence.** `pickDistractors` prend une **proximité cible** et sait aussi **pénaliser** la proximité, pas seulement la récompenser. Une fonction, un paramètre, et le garde `check:answer-position` rejoue déjà la chaîne. C'est aussi ce qui rend la spec moteur enfin vraie sur son propre palier bas.

**Le format Expert n'est pas dans cette échelle.** Écrire le nom au clavier est un **format de réponse**, réservé par la spec moteur à un niveau global avancé, donc jamais garanti pour une classe entière. Règle : **le professeur n'assigne pas le format Expert en V1**. Le cran Expert reste un palier de distracteurs en QCM. Un contrat qui retomberait en QCM pour la moitié de la classe ne serait plus un contrat commun.

---

## 14. L'adaptation par élève

**Ce que le code sait faire.** `user_typeface_state` porte déjà, par élève et par face, le mastery de 0 à 4, l'intervalle de retour, le nombre de vues, de réussites, d'erreurs et la série en cours. Et `pickDistractors` **lit déjà** le mastery de la face demandée pour choisir son palier. La machinerie existe.

**Ce qui manque.** Le branchement de la bande d'exigence du professeur sur cette lecture, et la règle de vision qui l'autorise.

**Règle, sur direction du propriétaire du 2026-09-10, inscrite en I-25.** Deux choix pour le professeur.

**Même exigence pour tout le monde.** Le cran choisi s'applique tel quel à tous.

**Adapter à chaque élève.** Le cran choisi devient le **centre d'une bande** d'un cran de part et d'autre. À l'intérieur du contrat, le moteur peut consulter l'état personnel de l'élève pour choisir **quelles faces du périmètre** reviennent, **dans quel ordre**, et **à quel point** les mauvaises réponses sont proches. Il ne peut jamais sortir du périmètre, changer les proportions du mix, ni changer le nombre de questions. La classe reçoit le même exercice pédagogique, pas nécessairement la même succession de questions.

**Et le professeur ne voit rien de cet état.** Il lit les résultats de ses exercices, jamais le mastery, jamais le pool, jamais le déplacement que sa session a produit.

**Conséquence, et elle touche un écran déjà construit.** Quand une assignation est adaptative, les notes de deux élèves **ne sont pas strictement comparables**. La fiche Exercice doit le dire d'une phrase, et la répartition de la classe en avance / avec / en retard ne s'affiche pas sur une assignation adaptative. Un écran qui compare des exercices calibrés différemment sans le dire est un écran qui ment.

---

## 15. Training, Competition, et l'effet sur la progression

**Ce que le code sait faire.** Le mode existe sur les sessions (`training`, `competition`, `expert`). La compétition est **bornée à deux minutes** par une constante, avec une échéance calculée depuis le début de session. L'architecture définit la politique de progression (`update_mastery`, `observe_only`) et la contrainte de base qui rend la compétition toujours sans effet sur le mastery.

**Ce qui manque.** Les colonnes de politique et de contexte, et leurs deux contraintes.

**Règle.** Le professeur choisit **un effet**, dit en mots, jamais une ambiance.

| Choix du professeur | Mode | Politique | Ce que l'écran dit |
|---|---|---|---|
| Exercice | `training` | `update_mastery` | « compte dans leur progression » |
| Contrôle | `training` | `observe_only` | « ne compte pas, c'est une mesure » |
| Compétition | `competition` | `observe_only` | « deux minutes, classement, sans effet sur la progression » |

**Conséquence.** Le contrôle est offert parce que l'architecture le permet déjà et qu'un professeur le demandera le premier jour. La compétition assignée garde ses deux minutes : elle n'a donc **pas de nombre de questions**, et le compositeur remplace ce réglage par la durée, affichée et non modifiable. Mélanger un budget de questions et un chrono dans le même objet produirait deux exercices incomparables dans la même classe.

---

## 16. Le nombre de questions

**Ce que le code sait faire.** Une séance personnelle **n'a pas de longueur prévue**, c'est un invariant (I-17) et un garde le surveille. Le curseur de question n'avance **que sur une bonne réponse** : en entraînement, l'élève reprend la même question jusqu'à la réussir, et chaque question résolue porte exactement une ligne `attempt_index = 1`.

**Ce qui manque.** Un budget porté par l'assignation.

**Règle.** Le nombre de questions est une valeur du **contrat**, jamais une constante, et il compte les **questions résolues**. Les valeurs offertes sont 10, 15, 20, 25, 30.

**ET LA RÈGLE QUI EN DÉCOULE EST LA PLUS IMPORTANTE DE CETTE SECTION.** Puisqu'une question d'entraînement ne se résout qu'une fois réussie, un pourcentage de bonnes réponses brut vaudrait **toujours 100 %**. Le résultat d'un exercice est donc défini une fois pour toutes comme la **justesse au premier essai** : `attempt_index = 1 AND is_correct`, sur les questions résolues. Tous les écrans professeur écrivent « au premier essai » à côté du chiffre.

**Conséquence.** Le serveur refuse de servir une question au delà du budget de l'assignation et clôt la session. Le garde `check:session-lifecycle` doit continuer d'interdire toute constante de longueur : la valeur vient de la ligne `assignments`, et de nulle part ailleurs. Les pourcentages de la fiche Exercice et de la fiche Élève, construits sur mock, prennent cette définition sans changer d'affichage.

---

## 17. Les élèves inclus et exclus

**Ce que le code sait faire.** Rien, le monde scolaire n'existe pas en base.

**Ce qui manque.** `class_members` et `assignment_recipients`.

**Règle.** Toute la classe est cochée par défaut. Le professeur décoche qui il veut, en voyant qui est **invité mais jamais connecté** : on ne peut pas donner un devoir à quelqu'un qui n'a pas de compte actif, donc ces élèves sont visibles, décochables, et signalés comme tels sans être exclus d'office.

La liste des destinataires est **figée à la publication**. Ensuite : on peut **ajouter** un destinataire tant que l'exercice n'est pas fermé, jamais en **retirer** un qui a déjà répondu. Un ajout est dit à l'écran, parce qu'il change les dénominateurs que le professeur a déjà lus.

**Conséquence.** Un élève qui rejoint la classe après la publication ne reçoit pas l'exercice tant que le professeur ne l'ajoute pas. C'est voulu : l'inverse ferait apparaître des devoirs en retard sur des élèves qui n'étaient pas là.

---

## 18. Disponibilité et échéance

**Ce que le code sait faire.** Le mock raisonne en heures relatives. La base ne connaît pas encore la fenêtre.

**Ce qui manque.** `available_from` et `due_at` sur `assignments`, en `timestamptz`.

**Règle.** Deux moments, stockés en UTC, saisis et affichés en heure locale. Ouverture : tout de suite, ou une date. Échéance : une date, dont l'heure par défaut est **23 h 59 locales**, parce que c'est ce qu'un professeur veut dire quand il dit « pour vendredi ». La date résolue est écrite en clair sous les listes déroulantes, pour que personne ne découvre un décalage après coup.

Une session assignée n'est **servie que dans la fenêtre**. À l'échéance, une session en cours se ferme : les réponses déjà données comptent, aucune nouvelle question n'est servie, et l'exercice apparaît comme commencé et non terminé. Après l'échéance, l'élève garde l'accès au **bilan de sa propre session**, qui est sa donnée.

**Conséquence.** Le serveur vérifie la fenêtre à chaque demande de question, jamais le client. Une session par couple élève et assignation, donc une contrainte d'unicité sur `(assignment_id, user_id)`, ce qui rend la reprise naturelle : l'élève retrouve sa session ouverte et continue là où il s'était arrêté.

---

## 19. Le preview, puis la publication

**Ce que le code sait faire.** Le compositeur affiche déjà une phrase de récapitulation, calculée sur ses réglages, et la maquette rend des spécimens réels.

**Ce qui manque.** Le temps médian par question, qui demande des réponses de contexte assigné, et tout l'appareil d'états et d'immuabilité, qui n'existe nulle part.

**Règle.** Avant Assign, une ligne qui dit exactement ce qui va sortir, plus quelques **vrais spécimens** de l'exercice.

> 24 élèves · 20 questions · Challenging, adapté par élève · Grotesques et humanistes · 6 typographies imposées · 3 confusions récurrentes traitées · ouvre demain, ferme vendredi 23 h 59

Chaque chiffre vient du contrat. **Pas d'estimation de durée au départ** : le journal porte le temps de réponse, mais aucune réponse de contexte assigné n'existe encore, donc la médiane n'existe pas. Elle s'affichera quand elle sera mesurée, et elle dira d'où elle vient.

**Ce qui devient immuable à la publication.** La règle est unique et elle se déduit d'une seule question : est ce qu'un changement rendrait faux un chiffre que le professeur a déjà lu, ou différents deux exercices censés être le même.

| Élément | Avant ouverture, sans réponse | Une fois ouvert, avec au moins une réponse |
|---|---|---|
| Nom | modifiable | modifiable |
| Périmètre, faces imposées, confusions retenues | modifiable | **figé** |
| Mix | modifiable | **figé** |
| Bande d'exigence, adaptation | modifiable | **figé** |
| Nombre de questions | modifiable | **figé** |
| Mode et politique de progression | modifiable | **figé** |
| Ouverture | modifiable | passée, sans objet |
| Échéance | modifiable | **modifiable**, voir ci dessous |
| Destinataires | modifiable | **ajout seulement** |
| Annulation | suppression franche | fermeture immédiate, réponses conservées |

**L'échéance est le seul réglage qui reste vivant, et c'est le plus demandé.** L'allonger est libre. La raccourcir est possible jusqu'à maintenant au plus tôt, et l'écran dit combien d'élèves sont en cours d'exercice avant de valider.

**Une assignation fermée ne se réouvre pas.** Un exercice fermé est une mesure ; le réouvrir changerait le sens de ce qui a déjà été lu. On le **redonne**, ce qui crée une nouvelle assignation avec la provenance `duplicate`. C'est exactement ce que promet le bouton « Give it again » de la fiche Exercice.

**Annuler conserve les réponses et le mastery déjà écrit.** Une réponse est un fait, et un fait ne se retire pas parce que l'exercice a été annulé.

**Conséquence.** Un état sur `assignments` (`draft`, `scheduled`, `open`, `closed`, `cancelled`), les transitions portées par le serveur, et la règle d'immuabilité appliquée en base plutôt qu'en interface : une mise à jour qui touche un champ figé sur une assignation ayant des réponses est **rejetée par une contrainte**, pas par un formulaire.

---

## 20. Ce qui reste à arbitrer

Cinq points, et rien d'autre. Chacun a une recommandation ; le produit est constructible sur ces recommandations si l'arbitrage tarde.

| Point | Recommandation | Alternative | Ce que ça change |
|---|---|---|---|
| Format Expert assignable | non en V1, le cran Expert reste du QCM | l'autoriser avec retombée en QCM par élève | autoriser casse le contrat commun : deux formats dans une même classe |
| Nombre de questions en compétition | pas de réglage, deux minutes fixes | rendre la durée réglable par assignation | réglable ajoute un paramètre moteur et un risque de comparabilité |
| Contrôle sans effet sur la progression | l'exposer dès la V1 | ne garder que Exercice et Compétition | l'exposer coûte une case et répond à une vraie demande d'enseignant |
| Parts de départ du mix | 45 / 20 / 20 / 15 comme hypothèse mesurée | autre répartition, ou pas de mix en V1 | c'est un point de départ, mesurable et modifiable sans rien casser |
| Notes non comparables en mode adaptatif | garder les notes et écrire l'avertissement | masquer les notes, ne montrer que l'avancement | masquer protège la rigueur, garder répond à ce qu'un prof cherche |

---

## 21. Conséquences base et moteur, récapitulées

**Base.** `schools`, `school_members`, `classes`, `class_members`, `invitations`, `assignments`, `assignment_recipients`. Sur `sessions` : `context`, `progression_policy`, `assignment_id`, plus les deux contraintes de l'architecture et l'unicité `(assignment_id, user_id)`. Sur `user_event_fact` : propagation des trois axes, pour qu'une lecture n'ait jamais besoin d'une jointure pour connaître ses droits.

**Moteur.** Une proximité cible paramétrable dans `pickDistractors`, capable de pénaliser la proximité. Un budget de questions porté par l'assignation. Le respect de la fenêtre à chaque demande. Les faces imposées garanties dans la séquence. Le classement d'une face dans un panier de mix.

**Gardes.** `check:teacher-read-gate`, prévu par l'architecture, qui échoue si un module professeur mentionne `user_typeface_state`. `check:session-lifecycle`, déjà là, qui doit continuer d'interdire une constante de longueur.

**Lecture.** Une seule fonction de lecture professeur, bornée aux assignations du professeur.

---

## 22. Ordre de construction

1. Le compositeur sur le vrai catalogue actif (section 6). Sans lui, rien d'autre n'a de matière.
2. Le schéma du monde scolaire et les trois axes de session.
3. La porte de lecture professeur et son garde.
4. La séance assignée : fenêtre, budget, unicité, reprise.
5. La proximité cible dans `pickDistractors`.
6. Le mix et les paniers.
7. L'adaptation par élève, une fois I-25 inscrite.
8. Les recommandations, qui n'ont de matière qu'une fois qu'il existe des assignations jouées.

Les quatre écrans de lecture et le compositeur existent déjà sur données factices : ils changent de source, pas de forme.
