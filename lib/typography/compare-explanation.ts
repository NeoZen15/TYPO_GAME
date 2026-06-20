import type {
  ConfidenceLevel,
  TypefaceMeasurementProfile,
  WordMeasurementProfile,
} from "@/lib/typography/measurement-profile-contracts";
import { buildCompareProfileInsight, type CompareProfileInsight, type CompareQuickQuestion } from "@/lib/typography/compare-profile-insights";

type ExplanationWinner = "left" | "right" | "tie" | "ambiguous";
type ExplanationSignal = "low" | "medium" | "high";
type ExplanationSampleMode = "text" | "word" | "glyph";

export type ExplanationMetricEvidence = {
  id: string;
  label: string;
  leftValue: number;
  rightValue: number;
  delta: number;
  unit: "px" | "ratio" | "score";
  source: string;
  usedInVerdict: boolean;
};

export type ExplanationWitnessEvidence = {
  leftSupport: ConfidenceLevel;
  rightSupport: ConfidenceLevel;
  sharedRoles: string[];
  leftChosenGlyphs: string[];
  rightChosenGlyphs: string[];
  selectedWordWitnesses: string[];
};

export type ExplanationWordCandidate = {
  word: string;
  score: number;
  leftSupport: ConfidenceLevel;
  rightSupport: ConfidenceLevel;
  sharedWitnesses: string[];
  reasons: string[];
};

export type ExplanationGlyphCandidate = {
  glyph: string;
  score: number;
  appearsInSelectedWord: boolean;
  isSharedWitness: boolean;
  reasons: string[];
};

export type CompareExplanationData = {
  version: string;
  feature: string;
  featureLabel: string;
  pair: {
    leftFontId: string;
    leftFamilyName: string;
    rightFontId: string;
    rightFamilyName: string;
  };
  verdict: {
    winner: ExplanationWinner;
    signal: ExplanationSignal;
    summary: string;
    shortLabel: string;
  };
  samples: {
    mode: {
      selected: ExplanationSampleMode;
      fallback: ExplanationSampleMode;
      candidates: Array<{
        id: ExplanationSampleMode;
        score: number;
        reasons: string[];
      }>;
    };
    word?: {
      selected: string;
      fallback: string;
      candidates: ExplanationWordCandidate[];
    };
    glyph?: {
      selected: string;
      fallback: string;
      candidates: ExplanationGlyphCandidate[];
    };
  };
  evidence: {
    metrics: ExplanationMetricEvidence[];
    witnesses?: ExplanationWitnessEvidence;
  };
  decisions: {
    verdictReasons: string[];
    sampleReasons: string[];
    rejectionReasons: Array<{
      scope: "mode" | "word" | "glyph" | "verdict";
      candidateId: string;
      reasons: string[];
    }>;
  };
  reliability: {
    confidence: ConfidenceLevel;
    provenance: {
      left: string;
      right: string;
    };
    ambiguityFlags: string[];
    missingData: string[];
    caveats: string[];
  };
  insight: CompareProfileInsight;
};

const supportOrder: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };

const supportScoreLabel = (support: ConfidenceLevel) => `${support} (${supportOrder[support] + 1}/3)`;

const joinOrNone = (items: string[]) => (items.length ? items.join(", ") : "none");

const featureWordKey = (feature: string, word: string) => `${feature}:${word}`;

const featureSupportKey = (feature: string): keyof WordMeasurementProfile["featureSupport"] | null => {
  switch (feature) {
    case "aperture":
      return "aperture";
    case "terminals":
      return "terminals";
    case "contrast":
      return "contrast";
    case "xHeight":
      return "xHeight";
    default:
      return null;
  }
};

const getWordCandidates = ({
  feature,
  leftProfile,
  rightProfile,
  fallbackWord,
}: {
  feature: string;
  leftProfile: TypefaceMeasurementProfile;
  rightProfile: TypefaceMeasurementProfile;
  fallbackWord: string;
}): ExplanationWordCandidate[] => {
  const supportKey = featureSupportKey(feature);
  if (!supportKey) return [];

  return Object.keys(leftProfile.wordProfiles)
    .filter((key) => key.startsWith(`${feature}:`) && rightProfile.wordProfiles[key])
    .map((key) => {
      const leftWordProfile = leftProfile.wordProfiles[key];
      const rightWordProfile = rightProfile.wordProfiles[key];
      const leftSupport = leftWordProfile.featureSupport[supportKey];
      const rightSupport = rightWordProfile.featureSupport[supportKey];
      const sharedWitnesses = Object.keys(leftWordProfile.witnesses).filter(
        (role) => rightWordProfile.witnesses[role as keyof typeof rightWordProfile.witnesses]
      );
      const score = Math.min(supportOrder[leftSupport], supportOrder[rightSupport]) * 10 + sharedWitnesses.length;

      return {
        word: leftWordProfile.word,
        score,
        leftSupport,
        rightSupport,
        sharedWitnesses,
        reasons: [
          `supports ${leftSupport}/${rightSupport}`,
          sharedWitnesses.length ? `shared witnesses: ${sharedWitnesses.join(", ")}` : "no shared witnesses",
          leftWordProfile.word === fallbackWord ? "matches editorial fallback" : "beats the editorial fallback",
        ],
      };
    })
    .sort((left, right) => right.score - left.score || left.word.localeCompare(right.word));
};

