import type { TrainingFocus } from "@/lib/profile/objectives";

// La consigne d'orientation qu'un bouton Play it du Path confie au demarrage
// d'une seance (docs/product/spec-objectifs-joueur.md, section 4).
//
// MODULE PUR, et c'est voulu. check:focus-bias l'importe tel quel avec Node, qui
// efface les types mais ne resout pas l'alias "@/" : le seul import permis est un
// import de type, que Node retire entierement. contracts.ts le reexporte.
//
// UNE CONSIGNE MAL FORMEE EST IGNOREE, JAMAIS REFUSEE. Elle traverse le reseau
// depuis une URL que n'importe qui peut ecrire, et une consigne n'est qu'une
// orientation : la perdre rend la seance ordinaire, la refuser rendrait une
// erreur sur un simple chargement de page. Tout ce qui n'est pas exactement la
// forme attendue vaut donc null, et seuls les champs valides sont recopies.

export type { TrainingFocus };

const PALIER_ID_PATTERN = /^\d\.\d$/;
const FACE_SLUG_PATTERN = /^[a-z0-9_]{1,80}$/;
const MIN_FOCUS_FACES = 2;
const MAX_FOCUS_FACES = 6;

export const normalizeFocus = (value: unknown): TrainingFocus | null => {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { kind?: unknown; id?: unknown; slugs?: unknown };

  if (candidate.kind === "palier") {
    return typeof candidate.id === "string" && PALIER_ID_PATTERN.test(candidate.id)
      ? { kind: "palier", id: candidate.id }
      : null;
  }

  if (candidate.kind === "faces") {
    if (!Array.isArray(candidate.slugs)) return null;
    const slugs: unknown[] = candidate.slugs;
    if (!slugs.every((slug) => typeof slug === "string" && FACE_SLUG_PATTERN.test(slug))) {
      return null;
    }
    const unique = [...new Set(slugs as string[])];
    return unique.length >= MIN_FOCUS_FACES && unique.length <= MAX_FOCUS_FACES
      ? { kind: "faces", slugs: unique }
      : null;
  }

  return null;
};
