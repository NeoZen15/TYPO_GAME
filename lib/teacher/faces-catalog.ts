import "server-only";

import catalog from "@/content/catalog/typefaces-core.json";
import {
  getRuntimeFontFace,
  getRuntimeFontFamily,
  hasRuntimeFace,
} from "@/lib/game/fonts/runtime-catalog";
import type { FaceScope, FaceTree, PickableFace } from "@/lib/teacher/faces-contracts";

// The faces a teacher may actually put in an exercise, read from the REAL
// catalogue.
//
// WHY THIS MODULE REPLACES lib/teacher/teacher-faces.ts. That file read
// content/typefaces/font-manifest-v4.json, the project's starter list: 28
// entries, 23 servable. The catalogue is content/catalog/typefaces-core.json,
// 2 136 records of which 1 279 are active AND renderable. A composer offering 23
// faces cannot express "travaille les grotesques", and none of the three DWIGGINS
// recommendations has any matter to work with. Measured, not assumed: 813 sans
// serif, 406 serif, 55 mono, 5 display, 9 sub categories, 42 visual clusters.
//
// TWO FILTERS, BOTH MANDATORY. `activation_status`, because a deactivated face is
// not playable (the twin guard turned off every face that draws the same Latin as
// another, migration 020). And `hasRuntimeFace`, because a face without a servable
// asset renders in a fallback font: the browser then invents the letterform and
// the exercise asks a student to name something that is not on screen. That is the
// one fault this product cannot afford, and it has already been caught once.
//
// SERVER ONLY, like the runtime catalogue it reads. The backing JSON is 3.4 MB and
// has no business in a browser bundle. The client receives small rows through
// app/api/teacher/faces, each carrying its own font family and, when the face is
// self hosted, the descriptor to inject before painting it. Adobe faces carry a
// null descriptor on purpose: the project stylesheet in the root layout has
// already declared their family.
//
// FONT RESOLUTION IS NOT DONE HERE. Families and descriptors come from
// lib/game/fonts/runtime-catalog.ts, the single runtime source, which is also
// what check:font-renderable requires of any module that paints a face.

type CatalogRecord = (typeof catalog.records)[number];

const CATEGORY_ORDER = ["sans_serif", "serif", "display", "mono"];

const CATEGORY_LABELS: Record<string, string> = {
  sans_serif: "Sans serif",
  serif: "Serif",
  display: "Display",
  mono: "Monospace",
};

const SUB_LABELS: Record<string, string> = {
  humanist: "Humanist",
  neo_grotesk: "Neo grotesque",
  geometric: "Geometric",
  grotesk: "Grotesque",
  old_style: "Old style",
  transitional: "Transitional",
  didone: "Didone",
  slab: "Slab",
  glyphic: "Glyphic",
};

const label = (map: Record<string, string>, key: string) => {
  const known = map[key];
  if (known) return known;
  // A sub category the map does not know (script, and whatever the catalogue
  // grows next) still comes out written like the others.
  const plain = key.replace(/_/g, " ");
  return plain.charAt(0).toUpperCase() + plain.slice(1);
};

const playable = (record: CatalogRecord) =>
  record.activation_status === true && hasRuntimeFace(record.typeface_slug);

const FACES: CatalogRecord[] = catalog.records.filter(playable);

const bySlug = new Map(FACES.map((record) => [record.typeface_slug, record]));

const toPickable = (record: CatalogRecord): PickableFace => ({
  slug: record.typeface_slug,
  name: record.display_name,
  category: record.primary_category,
  subCategory: record.sub_category,
  cluster: record.visual_cluster_id,
  difficulty: record.difficulty_base,
  rarity: record.rarity_tag,
  fontFamily: getRuntimeFontFamily(record.typeface_slug, record.display_name),
  fontFace: getRuntimeFontFace(record.typeface_slug),
});

/** How many faces are actually playable. The number the teacher is told. */
export const playableCount = () => FACES.length;