const getGlyphCandidates = ({
  candidateGlyphs,
  selectedWord,
  leftProfile,
  rightProfile,
}: {
  candidateGlyphs: string[];
  selectedWord: string;
  leftProfile: TypefaceMeasurementProfile;
  rightProfile: TypefaceMeasurementProfile;
}): ExplanationGlyphCandidate[] => {
  const leftWitnessGlyphs = Object.values(leftProfile.witnesses)
    .flatMap((set) => set?.chosenGlyphs ?? [])
    .map((glyph) => glyph.toLowerCase());
  const rightWitnessGlyphs = Object.values(rightProfile.witnesses)
    .flatMap((set) => set?.chosenGlyphs ?? [])
    .map((glyph) => glyph.toLowerCase());
  const wordGlyphs = new Set(selectedWord.toLowerCase().split(""));

  return candidateGlyphs
    .map((glyph) => {
      const normalized = glyph.toLowerCase();
      const appearsInSelectedWord = wordGlyphs.has(normalized);
      const isSharedWitness = leftWitnessGlyphs.includes(normalized) && rightWitnessGlyphs.includes(normalized);
      const score = (appearsInSelectedWord ? 2 : 0) + (isSharedWitness ? 3 : 0);
      return {
        glyph,
        score,
        appearsInSelectedWord,
        isSharedWitness,
        reasons: [
          appearsInSelectedWord ? `appears in "${selectedWord}"` : "not in selected word",
          isSharedWitness ? "shared witness glyph" : "not a shared witness glyph",
        ],
      };
    })
    .sort((left, right) => right.score - left.score || left.glyph.localeCompare(right.glyph));
};

