import type { GameFontFace } from "@/lib/game/fonts/contracts";

// Types shared by the catalogue reader and the composer, and nothing else.
//
// This module holds TYPES ONLY, on purpose, for the same reason
// lib/game/fonts/contracts.ts does: the reader that produces these rows is
// server-only (it parses a 3.4 MB catalogue), while the composer that consumes
// them is a client component. A type crosses that boundary, a module does not.

/** One face, trimmed to what a picker and a specimen need. */
export type PickableFace = {
  slug: string;
  name: string;
  category: string;
  subCategory: string;
  /** Faces sharing this are the ones that get mixed up. Measured in the files. */
  cluster: string;
  difficulty: string;
  rarity: string;
  /** The CSS value to put on the specimen element, and nothing else. */
  fontFamily: string;
  /** Null for an Adobe face: its family is already declared by the stylesheet. */
  fontFace: GameFontFace | null;
};

/** A branch of the family tree: what a teacher points at when he says "serif". */
export type FaceScope = {
  kind: "category" | "subcategory";
  key: string;
  label: string;
  /**
   * The branch a leaf belongs to, and it is not decoration: `didone` exists
   * under serif (50 faces), sans serif (1), display (1) and mono (1). A chip
   * that says only "Didone" names four different things.
   */
  parent?: string;
  count: number;
};

/** The tree the composer shows on arrival. */
export type FaceTree = { scope: FaceScope; children: FaceScope[] }[];
