#!/usr/bin/env node
/**
 * check-adobe-migration.mjs
 *
 * Garde la coherence entre les trois endroits qui decrivent les polices Adobe :
 *
 *   content/catalog/adobe-fonts-kit.json   ce que le projet web Adobe sert
 *   app/layout.tsx                          la feuille de style que le navigateur charge
 *   db/migrations/016_...sql                les lignes que le catalogue portera
 *
 * POURQUOI CE GARDE EXISTE. Une police Adobe ne vit pas dans public/fonts : il n'y a
 * aucun fichier a verifier, donc check:font-renderable et check:font-licenses ne
 * voient rien. Le seul lien entre une ligne du catalogue et un rendu a l'ecran est
 * le nom de famille CSS. S'il derive d'un caractere entre la migration et le kit,
 * la police ne s'affiche pas, le navigateur met un repli, et le joueur doit nommer
 * une typo qui n'est pas a l'ecran. C'est exactement le defaut que le garde de
 * couverture latine a corrige pour une autre cause.
 *
 * Il travaille hors ligne : aucun acces reseau, aucun acces base. Le controle qui
 * demande la base, l'existence des lignes visees par un UPDATE, est dans
 * scripts/check_adobe_migration_against_db.mjs et se lance a la main avant d'appliquer.
 */

import { readFileSync } from "node:fs";

const KIT = "content/catalog/adobe-fonts-kit.json";
const LAYOUT = "app/layout.tsx";
const MIGRATION = "db/migrations/016_adobe_catalog_rows.sql";
const RETOUR = "db/migrations/016_adobe_catalog_rows.rollback.sql";
const SCHEMA = "db/migrations/002_catalog_tables.sql";
const ENUMS_015 = "db/migrations/015_adobe_fonts_source.sql";
const COMPETITION = "lib/game/competition/provider.ts";

const echecs = [];
const echec = (regle, detail) => echecs.push(`${regle} : ${detail}`);
const lire = (chemin) => readFileSync(chemin, "utf8");

const kit = JSON.parse(lire(KIT));
const layout = lire(LAYOUT);
const migration = lire(MIGRATION);
const retour = lire(RETOUR);
const schema = lire(SCHEMA);
const enums015 = lire(ENUMS_015);
const competition = lire(COMPETITION);

// --- 1. la feuille chargee par le layout est celle du kit ---
if (!layout.includes(kit.meta.stylesheet) && !layout.includes("ADOBE_KIT_STYLESHEET")) {
  echec("feuille-chargee", `${LAYOUT} ne charge ni ${kit.meta.stylesheet} ni ADOBE_KIT_STYLESHEET`);
}
if (!layout.includes("use.typekit.net")) {
  echec("preconnect", `${LAYOUT} ne preconnecte pas use.typekit.net, chaque police coute un handshake de plus`);
}

// --- 2. les deux valeurs d'enum que la 016 utilise sont bien creees par la 015 ---
for (const valeur of ["'adobe'", "'adobe_fonts'"]) {
  if (!enums015.includes(`ADD VALUE IF NOT EXISTS ${valeur}`)) {
    echec("enum-prerequis", `${ENUMS_015} ne cree pas la valeur ${valeur} dont la 016 se sert`);
  }
}

