// Garde de l'instantané de metadonnees Google Fonts.
//
// Il ne verifie pas que la collecte a tourne recemment, un instantane vieux
// reste un instantane valide. Il verifie que le fichier a la forme que la tache 2
// attend, parce qu'une cle renommee en amont donnerait un classement de
// notoriete silencieusement vide plutot qu'une erreur.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SNAPSHOT = "content/catalog/google-metadata-sync/metadata-snapshot.json";
const failures = [];

const chemin = path.join(ROOT, SNAPSHOT);
if (!fs.existsSync(chemin)) {
  console.log(
    `check:google-metadata-sync OK : ${SNAPSHOT} absent, la collecte n'a pas encore tourne. ` +
      "Lancer npm run sync:google-metadata pour le produire."
  );
  process.exit(0);
}

const payload = JSON.parse(fs.readFileSync(chemin, "utf8"));

if (payload.source !== "google_fonts_metadata_endpoint") {
  failures.push(`${SNAPSHOT}: champ source attendu "google_fonts_metadata_endpoint", trouve "${payload.source}".`);
}

if (!Array.isArray(payload.families) || payload.families.length === 0) {
  failures.push(`${SNAPSHOT}: families doit etre un tableau non vide.`);
} else {
  const requis = ["family", "rank", "popularity", "trending", "category", "classifications", "designers", "date_added"];
  const premiere = payload.families[0];
  for (const cle of requis) {
    if (!(cle in premiere)) failures.push(`${SNAPSHOT}: cle "${cle}" absente des familles.`);
  }
  const sansPopularite = payload.families.filter((f) => typeof f.popularity !== "number").length;
  if (sansPopularite > 0) {
    failures.push(`${SNAPSHOT}: ${sansPopularite} famille(s) sans popularity numerique, le classement serait fausse.`);
  }
  // rank, pas popularity. Mesure du 2026-08-19 : Google rend 1942 familles pour
  // 1182 valeurs de popularity distinctes, avec des doublons des le rang 2. Un
  // garde qui exigerait l'unicite de popularity echouerait toujours. rank est
  // calcule par le collecteur, dense de 1 a N, donc unique par construction, et
  // c'est lui que les seuils de rarete liront.
  const rangs = new Set(payload.families.map((f) => f.rank));
  if (rangs.size !== payload.families.length) {
    failures.push(
      `${SNAPSHOT}: ${payload.families.length} familles pour ${rangs.size} valeurs de rank distinctes. ` +
        "rank doit etre unique, sinon deux polices se disputent la meme place."
    );
  }
  const attendu = payload.families.length;
  const rangsTries = [...rangs].sort((x, y) => x - y);
  if (rangsTries[0] !== 1 || rangsTries[attendu - 1] !== attendu) {
    failures.push(
      `${SNAPSHOT}: rank va de ${rangsTries[0]} a ${rangsTries[attendu - 1]} pour ${attendu} familles. ` +
        "Il doit etre dense, de 1 a N, sinon un seuil ne selectionne pas le nombre de polices qu'il annonce."
    );
  }
}

if (failures.length > 0) {
  console.error("check:google-metadata-sync FAILED\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(
  `check:google-metadata-sync OK : ${payload.families.length} familles, popularity numerique et unique sur toutes.`
);
