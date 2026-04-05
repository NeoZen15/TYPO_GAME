# Type Page Calibration

This document defines the calibration rules for `/type/[slug]`.

The goal is not to make a pretty isolated page.
The goal is to define one strict master page that can later be multiplied across the typography system.

## Principles

- Keep the existing DWIGGINS visual language: soft surfaces, boxes, editorial atmosphere.
- Increase technical authority through composition, not through visual noise.
- Let the typeface dominate the page.
- Make every block feel structural, not decorative.
- Build the page on a repeatable grid.

## Grid

- The page shell uses a 12-column grid.
- All main page blocks span the full shell width.
- Each section uses the same internal rule:
  - columns `1-2`: section label / section title
  - columns `3-12`: content field
- On tablet and mobile, this collapses to one column.

## Specimen Discipline

- The main specimen word must never produce absurd orphan breaks.
- The specimen is allowed to wrap on small screens only.
- The specimen word should use a stable typographic test word.
- Default test word: `Hamburgefonstiv`
- Desktop sizing must be calibrated from word length, not by hand per page.
- The same scaling rule must protect:
  - hero specimen
  - visual-control main specimen
  - weight rail samples

## Hierarchy

- Hero first: identity and specimen.
- Observation second: reading, signs, quick cues.
- Analysis third: structural features.
- System record fourth: metadata and operational role.
- Comparison gateway fifth: route toward related typefaces and comparison pages.

## Visual Rules

- Boxes are used to structure reading, not to fill space.
- Borders and panel surfaces must align with the grid.
- Labels should be compact, quiet, and consistent.
- Large type moments should sit on clear horizontal rules or spatial bands.
- No random centering, no arbitrary widths, no accidental line breaks.

## DA Guardrails

- Reuse the canonical site radii only:
  - `--radius-pill`
  - `--radius-card`
  - `--radius-shell`
- Keep chip geometry aligned with the rest of the site:
  - same pill height family
  - same uppercase rhythm
  - same border and surface softness
- Keep section padding in one cadence.
- Avoid one-off button or rectangle variants on `/type/[slug]`.
- The page can become more technical, but never by inventing a second DA.

## Reuse

- Any future `/type/[slug]` page should reuse this exact composition logic.
- Any divergence should be intentional and documented.
