#!/usr/bin/env node

// Legal deliverables guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. Three documents and one notice are a go-live blocker
// (checklist section G). A blocker is only lifted when the thing exists, is
// reachable, and says what the law requires it to say. This checks all three,
// mechanically, so "we have a privacy policy" cannot become true by half.
//
// WHAT IT CANNOT CHECK, and nobody should pretend otherwise: whether the text is
// legally sufficient. It checks presence, reachability and the required
// headings, not the quality of the prose. A lawyer reads the prose.
//
// IT SHOUTS ABOUT PLACEHOLDERS WITHOUT FAILING ON THEM. The documents carry
// A COMPLETER markers wherever only the publisher can answer: identity, SIRET,
// address, host, retention. A developer cannot fill those, so failing the gate
// on them would block everyone for something nobody in the code can fix. They
// are printed loudly at every run instead, the same way check:font-licenses
// keeps repeating that PP Frama has no webfont licence. Nothing goes live while
// one remains, and section G of the checklist is where that is enforced.

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
// Ce que seul l'éditeur peut fournir. Rappelé fort à chaque passage, jamais
// transformé en échec: la porte doit rester franchissable par un développeur
// qui ne connaît ni le SIRET ni l'hébergeur. Même idiome que check:font-licenses
// pour PP Frama, et que check:event-partitions pour les migrations non appliquées.
const reminders = [];

const read = (relative) => {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    failures.push(`${relative}: missing`);
    return null;
  }
  return fs.readFileSync(absolute, "utf8");
};

// Each document, and the headings it owes. The wording is French because the
// documents are, and because a French heading is what a French reader looks for.
const DOCUMENTS = [
  {
    file: "content/legal.ts",
    export: "privacyCopy",
    sections: [
      "Qui traite vos données",
      "Ce que nous collectons",
      "Ce que nous ne collectons pas",
      "Pourquoi",
      "Base légale",
      "Combien de temps",
      "Où vos données sont stockées",
      "Sous-traitants",
      "Vos droits",
      "Cookies et stockage local",
      "Réclamation",
    ],
  },
  {
    file: "content/legal.ts",
    export: "legalNoticeCopy",
    sections: ["Éditeur", "Directeur de la publication", "Hébergeur", "Contact"],
  },
  {
    file: "content/legal.ts",
    export: "termsCopy",
    sections: [
      "Objet",
      "Accès au service",
      "Compte et progression",
      "Propriété intellectuelle",
      "Responsabilité",
      "Modification",
      "Droit applicable",
    ],
  },
];

const ROUTES = [
  "app/legal/confidentialite/page.tsx",
  "app/legal/mentions-legales/page.tsx",
  "app/legal/cgu/page.tsx",
];

const legalSource = read("content/legal.ts");

if (legalSource) {
  for (const document of DOCUMENTS) {
    if (!legalSource.includes(`export const ${document.export}`)) {
      failures.push(`content/legal.ts: no ${document.export} export`);
      continue;
    }
    for (const section of document.sections) {
      if (!legalSource.includes(section)) {
        failures.push(`${document.export}: missing the "${section}" section`);
      }
    }
  }

  // The facts the inventory established, which the policy must not contradict.
  // Each one was verified in the code on 2026-08-15 and is the kind of claim a
  // regulator would test first.
  const FACTS = [
    ["jdt_guest_user_id", "the cookie must be named, a policy that hides the name is useless"],
    ["Londres", "the database is in AWS eu-west-2, London, not in the EU as the checklist assumed"],
    ["Neon", "the subprocessor must be named"],
    ["adéquation", "a UK transfer rests on the adequacy decision, which has to be stated"],
  ];
  for (const [needle, why] of FACTS) {
    if (!legalSource.includes(needle)) {
      failures.push(`content/legal.ts: "${needle}" never appears. ${why}.`);
    }
  }

  reminders.push(...new Set([...legalSource.matchAll(/\[A COMPLETER[^\]]*\]/g)].map((m) => m[0])));
}

for (const route of ROUTES) {
  read(route);
}

// Reachable, or it does not exist. A privacy policy nobody can click is the
// same as no privacy policy.
const footer = read("features/landing/components/LandingExperience.tsx");
if (footer) {
  for (const href of ["/legal/confidentialite", "/legal/mentions-legales", "/legal/cgu"]) {
    if (!footer.includes(href)) {
      failures.push(`the landing footer does not link ${href}`);
    }
  }
}

// The notice that tells a first-time visitor what is stored. Not a consent gate:
// the only cookie is strictly necessary, and no analytics exist yet
// (users.consent_analytics defaults to false and nothing reads it). The day one
// does, this becomes a gate, and this guard should gain a rule saying so.
const notice = read("components/ui/StorageNotice.tsx");
if (notice && !notice.includes("/legal/confidentialite")) {
  failures.push("components/ui/StorageNotice.tsx: the notice does not link the policy");
}

if (failures.length > 0) {
  console.error("check:legal-docs FAILED\n");
  for (const failure of failures) {
    console.error(`  - ${failure}\n`);
  }
  process.exit(1);
}

if (reminders.length > 0) {
  console.log(
    `check:legal-docs : ${reminders.length} information(s) que seul l'éditeur peut fournir, ` +
      `à remplir dans content/legal.ts AVANT toute mise en ligne :`
  );
  for (const reminder of reminders) console.log(`  · ${reminder}`);
}

console.log(
  "check:legal-docs OK : the three documents exist with every required section, they name the " +
    "cookie, the subprocessor and the storage country, the three routes exist, the footer links " +
    "them, and the storage notice points at the policy. What only the publisher can fill is " +
    "listed above, if anything is left."
);
