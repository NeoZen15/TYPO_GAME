import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import TypefaceTester from "@/components/typography/TypefaceTester";
import SiteNav from "@/components/ui/SiteNav";
import {
  getComparisonsForTypeface,
  getConceptsByIds,
  getTypefaceBySlug,
  getTypefacesByIds,
} from "@/lib/typography/content";
import {
  getManifestTypefaceBySlug,
  getSpecimenFontFaceCss,
  getSpecimenGlyphGroups,
  getSpecimenPreviewFamily,
  getSpecimenRecordBySlug,
} from "@/lib/typography/specimen-data";

type TypefacePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const formatFeatureLabel = (feature: string): string =>
  feature
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());

const featureDescriptions: Record<string, string> = {
  contrast: "Difference between thick and thin strokes.",
  xHeight: "Height of the lowercase body for text reading.",
  aperture: "How open or closed counters and terminals feel.",
  terminals: "How stroke endings shape the tone of the face.",
  stressAxis: "Direction of the internal visual axis.",
};

type SpecimenStyleVars = CSSProperties & Record<`--${string}`, string | number>;

const getSpecimenScaleStyle = (word: string, fontFamily: string): SpecimenStyleVars => {
  const normalizedLength = [...word.replace(/\s+/g, "")].length || 1;
  const heroScale = Math.max(0.54, Math.min(1, 11 / normalizedLength));
  const stageScale = Math.max(0.42, Math.min(1, 10 / normalizedLength));
  const weightScale = Math.max(0.72, Math.min(1, 12 / normalizedLength));

  return {
    fontFamily,
    "--specimen-length": normalizedLength,
    "--specimen-hero-scale": heroScale.toFixed(3),
    "--specimen-stage-scale": stageScale.toFixed(3),
    "--specimen-weight-scale": weightScale.toFixed(3),
  };
};

const getHeroScaleStyle = (word: string, fontFamily: string): SpecimenStyleVars => {
  const normalizedLength = [...word.replace(/\s+/g, "")].length || 1;
  const heroScale = Math.max(0.8, Math.min(1.28, 9 / normalizedLength + 0.34));

  return {
    fontFamily,
    "--specimen-length": normalizedLength,
    "--specimen-hero-scale": heroScale.toFixed(3),
  };
};

