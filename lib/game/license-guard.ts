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

// UNE QUATRIEME LICENCE AUTORISEE, ET PAS UN TROU DANS LA CLAUSE.
//
// Les trois premieres autorisent l'AUTO-HEBERGEMENT : le fichier est a nous, nous
// le servons, et la licence dit que nous en avons le droit. La quatrieme dit autre
// chose : le fichier n'est pas a nous, il reste chez Adobe, et le droit de
// l'afficher vient d'un abonnement Creative Cloud actif plus le projet web qui le
// sert depuis leur CDN. Leurs conditions interdisent explicitement de telecharger
// et d'heberger ces fichiers, ce que ce projet ne fait jamais.
//
// POURQUOI CETTE FORME PLUTOT QU'UNE EXCEPTION DANS LA REQUETE. La clause SQL des
// deux requetes de pool est verifiee au caractere pres par
// scripts/quality/check-license-guard.mjs, et son jumeau SQL par
// check-pool-serialisation.mjs. Ajouter une porte a cote de la clause aurait
// signifie desarmer le motif que ces deux gardes surveillent. En passant par une
// valeur de licence de plus, la clause reste identique, les deux gardes gardent
// exactement ce qu'ils gardaient, et le mecanisme n'est pas affaibli.
//
// CE QUE CELA NE DEBLOQUE PAS, et c'est la propriete de surete a retenir : aucune
// police aujourd'hui refusee ne devient servable par accident. Seules les lignes
// dont quelqu'un a explicitement pose license_type a 'adobe_fonts' passent, et
// aucune ligne du catalogue ne porte cette valeur avant qu'on l'y mette. Times New
// Roman en 'proprietary' reste bloquee ; Times New Roman servie par Adobe est une
// autre ligne, avec une autre licence.
//
// LE JOUR OU L'ABONNEMENT S'ARRETE, ces polices cessent de s'afficher et le
// navigateur les remplace. Le jeu doit donc les traiter comme une couche qui peut
// disparaitre, jamais comme son socle. Le socle reste les polices libres, qui sont
// des fichiers a nous et marcheront sans rien payer.
export const RUNTIME_ALLOWED_LICENSE_TYPES = ["ofl", "apache2", "ufl", "adobe_fonts"] as const;

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
