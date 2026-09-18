#!/usr/bin/env node

// LES QUATRE SERRURES POSEES PAR L'AUDIT DE SECURITE DU 2026-09-18.
//
// Un garde qui relit du texte ne prouve pas grand chose, donc trois des quatre
// controles EXECUTENT le vrai module dans un sous processus et regardent ce qu'il
// rend. Le quatrieme est textuel faute de pouvoir demarrer la base, et il le dit.
//
//   1. L'ORIGINE, sur la table des cas : absente, identique, etrangere,
//      litteralement `null`, malformee, et une lecture qui ne doit jamais etre
//      refusee. C'est le controle CSRF de `proxy.ts`, extrait en fonction pure
//      pour cette raison precise.
//   2. LA LIMITE DE DEBIT : la fenetre se remplit, refuse, puis se rouvre, et le
//      seuil le plus precis gagne sur le plus general. Une route d'ouverture de
//      partie qui retomberait sur le seuil general de l'API vaudrait 180 parties
//      par minute au lieu de 20.
//   3. LA POLITIQUE DE CONTENU, lue sur `next.config.ts` charge pour de vrai,
//      une fois en production et une fois en developpement. Les directives qui ne
//      se negocient pas doivent etre la, et les autorisations du labo ne doivent
//      JAMAIS apparaitre en production.
//   4. LA PORTE DE L'ADMINISTRATION : la regle est ecrite une seule fois, les
//      deux entrees l'appellent, et l'exception sans compte est bornee au hors
//      production. C'est le defaut qui ouvrait dix sept pages d'usage reel au
//      premier visiteur venu le jour de la mise en ligne.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const RACINE = process.cwd();
const url = (relatif) => JSON.stringify(pathToFileURL(path.join(RACINE, relatif)).href);
const lire = (relatif) => fs.readFileSync(path.join(RACINE, relatif), "utf8");

const echecs = [];

const sonde = (libelle, source, env = {}) => {
  const resultat = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--input-type=module", "-e", source],
    { cwd: RACINE, encoding: "utf8", env: { ...process.env, ...env } },
  );

  if (resultat.error) {
    echecs.push(`${libelle} : la sonde n'a pas demarre (${resultat.error.message})`);
    return null;
  }
  if (resultat.status !== 0) {
    const derniere = (resultat.stderr || resultat.stdout).trim().split("\n").pop();
    echecs.push(`${libelle} : ${derniere}`);
    return null;
  }
  return resultat.stdout;
};

// 1. L'ORIGINE.
sonde(
  "controle d'origine",
  `
import { origineAcceptee } from ${url("lib/server/request-origin.ts")};

const cas = [
  ["une lecture d'ailleurs passe toujours", { methode: "GET", origine: "https://ailleurs.example", hote: "dwiggins.fr" }, true],
  ["une ecriture sans origine passe", { methode: "POST", origine: null, hote: "dwiggins.fr" }, true],
  ["une ecriture de la meme origine passe", { methode: "POST", origine: "https://dwiggins.fr", hote: "dwiggins.fr" }, true],
  ["une ecriture d'un autre domaine est refusee", { methode: "POST", origine: "https://mechant.example", hote: "dwiggins.fr" }, false],
  ["une origine litteralement null est refusee", { methode: "POST", origine: "null", hote: "dwiggins.fr" }, false],
  ["une origine malformee est refusee", { methode: "POST", origine: "pas une url", hote: "dwiggins.fr" }, false],
  ["une ecriture sans hote connu est refusee", { methode: "POST", origine: "https://dwiggins.fr", hote: null }, false],
  ["le port compte dans l'origine", { methode: "POST", origine: "http://127.0.0.1:3000", hote: "127.0.0.1:3001" }, false],
  ["DELETE est une ecriture", { methode: "DELETE", origine: "https://mechant.example", hote: "dwiggins.fr" }, false],
];

for (const [nom, entree, attendu] of cas) {
  const obtenu = origineAcceptee(entree);
  if (obtenu !== attendu) {
    console.error("SONDE " + nom + " : attendu " + attendu + ", obtenu " + obtenu);
    process.exit(1);
  }
}
`,
);

// 2. LA LIMITE DE DEBIT.
sonde(
  "limite de debit",
  `
import { consommer, seuilPour } from ${url("lib/server/rate-limit.ts")};

for (let i = 0; i < 3; i += 1) {
  if (consommer("cle-a", 3, 60000).ok !== true) {
    console.error("SONDE la fenetre a refuse avant d'etre pleine");
    process.exit(1);
  }
}

const quatrieme = consommer("cle-a", 3, 60000);
if (quatrieme.ok !== false || quatrieme.reessayerDansSecondes < 1) {
  console.error("SONDE la quatrieme requete est passee, ou sans delai de reprise");
  process.exit(1);
}

if (consommer("cle-b", 3, 60000).ok !== true) {
  console.error("SONDE une autre cle a paye pour la premiere");
  process.exit(1);
}

const courte = consommer("cle-c", 1, 5);
const bloquee = consommer("cle-c", 1, 5);
if (courte.ok !== true || bloquee.ok !== false) {
  console.error("SONDE la fenetre courte ne s'est pas fermee");
  process.exit(1);
}
await new Promise((r) => setTimeout(r, 20));
if (consommer("cle-c", 1, 5).ok !== true) {
  console.error("SONDE la fenetre ne s'est jamais rouverte");
  process.exit(1);
}

const ouverture = seuilPour("/api/training/session/start");
const general = seuilPour("/api/training/answer");
if (!ouverture || ouverture.prefixe !== "/api/training/session/start") {
  console.error("SONDE l'ouverture de partie retombe sur un seuil plus general");
  process.exit(1);
}
if (!general || general.prefixe !== "/api/") {
  console.error("SONDE le rythme des reponses n'a pas de seuil");
  process.exit(1);
}
if (seuilPour("/legal/cgu")) {
  console.error("SONDE une page du site est limitee comme une route d'API");
  process.exit(1);
}
`,
);

