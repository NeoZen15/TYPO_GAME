# DWIGGINS — Architecture backend

Date : 2026-07-29.
Statut : **proposition, en attente de validation. Aucune implémentation avant accord.**
Source de vérité produit : `docs/game/vision-produit-dwiggins.md` (invariants I-15 à I-23).
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

### 2.1 Le cycle de vie d'une séance sans limite

`TRAINING_TOTAL_ROUNDS` disparaît. La séance devient :

1. **Ouverture** : l'élève entre dans le mode. Le serveur crée la session (`training`, `personal`, `update_mastery`) et sert la première question. Le `global_q_index` **continue** là où il s'était arrêté, il est cumulé sur toutes les séances.
2. **Boucle** : questions servies sans compteur de fin. Aucun état « manche N sur 8 » n'existe plus dans le contrat.
3. **Clôture volontaire** : l'élève déclenche « terminer ma séance ». La session passe en `completed` et `ended_at` est écrit. `duration_ms` **n'est pas écrit** : c'est une colonne `GENERATED ALWAYS AS ... STORED` que la base calcule seule depuis `ended_at` et `started_at` (`db/migrations/003_users_sessions_pool.sql:115-122`). Toute écriture directe est rejetée par Postgres, erreur 428C9.
4. **Bilan** : agrégat **borné à la session**, calculé à la demande depuis `user_event_fact` filtré sur `session_id`. Durée, réponses, précision, typographies renforcées, nouvelles découvertes, principales confusions, évolution du pool. Il ne clôt, ne réinitialise et ne suspend **aucun** état pédagogique (I-17).
5. **Abandon** : une session laissée ouverte est marquée `abandoned` par expiration, sans conséquence pédagogique. Le travail déjà fait reste acquis, puisque le mastery est écrit réponse par réponse et non en fin de séance.

Point à ne pas manquer à l'implémentation : le bilan est une **vue**, jamais un enregistrement. S'il devait être mis en cache pour l'affichage, il reste intégralement reconstructible depuis le journal.

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
