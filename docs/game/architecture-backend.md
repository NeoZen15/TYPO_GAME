# DWIGGINS — Architecture backend

Date : 2026-07-29.
Statut : **proposition, en attente de validation. Aucune implémentation avant accord.**
Source de vérité produit : `docs/game/vision-produit-dwiggins.md` (invariants I-15 à I-27).
Source de vérité du fonctionnement moteur : `docs/game/training-engine-spec-v2-clean.md` (invariants I-01 à I-14).

## 0. Principe directeur

Le backend est le produit. Ce document décrit donc **où vit chaque décision**, et surtout **où vit chaque interdit**. Règle de conception appliquée partout : un invariant ne doit pas être « respecté par le code », il doit être **impossible à enfreindre**. Le repo a déjà un exemple qui marche, le garde-fou de licence, posé dans la seule requête qui expose une typographie à un joueur : aucun écran, aucune fonction de seeding ne peut le contourner. Chaque interdit de la vision est traité ici avec le même patron.

Rien de ce document ne s'applique à la base de production sans feu vert. La vérification se fait sur une **branche Neon jetable**.

## 1. Ce qui existe déjà, mesuré

Point de départ factuel, relevé en lecture seule le 2026-07-29, pour ne rien reconstruire de ce qui est là.

| Table | Colonnes | Rôle actuel |
|---|---|---|
| `users` | 16 | identité, `role` (`guest`, `player`, `admin`), `dreyfus_level` et `dreyfus_sub`, `global_q_index`, `pending_unlock_count`, `onboarding_familiarity`, consentement, suppression et anonymisation |
| `sessions` | 16 | `mode`, `status` (`active`, `completed`, `abandoned`, `invalid`), `seed`, compteurs, `duration_ms`, `client_fingerprint`, `integrity_flags` |
| `user_typeface_state` | 20 | l'état pédagogique par couple utilisateur et typographie : mastery, `next_due_after_q`, `interval_questions`, `adaptive_coef`, `in_active_pool`, compteurs |
| `user_event_fact` | 24 | le journal, une ligne par réponse : `answer_slug`, `response_time_ms`, `mastery_before` et `after`, `display_word`, `reason_code`, `attempt_index`, `is_retry`, `seed`, `engine_version` |

Fonctions vivantes en base : `init_user_pool` (deux surcharges), `rebalance_user_pool`, `try_unlock_one_typeface`, `register_mastery_unlock`, `recompute_visible_level`, plus la vue `v_user_visible_level`.

**Ce qui manque pour la vision** : aucune notion de contexte ni de politique de progression, aucun rôle professeur, élève ou administration, aucune école, classe, invitation ni assignation, aucune séparation des données de test.

## 2. Sessions : les trois axes

Le cœur de l'architecture. Trois colonnes ajoutées à `sessions`, chacune répondant à une question distincte.

| Colonne | Valeurs | Question à laquelle elle répond |
|---|---|---|
| `mode` (existe) | `training`, `competition`, `expert` | comment on joue |
| `context` (nouveau) | `personal`, `teacher_assignment` | à qui appartiennent les données, qui peut les lire |
| `progression_policy` (nouveau) | `update_mastery`, `observe_only` | quel effet pédagogique la session produit |
| `assignment_id` (nouveau, nullable) | référence l'assignation | non nul si et seulement si `context = teacher_assignment` |

Contraintes à poser dans le schéma, pas dans le code :

- `CHECK ((context = 'teacher_assignment') = (assignment_id IS NOT NULL))`, pour qu'une session assignée sans assignation soit impossible ;
- `CHECK (mode <> 'competition' OR progression_policy = 'observe_only')`, qui rend l'invariant I-22 **inviolable au niveau de la ligne** : aucune session de compétition ne peut exister avec une politique qui écrirait le mastery, en personnel comme en assigné ;
- la politique est **obligatoire** (`NOT NULL`), donc jamais implicite. Le défaut par mode est appliqué à la création côté serveur, jamais par le client.