export default async function TypefacePage({ params }: TypefacePageProps) {
  const { slug } = await params;
  const typeface = await getTypefaceBySlug(slug);

  if (!typeface) {
    notFound();
  }

  const [concepts, comparisons] = await Promise.all([
    getConceptsByIds(typeface.conceptRefs ?? []),
    getComparisonsForTypeface(typeface.id),
  ]);

  const relatedTypefaceIds = [...new Set(comparisons.flatMap((comparison) => [comparison.leftId, comparison.rightId]))];
  const relatedTypefaces = await getTypefacesByIds(relatedTypefaceIds);
  const typefaceNameById = new Map(relatedTypefaces.map((entry) => [entry.id, entry.name]));
  // Un lien vers une page de spécimen n'est proposé que si cette page existe.
  // Depuis que `/type/[slug]` répond 404 sans police servie, la carte « nearby »
  // et les lignes de comparaison de la page d'Inter pointaient droit sur
  // Helvetica Neue, donc sur une page introuvable. La carte de comparaison, elle,
  // teste déjà la présence du slug avant de faire un lien : filtrer la table
  // suffit, le texte reste, seul le lien disparaît.
  const hasSpecimenPage = (candidateSlug: string) => Boolean(getSpecimenFontFaceCss(candidateSlug));
  const typefaceSlugById = new Map(
    relatedTypefaces.filter((entry) => hasSpecimenPage(entry.slug)).map((entry) => [entry.id, entry.slug])
  );
  const manifestTypeface = getManifestTypefaceBySlug(typeface.slug);
  const specimenRuntimeRecord = getSpecimenRecordBySlug(typeface.slug);
  const previewFamily = getSpecimenPreviewFamily(typeface.slug);
  const specimenFontCss = getSpecimenFontFaceCss(typeface.slug);
  const displayFamily = previewFamily
    ? `"${previewFamily}", "${typeface.name}", "Helvetica Neue", Arial, sans-serif`
    : typeface.slug === "inter"
      ? 'var(--font-inter), Inter, "Helvetica Neue", Arial, sans-serif'
      : `"${typeface.name}", "Helvetica Neue", Arial, sans-serif`;
  const specimenStyle = { fontFamily: displayFamily };

  // PAS DE PAGE DE SPÉCIMEN SANS LA POLICE. Consigne de Marion le 2026-08-17,
  // « supprimer Helvetica, on taffe sur Inter, on le refera après ».
  //
  // Le constat qui l'a déclenchée : sans fichier servi, le spécimen n'est pas
  // cette typo. C'est celle du système du visiteur s'il l'a, sinon Arial, et rien
  // ne l'avertissait. Sur un Mac la page d'Helvetica paraît juste, sur un PC ou
  // un téléphone Android elle montre les lettres d'Arial sous le nom d'Helvetica.
  // Même faute que celle corrigée dans le jeu le 2026-08-15, « ne jamais montrer
  // une lettre inventée par le navigateur », restée debout ici.
  //
  // J'avais d'abord ajouté une mention sous le spécimen. Son arbitrage est plus
  // net : une page de spécimen qui ne peut pas montrer sa police n'a pas à
  // exister, on la refera quand la question de la licence sera tranchée.
  // Aucun contenu n'est supprimé, les textes de `content/` restent intacts :
  // retirer cette condition republie la page telle quelle.
  if (!getSpecimenFontFaceCss(typeface.slug)) {
    notFound();
  }
  const historyUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(typeface.name)}`;
  const primaryComparison = comparisons[0] ?? null;
  const demoParagraph =
    "One of the most famous lighthouses of antiquity stood in Alexandria, where architecture, precision and readability had to coexist in one clear signal.";
  const featureSummary = (["contrast", "xHeight", "aperture", "terminals"] as const).map(
    (feature) => `${formatFeatureLabel(feature)}: ${typeface.features[feature] ?? "n/a"}`
  );
  const weightedSamples = [300, 400, 500, 700, 900];
  // `quickFacts` et ses trois pastilles sont partis le 2026-08-17, même décision
  // que sur la page comparaison : « Comparaisons · 1 » et « Concepts · 1 »
  // comptaient notre propre contenu, ce qui ne dit rien à un lecteur, et
  // « Category · sans-serif » répétait en pastille ce que le héros dit déjà.
  // Consigne : « trouve un moment de supprimer ça et juste mettre serif ou
  // sans-serif ».
  const visibleComparisons = comparisons.slice(0, 3);
  const relatedTypefacesExcludingCurrent = relatedTypefaces
    .filter((entry) => entry.id !== typeface.id && hasSpecimenPage(entry.slug))
    .slice(0, 4);
  const glyphSets = typeface.specimen.glyphSets ?? [];
  const technicalRows = [
    { label: "Status", value: typeface.status },
    { label: "Slug", value: typeface.slug },
    { label: "ID", value: typeface.id },
    { label: "Category", value: `${typeface.category} / ${typeface.subCategory}` },
    { label: "Glyph sets", value: glyphSets.length > 0 ? glyphSets.join(", ") : "n/a" },
    { label: "Runtime source", value: manifestTypeface?.fontSource ?? "n/a" },
    { label: "Variable font", value: specimenRuntimeRecord?.isVariable ? "yes" : "no" },
    { label: "Glyph count", value: specimenRuntimeRecord?.glyphCount ? String(specimenRuntimeRecord.glyphCount) : "n/a" },
    {
      label: "Codepoints",
      value: specimenRuntimeRecord?.codepointCount ? String(specimenRuntimeRecord.codepointCount) : "n/a",
    },
  ];
  const analysisFeatures = Object.entries(typeface.features).map(([feature, value]) => ({
    feature,
    label: formatFeatureLabel(feature),
    value,
    description: featureDescriptions[feature] ?? "Key structural cue used for comparison and guided reading.",
  }));
  const testerText =
    "Bold pigeons hijack the poster while sleepy vowels queue for espresso. 0123456789 · Hamburgefonstiv";
  const testerAxes = specimenRuntimeRecord?.axes ?? [];
  const testerWeights = specimenRuntimeRecord?.weights ?? [];
  const testerGlyphGroups = getSpecimenGlyphGroups(typeface.slug);
  const specimenWord = typeface.specimen.defaultText.trim();
  const heroHeadingLineOne = `The ${typeface.name}`;
  const heroHeadingLineTwo = "typeface family";
  const heroScaleStyle = getHeroScaleStyle(`${heroHeadingLineOne} ${heroHeadingLineTwo}`, displayFamily);
  const specimenScaleStyle = getSpecimenScaleStyle(specimenWord, displayFamily);

  const pageClassName = `typo-page ${typeface.slug === "inter" ? "typo-page--black" : ""}`;

  return (
    <main className={pageClassName}>
      {specimenFontCss ? <style>{specimenFontCss}</style> : null}
      <article className="typo-shell">
        <SiteNav />
        <nav className="typo-breadcrumbs" aria-label="Typeface navigation">
          <Link href="/" className="typo-link">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/play" className="typo-link">
            Play
          </Link>
          <span aria-hidden="true">/</span>
          <span>{typeface.name}</span>
        </nav>

        <header className="typo-hero typo-hero--immersive">
          <div className="typo-hero-stage" style={heroScaleStyle}>
            {/* La catégorie, seule et sans son étiquette : sur une page qui ne
                parle que de cette typo, « Category · » ne dit rien de plus que
                « sans-serif ». */}
            <p className="typo-hero-stage-meta">{typeface.category}</p>
            <h1 className="typo-hero-stage-title" aria-label={`${typeface.name} typeface family`}>
              <span className="typo-hero-stage-line typo-hero-stage-line--xl">{heroHeadingLineOne}</span>
              <span className="typo-hero-stage-line typo-hero-stage-line--xl">{heroHeadingLineTwo}</span>
            </h1>
          </div>
        </header>

        <section className="typo-section typo-section--stage typo-section--specimen" aria-labelledby="type-specimen-title">
          <div className="typo-section-head">
            <h2 id="type-specimen-title" className="typo-section-title">
              Visual control
            </h2>
          </div>
          <div className="typo-specimen-layout" style={specimenScaleStyle}>
            <div className="typo-specimen-stage">
              <p className="typo-specimen-line typo-specimen-line--hero">{specimenWord}</p>
              <p className="typo-specimen-line">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
              <p className="typo-specimen-line">abcdefghijklmnopqrstuvwxyz</p>
              <p className="typo-specimen-line">0123456789 &amp;!? +-</p>
              <p className="typo-specimen-line typo-specimen-line--copy">
                Sphinx of black quartz, judge my vow. Pack my box with five dozen liquor jugs.
              </p>
            </div>
            <aside className="typo-specimen-rail">
              <p className="typo-specimen-rail-label">Weights</p>
              <div className="typo-weights-grid">
                {weightedSamples.map((weight) => (
                  <p key={weight} className="typo-weight-line" style={{ fontWeight: weight }}>
                    <span className="typo-weight-label">{weight}</span>
                    <span className="typo-weight-sample">{specimenWord}</span>
                  </p>
                ))}
              </div>
            </aside>
          </div>
          <div className="typo-specimen-stack" style={specimenStyle}>
            <p className="typo-demo-label">Specimen strips</p>
            <div className="typo-specimen-strip typo-specimen-strip--primary">BORN FREE</div>
            <div className="typo-specimen-strip typo-specimen-strip--secondary">Construção</div>
            <div className="typo-specimen-strip typo-specimen-strip--tertiary">
              Nineteen Eighty-Four, often published as 1984
            </div>
            <div className="typo-specimen-strip typo-specimen-strip--quaternary">
              Doublethink means the power of holding two contradictory beliefs in one mind simultaneously.
            </div>
          </div>
          <div className="typo-observation-grid">
            <article className="typo-observation-main">
              <p className="typo-demo-label">Continuous reading</p>
              <p className="typo-observation-text" style={specimenStyle}>
                {demoParagraph}
              </p>
            </article>
            <article className="typo-observation-side">
              <p className="typo-demo-label">Signs and ambiguity</p>
              <p className="typo-observation-text typo-observation-text--mono" style={specimenStyle}>
                {"->"} {"-->"} === +++ ?! @#$ % &amp; 0O1Il
              </p>
            </article>
            <article className="typo-observation-side">
              <p className="typo-demo-label">Quick cues</p>
              <ul className="typo-inline-list">
                {featureSummary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
          <div className="typo-observation-footer">
            {concepts.length > 0 ? (
              <div className="typo-concepts-block">
                <p className="typo-inline-concepts-copy">Concepts to observe</p>
                <div className="typo-concepts-grid">
                  {concepts.map((concept) => (
                    <article key={concept.id} className="typo-concept-card">
                      <p className="typo-demo-label">{concept.title}</p>
                      <p className="typo-concept-copy">{concept.definitionShort}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            <dl className="typo-kv-list typo-kv-list--compact">
              {Object.entries(typeface.features)
                .slice(0, 4)
                .map(([feature, value]) => (
                  <div key={feature} className="typo-kv-row">
                    <dt>{formatFeatureLabel(feature)}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </section>

        <section className="typo-section" aria-labelledby="type-tester-title">
          <div className="typo-section-head">
            <h2 id="type-tester-title" className="typo-section-title">
              Live tester
            </h2>
          </div>
          <div className="typo-tester-grid">
            <TypefaceTester
              availableWeights={testerWeights}
              axes={testerAxes}
              fontFamily={displayFamily}
              glyphGroups={testerGlyphGroups}
              initialText={testerText}
            />
          </div>
        </section>

        <section className="typo-section" aria-labelledby="type-analysis-title">
          <div className="typo-section-head">
            <h2 id="type-analysis-title" className="typo-section-title">
              Analytical structure
            </h2>
          </div>
          <div className="typo-analysis-grid">
            {analysisFeatures.map((item) => (
              <article key={item.feature} className="typo-analysis-card">
                <p className="typo-demo-label">{item.label}</p>
                <p className="typo-analysis-value">{item.value}</p>
                <p className="typo-concept-copy">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="typo-section" aria-labelledby="type-system-title">
          <div className="typo-section-head">
            <h2 id="type-system-title" className="typo-section-title">
              System record
            </h2>
          </div>
          <div className="typo-system-grid">
            <article className="typo-system-card">
              <p className="typo-demo-label">Identity and classification</p>
              <dl className="typo-kv-list typo-kv-list--compact">
                {technicalRows.map((row) => (
                  <div key={row.label} className="typo-kv-row">
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
            <article className="typo-system-card">
              <p className="typo-demo-label">Pedagogical intent</p>
              <p className="typo-concept-copy">
                The page should help the user see structure before memorizing names. Each block isolates a reliable cue,
                then routes the user toward comparison and training.
              </p>
            </article>
            <article className="typo-system-card">
              <p className="typo-demo-label">Editorial extension</p>
              <p className="typo-concept-copy">
                This entry can scale into comparison pages, concept pages, SEO pages and visual overlays while keeping
                one source of truth.
              </p>
            </article>
          </div>
        </section>

        <section className="typo-section typo-section--gateway" aria-labelledby="type-compare-title">
          <div className="typo-section-head">
            <h2 id="type-compare-title" className="typo-section-title">
              Comparison gateway
            </h2>
          </div>
          {comparisons.length === 0 ? (
            <p className="typo-muted">Aucune comparaison disponible.</p>
          ) : (
            <div className="typo-gateway-list">
              {visibleComparisons.map((comparison) => {
                const leftName = typefaceNameById.get(comparison.leftId) ?? comparison.leftId;
                const rightName = typefaceNameById.get(comparison.rightId) ?? comparison.rightId;
                const firstDiff = comparison.diffHighlights[0];

                return (
                  <article key={comparison.pairId} className="typo-gateway-card">
                    <p className="typo-demo-label">Score {comparison.score}</p>
                    <h3 className="typo-gateway-title">
                      {leftName} vs {rightName}
                    </h3>
                    <p className="typo-muted">
                      {firstDiff
                        ? `${formatFeatureLabel(firstDiff.feature)}: ${firstDiff.left} -> ${firstDiff.right}`
                        : "Detailed structural differences available."}
                    </p>
                    <div className="typo-gateway-actions">
                      <Link href={`/compare/${comparison.slug}`} className="typo-link">
                        Explorer cette comparaison
                      </Link>
                      {typefaceSlugById.get(comparison.leftId) ? (
                        <Link href={`/type/${typefaceSlugById.get(comparison.leftId)}`} className="typo-link">
                          Voir {leftName}
                        </Link>
                      ) : null}
                      {typefaceSlugById.get(comparison.rightId) ? (
                        <Link href={`/type/${typefaceSlugById.get(comparison.rightId)}`} className="typo-link">
                          Voir {rightName}
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="typo-actions">
            {primaryComparison ? (
              <Link className="typo-link-pill" href={`/compare/${primaryComparison.slug}`}>
                Commencer par la comparaison principale
              </Link>
            ) : null}
            <a className="typo-link-pill" href={historyUrl} target="_blank" rel="noreferrer">
              Histoire de {typeface.name}
            </a>
          </div>
        </section>

        {relatedTypefacesExcludingCurrent.length > 0 ? (
          <section className="typo-section" aria-labelledby="type-related-title">
            <div className="typo-section-head">
              <h2 id="type-related-title" className="typo-section-title">
                Nearby typefaces
              </h2>
            </div>
            <div className="typo-related-grid">
              {relatedTypefacesExcludingCurrent.map((relatedTypeface) => (
                <Link key={relatedTypeface.id} href={`/type/${relatedTypeface.slug}`} className="typo-related-card">
                  <span className="typo-demo-label">Explore</span>
                  <strong className="typo-related-name">{relatedTypeface.name}</strong>
                  <span className="typo-muted">
                    {relatedTypeface.category} · {relatedTypeface.subCategory}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </main>
  );
}
