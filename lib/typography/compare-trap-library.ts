export type CompareTrap = {
  id: string;
  label: string;
  statement: string;
  diagnosticQuestion: string;
};

type CompareTrapFactoryArgs = {
  leftName: string;
  rightName: string;
};

type CompareTrapFactory = (args: CompareTrapFactoryArgs) => CompareTrap;

const trapFactories: Record<string, CompareTrapFactory> = {
  aperture_vs_width: ({ leftName, rightName }) => ({
    id: "aperture_vs_width",
    label: "Ouverture vs largeur",
    statement: `${rightName} peut sembler simplement plus large que ${leftName}, alors que le vrai signal est parfois l'air qui entre plus vite dans la lettre.`,
    diagnosticQuestion: `Si tu caches presque toute la lettre sauf son entree, vois-tu encore la meme difference entre ${leftName} et ${rightName} ?`,
  }),
  xheight_vs_weight: ({ leftName, rightName }) => ({
    id: "xheight_vs_weight",
    label: "x-height vs poids",
    statement: `${rightName} peut sembler plus lourd que ${leftName}, alors que la vraie difference peut venir d'abord de la hauteur du corps minuscule.`,
    diagnosticQuestion: `Si tu ignores l'epaisseur du trait, qui monte le plus vite entre ${leftName} et ${rightName} ?`,
  }),
  contrast_vs_crispness: ({ leftName, rightName }) => ({
    id: "contrast_vs_crispness",
    label: "Contraste vs nettete",
    statement: `${rightName} peut sembler plus net que ${leftName}, alors que le vrai ecart vient de la tension entre pleins et delies.`,
    diagnosticQuestion: `Si tu regardes seulement la pulsation du trait, vois-tu encore la meme difference entre ${leftName} et ${rightName} ?`,
  }),
  terminals_vs_personality: ({ leftName, rightName }) => ({
    id: "terminals_vs_personality",
    label: "Terminaisons vs personnalite",
    statement: `Tu peux projeter une personnalite generale sur ${leftName} ou ${rightName} sans localiser quelle terminaison produit vraiment cet effet.`,
    diagnosticQuestion: `Peux-tu nommer la terminaison exacte qui fait pencher ton jugement entre ${leftName} et ${rightName} ?`,
  }),
  generic_global_impression: ({ leftName, rightName }) => ({
    id: "generic_global_impression",
    label: "Impression globale",
    statement: `Le faux pas classique consiste a trancher entre ${leftName} et ${rightName} sur une impression generale avant d'avoir isole un indice local.`,
    diagnosticQuestion: `Quel indice precis t'autorise vraiment a separer ${leftName} de ${rightName} ?`,
  }),
};

const featureTrapMapping: Record<string, string> = {
  aperture: "aperture_vs_width",
  xHeight: "xheight_vs_weight",
  contrast: "contrast_vs_crispness",
  terminals: "terminals_vs_personality",
};

export const getCompareTrap = ({
  feature,
  leftName,
  rightName,
}: {
  feature: string;
  leftName: string;
  rightName: string;
}): CompareTrap => {
  const trapId = featureTrapMapping[feature] ?? "generic_global_impression";
  const factory = trapFactories[trapId] ?? trapFactories.generic_global_impression;
  return factory({ leftName, rightName });
};

