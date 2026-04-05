#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const argv = process.argv.slice(2);
const strictMode = argv.includes("--strict");
const jsonFlagIndex = argv.indexOf("--json");
const jsonOutputPath =
  jsonFlagIndex >= 0 && argv[jsonFlagIndex + 1]
    ? path.resolve(repoRoot, argv[jsonFlagIndex + 1])
    : null;

const typographyRoot = path.join(repoRoot, "content", "typography");
const typefacesDir = path.join(typographyRoot, "typefaces");
const conceptsDir = path.join(typographyRoot, "concepts");
const overridesDir = path.join(typographyRoot, "overrides");
const generatedDir = path.join(typographyRoot, "generated");
const comparisonsFile = path.join(generatedDir, "comparisons.json");
const slugHistoryFile = path.join(generatedDir, "slug-history.json");
const slugRedirectsFile = path.join(generatedDir, "slug-redirects.json");

const strictEscalationCodes = new Set(["VAL_SEO_001", "VAL_SEO_002", "VAL_MESH_001", "VAL_MESH_002"]);

/**
 * @typedef {"BLOCK" | "WARN" | "INFO"} Severity
 * @typedef {{
 * severity: Severity;
 * code: string;
 * path: string;
 * field: string;
 * message: string;
 * action: string;
 * context?: Record<string, unknown>;
 * }} Issue
 */

/** @type {Issue[]} */
const issues = [];

const addIssue = (issue) => {
  const nextIssue = { ...issue };
  if (strictMode && issue.severity === "WARN" && strictEscalationCodes.has(issue.code)) {
    nextIssue.severity = "BLOCK";
  }
  issues.push(nextIssue);
};

if (!fs.existsSync(typographyRoot)) {
  addIssue({
    severity: "INFO",
    code: "VAL_INFO_005",
    path: "content/typography",
    field: "root",
    message: "Racine canonique absente pour le systeme typographique",
    action: "Creer `content/typography/{typefaces,concepts,overrides,generated}` avant le premier lot.",
  });
}

const parseJsonFile = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_002",
      path: path.relative(repoRoot, filePath),
      field: "$",
      message: "Impossible de parser le fichier JSON.",
      action: "Corriger la syntaxe JSON.",
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    return null;
  }
};

const listJsonFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
};

const ensureRequiredFields = (entity, requiredFields, filePath, entityLabel) => {
  for (const requiredField of requiredFields) {
    if (!(requiredField in entity)) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_SCHEMA_001",
        path: path.relative(repoRoot, filePath),
        field: requiredField,
        message: `Champ obligatoire manquant (${entityLabel}).`,
        action: `Ajouter le champ \`${requiredField}\`.`,
      });
    }
  }
};

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const buildPairId = (leftId, rightId) => [leftId, rightId].sort((a, b) => a.localeCompare(b)).join("--");

const slugRoute = (kind, slug) => {
  if (kind === "typeface") {
    return `/type/${slug}`;
  }
  if (kind === "concept") {
    return `/learn/${slug}`;
  }
  return `/unknown/${slug}`;
};

const typefaceFiles = listJsonFiles(typefacesDir);
const conceptFiles = listJsonFiles(conceptsDir);
const overrideFiles = listJsonFiles(path.join(overridesDir, "type"))
  .concat(listJsonFiles(path.join(overridesDir, "compare")))
  .concat(listJsonFiles(path.join(overridesDir, "concept")));

/** @type {Array<Record<string, unknown> & {__file: string}>} */
const typefaces = [];
/** @type {Array<Record<string, unknown> & {__file: string}>} */
const concepts = [];
/** @type {Array<Record<string, unknown> & {__file: string}>} */
const comparisons = [];
/** @type {Array<Record<string, unknown> & {__file: string}>} */
const overrides = [];

for (const filePath of typefaceFiles) {
  const data = parseJsonFile(filePath);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    continue;
  }
  const entity = { ...data, __file: filePath };
  typefaces.push(entity);

  ensureRequiredFields(entity, ["id", "slug", "status", "name", "category", "subCategory", "features", "specimen"], filePath, "typeface");

  if (entity.status && !["draft", "published"].includes(String(entity.status))) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_003",
      path: path.relative(repoRoot, filePath),
      field: "status",
      message: "Valeur de status invalide pour typeface.",
      action: "Utiliser `draft` ou `published`.",
    });
  }

  if (!isNonEmptyString(entity.id) || !String(entity.id).startsWith("tf_")) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_002",
      path: path.relative(repoRoot, filePath),
      field: "id",
      message: "Format de `id` invalide pour typeface.",
      action: "Utiliser une chaine non vide commencant par `tf_`.",
    });
  }
}

