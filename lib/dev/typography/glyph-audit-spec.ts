import type { GlyphMetrics, GlyphOverlayModel } from "@/lib/typography/glyph-overlay-engine";
import { getProjectedGuideContact } from "@/lib/typography/glyph-overlay-engine";

export type AuditGuideKey = "x" | "cap" | "ascender" | "baseline" | "descender";
export type AuditChipKey = AuditGuideKey | "width";
export type AuditPriority = "high" | "medium";
export type OvershootExpectation = "none" | "possible" | "expected";

export type GlyphAuditExpectation = {
  glyph: string;
  family: string;
  primaryGuide: AuditGuideKey;
  requiredGuides: AuditGuideKey[];
  forbiddenGuides: AuditGuideKey[];
  overshoot: OvershootExpectation;
  priority: AuditPriority;
  note: string;
  workbookRow: number | null;
  workbookSource: "CONTROLE LETTRES" | "manual-extension";
};

export type GlyphAuditGroup = {
  id: string;
  title: string;
  note: string;
  glyphs: string[];
};

export type GlyphAuditEvaluation = {
  pass: boolean;
  structuralPass: boolean;
  geometryPass: boolean;
  actualGuides: AuditGuideKey[];
  expectedGuides: AuditGuideKey[];
  actualChips: AuditChipKey[];
  expectedChips: AuditChipKey[];
  actualAxisCount: number;
  expectedAxisCount: number;
  missingGuides: AuditGuideKey[];
  forbiddenGuidesPresent: AuditGuideKey[];
  chipMismatch: boolean;
  axisMismatch: boolean;
  issues: string[];
  geometry: Partial<Record<AuditGuideKey, { deltaPx: number | null; tolerancePx: number; mode: "strict" | "overshoot" }>>;
};

const GUIDE_ORDER: AuditGuideKey[] = ["x", "cap", "ascender", "baseline", "descender"];
const CHIP_ORDER: AuditChipKey[] = ["x", "cap", "ascender", "descender", "width"];

const sortGuideKeys = (keys: AuditGuideKey[]) =>
  [...new Set(keys)].sort((a, b) => GUIDE_ORDER.indexOf(a) - GUIDE_ORDER.indexOf(b));

const sortChipKeys = (keys: AuditChipKey[]) =>
  [...new Set(keys)].sort((a, b) => CHIP_ORDER.indexOf(a) - CHIP_ORDER.indexOf(b));

const buildExpectation = (
  glyph: string,
  family: string,
  primaryGuide: AuditGuideKey,
  requiredGuides: AuditGuideKey[],
  forbiddenGuides: AuditGuideKey[],
  overshoot: OvershootExpectation,
  priority: AuditPriority,
  note: string,
  workbookRow: number | null,
  workbookSource: GlyphAuditExpectation["workbookSource"] = "CONTROLE LETTRES"
): GlyphAuditExpectation => ({
  glyph,
  family,
  primaryGuide,
  requiredGuides: sortGuideKeys(requiredGuides),
  forbiddenGuides: sortGuideKeys(forbiddenGuides),
  overshoot,
  priority,
  note,
  workbookRow,
  workbookSource,
});

