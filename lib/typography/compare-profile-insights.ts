import type { ConfidenceLevel, MetricKey, TypefaceMeasurementProfile, WordMeasurementProfile } from "@/lib/typography/measurement-profile-contracts";

type MetricInsight = {
  mode: "metric";
  label: string;
  leftValue: number;
  rightValue: number;
  delta: number;
  strongerSide: "left" | "right" | "tie";
  signal: "low" | "medium" | "high";
  verdict: string;
  summary: string;
  note: string;
};

type WitnessInsight = {
  mode: "witness";
  label: string;
  support: ConfidenceLevel;
  leftSupport: ConfidenceLevel;
  rightSupport: ConfidenceLevel;
  strongerSide: "left" | "right" | "tie";
  signal: "low" | "medium" | "high";
  verdict: string;
  word: string;
  witnessRoles: string[];
  summary: string;
  note: string;
};

type MissingInsight = {
  mode: "missing";
  label: string;
  note: string;
};

export type CompareProfileInsight = MetricInsight | WitnessInsight | MissingInsight;
export type CompareQuickQuestion = {
  category?: string;
  question: string;
  preview?: string;
  answer: string;
};

const FEATURE_METRIC_KEY: Partial<Record<string, MetricKey>> = {
  xHeight: "xHeight",
};

const HUMAN_LABEL: Partial<Record<MetricKey | string, string>> = {
  xHeight: "x-height",
  aperture: "aperture",
  terminals: "terminals",
  contrast: "contrast",
};

const FEATURE_SUPPORT_KEY: Partial<Record<string, keyof WordMeasurementProfile["featureSupport"]>> = {
  aperture: "aperture",
  terminals: "terminals",
  contrast: "contrast",
  xHeight: "xHeight",
};

const FEATURE_WITNESS_ROLE = {
  xHeight: "xHeight",
} as const;

const featureWordKey = (feature: string, word: string) => `${feature}:${word}`;

export const formatMetricPx = (value: number) => `${value.toFixed(1)}px`;

const formatWitnessRole = (role: string) => HUMAN_LABEL[role] ?? role;
const supportOrder: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };

const resolveMetricSignal = (delta: number): "low" | "medium" | "high" => {
  const distance = Math.abs(delta);
  if (distance >= 2) return "high";
  if (distance >= 0.75) return "medium";
  return "low";
};

const resolveWitnessSignal = (gap: number): "low" | "medium" | "high" => {
  if (gap >= 2) return "high";
  if (gap >= 1) return "medium";
  return "low";
};

export const pickBestCorpusWordSample = ({
  feature,
  fallbackWord,
  leftProfile,
  rightProfile,
}: {
  feature: string;
  fallbackWord: string;
  leftProfile: TypefaceMeasurementProfile;
  rightProfile: TypefaceMeasurementProfile;
}) => {
  const supportKey = FEATURE_SUPPORT_KEY[feature];
  if (!supportKey) return fallbackWord;

  const fallbackKey = featureWordKey(feature, fallbackWord);
  const candidates = Object.keys(leftProfile.wordProfiles)
    .filter((key) => key.startsWith(`${feature}:`) && rightProfile.wordProfiles[key])
    .map((key) => {
      const leftWordProfile = leftProfile.wordProfiles[key];
      const rightWordProfile = rightProfile.wordProfiles[key];
      const word = leftWordProfile.word;
      const leftSupport = leftWordProfile.featureSupport[supportKey];
      const rightSupport = rightWordProfile.featureSupport[supportKey];
      const minSupport = Math.min(supportOrder[leftSupport], supportOrder[rightSupport]);
      const totalSupport = supportOrder[leftSupport] + supportOrder[rightSupport];
      const isFallback = key === fallbackKey;
      return {
        key,
        word,
        minSupport,
        totalSupport,
        isFallback,
      };
    })
    .sort((left, right) => {
      if (right.minSupport !== left.minSupport) return right.minSupport - left.minSupport;
      if (right.totalSupport !== left.totalSupport) return right.totalSupport - left.totalSupport;
      if (left.isFallback !== right.isFallback) return left.isFallback ? -1 : 1;
      return left.word.localeCompare(right.word);
    });

  return candidates[0]?.word ?? fallbackWord;
};

