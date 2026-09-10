// Quelle face un devoir demande a cet eleve, maintenant.
//
// PUR, SANS IMPORT DE RUNTIME, et pour la meme raison que question-shape.ts : ces
// decisions SONT le devoir, et un garde doit pouvoir les exercer pour de vrai
// plutot que relire leur intention. Aucune requete ici, aucune base : l'appelant
// apporte les candidats et l'historique, ce fichier tranche.
//
// LA REGLE QUI GOUVERNE TOUT : l'ensemble jouable vient du CONTRAT et jamais du
// pool personnel de l'eleve (I-21). Une face qui n'est pas dans les candidats
// fournis ne peut pas sortir, quoi qu'ait fait l'eleve par ailleurs.
//
// TROIS DECISIONS, DANS CET ORDRE.
//
//   1. LES FACES IMPOSEES D'ABORD. « Je veux absolument Univers » n'a de sens que
//      si Univers est demandee a chaque eleve. Elles passent donc avant tout, une
//      fois chacune, et ensuite elles rentrent dans le rang.
//   2. PUIS LE MIX, panier par panier. Les parts du contrat disent combien de
//      questions chaque panier merite ; on sert le panier le plus en retard sur sa
//      part. Un panier vide ne bloque rien : sa part se redistribue d'elle meme,
//      puisqu'un panier sans candidat n'est jamais choisi.
//   3. ET JAMAIS DEUX FOIS DE SUITE LA MEME FACE. A l'interieur d'un panier, on
//      prend celle qui a ete demandee le moins souvent dans cette seance, et la
//      graine tranche les egalites pour que deux eleves ne recoivent pas
//      mecaniquement le meme ordre.

/** Les quatre paniers du mix, tels que le contrat les stocke. */
export type Bucket = "consolidation" | "upkeep" | "targeted" | "novelty";

export const BUCKETS: Bucket[] = ["consolidation", "upkeep", "targeted", "novelty"];

/**
 * Une face candidate, telle que l'appelant l'a classee.
 *
 * `bucket` est calcule sur l'HISTORIQUE DES ASSIGNATIONS DE CE PROFESSEUR et
 * jamais sur l'etat personnel de l'eleve : « nouveau » veut dire jamais demande
 * dans vos exercices, pas jamais vu de sa vie. C'est ce qui empeche le mix de
 * devenir une lecture detournee du pool prive.
 */
export type Candidate = {
  slug: string;
  bucket: Bucket;
  /** Nommee par le professeur, donc garantie demandee au moins une fois. */
  imposed: boolean;
};

export type Mix = Record<Bucket, number>;

/** Combien de fois chaque face a deja ete demandee dans CETTE seance. */
export type AskedCount = Record<string, number>;

// Hachage entier, sans import : le meme role que dans question-shape.ts, tranche
// les egalites de facon reproductible pour une graine donnee.
const tiebreak = (seed: string, index: number, slug: string) => {
  let h = 2166136261;
  const input = `${seed}:${index}:${slug}`;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000;
};

/**
 * La prochaine face du devoir, ou null si le contrat n'offre rien.
 *
 * `questionIndex` est le rang de la question dans la seance, en partant de zero.
 */
export const nextFace = (
  candidates: Candidate[],
  mix: Mix,
  asked: AskedCount,
  questionIndex: number,
  seed: string
): Candidate | null => {
  if (candidates.length === 0) return null;

  // 1. Les faces imposees jamais encore demandees, dans l'ordre du contrat.
  const owed = candidates.filter((c) => c.imposed && (asked[c.slug] ?? 0) === 0);
  if (owed.length > 0) return owed[0];

  // 2. Le panier le plus en retard sur sa part, parmi ceux qui ont des candidats.
  const total = Math.max(1, Object.values(asked).reduce((sum, n) => sum + n, 0));
  const servedBy = (bucket: Bucket) =>
    candidates
      .filter((c) => c.bucket === bucket)
      .reduce((sum, c) => sum + (asked[c.slug] ?? 0), 0);

  const wanted = BUCKETS.map((bucket) => {
    const available = candidates.some((c) => c.bucket === bucket);
    if (!available) return { bucket, debt: Number.NEGATIVE_INFINITY };
    const share = (mix[bucket] ?? 0) / 100;
    return { bucket, debt: share - servedBy(bucket) / total };
  })
    .filter((row) => row.debt !== Number.NEGATIVE_INFINITY)
    .sort((left, right) => right.debt - left.debt);

  if (wanted.length === 0) return null;
  const bucket = wanted[0].bucket;

  // 3. Dans ce panier, la moins demandee ; la graine tranche les egalites.
  return candidates
    .filter((c) => c.bucket === bucket)
    .sort((left, right) => {
      const a = asked[left.slug] ?? 0;
      const b = asked[right.slug] ?? 0;
      if (a !== b) return a - b;
      return (
        tiebreak(seed, questionIndex, left.slug) - tiebreak(seed, questionIndex, right.slug)
      );
    })[0] ?? null;
};

/**
 * Le devoir est il fini pour cet eleve ?
 *
 * `resolved` compte les questions REUSSIES, parce qu'en entrainement le curseur
 * n'avance que sur une bonne reponse : l'eleve reprend une question jusqu'a la
 * lire juste. Le budget vient du contrat, jamais d'une constante, et c'est ce que
 * check:session-lifecycle protege depuis la disparition de TRAINING_TOTAL_ROUNDS.
 */
export const isBudgetSpent = (resolved: number, questionCount: number | null) =>
  questionCount !== null && resolved >= questionCount;

/**
 * La fenetre, et elle est verifiee a CHAQUE question, jamais une seule fois a
 * l'ouverture : une seance peut rester ouverte pendant que l'echeance passe.
 */
export const isWindowOpen = (now: number, availableFrom: number, dueAt: number) =>
  now >= availableFrom && now < dueAt;