Les trois se propagent sur `user_event_fact` (`context`, `progression_policy`, `assignment_id`), pour qu'une lecture n'ait jamais besoin d'une jointure pour connaître ses droits. C'est la même raison qui fait que `mode` y est déjà dupliqué.

### 2.2 Les quatre contextes moteur, et ce que chacun a le droit de faire

Ajouté le 2026-09-10, sur demande du propriétaire, **avant** d'écrire une ligne de schéma. Le principe à verrouiller d'abord : **DWIGGINS n'est pas un produit où l'élève ne joue que si un professeur lui donne quelque chose.** Le parcours personnel est premier et autonome, l'assignation est un second parcours qui coexiste avec lui et ne le remplace jamais. C'est inscrit en I-26.

**Les quatre contextes ne sont pas un quatrième axe.** Ils sont des combinaisons des trois colonnes du §2, et c'est exactement pourquoi ces trois colonnes suffisent. Une cinquième combinaison existe déjà en production, la compétition personnelle, et une sixième est parkée, le mode Expert.

| Contexte | `mode` | `context` | `progression_policy` |
|---|---|---|---|
| Entraînement personnel | `training` | `personal` | `update_mastery` |
| Exercice assigné | `training` | `teacher_assignment` | `update_mastery` |
| Contrôle assigné | `training` | `teacher_assignment` | `observe_only` |
| Compétition assignée | `competition` | `teacher_assignment` | `observe_only` |
| Compétition personnelle (existe) | `competition` | `personal` | `observe_only` |

**La matrice des droits.** Chaque ligne est une propriété vérifiable, et c'est ce qui permet à un garde de la tenir.

| | Entraînement personnel | Exercice assigné | Contrôle assigné | Compétition assignée |
|---|---|---|---|---|
| Qui crée la session | l'élève, en entrant dans le mode | l'élève, en ouvrant le devoir | l'élève, en ouvrant le contrôle | l'élève, en ouvrant le devoir |
| D'où vient l'ensemble jouable | le **pool personnel** (`user_typeface_state`) | le **périmètre du contrat**, jamais le pool (I-21) | le périmètre du contrat | le périmètre du contrat |
| Peut LIRE l'état personnel | oui, c'est sa matière | **oui, pour adapter** (I-25) | **non** | non, sauf pour journaliser où en était l'élève |
| Peut ÉCRIRE l'état personnel | oui, réponse par réponse | **oui** (I-22), invisible du professeur (I-23) | **non** | **non**, interdit au niveau de la ligne |
| Adaptative | oui, par la répétition espacée | oui, à l'intérieur du contrat | non, un contrôle est calibré pareil pour tous | non, c'est ce qui la rend comparable |
| Répétition espacée | active | active | **inactive**, aucun intervalle n'est déplacé | inactive |
| Distracteurs | proximité selon le mastery de la face | proximité selon la bande d'exigence, ajustée par élève | proximité selon le seul cran du professeur | proximité fixe, identique pour tous |
| Longueur | aucune, l'élève décide (I-17) | budget de questions du contrat | budget de questions du contrat | deux minutes |
| Résultat produit | un bilan de séance, pour l'élève | justesse au premier essai, plus le déplacement privé | justesse au premier essai | un score et un classement |
| Visible du professeur | **jamais rien** | les résultats de SA session uniquement | les résultats de SA session uniquement | score et classement de SA session |

**Le sens de circulation, et il est unique.** L'entraînement personnel peut nourrir le moteur pour personnaliser un **exercice assigné**. Ce que l'élève fait dans un exercice assigné peut enrichir son modèle personnel, mais **seulement** en Exercice : le Contrôle mesure et la Compétition performe, donc ni l'un ni l'autre ne déplace la maîtrise. Et dans tous les cas, **rien de l'état privé ne remonte au professeur** : il lit ce que ses propres exercices ont produit, jamais l'activité libre, jamais le pool, jamais le déplacement que sa session a produit.