// 3. LA POLITIQUE DE CONTENU.
const politique = (env) =>
  sonde(
    `politique de contenu (${env.NODE_ENV})`,
    `
const config = (await import(${url("next.config.ts")})).default;
const entrees = await config.headers();
const enTetes = entrees[0].headers;
const trouve = (nom) => (enTetes.find((h) => h.key === nom) || {}).value || "";
console.log(JSON.stringify({
  csp: trouve("Content-Security-Policy"),
  cadre: trouve("X-Frame-Options"),
  sniff: trouve("X-Content-Type-Options"),
  referent: trouve("Referrer-Policy"),
  permissions: trouve("Permissions-Policy"),
  hsts: trouve("Strict-Transport-Security"),
  source: entrees[0].source,
}));
`,
    env,
  );

const enProduction = politique({ NODE_ENV: "production" });
const enDeveloppement = politique({ NODE_ENV: "development" });

if (enProduction) {
  const lu = JSON.parse(enProduction);
  const exigees = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];
  for (const directive of exigees) {
    if (!lu.csp.includes(directive)) {
      echecs.push(`next.config.ts : la politique de production ne porte pas "${directive}"`);
    }
  }
  for (const interdit of ["'unsafe-eval'", "esm.sh", "ws:"]) {
    if (lu.csp.includes(interdit)) {
      echecs.push(
        `next.config.ts : la politique de production autorise "${interdit}", qui n'existe que pour le labo local`,
      );
    }
  }
  if (lu.cadre !== "DENY") echecs.push("next.config.ts : X-Frame-Options n'est pas DENY");
  if (lu.sniff !== "nosniff") echecs.push("next.config.ts : X-Content-Type-Options n'est pas nosniff");
  if (!lu.referent) echecs.push("next.config.ts : Referrer-Policy est absent");
  if (!lu.permissions.includes("camera=()")) echecs.push("next.config.ts : Permissions-Policy n'ferme pas la camera");
  if (!lu.hsts.includes("max-age=")) echecs.push("next.config.ts : HSTS est absent en production");
  if (lu.hsts.includes("preload")) {
    echecs.push("next.config.ts : HSTS porte `preload`, qui engage le domaine pour des mois et appartient au proprietaire");
  }
}

if (enDeveloppement) {
  const lu = JSON.parse(enDeveloppement);
  if (lu.hsts) echecs.push("next.config.ts : HSTS est pose en developpement, ou il n'a rien a faire");
  if (!lu.csp.includes("'unsafe-eval'")) {
    echecs.push("next.config.ts : le rechargement a chaud de Turbopack a besoin de 'unsafe-eval' en developpement");
  }
}

// 4. LA PORTE DE L'ADMINISTRATION.
//
// Textuel, et c'est assume : la fonction lit la base, donc l'executer ici
// demanderait une connexion. Ce que le texte peut prouver, il le prouve.
// 3 bis. La techno ne s'annonce pas : X-Powered-By desactive dans la config.
const configTxt = lire("next.config.ts");
if (!/poweredByHeader:\s*false/.test(configTxt)) {
  echecs.push("next.config.ts : poweredByHeader n'est pas a false, l'en-tete X-Powered-By reannonce la techno");
}

const gate = lire("lib/admin/gate.ts");
if (!gate.includes("isDevRuntime()")) {
  echecs.push(
    "lib/admin/gate.ts : l'exception sans compte n'est plus bornee au hors production, donc l'administration s'ouvre en ligne",
  );
}
if (!gate.includes('identity.role === "admin"')) {
  echecs.push("lib/admin/gate.ts : la porte ne reconnait plus un compte administrateur");
}

for (const entree of ["app/admin/layout.tsx", "app/api/admin/access/decide/route.ts"]) {
  if (!lire(entree).includes("isAdminAccessAllowed")) {
    echecs.push(`${entree} : cette entree de l'administration ne passe plus par la porte commune`);
  }
}

const dossiersAdmin = ["app/admin", "app/api/admin"];
const fichiers = (dossier) =>
  fs.existsSync(path.join(RACINE, dossier))
    ? fs
        .readdirSync(path.join(RACINE, dossier), { withFileTypes: true, recursive: true })
        .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
        .map((e) => path.relative(RACINE, path.join(e.parentPath ?? e.path, e.name)))
    : [];

for (const dossier of dossiersAdmin) {
  for (const fichier of fichiers(dossier)) {
    const contenu = lire(fichier);
    if (contenu.includes('role === "admin"') && !contenu.includes("isAdminAccessAllowed")) {
      echecs.push(
        `${fichier} : une porte d'administration est reecrite ici au lieu d'appeler lib/admin/gate.ts`,
      );
    }
  }
}

if (echecs.length > 0) {
  console.error("Serrures de securite en defaut :");
  echecs.forEach((echec) => console.error(`- ${echec}`));
  process.exit(1);
}

console.log(
  "Serrures verifiees : origine refusee hors du site et sur `null`, limite de debit qui se ferme et se rouvre avec le seuil le plus precis, politique de contenu complete en production et sans les autorisations du labo, porte d'administration unique et fermee en production sans compte.",
);
