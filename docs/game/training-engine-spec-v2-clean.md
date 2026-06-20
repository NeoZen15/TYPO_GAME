# Training Engine Spec v2 (Scalable)
# JEUX DE TYPO — Mode Training
# Version 2.0 — Document exécutable

---

## 1. Résumé exécutif

Le mode Training est une boucle adaptative continue sans limite de temps ni de score visible. Le cœur est un moteur de répétition espacée par utilisateur par typographie (mastery_level 0–4, intervalles dynamiques). Le pool actif par utilisateur est d'environ 30 typographies ; il grandit progressivement à mesure que des typographies se stabilisent au niveau 4. Le catalogue global peut atteindre 1000+ typographies sans modification structurelle. Le backend décide seul de la typographie suivante, des distracteurs, et du déclenchement des Type Cards de correction (Misread). Le frontend affiche, capture la réponse, mesure le temps de réponse, et transmet. Les invariants pédagogiques sont non négociables et vérifiés par le backend à chaque sélection. La migration V1→V2 se fait par flag feature sans réécriture de la couche design existante.

---

## 2. Invariants pédagogiques

Liste fermée. Aucune logique backend ou frontend ne peut les contredire.

| # | Invariant | Source |
|---|-----------|--------|
| I-01 | Une typographie ratée ne revient **jamais** immédiatement. Retour minimum après **2 questions** d'écart. | V4 |
| I-02 | Une typographie réussie ne revient **pas** dans les **5 questions suivantes** minimum. | V4 |
| I-03 | Une bonne réponse fait **monter d'un niveau** (mastery_level + 1, plafonné à 4). | V4 |
| I-04 | Une mauvaise réponse fait **descendre d'un niveau** (mastery_level - 1, plancher à 0). Exception : niveau 4 → descend à 3 uniquement. | V4 |
| I-05 | Le mastery_level est **par utilisateur par typographie**. Il n'existe pas de niveau global fixe d'une typographie. | V4 |
| I-06 | Une typographie n'est **jamais supprimée** du pool ou du système. Seul son intervalle de retour change. | V4 |
| I-07 | Une nouvelle typographie n'entre dans le pool actif que lorsque **3 typographies différentes** atteignent mastery_level 4. Une seule typographie est introduite à la fois. | V4 |
| I-08 | Le niveau global visible (N.1–E.5) ne remplace **jamais** la logique interne de répétition espacée. Il en est la lecture agrégée. | V4 |
| I-09 | Le mode Training **n'a pas de score visible** et **pas de limite de temps**. | V4 |
| I-10 | Le frontend ne décide **jamais** de la typographie suivante ni des distracteurs. | V4 |
| I-11 | Le score du mode Compétition n'influence **jamais** le mastery_level. | V4 |
| I-12 | En mode invité, **aucune donnée n'est persistée** après fermeture de session. | V4 |
| I-13 | Le poids adaptatif ne peut **jamais** casser I-01/I-02 ni inverser la logique de répétition espacée (la répétition reste dominante). | V4 |
| I-14 | En cas de retry sur une même question, **une seule** pénalité mastery/cooldown est appliquée par question affichée. | V2 |

---

## 3. Modèle de données canon

### 3.1 Entités

#### `user_typeface_state` — état par utilisateur par typographie

| Champ | Type | Nullable | Description |
|-------|------|----------|-------------|
| `user_id` | `UUID` | non | Référence utilisateur (ou session_id invité) |
| `typeface_slug` | `VARCHAR(64)` | non | FK → `typefaces.typeface_slug` |
| `mastery_level` | `SMALLINT` | non | 0–4. Niveau interne de maîtrise. |
| `correct_streak` | `SMALLINT` | non | Nombre de bonnes réponses consécutives depuis dernière erreur. Reset à 0 sur erreur. |
| `total_correct` | `INT` | non | Compteur total de bonnes réponses. |
| `total_errors` | `INT` | non | Compteur total d'erreurs. |
| `session_errors` | `SMALLINT` | non | Erreurs dans la session courante. Reset à 0 à chaque `start_session`. |
| `consecutive_session_errors` | `SMALLINT` | non | Erreurs consécutives sur cette typo **dans la session courante**. Reset sur bonne réponse. |
| `last_shown_at_q` | `INT` | non | Index global de question lors de la dernière apparition. |
| `next_due_at_q` | `INT` | non | Index global de question à partir duquel cette typo peut réapparaître. |
| `interval_questions` | `INT` | non | Intervalle courant en nombre de questions. Calculé par le moteur. |
| `in_active_pool` | `BOOLEAN` | non | True si dans le pool actif de l'utilisateur. |
| `paused_until_q` | `INT` | oui | Pause temporaire jusqu'à cet index global (null = non pausée). |
| `first_seen_at` | `TIMESTAMPTZ` | oui | Première apparition (null = jamais vue). |
| `last_seen_at` | `TIMESTAMPTZ` | oui | Dernière apparition. |
| `adaptive_weight` | `FLOAT` | non | Coefficient adaptatif [0.5–2.0]. Défaut 1.0. Influence l'intervalle de retour. |
| `created_at` | `TIMESTAMPTZ` | non | Création de l'enregistrement. |
| `updated_at` | `TIMESTAMPTZ` | non | Dernière mise à jour. |

#### `user_session` — session Training en cours

| Champ | Type | Nullable | Description |
|-------|------|----------|-------------|
| `session_id` | `UUID` | non | PK. |
| `user_id` | `UUID` | non | |
| `mode` | `ENUM('training','competition','expert')` | non | |
| `current_display_word` | `VARCHAR(64)` | non | Mot courant affiché pour la question active. |
| `word_policy` | `ENUM('training_every_5','competition_every_question','expert_every_question')` | non | Politique de rotation des mots selon mode. |
| `word_change_interval_q` | `SMALLINT` | non | Nombre de questions entre deux changements de mot (5 en Training, 1 sinon). |
| `current_q_index` | `INT` | non | Index courant de question dans cette session (démarre à 0). |
| `global_q_index` | `INT` | non | Index global cumulé toutes sessions confondues pour cet utilisateur. |
| `started_at` | `TIMESTAMPTZ` | non | |
| `last_active_at` | `TIMESTAMPTZ` | non | |
| `is_guest` | `BOOLEAN` | non | True = session invité, pas de persistance. |
| `expires_at` | `TIMESTAMPTZ` | oui | Date d'expiration de session (obligatoire en invité). |
| `active_pool_snapshot` | `JSONB` | non | Snapshot des slugs du pool actif au démarrage de session. |

