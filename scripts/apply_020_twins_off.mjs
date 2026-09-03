#!/usr/bin/env node
/**
 * apply_020_twins_off.mjs
 *
 * Applique db/migrations/020_twins_off.sql. A LANCER PAR LE PROPRIETAIRE : le
 * classifieur refuse a l'agent l'ecriture en production, y compris par les
 * outils du plugin neon.
 *
 *   node scripts/apply_020_twins_off.mjs --dry-run
 *   node scripts/apply_020_twins_off.mjs
 *   node scripts/apply_020_twins_off.mjs --rollback
 *
 * UNE SECONDE COMMANDE EST OBLIGATOIRE, et dans le meme commit :
 *
 *   python3 scripts/sync_catalog_activation_json.py
 *
 * Sans elle, content/catalog/typefaces-core.json declare encore ces 285 lignes
 * actives, et le prochain passage de import_catalog_json.py les rallume sans
 * erreur et sans bruit. C'est le piege rencontre en aout sur les 108 Adobe.
 *
 * CE QUE CA CHANGE. 285 polices qui dessinent le meme latin qu'une autre
 * cessent d'etre jouables. Le catalogue passe de 1279 a 994 polices actives.
 * Rien n'est detruit : les lignes gardent fichier, metadonnees et cluster.
 *
 * CE QUI PROTEGE. Trois controles en fin de transaction : 285 lignes eteintes,
 * 994 actives, et le premier pool du debutant qui garde ses 23 polices Adobe.
 * Une transaction qui leve annule tout.
 */

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const ROLLBACK = process.argv.includes("--rollback");
const DRY_RUN = process.argv.includes("--dry-run");
const FICHIER = ROLLBACK
  ? "db/migrations/020_twins_off.rollback.sql"
  : "db/migrations/020_twins_off.sql";

const brut = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m);
if (!brut) { console.error("DATABASE_URL absente de .env.local"); process.exit(1); }
const url = brut[1].replace(/^["']|["']$/g, "");
const sql = neon(url);
console.log(`cible : ${url.match(/@([^/]+)\//)[1]}`);
console.log(`fichier : ${FICHIER}${DRY_RUN ? "  (essai a blanc)" : ""}\n`);

// Decoupage conscient du dollar-quoting.
const decouper = (texte) => {
  const ordres = [];
  let courant = "", balise = null, i = 0;
  while (i < texte.length) {
    if (!balise) {
      const m = /^\$[A-Za-z_]*\$/.exec(texte.slice(i));
      if (m) { balise = m[0]; courant += balise; i += balise.length; continue; }
      if (texte[i] === ";") { ordres.push(courant); courant = ""; i++; continue; }
    } else if (texte.startsWith(balise, i)) {
      courant += balise; i += balise.length; balise = null; continue;
    }
    courant += texte[i]; i++;
  }
  if (courant.trim()) ordres.push(courant);
  return ordres
    .map((o) => o.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n").trim())
    .filter((o) => o.length > 0 && !/^(BEGIN|COMMIT)$/i.test(o));
};

const ordres = decouper(readFileSync(FICHIER, "utf8"));
console.log(`${ordres.length} ordres a jouer`);

const etat = async () => {
  const [x] = await sql`
    SELECT count(*) FILTER (WHERE activation_status)       AS actives,
           count(*) FILTER (WHERE NOT activation_status)   AS eteintes
    FROM typefaces_core`;
  return x;
};

const avant = await etat();
console.log("avant :", JSON.stringify(avant));
if (DRY_RUN) {
  console.log(`\nessai a blanc, rien n'a ete ecrit. Les ${ordres.length} ordres se decoupent bien.`);
  process.exit(0);
}

try {
  await sql.transaction(ordres.map((o) => sql.query(o)));
} catch (e) {
  console.error(`\nECHEC, rien n'a ete ecrit : ${e.message}`);
  process.exit(1);
}

const apres = await etat();
console.log("apres :", JSON.stringify(apres));
console.log(
  `\nAdobe en easy : ${avant.adobe_easy} -> ${apres.adobe_easy}` +
  `, en medium : ${avant.adobe_medium} -> ${apres.adobe_medium}`
);
console.log(
  ROLLBACK
    ? "\nRetour arriere joue. Pense a relancer sync_catalog_activation_json.py --rollback."
    : "\n020 appliquee. LANCE MAINTENANT : python3 scripts/sync_catalog_activation_json.py"
);
