import type { buildCompareProfileInsight } from "@/lib/typography/compare-profile-insights";

export type CompareView = "overlay" | "split" | "measure";
export type CompareSample = "text" | "word" | "glyph";
export type CompareEmphasis = "left" | "right";

const FULL_GLYPH_SET = "abcdefghijklmnopqrstuvwxyz".split("");

export type AnchorConfig = {
  feature: string;
  title: string;
  directive: string;
  note: string;
  sampleText: string;
  sampleWord: string;
  sampleGlyphs: string[];
  glyphPrompts: string[];
  defaultGlyphIndex: number;
  recommendedView: CompareView;
  defaultSample: CompareSample;
  defaultEmphasis?: CompareEmphasis;
  takeaway: string;
  whyItConfuses: string;
  whatBreaksIt: string;
  whereItMatters: string;
  alignmentTitle: string;
  alignmentNote: string;
  spacingNote: string;
};

const FEATURE_COPY: Record<string, Omit<AnchorConfig, "feature">> = {
  aperture: {
    title: "Aperture",
    directive: "Regarde d'abord l'ouverture du e, du c et du s.",
    note: "Laisse ton oeil comparer l'air qui entre dans les lettres avant de lire la phrase entière.",
    sampleText: "See the steel echo: secret cities keep decent space between counters.",
    sampleWord: "access",
    sampleGlyphs: ["e", "c", "s", "a", "g"],
    glyphPrompts: [
      "Observe l'ouverture du e: Inter laisse entrer davantage d'air avant la barre horizontale.",
      "Sur le c, regarde la bouche: l'espace s'ouvre plus vite dans Inter.",
      "Le s montre si la forme se referme ou respire quand la courbe revient vers l'interieur.",
      "Le a aide a confirmer la meme logique d'ouverture dans une structure plus complexe.",
      "Le g sert de verification finale quand tu veux tester la sensation d'ouverture sur une forme plus dense.",
    ],
    defaultGlyphIndex: 0,
    recommendedView: "overlay",
    defaultSample: "glyph",
    defaultEmphasis: "right",
    takeaway: "What changes: Inter ouvre davantage ses contreformes, ce qui rend la ligne plus aeree des petites tailles.",
    whyItConfuses: "Les deux fontes paraissent neutres et fiables au premier coup d'oeil.",
    whatBreaksIt: "Les ouvertures d'Inter respirent plus vite dans les minuscules que celles de Helvetica Neue.",
    whereItMatters: "C'est surtout visible dans les interfaces, les petites tailles et les lignes denses.",
    alignmentTitle: "Counter opening guide",
    alignmentNote: "Garde la meme ligne de base et compare la vitesse avec laquelle l'oeil entre dans e, c et s.",
    spacingNote: "Le mot test montre aussi si l'air circule plus librement d'une lettre a l'autre.",
  },
  xHeight: {
    title: "x-height",
    directive: "Compare la hauteur du corps minuscule avant de regarder les capitales.",
    note: "La sensation de densité vient souvent de la hauteur perçue des minuscules, pas du poids seul.",
    sampleText: "Minimum letters build a tall texture when the lowercase body climbs higher.",
    sampleWord: "minimum",
    sampleGlyphs: ["x", "n", "o", "m", "u"],
    glyphPrompts: [
      "Le x sert de repere direct pour estimer la hauteur utile des minuscules.",
      "Le n montre comment la hauteur percue compacte la ligne sans changer brutalement le poids.",
      "Le o aide a comparer la hauteur du corps minuscule sur une forme plus ronde.",
      "Le m rend tout de suite visible la densite induite par une x-height plus haute.",
      "Le u confirme si la ligne reste haute ou retombe quand la forme s'ouvre davantage.",
    ],
    defaultGlyphIndex: 0,
    recommendedView: "split",
    defaultSample: "word",
    defaultEmphasis: "right",
    takeaway: "What changes: une x-height plus haute compacte la texture et fait monter la ligne avant meme que le poids change.",
    whyItConfuses: "Les deux dessins peuvent sembler proches tant qu'on regarde surtout les capitales.",
    whatBreaksIt: "La hauteur des minuscules d'Inter remplit plus vite la ligne et change la densite generale.",
    whereItMatters: "On le voit surtout dans les mots repetitifs, les listes et les systemes d'interface.",
    alignmentTitle: "x-height guide",
    alignmentNote: "Aligne la base du x et regarde jusqu'ou monte le corps minuscule dans chaque fonte.",
    spacingNote: "Le mot minimum fait ressortir comment la hauteur et la largeur construisent une texture differente.",
  },
  terminals: {
    title: "Terminals",
    directive: "Observe la manière dont les fins de traits ferment ou laissent respirer la forme.",
    note: "Les terminaisons changent le ton d'une fonte même quand la structure générale semble proche.",
    sampleText: "Humanist endings soften the line while neutral cuts keep the rhythm restrained.",
    sampleWord: "terminals",
    sampleGlyphs: ["a", "r", "t", "f", "j"],
    glyphPrompts: [
      "Le a fait sentir la difference entre une fin plus humaniste et une coupe plus neutre.",
      "Le r laisse voir comment la terminaison donne du ton a toute la ligne.",
      "Le t permet de comparer la maniere dont le trait se ferme sur un dessin tres simple.",
      "Le f accentue la personnalite des terminaisons quand la forme devient plus tendue.",
      "Le j confirme la meme logique sur une lettre plus mobile et plus asymetrique.",
    ],
    defaultGlyphIndex: 0,
    recommendedView: "overlay",
    defaultSample: "glyph",
    defaultEmphasis: "left",
    takeaway: "What changes: des terminaisons plus humanistes assouplissent le ton, la ou des coupes neutres gardent la ligne plus retenue.",
    whyItConfuses: "A distance, la structure globale semble proche et les terminaisons passent au second plan.",
    whatBreaksIt: "Les fins de traits plus humanistes de Frutiger changent le ton avant meme la silhouette globale.",
    whereItMatters: "Cela compte surtout quand on compare des sans serif tres proches en signaletique ou en lecture fonctionnelle.",
    alignmentTitle: "Terminal guide",
    alignmentNote: "Aligne les lettres et regarde surtout comment les fins de traits coupent ou relachent la forme.",
    spacingNote: "Le mot test aide a voir si ces terminaisons serrent ou relachent le rythme general.",
  },
  contrast: {
    title: "Contrast",
    directive: "Regarde l'écart entre pleins et déliés avant toute autre chose.",
    note: "Le contraste change la tension visuelle d'un mot avant même que sa silhouette soit identifiée.",
    sampleText: "Strong contrast creates a sharper pulse; calmer strokes keep the colour more even.",
    sampleWord: "contrast",
    sampleGlyphs: ["n", "o", "s", "v", "w"],
    glyphPrompts: [
      "Le n aide a voir si les pleins et delies s'opposent fortement ou restent reguliers.",
      "Le o montre le contraste sans l'aide d'angles ou de terminaisons plus demonstratives.",
      "Le s fait ressortir la tension du trait quand la courbe change de direction.",
      "Le v expose la difference de tension sur une forme plus pointue.",
      "Le w verifie si cette pulsation reste stable quand la lettre se repete.",
    ],
    defaultGlyphIndex: 0,
    recommendedView: "overlay",
    defaultSample: "word",
    defaultEmphasis: "right",
    takeaway: "What changes: plus le contraste monte, plus la pulsation du mot devient nerveuse et moins la couleur parait uniforme.",
    whyItConfuses: "La silhouette du mot reste lisible meme quand le contraste change fortement.",
    whatBreaksIt: "La tension des pleins et delies modifie la pulsation interne du mot avant son contour global.",
    whereItMatters: "On le sent tres vite sur les grands corps, les titres et les rythmes editoriaux.",
    alignmentTitle: "Stroke guide",
    alignmentNote: "Garde les formes superposees et regarde comment la tension du trait monte ou se calme.",
    spacingNote: "Le mot test permet de sentir si la pulsation reste reguliere ou devient plus nerveuse.",
  },
};

