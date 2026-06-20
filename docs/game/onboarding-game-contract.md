# Onboarding + Game Spec and Audit (V1)

Last update: 2026-03-12

## 1) Scope

This document now serves 2 goals:
- product spec (target behavior)
- implementation audit (actual behavior in code)

Covered areas:
- onboarding flow
- micro test behavior
- progress bar logic
- calibration handoff to `/game`
- persistence contract (front V1)

Related game product draft:
- see `docs/game/game-mode-normal-spec.md`
- visual/runtime source of truth:
  - `docs/ui/front-ui-master-spec.md`

## 2) Product Goal

Onboarding must prepare users to observe letter structure, not guess fast.

Success signals:
- users understand the mindset in under ~20 seconds
- choices feel useful
- first game screen reflects onboarding choices

## 3) Current Front Flow (Implemented)

Order in code:
- `welcome`
- `pace`
- `familiarity`
- `micro`
- `launch`

Per screen:
- `welcome`: intro copy, button `Continue`
- `pace`: single-select required, button `Continue`
- `familiarity`: single-select required, button `Continue`
- `micro`: select option then `Validate`; continue allowed only after correct validation
- `launch`: summary chips + `Start playing` to `/game`

## 4) Progress Bar Rules (Implemented)

Progress is based on 3 answerable checkpoints:
- `pace`
- `familiarity`
- `micro` resolved as correct

Current steps:
- start: 0%
- after `pace`: 33%
- after `familiarity`: 67%
- after correct `micro`: 100%

Notes:
- `welcome` and `launch` do not increment progress
- there is no auto-complete based on waiting time

## 5) Micro Test Rules (Implemented)

Interaction model:
- one sample word appears
- user picks one of 2 labels
- user clicks `Validate`
- if wrong: selected answer turns red, user can retry
- if correct: selected answer turns green, CTA label becomes `Start session`

Important constraints:
- no timer
- no auto-advance
- must validate explicitly

## 6) Calibration Mapping (Implemented)

### 6.1 `pace` impact

On onboarding:
- informational note appears on `familiarity` step

On game first screen:
- `Relaxed`: slower feedback delay (`640ms`)
- `Balanced`: standard delay (`320ms`)
- `Challenging`: fast delay (`140ms`)
- hint visibility: hidden when `Challenging`, shown otherwise

### 6.2 `familiarity` impact

On onboarding:
- currently stored, but no strong visual pair change inside onboarding micro

On game first screen:
- determines the comparison profile:
  - prompt text
  - option labels
  - font pair classes
  - expected answer side
  - hint copy

## 7) Persistence Contract (Front V1)

Storage key:
- `jdt-onboarding-v1`

Stored payload:
```json
{
  "pace": "Balanced",
  "familiarity": "A little"
}
```

Used by `/game`:
- read once at mount
- fallback defaults if missing/invalid:
  - `pace = Balanced`
  - `familiarity = A little`

## 8) Theme Contract (Current)

Global theme:
- starts in `light`
- switch stored in `localStorage` (`jdt-theme`)

Color system:
- primary UI stays black/white/yellow
- onboarding/game correctness feedback uses:
  - green `#00c853` for correct choice states
  - red `#ff0000` for wrong choice states

## 9) Technical Audit (2026-03-11)

Checks executed:
- `npm run lint` -> pass
- `npm run typecheck` -> pass
- `npm run quality` -> pass
  - artifacts check pass
  - copy usage check pass
  - motion/layout contracts check pass (19 checks)

## 10) Spec vs Code Gaps (Important)

1. Immediate impact after first answer is currently mostly copy-level in onboarding.
- Current: visible pace note appears.
- Missing if strict spec: stronger visual adaptation before leaving onboarding.

2. Previous spec text was inconsistent on progress and timer.
- Now aligned to implemented behavior (3 checkpoints, no timer).

## 11) Acceptance Criteria (Updated to Current Build)

Functional:
- intro appears before questions
- cannot continue on `pace`/`familiarity` without selection
- micro requires `Validate`
- micro must be correct before advancing
- launch CTA routes to `/game`

UX:
- progress follows 0/33/67/100
- correct state is green
- wrong state is red
- no hidden timeout that auto-finishes onboarding

Persistence:
- onboarding answers saved locally
- game reads saved answers and adapts first card

Accessibility:
- option groups use radio roles
- arrow keys move selection inside groups

## 12) V2 Back Contract (Target, Not Implemented Yet)

Future backend should consume:
- `pace`
- `familiarity`
- onboarding version

Then return:
- `starterProfile`
- first-session config (difficulty/hints/timing)

Still out of scope now:
- auth
- server persistence
- adaptive scoring model

## 13) Audit Delta (2026-03-12)

Fixes confirmed in this pass:
- wrong-answer state is now explicit and styled red on onboarding micro answers
- wrong-answer state is also styled red on `/game` first question
- feedback text now supports red wrong state in onboarding and game

Checks rerun:
- `npm run lint` -> pass
- `npm run typecheck` -> pass
- `npm run quality` -> pass

Non-blocking issues found:
- immediate impact after first answer is still mostly copy-level in onboarding

Recommended improvements (priority order):
1. add stronger visual adaptation in onboarding immediately after first answer
2. add a lightweight QA checklist for manual onboarding regression (pace/familiarity/micro/launch)

Additional changes delivered in this pass:
- onboarding micro expected side is now randomized (`left` or `right`) per session
- unused onboarding CSS selectors removed (`.onboarding-micro-card`, `.onboarding-micro-label`, and `picked` feedback variants)

## 14) Manual QA Checklist (Onboarding)

1. Open `/onboarding` and confirm step order is `welcome -> pace -> familiarity -> micro -> launch`.
2. On `pace`, verify `Continue` stays disabled until one option is selected.
3. On `familiarity`, verify `Continue` stays disabled until one option is selected.
4. Confirm progress values visually follow 0/33/67/100 across `pace`, `familiarity`, and `micro`.
5. On `micro`, click a wrong answer then `Validate`:
   - selected button turns red
   - feedback text turns red
   - CTA remains `Validate`
6. On `micro`, click the correct answer then `Validate`:
   - selected button turns green
   - feedback text turns green
   - CTA changes to `Start session`
7. Reload `/onboarding` multiple times and confirm the correct side in `micro` is not always the same.
8. Click `Start session` then `Start playing` and confirm navigation to `/game`.
9. On `/game`, verify wrong answer is red and correct answer is green.
10. Toggle theme and confirm onboarding/game remain readable in both modes.
