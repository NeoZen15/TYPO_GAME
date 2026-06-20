# Compare Stage `aperture` Spec

## Problem

The current glyph comparison can mention `aperture`, but if the opening is not visually isolated the user still reads the glyph globally and misses the actual entry point of the eye.

## Goal

Turn the `aperture` stage into a local anatomy proof:

- show where the opening lives
- show the counter as a secondary supporting shape
- keep the reading centered on one side of the glyph, not the whole glyph equally

## Primary Truth

The user should immediately understand where the form opens and whether that opening is tighter or looser.

## Visual Rules

- Use only `cap height`, `x-height` and `baseline` as structural guides.
- Treat `x-height` as a reading band, not as the hero.
- Put the primary focus on the opening edge.
- Use the counter only as a secondary confirmation.
- Keep the glyph huge and centered.
- Use a single highlight color.

## Mandatory Labels

- `APERTURE`
- `COUNTER`
- `BASELINE`

## What To Avoid

- Generic circles with no clear relation to the opening.
- Over-annotating both sides of the glyph equally.
- Using too many horizontal guides.

## QA

- The opening can be identified before reading the label.
- The secondary counter marker does not compete with the aperture marker.
- The feature still reads on narrow viewports.
