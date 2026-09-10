// ============================================================================
// check:teacher-read-gate
//
// POURQUOI CE GARDE EXISTE. L'etancheite eleve / professeur est une promesse
// produit gelee : le professeur ne lit QUE ce que ses propres exercices ont
// produit, jamais l'entrainement libre, jamais la maitrise, jamais le pool
// (invariants I-15, I-16, I-23 de la vision). L'architecture backend prevoit ce
// garde nommement, section 3.3, et pour une raison simple : une promesse qui
// tient sur la vigilance de chaque requete future ne tient pas.
//
// TROIS PROPRIETES, TOUTES LISIBLES DANS LE TEXTE DES FICHIERS.
//
//   1. Aucun module destine au professeur ne mentionne la table d'etat
//      pedagogique personnel, ni n'importe, meme indirectement, un module qui la
//      mentionne. La chaine d'imports est suivie, comme le fait check:dev-routes,
//      parce qu'un import de deuxieme rang est exactement ce qu'une relecture
//      humaine ne voit pas.
//
//   2. Dans la porte elle meme, toute requete qui touche le journal porte SES
//      DEUX BORNES : `teacher_id` et `context = 'teacher_assignment'`. La
//      premiere dit « tes assignations », la seconde dit « pas la vie privee de
//      l'eleve ». Une requete qui perd l'une des deux fait echouer ce garde.
//
//   3. La porte est le SEUL module du monde professeur a parler a la base. Si un
//      ecran se met a interroger la base directement, il n'y a plus de porte.
//
// CE QU'IL NE FAIT PAS. Il lit du texte. Il ne prouve pas que le SQL est correct,
// seulement que les formes dont l'absence serait une fuite sont presentes. La
// preuve par execution vit dans la note du 2026-09-10 de la checklist, ou la
// requete de la porte a rendu une ligne sur les deux reponses d'un meme eleve.
// ============================================================================

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Le nom de la table interdite. Ce fichier n'est pas un module professeur, il a
// donc le droit de la nommer : c'est meme tout son travail.
const FORBIDDEN_TABLE = "user_typeface_state";

const GATE = "lib/teacher/read-gate.ts";
const DB_CLIENT = "@/lib/server/neon";

// Les racines du monde professeur. Tout fichier sous ces chemins est un module
// destine au professeur, et tout ce qu'il importe le devient par transitivite.
const TEACHER_ROOTS = [
  "lib/teacher",
  "features/teacher",
  "app/teacher",
  "app/api/teacher",
];

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

// Resolution des imports du projet : l'alias "@/" pointe la racine, le relatif
// pointe le dossier du fichier, et l'extension est implicite.
const resolveImport = (fromRelative, specifier) => {
  let base;
  if (specifier.startsWith("@/")) {
    base = specifier.slice(2);
  } else if (specifier.startsWith(".")) {
    base = path.normalize(path.join(path.dirname(fromRelative), specifier));
  } else {
    return null; // paquet externe ou builtin, hors perimetre
  }
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (fs.existsSync(path.join(ROOT, candidate)) && /\.(ts|tsx)$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
};

const importsOf = (relative) => {
  const source = read(relative);
  const found = [];
  for (const match of source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
    const resolved = resolveImport(relative, match[1]);
    if (resolved) found.push(resolved);
  }
  return found;
};

const failures = [];

// ---------------------------------------------------------------------------
// 1. La table interdite, dans les modules professeur et dans leur fermeture
// ---------------------------------------------------------------------------

const entries = TEACHER_ROOTS.flatMap(walk);
if (entries.length === 0) {
  failures.push("aucun module professeur trouve : les racines ont bouge, ce garde est devenu aveugle.");
}

const seen = new Set();
const reachedFrom = new Map();
const queue = entries.map((file) => [file, [file]]);

while (queue.length > 0) {
  const [file, trail] = queue.shift();
  if (seen.has(file)) continue;
  seen.add(file);
  reachedFrom.set(file, trail);

  if (read(file).includes(FORBIDDEN_TABLE)) {
    const chain = trail.length > 1 ? ` (atteint par ${trail.join(" -> ")})` : "";
    failures.push(
      `${file} mentionne la table d'etat pedagogique personnel${chain}. ` +
        "Un module destine au professeur ne peut ni la lire ni la nommer, commentaires compris."
    );
  }

  for (const next of importsOf(file)) {
    if (!seen.has(next)) queue.push([next, [...trail, next]]);
  }
}

// ---------------------------------------------------------------------------
// 2. Les deux bornes, requete par requete, dans la porte
// ---------------------------------------------------------------------------

if (!fs.existsSync(path.join(ROOT, GATE))) {
  failures.push(`${GATE} est absent : la porte de lecture professeur a disparu.`);
} else {
  const source = read(GATE);
  const templates = [];
  let cursor = 0;
  while (true) {
    const start = source.indexOf("sql`", cursor);
    if (start === -1) break;
    const end = source.indexOf("`", start + 4);
    if (end === -1) break;
    templates.push(source.slice(start + 4, end));
    cursor = end + 1;
  }

  if (templates.length === 0) {
    failures.push(`${GATE} ne contient aucune requete : la porte ne lit plus rien.`);
  }

  templates.forEach((query, index) => {
    const label = `${GATE}, requete ${index + 1}`;
    if (!query.includes("teacher_id")) {
      failures.push(`${label} ne borne pas sur teacher_id : elle lit les assignations de tout le monde.`);
    }
    if (query.includes("user_event_fact") && !query.includes("context = 'teacher_assignment'")) {
      failures.push(
        `${label} lit le journal sans borner le contexte : elle lirait l'entrainement libre de l'eleve.`
      );
    }
  });

  console.log(
    `check:teacher-read-gate : ${templates.length} requetes dans la porte, toutes bornees sur teacher_id, ` +
      "et celles qui lisent le journal bornees sur le contexte assigne."
  );
}

// ---------------------------------------------------------------------------
// 3. La porte est le seul module professeur a parler a la base
// ---------------------------------------------------------------------------

const talkers = entries.filter((file) => read(file).includes(DB_CLIENT));
const strays = talkers.filter((file) => file !== GATE);
if (strays.length > 0) {
  failures.push(
    `${strays.join(", ")} parle a la base directement. Tout ce qui est destine au professeur passe par ${GATE}, ` +
      "sinon il n'y a plus de porte a garder."
  );
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error("check:teacher-read-gate a echoue.\n");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `check:teacher-read-gate OK : ${entries.length} modules professeur, ${seen.size} fichiers dans leur fermeture d'imports, ` +
    "aucun ne nomme l'etat pedagogique personnel."
);
