#!/usr/bin/env node

// Self-hosted font licence check. No build, no database, no network.
//
// Serving a font file from public/fonts is redistributing it, and the three
// licences the catalogue relies on all make the same demand: their notice has to
// travel with the copies. OFL 1.1 section 2, Apache 2.0 section 4 and the Ubuntu
// Font Licence 1.0 each require the text to be included in the distribution.
// So every directory that hosts a font file has to hold its own licence text.
//
// Four things can silently break that, and this check catches all four from the
// files alone.
//
//   1. A new font family lands in public/fonts without its licence.
//   2. A licence file is deleted, renamed, emptied or truncated.
//   3. A licence file is present but is not the licence the catalogue declares
//      for that typeface.
//   4. A typeface the runtime can actually serve has no directory at all.
//
// The texts themselves are copied verbatim from the google/fonts snapshot by
// scripts/sync-font-licenses.mjs. This check never writes and never needs the
// snapshot, so it keeps working on a bare clone.

import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();

const FONTS_DIR = "public/fonts";
const GITIGNORE = ".gitignore";
const GUARD_MODULE = "lib/game/license-guard.ts";
const TYPEFACES_CATALOG = "content/catalog/typefaces-core.json";
const RUNTIME_ASSETS_CATALOG = "content/catalog/font-runtime-assets.json";

const FONT_FILE_PATTERN = /\.(woff2|woff|otf|ttf)$/i;

// One stable file name per licence. The snapshot itself is not consistent (it
// ships the Ubuntu licence as UFL.txt for three families and as LICENCE.txt for
// two), so the sync script normalises the name and this check has a single rule
// to enforce instead of a list of accepted spellings.
//
// `markers` are substrings that must appear once whitespace is collapsed and the
// text uppercased. The second marker of each licence is its closing sentence, so
// a file cut in half fails even though its opening lines look right.
// `minBytes` is a floor well under the smallest real text (OFL 4267, UFL 4673,
// Apache 11358 bytes today), enough to reject an empty or gutted file without
// breaking on legitimate formatting differences.
const LICENSE_FILES = {
  "OFL.txt": {
    licenseType: "ofl",
    // Deliberately not "VERSION 1.1": two served families (jomolhari, uchen) are
    // licensed under OFL 1.0, and their text is just as valid.
    markers: ["OPEN FONT LICENSE", "OTHER DEALINGS IN THE FONT SOFTWARE"],
    minBytes: 3000,
  },
  "LICENSE.txt": {
    licenseType: "apache2",
    markers: ["APACHE LICENSE", "END OF TERMS AND CONDITIONS"],
    minBytes: 9000,
  },
  "UFL.txt": {
    licenseType: "ufl",
    markers: ["UBUNTU FONT LICENCE", "OTHER DEALINGS IN THE FONT SOFTWARE"],
    minBytes: 3000,
  },
};

// Directories under public/fonts that are not a Google Fonts family. Both are
// declared here rather than skipped quietly, because a licence exception nobody
// can see is how the original defect got shipped in the first place.
const NON_FAMILY_DIRS = {
  // Transient font staging workspace. It is ignored by git, so it does not exist
  // in a fresh clone and never reaches production. The ignore rule is verified
  // below: if the directory stops being ignored, it comes back in scope.
  staged: { ignoredBy: "/public/fonts/staged/" },

  // PP Frama, drawn and sold by Pangram Pangram. The font files declare
  // "Pangram Pangram EULA" in their name table and point at
  // pangrampangram.com/pages/eula, a commercial end user agreement that is not
  // distributed with the files, so there is no text to copy here. Serving it to
  // visitors without a webfont licence is the open legal blocker tracked in the
  // legal section of docs/process/checklist.md. Reported as a note on every run.
  brand: {
    note: "public/fonts/brand hosts PP Frama (Pangram Pangram, commercial EULA), which has no redistributable licence text: the webfont licence is still the open blocker in the legal section of docs/process/checklist.md",
  },
};

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

// The five Ubuntu faces still carry license_type "unknown" in the catalogue,
// because the enum has no `ufl` value until migration 010 is applied. The runtime
// guard already lists them by slug, so this check reuses that same list instead
// of inventing a second exception nobody would remember to remove.
const uflLegacySlugs = new Set(
  parseStringArray(readFile(GUARD_MODULE), "UFL_LEGACY_SLUGS") ?? []
);

const gitignore = readFile(GITIGNORE);

const normalize = (text) => text.replace(/\s+/g, " ").trim().toUpperCase();

