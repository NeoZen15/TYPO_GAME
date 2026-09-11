import { NextResponse } from "next/server";

import { isClerkConfigured } from "@/lib/server/clerk-availability";
import { getCurrentIdentity } from "@/lib/server/current-user";
import { accessRequestCounts, rejectAccessRequest } from "@/lib/admin/access-requests";

// La décision, et elle porte la même porte que la page.
//
// UNE PAGE GARDÉE DERRIÈRE UNE ROUTE OUVERTE NE GARDE RIEN. La règle est donc
// écrite deux fois parce qu'elle protège deux choses : la page protège la
// lecture, cette route protège l'écriture. Même exception étroite, et elle se
// referme d'elle même : sans Clerk et sans aucune demande, il n'y a ni donnée à
// lire ni décision à prendre.
//
// ACCEPTER N'EST PAS ENCORE POSSIBLE, ET C'EST UN REFUS EXPLICITE. Le geste crée
// le compte chez Clerk, l'école si besoin, l'appartenance enseignante puis
// l'invitation. Sans les clés, la moitié de cette chaîne marcherait et l'autre
// non : on refuse d'en faire la moitié. La contrainte de base dit la même chose,
// une demande acceptée exige un compte créé.

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      requestId?: string;
      decision?: "approve" | "reject";
    };

    if (!body.requestId || (body.decision !== "approve" && body.decision !== "reject")) {
      return NextResponse.json({ error: "décision incomprise" }, { status: 400 });
    }

    const [identity, counts] = await Promise.all([getCurrentIdentity(), accessRequestCounts()]);
    const total = counts.pending + counts.approved + counts.rejected;
    const allowed = identity.role === "admin" || (!isClerkConfigured() && total === 0);
    if (!allowed) {
      return NextResponse.json({ error: "réservé à l'administration" }, { status: 403 });
    }

    if (body.decision === "approve") {
      if (!isClerkConfigured()) {
        return NextResponse.json(
          { error: "accepter crée le compte chez Clerk : ses clés ne sont pas posées" },
          { status: 409 },
        );
      }
      // Le provisionnement complet (compte Clerk, école, appartenance,
      // invitation) est le prochain morceau, et il n'a de sens qu'une fois les
      // clés posées : il s'écrira contre l'API réelle, pas contre une idée d'elle.
      return NextResponse.json({ error: "provisionnement pas encore branché" }, { status: 501 });
    }

    const outcome = await rejectAccessRequest(body.requestId, identity.userId);
    if (outcome === "unknown") {
      return NextResponse.json({ error: "cette demande n'existe pas" }, { status: 404 });
    }
    if (outcome === "already_decided") {
      // Re-refuser écraserait une date de décision et la trace de qui a décidé.
      return NextResponse.json({ error: "cette demande a déjà été décidée" }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin/access/decide failed", error);
    return NextResponse.json({ error: "la décision n'a pas été enregistrée" }, { status: 500 });
  }
}