for (const filePath of conceptFiles) {
  const data = parseJsonFile(filePath);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    continue;
  }
  const entity = { ...data, __file: filePath };
  concepts.push(entity);

  ensureRequiredFields(entity, ["id", "slug", "status", "title", "definitionShort", "featureKeys", "body"], filePath, "concept");

  if (entity.status && !["draft", "published"].includes(String(entity.status))) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_003",
      path: path.relative(repoRoot, filePath),
      field: "status",
      message: "Valeur de status invalide pour concept.",
      action: "Utiliser `draft` ou `published`.",
    });
  }

  if (!isNonEmptyString(entity.id) || !String(entity.id).startsWith("cp_")) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_002",
      path: path.relative(repoRoot, filePath),
      field: "id",
      message: "Format de `id` invalide pour concept.",
      action: "Utiliser une chaine non vide commencant par `cp_`.",
    });
  }
}

if (fs.existsSync(comparisonsFile)) {
  const data = parseJsonFile(comparisonsFile);
  if (Array.isArray(data)) {
    for (const item of data) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_SCHEMA_002",
          path: path.relative(repoRoot, comparisonsFile),
          field: "$[]",
          message: "Entree comparison invalide.",
          action: "Chaque entree doit etre un objet JSON.",
        });
        continue;
      }
      comparisons.push({ ...item, __file: comparisonsFile });
    }
  } else {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_002",
      path: path.relative(repoRoot, comparisonsFile),
      field: "$",
      message: "Le fichier comparisons doit contenir un tableau JSON.",
      action: "Utiliser un tableau d'objets comparison.",
    });
  }
}

for (const filePath of overrideFiles) {
  const data = parseJsonFile(filePath);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    continue;
  }
  overrides.push({ ...data, __file: filePath });
}

const typefaceById = new Map();
const conceptById = new Map();
const typefaceSlugToPath = new Map();
const conceptSlugToPath = new Map();
const comparisonSlugToPath = new Map();
const publishedTypefaceIds = new Set();
const publishedConceptIds = new Set();
const allRoutes = new Map();

for (const typeface of typefaces) {
  const filePath = String(typeface.__file);
  const relPath = path.relative(repoRoot, filePath);
  const id = String(typeface.id ?? "");
  const slug = String(typeface.slug ?? "");

  if (typefaceById.has(id)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_UNIQUE_001",
      path: relPath,
      field: "id",
      message: `Duplication d'id typeface (${id}).`,
      action: "Conserver un id unique.",
    });
  } else if (isNonEmptyString(id)) {
    typefaceById.set(id, typeface);
  }

  if (!isNonEmptyString(slug)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_001",
      path: relPath,
      field: "slug",
      message: "Slug typeface manquant ou vide.",
      action: "Ajouter un slug non vide.",
    });
  } else {
    const previousSlugPath = typefaceSlugToPath.get(slug);
    const hasDuplicateSlug = Boolean(previousSlugPath);
    if (hasDuplicateSlug) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_UNIQUE_002",
        path: relPath,
        field: "slug",
        message: `Duplication de slug typeface (${slug}).`,
        action: "Conserver un slug unique par typeface.",
        context: { other: previousSlugPath },
      });
    } else {
      typefaceSlugToPath.set(slug, relPath);
      const route = slugRoute("typeface", slug);
      if (allRoutes.has(route)) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_ROUTE_001",
          path: relPath,
          field: "slug",
          message: `Collision de route (${route}).`,
          action: "Utiliser un slug unique.",
          context: { other: allRoutes.get(route) },
        });
      } else {
        allRoutes.set(route, relPath);
      }
    }
  }

  if (typeface.status === "published") {
    publishedTypefaceIds.add(id);
    const seo = typeface.seo;
    if (!seo || typeof seo !== "object" || Array.isArray(seo) || !isNonEmptyString(seo.title)) {
      addIssue({
        severity: "WARN",
        code: "VAL_SEO_001",
        path: relPath,
        field: "seo.title",
        message: "seo.title manquant sur une typeface publiee.",
        action: "Renseigner seo.title.",
      });
    }
    if (!seo || typeof seo !== "object" || Array.isArray(seo) || !isNonEmptyString(seo.description)) {
      addIssue({
        severity: "WARN",
        code: "VAL_SEO_002",
        path: relPath,
        field: "seo.description",
        message: "seo.description manquante sur une typeface publiee.",
        action: "Renseigner seo.description.",
      });
    }
  }
}

