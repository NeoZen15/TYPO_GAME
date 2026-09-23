import { NextResponse } from "next/server";

import { balayerSessionsOuvertes } from "@/lib/game/session-sweep";
import { isDevRuntime } from "@/lib/dev-mode";

// LA SEULE ROUTE DU PRODUIT QUI N'EST APPELEE PAR PERSONNE.
//
// Elle est declenchee par la tache planifiee de Vercel, declaree dans
// `vercel.json`, une fois par jour a 03h00 UTC. Elle referme les sessions restees
// ouvertes, ce qu'aucun chemin de joueur ne peut faire pour quelqu'un qui n'est
// jamais revenu. Le raisonnement complet est dans `lib/game/session-sweep.ts`.
//
// COMMENT ELLE SE GARDE, ET POURQUOI PAS AUTREMENT. Elle ecrit, donc elle ne peut
// pas etre ouverte. Mais elle n'a pas d'utilisateur : personne n'est connecte
// quand une tache planifiee s'execute, donc ni le cookie d'identite ni Clerk ne
// repondent a « qui demande ». Vercel signe ses appels de tache avec un en-tete
// `Authorization: Bearer <CRON_SECRET>`, et c'est la seule preuve disponible ici.
//
// SANS `CRON_SECRET`, ELLE REFUSE EN PRODUCTION. Meme forme que
// `GAME_PROVIDER_SECRET` : le produit ne doit pas se retrouver avec une route
// d'ecriture ouverte parce qu'une variable manque. Un refus visible vaut mieux
// qu'un balayage que n'importe qui peut declencher en boucle. En developpement
// elle passe sans secret, sinon on ne peut pas l'essayer.
//
// ELLE EST IDEMPOTENTE. Deux appels le meme jour : le second ferme zero session.
// C'est ce qui permet de la relancer a la main sans reflechir.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const attendu = process.env.CRON_SECRET;

  if (!attendu) {
    if (!isDevRuntime()) {
      console.error("cron/sweep refuse : CRON_SECRET absente en production.");
      return NextResponse.json({ error: "cron_secret_absente" }, { status: 503 });
    }
  } else {
    const donne = request.headers.get("authorization");
    if (donne !== `Bearer ${attendu}`) {
      // Pas de detail dans le corps : qui frappe a cette porte n'a pas a savoir
      // si c'est le secret ou l'en-tete qui manque.
      return NextResponse.json({ error: "non autorise" }, { status: 401 });
    }
  }

  try {
    const resultat = await balayerSessionsOuvertes();
    console.log(
      `cron/sweep : ${resultat.fermees} session(s) refermee(s), seuil ${resultat.seuilMinutes} min.`,
    );
    return NextResponse.json(resultat);
  } catch (erreur) {
    console.error("cron/sweep a echoue", erreur);
    return NextResponse.json({ error: "balayage_echoue" }, { status: 500 });
  }
}
