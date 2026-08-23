#!/usr/bin/env node

// Latin coverage guard check. No build, no database, no network.
//
// The game draws a Latin word and asks which typeface draws it, so a face with
// no Latin letters cannot be a question: the browser falls back to another font
// and the player is asked about a typeface that is not on screen. The guard that
// prevents it is a slug list plus one SQL clause per pool query, and three
// things can silently break it.
//
//   1. lib/game/latin-coverage-guard.ts stops declaring the list.
//   2. Someone edits a pool query and drops the exclusion clause.
//   3. A font file changes under the same slug, so the list stops matching what
//      the files actually contain, in either direction.
//
// Case 3 is checked both ways on purpose. A slug on the list that now covers
// Latin is an exclusion with no reason to exist, and dead weight in a guard is
// exactly what nobody dares to delete later (same argument as the licence
// check). A slug off the list that does not cover Latin is the original defect
// coming back.

import fs from "node:fs";
import path from "node:path";
import { openSync as openFontSync } from "fontkit";

const PROJECT_ROOT = process.cwd();

const GUARD_MODULE = "lib/game/latin-coverage-guard.ts";
const POOL_QUERY_FILES = [
  "lib/game/training/provider.ts",
  "lib/game/competition/provider.ts",
];
const RUNTIME_ASSETS_CATALOG = "content/catalog/font-runtime-assets.json";

const failures = [];
const notes = [];

const readFile = (relativePath) =>
  fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");

const readJson = (relativePath) => JSON.parse(readFile(relativePath));

// Parse a `export const NAME = ["a", "b"] as const;` string array out of the
// guard module, so this check reads the same values the engine compiles.
const parseStringArray = (source, name) => {
  const match = new RegExp(
    `export const ${name}\\s*=\\s*\\[([^\\]]*)\\]\\s*as const;`,
    "m"
  ).exec(source);

  if (!match) return null;

  return [...match[1].matchAll(/"([^"]*)"/g)].map((entry) => entry[1]);
};

const guardSource = readFile(GUARD_MODULE);
const latinUnreadySlugs = parseStringArray(guardSource, "LATIN_UNREADY_SLUGS");

if (!latinUnreadySlugs || latinUnreadySlugs.length === 0) {
  failures.push(`${GUARD_MODULE}: LATIN_UNREADY_SLUGS is missing or empty`);
}

// The clause has to sit in the SQL, next to the licence clause, and not in a
// component: a face filtered at render time has already been picked as the
// correct answer or as one of the four options.
const LATIN_CLAUSE_PATTERN =
  /AND tc\.typeface_slug <> ALL\(\$\{\[\.\.\.LATIN_UNREADY_SLUGS\]\}::text\[\]\)/;

for (const relativePath of POOL_QUERY_FILES) {
  const source = readFile(relativePath);

  if (!source.includes('from "@/lib/game/latin-coverage-guard"')) {
    failures.push(`${relativePath}: does not import the latin coverage guard`);
    continue;
  }

  if (!LATIN_CLAUSE_PATTERN.test(source)) {
    failures.push(
      `${relativePath}: pool query is missing the exclusion clause built from LATIN_UNREADY_SLUGS`
    );
  }
}

// The 52 basic Latin letters. A face missing a single one of them cannot draw
// every word of the corpus, so the bar is all of them, not most of them.
const LATIN_CODE_POINTS = [];
for (let codePoint = 0x41; codePoint <= 0x5a; codePoint += 1) {
  LATIN_CODE_POINTS.push(codePoint);
}
for (let codePoint = 0x61; codePoint <= 0x7a; codePoint += 1) {
  LATIN_CODE_POINTS.push(codePoint);
}

const missingLatinLetters = (font) =>
  LATIN_CODE_POINTS.filter((codePoint) => !font.hasGlyphForCodePoint(codePoint));

// Avoir le caractere ne veut pas dire le dessiner. Adobe Blank mappe les 52
// lettres latines sur des glyphes vides : elle passait hasGlyphForCodePoint sans
// tracer un seul trait, et une manche pouvait donc afficher un mot invisible et
// demander au joueur de le reconnaitre. C'est la couverture latine une marche plus
// loin : la police est la, l'encre n'y est pas.
//
// LE TEST PORTE SUR LA CHASSE, PAS SUR LE TRACE, et c'est le fruit d'une mesure,
// pas d'une intuition. Compter les commandes de trace echoue des deux cotes :
// Adobe Blank en a deux, un contour degenere, donc elle passait ; et Reem Kufi Fun
// comme Sixtyfour Convergence en ont zero parce qu'elles dessinent par calques de
// couleur, donc elles etaient accusees a tort. Mesure sur les quatre polices :
//   adobeblank            avance 0     commandes 2
//   reemkufifun           avance 700   commandes 0
//   sixtyfourconvergence  avance 1024  commandes 0
//   inter                 avance 1413  commandes 18
// Une lettre qui n'avance pas le curseur n'occupe aucune place sur la ligne. Aucune
// police reelle ne fait ca sur A, e ou M.
//
// Cinq lettres suffisent : une police a laquelle l'encre manque la manque partout,
// et rouvrir 1172 fichiers coute deja assez cher.
const INK_SAMPLE = ["A", "e", "g", "M", "s"].map((c) => c.codePointAt(0));

