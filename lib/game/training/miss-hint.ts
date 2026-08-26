// ---------------------------------------------------------------------------
// Ce qu'il fallait regarder, quand le joueur s'est trompé.
//
// POURQUOI. Une erreur est le seul instant où le joueur est vraiment attentif à
// la forme. Lui répondre « Incorrect. Try again. » gâche cet instant : il sait
// déjà qu'il s'est trompé, ce qu'il ne sait pas c'est OÙ il aurait dû regarder.
//
// SUR QUOI ÇA S'APPUIE. Chaque police du catalogue porte une signature de onze
// traits (`structural_signature_json`, migration 002), remplie sur les 1279
// polices jouables sans un seul trou. Comparer la signature de la police
// choisie et celle de la bonne réponse donne le trait qui les sépare.
//
// CE QUE ÇA NE PEUT PAS FAIRE, mesuré avant d'écrire une ligne. Sur les 44 497
// paires de polices d'un même groupe visuel, seules 35 pour cent diffèrent par
// au moins un de ces onze traits : la signature est une classification
// éditoriale grossière, deux polices visiblement distinctes peuvent la
// partager entièrement. La fonction rend donc `null` sans forcer, et l'appelant
// retombe sur le message générique. Promettre une leçon qu'on ne peut pas
// tenir serait pire que de se taire.
//
// Le cas « aucune réponse possible » est traité ailleurs et avant : le garde de
// jumelles (`lib/game/twin-guard.ts`) empêche deux polices au dessin latin
// identique de sortir dans la même manche.
//
// Sans import de runtime, pour rester testable directement.
// ---------------------------------------------------------------------------

export type Signature = Record<string, unknown> | null | undefined;

export type MissHintFace = {
  displayName: string;
  signature: Signature;
};

// L'ordre EST la décision : le premier trait qui diffère est celui qu'on
// nomme. Il va du plus visible d'un coup d'œil au plus subtil, pour qu'un
// débutant reçoive « regarde les empattements » plutôt que « regarde l'axe ».
// `fixed_width`, `caps_only` et `distinctive_w` sont exclus : ce sont des
// propriétés de la fonte, pas des endroits où poser le regard.
// Réordonné le 2026-08-26 après mesure : avec `x_height` en troisième position
// il portait la moitié des phrases, parce qu'il n'a que deux valeurs et sépare
// donc presque n'importe quelle paire. Une aide qui dit toujours la même chose
// n'apprend plus rien, et la hauteur d'x est en plus le repère le moins précis
// à montrer. Il descend au rang de dernier recours, derrière les traits qu'un
// typographe nommerait vraiment en premier.
const TRAIT_ORDER = [
  "serifs",
  "a_type",
  "terminals",
  "e_aperture",
  "contrast",
  "width",
  "x_height",
  "axis",
] as const;

// Où regarder, en une expression. Le mot doit nommer un endroit de la lettre,
// pas une catégorie de classification.
const WHERE: Record<string, string> = {
  serifs: "the serifs",
  a_type: "the a",
  x_height: "the x-height",
  terminals: "the terminals",
  width: "the width",
  contrast: "the thick to thin",
  e_aperture: "the e",
  axis: "the stress",
};

// Le vocabulaire complet des valeurs, relevé sur les 1279 polices jouables le
// 2026-08-26. Une valeur absente d'ici fait renoncer la fonction plutôt que
// d'afficher du snake_case au joueur.
const SAYS: Record<string, Record<string, string>> = {
  serifs: {
    bracketed: "bracketed serifs",
    hairline: "hairline serifs",
    present: "serifs",
    slab: "slab serifs",
  },
  a_type: {
    double_storey: "a two storey a",
    single_storey: "a single storey a",
  },
  x_height: {
    large: "a large x-height",
    medium: "a medium x-height",
  },
  terminals: {
    cut_horizontal: "flat cut terminals",
    cut_oblique: "obliquely cut terminals",
    rounded: "rounded terminals",
    slab: "slab terminals",
  },
  width: {
    condensed: "a condensed width",
    normal: "a normal width",
  },
  contrast: {
    low: "little contrast",
    medium: "medium contrast",
    high: "high contrast",
    very_high: "very high contrast",
  },
  e_aperture: {
    open: "an open e",
    semi_open: "a half open e",
    closed: "a closed e",
  },
  axis: {
    vertical: "a vertical stress",
    slightly_inclined: "a leaning stress",
  },
};

const read = (signature: Signature, trait: string): string | null => {
  if (!signature) return null;
  const raw = signature[trait];
  if (raw === null || raw === undefined) return null;
  return SAYS[trait]?.[String(raw)] ?? null;
};

/**
 * La phrase à montrer après une erreur, ou `null` quand les deux signatures ne
 * se séparent sur aucun trait nommable.
 *
 * Elle nomme l'endroit, puis ce que chaque police y fait, dans cet ordre : le
 * joueur doit d'abord savoir où poser les yeux, ensuite quoi y voir.
 */
export const buildMissHint = (
  chosen: MissHintFace,
  correct: MissHintFace
): string | null => {
  for (const trait of TRAIT_ORDER) {
    const a = read(chosen.signature, trait);
    const b = read(correct.signature, trait);
    if (!a || !b || a === b) continue;

    return `Look at ${WHERE[trait]}. ${chosen.displayName} has ${a}, ${correct.displayName} has ${b}.`;
  }

  return null;
};
