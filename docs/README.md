# Docs — Jeux de Typo V2

Sommaire de la documentation, rangée par thème.
Pour comprendre le projet, commencer par [`overview/site-system-overview.md`](overview/site-system-overview.md).

## overview/ — vue d'ensemble
- [`site-system-overview.md`](overview/site-system-overview.md) — fiche de transmission rapide : ce que fait le site, structure, données, pipeline.
- [`brief.md`](overview/brief.md) — intention produit en quelques lignes.
- [`repo-organization.md`](overview/repo-organization.md) — frontières runtime / dev-lab / artefacts, règles de rangement du repo.
- [`naming.md`](overview/naming.md) — conventions de nommage.

## game/ — moteur de jeu & pédagogie
- [`game-unified-spec-v1.md`](game/game-unified-spec-v1.md) — spec unifiée des modes de jeu.
- [`game-mode-normal-spec.md`](game/game-mode-normal-spec.md) — spec du mode training (`/game`).
- [`game-v4-executable-spec.md`](game/game-v4-executable-spec.md) — spec exécutable v4.
- [`onboarding-game-contract.md`](game/onboarding-game-contract.md) — contrat onboarding ↔ jeu.
- [`perceptual-progression-spec.md`](game/perceptual-progression-spec.md) — modèle de progression perceptive (carte du regard).
- [`scoring-and-selection-math.md`](game/scoring-and-selection-math.md) — maths du scoring et de la sélection de questions.
- [`scoring-implementation-contract.md`](game/scoring-implementation-contract.md) — contrat d'implémentation du scoring.
- [`training-database-master-recap-v7.md`](game/training-database-master-recap-v7.md) — récap base de données training.
- [`training-engine-spec-v2-clean.md`](game/training-engine-spec-v2-clean.md) — spec du moteur training v2.

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

## process/ — workflow, qualité, plans
- [`safety-workflow.md`](process/safety-workflow.md) — workflow de sauvegarde / checkpoints.
- [`worktree-stabilization.md`](process/worktree-stabilization.md) — note de stabilisation du worktree.
- [`test-plan.md`](process/test-plan.md) — plan de test.
- [`agent-validation-plan.md`](process/agent-validation-plan.md) — plan de validation par agents.
- [`v4-source-diff-checklist.md`](process/v4-source-diff-checklist.md) — checklist de diff source v4.
- [`backend-todo.md`](process/backend-todo.md) — TODO backend.

## archive/ — handoffs & références historiques
- [`NIVEAU.rtf`](archive/NIVEAU.rtf) — référence texte du jeu (niveaux).
- [`context-handoff-2026-03-27-play-onboarding.md`](archive/context-handoff-2026-03-27-play-onboarding.md) — handoff de contexte.
- [`handoff-page-parcours.md`](archive/handoff-page-parcours.md) — handoff page parcours.
- [`translator-review-packet.md`](archive/translator-review-packet.md) — packet de review traduction.