export const GLYPH_AUDIT_EXPECTATIONS: GlyphAuditExpectation[] = [
  buildExpectation("x", "Minuscules x height", "x", ["x", "baseline"], ["cap", "ascender", "descender"], "none", "high", "Reference la plus propre pour valider la x height.", 2),
  buildExpectation("a", "Minuscules x height", "x", ["x", "baseline"], ["cap", "ascender", "descender"], "none", "medium", "Le haut du bol doit confirmer la x height sans couper la contreforme.", 3),
  buildExpectation("e", "Minuscules x height", "x", ["x", "baseline"], ["cap", "ascender", "descender"], "none", "high", "Lettre critique car ouverture, barre et courbe revelent vite les faux contacts.", 4),
  buildExpectation("n", "Minuscules x height", "x", ["x", "baseline"], ["cap", "ascender", "descender"], "none", "medium", "Bon test des verticales et du sommet d arche.", 5),
  buildExpectation("o", "Minuscules x height", "x", ["x", "baseline"], ["cap", "ascender", "descender"], "possible", "high", "Lettre ronde avec depassement optique possible.", 6),
  buildExpectation("s", "Minuscules x height", "x", ["x", "baseline"], ["cap", "ascender", "descender"], "possible", "medium", "Courbes complexes et equilibre optique fragile.", 7),
  buildExpectation("c", "Minuscules x height", "x", ["x", "baseline"], ["cap", "ascender", "descender"], "possible", "medium", "Ouverture et courbe pouvant depasser legerement.", 8),
  buildExpectation("r", "Minuscules x height", "x", ["x", "baseline"], ["cap", "ascender", "descender"], "none", "medium", "Petit sommet qui peut tromper si la mesure est trop globale.", 9),
  buildExpectation("m", "Minuscules x height", "x", ["x", "baseline"], ["cap", "ascender", "descender"], "none", "medium", "Plusieurs arches pour verifier la stabilite de la ligne.", 10),
  buildExpectation("z", "Minuscules x height", "x", ["x", "baseline"], ["cap", "ascender", "descender"], "none", "medium", "Lettre angulaire utile pour voir si la x height est trop theorique.", 11),
  buildExpectation("b", "Ascenders", "ascender", ["x", "ascender", "baseline"], ["cap", "descender"], "possible", "high", "Le bol reste sur la x height pendant que la hampe monte dans la zone ascender.", 12),
  buildExpectation("d", "Ascenders", "ascender", ["x", "ascender", "baseline"], ["cap", "descender"], "possible", "high", "Le test le plus lisible pour expliquer ascender contre x height.", 13),
  buildExpectation("h", "Ascenders", "ascender", ["x", "ascender", "baseline"], ["cap", "descender"], "possible", "high", "La hampe et l arche doivent montrer deux hauteurs nettes.", 14),
  buildExpectation("k", "Ascenders", "ascender", ["x", "ascender", "baseline"], ["cap", "descender"], "possible", "medium", "Les diagonales peuvent creer une fausse impression si la ligne est mal ancree.", 15),
  buildExpectation("l", "Ascenders", "ascender", ["x", "ascender", "baseline"], ["cap", "descender"], "possible", "high", "Reference simple pour le sommet d ascender.", 16),
  buildExpectation("t", "Ascenders", "ascender", ["x", "ascender", "baseline"], ["cap", "descender"], "possible", "medium", "Lettre piegeuse car souvent plus basse qu une vraie ascender selon les fontes.", 17),
  buildExpectation("f", "Ascenders", "ascender", ["x", "ascender", "baseline"], ["cap", "descender"], "possible", "medium", "Sommet pouvant depasser ou varier fortement selon la fonte.", 18),
  buildExpectation("p", "Descenders", "descender", ["x", "baseline", "descender"], ["cap", "ascender"], "possible", "high", "La hampe descend sous la baseline et doit rejoindre la descender.", 19),
  buildExpectation("q", "Descenders", "descender", ["x", "baseline", "descender"], ["cap", "ascender"], "possible", "high", "Meme logique que p avec direction opposee.", 20),
  buildExpectation("g", "Descenders", "descender", ["x", "baseline", "descender"], ["cap", "ascender"], "possible", "high", "Lettre tres dangereuse car le dessin change beaucoup selon la fonte.", 21),
  buildExpectation("j", "Descenders", "descender", ["x", "baseline", "descender"], ["cap", "ascender"], "possible", "medium", "Peut descendre tres bas et creer un faux maximum.", 22),
  buildExpectation("y", "Descenders", "descender", ["x", "baseline", "descender"], ["cap", "ascender"], "possible", "medium", "Diagonales et terminaison peuvent donner un contact difficile a lire.", 23),
  buildExpectation("H", "Majuscules cap height", "cap", ["cap", "baseline"], ["x", "ascender", "descender"], "none", "high", "Reference principale de cap height. Tres stable.", 24),
  buildExpectation("E", "Majuscules cap height", "cap", ["cap", "baseline"], ["x", "ascender", "descender"], "none", "medium", "Test vertical et horizontal fiable.", 25),
  buildExpectation("T", "Majuscules cap height", "cap", ["cap", "baseline"], ["x", "ascender", "descender"], "none", "medium", "Tres utile pour controler la hauteur de barre superieure.", 26),
  buildExpectation("I", "Majuscules cap height", "cap", ["cap", "baseline"], ["x", "ascender", "descender"], "none", "medium", "Simple mais utile comme majuscule tres stable.", 27),
  buildExpectation("A", "Majuscules cap height", "cap", ["cap", "baseline"], ["x", "ascender", "descender"], "none", "medium", "Sommet pointu qui peut creer une impression differente du vrai contact.", 28),
  buildExpectation("M", "Majuscules cap height", "cap", ["cap", "baseline"], ["x", "ascender", "descender"], "none", "medium", "Sommet double utile pour verifier largeur et hauteur.", 29),
  buildExpectation("O", "Majuscules cap height", "cap", ["cap", "baseline"], ["x", "ascender", "descender"], "expected", "high", "Lettre ronde avec depassement optique frequent.", 30),
  buildExpectation("C", "Majuscules cap height", "cap", ["cap", "baseline"], ["x", "ascender", "descender"], "expected", "high", "Courbe ouverte avec depassement possible.", 31),
  buildExpectation("G", "Majuscules cap height", "cap", ["cap", "baseline"], ["x", "ascender"], "expected", "medium", "Courbe complexe avec depassement et details internes.", 32),
  buildExpectation("S", "Majuscules cap height", "cap", ["cap", "baseline"], ["x", "ascender", "descender"], "expected", "medium", "Courbe tres optique, a ne pas utiliser comme seule reference.", 33),
  buildExpectation("Q", "Majuscules cap height", "cap", ["cap", "baseline", "descender"], ["x", "ascender"], "expected", "medium", "Rond plus queue, attention au bas qui peut perturber.", 34),
  buildExpectation("0", "Cap-like numerals", "cap", ["cap", "baseline"], ["x", "ascender", "descender"], "possible", "medium", "Extension manuelle utile pour valider les chiffres cap-like dans l interface.", null, "manual-extension"),
];