for (const concept of concepts) {
  const filePath = String(concept.__file);
  const relPath = path.relative(repoRoot, filePath);
  const id = String(concept.id ?? "");
  const slug = String(concept.slug ?? "");

  if (conceptById.has(id)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_UNIQUE_001",
      path: relPath,
      field: "id",
      message: `Duplication d'id concept (${id}).`,
      action: "Conserver un id unique.",
    });
  } else if (isNonEmptyString(id)) {
    conceptById.set(id, concept);
  }

  if (!isNonEmptyString(slug)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_001",
      path: relPath,
      field: "slug",
      message: "Slug concept manquant ou vide.",
      action: "Ajouter un slug non vide.",
    });
  } else {
    const previousSlugPath = conceptSlugToPath.get(slug);
    const hasDuplicateSlug = Boolean(previousSlugPath);
    if (hasDuplicateSlug) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_UNIQUE_002",
        path: relPath,
        field: "slug",
        message: `Duplication de slug concept (${slug}).`,
        action: "Conserver un slug unique par concept.",
        context: { other: previousSlugPath },
      });
    } else {
      conceptSlugToPath.set(slug, relPath);
      const route = slugRoute("concept", slug);
      if (allRoutes.has(route)) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_ROUTE_001",
          path: relPath,
          field: "slug",
          message: `Collision de route (${route}).`,
          action: "Utiliser un slug unique.",
          context: { other: allRoutes.get(route) },
        });
      } else {
        allRoutes.set(route, relPath);
      }
    }
  }

  if (concept.status === "published") {
    publishedConceptIds.add(id);
    const seo = concept.seo;
    if (!seo || typeof seo !== "object" || Array.isArray(seo) || !isNonEmptyString(seo.title)) {
      addIssue({
        severity: "WARN",
        code: "VAL_SEO_001",
        path: relPath,
        field: "seo.title",
        message: "seo.title manquant sur un concept publie.",
        action: "Renseigner seo.title.",
      });
    }
    if (!seo || typeof seo !== "object" || Array.isArray(seo) || !isNonEmptyString(seo.description)) {
      addIssue({
        severity: "WARN",
        code: "VAL_SEO_002",
        path: relPath,
        field: "seo.description",
        message: "seo.description manquante sur un concept publie.",
        action: "Renseigner seo.description.",
      });
    }
  }
}

for (const typeface of typefaces) {
  const relPath = path.relative(repoRoot, String(typeface.__file));
  const conceptRefs = Array.isArray(typeface.conceptRefs) ? typeface.conceptRefs : [];
  for (const conceptId of conceptRefs) {
    if (!conceptById.has(String(conceptId))) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_REF_001",
        path: relPath,
        field: "conceptRefs",
        message: `Reference concept introuvable (${conceptId}).`,
        action: "Corriger conceptRefs vers des concepts existants.",
      });
      continue;
    }
    if (!publishedConceptIds.has(String(conceptId))) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_REF_002",
        path: relPath,
        field: "conceptRefs",
        message: `Reference vers concept non publie (${conceptId}).`,
        action: "Publier le concept cible ou retirer la reference.",
      });
    }
  }
}

for (const concept of concepts) {
  const relPath = path.relative(repoRoot, String(concept.__file));
  const exampleTypefaceIds = Array.isArray(concept.exampleTypefaceIds) ? concept.exampleTypefaceIds : [];
  for (const typefaceId of exampleTypefaceIds) {
    if (!typefaceById.has(String(typefaceId))) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_REF_001",
        path: relPath,
        field: "exampleTypefaceIds",
        message: `Reference typeface introuvable (${typefaceId}).`,
        action: "Corriger exampleTypefaceIds vers des typefaces existantes.",
      });
      continue;
    }
    if (!publishedTypefaceIds.has(String(typefaceId))) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_REF_002",
        path: relPath,
        field: "exampleTypefaceIds",
        message: `Reference vers typeface non publiee (${typefaceId}).`,
        action: "Publier la typeface cible ou retirer la reference.",
      });
    }
  }
}

const comparisonIndexByPairId = new Map();
const comparisonsPerTypeface = new Map();
const outgoingByRoute = new Map();
const incomingByRoute = new Map();

