# Brief produit — la création d'exercice

**Rang 4.** Ce document applique la vision (`game/vision-produit-dwiggins.md`), la spec moteur et l'architecture backend (`game/architecture-backend.md`). Il ne redéfinit rien. Là où il touche un invariant, il le dit et laisse la décision au propriétaire.

Écrit le 2026-09-10, à partir de la conversation du jour et de ce que le code porte réellement. Chaque chiffre cité a été mesuré, pas supposé.

---

## 1. Le principe

Le professeur exprime une **intention pédagogique**. DWIGGINS conseille, explique et préremplit. Le professeur peut tout modifier.

Trois choses qu'on ne veut pas, et il faut les nommer parce que c'est vers elles que ce genre d'écran glisse tout seul.

**Pas un générateur automatique opaque.** Un bouton « générer un exercice » qui sort vingt questions sans dire pourquoi ne se discute pas, donc ne s'enseigne pas.

**Pas un formulaire à programmer.** Un professeur ne règle pas un coefficient adaptatif ni une distance de cluster. Il dit ce qu'il veut travailler et à quel niveau d'exigence.

**Pas un tunnel de sept écrans.** Une seule page. Au premier regard elle est très simple. La puissance apparaît quand le professeur veut éditer.

C'est ici que se joue la différence entre un devoir de reconnaissance typographique et un outil d'enseignement.

---

## 2. Ce que l'écran produit vraiment

L'architecture est formelle : **le frontend n'a aucun pouvoir décisionnel pédagogique, le backend décide la sélection des typographies**. Le compositeur n'écrit donc **jamais une liste de vingt questions**. Il écrit une **intention**, et le moteur la traduit au moment où l'élève joue.

Cette intention a déjà sa table dans l'architecture : `assignments`, avec la classe, le professeur, la définition de la séance (typographies choisies, difficulté, mode, nombre de questions, durée, échéance) et la politique de progression. Le compositeur ne crée pas un objet nouveau, il **remplit celui-là** et lui ajoute ce que la conversation d'aujourd'hui rend nécessaire : les familles visées, le niveau d'exigence, l'adaptation par élève, et le mix.

Un devoir joué est une **session** avec `context = teacher_assignment` et `assignment_id`, jamais une mutation du pool personnel de l'élève (résolution de la contradiction 3 de la vision).

Conséquence directe sur la promesse d'écran : **on ne prévisualisera jamais les vingt questions exactes**, et ce n'est pas un manque, c'est le modèle. On prévisualise l'intention.

---

## 3. L'écran, une page qui s'ouvre

Quatre moments, dans cet ordre, sur une seule page.

| Moment | Au premier regard | Ce qui s'ouvre si on veut éditer |
|---|---|---|
| 1. D'où on part | trois propositions et une porte vide | rien, on choisit |
| 2. Ce qu'on travaille | la sélection préremplie, en spécimens | familles, typographies précises, ce que le moteur a détecté |
| 3. Comment | un niveau d'exigence, un mix | les quatre crans expliqués, le curseur du mix, l'adaptation par élève |
| 4. Pour qui et jusqu'à quand | classe, longueur, échéance | les élèves concernés un par un |

Puis le **preview**, puis **Assign**.

Rien ne s'ouvre par défaut. Un professeur pressé choisit une proposition, regarde le preview, assigne. Un professeur qui vient de faire un cours sur les didones ouvre tout et compose.

---

## 4. Moment 1 : d'où on part

Trois propositions **réellement différentes**, pas trois niveaux de difficulté. Chacune porte une phrase qui dit **pourquoi** DWIGGINS la recommande. À côté, une quatrième porte : **partir de zéro**.

Exemples de la forme visée, avec la donnée qui les produit.

**Consolider une famille.** « Vos DSAA 1 reconnaissent les serif mais ne les stabilisent pas : 68 % sur les six exercices où elles apparaissaient, et deux élèves sur trois se trompent encore entre deux fois. » Requête : les réponses de vos assignations, jointes au catalogue par `primary_category` et `sub_category`.

**Séparer deux voisines.** « Helvetica LT Pro, Univers Next Pro et Arial sont confondues 14 fois dans vos exercices. » Requête : `user_event_fact` groupé par (typeface_slug, answer_slug) sur les réponses fausses de vos assignations. La colonne existe déjà : le journal enregistre **la réponse choisie à côté de la réponse attendue**.