export const pickBestCorpusGlyphSample = ({
  feature,
  fallbackGlyph,
  candidateGlyphs,
  sampleWord,
  leftProfile,
  rightProfile,
}: {
  feature: string;
  fallbackGlyph: string;
  candidateGlyphs: string[];
  sampleWord: string;
  leftProfile: TypefaceMeasurementProfile;
  rightProfile: TypefaceMeasurementProfile;
}) => {
  const normalizedCandidates = candidateGlyphs.map((glyph) => glyph.toLowerCase());
  const fallbackLower = fallbackGlyph.toLowerCase();
  const witnessRole = FEATURE_WITNESS_ROLE[feature as keyof typeof FEATURE_WITNESS_ROLE];

  if (witnessRole) {
    const leftChosen = leftProfile.witnesses[witnessRole]?.chosenGlyphs ?? [];
    const rightChosen = rightProfile.witnesses[witnessRole]?.chosenGlyphs ?? [];
    const sharedWitnessGlyph = normalizedCandidates.find((glyph) => leftChosen.includes(glyph) && rightChosen.includes(glyph));
    if (sharedWitnessGlyph) {
      return candidateGlyphs[normalizedCandidates.indexOf(sharedWitnessGlyph)] ?? fallbackGlyph;
    }
  }

  const seen = new Set<string>();
  const orderedWordGlyphs = sampleWord
    .toLowerCase()
    .split("")
    .filter((glyph) => {
      if (seen.has(glyph)) return false;
      seen.add(glyph);
      return true;
    });

  const sharedWordGlyph = orderedWordGlyphs.find((glyph) => normalizedCandidates.includes(glyph));
  if (sharedWordGlyph) {
    return candidateGlyphs[normalizedCandidates.indexOf(sharedWordGlyph)] ?? fallbackGlyph;
  }

  const fallbackIndex = normalizedCandidates.indexOf(fallbackLower);
  return fallbackIndex >= 0 ? candidateGlyphs[fallbackIndex] : fallbackGlyph;
};

export const pickBestCorpusSampleMode = ({
  feature,
  fallbackSample,
  sampleWord,
  leftProfile,
  rightProfile,
}: {
  feature: string;
  fallbackSample: "text" | "word" | "glyph";
  sampleWord: string;
  leftProfile: TypefaceMeasurementProfile;
  rightProfile: TypefaceMeasurementProfile;
}) => {
  if (fallbackSample === "text") return fallbackSample;

  const insight = buildCompareProfileInsight({
    feature,
    sampleWord,
    leftProfile,
    rightProfile,
  });

  if (insight.mode === "missing") {
    return fallbackSample;
  }

  if (insight.mode === "metric") {
    return feature === "xHeight" && insight.signal !== "low" ? "word" : fallbackSample;
  }

  return insight.signal !== "low" ? "word" : fallbackSample;
};

export const buildCorpusPedagogyLine = ({
  insight,
  sampleWord,
  sampleGlyph,
  sampleMode,
  leftName,
  rightName,
}: {
  insight: CompareProfileInsight | null;
  sampleWord: string;
  sampleGlyph: string;
  sampleMode: "text" | "word" | "glyph";
  leftName: string;
  rightName: string;
}) => {
  if (!insight || insight.mode === "missing") return null;

  const focusName =
    insight.strongerSide === "left"
      ? leftName
      : insight.strongerSide === "right"
        ? rightName
        : null;

  const sampleReference =
    sampleMode === "word"
      ? `the word "${sampleWord}"`
      : sampleMode === "glyph"
        ? `the letter "${sampleGlyph}"`
        : "the current sample";

  if (!focusName) {
    return `Corpus cue: start from ${sampleReference}. The current signal is ${insight.signal}, so compare rhythm and texture before deciding what feels stronger.`;
  }

  return `Corpus cue: start with ${focusName} on ${sampleReference}. The current corpus signal is ${insight.signal}, so that is the clearest place to look first.`;
};

export const buildCompareQuickQuestions = ({
  insight,
  featureLabel,
  sampleMode,
  sampleWord,
  sampleGlyph,
  leftName,
  rightName,
}: {
  insight: CompareProfileInsight | null;
  featureLabel: string;
  sampleMode: "text" | "word" | "glyph";
  sampleWord: string;
  sampleGlyph: string;
  leftName: string;
  rightName: string;
}): CompareQuickQuestion[] => {
  const sampleReference =
    sampleMode === "word"
      ? `le mot "${sampleWord}"`
      : sampleMode === "glyph"
        ? `la lettre "${sampleGlyph}"`
        : "cet exemple";

  const firstLookAnswer =
    !insight || insight.mode === "missing"
      ? `Commence par ${featureLabel.toLowerCase()} dans ${sampleReference}, puis regarde si une des deux fontes se détache naturellement.`
      : insight.strongerSide === "tie"
        ? `Commence par ${featureLabel.toLowerCase()} dans ${sampleReference}. Ici c'est subtil, donc regarde surtout le rythme général.`
        : `Regarde d'abord ${insight.strongerSide === "left" ? leftName : rightName} sur ${sampleReference}. C'est là que la différence ressort le plus vite.`;

  const sampleAnswer =
    sampleMode === "word"
      ? `On te montre ${sampleReference} parce qu'il expose cette différence dans un contexte plus vivant qu'une lettre isolée.`
      : sampleMode === "glyph"
        ? `On te montre ${sampleReference} parce qu'elle concentre bien la différence sans bruit autour.`
        : `Cet exemple a été gardé parce qu'il laisse la différence respirer sans trop de distraction.`;

  const whyAnswer =
    !insight || insight.mode === "missing"
      ? "Le corpus n'a pas encore une lecture assez solide ici, donc le stage reste le meilleur arbitre."
      : insight.strongerSide === "tie"
        ? "Parce que les deux côtés sont très proches ici. Il faut surtout regarder ce qui te semble plus clair ou plus tendu."
        : `Parce que le corpus voit un signal ${insight.signal} qui pousse plutôt vers ${insight.strongerSide === "left" ? leftName : rightName}.`;

  return [
    {
      question: "Qu'est-ce que je regarde d'abord ?",
      answer: firstLookAnswer,
    },
    {
      question: "Pourquoi ce sample ?",
      answer: sampleAnswer,
    },
    {
      question: insight?.mode !== "missing" && insight?.strongerSide !== "tie" ? "Pourquoi cette fonte ressort ?" : "Pourquoi c'est subtil ?",
      answer: whyAnswer,
    },
  ];
};