**Ce que le code fait déjà, mesuré le 2026-09-10 et pas déduit.**

- L'**entraînement personnel** est complet : pool personnel, intervalles, écriture du mastery réponse par réponse, paliers de distracteurs pilotés par le mastery de la face demandée.
- La **compétition personnelle** est déjà, par construction, le patron d'une session qui n'appartient pas au pool : son ensemble jouable est **une requête catalogue** mise en cache par joueur, elle **n'écrit jamais** `user_typeface_state` (seul le fournisseur d'entraînement l'écrit, trois instructions), et elle lit la maîtrise de la face **uniquement pour la journaliser**. Ses distracteurs sont pondérés sur la catégorie, le cluster et un hachage de graine, **jamais** sur la maîtrise du joueur : c'est précisément ce qui rend deux scores comparables.
- Donc **le Contrôle assigné est architecturalement une compétition avec un périmètre de professeur et un budget de questions**, et non un entraînement bridé. C'est la façon la moins risquée de le construire.
- L'**exercice assigné** est le seul des quatre qui demande un chemin neuf : un ensemble jouable venu du contrat, une lecture de l'état personnel pour calibrer, et une écriture du mastery. Aucune des trois pièces n'existe.
- **Rien de tout cela n'est aujourd'hui exprimable** : `sessions` n'a ni `context`, ni `progression_policy`, ni `assignment_id`, et le journal ne les porte donc pas non plus. Tant que ces colonnes n'existent pas, un professeur ne peut pas lire « ce que mes exercices ont produit » sans lire l'entraînement libre, ce qui est interdit. C'est la première migration, et elle commande tout le reste.

**UNE CONTRADICTION QUI SEMBLAIT OUVERTE EST DÉJÀ TRANCHÉE PAR LE SCHÉMA.** Un exercice assigné en `update_mastery` fait répondre sur des faces choisies par le professeur, dont certaines ne sont pas dans le pool de l'élève. Écrire leur maîtrise crée une ligne d'état : est ce que le professeur façonne alors l'espace privé de l'élève, ce que le registre des contradictions de la vision redoutait au point 3 ? Non, et la réponse est dans la table depuis le début : `user_typeface_state.in_active_pool` est `NOT NULL DEFAULT false`, et le pool est défini par `in_active_pool = true`. Donc une réponse donnée dans un devoir **enregistre la maîtrise de la face sans la faire entrer dans le pool personnel**. Une ligne d'état n'est pas une appartenance au pool. La seule porte d'entrée du pool reste la règle du moteur, trois faces stabilisées pour une nouvelle, et le professeur ne l'ouvre jamais. Rien à ajouter au schéma, rien à décider : il fallait le mesurer et l'écrire.

**Deux conséquences à assumer, toutes deux petites.** Une face montée au niveau 4 par un devoir compte dans le niveau global visible de l'élève, puisqu'il l'a réellement apprise, et ce niveau reste invisible du professeur (I-23). Et le moteur, quand il choisit la prochaine face à faire entrer dans le pool, **ne privilégie pas** ce que le professeur a enseigné : ce serait laisser un tiers dessiner l'espace privé, même avec de bonnes intentions. C'est une idée à reprendre plus tard, pas une V1.

**UN LEVIER, UN CONDUCTEUR PAR CONTEXTE DE SÉANCE.** Principe d'architecture posé par le propriétaire le 2026-09-11, après vérification que les crans d'exigence ne créaient pas un système de difficulté parallèle. Le moteur a plusieurs leviers (quelle face est demandée, la proximité des mauvaises réponses, la maîtrise interne, le niveau global) et le cran d'exigence n'en touche **qu'un** : la proximité. Ce levier avait un conducteur, la maîtrise de la face demandée ; il en a maintenant deux, et **jamais en même temps** : en séance personnelle aucun cran n'est transmis et le comportement historique tient, en séance assignée le contrat décide et la maîtrise ne fait que déplacer d'un cran à l'intérieur de la bande. **La règle générale à respecter pour toute évolution : un levier n'accepte qu'un conducteur par contexte de séance, et l'ordre de priorité se décide le jour où un second se présente.** Le cas connu qui se présentera : la spec moteur prévoit que le niveau global déverrouille un environnement plus exigeant par la similarité des distracteurs, donc par ce même levier, en séance personnelle.

