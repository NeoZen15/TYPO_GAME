import { NextResponse, type NextRequest } from "next/server";

import { isClerkConfigured } from "@/lib/server/clerk-availability";

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
export default async function middleware(request: NextRequest) {
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