for (const comparison of comparisons) {
  const relPath = path.relative(repoRoot, String(comparison.__file));
  ensureRequiredFields(
    comparison,
    ["pairId", "slug", "leftId", "rightId", "status", "diffHighlights", "score", "conceptRefs"],
    String(comparison.__file),
    "comparison"
  );

  const pairId = String(comparison.pairId ?? "");
  const leftId = String(comparison.leftId ?? "");
  const rightId = String(comparison.rightId ?? "");
  const expectedPairId = buildPairId(leftId, rightId);
  const slug = String(comparison.slug ?? "");
  const status = String(comparison.status ?? "");

  if (!isNonEmptyString(pairId) || pairId !== expectedPairId) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_PAIR_001",
      path: relPath,
      field: "pairId",
      message: `pairId non canonique (${pairId}).`,
      action: `Utiliser ${expectedPairId}.`,
    });
  }

  if (leftId === rightId) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_PAIR_002",
      path: relPath,
      field: "leftId/rightId",
      message: "Une comparaison ne peut pas cibler la meme typeface des deux cotes.",
      action: "Utiliser deux ids de typeface differents.",
    });
  }

  if (!["draft", "published"].includes(status)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_003",
      path: relPath,
      field: "status",
      message: "Valeur de status invalide pour comparison.",
      action: "Utiliser `draft` ou `published`.",
    });
  }

  if (comparisonIndexByPairId.has(pairId)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_UNIQUE_001",
      path: relPath,
      field: "pairId",
      message: `Duplication de pairId (${pairId}).`,
      action: "Conserver une seule comparaison par pairId.",
    });
  } else {
    comparisonIndexByPairId.set(pairId, comparison);
  }

  if (!typefaceById.has(leftId)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_REF_001",
      path: relPath,
      field: "leftId",
      message: `leftId introuvable (${leftId}).`,
      action: "Corriger leftId vers une typeface existante.",
    });
  } else if (!publishedTypefaceIds.has(leftId)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_REF_002",
      path: relPath,
      field: "leftId",
      message: `leftId non publie (${leftId}).`,
      action: "Publier la typeface cible ou retirer la comparaison.",
    });
  }

  if (!typefaceById.has(rightId)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_REF_001",
      path: relPath,
      field: "rightId",
      message: `rightId introuvable (${rightId}).`,
      action: "Corriger rightId vers une typeface existante.",
    });
  } else if (!publishedTypefaceIds.has(rightId)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_REF_002",
      path: relPath,
      field: "rightId",
      message: `rightId non publie (${rightId}).`,
      action: "Publier la typeface cible ou retirer la comparaison.",
    });
  }

  if (!comparisonsPerTypeface.has(leftId)) {
    comparisonsPerTypeface.set(leftId, []);
  }
  if (!comparisonsPerTypeface.has(rightId)) {
    comparisonsPerTypeface.set(rightId, []);
  }
  comparisonsPerTypeface.get(leftId).push(pairId);
  comparisonsPerTypeface.get(rightId).push(pairId);

  if (!isNonEmptyString(slug)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_001",
      path: relPath,
      field: "slug",
      message: "Slug comparison manquant ou vide.",
      action: "Ajouter un slug non vide.",
    });
  } else {
    const previousSlugPath = comparisonSlugToPath.get(slug);
    const hasDuplicateSlug = Boolean(previousSlugPath);
    if (hasDuplicateSlug) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_UNIQUE_002",
        path: relPath,
        field: "slug",
        message: `Duplication de slug comparison (${slug}).`,
        action: "Conserver un slug unique par comparaison.",
        context: { other: previousSlugPath },
      });
    } else {
      comparisonSlugToPath.set(slug, relPath);
      const compareRoute = `/compare/${slug}`;
      if (allRoutes.has(compareRoute)) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_ROUTE_001",
          path: relPath,
          field: "slug",
          message: `Collision de route (${compareRoute}).`,
          action: "Utiliser un slug de comparaison unique.",
          context: { other: allRoutes.get(compareRoute) },
        });
      } else {
        allRoutes.set(compareRoute, relPath);
      }
    }
  }

  const conceptRefs = comparison.conceptRefs;
  if (!Array.isArray(conceptRefs)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_002",
      path: relPath,
      field: "conceptRefs",
      message: "conceptRefs doit etre un tableau.",
      action: "Utiliser un tableau d'ids de concepts.",
    });
  } else {
    for (const conceptId of conceptRefs) {
      const conceptIdText = String(conceptId ?? "");
      if (!isNonEmptyString(conceptIdText)) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_SCHEMA_002",
          path: relPath,
          field: "conceptRefs[]",
          message: "Entrée conceptRefs invalide.",
          action: "Utiliser des ids `cp_*` non vides.",
        });
        continue;
      }
      if (!conceptById.has(conceptIdText)) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_REF_001",
          path: relPath,
          field: "conceptRefs",
          message: `Reference concept introuvable (${conceptIdText}).`,
          action: "Corriger conceptRefs vers des concepts existants.",
        });
        continue;
      }
      if (!publishedConceptIds.has(conceptIdText)) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_REF_002",
          path: relPath,
          field: "conceptRefs",
          message: `Reference vers concept non publie (${conceptIdText}).`,
          action: "Publier le concept cible ou retirer la reference.",
        });
      }
    }
  }

  if (!Array.isArray(comparison.diffHighlights)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_002",
      path: relPath,
      field: "diffHighlights",
      message: "diffHighlights doit etre un tableau.",
      action: "Fournir un tableau d'objets de differences.",
    });
  } else if (comparison.diffHighlights.length === 0) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_001",
      path: relPath,
      field: "diffHighlights",
      message: "diffHighlights vide.",
      action: "Ajouter au moins une difference.",
    });
  } else {
    comparison.diffHighlights.forEach((highlight, index) => {
      if (!isPlainObject(highlight)) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_SCHEMA_002",
          path: relPath,
          field: `diffHighlights[${index}]`,
          message: "Chaque diffHighlight doit etre un objet.",
          action: "Utiliser un objet avec `feature`, `left`, `right`.",
        });
        return;
      }

      const feature = String(highlight.feature ?? "");
      const left = String(highlight.left ?? "");
      const right = String(highlight.right ?? "");
      if (!isNonEmptyString(feature) || !isNonEmptyString(left) || !isNonEmptyString(right)) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_SCHEMA_002",
          path: relPath,
          field: `diffHighlights[${index}]`,
          message: "diffHighlight incomplet.",
          action: "Renseigner `feature`, `left`, `right` en chaines non vides.",
        });
      }
    });
  }

  if (typeof comparison.score !== "number" || Number.isNaN(comparison.score)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_002",
      path: relPath,
      field: "score",
      message: "Score invalide.",
      action: "Utiliser un nombre.",
    });
  } else if (comparison.score < 0 || comparison.score > 1) {
    addIssue({
      severity: "WARN",
      code: "VAL_QUALITY_001",
      path: relPath,
      field: "score",
      message: `Score hors plage recommandee (${comparison.score}).`,
      action: "Utiliser un score compris entre 0 et 1.",
    });
  }

  if (status === "published") {
    const seo = comparison.seo;
    if (!isPlainObject(seo) || !isNonEmptyString(seo.title)) {
      addIssue({
        severity: "WARN",
        code: "VAL_SEO_001",
        path: relPath,
        field: "seo.title",
        message: "seo.title manquant sur une comparaison publiee.",
        action: "Renseigner seo.title.",
      });
    }
    if (!isPlainObject(seo) || !isNonEmptyString(seo.description)) {
      addIssue({
        severity: "WARN",
        code: "VAL_SEO_002",
        path: relPath,
        field: "seo.description",
        message: "seo.description manquante sur une comparaison publiee.",
        action: "Renseigner seo.description.",
      });
    }
  }
}