#### `user_session_event` — trace analytics par question

| Champ | Type | Nullable | Description |
|-------|------|----------|-------------|
| `event_id` | `UUID` | non | PK. |
| `session_id` | `UUID` | non | FK. |
| `global_q_index` | `INT` | non | |
| `question_id` | `VARCHAR(64)` | non | Identifiant de la question affichée. |
| `attempt_index` | `SMALLINT` | non | Numéro du clic sur la question courante (1, 2, 3...). |
| `typeface_slug` | `VARCHAR(64)` | non | Typographie affichée. |
| `answer_slug` | `VARCHAR(64)` | non | Typographie choisie par l'utilisateur. |
| `is_correct` | `BOOLEAN` | non | |
| `classification` | `ENUM('correct_first_try','full_error_first_wrong','partial_signal','correct_after_error')` | non | Classe métier de la réponse. |
| `response_time_ms` | `INT` | non | Temps de réponse en millisecondes. |
| `mastery_before` | `SMALLINT` | non | Mastery avant cette réponse. |
| `mastery_after` | `SMALLINT` | non | Mastery après cette réponse. |
| `type_card_triggered` | `BOOLEAN` | non | Une Type Card a-t-elle été déclenchée. |
| `type_card_kind` | `ENUM('misread') \| NULL` | oui | |
| `distractors` | `JSONB` | non | Array des 3 slugs de distracteurs proposés. |
| `created_at` | `TIMESTAMPTZ` | non | |

### 3.2 Exemple JSON — état complet d'une typographie pour un utilisateur

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "typeface_slug": "helvetica",
  "mastery_level": 2,
  "correct_streak": 1,
  "total_correct": 4,
  "total_errors": 3,
  "session_errors": 1,
  "consecutive_session_errors": 0,
  "last_shown_at_q": 42,
  "next_due_at_q": 57,
  "interval_questions": 15,
  "in_active_pool": true,
  "first_seen_at": "2025-01-10T14:22:00Z",
  "last_seen_at": "2025-01-15T09:45:00Z",
  "adaptive_weight": 1.3,
  "created_at": "2025-01-10T14:22:00Z",
  "updated_at": "2025-01-15T09:45:10Z"
}
```

### 3.3 Table de paramètres tunables

| Paramètre | Clé | Défaut | Min | Max | Description |
|-----------|-----|--------|-----|-----|-------------|
| Taille cible pool actif | `POOL_TARGET_SIZE` | 30 | 10 | 60 | Nombre de typographies dans le pool actif. |
| Seuil introduction nouvelle typo | `POOL_UNLOCK_THRESHOLD` | 3 | 1 | 5 | Nombre de typos à mastery 4 requis pour introduire une nouvelle. |
| Cooldown après erreur | `COOLDOWN_WRONG_Q` | 2 | 2 | 10 | Nombre minimal de questions avant réapparition après erreur. |
| Cooldown après réussite | `COOLDOWN_CORRECT_Q` | 5 | 3 | 20 | Nombre minimal de questions avant réapparition après réussite. |
| Intervalle niveau 0 min | `INTERVAL_L0_MIN` | 1 | 1 | 3 | |
| Intervalle niveau 0 max | `INTERVAL_L0_MAX` | 3 | 1 | 5 | |
| Intervalle niveau 1 min | `INTERVAL_L1_MIN` | 3 | 2 | 6 | |
| Intervalle niveau 1 max | `INTERVAL_L1_MAX` | 6 | 3 | 10 | |
| Intervalle niveau 2 min | `INTERVAL_L2_MIN` | 10 | 5 | 20 | |
| Intervalle niveau 2 max | `INTERVAL_L2_MAX` | 25 | 10 | 40 | |
| Intervalle niveau 3 min | `INTERVAL_L3_MIN` | 25 | 15 | 40 | |
| Intervalle niveau 3 max | `INTERVAL_L3_MAX` | 50 | 25 | 80 | |
| Intervalle niveau 4 min | `INTERVAL_L4_MIN` | 80 | 40 | 120 | |
| Intervalle niveau 4 max | `INTERVAL_L4_MAX` | 150 | 80 | 300 | |
| Poids adaptatif min | `ADAPTIVE_WEIGHT_MIN` | 0.5 | 0.1 | 1.0 | Borne basse du coefficient adaptatif. |
| Poids adaptatif max | `ADAPTIVE_WEIGHT_MAX` | 2.0 | 1.0 | 4.0 | Borne haute du coefficient adaptatif. |
| Incrément adaptatif sur erreur | `ADAPTIVE_INC_ERROR` | 0.1 | 0.05 | 0.3 | Augmentation du poids sur erreur répétée. |
| Décrément adaptatif sur réussite | `ADAPTIVE_DEC_CORRECT` | 0.05 | 0.01 | 0.15 | Diminution du poids sur réussite stable. |
| Durée feedback Training (ms) | `FEEDBACK_MS_TRAINING` | 800 | 400 | 2000 | |
| Durée feedback Competition (ms) | `FEEDBACK_MS_COMPETITION` | 500 | 250 | 1200 | |
| Durée feedback Expert (ms) | `FEEDBACK_MS_EXPERT` | 650 | 300 | 1600 | |
| Durée Type Card (ms) | `TYPE_CARD_DURATION_MS` | 3500 | 2000 | 6000 | |
| Timeout invité inactivité (min) | `GUEST_IDLE_TIMEOUT_MIN` | 30 | 5 | 120 | |
| Taille pool par niveau | `POOL_TARGET_BY_TIER` | `N:30,D:30,C:32,A:34,E:36` | — | — | Taille cible dynamique du pool actif selon niveau global. |
| Changement mot Training (questions) | `WORD_CHANGE_EVERY_Q_TRAINING` | 5 | 1 | 20 | Rotation du mot en mode Training. |
| Changement mot Competition (questions) | `WORD_CHANGE_EVERY_Q_COMPETITION` | 1 | 1 | 20 | Rotation du mot en mode Competition. |
| Changement mot Expert (questions) | `WORD_CHANGE_EVERY_Q_EXPERT` | 1 | 1 | 20 | Rotation du mot en mode Expert. |
| Nombre de distracteurs QCM | `DISTRACTOR_COUNT` | 3 | 3 | 3 | Toujours 3 (4 choix dont 1 correct). Non tunable en V2. |

---

## 4. Moteur de scheduling Training

### 4.1 Fenêtres d'intervalle par niveau

```
niveau 0 : [INTERVAL_L0_MIN .. INTERVAL_L0_MAX]  →  [1 .. 3]  questions
niveau 1 : [INTERVAL_L1_MIN .. INTERVAL_L1_MAX]  →  [3 .. 6]  questions
niveau 2 : [INTERVAL_L2_MIN .. INTERVAL_L2_MAX]  →  [10 .. 25] questions
niveau 3 : [INTERVAL_L3_MIN .. INTERVAL_L3_MAX]  →  [25 .. 50] questions
niveau 4 : [INTERVAL_L4_MIN .. INTERVAL_L4_MAX]  →  [80 .. 150] questions
```

### 4.2 Calcul de l'intervalle après réponse

```
fonction compute_interval(mastery_level, adaptive_weight, correct):
    si correct:
        new_level = min(mastery_level + 1, 4)
    sinon:
        si mastery_level == 4:
            new_level = 3
        sinon:
            new_level = max(mastery_level - 1, 0)

    base_min = INTERVAL_BY_LEVEL[new_level].min
    base_max = INTERVAL_BY_LEVEL[new_level].max

    # Intervalle de base : tirage uniforme dans la fenêtre
    base_interval = random_int(base_min, base_max)

    # Application du poids adaptatif
    # Un poids > 1.0 raccourcit l'intervalle (typo difficile → plus fréquente)
    # Un poids < 1.0 l'allonge (typo maîtrisée → moins fréquente)
    adjusted = round(base_interval / adaptive_weight)

    # Application des cooldowns absolus (invariants I-01 et I-02)
    si correct:
        min_cooldown = COOLDOWN_CORRECT_Q   # 5
    sinon:
        min_cooldown = COOLDOWN_WRONG_Q     # 2

    retourner max(adjusted, min_cooldown)
