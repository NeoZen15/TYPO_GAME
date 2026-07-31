// Descriptor for a single runtime face, carried by a game question so the client
// can inject its @font-face just before the face is shown.
//
// This module holds a TYPE and nothing else, on purpose: a client component can
// import it freely, while the runtime catalog that produces these descriptors is
// server-only (it parses an 800 kB asset manifest that has no business in a
// browser bundle).
export type GameFontFace = {
  family: string;
  src: string;
  weight: number;
  style: string;
};
