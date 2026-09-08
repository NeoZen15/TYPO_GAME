#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

// THE SKY BELONGS TO THE CONSTELLATION, AND TO NOTHING ELSE.
//
// Owner's call, 2026-09-08. The starfield used to be a page decoration: ten
// surfaces mounted their own fixed canvas (the five profile boards, the three
// mode pages, the session recap, the legal pages). It is now a device of the
// profile's constellation only, where the stars carry the meaning of the
// drawing, and every other page is on the plain system background.
//
// Why a guard rather than a note. The removal broke a component the day it was
// tried on the teacher space: panels painted as a 90 per cent wash of the page
// colour only read as panels because stars passed behind them, and on a plain
// page that wash is the page colour over the page colour. So the sky is not
// decoration one can add back casually, it changes what every surface above it
// needs to be painted with. This check makes the rule enforceable: a starfield
// that comes back anywhere else fails the gate instead of shipping.
//
// Two things are policed:
//   1. StarField.tsx is imported by the constellation and by nothing else.
//   2. No surface paints itself as a wash of the page colour, the fill that
//      silently depends on something being behind it. The single legal
//      exception is the constellation's own zoom, which has a sky.
const ALLOWED_IMPORTERS = new Set([
  "features/profile/components/ProgressConstellation.tsx",
]);

// The component itself, plus the only screen allowed to lay it out.
const ALLOWED_STARS = new Set([
  "features/profile/components/StarField.tsx",
  "features/profile/components/ProgressConstellation.tsx",
]);

// The constellation's zoom panel, the one surface that still sits on stars.
const ALLOWED_WASH = new Set([
  "features/profile/components/ProgressConstellation.tsx",
]);

const ROOTS = ["app", "components", "features", "lib", "content"];
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    return EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });

const files = ROOTS.filter((root) => fs.existsSync(root)).flatMap((root) => walk(root));

const failures = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");

  if (/from "@\/features\/profile\/components\/StarField"/.test(source) && !ALLOWED_IMPORTERS.has(file)) {
    failures.push(`${file}: imports StarField. The sky is the constellation's, not a page background.`);
  }

  if (/\bdw-stars\b/.test(source) && !ALLOWED_STARS.has(file)) {
    failures.push(`${file}: styles .dw-stars. Only the constellation declares the star canvas.`);
  }

  if (/color-mix\(in srgb, var\(--pf-bg\) \d+%, transparent\)/.test(source) && !ALLOWED_WASH.has(file)) {
    failures.push(
      `${file}: paints a surface as a wash of the page colour. That fill reads as a panel only over a sky; use '--pf-surface'.`
    );
  }
}

if (failures.length > 0) {
  console.error("Starfield ownership violations detected:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Starfield ownership verified across ${files.length} files: the sky is the constellation's alone, every other surface is painted flat.`
);
