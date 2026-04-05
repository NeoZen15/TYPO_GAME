import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
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

type AnchorConfig = {
  feature: string;
  title: string;
  directive: string;
  note: string;
  sampleText: string;
  sampleWord: string;
  sampleGlyph: string;
  recommendedView: CompareView;
};

const FEATURE_COPY: Record<string, Omit<AnchorConfig, "feature">> = {
  aperture: {
    title: "Aperture",
    directive: "Regarde d'abord l'ouverture du e, du c et du s.",
    note: "Laisse ton oeil comparer l'air qui entre dans les lettres avant de lire la phrase entière.",
    sampleText: "See the steel echo: secret cities keep decent space between counters.",
    sampleWord: "access",
    sampleGlyph: "e c s a g",
    recommendedView: "overlay",
  },
  xHeight: {
    title: "x-height",
    directive: "Compare la hauteur du corps minuscule avant de regarder les capitales.",
    note: "La sensation de densité vient souvent de la hauteur perçue des minuscules, pas du poids seul.",
    sampleText: "Minimum letters build a tall texture when the lowercase body climbs higher.",
    sampleWord: "minimum",
    sampleGlyph: "x n o m u",
    recommendedView: "split",
  },
  terminals: {
    title: "Terminals",
    directive: "Observe la manière dont les fins de traits ferment ou laissent respirer la forme.",
    note: "Les terminaisons changent le ton d'une fonte même quand la structure générale semble proche.",
    sampleText: "Humanist endings soften the line while neutral cuts keep the rhythm restrained.",
    sampleWord: "terminals",
    sampleGlyph: "a r t f j",
    recommendedView: "overlay",
  },
  contrast: {
    title: "Contrast",
    directive: "Regarde l'écart entre pleins et déliés avant toute autre chose.",
    note: "Le contraste change la tension visuelle d'un mot avant même que sa silhouette soit identifiée.",
    sampleText: "Strong contrast creates a sharper pulse; calmer strokes keep the colour more even.",
    sampleWord: "contrast",
    sampleGlyph: "n o s v w",
    recommendedView: "overlay",
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
    sampleGlyph: "a e s r g",
    recommendedView: "overlay" as const,
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

const getSuggestedEmphasis = (left: string, right: string): "left" | "right" => {
  return getValueStrength(right) >= getValueStrength(left) ? "right" : "left";
};

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

  const emphasis = resolvedSearchParams.emphasis === "left" || resolvedSearchParams.emphasis === "right"
    ? resolvedSearchParams.emphasis
    : getSuggestedEmphasis(activeAnchor.left, activeAnchor.right);
  const view: CompareView =
    resolvedSearchParams.view === "split" || resolvedSearchParams.view === "overlay"
      ? resolvedSearchParams.view
      : activeAnchor.config.recommendedView;
  const sample: CompareSample =
    resolvedSearchParams.sample === "word" || resolvedSearchParams.sample === "text" || resolvedSearchParams.sample === "glyph"
      ? resolvedSearchParams.sample
      : "word";

  const stageText =
    sample === "glyph"
      ? activeAnchor.config.sampleGlyph
      : sample === "word"
        ? activeAnchor.config.sampleWord
        : activeAnchor.config.sampleText;
  const stageGlyphs = sample === "glyph" ? activeAnchor.config.sampleGlyph.split(/\s+/).filter(Boolean) : [];
  const requestedGlyphIndex =
    typeof resolvedSearchParams.glyph === "string" ? Number.parseInt(resolvedSearchParams.glyph, 10) : Number.NaN;
  const glyphIndex =
    Number.isFinite(requestedGlyphIndex) && requestedGlyphIndex >= 0 && requestedGlyphIndex < stageGlyphs.length
      ? requestedGlyphIndex
      : 0;
  const activeGlyph = stageGlyphs[glyphIndex] ?? "";
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

  return (
    <main className="typo-page">
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
            <div>
              <p className="typo-demo-label">Comparison stage</p>
              <h2 id="compare-stage-title" className="compare-stage-title">
                Learn to see one difference at a time
              </h2>
            </div>
            <div className="compare-stage-controls">
              <Link
                href={buildQuery(currentParams, { focus: activeAnchor.feature, view: "overlay" })}
                className={`compare-control ${view === "overlay" ? "is-active" : ""}`}
              >
                Overlay
              </Link>
              <Link
                href={buildQuery(currentParams, { focus: activeAnchor.feature, view: "split" })}
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
                  <Link href={swapHref} className="compare-stage-focus-toggle">
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
            ) : (
              <div className="compare-stage-split">
                <article className="compare-stage-pane compare-stage-pane--left">
                  <p className="compare-stage-pane-label">{leftTypeface.name}</p>
                  {sample === "glyph" ? (
                    <p className="compare-stage-pane-text">{activeGlyph}</p>
                  ) : (
                    <p className="compare-stage-pane-text">{stageText}</p>
                  )}
                </article>
                <article className="compare-stage-pane compare-stage-pane--right">
                  <p className="compare-stage-pane-label">{rightTypeface.name}</p>
                  {sample === "glyph" ? (
                    <p className="compare-stage-pane-text">{activeGlyph}</p>
                  ) : (
                    <p className="compare-stage-pane-text">{stageText}</p>
                  )}
                </article>
              </div>
            )}
          </div>

          <div className="compare-stage-toolbar">
            <div className="compare-stage-controls">
              <Link
                href={buildQuery(currentParams, { sample: "text", focus: activeAnchor.feature })}
                className={`compare-control ${sample === "text" ? "is-active" : ""}`}
              >
                Text
              </Link>
              <Link
                href={buildQuery(currentParams, { sample: "word", focus: activeAnchor.feature })}
                className={`compare-control ${sample === "word" ? "is-active" : ""}`}
              >
                Word
              </Link>
              <Link
                href={buildQuery(currentParams, { sample: "glyph", focus: activeAnchor.feature, glyph: "0" })}
                className={`compare-control ${sample === "glyph" ? "is-active" : ""}`}
              >
                Letters
              </Link>
            </div>
            {sample === "glyph" && stageGlyphs.length > 0 ? (
              <div className="compare-stage-glyph-picker" aria-label="Letter picker">
                {stageGlyphs.map((glyph, index) => (
                  <Link
                    key={`${glyph}-${index}`}
                    href={buildQuery(currentParams, { sample: "glyph", focus: activeAnchor.feature, glyph: String(index) })}
                    className={`compare-stage-glyph-choice ${index === glyphIndex ? "is-active" : ""}`}
                  >
                    {glyph}
                  </Link>
                ))}
              </div>
            ) : null}
            <p className="compare-stage-toolbar-copy">
              Start with the active cue, then confirm it by switching the mode or swapping the dominant typeface.
            </p>
          </div>
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
                href={buildQuery(currentParams, {
                  focus: anchor.feature,
                  view: anchor.config.recommendedView,
                  emphasis: getSuggestedEmphasis(anchor.left, anchor.right),
                })}
                className={`compare-anchor ${anchor.feature === activeAnchor.feature ? "is-active" : ""}`}
              >
                <p className="typo-demo-label">{anchor.config.title}</p>
                <p className="compare-anchor-directive">{anchor.config.directive}</p>
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
            <div className="typo-actions">
              <Link href={`/type/${leftTypeface.slug}`} className="typo-link-pill">
                Open {leftTypeface.name}
              </Link>
              <Link href={`/type/${rightTypeface.slug}`} className="typo-link-pill">
                Open {rightTypeface.name}
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
