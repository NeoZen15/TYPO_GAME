// ============================================================================
// check:objectives
//
// POURQUOI CE GARDE EXISTE. Les trois objectifs du Path (Allumer, Corriger,
// Mission du jour) promettent quelque chose au joueur, et un bouton doit tenir
// cette promesse (docs/product/spec-objectifs-joueur.md). Rien a l'ecran ne dit
// si le choix a glisse : une etape non calculable proposee, une paire retenue sur
// une seule erreur, une mission remplie par un devoir. Ce garde exerce le module
// pur lib/profile/objectives.ts sur quatre profils inventes et verifie :
//
//   - une etape non calculable n'est jamais proposee ;
//   - Allumer ne propose qu'une etape qui a cinq faces dans le pool actif ;
//   - l'emergente la plus proche du seuil passe devant, puis l'ordre canonique ;
//   - tout allume : l'etape qui a le plus de revisions dues, en « entretenir » ;
//   - Corriger exige deux occurrences, garde trois paires et six faces au plus ;
//   - sans paire qui compte, Corriger n'annonce aucune police ;
//   - la mission ne compte que le contexte personnel et ne ferme jamais la seance.
//
// Le module doit rester sans import de runtime pour que Node puisse en effacer
// les types, comme lib/game/assigned/contract.ts. Sinon ce garde devient aveugle.
// ============================================================================

const MODULE = "../../lib/profile/objectives.ts";

const failures = [];
const expect = (cond, label) => {
  if (!cond) failures.push(label);
};

const mod = await import(MODULE).catch((error) => {
  console.error(
    `check:objectives n'a pas pu importer ${MODULE} : ${error.message}. ` +
      "Il doit rester sans import de runtime."
  );
  process.exit(1);
});
const { buildObjectives, MISSION_TARGET_DEFAULT } = mod;

// Les huit etapes calculables aujourd'hui (lib/profile/palier-taxonomy.ts).
const DERIVABLE = ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "3.1", "3.2"];

const palier = (id, state, a, mastered, label = `step ${id}`) => ({ id, label, state, a, mastered });
const face = (slug, paliers, { inPool = true, due = false } = {}) => ({ slug, paliers, inPool, due });
const faces = (prefix, n, paliers, opts) =>
  Array.from({ length: n }, (_, i) => face(`${prefix}_${i + 1}`, paliers, opts));

// --- Profil 1 : joueur neuf, rien joue --------------------------------------
{
  const out = buildObjectives({
    paliers: [
      palier("1.1", "dormant", 0, 0), // non calculable, doit etre ignore
      palier("2.1", "dormant", 0, 0),
      palier("2.2", "dormant", 0, 0),
    ],
    derivable: DERIVABLE,
    faces: [...faces("pool", 30, ["2.1"]), ...faces("mono", 2, ["2.2"])],
    confusions: [],
    todayCorrectPersonal: 0,
  });
  expect(out.light.kind === "light", "neuf : Allumer doit exister");
  expect(out.light.palierId === "2.1", `neuf : Allumer doit proposer 2.1, pas ${out.light.palierId}`);
  expect(out.fix.pairs.length === 0, "neuf : Corriger ne doit retenir aucune paire");
  expect(out.fix.focus === null, "neuf : Corriger sans paire ne doit annoncer aucune police");
  expect(out.mission.target === MISSION_TARGET_DEFAULT, "neuf : cible par defaut");
  expect(out.mission.done === 0 && out.mission.reached === false, "neuf : mission a zero");
}

