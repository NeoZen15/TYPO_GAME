# Gate

The Gate is the single-page scroll sequence that introduces the typographic experience.

Structure:
- `block-1`: centered `LOOK CLOSER` hero on black, animated with a two-layer threshold morph loop.
- `block-2`: dark section with morphing title layers plus line-by-line paragraph reveal.
- `block-3`: binary choice panel with evasive "Not now" interaction.
- `block-4`: rotating typographic reel with viewport-aware activation.
- `block-5`: letterform lockup with scroll-driven construction-guide drawing.

Behavior constraints:
- ScrollTriggers, timings, and easing values are part of the intended UX and should not be changed in cleanup tasks.
- Layout-affecting wrappers, class names, and section ordering are considered front-facing contracts.