const lockedOverrideKeys = new Set([
  "id",
  "slug",
  "pairId",
  "leftId",
  "rightId",
  "status",
  "features",
  "category",
  "subCategory",
]);

const allowedOverrideKeys = new Set([
  "target",
  "targetId",
  "heroTitle",
  "heroIntro",
  "introRichText",
  "orderedComparisons",
  "orderedConcepts",
  "pinnedConceptIds",
  "ctaGameVariant",
  "faq",
  "seo",
  "specimen",
]);

for (const override of overrides) {
  const relPath = path.relative(repoRoot, String(override.__file));
  ensureRequiredFields(override, ["target", "targetId"], String(override.__file), "override");

  const target = String(override.target ?? "");
  const targetId = String(override.targetId ?? "");

  if (!["type", "compare", "concept"].includes(target)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_003",
      path: relPath,
      field: "target",
      message: "Valeur target invalide.",
      action: "Utiliser `type`, `compare`, ou `concept`.",
    });
    continue;
  }

  for (const key of Object.keys(override)) {
    if (key === "__file") {
      continue;
    }
    if (lockedOverrideKeys.has(key)) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_LOCK_001",
        path: relPath,
        field: key,
        message: "Champ verrouille surcharge dans override.",
        action: `Retirer \`${key}\` de l'override.`,
      });
    }
    if (!allowedOverrideKeys.has(key) && key !== "target" && key !== "targetId") {
      addIssue({
        severity: "WARN",
        code: "VAL_OVERRIDE_101",
        path: relPath,
        field: key,
        message: "Champ override non reconnu.",
        action: "Verifier que ce champ est bien supporte par le contrat.",
      });
    }
  }

  if ("seo" in override) {
    if (!isPlainObject(override.seo)) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_SCHEMA_002",
        path: relPath,
        field: "seo",
        message: "seo override doit etre un objet.",
        action: "Utiliser un objet `{ title?, description? }`.",
      });
    } else {
      if ("title" in override.seo && !isNonEmptyString(override.seo.title)) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_SCHEMA_002",
          path: relPath,
          field: "seo.title",
          message: "seo.title override invalide.",
          action: "Utiliser une chaine non vide.",
        });
      }
      if ("description" in override.seo && !isNonEmptyString(override.seo.description)) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_SCHEMA_002",
          path: relPath,
          field: "seo.description",
          message: "seo.description override invalide.",
          action: "Utiliser une chaine non vide.",
        });
      }
    }
  }

  if ("specimen" in override) {
    if (target !== "type") {
      addIssue({
        severity: "BLOCK",
        code: "VAL_LOCK_002",
        path: relPath,
        field: "specimen",
        message: "specimen override autorise uniquement pour target=type.",
        action: "Retirer specimen de cet override.",
      });
    } else if (!isPlainObject(override.specimen)) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_SCHEMA_002",
        path: relPath,
        field: "specimen",
        message: "specimen override doit etre un objet.",
        action: "Utiliser un objet `{ defaultText }`.",
      });
    } else {
      const specimenKeys = Object.keys(override.specimen);
      const unsupportedSpecimenKeys = specimenKeys.filter((key) => key !== "defaultText");
      if (unsupportedSpecimenKeys.length > 0) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_LOCK_002",
          path: relPath,
          field: "specimen",
          message: `Cles specimen non autorisees (${unsupportedSpecimenKeys.join(", ")}).`,
          action: "Conserver uniquement `specimen.defaultText`.",
        });
      }
      if ("defaultText" in override.specimen && !isNonEmptyString(override.specimen.defaultText)) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_SCHEMA_002",
          path: relPath,
          field: "specimen.defaultText",
          message: "specimen.defaultText override invalide.",
          action: "Utiliser une chaine non vide.",
        });
      }
    }
  }

  if (target === "type") {
    const typeface = typefaceById.get(targetId);
    if (!typeface) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_OVERRIDE_001",
        path: relPath,
        field: "targetId",
        message: `Override type cible introuvable (${targetId}).`,
        action: "Pointer vers une typeface existante.",
      });
    } else if (typeface.status !== "published") {
      addIssue({
        severity: "WARN",
        code: "VAL_OVERRIDE_101",
        path: relPath,
        field: "targetId",
        message: `Override type pointe vers une cible draft (${targetId}).`,
        action: "Publier la cible ou desactiver l'override.",
      });
    }
  }

  if (target === "concept") {
    const concept = conceptById.get(targetId);
    if (!concept) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_OVERRIDE_001",
        path: relPath,
        field: "targetId",
        message: `Override concept cible introuvable (${targetId}).`,
        action: "Pointer vers un concept existant.",
      });
    } else if (concept.status !== "published") {
      addIssue({
        severity: "WARN",
        code: "VAL_OVERRIDE_101",
        path: relPath,
        field: "targetId",
        message: `Override concept pointe vers une cible draft (${targetId}).`,
        action: "Publier la cible ou desactiver l'override.",
      });
    }
  }

  if (target === "compare") {
    if (!comparisonIndexByPairId.has(targetId)) {
      addIssue({
        severity: "BLOCK",
        code: "VAL_OVERRIDE_001",
        path: relPath,
        field: "targetId",
        message: `Override compare cible introuvable (${targetId}).`,
        action: "Pointer vers un pairId existant.",
      });
    }
  }
}