**LE RAPPROCHEMENT PROPOSE, IL N'IDENTIFIE JAMAIS.** Même date, même raison. Comparer des noms d'établissements normalisés (minuscules, accents, espaces) est une **aide à la décision** et jamais une décision : deux établissements différents peuvent porter exactement le même nom, et deux écritures du même peuvent différer d'un accent. Donc l'administration reçoit une **liste de candidats** avec la raison de chaque rapprochement, l'humain tranche, et **accepter exige que ce choix ait été fait**, existant nommé ou nouveau demandé. Le jour où d'autres signaux existeront, ville, domaine de courriel, identifiant d'établissement, ils s'ajouteront aux raisons et pourront peser : la forme est déjà celle là. Une normalisation pratique aujourd'hui ne doit pas devenir une règle d'identité demain.

**Les recommandations existent des deux côtés, et c'est la même intelligence.** Le professeur reçoit « voilà ce que ta classe devrait travailler », calculé **uniquement** sur les assignations qu'il a données. L'élève reçoit, sur son profil, « voilà ce que ton œil devrait travailler maintenant », calculé **uniquement** sur son propre état. Les deux calculs partagent leur méthode et **jamais leurs sources** : la recommandation d'un élève ne lit aucune donnée institutionnelle, celle d'un professeur ne lit aucune donnée personnelle. Inscrit en I-27.

### 2.1 Le cycle de vie d'une séance sans limite

`TRAINING_TOTAL_ROUNDS` disparaît. La séance devient :

1. **Ouverture** : l'élève entre dans le mode. Le serveur crée la session (`training`, `personal`, `update_mastery`) et sert la première question. Le `global_q_index` **continue** là où il s'était arrêté, il est cumulé sur toutes les séances.
2. **Boucle** : questions servies sans compteur de fin. Aucun état « manche N sur 8 » n'existe plus dans le contrat.
3. **Clôture volontaire** : l'élève déclenche « terminer ma séance ». La session passe en `completed` et `ended_at` est écrit. `duration_ms` **n'est pas écrit** : c'est une colonne `GENERATED ALWAYS AS ... STORED` que la base calcule seule depuis `ended_at` et `started_at` (`db/migrations/003_users_sessions_pool.sql:115-122`). Toute écriture directe est rejetée par Postgres, erreur 428C9.
4. **Bilan** : agrégat **borné à la session**, calculé à la demande depuis `user_event_fact` filtré sur `session_id`. Durée, réponses, précision, typographies renforcées, nouvelles découvertes, principales confusions, évolution du pool. Il ne clôt, ne réinitialise et ne suspend **aucun** état pédagogique (I-17).
5. **Abandon** : une session laissée ouverte est marquée `abandoned` par expiration, sans conséquence pédagogique. Le travail déjà fait reste acquis, puisque le mastery est écrit réponse par réponse et non en fin de séance.

Point à ne pas manquer à l'implémentation : le bilan est une **vue**, jamais un enregistrement. S'il devait être mis en cache pour l'affichage, il reste intégralement reconstructible depuis le journal.

### 2.3 L'accès enseignant : demande, validation, provisionnement

Ajouté le 2026-09-10, sur décision du propriétaire. **Le schéma et l'authentification sont prêts maintenant, le tableau de bord se construit plus tard.**

**Il n'y a pas d'inscription libre.** Un enseignant **demande**, le propriétaire **valide**, et tout est créé derrière. C'est le modèle le plus simple qui laisse une trace, une file d'attente et une décision attribuable.

