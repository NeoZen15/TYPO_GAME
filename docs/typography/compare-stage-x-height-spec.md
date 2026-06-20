# Compare Stage `x-height` Spec

## Problem

The current `split + word + x-height` stage looks technical but does not produce a usable visual proof.
Users see two words and a neutral grid, but they do not understand where to look or why the x-height is different.

## Goal

Turn the `x-height` stage into an editorial anatomy plate that teaches one thing immediately:

- where the lowercase body sits
- where the baseline is
- where the x-height is
- which typeface pushes that lowercase body higher

The stage must remain readable without relying on the explanatory paragraph below it.

## Success Criteria

- In the first 2 seconds, users can identify `baseline` and `x-height`.
- The lowercase body is visible as a band, not as an abstract concept.
- Helvetica Neue and Inter can be compared without mentally reconstructing the heights.
- The stage feels closer to a typographic anatomy reference than to a generic grid overlay.

## Visual Rules

- Keep only the lines that teach something.
- Use `x-height` as the primary guide line.
- Use `baseline` as the second strongest guide line.
- Keep `cap height` and `descender` subtle.
- Add a tinted band between `x-height` and `baseline`.
- Keep the word large, but anchor it to the baseline so it reads as a constructed specimen.
- Put labels at the edge of the pane, not in the middle of the word.
- Add one short callout only: `lowercase body`.

## What To Remove

- The generic horizontal guide system that is identical for every feature.
- Decorative lines with no label or teaching role.
- Any anatomy callout that is not directly tied to x-height.
- Any pseudo-measurement wording that suggests precision without a useful reading.

## Implementation Notes

- Build a dedicated component for `xHeight + word + split`.
- Measure the panel with `ResizeObserver`.
- Use canvas text metrics to estimate:
  - `capHeight` from `H`
  - `xHeight` from `x`
  - `descender` from `p`
  - word width from the comparison word
- Render the specimen as SVG text so the guides and the word live in the same coordinate system.
- Draw:
  - background band between `x-height` and `baseline`
  - `cap height` line
  - `x-height` line
  - `baseline` line
  - optional `descender` line
  - one callout line and label for `lowercase body`

## Copy Rules

- Labels must stay short and anatomical:
  - `CAP HEIGHT`
  - `X-HEIGHT`
  - `BASELINE`
  - `DESCENDER`
  - `LOWERCASE BODY`
- Do not explain the concept inside the pane with long prose.
- Let the pane demonstrate. Let the paragraph below confirm.

## QA Checklist

- The x-height line is visually stronger than cap height and descender.
- The band is visible in both dark and light themes.
- The word sits cleanly on the baseline.
- The labels do not collide with the word.
- The Inter pane visibly shows a taller lowercase zone than Helvetica Neue.
- The stage still works responsively on a smaller viewport.
