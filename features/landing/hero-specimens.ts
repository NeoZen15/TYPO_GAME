// The seven faces the landing hero cycles its word through.
//
// This list lives in a plain module, not in LandingExperience.tsx, because both a
// client component and a server component need it. Every export of a "use client"
// module is replaced on the server by a client-reference proxy, so a server
// component importing the slug array from there receives a stub rather than an
// array, and the first .map() on it throws during prerender. A shared module has
// no such boundary: each side imports the real value.
export const HERO_SPECIMENS = [
  { slug: "montserrat", label: "Montserrat" },
  { slug: "libre_baskerville", label: "Libre Baskerville" },
  { slug: "poppins", label: "Poppins" },
  { slug: "pt_serif", label: "PT Serif" },
  { slug: "dm_sans", label: "DM Sans" },
  { slug: "raleway", label: "Raleway" },
  { slug: "roboto", label: "Roboto" },
] as const;

// Kept derived from HERO_SPECIMENS rather than written twice: a preload list that
// drifts from the rotation list is worse than none, it fetches faces nobody paints
// and misses the ones the visitor actually waits for.
export const HERO_SPECIMEN_SLUGS = HERO_SPECIMENS.map((specimen) => specimen.slug);