export const buildCompareExplanationData = ({
  version,
  feature,
  featureLabel,
  leftProfile,
  rightProfile,
  fallbackSampleMode,
  selectedSampleMode,
  fallbackWord,
  selectedWord,
  fallbackGlyph,
  selectedGlyph,
  candidateGlyphs,
}: {
  version: string;
  feature: string;
  featureLabel: string;
  leftProfile: TypefaceMeasurementProfile;
  rightProfile: TypefaceMeasurementProfile;
  fallbackSampleMode: ExplanationSampleMode;
  selectedSampleMode: ExplanationSampleMode;
  fallbackWord: string;
  selectedWord: string;
  fallbackGlyph: string;
  selectedGlyph: string;
  candidateGlyphs: string[];
}): CompareExplanationData => {
  const insight = buildCompareProfileInsight({
    feature,
    sampleWord: selectedWord,
    leftProfile,
    rightProfile,
  });

  const winner =
    insight.mode === "missing"
      ? "ambiguous"
      : insight.strongerSide;

  const shortLabel =
    insight.mode === "missing"
      ? "Need more evidence"
      : insight.strongerSide === "tie"
        ? "Tie"
        : insight.strongerSide === "left"
          ? `${leftProfile.familyName} leads`
          : `${rightProfile.familyName} leads`;

  const metricEvidence: ExplanationMetricEvidence[] =
    insight.mode === "metric"
      ? [
          {
            id: feature,
            label: insight.label,
            leftValue: insight.leftValue,
            rightValue: insight.rightValue,
            delta: insight.delta,
            unit: "px",
            source: leftProfile.metrics.xHeight?.source ?? "derived",
            usedInVerdict: true,
          },
        ]
      : [];

  const selectedWordProfile = leftProfile.wordProfiles[featureWordKey(feature, selectedWord)];
  const rightSelectedWordProfile = rightProfile.wordProfiles[featureWordKey(feature, selectedWord)];
  const witnessEvidence =
    selectedWordProfile && rightSelectedWordProfile && insight.mode === "witness"
      ? {
          leftSupport: insight.leftSupport,
          rightSupport: insight.rightSupport,
          sharedRoles: insight.witnessRoles,
          leftChosenGlyphs: Object.values(selectedWordProfile.witnesses).flatMap((set) => set?.chosenGlyphs ?? []),
          rightChosenGlyphs: Object.values(rightSelectedWordProfile.witnesses).flatMap((set) => set?.chosenGlyphs ?? []),
          selectedWordWitnesses: insight.witnessRoles,
        }
      : undefined;

  const wordCandidates = getWordCandidates({
    feature,
    leftProfile,
    rightProfile,
    fallbackWord,
  });
  const glyphCandidates = getGlyphCandidates({
    candidateGlyphs,
    selectedWord,
    leftProfile,
    rightProfile,
  });

  const modeCandidates = [
    {
      id: "word" as const,
      score: selectedSampleMode === "word" ? 20 : fallbackSampleMode === "word" ? 12 : 8,
      reasons: [selectedSampleMode === "word" ? "selected by corpus" : "available as fallback"],
    },
    {
      id: "glyph" as const,
      score: selectedSampleMode === "glyph" ? 20 : fallbackSampleMode === "glyph" ? 12 : 8,
      reasons: [selectedSampleMode === "glyph" ? "selected by corpus" : "available as fallback"],
    },
    {
      id: "text" as const,
      score: selectedSampleMode === "text" ? 20 : fallbackSampleMode === "text" ? 12 : 2,
      reasons: [selectedSampleMode === "text" ? "selected by corpus" : "least specific mode"],
    },
  ];

  const ambiguityFlags = [...new Set([...leftProfile.ambiguityFlags, ...rightProfile.ambiguityFlags])];
  const missingData: string[] = [];
  if (insight.mode === "missing") missingData.push("No stable corpus insight for this feature on both typefaces.");
  if (insight.mode === "witness" && !witnessEvidence) missingData.push("Witness evidence is incomplete for the selected word.");

  return {
    version,
    feature,
    featureLabel,
    pair: {
      leftFontId: leftProfile.fontId,
      leftFamilyName: leftProfile.familyName,
      rightFontId: rightProfile.fontId,
      rightFamilyName: rightProfile.familyName,
    },
    verdict: {
      winner,
      signal: insight.mode === "missing" ? "low" : insight.signal,
      summary: insight.note,
      shortLabel,
    },
    samples: {
      mode: {
        selected: selectedSampleMode,
        fallback: fallbackSampleMode,
        candidates: modeCandidates,
      },
      word: {
        selected: selectedWord,
        fallback: fallbackWord,
        candidates: wordCandidates,
      },
      glyph: {
        selected: selectedGlyph,
        fallback: fallbackGlyph,
        candidates: glyphCandidates,
      },
    },
    evidence: {
      metrics: metricEvidence,
      witnesses: witnessEvidence,
    },
    decisions: {
      verdictReasons: insight.mode === "missing" ? [insight.note] : [insight.summary, insight.note],
      sampleReasons: [
        `selected mode: ${selectedSampleMode}`,
        `selected word: ${selectedWord}`,
        `selected glyph: ${selectedGlyph}`,
      ],
      rejectionReasons: [
        ...wordCandidates
          .filter((candidate) => candidate.word !== selectedWord)
          .slice(0, 2)
          .map((candidate) => ({
            scope: "word" as const,
            candidateId: candidate.word,
            reasons: candidate.reasons,
          })),
        ...glyphCandidates
          .filter((candidate) => candidate.glyph !== selectedGlyph)
          .slice(0, 2)
          .map((candidate) => ({
            scope: "glyph" as const,
            candidateId: candidate.glyph,
            reasons: candidate.reasons,
          })),
      ],
    },
    reliability: {
      confidence: leftProfile.confidence === rightProfile.confidence ? leftProfile.confidence : "medium",
      provenance: {
        left: leftProfile.provenance.kind,
        right: rightProfile.provenance.kind,
      },
      ambiguityFlags,
      missingData,
      caveats: [
        leftProfile.provenance.kind !== rightProfile.provenance.kind
          ? "The two profiles do not come from the same provenance level."
          : "Both profiles come from the same provenance level.",
        insight.mode === "witness" ? "This feature is currently explained by witness support, not by a single scalar metric." : "This feature currently has a scalar metric in the corpus.",
      ],
    },
    insight,
  };
};

