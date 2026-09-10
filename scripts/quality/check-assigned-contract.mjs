// ============================================================================
// check:assigned-contract
//
// POURQUOI CE GARDE EXISTE. Un devoir repose sur une frontiere invisible a la
// relecture : le CONTRAT est commun a la classe, l'ADAPTATION joue a l'interieur
// (I-25). Rien dans le code ne ressemble a cette frontiere, et pourtant si elle
// glisse, deux eleves d'une meme classe ne passent plus le meme exercice et le
// professeur compare des choses incomparables sans le savoir.
//
// Ce garde exerce les deux modules purs du chemin assigne, lib/game/assigned/
// contract.ts et select.ts, sur des contrats synthetiques. Il verifie ce qui doit
// rester vrai quoi qu'il arrive :
//
//   - une face imposee est demandee avant tout, une fois chacune ;
//   - la selection ne rend jamais une face absente du contrat ;
//   - les parts du mix sont servies, et un panier vide se redistribue seul ;
//   - l'adaptation se deplace d'un cran au plus et ne sort pas de la bande ;
//   - sans adaptation, deux eleves recoivent exactement la meme difficulte ;
//   - le controle et la competition n'ecrivent jamais la maitrise (I-22) ;
//   - le budget vient du contrat, et une competition n'en a pas ;
//   - la fenetre se ferme a l'echeance, bornes comprises.
//
// Les deux modules doivent rester sans import de runtime pour que Node puisse en
// effacer les types, comme question-shape.ts. Sinon ce garde devient aveugle.
// ============================================================================

const CONTRACT = "../../lib/game/assigned/contract.ts";
const SELECT = "../../lib/game/assigned/select.ts";

const failures = [];
const notes = [];

const modules = await Promise.all([import(CONTRACT), import(SELECT)]).catch((error) => {
  console.error(
    `check:assigned-contract n'a pas pu importer les modules du chemin assigne : ${error.message}. ` +
      "Ils doivent rester sans import de runtime."
  );
  process.exit(1);
});

const { PROXIMITY_OF, POLICY_OF, proximityFor } = modules[0];
const { nextFace, isBudgetSpent, isWindowOpen } = modules[1];

const MIX = { consolidation: 45, upkeep: 20, targeted: 20, novelty: 15 };

const candidate = (slug, bucket, imposed = false) => ({ slug, bucket, imposed });

const pool = [
  candidate("imposee_a", "targeted", true),
  candidate("imposee_b", "consolidation", true),
  candidate("conso_1", "consolidation"),
  candidate("conso_2", "consolidation"),
  candidate("upkeep_1", "upkeep"),
  candidate("cible_1", "targeted"),
  candidate("neuve_1", "novelty"),
];

// --- une seance entiere, question par question -----------------------------
const play = (candidates, count, seed = "graine") => {
  const asked = {};
  const order = [];
  for (let i = 0; i < count; i += 1) {
    const face = nextFace(candidates, MIX, asked, i, seed);
    if (!face) break;
    order.push(face.slug);
    asked[face.slug] = (asked[face.slug] ?? 0) + 1;
  }
  return { order, asked };
};

const { order } = play(pool, 40);

if (order.length !== 40) {
  failures.push(`une seance de 40 questions n'en a servi que ${order.length} : la selection s'est tarie.`);
}

const imposed = pool.filter((c) => c.imposed).map((c) => c.slug);
const firstTwo = order.slice(0, imposed.length).sort();
if (JSON.stringify(firstTwo) !== JSON.stringify([...imposed].sort())) {
  failures.push(
    `les faces imposees doivent passer avant tout, et la seance commence par ${JSON.stringify(order.slice(0, 4))}.`
  );
}
notes.push(`faces imposees servies en premier (${imposed.length})`);

