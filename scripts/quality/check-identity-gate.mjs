// ============================================================================
// check:identity-gate
//
// POURQUOI CE GARDE EXISTE. « Qui demande ? » doit avoir une seule reponse dans
// tout le produit. Aujourd'hui l'identite est un cookie d'invite, demain une
// session d'authentification, et le jour de la bascule il ne faut pas partir a la
// chasse aux endroits qui lisaient le cookie en attendant.
//
// LA DERIVE AVAIT DEJA COMMENCE, et une partie etait de ma main. Un module
// d'identite existait (`lib/server/current-user.ts`, avec sa validation de
// format) et quatre lectures directes du cookie s'etaient ajoutees a cote, dont
// trois ecrites le 2026-09-10 en construisant le chemin assigne. Deux avaient
// perdu la validation en chemin, donc une valeur de cookie forgee partait droit
// dans un cast uuid et rendait 500 au lieu d'un refus propre. Ce garde empeche la
// cinquieme.
//
// QUATRE PROPRIETES.
//   1. Le nom du cookie n'est ecrit qu'a UN endroit.
//   2. Seul le module d'identite LIT le cookie.
//   3. Ce qui POSE le cookie importe son nom, jamais ne le reecrit.
//   4. Le module valide le format avant de rendre une identite.
// ============================================================================

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MODULE = "lib/server/current-user.ts";
const COOKIE = "jdt_guest_user_id";
const ROOTS = ["app", "lib", "features", "components"];

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const walk = (dir) => {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : /\.(ts|tsx)$/.test(entry.name)
          ? [path.join(dir, entry.name)]
          : []
    );
};

const failures = [];
const files = ROOTS.flatMap(walk);

if (!fs.existsSync(path.join(ROOT, MODULE))) {
  console.error(`check:identity-gate a echoue.\n\n  - ${MODULE} est absent : le produit n'a plus de module d'identite.`);
  process.exit(1);
}

// 1. Le nom du cookie, une seule fois.
const namers = files.filter((file) => read(file).includes(`"${COOKIE}"`));
if (namers.length !== 1 || namers[0] !== MODULE) {
  failures.push(
    `le nom du cookie est ecrit dans ${namers.length} fichier(s) (${namers.join(", ")}). ` +
      `Il doit l'etre dans ${MODULE} et nulle part ailleurs, sinon un renommage en oublie un.`
  );
}

// 2. Seul le module lit le cookie. On cherche la LECTURE, `.get(...)`, et non la
// simple mention du nom : une route qui pose le cookie a le droit de le nommer.
for (const file of files) {
  if (file === MODULE) continue;
  const source = read(file);
  if (/\.get\(\s*GUEST_COOKIE_NAME\s*\)/.test(source) || source.includes(`.get("${COOKIE}")`)) {
    failures.push(
      `${file} lit le cookie d'identite directement. Tout passe par getCurrentUserId(), ` +
        "qui valide le format et qui est le seul endroit a changer le jour de l'authentification."
    );
  }
}

// 3. Ce qui pose le cookie importe son nom.
for (const file of files) {
  if (file === MODULE) continue;
  const source = read(file);
  if (source.includes("GUEST_COOKIE_NAME") && !source.includes('from "@/lib/server/current-user"')) {
    failures.push(
      `${file} utilise GUEST_COOKIE_NAME sans l'importer du module d'identite : c'est une deuxieme declaration qui attend de deriver.`
    );
  }
}

// 4. La validation de format, dans le module.
const module_ = read(MODULE);
if (!module_.includes("GUEST_USER_ID_PATTERN.test(")) {
  failures.push(
    `${MODULE} ne valide plus le format de l'identifiant. Sans ce test, une valeur de cookie forgee part dans un cast uuid ` +
      "et le serveur rend 500 la ou il devait rendre un refus."
  );
}

if (failures.length > 0) {
  console.error("check:identity-gate a echoue.\n");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `check:identity-gate OK : ${files.length} fichiers balayes, le cookie d'identite nomme une seule fois dans ${MODULE}, ` +
    "lu nulle part ailleurs, et son format valide avant toute identite rendue."
);
