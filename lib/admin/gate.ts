import "server-only";

import { isDevRuntime } from "@/lib/dev-mode";
import { isClerkConfigured } from "@/lib/server/clerk-availability";
import { getCurrentIdentity } from "@/lib/server/current-user";
import { sql } from "@/lib/server/neon";

// QUI A LE DROIT D'ENTRER DANS L'ADMINISTRATION. Une seule reponse, ici.
//
// POURQUOI CE FICHIER EXISTE. La regle vivait en double, dans
// `app/admin/layout.tsx` pour la lecture et dans la route de decision pour
// l'ecriture. Une regle ecrite deux fois est une regle qui derive, et l'audit du
// 2026-09-18 a du la corriger aux deux endroits pour un seul defaut. Les portes
// restent, elles appellent la meme fonction.
//
// LE DEFAUT CORRIGE : L'EXCEPTION S'OUVRAIT AUSSI EN PRODUCTION. La regle disait
// « sans Clerk et sans aucune demande, on ouvre », raisonnable sur une machine de
// developpement et pas du tout sur le site en ligne. En production, la seule
// porte est un compte administrateur.
//
// CE FICHIER NE LIT LA BASE QUE DANS LE CAS DEV, ET AVEC LE `sql` DE BASE. Il ne
// passe pas par le `sql` garde de `lib/admin/guarded-sql`, et c'est delibere :
// ce garde l'appelle pour decider, donc s'il l'appelait en retour la lecture du
// compteur tournerait en boucle. En production, la fonction repond avant meme de
// toucher la base.
export const isAdminAccessAllowed = async (): Promise<boolean> => {
  const identity = await getCurrentIdentity();
  if (identity.role === "admin") return true;

  // Hors production seulement : tant que Clerk n'a pas de cles et qu'aucune
  // demande n'existe, l'espace s'ouvre pour que le produit reste utilisable.
  if (!isDevRuntime() || isClerkConfigured()) return false;

  const rows = (await sql`SELECT count(*)::int AS n FROM access_requests`) as { n: number }[];
  return (rows[0]?.n ?? 0) === 0;
};