const catalogBySlug = new Map(
  readJson(TYPEFACES_CATALOG).records.map((record) => [record.typeface_slug, record])
);

const slugsWithReadyAsset = new Set(
  readJson(RUNTIME_ASSETS_CATALOG)
    .records.filter(
      (record) => record.runtime_status === "ready" && record.file_role === "primary"
    )
    .map((record) => record.typeface_slug)
);

const servableSlugs = new Set(
  [...catalogBySlug.values()]
    .filter(
      (record) =>
        record.activation_status === true && slugsWithReadyAsset.has(record.typeface_slug)
    )
    .map((record) => record.typeface_slug)
);

const directories = fs
  .readdirSync(path.join(PROJECT_ROOT, FONTS_DIR))
  .filter((entry) => fs.statSync(path.join(PROJECT_ROOT, FONTS_DIR, entry)).isDirectory())
  .sort();

const licensed = new Set();
const licenseCounts = {};
let emptyDirectories = 0;

for (const directory of directories) {
  const exception = NON_FAMILY_DIRS[directory];

  if (exception?.ignoredBy) {
    if (gitignore.includes(exception.ignoredBy)) continue;

    failures.push(
      `${FONTS_DIR}/${directory}: no longer ignored by git (${exception.ignoredBy} is gone from ${GITIGNORE}), so it now ships and needs a licence like every other directory`
    );
    continue;
  }

  if (exception?.note) {
    notes.push(exception.note);
    continue;
  }

  const directoryPath = path.join(PROJECT_ROOT, FONTS_DIR, directory);
  const entries = fs.readdirSync(directoryPath);

  // Hosting a font file is what triggers the obligation, so a directory holding
  // none of them has nothing to license.
  if (!entries.some((entry) => FONT_FILE_PATTERN.test(entry))) {
    emptyDirectories += 1;
    continue;
  }

  const present = Object.keys(LICENSE_FILES).filter((name) => entries.includes(name));

  if (present.length === 0) {
    failures.push(
      `${FONTS_DIR}/${directory}: hosts font files but carries no licence text (expected one of ${Object.keys(LICENSE_FILES).join(", ")})`
    );
    continue;
  }

  const record = catalogBySlug.get(directory);
  const expected = record
    ? uflLegacySlugs.has(directory) && record.license_type === "unknown"
      ? "ufl"
      : record.license_type
    : null;

  let valid = 0;

  for (const name of present) {
    const spec = LICENSE_FILES[name];
    const filePath = path.join(directoryPath, name);
    const raw = fs.readFileSync(filePath, "utf8");

    if (raw.length < spec.minBytes) {
      failures.push(
        `${FONTS_DIR}/${directory}/${name}: ${raw.length} bytes, under the ${spec.minBytes} byte floor for this licence, so the text is empty or truncated`
      );
      continue;
    }

    const text = normalize(raw);
    const missing = spec.markers.filter((marker) => !text.includes(marker));

    if (missing.length > 0) {
      failures.push(
        `${FONTS_DIR}/${directory}/${name}: does not read as its licence, missing ${missing.map((marker) => `"${marker}"`).join(" and ")}`
      );
      continue;
    }

    valid += 1;
    licenseCounts[spec.licenseType] = (licenseCounts[spec.licenseType] ?? 0) + 1;

    if (expected && expected !== spec.licenseType) {
      failures.push(
        `${FONTS_DIR}/${directory}/${name}: is the ${spec.licenseType} text, but ${TYPEFACES_CATALOG} declares license_type "${record.license_type}" for this typeface`
      );
    }
  }

  if (valid > 0) licensed.add(directory);
}

// A typeface the runtime can serve but that has no directory would be served
// from somewhere this check never looks, so the perimeter is asserted, not
// assumed.
for (const slug of servableSlugs) {
  if (!licensed.has(slug)) {
    failures.push(
      `${TYPEFACES_CATALOG}: ${slug} is servable (active + ready asset) but has no licensed directory under ${FONTS_DIR}`
    );
  }
}

if (emptyDirectories > 0) {
  notes.push(
    `${emptyDirectories} directories under ${FONTS_DIR} hold no font file, so nothing there needs a licence`
  );
}

if (failures.length > 0) {
  console.error("Self-hosted font licence violations detected:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

notes.forEach((note) => console.log(`Note: ${note}`));

const breakdown = Object.entries(licenseCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([licenseType, count]) => `${count} ${licenseType}`)
  .join(", ");

console.log(
  `Self-hosted font licences verified: ${licensed.size} font directories each carrying their licence text (${breakdown}), covering the ${servableSlugs.size} servable typefaces.`
);
