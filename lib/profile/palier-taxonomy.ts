// Heuristic typeface → palier mapping ("amorçage" of the eye constellation).
//
// IMPORTANT: this is NOT the real pedagogical taxonomy. The true mapping of
// "which typefaces teach which perceptual palier" does not exist yet in the
// codebase (the engine's selectNextChallenge is still pseudo-code, see
// docs/game/scoring-and-selection-math.md §8). Until it exists, we light only
// the paliers that map cleanly onto attributes ALREADY in typefaces_core
// (primary_category, sub_category, aperture_profile, contrast_profile). Every
// other palier stays dormant — honestly "not measurable yet" rather than faked.
//
// Each predicate decides whether a given typeface counts toward that palier's
// real accuracy + mastered totals (computed from the player's events/state).

export type TypefaceAttrs = {
  primary: string; // primary_category: sans_serif | serif | mono | display
  sub: string; // sub_category: neo_grotesk | humanist | geometric | ... | script
  aperture: string; // aperture_profile: open | semi_open | closed
  contrast: string; // contrast_profile: low | medium | high | very_high
};

type PalierPredicate = (attrs: TypefaceAttrs) => boolean;

// Keyed by palier id (see MOCK_EYE in mock-profile.ts). Only the derivable
// subset is listed; absent ids => dormant.
export const PALIER_TAXONOMY: Record<string, PalierPredicate> = {
  // Axis 2 — Seeing Families (the family signal is fully in the catalog)
  "2.1": (a) => a.primary === "serif" || a.primary === "sans_serif", // Serif or sans
  "2.2": (a) => a.primary === "mono", // Monospace
  "2.3": (a) => a.sub === "script", // Script
  "2.4": (a) => a.primary === "display", // Text or display
  "2.5": (a) => a.primary === "serif", // Serif class
  "2.6": (a) => a.primary === "sans_serif", // Sans class

  // Axis 3 — Seeing Structure (only the two attributes we actually store)
  "3.1": (a) => a.aperture === "open" || a.aperture === "closed", // Aperture (distinctive)
  "3.2": (a) => a.contrast === "low" || a.contrast === "high" || a.contrast === "very_high", // Contrast
};

export const isPalierDerivable = (palierId: string): boolean =>
  palierId in PALIER_TAXONOMY;
