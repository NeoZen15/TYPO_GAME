// Latin coverage guard. Single source of truth for "can a player read the word
// this typeface is asked to draw".
//
// Measured, not supposed: of the 1172 servable typefaces (activation_status true
// plus a ready primary runtime asset), 36 carry none of the 52 basic Latin
// letters A to Z and a to z. They are Devanagari, Khmer, Tamil, Arabic, Myanmar,
// Bengali, Sinhala, Thai, Lao, emoji and other non Latin faces, and the
// catalogue files all of them as sans_serif or serif, which says nothing useful
// about a Devanagari or an emoji face.
//
// Why this matters to a player: the game draws a Latin word and asks which
// typeface draws it. When one of the 36 comes out as the correct answer, the
// browser silently falls back to another font, so the question asks the player
// to recognise a typeface that is not on screen. That was about 3,1 per cent of
// correct answer draws.
//
// Enforced in the data access layer, inside the same two pool queries as the
// licence guard, because those are the only two reads that decide which
// typefaces a player can be served (correct answer and distractors alike):
//   lib/game/training/provider.ts     getPoolRows
//   lib/game/competition/provider.ts  getCompetitionPoolRows
// A filter applied when the word is rendered would be a filter somebody can
// route around, and it would still let a face reach the four options.
//
// These 36 stay in the catalogue and keep their runtime asset. They stop being
// playable, nothing else changes. Reclassifying them, or showing them one day in
// their own script, is a data decision for the project owner.
//
// Kept in sync with the font files by scripts/quality/check-latin-coverage.mjs,
// which reopens every served asset with fontkit and fails both ways: a slug on
// this list that now covers Latin, and a slug off this list that does not.

export const LATIN_UNREADY_SLUGS = [
  "aksarabaligalang",
  "hannari",
  "karlatamilinclined",
  "karlatamilupright",
  "khmer",
  "kokoro",
  "lohitbengali",
  "lohitdevanagari",
  "lohittamil",
  "myanmarsanspro",
  "nikukyu",
  "notoemoji",
  "notonaskharabicui",
  "notosansarabicui",
  "notosansbengaliui",
  "notosansdevanagariui",
  "notosansgujaratiui",
  "notosansgurmukhiui",
  "notosanskannadaui",
  "notosanskhmerui",
  "notosanslaoui",
  "notosansmalayalamui",
  "notosansmyanmarui",
  "notosansnko_todelist",
  "notosansoriyaui",
  "notosanssharada",
  "notosanssinhalaui",
  "notosanstamilui",
  "notosansteluguui",
  "notosansthaiui",
  "notoserifmyanmar",
  "notoserifnyiakengpuachuehmong",
  "phetsarath",
  "siemreap",
  "sitara",
  "souliyo",
] as const;

// Same decision as the SQL clause, for anything that has already loaded a row
// (catalogue checks, future specimen pages).
export const isLatinCoverageCleared = (typefaceSlug: string): boolean =>
  !(LATIN_UNREADY_SLUGS as readonly string[]).includes(typefaceSlug);
