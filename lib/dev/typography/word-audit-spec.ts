import {
  resolveWordGuideAnchors,
  type WordChipKey,
  type WordGuideKey,
  type WordOverlayDebug,
  type WordOverlayMetrics,
  type WordOverlayModel,
} from "@/lib/typography/word-overlay-engine";

export type WordAuditExpectation = {
  id: string;
  title: string;
  feature: "xHeight" | "aperture" | "terminals" | "contrast";
  word: string;
  witnessGlyphs: Partial<Record<WordGuideKey, string[]>>;
  requiredGuides: WordGuideKey[];
  forbiddenGuides: WordGuideKey[];
  requiredChips: WordChipKey[];
  maxCenterDeltaPx: number;
  minSideGapPx: number;
  minVerticalGapPx: number;
  requiresFocusZone?: boolean;
  requiresBand?: boolean;
  note: string;
};

export type WordAuditEvaluation = {
  pass: boolean;
  structuralPass: boolean;
  geometryPass: boolean;
  compositionPass: boolean;
  actualGuides: WordGuideKey[];
  actualChips: WordChipKey[];
  expectedGuides: WordGuideKey[];
  expectedChips: WordChipKey[];
  issues: string[];
  composition: {
    leftGap: number;
    rightGap: number;
    topGap: number;
    bottomGap: number;
    centeredXDelta: number;
    centeredYDelta: number;
  };
  debug: WordOverlayDebug;
};

const GUIDE_ORDER: WordGuideKey[] = ["ascender", "cap", "x", "baseline", "descender"];
const CHIP_ORDER: WordChipKey[] = ["x", "cap", "ascender", "descender", "width", "aperture", "terminal", "stroke"];

const sortGuideKeys = (keys: WordGuideKey[]) =>
  [...new Set(keys)].sort((a, b) => GUIDE_ORDER.indexOf(a) - GUIDE_ORDER.indexOf(b));

const sortChipKeys = (keys: WordChipKey[]) =>
  [...new Set(keys)].sort((a, b) => CHIP_ORDER.indexOf(a) - CHIP_ORDER.indexOf(b));

export const WORD_AUDIT_EXPECTATIONS: WordAuditExpectation[] = [
  {
    id: "word-aperture-access",
    title: "Aperture / access",
    feature: "aperture",
    word: "access",
    witnessGlyphs: {
      x: ["a"],
      baseline: ["a", "c", "e", "s"],
    },
    requiredGuides: ["x", "baseline"],
    forbiddenGuides: ["descender"],
    requiredChips: ["x", "width", "aperture"],
    maxCenterDeltaPx: 18,
    minSideGapPx: 24,
    minVerticalGapPx: 14,
    requiresFocusZone: true,
    note: "Valide la projection globale du mot avant la future couche locale aperture.",
  },
  {
    id: "word-xheight-minimum",
    title: "x-height / minimum",
    feature: "xHeight",
    word: "minimum",
    witnessGlyphs: {
      x: ["n", "m", "u"],
      baseline: ["m", "i", "n", "u"],
    },
    requiredGuides: ["x", "baseline"],
    forbiddenGuides: ["descender"],
    requiredChips: ["x", "width"],
    maxCenterDeltaPx: 18,
    minSideGapPx: 24,
    minVerticalGapPx: 14,
    requiresBand: true,
    note: "Valide le bloc mot repetitif et la lisibilite des mesures globales.",
  },
  {
    id: "word-descender-play",
    title: "descender / play",
    feature: "xHeight",
    word: "play",
    witnessGlyphs: {
      x: ["a"],
      baseline: ["l", "a"],
      ascender: ["l"],
      descender: ["p", "y"],
    },
    requiredGuides: ["x", "ascender", "baseline", "descender"],
    forbiddenGuides: ["cap"],
    requiredChips: ["x", "ascender", "descender", "width"],
    maxCenterDeltaPx: 18,
    minSideGapPx: 24,
    minVerticalGapPx: 14,
    note: "Valide que le corpus word expose enfin une vraie descender et une ascender dans un meme mot.",
  },
  {
    id: "word-cap-atlas",
    title: "cap / Atlas",
    feature: "xHeight",
    word: "Atlas",
    witnessGlyphs: {
      cap: ["A"],
      x: ["a"],
      baseline: ["t", "l", "a", "s"],
      ascender: ["t", "l"],
    },
    requiredGuides: ["cap", "x", "ascender", "baseline"],
    forbiddenGuides: ["descender"],
    requiredChips: ["x", "cap", "ascender", "width"],
    maxCenterDeltaPx: 18,
    minSideGapPx: 24,
    minVerticalGapPx: 14,
    note: "Valide une lecture mixte majuscule + lowercase dans le renderer word sans focus local.",
  },
  {
    id: "word-terminals-terminals",
    title: "terminals / terminals",
    feature: "terminals",
    word: "terminals",
    witnessGlyphs: {
      x: ["a", "m", "n"],
      baseline: ["t", "e", "r", "m", "i", "n", "a", "l", "s"],
    },
    requiredGuides: ["x", "baseline"],
    forbiddenGuides: ["descender"],
    requiredChips: ["x", "ascender", "width", "terminal"],
    maxCenterDeltaPx: 18,
    minSideGapPx: 24,
    minVerticalGapPx: 14,
    requiresFocusZone: true,
    note: "Valide que le renderer word peut porter une annotation locale de terminaison.",
  },
  {
    id: "word-contrast-contrast",
    title: "contrast / contrast",
    feature: "contrast",
    word: "contrast",
    witnessGlyphs: {
      x: ["a", "n"],
      baseline: ["c", "o", "n", "t", "r", "a", "s"],
    },
    requiredGuides: ["x", "baseline"],
    forbiddenGuides: ["descender"],
    requiredChips: ["x", "ascender", "width", "stroke"],
    maxCenterDeltaPx: 18,
    minSideGapPx: 24,
    minVerticalGapPx: 14,
    requiresFocusZone: true,
    note: "Valide que le renderer word peut porter des zones locales de contraste.",
  },
];

