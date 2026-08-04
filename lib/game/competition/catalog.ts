import "server-only";

import { TRAINING_WORD_POOL } from "@/lib/game/training/catalog";

// Competition question material.
//
// Font resolution used to live here, with its own copy of the runtime manifest
// lookup and its own local-family table. It now lives in
// lib/game/fonts/runtime-catalog, the single source shared with training, and the
// competition provider calls it directly: no alias, no indirection, so there is
// exactly one place where a face becomes renderable. Nothing about the
// competition behaviour changes, this file was already reading the right
// catalogue, it simply no longer owns the mechanism.
//
// Timing and scoring constants moved to ./constants so the client screen can
// import them without pulling the ~800 kB asset manifest into its bundle.
export * from "@/lib/game/competition/constants";

export const getCompetitionDisplayWord = (seed: string | number, questionIndex: number) => {
  const seedNumber = Number.parseInt(String(seed).slice(-6), 10) || 0;
  const wordIndex = (questionIndex + seedNumber) % TRAINING_WORD_POOL.length;
  return TRAINING_WORD_POOL[wordIndex] ?? TRAINING_WORD_POOL[0];
};

