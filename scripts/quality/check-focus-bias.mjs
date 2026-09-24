// ============================================================================
// check:focus-bias
//
// POURQUOI CE GARDE EXISTE. Une consigne d'orientation (Allumer, Corriger) doit
// ORIENTER le choix des questions, jamais le RESTREINDRE
// (docs/product/spec-objectifs-joueur.md, section 4). La difference ne se voit
// pas a l'ecran : une consigne qui servirait une face non due, qui biaiserait le
// repli « aucune face due », ou qui changerait la seance ordinaire, donnerait
// toujours une question jouable. Ce garde exerce le vrai module
// lib/game/training/question-shape.ts sur des pools synthetiques et verifie :
//
//   - sans consigne, le choix est celui d'origine, sur au moins 200 couples
//     (graine, index) ;
//   - avec consigne, la face choisie y repond des qu'une face due y repond ;
//   - avec consigne, la face choisie est toujours une face due quand il y en a ;
//   - si aucune face due ne repond, le choix est celui sans consigne, repli
//     compris ;
//   - les leurres privilegies passent parmi les leurres, jamais une jumelle ;
//   - normalizeFocus ignore toute consigne mal formee au lieu de la refuser.
//
// Les deux modules doivent rester sans import de runtime pour que Node puisse en
// effacer les types. Sinon ce garde devient aveugle.
// ============================================================================

const SHAPE = "../../lib/game/training/question-shape.ts";
const FOCUS = "../../lib/game/training/focus.ts";

const failures = [];
const expect = (cond, label) => {
  if (!cond) failures.push(label);
};

const load = (path) =>
  import(path).catch((error) => {
    console.error(
      `check:focus-bias n'a pas pu importer ${path} : ${error.message}. ` +
        "Il doit rester sans import de runtime."
    );
    process.exit(1);
  });

const { pickEligibleTypeface, pickDistractors, hashScore } = await load(SHAPE);
const { normalizeFocus } = await load(FOCUS);

// --- La reference : le tri d'origine, fige ici ---------------------------------
// Recopie volontaire du comportement d'avant la consigne. C'est la seule facon de
// dire « inchange » : comparer le module a lui meme ne prouverait rien.
const DIFF = { easy: 0, medium: 1, hard: 2 };
const RAR = { common: 0, uncommon: 1, rare: 2 };
const referencePick = (pool, q, seed) => {
  const eligible = pool.filter((row) => row.next_due_after_q <= q);
  const source = eligible.length > 0 ? eligible : pool;
  return [...source].sort((l, r) => {
    if (l.next_due_after_q !== r.next_due_after_q) return l.next_due_after_q - r.next_due_after_q;
    if (l.mastery_level !== r.mastery_level) return l.mastery_level - r.mastery_level;
    const dl = DIFF[l.difficulty_base] ?? 1;
    const dr = DIFF[r.difficulty_base] ?? 1;
    if (dl !== dr) return dl - dr;
    const rl = RAR[l.rarity_tag ?? "common"] ?? 0;
    const rr = RAR[r.rarity_tag ?? "common"] ?? 0;
    if (rl !== rr) return rl - rr;
    return hashScore(seed, q, l.typeface_slug) - hashScore(seed, q, r.typeface_slug);
  })[0];
};

// --- Pools synthetiques, deterministes -----------------------------------------
let state = 7;
const rand = () => {
  state = (state * 1103515245 + 12345) % 2147483648;
  return state / 2147483648;
};
const CATS = ["sans_serif", "serif", "mono", "display"];
const DIFFS = ["easy", "medium", "hard"];
const RARS = ["common", "uncommon", "rare"];

const makePool = (size, qIndex) =>
  Array.from({ length: size }, (_, i) => ({
    typeface_slug: `face_${i}`,
    mastery_level: Math.floor(rand() * 5),
    // Environ la moitie due, l'autre en fenetre d'attente.
    next_due_after_q: qIndex + Math.floor(rand() * 20) - 10,
    primary_category: CATS[Math.floor(rand() * CATS.length)],
    visual_cluster_id: `c${Math.floor(rand() * 5)}`,
    difficulty_base: DIFFS[Math.floor(rand() * DIFFS.length)],
    rarity_tag: RARS[Math.floor(rand() * RARS.length)],
  }));

const isDue = (row, q) => row.next_due_after_q <= q;

