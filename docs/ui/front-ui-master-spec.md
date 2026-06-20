# Front UI Master Spec (Landing + Onboarding + Game)

Last update: 2026-03-13
Status: canonical front reference

## 1) Purpose

This document is the single source of truth for:
- information architecture (routes and transitions)
- runtime flow (landing, onboarding, game)
- visual tokens used in the current build
- interaction timing and feedback behavior

Related docs:
- `docs/game/onboarding-game-contract.md`
- `docs/game/game-mode-normal-spec.md`
- `docs/game/game-v4-executable-spec.md`

## 2) Information Architecture (Current)

Route tree:
- `/` landing page (manifest + sections + CTA)
- `/onboarding` non-scroll onboarding flow
- `/play` mode selection page (transition before mode runtime)
- `/play/training` training entry route
- `/play/competition` competition placeholder route
- `/play/expert` expert placeholder route
- `/play/training/rules` training rules route (active)
- `/play/competition/rules` competition rules route (active)
- `/play/expert/rules` expert rules route (active)
- `/game` non-scroll training screen (front-only runtime)

Current transition paths:
- `/` -> click `Yes` in block 3 -> `/onboarding`
- `/onboarding` -> finish flow -> `/play`
- `/play` -> choose one mode route
- `/play` -> click `Rules` on mode card -> `/play/{mode}/rules`
- `/play/{mode}/rules` -> `Back to modes` -> `/play`
- `/game` -> `Play again` restarts local session in place

No other route transition is active for game mode selection yet.

## 3) Theme Contract

Theme key:
- localStorage key: `jdt-theme`

Default theme at boot:
- `light` (from `app/layout.tsx` bootstrap script)

Supported values:
- `light`
- `dark`

Theme switch behavior:
- fixed at top-right
- one-click toggle
- applies to `document.documentElement.dataset.theme`
- updates `colorScheme`

Theme switch sizing:
- track: `2.86rem x 1.64rem`
- thumb: `1.24rem`
- track radius: `999px`
- thumb radius: `999px`

## 4) Global Visual Tokens (Exact)

Core semantic colors:
- background light: `#ffffff`
- foreground light: `#111114`
- background dark: `#000000`
- foreground dark: `#ffffff`
- accent yellow: `#ffd213`
- success green: `#00c853`
- error red: `#ff0000`

Progress yellow gradient:
- `linear-gradient(90deg, #ffe160 0%, #ffd213 56%, #ffc901 100%)`

Typography base:
- UI stack (token `--ui-sans`): `"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif`
- **Inter** (SIL OFL) is self-hosted in `public/fonts/ui/` — two variable fonts: `InterVariable.woff2` (roman) + `InterVariable-Italic.woff2` (italic), each covering all weights 100–900 + optical sizing (opsz 14–32) in one file. Embedded via two `@font-face` → the SAME UI font on every platform (Apple / Windows / Android). `system-ui` is only a load-time fallback.
- ⚠️ SF Pro / `"SF Pro Display"` must NEVER be named in the UI stack or embedded — Apple's font licence forbids self-hosting / web / brand use. Do not reintroduce it.
- body base size: `1rem`

## 5) Landing Screen Contract (`/`)

Key CTA block:
- prompt: `Want to see how it works?`
- actions: `Yes` and `Not now`
- `Yes` routes to `/onboarding`

CTA button style:
- transparent background
- no border
- color uses tokenized muted/strong foreground
- hover/focus underline for `Yes`

Spacing:
- actions gap: `clamp(2rem, 4vw, 4.25rem)`

## 6) Onboarding Contract (`/onboarding`)

### 6.1 Flow order

Step order:
- `welcome`
- `pace`
- `familiarity`
- `micro`
- `launch`

Progress model:
- checkpoints counted: `pace`, `familiarity`, `micro` (correct only)
- values: `0% -> 33% -> 67% -> 100%`

### 6.2 Layout and containers

Onboarding shell:
- width: `min(92vw, 44rem)`
- max-height: `calc(100svh - clamp(5.8rem, 12vh, 7.8rem))`
- border radius: `1.15rem`
- border: `1px` mixed foreground

Speech bubble title:
- radius: `0.94rem`
- pointer diamond size: `0.58rem`

Primary controls:
- option pills radius: `999px`
- CTA button radius: `999px`

### 6.3 Validation and feedback states

Question steps (`pace`, `familiarity`):
- `Continue` disabled until one option is selected

Micro step:
- user selects left/right
- click `Validate`
- if wrong: selected option turns red, user can retry
- if correct: selected option turns green, CTA changes to `Start session`

Micro answer colors (hard-coded):
- correct: `#00c853` with white text
- wrong: `#ff0000` with white text

