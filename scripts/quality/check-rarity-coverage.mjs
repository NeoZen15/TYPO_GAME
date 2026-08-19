// Garde de la repartition de rarity_tag.
//
// LE DEFAUT QU'IL PROTEGE. Mesure du 2026-08-19 : 1148 polices actives sur 1172
// portaient rarity_tag = common et 24 uncommon, zero rare. Autrement dit la
// colonne existait et ne disait rien, donc le constructeur de questions ne
// pouvait pas servir les connues avant les obscures.
//
// Il lit le fichier de migration, pas la base : la base demande le feu vert du
// proprietaire et un garde ne doit pas dependre d'une connexion reseau. Ce qu'il
// verifie, c'est que la migration produite couvre les trois paliers et une part
// serieuse du catalogue.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATION = "db/migrations/013_rarity_from_popularity.sql";
const failures = [];

const chemin = path.join(ROOT, MIGRATION);
if (!fs.existsSync(chemin)) {
  console.log(
    `check:rarity-coverage OK : ${MIGRATION} absent, le classement n'a pas encore ete construit. ` +
      "Lancer npm run build:rarity pour le produire."
  );
  process.exit(0);
}

const sql = fs.readFileSync(chemin, "utf8");
const comptes = { common: 0, uncommon: 0, rare: 0 };
for (const m of sql.matchAll(/SET rarity_tag = '(common|uncommon|rare)'/g)) {
  comptes[m[1]] += 1;
}
const total = comptes.common + comptes.uncommon + comptes.rare;

for (const palier of ["common", "uncommon", "rare"]) {
  if (comptes[palier] === 0) {
    failures.push(
      `${MIGRATION}: aucun UPDATE vers '${palier}'. Les trois paliers doivent etre ` +
        "servis, sinon la progression n'a rien a ordonner."
    );
  }
}

if (total < 800) {
  failures.push(
    `${MIGRATION}: ${total} polices classees seulement. Le catalogue compte 1172 actives, ` +
      "un classement qui en couvre moins de 800 laisse la majorite sans notoriete."
  );
}

if (/DELETE|DROP|TRUNCATE|ALTER TABLE/i.test(sql)) {
  failures.push(
    `${MIGRATION}: contient une instruction destructrice. Ce fichier ne doit faire que des ` +
      "UPDATE de rarity_tag."
  );
}

if (failures.length > 0) {
  console.error("check:rarity-coverage FAILED\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(
  `check:rarity-coverage OK : ${total} polices classees, ` +
    `${comptes.common} common, ${comptes.uncommon} uncommon, ${comptes.rare} rare.`
);