const inklessLatinLetters = (font) =>
  INK_SAMPLE.filter((codePoint) => {
    try {
      const glyph = font.glyphForCodePoint(codePoint);
      return !glyph || glyph.advanceWidth === 0;
    } catch {
      return false; // illisible ici, la couverture latine plus haut a deja tranche
    }
  }).map((codePoint) => String.fromCodePoint(codePoint));

const excludedSlugs = new Set(latinUnreadySlugs ?? []);

// Le test d'encre ne porte que sur les lignes ACTIVES. Une ligne eteinte ne sort
// d'aucun pool, donc son absence d'encre ne peut atteindre personne, et c'est
// justement la reparation que le message recommande. Sans ce filtre le garde
// resterait rouge apres la reparation, ce qui apprend a l'ignorer.
const activeSlugs = new Set(
  readJson("content/catalog/typefaces-core.json")
    .records.filter((record) => record.activation_status === true)
    .map((record) => record.typeface_slug)
);
const servedAssets = readJson(RUNTIME_ASSETS_CATALOG).records.filter(
  (record) => record.runtime_status === "ready" && record.file_role === "primary"
);

const seenExcludedSlugs = new Set();
let coveringCount = 0;

for (const asset of servedAssets) {
  const absolutePath = path.join(PROJECT_ROOT, asset.source_path);

  if (!fs.existsSync(absolutePath)) {
    failures.push(
      `${RUNTIME_ASSETS_CATALOG}: ${asset.typeface_slug} points at ${asset.source_path}, which does not exist`
    );
    continue;
  }

  const actualSize = fs.statSync(absolutePath).size;
  if (actualSize !== asset.file_size_bytes) {
    failures.push(
      `${asset.source_path}: ${asset.typeface_slug} is ${actualSize} bytes, catalogue says ${asset.file_size_bytes}`
    );
    continue;
  }

  let missing;
  try {
    missing = missingLatinLetters(openFontSync(absolutePath));
  } catch (error) {
    failures.push(
      `${asset.source_path}: ${asset.typeface_slug} could not be opened by fontkit (${error.message})`
    );
    continue;
  }

  if (excludedSlugs.has(asset.typeface_slug)) {
    seenExcludedSlugs.add(asset.typeface_slug);

    if (missing.length === 0) {
      failures.push(
        `${GUARD_MODULE}: LATIN_UNREADY_SLUGS lists ${asset.typeface_slug}, but its served asset now covers the 52 basic Latin letters, so the exclusion has no reason to exist`
      );
    }

    continue;
  }

  if (missing.length > 0) {
    failures.push(
      `${asset.source_path}: ${asset.typeface_slug} is servable but misses ${missing.length} of the 52 basic Latin letters, so a round could ask about a typeface the browser never draws (add it to LATIN_UNREADY_SLUGS in ${GUARD_MODULE})`
    );
    continue;
  }

  const inkless = activeSlugs.has(asset.typeface_slug)
    ? inklessLatinLetters(openFontSync(absolutePath))
    : [];
  if (inkless.length > 0) {
    failures.push(
      `${asset.source_path}: ${asset.typeface_slug} carries the Latin letters but draws nothing for ${inkless.join(", ")}, so a round would show an empty word and ask the player to name it. Deactivate the row rather than excluding it: a typeface with no ink is not a typeface to recognise.`
    );
    continue;
  }

  coveringCount += 1;
}

for (const slug of latinUnreadySlugs ?? []) {
  if (!seenExcludedSlugs.has(slug)) {
    notes.push(
      `${slug} is listed in LATIN_UNREADY_SLUGS but has no ready primary runtime asset, so nothing serves it today`
    );
  }
}

if (failures.length > 0) {
  console.error("Latin coverage guard violations detected:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

notes.forEach((note) => console.log(`Note: ${note}`));

console.log(
  `Latin coverage guard verified: ${coveringCount} servable faces covering the 52 basic Latin letters, ${seenExcludedSlugs.size} excluded from the pools (of ${servedAssets.length} served assets).`
);