Micro feedback text colors:
- correct text: `#22c55e`
- wrong text: `#ef4444`

### 6.4 Onboarding timing values

Transitions:
- option transitions: `160ms`
- progress fill transition: `240ms`
- mascot beat animation: `2.2s` loop
- success/wrong pop animation: `560ms`

## 7) Game Contract (`/game` current front runtime)

### 7.1 Core loop (current implementation)

Per round:
- one central word rendered in the target font
- 4 options in a `2x2` grid
- click is immediate (no validate button)

Answer behavior:
- wrong click: selected option turns red, round stays active, player can keep trying
- correct click: selected option turns green, round advances after `2000ms`

Session behavior:
- training sample word is fixed for the full session
- new session chooses a new random word from pool

### 7.2 Game option card geometry and style

Outer frame:
- no visible outer shell frame on `/game` (no tinted container border around the whole play area)
- the visual focus is only the central word and the option cards

Option container:
- width grid cap: `min(100%, 33rem)`
- grid: `2 columns`
- gap: `0.68rem`

Option card:
- radius desktop: `1.04rem`
- radius mobile (`@media <= 768px`): `0.94rem`
- min-height: `clamp(3.72rem, 7.3vh, 4.42rem)`
- side accent bar with neon glow via `::before`

State colors:
- selected: neutral emphasis
- correct: background/border `#00c853`, white label
- wrong: background/border `#ff0000`, white label

### 7.3 Game timing values

Current round timing constants:
- correct delay before next round: `2000ms`
- wrong delay: none (manual retry on same round)

Option transitions:
- `180ms` for transform/filter/shadow/border

## 8) Radius and Shape Reference

Main radii currently used:
- `999px` (pills/switch/rounded controls)
- `1.15rem` (onboarding shell)
- `1.04rem` (game option desktop)
- `0.94rem` (speech bubble and mobile option variant)
- `0.90rem` (micro sample block)

## 9) Interaction Rules to Keep Stable

- onboarding and game remain non-scroll experiences
- option labels stay neutral UI typography (no hint leakage)
- success always green and error always red on interactive choice states
- route transitions stay explicit (`/` -> `/onboarding` -> `/play` -> mode route)

## 10) Known Open Design Decisions

Pending product decisions (not blocked by current front):
- final multi-mode entry architecture (training/competition/expert)
- account gate timing (guest first vs login first)
- final placement of mode selector (landing vs post-onboarding)
- Type Card behavior in game V2 runtime (currently simplified)

## 11) Mode Selection Contract (`/play`)

Layout:
- page is non-scroll and centered
- shell width: `min(94vw, 58rem)` on desktop
- mode cards grid:
  - desktop: 3 columns
  - `<=980px`: 2 columns
  - `<=640px`: 1 column

Card identity colors (accent only, same visual universe):
- training: `#40d38f`
- competition: `#ff934a`
- expert: `#58a9ff`

Card text contract:
- title and body text must wrap (no horizontal clipping)
- short body copy is preferred to preserve scan speed
- mode label chips (`TRAINING`, `COMPETITION`, `EXPERT`) must stay visually centered in their pills

Footer contract per card:
- left: mode meta label (`CORE MODE`, `TIMED MODE`, `ADVANCED FORMAT`)
- right: `RULES` quick access
- `RULES` remains visually emphasized (pill style), not plain inline text

Mascot contract on `/play`:
- mascot sits to the left of the main shell
- mascot is draggable
- mascot displays a short contextual comment on card hover/focus
- comment bubble is pinned on the left side for `/play` so text stays visible

## 12) Mode Rules Contract (`/play/{mode}/rules`)

Layout:
- page shell is centered
- no viewport-level page scrolling expected
- rules content area is scrollable as a single panel
- no nested scrolling inside a single rule card

Header contract:
- mode kicker chip (`TRAINING RULES`, `COMPETITION RULES`, `EXPERT RULES`) stays centered in its pill
- title remains `How this mode works`
- subtitle changes per mode

Mode tabs:
- pills for `TRAINING`, `COMPETITION`, `EXPERT`
- active tab uses mode accent

Rules panel behavior:
- panel height is constrained and scrolls vertically as one container
- current front values:
  - height: `min(52svh, 26rem)`
  - `overflow-y: auto`
  - `overflow-x: hidden`
  - `overscroll-behavior: contain`

Content density:
- each mode exposes 4 sections
- the 4th section is intentionally longer (`Detailed ... rules`) to support deep read
- long-read flow must stay continuous at panel level

Bottom actions:
- left: `Back to modes` (solid)
- right: `Open {Mode}` (outline/accent)

Mascot contract on rules pages:
- mascot is left of shell
- mascot remains draggable
- comment bubble is pinned left so it does not cover rules cards
