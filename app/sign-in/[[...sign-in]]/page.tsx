import type { Metadata } from "next";
import Link from "next/link";

import { isClerkConfigured } from "@/lib/server/clerk-availability";

export const metadata: Metadata = {
  title: "Se connecter",
};

// LA SEULE PORTE, ET IL N'Y A PAS DE PORTE D'INSCRIPTION.
//
// Decision du proprietaire, 2026-09-10 : les comptes d'enseignants sont crees
// derriere, sur demande validee. Il n'y a donc volontairement aucune route
// `/sign-up` : un enseignant qui arrive ici a deja un compte, cree pour lui.
// **A verrouiller aussi dans le tableau de bord Clerk** (mode restreint), sinon
// l'inscription reste possible par l'API de Clerk meme sans page chez nous.
//
// AUCUNE DIRECTION ARTISTIQUE ICI. Le composant de Clerk sort avec son apparence
// par defaut : l'habiller est une decision qui appartient au proprietaire, et une
// page de connexion mal habillee se corrige, une page inventee se refait.
export default async function SignInPage() {
  if (!isClerkConfigured()) {
    return (
      <main style={{ padding: "3rem 1.5rem", maxWidth: "34rem", margin: "0 auto" }}>
        <h1>La connexion n&apos;est pas encore ouverte</h1>
        <p>
          L&apos;authentification est branchée mais ses clés ne sont pas posées sur
          cet environnement. Le jeu, lui, se joue sans compte.
        </p>
        <Link href="/">Retour à l&apos;accueil</Link>
      </main>
    );
  }

  const { SignIn } = await import("@clerk/nextjs");
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "80vh", padding: "2rem" }}>
      <SignIn />
    </main>
  );
}
