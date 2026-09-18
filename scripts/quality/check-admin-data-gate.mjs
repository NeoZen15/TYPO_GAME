#!/usr/bin/env node

// LA DONNEE DE L'ADMINISTRATION NE SE LIT QUE PAR LE `sql` GARDE.
//
// Pose apres le pentest du 2026-09-18. La porte de `app/admin/layout.tsx` garde
// l'ECRAN mais pas la charge React de la page, que Next serialise meme quand le
// layout affiche le refus : `/admin` rendait « Reserve a l'administration » et le
// HTML transportait quand meme les chiffres du tableau de bord, et aurait
// transporte les noms et adresses des demandeurs en production.
//
// LE CORRECTIF : chaque module de donnees de l'administration lit par
// `lib/admin/guarded-sql`, qui refuse avant de toucher la base si le demandeur
// n'est pas administrateur. Ce garde empeche la regression : un module
// d'administration, ou une page sous `app/admin`, qui importerait le `sql` de
// base rouvrirait la fuite sans que personne le voie.
//
// DEUX EXCEPTIONS, ET ELLES SONT NOMMEES :
//   - `lib/admin/gate.ts` lit le compteur de demandes avec le `sql` de base,
//     parce que le garde l'appelle pour decider : s'il passait par le garde, la
//     decision tournerait en boucle.
//   - `lib/admin/guarded-sql.ts` EST le garde, donc il enveloppe le `sql` de base.

import fs from "node:fs";
import path from "node:path";

const RACINE = process.cwd();
const BASE_IMPORT = '@/lib/server/neon';
const GARDE_IMPORT = '@/lib/admin/guarded-sql';
const EXCEPTIONS = new Set(["lib/admin/gate.ts", "lib/admin/guarded-sql.ts"]);

const echecs = [];

const fichiers = (dossier, filtre) => {
  const abs = path.join(RACINE, dossier);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => path.relative(RACINE, path.join(e.parentPath ?? e.path, e.name)))
    .filter(filtre);
};

// 1. Un module de donnees d'administration qui utilise sql`...` doit l'importer
//    du garde, sauf les deux exceptions nommees.
for (const f of fichiers("lib/admin", () => true)) {
  const src = fs.readFileSync(path.join(RACINE, f), "utf8");
  const utiliseSql = /\bsql`/.test(src);
  if (!utiliseSql) continue;
  if (EXCEPTIONS.has(f)) continue;
  if (src.includes(`from "${BASE_IMPORT}"`)) {
    echecs.push(`${f} : lit la base avec le sql de base (${BASE_IMPORT}) ; passer par ${GARDE_IMPORT}, sinon la donnee fuite dans la page rendue en parallele`);
  }
  if (!src.includes(`from "${GARDE_IMPORT}"`)) {
    echecs.push(`${f} : utilise sql\`...\` sans importer le sql garde depuis ${GARDE_IMPORT}`);
  }
}

// 2. Aucune page sous app/admin ne parle a la base en direct : elle doit passer
//    par un module de lib/admin, donc par le garde.
for (const f of fichiers("app/admin", () => true)) {
  const src = fs.readFileSync(path.join(RACINE, f), "utf8");
  if (src.includes(`from "${BASE_IMPORT}"`) || /\bsql`/.test(src)) {
    echecs.push(`${f} : une page d'administration lit la base en direct ; la lecture doit vivre dans lib/admin derriere le sql garde`);
  }
}

// 3. Le garde lui meme doit bien envelopper une verification d'acces.
const garde = fs.readFileSync(path.join(RACINE, "lib/admin/guarded-sql.ts"), "utf8");
if (!garde.includes("isAdminAccessAllowed")) {
  echecs.push("lib/admin/guarded-sql.ts : le sql garde ne verifie plus l'acces administrateur avant de lire");
}

if (echecs.length > 0) {
  console.error("Fuite possible de donnees d'administration :");
  echecs.forEach((e) => console.error(`- ${e}`));
  process.exit(1);
}

console.log(
  "Donnees d'administration verrouillees : tous les modules de donnees lisent par le sql garde, aucune page admin ne parle a la base en direct, et le garde verifie l'acces avant chaque lecture.",
);