for (const typeface of typefaces) {
  const route = slugRoute("typeface", String(typeface.slug ?? ""));
  const relPath = path.relative(repoRoot, String(typeface.__file));
  const conceptRefs = Array.isArray(typeface.conceptRefs) ? typeface.conceptRefs.map(String) : [];
  const comparisonCount = (comparisonsPerTypeface.get(String(typeface.id ?? "")) ?? []).length;

  const outgoingCount = conceptRefs.length + comparisonCount + 1;
  outgoingByRoute.set(route, outgoingCount);

  if (typeface.status === "published" && comparisonCount < 3) {
    addIssue({
      severity: "WARN",
      code: "VAL_CONTENT_001",
      path: relPath,
      field: "comparisons",
      message: `Comparaisons recommandees insuffisantes (${comparisonCount}).`,
      action: "Ajouter des comparaisons generees ou seeds pertinentes.",
    });
  }

  if (typeface.status === "published" && outgoingCount <= 1) {
    addIssue({
      severity: "WARN",
      code: "VAL_MESH_001",
      path: relPath,
      field: "maillage",
      message: "Liens sortants insuffisants.",
      action: "Ajouter comparaisons et concepts relies.",
    });
  }
}

for (const concept of concepts) {
  const route = slugRoute("concept", String(concept.slug ?? ""));
  const relPath = path.relative(repoRoot, String(concept.__file));
  const exampleIds = Array.isArray(concept.exampleTypefaceIds)
    ? concept.exampleTypefaceIds.map(String)
    : [];
  outgoingByRoute.set(route, exampleIds.length);

  if (concept.status === "published" && exampleIds.length < 2) {
    addIssue({
      severity: "WARN",
      code: "VAL_CONTENT_002",
      path: relPath,
      field: "exampleTypefaceIds",
      message: `Exemples conceptuels insuffisants (${exampleIds.length}).`,
      action: "Ajouter au moins deux typefaces d'exemple.",
    });
  }

  if (concept.status === "published" && exampleIds.length === 0) {
    addIssue({
      severity: "WARN",
      code: "VAL_MESH_001",
      path: relPath,
      field: "maillage",
      message: "Liens sortants insuffisants.",
      action: "Ajouter des typefaces et comparaisons reliees.",
    });
  }
}