```

### 4.3 Algorithme de sélection de la prochaine typographie

```
fonction select_next_typeface(user_id, global_q_index):

    # 1. Récupérer le pool actif de l'utilisateur
    pool = get_active_pool(user_id)
    # pool = liste de user_typeface_state avec in_active_pool = true

    # 2. Identifier les typographies éligibles
    eligible = []
    pour chaque item dans pool:
        si item.typeface.activation_status == FALSE:
            continuer
        si item.paused_until_q != null ET item.paused_until_q > global_q_index:
            continuer     # typo temporairement pausée
        si item.next_due_at_q > global_q_index:
            continuer     # en cooldown, non éligible
        eligible.append(item)

    # 3. Si pool vide ou aucun éligible → cas critique
    si eligible est vide:
        retourner fallback_selection(user_id, global_q_index)
        # voir section 4.5

    # 4. Partitionner entre "overdue" et "due now"
    overdue = [item pour item dans eligible si item.next_due_at_q < global_q_index - 3]
    due_now = [item pour item dans eligible si item non dans overdue]

    # 5. Priorité de sélection (ordre décroissant de priorité)
    #    P1 : overdue mastery 0 (jamais réussie et en retard)
    #    P2 : overdue mastery 1
    #    P3 : due_now mastery 0
    #    P4 : overdue mastery > 1 (trié par mastery croissant)
    #    P5 : due_now mastery 1
    #    P6 : due_now mastery > 1 (trié par mastery croissant)
    #    P7 : toute typo éligible (fallback dans pool)

    candidats = prioritize(overdue, due_now)
    # prioritize retourne la liste ordonnée selon P1..P7

    # 6. Sélection déterministe dans la priorité la plus haute disponible
    top_priority_group = premier groupe non vide de candidats
    
    # Parmi égaux de même priorité, tirage aléatoire pondéré
    # pondération = adaptive_weight (poids plus élevé = sélectionné plus souvent)
    selected = weighted_random(top_priority_group, key=lambda x: x.adaptive_weight)

    retourner selected.typeface_slug
```

### 4.4 Gestion des cooldowns

```
fonction apply_cooldown(state, correct, global_q_index):
    interval = compute_interval(state.mastery_level, state.adaptive_weight, correct)
    state.last_shown_at_q = global_q_index
    state.next_due_at_q = global_q_index + interval
    state.interval_questions = interval
    retourner state
```

Garanties d'invariants :
- `interval` ≥ `COOLDOWN_WRONG_Q` (2) après erreur → I-01
- `interval` ≥ `COOLDOWN_CORRECT_Q` (5) après réussite → I-02
- Ces bornes s'appliquent **après** l'application du poids adaptatif — le poids ne peut jamais casser les cooldowns.

### 4.5 Fallback — pool sans éligible (invisible côté joueur)

```
fonction fallback_selection(user_id, global_q_index):
    # Cas : aucune typo éligible sans violer I-01/I-02
    # 1) Tentative d'injection contrôlée d'une nouvelle typo (si disponible)
    unlocked = try_unlock_one_typeface(user_id, global_q_index)
    si unlocked != null:
        log_event(user_id, "pool_recovered_by_unlock", {
            "global_q_index": global_q_index,
            "typeface_slug": unlocked.typeface_slug
        })
        retourner unlocked.typeface_slug

    # 2) Aucun candidat injectible : reprise silencieuse sans rupture UX
    #    (fallback technique interne, non exposé en UI)
    candidate = min(get_active_pool(user_id), key=lambda x: x.next_due_at_q)
    recovery_q = candidate.next_due_at_q
    set_scheduler_cursor(user_id, recovery_q)
    log_event(user_id, "pool_recovered_by_cursor_jump", {
        "from_q": global_q_index,
        "to_q": recovery_q,
        "typeface_slug": candidate.typeface_slug
    })
    retourner candidate.typeface_slug
