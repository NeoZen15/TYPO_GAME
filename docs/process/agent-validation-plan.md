# Agent Validation Plan

Statut: proposition uniquement

Ce document sert de support de validation avant toute modification du code.

Règle de travail actuelle :
- les sous-agents peuvent analyser et proposer
- aucune modification produit n'est appliquée sans validation explicite
- une fois validé, les changements seront implémentés par lots

## Objectif

Consolider les recommandations de trois sous-agents actifs :
- `frontend / UX`
- `copywriter`
- `gameplay / API`

Le but est de valider les changements à faire avant d'agir.

## Vue d'ensemble

Les agents convergent sur trois besoins principaux :
- rendre le parcours plus honnête et plus lisible
- harmoniser la voix éditoriale et la microcopy
- durcir le flux `training` côté API et base de données

## Lot A

### A1. Rendre la page des modes honnête sur ce qui est disponible

Résumé :
`Training` est jouable, mais `Competition` et `Expert` mènent encore vers des placeholders. L'interface devrait le dire plus clairement.

Fichiers pressentis :
- `features/modes/components/ModeSelectPage.tsx`
- `features/modes/components/ModePlaceholderPage.tsx`
- `app/play/competition/page.tsx`
- `app/play/expert/page.tsx`

Bénéfice attendu :
- moins de déception
- meilleure confiance produit
- choix plus clair pour l'utilisateur

Risque :
- faible

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

### A2. Clarifier le choix d'entrée sur la landing

Résumé :
Le hero est fort, mais le choix `Yes / Not now` ressemble davantage à un piège ludique qu'à une vraie décision utilisateur. L'objectif est de garder la personnalité du produit tout en rendant la sortie plus claire.

Fichiers pressentis :
- `features/landing/components/Gate.tsx`
- `content/copy.ts`
- `app/globals.css`

Bénéfice attendu :
- moins de friction au premier écran
- meilleure compréhension du produit
- meilleur passage vers le parcours utile

Risque :
- faible

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

### A3. Raccourcir l'onboarding et corriger les CTA trompeurs

Résumé :
Le flow actuel est perçu comme très linéaire. Le CTA `Start session` ne lance pas immédiatement la session, ce qui peut créer une confusion. Une simplification du tunnel est recommandée.

Fichiers pressentis :
- `features/onboarding/components/OnboardingFlow.tsx`
- `content/copy.ts`
- `app/globals.css`

Bénéfice attendu :
- onboarding plus court
- moins d'abandon
- compréhension plus nette des étapes

Risque :
- moyen

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

### A4. Uniformiser la navigation autour de `/play`

Résumé :
Aujourd'hui, `Training` quitte l'arborescence `/play` pour aller vers `/game`, tandis que les autres modes restent sous `/play/*`. L'agent recommande de clarifier cette logique de navigation.

Fichiers pressentis :
- `app/play/training/page.tsx`
- `app/game/page.tsx`
- `features/modes/components/ModeSelectPage.tsx`
- `features/modes/components/ModeRulesPage.tsx`

Bénéfice attendu :
- navigation plus cohérente
- structure produit plus compréhensible

Risque :
- moyen

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

## Lot B

### B1. Repositionner le hero et les CTA de la landing

Résumé :
Le concept `LOOK CLOSER` est jugé fort, mais le sous-texte et les CTA peuvent mieux expliquer la promesse. L'idée n'est pas de banaliser la page, mais d'ajouter de la clarté.

Fichiers pressentis :
- `features/landing/components/Gate.tsx`
- `content/copy.ts`

Bénéfice attendu :
- meilleure compréhension immédiate
- meilleure conversion vers l'onboarding

Risque :
- faible

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

### B2. Rendre l'onboarding plus orienté bénéfice

Résumé :
Certaines étapes ressemblent à de la mécanique produit. L'agent copy propose de reformuler les titres et sous-titres pour expliquer la valeur utilisateur plutôt que le fonctionnement interne.

Fichiers pressentis :
- `features/onboarding/components/OnboardingFlow.tsx`
- `content/copy.ts`

Bénéfice attendu :
- parcours plus rassurant
- onboarding moins scolaire
- meilleure perception du jeu comme outil d'entraînement

Risque :
- faible

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

### B3. Différencier les modes par promesse, pas seulement par mécanique

Résumé :
Les cartes de modes peuvent mieux vendre le bénéfice de chaque expérience, par exemple apprentissage progressif, vitesse sous pression, ou identification directe.

Fichiers pressentis :
- `features/modes/components/ModeSelectPage.tsx`
- `content/copy.ts`

Bénéfice attendu :
- décision plus rapide
- meilleure lisibilité produit

Risque :
- faible

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

### B4. Alléger et harmoniser les règles

Résumé :
Les pages de règles sont riches mais parfois longues et tonalement inégales. L'agent recommande un resserrage avec un ton plus stable, plus premium, moins relâché.

