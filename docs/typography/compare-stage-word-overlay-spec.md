# Compare Stage `Word Overlay` Spec

## Problem

The current `word + measure` stage mixes three different concerns without a stable system:

- placing the whole word in the pane
- measuring the global anatomy of the word block
- pointing to local details inside specific letters

When these three concerns are not separated, the result quickly breaks:

- the word can drift or get cropped
- the labels and guides can fight the specimen
- local annotations can pretend to be precise while actually floating

## Goal

Create a dedicated canonical system for `Word` similar in rigor to the current `Letter` logic, but adapted to a composed specimen instead of an isolated glyph.

The stage must prove two things at once:

- the structure of the whole word
- the local feature inside one or more letters of that word

## Core Principle

`Word` must not copy `Letter`.

But `Word` must match `Letter` in discipline.

That means:

1. one canonical projection method
2. one canonical annotation hierarchy
3. one auditable geometry model
4. no per-screen heuristic offsets unless the spec explicitly allows them

## Relation To Existing Systems

`Word` must reuse the canonical projection logic from:

- [anatomy-metrics-system.md](/Users/launaymarion/Documents/JEUX_DE_TYPO/09_DEV/08_jeux-de-typo-v2/docs/typography/anatomy-metrics-system.md)
- [compare-stage-annotation-system.md](/Users/launaymarion/Documents/JEUX_DE_TYPO/09_DEV/08_jeux-de-typo-v2/docs/typography/compare-stage-annotation-system.md)

`Word` should become its own dedicated engine, just as `Letter` now has a dedicated geometry engine.

Suggested implementation target:

- `lib/typography/word-overlay-engine.ts`

## Word Model

The engine must measure the stage in two layers.

### Layer 1: global word block

Measure the displayed word as one specimen:

- actual ink left
- actual ink right
- actual ink width
- actual ink top
- actual ink bottom
- baseline
- x-height
- cap height
- ascender
- descender
- optical center of the displayed word block

This layer defines the composition frame.

### Layer 2: local letter regions

Then measure letters inside the word:

- index of the target letter
- left/right bounds of that letter inside the word
- local opening or counter zone
- local focus zone rectangle or ellipse
- optional secondary confirmation zone

This layer defines the feature annotation.

### Layer 3: witness glyphs

`Word` must also resolve structural guides from internal witness glyphs.

This is the key difference from `Letter`.

`Letter` can measure one glyph directly.

`Word` must:

1. measure the whole word for composition
2. choose reliable internal glyphs for each structural guide
3. resolve the visible guide from those witness glyphs

The word block is not itself a witness glyph.

The global ink box may help composition, but it must not become the truth source for every guide.

## Projection Rules

The global word block must follow the canonical projection workflow:

1. measure font metrics from canonical probes
2. measure the actual displayed word box
3. choose the `comparisonWord` frame
4. fit the actual word into that frame
5. project guides using the same scale as the rendered word

Do not invent a second positioning formula inside the component.

## Placement Rules

### Horizontal placement

The word must be centered from its real ink bounds, not from CSS text alignment.

The stage must reserve a safety margin on both sides.

The specimen must never touch the left or right panel edges.

### Vertical placement

The word must be centered as a typographic block, not just as a DOM box.

The placement should account for:

- ascender
- x-height
- baseline
- descender

The visual goal is:

- the word feels optically centered
- the baseline remains structurally credible
- the guides do not pin the specimen to the bottom of the pane

### Gutter rule

The stage must reserve explicit space for:

- guide labels
- width labels
- optional local feature label

The word must never consume the guide-label gutter.

## Witness Glyph Rules

Visible guides in `Word` must come from witness glyphs, not from the global ink box alone.

### x-height

Resolve from reliable lowercase body glyphs inside the word.

Prefer:

- `x`
- `n`
- `m`
- `u`
- `a` as fallback when no stronger witness exists

Avoid using these as the only x-height truth source when better witnesses exist:

- `e`
- `c`
- `s`
- `o`

