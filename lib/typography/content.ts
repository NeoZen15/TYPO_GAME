import fs from "node:fs/promises";
import path from "node:path";

export type Typeface = {
  id: string;
  slug: string;
  status: "draft" | "published";
  name: string;
  category: string;
  subCategory: string;
  features: Record<string, string>;
  specimen: {
    defaultText: string;
    glyphSets?: string[];
  };
  conceptRefs?: string[];
  seo?: {
    title?: string;
    description?: string;
  };
};

export type Concept = {
  id: string;
  slug: string;
  status: "draft" | "published";
  title: string;
  definitionShort: string;
  featureKeys: string[];
  exampleTypefaceIds?: string[];
  body: string;
  seo?: {
    title?: string;
    description?: string;
  };
};

export type Comparison = {
  pairId: string;
  slug: string;
  leftId: string;
  rightId: string;
  status: "draft" | "published";
  diffHighlights: Array<{
    feature: string;
    left: string;
    right: string;
  }>;
  conceptRefs: string[];
  score: number;
  seo?: {
    title?: string;
    description?: string;
  };
};

export type TypeOverride = {
  target: "type";
  targetId: string;
  specimen?: {
    defaultText?: string;
  };
  seo?: {
    title?: string;
    description?: string;
  };
};

export type CompareOverride = {
  target: "compare";
  targetId: string;
  heroTitle?: string;
  heroIntro?: string;
  pinnedConceptIds?: string[];
  ctaGameVariant?: string;
  seo?: {
    title?: string;
    description?: string;
  };
};

type RootedPath = {
  root: string;
  typefacesDir: string;
  conceptsDir: string;
  typeOverridesDir: string;
  compareOverridesDir: string;
  comparisonsFile: string;
};

const rootedPath: RootedPath = {
  root: path.join(process.cwd(), "content", "typography"),
  typefacesDir: path.join(process.cwd(), "content", "typography", "typefaces"),
  conceptsDir: path.join(process.cwd(), "content", "typography", "concepts"),
  typeOverridesDir: path.join(process.cwd(), "content", "typography", "overrides", "type"),
  compareOverridesDir: path.join(process.cwd(), "content", "typography", "overrides", "compare"),
  comparisonsFile: path.join(process.cwd(), "content", "typography", "generated", "comparisons.json"),
};

const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
};

const listJsonFiles = async (dirPath: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(dirPath, entry.name))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
};

const readAllJsonObjects = async <T>(dirPath: string): Promise<T[]> => {
  const files = await listJsonFiles(dirPath);
  const payloads = await Promise.all(files.map((filePath) => readJsonFile<T>(filePath)));
  return payloads;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function mergeOverride<TBase extends Record<string, unknown>, TOverride extends Record<string, unknown>>(
  base: TBase,
  override: TOverride | null | undefined
): TBase & TOverride {
  if (!override) {
    return base as TBase & TOverride;
  }

  const merged: Record<string, unknown> = {
    ...base,
    ...override,
  };

  const baseSeo = isObject(base.seo) ? base.seo : {};
  const overrideSeo = isObject(override.seo) ? override.seo : {};
  if (Object.keys(baseSeo).length > 0 || Object.keys(overrideSeo).length > 0) {
    merged.seo = {
      ...baseSeo,
      ...overrideSeo,
    };
  }

  const baseSpecimen = isObject(base.specimen) ? base.specimen : {};
  const overrideSpecimen = isObject(override.specimen) ? override.specimen : {};
  if (Object.keys(baseSpecimen).length > 0 || Object.keys(overrideSpecimen).length > 0) {
    merged.specimen = {
      ...baseSpecimen,
      ...overrideSpecimen,
    };
  }

  return merged as TBase & TOverride;
}

const getPublishedTypefaces = async (): Promise<Typeface[]> => {
  const entries = await readAllJsonObjects<Typeface>(rootedPath.typefacesDir);
  return entries.filter((entry) => entry.status === "published");
};

const getPublishedConcepts = async (): Promise<Concept[]> => {
  const entries = await readAllJsonObjects<Concept>(rootedPath.conceptsDir);
  return entries.filter((entry) => entry.status === "published");
};

const getPublishedComparisons = async (): Promise<Comparison[]> => {
  try {
    const entries = await readJsonFile<Comparison[]>(rootedPath.comparisonsFile);
    return entries.filter((entry) => entry.status === "published");
  } catch {
    return [];
  }
};

const getTypeOverrides = async (): Promise<TypeOverride[]> => {
  const entries = await readAllJsonObjects<TypeOverride>(rootedPath.typeOverridesDir);
  return entries.filter((entry) => entry.target === "type");
};

const getCompareOverrides = async (): Promise<CompareOverride[]> => {
  const entries = await readAllJsonObjects<CompareOverride>(rootedPath.compareOverridesDir);
  return entries.filter((entry) => entry.target === "compare");
};

export const getTypefaceById = async (id: string): Promise<Typeface | null> => {
  const typefaces = await getPublishedTypefaces();
  const candidate = typefaces.find((entry) => entry.id === id);
  return candidate ?? null;
};

export const getTypefacesByIds = async (ids: string[]): Promise<Typeface[]> => {
  const typefaces = await getPublishedTypefaces();
  const typefaceById = new Map(typefaces.map((typeface) => [typeface.id, typeface]));
  const orderedTypefaces: Typeface[] = [];

  for (const id of ids) {
    const typeface = typefaceById.get(id);
    if (typeface) {
      orderedTypefaces.push(typeface);
    }
  }

  return orderedTypefaces;
};

export const getTypefaceBySlug = async (slug: string): Promise<Typeface | null> => {
  const [typefaces, typeOverrides] = await Promise.all([getPublishedTypefaces(), getTypeOverrides()]);
  const candidate = typefaces.find((entry) => entry.slug === slug);
  if (!candidate) {
    return null;
  }
  const override = typeOverrides.find((entry) => entry.targetId === candidate.id);
  return mergeOverride(candidate, override ?? null);
};

export const getComparisonBySlug = async (
  slug: string
): Promise<(Comparison & Partial<CompareOverride>) | null> => {
  const [comparisons, compareOverrides] = await Promise.all([getPublishedComparisons(), getCompareOverrides()]);
  const candidate = comparisons.find((entry) => entry.slug === slug);
  if (!candidate) {
    return null;
  }
  const override = compareOverrides.find((entry) => entry.targetId === candidate.pairId);
  return mergeOverride(candidate, override ?? null);
};

export const getConceptsByIds = async (ids: string[]): Promise<Concept[]> => {
  const concepts = await getPublishedConcepts();
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
  const orderedConcepts: Concept[] = [];

  for (const id of ids) {
    const concept = conceptById.get(id);
    if (concept) {
      orderedConcepts.push(concept);
    }
  }

  return orderedConcepts;
};

export const getComparisonsForTypeface = async (typefaceId: string): Promise<Comparison[]> => {
  const comparisons = await getPublishedComparisons();
  return comparisons.filter((comparison) => comparison.leftId === typefaceId || comparison.rightId === typefaceId);
};

export const getTypefaceNameById = async (id: string): Promise<string | null> => {
  const typeface = await getTypefaceById(id);
  return typeface?.name ?? null;
};

export const getTypographyRoot = (): string => rootedPath.root;
