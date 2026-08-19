import crypto from "node:crypto";

// Pure shape of a training question: which face is asked, which three faces
// stand beside it, and in which order the four buttons come out.
//
// WHY THIS MODULE EXISTS, AND WHY IT STAYS FREE OF RUNTIME IMPORTS. These three
// decisions are the whole of the exercise the player is given, and they are
// decidable with no database, no session and no font. Living inside provider.ts
// they could only be checked by re-implementing them somewhere else, and a
// re-implementation agrees with itself, not with the engine. Here, a guard
// imports this file directly (Node strips the types) and exercises the real
// chain. Keep the imports to node builtins only, or that guard goes blind.

export type QuestionShapeRow = {
  typeface_slug: string;
  mastery_level: number;
  next_due_after_q: number;
  primary_category: string;
  visual_cluster_id: string;
  difficulty_base: string;
  // Notoriete, depuis typefaces_core.rarity_tag (migration 013). Optionnel parce
  // que la migration peut ne pas etre appliquee : absent vaut common, donc le tri
  // est neutre et le code marche avant comme apres.
  rarity_tag?: string;
};

const hash = (input: string) =>
  Number.parseInt(
    crypto.createHash("sha256").update(input).digest("hex").slice(0, 8),
    16
  );

// Deterministic per (session, question index, face), so the same question
// always composes the same way. The question token carries the option slugs in
// their display order, so a non reproducible order would break the token.
export const hashScore = (seed: string, globalQIndex: number, slug: string) =>
  hash(`${seed}:${globalQIndex}:${slug}`);

// easy < medium < hard, matching app.difficulty_base_enum order. Used as a
// selection tiebreak so injected easy faces (Stage 4 rebalance, mastery 0)
// surface ahead of harder ties before the per-session seed hash decides.
const DIFFICULTY_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
const difficultyRank = (value: string) => DIFFICULTY_RANK[value] ?? 1;

// common < uncommon < rare. Une notoriete inconnue vaut common, donc neutre.
const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2 };
const rarityRank = (value: string | undefined) => RARITY_RANK[value ?? "common"] ?? 0;

export const pickEligibleTypeface = <Row extends QuestionShapeRow>(
  pool: Row[],
  globalQIndex: number,
  seed: string
): Row | undefined => {
  const eligible = pool.filter((row) => row.next_due_after_q <= globalQIndex);
  const source = eligible.length > 0 ? eligible : pool;

  return [...source].sort((left, right) => {
    if (left.next_due_after_q !== right.next_due_after_q) {
      return left.next_due_after_q - right.next_due_after_q;
    }
    if (left.mastery_level !== right.mastery_level) {
      return left.mastery_level - right.mastery_level;
    }
    if (difficultyRank(left.difficulty_base) !== difficultyRank(right.difficulty_base)) {
      return difficultyRank(left.difficulty_base) - difficultyRank(right.difficulty_base);
    }
    if (rarityRank(left.rarity_tag) !== rarityRank(right.rarity_tag)) {
      return rarityRank(left.rarity_tag) - rarityRank(right.rarity_tag);
    }

    return (
      hashScore(seed, globalQIndex, left.typeface_slug) -
      hashScore(seed, globalQIndex, right.typeface_slug)
    );
  })[0];
};

export const pickDistractors = <Row extends QuestionShapeRow>(
  pool: Row[],
  correct: QuestionShapeRow,
  globalQIndex: number,
  seed: string
): Row[] => {
  const others = pool.filter((row) => row.typeface_slug !== correct.typeface_slug);

  return others
    .map((row) => {
      let score = 1000;

      if (correct.mastery_level <= 1) {
        score -= row.primary_category === correct.primary_category ? 125 : 0;
        score -= row.visual_cluster_id === correct.visual_cluster_id ? 250 : 0;
      } else if (correct.mastery_level === 2) {
        score -= row.primary_category === correct.primary_category ? 225 : 0;
        score -= row.visual_cluster_id === correct.visual_cluster_id ? 175 : 0;
      } else {
        score -= row.primary_category === correct.primary_category ? 325 : 0;
        score -= row.visual_cluster_id === correct.visual_cluster_id ? 350 : 0;
      }

      score += hashScore(seed, globalQIndex, row.typeface_slug) % 97;

      return { row, score };
    })
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((item) => item.row);
};

// A REAL DRAW, NOT A KEYED ORDER. Owner's call, 2026-08-15.
//
// The first version of this fix ordered the buttons by a differently salted
// hash. That removed the defect (the correct answer no longer held the minimum
// key by construction) and measured as uniform, but it stayed a FUNCTION of the
// question: the same question always came out the same way, and anyone able to
// compute the key could predict the slot. A shuffle whose output can be
// computed in advance is not a shuffle, it is an obfuscation.
//
// Nothing needs the order to be reproducible. The question token carries the
// slugs it was built with (`question-token.ts`), and the answer path only asks
// whether the submitted slug is among them, never in which place
// (`payload.options.includes(answerSlug)`). So the order is drawn here, once,
// per question built.
//
// crypto.randomInt rather than Math.random: this decides what a player is
// scored on, and Math.random is neither uniform by contract nor unpredictable.
// Fisher Yates walked downwards, which is the unbiased form. Drawing an index
// per position and hoping for no collision, or sorting on a random comparator,
// are the two classic ways to get a skewed shuffle.
const shuffled = <Row>(rows: Row[]): Row[] => {
  const draw = [...rows];

  for (let index = draw.length - 1; index > 0; index -= 1) {
    const pick = crypto.randomInt(index + 1);
    [draw[index], draw[pick]] = [draw[pick], draw[index]];
  }

  return draw;
};

export const orderOptionsForDisplay = <Row extends QuestionShapeRow>(
  correct: Row,
  distractors: Row[]
): Row[] => shuffled([correct, ...distractors]);
