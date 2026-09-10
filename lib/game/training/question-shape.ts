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
  // Profil de contraste et d'ouverture, depuis typefaces_core. Optionnels comme
  // rarity_tag et pour la meme raison : les appelants synthetiques des gardes
  // construisent une ligne sans passer par la base. Ils ne servent qu'au palier
  // le plus fin, ou "micro variations d'ouverture et de contraste" est
  // litteralement ce que la spec moteur demande.
  contrast_profile?: string;
  aperture_profile?: string;
  // Notoriete, depuis typefaces_core.rarity_tag (migration 013). La colonne est
  // NOT NULL en base (db/migrations/002_catalog_tables.sql), donc une ligne reelle
  // porte toujours une valeur, migration 013 appliquee ou non. Optionnel ici pour
  // les appelants synthetiques, les tests notamment, qui construisent une ligne
  // sans passer par la base et peuvent l'omettre : absent vaut common, donc le tri
  // reste neutre pour eux.
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

// UNE JUMELLE NE PEUT PAS ETRE UN LEURRE. Noto Sans JP, KR, SC et TC dessinent le
// latin a l'identique : proposer l'une comme bonne reponse et l'autre comme leurre
// fait une question sans reponse, ou le joueur ne peut que deviner. La liste et la
// facon dont elle a ete etablie sont dans lib/game/twin-guard.ts.
//
// LE TEST ARRIVE EN PARAMETRE, IL N'EST PAS IMPORTE ICI. Node charge ce fichier tel
// quel dans check:answer-position, pour rejouer la chaine de question et verifier
// que la bonne reponse ne tombe pas toujours au meme bouton. Node ne resout ni
// l'alias "@/" ni un import relatif sans extension : tout import de runtime rendrait
// ce garde la aveugle, ce que CLAUDE.md interdit explicitement. Essaye et constate.
// Le module reste donc pur, et c'est l'appelant qui fournit le test.
//
// LE REPLI EXISTE ET IL EST VOULU. Un pool d'entrainement peut etre petit, une
// trentaine de polices au depart, et rien ne garantit qu'il reste trois leurres une
// fois les jumelles retirees. On complete alors avec les jumelles ecartees plutot
// que de rendre moins de quatre boutons : une question difficile vaut mieux qu'un
// ecran casse.
export type SontJumelles = (correctSlug: string, otherSlug: string) => boolean;

const JAMAIS_JUMELLES: SontJumelles = () => false;

const withoutTwins = <Row extends QuestionShapeRow>(
  others: Row[],
  correct: QuestionShapeRow,
  sontJumelles: SontJumelles
): Row[] => {
  const clean = others.filter(
    (row) => !sontJumelles(correct.typeface_slug, row.typeface_slug)
  );
  if (clean.length >= 3) {
    return clean;
  }
  const removed = others.filter(
    (row) => !clean.some((kept) => kept.typeface_slug === row.typeface_slug)
  );
  return [...clean, ...removed];
};

/**
 * A quel point les mauvaises reponses ressemblent a la bonne.
 *
 * LES QUATRE CRANS DE LA SPEC MOTEUR, ENFIN EXPRIMABLES. « La difficulte du QCM
 * augmente uniquement par la similarite visuelle des mauvaises reponses », et son
 * palier le plus bas demande « des mauvaises reponses tres contrastees et issues
 * de categories differentes ». Ce palier n'existait pas dans ce fichier : les
 * trois paliers pilotes par le mastery PREFERAIENT tous les faces les plus
 * proches et ne faisaient que reponderer la categorie contre le cluster. Un cran
 * « accessible » ne se fabrique pas en preferant moins la proximite, il se
 * fabrique en la PENALISANT, ce que fait 'far' ci dessous.
 *
 *   far     hors categorie, contraste oppose        (Accessible)
 *   family  meme grande famille, cluster different  (Balanced)
 *   cluster meme cluster visuel                     (Challenging)
 *   micro   meme cluster, ouverture et contraste voisins (Expert)
 *
 * C'est le professeur qui choisit ce cran pour un devoir (spec de creation
 * d'exercice, section 13). En entrainement personnel, personne ne le choisit :
 * le parametre est absent et le comportement reste exactement celui d'avant,
 * pilote par le mastery de la face demandee.
 */
export type Proximity = "far" | "family" | "cluster" | "micro";

export const pickDistractors = <Row extends QuestionShapeRow>(
  pool: Row[],
  correct: QuestionShapeRow,
  globalQIndex: number,
  seed: string,
  sontJumelles: SontJumelles = JAMAIS_JUMELLES,
  /**
   * Absent en entrainement personnel, ou le mastery decide. Present pour un
   * devoir, ou le contrat decide et ou deux eleves du meme cran doivent recevoir
   * la meme difficulte de leurres.
   */
  proximity?: Proximity
): Row[] => {
  const others = withoutTwins(
    pool.filter((row) => row.typeface_slug !== correct.typeface_slug),
    correct,
    sontJumelles
  );

  return others
    .map((row) => {
      let score = 1000;
      const sameCategory = row.primary_category === correct.primary_category;
      const sameCluster = row.visual_cluster_id === correct.visual_cluster_id;

      if (proximity) {
        // LE SIGNE COMPTE PLUS QUE LA VALEUR. Le plus petit score gagne, donc un
        // malus ecarte et un bonus rapproche. 'far' est le seul des quatre a
        // ecarter, et c'est exactement ce qui manquait.
        if (proximity === "far") {
          score += sameCategory ? 300 : 0;
          score += sameCluster ? 400 : 0;
          // Contraste oppose quand la ligne le porte : deux faces de contraste
          // different se distinguent d'un coup d'oeil, ce qui est le but du cran.
          if (
            correct.contrast_profile !== undefined &&
            row.contrast_profile !== undefined &&
            row.contrast_profile !== correct.contrast_profile
          ) {
            score -= 120;
          }
        } else if (proximity === "family") {
          score -= sameCategory ? 250 : 0;
          score += sameCluster ? 200 : 0;
        } else if (proximity === "cluster") {
          score -= sameCategory ? 150 : 0;
          score -= sameCluster ? 350 : 0;
        } else {
          score -= sameCategory ? 150 : 0;
          score -= sameCluster ? 450 : 0;
          if (
            correct.contrast_profile !== undefined &&
            row.contrast_profile === correct.contrast_profile
          ) {
            score -= 120;
          }
          if (
            correct.aperture_profile !== undefined &&
            row.aperture_profile === correct.aperture_profile
          ) {
            score -= 80;
          }
        }

        score += hashScore(seed, globalQIndex, row.typeface_slug) % 97;

        return { row, score };
      }

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