export const GLYPH_AUDIT_GROUPS: GlyphAuditGroup[] = [
  {
    id: "lowercase-x-height",
    title: "Minuscules x-height",
    note: "Spec issue du tableau pour les minuscules dont le corps principal doit s arreter proprement sur la x-height.",
    glyphs: ["x", "a", "e", "n", "o", "s", "c", "r", "m", "z"],
  },
  {
    id: "ascenders",
    title: "Ascenders",
    note: "Les glyphes a hampe haute doivent exposer deux niveaux distincts: x-height pour le corps, ascender pour la hampe.",
    glyphs: ["b", "d", "h", "k", "l", "t", "f"],
  },
  {
    id: "descenders",
    title: "Descenders",
    note: "Le point le plus bas visible doit rejoindre la descender, tout en conservant la baseline et la x-height.",
    glyphs: ["p", "q", "g", "j", "y"],
  },
  {
    id: "cap-height",
    title: "Majuscules cap height",
    note: "La cap height doit etre validee d abord sur les formes droites puis challengee sur les rondes avec overshoot attendu.",
    glyphs: ["H", "E", "T", "I", "A", "M", "O", "C", "G", "S", "Q", "0"],
  },
];

const EXPECTATION_MAP = new Map(GLYPH_AUDIT_EXPECTATIONS.map((expectation) => [expectation.glyph, expectation]));

export const getGlyphAuditExpectation = (glyph: string) => EXPECTATION_MAP.get(glyph) ?? null;

export const formatGuideLabel = (key: AuditGuideKey) => {
  switch (key) {
    case "x":
      return "x-height";
    case "cap":
      return "cap height";
    case "ascender":
      return "ascender";
    case "baseline":
      return "baseline";
    case "descender":
      return "descender";
  }
};

export const formatChipLabel = (key: AuditChipKey) => {
  if (key === "width") return "width";
  return formatGuideLabel(key);
};