```

Règle stricte :
- I-01 et I-02 ne sont jamais assouplis en fallback.
- Le fallback doit restaurer une question valide et la partie continue normalement.

### 4.6 Mise à jour du poids adaptatif

```
fonction update_adaptive_weight(state, correct):
    si correct:
        si state.correct_streak >= 3:
            # Réussite stable → réduire le poids
            state.adaptive_weight = max(
                state.adaptive_weight - ADAPTIVE_DEC_CORRECT,
                ADAPTIVE_WEIGHT_MIN
            )
    sinon:
        si state.consecutive_session_errors >= 2:
            # Erreurs répétées → augmenter le poids
            state.adaptive_weight = min(
                state.adaptive_weight + ADAPTIVE_INC_ERROR,
                ADAPTIVE_WEIGHT_MAX
            )
    retourner state
```

---

## 5. Gestion des réponses

### 5.1 Classification d'une réponse

| Cas | Définition | Traitement |
|-----|-----------|------------|
| `correct_first_try` | Bonne réponse au premier clic sur la question affichée. | mastery +1, cooldown correct, update streak |
| `full_error_first_wrong` | Premier clic incorrect sur la question affichée. | mastery -1, cooldown wrong, Misread éligible, update streak |
| `partial_signal` | Clic incorrect additionnel sur la même question après un premier wrong. | **aucun** impact mastery/cooldown, pas de Type Card |
| `correct_after_error` | Bonne réponse après au moins une erreur sur la même question. | fin de question, **pas** de mastery +1 |

Règle runtime :
- Le retry sur la même question est autorisé en Training.
- Une question affichée ne peut produire qu'une seule pénalité de mastery/cooldown (I-14).

### 5.2 Impact exact sur mastery_level et intervalle

```
fonction process_answer(user_id, question_id, typeface_slug, answer_slug,
                        response_time_ms, global_q_index,
                        attempt_index, question_has_error):

    state = get_user_typeface_state(user_id, typeface_slug)
    correct = (answer_slug == typeface_slug)
    mastery_before = state.mastery_level

    si correct ET question_has_error:
        classification = "correct_after_error"
        advance_question = true
        # pas de +1 : la question a deja été ratée

    sinon si correct:
        classification = "correct_first_try"
        advance_question = true
        state.mastery_level = min(state.mastery_level + 1, 4)
        state.correct_streak += 1
        state.consecutive_session_errors = 0

    sinon si attempt_index == 1:
        classification = "full_error_first_wrong"
        advance_question = false
        si state.mastery_level == 4:
            state.mastery_level = 3
        sinon:
            state.mastery_level = max(state.mastery_level - 1, 0)
        state.correct_streak = 0
        state.consecutive_session_errors += 1
        state.session_errors += 1
        state.total_errors += 1

    sinon:
        classification = "partial_signal"
        advance_question = false
        # aucun impact mastery/cooldown

    si classification == "correct_first_try":
        state.total_correct += 1

    si classification == "correct_first_try" OU classification == "full_error_first_wrong":
        state = update_adaptive_weight(state, correct)
        state = apply_cooldown(state, correct, global_q_index)

    state.last_seen_at = now()
    state.updated_at = now()

    type_card = evaluate_type_card(state, classification)

    si advance_question:
        global_q_index += 1

    sauvegarder(state)
    enregistrer_event(session_id, global_q_index, typeface_slug, answer_slug,
                      correct, response_time_ms, mastery_before, state.mastery_level, type_card,
                      classification, attempt_index)

    retourner {
        correct: correct,
        classification: classification,
        mastery_before: mastery_before,
        mastery_after: state.mastery_level,
        type_card: type_card,
        advance_question: advance_question,
        next_q_index: global_q_index
    }
```

---

## 6. Type Cards

### 6.1 Conditions de déclenchement

```
fonction evaluate_type_card(state, classification):

    # V2 Training: cartes de correction uniquement (Misread)
    si classification != "full_error_first_wrong":
        retourner null

    # Conditions pédagogiques conservées
    si state.session_errors == 1:
        retourner { kind: "misread", typeface_slug: state.typeface_slug }

    si state.consecutive_session_errors == 2:
        retourner { kind: "misread", typeface_slug: state.typeface_slug }

    retourner null
