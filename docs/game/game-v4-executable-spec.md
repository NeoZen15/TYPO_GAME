# Game V4 Executable Spec (Front + Data Contract)

Last update: 2026-03-12
Status: implementation guide

## 1) Scope

This document turns the V4 product intent into executable rules:
- front behavior contracts
- data model contracts
- API target contracts
- V1 front-only implementation checklist

Companion docs:
- `docs/game/game-unified-spec-v1.md` (merged canonical source without duplication)
- `docs/ui/front-ui-master-spec.md` (canonical UI/runtime values and route flow)
- `docs/game/game-mode-normal-spec.md` (UX and pedagogical intent)
- `docs/game/onboarding-game-contract.md` (onboarding handoff contract)

## 2) Canonical Entities

### 2.1 Enums

`GameMode`
- `training`
- `competition`
- `expert`

`MasteryLevel`
- `0`
- `1`
- `2`
- `3`
- `4`

`TypeCardKind`
- `reading`
- `misread`

`AnswerState`
- `correct`
- `wrong`

### 2.2 Core Models

`WordEntry`
```json
{
  "id": "word-alphabet",
  "value": "alphabet",
  "lettersCoverage": ["a", "e", "l", "p", "h", "b", "t"]
}
```

`TypefaceEntry`
```json
{
  "id": "helvetica",
  "label": "Helvetica",
  "fontFamilyCss": "\"Helvetica Neue\", Helvetica, Arial, sans-serif",
  "family": "sans",
  "subfamily": "neo-grotesk",
  "confusionFamilies": ["neo_grotesk_vs_humanist", "tight_spacing_vs_open_spacing"]
}
```

`TypefaceProgress`
```json
{
  "typefaceId": "helvetica",
  "masteryLevel": 2,
  "lastSeenRound": 18,
  "lastResult": "correct",
  "errorCountSession": 1
}
```

`TypeCardEntry`
```json
{
  "id": "misread-neo-grotesk-vs-humanist",
  "kind": "misread",
  "title": "HELVETICA",
  "lineA": "Often confused with Arial because of its neutral appearance.",
  "lineB": "Next time look at tighter spacing and a more rigid rhythm."
}
```

## 3) Front Runtime Contract

### 3.1 Session Bootstrap

At session start, front must derive:
- `mode`
- `sessionWord` (fixed for Training and Competition session)
- `activeTypefacePool` (target around 30)
- `roundIndex = 0`
- `sessionStats` container

### 3.2 Round Contract

For each round, front must produce:
- one target typeface sample in center
- four unique candidate labels
- one correct candidate ID

Option labels must stay neutral UI typography.
Only center sample uses target typeface rendering.

### 3.3 Answer Contract

On card click:
- answer is validated immediately
- answer state is emitted (`correct` or `wrong`)
- short visual feedback is shown
- optional Type Card decision is evaluated
- if wrong: stay on current round and allow retry
- if correct: transition to next round after delay (`2000ms` in current front runtime)

No dedicated validate button in current V1 UI.

## 4) Word Logic Contract

### 4.1 Rules

Training:
- pick one word at session start
- keep same word for all rounds in session

Competition:
- same rule as Training for V1

Expert:
- word change allowed (future phase)

### 4.2 Word Pool Constraints

- target size ~20 words
- neutral lexical tone
- no proper names, symbols, or digits
- no very short words
- ensure key letter coverage (`a`, `e`, `o`, `n`, `r`, `l`, `i`, `t`, `s`)

## 5) Repetition and Mastery Contract

### 5.1 Mastery update rule

On correct:
- `level = min(level + 1, 4)`

On wrong:
- `level = max(level - 1, 0)`

Special case:
- wrong at level 4 -> level 3

### 5.2 Return windows (question intervals)

- level 0 -> `1..3`
- level 1 -> `3..6`
- level 2 -> `10..25`
- level 3 -> `25..50`
- level 4 -> `80..150`

### 5.3 Cooldowns

- wrong item cannot reappear immediately (`minDelay = 2`)
- correct item cannot reappear in the next 5 questions

### 5.4 Pool growth

- add one new typeface only when 3 different typefaces reach level 4
- keep active pool around 30

## 6) QCM Option Generation Contract

Given target typeface `T`:
- include `T` + 3 distractors
- distractors must be unique and different from `T`
- distractor similarity depends on target mastery bracket:
  - levels 0-1: high contrast distractors
  - level 2: same broad family but still distinct
  - levels 3-4: very close visual distractors