**Le flux de la V1, dans l'ordre.** Une demande arrive et se pose en `pending`. DWIGGINS **pré-vérifie et préremplit** ce qu'il peut : doublons de demandes sur l'adresse, existence d'un compte, établissement déjà connu ou nouveau. Le propriétaire lit la fiche, voit **l'aperçu de ce qui va être créé**, et clique. Sur **Approve**, le système crée le compte Clerk, l'école si elle n'existe pas, l'appartenance enseignante, puis envoie l'invitation. Sur **Reject**, **rien n'est créé**.

**Ce que le schéma porte pour ça** (migration 023, `access_requests`) : la demande telle qu'elle a été déclarée, le statut en trois valeurs qui sont les trois colonnes du tableau de bord (`pending`, `approved`, `rejected`), la trace de décision (qui, quand), ce qui a été créé derrière (compte, école) et l'identifiant de l'invitation Clerk, pour que l'écran puisse dire « envoyée, pas encore acceptée » sans le deviner et pour n'en envoyer jamais deux.

**Trois décisions de schéma qui évitent une dette.**

- **Aucune adresse dans `users`, et il n'y en aura pas.** L'adresse appartient à Clerk ; la dupliquer créerait deux vérités pour une personne. La détection de doublons se fait donc en deux temps : les demandes entre elles par l'adresse dans notre table, et l'existence d'un compte en interrogeant Clerk au moment de l'affichage. Zéro colonne à ajouter.
- **Une demande acceptée exige un compte créé**, par contrainte. Si une étape du provisionnement échoue, la demande **reste en attente** et le tableau de bord le montre, au lieu d'afficher un professeur qui n'existe pas.
- **`invitations` reste la table des ÉLÈVES.** Son `class_id` est obligatoire, et il doit le rester : une invitation d'enseignant n'a pas de classe, et c'est Clerk qui l'envoie. Élargir cette table pour y faire entrer les deux cas rendrait les deux flous.

**Ce que l'authentification doit exposer, et qu'elle expose déjà.** `getCurrentIdentity()` rend le rôle (`guest`, `player`, `admin`) et l'appartenance enseignante, lue dans `school_members` et pas déduite du rôle. Le tableau de bord Admin se garde donc sur `role = 'admin'`, et l'espace professeur sur l'appartenance. Une page d'administration doit **refuser de se rendre** pour qui n'est pas administrateur : la borne des données protège les lectures, elle ne remplace pas le refus d'une page.

**Les scripts restent des outils de secours techniques**, jamais le geste quotidien. Le geste quotidien est le tableau de bord.

## 3. L'état pédagogique et sa frontière de lecture

### 3.1 Les faits, et eux seuls

Deux magasins de faits, et rien d'autre n'a le droit d'être une vérité pédagogique :

- `user_typeface_state`, l'état de répétition espacée par couple utilisateur et typographie ;
- `user_event_fact`, le journal append-only, une ligne par réponse.

Tout le reste (niveau visible, carte DWIGGINS, axes, paliers, statistiques, bilans, vues professeur) est **recalculé**. Un cache est permis s'il est reconstructible et jamais traité comme source.

### 3.2 L'écriture du mastery vit dans la base, pas dans TypeScript

Proposition centrale, et c'est le point le plus important de ce document.

Aujourd'hui, `submitTrainingAnswer` décide en TypeScript d'écrire `user_typeface_state`. Si demain une session assignée en `observe_only` passe par un autre chemin d'appel, rien n'empêche l'écriture. Donc : **une seule fonction SQL `apply_answer(p_session_id, ...)` porte l'écriture pédagogique**, et c'est **elle** qui lit la politique de la session pour décider.