const known = new Set(pool.map((c) => c.slug));
const strays = order.filter((slug) => !known.has(slug));
if (strays.length > 0) {
  failures.push(`la selection a rendu ${strays.length} face(s) absente(s) du contrat : ${JSON.stringify(strays)}.`);
}
notes.push("aucune face hors contrat");

// --- les parts du mix ------------------------------------------------------
const bucketOf = Object.fromEntries(pool.map((c) => [c.slug, c.bucket]));
const served = { consolidation: 0, upkeep: 0, targeted: 0, novelty: 0 };
for (const slug of order) served[bucketOf[slug]] += 1;

for (const [bucket, share] of Object.entries(MIX)) {
  const got = Math.round((100 * served[bucket]) / order.length);
  if (Math.abs(got - share) > 12) {
    failures.push(
      `le panier '${bucket}' vaut ${share} % dans le contrat et a recu ${got} % des questions : le mix n'est pas servi.`
    );
  }
}
notes.push(
  `mix servi a ${Object.entries(served).map(([b, n]) => `${b} ${Math.round((100 * n) / order.length)}%`).join(" ")}`
);

// --- un panier vide se redistribue seul ------------------------------------
const withoutNovelty = pool.filter((c) => c.bucket !== "novelty");
const short = play(withoutNovelty, 20);
if (short.order.length !== 20) {
  failures.push(
    `sans candidat 'novelty', la seance doit continuer sur les trois autres paniers et elle s'arrete a ${short.order.length}.`
  );
}
if (short.order.some((slug) => bucketOf[slug] === "novelty")) {
  failures.push("un panier sans candidat a quand meme ete servi.");
}
notes.push("panier vide redistribue");

// --- l'adaptation, et sa bande --------------------------------------------
const LADDER = ["far", "family", "cluster", "micro"];
for (const exigence of Object.keys(PROXIMITY_OF)) {
  const centre = PROXIMITY_OF[exigence];
  for (const mastery of [0, 1, 2, 3, 4, null]) {
    const flat = proximityFor(exigence, false, mastery);
    if (flat !== centre) {
      failures.push(
        `sans adaptation, le cran '${exigence}' doit rendre '${centre}' quoi qu'il arrive, et il rend '${flat}' pour une maitrise de ${mastery}.`
      );
    }
    const moved = proximityFor(exigence, true, mastery);
    const distance = Math.abs(LADDER.indexOf(moved) - LADDER.indexOf(centre));
    if (distance > 1) {
      failures.push(
        `l'adaptation doit rester dans une bande d'un cran, et '${exigence}' saute de ${distance} crans pour une maitrise de ${mastery}.`
      );
    }
  }
}
notes.push("adaptation bornee a un cran, et nulle sans adaptation");

// --- la politique de progression, par type de devoir (I-22) ----------------
for (const [kind, expected] of [
  ["exercise", "update_mastery"],
  ["control", "observe_only"],
  ["competition", "observe_only"],
]) {
  if (POLICY_OF[kind] !== expected) {
    failures.push(`le type '${kind}' doit porter la politique '${expected}' et porte '${POLICY_OF[kind]}'.`);
  }
}
notes.push("controle et competition n'ecrivent jamais la maitrise");

// --- le budget et la fenetre ----------------------------------------------
if (isBudgetSpent(999, null)) {
  failures.push("une competition n'a pas de budget de questions, et il est declare epuise.");
}
if (!isBudgetSpent(20, 20) || isBudgetSpent(19, 20)) {
  failures.push("le budget doit s'epuiser exactement au nombre de questions du contrat.");
}
if (isWindowOpen(100, 200, 300) || !isWindowOpen(200, 200, 300) || isWindowOpen(300, 200, 300)) {
  failures.push("la fenetre doit s'ouvrir a l'heure d'ouverture et se fermer a l'echeance, exclue.");
}
notes.push("budget du contrat et fenetre bornee");

if (failures.length > 0) {
  console.error("check:assigned-contract a echoue.\n");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`check:assigned-contract OK : ${notes.join(" · ")}.`);
