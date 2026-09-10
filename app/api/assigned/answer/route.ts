import { NextResponse } from "next/server";

import { isGameRequestError } from "@/lib/game/request-error";
import { submitAssignedAnswer } from "@/lib/game/assigned/writer";

// Ecrire une reponse de devoir.
//
// LE CORPS NE PORTE QUE LE JETON ET LA REPONSE CHOISIE. La face demandee, les
// options et le mot affiche voyagent dans le jeton signe, donc ni la session ni
// l'identite ne sont a declarer : elles y sont deja, signees. Un corps qui les
// porterait serait un corps qu'on peut changer.
//
// UN DOUBLON N'EST PAS UNE ERREUR. Une soumission rejouee rend ce que la base a
// enregistre, avec `duplicate: true` et un 200. C'est la lecon de la competition :
// jeter une reprise ordinaire transformait un tour qui marchait en 500.

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      questionToken?: string;
      answerSlug?: string;
      responseTimeMs?: number;
    };

    if (!body.questionToken || !body.answerSlug) {
      return NextResponse.json({ error: "invalid_assigned_answer_payload" }, { status: 400 });
    }

    const result = await submitAssignedAnswer({
      token: body.questionToken,
      answerSlug: body.answerSlug,
      responseTimeMs: typeof body.responseTimeMs === "number" ? body.responseTimeMs : 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isGameRequestError(error)) {
      console.warn(`assigned/answer refused: ${error.code}`, error.message);
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("assigned/answer failed", error);
    return NextResponse.json({ error: "assigned_answer_failed" }, { status: 500 });
  }
}
