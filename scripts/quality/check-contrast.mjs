#!/usr/bin/env node

// ---------------------------------------------------------------------------
// Ink contrast guard.
//
// On 2026-08-23 a browser sweep found 97 texts below the readability threshold
// in the light theme, across FOUR separate palettes: the main one under :root,
// the typography pages under .typo-page, the comparison stage under
// .compare-stage-shell, and literal colours in the profile. Three of them would
// have been missed by reading the file, because none of them looks wrong on its
// own: every one was simply the dark scale reused on a light ground.
//
// The defect is arithmetic and it repeats: THE SAME ALPHA DOES NOT GIVE THE
// SAME CONTRAST ON A DIFFERENT GROUND. Beige at 34 per cent on black reads
// 2.71; ink at 34 per cent on beige reads 2.15. A new palette written by
// copying an existing one therefore lands under the threshold without anyone
// noticing until the theme is toggled.
//
// This guard checks the PALETTE, not the pixels. Rendering would need a browser
// and a server inside the quality gate; the tokens are where the defect lives
// and they can be read straight from the stylesheet. Every palette below
// declares its ground and the ink tokens that must stay readable on it.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";

const cssPath = path.join(process.cwd(), "app", "globals.css");
const css = fs.readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// WCAG 2.1 contrast minimum for body-size text. Tokens used only for hairlines
// and fills are not listed below, so nothing here is held to a text threshold
// it was never meant to meet.
const MIN = 4.5;

// Each entry: the CSS block that declares the palette, the ground colour text
// sits on inside it, and the ink tokens that carry readable text.
const PALETTES = [
  {
    name: "main, light",
    block: ":root",
    ground: "#f4f3ee",
    tokens: ["--ink-strong", "--ink-muted", "--ink-soft"],
  },
  {
    name: "main, dark",
    block: ':root[data-theme="dark"]',
    ground: "#000000",
    tokens: ["--ink-strong", "--ink-muted"],
    // --ink-soft is deliberately decorative on black and is not listed.
  },
  {
    name: "typography pages, light",
    block: ".typo-page",
    ground: "#fefbf7", // --typo-shell-bg composited over --typo-page-bg
    tokens: ["--typo-ink", "--typo-muted", "--typo-soft"],
  },
  {
    name: "comparison stage, light",
    block: ".compare-stage-shell",
    ground: "#fefbf7",
    tokens: [
      "--compare-stage-ink",
      "--compare-stage-ink-soft",
      "--compare-control-ink",
      "--compare-control-ink-active",
    ],
  },
  {
    name: "navigation bar, light",
    block: ":root",
    ground: "#141019", // --nav-bg in light: the bar is a black object
    tokens: ["--nav-ink", "--nav-ink-muted", "--nav-ink-strong"],
  },
  {
    name: "navigation bar, dark",
    block: ':root[data-theme="dark"]',
    ground: "#f4f3ee",
    tokens: ["--nav-ink", "--nav-ink-muted", "--nav-ink-strong"],
  },
];

// --- colour plumbing -------------------------------------------------------

const parseColour = (value) => {
  const hex = value.trim().match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const rgb = value.trim().match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/i);
  if (rgb) {
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] === undefined ? 1 : +rgb[4] };
  }
  return null;
};

const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});

const luminance = ({ r, g, b }) => {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// --- reading the stylesheet ------------------------------------------------

// A selector can open several rules in the sheet (a base one, then narrower
// ones further down). Collect them all rather than assuming the last one holds
// the tokens: on `.compare-stage-shell` the later rule declares none, and
// reading only that one made the guard report a palette as missing.
const blockBodies = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g");
  return [...css.matchAll(re)].map((m) => m[2]);
};

// Last declaration wins the cascade, so scan the bodies in order and keep the
// last value seen.
const readToken = (bodies, token) => {
  const re = new RegExp(`${token.replace(/-/g, "\\-")}\\s*:\\s*([^;]+);`);
  let value = null;
  for (const body of bodies) {
    const m = body.match(re);
    if (m) value = m[1].trim();
  }
  return value;
};

// --- the check -------------------------------------------------------------

const failures = [];
const missing = [];
const checked = [];

for (const palette of PALETTES) {
  const bodies = blockBodies(palette.block);
  if (bodies.length === 0) {
    missing.push(`${palette.name}: no rule found for \`${palette.block}\``);
    continue;
  }
  const ground = parseColour(palette.ground);
  for (const token of palette.tokens) {
    const raw = readToken(bodies, token);
    if (raw === null) {
      missing.push(`${palette.name}: \`${token}\` is not declared in \`${palette.block}\``);
      continue;
    }
    const ink = parseColour(raw);
    if (ink === null) {
      missing.push(`${palette.name}: \`${token}\` is \`${raw}\`, which this guard cannot read`);
      continue;
    }
    const ratio = contrast(over(ink, ground), ground);
    const record = { palette: palette.name, token, raw, ratio, ground: palette.ground };
    checked.push(record);
    if (ratio < MIN) failures.push(record);
  }
}

if (missing.length > 0) {
  console.error(
    "The contrast guard could not read part of the palette. A token was renamed,\n" +
      "moved, or written in a form this guard does not parse. Fix the list at the\n" +
      "top of scripts/quality/check-contrast.mjs so the guard keeps seeing it,\n" +
      "rather than leaving it silently unchecked."
  );
  missing.forEach((m) => console.error(`- ${m}`));
  process.exit(1);
}

if (failures.length > 0) {
  console.error(
    `Ink tokens below the ${MIN} contrast threshold on their own ground.\n` +
      "Remember the alphas of one theme do not transpose to the other: the same\n" +
      "transparency over a different ground gives a different contrast.\n"
  );
  for (const f of failures) {
    console.error(
      `- ${f.palette}: ${f.token} is ${f.raw} on ${f.ground}, reading ${f.ratio.toFixed(2)}`
    );
  }
  process.exit(1);
}

const worst = checked.reduce((a, b) => (a.ratio <= b.ratio ? a : b));
console.log(
  `Ink contrast verified: ${checked.length} tokens across ${PALETTES.length} palettes all clear ${MIN} ` +
    `on their own ground. Tightest is ${worst.token} in the ${worst.palette} palette at ${worst.ratio.toFixed(2)}.`
);
