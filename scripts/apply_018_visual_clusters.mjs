#!/usr/bin/env node
/**
 * apply_018_visual_clusters.mjs
 *
 * Applique db/migrations/018_visual_clusters.sql. A LANCER PAR LE PROPRIETAIRE :
 * le classifieur refuse a l'agent l'ecriture de masse en production.
 *
 *   node scripts/apply_018_visual_clusters.mjs --dry-run
 *   node scripts/apply_018_visual_clusters.mjs
 *   node scripts/apply_018_visual_clusters.mjs --rollback
 *
 * PAS DE SECONDE COMMANDE. content/catalog/typefaces-core.json a deja ete mis en
 * miroir par scripts/build_visual_clusters.py, dans le meme commit.
 *
 * CE QUI PROTEGE. Un controle en fin de transaction, qui annule tout si le
 * resultat n'est pas exactement celui calcule hors ligne : 42 clusters distincts
 * sur les lignes actives, le plus gros a 185, et aucune ligne active laissee sur
 * un ancien identifiant en _A.
 */

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const ROLLBACK = process.argv.includes("--rollback");
const DRY_RUN = process.argv.includes("--dry-run");
const FICHIER = ROLLBACK
  ? "db/migrations/018_visual_clusters.rollback.sql"
  : "db/migrations/018_visual_clusters.sql";

const brut = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m);
if (!brut) { console.error("DATABASE_URL absente de .env.local"); process.exit(1); }
const url = brut[1].replace(/^["']|["']$/g, "");
const sql = neon(url);
console.log(`cible : ${url.match(/@([^/]+)\//)[1]}`);
console.log(`fichier : ${FICHIER}${DRY_RUN ? "  (essai a blanc)" : ""}\n`);

const ordres = readFileSync(FICHIER, "utf8")
  .split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n")
  .split(";").map((s) => s.trim())
  .filter((s) => s.length > 0 && !/^(BEGIN|COMMIT)$/i.test(s));
console.log(`${ordres.length} ordres a jouer`);

const etat = async () => {
  const [x] = await sql`
    SELECT count(DISTINCT visual_cluster_id) AS clusters,
           max(n) AS plus_gros,
           count(*) FILTER (WHERE ancien) AS restes_anciens
    FROM (
      SELECT visual_cluster_id,
             count(*) OVER (PARTITION BY visual_cluster_id) AS n,
             visual_cluster_id LIKE '%\\_A' AS ancien
      FROM typefaces_core WHERE activation_status
    ) t`;
  return x;
};

const avant = await etat();
console.log("avant :", JSON.stringify(avant));
if (DRY_RUN) { console.log("\nessai a blanc, rien n'a ete ecrit."); process.exit(0); }

const controle = ROLLBACK ? null : `DO $$
DECLARE n int; gros int; anciens int;
BEGIN
  SELECT count(DISTINCT visual_cluster_id) INTO n FROM typefaces_core WHERE activation_status;
  SELECT max(c) INTO gros FROM (
    SELECT count(*) AS c FROM typefaces_core WHERE activation_status GROUP BY visual_cluster_id) t;
  SELECT count(*) INTO anciens FROM typefaces_core
    WHERE activation_status AND visual_cluster_id LIKE '%\\_A';
  IF anciens <> 0 THEN
    RAISE EXCEPTION 'ANNULE : % lignes actives gardent un ancien identifiant de cluster', anciens;
  END IF;
  IF n <> 42 THEN
    RAISE EXCEPTION 'ANNULE : 42 clusters attendus sur les lignes actives, trouve %', n;
  END IF;
  IF gros <> 185 THEN
    RAISE EXCEPTION 'ANNULE : plus gros cluster attendu a 185, trouve %', gros;
  END IF;
END $$`;

try {
  await sql.transaction((controle ? [...ordres, controle] : ordres).map((o) => sql.query(o)));
} catch (e) {
  console.error(`\nECHEC, rien n'a ete ecrit : ${e.message}`);
  process.exit(1);
}

const apres = await etat();
console.log("apres :", JSON.stringify(apres));
console.log(`\nclusters : ${avant.clusters} -> ${apres.clusters}, plus gros ${avant.plus_gros} -> ${apres.plus_gros}`);
