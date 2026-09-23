#!/usr/bin/env node

import fs from "node:fs";

// Trois fichiers d'etat sont morts dans ce projet avant celui-ci. La page HTML
// « Ou on en est » du 7 juillet et project-onboarding-2026-07-30.md sont morts
// perimes : des instantanes que personne n'a rouverts. La checklist, elle, est
// morte obese : bien tenue a jour, mais toujours en ajoutant a la fin, jusqu'a
// 158 000 mots et 175 sections, au point que sa propre section « REPRISE, a lire
// en premier » s'est retrouvee enterree ligne 547 sous vingt notes plus recentes.
//
// Les deux facons de rater sont opposees : ne pas mettre a jour perime, mettre a
// jour en ajoutant gonfle. La seule forme qui survit aux deux est un texte qu'on
// reecrit entierement. Or ce n'est pas la discipline qui decide lequel des deux
// comportements on adopte, c'est la TAILLE : sous un millier de mots, reecrire
// reste plus simple qu'ajouter, donc on reecrit. Au dessus, ajouter gagne, et
// c'est fini. Ce plafond n'est donc pas une regle d'hygiene, c'est le mecanisme.
//
// Le plafond global existe pour la meme raison : CLAUDE.md est charge a chaque
// session, donc chaque mot y est paye a chaque fois. Sans plafond, ce fichier
// deviendrait la deuxieme checklist.
const FICHIER = "CLAUDE.md";
const TITRE = "## Où on en est";
const PLAFOND_SECTION = 700;
const PLAFOND_FICHIER = 5000;

// Les quatre fiches d'arbitrages recoivent le pourquoi distille de la checklist.
// Sans plafond elles redeviendraient la checklist, en quatre exemplaires : c'est le
// meme mecanisme et le meme piege. 1500 mots chacune, soit 6000 au total contre les
// 158 000 d'origine, ce qui est l'ordre de grandeur assume de la distillation. Un
// depassement veut dire qu'on a garde du journal de bord au lieu du seul pourquoi.
const ARBITRAGES = [
  "docs/game/arbitrages.md",
  // Separee de la precedente le 2026-09-18 : le moteur et l'espace enseignant avaient
  // assez de decisions chacun pour que les tenir ensemble oblige a en couper. C'est le
  // plafond qui l'a revele, en refusant une fiche de 1650 mots.
  "docs/game/arbitrages-espace-prof.md",
  // Separee le 2026-09-18 : ce que le moteur enseigne et la facon dont ses ecritures
  // tiennent en base sont deux domaines.
  "docs/game/arbitrages-ecritures.md",
  "docs/ui/arbitrages.md",
  // Separee le 2026-09-18, meme raison que l'espace prof : ce qu'on dessine et le
  // systeme qui le dessine sont deux domaines, et les tenir ensemble obligeait a
  // couper dans l'un des deux.
  "docs/ui/arbitrages-systeme.md",
  "docs/typography/arbitrages.md",
  "docs/overview/arbitrages-mise-en-ligne.md",
];
const PLAFOND_ARBITRAGES = 1500;

const compterMots = (texte) => texte.split(/\s+/).filter(Boolean).length;

const echecs = [];

if (!fs.existsSync(FICHIER)) {
  console.error(`${FICHIER} est introuvable.`);
  process.exit(1);
}

const contenu = fs.readFileSync(FICHIER, "utf8");
const debut = contenu.indexOf(`\n${TITRE}`);

if (debut === -1) {
  echecs.push(
    `la section « ${TITRE.replace("## ", "")} » a disparu de ${FICHIER}. C'est la seule reponse ` +
      `a « on en est ou » qui ne coute pas la lecture du journal de bord.`,
  );
} else {
  const suite = contenu.indexOf("\n## ", debut + 1);
  const section = contenu.slice(debut, suite === -1 ? undefined : suite);
  const mots = compterMots(section);

  if (mots > PLAFOND_SECTION) {
    echecs.push(
      `la section « Où on en est » fait ${mots} mots, plafond ${PLAFOND_SECTION}. ` +
        `Ne pas relever le plafond : la reecrire. C'est en ajoutant que la checklist ` +
        `est passee a 158 000 mots.`,
    );
  }
}

const motsFichier = compterMots(contenu);
if (motsFichier > PLAFOND_FICHIER) {
  echecs.push(
    `${FICHIER} fait ${motsFichier} mots, plafond ${PLAFOND_FICHIER}. Ce fichier est charge a ` +
      `chaque session, donc chaque mot y est paye a chaque fois. Deplacer le durable vers docs/.`,
  );
}

for (const fiche of ARBITRAGES) {
  if (!fs.existsSync(fiche)) {
    echecs.push(`${fiche} est introuvable. Les quatre fiches d'arbitrages portent le pourquoi distille de la checklist.`);
    continue;
  }
  const mots = compterMots(fs.readFileSync(fiche, "utf8"));
  if (mots > PLAFOND_ARBITRAGES) {
    echecs.push(
      `${fiche} fait ${mots} mots, plafond ${PLAFOND_ARBITRAGES}. Ne pas relever le plafond : ` +
        `au dela, c'est du journal de bord garde par erreur, pas du pourquoi.`,
    );
  }
}

if (echecs.length > 0) {
  console.error("Fichier d'etat : violations detectees.");
  echecs.forEach((echec) => console.error(`- ${echec}`));
  process.exit(1);
}

const totalArbitrages = ARBITRAGES.reduce(
  (n, f) => n + compterMots(fs.readFileSync(f, "utf8")),
  0,
);
console.log(
  `Fichier d'etat verifie : « Où on en est » presente, ${FICHIER} a ${motsFichier}/${PLAFOND_FICHIER} mots, ` +
    `les ${ARBITRAGES.length} fiches d'arbitrages a ${totalArbitrages}/${ARBITRAGES.length * PLAFOND_ARBITRAGES}.`,
);
