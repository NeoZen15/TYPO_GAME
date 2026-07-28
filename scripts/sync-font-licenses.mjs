#!/usr/bin/env node

// Copy the licence text of every self-hosted font next to its files.
//
// Self-hosting a font file is redistributing it. The OFL, Apache 2.0 and UFL all
// require their notice to travel with the copies, so every served directory under
// public/fonts/<slug>/ must carry the licence text of its own family.
//
// The text is never written by this script, only copied byte for byte out of the
// google/fonts snapshot the assets were converted from. Nothing is generated, so
// no legal document can be paraphrased by accident.
//
// Usage:
//   node scripts/sync-font-licenses.mjs
//   node scripts/sync-font-licenses.mjs --snapshot <path-to-google/fonts-clone>
//   node scripts/sync-font-licenses.mjs --snapshot <path> --dry-run
//   node scripts/sync-font-licenses.mjs --fonts-root <path-to-a-font-tree>
//
// The snapshot lives outside the repository, so its location is resolved in three
// steps: the --snapshot flag, then the GOOGLE_FONTS_SNAPSHOT environment variable,
// then the default below, which is where the converted assets came from on the
// machine this catalogue was built on. Any other machine sets the variable instead
// of editing this file.
//
// The result is verified by `npm run check:font-licenses`, which reads only the
// repository and therefore keeps working without the snapshot.

import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const DEFAULT_FONTS_ROOT = path.join(PROJECT_ROOT, "public/fonts");
const TYPEFACES_CATALOG = "content/catalog/typefaces-core.json";

const DEFAULT_SNAPSHOT =
  "/Users/launaymarion/Documents/JEUX_DE_TYPO/02_ASSETS_TYPO/google_fonts/06_repo_snapshot/fonts-main";

// Licence directories of the google/fonts repository, mapped to the label the
// catalogue uses and to the file name we standardise on.
const LICENSE_DIRS = {
  ofl: { label: "ofl", fileName: "OFL.txt" },
  apache: { label: "apache2", fileName: "LICENSE.txt" },
  ufl: { label: "ufl", fileName: "UFL.txt" },
  "cc-by-sa": { label: "cc-by-sa", fileName: "LICENSE.txt" },
};

// Directories under public/fonts that are not a served typeface family.
//
// `staged` is the transient font staging workspace, ignored by git, so it does
// not exist in a fresh clone and never reaches production.
// `brand` holds PP Frama, a proprietary face with no licence file to copy: it is
// the open blocker tracked in the legal section of docs/process/checklist.md.
// `ui` holds Inter, taken from rsms/inter and not from the Google snapshot, so it
// carries its own OFL copy already.
const NON_FAMILY_DIRS = new Set(["staged", "brand", "ui"]);

// Families whose snapshot directory carries no licence file at all. Each entry
// names the verbatim source used instead, and why that source is the right one.
const MISSING_LICENSE_FILE_SOURCES = {
  // The same family under the directory name google/fonts used before the
  // rename. Its OFL.txt opens on "Copyright 2016 The Rounded M+ Project
  // Authors.", byte for byte the copyright string embedded in the font we serve.
  mplusrounded1c: { from: "ofl/roundedmplus1c", fileName: "OFL.txt" },

  // The six jsMath faces declare APACHE2 in METADATA.pb and carry no licence
  // string in their name table. The Apache 2.0 text holds no per-family
  // copyright line and is byte identical across 38 of the 41 apache families of
  // the snapshot, so the canonical copy below is the same text they would ship.
  jsmathcmbx10: { from: "apache/permanentmarker", fileName: "LICENSE.txt" },
  jsmathcmex10: { from: "apache/permanentmarker", fileName: "LICENSE.txt" },
  jsmathcmmi10: { from: "apache/permanentmarker", fileName: "LICENSE.txt" },
  jsmathcmr10: { from: "apache/permanentmarker", fileName: "LICENSE.txt" },
  jsmathcmsy10: { from: "apache/permanentmarker", fileName: "LICENSE.txt" },
  jsmathcmti10: { from: "apache/permanentmarker", fileName: "LICENSE.txt" },
};

const parseArgs = () => {
  const argv = process.argv.slice(2);
  let snapshot = null;
  let fontsRoot = null;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--snapshot") {
      snapshot = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--fonts-root") {
      fontsRoot = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--dry-run") {
      dryRun = true;
    }
  }

  // --fonts-root exists so the licence lands in the tree the font files were just
  // copied into, whatever that tree is. scripts/mirror_fonts.py passes its own
  // --dest, which keeps "a served directory carries its licence" true even when
  // the conversion writes somewhere other than public/fonts.
  return {
    snapshot: path.resolve(snapshot ?? process.env.GOOGLE_FONTS_SNAPSHOT ?? DEFAULT_SNAPSHOT),
    snapshotOrigin: snapshot
      ? "--snapshot"
      : process.env.GOOGLE_FONTS_SNAPSHOT
        ? "GOOGLE_FONTS_SNAPSHOT"
        : "default path",
    fontsRoot: path.resolve(fontsRoot ?? DEFAULT_FONTS_ROOT),
    dryRun,
  };
};

