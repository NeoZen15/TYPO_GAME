#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const gatePathCandidates = [
  path.join(repoRoot, "features", "landing", "components", "Gate.tsx"),
  path.join(repoRoot, "components", "blocks", "Gate.tsx"),
];
const gatePath = gatePathCandidates.find((candidate) => fs.existsSync(candidate));

if (!gatePath) {
  throw new Error("Unable to find Gate.tsx in expected locations.");
}

const gateSource = fs.readFileSync(gatePath, "utf8");
const globalCss = fs.readFileSync(path.join(repoRoot, "app", "globals.css"), "utf8");

const checks = [
  {
    label: "Gate block order remains 1 -> 5",
    source: gateSource,
    pattern:
      /className="block-1"[\s\S]*className="section block-2"[\s\S]*className="section block-3"[\s\S]*className="section block-4"[\s\S]*className="section block-5"/,
  },
  {
    label: "Intro hero LOOK CLOSER contract",
    source: gateSource,
    pattern:
      /className="block-1-hero"[\s\S]*className="block-1-hero__look"[\s\S]*LOOK[\s\S]*className="block-1-hero__closer-wrap"[\s\S]*className="block-1-hero__closer"[\s\S]*CLOSER/,
  },
  {
    label: "Legacy SVG intro flow removed",
    source: gateSource,
    pattern: /./,
    mustNotMatch: /textWrapperRef|mountInlineTitleSvg|computeIntroTransform|title-svg|fetch\("\/TITRE_\.svg/,
  },
  {
    label: "Block 2 morph title markup contract",
    source: gateSource,
    pattern:
      /className="section-title block-2-morph"[\s\S]*className="block-2-morph-rotator"[\s\S]*className="[^"]*block-2-morph-word[^"]*"[\s\S]*className="[^"]*block-2-morph-word[^"]*"[\s\S]*className="[^"]*block-2-morph-word[^"]*"/,
  },
  {
    label: "Block 4 reel idle duration contract",
    source: gateSource,
    pattern: /const idleDurationMs = 1500;/,
  },
  {
    label: "Block 4 reel lead-in duration contract",
    source: gateSource,
    pattern: /const leadInDurationMs = 420;/,
  },
  {
    label: "Block 4 settle timeout contract",
    source: gateSource,
    pattern: /settleTimeout = window\.setTimeout\(finalizeSpin, 470\);/,
  },
  {
    label: "Block 5 scroll-draw contract",
    source: gateSource,
    pattern:
      /querySelectorAll<SVGGeometryElement>\("\[data-guide-draw\]"\)[\s\S]*const letterTopAbs = scrollY \+ letterRect\.top;[\s\S]*startScroll = letterTopAbs - viewportHeight \* 0\.85;[\s\S]*const letterCenterAbs = scrollY \+ letterRectTop \+ letterRect\.height \/ 2;[\s\S]*endScroll = letterCenterAbs - viewportHeight \/ 2;[\s\S]*const progress = \(scrollY - startScroll\) \/ \(endScroll - startScroll\);/,
  },
  {
    label: "Block 5 dash mapping contract",
    source: gateSource,
    pattern: /strokeDashoffset:\s*length \* \(1 - clamped\),/,
  },
  {
    label: "Block 5 guides hidden baseline",
    source: globalCss,
    pattern:
      /\.block-5-guides \[data-guide-draw\]\s*\{[\s\S]*opacity:\s*0;[\s\S]*visibility:\s*hidden;/,
  },
  {
    label: "Block 2 dark theme contract",
    source: globalCss,
    pattern: /\.block-2\s*\{[\s\S]*background-color:\s*black;[\s\S]*color:\s*white;/,
  },
  {
    label: "Block 2 threshold filter contract",
    source: globalCss,
    pattern: /\.block-2-morph-rotator\s*\{[\s\S]*filter:\s*url\(#threshold\);/,
  },
  {
    label: "Block 2 rotating words animation contract",
    source: globalCss,
    pattern:
      /\.block-2-morph-word\s*\{[\s\S]*animation:\s*block2-rotate-words 9s infinite ease-in-out;/,
  },
  {
    label: "Block 2 rotating words keyframes contract",
    source: globalCss,
    pattern: /@keyframes\s+block2-rotate-words/,
  },
  {
    label: "Block 1 morph animation contract",
    source: globalCss,
    pattern:
      /\.block-1-hero__closer\s*\{[\s\S]*animation:\s*block1-closer-reveal 0\.9s cubic-bezier\(0\.4, 0, 0\.2, 1\) 1\.02s both;/,
  },
  {
    label: "Block 1 morph keyframes contract",
    source: globalCss,
    pattern: /@keyframes\s+block1-closer-reveal/,
  },
  {
    label: "Scroll hint breathing timing contract",
    source: globalCss,
    pattern: /\.scroll-hint\s*\{[\s\S]*animation:\s*scroll-hint-breath 2\.4s ease-in-out infinite;/,
  },
  {
    label: "Scroll hint dot timing contract",
    source: globalCss,
    pattern: /\.scroll-hint__dot\s*\{[\s\S]*animation:\s*scroll-hint-dot 1\.7s cubic-bezier\(0\.4, 0, 0\.2, 1\) infinite;/,
  },
  {
    label: "Block 4 reel CSS transition contract",
    source: globalCss,
    pattern:
      /\.block-4-reel-track\.is-spinning\s*\{[\s\S]*transition:\s*transform 350ms cubic-bezier\(0\.22, 1, 0\.36, 1\);/,
  },
];

const failures = checks.filter((check) => {
  const matches = check.pattern.test(check.source);
  const forbiddenMatch = check.mustNotMatch?.test(check.source) ?? false;
  return !matches || forbiddenMatch;
});

if (failures.length > 0) {
  console.error("Motion/layout contracts failed:");
  failures.forEach((failure) => console.error(`- ${failure.label}`));
  process.exit(1);
}

console.log(`Motion/layout contracts verified (${checks.length} checks).`);
