#!/usr/bin/env node

// LA DURÉE DE CONSERVATION ANNONCÉE, ENFIN APPLIQUÉE.
//
// POURQUOI CE FICHIER EXISTE. La politique de confidentialité annonce depuis le
// 15 août 2026 que « les données rattachées à un identifiant devenu inutilisable
// sont conservées vingt-quatre mois au plus, puis anonymisées ». Rien ne le
// faisait. Une durée de conservation annoncée et jamais appliquée n'est pas une
// approximation, c'est une déclaration fausse, et c'est celle que l'audit du
// 2026-09-18 a relevée.
//
// ANONYMISER ET NON SUPPRIMER, PARCE QUE LE SCHÉMA L'AVAIT PRÉVU. La table
// `users` porte `deleted_at` et `anonymized_at` depuis la migration 003, sous un
// commentaire « RGPD ». L'intention d'origine était donc de rompre le lien en
// gardant la valeur pédagogique des réponses, ce que la politique dit aussi. Les
// clés étrangères sont en ON DELETE RESTRICT sur onze tables : supprimer une
// personne imposerait un ordre précis et détruirait des mesures qui n'identifient
// personne. On rompt le lien, on garde le corpus.
//
// CE QUI EST RÉELLEMENT EFFACÉ. Presque rien, et c'est le signe que la
// minimisation du produit était bonne : il n'y a ni nom, ni email, ni adresse IP,
// ni user-agent dans ce schéma. Le seul identifiant qui désigne une personne
// chez un tiers est `clerk_id`. Il part, `merged_from_guest_id` part avec lui, et
// `anonymized_at` est horodaté. Le rôle redescend à `guest` parce que la
// contrainte `chk_clerk_required_for_authenticated_roles` exige un `clerk_id`
// pour `player` et `admin` : laisser le rôle en place rendrait la ligne invalide.
//
// L'`user_id` RESTE, et il faut savoir pourquoi. C'est la clé primaire, référencée
// par onze tables. La changer reviendrait à réécrire tout le journal. Ce n'est pas
// une demi-mesure : c'est un uuid tiré au hasard par la base, qui ne contient
// aucune information sur personne, et une fois `clerk_id` parti plus rien ne le
// relie à un être humain. Il redevient ce qu'il était pour un invité, un numéro.
//
// IL NE S'EXÉCUTE PAS TOUT SEUL. Par défaut il COMPTE et n'écrit rien. Il faut
// `--appliquer` pour qu'il touche la base, et c'est délibéré : `DATABASE_URL`
// pointe aujourd'hui la production.
//
//   node --env-file=.env.local scripts/retention/anonymiser.mjs              # compte
//   node --env-file=.env.local scripts/retention/anonymiser.mjs --appliquer   # écrit
//
// `--env-file` PLUTÔT QU'UNE VARIABLE PASSÉE À LA MAIN. Node lit le fichier
// lui-même, donc la chaîne de connexion ne traverse ni la ligne de commande, ni
// l'historique du shell, ni la sortie d'une session. C'est exactement le geste
// qui a fait fuiter le secret le 2026-09-18 quand il a été fait autrement.
//
// À PLANIFIER UNE FOIS PAR MOIS, avec l'audit de conformité. Tant qu'il n'est pas
// planifié, la phrase de la politique reste une promesse tenue à la main.

import { neon } from "@neondatabase/serverless";

const MOIS = 24;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL absente. Rien n'a été fait.");
  console.error("Node ne lit pas .env.local tout seul. Lancer plutôt :");
  console.error("  node --env-file=.env.local scripts/retention/anonymiser.mjs");
  process.exit(2);
}

const appliquer = process.argv.includes("--appliquer");

// AUCUNE ERREUR DE CE FICHIER NE DOIT POUVOIR CONTENIR LA CHAÎNE DE CONNEXION.
//
// Le 2026-09-18, `neon()` a refusé une URL et a recraché dans son message
// d'erreur la chaîne entière, mot de passe compris, qui est partie dans un
// terminal et dans une conversation. C'était la DEUXIÈME fuite du même secret,
// la première datant du 2026-08-24. Une bibliothèque qui met un secret dans un
// message d'erreur n'est pas une bibliothèque fautive, c'est une bibliothèque
// normale : c'est à l'appelant de ne pas laisser ce message sortir.
//
// D'où ce cadre, et d'où le `catch` du bas qui n'imprime jamais `erreur.message`
// brut sans l'avoir expurgé. La règle vaut pour tout nouveau script qui parle à
// la base : on rend un diagnostic, jamais la valeur.
const expurger = (texte) =>
  String(texte ?? "").replaceAll(url, "<DATABASE_URL masquée>");

let sql;
try {
  sql = neon(url);
} catch (erreur) {
  console.error("DATABASE_URL refusée par le client Neon.");
  console.error(`Diagnostic : ${expurger(erreur.message)}`);
  console.error("La valeur n'est pas affichée, c'est volontaire. Vérifier la ligne");
  console.error("DATABASE_URL de .env.local : pas de guillemets autour, pas d'espace,");
  console.error("pas de retour à la ligne au milieu.");
  process.exit(2);
}

const seuil = `${MOIS} months`;

try {
  const [compte] = await sql`
    SELECT
      count(*)::int AS concernes,
      min(last_seen_at) AS plus_ancienne,
      count(*) FILTER (WHERE clerk_id IS NOT NULL)::int AS avec_clerk
    FROM users
    WHERE last_seen_at < now() - ${seuil}::interval
      AND anonymized_at IS NULL
  `;

  console.log(`Seuil : ${MOIS} mois sans activité.`);
  console.log(`Lignes concernées : ${compte.concernes}`);
  console.log(`  dont rattachées à un compte Clerk : ${compte.avec_clerk}`);
  console.log(
    `  activité la plus ancienne en base : ${compte.plus_ancienne ?? "aucune ligne assez ancienne"}`,
  );

  if (compte.concernes === 0) {
    console.log("\nRien à anonymiser. La promesse de la politique est tenue à cet instant.");
    process.exit(0);
  }

  if (!appliquer) {
    console.log("\nSIMULATION. Rien n'a été écrit. Relancer avec --appliquer pour agir.");
    process.exit(0);
  }

  const touchees = await sql`
    UPDATE users
    SET clerk_id = NULL,
        merged_from_guest_id = NULL,
        role = 'guest',
        anonymized_at = now()
    WHERE last_seen_at < now() - ${seuil}::interval
      AND anonymized_at IS NULL
    RETURNING user_id
  `;

  console.log(`\n${touchees.length} ligne(s) anonymisée(s).`);
  process.exit(0);
} catch (erreur) {
  console.error(`Échec : ${expurger(erreur.message)}`);
  process.exit(1);
}