export const buildRichCompareQuickQuestions = ({
  explanation,
}: {
  explanation: CompareExplanationData;
}): CompareQuickQuestion[] => {
  const metricLine = explanation.evidence.metrics[0];
  const selectedWordCandidate = explanation.samples.word?.candidates.find(
    (candidate) => candidate.word === explanation.samples.word?.selected
  );
  const selectedGlyphCandidate = explanation.samples.glyph?.candidates.find(
    (candidate) => candidate.glyph === explanation.samples.glyph?.selected
  );
  const witnessLine = explanation.evidence.witnesses;
  const lookFirst =
    explanation.verdict.winner === "left"
      ? explanation.pair.leftFamilyName
      : explanation.verdict.winner === "right"
        ? explanation.pair.rightFamilyName
        : "les deux cotes";
  const selectedWord = explanation.samples.word?.selected;
  const selectedGlyph = explanation.samples.glyph?.selected;
  const sampleReference =
    explanation.samples.mode.selected === "glyph"
      ? `la lettre "${selectedGlyph ?? ""}"`
      : explanation.samples.mode.selected === "word"
        ? `le mot "${selectedWord ?? ""}"`
        : "le specimen courant";
  const confidenceLabel =
    explanation.reliability.confidence === "high"
      ? "fiable"
      : explanation.reliability.confidence === "medium"
        ? "utile mais a verifier"
        : "fragile";
  const leadSideLine =
    explanation.verdict.winner === "tie"
      ? "Aucune des deux fontes ne domine clairement ici."
      : `Commence par ${lookFirst}. C'est la que le signal ressort le plus vite.`;

  return [
    {
      category: "Voir",
      question: "Qu'est-ce que je regarde d'abord ?",
      preview: selectedGlyph ? `"${selectedGlyph}"` : selectedWord ? `"${selectedWord}"` : explanation.samples.mode.selected,
      answer:
        metricLine
          ? [
              leadSideLine,
              `Entre par ${sampleReference}.`,
              `Ne lis pas encore le mot entier: regarde seulement ${metricLine.label.toLowerCase()} avant la texture generale.`,
            ].join("\n")
          : [
              leadSideLine,
              `Entre par ${sampleReference}.`,
              `Reste sur un indice local avant de conclure sur l'ensemble.`,
            ].join("\n"),
    },
    {
      category: "Lecture",
      question: "Pourquoi ce sample ?",
      preview: `${explanation.samples.mode.selected} · ${selectedWord ?? selectedGlyph ?? "sample"}`,
      answer: [
        explanation.samples.mode.selected === "glyph"
          ? `Cette lettre concentre la difference sans trop de bruit autour.`
          : explanation.samples.mode.selected === "word"
            ? `Ce mot laisse la difference vivre dans une vraie texture de lecture.`
            : `Ce specimen laisse la difference respirer sans trop de distraction.`,
        selectedWordCandidate
          ? `Le mot "${selectedWordCandidate.word}" tient bien la comparaison sur les deux fontes.`
          : null,
        selectedGlyphCandidate?.isSharedWitness
          ? `La lettre "${selectedGlyphCandidate.glyph}" est aussi un bon temoin des deux cotes.`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      category: "Preuve",
      question: "Qu'est-ce qui fait pencher ?",
      preview: metricLine ? metricLine.label : explanation.verdict.signal,
      answer: metricLine
        ? [
            `${explanation.verdict.summary}`,
            `${metricLine.label}: ${explanation.pair.leftFamilyName} ${metricLine.leftValue.toFixed(1)} vs ${explanation.pair.rightFamilyName} ${metricLine.rightValue.toFixed(1)}.`,
            `L'ecart reste ${explanation.verdict.signal === "high" ? "net" : explanation.verdict.signal === "medium" ? "lisible" : "subtil"}.`,
          ].join("\n")
        : [
            `${explanation.verdict.summary}`,
            `${explanation.pair.leftFamilyName}: ${supportScoreLabel(witnessLine?.leftSupport ?? "low")} · ${explanation.pair.rightFamilyName}: ${supportScoreLabel(witnessLine?.rightSupport ?? "low")}.`,
            `Lis-le sur ${sampleReference}, pas sur une impression generale.`,
          ].join("\n"),
    },
    {
      category: "Doute",
      question: "A quel point je peux lui faire confiance ?",
      preview: confidenceLabel,
      answer: [
        `Le signal est ${confidenceLabel}.`,
        explanation.reliability.ambiguityFlags.length
          ? `Il reste des zones d'ambiguite: ${joinOrNone(explanation.reliability.ambiguityFlags.slice(0, 3))}.`
          : `Il n'y a pas d'alerte majeure sur cette lecture.`,
        explanation.reliability.missingData.length
          ? `Ce qui manque encore: ${explanation.reliability.missingData.join(" ")}`
          : `Le corpus suffit pour orienter le regard, mais il ne remplace pas l'oeil.`,
      ].join("\n"),
    },
    {
      category: "Action",
      question: "Quel test je fais maintenant ?",
      preview: "contre-test",
      answer: [
        selectedGlyph ? `Passe de la lettre "${selectedGlyph}" au mot "${selectedWord ?? ""}".` : null,
        `Inverse ensuite ton attention entre ${explanation.pair.leftFamilyName} et ${explanation.pair.rightFamilyName}.`,
        `Si le meme signal ne tient plus, ton premier verdict etait trop rapide.`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
};