// --- Profil 2 : joueur du milieu --------------------------------------------
{
  const out = buildObjectives({
    paliers: [
      palier("2.1", "lit", 0.9, 8),
      palier("2.5", "emerging", 0.7, 2), // manque 3 faces
      palier("2.6", "emerging", 0.74, 4), // manque 1 face : devant
      palier("3.1", "emerging", 0.79, 4), // manque 1 face, plus proche du seuil : devant 2.6
      palier("3.2", "emerging", 0.5, 4), // manque 1 face mais 2 faces seulement dans le pool
      // Non calculable, et pourtant la plus proche du seuil avec cinq faces dans
      // le pool : si le filtre des etapes calculables saute, c'est elle qui sort.
      palier("3.3", "emerging", 0.8, 4),
    ],
    derivable: DERIVABLE,
    faces: [
      ...faces("sans", 6, ["2.1", "2.6"]),
      ...faces("serif", 6, ["2.1", "2.5"]),
      ...faces("ouv", 5, ["3.1"]),
      ...faces("contraste", 2, ["3.2"]),
      ...faces("axe", 5, ["3.3"]),
      ...faces("contraste_hors_pool", 6, ["3.2"], { inPool: false }),
    ],
    confusions: [
      { asked: "helvetica", answered: "arial", count: 6 },
      { asked: "arial", answered: "helvetica", count: 3 },
      { asked: "garamond", answered: "caslon", count: 4 },
      { asked: "futura", answered: "avenir", count: 2 },
      { asked: "bodoni", answered: "didot", count: 2 }, // quatrieme paire qui compte : coupee
      { asked: "gill", answered: "johnston", count: 1 }, // une seule fois : ignoree
    ],
    todayCorrectPersonal: 9,
    missionTarget: 15,
  });
  expect(out.light.palierId === "3.1", `milieu : Allumer doit proposer 3.1, pas ${out.light.palierId}`);
  expect(out.light.mode === "light", "milieu : une emergente se propose en « allumer »");
  expect(
    out.light.focus && out.light.focus.kind === "palier" && out.light.focus.id === "3.1",
    "milieu : la consigne d'Allumer vise l'etape"
  );
  expect(out.fix.pairs.length === 3, `milieu : trois paires, pas ${out.fix.pairs.length}`);
  expect(
    out.fix.pairs[0].asked === "helvetica" && out.fix.pairs[0].answered === "arial",
    "milieu : la paire la plus frequente en tete"
  );
  expect(out.fix.pairs[0].count === 9, "milieu : une paire compte ses deux sens (6 + 3)");
  expect(
    !out.fix.pairs.some((p) => p.asked === "gill" || p.answered === "gill"),
    "milieu : une paire vue une seule fois ne compte pas"
  );
  const slugs = out.fix.focus && out.fix.focus.kind === "faces" ? out.fix.focus.slugs : [];
  expect(slugs.length > 0 && slugs.length <= 6, `milieu : Corriger vise 1 a 6 faces, pas ${slugs.length}`);
  expect(new Set(slugs).size === slugs.length, "milieu : aucune face en double dans la consigne");
  expect(out.mission.done === 9 && out.mission.reached === false, "milieu : mission a 9 sur 15");
}

// --- Profil 3 : tout allume --------------------------------------------------
{
  const out = buildObjectives({
    paliers: [palier("2.1", "lit", 0.9, 8), palier("2.2", "lit", 0.88, 6), palier("3.1", "lit", 0.86, 7)],
    derivable: DERIVABLE,
    faces: [
      ...faces("a", 6, ["2.1"], { due: false }),
      ...faces("b", 6, ["2.2"], { due: true }),
      ...faces("c", 6, ["3.1"], { due: false }),
      face("c_due", ["3.1"], { due: true }),
    ],
    confusions: [],
    todayCorrectPersonal: 20,
    missionTarget: 15,
  });
  expect(out.light.mode === "maintain", "allume : Allumer passe en « entretenir »");
  expect(out.light.palierId === "2.2", `allume : l'etape aux revisions dues, pas ${out.light.palierId}`);
  expect(out.mission.reached === true && out.mission.done === 20, "allume : mission atteinte, compte intact");
  expect(out.mission.endsSession === false, "allume : la mission ne ferme jamais la seance (I-17)");
}

// --- Profil 4 : aucune etape proposable -------------------------------------
{
  const out = buildObjectives({
    paliers: [palier("2.2", "dormant", 0, 0), palier("4.1", "emerging", 0.6, 2)],
    derivable: DERIVABLE,
    faces: faces("mono", 3, ["2.2"]), // trois faces seulement dans le pool
    confusions: [{ asked: "x", answered: "y", count: 1 }],
    todayCorrectPersonal: 0,
  });
  expect(out.light.palierId === null, "vide : sans cinq faces dans le pool, aucune etape proposee");
  expect(out.light.focus === null, "vide : Allumer sans etape n'annonce aucune consigne");
  expect(out.fix.focus === null, "vide : une seule erreur ne fait pas une paire");
}

if (failures.length > 0) {
  console.error(`check:objectives ECHEC, ${failures.length} :`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("check:objectives OK, quatre profils, Allumer, Corriger et Mission du jour");