for (const comparison of comparisons) {
  const compareRoute = `/compare/${String(comparison.slug ?? "")}`;
  outgoingByRoute.set(compareRoute, 3);
}

for (const typeface of typefaces) {
  const route = slugRoute("typeface", String(typeface.slug ?? ""));
  incomingByRoute.set(route, 0);
}
for (const concept of concepts) {
  const route = slugRoute("concept", String(concept.slug ?? ""));
  incomingByRoute.set(route, 0);
}

for (const comparison of comparisons) {
  const left = typefaceById.get(String(comparison.leftId ?? ""));
  const right = typefaceById.get(String(comparison.rightId ?? ""));
  if (left && left.slug) {
    const leftRoute = slugRoute("typeface", String(left.slug));
    incomingByRoute.set(leftRoute, (incomingByRoute.get(leftRoute) ?? 0) + 1);
  }
  if (right && right.slug) {
    const rightRoute = slugRoute("typeface", String(right.slug));
    incomingByRoute.set(rightRoute, (incomingByRoute.get(rightRoute) ?? 0) + 1);
  }
}

for (const typeface of typefaces) {
  const conceptRefs = Array.isArray(typeface.conceptRefs) ? typeface.conceptRefs.map(String) : [];
  for (const conceptId of conceptRefs) {
    const concept = conceptById.get(conceptId);
    if (concept && concept.slug) {
      const conceptRoute = slugRoute("concept", String(concept.slug));
      incomingByRoute.set(conceptRoute, (incomingByRoute.get(conceptRoute) ?? 0) + 1);
    }
  }
}

for (const concept of concepts) {
  const exampleIds = Array.isArray(concept.exampleTypefaceIds)
    ? concept.exampleTypefaceIds.map(String)
    : [];
  for (const typefaceId of exampleIds) {
    const typeface = typefaceById.get(typefaceId);
    if (typeface && typeface.slug) {
      const route = slugRoute("typeface", String(typeface.slug));
      incomingByRoute.set(route, (incomingByRoute.get(route) ?? 0) + 1);
    }
  }
}

for (const typeface of typefaces) {
  if (typeface.status !== "published") {
    continue;
  }
  const route = slugRoute("typeface", String(typeface.slug ?? ""));
  const relPath = path.relative(repoRoot, String(typeface.__file));
  if ((incomingByRoute.get(route) ?? 0) === 0) {
    addIssue({
      severity: "WARN",
      code: "VAL_MESH_002",
      path: relPath,
      field: "maillage",
      message: "Aucun lien entrant detecte.",
      action: "Ajouter des liens depuis concepts ou comparaisons.",
    });
  }
}