export const evaluateGlyphAudit = (
  expectation: GlyphAuditExpectation,
  overlayModel: GlyphOverlayModel,
  metrics: GlyphMetrics
): GlyphAuditEvaluation => {
  const actualGuides = sortGuideKeys(
    overlayModel.guideLines
      .map((guide) => guide.key)
      .filter((key): key is AuditGuideKey => GUIDE_ORDER.includes(key as AuditGuideKey))
  );
  const expectedGuides = sortGuideKeys(expectation.requiredGuides);
  const actualChips = sortChipKeys(
    overlayModel.metricChips
      .map((chip) => chip.key)
      .filter((key): key is AuditChipKey => CHIP_ORDER.includes(key as AuditChipKey))
  );
  const expectedChips = sortChipKeys([...expectation.requiredGuides.filter((key) => key !== "baseline"), "width"]);
  const expectedAxisCount = expectation.requiredGuides.filter((key) => key !== "baseline").length;
  const actualAxisCount = overlayModel.verticalMeasures.length;
  const missingGuides = expectedGuides.filter((key) => !actualGuides.includes(key));
  const forbiddenGuidesPresent = expectation.forbiddenGuides.filter((key) => actualGuides.includes(key));
  const chipMismatch =
    actualChips.length !== expectedChips.length || actualChips.some((key, index) => key !== expectedChips[index]);
  const axisMismatch = actualAxisCount !== expectedAxisCount;
  const structuralIssues: string[] = [];

  if (missingGuides.length) {
    structuralIssues.push(`Missing ${missingGuides.map(formatGuideLabel).join(", ")}`);
  }

  if (forbiddenGuidesPresent.length) {
    structuralIssues.push(`Unexpected ${forbiddenGuidesPresent.map(formatGuideLabel).join(", ")}`);
  }

  if (chipMismatch) {
    structuralIssues.push(
      `Expected chips ${expectedChips.map(formatChipLabel).join(" + ") || "none"}, got ${
        actualChips.map(formatChipLabel).join(" + ") || "none"
      }`
    );
  }

  if (axisMismatch) {
    structuralIssues.push(`Expected ${expectedAxisCount} vertical measure${expectedAxisCount > 1 ? "s" : ""}, got ${actualAxisCount}`);
  }

  const touchTolerance = Math.max(metrics.fontSize * 0.018, 2.25);
  const overshootTolerance = Math.max(metrics.fontSize * 0.05, 6);
  const geometryIssues: string[] = [];
  const geometry: GlyphAuditEvaluation["geometry"] = {};
  const topGuides = new Set<AuditGuideKey>(["x", "cap", "ascender"]);
  const edgeSnapTolerance = Math.max(metrics.fontSize * 0.025, 3);

  for (const guideKey of expectedGuides) {
    const guide = overlayModel.guideLines.find((entry) => entry.key === guideKey);
    if (!guide) {
      geometry[guideKey] = { deltaPx: null, tolerancePx: touchTolerance, mode: "strict" };
      continue;
    }

    const snappedToTopEdge = topGuides.has(guideKey) && Math.abs(guide.y - metrics.top) <= edgeSnapTolerance;
    const snappedToBottomEdge = guideKey === "descender" && Math.abs(guide.y - metrics.bottom) <= edgeSnapTolerance;
    const snappedToBottomBaseline = guideKey === "baseline" && Math.abs(guide.y - metrics.bottom) <= edgeSnapTolerance;

    const edgeContactY = snappedToTopEdge ? metrics.top : snappedToBottomEdge || snappedToBottomBaseline ? metrics.bottom : null;
    const contact = edgeContactY === null ? getProjectedGuideContact(guideKey, guide.y, metrics) : null;
    const resolvedContactY = edgeContactY ?? contact?.y ?? null;

    if (resolvedContactY === null) {
      geometry[guideKey] = { deltaPx: null, tolerancePx: touchTolerance, mode: "strict" };
      geometryIssues.push(`No contact sample for ${formatGuideLabel(guideKey)}`);
      continue;
    }

    const deltaPx = resolvedContactY - guide.y;
    const allowsOvershoot =
      expectation.overshoot !== "none" && (guideKey === "x" || guideKey === "cap" || guideKey === "descender");
    const tolerancePx = allowsOvershoot ? overshootTolerance : touchTolerance;
    const mode = allowsOvershoot ? "overshoot" : "strict";
    geometry[guideKey] = { deltaPx, tolerancePx, mode };

    const isWithinRange = allowsOvershoot
      ? deltaPx <= touchTolerance && deltaPx >= -tolerancePx
      : Math.abs(deltaPx) <= tolerancePx;

    if (!isWithinRange) {
      const direction =
        topGuides.has(guideKey) || guideKey === "descender"
          ? deltaPx > 0
            ? "floating above the ink"
            : "cutting into the ink"
          : deltaPx > 0
            ? "missing the ink contact"
            : "floating below the ink";
      geometryIssues.push(
        `${formatGuideLabel(guideKey)} is ${direction} (${deltaPx.toFixed(1)}px, tolerance ${tolerancePx.toFixed(1)}px)`
      );
    }
  }

  const structuralPass = structuralIssues.length === 0;
  const geometryPass = geometryIssues.length === 0;
  const issues = [...structuralIssues, ...geometryIssues];

  return {
    pass: issues.length === 0,
    structuralPass,
    geometryPass,
    actualGuides,
    expectedGuides,
    actualChips,
    expectedChips,
    actualAxisCount,
    expectedAxisCount,
    missingGuides,
    forbiddenGuidesPresent,
    chipMismatch,
    axisMismatch,
    issues,
    geometry,
  };
};
