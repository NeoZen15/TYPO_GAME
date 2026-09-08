// The faces a teacher may actually put in an exercise.
//
// READ FROM THE MANIFEST, NEVER WRITTEN BY HAND. A composer that offers a
// family the product cannot serve produces an exercise whose specimen the
// browser invents, which is the one thing this product must never show, and the
// exact fault already caught once on the typeface pages. So the list is the
// manifest filtered to what is active AND has a runtime asset: 23 families
// today, and whatever the manifest says tomorrow.
//
// The manifest also carries something the composer would otherwise have to
// guess: `visualClusterId`, measured in the files. Two faces in one cluster are
// the ones that actually get confused, which is what makes an exercise a
// question rather than a formality.

import manifest from "@/content/typefaces/font-manifest-v4.json";

export type PickableFace = {
  slug: string;
  name: string;
  /** The manifest's own grouping, and the drop-down's groups. */
  category: string;
  subCategory: string;
  /** Faces sharing this are the ones that get mixed up. Measured, not assumed. */
  clusterId: string;
  difficulty: string;
};

const ORDER = ["sans_serif", "serif", "display", "mono"];

export const CATEGORY_LABELS: Record<string, string> = {
  sans_serif: "Sans serif",
  serif: "Serif",
  display: "Display",
  mono: "Monospace",
};

export const PICKABLE_FACES: PickableFace[] = manifest.fonts
  .filter((f) => f.activationStatus && typeof f.runtimePath === "string" && f.runtimePath.length > 0)
  .map((f) => ({
    slug: f.slug,
    name: f.displayName,
    category: f.primaryCategory,
    subCategory: f.subCategory,
    clusterId: f.visualClusterId,
    difficulty: f.difficultyBase,
  }))
  .sort((a, b) => {
    const ga = ORDER.indexOf(a.category);
    const gb = ORDER.indexOf(b.category);
    if (ga !== gb) return (ga === -1 ? 99 : ga) - (gb === -1 ? 99 : gb);
    return a.name.localeCompare(b.name);
  });

const bySlug = new Map(PICKABLE_FACES.map((f) => [f.slug, f]));

export const faceOf = (slug: string): PickableFace | null => bySlug.get(slug) ?? null;

/** The drop-down's groups, in a fixed order. */
export function faceGroups(): { category: string; label: string; faces: PickableFace[] }[] {
  return ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    faces: PICKABLE_FACES.filter((f) => f.category === category),
  })).filter((g) => g.faces.length > 0);
}

/**
 * The pairs among a selection that share a visual cluster.
 *
 * This is the whole reading the composer can honestly offer: an exercise made
 * of faces that look nothing alike is a formality, and one that puts two
 * cluster-mates side by side asks something real. Measured in the files, so it
 * is a fact about the fonts and not a claim about the students.
 */
export function confusablePairs(slugs: readonly string[]): [PickableFace, PickableFace][] {
  const picks = slugs.map(faceOf).filter((f): f is PickableFace => f !== null);
  const out: [PickableFace, PickableFace][] = [];
  for (let i = 0; i < picks.length; i += 1) {
    for (let j = i + 1; j < picks.length; j += 1) {
      if (picks[i].clusterId === picks[j].clusterId) out.push([picks[i], picks[j]]);
    }
  }
  return out;
}
