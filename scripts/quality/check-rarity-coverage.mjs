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
//
// SECOND DEFAUT QU'IL PROTEGE, ajoute le 2026-08-19. Le script generateur
// normalise les noms Google ("Open Sans" -> "opensans") pour apparier les
// familles, mais le catalogue garde parfois un slug avec tiret bas
// ("open_sans"). Un bug d'appariement avait fait ecrire 13 des 23 ordres de la
// migration 014 vers des cles normalisees qui n'existent nulle part dans le
// catalogue (abrilfatface, opensans, playfairdisplay...), et ce garde ne s'en
// apercevait pas : rien ici ne verifiait que les slugs vises existent vraiment.
// Applique en l'etat, la migration aurait rempli 10 designers sur 23 sans
// erreur ni avertissement. D'ou le controle plus bas, qui croise CHAQUE slug
// vise par 013 et par 014 avec la liste reelle du catalogue.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATION = "db/migrations/013_rarity_from_popularity.sql";
const CATALOGUE = "content/catalog/typefaces-core.json";
const failures = [];

function slugsInconnus(sql, slugsConnus) {
  const vises = new Set();
  for (const m of sql.matchAll(/typeface_slug\s*=\s*'([^']+)'/g)) {
    vises.add(m[1]);
  }
  return [...vises].filter((slug) => !slugsConnus.has(slug)).sort();
}

function chargerSlugsConnus() {
  const cheminCatalogue = path.join(ROOT, CATALOGUE);
  const catalogue = JSON.parse(fs.readFileSync(cheminCatalogue, "utf8"));
  return new Set(catalogue.records.map((r) => r.typeface_slug));
}

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

const slugsConnus = chargerSlugsConnus();
const inconnus013 = slugsInconnus(sql, slugsConnus);
if (inconnus013.length > 0) {
  failures.push(
    `${MIGRATION}: ${inconnus013.length} slug(s) absent(s) du catalogue (${CATALOGUE}) : ` +
      `${inconnus013.join(", ")}. Une cle qui n'existe pas ne met a jour aucune ligne, ` +
      "sans erreur ni avertissement."
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

// La migration des designers, quand elle existe, ne doit toucher que ce champ.
const MIGRATION_DESIGNERS = "db/migrations/014_designers_from_metadata.sql";
const cheminDesigners = path.join(ROOT, MIGRATION_DESIGNERS);
if (fs.existsSync(cheminDesigners)) {
  const sqlDesigners = fs.readFileSync(cheminDesigners, "utf8");
  const updates = [...sqlDesigners.matchAll(/SET designer = /g)].length;
  if (updates === 0) {
    failures.push(`${MIGRATION_DESIGNERS}: aucun UPDATE de designer.`);
  }
  if (/rarity_tag|DELETE|DROP|TRUNCATE|ALTER TABLE/i.test(sqlDesigners)) {
    failures.push(
      `${MIGRATION_DESIGNERS}: touche autre chose que designer. Une migration par colonne, ` +
        "sinon le proprietaire ne peut pas accepter l'une en refusant l'autre."
    );
  }
  const inconnusDesigners = slugsInconnus(sqlDesigners, slugsConnus);
  if (inconnusDesigners.length > 0) {
    failures.push(
      `${MIGRATION_DESIGNERS}: ${inconnusDesigners.length} slug(s) absent(s) du catalogue ` +
        `(${CATALOGUE}) : ${inconnusDesigners.join(", ")}. Une cle qui n'existe pas ne met a ` +
        "jour aucune ligne, sans erreur ni avertissement."
    );
  }
  console.log(`  et ${updates} designer(s) dans ${MIGRATION_DESIGNERS}.`);
}

if (failures.length > 0) {
  console.error("check:rarity-coverage FAILED\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}