for (const concept of concepts) {
  if (concept.status !== "published") {
    continue;
  }
  const route = slugRoute("concept", String(concept.slug ?? ""));
  const relPath = path.relative(repoRoot, String(concept.__file));
  if ((incomingByRoute.get(route) ?? 0) === 0) {
    addIssue({
      severity: "WARN",
      code: "VAL_MESH_002",
      path: relPath,
      field: "maillage",
      message: "Aucun lien entrant detecte.",
      action: "Ajouter des liens depuis pages type et comparaisons.",
    });
  }
}

const readOptionalObject = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const data = parseJsonFile(filePath);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    addIssue({
      severity: "BLOCK",
      code: "VAL_SCHEMA_002",
      path: path.relative(repoRoot, filePath),
      field: "$",
      message: "Objet JSON attendu.",
      action: "Utiliser un objet JSON cle -> valeur.",
    });
    return null;
  }
  return data;
};

const slugHistory = readOptionalObject(slugHistoryFile);
const slugRedirects = readOptionalObject(slugRedirectsFile);
if (slugHistory) {
  for (const typeface of typefaces) {
    if (typeface.status !== "published") {
      continue;
    }
    const id = String(typeface.id ?? "");
    const currentSlug = String(typeface.slug ?? "");
    const previousSlug = typeof slugHistory[id] === "string" ? slugHistory[id] : null;
    if (previousSlug && previousSlug !== currentSlug) {
      const redirectKey = `/type/${previousSlug}`;
      const expectedTarget = `/type/${currentSlug}`;
      const redirectTarget =
        slugRedirects && typeof slugRedirects[redirectKey] === "string"
          ? slugRedirects[redirectKey]
          : null;
      if (redirectTarget !== expectedTarget) {
        addIssue({
          severity: "BLOCK",
          code: "VAL_SLUG_001",
          path: path.relative(repoRoot, String(typeface.__file)),
          field: "slug",
          message: `Slug publie modifie sans redirection (${previousSlug} -> ${currentSlug}).`,
          action: `Ajouter la redirection ${redirectKey} -> ${expectedTarget}.`,
        });
      }
    }
  }
}

addIssue({
  severity: "INFO",
  code: "VAL_INFO_001",
  path: "content/typography",
  field: "counts",
  message: `typefaces=${typefaces.length}, concepts=${concepts.length}, comparisons=${comparisons.length}, overrides=${overrides.length}`,
  action: "Suivre ce volume entre les builds.",
});

const conceptInboundCounts = concepts
  .map((concept) => ({
    id: String(concept.id ?? ""),
    inbound: incomingByRoute.get(slugRoute("concept", String(concept.slug ?? ""))) ?? 0,
  }))
  .sort((a, b) => b.inbound - a.inbound);

if (conceptInboundCounts.length > 0) {
  const topConcepts = conceptInboundCounts
    .slice(0, 3)
    .map((item) => `${item.id}:${item.inbound}`)
    .join(", ");
  addIssue({
    severity: "INFO",
    code: "VAL_INFO_002",
    path: "content/typography/concepts",
    field: "inbound",
    message: `Top concepts relies: ${topConcepts}`,
    action: "Verifier l'equilibre de distribution des liens.",
  });
}

const summary = {
  block: issues.filter((issue) => issue.severity === "BLOCK").length,
  warn: issues.filter((issue) => issue.severity === "WARN").length,
  info: issues.filter((issue) => issue.severity === "INFO").length,
};

console.log(`BLOCK ${summary.block} | WARN ${summary.warn} | INFO ${summary.info}`);

const severityOrder = ["BLOCK", "WARN", "INFO"];
for (const severity of severityOrder) {
  const bucket = issues.filter((issue) => issue.severity === severity);
  if (bucket.length === 0) {
    continue;
  }
  for (const issue of bucket) {
    console.log(
      `[${issue.severity}][${issue.code}] ${issue.path}:${issue.field} - ${issue.message}. Action: ${issue.action}`
    );
  }
}

if (jsonOutputPath) {
  const payload = {
    summary,
    strictMode,
    generatedAt: new Date().toISOString(),
    issues,
  };
  fs.mkdirSync(path.dirname(jsonOutputPath), { recursive: true });
  fs.writeFileSync(jsonOutputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`JSON report written to ${path.relative(repoRoot, jsonOutputPath)}.`);
}

if (summary.block > 0) {
  process.exit(1);
}
