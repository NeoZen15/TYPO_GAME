#!/usr/bin/env node

// LE BALAYAGE DES SESSIONS, A LA MAIN.
//
// LE MECANISME NORMAL EST AILLEURS : `lib/game/session-sweep.ts`, appele par
// `/api/cron/sweep`, une fois par jour via la tache planifiee de `vercel.json`.
// Ce fichier ci est la porte de l'operateur, pour les deux cas ou la tache ne
// peut pas aider : avant la mise en ligne, puisqu'il n'y a pas encore de Vercel
// pour la declencher, et le jour ou il faut refermer tout de suite sans attendre
// trois heures du matin.
//
// L'INSTRUCTION EST DONC ECRITE DEUX FOIS, ici et dans le module, et c'est
// assume. La sortir dans un module partage imposerait a ce script de resoudre les
// alias `@/` et l'import `server-only` de Next, ce que Node ne fait pas seul :
// on gagnerait une copie et on perdrait la possibilite de lancer la commande. La
// reference reste `lib/game/session-sweep.ts`, qui porte le raisonnement complet
// et la mesure du 2026-09-21. Toute modification de la regle se fait la-bas
// d'abord, et se recopie ici.
//
//   node --env-file=.env.local scripts/maintenance/balayer-sessions.mjs
//   node --env-file=.env.local scripts/maintenance/balayer-sessions.mjs --appliquer
//
// Par defaut il COMPTE et n'ecrit rien. Idempotent : relance sans effet.

import { neon } from "@neondatabase/serverless";

const SEUIL_MINUTES = 30;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL absente. Rien n'a été fait.");
  console.error("Node ne lit pas .env.local tout seul. Lancer plutôt :");
  console.error("  node --env-file=.env.local scripts/maintenance/balayer-sessions.mjs");
  process.exit(2);
}

// Aucune erreur de ce fichier ne doit pouvoir contenir la chaîne de connexion.
// Voir scripts/retention/anonymiser.mjs pour l'incident qui a imposé cette règle.
const expurger = (texte) => String(texte ?? "").replaceAll(url, "<DATABASE_URL masquée>");

const appliquer = process.argv.includes("--appliquer");

let sql;
try {
  sql = neon(url);
} catch (erreur) {
  console.error("DATABASE_URL refusée par le client Neon.");
  console.error(`Diagnostic : ${expurger(erreur.message)}`);
  process.exit(2);
}

const seuil = `${SEUIL_MINUTES} minutes`;

try {
  const apercu = await sql`
    SELECT mode::text AS mode, count(*)::int AS n, min(started_at) AS plus_ancienne
    FROM sessions
    WHERE status = 'active' AND started_at < now() - ${seuil}::interval
    GROUP BY 1 ORDER BY 1
  `;

  const total = apercu.reduce((somme, ligne) => somme + ligne.n, 0);

  console.log(`Seuil : ${SEUIL_MINUTES} minutes sans activité.`);
  console.log(`Sessions restées ouvertes : ${total}`);
  for (const ligne of apercu) {
    console.log(`  ${ligne.mode.padEnd(14)} ${String(ligne.n).padStart(4)}   la plus ancienne : ${ligne.plus_ancienne}`);
  }

  if (total === 0) {
    console.log("\nRien à refermer.");
    process.exit(0);
  }

  if (!appliquer) {
    console.log("\nSIMULATION. Rien n'a été écrit. Relancer avec --appliquer pour refermer.");
    process.exit(0);
  }

  // `ended_at` vaut le DERNIER ÉVÉNEMENT de la session, jamais `now()` : dater la
  // fin au moment du balayage inventerait une durée que personne n'a vécue.
  const fermees = await sql`
    UPDATE sessions AS s
    SET status = 'abandoned'::app.session_status_enum,
        ended_at = COALESCE(
          (
            SELECT MAX(uef.event_ts_utc)
            FROM user_event_fact uef
            WHERE uef.session_id = s.session_id
          ),
          s.started_at
        )
    WHERE s.status = 'active'
      AND s.started_at < now() - ${seuil}::interval
    RETURNING s.session_id
  `;

  console.log(`\n${fermees.length} session(s) refermée(s).`);
  process.exit(0);
} catch (erreur) {
  console.error(`Échec : ${expurger(erreur.message)}`);
  process.exit(1);
}
