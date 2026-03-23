# Game Mode Normal Specification (V1)

Last update: 2026-03-13 (visual pass synced)
Status: active draft

## 0) Linked Docs

- `docs/game-unified-spec-v1.md` as merged canonical reference (learning system + interface/runtime).
- `docs/front-ui-master-spec.md` as canonical UI/runtime reference (colors, radius, timings, route flow).
- `docs/game-v4-executable-spec.md` for front-runtime contracts and data/API contracts.
- `docs/onboarding-game-contract.md` for onboarding handoff and calibration context.

## 1) Scope

This document defines the V1 behavior of the playable game screen in Normal (Training) mode:
- central word display
- 4 option cards
- validation and correction flow
- pedagogical Type Cards
- word system and word rotation rules

Not covered in this scope:
- login/auth implementation
- backend persistence implementation
- competition timer mode implementation
- expert free-text mode implementation

## 1.1 Current Front Snapshot (Implemented)

This section documents what is currently implemented on `/game` in front-only mode.

- game view is fixed-height and non-scrollable
- no visible outer frame around the full game area
- one central sample word is displayed in uppercase
- 4 answer options are displayed in a `2x2` grid
- option labels use neutral UI typography (no hint leakage)
- option cards use a neutral surface with side color accents
- side accents include a neon glow effect (base + hover + selected)
- card corners are rounded, but not fully pill
- option labels are centered
- dark mode is supported on `/game` via the global theme switch
- selection is immediate on click (no validate button)
- wrong-answer flip animation is disabled in current UI

## 2) Locked Product Rules

1. One typeface sample is shown at a time.
2. The player answers with 4 choices.
3. Option labels are always rendered in neutral site UI typography.
4. The central sample is rendered in the target typeface.
5. Word rotation is mode-driven.
6. Training changes word every 5 questions; Competition/Expert change every question.
7. Type Cards are full-screen, temporary, and non-interactive.

## 3) Word System

### 3.1 Why words exist

The word is not for reading meaning.
The word exists to expose letter structure.

Design goal:
- force visual observation
- reduce semantic guessing
- keep cognitive load stable

### 3.2 Session rule

Training mode:
- one word is selected at session start
- that word is reused for all questions in the session
- next session can use another word

Expert mode (future):
- word changes are allowed

### 3.3 Why not one word forever

If the same word is used across the entire life of the product, users memorize the word pattern first and observe less.

### 3.4 Why not change every question

Changing the word at each question adds unnecessary cognitive noise and weakens typographic focus.

### 3.5 Word pool size

Target pool size: around 20 words.

Rationale:
- fewer than 10: over-memorization risk
- more than 30: little additional pedagogical value for higher content cost

### 3.6 Word quality constraints

Word selection constraints:
- no emotional words
- no proper names
- no very short words
- no numbers or symbols
- neutral lexical tone

### 3.7 Letter coverage constraints

Words should collectively expose key discriminant letters:
- `a` for structure and counters
- `e` for aperture
- `o` for round forms
- `n`, `r`, `l`, `i` for vertical rhythm
- `t` for crossings
- `s` for complex curves

### 3.8 V1 word list

- `alphabet`
- `typographie`
- `structure`
- `regular`
- `baseline`
- `contraste`
- `lecture`
- `espace`
- `ligne`
- `courbe`
- `hauteur`
- `epaisseur`
- `glyphes`
- `famille`
- `alignement`
- `rythme`
- `design`
- `caractere`
- `forme`
- `proportion`

## 4) Card Layout and Visual Rules

1. The game page remains fixed-height and non-scrollable.
2. No outer game-shell frame should visually surround the word/options composition.
3. The central word is visually dominant.
4. Answer options are 4 rounded cards in a 2x2 composition.
5. Cards use neutral surfaces with side color accents (not full color fill).
6. Side accents use a controlled neon glow for readability and rhythm.
7. Card labels keep neutral site typography to avoid hint leakage.
8. Option labels are centered in the card.
9. Validation state feedback stays immediate and readable.
10. Dark mode and light mode must both preserve contrast and hierarchy.

## 5) Core Round Loop (Training)

Per round:
1. Show one central sample in target typeface.
2. User selects one of 4 option cards.
3. Selection is validated immediately.
4. If wrong: selected option turns red and player can retry on the same round.
5. If correct: selected option turns green and the system advances after a short delay.
6. System may show a Type Card depending on trigger policy.

## 6) Type Cards System (Pedagogical Core)

### 6.1 Definition

A Type Card is a full-screen temporary pedagogical card shown between rounds.
It is not interactive and auto-dismisses.

### 6.2 Card families

Two families exist in V1:
- `Reading Card`
- `Misread Card`

Current implementation status:
- `Reading Card`: implemented
- `Misread Card`: pending (currently replaced by short wrong feedback + auto-continue)

### 6.3 Reading Card

Purpose:
- reinforce a correct visual recognition

Content constraints:
- typeface name
- one short visual identity sentence
- one explicit observation instruction

Forbidden content:
- long historical context
- encyclopedic definitions
- multi-topic explanations

Display policy:
- not after every correct answer
- sampled to preserve gameplay rhythm

### 6.4 Misread Card

Purpose:
- transform an error into immediate visual correction without punitive tone

Content constraints:
- correct typeface name
- one confusion explanation sentence
- one “look at this next time” instruction

Display policy:
- not after every error
- trigger only when:
  - first error on a given typeface during the session
  - or same confusion repeated twice in a row

Otherwise:
- show only a short incorrect feedback and continue

### 6.5 Confusion mutualization

Misread logic is based on confusion families, not one card per font only.
One Misread Card can serve several fonts sharing close visual confusion.

V1 confusion families examples:
- neo-grotesk vs humanist
- humanist vs geometric
- neutral system sans vs expressive sans
- tighter spacing vs open spacing

### 6.6 Interaction and timing contract

Type Card behavior:
- full-screen overlay
- no click, no keyboard action required
- transitions are automatic

Timing targets:
- fast enough to preserve pace
- long enough to read one short message

## 7) Data Model Requirements (Front V1)

Session state must include:
- `sessionWord`
- `roundIndex`
- `currentTypefaceId`
- `shownReadingCards` set
- `firstErrorSeenByTypeface` set
- `lastConfusionFamily` and streak count

Content catalogs required:
- `wordPool` (20 words)
- `readingCardsByTypeface`
- `misreadCardsByConfusionFamily`

## 8) Acceptance Criteria

Functional:
- Word rotation follows mode policy (`training=5 questions`, `competition=1`, `expert=1`)
- 4 options are always shown
- correct option maps to rendered sample typeface
- option labels never reveal candidate rendering style
- wrong answer does not force immediate round advance
- correct answer advances after configured delay (`2000ms` in current runtime)

Pedagogical:
- Reading Cards appear on some correct answers only
- Misread Cards appear only on defined trigger cases
- every Type Card contains a single clear visual instruction

UX:
- no interaction possible during Type Card display
- Type Card auto-dismiss works reliably
- round pacing remains fluid

## 9) Out of Scope (Current Phase)

- backend spaced-repetition engine
- score model and competition ranking
- expert input validation service
- auth and account persistence