let couples = 0;
let preferredServed = 0;
for (let s = 0; s < 40; s += 1) {
  for (let q = 20; q < 26; q += 1) {
    const seed = `seed-${s}`;
    const pool = makePool(12 + (s % 9), q);
    const ref = referencePick(pool, q, seed);
    couples += 1;

    // 1. Sans consigne, identique a l'origine.
    const plain = pickEligibleTypeface(pool, q, seed);
    expect(
      plain?.typeface_slug === ref?.typeface_slug,
      `sans consigne, ${seed} q${q} : ${plain?.typeface_slug} au lieu de ${ref?.typeface_slug}`
    );

    // Trois consignes : une categorie, un sous ensemble de slugs, rien du tout.
    const prefersList = [
      (row) => row.primary_category === CATS[s % CATS.length],
      (row) => Number(row.typeface_slug.split("_")[1]) % 3 === 0,
      () => false,
    ];
    for (const [k, prefers] of prefersList.entries()) {
      const picked = pickEligibleTypeface(pool, q, seed, prefers);
      const due = pool.filter((row) => isDue(row, q));
      const dueMatching = due.filter(prefers);

      // 2. La consigne est servie des qu'une face due y repond.
      if (dueMatching.length > 0) {
        expect(
          picked && prefers(picked),
          `consigne ${k}, ${seed} q${q} : ${picked?.typeface_slug} ne repond pas alors que ${dueMatching.length} dues y repondent`
        );
        if (picked && prefers(picked)) preferredServed += 1;
      }

      // 3. Jamais une face non due quand il y a des dues.
      if (due.length > 0) {
        expect(
          picked && isDue(picked, q),
          `consigne ${k}, ${seed} q${q} : ${picked?.typeface_slug} n'est pas due`
        );
      }

      // 4. Aucune due ne repond : exactement le choix sans consigne.
      if (dueMatching.length === 0) {
        expect(
          picked?.typeface_slug === ref?.typeface_slug,
          `consigne ${k}, ${seed} q${q} : aucune due ne repond, ${picked?.typeface_slug} au lieu de ${ref?.typeface_slug}`
        );
      }
    }
  }
}
expect(couples >= 200, `seulement ${couples} couples (graine, index), il en faut 200`);
expect(preferredServed > 50, `la consigne n'a ete exercee que ${preferredServed} fois`);

// 4 bis. Le repli « aucune face due » n'est jamais biaise, meme quand la consigne
// designe des faces du pool.
{
  const q = 5;
  for (let s = 0; s < 30; s += 1) {
    const seed = `repli-${s}`;
    const pool = makePool(10, 100).map((row) => ({ ...row, next_due_after_q: 50 + Math.floor(rand() * 30) }));
    const ref = referencePick(pool, q, seed);
    const prefers = (row) => row.typeface_slug !== ref.typeface_slug;
    const picked = pickEligibleTypeface(pool, q, seed, prefers);
    expect(
      picked?.typeface_slug === ref.typeface_slug,
      `repli ${seed} : la consigne a biaise le repli (${picked?.typeface_slug} au lieu de ${ref.typeface_slug})`
    );
  }
}

// --- Les leurres privilegies ---------------------------------------------------
{
  // La bonne reponse, sa face confondue (loin d'elle, donc jamais leurre sans
  // bonus), une jumelle privilegiee elle aussi, et assez de voisines proches pour
  // remplir les trois places sans aide.
  const correct = {
    typeface_slug: "helvetica",
    mastery_level: 2,
    next_due_after_q: 0,
    primary_category: "sans_serif",
    visual_cluster_id: "grotesk",
    difficulty_base: "medium",
  };
  const near = Array.from({ length: 8 }, (_, i) => ({
    ...correct,
    typeface_slug: `near_${i}`,
  }));
  const confused = { ...correct, typeface_slug: "garamond", primary_category: "serif", visual_cluster_id: "oldstyle" };
  const twin = { ...correct, typeface_slug: "helvetica_twin", primary_category: "display", visual_cluster_id: "far" };
  const pool = [correct, ...near, confused, twin];
  const sontJumelles = (a, b) =>
    (a === "helvetica" && b === "helvetica_twin") || (a === "helvetica_twin" && b === "helvetica");

  let confusedPlaced = 0;
  for (let s = 0; s < 60; s += 1) {
    const seed = `leurre-${s}`;
    const plain = pickDistractors(pool, correct, s, seed, sontJumelles).map((r) => r.typeface_slug);
    const absent = pickDistractors(pool, correct, s, seed, sontJumelles, undefined, undefined).map((r) => r.typeface_slug);
    const empty = pickDistractors(pool, correct, s, seed, sontJumelles, undefined, []).map((r) => r.typeface_slug);
    const outside = pickDistractors(pool, correct, s, seed, sontJumelles, undefined, ["hors_pool"]).map((r) => r.typeface_slug);
    expect(!plain.includes("garamond"), `leurres ${seed} : la face confondue sort sans bonus, le test ne prouve rien`);
    expect(absent.join() === plain.join(), `leurres ${seed} : preferred absent change les leurres`);
    expect(empty.join() === plain.join(), `leurres ${seed} : preferred vide change les leurres`);
    expect(outside.join() === plain.join(), `leurres ${seed} : un slug hors pool change les leurres`);

    const preferred = ["helvetica", "garamond", "helvetica_twin"];
    const biased = pickDistractors(pool, correct, s, seed, sontJumelles, undefined, preferred).map((r) => r.typeface_slug);
    expect(biased.length === 3, `leurres ${seed} : ${biased.length} leurres au lieu de 3`);
    expect(biased.includes("garamond"), `leurres ${seed} : la face confondue n'est pas parmi les leurres (${biased.join()})`);
    expect(!biased.includes("helvetica_twin"), `leurres ${seed} : une jumelle est servie en leurre (${biased.join()})`);
    expect(!biased.includes("helvetica"), `leurres ${seed} : la bonne reponse est servie en leurre`);
    if (biased.includes("garamond")) confusedPlaced += 1;
  }
  expect(confusedPlaced === 60, `face confondue placee ${confusedPlaced} fois sur 60`);

  // Le repli de withoutTwins : deux leurres propres seulement, donc une jumelle
  // prend la troisieme place. C'est le seul endroit ou le bonus pourrait en
  // pousser une, et il ne doit pas : la jumelle proche garde sa place, la
  // jumelle privilegiee et lointaine ne la lui prend pas.
  const twinFar = { ...correct, typeface_slug: "twin_far", primary_category: "display", visual_cluster_id: "far" };
  const twinNear = { ...correct, typeface_slug: "twin_near" };
  const small = [correct, near[0], near[1], twinFar, twinNear];
  const twins = (a, b) => a === "helvetica" && (b === "twin_far" || b === "twin_near");
  for (let s = 0; s < 30; s += 1) {
    const seed = `repli-leurre-${s}`;
    const plain = pickDistractors(small, correct, s, seed, twins).map((r) => r.typeface_slug);
    const biased = pickDistractors(small, correct, s, seed, twins, undefined, ["twin_far"]).map((r) => r.typeface_slug);
    expect(plain.includes("twin_near") && !plain.includes("twin_far"), `repli leurres ${seed} : le cas ne prouve rien (${plain.join()})`);
    expect(!biased.includes("twin_far"), `repli leurres ${seed} : le bonus a pousse une jumelle (${biased.join()})`);
  }
}

