# Docs — Jeux de Typo V2

Sommaire de la documentation, rangée par thème.
Pour comprendre le projet, commencer par [`overview/site-system-overview.md`](overview/site-system-overview.md).

## Hiérarchie de décision (2026-07-29)

Une seule chaîne fait autorité. Chaque rang est subordonné à celui du dessus, et un document qui contredit un rang supérieur a tort.

1. [`game/vision-produit-dwiggins.md`](game/vision-produit-dwiggins.md) — **Vision Produit** : les principes, et ce qui n'est pas négociable.
2. [`game/training-engine-spec-v2-clean.md`](game/training-engine-spec-v2-clean.md) — **Spec Moteur** : la traduction des principes en règles pédagogiques.
3. [`game/architecture-backend.md`](game/architecture-backend.md) — **Architecture Backend** : où ces règles vivent techniquement.
4. Contrats d'API, specs d'interface, documents d'exécution et plans de réalisation : ils appliquent, ils ne redéfinissent pas.

**Les documents de recherche sont hors de cette chaîne. Ils inspirent le produit, ils ne le gouvernent jamais.** Une idée de recherche ne peut être développée qu'après avoir été réévaluée au regard de la vision, reformulée si nécessaire, puis intégrée explicitement dans une spécification de rang 2 ou 3. Sont classés recherche : [`game/scoring-and-selection-math.md`](game/scoring-and-selection-math.md) et [`game/scoring-implementation-contract.md`](game/scoring-implementation-contract.md). Détail et raison en [vision §13](game/vision-produit-dwiggins.md).

## overview/ — vue d'ensemble
- [`project-onboarding-2026-07-30.md`](overview/project-onboarding-2026-07-30.md) — document d'accueil complet en 8 parties, pour une personne qui ne connaît pas le projet : produit et vision, système typographique, moteur, interface, backend, catalogue et licences, façon de travailler, puis l'état réel au 2026-07-30. **Décrit, ne décide rien**, aucune autorité normative, subordonné à la chaîne ci-dessus et à `process/checklist.md`.
- [`getting-started.md`](overview/getting-started.md) — porte d'entrée simple pour comprendre le projet quand on découvre le repo.
- [`site-system-overview.md`](overview/site-system-overview.md) — fiche de transmission rapide : ce que fait le site, structure, données, pipeline.
- [`project-overview-longform.md`](overview/project-overview-longform.md) — version longue de transmission produit/concept/architecture.
- [`brief.md`](overview/brief.md) — intention produit en quelques lignes.
- [`business-model.md`](overview/business-model.md) — modèle économique : pistes (affiliation / Pro / B2B), ce que le build supporte déjà, hypothèses de prix.
- [`Etude-Marche-B2B-SaaS-Ecoles-de-Design.pdf`](overview/Etude-Marche-B2B-SaaS-Ecoles-de-Design.pdf) : étude de marché et positionnement B2B SaaS pour écoles de design (direction de travail, non validée, en particulier les prix).
- [`repo-organization.md`](overview/repo-organization.md) — frontières runtime / dev-lab / artefacts, règles de rangement du repo.
- [`naming.md`](overview/naming.md) — conventions de nommage.

## game/ — moteur de jeu & pédagogie
- [`architecture-backend.md`](game/architecture-backend.md) — **architecture backend proposée (2026-07-29)** : trois axes de session (mode, contexte, politique de progression), écriture du mastery portée par la base, porte de lecture professeur, quatre natures de données, séquencement.
- [`vision-produit-dwiggins.md`](game/vision-produit-dwiggins.md) — **vision produit figée (2026-07-29), document de rang supérieur** : en cas de contradiction avec un autre doc, c'est lui qui fait foi. Moteur d'entraînement du regard, séance contre progression, vérité pédagogique unique, étanchéité élève / professeur, invariants I-15 à I-23, et registre des contradictions documentaires.
- [`NIVEAU.rtf`](game/NIVEAU.rtf) — **vision joueur** (le pourquoi, le ton) : DWIGGINS, l'entraînement du regard.
- [`game-unified-spec-v1.md`](game/game-unified-spec-v1.md) — spec unifiée des modes de jeu.
- [`game-mode-normal-spec.md`](game/game-mode-normal-spec.md) — spec du mode training (`/game`).
- [`game-v4-executable-spec.md`](game/game-v4-executable-spec.md) — spec exécutable v4.
- [`onboarding-game-contract.md`](game/onboarding-game-contract.md) — contrat onboarding ↔ jeu.
- [`perceptual-progression-spec.md`](game/perceptual-progression-spec.md) — modèle de progression perceptive (carte du regard).
- [`scoring-and-selection-math.md`](game/scoring-and-selection-math.md) — maths du scoring et de la sélection de questions.
- [`scoring-implementation-contract.md`](game/scoring-implementation-contract.md) — contrat d'implémentation du scoring.
- [`handoff-page-parcours.md`](game/handoff-page-parcours.md) — brief dev de la page Parcours (carte-galaxie DWIGGINS).
- [`training-database-master-recap-v7.md`](game/training-database-master-recap-v7.md) — récap base de données training.
- [`training-engine-spec-v2-clean.md`](game/training-engine-spec-v2-clean.md) — spec du moteur training v2, source de vérité du fonctionnement (invariants I-01 à I-14).
- [`self-correction-engine.md`](game/self-correction-engine.md) — auto-correction du niveau déclaré (5 étapes, migration 007).
- [`pool-growth.md`](game/pool-growth.md) — croissance du pool actif (I-07 et fallback §4.5, migration 008).
- [`global-level-progression.md`](game/global-level-progression.md) — niveau global visible N.1 à E.5 (migration 009).
- [`classes-comptes-spec.md`](game/classes-comptes-spec.md) — comptes, écoles, classes, provisionnement (sa section tableau de bord prof est caduque depuis la vision du 2026-07-29).

