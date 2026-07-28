// ---------------------------------------------------------------------------
// Adaptive warm-up data — "A first look".
//
// One round per declared familiarity level, forming a pedagogical difficulty
// ladder. buildRound() in OnboardingWarmup used to ignore familiarity and always
// return the beginner round; this module is the typed data source that makes the
// warm-up adaptive. The component owns rendering and click affordance; this file
// owns only the data.
//
// GROUNDING. Every hero face is a real slug from the catalog manifest
// (content/typefaces/font-manifest-v4.json, surfaced by lib/game/training/catalog).
// We expose `familySlug` + `familyName` (NOT a pre-resolved CSS string) so the
// consumer resolves the font itself with:
//     getTypefaceFontFamily(round.familySlug, round.familyName)
// exactly as the component already does for the beginner round. Keeping slug +
// name (rather than the resolved family) means this module has zero dependency on
// the font runtime and stays a pure data layer.
//
// FIXED SHAPE. Every round has EXACTLY 4 options (the UI renders a fixed 2x2
// grid) and reuses the accent-color scheme #8ea2ff / #67d6b6 / #f5bf6a / #f39ab1
// in that order. Copy is English only.
//
// LADDER
//   "Not at all"     easy category read. A clear serif -> "Serif".
//   "A little"       still a category read, but the answer flips to "Sans-serif"
//                    (a clean geometric sans). Default for empty/unknown input.
//   "Quite familiar" subtler: name the serif sub-style of a textbook Didone.
//   "Designer"       fine distinction between four close neo-grotesque sans by
//                    stroke terminals (the data-backed odd-one-out).
// ---------------------------------------------------------------------------

export type WarmupRound = {
  word: string;
  familySlug: string;
  familyName: string;
  prompt: string;
  options: { key: string; label: string; color: string }[];
  correctIndex: number;
  reveal: string; // plain-language feedback on correct
  ghostWrong: string; // plain-language feedback on wrong
};

// Shared accent-color scheme, applied in this order to the four cards on every
// round (matches the previous BEGINNER_OPTIONS palette).
const CARD_COLORS = ["#8ea2ff", "#67d6b6", "#f5bf6a", "#f39ab1"] as const;

// The four broad categories (levels 1 and 2). Same label set, same order, so the
// step from level 1 to level 2 is purely "which category is it this time?".
const CATEGORY_OPTIONS = [
  { key: "serif", label: "Serif", color: CARD_COLORS[0] },
  { key: "sans_serif", label: "Sans-serif", color: CARD_COLORS[1] },
  { key: "slab_serif", label: "Slab serif", color: CARD_COLORS[2] },
  { key: "script", label: "Script", color: CARD_COLORS[3] },
];

// Serif sub-styles (level 3). Real families of serif; the Didone is the answer.
const SERIF_STYLE_OPTIONS = [
  { key: "old_style", label: "Old-style", color: CARD_COLORS[0] },
  { key: "transitional", label: "Transitional", color: CARD_COLORS[1] },
  { key: "didone", label: "Didone", color: CARD_COLORS[2] },
  { key: "slab_serif", label: "Slab serif", color: CARD_COLORS[3] },
];

// Four close neo-grotesque / grotesque sans (level 4), all real catalog faces.
// Per the manifest structuralSignature, IBM Plex Sans is the odd one out: its
// stroke terminals are cut horizontally (flat), while Roboto, Inter and Work Sans
// cut theirs on the oblique. That flat cut is the fine distinction to spot.
const SANS_FACE_OPTIONS = [
  { key: "ibm_plex_sans", label: "IBM Plex Sans", color: CARD_COLORS[0] },
  { key: "roboto", label: "Roboto", color: CARD_COLORS[1] },
  { key: "inter", label: "Inter", color: CARD_COLORS[2] },
  { key: "work_sans", label: "Work Sans", color: CARD_COLORS[3] },
];

// Canonical familiarity keys (mirror lib/game/training/contracts FAMILIARITY_VALUES).
type Familiarity = "Not at all" | "A little" | "Quite familiar" | "Designer";

const ROUNDS: Record<Familiarity, WarmupRound> = {
  // Level 1 — total beginner. Unchanged beginner content: a clear serif reads as
  // "Serif" just by looking at the little feet. No vocabulary required.
  "Not at all": {
    word: "Reading",
    familySlug: "libre_baskerville",
    familyName: "Libre Baskerville",
    prompt: "What kind of letters are these?",
    options: CATEGORY_OPTIONS,
    correctIndex: 0,
    reveal: "Correct. See the little feet on each letter?",
    ghostWrong: "Not quite. Look at the ends of the strokes.",
  },

  // Level 2 — gentle, but the answer flips. A clean geometric sans has no feet at
  // all, so the read is a clear "Serif or not?" binary inside the same four cards.
  "A little": {
    word: "Layout",
    familySlug: "poppins",
    familyName: "Poppins",
    prompt: "What kind of letters are these?",
    options: CATEGORY_OPTIONS,
    correctIndex: 1,
    reveal: "Right. Even strokes, rounded shapes, and no feet at all.",
    ghostWrong: "Look again. These stroke ends are clean, with no little feet.",
  },

  // Level 3 — subtler. Still a serif, but now name its sub-style. Playfair Display
  // is a textbook Didone: very high contrast plus hairline serifs.
  "Quite familiar": {
    word: "Fashion",
    familySlug: "playfair_display",
    familyName: "Playfair Display",
    prompt: "Which serif style is this?",
    options: SERIF_STYLE_OPTIONS,
    correctIndex: 2,
    reveal: "Yes, a Didone. Note the sharp jump from thick stems to hairline serifs.",
    ghostWrong: "Look at the strokes: thick stems, hairline-thin curves. That points to a Didone.",
  },

  // Level 4 — designer. Four close sans; pick the one set here. The tell is the
  // terminals: IBM Plex Sans cuts its stroke ends flat (horizontal), the others
  // cut on the oblique.
  Designer: {
    word: "Grotesk",
    familySlug: "ibm_plex_sans",
    familyName: "IBM Plex Sans",
    prompt: "Which face is this?",
    options: SANS_FACE_OPTIONS,
    correctIndex: 0,
    reveal: "Correct. See the flat, horizontally cut stroke ends? That is IBM Plex Sans.",
    ghostWrong: "Closer look at the terminals: these are cut flat, not on a slant.",
  },
};

// Default to the "A little" round for empty or unrecognised familiarity, matching
// the onboarding fallback (OnboardingFlow / GameScreen both default to "A little").
const DEFAULT_FAMILIARITY: Familiarity = "A little";

export function getWarmupRound(familiarity: string): WarmupRound {
  if (familiarity in ROUNDS) {
    return ROUNDS[familiarity as Familiarity];
  }
  return ROUNDS[DEFAULT_FAMILIARITY];
}