**Pousser un regard solide.** « Vos BTS 2 tiennent 84 % sur ce que vous leur donnez. Voilà des formes très proches. » Requête : même source, plus le `visual_cluster_id` du catalogue pour aller chercher la proximité.

**Le jour 1, il n'y a aucune donnée, et l'écran doit être bon quand même.** Une classe neuve n'a produit aucune réponse. Les trois propositions deviennent alors trois **entrées catalogue**, qui ne demandent aucun historique parce qu'elles décrivent les polices et pas les élèves : les grandes familles, les couples d'un même cluster visuel, les formes rares. Le catalogue porte 1 279 typographies actives, 9 sous-catégories et 42 clusters visuels mesurés dans les fichiers. C'est largement assez pour trois propositions honnêtes sans connaître personne.

**Règle, déjà posée sur les autres écrans du prof et valable ici :** une proposition affiche sa preuve à côté de sa phrase. Un signal dont la preuve n'est pas vérifiable est pire que pas de signal, parce que le professeur ne peut plus être en désaccord avec nous.

---

## 5. Moment 2 : ce qu'on travaille

Le professeur sélectionne **une ou plusieurs familles**, **des typographies précises**, ou **les deux**. « Travaille les grotesques, mais je veux absolument Helvetica, Univers et Arial. »

Il part d'une proposition et il **enlève, ajoute, remplace**. C'est le geste central de l'écran, pas une option.

