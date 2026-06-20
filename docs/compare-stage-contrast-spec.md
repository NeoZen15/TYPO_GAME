# Compare Stage `contrast` Spec

## Problem

If the contrast stage only shows a glyph with labels, the user still does not feel the difference in stroke tension. The visual proof must isolate where the stroke thickens and where it relaxes.

## Goal

Turn the `contrast` stage into a tension map:

- identify one heavier zone
- identify one lighter return
- keep the structure minimal so the eye compares stroke energy, not layout noise

## Primary Truth

The user should understand where the stroke gains weight and where it releases it.

## Visual Rules

- Use only a few guides: `cap height`, `stress zone`, `baseline`.
- Make the thicker stroke marker the primary accent.
- Make the lighter return secondary but still readable.
- Prefer one strong diagonal or curve tension over multiple weak annotations.

## Mandatory Labels

- `HEAVIER STROKE`
- `LIGHTER RETURN`
- `BASELINE`

## What To Avoid

- A generic `STROKE` label with no local proof.
- Too many markers competing at the same level.
- Using equal emphasis on thick and thin if one should lead the reading.

## QA

- The user sees the thick/thin contrast before reading the caption.
- The two annotations describe a tension pair, not two unrelated spots.
- The stage remains legible even for narrow glyphs.