```

### 6.2 Contenu minimal d'une Type Card

Les contenus des Type Cards sont des données statiques versionnées dans le repo (`content/type-cards/*.json`), **pas** générés dynamiquement en V2.
En V2 Training, `kind = "misread"` uniquement.

#### Misread Card

```json
{
  "kind": "misread",
  "typeface_slug": "helvetica",
  "display_name": "Helvetica",
  "confusion_note": "Souvent confondue avec Arial en raison de son apparence neutre.",
  "visual_instruction": "La prochaine fois, regardez l'espacement serré et le rythme rigide des lettres.",
  "display_word": "contraste"
}
```

Champs obligatoires :

| Champ | Type | Description |
|-------|------|-------------|
| `kind` | `"misread"` | |
| `typeface_slug` | `string` | |
| `display_name` | `string` | Nom affiché à l'utilisateur |
| `visual_instruction` | `string` | Instruction visuelle unique. Max 120 caractères. |
| `display_word` | `string` | Mot de la question courante (injecté au moment du rendu) |
| `confusion_note` | `string` | Phrase courte expliquant la confusion. Max 100 caractères. |

### 6.3 Durée et comportement UI

| Propriété | Valeur | Configurable |
|-----------|--------|-------------|
| Durée d'affichage | `TYPE_CARD_DURATION_MS` = 3500 ms | Oui (table paramètres) |
| Interaction utilisateur pendant affichage | **Non bloquante** (la boucle continue) | Non |
| Fermeture anticipée par l'utilisateur | Automatique uniquement (pas de clic de fermeture) | Non |
| Format d'affichage | Overlay non modal (pas plein écran) | Non |
| Police affichée dans la carte | Police de la typographie concernée | Non |

> **Règle** : la police de la typographie doit être chargée avant l'affichage de la Type Card. Le backend indique `typeface_slug` dans sa réponse avant la carte ; le frontend précharge le fichier woff2 pendant le feedback de réponse.

---

## 7. Pool actif dynamique

### 7.1 Taille et initialisation

```
Taille cible dynamique (selon niveau global visible) :
  - N, D : 30
  - C : 32
  - A : 34
  - E : 36

Initialisation (première session) :
  1. Sélectionner les typographies avec :
     - activation_status = TRUE
     - dreyfus_tier = 'N'
     - rarity_tag = 'common'
  2. Couvrir au minimum 2 primary_category distincts.
  3. Si count < pool_target(user_level), compléter avec dreyfus_tier = 'D' et rarity_tag = 'common'.
  4. Limiter à pool_target(user_level).
  5. Créer un user_typeface_state pour chaque typo sélectionnée :
     mastery_level = 0, next_due_at_q = 0, in_active_pool = TRUE.
```

### 7.2 Règles d'entrée dans le pool

```
Événement déclencheur : 3 typographies différentes atteignent mastery_level = 4
(compteur suivi dans user_profile.pending_unlock_count, reset à 0 après introduction)

Sélection de la nouvelle typographie :
  1. Exclure toutes les typos déjà dans le pool actif (in_active_pool = TRUE).
  2. Exclure les typos avec activation_status = FALSE.
  3. Filtrer : dreyfus_tier <= niveau Dreyfus actuel de l'utilisateur.
  4. Filtrer : rarity_tag compatible avec le niveau (voir table ci-dessous).
  5. Parmi les candidates, sélectionner celle dont la sub_category est la moins
     représentée dans le pool actif courant (diversification).
  6. En cas d'égalité, trier par rarity_tag (common > uncommon > rare),
     puis par dreyfus_tier (N > D > C > A > E), puis random.
  7. Ajouter UNE SEULE typographie. Attendre le prochain déclenchement pour la suivante.
```

Compatibilité rarity_tag × niveau Dreyfus utilisateur :

| Niveau Dreyfus utilisateur | rarity_tag autorisé |
|---------------------------|---------------------|
| N | common uniquement |
| D | common, uncommon |
| C, A, E | common, uncommon, rare |

### 7.3 Règles de sortie du pool

Une typographie ne sort **jamais** du pool actif (invariant I-06). Son `in_active_pool` reste `TRUE` indéfiniment. Seul son intervalle augmente avec le mastery_level.

> **Note** : à mastery_level 4, l'intervalle atteint 80–150 questions. Une typographie maîtrisée revient donc environ toutes les 80–150 questions, maintenant la mémoire long terme.

### 7.4 Comportement avec catalogue global 1000+

```
Règle : le moteur ne consulte jamais le catalogue global entier à chaque question.
Il travaille exclusivement sur le pool actif de l'utilisateur (~30 items).

Le catalogue global est consulté uniquement pour :
  a) l'initialisation du pool (une fois à la première session)
  b) l'introduction d'une nouvelle typographie (événement rare, asynchrone)
  c) la génération des distracteurs (requête filtrée par visual_cluster_id)

Scalabilité :
  - La table user_typeface_state a un index composite (user_id, in_active_pool, next_due_at_q).
  - La requête de sélection de la prochaine typo opère sur ~30 lignes maximum.
  - La requête de génération des distracteurs est indexée sur visual_cluster_id.
  - L'ajout de 970 nouvelles typographies au catalogue n'impacte aucune requête runtime.
```

---

## 8. Contrat API front/back

### 8.1 `POST /api/training/session/start`

**Requête :**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "is_guest": false
}
```

**Réponse :**
```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "word_policy": "training_every_5",
  "global_q_index": 147,
  "first_question": {
    "display_word": "contraste",
    "typeface_slug": "roboto",
    "display_name": "Roboto",
    "font_source": "google",
    "is_variable_font": true,
    "weight_to_load": "400",
    "choices": [
      { "slug": "roboto",     "display_name": "Roboto" },
      { "slug": "inter",      "display_name": "Inter" },
      { "slug": "open_sans",  "display_name": "Open Sans" },
      { "slug": "lato",       "display_name": "Lato" }
    ],
    "correct_index": 0
  }
}
```

> `correct_index` est envoyé au frontend pour permettre l'affichage du feedback immédiat sans aller-retour réseau. Le frontend ne l'utilise **que** pour le feedback visuel post-réponse, jamais pour pré-valider.
> `session_id` est toujours généré côté backend.
> Session invité: expiration par inactivité à 30 minutes (`expires_at` glissant sur `last_active_at`).
> Le mot affiché est porté par chaque question (`question.display_word`), pas par la session entière.

### 8.2 `POST /api/training/answer`

**Requête :**
```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "question_id": "q_147_roboto",
  "attempt_index": 1,
  "global_q_index": 147,
  "typeface_slug": "roboto",
  "answer_slug": "inter",
  "response_time_ms": 1842
}
```

**Réponse :**
```json
{
  "correct": false,
  "classification": "full_error_first_wrong",
  "question_status": "retry_same_question",
  "mastery_before": 2,
  "mastery_after": 1,
  "feedback_duration_ms": 800,
  "type_card": {
    "kind": "misread",
    "typeface_slug": "roboto",
    "display_name": "Roboto",
    "confusion_note": "Souvent confondue avec Inter en raison des ouvertures similaires.",
    "visual_instruction": "La prochaine fois, observez la légère modulation humaniste du trait.",
    "duration_ms": 3500
  },
  "next_question": null,
  "global_q_index": 147,
  "progression_hint": {
    "visible_level": "N.3",
    "level_changed": false
  }
}
```

> `type_card` est `null` si aucune carte déclenchée.
> `next_question` est inclus uniquement si `question_status = "advance"`.
> `question_status = "retry_same_question"` signifie que la même typographie reste affichée.
> En mode retry, l'ensemble des 4 options reste identique; l'ordre visuel des boutons est remélangé à chaque tentative.
> Si `next_question` est présent, le frontend précharge sa police dès réception pendant le feedback.

### 8.3 `POST /api/training/session/end`

**Requête :**
```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Réponse :**
```json
{
  "session_summary": {
    "questions_answered": 24,
    "correct_count": 19,
    "error_count": 5,
    "typefaces_seen": 12,
    "typefaces_leveled_up": 3,
    "typefaces_leveled_down": 1,
    "new_typeface_introduced": null,
    "visible_level_before": "N.3",
    "visible_level_after": "N.4",
    "level_changed": true
  },
  "persisted": true
}
```

> Pour un utilisateur invité, `persisted = false` et le résumé est identique mais rien n'est sauvegardé en base.

### 8.4 Gestion des erreurs API

| Code HTTP | Cas | Corps |
|-----------|-----|-------|
| 400 | `global_q_index` ne correspond pas à l'état session | `{ "error": "invalid_q_index" }` |
| 400 | `typeface_slug` inconnu ou hors pool | `{ "error": "invalid_typeface" }` |
| 409 | Réponse déjà soumise pour ce `question_id` + `attempt_index` | `{ "error": "already_answered" }` |
| 404 | `session_id` inconnu | `{ "error": "session_not_found" }` |
| 503 | Erreur interne non récupérable | `{ "error": "internal_unavailable" }` |

---

## 9. Contrat front runtime

### 9.1 Ce que le frontend décide

| Décision | Description |
|----------|-------------|
| Afficher le feedback visuel | Couleur correct/incorrect, animation. Durée = `feedback_duration_ms` reçu. |
| Afficher la Type Card | Si `type_card != null` dans la réponse, afficher en overlay non modal pendant `type_card.duration_ms`. |
| Bloquer les interactions | Pendant feedback uniquement (pas pendant Type Card). |
| Précharger la police suivante | Si `next_question` est présent, précharger `font_source` + `weight_to_load`. |
| Afficher le niveau visible | Ne pas afficher en continu; afficher un toast uniquement lors de `level_changed=true`. |
| Afficher statut invité | Si `is_guest=true`, afficher "progression non sauvegardée". |
| Mot affiché | Utiliser `question.display_word` (rotation pilotée backend selon mode). |

### 9.2 Ce que le backend décide

| Décision | Description |
|----------|-------------|
| Typographie suivante | Algorithme de scheduling (section 4). |
| Distracteurs | Sélection selon visual_cluster_id, difficulty_base, niveau Dreyfus. |
| Ordre des choix QCM | Mélangé aléatoirement côté backend. |
| Retry QCM | Même set de 4 options conservé sur la question en cours; ordre remélangé à chaque tentative. |
| Déclenchement Type Card | Logique section 6.1. |
| Contenu Type Card | Données statiques JSON versionnées dans le repo. |
| Mise à jour mastery_level | Règles section 5. |
| Calcul niveau global visible | Agrégation des mastery_level à chaque réponse. |
| Introduction nouvelle typo | Déclenchée côté backend, annoncée dans `session_summary`. |

### 9.3 États UI attendus

```
État 1 : WAITING_FOR_ANSWER
  - Affiche la typographie avec `question.display_word` et les 4 choix.
  - Interactions : choix cliquables.
  - Chrono : aucun.

État 2 : FEEDBACK
  - Affiche la validation visuelle (correct/incorrect).
  - Durée : feedback_duration_ms.
  - Interactions : bloquées.
  - Action parallèle : précharger police de next_question (si présente).

État 3 : TYPE_CARD_OVERLAY (conditionnel)
  - Overlay non modal. Type Card Misread.
  - Durée : type_card.duration_ms.
  - Interactions : non bloquées.
  - Police affichée : celle de la typographie concernée (déjà chargée).

État 4 : TRANSITIONING
  - Durée < 100 ms. Swap de la police affichée.
  - Retour à WAITING_FOR_ANSWER (question suivante).
```

Diagramme de transitions :

```
WAITING_FOR_ANSWER
  → (réponse soumise) → FEEDBACK
FEEDBACK
  → (question_status = retry_same_question) → WAITING_FOR_ANSWER
  → (question_status = advance) → TRANSITIONING
TYPE_CARD_OVERLAY
  → (durée écoulée) → disparition visuelle (sans changer l'état principal)
TRANSITIONING
  → WAITING_FOR_ANSWER
```

Note:
- `TYPE_CARD_OVERLAY` peut apparaître en parallèle de `WAITING_FOR_ANSWER` juste après un premier faux clic (retry).

---

## 10. Analytics minimales

### 10.1 Events indispensables

| Event | Déclencheur | Payload minimal |
|-------|------------|-----------------|
| `session_started` | `start_session` | `session_id`, `user_id`, `is_guest`, `pool_size` |
| `answer_submitted` | `submit_answer` | `session_id`, `global_q_index`, `question_id`, `attempt_index`, `classification`, `typeface_slug`, `answer_slug`, `is_correct`, `response_time_ms`, `mastery_before`, `mastery_after` |
| `type_card_shown` | Affichage Type Card | `session_id`, `kind`, `typeface_slug`, `global_q_index` |
| `pool_unlocked` | Introduction nouvelle typo | `session_id`, `new_typeface_slug`, `trigger_count` |
| `pool_recovered_by_unlock` | Reprise silencieuse via unlock | `session_id`, `global_q_index`, `typeface_slug` |
| `pool_recovered_by_cursor_jump` | Reprise silencieuse via curseur scheduler | `session_id`, `from_q`, `to_q`, `typeface_slug` |
| `level_changed` | Franchissement sous-niveau ou niveau principal | `session_id`, `level_before`, `level_after` |
| `session_ended` | `end_session` | `session_id`, `questions_answered`, `correct_count`, `error_count` |

### 10.2 KPIs de qualité pédagogique

| KPI | Définition | Cible indicative |
|-----|-----------|-----------------|
| Taux de maîtrise pool | % de typographies du pool actif à mastery_level ≥ 3 | > 60 % après 200 questions |
| Taux d'erreur par cluster | % d'erreurs groupées par visual_cluster_id | Indicateur de confusion structurelle |
| Temps moyen de réponse | Par mastery_level | Décroissance attendue avec la progression |
| Fréquence recovery fallback | `pool_recovered_by_unlock` + `pool_recovered_by_cursor_jump` / session | Doit rester très faible (< 0.5/session). |
| Taux de déclenchement Type Card | Type Cards / erreurs totales | ~40–60 % (ni trop rare, ni trop fréquent) |
| Rétention mastery_level 4 | % de typos restant à 4 après 10 réapparitions | > 80 % |

---

## 11. Plan de migration V1 → V2

### 11.1 Étapes

| Étape | Action | Prérequis | Impact utilisateur |
|-------|--------|-----------|-------------------|
| 1 | Déployer le nouveau schéma `user_typeface_state` en parallèle | Migration DB | Aucun |
| 2 | Migrer les états V1 existants vers `user_typeface_state` (script one-shot) | Étape 1 validée | Aucun |
| 3 | Déployer le backend Training Engine V2 derrière flag feature `training_v2` | Étapes 1–2 | Aucun |
| 4 | Activer `training_v2` pour 5 % des utilisateurs (canary) | Étape 3 | Groupe canary |
| 5 | Monitoring 48 h : KPIs pédagogiques + erreurs API | Étape 4 | — |
| 6 | Extension à 100 % des utilisateurs | Étape 5 validée | Tous |
| 7 | Désactivation du backend V1 | Étape 6 stable (7 jours) | Aucun |

### 11.2 Script de migration des états V1

```
Pour chaque enregistrement user_typeface_state_v1 :
  new_state.mastery_level = v1.mastery_level
  new_state.correct_streak = 0              # réinitialisé, non disponible en V1
  new_state.total_correct = v1.correct_count
  new_state.total_errors = v1.error_count
  new_state.session_errors = 0
  new_state.consecutive_session_errors = 0
  new_state.last_shown_at_q = v1.last_seen_question_index
  new_state.next_due_at_q = v1.next_due_after_questions + v1.current_question_index
  new_state.interval_questions = v1.next_due_after_questions
  new_state.in_active_pool = v1.in_active_pool
  new_state.adaptive_weight = 1.0           # valeur neutre
  new_state.first_seen_at = v1.first_seen_timestamp
  new_state.last_seen_at = v1.last_seen_timestamp
```

### 11.3 Risques et rollback

| Risque | Probabilité | Impact | Mitigation | Rollback |
|--------|------------|--------|-----------|----------|
| Incohérence des `global_q_index` après migration | Moyen | Sélection incorrecte | Vérifier les index max par user avant/après migration | Rebasculer sur backend V1 via flag feature |
| Reprise fallback trop fréquente | Faible | Qualité pédagogique dégradée | Monitoring `pool_recovered_by_*` + tuning pool/unlock | Augmenter `POOL_TARGET_SIZE` et vérifier règles d'unlock |
| Type Card déclenchée en boucle | Faible | UX perturbée | Compteur `type_card_shown_this_session` par typo, cap à 2 par session | Désactiver Type Cards temporairement via flag |
| Poids adaptatif mal migré (1.0 neutre) | Faible | Intervalles sous-optimaux | Acceptable — convergence naturelle en quelques sessions | Aucun requis |

---

## 12. Checklist QA exhaustive

### 12.1 Cas nominaux

- [ ] `N-01` : réponse correcte → mastery_level monte de 1 (si < 4)
- [ ] `N-02` : réponse correcte à mastery 4 → mastery reste 4
- [ ] `N-03` : réponse incorrecte → mastery descend de 1 (si > 0)
- [ ] `N-04` : réponse incorrecte à mastery 4 → mastery passe à 3 (et non à 2 ni 4)
- [ ] `N-05` : réponse incorrecte à mastery 0 → mastery reste 0
- [ ] `N-06` : après réussite, la même typo n'apparaît pas avant 5 questions
- [ ] `N-07` : après erreur, la même typo n'apparaît pas avant 2 questions
- [ ] `N-08` : rotation des mots respecte la policy de mode (Training: toutes les 5 questions, Competition/Expert: chaque question)
- [ ] `N-09` : la réponse correcte n'est jamais placée systématiquement au même index dans les 4 choix
- [ ] `N-10` : une Type Card misread est déclenchée à la première erreur sur une typo dans la session
- [ ] `N-11` : une Type Card misread est déclenchée à la deuxième erreur consécutive sur la même typo
- [ ] `N-12` : pas de Type Card si l'erreur est ni première ni double consécutive
- [ ] `N-13` : le frontend bloque les interactions pendant le feedback uniquement
- [ ] `N-14` : une nouvelle typo est introduite exactement après 3 stabilisations à mastery 4
- [ ] `N-15` : une seule typo est introduite à chaque événement d'unlock
- [ ] `N-16` : un utilisateur invité ne déclenche aucune écriture persistante en base
- [ ] `N-17` : premier wrong sur question → `question_status=retry_same_question`, pas d'avance de question
- [ ] `N-18` : wrong additionnel sur même question (`partial_signal`) → aucun changement de mastery/cooldown
- [ ] `N-19` : correct après erreur sur même question (`correct_after_error`) → avance question sans mastery +1
- [ ] `N-20` : en retry, les 4 options restent identiques à la question initiale
- [ ] `N-21` : en retry, l'ordre visuel des 4 options est remélangé
- [ ] `N-22` : le niveau global visible est recalculé après chaque réponse (pas uniquement en fin de session)
- [ ] `N-23` : la Misread est non bloquante (interaction possible après feedback)
- [ ] `N-24` : le niveau global n'est pas affiché en continu dans l'écran game
- [ ] `N-25` : un toast apparaît quand `level_changed=true`
- [ ] `N-26` : en retry sur la même question, `display_word` ne change pas

### 12.2 Cas limites

- [ ] `L-01` : pool initialisé avec exactement 30 typos disponibles dans le catalogue → aucune erreur
- [ ] `L-02` : catalogue avec moins de 30 typos actives dreyfus_tier='N' → initialisation avec moins de 30, pas de crash
- [ ] `L-03` : toutes les typos du pool en cooldown simultanément → reprise silencieuse (unlock puis curseur scheduler) sans casser I-01/I-02
- [ ] `L-04` : catalogue global à 1000 typos → temps de réponse `start_session` < 200 ms
- [ ] `L-05` : utilisateur à mastery 0 sur toutes ses typos → le moteur ne boucle pas indéfiniment
- [ ] `L-06` : `response_time_ms` = 0 → accepté sans erreur (cas de test automatisé)
- [ ] `L-07` : soumission d'un `answer_slug` hors des 4 choix proposés → rejeté avec code 400
- [ ] `L-08` : double soumission du même `question_id` + `attempt_index` → rejeté avec code 409
- [ ] `L-09` : session invité, appel à `session/end` → `persisted = false`, aucune écriture
- [ ] `L-09b` : session invité inactive > 30 min → expiration automatique et nouvelle session requise
- [ ] `L-09c` : en mode invité, bannière "progression non sauvegardée" visible
- [ ] `L-10` : `adaptive_weight` calculé à la borne max (2.0) → l'intervalle ne descend pas sous `COOLDOWN_WRONG_Q`
- [ ] `L-11` : `adaptive_weight` calculé à la borne min (0.5) → l'intervalle ne monte pas au-dessus de `INTERVAL_L4_MAX`
- [ ] `L-12` : pool actif à sa taille cible par niveau (30/32/34/36), toutes typos à mastery 4 → aucune nouvelle typo entrante tant que le seuil de 3 n'est pas re-déclenché (cas de plateau, logger `pool_plateau`)
- [ ] `L-13` : typo avec `paused_until_q` > `global_q_index` n'est jamais sélectionnée

### 12.3 Non-régression pédagogique

- [ ] `P-01` : mastery_level par utilisateur par typo est strictement isolé entre utilisateurs (user A à mastery 3 sur Helvetica n'affecte pas user B)
- [ ] `P-02` : le mode Compétition ne modifie jamais un mastery_level (vérification par lecture après session compétition)
- [ ] `P-03` : un utilisateur invité dont la session expire n'hérite d'aucun état d'une session précédente
- [ ] `P-04` : le niveau global visible ne peut baisser que selon les règles de régression (jamais d'un coup de plusieurs sous-niveaux sur une seule session)
- [ ] `P-05` : une typographie à mastery 4 qui reçoit une erreur → mastery = 3, pas 2 (I-04 strict)
- [ ] `P-06` : les invariants I-01 à I-14 sont vérifiables en base par requête SQL (test de non-régression automatisable)
- [ ] `P-07` : la Type Card misread contient toujours le `display_word` de la question courante, pas un mot générique
- [ ] `P-08` : les distracteurs proposés dans une question ne contiennent jamais la bonne réponse en doublon
- [ ] `P-09` : après l'introduction d'une nouvelle typo dans le pool, son mastery_level initial est toujours 0
- [ ] `P-10` : l'intervalle d'une typo à mastery 0 ne peut jamais dépasser `INTERVAL_L0_MAX` après une erreur

---

## 13. Décisions figées

| Sujet | Décision |
|---|---|
| `global_q_index` | Cumulé sur toutes les sessions utilisateur. |
| Retry + Misread | Misread affichée immédiatement au 1er faux clic. |
| Fallback pool sans éligible | Reprise silencieuse, la partie continue normalement (pas de modal bloquante). |
| Type Cards (stockage) | Fichiers JSON versionnés dans le repo (source de vérité front/backend). |
| Niveau global visible | Recalculé à chaque réponse. |
| Retry + distracteurs | Même set de 4 options sur la question; ordre des boutons remélangé à chaque tentative. |
| Session invité | `session_id` généré backend, timeout d'inactivité 30 minutes. |

## 14. Open questions restantes

Aucune question bloquante dans le scope V2 actuel.

## 15. Décisions produit complémentaires (validées)

| Sujet | Décision |
|---|---|
| Mode initial | `training` est le mode par défaut au premier lancement. |
| Route actuelle | `/game` reste la référence UI du training pour cette phase. |
| Route cible | Canonique à terme: `/play/training`. |
| Durée session training | Pas de fin stricte pour l'instant (boucle continue). |
| Reprise session | Reprise sur une nouvelle question (pas la précédente). |
| Politique de mots | Training: changement toutes les 5 questions. Competition/Expert: changement à chaque question. |
| Retry policy | Training: retry illimité. Competition: pas de retry sur la même question. |
| Misread timing | Affichage immédiat au 1er faux clic. |
| Misread UX | Non bloquante, overlay non modal, durée fixe. |
| Cap cartes | Cap doux: maximum 1 Misread toutes 2 questions. |
| Niveau global (affichage) | Non affiché en continu sur l'écran game; toast uniquement sur changement. |
| Feedback timing | Dépend du mode (`training`, `competition`, `expert`). |
| Mode invité (UX) | Message visible "progression non sauvegardée". |
| Mode invité (tech) | `session_id` backend + timeout glissant 30 minutes. |
| Pool actif | Taille dépend du niveau global (`N/D=30`, `C=32`, `A=34`, `E=36`). |
| Unlock nouvelle typo | Immédiat quand le seuil d'unlock est atteint. |
| Typos instables | Pause temporaire autorisée (sans suppression définitive). |
| Langues | EN + FR selon choix utilisateur; défaut EN. |
| Textes Type Cards | Brouillon auto possible, validation éditoriale humaine obligatoire. |
| Source de vérité catalogue | Excel validé comme source de vérité + versioning du catalogue. |
| Polices runtime | Hébergement local projet (`public/fonts`). |
| Preload polices | 1 police courante + 1 police suivante. |
| Performance cible | Temps de transition question < 120 ms (hors animations voulues). |
| Debug moteur | Mode debug visible activable en environnement de test. |
| Tests | Unit scheduler + intégration API + non-régression pédagogique. |
| KPI prioritaires | Taux de maîtrise, erreurs par cluster, temps moyen de réponse. |
| Dashboard | Dashboard admin KPI minimal requis en V1. |
| Competition | Le score compétition n'impacte jamais la progression training. |
| Expert réponse texte | Pas d'alias libres; uniquement noms officiels + table de synonymes autorisés. |
| Règles front | Règles éditables via JSON versionné. |
| Définition MVP | Onboarding + mode select + training moteur + analytics + dashboard minimal. |
