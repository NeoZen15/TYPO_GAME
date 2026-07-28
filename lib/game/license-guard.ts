// Runtime licence guard. Single source of truth for "may this typeface be shown
// to a player at all".
//
// Legal rule: the site is meant to go live, so a typeface whose licence is not
// established must never reach a player. typefaces_core.license_type is
// NOT NULL DEFAULT 'unknown' (db/migrations/002_catalog_tables.sql), which means
// a row nobody filled in reads as 'unknown', and 'unknown' is exactly the case
// we have to refuse. The guard is therefore an ALLOWLIST of libre licences, not
// a denylist of bad ones: null, empty string, 'unknown', 'proprietary' or any
// label added later all fail closed until somebody decides otherwise.
//
// Enforced in the data access layer, inside the two pool queries that decide
// which typefaces a player can be served (correct answer and distractors alike):
//   lib/game/training/provider.ts     getPoolRows
//   lib/game/competition/provider.ts  getCompetitionPoolRows
// Both compare license_type::text, never the enum label itself, so adding 'ufl'
// to the allowlist cannot break the query while the enum still lacks that label.

export const RUNTIME_ALLOWED_LICENSE_TYPES = ["ofl", "apache2", "ufl"] as const;

// The Ubuntu family is published under the Ubuntu Font Licence 1.0, a libre
// licence with commercial use allowed. Verified in the project snapshot
// 02_ASSETS_TYPO/google_fonts/06_repo_snapshot/fonts-main: the five slugs below
// are the entire content of its ufl/ folder, each one carrying LICENCE.txt
// (UBUNTU FONT LICENCE Version 1.0) and METADATA.pb with license: "UFL".
//
// app.license_type_enum has no 'ufl' label yet, so these five rows still store
// 'unknown' and the allowlist alone would drop them by mistake. This slug
// exception keeps them servable without loosening the guard for anything else.
// db/migrations/010_license_type_ufl.sql adds the label and moves the five rows
// to 'ufl'. Once that migration is applied, this list can be emptied.
export const UFL_LEGACY_SLUGS = [
  "ubuntu",
  "ubuntucondensed",
  "ubuntumono",
  "ubuntusans",
  "ubuntusansmono",
] as const;

// Same decision as the SQL clause, for anything that has already loaded a row
// (catalogue checks, future specimen pages). Kept in sync with the queries by
// scripts/quality/check-license-guard.mjs.
export const isRuntimeLicenseCleared = (
  licenseType: string | null | undefined,
  typefaceSlug: string
): boolean => {
  const normalized = (licenseType ?? "").trim().toLowerCase();

  if ((RUNTIME_ALLOWED_LICENSE_TYPES as readonly string[]).includes(normalized)) {
    return true;
  }

  return (UFL_LEGACY_SLUGS as readonly string[]).includes(typefaceSlug);
};
