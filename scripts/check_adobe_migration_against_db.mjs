#!/usr/bin/env node
/**
 * check_adobe_migration_against_db.mjs
 *
 * Le controle que scripts/quality/check-adobe-migration.mjs ne peut pas faire :
 * confronter la migration 016 a la vraie base. Il n'est PAS dans npm run quality,
 * la porte doit rester utilisable hors ligne et sans DATABASE_URL.
 *
 * A LANCER A LA MAIN JUSTE AVANT D'APPLIQUER LA 016 :
 *   node scripts/check_adobe_migration_against_db.mjs
 *
 * IL NE FAIT QUE DES SELECT. Aucun INSERT, aucun UPDATE, aucun DDL.
 *
 * CE QU'IL CHERCHE, ET POURQUOI. Un UPDATE dont le WHERE ne matche aucune ligne
 * ne leve pas d'erreur en PostgreSQL : il rapporte zero ligne touchee et la
 * transaction reussit. La migration 014 a ete ecrite avec des slugs normalises,
 * treize d'entre eux n'existaient pas, et rien ne l'aurait signale a l'execution.
 * C'est ce controle la, et lui seul, qui l'aurait attrape.
 */

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const MIGRATION = "db/migrations/016_adobe_catalog_rows.sql";

const brut = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m);
if (!brut) { console.error("DATABASE_URL absente de .env.local"); process.exit(1); }
const sql = neon(brut[1].replace(/^["']|["']$/g, ""));

const migration = readFileSync(MIGRATION, "utf8");
const majSlugs = [...migration.matchAll(/^WHERE typeface_slug = '([^']+)';$/gm)].map((m) => m[1]);
const insSlugs = [...migration.matchAll(/\) VALUES \(\n  '([a-z0-9_]+)'/g)].map((m) => m[1]);

let ko = 0;
const echec = (m) => { console.error(`  ECHEC ${m}`); ko++; };

console.log(`la 016 porte ${majSlugs.length} UPDATE et ${insSlugs.length} INSERT\n`);

// 1. Chaque UPDATE vise-t-il une ligne qui existe ?
const cibles = await sql`
  SELECT typeface_slug, activation_status, font_source::text AS source,
         license_type::text AS licence, primary_category::text AS categorie
  FROM typefaces_core WHERE typeface_slug = ANY(${majSlugs})`;
console.log(`1. cibles des UPDATE presentes : ${cibles.length}/${majSlugs.length}`);
for (const r of cibles) {
  console.log(`   ${r.typeface_slug.padEnd(18)} actif=${r.activation_status} ${r.source}/${r.licence} ${r.categorie}`);
}
for (const s of majSlugs) {
  if (!cibles.some((r) => r.typeface_slug === s)) echec(`${s} n'existe pas, son UPDATE ne toucherait rien`);
}

// 2. Un INSERT tombe-t-il sur une ligne existante ? Le ON CONFLICT le rattrape,
//    mais ecraserait alors une ligne deja revue a la main : il faut le savoir avant.
const collisions = await sql`
  SELECT typeface_slug, qa_status::text AS qa FROM typefaces_core WHERE typeface_slug = ANY(${insSlugs})`;
console.log(`\n2. slugs d'INSERT deja en base : ${collisions.length}`);
for (const c of collisions) console.log(`   ${c.typeface_slug} (qa_status ${c.qa})`);

// 3. Les valeurs d'enum de la 015 sont-elles la ? Sans elles la 016 echoue.
const enums = await sql`
  SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typname IN ('font_source_enum','license_type_enum') ORDER BY t.typname, e.enumsortorder`;
const groupes = {};
for (const e of enums) (groupes[e.typname] ??= []).push(e.enumlabel);
console.log("\n3. valeurs d'enum en base :");
for (const [n, v] of Object.entries(groupes)) console.log(`   ${n} = ${v.join(", ")}`);
const pretes = groupes.font_source_enum?.includes("adobe") && groupes.license_type_enum?.includes("adobe_fonts");
console.log(pretes
  ? "   la 015 est appliquee, la 016 peut passer"
  : "   la 015 n'est PAS appliquee : appliquer la 015 avant la 016, sinon la 016 echoue");

// 4. Ou en est le catalogue, et ou il sera.
const [avant] = await sql`
  SELECT count(*) FILTER (WHERE activation_status) AS actives, count(*) AS total FROM typefaces_core`;
console.log(`\n4. catalogue : ${avant.actives} actives sur ${avant.total}`);
console.log(`   apres la 016 : ${Number(avant.actives) + insSlugs.length + majSlugs.length} actives attendues`);

console.log(ko === 0 ? "\nRIEN A SIGNALER" : `\n${ko} PROBLEMES, ne pas appliquer`);
process.exit(ko === 0 ? 0 : 1);