// --- normalizeFocus --------------------------------------------------------------
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cases = [
    [{ kind: "palier", id: "2.6" }, { kind: "palier", id: "2.6" }],
    [{ kind: "palier", id: "9.9" }, { kind: "palier", id: "9.9" }],
    [{ kind: "palier", id: "2.10" }, null],
    [{ kind: "palier", id: "26" }, null],
    [{ kind: "palier", id: 2.6 }, null],
    [{ kind: "palier" }, null],
    [{ kind: "faces", slugs: ["helvetica", "arial"] }, { kind: "faces", slugs: ["helvetica", "arial"] }],
    [{ kind: "faces", slugs: ["a", "b", "a"] }, { kind: "faces", slugs: ["a", "b"] }],
    [{ kind: "faces", slugs: ["a", "a"] }, null],
    [{ kind: "faces", slugs: ["a"] }, null],
    [{ kind: "faces", slugs: ["a", "b", "c", "d", "e", "f"] }, { kind: "faces", slugs: ["a", "b", "c", "d", "e", "f"] }],
    [{ kind: "faces", slugs: ["a", "b", "c", "d", "e", "f", "g"] }, null],
    [{ kind: "faces", slugs: ["a", "Arial"] }, null],
    [{ kind: "faces", slugs: ["a", "b-c"] }, null],
    [{ kind: "faces", slugs: ["a", "x".repeat(81)] }, null],
    [{ kind: "faces", slugs: ["a", 3] }, null],
    [{ kind: "faces", slugs: "a,b" }, null],
    [{ kind: "faces" }, null],
    [{ kind: "other", id: "2.6" }, null],
    [null, null],
    [undefined, null],
    ["palier", null],
    [42, null],
    [[], null],
  ];
  for (const [input, want] of cases) {
    let got;
    try {
      got = normalizeFocus(input);
    } catch (error) {
      got = `exception ${error.message}`;
    }
    expect(same(got, want), `normalizeFocus(${JSON.stringify(input)}) rend ${JSON.stringify(got)} au lieu de ${JSON.stringify(want)}`);
  }
  // Rien d'autre que la forme validee ne traverse : un champ en trop est lache.
  const extra = normalizeFocus({ kind: "palier", id: "2.1", slugs: ["x", "y"], evil: true });
  expect(same(extra, { kind: "palier", id: "2.1" }), `normalizeFocus laisse passer des champs en trop : ${JSON.stringify(extra)}`);
}

if (failures.length > 0) {
  console.error(`check:focus-bias : ${failures.length} echec(s)`);
  for (const failure of failures.slice(0, 20)) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `check:focus-bias : ok (${couples} couples graine et index, consigne servie ${preferredServed} fois, leurres et normalisation verifies)`
);