export const getAnchorConfig = (feature: string): AnchorConfig => ({
  feature,
  ...(FEATURE_COPY[feature] ?? {
    title: feature,
    directive: "Regarde d'abord ce détail structurel dans le stage.",
    note: "Ici, on cherche un indice simple qui modifie la texture générale de la ligne.",
    sampleText: "A precise difference becomes easier to see once the page forces the right comparison.",
    sampleWord: "observe",
    sampleGlyphs: ["a", "e", "s", "r", "g"],
    glyphPrompts: [
      "Observe la premiere lettre comme point d'entree, puis confirme avec les autres.",
      "Chaque lettre isolee sert ici de verification plus que de demonstration autonome.",
      "La forme se comprend mieux quand tu regardes la structure avant le mot entier.",
      "Utilise cette etape pour confirmer un detail deja soupconne dans le stage.",
      "La derniere lettre sert de rappel: on cherche un indice simple, pas une lecture complete.",
    ],
    defaultGlyphIndex: 0,
    recommendedView: "overlay" as const,
    defaultSample: "word" as const,
    defaultEmphasis: "right" as const,
    takeaway: "What changes: une difference simple devient visible des que la page force le bon niveau de comparaison.",
    whyItConfuses: "La paire semble proche tant qu'on reste dans une lecture trop globale.",
    whatBreaksIt: "Un detail structurel bien choisi suffit a casser cette proximite visuelle.",
    whereItMatters: "Le plus utile est de confirmer ce detail a plusieurs echelles, du glyphe a la ligne.",
    alignmentTitle: "Alignment guide",
    alignmentNote: "Aligne la base et compare un seul indice structurel avant de revenir au mot entier.",
    spacingNote: "Le strip de lettres sert ensuite a confirmer si le meme indice modifie vraiment le rythme.",
  }),
});