Reason:

- they introduce curves, openings or overshoot-like shapes that can look visually close while staying typographically unstable

### baseline

Resolve from the bottom contact of reliable non-descending lowercase witnesses.

Do not infer baseline from the whole word box when the word has no descenders.

### ascender

Show only when the word truly contains an ascender witness.

Prefer:

- `b`
- `d`
- `f`
- `h`
- `k`
- `l`
- `t`

### descender

Show only when the word truly contains a descender witness.

Prefer:

- `g`
- `j`
- `p`
- `q`
- `y`

### cap height

Resolve only when the word contains uppercase witnesses.

Use the uppercase witness top, not the global word top.

## Word Test Witness Plans

The canonical test words must declare which glyphs validate which guides.

### `access`

- `x-height`: `a`
- `baseline`: `a c e s`
- `ascender`: none
- `descender`: none

### `minimum`

- `x-height`: `n m u`
- `baseline`: `m i n u`
- `ascender`: none
- `descender`: none

## Annotation Hierarchy

The `Word` stage must always separate:

1. global word measures
2. local feature proof

They must not compete at the same visual strength.

### Global layer

This is the primary reading layer.

Allowed elements:

- baseline
- x-height
- word width
- optional cap height
- optional ascender
- optional descender

Rules:

- maximum 4 strong structural guides visible at once
- width is a global measure, not a decorative line
- labels stay at the edge, not in the center of the specimen

### Local layer

This is the secondary reading layer.

Allowed elements:

- one primary focus zone
- one optional weaker secondary zone
- one short label

Rules:

- do not use fake point anchors
- do not annotate more than one local feature at strong emphasis
- local annotation must point to a zone, not to an arbitrary coordinate

## Feature Behavior In Word Mode

### aperture

Global layer:

- baseline
- x-height
- width

Local layer:

- one focus zone on the `e` opening
- optional weaker secondary zone on a counter if it helps the reading

Do not show:

- multiple competing opening callouts on `c`, `e`, and `s` at once
- a surgical point anchor that implies fake precision

### x-height

Global layer:

- baseline
- x-height
- optional cap height
- optional lowercase body band

Local layer:

- ideally none, unless one letter is used as a confirmation only

### terminals

Global layer:

- width
- baseline

Local layer:

- one terminal zone
- optional secondary terminal confirmation

### contrast

Global layer:

- baseline
- width

Local layer:

- one thick-stroke zone
- one thin-stroke zone

## Audit Model

`Word` needs the same rigor as `Letter`, but with an extra composition pass.

### 1. Structure pass

Checks:

- required guides exist for the feature
- forbidden guides are not shown
- only allowed annotation primitives are used

### 2. Geometry pass

Checks:

- left/right word bounds match the real rendered specimen
- width measure matches the true word width
- baseline matches the rendered specimen baseline
- x-height matches the real projected x-height
- local focus zone overlaps the intended letter region

### 3. Composition pass

Checks:

- the word is not cropped
- the word is horizontally centered from real ink bounds
- the word is vertically balanced in the pane
- labels do not collide with the specimen
- guides do not exit the pane
- the specimen remains the dominant element

## Forbidden Shortcuts

Do not:

- center the word with CSS alone
- compute local letter markers from arbitrary percentages without relation to measured bounds
- display every possible guide at once
- mix global and local annotations at equal strength
- patch spacing by ad hoc offsets inside the component

## Implementation Policy

Before changing the `Word` UI:

1. update this spec if the model changes
2. implement the geometry in a dedicated engine
3. make the component render from engine output
4. add an audit surface similar in spirit to the glyph audit board

## QA Checklist

1. Is the word fully visible with safety margins on both sides?
2. Does the word feel optically centered in the panel?
3. Are the global guides readable before the local detail?
4. Is the local feature shown as a zone rather than a fake point?
5. Do the labels support the reading instead of overpowering it?
6. Can the feature be understood without the paragraph below?
7. Does the stage still feel like a specimen first, annotation second?
