type CompareFeaturePlaybook = {
  feature: string;
  lensLabel: string;
  title: string;
  trapId?: string;
  buildHypothesis: (args: { leftName: string; rightName: string; leftValue: string; rightValue: string }) => string;
  buildLookPrompt: (args: { sampleLabel: string; leftName: string; rightName: string }) => string;
  buildIgnorePrompt: (args: { sampleLabel: string }) => string;
  buildCounterTest: (args: { sampleWord: string; sampleGlyph: string; currentMode: string }) => string;
  buildJudgmentPrompt: (args: { leftName: string; rightName: string }) => string;
};

const genericPlaybook = {
  buildLookPrompt: ({ sampleLabel }: { sampleLabel: string }) =>
    `Entre par ${sampleLabel}, puis garde ton regard sur un seul indice structurel avant de revenir au mot entier.`,
  buildIgnorePrompt: ({ sampleLabel }: { sampleLabel: string }) =>
    `Ne lis pas encore ${sampleLabel} comme du texte. Traite-le d'abord comme une preuve locale.`,
  buildCounterTest: ({
    sampleWord,
    sampleGlyph,
  }: {
    sampleWord: string;
    sampleGlyph: string;
    currentMode: string;
  }) =>
    `Teste d'abord la lettre "${sampleGlyph}", puis verifie si le meme signal tient encore dans "${sampleWord}". Si le signal disparait, ton hypothese etait trop large.`,
  buildJudgmentPrompt: ({ leftName, rightName }: { leftName: string; rightName: string }) =>
    `Formule un verdict local avant tout verdict global: qu'est-ce qui te fait d'abord pencher vers ${leftName} ou ${rightName} ?`,
};

