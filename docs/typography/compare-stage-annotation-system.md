# Compare Stage Annotation System

## Goal

Build a compare-stage annotation language that is:

- visually clear
- mathematically stable
- duplicable across screens
- honest about what is being shown

The system must avoid fake precision.
If a feature can be explained with guides, bands, or focus zones, do not add a point anchor inside the letter.

## Core rule

Do not point to a pixel unless that point is truly measurable and meaningful.

Most compare-stage screens should annotate:

- a structure
- a relation
- or a zone

not a single coordinate.

## Allowed annotation primitives

Only use these primitives:

1. Guides
Horizontal structural lines.

Examples:

- baseline
- x-height
- cap height
- ascender
- descender

2. Bands
A highlighted strip between two guides.

Examples:

- lowercase body band between baseline and x-height
- cap zone when needed

3. Focus zones
A soft ellipse, contour, glow, or tinted area that highlights a local region.

Examples:

- aperture zone
- terminal zone
- thick stroke zone
- thin stroke zone
- counter zone

4. Labels
Short uppercase labels attached to a guide, band, or focus zone.

Examples:

- X-HEIGHT
- BASELINE
- LOWERCASE BODY
- APERTURE
- TERMINAL
- THICK STROKE

## Forbidden patterns

Do not use:

- arbitrary dot anchors inside a glyph
- callouts pointing into empty space
- one universal annotation reused on every letter
- labels that imply local precision when only a general relation is shown
- more than two strong focus zones on the same stage

## System hierarchy

Each compare-stage visual must follow this order:

1. The specimen remains dominant.
2. The structure is readable at a glance.
3. The focus is obvious in under two seconds.
4. The labels support the reading but never overpower the glyph.

## Maximum density

Per stage:

- maximum 4 visible structural guides
- maximum 1 band
- maximum 2 focus zones
- maximum 3 labels in the main specimen area

If more information is needed, split it into another stage.

## Feature rules

### x-height

#### What this feature is

The perceived height of the lowercase body between baseline and x-height.

#### What to show

- baseline
- x-height
- cap height as a secondary guide
- a band between baseline and x-height

#### What the label should point to

The label `LOWERCASE BODY` must point to the band, not to a point inside the letter.

#### What not to show

- no dot anchor inside the glyph
- no vague circle on `x`
- no local point callout pretending to identify a precise lowercase body coordinate

#### Best letter roles

- `x`: structural proof only
- `n`: main proof of lowercase body
- `m`: density and repeated height
- `o`: rounded confirmation
- `u`: open-shape confirmation

#### Letter-specific rule

`x` is valid as a height marker, but weak as a local body annotation target.
Use `x` to prove the guide system.
Use `n` or `m` to prove the lowercase body.

### aperture

#### What this feature is

How open the glyph is where the eye enters the form.

#### What to show

- one local focus zone around the opening
- optionally a weaker secondary zone for the counter

#### What the label should point to

The label `APERTURE` points to the opening zone, not a pixel.

#### Best letters

- `e`
- `c`
- `s`
- sometimes `a`

#### What not to show

- no fake surgical point at the lip of the form
- no wide ambiguous halo that covers half the letter

### terminals

#### What this feature is

How the stroke ends and what tone that finish gives the glyph.

#### What to show

- one focus zone on the terminal
- optionally a secondary terminal zone if needed to confirm the same logic

#### What the label should point to

The label `TERMINAL` or `ENDING` points to the terminal area as a whole.

#### Best letters

- `a`
- `r`
- `t`
- `f`
- `j`

#### What not to show

- no point pretending to identify the single correct end coordinate
- no more than two terminal highlights

### contrast

#### What this feature is

The tension between thicker and thinner stroke regions.

#### What to show

- one zone for heavy stroke
- one zone for light stroke

#### What the labels should point to

- `THICK STROKE`
- `THIN STROKE`

These point to zones, not points.

#### Best letters

- `n`
- `o`
- `s`
- `v`
- `w`

#### What not to show

- no single generic `STROKE` label
- no one-point annotation for a relational feature

### counter

#### What this feature is

The enclosed internal space of a glyph.

#### What to show

- the counter area lightly filled or outlined

#### What the label should point to

The label `COUNTER` points to the filled internal area.

#### Best letters

- `a`
- `e`
- `o`
- `p`
- `d`

### serif

#### What this feature is

The attached finishing structure at a stroke end.

#### What to show

- a local zone around the serif
- optionally a secondary zone around the bracket if that is part of the lesson

#### Labels

- `SERIF`
- `BRACKET`

### ligature

#### What this feature is

The linking structure between letters.

#### What to show

- the whole joining area

#### What not to show

- no arbitrary midpoint anchor

## Decision tree

Before annotating, ask:

1. Is the feature structural?

If yes, use guides.

Examples:

- x-height
- cap height
- ascender
- descender

2. Is the feature relational?

If yes, use guides plus a band.

Examples:

- lowercase body
- vertical occupancy

3. Is the feature local but broad?

If yes, use a focus zone.

Examples:

- aperture
- terminal
- counter
- thick stroke

4. Is a single point truly necessary?

If the answer is not absolutely yes, do not use a point.

## Pair-specific adaptation

The feature definition stays stable.
The proof must adapt to the actual typeface pair.

Example:

- For `Helvetica Neue` vs `Inter` on `x-height`, the proof should emphasize lowercase occupancy, not capitals.
- For `Helvetica Neue` vs `Inter` on `aperture`, choose glyphs where Inter opens faster and the difference is visible immediately.

Rule:

Do not annotate what is theoretically true.
Annotate what makes the actual pair legible.

## Glyph selection rules for x-height

### Valid

- `x`
- `n`
- `o`
- `m`
- `u`

### Preferred roles

- `x`: guide proof
- `n`: primary lowercase body proof
- `m`: density proof
- `o`: rounded confirmation
- `u`: open-shape confirmation

### Invalid uses

- `X` uppercase for x-height lesson
- any capital used as the main proof of lowercase body
- local `LOWERCASE BODY` callout placed on `x`

## Label vocabulary

Keep labels short and literal.

Allowed examples:

- BASELINE
- X-HEIGHT
- CAP HEIGHT
- DESCENDER
- LOWERCASE BODY
- APERTURE
- TERMINAL
- COUNTER
- THICK STROKE
- THIN STROKE

Avoid:

- interpretive copy as labels
- long explanatory sentences near the glyph
- multiple synonyms for the same thing in one stage

## Layout rules

### Structural gutter

Each stage must reserve explicit layout space for:

- specimen
- guide labels
- optional focus labels

The specimen must never consume the guide-label gutter.

### Reading order

The viewer should read in this order:

1. specimen
2. main guide or band
3. focus zone
4. label

If the eye lands on labels first, the stage is too noisy.

## QA checklist

For every stage, validate these questions:

1. Can the feature be understood without reading the paragraph below?
2. If labels are removed, does the composition still guide the eye correctly?
3. Does every annotation point to a real relation or zone?
4. Is any dot anchor fake, vague, or unnecessary?
5. Is the displayed letter actually appropriate for the feature?
6. For x-height, is the proof based on lowercase forms rather than capitals?
7. Does the specimen still remain the dominant element?

If any answer fails, revise the stage.

## Default implementation policy

When unsure:

- prefer guides over callouts
- prefer bands over points
- prefer zones over pseudo-precision
- prefer fewer annotations over more annotations

The system should feel educational, not forensic.