```
apply_answer(session_id, typeface_slug, answer_slug, response_time_ms, attempt_index) :
    policy = (SELECT progression_policy FROM sessions WHERE session_id = ...)
    écrire la ligne de journal  (toujours, avec context et policy)
    si policy = 'observe_only' : ne toucher NI mastery, NI intervalle, NI pool, NI adaptive_coef
    si policy = 'update_mastery' : appliquer §5 de la spec moteur (promotion, démotion, coef, cooldown, unlock I-07)
```

Conséquence : aucun appelant ne peut se tromper, y compris un futur mode professeur écrit par quelqu'un qui n'aurait pas lu la vision. L'interdit vit sous le code applicatif.

### 3.3 La porte de lecture professeur

Une **seule** fonction de lecture pour tout ce qui est destiné à un professeur :

```
assignment_results(p_teacher_id, p_assignment_id) :
    vérifie que l'assignation appartient à ce professeur, sinon retourne vide
    lit user_event_fact JOIN sessions
      WHERE assignment_id = p_assignment_id
        AND context = 'teacher_assignment'
    ne joint JAMAIS user_typeface_state
```

Trois garanties superposées, exactement les trois niveaux demandés :

- **schéma** : `context`, `progression_policy` et `assignment_id` existent comme données de premier rang, sur la session et sur l'événement ;
- **autorisations** : politiques RLS Postgres sur `user_typeface_state` et sur `user_event_fact`, plus un rôle base distinct pour les lectures professeur, qui n'a simplement pas le droit `SELECT` sur `user_typeface_state`. Un bug applicatif ne suffit alors plus à fuiter ;
- **requêtes** : un module unique côté serveur, et un contrôle de porte qualité `check:teacher-read-gate` qui échoue si un module destiné au professeur importe ou mentionne `user_typeface_state`, sur le modèle exact de `check:dev-routes` qui suit déjà les chaînes d'import à travers les ponts de compatibilité.

Ce que le professeur ne voit **jamais**, y compris quand sa propre session a fait progresser l'élève (I-23) : le mastery global, le pool, les intervalles, le déplacement produit par sa session, et tout ce qui vient d'un contexte `personal`.

## 4. Identités, école, classes

Extension de l'existant, en suivant `classes-comptes-spec.md` pour tout ce qui n'est pas caduc.

- `user_role_enum` reçoit `student`, `teacher`, `school_admin`. `guest` et `player` restent, le joueur solo grand public ne disparaît pas.
- `users` reçoit `email` (unique), `password_hash`. Auth maison, pas de fournisseur tiers.
- `schools` : l'établissement, porteur de la **licence** et du **compteur de sièges**. La licence ne vit jamais sur le professeur.
- `school_members` : rattachement d'un professeur ou d'un administrateur à un établissement.
- `classes` : `school_id`, `teacher_id`, `name`, `join_code`.
- `class_students` : rattachement d'un élève à une classe.
- `invitations` : `email`, `token` à usage unique, `status`. L'élève choisit lui même son mot de passe, le professeur ne peut jamais le définir.
- `assignments` : `class_id`, `teacher_id`, la définition de la session pédagogique (typographies choisies, difficulté, mode, nombre de questions, durée, échéance) et la `progression_policy` retenue pour ce devoir.

**Invariant de principe conservé** : le compte appartient à la personne, la progression est personnelle et portable, elle survit à l'expiration de la licence et au départ de la classe. La licence conditionne l'accès, jamais la propriété.

Point de vigilance à écrire dans le code : c'est le professeur qui provisionne le compte de l'élève, et c'est ce même élève qui détient ensuite des données que le professeur ne doit pas lire. Le provisionnement ne doit donc ouvrir **aucun** pouvoir résiduel : pas de réinitialisation de mot de passe par le professeur, pas d'usurpation, pas de « connexion en tant que ».

## 5. Télémétrie et indicateurs

### 5.1 Ce qui s'ajoute au journal

`user_event_fact` est déjà riche (24 colonnes, `answer_slug` et `response_time_ms` remplis à 100 pour cent). Ajouts nécessaires :