Fichiers pressentis :
- `features/modes/components/ModeRulesPage.tsx`
- `content/copy.ts`

Bénéfice attendu :
- lecture plus fluide
- meilleure cohérence de marque

Risque :
- moyen

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

### B5. Refaire la microcopy du jeu

Résumé :
Les états `loading`, `error` et `end state` du jeu sont fonctionnels, mais encore très bruts. L'agent recommande une voix plus calme, précise et rassurante.

Fichiers pressentis :
- `features/game/components/GameScreen.tsx`
- `content/copy.ts`

Bénéfice attendu :
- meilleure confiance dans les cas de chargement et d'erreur
- sensation produit plus soignée

Risque :
- faible

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

### B6. Fixer un ton éditorial de référence

Recommandation :
calme, précis, premium, éditorial, jamais professoral, avec une légère tension ludique mais sans ironie inutile.

Point d'attention :
choisir une langue principale par parcours visible, puis harmoniser toutes les microcopies critiques.

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

## Lot C

### C1. Durcir la validation d'entrée des routes API

Résumé :
Le flux `training` valide encore trop tard les entrées. L'objectif est de transformer les erreurs de payload en `400` ou `422`, plutôt qu'en faux `500`.

Fichiers pressentis :
- `app/api/training/session/start/route.ts`
- `app/api/training/answer/route.ts`
- `lib/game/training/contracts.ts`
- `lib/game/training/provider.ts`

Bénéfice attendu :
- API plus stable
- moins d'erreurs ambiguës
- meilleure base pour le front

Risque :
- faible

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

### C2. Rendre `GAME_PROVIDER_SECRET` obligatoire

Résumé :
La signature du token retombe aujourd'hui sur `DATABASE_URL`, puis sur un secret codé en dur. L'agent recommande de supprimer ce fallback et d'exiger un secret explicite.

Fichiers pressentis :
- `lib/game/training/question-token.ts`
- `lib/game/training/provider.ts`
- `lib/server/neon.ts`

Bénéfice attendu :
- sécurité plus saine
- comportement plus prévisible

Risque :
- moyen

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

### C3. Introduire des erreurs métier et un mapping HTTP clair

Résumé :
Aujourd'hui, beaucoup de cas d'échec finissent en `500`. L'idée est d'introduire des erreurs typées pour distinguer clairement payload invalide, token invalide, session expirée, état manquant, etc.

Fichiers pressentis :
- `lib/game/training/provider.ts`
- `app/api/training/session/start/route.ts`
- `app/api/training/answer/route.ts`
- `features/game/components/GameScreen.tsx`

Bénéfice attendu :
- erreurs plus lisibles
- UX plus propre côté jeu
- logs plus utiles

Risque :
- faible à moyen

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

### C4. Encapsuler `submitTrainingAnswer` dans une transaction

Résumé :
Le provider enchaîne plusieurs écritures sur plusieurs tables. En cas d'échec intermédiaire ou de concurrence, l'état peut devenir partiel. L'agent recommande une transaction explicite.

Fichiers pressentis :
- `lib/game/training/provider.ts`
- `db/migrations/003_users_sessions_pool.sql`
- `db/migrations/001_user_event_fact.sql`

Bénéfice attendu :
- meilleure cohérence de l'état gameplay
- moins de corruption silencieuse

Risque :
- élevé

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

### C5. Implémenter l'idempotence prévue par le schéma

Résumé :
Le schéma prévoit déjà des mécanismes de garde, mais ils ne sont pas réellement exploités par le flux actuel. L'objectif est de rendre les double-submits et les retries réseau sûrs.

Fichiers pressentis :
- `db/migrations/001_user_event_fact.sql`
- `lib/game/training/provider.ts`
- `app/api/training/answer/route.ts`
- `features/game/components/GameScreen.tsx`

Bénéfice attendu :
- meilleure robustesse réseau
- comptage d'essais fiable

Risque :
- moyen

Validation :
- [ ] Valider
- [ ] À rediscuter
- [ ] Refuser

## Ordre recommandé

Si on doit avancer par lots, l'ordre recommandé est :

1. `A1` rendre les modes honnêtes
2. `A2` clarifier la landing
3. `B2` et `B5` améliorer onboarding et microcopy
4. `C1` et `C3` durcir validation et gestion d'erreurs
5. `A3` simplifier l'onboarding
6. `C2` imposer `GAME_PROVIDER_SECRET`
7. `B4` harmoniser les règles
8. `A4` retravailler la structure `/play`
9. `C4` et `C5` refactor transaction + idempotence

## Validation finale

Merci de répondre en indiquant simplement :

- les items validés
- les items à rediscuter
- les items à exclure

Exemple :

```md
Validés : A1, A2, B2, B5, C1, C3
À rediscuter : A3, A4, B4, C2
Exclus : C4, C5
```
