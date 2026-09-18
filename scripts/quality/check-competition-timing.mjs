#!/usr/bin/env node

// LE SCORE DE COMPETITION NE SE DECIDE PAS SUR UNE VALEUR DU CLIENT.
//
// Pose apres l'auto-pentest du 2026-09-18. Le bonus de vitesse (+2 au lieu de
// +1) se decidait sur le `responseTimeMs` declare par le navigateur : envoyer 0
// donnait le bonus a chaque bonne reponse, un point vole par mot. Durci pour que
// le calcul ne depende que de l'horloge du serveur (`serverElapsedMs`), que le
// client ne peut pas falsifier.
//
// Ce garde execute la vraie fonction `awardPointsFor` du provider et prouve la
// propriete qui compte : QUAND UNE MESURE SERVEUR EXISTE, LE TEMPS DECLARE PAR LE
// CLIENT NE CHANGE RIEN AU SCORE. Donc mentir ne rapporte rien.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RACINE = process.cwd();
const MODULE = pathToFileURL(path.join(RACINE, "lib/game/competition/scoring.ts")).href;
// Le provider importe en `@/...`, que Node ne resout pas seul : meme loader
// d'alias que check:recap-view.
const LOADER = pathToFileURL(path.join(RACINE, "scripts/typography/alias-loader.mjs")).href;

const probe = `
import { awardPointsFor } from ${JSON.stringify(MODULE)};

const echecs = [];
const eq = (a, b, msg) => { if (a !== b) echecs.push(msg + " (obtenu " + a + ", attendu " + b + ")"); };

// 1. LE MENSONGE NE PAYE PLUS : a mesure serveur egale, le temps declare par le
//    client ne change pas le resultat. On balaie des mesures serveur et deux
//    declarations opposees (0 = "instantane", 999999 = "tres lent").
for (const serveur of [0, 500, 1999, 2000, 5000, 6999, 7000, 7001, 12000]) {
  const menteurRapide = awardPointsFor(true, 0, serveur);
  const menteurLent = awardPointsFor(true, 999999, serveur);
  eq(menteurRapide, menteurLent, "le temps declare par le client change le score a mesure serveur " + serveur + " ms");
}

// 2. La borne serveur est bien la ou on l'attend : dans la fenetre -> +2, au dela -> +1.
eq(awardPointsFor(true, 0, 3000), 2, "une reponse rapide au serveur (3 s) devrait valoir +2");
eq(awardPointsFor(true, 0, 7000), 2, "a la limite de 7 s le bonus tient encore");
eq(awardPointsFor(true, 0, 7001), 1, "au dela de 7 s le bonus tombe a +1");

// 3. Le cas precis du pentest : reponse lente maquillee en instantanee.
//    Reflexion 6 s cote serveur, declaration 0 -> ne doit PAS valoir +2.
eq(awardPointsFor(true, 0, 9000), 1, "une reponse de 9 s declaree instantanee touche encore le bonus");

// 4. Une mauvaise reponse ne vaut jamais rien, quelle que soit la vitesse.
eq(awardPointsFor(false, 0, 100), 0, "une mauvaise reponse rapporte des points");

// 5. Sans mesure serveur (jeton d'avant le tampon, ou doublon en lecture), on
//    retombe sur l'ancien comportement, c'est voulu.
eq(awardPointsFor(true, 1500, null), 2, "le repli sans mesure serveur devrait accorder +2 a une declaration rapide");
eq(awardPointsFor(true, 2500, null), 1, "le repli sans mesure serveur devrait accorder +1 a une declaration lente");

if (echecs.length) { echecs.forEach((e) => console.error("SONDE " + e)); process.exit(1); }
console.log("OK");
`;

const r = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--disable-warning=ExperimentalWarning", "--loader", LOADER, "--input-type=module", "-e", probe],
  { cwd: RACINE, encoding: "utf8" },
);

if (r.status !== 0) {
  console.error("Bonus de vitesse en competition : le score depend encore d'une valeur du client.");
  console.error((r.stderr || r.stdout).trim());
  process.exit(1);
}

console.log(
  "Bonus de vitesse verrouille : a mesure serveur egale le temps declare par le client ne change pas le score, la borne des 7 s tient, et le repli sans mesure reste l'ancien comportement.",
);