## typography/ — moteur typographique (mesure, compare, specimen)
- [`typography-system-contract.md`](typography/typography-system-contract.md) — contrat de référence du système typo.
- [`anatomy-metrics-system.md`](typography/anatomy-metrics-system.md) — système de métriques d'anatomie.
- [`specimen-layer-strategy.md`](typography/specimen-layer-strategy.md) — stratégie de la couche specimen.
- [`type-page-calibration.md`](typography/type-page-calibration.md) — calibration de la page `type`.
- `compare-stage-*.md` — specs des étapes de comparaison : [annotation](typography/compare-stage-annotation-system.md), [aperture](typography/compare-stage-aperture-spec.md), [contrast](typography/compare-stage-contrast-spec.md), [terminals](typography/compare-stage-terminals-spec.md), [word-overlay](typography/compare-stage-word-overlay-spec.md), [x-height](typography/compare-stage-x-height-spec.md).

## catalog/ — pipeline catalogue & sources de polices
- [`catalog-automation-roadmap.md`](catalog/catalog-automation-roadmap.md) — roadmap d'automatisation du catalogue.
- [`catalog-workbook-1000-spec.md`](catalog/catalog-workbook-1000-spec.md) — spec du workbook 1000+ typos.
- [`claude-prompt-catalog-workbook-1000.md`](catalog/claude-prompt-catalog-workbook-1000.md) — prompt aligné sur cette spec.
- [`massive-font-source-strategy.md`](catalog/massive-font-source-strategy.md) — stratégie source massive (snapshot Google Fonts).
- [`google-fonts-api-strategy.md`](catalog/google-fonts-api-strategy.md) — stratégie radar Google Fonts API.

## ui/ — front, design system, motion
- [`front-ui-master-spec.md`](ui/front-ui-master-spec.md) — spec maître du front.
- [`ui-consistency-contract.md`](ui/ui-consistency-contract.md) — contrat de cohérence UI (typo/espacement/casse/thème).
- [`ui-palette-reference.md`](ui/ui-palette-reference.md) — référence couleurs + texte, checklist d'incohérences.
- [`motion.md`](ui/motion.md) — règles d'animation et de timing.
- [`gate.md`](ui/gate.md) — séquence scroll d'introduction (« Gate »).
- [`profile-tabs-spec.md`](ui/profile-tabs-spec.md) — spec des onglets de la page profil.
- [`pages-explication-plan.md`](ui/pages-explication-plan.md) — plan des pages qui expliquent DWIGGINS au joueur : entrée du mode Entraînement (exigence de la vision §2.1), réécriture des règles, bloc explicatif du profil. **Plan de réalisation front, pas une source de vérité** : il traduit `game/vision-produit-dwiggins.md` en interface sans redéfinir aucune règle.

## process/ — workflow, qualité, plans
- [`checklist.md`](process/checklist.md) — **« Où on en est »** : avancement produit par sujet, confronté à l'état réel du code (source de vérité).
- [`safety-workflow.md`](process/safety-workflow.md) — workflow de sauvegarde / checkpoints.
- [`worktree-stabilization.md`](process/worktree-stabilization.md) — note de stabilisation du worktree.
- [`test-plan.md`](process/test-plan.md) — plan de test.
- [`agent-validation-plan.md`](process/agent-validation-plan.md) — plan de validation par agents.
- [`v4-source-diff-checklist.md`](process/v4-source-diff-checklist.md) — checklist de diff source v4.
- [`backend-todo.md`](process/backend-todo.md) — TODO backend.

## archive/ — handoffs & références historiques
- [`context-handoff-2026-03-27-play-onboarding.md`](archive/context-handoff-2026-03-27-play-onboarding.md) — handoff de contexte.
- [`translator-review-packet.md`](archive/translator-review-packet.md) — packet de review traduction.
- [`overview-notes/README.md`](archive/overview-notes/README.md) — notes de réflexion et veille conservées à titre d'archive, hors des docs actives.