export const compareFeaturePlaybooks: Record<string, CompareFeaturePlaybook> = {
  aperture: {
    feature: "aperture",
    lensLabel: "Ouverture",
    title: "L'ouverture doit gagner avant la silhouette",
    trapId: "aperture_vs_width",
    buildHypothesis: ({ leftName, rightName, leftValue, rightValue }) =>
      `${rightName} parait plus respirant que ${leftName}, non pas parce que la ligne est globalement plus belle, mais parce que son ouverture (${rightValue} contre ${leftValue}) laisse entrer l'oeil plus vite.`,
    buildLookPrompt: ({ sampleLabel, leftName, rightName }) =>
      `Entre par ${sampleLabel}. Compare comment l'oeil entre dans le e, puis dans le c. Si ${rightName} s'ouvre plus tot que ${leftName}, l'hypothese tient deja avant la lecture du mot.`,
    buildIgnorePrompt: ({ sampleLabel }) =>
      `N'essaie pas encore de juger ${sampleLabel} par sa largeur, son poids ou sa nettete. Ici, seule la vitesse d'entree dans la contreforme compte.`,
    buildCounterTest: ({ sampleWord, sampleGlyph, currentMode }) =>
      `Fais un contre-test: passe ${currentMode === "glyph" ? `de "${sampleGlyph}" a "${sampleWord}"` : `du mot "${sampleWord}" a la lettre "${sampleGlyph}"`}. Si tu ne retrouves pas la meme sensation d'ouverture dans les deux cas, tu lis probablement la texture generale plutot que l'ouverture elle-meme.`,
    buildJudgmentPrompt: ({ leftName, rightName }) =>
      `Formule un verdict tres court: "je vois une ouverture plus rapide chez ${rightName}" ou "je ne vois pas encore ce qui distingue ${rightName} de ${leftName}".`,
  },
  xHeight: {
    feature: "xHeight",
    lensLabel: "x-height",
    title: "La hauteur minuscule doit monter avant le ton general",
    trapId: "xheight_vs_weight",
    buildHypothesis: ({ leftName, rightName, leftValue, rightValue }) =>
      `${rightName} devrait remplir la ligne plus vite que ${leftName}, parce que son corps minuscule monte plus haut (${rightValue} contre ${leftValue}).`,
    buildLookPrompt: ({ sampleLabel, leftName, rightName }) =>
      `Entre par ${sampleLabel}. Compare la hauteur utile des minuscules avant toute autre lecture. Si ${rightName} remplit plus vite la ligne que ${leftName}, l'hypothese tient.`,
    buildIgnorePrompt: ({ sampleLabel }) =>
      `N'evalue pas ${sampleLabel} par le poids d'abord. Ici, la densite peut venir de la hauteur minuscule avant meme le dessin du trait.`,
    buildCounterTest: ({ sampleWord, sampleGlyph }) =>
      `Verifie ensuite sur "${sampleGlyph}" puis sur "${sampleWord}". Si la sensation de densite disparait quand tu isoles la hauteur, tu confondais probablement densite et poids.`,
    buildJudgmentPrompt: ({ leftName, rightName }) =>
      `Formule un verdict local: qui monte le plus vite entre la baseline et la x-height, ${leftName} ou ${rightName} ?`,
  },
  contrast: {
    feature: "contrast",
    lensLabel: "Contraste",
    title: "La pulsation du trait doit apparaitre avant la forme du mot",
    trapId: "contrast_vs_crispness",
    buildHypothesis: ({ leftName, rightName, leftValue, rightValue }) =>
      `${rightName} devrait produire une pulsation plus nette que ${leftName}, car son contraste (${rightValue} contre ${leftValue}) anime davantage l'interieur du mot.`,
    buildLookPrompt: ({ sampleLabel, leftName, rightName }) =>
      `Entre par ${sampleLabel}. Regarde la tension interne du trait avant la silhouette. Si ${rightName} pulse plus que ${leftName}, ne nomme pas encore la forme du mot.`,
    buildIgnorePrompt: ({ sampleLabel }) =>
      `N'interprete pas ${sampleLabel} comme une question de nettete ou de couleur generale. On cherche d'abord la variation interne du trait.`,
    buildCounterTest: ({ sampleWord, sampleGlyph }) =>
      `Passe ensuite de "${sampleGlyph}" a "${sampleWord}". Si la tension du trait s'efface au profit d'une simple impression de noirceur, ton diagnostic etait trop global.`,
    buildJudgmentPrompt: ({ rightName }) =>
      `Nomine la source de ta decision: vois-tu surtout une tension plus vive chez ${rightName}, ou n'es-tu pas encore capable de la separer de la silhouette ?`,
  },
  terminals: {
    feature: "terminals",
    lensLabel: "Terminaisons",
    title: "La coupe des fins de traits doit parler avant le ton general",
    trapId: "terminals_vs_personality",
    buildHypothesis: ({ leftName, rightName, leftValue, rightValue }) =>
      `${leftName} et ${rightName} peuvent sembler proches, mais leurs terminaisons (${leftValue} contre ${rightValue}) changent deja le ton avant la silhouette globale.`,
    buildLookPrompt: ({ sampleLabel }) =>
      `Entre par ${sampleLabel}. Observe la fin des traits avant le mot entier: est-ce que la forme se coupe, se relache ou reste neutre ?`,
    buildIgnorePrompt: ({ sampleLabel }) =>
      `Ne juge pas encore ${sampleLabel} par son humanisme global. Ici, on veut voir comment les fins de traits fabriquent ce ton.`,
    buildCounterTest: ({ sampleWord, sampleGlyph }) =>
      `Teste d'abord "${sampleGlyph}", puis "${sampleWord}". Si tu ne retrouves pas la meme sensation en changeant d'echelle, tu projetais une personnalite generale sur la paire.`,
    buildJudgmentPrompt: ({ leftName, rightName }) =>
      `Verbalise le point exact: quelle fin de trait t'aide vraiment a distinguer ${leftName} de ${rightName} ?`,
  },
};

export const getCompareFeaturePlaybook = (feature: string): CompareFeaturePlaybook => {
  const playbook = compareFeaturePlaybooks[feature];
  if (playbook) return playbook;

  return {
    feature,
    lensLabel: feature,
    title: "Un indice structurel doit casser l'impression generale",
    buildHypothesis: ({ leftName, rightName }) =>
      `La paire ${leftName} / ${rightName} doit d'abord se separer sur un indice structurel local, pas sur une impression generale.`,
    buildLookPrompt: genericPlaybook.buildLookPrompt,
    buildIgnorePrompt: genericPlaybook.buildIgnorePrompt,
    buildCounterTest: genericPlaybook.buildCounterTest,
    buildJudgmentPrompt: genericPlaybook.buildJudgmentPrompt,
  };
};
