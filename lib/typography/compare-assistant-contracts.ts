export type CompareNarrativeMode = "atelier" | "enquete";

export type CompareInterventionKind =
  | "hypothesis"
  | "look"
  | "warning"
  | "test"
  | "evidence"
  | "judgment";

export type CompareInterventionBlock = {
  id: string;
  kind: CompareInterventionKind;
  eyebrow: string;
  title: string;
  body: string;
  items?: string[];
  meta?: string;
};

export type CompareExperienceScript = {
  version: string;
  mode: CompareNarrativeMode;
  title: string;
  lensLabel: string;
  hypothesis: string;
  entryLabel: string;
  entryValue: string;
  confidenceLabel: string;
  confidenceNote: string;
  stagePrompts: string[];
  blocks: CompareInterventionBlock[];
};

