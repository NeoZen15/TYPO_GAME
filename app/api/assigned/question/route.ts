import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isGameRequestError } from "@/lib/game/request-error";
import { buildAssignedQuestion } from "@/lib/game/assigned/writer";

// La question suivante du devoir, ou la fin.
//
// `null` N'EST PAS UNE ERREUR, c'est la fin de l'exercice : budget epuise ou
// echeance passee. La route rend donc `{ done: true }` avec un 200, et l'ecran
// montre le bilan. Repondre 404 ou 409 la dessus obligerait l'ecran a traiter la
// reussite comme un incident.
//
// L'identite vient du cookie, jamais du corps : voir la route d'ouverture.

const GUEST_COOKIE_NAME = "jdt_guest_user_id";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
    if (!body.sessionId) {
      return NextResponse.json({ error: "invalid_assigned_question_payload" }, { status: 400 });
    }

    const store = await cookies();
    const userId = store.get(GUEST_COOKIE_NAME)?.value ?? null;
    if (!userId) {
      return NextResponse.json({ error: "no_identity" }, { status: 401 });
    }

    const question = await buildAssignedQuestion(body.sessionId, userId);
    if (!question) {
      return NextResponse.json({ done: true });
    }

    return NextResponse.json({ done: false, question });
  } catch (error) {
    if (isGameRequestError(error)) {
      console.warn(`assigned/question refused: ${error.code}`, error.message);
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("assigned/question failed", error);
    return NextResponse.json({ error: "assigned_question_failed" }, { status: 500 });
  }
}
