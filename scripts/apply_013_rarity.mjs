#!/usr/bin/env node
/**
 * apply_013_rarity.mjs
 *
 * Applique db/migrations/013_rarity_from_popularity.sql sur la base pointee par
 * DATABASE_URL. La notoriete devient l'axe de progression : les polices connues
 * restent atteignables des le debut, les obscures reculent en uncommon et rare.
 *
 * A LANCER PAR LE PROPRIETAIRE. Le classifieur de permissions refuse a l'agent
 * toute ecriture de masse en production, par le shell comme par l'outil Neon.
 *
 *   node scripts/apply_013_rarity.mjs            applique
 *   node scripts/apply_013_rarity.mjs --dry-run  n'ecrit rien, montre l'effet
 *   node scripts/apply_013_rarity.mjs --rollback rejoue 013_...rollback.sql
 *
 * CE QUI PROTEGE. Les 1090 ordres partent dans UNE transaction, close par un
 * controle qui leve si le resultat n'est pas exactement celui attendu. Une
 * transaction qui leve annule tout, donc la verification ne peut pas arriver
 * trop tard. Le controle porte sur trois choses :
 *   - aucune ligne Adobe touchee : 30 canoniques et 78 variantes, inchangees
 *   - au moins 357 uncommon et 490 rare hors Adobe
 *   - la portee du debutant atterrit sur 355, mesuree avant application
 *
 * VERIFIE LE 2026-08-23 sur la base reelle, en lecture seule : les 1090 slugs
 * existent tous, aucun n'est une ligne Adobe, et le retour arriere couvre les
 * 1090. Le premier pool d'un joueur neuf gagne Helvetica LT Pro, Futura PT,
 * Gill Sans Nova, Franklin Gothic, Impact, Eurostile et ITC Avant Garde Gothic,
 * et perd Alumni Sans Inline One, Chocolate Classical Sans et Black Han Sans.
 *
 * APRES APPLICATION, lancer scripts/sync_catalog_rarity_json.py pour que
 * content/catalog/typefaces-core.json suive : sans ca, le prochain reimport
 * annulerait la migration en silence.
 */

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const ROLLBACK = process.argv.includes("--rollback");
const DRY_RUN = process.argv.includes("--dry-run");
const FICHIER = ROLLBACK
  ? "db/migrations/013_rarity_from_popularity.rollback.sql"
  : "db/migrations/013_rarity_from_popularity.sql";

const brut = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m);
if (!brut) {
  console.error("DATABASE_URL absente de .env.local");
  process.exit(1);
}
const url = brut[1].replace(/^["']|["']$/g, "");
const sql = neon(url);
console.log(`cible : ${url.match(/@([^/]+)\//)[1]}`);
console.log(`fichier : ${FICHIER}${DRY_RUN ? "  (essai a blanc)" : ""}\n`);

const ordres = readFileSync(FICHIER, "utf8")
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !/^(BEGIN|COMMIT)$/i.test(s));
console.log(`${ordres.length} ordres a jouer`);

const etat = async () => {
  const [x] = await sql`
    SELECT count(*) FILTER (WHERE rarity_tag = 'common') AS communes,
           count(*) FILTER (WHERE rarity_tag = 'uncommon') AS peu_communes,
           count(*) FILTER (WHERE rarity_tag = 'rare') AS rares,
           count(*) FILTER (WHERE activation_status AND rarity_tag = 'common'
                             AND dreyfus_tier IN ('N','D')) AS portee_debutant,
           count(*) FILTER (WHERE font_source::text = 'adobe' AND rarity_tag = 'common') AS adobe_canoniques,
           count(*) FILTER (WHERE font_source::text = 'adobe' AND rarity_tag = 'uncommon') AS adobe_variantes
    FROM typefaces_core`;
  return x;
};

const avant = await etat();
console.log("avant :", JSON.stringify(avant));

if (DRY_RUN) {
  console.log("\nessai a blanc, rien n'a ete ecrit.");
  process.exit(0);
}

// Une seule transaction. sql.transaction() de @neondatabase/serverless envoie
// le lot en BEGIN ... COMMIT cote serveur : si le controle final leve, tout est
// annule, y compris les 1090 UPDATE qui precedent.
const controle = ROLLBACK
  ? null
  : `DO $$
DECLARE u int; r int; adobe_c int; adobe_u int; portee int;
BEGIN
  SELECT count(*) FILTER (WHERE rarity_tag = 'uncommon'), count(*) FILTER (WHERE rarity_tag = 'rare')
    INTO u, r FROM typefaces_core WHERE font_source::text <> 'adobe';
  SELECT count(*) FILTER (WHERE rarity_tag = 'common'), count(*) FILTER (WHERE rarity_tag = 'uncommon')
    INTO adobe_c, adobe_u FROM typefaces_core WHERE font_source::text = 'adobe';
  SELECT count(*) INTO portee FROM typefaces_core
    WHERE activation_status AND rarity_tag = 'common' AND dreyfus_tier IN ('N','D');
  IF adobe_c <> 30 OR adobe_u <> 78 THEN
    RAISE EXCEPTION 'ANNULE : des lignes Adobe ont ete touchees, attendu 30 et 78, trouve % et %', adobe_c, adobe_u;
  END IF;
  IF u < 357 OR r < 490 THEN
    RAISE EXCEPTION 'ANNULE : attendu au moins 357 uncommon et 490 rare hors Adobe, trouve % et %', u, r;
  END IF;
  IF portee <> 355 THEN
    RAISE EXCEPTION 'ANNULE : portee du debutant attendue a 355, trouvee %', portee;
  END IF;
END $$`;

const lot = controle ? [...ordres, controle] : ordres;
try {
  await sql.transaction(lot.map((o) => sql.query(o)));
} catch (e) {
  console.error(`\nECHEC, rien n'a ete ecrit : ${e.message}`);
  process.exit(1);
}

const apres = await etat();
console.log("apres :", JSON.stringify(apres));
console.log(`\nportee du debutant : ${avant.portee_debutant} -> ${apres.portee_debutant}`);
console.log(`lignes Adobe : ${apres.adobe_canoniques} canoniques et ${apres.adobe_variantes} variantes, inchangees`);
if (!ROLLBACK) {
  console.log("\nA FAIRE MAINTENANT : ./.venv/bin/python scripts/sync_catalog_rarity_json.py");
  console.log("sans quoi le prochain reimport du catalogue annulerait cette migration.");
}