- `context`, `progression_policy`, `assignment_id` : la propagation des trois axes ;
- `options_offered` (jsonb) : **l'ensemble des options proposées**, seul manque réel côté diagnostic. Aujourd'hui on sait ce qui a été choisi, pas ce qui a été proposé et écarté, donc la difficulté réelle d'une question n'est pas mesurable ;
- `data_origin` (`real`, `test`) : voir §6.

La migration 011, sept partitions mensuelles 2026, est écrite et non appliquée. Elle redevient pertinente dès que le volume réel démarre.

### 5.2 Les vues, et à qui elles s'adressent

| Vue | Public | Source | Interdits |
|---|---|---|---|
| Bilan de séance | élève | journal filtré sur `session_id` | ne persiste rien |
| Carte DWIGGINS, axes et paliers | élève | comptes de mastery et journal, contexte `personal` inclus | jamais de note brute (I-18) |
| Niveau Dreyfus | moteur | comptes de mastery | pas une note pour l'élève (I-20) |
| Résultats d'une assignation | professeur | `assignment_results` uniquement | aucun accès à `user_typeface_state` (I-15, I-16, I-23) |
| Engagement (XP, série, jetons) | élève | magasin séparé | n'influence jamais le moteur, jamais visible du professeur (I-19) |

L'engagement vit dans une table distincte (`user_engagement`), explicitement étiquetée non pédagogique, jamais jointe dans une lecture professeur ni dans une décision de sélection.

### 5.3 Analyses internes : régime validé (invariant I-24)

Débloqué le 2026-07-29. Le principe est validé, à condition de distinguer **le professeur** de **l'opérateur du produit** : la confidentialité interdit la lecture institutionnelle de l'entraînement personnel, elle n'interdit pas d'améliorer le produit avec ses propres données.

Conditions cumulatives à implémenter, pas à documenter seulement :

| Règle | Traduction technique |
|---|---|
| Jamais accessible au professeur ni à l'école | les vues d'analyse interne vivent hors de la porte `assignment_results`, sur un rôle base distinct |
| Jamais utilisé pour évaluer un élève | aucune vue d'analyse interne n'alimente une vue professeur ni une décision de notation |
| Accès nominatif réservé aux opérations indispensables | sécurité, support, exercice des droits ; chemin d'accès distinct et restreint |
| Analyses produit pseudonymisées ou agrégées de préférence | identifiant de corrélation stable et non signifiant plutôt que `user_id` en clair dans les vues d'analyse |
| Cohortes trop petites masquées sur les tableaux de bord généraux | seuil appliqué à la **vue de tableau de bord**, pas à toute requête interne : un diagnostic technique ou pédagogique peut légitimement suivre un cas individuel |
| Accès journalisés | table d'audit des lectures nominatives, append-only |
| Durées de conservation définies | politique de purge par nature de donnée, articulée avec la rétention de 36 mois déjà décidée |
| Données de test séparées | `data_origin`, voir §6 |

**Vocabulaire imposé** : tant que les événements restent techniquement rattachables à un compte, on écrit **pseudonymisé**. Le mot « anonymisé » est proscrit dans le projet, il décrirait une garantie que le schéma n'offre pas.

## 6. Les quatre natures de données

Séparation à garantir par le schéma, pas par convention.

1. **Pédagogique** : `user_typeface_state`, plus les événements de contexte `personal`. Privé, jamais lisible par un tiers.
2. **Session** : `sessions` et les agrégats bornés à une session. Durée de vie courte, valeur analytique faible passé le bilan.
3. **Assignation** : événements de contexte `teacher_assignment`. Seule matière lisible par un professeur, et seulement la sienne.
4. **Test** : colonne `data_origin` sur `users`, `sessions` et `user_event_fact`, écrite par le serveur, `real` par défaut et `test` quand le drapeau d'exécution de test est actif.