/**
 * The family tree, with real counts.
 *
 * The counts matter and are not decoration: "serif" and "didone" do not weigh
 * the same thing, and a teacher choosing a scope has to know whether he just
 * opened 406 faces or 12.
 */
export function faceTree(): FaceTree {
  const byCategory = new Map<string, CatalogRecord[]>();
  for (const record of FACES) {
    const list = byCategory.get(record.primary_category) ?? [];
    list.push(record);
    byCategory.set(record.primary_category, list);
  }

  return [...byCategory.entries()]
    .sort((left, right) => {
      const a = CATEGORY_ORDER.indexOf(left[0]);
      const b = CATEGORY_ORDER.indexOf(right[0]);
      return (a === -1 ? 99 : a) - (b === -1 ? 99 : b);
    })
    .map(([category, records]) => {
      const subs = new Map<string, number>();
      for (const record of records) {
        subs.set(record.sub_category, (subs.get(record.sub_category) ?? 0) + 1);
      }
      return {
        scope: {
          kind: "category" as const,
          key: category,
          label: label(CATEGORY_LABELS, category),
          count: records.length,
        },
        children: [...subs.entries()]
          .sort((left, right) => right[1] - left[1])
          .map(([sub, count]) => ({
            kind: "subcategory" as const,
            key: sub,
            label: label(SUB_LABELS, sub),
            parent: label(CATEGORY_LABELS, category),
            count,
          })),
      };
    });
}

/** Name search. Prefix matches first, because that is how a name is recalled. */
export function searchFaces(query: string, limit = 40): PickableFace[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const scored: { record: CatalogRecord; rank: number }[] = [];
  for (const record of FACES) {
    const name = record.display_name.toLowerCase();
    const at = name.indexOf(needle);
    if (at === -1) continue;
    scored.push({ record, rank: at === 0 ? 0 : 1 });
  }

  return scored
    .sort((left, right) =>
      left.rank !== right.rank
        ? left.rank - right.rank
        : left.record.display_name.localeCompare(right.record.display_name),
    )
    .slice(0, limit)
    .map(({ record }) => toPickable(record));
}

/** A sample of a family branch, so a scope can be shown as specimens too. */
export function facesOfScope(scope: FaceScope, limit = 8): PickableFace[] {
  const matches = (record: CatalogRecord) =>
    scope.kind === "category"
      ? record.primary_category === scope.key
      : record.sub_category === scope.key &&
        // A leaf belongs to its branch: `didone` under serif is not `didone`
        // under mono, and a sample that crosses would show the wrong faces.
        (scope.parent === undefined ||
          label(CATEGORY_LABELS, record.primary_category) === scope.parent);

  return FACES.filter(matches).slice(0, limit).map(toPickable);
}

/** Restore rows for slugs already chosen, in the order asked. */
export function facesBySlugs(slugs: readonly string[]): PickableFace[] {
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((record): record is CatalogRecord => record !== undefined)
    .map(toPickable);
}

/**
 * The pairs among a selection that share a visual cluster.
 *
 * The one reading the composer can honestly offer: an exercise made of faces
 * that look nothing alike is a formality, and one that puts two cluster mates
 * side by side asks something real. Measured in the files, so it is a fact about
 * the fonts and never a claim about the students.
 */
export function confusablePairs(
  slugs: readonly string[],
): { left: string; right: string }[] {
  const picks = slugs
    .map((slug) => bySlug.get(slug))
    .filter((record): record is CatalogRecord => record !== undefined);

  const out: { left: string; right: string }[] = [];
  for (let i = 0; i < picks.length; i += 1) {
    for (let j = i + 1; j < picks.length; j += 1) {
      if (picks[i].visual_cluster_id === picks[j].visual_cluster_id) {
        out.push({ left: picks[i].display_name, right: picks[j].display_name });
      }
    }
  }
  return out;
}
