# Anatomy Metrics System

## Purpose

Provide a single reproducible positioning method for all comparison anatomy screens so that:

- baseline, x-height, cap height, ascender and descender stay aligned
- different panes use the same measurement logic
- new comparison screens can be duplicated without manual offsets

## Core Rule

Never position guides from arbitrary percentages alone.

Instead:

1. Measure the font at a calibration size (`1000px`)
2. Measure canonical probe glyphs
3. Derive the font ratios from those probes
4. Project those ratios into the panel guides
5. Fit the specimen inside those guides

## Canonical Probes

- `H` -> cap height
- `x` -> x-height
- `h`, `l`, `d`, `k` -> ascender max
- `p`, `g`, `y`, `q`, `j` -> descender max

These probes are stable enough to build the structure before drawing the actual comparison sample.

## Projection Model

The projection is now sample-aware and deterministic:

1. Measure canonical font probes once
2. Measure the actual displayed sample box
3. Choose a shared frame for the panel type
4. Fit the actual sample into that frame
5. Project `cap height`, `x-height`, `ascender`, `baseline`, `descender` from the font metrics using the exact same scale

This means the rendered specimen and the guides are finally driven by the same projection scale.

## Shared Frames

The projection frame is also centralized.

Current shared frames:

- `comparisonGlyph`
- `comparisonWord`
- `testerGlyph`

These frames define only the layout envelope:

- top padding ratio
- bottom padding ratio
- horizontal padding ratio

They do not redefine the font anatomy. They only define how the already measured anatomy is projected into a given panel type.

## Why This Is More Stable

The new model is:

- measure canonical probes first
- establish a shared anatomical frame
- measure the actual displayed sample
- fit the actual sample into that frame
- project the guides from the canonical font metrics with the same scale

So the system keeps one source of truth for anatomy, while the rendered sample no longer floats independently from the guides.

## Implementation Location

- shared metrics: [anatomy-metrics.ts](/Users/launaymarion/Documents/JEUX_DE_TYPO/09_DEV/08_jeux-de-typo-v2./lib/typography/anatomy-metrics.ts)
- x-height word split: [XHeightWordSplit.tsx](/Users/launaymarion/Documents/JEUX_DE_TYPO/09_DEV/08_jeux-de-typo-v2./components/typography/XHeightWordSplit.tsx)
- glyph anatomy split: [MeasuredGlyphSplit.tsx](/Users/launaymarion/Documents/JEUX_DE_TYPO/09_DEV/08_jeux-de-typo-v2./components/typography/MeasuredGlyphSplit.tsx)
- glyph tester: [TypefaceTester.tsx](/Users/launaymarion/Documents/JEUX_DE_TYPO/09_DEV/08_jeux-de-typo-v2./components/typography/TypefaceTester.tsx)

## Duplication Rule

Any future anatomy screen should:

- reuse `measureFontMetrics`
- reuse `getStageFrame`
- reuse `projectSampleToFrame`
- reuse `projectSamplesToFrame` when sizing against a set
- add only feature-specific annotations on top

Do not create a new per-component measuring formula unless the panel uses a genuinely different anatomical frame.
