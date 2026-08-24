#!/usr/bin/env node
/**
 * check-twin-guard.mjs
 *
 * Garde la regle : deux polices qui dessinent le latin a l'identique ne peuvent pas
 * sortir dans la meme manche, l'une comme bonne reponse et l'autre comme leurre.
 *
 * POURQUOI CE GARDE EXISTE. Sans lui, le jeu pouvait montrer un mot et proposer
 * Noto Sans, Noto Sans JP, Noto Sans KR et Noto Sans SC : une question sans reponse,
 * ou le joueur ne peut que deviner. Le defaut ne leve aucune erreur, ne casse aucun
 * ecran, et ne se voit que si on joue la manche exacte. C'est exactement le genre de
 * defaut qu'un garde doit tenir.
 *
 * TROIS FAMILLES DE REGLES.
 *   1. La liste du module est celle que la mesure a produite, sans derive.
 *   2. Les deux fournisseurs importent le module ET s'en servent dans leur choix de
 *      leurres. Un import sans usage serait un garde mort.
 *   3. Aucune famille ne contient une police que le catalogue ne sert plus.
 *
 * Hors ligne, sans base, sans reseau.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const lire = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const lireJson = (p) => JSON.parse(lire(p));

const MODULE = "lib/game/twin-guard.ts";
const RAPPORT = "data/typography-profiles/indistinguishable-pairs.json";
const CATALOGUE = "content/catalog/typefaces-core.json";

const echecs = [];
const echec = (regle, detail) => echecs.push(`${regle} : ${detail}`);

const moduleSource = lire(MODULE);

// --- 1. le module dit ce que la mesure a trouve ---
const blocFamilles = moduleSource.match(
  /export const TWIN_FAMILIES[^=]*=\s*\[([\s\S]*?)\n\] as const;/
);
if (!blocFamilles) {
  echec("module-illisible", `${MODULE} n'expose pas TWIN_FAMILIES sous la forme attendue`);
} else {
  const famillesModule = [...blocFamilles[1].matchAll(/^\s*\[([^\]]*)\],\s*$/gm)].map((m) =>
    [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort()
  );
  const famillesRapport = lireJson(RAPPORT).familles.map((f) => [...f.membres].sort());

  const cle = (f) => f.join(",");
  const dansModule = new Set(famillesModule.map(cle));
  const dansRapport = new Set(famillesRapport.map(cle));

  for (const f of famillesRapport) {
    if (!dansModule.has(cle(f))) {
      echec("famille-absente",
        `${MODULE} ignore une famille mesuree de ${f.length} polices (${f.slice(0, 3).join(", ")}). Relancer scripts/build_twin_guard.py`);
    }
  }
  for (const f of famillesModule) {
    if (!dansRapport.has(cle(f))) {
      echec("famille-inventee",
        `${MODULE} declare une famille que la mesure ne trouve pas (${f.slice(0, 3).join(", ")})`);
    }
  }

  // --- 3. aucune famille ne nomme une police disparue du catalogue ---
  const connus = new Set(lireJson(CATALOGUE).records.map((r) => r.typeface_slug));
  for (const f of famillesModule) {
    for (const slug of f) {
      if (!connus.has(slug)) {
        echec("police-fantome", `${MODULE} nomme ${slug}, absente du catalogue`);
      }
    }
  }

  // une famille d'un seul membre ne protege rien
  for (const f of famillesModule) {
    if (f.length < 2) {
      echec("famille-solitaire", `${MODULE} porte une famille d'un seul membre : ${f[0]}`);
    }
  }
}

// --- 2. les trois maillons de la chaine, chacun verifie a sa place ---
//
// LA CHAINE N'EST PAS LA MEME DES DEUX COTES, et c'est voulu.
//
// En competition, le fournisseur importe le garde et filtre directement.
//
// En entrainement, question-shape.ts NE PEUT PAS importer le garde : Node le charge
// tel quel dans check:answer-position pour rejouer la chaine de question, et il ne
// resout ni l'alias "@/" ni un import relatif sans extension. Un import y rendrait
// ce garde la aveugle, ce que CLAUDE.md interdit. Le test arrive donc en parametre,
// et il faut verifier les DEUX bouts : que le module s'en sert, et que l'appelant
// le fournit. Verifier un seul bout laisserait passer la moitie du defaut.

{
  const forme = lire("lib/game/training/question-shape.ts");
  if (/from "@\/lib\/game\/twin-guard"/.test(forme)) {
    echec("import-interdit",
      "lib/game/training/question-shape.ts importe le garde en \"@/\" : Node ne resout pas cet alias et check:answer-position deviendrait aveugle");
  }
  // La regle porte sur la SIGNATURE PUBLIQUE de pickDistractors, pas sur une
  // occurrence quelconque du nom. Une premiere version cherchait juste
  // "sontJumelles: SontJumelles" n'importe ou dans le fichier : retirer le parametre
  // de pickDistractors la laissait verte, parce que la fonction interne withoutTwins
  // porte le meme nom de parametre. Attrape par mutation.
  const signature = forme.match(
    /export const pickDistractors[\s\S]*?\n\): Row\[\] =>/
  );
  if (!signature) {
    echec("signature-illisible",
      "lib/game/training/question-shape.ts n'expose plus pickDistractors sous la forme attendue");
  } else if (!/sontJumelles\s*:\s*SontJumelles\s*=\s*JAMAIS_JUMELLES/.test(signature[0])) {
    echec("parametre-manquant",
      "pickDistractors n'accepte plus le test des jumelles en dernier parametre, avec son defaut inerte");
  }
  if (!/filter\([\s\S]{0,200}sontJumelles\(correct\.typeface_slug,\s*row\.typeface_slug\)/.test(forme)) {
    echec("filtre-manquant",
      "lib/game/training/question-shape.ts n'ecarte pas les jumelles dans un filter");
  }

  const fournisseur = lire("lib/game/training/provider.ts");
  if (!fournisseur.includes('from "@/lib/game/twin-guard"')) {
    echec("import-manquant", "lib/game/training/provider.ts n'importe pas le garde des jumelles");
  } else if (!/pickDistractors\([\s\S]{0,300}isIndistinguishableFrom/.test(fournisseur)) {
    echec("test-non-fourni",
      "lib/game/training/provider.ts importe le garde mais ne le passe pas a pickDistractors : le parametre garderait sa valeur par defaut, qui n'ecarte rien");
  }

  const competition = lire("lib/game/competition/provider.ts");
  if (!competition.includes('from "@/lib/game/twin-guard"')) {
    echec("import-manquant", "lib/game/competition/provider.ts n'importe pas le garde des jumelles");
  } else {
    if (!/isIndistinguishableFrom\(\s*correct\.typeface_slug,\s*row\.typeface_slug\s*\)/.test(competition)) {
      echec("appel-manquant",
        "lib/game/competition/provider.ts n'appelle pas le garde sur (correct.typeface_slug, row.typeface_slug)");
    }
    if (!/filter\([\s\S]{0,400}isIndistinguishableFrom/.test(competition)) {
      echec("appel-inerte",
        "lib/game/competition/provider.ts appelle le garde hors d'un filter : rien ne serait ecarte");
    }
  }
}

if (echecs.length === 0) {
  const n = (moduleSource.match(/^\s*\[/gm) || []).length;
  console.log(`check:twin-guard OK, ${n} familles de polices indistinguables, filtrees dans les deux fournisseurs`);
  process.exit(0);
}
console.error(`check:twin-guard a trouve ${echecs.length} problemes :`);
for (const e of echecs) console.error(`  ${e}`);
process.exit(1);