export const evaluateWordAudit = (
  expectation: WordAuditExpectation,
  model: WordOverlayModel,
  metrics: WordOverlayMetrics
): WordAuditEvaluation => {
  const anchors = resolveWordGuideAnchors({ word: expectation.word, metrics });
  const actualGuides = sortGuideKeys(model.guideLines.map((guide) => guide.key));
  const actualChips = sortChipKeys(model.metricChips.map((chip) => chip.key));
  const expectedGuides = sortGuideKeys(expectation.requiredGuides);
  const expectedChips = sortChipKeys(expectation.requiredChips);
  const issues: string[] = [];

  const missingGuides = expectedGuides.filter((guide) => !actualGuides.includes(guide));
  const forbiddenGuides = expectation.forbiddenGuides.filter((guide) => actualGuides.includes(guide));
  const chipMismatch =
    expectedChips.length !== actualChips.length || expectedChips.some((chip, index) => chip !== actualChips[index]);

  if (missingGuides.length) {
    issues.push(`Missing guides: ${missingGuides.join(", ")}`);
  }

  if (forbiddenGuides.length) {
    issues.push(`Forbidden guides shown: ${forbiddenGuides.join(", ")}`);
  }

  if (chipMismatch) {
    issues.push(`Expected chips ${expectedChips.join(" + ")}, got ${actualChips.join(" + ")}`);
  }

  if (expectation.requiresFocusZone) {
    const primaryZone =
      model.focusZones.find((zone) => zone.key === "aperture") ??
      model.focusZones.find((zone) => zone.key === "terminal") ??
      model.focusZones.find((zone) => zone.key === "thickStroke");
    const secondaryZone =
      model.focusZones.find((zone) => zone.key === "counter") ??
      model.focusZones.find((zone) => zone.key === "thinStroke");

    if (!primaryZone) {
      issues.push("Missing primary local focus zone.");
    }

    if (expectation.feature === "aperture" && !secondaryZone) {
      issues.push("Missing secondary counter focus zone.");
    }

    if (expectation.feature === "contrast" && !secondaryZone) {
      issues.push("Missing secondary thin-stroke focus zone.");
    }

    const region = metrics.letterRegions.find((entry) => entry.index === primaryZone?.targetGlyphIndex);
    if (primaryZone && region) {
      const zoneLeft = primaryZone.x;
      const zoneRight = primaryZone.x + primaryZone.width;
      const zoneTop = primaryZone.y;
      const zoneBottom = primaryZone.y + primaryZone.height;
      const overlapsHorizontally = zoneRight >= region.left && zoneLeft <= region.right;
      const overlapsVertically = zoneBottom >= region.top && zoneTop <= region.bottom;
      if (!overlapsHorizontally || !overlapsVertically) {
        issues.push("Primary focus zone does not overlap the target letter region.");
      }
    }
  }

  if (expectation.requiresBand) {
    const band = model.bands.find((entry) => entry.key === "lowercaseBody");
    if (!band) {
      issues.push("Missing lowercase body band.");
    }
  }

  const baselineGuide = model.guideLines.find((guide) => guide.key === "baseline");
  const xGuide = model.guideLines.find((guide) => guide.key === "x");
  if (!baselineGuide || Math.abs(baselineGuide.y - anchors.baseline) > 0.5) {
    issues.push("Baseline guide is not aligned to measured baseline.");
  }
  if (!xGuide || Math.abs(xGuide.y - anchors.x) > 0.5) {
    issues.push("X-height guide is not aligned to measured x-height.");
  }

  if (Math.abs(metrics.bounds.width - metrics.rawWordWidth) > 3.5) {
    issues.push("Word width measure does not match measured bounds.");
  }

  if (metrics.composition.leftGap < expectation.minSideGapPx || metrics.composition.rightGap < expectation.minSideGapPx) {
    issues.push("Word does not keep enough horizontal safety margin.");
  }

  if (metrics.composition.topGap < expectation.minVerticalGapPx || metrics.composition.bottomGap < expectation.minVerticalGapPx) {
    issues.push("Word does not keep enough vertical safety margin.");
  }

  if (
    Math.abs(metrics.composition.centeredXDelta) > expectation.maxCenterDeltaPx ||
    Math.abs(metrics.composition.centeredYDelta) > expectation.maxCenterDeltaPx
  ) {
    issues.push("Word block is drifting too far from the frame center.");
  }

  const structuralPass =
    !missingGuides.length &&
    !forbiddenGuides.length &&
    !chipMismatch &&
    !issues.some((issue) => issue.includes("Missing local")) &&
    !issues.some((issue) => issue.includes("Missing lowercase body band"));
  const geometryPass =
    issues.filter((issue) => issue.includes("aligned") || issue.includes("width measure") || issue.includes("overlap")).length === 0;
  const compositionPass =
    issues.filter((issue) => issue.includes("margin") || issue.includes("frame center")).length === 0;

  return {
    pass: issues.length === 0,
    structuralPass,
    geometryPass,
    compositionPass,
    actualGuides,
    actualChips,
    expectedGuides,
    expectedChips,
    issues,
    composition: {
      leftGap: metrics.composition.leftGap,
      rightGap: metrics.composition.rightGap,
      topGap: metrics.composition.topGap,
      bottomGap: metrics.composition.bottomGap,
      centeredXDelta: metrics.composition.centeredXDelta,
      centeredYDelta: metrics.composition.centeredYDelta,
    },
    debug: model.debug,
  };
};