export const buildCompareProfileInsight = ({
  feature,
  sampleWord,
  leftProfile,
  rightProfile,
}: {
  feature: string;
  sampleWord: string;
  leftProfile: TypefaceMeasurementProfile;
  rightProfile: TypefaceMeasurementProfile;
}): CompareProfileInsight => {
  const metricKey = FEATURE_METRIC_KEY[feature];
  if (metricKey) {
    const leftMetric = leftProfile.metrics[metricKey];
    const rightMetric = rightProfile.metrics[metricKey];

    if (!leftMetric || !rightMetric) {
      return {
        mode: "missing",
        label: "Metric unavailable",
        note: "The latest corpus does not yet expose a stable numeric value for this focus on both typefaces.",
      };
    }

    const delta = Number((rightMetric.value - leftMetric.value).toFixed(1));
    return {
      mode: "metric",
      label: HUMAN_LABEL[metricKey] ?? metricKey,
      leftValue: leftMetric.value,
      rightValue: rightMetric.value,
      delta,
      strongerSide: delta === 0 ? "tie" : delta > 0 ? "right" : "left",
      signal: resolveMetricSignal(delta),
      verdict:
        delta === 0
          ? "Corpus verdict: tie"
          : delta > 0
            ? `Corpus verdict: ${rightProfile.familyName} ahead`
            : `Corpus verdict: ${leftProfile.familyName} ahead`,
      summary:
        delta === 0
          ? "Both typefaces land on the same corpus value for this metric."
          : delta > 0
            ? `${rightProfile.familyName} measures higher on this corpus metric.`
            : `${leftProfile.familyName} measures higher on this corpus metric.`,
      note: "This value comes from the font-structure side of the corpus, not from visible ink bounds alone.",
    };
  }

  const supportKey = FEATURE_SUPPORT_KEY[feature];
  const leftWordProfile = leftProfile.wordProfiles[featureWordKey(feature, sampleWord)];
  const rightWordProfile = rightProfile.wordProfiles[featureWordKey(feature, sampleWord)];

  if (!supportKey || !leftWordProfile || !rightWordProfile) {
    return {
      mode: "missing",
      label: "Witness profile unavailable",
      note: "The latest corpus does not yet expose a canonical word profile for this focus on both typefaces.",
    };
  }

  const leftSupport = leftWordProfile.featureSupport[supportKey];
  const rightSupport = rightWordProfile.featureSupport[supportKey];
  const supportGap = Math.abs(supportOrder[leftSupport] - supportOrder[rightSupport]);
  const strongerSide =
    supportOrder[leftSupport] === supportOrder[rightSupport]
      ? "tie"
      : supportOrder[leftSupport] > supportOrder[rightSupport]
        ? "left"
        : "right";
  const winner = strongerSide === "tie" ? leftSupport : strongerSide === "left" ? leftSupport : rightSupport;
  const witnessRoles = Object.keys(leftWordProfile.witnesses).filter((role) => rightWordProfile.witnesses[role as keyof typeof rightWordProfile.witnesses]);

  return {
    mode: "witness",
    label: `${HUMAN_LABEL[feature] ?? feature} witness`,
    support: winner,
    leftSupport,
    rightSupport,
    strongerSide,
    signal: resolveWitnessSignal(supportGap),
    verdict:
      strongerSide === "tie"
        ? "Corpus verdict: tie"
        : strongerSide === "left"
          ? `Corpus verdict: ${leftProfile.familyName} ahead`
          : `Corpus verdict: ${rightProfile.familyName} ahead`,
    word: sampleWord,
    witnessRoles: witnessRoles.map(formatWitnessRole),
    summary:
      strongerSide === "tie"
        ? "Both typefaces are supported equally by the current corpus witness."
        : strongerSide === "left"
          ? `${leftProfile.familyName} has stronger corpus support on this witness reading.`
          : `${rightProfile.familyName} has stronger corpus support on this witness reading.`,
    note: `This focus is currently read from the canonical word witness "${sampleWord}" and its local feature support, rather than a single scalar metric.`,
  };
};
