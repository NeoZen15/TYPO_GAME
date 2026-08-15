// The shape every end-of-session page is rendered from, whatever the mode.
//
// WHY A SHAPE AND NOT A COMPONENT PER MODE. The three modes do not measure the
// same thing: competition has a score and a clock, training has neither and says
// so in its own rules, and it alone moves mastery. Duplicating the page per mode
// would make three files that look alike on the day they are written and drift
// apart after that, which is exactly the mistake this project already made once
// with the art direction. So the frame is one component, and each mode ships a
// pure function that translates its own session summary into this shape.
//
// Adding a mode means writing one of those functions. It never means touching
// the page.

export type RecapFigure = {
  value: string;
  label: string;
};

export type RecapKpi = {
  key: string;
  value: string;
  label: string;
  helper: string;
};

/** One line of the right-hand panel. Empty cells are simply not rendered. */
export type RecapRow = {
  key: string;
  /** Small pill on the left. Category in competition, nothing in training. */
  chip: string;
  detail: string;
  /** Right-aligned figure. A response time, a count. */
  value: string;
  /** Faint trailing note. The word that was shown, a category. */
  aside: string;
};

export type RecapPanel = {
  title: string;
  /** Shown as the arena tag when set. */
  tag?: string;
  /** Up to three headline figures. */
  figures?: RecapFigure[];
  /** Secondary figures under a rule, qualifying the ones above. */
  foot?: RecapFigure[];
  rows?: RecapRow[];
  /** Printed when there is nothing to list. */
  empty?: string;
};

export type RecapView = {
  kicker: string;
  title: string;
  lede: string;
  kpis: RecapKpi[];
  left: RecapPanel;
  right: RecapPanel;
};

/**
 * Human label for a typeface slug.
 *
 * Training's confusions carry slugs where competition's misses carry display
 * names, because they come from different tables. Rather than make the page
 * handle two vocabularies, the training adapter turns the slug into a label
 * here. Imperfect on purpose: "eb-garamond" becomes "Eb Garamond", not "EB
 * Garamond". Getting the real name means a catalogue read the client does not
 * have, so this stays a display convenience, never a source of truth.
 */
export const labelFromSlug = (slug: string) =>
  slug
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