**Ce que le catalogue permet au moteur de construire autour de cette sélection**, tout mesuré : `primary_category` (813 sans serif, 406 serif, 55 mono, 5 display sur les actives), `sub_category` (9 valeurs), `visual_cluster_id` (42 clusters, le plus gros en compte 121 sur les neo grotesques et 185 sur les humanistes), `contrast_profile`, `aperture_profile`, `rarity_tag`, `difficulty_base`, et une `structural_signature` de onze champs (forme du a, ouverture du e, axe, terminaisons, hauteur d'x, chasse fixe, largeur, capitales seules, w distinctif).

**Une vérification qui change un exemple.** Le trio « Helvetica / Univers / Akzidenz-Grotesk » n'est pas composable tel quel : `helvetica` en version système est **désactivée** dans le catalogue (les jumelles qui dessinent le même latin ne sont plus jouables depuis la migration 020) et **Akzidenz-Grotesk n'est pas dans le catalogue**, faute de licence. Le trio réel et jouable est **Helvetica LT Pro, Univers Next Pro et Arial**, tous trois actifs, servis par le projet Adobe, et **tous les trois dans le même cluster visuel**. L'exemple tient, il change juste de noms. Règle générale : le compositeur ne propose que des faces que le produit sait servir, sinon le navigateur invente la lettre.

**Un défaut de mon prototype, à corriger avant tout le reste.** Le compositeur construit hier lit `content/typefaces/font-manifest-v4.json`, la liste de départ du projet : 28 polices, 23 servables. Le vrai catalogue est `content/catalog/typefaces-core.json`, 2 136 lignes dont 1 279 actives. Tant qu'il lit le petit manifeste, aucune des trois propositions n'a de matière.

**Voir ce que le moteur a détecté, et arbitrer.** Quand la proposition vient des faiblesses de la classe, le professeur voit la liste avant d'assigner : trois ou quatre confusions récurrentes, chacune avec son compte. Il coche, il décoche celle qui ne l'intéresse pas, il ajoute ce qu'il vient d'enseigner. DWIGGINS détecte, propose ; le professeur arbitre.

---

## 6. Moment 3 : le niveau d'exigence

Quatre crans, avec une phrase concrète chacun. Le moteur les traduit dans ses propres paramètres.

| Cran | Ce que le professeur lit | Ce que le moteur fait |
|---|---|---|
| Accessible | les mauvaises réponses sont franchement différentes | distracteurs hors de la famille, contraste fort |
| Balanced | même grande famille, différences visibles | distracteurs de la même catégorie, cluster différent |
| Challenging | typographies très proches | distracteurs du même cluster visuel |
| Expert | reconnaissance très fine | intra cluster, micro variations d'ouverture et de contraste |

C'est exactement l'échelle de la spec moteur : **la difficulté du QCM ne monte que par la similarité visuelle des mauvaises réponses**. Le compositeur ne fait donc que rendre accessible une échelle qui existe déjà sur le papier.

**LE VRAI CHANTIER EST LÀ, ET IL EST PETIT.** Aujourd'hui `pickDistractors` **préfère toujours les faces les plus proches**, à tous les niveaux : la même catégorie retire 125 à 325 points au score et le même cluster 175 à 350, et le plus bas score est choisi. Les trois paliers actuels, pilotés par le mastery de la face demandée, ne font que **réordonner** l'importance de la catégorie contre celle du cluster. Le cran « distracteurs franchement différents » de la spec **n'est pas implémenté**. Il faut donc que cette fonction prenne une **proximité cible** et sache aussi **pénaliser** la proximité, pas seulement la récompenser. C'est une fonction, un paramètre, et le garde `check:answer-position` rejoue déjà la chaîne.

**Expert est deux choses différentes, et il faut les séparer dans l'écran.** C'est un palier de distracteurs, et c'est aussi un **format de réponse** où l'élève écrit le nom, que la spec réserve à un niveau global avancé. Si le professeur choisit Expert, le compositeur doit dire combien d'élèves ne peuvent pas encore recevoir le format écrit, et l'exercice retombe pour eux en QCM au palier le plus proche. Sans cette phrase, un professeur envoie un devoir que la moitié de sa classe ne peut pas passer.

---

## 7. La difficulté adaptative par élève

Deux choix : **le même exercice pour tout le monde**, ou **adapté à chaque élève**.

Adapté veut dire : le professeur pose une intention générale, par exemple Challenging, et le moteur module la proximité des distracteurs selon ce que chaque élève réussit et rate. La classe reçoit **le même exercice pédagogique**, pas nécessairement la même succession de questions.

**Ce que ça coûte est plus faible qu'il n'y paraît, parce que la machinerie existe.** `user_typeface_state` porte déjà, par élève et par typographie, le niveau de maîtrise 0 à 4, l'intervalle de retour, le nombre de vues, de réussites, d'erreurs et la série en cours. Et `pickDistractors` lit **déjà** le mastery de la face demandée pour choisir ses paliers. Adapter par élève, c'est donc brancher le plancher et le plafond posés par le professeur sur une lecture qui se fait déjà, pas écrire un moteur.

**MAIS ÇA TOUCHE LE MUR, ET LA DÉCISION T'APPARTIENT.** L'invariant I-21 dit que **la sélection des typographies d'une session assignée ne consulte jamais le pool personnel** de l'élève. Ici, ce n'est pas la sélection qui consulterait l'état personnel, c'est la **proximité des mauvaises réponses**. Le professeur n'en voit rien, I-23 tenant par ailleurs : il lit les résultats de sa session, jamais le mastery, jamais le pool, jamais le déplacement produit. Mon avis : c'est compatible avec l'esprit du mur, puisque rien ne remonte au professeur et que les faces demandées restent **entièrement son choix**. Mais l'invariant ne couvre pas ce cas, donc il faut **une ligne explicite dans la vision** avant d'écrire une seule ligne de code, sinon quelqu'un lira ça plus tard comme une fuite.

---

## 8. L'équilibre du mix

Un exercice recommandé ne doit pas devenir une punition faite de tout ce que les élèves ratent.

L'hypothèse de V1, **à tester et pas une règle scientifique** : 45 % de consolidation, 20 % de choses déjà reconnues pour entretenir la mémoire, 20 % de difficultés ciblées, 15 % de nouveauté. Le compositeur montre cette composition, et le professeur la déplace avec un seul curseur compréhensible, **plus de renforcement** contre **plus de découverte**. Il ne touche jamais un coefficient.

C'est cohérent avec le moteur : une typographie stabilisée n'est jamais retirée, et chaque erreur rapproche son rappel.

**Une précision qui protège le mur, et qui n'est pas un détail.** « Déjà reconnu » et « nouveauté » se calculent sur **l'historique des assignations de ce professeur**, jamais sur l'état personnel de l'élève. Sinon le mix devient une façon détournée de lire le pool privé. Autrement dit : nouveau veut dire *jamais demandé dans vos exercices*, pas *jamais vu de sa vie*.

**Comment on testera l'hypothèse**, puisque c'en est une : sur deux exercices comparables donnés à des classes comparables, mesurer dans le journal si la réussite sur les faces ciblées progresse davantage avec ce mix qu'avec un mix plat. La donnée est là, `user_event_fact` porte la face, la réponse choisie, la justesse et le temps de réponse.

---

## 9. Moment 4 : pour qui, et jusqu'à quand

Les paramètres simples, et ils viennent en dernier parce qu'ils ne se discutent pas.

La **classe**. Les **élèves concernés**, toute la classe cochée par défaut. Le **nombre de questions**. La **date de mise à disposition** et l'**échéance**. Et le type, **Training** ou **Competition**.

**Training et Competition ne sont pas deux ambiances, ce sont deux effets, et le compositeur doit le dire en mots.** L'architecture porte ça sur la session : un devoir en training peut écrire la progression de l'élève (`update_mastery`), et la compétition est **toujours** sans effet sur elle, contrainte au niveau de la ligne en base. Donc l'écran dit « ce devoir compte dans leur progression » ou « ce devoir ne compte pas, c'est une mesure ». Et il existe un troisième cas que l'architecture permet déjà et qu'un professeur demandera : un devoir d'entraînement **sans effet** sur la progression, c'est à dire un contrôle. Une case, pas un écran.

**Le nombre de questions est porté par l'assignation, jamais par une constante.** Une séance personnelle n'a pas de longueur prévue, c'est un invariant (I-17) et un garde le surveille. Un devoir, lui, a une longueur : elle vient de la ligne `assignments` et de nulle part ailleurs.

---

## 10. Le preview

Avant Assign, une ligne qui dit exactement ce qui va sortir.

> 24 élèves · 20 questions · Challenging · Grotesques et humanistes · 6 typographies visées · 3 confusions récurrentes traitées

Avec quelques **vrais spécimens** de l'exercice, comme partout ailleurs dans cet espace : sur un produit qui entraîne le regard, ce qu'on demande à un élève, ce sont des lettres.

**L'estimation de durée demande une mesure qu'on n'a pas encore.** Le journal porte `response_time_ms` par réponse, donc une médiane est calculable, mais il n'existe aujourd'hui aucune réponse de contexte assigné. Donc : pas de « ≈ 4 min » inventé au départ. Soit on l'affiche à partir de la médiane du produit entier en disant d'où elle vient, soit on l'omet jusqu'à ce que la donnée existe. À trancher, et c'est réversible.

---

## 11. Ce qui manque pour que tout ça soit vrai

Dans l'ordre où il faut le faire. Les quatre écrans du prof et le compositeur existent déjà, sur données factices ; ce qui suit est ce qui les rend réels.

1. **Le schéma du monde scolaire** : `schools`, `school_members`, `classes`, `class_members`, `invitations`, `assignments`. Tout est déjà spécifié dans l'architecture backend, rien à concevoir.
2. **Les trois axes sur `sessions`** : `context`, `progression_policy`, `assignment_id`, avec leurs deux contraintes en base. C'est ce qui permet enfin à un professeur de ne lire **que** ce que ses exercices ont produit, et c'est le mur que tout l'espace prof contourne aujourd'hui avec un mock.
3. **La porte de lecture professeur**, une seule fonction, plus le garde `check:teacher-read-gate` prévu par l'architecture.
4. **La séance assignée bornée** : une session qui connaît sa longueur, sans réintroduire de compteur global.
5. **Le palier de distracteurs paramétrable**, la seule vraie modification du moteur (section 6).
6. **Le compositeur branché sur le vrai catalogue** au lieu du manifeste de 28 polices (section 5).

Et ce qui existe déjà, pour mémoire : le catalogue et ses champs, la répétition espacée par élève et par face, le journal avec la réponse choisie et le temps de réponse, les quatre écrans de lecture, et le compositeur en maquette jouable.

---

## 12. Les six décisions qui t'appartiennent

1. **L'adaptation par élève** touche I-21. Une ligne à écrire dans la vision avant tout code (section 7).
2. **Le mix 45 / 20 / 20 / 15** : hypothèse à garder telle quelle pour la V1, ou autre répartition de départ.
3. **Le contrôle sans effet sur la progression** : on l'expose au professeur en V1, ou on garde deux choix.
4. **L'estimation de durée** dans le preview : médiane du produit assumée, ou rien tant qu'on n'a pas la vraie.
5. **Le format Expert** : retombée automatique en QCM pour les élèves qui ne l'ont pas débloqué, ou refus d'assigner tant que la classe entière ne peut pas le passer.
6. **Un devoir en `update_mastery` fait répondre sur des faces choisies par le professeur, parfois absentes du pool.** Écrire leur état crée une ligne d'état pour ces faces. Mon avis : une ligne d'état n'est pas une entrée dans le pool, et une réponse reste un fait qu'on enregistre. Mais c'est une frontière, et elle mérite ton arbitrage explicite.
