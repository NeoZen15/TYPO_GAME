# Compare Stage `terminals` Spec

## Problem

Terminal differences are easy to lose when the glyph is treated as a whole. The user needs to understand where the stroke ends and what tone that ending gives to the shape.

## Goal

Make the `terminals` stage read like an end-of-stroke anatomy plate:

- identify the main terminal first
- show a secondary ending cut if useful
- keep the rest of the glyph quiet

## Primary Truth

The stage should answer: how does the stroke finish here?

## Visual Rules

- Use a minimal structure: `cap height`, `x-height` zone, `baseline`.
- Place the primary marker on the most expressive ending.
- Use the secondary marker only to confirm the same logic elsewhere.
- Favor asymmetry in composition if that makes the ending easier to read.

## Mandatory Labels

- `TERMINAL`
- `ENDING CUT`
- `BASELINE`

## What To Avoid

- Treating terminals as a height problem.
- Marking too many endings at once.
- Centering the attention on the full glyph instead of its exit points.

## QA

- The user can locate the featured ending immediately.
- The secondary ending reinforces the same typographic tone.
- The labels stay outside the core silhouette of the glyph.
