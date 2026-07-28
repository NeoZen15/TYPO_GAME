#!/usr/bin/env node

// Runtime licence guard check. No build, no database, no network.
//
// Two things can silently break the guard: someone edits a pool query and drops
// the licence clause, or someone activates a typeface whose licence is not
// established. This check catches both from the files alone.
//
//   1. lib/game/license-guard.ts still declares the allowlist and the exception.
//   2. Both pool queries (training + competition) still carry the clause built
//      from those two constants.
//   3. Every typeface the runtime could actually serve (activation_status true
//      plus a ready primary runtime asset) passes the guard.

import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();

const GUARD_MODULE = "lib/game/license-guard.ts";
const POOL_QUERY_FILES = [
  "lib/game/training/provider.ts",
  "lib/game/competition/provider.ts",
];
const TYPEFACES_CATALOG = "content/catalog/typefaces-core.json";
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
const allowedLicenseTypes = parseStringArray(guardSource, "RUNTIME_ALLOWED_LICENSE_TYPES");
const uflLegacySlugs = parseStringArray(guardSource, "UFL_LEGACY_SLUGS");

if (!allowedLicenseTypes || allowedLicenseTypes.length === 0) {
  failures.push(`${GUARD_MODULE}: RUNTIME_ALLOWED_LICENSE_TYPES is missing or empty`);
}

if (!uflLegacySlugs) {
  failures.push(`${GUARD_MODULE}: UFL_LEGACY_SLUGS is missing`);
}

// The clause has to sit in the SQL, not in a component: a guard applied at
// display time is a guard somebody can route around.
//
// The surrounding `AND (` and its closing parenthesis are part of the pattern on
// purpose. Without them, a rewrite that dropped the parentheses would turn
// `A AND (B OR C)` into `(A AND B) OR C`, which serves the five UFL slugs even
// when they are deactivated, and this check would still pass.
const LICENSE_CLAUSE_PATTERN =
  /AND \(\s*\n\s*tc\.license_type::text = ANY\(\$\{\[\.\.\.RUNTIME_ALLOWED_LICENSE_TYPES\]\}::text\[\]\)\s*\n\s*OR tc\.typeface_slug = ANY\(\$\{\[\.\.\.UFL_LEGACY_SLUGS\]\}::text\[\]\)\s*\n\s*\)/;

for (const relativePath of POOL_QUERY_FILES) {
  const source = readFile(relativePath);

  if (!source.includes('from "@/lib/game/license-guard"')) {
    failures.push(`${relativePath}: does not import the runtime licence guard`);
    continue;
  }

  if (!LICENSE_CLAUSE_PATTERN.test(source)) {
    failures.push(
      `${relativePath}: pool query is missing the licence clause built from RUNTIME_ALLOWED_LICENSE_TYPES and UFL_LEGACY_SLUGS`
    );
  }
}

// Same decision as isRuntimeLicenseCleared in the guard module.
const isCleared = (licenseType, typefaceSlug) => {
  const normalized = String(licenseType ?? "").trim().toLowerCase();
  if ((allowedLicenseTypes ?? []).includes(normalized)) return true;
  return (uflLegacySlugs ?? []).includes(typefaceSlug);
};

const typefaces = readJson(TYPEFACES_CATALOG).records;
const runtimeAssets = readJson(RUNTIME_ASSETS_CATALOG).records;

const slugsWithReadyAsset = new Set(
  runtimeAssets
    .filter((record) => record.runtime_status === "ready" && record.file_role === "primary")
    .map((record) => record.typeface_slug)
);

const servable = typefaces.filter(
  (record) => record.activation_status === true && slugsWithReadyAsset.has(record.typeface_slug)
);

const blocked = servable.filter(
  (record) => !isCleared(record.license_type, record.typeface_slug)
);

for (const record of blocked) {
  failures.push(
    `${TYPEFACES_CATALOG}: ${record.typeface_slug} is servable (active + ready asset) but its license_type "${record.license_type}" is not cleared for runtime`
  );
}

// A slug exception that no longer matches anything is dead weight, and dead
// weight in a legal guard is exactly what nobody dares to delete later.
const catalogBySlug = new Map(typefaces.map((record) => [record.typeface_slug, record]));

for (const slug of uflLegacySlugs ?? []) {
  const record = catalogBySlug.get(slug);

  if (!record) {
    failures.push(`${GUARD_MODULE}: UFL_LEGACY_SLUGS lists ${slug}, absent from the catalogue`);
    continue;
  }

  if (isCleared(record.license_type, "")) {
    notes.push(
      `${slug} now carries license_type "${record.license_type}", so its UFL_LEGACY_SLUGS exception is no longer needed`
    );
  }
}

if (notes.length === (uflLegacySlugs ?? []).length && notes.length > 0) {
  notes.push(
    `every UFL_LEGACY_SLUGS entry is covered by license_type: the exception list can be emptied in ${GUARD_MODULE}`
  );
}

if (failures.length > 0) {
  console.error("Runtime licence guard violations detected:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

notes.forEach((note) => console.log(`Note: ${note}`));

console.log(
  `Runtime licence guard verified: ${servable.length} servable typefaces, all cleared (allowlist ${(allowedLicenseTypes ?? []).join(", ")}; ${(uflLegacySlugs ?? []).length} slug exceptions).`
);
