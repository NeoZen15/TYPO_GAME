import type { MetadataRoute } from "next";

// CE QUI NE DOIT PAS ETRE INDEXE, ET POURQUOI.
//
// Pose par scripts/conformite/conformite.py.
//
// `/admin` lit l'usage reel du produit et des demandes d'acces, donc des noms et
// des adresses. `/dev` expose les outils du laboratoire typographique. `/api`
// n'a rien a faire dans un moteur de recherche. `/assigned` porte le devoir d'un
// eleve, adresse par adresse : une adresse indexee est un devoir lisible par
// n'importe qui.
//
// Une consigne d'indexation n'est PAS un controle d'acces : elle demande, elle
// n'empeche pas. La porte de `/admin` est dans lib/admin/gate.ts, celle des
// routes de developpement dans lib/dev-mode.ts. Ce fichier evite la fuite la plus
// betement evitable, celle qui ne demande aucune competence.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/dev", "/assigned", "/sign-in"],
      },
    ],
  };
}
