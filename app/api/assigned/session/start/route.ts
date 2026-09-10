import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isGameRequestError } from "@/lib/game/request-error";
import { openAssignedSession } from "@/lib/game/assigned/session";

// Ouvrir, ou REPRENDRE, la seance d'un eleve sur un devoir.
//
// L'IDENTITE VIENT DU COOKIE ET JAMAIS DU CORPS. C'est la seule identite que le
// produit possede aujourd'hui, faute de comptes : le meme cookie httpOnly que
// l'entrainement. Le corps ne porte donc que l'assignation, et l'eleve ne peut
// pas se declarer quelqu'un d'autre en changeant une valeur. Le jour ou les
// comptes existent, c'est cette ligne qui change et rien d'autre.
//
// LES QUATRE REFUS SONT DES REPONSES, PAS DES ERREURS. Pas destinataire, pas
// encore ouvert, echeance passee, budget epuise : ce sont des situations
// normales du produit et l'ecran doit pouvoir dire laquelle. Elles partent donc
// en 409 avec leur nom, jamais en 500.

const GUEST_COOKIE_NAME = "jdt_guest_user_id";
const ENGINE_VERSION = "assigned-provider-v1";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { assignmentId?: string };
    if (!body.assignmentId) {
      return NextResponse.json({ error: "invalid_assigned_start_payload" }, { status: 400 });
    }

    const store = await cookies();
    const userId = store.get(GUEST_COOKIE_NAME)?.value ?? null;
    if (!userId) {
      // Sans identite, il n'y a pas de destinataire a verifier, donc pas de
      // devoir a ouvrir. 401 plutot que 400 : la requete est bien formee, c'est
      // le demandeur qui est inconnu.
      return NextResponse.json({ error: "no_identity" }, { status: 401 });
    }

    // La graine est tiree par le SERVEUR, comme partout ailleurs : elle decide de
    // l'ordre des questions, donc un client qui la choisirait choisirait son
    // devoir.
    const seed = Math.floor(Math.random() * 2 ** 31);
    const opened = await openAssignedSession(body.assignmentId, userId, ENGINE_VERSION, seed);

    if ("refused" in opened) {
      return NextResponse.json({ refused: opened.refused }, { status: 409 });
    }

    return NextResponse.json(opened);
  } catch (error) {
    if (isGameRequestError(error)) {
      console.warn(`assigned/session/start refused: ${error.code}`, error.message);
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("assigned/session/start failed", error);
    return NextResponse.json({ error: "assigned_start_failed" }, { status: 500 });
  }
}
