// Resolution de l'alias "@/" pour les gardes qui importent le vrai code.
//
// POURQUOI CE FICHIER EXISTE. tsconfig fait pointer "@/" sur la racine du depot.
// Node ne lit pas tsconfig : un `import "@/lib/..."` lui repond "Cannot find
// package '@/lib'". check:recap-view importe les trois adaptateurs de fin de
// session pour les exercer pour de vrai, sans build, sans base et sans reseau,
// et c'est exactement ce que cette resolution manquante lui interdisait.
//
// CE QUE CA REMPLACE, et c'est le point. La garde exigeait jusqu'ici que ces
// trois fichiers n'aient AUCUN import executable, pour que Node puisse se
// contenter de retirer leurs types. Cette contrainte ne protegeait rien du jeu :
// elle contournait une limite du banc d'essai, et elle poussait a recopier une
// couleur ou un formateur plutot qu'a l'importer. Le jour ou un adaptateur a eu
// besoin de MODE_ACCENT, la garde est passee au rouge sans qu'aucune regle du
// cadre de fin de session ne soit enfreinte.
//
// Les extensions sont essayees dans l'ordre parce que les imports du projet
// n'en portent pas, et le repli sur le chemin nu laisse Node produire son
// message d'origine plutot qu'une erreur inventee ici.
import { statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", ".mts", ".js", "/index.ts", "/index.tsx"];

const isFile = (candidate) => {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
};

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const base = path.join(ROOT, specifier.slice(2));
  const resolved =
    CANDIDATE_SUFFIXES.map((suffix) => `${base}${suffix}`).find(isFile) ?? base;

  return nextResolve(pathToFileURL(resolved).href, context);
}
