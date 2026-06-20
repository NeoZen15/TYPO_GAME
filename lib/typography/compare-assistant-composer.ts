import type { CompareExplanationData } from "@/lib/typography/compare-explanation";
import { getCompareFeaturePlaybook } from "@/lib/typography/compare-assistant-playbooks";
import type { CompareExperienceScript, CompareInterventionBlock } from "@/lib/typography/compare-assistant-contracts";
import { getCompareTrap } from "@/lib/typography/compare-trap-library";

const getConfidenceLabel = (confidence: CompareExplanationData["reliability"]["confidence"]) => {
  switch (confidence) {
    case "high":
      return "Corpus stable";
    case "medium":
      return "Corpus usable";
    default:
      return "Corpus fragile";
  }
};

const getSampleReference = ({
  sampleMode,
  sampleWord,
  sampleGlyph,
}: {
  sampleMode: "text" | "word" | "glyph";
  sampleWord: string;
  sampleGlyph: string;
}) => {
  if (sampleMode === "glyph") return `la lettre "${sampleGlyph}"`;
  if (sampleMode === "word") return `le mot "${sampleWord}"`;
  return "le specimen courant";
};

export const composeCompareExperience = ({
  feature,
  leftName,
  rightName,
  leftValue,
  rightValue,
  sampleMode,
  sampleWord,
  sampleGlyph,
  explanation,
}: {
  feature: string;
  leftName: string;
  rightName: string;
  leftValue: string;
  rightValue: string;
  sampleMode: "text" | "word" | "glyph";
  sampleWord: string;
  sampleGlyph: string;
  explanation: CompareExplanationData | null;
}): CompareExperienceScript => {
  const playbook = getCompareFeaturePlaybook(feature);
  const trap = getCompareTrap({ feature, leftName, rightName });
  const sampleReference = getSampleReference({ sampleMode, sampleWord, sampleGlyph });
  const signal = explanation?.verdict.signal ?? "low";
  const confidence = explanation?.reliability.confidence ?? "low";
  const confidenceLabel = getConfidenceLabel(confidence);
  const confidenceFragments = [
    `signal ${signal}`,
    explanation?.reliability.caveats[0],
    explanation?.reliability.missingData[0],
  ].filter(Boolean);

  const evidenceItems =
    explanation?.evidence.metrics.length
      ? explanation.evidence.metrics.map((metric) => {
          const deltaLabel = `${metric.delta > 0 ? "+" : ""}${metric.delta.toFixed(1)} ${metric.unit}`;
          return `${metric.label}: ${leftName} ${metric.leftValue.toFixed(1)} vs ${rightName} ${metric.rightValue.toFixed(1)} · ${deltaLabel}`;
        })
      : explanation?.evidence.witnesses
        ? [
            `${leftName}: support ${explanation.evidence.witnesses.leftSupport}`,
            `${rightName}: support ${explanation.evidence.witnesses.rightSupport}`,
            `temoins partages: ${explanation.evidence.witnesses.sharedRoles.join(", ") || "aucun"}`,
          ]
        : [`Aucune preuve corpus stable n'est encore exposee pour ${playbook.lensLabel.toLowerCase()}.`];

  const blocks: CompareInterventionBlock[] = [
    {
      id: "hypothesis",
      kind: "hypothesis",
      eyebrow: "Hypothese",
      title: playbook.title,
      body: playbook.buildHypothesis({ leftName, rightName, leftValue, rightValue }),
      meta: `Paire observee: ${leftName} vs ${rightName}`,
    },
    {
      id: "look",
      kind: "look",
      eyebrow: "Entree",
      title: `Commence par ${sampleReference}`,
      body: playbook.buildLookPrompt({ sampleLabel: sampleReference, leftName, rightName }),
      items: [
        playbook.buildIgnorePrompt({ sampleLabel: sampleReference }),
        `Ne cherche qu'un seul indice: ${playbook.lensLabel.toLowerCase()}.`,
      ],
    },
    {
      id: "warning",
      kind: "warning",
      eyebrow: "Faux ami",
      title: trap.label,
      body: trap.statement,
      items: [trap.diagnosticQuestion],
      meta: "Le systeme doit te ralentir avant toute conclusion confortable.",
    },
    {
      id: "test",
      kind: "test",
      eyebrow: "Contre-test",
      title: "Essaie de casser l'hypothese",
      body: playbook.buildCounterTest({ sampleWord, sampleGlyph, currentMode: sampleMode }),
      items: [
        `Inverse ton attention entre ${leftName} et ${rightName}.`,
        `Change d'echelle sans changer de feature.`,
      ],
    },
    {
      id: "evidence",
      kind: "evidence",
      eyebrow: "Preuves",
      title: "Ce que le corpus apporte",
      body:
        explanation?.verdict.summary ??
        `Le corpus ne tranche pas encore proprement cette paire; l'oeil reste l'arbitre principal sur ${sampleReference}.`,
      items: evidenceItems,
      meta: confidenceFragments.join(" · "),
    },
    {
      id: "judgment",
      kind: "judgment",
      eyebrow: "Verdict provisoire",
      title: "Formule ton jugement",
      body: playbook.buildJudgmentPrompt({ leftName, rightName }),
      items: [
        `Je vois deja une difference nette.`,
        `Je vois un signal mais je peux encore me tromper.`,
        `Je ne vois pas encore assez pour trancher.`,
      ],
    },
  ];

  return {
    version: "compare-assistant-v1",
    mode: "atelier",
    title: "Observation protocol",
    lensLabel: playbook.lensLabel,
    hypothesis: playbook.buildHypothesis({ leftName, rightName, leftValue, rightValue }),
    entryLabel: sampleMode === "glyph" ? "Entree ideale" : "Temoin principal",
    entryValue: sampleMode === "glyph" ? sampleGlyph : sampleWord,
    confidenceLabel,
    confidenceNote: confidenceFragments.join(" · "),
    stagePrompts: [
      `Observe ${playbook.lensLabel.toLowerCase()} avant la texture generale.`,
      `Suspends ton verdict tant que le contre-test n'a pas tenu.`,
      `Accepte l'ambiguite si la preuve reste faible.`,
    ],
    blocks,
  };
};
