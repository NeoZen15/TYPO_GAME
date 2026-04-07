import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import MeasuredGlyphSplit from "@/components/typography/MeasuredGlyphSplit";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import { getComparisonBySlug, getComparisonsForTypeface, getConceptsByIds, getTypefaceById } from "@/lib/typography/content";
import { getSpecimenFontFaceCss, getSpecimenPreviewFamily } from "@/lib/typography/specimen-data";

type ComparisonPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type CompareView = "overlay" | "split";
type CompareSample = "text" | "word" | "glyph";
type CompareEmphasis = "left" | "right";
const FULL_GLYPH_SET = "abcdefghijklmnopqrstuvwxyz".split("");

type AnchorConfig = {
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

const getAnchorConfig = (feature: string): AnchorConfig => ({
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

const getDisplayFamily = (slug: string, name: string) => {
  const previewFamily = getSpecimenPreviewFamily(slug);
  return previewFamily
    ? `"${previewFamily}", "${name}", "Helvetica Neue", Arial, sans-serif`
    : `"${name}", "Helvetica Neue", Arial, sans-serif`;
};

const getValueStrength = (value: string) => {
  const normalized = value.toLowerCase();
  if (["open", "high", "humanist", "strong"].includes(normalized)) return 2;
  if (["medium", "neutral", "balanced"].includes(normalized)) return 1;
  return 0;
};

const getSuggestedEmphasis = (left: string, right: string): CompareEmphasis => {
  return getValueStrength(right) >= getValueStrength(left) ? "right" : "left";
};

const getSampleLabel = (sample: CompareSample, glyph: string) => {
  if (sample === "glyph") return glyph || "letter";
  if (sample === "word") return "word";
  return "text";
};

const getSampleLead = (sample: CompareSample) => {
  if (sample === "glyph") return "Detail level";
  if (sample === "word") return "Silhouette level";
  return "Reading level";
};

const getFeatureMeasureLabel = (feature: string) => {
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

const getGlyphPool = (focusedGlyphs: string[]) => {
  const seen = new Set<string>();
  const ordered = [...focusedGlyphs, ...FULL_GLYPH_SET].filter((glyph) => {
    const normalized = glyph.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  return ordered;
};

const getGenericGlyphPrompt = (feature: string, glyph: string) => {
  switch (feature) {
    case "aperture":
      return `Observe comment ${glyph} s'ouvre ou se referme quand le trait revient vers l'interieur.`;
    case "xHeight":
      return `Regarde jusqu'ou monte ${glyph} au-dessus de la ligne de base pour estimer la hauteur utile des minuscules.`;
    case "terminals":
      return `Observe comment ${glyph} termine son trait et si la fin de forme reste neutre ou plus humaniste.`;
    case "contrast":
      return `Observe comment ${glyph} distribue ses pleins et delies avant de revenir au mot complet.`;
    default:
      return `Observe ${glyph} comme un indice structurel isole avant de revenir au mot entier.`;
  }
};

const getWordCells = (word: string) => word.split("").filter(Boolean);

const buildQuery = (params: URLSearchParams, patch: Record<string, string>) => {
  const next = new URLSearchParams(params);
  Object.entries(patch).forEach(([key, value]) => next.set(key, value));
  const query = next.toString();
  return query ? `?${query}` : "";
};

export default async function ComparisonPage({ params, searchParams }: ComparisonPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const comparison = await getComparisonBySlug(slug);

  if (!comparison) {
    notFound();
  }

  const [leftTypeface, rightTypeface] = await Promise.all([
    getTypefaceById(comparison.leftId),
    getTypefaceById(comparison.rightId),
  ]);

  if (!leftTypeface || !rightTypeface) {
    notFound();
  }

  const conceptIds =
    Array.isArray(comparison.pinnedConceptIds) && comparison.pinnedConceptIds.length > 0
      ? comparison.pinnedConceptIds
      : comparison.conceptRefs;

  const [concepts, leftRelatedComparisons, rightRelatedComparisons] = await Promise.all([
    getConceptsByIds(conceptIds),
    getComparisonsForTypeface(comparison.leftId),
    getComparisonsForTypeface(comparison.rightId),
  ]);

  const relatedComparisons = [...leftRelatedComparisons, ...rightRelatedComparisons].filter(
    (entry, index, array) => entry.slug !== comparison.slug && array.findIndex((item) => item.slug === entry.slug) === index
  );

  const heroTitle = comparison.heroTitle ?? `${leftTypeface.name} vs ${rightTypeface.name}`;
  const fallbackIntro = comparison.heroIntro ?? "Regarde d'abord la différence la plus structurante.";
  const anchors = comparison.diffHighlights.map((highlight) => ({
    ...highlight,
    config: getAnchorConfig(highlight.feature),
  }));
  const activeAnchor =
    anchors.find((anchor) => anchor.feature === resolvedSearchParams.focus) ??
    anchors[0] ??
    ({
      feature: "contrast",
      left: "calm",
      right: "sharp",
      config: getAnchorConfig("contrast"),
    } as const);

  const currentParams = new URLSearchParams();
  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string") currentParams.set(key, value);
  });

  const defaultEmphasis = activeAnchor.config.defaultEmphasis ?? getSuggestedEmphasis(activeAnchor.left, activeAnchor.right);
  const emphasis: CompareEmphasis =
    resolvedSearchParams.emphasis === "left" || resolvedSearchParams.emphasis === "right"
      ? resolvedSearchParams.emphasis
      : defaultEmphasis;
  const view: CompareView =
    resolvedSearchParams.view === "split" || resolvedSearchParams.view === "overlay"
      ? resolvedSearchParams.view
      : activeAnchor.config.recommendedView;
  const sample: CompareSample =
    resolvedSearchParams.sample === "word" || resolvedSearchParams.sample === "text" || resolvedSearchParams.sample === "glyph"
      ? resolvedSearchParams.sample
      : activeAnchor.config.defaultSample;

  const stageText =
    sample === "glyph"
      ? activeAnchor.config.sampleGlyphs.join(" ")
      : sample === "word"
        ? activeAnchor.config.sampleWord
        : activeAnchor.config.sampleText;
  const stageGlyphs = getGlyphPool(activeAnchor.config.sampleGlyphs);
  const requestedGlyphIndex =
    typeof resolvedSearchParams.glyph === "string" ? Number.parseInt(resolvedSearchParams.glyph, 10) : Number.NaN;
  const glyphIndex =
    Number.isFinite(requestedGlyphIndex) && requestedGlyphIndex >= 0 && requestedGlyphIndex < stageGlyphs.length
      ? requestedGlyphIndex
      : activeAnchor.config.defaultGlyphIndex;
  const activeGlyph = stageGlyphs[glyphIndex] ?? "";
  const focusedGlyphIndex = activeAnchor.config.sampleGlyphs.findIndex((glyph) => glyph === activeGlyph);
  const activeGlyphPrompt =
    focusedGlyphIndex >= 0
      ? activeAnchor.config.glyphPrompts[focusedGlyphIndex] ?? activeAnchor.config.note
      : getGenericGlyphPrompt(activeAnchor.feature, activeGlyph);
  const previousGlyphIndex = glyphIndex > 0 ? glyphIndex - 1 : stageGlyphs.length - 1;
  const nextGlyphIndex = glyphIndex < stageGlyphs.length - 1 ? glyphIndex + 1 : 0;
  const nextGlyph = stageGlyphs[nextGlyphIndex] ?? "";
  const spacingCells = getWordCells(activeAnchor.config.sampleWord);
  const leftFontCss = getSpecimenFontFaceCss(leftTypeface.slug);
  const rightFontCss = getSpecimenFontFaceCss(rightTypeface.slug);
  const leftFamily = getDisplayFamily(leftTypeface.slug, leftTypeface.name);
  const rightFamily = getDisplayFamily(rightTypeface.slug, rightTypeface.name);
  const stageStyle = {
    "--compare-left-family": leftFamily,
    "--compare-right-family": rightFamily,
  } as CSSProperties & Record<`--${string}`, string>;

  const stageClasses = `compare-stage compare-stage--${view} compare-stage--emphasis-${emphasis} compare-stage--sample-${sample}`;
  const swapHref = buildQuery(currentParams, { emphasis: emphasis === "left" ? "right" : "left" });
  const stageObserveLabel = activeAnchor.config.title;
  const defaultStageGlyph = activeAnchor.config.sampleGlyphs[activeAnchor.config.defaultGlyphIndex] ?? "";
  const stageSampleLabel = getSampleLabel(activeAnchor.config.defaultSample, defaultStageGlyph);
  const currentSampleLead = getSampleLead(sample);
  const featureMeasureLabel = getFeatureMeasureLabel(activeAnchor.feature);
  const anchorHrefFor = (anchor: (typeof anchors)[number]) =>
    buildQuery(currentParams, {
      focus: anchor.feature,
      view: anchor.config.recommendedView,
      sample: anchor.config.defaultSample,
      emphasis: anchor.config.defaultEmphasis ?? getSuggestedEmphasis(anchor.left, anchor.right),
      glyph: String(anchor.config.defaultGlyphIndex),
    });
  const gameHref = comparison.ctaGameVariant ? `/play?variant=${comparison.ctaGameVariant}` : "/play";
  const dominantTypeface = emphasis === "left" ? leftTypeface : rightTypeface;

  return (
    <main className="typo-page">
      <ThemeSwitch />
      {leftFontCss || rightFontCss ? <style>{[leftFontCss, rightFontCss].filter(Boolean).join("\n\n")}</style> : null}
      <article className="typo-shell">
        <nav className="typo-breadcrumbs" aria-label="Comparison navigation">
          <Link href="/" className="typo-link">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/play" className="typo-link">
            Play
          </Link>
          <span aria-hidden="true">/</span>
          <span>{heroTitle}</span>
        </nav>

        <div className="typo-top">
          <p className="typo-chip typo-chip--info">Category · {leftTypeface.category}</p>
          <p className="typo-chip typo-chip--positive">Comparaison · {comparison.score}</p>
          <p className="typo-chip typo-chip--warning">Concepts · {concepts.length}</p>
        </div>

        <header className="compare-hero">
          <div className="compare-hero-copy">
            <p className="compare-hero-kicker">Guided comparison</p>
            <h1 className="compare-hero-title">{heroTitle}</h1>
            <p className="compare-hero-directive">{activeAnchor.config.directive}</p>
            <p className="compare-hero-note">{fallbackIntro} {activeAnchor.config.note}</p>
          </div>
          <div className="compare-hero-side">
            <p className="typo-demo-label">Current cue</p>
            <p className="compare-hero-feature">{activeAnchor.config.title}</p>
            <p className="compare-hero-values">
              {leftTypeface.name}: {activeAnchor.left} · {rightTypeface.name}: {activeAnchor.right}
            </p>
          </div>
        </header>

        <section className="compare-stage-shell" aria-labelledby="compare-stage-title">
          <div className="compare-stage-head">
            <div className="compare-stage-head-copy">
              <p className="typo-demo-label">Comparison stage</p>
              <h2 id="compare-stage-title" className="compare-stage-title">
                Learn to see one difference at a time
              </h2>
              <div className="compare-stage-meta" aria-label="Guided stage defaults">
                <p className="compare-stage-meta-item">
                  Observe first <span>{stageObserveLabel}</span>
                </p>
                <p className="compare-stage-meta-item">
                  Default sample <span>{stageSampleLabel}</span>
                </p>
              </div>
            </div>
            <div className="compare-stage-controls">
              <Link
                href={buildQuery(currentParams, { focus: activeAnchor.feature, view: "overlay" })}
                scroll={false}
                className={`compare-control ${view === "overlay" ? "is-active" : ""}`}
              >
                Overlay
              </Link>
              <Link
                href={buildQuery(currentParams, { focus: activeAnchor.feature, view: "split" })}
                scroll={false}
                className={`compare-control ${view === "split" ? "is-active" : ""}`}
              >
                Split
              </Link>
            </div>
          </div>

          <div className={stageClasses} style={stageStyle}>
            <div className="compare-stage-guides" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            {view === "overlay" ? (
              <div className="compare-stage-overlay">
                <div className="compare-stage-focus-switch">
                  <p className={`compare-stage-focus-name ${emphasis === "left" ? "is-active" : ""}`}>
                    {leftTypeface.name}
                  </p>
                  <Link href={swapHref} scroll={false} className="compare-stage-focus-toggle">
                    Flip focus
                  </Link>
                  <p className={`compare-stage-focus-name ${emphasis === "right" ? "is-active" : ""}`}>
                    {rightTypeface.name}
                  </p>
                </div>
                {sample === "glyph" ? (
                  <>
                    <p className="compare-stage-layer compare-stage-layer--left" aria-hidden="true">
                      {activeGlyph}
                    </p>
                    <p className="compare-stage-layer compare-stage-layer--right" aria-hidden="true">
                      {activeGlyph}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="compare-stage-layer compare-stage-layer--left">{stageText}</p>
                    <p className="compare-stage-layer compare-stage-layer--right">{stageText}</p>
                  </>
                )}
              </div>
            ) : sample === "glyph" ? (
              <MeasuredGlyphSplit
                glyph={activeGlyph}
                guideLabel={featureMeasureLabel}
                left={{ label: leftTypeface.name, family: leftFamily }}
                right={{ label: rightTypeface.name, family: rightFamily }}
              />
            ) : (
              <div className="compare-stage-split">
                <article className="compare-stage-pane compare-stage-pane--left">
                  <p className="compare-stage-pane-label">{leftTypeface.name}</p>
                  <p className="compare-stage-pane-text">{stageText}</p>
                </article>
                <article className="compare-stage-pane compare-stage-pane--right">
                  <p className="compare-stage-pane-label">{rightTypeface.name}</p>
                  <p className="compare-stage-pane-text">{stageText}</p>
                </article>
              </div>
            )}
          </div>

          <p className="compare-stage-takeaway">{activeAnchor.config.takeaway}</p>

          <div className="compare-stage-toolbar">
            <div className="compare-stage-controls">
              <Link
                href={buildQuery(currentParams, { sample: "text", focus: activeAnchor.feature })}
                scroll={false}
                className={`compare-control ${sample === "text" ? "is-active" : ""}`}
              >
                Text
              </Link>
              <Link
                href={buildQuery(currentParams, { sample: "word", focus: activeAnchor.feature })}
                scroll={false}
                className={`compare-control ${sample === "word" ? "is-active" : ""}`}
              >
                Word
              </Link>
              <Link
                href={buildQuery(currentParams, { sample: "glyph", focus: activeAnchor.feature, glyph: "0" })}
                scroll={false}
                className={`compare-control ${sample === "glyph" ? "is-active" : ""}`}
              >
                Letters
              </Link>
            </div>
            {sample === "glyph" && stageGlyphs.length > 0 ? (
              <div className="compare-stage-glyph-tools" aria-label="Letter picker">
                <div className="compare-stage-glyph-picker compare-stage-glyph-picker--focused">
                  {activeAnchor.config.sampleGlyphs.map((glyph) => {
                    const index = stageGlyphs.findIndex((entry) => entry === glyph);
                    return (
                      <Link
                        key={`${glyph}-${index}`}
                        href={buildQuery(currentParams, { sample: "glyph", focus: activeAnchor.feature, glyph: String(index) })}
                        scroll={false}
                        className={`compare-stage-glyph-choice ${index === glyphIndex ? "is-active" : ""}`}
                      >
                        {glyph}
                      </Link>
                    );
                  })}
                </div>
                <div className="compare-stage-glyph-library">
                  <p className="compare-stage-glyph-library-label">Alphabet</p>
                  <div className="compare-stage-glyph-library-panel">
                    {FULL_GLYPH_SET.map((glyph) => {
                      const index = stageGlyphs.findIndex((entry) => entry === glyph);
                      return (
                        <Link
                          key={`library-${glyph}-${index}`}
                          href={buildQuery(currentParams, { sample: "glyph", focus: activeAnchor.feature, glyph: String(index) })}
                          scroll={false}
                          className={`compare-stage-glyph-choice compare-stage-glyph-choice--library ${index === glyphIndex ? "is-active" : ""}`}
                        >
                          {glyph}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
            <p className="compare-stage-toolbar-copy">
              Commence par l&apos;etat guide, puis confirme la difference en changeant le mode ou la dominance.
            </p>
          </div>

          <div className="compare-stage-reading-brief" aria-label="Guided reading brief">
            <p className="compare-stage-reading-chip">
              {currentSampleLead} <span>{sample === "glyph" ? activeGlyph : sample}</span>
            </p>
            <p className="compare-stage-reading-item">
              Why they get confused <span>{activeAnchor.config.whyItConfuses}</span>
            </p>
            <p className="compare-stage-reading-item">
              What breaks it <span>{activeAnchor.config.whatBreaksIt}</span>
            </p>
            <p className="compare-stage-reading-item">
              Where it matters <span>{activeAnchor.config.whereItMatters}</span>
            </p>
          </div>

          <section className="compare-proof-strip" aria-labelledby="compare-proof-strip-title">
            <div className="compare-proof-head">
              <div>
                <p className="typo-demo-label">Comparison proof</p>
                <h3 id="compare-proof-strip-title" className="compare-proof-title">
                  {activeAnchor.config.alignmentTitle}
                </h3>
              </div>
              <p className="compare-proof-copy">{activeAnchor.config.alignmentNote}</p>
            </div>
            <div className="compare-proof-grid">
              <article className="compare-proof-card">
                <p className="compare-proof-label">{leftTypeface.name}</p>
                <div className="compare-proof-word compare-proof-word--left">
                  {spacingCells.map((cell, index) => (
                    <span key={`${leftTypeface.slug}-${cell}-${index}`} className="compare-proof-cell">
                      {cell}
                    </span>
                  ))}
                </div>
              </article>
              <article className="compare-proof-card">
                <p className="compare-proof-label">{rightTypeface.name}</p>
                <div className="compare-proof-word compare-proof-word--right">
                  {spacingCells.map((cell, index) => (
                    <span key={`${rightTypeface.slug}-${cell}-${index}`} className="compare-proof-cell">
                      {cell}
                    </span>
                  ))}
                </div>
              </article>
            </div>
            <p className="compare-proof-copy compare-proof-copy--spacing">{activeAnchor.config.spacingNote}</p>
          </section>

          {sample === "glyph" && stageGlyphs.length > 0 ? (
            <section className="compare-detail-focus" aria-labelledby="compare-detail-focus-title">
              <div className="compare-detail-focus-head">
                <div>
                  <p className="typo-demo-label">Focus detail</p>
                  <h3 id="compare-detail-focus-title" className="compare-detail-focus-title">
                    {activeAnchor.config.title} · step {glyphIndex + 1}/{stageGlyphs.length}
                  </h3>
                </div>
                <div className="compare-detail-focus-nav">
                  <Link
                    href={buildQuery(currentParams, { sample: "glyph", focus: activeAnchor.feature, glyph: String(previousGlyphIndex) })}
                    scroll={false}
                    className="compare-detail-focus-link"
                  >
                    Previous
                  </Link>
                  <Link
                    href={buildQuery(currentParams, { sample: "glyph", focus: activeAnchor.feature, glyph: String(nextGlyphIndex) })}
                    scroll={false}
                    className="compare-detail-focus-link"
                  >
                    Next
                  </Link>
                </div>
              </div>
              <div className="compare-detail-focus-body">
                <p className="compare-detail-focus-glyph">{activeGlyph}</p>
                <div className="compare-detail-focus-content">
                  <p className="compare-detail-focus-copy">{activeGlyphPrompt}</p>
                  <div className="compare-detail-focus-rail" aria-label="Focus detail cues">
                    <p className="compare-detail-focus-chip">
                      <span>Look for</span>
                      Observe comment l&apos;ouverture reste stable ou se referme quand la courbe revient vers l&apos;interieur.
                    </p>
                    <p className="compare-detail-focus-chip">
                      <span>Then check</span>
                      Passe ensuite sur <strong>{nextGlyph}</strong> pour confirmer la meme logique sur une autre forme.
                    </p>
                    <p className="compare-detail-focus-chip">
                      <span>Why this step</span>
                      Cette lettre sert de verification intermediaire avant de revenir au mot complet.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </section>

        <section className="compare-anchors" aria-labelledby="compare-anchors-title">
          <div className="typo-section-head">
            <h2 id="compare-anchors-title" className="typo-section-title">
              Visual anchors
            </h2>
          </div>
          <div className="compare-anchor-grid">
            {anchors.map((anchor) => (
              <Link
                key={anchor.feature}
                href={anchorHrefFor(anchor)}
                scroll={false}
                className={`compare-anchor ${anchor.feature === activeAnchor.feature ? "is-active" : ""}`}
              >
                <p className="typo-demo-label">{anchor.config.title}</p>
                <p className="compare-anchor-directive">{anchor.config.directive}</p>
                <p className="compare-anchor-note">{anchor.config.takeaway}</p>
                <p className="compare-anchor-values">
                  {leftTypeface.name}: {anchor.left} · {rightTypeface.name}: {anchor.right}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="compare-bottom-grid">
          <article className="compare-concept-card">
            <p className="typo-demo-label">Pinned concept</p>
            {concepts[0] ? (
              <>
                <h2 className="compare-mini-title">{concepts[0].title}</h2>
                <p className="compare-mini-copy">{concepts[0].definitionShort}</p>
                <Link href={`/learn/${concepts[0].slug}`} className="typo-link">
                  Learn more
                </Link>
              </>
            ) : (
              <p className="compare-mini-copy">No concept pinned yet for this pair.</p>
            )}
          </article>

          <article className="compare-next-card">
            <p className="typo-demo-label">Next action</p>
            <h2 className="compare-mini-title">Turn observation into practice</h2>
            <p className="compare-mini-copy">
              Passe a une autre paire, ouvre le specimen dominant ou entraine exactement cette distinction dans le jeu.
            </p>
            <div className="typo-actions">
              <Link href={`/type/${dominantTypeface.slug}`} className="typo-link-pill">
                Open {dominantTypeface.name} specimen
              </Link>
              <Link href={gameHref} className="typo-link-pill">
                Train this distinction in the game
              </Link>
              {relatedComparisons[0] ? (
                <Link href={`/compare/${relatedComparisons[0].slug}`} className="typo-link-pill">
                  Try another pair
                </Link>
              ) : null}
            </div>
          </article>
        </section>
      </article>
    </main>
  );
}
