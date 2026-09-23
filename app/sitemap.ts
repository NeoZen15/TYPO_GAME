import type { MetadataRoute } from "next";

// LES PAGES PUBLIQUES, ET RIEN D'AUTRE.
//
// Pose par scripts/conformite/conformite.py.
//
// Volontairement tenu a la main plutot que derive des routes : `app/` contient
// des routes d'administration, de developpement et de devoir, et une generation
// automatique les ferait entrer ici au premier ajout. Une liste courte qu'on
// met a jour est plus sure qu'une liste complete qu'on ne relit jamais.
//
// L'adresse de base vient de l'environnement pour que le fichier ne fige pas un
// domaine que le proprietaire pourrait changer.
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dwiggins.fr";

const PAGES = [
  "/",
  "/play",
  "/compare",
  "/legal/mentions-legales",
  "/legal/confidentialite",
  "/legal/cgu",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const maintenant = new Date();
  return PAGES.map((chemin) => ({
    url: `${BASE}${chemin}`,
    lastModified: maintenant,
  }));
}