const getValueStrength = (value: string) => {
  const normalized = value.toLowerCase();
  if (["open", "high", "humanist", "strong"].includes(normalized)) return 2;
  if (["medium", "neutral", "balanced"].includes(normalized)) return 1;
  return 0;
};

export const getSuggestedEmphasis = (left: string, right: string): CompareEmphasis => {
  return getValueStrength(right) >= getValueStrength(left) ? "right" : "left";
};

export const getSampleLabel = (sample: CompareSample, glyph: string) => {
  if (sample === "glyph") return glyph || "letter";
  if (sample === "word") return "word";
  return "text";
};

export const getFeatureMeasureLabel = (feature: string) => {
  switch (feature) {
    case "xHeight":
      return "x-height";
    case "aperture":
      return "opening";
    case "terminals":
      return "ending";
    case "contrast":
      return "stroke";
    default:
      return "focus";
  }
};

export const getGlyphPool = (focusedGlyphs: string[]) => {
  const seen = new Set<string>();
  return [...focusedGlyphs, ...FULL_GLYPH_SET].filter((glyph) => {
    const normalized = glyph.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export const buildQuery = (params: URLSearchParams, patch: Record<string, string>) => {
  const next = new URLSearchParams(params);
  Object.entries(patch).forEach(([key, value]) => next.set(key, value));
  const query = next.toString();
  return query ? `?${query}` : "";
};

export const prioritizeGlyph = (glyphs: string[], preferredGlyph: string) => {
  const normalizedPreferred = preferredGlyph.toLowerCase();
  const ordered = [...glyphs];
  const preferredIndex = ordered.findIndex((glyph) => glyph.toLowerCase() === normalizedPreferred);
  if (preferredIndex <= 0) return ordered;
  const [preferred] = ordered.splice(preferredIndex, 1);
  ordered.unshift(preferred);
  return ordered;
};

export const buildStageCorpusHint = ({
  insight,
  leftName,
  rightName,
}: {
  insight: ReturnType<typeof buildCompareProfileInsight> | null;
  leftName: string;
  rightName: string;
}) => {
  if (!insight || insight.mode === "missing") return null;

  if (insight.mode === "metric") {
    if (insight.strongerSide === "tie") {
      return `Corpus hint: neither side is ahead on ${insight.label}, so read the stage for texture rather than size alone.`;
    }

    const focusName = insight.strongerSide === "left" ? leftName : rightName;
    return `Corpus hint: look at ${focusName} first. The ${insight.label} signal is ${insight.signal} and leans that way.`;
  }

  if (insight.strongerSide === "tie") {
    return `Corpus hint: both sides are equally supported on the witness "${insight.word}", so use the stage to decide what you actually feel.`;
  }

  const focusName = insight.strongerSide === "left" ? leftName : rightName;
  return `Corpus hint: inspect ${focusName} first on "${insight.word}". The witness signal is ${insight.signal} on this feature.`;
};