## 7) Type Cards Contract

### 7.1 General behavior

- full-screen overlay
- non-interactive
- auto-dismiss
- blocks gameplay interactions while visible

### 7.2 Reading Card trigger

Shown after some correct answers.
Recommended V1 rule:
- show if `readingCardShown[typefaceId]` is false
- then with sampling gate (`p = 0.35`) to preserve rhythm

### 7.3 Misread Card trigger

Show only when:
- first error on this typeface in current session, or
- same confusion family repeated twice in a row

Else:
- show only short wrong feedback and continue

### 7.4 Payload format

`TypeCardPayload`
```json
{
  "kind": "misread",
  "title": "HELVETICA",
  "lineA": "Often confused with Arial because of its neutral appearance.",
  "lineB": "Next time look at tighter spacing and a more rigid rhythm.",
  "durationMs": 1200
}
```

## 8) API Contract Target (Post-Local Phase)

### 8.1 Start session

`POST /api/game/session/start`

Request:
```json
{
  "mode": "training",
  "onboarding": {
    "pace": "Balanced",
    "familiarity": "A little",
    "onboardingVersion": "v1"
  }
}
```

Response:
```json
{
  "sessionId": "sess_123",
  "mode": "training",
  "sessionWord": "structure",
  "activePoolSize": 30,
  "round": {
    "roundId": "r_1",
    "sampleTypefaceId": "helvetica",
    "sampleFontFamilyCss": "\"Helvetica Neue\", Helvetica, Arial, sans-serif",
    "options": [
      { "id": "helvetica", "label": "Helvetica" },
      { "id": "arial", "label": "Arial" },
      { "id": "inter", "label": "Inter" },
      { "id": "roboto", "label": "Roboto" }
    ]
  }
}
```

### 8.2 Submit answer

`POST /api/game/session/{sessionId}/answer`

Request:
```json
{
  "roundId": "r_1",
  "selectedTypefaceId": "arial",
  "responseTimeMs": 1460
}
```

Response:
```json
{
  "result": "wrong",
  "correctTypefaceId": "helvetica",
  "masteryDelta": { "typefaceId": "helvetica", "from": 2, "to": 1 },
  "typeCard": {
    "kind": "misread",
    "title": "HELVETICA",
    "lineA": "Often confused with Arial because of its neutral appearance.",
    "lineB": "Next time look at tighter spacing and a more rigid rhythm.",
    "durationMs": 1200
  }
}
```

Contract note:
- `nextRound` is required on correct responses.
- `nextRound` may be omitted on wrong responses when retry-on-same-round is active.

## 9) Front-Only Local Contract (Current V1 Path)

Until backend phase:
- keep same response shape locally in a store/service module
- simulate `sessionId`, `roundId`, and `typeCard` payload
- persist only minimal onboarding/game seed locally

Local storage keys (proposed):
- `jdt-onboarding-v1`
- `jdt-game-seed-v1`
- `jdt-game-session-v1` (optional if resume is needed)

## 10) V1 Front-Only Implementation Checklist

### A. Data Catalogs

- create typed catalogs for:
  - `wordPool` (20 entries)
  - `typefaces`
  - `readingCardsByTypeface`
  - `misreadCardsByConfusionFamily`
- add schema validation at load time

### B. Session Engine

- create `createSession(mode, onboarding)` function
- pick and freeze `sessionWord` for Training
- initialize active pool and mastery map

### C. Round Generator

- implement `buildRound(sessionState)`:
  - pick target based on repetition windows + cooldowns
  - build 4 options by similarity tier
- guarantee uniqueness and deterministic fallback

### D. Answer Resolver

- implement `resolveAnswer(round, selectedId, responseTimeMs)`
- apply mastery updates
- compute next appearance windows
- decide Type Card trigger

### E. Type Card Renderer

- full-screen overlay component
- disable interactions while visible
- auto-dismiss by `durationMs`
- resume round flow after dismiss

### F. UI Contracts

- no validate button for current V1 flow
- click card -> immediate evaluation
- keep option label typography neutral
- keep center sample typography faithful

### G. Manual QA

- confirm same word through full Training session
- confirm word changes on new session
- confirm wrong/correct feedback states
- confirm Misread trigger on first error and repeated confusion
- confirm Reading card appears only sometimes after correct
- confirm no interaction during Type Card display

## 11) Out of Scope in This Pass

- production backend endpoints
- auth and account persistence
- competition scoring backend
- expert answer normalization backend
