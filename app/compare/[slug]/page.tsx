import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import CompareQuickHelpWidget from "@/components/typography/CompareQuickHelpWidget";
import MeasuredGlyphSplit from "@/components/typography/MeasuredGlyphSplit";
import MeasuredWordSplit from "@/components/typography/MeasuredWordSplit";
import SiteNav from "@/components/ui/SiteNav";
import {
  buildQuery,
  getAnchorConfig,
  getFeatureMeasureLabel,
  getGlyphPool,
  getSampleLabel,
  getSuggestedEmphasis,
  prioritizeGlyph,
  type CompareEmphasis,
  type CompareSample,
  type CompareView,
} from "@/lib/typography/compare-page-helpers";
import {
  buildCompareProfileInsight,
  pickBestCorpusGlyphSample,
  pickBestCorpusSampleMode,
  pickBestCorpusWordSample,
} from "@/lib/typography/compare-profile-insights";
import { buildCompareExplanationData, buildRichCompareQuickQuestions } from "@/lib/typography/compare-explanation";
import { getComparisonBySlug, getComparisonsForTypeface, getConceptsByIds, getTypefaceById } from "@/lib/typography/content";
import { getSpecimenFontFaceCss, getSpecimenPreviewFamily } from "@/lib/typography/specimen-data";
import { getLatestTypefaceCorpusVersion, getTypefaceProfileFromCorpus } from "@/lib/typography/typeface-profile-corpus";

type ComparisonPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
const getDisplayFamily = (slug: string, name: string) => {
  const previewFamily = getSpecimenPreviewFamily(slug);
  return previewFamily
    ? `"${previewFamily}", "${name}", "Helvetica Neue", Arial, sans-serif`
    : `"${name}", "Helvetica Neue", Arial, sans-serif`;
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
  const corpusVersion = getLatestTypefaceCorpusVersion();
  const leftProfile = getTypefaceProfileFromCorpus({ fontId: leftTypeface.slug, version: corpusVersion?.version });
  const rightProfile = getTypefaceProfileFromCorpus({ fontId: rightTypeface.slug, version: corpusVersion?.version });
  const corpusSampleWord =
    corpusVersion && leftProfile && rightProfile
      ? pickBestCorpusWordSample({
          feature: activeAnchor.feature,
          fallbackWord: activeAnchor.config.sampleWord,
          leftProfile,
          rightProfile,
        })
      : activeAnchor.config.sampleWord;
  const corpusSuggestedSample =
    corpusVersion && leftProfile && rightProfile
      ? pickBestCorpusSampleMode({
          feature: activeAnchor.feature,
          fallbackSample: activeAnchor.config.defaultSample,
          sampleWord: corpusSampleWord,
          leftProfile,
          rightProfile,
        })
      : activeAnchor.config.defaultSample;
  const view: CompareView =
    resolvedSearchParams.view === "split" || resolvedSearchParams.view === "overlay" || resolvedSearchParams.view === "measure"
      ? resolvedSearchParams.view
      : activeAnchor.config.recommendedView;
  const sample: CompareSample =
    resolvedSearchParams.sample === "word" || resolvedSearchParams.sample === "text" || resolvedSearchParams.sample === "glyph"
      ? resolvedSearchParams.sample
      : corpusSuggestedSample;

  const stageText =
    sample === "glyph"
      ? activeAnchor.config.sampleGlyphs.join(" ")
      : sample === "word"
        ? corpusSampleWord
        : activeAnchor.config.sampleText;
  const guidedGlyphs = activeAnchor.config.sampleGlyphs;
  const libraryGlyphs = getGlyphPool(activeAnchor.config.sampleGlyphs);
  const stageGlyphs = libraryGlyphs;
  const defaultGuidedGlyph = guidedGlyphs[activeAnchor.config.defaultGlyphIndex] ?? guidedGlyphs[0] ?? "";
  const corpusSampleGlyph =
    corpusVersion && leftProfile && rightProfile
      ? pickBestCorpusGlyphSample({
          feature: activeAnchor.feature,
          fallbackGlyph: defaultGuidedGlyph,
          candidateGlyphs: guidedGlyphs,
          sampleWord: corpusSampleWord,
          leftProfile,
          rightProfile,
        })
      : defaultGuidedGlyph;
  const prioritizedGuidedGlyphs = prioritizeGlyph(guidedGlyphs, corpusSampleGlyph);
  const defaultLibraryGlyphIndex = Math.max(libraryGlyphs.findIndex((glyph) => glyph === corpusSampleGlyph), 0);
  const requestedGlyphIndex =
    typeof resolvedSearchParams.glyph === "string" ? Number.parseInt(resolvedSearchParams.glyph, 10) : Number.NaN;
  const glyphIndex =
    Number.isFinite(requestedGlyphIndex) && requestedGlyphIndex >= 0 && requestedGlyphIndex < stageGlyphs.length
      ? requestedGlyphIndex
      : defaultLibraryGlyphIndex;
  const activeGlyph = stageGlyphs[glyphIndex] ?? "";
  const leftFontCss = getSpecimenFontFaceCss(leftTypeface.slug);
  const rightFontCss = getSpecimenFontFaceCss(rightTypeface.slug);
  const defaultStageGlyph = activeAnchor.config.sampleGlyphs[activeAnchor.config.defaultGlyphIndex] ?? "";
  const stageSampleLabel = getSampleLabel(activeAnchor.config.defaultSample, defaultStageGlyph);
  const featureMetricInsight =
    corpusVersion && leftProfile && rightProfile
      ? buildCompareProfileInsight({
          feature: activeAnchor.feature,
          sampleWord: corpusSampleWord,
          leftProfile,
          rightProfile,
        })
      : null;
  const compactCorpusChip =
    featureMetricInsight && featureMetricInsight.mode !== "missing"
      ? featureMetricInsight.strongerSide === "tie"
        ? `Corpus read · ${featureMetricInsight.signal === "low" ? "subtle" : "balanced"}`
        : `${featureMetricInsight.strongerSide === "left" ? leftTypeface.name : rightTypeface.name} leads`
      : null;
  const stageSampleFocusLabel =
    corpusSuggestedSample === "word"
      ? corpusSampleWord
      : corpusSuggestedSample === "glyph"
        ? corpusSampleGlyph
        : stageSampleLabel;
  const compareExplanation =
    corpusVersion && leftProfile && rightProfile
      ? buildCompareExplanationData({
          version: corpusVersion.version,
          feature: activeAnchor.feature,
          featureLabel: activeAnchor.config.title,
          leftProfile,
          rightProfile,
          fallbackSampleMode: activeAnchor.config.defaultSample,
          selectedSampleMode: corpusSuggestedSample,
          fallbackWord: activeAnchor.config.sampleWord,
          selectedWord: corpusSampleWord,
          fallbackGlyph: defaultGuidedGlyph,
          selectedGlyph: corpusSampleGlyph,
          candidateGlyphs: guidedGlyphs,
        })
      : null;
  const quickQuestions = compareExplanation ? buildRichCompareQuickQuestions({ explanation: compareExplanation }) : [];
  const leftFamily = getDisplayFamily(leftTypeface.slug, leftTypeface.name);
  const rightFamily = getDisplayFamily(rightTypeface.slug, rightTypeface.name);
  const stageStyle = {
    "--compare-left-family": leftFamily,
    "--compare-right-family": rightFamily,
  } as CSSProperties & Record<`--${string}`, string>;

  const stageClasses = `compare-stage compare-stage--feature-${activeAnchor.feature} compare-stage--${view} compare-stage--emphasis-${emphasis} compare-stage--sample-${sample}`;
  const isMeasureMode = view === "measure";
  const swapHref = buildQuery(currentParams, { emphasis: emphasis === "left" ? "right" : "left" });
  const stageObserveLabel = activeAnchor.config.title;
  const featureMeasureLabel = getFeatureMeasureLabel(activeAnchor.feature);
  const gameHref = comparison.ctaGameVariant ? `/play?variant=${comparison.ctaGameVariant}` : "/play";
  const dominantTypeface = emphasis === "left" ? leftTypeface : rightTypeface;

  return (
    <main className="typo-page compare-page">
      {leftFontCss || rightFontCss ? <style>{[leftFontCss, rightFontCss].filter(Boolean).join("\n\n")}</style> : null}
      <article className="typo-shell">
        <SiteNav />

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
          {compactCorpusChip ? (
            <p className="typo-chip typo-chip--positive">
              {compactCorpusChip}
            </p>
          ) : null}
        </div>

        <header className="compare-hero">
          <div className="compare-hero-copy">
            <p className="compare-hero-kicker">Guided comparison</p>
            <h1 className="compare-hero-title">{heroTitle}</h1>
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
                  Start with <span>{corpusSuggestedSample}</span>
                </p>
                <p className="compare-stage-meta-item">
                  Look at <span>{stageSampleFocusLabel}</span>
                </p>
              </div>
            </div>
          </div>

          <div className={stageClasses} style={stageStyle}>
            <div className="compare-stage-view">
              <div className="compare-stage-control-cluster" aria-label="Compare controls">
                <div className="compare-stage-control-row compare-stage-control-row--mode">
                  <Link
                    href={buildQuery(currentParams, { focus: activeAnchor.feature, view: "overlay" })}
                    scroll={false}
                    className={`compare-control ${view === "overlay" ? "is-active" : ""}`}
                  >
                    Overlay
                  </Link>
                  <Link
                    href={buildQuery(currentParams, { focus: activeAnchor.feature, view: "measure" })}
                    scroll={false}
                    className={`compare-control ${view === "measure" ? "is-active" : ""}`}
                  >
                    Measure
                  </Link>
                </div>
              </div>
              <div className="compare-stage-guides" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>

              {view === "overlay" ? (
                <div className="compare-stage-overlay">
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
                  feature={activeAnchor.feature}
                  guideLabel={featureMeasureLabel}
                  left={{ label: leftTypeface.name, family: leftFamily }}
                  right={{ label: rightTypeface.name, family: rightFamily }}
                  showMeasurements={isMeasureMode}
                />
              ) : sample === "word" && (view === "measure" || (view === "split" && activeAnchor.feature === "xHeight")) ? (
                <MeasuredWordSplit
                  word={stageText}
                  left={{ label: leftTypeface.name, family: leftFamily }}
                  right={{ label: rightTypeface.name, family: rightFamily }}
                  feature={activeAnchor.feature}
                  showMeasurements={isMeasureMode}
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

            <div className={`compare-stage-controls-zone compare-stage-controls-zone--${view === "overlay" ? "overlay" : "measure"}`}>
              {view === "overlay" ? (
                <div className="compare-stage-bottom-bar">
                  <div className="compare-stage-focus-rail" aria-label="Typeface focus">
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
                </div>
              ) : null}
              <div className="compare-stage-bottom-bar compare-stage-bottom-bar--measure">
                <div className="compare-stage-sample-switch compare-stage-sample-switch--measure" aria-label="Sample controls">
                  <Link
                    href={buildQuery(currentParams, { sample: "word", focus: activeAnchor.feature })}
                    scroll={false}
                    className={`compare-stage-focus-toggle compare-stage-focus-toggle--secondary ${sample === "word" ? "is-active" : ""}`}
                  >
                    Word
                  </Link>
                  <Link
                    href={buildQuery(currentParams, {
                      sample: "glyph",
                      focus: activeAnchor.feature,
                      glyph: String(defaultLibraryGlyphIndex),
                    })}
                    scroll={false}
                    className={`compare-stage-focus-toggle compare-stage-focus-toggle--secondary ${sample === "glyph" ? "is-active" : ""}`}
                  >
                    Letter
                  </Link>
                </div>
              </div>
              <div className="compare-stage-bottom-drawer">
                {sample === "glyph" && stageGlyphs.length > 0 ? (
                  <div className="compare-stage-glyph-tools" aria-label="Letter picker">
                    <div className="compare-stage-glyph-picker compare-stage-glyph-picker--focused">
                      {prioritizedGuidedGlyphs.map((glyph) => {
                        const index = libraryGlyphs.findIndex((entry) => entry === glyph);
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
                        {libraryGlyphs.map((glyph) => {
                          const index = libraryGlyphs.findIndex((entry) => entry === glyph);
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
              </div>
            </div>
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
      <CompareQuickHelpWidget questions={quickQuestions} />
    </main>
  );
}
