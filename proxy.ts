import { NextResponse, type NextRequest } from "next/server";

import { isClerkConfigured } from "@/lib/server/clerk-availability";
import { cleDAppelant, consommer, seuilPour } from "@/lib/server/rate-limit";
import { origineAcceptee } from "@/lib/server/request-origin";

// `proxy.ts` ET NON `middleware.ts`. Next 16 a renomme la convention : le
// serveur de dev le dit lui meme, « The "middleware" file convention is
// deprecated. Please use "proxy" instead ». Le fichier tournait quand meme, Next
// acceptant encore l'ancien nom, mais un avertissement a chaque demarrage est un
// avertissement qu'on finit par ne plus lire. Contenu identique.
//
// CE PROXY NE FAIT RIEN TANT QUE CLERK N'EST PAS CONFIGURE, et c'est
// deliberé. `clerkMiddleware()` jette sans cles, donc un middleware qui
// l'appellerait sans condition rendrait le site entier inaccessible le temps que
// le proprietaire cree son application Clerk. Le produit ne doit pas dependre
// d'une action qu'il est seul a pouvoir faire.
//
// AUCUNE ROUTE N'EST PROTEGEE ICI. La protection ne vient pas d'un tapis de
// redirections mais des donnees : la porte de lecture professeur borne chaque
// requete au professeur qui demande, et une session assignee verifie que l'eleve
// est destinataire. Un middleware qui garderait `/teacher` sans ces bornes
// donnerait une fausse impression de securite ; avec elles, il ne sert qu'a
// etablir la session, ce que fait `clerkMiddleware` seul.
//
// DEUX CONTROLES S'Y SONT AJOUTES LE 2026-09-18, ET AUCUN DES DEUX N'EST UNE
// AUTORISATION. Ils ne disent pas qui a le droit de faire quoi, ce qui reste le
// travail des donnees ; ils bornent le RYTHME et l'ORIGINE des appels a l'API.
// C'est ce qui manquait : n'importe qui pouvait boucler sur une route d'ecriture
// autant qu'il voulait, depuis n'importe ou.

export default async function middleware(request: NextRequest) {
  const chemin = request.nextUrl.pathname;

  if (chemin.startsWith("/api/")) {
    const origineOk = origineAcceptee({
      methode: request.method,
      origine: request.headers.get("origin"),
      hote: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    });

    if (!origineOk) {
      return NextResponse.json({ error: "origine refusee" }, { status: 403 });
    }

    const seuil = seuilPour(chemin);
    if (seuil) {
      const verdict = consommer(
        `${cleDAppelant(request.headers)}|${seuil.prefixe}`,
        seuil.limite,
        seuil.fenetreMs,
      );

      if (!verdict.ok) {
        // 429 avec `Retry-After` : un client correct attend, un client qui boucle
        // se fait dire en clair combien de temps. Le corps ne dit rien de plus que
        // le code, il n'a pas a expliquer les seuils a qui les cogne.
        return NextResponse.json(
          { error: "trop de requetes" },
          {
            status: 429,
            headers: { "Retry-After": String(verdict.reessayerDansSecondes) },
          },
        );
      }
    }
  }

  if (!isClerkConfigured()) {
    return NextResponse.next();
  }

  const { clerkMiddleware } = await import("@clerk/nextjs/server");
  return clerkMiddleware()(request, {
    // Le contexte d'evenement de Next, dont Clerk n'utilise que `waitUntil`.
    waitUntil: () => undefined,
  } as never);
}

export const config = {
  // Tout sauf les fichiers statiques et les images, la recommandation de Clerk.
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)"],
};