Le point 4 règle une dette réelle et mesurée : la base contient aujourd'hui 92 comptes invités, 193 sessions et 217 premières tentatives dont **207 en compétition à 24,6 pour cent de réussite** avec une médiane de réponse de 440 ms et un minimum de 10 ms. C'est du trafic de test indistinguable d'un joueur, et c'est ce qui rend tout KPI pédagogique illisible aujourd'hui. Deux mesures complémentaires : `data_origin` pour que ce soit **séparable**, et une branche Neon dédiée aux tests pour que ce soit **absent** de la production.

## 7. Séquencement

L'ordre est choisi pour que rien de risqué ne précède ce qui débloque, et pour qu'**aucune ligne de code professeur n'existe avant la porte d'étanchéité**.

| Phase | Contenu | Schéma touché | Pourquoi à ce rang |
|---|---|---|---|
| 0 | Source runtime unique des polices, descripteur porté par la question, injection à la demande | aucun | débloque le P0, le moteur décide déjà juste, sa décision doit arriver à l'œil |
| 0 bis | `check:font-renderable` dans la porte qualité | aucun | rend le défaut impossible plutôt que corrigé |
| 1 | Séance sans limite, clôture volontaire, bilan de séance | aucun | décision produit validée, et le contrat de session change avant qu'on bâtisse dessus |
| 2a | Télémétrie honnête : `misread_shown` seulement si une carte a été affichée | aucun | aucune décision produit requise, et chaque jour d'attente ajoute de la donnée fausse |
| 2b | Type Card Misread elle même | aucun | **suspendu avec l'arbitrage D**, conception produit en cours |
| 3 | Les trois axes en base, `apply_answer`, RLS, porte de lecture, `data_origin` | oui, sur branche Neon | **fondation d'étanchéité, avant toute fonctionnalité professeur** |
| 4 | Auth, rôles, écoles, classes, invitations | oui | la brique la plus lourde, elle arrive sur un socle déjà étanche |
| 5 | Assignations et lecture des résultats | oui | ne peut exister qu'après 3 et 4 |
| 6 | Couche d'engagement séparée, régime d'analyse interne | oui | dépend de l'arbitrage A |

Les phases 0, 0 bis, 1 et 2 ne touchent **pas** le schéma et ne touchent **pas** la logique de sélection du moteur : elles sont donc sans risque de régression pédagogique, et vérifiables par la porte qualité existante.

## 8. État des arbitrages

**A. Analyses internes : RÉSOLU** le 2026-07-29, régime en §5.3 et invariant I-24. Le §5.3 et la phase 6 sont débloqués.

**B. Moment de franchissement : RÉSOLU** le 2026-07-29. Le toast est conservé mais transformé en signal rare et qualitatif qui célèbre une évolution du regard, pas la montée d'un chiffre (vision §8.1). Conséquence pour l'implémentation : le payload continue de porter `levelChanged`, mais le rendu ne montre plus de libellé de palier ni de compteur.

**C. Statut de la math spec v3.1 : en cours.** Orientation : périmée pour l'ordonnancement pédagogique, mécaniques d'engagement éventuellement récupérées dans un document séparé. Contrainte imposée : **annoter chaque section**, un document moitié actif moitié périmé sans annotation fera reprendre la mauvaise logique.

**D. Type Cards : PARKÉ volontairement** le 2026-07-29. Le rôle, les familles et le comportement des cartes relèvent encore de la conception produit. Détail et orientation en vision §12 D.

**Conséquence de séquencement : la phase 2 se scinde en deux.** La **2a** ne dépend d'aucune décision produit et reste au programme : `misread_shown` ne doit être écrit que si une carte a réellement été affichée, sinon l'historique contiendra des affichages qui n'ont jamais eu lieu et la mesure d'effet des futures cartes sera faussée dès le premier jour. La **2b**, la carte elle même, part en attente avec D.

Les phases 0, 0 bis, 1 et 2a ne dépendent d'aucun arbitrage ouvert. Seule la 2b est suspendue.
