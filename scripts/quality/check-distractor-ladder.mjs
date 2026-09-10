// ============================================================================
// check:distractor-ladder
//
// POURQUOI CE GARDE EXISTE. « La difficulte du QCM augmente uniquement par la
// similarite visuelle des mauvaises reponses » est une regle de la spec moteur, et
// c'est la seule chose que le cran d'exigence d'un devoir traduit. Mesure le
// 2026-09-10 : les trois paliers historiques de pickDistractors PREFERAIENT tous
// les faces les plus proches et ne faisaient que reponderer la categorie contre le
// cluster. Le palier bas de la spec, « mauvaises reponses tres contrastees et
// issues de categories differentes », n'existait pas dans le code.
//
// Un cran accessible ne se fabrique pas en preferant moins la proximite : il se
// fabrique en la PENALISANT. Ce garde exerce la vraie fonction sur des pools
// synthetiques et verifie que les quatre crans produisent bien quatre questions
// differentes, plus qu'un devoir n'a PAS change l'entrainement personnel.
//
// Il importe lib/game/training/question-shape.ts directement, Node effacant les
// types, exactement comme check:answer-position. Le module doit donc rester sans
// import de runtime, sinon ce garde devient aveugle.
// ============================================================================

const SHAPE = "../../lib/game/training/question-shape.ts";

const face = (slug, category, cluster, extra = {}) => ({
  typeface_slug: slug,
  mastery_level: 0,
  next_due_after_q: 0,
  primary_category: category,
  visual_cluster_id: cluster,
  difficulty_base: "medium",
  rarity_tag: "common",
  ...extra,
});

// Une bonne reponse, trois voisines de son cluster, trois de sa categorie mais
// d'un autre cluster, et trois franchement ailleurs.
const correct = face("correct", "serif", "cluster_serif_didone_00", {
  contrast_profile: "very_high",
  aperture_profile: "closed",
});

const pool = [
  correct,
  face("cluster_1", "serif", "cluster_serif_didone_00", { contrast_profile: "very_high", aperture_profile: "closed" }),
  face("cluster_2", "serif", "cluster_serif_didone_00", { contrast_profile: "medium", aperture_profile: "open" }),
  face("cluster_3", "serif", "cluster_serif_didone_00", { contrast_profile: "very_high", aperture_profile: "open" }),
  face("family_1", "serif", "cluster_serif_slab_00", { contrast_profile: "low" }),
  face("family_2", "serif", "cluster_serif_old_style_00", { contrast_profile: "medium" }),
  face("family_3", "serif", "cluster_serif_transitional_00", { contrast_profile: "medium" }),
  face("far_1", "sans_serif", "cluster_sans_serif_humanist_02", { contrast_profile: "low" }),
  face("far_2", "mono", "cluster_mono_sans_A", { contrast_profile: "low" }),
  face("far_3", "display", "cluster_display_condensed_A", { contrast_profile: "low" }),
];

const failures = [];
const summary = [];

const { pickDistractors } = await import(SHAPE).catch((error) => {
  console.error(
    `check:distractor-ladder n'a pas pu importer ${SHAPE} : ${error.message}. ` +
      "Le module doit rester sans import de runtime pour que Node puisse en effacer les types."
  );
  process.exit(1);
});

// Plusieurs graines, parce qu'un seul tirage peut passer par chance : le jitter
// de hachage vaut moins de 97 et ne doit jamais renverser un palier.
const seeds = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

const draw = (proximity) =>
  seeds.map((seed) => pickDistractors(pool, correct, 0, seed, undefined, proximity).map((r) => r.typeface_slug));

const sameCluster = (slug) => slug.startsWith("cluster_");
const sameCategoryOnly = (slug) => slug.startsWith("family_");
const elsewhere = (slug) => slug.startsWith("far_");

for (const [proximity, predicate, expectation] of [
  ["far", elsewhere, "aucun leurre du cluster ni de la categorie de la bonne reponse"],
  ["cluster", sameCluster, "les trois leurres du meme cluster visuel"],
  ["micro", sameCluster, "les trois leurres du meme cluster visuel"],
]) {
  const draws = draw(proximity);
  const bad = draws.filter((picks) => !picks.every(predicate));
  summary.push(`${proximity} : ${draws.length - bad.length}/${draws.length} tirages conformes`);
  if (bad.length > 0) {
    failures.push(
      `le cran '${proximity}' devrait donner ${expectation}, et ${bad.length} tirage(s) sur ${draws.length} ne le font pas : ` +
        `${JSON.stringify(bad[0])}.`
    );
  }
}

// 'family' veut la meme grande famille SANS le cluster : c'est le seul cran dont
// la cible est un entre deux, donc celui qu'une reponderation cassee traverse.
const familyDraws = draw("family");
const familyBad = familyDraws.filter((picks) => !picks.every(sameCategoryOnly));
summary.push(`family : ${familyDraws.length - familyBad.length}/${familyDraws.length} tirages conformes`);
if (familyBad.length > 0) {
  failures.push(
    `le cran 'family' devrait donner trois leurres de la meme categorie mais d'un autre cluster, et ` +
      `${familyBad.length} tirage(s) sur ${familyDraws.length} ne le font pas : ${JSON.stringify(familyBad[0])}.`
  );
}

// 'far' contre 'cluster' : deux crans qui rendraient la meme question ne
// serviraient a rien, et c'est le defaut exact que ce garde protege.
const farFirst = draw("far")[0].join(",");
const clusterFirst = draw("cluster")[0].join(",");
if (farFirst === clusterFirst) {
  failures.push(
    "les crans 'far' et 'cluster' produisent la meme question : le palier n'est pas branche."
  );
}

// ET L'ENTRAINEMENT PERSONNEL NE DOIT PAS AVOIR BOUGE. Sans cran, le mastery
// decide, et le comportement historique prefere la proximite.
const legacy = pickDistractors(pool, { ...correct, mastery_level: 4 }, 0, "s1").map((r) => r.typeface_slug);
if (!legacy.every(sameCluster)) {
  failures.push(
    `sans cran, une face maitrisee doit toujours recevoir ses voisines de cluster comme avant, et elle recoit ${JSON.stringify(legacy)}.`
  );
}
summary.push("sans cran : comportement historique inchange");

if (failures.length > 0) {
  console.error("check:distractor-ladder a echoue.\n");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`check:distractor-ladder OK : ${summary.join(" · ")}.`);
