#!/usr/bin/env node

// Font renderability guard. No build, no database, no network.
//
// THE DEFECT THIS EXISTS FOR. The engine decides which typeface to show, and the
// screen must show THAT typeface. Training used to resolve its font family from a
// 28-entry manifest (23 with a runtime path) while its pool was drawn from the
// full catalogue: measured on two real pools, 8 renderable faces out of 25 and 2
// out of 30. Every other face rendered in a fallback font, so the question asked
// the player to name a typeface that was not on screen. Answerable only by luck.
//
// This is the same failure mode as check:latin-coverage (a face with no Latin
// glyphs cannot draw a Latin word), one step earlier in the chain: there, the file
// had nothing to draw with; here, the file was never declared to the browser.
//
// Three ways it can come back, all three checked.
//
//   1. Data: an active catalogue face ships without a usable runtime asset.
//   2. Wiring: a provider stops resolving faces through the single runtime source.
//   3. Delivery: a game screen stops declaring the descriptor it receives.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const readJson = (relative) => JSON.parse(read(relative));

const CATALOG = "content/catalog/typefaces-core.json";
const RUNTIME = "content/catalog/font-runtime-assets.json";
const RUNTIME_SOURCE = "lib/game/fonts/runtime-catalog.ts";
const INJECTOR = "lib/game/fonts/inject-font-face.ts";

// Modules that turn an engine decision into something a browser can render.
const PROVIDERS = ["lib/game/training/provider.ts", "lib/game/competition/provider.ts"];
const SCREENS = [
  "features/game/components/GameScreen.tsx",
  "features/game/components/CompetitionScreen.tsx",
];

// The retired path. A provider reaching for it is defect 2 coming back.
const RETIRED_RESOLVER = "getTypefaceFontFamily";

const failures = [];

// ---------------------------------------------------------------- 1. data
const runtimeReady = new Set(
  readJson(RUNTIME)
    .records.filter(
      (record) =>
        record.runtime_status === "ready" &&
        record.file_role === "primary" &&
        record.font_format === "woff2" &&
        typeof record.runtime_path === "string"
    )
    .map((record) => record.typeface_slug)
);

const activeSlugs = readJson(CATALOG)
  .records.filter((record) => record.activation_status === true)
  .map((record) => record.typeface_slug);

const unrenderable = activeSlugs.filter((slug) => !runtimeReady.has(slug));

if (unrenderable.length > 0) {
  failures.push(
    `${unrenderable.length} active catalogue face(s) have no ready primary woff2 in ${RUNTIME}, ` +
      `so a question on them would render in a fallback font:\n  ${unrenderable
        .slice(0, 20)
        .join(", ")}${unrenderable.length > 20 ? ", ..." : ""}`
  );
}

// ------------------------------------------------------------- 2. wiring
for (const relative of PROVIDERS) {
  const source = read(relative);

  if (!source.includes("@/lib/game/fonts/runtime-catalog")) {
    failures.push(
      `${relative} does not import ${RUNTIME_SOURCE}. Font families and descriptors must come ` +
        `from the single runtime source, otherwise a mode can serve a face it cannot render.`
    );
  }

  if (source.includes(RETIRED_RESOLVER)) {
    failures.push(
      `${relative} references ${RETIRED_RESOLVER}, the retired manifest-based resolver. ` +
        `It only covers 23 faces and returns an undeclared family for every other slug.`
    );
  }
}

// The training question builder must fail closed rather than serve an
// unrenderable face. Losing this filter is a silent regression, not a crash.
const trainingProvider = read("lib/game/training/provider.ts");
if (!trainingProvider.includes("hasRuntimeFace")) {
  failures.push(
    `lib/game/training/provider.ts no longer filters the pool with hasRuntimeFace. ` +
      `The correct answer must be a face the screen can declare.`
  );
}

// ----------------------------------------------------------- 3. delivery
for (const relative of SCREENS) {
  const source = read(relative);

  if (!source.includes("ensureGameFontFace")) {
    failures.push(
      `${relative} does not call ensureGameFontFace (${INJECTOR}). A question carries its font ` +
        `descriptor, and a descriptor that is never injected renders as a fallback.`
    );
  }
}

// ----------------------------------------------------------------- report

// ── Le fichier existe-t-il vraiment, et fait-il la taille annoncée ? ─────────
//
// AJOUTÉ LE 2026-08-15, après la question du propriétaire : « la typo affichée
// est bien la typo à deviner, il n'y a pas de bug ? »
//
// C'est la promesse centrale du produit. Un descripteur peut être parfait et
// pointer vers un fichier absent : le navigateur remplace alors silencieusement
// la police par une autre, sans erreur, et le joueur doit nommer un caractère
// qu'il n'a jamais vu. Aucune vérification ne portait sur le disque.
//
// La taille est comparée en plus de l'existence, parce qu'un fichier tronqué par
// un transfert interrompu existe et ne se charge pas.
//
// Les entrées `system_local` sont exclues à dessein : elles n'ont pas de fichier
// puisqu'elles s'appuient sur la police du système. Elles sont par ailleurs
// désactivées et propriétaires en base, donc jamais tirées, ce qui est la vraie
// raison pour laquelle ce produit ne dépend pas des polices du visiteur.
{
  const fichiersManquants = [];
  const taillesDivergentes = [];
  let verifies = 0;

  for (const record of readJson(RUNTIME).records) {
    if (record.runtime_status !== "ready") continue;
    const chemin = path.join(process.cwd(), record.source_path);
    if (!fs.existsSync(chemin)) {
      fichiersManquants.push(`${record.typeface_slug} -> ${record.source_path}`);
      continue;
    }
    const taille = fs.statSync(chemin).size;
    if (taille !== record.file_size_bytes) {
      taillesDivergentes.push(
        `${record.typeface_slug}: ${taille} octets sur le disque, ${record.file_size_bytes} déclarés`
      );
      continue;
    }
    verifies += 1;
  }

  if (fichiersManquants.length > 0) {
    failures.push(
      `${fichiersManquants.length} police(s) servable(s) sans fichier sur le disque. Le navigateur ` +
        `en substituerait une autre en silence et la question deviendrait impossible : ` +
        `${fichiersManquants.slice(0, 5).join(", ")}`
    );
  }
  if (taillesDivergentes.length > 0) {
    failures.push(
      `${taillesDivergentes.length} fichier(s) de police à la mauvaise taille, donc probablement ` +
        `tronqués : ${taillesDivergentes.slice(0, 5).join(", ")}`
    );
  }
  console.log(
    `check:font-renderable : ${verifies} fichiers de police présents sur le disque, ` +
      `à la taille déclarée.`
  );
}

if (failures.length > 0) {
  console.error("check:font-renderable FAILED\n");
  for (const failure of failures) {
    console.error(`  - ${failure}\n`);
  }
  process.exit(1);
}

console.log(
  `check:font-renderable OK : ${activeSlugs.length} active faces, all with a ready runtime asset ; ` +
    `${PROVIDERS.length} providers on the single runtime source ; ${SCREENS.length} screens injecting on demand.`
);
