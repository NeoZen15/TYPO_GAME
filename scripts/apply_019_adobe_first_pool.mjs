#!/usr/bin/env node
/**
 * apply_019_adobe_first_pool.mjs
 *
 * Applique db/migrations/019_adobe_first_pool.sql. A LANCER PAR LE PROPRIETAIRE :
 * le classifieur refuse a l'agent l'ecriture en production, y compris par les
 * outils du plugin neon.
 *
 *   node scripts/apply_019_adobe_first_pool.mjs --dry-run
 *   node scripts/apply_019_adobe_first_pool.mjs
 *   node scripts/apply_019_adobe_first_pool.mjs --rollback
 *
 * CE QUE CA CHANGE. Le premier pool d'un joueur passe de 8 polices Adobe sur 30
 * a 23, mesure. Deux causes corrigees : les trente polices Adobe `common`
 * etaient toutes en `easy` alors que le pool par defaut demande 18 places en
 * `medium`, et l'ordre de selection departageait par ordre alphabetique, ce qui
 * servait au debutant la lettre A de Google Fonts.
 *
 * DEJA EPROUVE. Les deux sens ont ete joues sur la branche jetable
 * br-small-feather-abfxtdn8 le 2026-08-31, en appelant init_user_pool comme le
 * jeu l'appelle : 23 Adobe sur 30 apres l'aller, 8 sur 30 apres le retour.
 *
 * CE QUI PROTEGE. Un controle en fin de transaction qui annule tout si le compte
 * n'est pas exact. Une transaction qui leve annule tout, donc la verification ne
 * peut pas arriver trop tard.
 *
 * DECOUPAGE. Le fichier contient des corps de fonction en dollar-quoting, donc
 * un simple split(";") les casserait en morceaux invalides. Le decoupeur ci
 * dessous suit les balises $...$ et ne coupe qu'en dehors.
 */

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const ROLLBACK = process.argv.includes("--rollback");
const DRY_RUN = process.argv.includes("--dry-run");
const FICHIER = ROLLBACK
  ? "db/migrations/019_adobe_first_pool.rollback.sql"
  : "db/migrations/019_adobe_first_pool.sql";

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
    SELECT
      count(*) FILTER (WHERE font_source::text = 'adobe' AND difficulty_base = 'easy')   AS adobe_easy,
      count(*) FILTER (WHERE font_source::text = 'adobe' AND difficulty_base = 'medium') AS adobe_medium
    FROM typefaces_core
    WHERE activation_status AND rarity_tag = 'common' AND dreyfus_tier IN ('N','D')`;
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
    ? "\nRetour arriere joue. Le prochain nouveau joueur retrouve 8 polices Adobe sur 30."
    : "\n019 appliquee. Le prochain nouveau joueur recoit 23 polices Adobe sur 30."
);
