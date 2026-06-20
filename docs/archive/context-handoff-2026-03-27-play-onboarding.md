# Contexte de reprise — 27 mars 2026

## Objectif produit (actuel)
- Recalibrer l'UI pour retrouver le rendu validé avant le 23 mars.
- Priorité actuelle: aligner **`/onboarding`** sur le langage visuel de **`/play`** (tailles de texte, hiérarchie typo, contrastes, shell, boutons, cohérence globale).

## État repo
- Branche: `main`
- Remote: `origin` configuré vers `https://github.com/NeoZen15/TYPO_GAME.git`
- Dernier gros checkpoint déjà commité/poussé: `e9b9171`
- Modifs locales non commit au moment de cette passation:
  - `app/globals.css`
  - `features/modes/components/ModeRulesPage.tsx` (modif préexistante, ne pas écraser sans vérifier)

## Ce qui a été fait juste avant cette passation
### 1) Audit `play -> onboarding`
- Comparaison des classes et tokens dans `app/globals.css`:
  - `mode-select-*` (source de vérité pour `/play`)
  - `onboarding-*` (cible à harmoniser)
- Inspection composant onboarding:
  - `features/onboarding/components/OnboardingFlow.tsx`

### 2) Patch appliqué dans `app/globals.css`
Objectif: rapprocher onboarding de la grammaire visuelle de play.
- Ajustements de rythme/layout:
  - `onboarding-shell` gap
  - `onboarding-content` gap
- Harmonisation typo:
  - `onboarding-title` calé sur tokens `--ui-title-*`
  - `onboarding-copy` calé sur `--ui-subtitle-*`
  - options onboarding: taille/weight/letter-spacing plus proches des boutons de game/play
  - chips résumé: style plus “label system” (uppercase + tracking)
- Harmonisation dark:
  - shell onboarding avec contour jaune + fond/halo dans l’esprit de `/play`
  - contrastes texte ajustés
  - bulle du titre et bordures ajustées

## Vérifications exécutées
- `npm run lint` ✅
- `npm run typecheck` ✅

## Captures générées (local)
- Réf `/play` light: `tmp/playwright/audit-play-typo/shot-0.png`
- État `/onboarding` light après patch: `tmp/playwright/onboarding-after-play-audit/shot-0.png`
- État `/onboarding` dark après patch: `tmp/playwright/onboarding-dark-after-play-audit/shot-0.png`

## Point d’attention design
- Le matching est **beaucoup plus proche** de `/play`, mais il reste à faire la validation visuelle finale à l’œil avec toi (surtout micro-contrastes et perception des tailles en dark).
- `ModeRulesPage.tsx` est modifié localement (pas traité dans cette passe), donc attention en commit global.

## Prochaine étape recommandée (dans la nouvelle discussion)
1. Ouvrir `/play` puis `/onboarding` en light + dark.
2. Faire un micro-audit visuel final sur:
   - taille titre onboarding
   - contraste body copy
   - épaisseur/balance des bordures shell + cartes
   - taille/poids boutons CTA
3. Appliquer une passe fine (delta CSS léger) puis commit propre.

## Commandes utiles
```bash
cd "/Users/launaymarion/Documents/JEUX_DE_TYPO/09_DEV/08_jeux-de-typo-v2."
npm run dev
```

```bash
npm run lint
npm run typecheck
```

## Fichiers clés à regarder en priorité
- `app/globals.css`
- `features/onboarding/components/OnboardingFlow.tsx`
- `features/modes/components/ModeSelectPage.tsx`
- `features/modes/components/ModeRulesPage.tsx`