// public/fonts/<slug> and the snapshot family directory do not spell the same
// name: our slugs keep underscores (abril_fatface, roboto_mono) where google/fonts
// concatenates (abrilfatface, robotomono). Comparing on letters and digits only
// is enough to pair them, and any collision would surface as a duplicate key.
const normalizeName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const indexSnapshot = (snapshotRoot) => {
  const index = new Map();
  const collisions = [];

  for (const [licenseDir, { label }] of Object.entries(LICENSE_DIRS)) {
    const licenseRoot = path.join(snapshotRoot, licenseDir);
    if (!fs.existsSync(licenseRoot)) continue;

    for (const family of fs.readdirSync(licenseRoot)) {
      const familyDir = path.join(licenseRoot, family);
      if (!fs.statSync(familyDir).isDirectory()) continue;

      const key = normalizeName(family);
      if (index.has(key)) collisions.push(`${licenseDir}/${family}`);

      index.set(key, { licenseDir, licenseLabel: label, family, familyDir });
    }
  }

  return { index, collisions };
};

const { snapshot, snapshotOrigin, fontsRoot: FONTS_ROOT, dryRun } = parseArgs();

if (!fs.existsSync(snapshot)) {
  console.error(`Snapshot not found (${snapshotOrigin}): ${snapshot}`);
  console.error(
    "The google/fonts clone lives outside the repository. Point at it with --snapshot <path> or set GOOGLE_FONTS_SNAPSHOT."
  );
  process.exit(2);
}

if (!fs.existsSync(FONTS_ROOT)) {
  console.error(`Font directory not found: ${FONTS_ROOT}`);
  process.exit(2);
}

const { index, collisions } = indexSnapshot(snapshot);

if (collisions.length > 0) {
  console.error("Snapshot family names collide once normalised, mapping is not safe:");
  collisions.forEach((entry) => console.error(`- ${entry}`));
  process.exit(1);
}

const catalog = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, TYPEFACES_CATALOG), "utf8")
).records;
const catalogBySlug = new Map(catalog.map((record) => [record.typeface_slug, record]));

const slugs = fs
  .readdirSync(FONTS_ROOT)
  .filter((entry) => fs.statSync(path.join(FONTS_ROOT, entry)).isDirectory())
  .filter((entry) => !NON_FAMILY_DIRS.has(entry))
  .sort();

const written = [];
const unchanged = [];
const failures = [];
const licenseMismatches = [];

for (const slug of slugs) {
  const hit = index.get(normalizeName(slug));

  if (!hit) {
    failures.push(`${slug}: no matching family in the snapshot`);
    continue;
  }

  const override = MISSING_LICENSE_FILE_SOURCES[slug];
  const sourceDir = override ? path.join(snapshot, override.from) : hit.familyDir;
  const candidates = override
    ? [override.fileName]
    : ["OFL.txt", "UFL.txt", "LICENSE.txt", "LICENCE.txt"];

  const sourceName = candidates.find((name) => fs.existsSync(path.join(sourceDir, name)));

  if (!sourceName) {
    failures.push(`${slug}: no licence file to copy in ${path.relative(snapshot, sourceDir)}`);
    continue;
  }

  // The file name we write is driven by the licence, not by the source spelling:
  // the snapshot ships the Ubuntu licence as UFL.txt for three families and as
  // LICENCE.txt for two, and one stable name per licence is what lets the check
  // stay a single rule.
  const targetName = override
    ? override.fileName
    : LICENSE_DIRS[hit.licenseDir].fileName;

  const catalogRecord = catalogBySlug.get(slug);
  if (catalogRecord && catalogRecord.license_type !== hit.licenseLabel) {
    licenseMismatches.push(
      `${slug}: catalogue says "${catalogRecord.license_type}", snapshot ships ${hit.licenseDir}/${sourceName}`
    );
  }

  const source = fs.readFileSync(path.join(sourceDir, sourceName));
  const targetPath = path.join(FONTS_ROOT, slug, targetName);

  if (fs.existsSync(targetPath) && fs.readFileSync(targetPath).equals(source)) {
    unchanged.push(slug);
    continue;
  }

  if (!dryRun) fs.writeFileSync(targetPath, source);
  written.push(`${slug}/${targetName} <- ${path.relative(snapshot, sourceDir)}/${sourceName}`);
}

if (failures.length > 0) {
  console.error("Font licence sync failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

for (const mismatch of licenseMismatches) {
  console.log(`Note: ${mismatch}`);
}

const fontsRootLabel =
  FONTS_ROOT === DEFAULT_FONTS_ROOT ? "public/fonts" : FONTS_ROOT;

console.log(
  `Font licences ${dryRun ? "would be synced" : "synced"} in ${fontsRootLabel}: ${written.length} written, ${unchanged.length} already up to date, ${slugs.length} family directories covered.`
);
