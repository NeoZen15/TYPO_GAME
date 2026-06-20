# Training Database Master Vision

Ce document sert de source unique avant tout prompt Claude.
Il récapitule exactement ce qui a été validé, ce qui manque, et le niveau de cible à atteindre.

Compléments opérationnels associés:
- `docs/overview/site-system-overview.md`
- `docs/catalog/catalog-workbook-1000-spec.md`
- `docs/catalog/claude-prompt-catalog-workbook-1000.md`
- `docs/catalog/catalog-automation-roadmap.md`
- `docs/typography/specimen-layer-strategy.md`
- `docs/catalog/massive-font-source-strategy.md`

## 1) Objectif global

Construire une base de données typographique exploitable en production pour:
- `training` (moteur pédagogique principal),
- `competition` (mode score/temps),
- `expert` (réponse texte normalisée),

avec une logique moteur centrée sur la pédagogie visuelle (répétition espacée), et pas sur un simple enchaînement statique de questions.

## 2) Invariants non négociables (validés)

1. Une typo ratée ne revient jamais immédiatement.
2. Le pool actif bouge selon la performance (`mastery`) et non selon un ordre statique.
3. En training, le retry sur la même question est autorisé.
4. En cas de fallback (plus d'éligible), la partie continue normalement sans casser l'UX.
5. Le déclenchement Misread suit la logique de session validée: première erreur sur la typo dans la session, ou deuxième erreur consécutive sur cette typo.
6. La répétition espacée reste dominante sur les autres ajustements adaptatifs.

## 3) État actuel observé (audit docs + Excel)

### 3.1 Docs relus
- `docs/game/training-engine-spec-v2-clean.md`
- `docs/game/game-unified-spec-v1.md`
- `docs/game/game-v4-executable-spec.md`

### 3.2 Excel relu
- Source: `JEUX_DE_TYPO_catalogue_v4__VALIDE__20260219_1903.xlsx`
- Sheet principale: `typefaces`
- Lignes: 28
- Colonnes: 17

### 3.3 Points solides
- `typeface_slug` uniques.
- `structural_signature` valide partout (JSON propre).
- Cohérence `contrast_profile` ↔ `structural_signature.contrast`.
- Cohérence `aperture_profile` ↔ `structural_signature.e_aperture`.
- Les familles Google du catalogue sont présentes côté assets woff2.

### 3.4 Gaps bloquants pour "base expert"
- `files_manifest` vide (non exploitable runtime si utilisé comme source).
- Catalogue encore petit (28 typos, loin d'un setup large).
- Couverture niveau Dreyfus incomplète (`A`/`E` absents).
- `rarity_tag` incomplet (`rare` absent).
- Pas de table dédiée pour réponses Expert normalisées (`accepted answers` validées).
- Pas de tables éditoriales prêtes pour `reading_cards` et `misread_cards`.

## 4) Direction globale

On vise une structure unique, robuste et évolutive long terme, sans séparation de version dans la lecture du document.

## 5) Spécification cible (production-ready)

Workbook avec sheets:
1. `meta_versioning`
2. `typefaces_core`
3. `font_runtime_assets`
4. `expert_answer_keys`
5. `confusion_families`
6. `confusion_pairs`
7. `reading_cards`
8. `misread_cards`
9. `mode_profiles`
10. `distractor_policy`
11. `scheduler_policy`
12. `telemetry_spec`
13. `enums_reference`
14. `qa_rules`
15. `qa_report`
16. `user_event_fact`
17. `user_daily_rollup`
18. `user_typeface_mastery_snapshot`
19. `user_confusion_graph_edges`
20. `dashboard_metric_definitions`
21. `dashboard_alert_rules`
22. `dashboard_views`

### 5.1 typefaces_core (minimum)
- identité typo: `typeface_slug`, `display_name`, `display_name_ascii`
- taxonomie: `primary_category`, `sub_category`, `visual_cluster_id`
- pilotage difficulté: `dreyfus_tier`, `difficulty_base`, `rarity_tag`
- activation/source: `activation_status`, `font_source`, `is_variable_font`
- contexte: `release_year`, `designer`, `foundry`, `license_type`, `license_url`
- rendu: `weight_structure`, `contrast_profile`, `aperture_profile`, `fallback_stack`
- signature: `structural_signature_json`
- modes: `expert_enabled`, `min_mode`
- gouvernance: `qa_status`, `updated_at_utc`

### 5.2 font_runtime_assets
- un mapping fichier runtime concret par typo
- chemins relatifs projet
- statut prêt runtime (`runtime_status=ready`) requis pour toute typo active
- hash/taille pour contrôle qualité

### 5.3 expert_answer_keys
- réponses texte autorisées, normalisées, versionnées
- règle stricte: pas d'alias libres, seulement alias validés

### 5.4 reading/misread
- contenu pédagogique structuré et activable
- ton neutre, orienté observation
- gouvernance (review status)

### 5.5 policies mode/moteur
- `mode_profiles`: training/competition/expert
- `distractor_policy`: règles de similarité et fallback
- `scheduler_policy`: intervalles, gaps, unlock, taille pool

### 5.6 QA strict
Règles bloquantes minimales:
- slug unique
- JSON valides
- cohérence signature/profils
- typo active => assets runtime prêts
- typo expert_enabled => réponses expert disponibles
- licence renseignée

### 5.7 Couche dashboard utilisateur (obligatoire)
- `user_event_fact`: journal granulaire append-only de chaque interaction.
- `user_daily_rollup`: agrégats journaliers par utilisateur et par mode.
- `user_typeface_mastery_snapshot`: état de maîtrise par typo, versionné dans le temps.
- `user_confusion_graph_edges`: arêtes de confusion observées (A -> B).
- `dashboard_metric_definitions`: définition canonique de chaque KPI.
- `dashboard_alert_rules`: seuils d'alerte opérationnelle et pédagogique.
- `dashboard_views`: vues prêtes à consommer côté produit/ops/research.

## 6) Extensions validées "aller plus loin"

1. Déterminisme: même `seed` + même état => même sortie (debug/replay).
2. Explainability: `reason_code` sur chaque sélection typo/distracteur.
3. Coverage matrix: couverture pédagogique des signatures.
4. Near-neighbor index pré-calculé (top-k typos proches).
5. Simulateur offline (novice/intermediate/expert, sessions massives).
6. Invariants QA par mode séparés.
7. Policy de rotation mots explicite par mode.
8. Fallback chain stricte sans casser les invariants.
9. Workflow éditorial (owner/review/approved).
10. Dépréciation/migration des typos (`replacement_slug`).
11. Budgets performance runtime.
12. Logs d'audit analytiques.

## 7) Capacités avancées (research-grade)

Cible avancée:
- moteur psychométrique (IRT)
- mémoire long terme (FSRS/SM2 hybride)
- graphe de confusions personnalisé utilisateur
- embeddings visuels glyphes pour distance perceptive
- KPI de rétention réelle (J+1/J+7/J+30)
- A/B natif par feature flags
- replay déterministe production

## 8) Décisions UX/produit retenues dans ce contexte moteur

- Le moteur pédagogique passe avant le scoring.
- Le feedback et les transitions dépendent du mode.
- La difficulté doit rester lisible et progressive.
- Le système doit rester compréhensible même sans connaissance backend.

## 9) Décisions validées et points encore ouverts

### 9.1 Décisions validées

1. Le mode Competition influence la progression long terme: `non`.
2. Politique langue: `fr + en`.
3. Progression niveau global: logique `mixte` (ensemble des signaux).
4. Synonymes mode Expert: `set large validé`.
5. Retry Training: `oui` (autorisé).
6. Misread: déclenchement à la `1re erreur sur la typo dans la session` ou à la `2e erreur consécutive sur cette typo`.
7. Pool actif: `dynamique selon utilisateur`.
8. Politique mot affiché: `training=toutes les 5 questions`, `competition/expert=à chaque question`.
9. Merge invité -> compte: `oui`.
10. Rétention des données événementielles: `36 mois`.
11. Anti-cheat compétition: `oui`.
12. KPI de pilotage: `tous importants` (pas de KPI unique prioritaire).
13. Carte \"Risque de décrochage\" visible côté utilisateur: `oui`.

### 9.2 Points encore ouverts

1. Déterminisme strict en production (`seed identique => session identique`): `oui`.
2. Politique finale des fontes locales en production: `remplacer par des alternatives libres`.

### 9.3 Note de cohérence pédagogique

La rotation des mots est pilotée par mode.
Pour préserver la méthode, le Training garde une rotation plus lente (`5 questions`), alors que Competition et Expert changent à chaque question. Cette règle doit rester configurable par mode dans `mode_profiles` et testée via `experiment_registry`.

A ce stade, aucun point bloquant n'est laissé ouvert dans cette section.

## 10) Ordre recommandé de mise en œuvre

1. Finaliser le data model cible (Excel + QA rules).
2. Générer un export JSON canonique depuis ce modèle.
3. Brancher le provider local (contrat API-like stable).
4. Valider les invariants pédagogiques en tests.
5. Ensuite seulement brancher backend réel sur le même contrat.
6. Activer la phase avancée (personnalisation + recherche).

## 11) Résumé opérationnel

- Oui, on peut aller beaucoup plus loin.
- Oui, la base définie ici est suffisante pour implémenter proprement.
- Oui, le document couvre aussi l'extension avancée si l'objectif est une qualité "expert" durable et mesurable.

Ce document doit être utilisé comme référence avant prompt Claude et avant implémentation backend réelle.

## 12) Vision long terme (3 à 5+ ans)

Objectif long terme:
- faire de JEUX DE TYPO un moteur d'entraînement perceptif durable,
- maintenir la progression sur des mois, pas seulement sur une session,
- créer un graphe de confusion visuelle propriétaire pour améliorer l'adaptation.

Principes d'architecture long terme:
- event sourcing (append-only) pour conserver l'historique complet,
- contrats API versionnés (`v1`, `v2`, `v3`) sans casser le front,
- séparation stricte entre contenu, moteur, et UX,
- migration des schémas pilotée par versioning explicite.

## 13) Dashboard ultra précis par utilisateur (spécification)

Le dashboard doit exister à trois niveaux:
- niveau joueur (suivi personnel détaillé),
- niveau produit (qualité pédagogique globale),
- niveau recherche (validation de la méthode d'apprentissage).

### 13.1 Blocs obligatoires du dashboard utilisateur

1. Identité d'apprentissage
- niveau global courant (`N.1` à `E.5`)
- trajectoire des 30 derniers jours
- statut de session (`guest` ou `account`)

2. Performance sessionnelle
- précision brute (correct / total)
- temps médian de réponse
- vitesse par mode
- distribution des tentatives par question

3. Mémoire et stabilité
- ratio de typos `mastery >= 3`
- nombre de typos stabilisées (`mastery = 4`)
- courbe de rétention (`J+1`, `J+7`, `J+30`)
- taux de rechute (typo stabilisée puis erreur)

4. Confusions visuelles
- top paires confondues (`A -> B`)
- cluster de confusion dominant
- évolution des confusions dans le temps

5. Qualité pédagogique
- fréquence de déclenchement `misread`
- impact post-misread (amélioration à court terme)
- charge cognitive estimée (erreurs + latence + répétitions)

### 13.2 KPI canoniques (formules à figer)

- `accuracy_rate = correct_answers / total_answers`
- `retry_rate = retry_attempts / total_questions`
- `median_response_ms = median(response_time_ms)`
- `mastery_stability_index = stable_typefaces / active_pool_size`
- `relapse_rate = relapses_on_mastered / mastered_typefaces_seen`
- `confusion_entropy = entropy(confusion_distribution)`
- `misread_effectiveness = post_misread_correct_within_3 / misread_shown`
- `retention_d1 = recalled_after_1_day / due_after_1_day`
- `retention_d7 = recalled_after_7_days / due_after_7_days`
- `retention_d30 = recalled_after_30_days / due_after_30_days`

### 13.3 Colonnes minimales pour `user_event_fact`

- `event_id`
- `idempotency_key`
- `event_ts_utc`
- `user_id`
- `session_id`
- `mode`
- `global_q_index`
- `question_id`
- `attempt_index`
- `typeface_slug`
- `answer_slug`
- `is_correct`
- `is_retry`
- `response_time_ms`
- `mastery_before`
- `mastery_after`
- `misread_shown`
- `reading_shown`
- `display_word`
- `reason_code`
- `seed`
- `engine_version`

### 13.3.1 Enum canonique `reason_code` (obligatoire)

`reason_code` ne doit jamais être un texte libre.
Valeurs autorisées:

- `correct_first_try`
- `correct_after_retry`
- `wrong_first_try`
- `wrong_retry`
- `timeout`
- `invalid_answer`

Règles:
- Si `attempt_index = 1` et `is_correct = true` -> `correct_first_try`
- Si `attempt_index > 1` et `is_correct = true` -> `correct_after_retry`
- Si `attempt_index = 1` et `is_correct = false` -> `wrong_first_try`
- Si `attempt_index > 1` et `is_correct = false` -> `wrong_retry`
- Si dépassement de temps -> `timeout`
- Si payload invalide -> `invalid_answer`

Note:
- Les doublons d'idempotence sont suivis dans `event_ingestion_guard` (`ingestion_status='duplicate'`)
- Ils ne doivent pas créer de ligne supplémentaire dans `user_event_fact`

### 13.3.2 Contraintes data `user_event_fact`

- `event_id` unique global
- `idempotency_key` unique par (`user_id`, `session_id`)
- `question_id` non nul pour les événements de réponse
- `attempt_index >= 1`
- `response_time_ms >= 0`
- `reason_code` doit appartenir à l'enum canonique

### 13.4 Colonnes minimales pour `user_daily_rollup`

- `date_utc`
- `user_id`
- `mode`
- `questions_total`
- `answers_total`
- `correct_total`
- `wrong_total`
- `retry_total`
- `median_response_ms`
- `stabilized_typefaces_total`
- `new_typefaces_unlocked`
- `misread_shown_total`
- `retention_due_d1`
- `retention_hit_d1`
- `retention_due_d7`
- `retention_hit_d7`
- `retention_due_d30`
- `retention_hit_d30`

### 13.5 Alertes ultra précises (dashboard_alert_rules)

Alertes pédagogiques:
- baisse de `retention_d7` sur 3 jours glissants
- hausse anormale de `relapse_rate`
- cluster de confusion persistant au-delà d'un seuil

Alertes produit:
- augmentation de `retry_rate` sans gain de stabilité
- chute de `misread_effectiveness`
- latence réponse moteur au-delà du budget

Alertes data:
- événement incomplet (champs requis absents)
- incohérence `mastery_before` / `mastery_after`
- divergence entre `mode_profile` et comportement observé

## 14) Contraintes performance long terme (non fonctionnel)

Budgets cibles:
- sélection prochaine typo `< 20 ms` p95
- génération distracteurs `< 15 ms` p95
- écriture événement `< 10 ms` p95
- chargement vue dashboard utilisateur `< 150 ms` p95

Contraintes scalabilité:
- support catalogue `1000+` typos sans régression runtime,
- support historique multi-années,
- indexation obligatoire des dimensions `user_id`, `mode`, `typeface_slug`, `event_ts_utc`.

Ordre de grandeur volume (référence):
- `1000 utilisateurs x 100 réponses/jour x 36 mois` ≈ `109,5 millions` d'événements.
- Ce volume reste compatible avec PostgreSQL partitionné + indexation correcte.

## 15) Ce que Claude doit livrer pour l'Excel cible (priorité maximale)

1. Workbook avec toutes les sheets listées en section 5.
2. Data dictionary complet, champ par champ.
3. QA rules bloquantes + QA report exemple.
4. KPI definitions alignées section 13.
5. Alert rules prêtes pour dashboard utilisateur.
6. Aucun résumé vague: uniquement structure exploitable.

## 16) Audit complémentaire (ce qui manque encore)

Cette section liste les manques restants après relecture complète du document.

### 16.1 Manques critiques (bloquants prod)

1. Contrat d'idempotence événementielle
- Il faut une règle explicite pour éviter les doublons d'events (`event_id` unique, `idempotency_key`, stratégie de replay).

2. Ordonnancement des événements
- Il faut une règle sur l'ordre de vérité (`event_ts_utc` vs `ingested_at_utc` vs `sequence_no`).

3. Merge invité -> compte
- Il faut un protocole canonique de fusion de progression quand un invité crée un compte.

4. Politique de suppression RGPD
- Il faut spécifier droit à l'effacement, anonymisation, rétention max, purge historique.

5. Intégrité mode compétition
- Il manque anti-cheat, anti-spam, détection d'anomalies (temps impossibles, rafales, tampering client).

6. SLO/SLA et runbook incident
- Il faut des objectifs de disponibilité et un protocole de reprise en cas de panne.

### 16.2 Manques importants (fortement recommandés)

1. Registry d'expériences
- Il faut un registre A/B (`experiment_id`, règles d'exposition, garde-fous, critères d'arrêt).

2. Registry de modèles moteur
- Il faut versionner scheduler, distractor policy, scoring policy avec migrations contrôlées.

3. Qualité multidevice
- Il faut une stratégie de résolution de conflits (deux devices actifs en parallèle).

4. Gouvernance éditoriale renforcée
- Il faut workflow `draft -> review -> approved -> published -> deprecated` pour cards/réponses.

5. Plan d'archivage
- Il faut une politique de partition/archivage des events (volume long terme).

6. Mesure de dérive
- Il faut suivre la dérive des confusions (drift) après ajout massif de typos.

### 16.3 Manques utiles (niveau excellence)

1. Qualité de rendu inter-device
- Tracking de variabilité de rendu (OS/navigateur) pour éviter biais perceptifs.

2. Résilience contenu
- Fallback quand une typo n'est pas chargeable en runtime (sans casser la session).

3. Explainability exportable
- Justification lisible pour chaque décision moteur (utile support/research).

## 17) Ajouts de sheets recommandés

Pour couvrir les manques ci-dessus, ajouter:

1. `event_ingestion_guard`
- `idempotency_key`, `ingested_at_utc`, `sequence_no`, `ingestion_status`, `duplicate_of_event_id`

2. `identity_merge_log`
- `merge_id`, `guest_user_id`, `account_user_id`, `merge_strategy`, `merged_at_utc`, `status`

3. `privacy_consent_ledger`
- `consent_id`, `user_id`, `consent_type`, `granted`, `granted_at_utc`, `revoked_at_utc`

4. `privacy_erasure_requests`
- `request_id`, `user_id`, `requested_at_utc`, `status`, `completed_at_utc`, `anonymization_scope`

5. `competition_integrity_events`
- `integrity_event_id`, `user_id`, `session_id`, `rule_id`, `severity`, `payload_json`, `created_at_utc`

6. `feature_flag_registry`
- `flag_key`, `description`, `owner`, `default_value`, `rollout_strategy`, `created_at_utc`

7. `experiment_registry`
- `experiment_id`, `hypothesis`, `population_rule`, `variant_policy`, `success_metric`, `stop_rule`, `status`

8. `model_registry`
- `model_version`, `scheduler_policy_ref`, `distractor_policy_ref`, `release_note`, `activated_at_utc`

9. `slo_sla_targets`
- `service_name`, `slo_name`, `target_value`, `window`, `alert_threshold`, `owner`

10. `incident_runbook`
- `incident_type`, `detection_signal`, `first_actions`, `rollback_strategy`, `communication_template`

## 18) Dashboard ultra précis par utilisateur (manques fermés)

En plus des KPI existants, ajouter:

### 18.1 Dimensions de lecture obligatoires

1. Segment temporel
- `last_24h`, `last_7d`, `last_30d`, `all_time`

2. Segment mode
- `training`, `competition`, `expert`

3. Segment difficulté
- `easy`, `medium`, `hard` + bande de similarité distracteurs

4. Segment cluster
- lecture par `visual_cluster_id`

5. Segment stabilité
- `new`, `learning`, `stable`, `relapsing`

### 18.2 Cartes dashboard supplémentaires

1. Carte \"Risque de décrochage\"
- score 0-100, drivers (baisse fréquence, hausse erreurs, hausse latence)

2. Carte \"Top 10 typos à retravailler\"
- priorité calculée par fréquence d'erreur x proximité visuelle x récence

3. Carte \"Efficacité des Misread\"
- gain de performance après misread à +1/+3/+5 questions

4. Carte \"Santé de progression\"
- progression nette semaine (montées - rechutes)

5. Carte \"Confiance du modèle\"
- intervalle de confiance sur niveau estimé

### 18.3 Alerting utilisateur personnalisé

1. Alerte stagnation
- pas d'amélioration de stabilité sur 7 jours

2. Alerte surcharge
- latence + erreurs + retries au-dessus d'un seuil

3. Alerte faux sentiment de maîtrise
- haute précision récente mais mauvaise rétention différée

## 19) Exigences non fonctionnelles détaillées (ajout)

1. Disponibilité cible
- moteur sélection + réponse: `99.9%` mensuel

2. Durabilité
- backup quotidien + test de restauration hebdomadaire

3. Observabilité
- corrélation `trace_id` entre front, API, moteur, event store

4. Sécurité
- chiffrement au repos + en transit
- séparation PII / métriques pédagogiques

5. Portabilité
- migration de schéma sans downtime utilisateur visible

## 20) Definition of Done (DoD) avant implémentation

La base cible est considérée prête uniquement si:

1. Toutes les sheets section 5 + section 17 existent.
2. Toutes les règles `blocker` de `qa_rules` passent à 100%.
3. Les invariants section 2 sont testés automatiquement.
4. Le dashboard section 13 + 18 est alimentable sans champ manquant.
5. Les politiques RGPD (consentement + effacement) sont tracées.
6. Le moteur est rejouable de manière déterministe sur un échantillon test.