// --- 3. le pool de competition laisse passer une police servie sans fichier ---
//
// Le pool de competition exige une ligne 'ready' dans font_runtime_assets. Une
// police Adobe n'en a pas et n'en aura jamais. Sans la branche font_source =
// 'adobe', les 108 lignes entrent au catalogue et aucune n'est jouable en
// competition : la migration devient inerte, silencieusement. Ce garde existe
// pour que la suppression de cette branche soit bruyante.
if (!/tc\.font_source::text = 'adobe'\s*\n\s*OR EXISTS \(/.test(competition)) {
  echec(
    "branche-adobe-competition",
    `${COMPETITION} n'a plus la branche font_source = 'adobe' devant l'EXISTS sur font_runtime_assets, les polices Adobe seraient absentes de la competition`
  );
}
// Et elle doit rester dans son propre groupe parenthese. Sans les parentheses,
// `A AND B OR C` sert toute ligne 'adobe' meme desactivee, meme sous licence
// refusee : le OR remonte par dessus tout ce qui precede. C'est le meme piege
// que celui documente dans check-license-guard.mjs pour la clause de licence.
//
// Ecrit en remontant depuis la ligne Adobe plutot qu'en une regex sur le fichier :
// une regex avec quantificateur paresseux traversait la clause de licence plus
// haut et restait verte parenthese retiree. Attrape par mutation, deux fois.
{
  const lignes = competition.split("\n");
  const i = lignes.findIndex((l) => l.includes("tc.font_source::text = 'adobe'"));
  if (i === -1) {
    echec("branche-adobe-introuvable", `${COMPETITION} : ligne font_source = 'adobe' absente`);
  } else {
    let j = i - 1;
    while (j >= 0 && !/^\s*AND\b/.test(lignes[j])) j -= 1;
    if (j < 0 || !/^\s*AND \($/.test(lignes[j])) {
      echec(
        "branche-adobe-parenthesee",
        `${COMPETITION} ligne ${j + 1} : la branche Adobe doit s'ouvrir sur "AND (" seul, trouve "${(lignes[j] ?? "").trim()}". Sans parentheses le OR remonte et sert des lignes desactivees.`
      );
    }
  }
}

// --- 4. la migration couvre exactement les familles du kit ---
const majSlugs = [...migration.matchAll(/^WHERE typeface_slug = '([^']+)';$/gm)].map((m) => m[1]);
const colonnes = migration
  .match(/INSERT INTO typefaces_core \(\n([\s\S]*?)\n\) VALUES/)?.[1]
  .split(",").map((c) => c.trim()).filter(Boolean) ?? [];
if (colonnes.length === 0) echec("structure", `${MIGRATION} n'a aucun INSERT lisible`);
const blocs = [...migration.matchAll(/\) VALUES \(\n([\s\S]*?)\n\)\nON CONFLICT/g)].map((m) => m[1]);

/** Decoupe une liste de valeurs SQL en respectant les quotes doublees. */
const decouper = (bloc) => {
  const out = [];
  let i = 0;
  while (i < bloc.length) {
    if (bloc[i] === "'") {
      let j = i + 1, val = "";
      while (j < bloc.length) {
        if (bloc[j] === "'" && bloc[j + 1] === "'") { val += "'"; j += 2; continue; }
        if (bloc[j] === "'") break;
        val += bloc[j++];
      }
      out.push(val); i = j + 1;
    } else if (/[A-Za-z]/.test(bloc[i])) {
      const mot = bloc.slice(i).match(/^[A-Za-z]+/)[0];
      if (mot !== "jsonb") out.push(mot);
      i += mot.length;
    } else i++;
  }
  return out;
};

const enumsSchema = Object.fromEntries(
  [...schema.matchAll(/CREATE TYPE app\.(\w+) AS ENUM \(([\s\S]*?)\);/g)]
    .map(([, nom, corps]) => [nom, [...corps.matchAll(/'([^']+)'/g)].map((m) => m[1])])
);
enumsSchema.font_source_enum.push("adobe");
enumsSchema.license_type_enum.push("ufl", "adobe_fonts");

const COLONNE_ENUM = {
  primary_category: "primary_category_enum", sub_category: "sub_category_enum",
  dreyfus_tier: "dreyfus_tier_enum", difficulty_base: "difficulty_base_enum",
  rarity_tag: "rarity_tag_enum", font_source: "font_source_enum",
  license_type: "license_type_enum", year_tag: "year_tag_enum",
  weight_structure: "weight_structure_enum", contrast_profile: "contrast_profile_enum",
  aperture_profile: "aperture_profile_enum", qa_status: "qa_status_enum",
};

const familleParSlug = new Map(kit.families.map((f) => [f.typeface_slug, f.css_family]));
const insSlugs = [];

for (const bloc of blocs) {
  const v = decouper(bloc);
  if (v.length !== colonnes.length) {
    echec("arite", `${v[0]} porte ${v.length} valeurs pour ${colonnes.length} colonnes`);
    continue;
  }
  const r = Object.fromEntries(colonnes.map((c, i) => [c, v[i]]));
  insSlugs.push(r.typeface_slug);

  if (!/^[a-z0-9_]+$/.test(r.typeface_slug)) echec("motif-slug", `${r.typeface_slug} viole le CHECK de typefaces_core`);
  if (r.display_name !== r.display_name.trim()) echec("espace-en-trop", `${r.typeface_slug} : nom "${r.display_name}"`);

  for (const [col, nomEnum] of Object.entries(COLONNE_ENUM)) {
    if (!enumsSchema[nomEnum].includes(r[col])) echec("valeur-enum", `${r.typeface_slug} : ${col}=${r[col]} absent de ${nomEnum}`);
  }
  if (!["training", "competition", "expert"].includes(r.min_mode)) echec("min-mode", `${r.typeface_slug} : ${r.min_mode}`);

  let sig;
  try { sig = JSON.parse(r.structural_signature_json); }
  catch { echec("signature-illisible", `${r.typeface_slug}`); continue; }
  if (sig.contrast !== r.contrast_profile) echec("chk-contrast-coherence", `${r.typeface_slug} : ${sig.contrast} vs ${r.contrast_profile}`);
  if (sig.e_aperture !== r.aperture_profile) echec("chk-aperture-coherence", `${r.typeface_slug} : ${sig.e_aperture} vs ${r.aperture_profile}`);
  if (!r.visual_cluster_id.startsWith("cluster_")) echec("cluster", `${r.typeface_slug} : ${r.visual_cluster_id}`);
  if (r.expert_enabled === "true" && !r.display_name_ascii) echec("chk-expert-ascii", `${r.typeface_slug}`);

  const pile = r.fallback_stack.match(/^"([^"]+)", (sans-serif|serif|monospace|cursive)$/);
  if (!pile) { echec("pile-mal-formee", `${r.typeface_slug} : ${r.fallback_stack}`); continue; }
  if (pile[1] !== familleParSlug.get(r.typeface_slug)) {
    echec("famille-css", `${r.typeface_slug} : la migration dit "${pile[1]}", le kit sert "${familleParSlug.get(r.typeface_slug)}"`);
  }
}

const couverts = new Set([...majSlugs, ...insSlugs]);
for (const f of kit.families) {
  if (!couverts.has(f.typeface_slug)) echec("famille-oubliee", `${f.typeface_slug} est servie par le kit mais absente de la migration`);
}
for (const s of couverts) {
  if (!familleParSlug.has(s)) echec("famille-fantome", `${s} est dans la migration mais le kit ne la sert pas`);
}

// --- 5. transactions et retour arriere ---
for (const [nom, txt] of [["016", migration], ["retour", retour]]) {
  const b = (txt.match(/^BEGIN;$/gm) || []).length;
  const c = (txt.match(/^COMMIT;$/gm) || []).length;
  if (b === 0 || b !== c) echec("transaction", `${nom} : ${b} BEGIN pour ${c} COMMIT`);
}
const rendus = [...retour.matchAll(/^WHERE typeface_slug = '([^']+)';$/gm)].map((m) => m[1]).sort();
if (rendus.join() !== [...majSlugs].sort().join()) {
  echec("retour-incomplet", `le retour arriere rend son etat a ${rendus.length} lignes, la 016 en rallume ${majSlugs.length}`);
}
if (!/UPDATE typefaces_core SET[\s\S]*?activation_status = false[\s\S]*?WHERE font_source = 'adobe'/.test(retour)) {
  echec("retour-sans-extinction", "le retour arriere n'eteint pas les lignes creees par la 016");
}

if (echecs.length === 0) {
  console.log(`check:adobe-migration OK, ${kit.families.length} familles du kit couvertes par ${majSlugs.length} UPDATE et ${insSlugs.length} INSERT`);
  process.exit(0);
}
console.error(`check:adobe-migration a trouve ${echecs.length} problemes :`);
for (const e of echecs) console.error(`  ${e}`);
process.exit(1);
