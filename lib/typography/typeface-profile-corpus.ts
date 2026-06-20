import fs from "node:fs";
import path from "node:path";
import type { TypefaceMeasurementProfile } from "@/lib/typography/measurement-profile-contracts";

type CorpusIndexEntry = {
  version: string;
  generatedAt: string;
  runtime: string;
  profileCount: number;
  fontIds: string[];
  manifest: string;
};

type CorpusIndex = {
  updatedAt: string;
  versions: CorpusIndexEntry[];
};

type CorpusManifest = {
  generatedAt: string;
  runtime: string;
  version: string;
  profileCount: number;
  fontIds: string[];
  files: Array<{
    fontId: string;
    familyName: string;
    file: string;
  }>;
};

const CORPUS_ROOT = path.join(process.cwd(), "data/typography-profiles/corpus");

const readJsonFile = <T,>(filePath: string): T | null => {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const getLatestTypefaceCorpusIndex = (): CorpusIndex | null => {
  return readJsonFile<CorpusIndex>(path.join(CORPUS_ROOT, "index.json"));
};

export const getLatestTypefaceCorpusVersion = () => {
  const index = getLatestTypefaceCorpusIndex();
  const versions = index?.versions ?? [];
  return (
    [...versions].sort(
      (left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime()
    )[0] ?? null
  );
};

export const getTypefaceCorpusManifest = (version?: string) => {
  const resolvedVersion = version ?? getLatestTypefaceCorpusVersion()?.version;
  if (!resolvedVersion) return null;
  return readJsonFile<CorpusManifest>(path.join(CORPUS_ROOT, resolvedVersion, "manifest.json"));
};

export const getTypefaceProfileFromCorpus = ({
  fontId,
  version,
}: {
  fontId: string;
  version?: string;
}): TypefaceMeasurementProfile | null => {
  const manifest = getTypefaceCorpusManifest(version);
  if (!manifest) return null;
  const fileEntry = manifest.files.find((entry) => entry.fontId === fontId);
  if (!fileEntry) return null;
  return readJsonFile<TypefaceMeasurementProfile>(path.join(CORPUS_ROOT, manifest.version, fileEntry.file));
};
