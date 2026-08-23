#!/usr/bin/env node
/**
 * apply_017_tail_rarity.mjs
 *
 * Applique db/migrations/017_tail_rarity.sql sur la base pointee par DATABASE_URL.
 *
 * CE QU'ELLE FAIT. 87 polices que la 013 n'a pas pu classer, faute d'ordre chez
 * Google, passent de common a rare. Et Adobe Blank s'eteint : elle porte les 52
 * lettres latines et n'en dessine aucune, l'avance de chaque glyphe vaut zero.
 *
 * A LANCER PAR LE PROPRIETAIRE. Le classifieur refuse a l'agent l'ecriture de
 * masse en production.
 *
 *   node scripts/apply_017_tail_rarity.mjs --dry-run
 *   node scripts/apply_017_tail_rarity.mjs
 *   node scripts/apply_017_tail_rarity.mjs --rollback
 *
 * PAS DE SECONDE COMMANDE CETTE FOIS. content/catalog/typefaces-core.json a deja
 * ete mis en miroir par scripts/build_017_tail_rarity.py, dans le meme commit que
 * la migration. Un reimport ne defera donc rien.
 *
 * CE QUI PROTEGE. Les deux ordres partent dans une seule transaction, close par un
 * controle qui leve si le resultat n'est pas exact. Une transaction qui leve
 * annule tout. Les valeurs attendues sont celles du JSON, calculees hors ligne :
 * 274 common, 1285 uncommon, 577 rare, portee du debutant a 259, Adobe Blank
 * eteinte, et les 108 lignes Adobe intactes a 30 canoniques et 78 variantes.
 */

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const ROLLBACK = process.argv.includes("--rollback");
const DRY_RUN = process.argv.includes("--dry-run");
const FICHIER = ROLLBACK
  ? "db/migrations/017_tail_rarity.rollback.sql"
  : "db/migrations/017_tail_rarity.sql";

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
           count(*) FILTER (WHERE activation_status) AS actives,
           count(*) FILTER (WHERE activation_status AND rarity_tag = 'common'
                             AND dreyfus_tier IN ('N','D')) AS portee_debutant,
           count(*) FILTER (WHERE typeface_slug = 'adobeblank' AND activation_status) AS blank_active
    FROM typefaces_core`;
  return x;
};

const avant = await etat();
console.log("avant :", JSON.stringify(avant));

if (DRY_RUN) {
  console.log("\nessai a blanc, rien n'a ete ecrit.");
  process.exit(0);
}

const controle = ROLLBACK
  ? null
  : `DO $$
DECLARE c int; u int; r int; portee int; blank int; adobe_c int; adobe_u int;
BEGIN
  SELECT count(*) FILTER (WHERE rarity_tag = 'common'),
         count(*) FILTER (WHERE rarity_tag = 'uncommon'),
         count(*) FILTER (WHERE rarity_tag = 'rare'),
         count(*) FILTER (WHERE typeface_slug = 'adobeblank' AND activation_status)
    INTO c, u, r, blank FROM typefaces_core;
  SELECT count(*) INTO portee FROM typefaces_core
    WHERE activation_status AND rarity_tag = 'common' AND dreyfus_tier IN ('N','D');
  SELECT count(*) FILTER (WHERE rarity_tag = 'common'), count(*) FILTER (WHERE rarity_tag = 'uncommon')
    INTO adobe_c, adobe_u FROM typefaces_core WHERE font_source::text = 'adobe';
  IF blank <> 0 THEN
    RAISE EXCEPTION 'ANNULE : Adobe Blank est encore active';
  END IF;
  IF adobe_c <> 30 OR adobe_u <> 78 THEN
    RAISE EXCEPTION 'ANNULE : des lignes Adobe ont ete touchees, attendu 30 et 78, trouve % et %', adobe_c, adobe_u;
  END IF;
  IF c <> 274 OR u <> 1285 OR r <> 577 THEN
    RAISE EXCEPTION 'ANNULE : attendu 274 / 1285 / 577, trouve % / % / %', c, u, r;
  END IF;
  IF portee <> 259 THEN
    RAISE EXCEPTION 'ANNULE : portee du debutant attendue a 259, trouvee %', portee;
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
console.log(`Adobe Blank : ${apres.blank_active === "0" ? "eteinte" : "ENCORE ACTIVE, anormal"}`);
