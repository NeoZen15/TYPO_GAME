"use client";

import { useEffect, useMemo, useState } from "react";
import { measureFontMetrics, measureVisualBox } from "@/lib/typography/anatomy-metrics";

type ComparisonMetricsPanelProps = {
  feature: string;
  sampleMode: "word" | "glyph";
  sampleWord: string;
  sampleGlyphs: string[];
  left: {
    label: string;
    family: string;
  };
  right: {
    label: string;
    family: string;
  };
  whatBreaksIt: string;
};

type MeasuredSet = {
  xHeightRatio: number;
  capHeightRatio: number;
  ascenderRatio: number;
  descenderRatio: number;
  averageGlyphWidth: number;
  sampleWordWidth: number;
  spacingDensity: number;
};

type SummaryItem = {
  id: string;
  label: string;
  delta: string;
  note: string;
};

type MetricRow = {
  id: string;
  label: string;
  leftValue: string;
  rightValue: string;
};

const CALIBRATION_SIZE = 1000;

const formatRatio = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatUnits = (value: number) => `${Math.round(value)}u`;
const formatSigned = (value: number, digits = 1) => {
  const rounded = value.toFixed(digits);
  return `${value >= 0 ? "+" : ""}${rounded}`;
};

const formatRatioDelta = (left: number, right: number) =>
  `${formatSigned((right - left) * 100)}%`;

const formatUnitDelta = (left: number, right: number) =>
  `${formatSigned(right - left, 0)}u`;

const formatDensityDelta = (left: number, right: number) =>
  `${formatSigned(right - left)}u/letter`;

const getHigherLabel = (leftValue: number, rightValue: number, leftLabel: string, rightLabel: string) =>
  rightValue > leftValue ? rightLabel : leftLabel;

const measureSet = (family: string, sampleWord: string, sampleGlyphs: string[]): MeasuredSet => {
  const fontMetrics = measureFontMetrics(family);
  const sampleWordBox = measureVisualBox(family, sampleWord);
  const proofGlyphs = sampleGlyphs.length > 0 ? sampleGlyphs : ["n", "o", "x"];
  const glyphBoxes = proofGlyphs.map((glyph) => measureVisualBox(family, glyph));
  const totalGlyphWidth = glyphBoxes.reduce((sum, box) => sum + box.width, 0);
  const averageGlyphWidth = totalGlyphWidth / Math.max(glyphBoxes.length, 1);

  return {
    xHeightRatio: fontMetrics.xAscent / CALIBRATION_SIZE,
    capHeightRatio: fontMetrics.capAscent / CALIBRATION_SIZE,
    ascenderRatio: fontMetrics.ascenderAscent / CALIBRATION_SIZE,
    descenderRatio: fontMetrics.descenderDepth / CALIBRATION_SIZE,
    averageGlyphWidth,
    sampleWordWidth: sampleWordBox.width,
    spacingDensity: sampleWordBox.width / Math.max(sampleWord.length, 1),
  };
};

export default function ComparisonMetricsPanel({
  feature,
  sampleMode,
  sampleWord,
  sampleGlyphs,
  left,
  right,
  whatBreaksIt,
}: ComparisonMetricsPanelProps) {
  const [readyTick, setReadyTick] = useState(() => {
    if (typeof document === "undefined") return 0;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    return fonts?.status === "loaded" ? 1 : 0;
  });

  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts || fonts.status === "loaded") return;

    let cancelled = false;

    fonts.ready
      .then(() => {
        if (!cancelled) {
          setReadyTick((value) => value + 1);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [left.family, right.family, sampleGlyphs, sampleWord]);

  const metrics = useMemo(() => {
    void readyTick;
    const uniqueGlyphs = sampleGlyphs.filter((glyph, index, array) => array.indexOf(glyph) === index);
    const leftMeasured = measureSet(left.family, sampleWord, uniqueGlyphs);
    const rightMeasured = measureSet(right.family, sampleWord, uniqueGlyphs);

    const summary: SummaryItem[] = [
      {
        id: "x-height-diff",
        label: "x height difference",
        delta: formatRatioDelta(leftMeasured.xHeightRatio, rightMeasured.xHeightRatio),
        note: `${getHigherLabel(leftMeasured.xHeightRatio, rightMeasured.xHeightRatio, left.label, right.label)} has the higher lowercase body.`,
      },
      {
        id: "cap-height-diff",
        label: "cap height difference",
        delta: formatRatioDelta(leftMeasured.capHeightRatio, rightMeasured.capHeightRatio),
        note: `${getHigherLabel(leftMeasured.capHeightRatio, rightMeasured.capHeightRatio, left.label, right.label)} reaches higher in capitals.`,
      },
      {
        id: "width-diff",
        label: "width difference",
        delta:
          sampleMode === "glyph"
            ? formatUnitDelta(leftMeasured.averageGlyphWidth, rightMeasured.averageGlyphWidth)
            : formatUnitDelta(leftMeasured.sampleWordWidth, rightMeasured.sampleWordWidth),
        note:
          sampleMode === "glyph"
            ? `${getHigherLabel(leftMeasured.averageGlyphWidth, rightMeasured.averageGlyphWidth, left.label, right.label)} draws the broader proof letter.`
            : `${getHigherLabel(leftMeasured.sampleWordWidth, rightMeasured.sampleWordWidth, left.label, right.label)} takes more horizontal room.`,
      },
      {
        id: "density-diff",
        label: "density difference",
        delta: formatDensityDelta(leftMeasured.spacingDensity, rightMeasured.spacingDensity),
        note: `${getHigherLabel(leftMeasured.spacingDensity, rightMeasured.spacingDensity, left.label, right.label)} feels denser across the word.`,
      },
    ];

    const columns: MetricRow[] = [
      {
        id: "x-height",
        label: "x height",
        leftValue: formatRatio(leftMeasured.xHeightRatio),
        rightValue: formatRatio(rightMeasured.xHeightRatio),
      },
      {
        id: "cap-height",
        label: "cap height",
        leftValue: formatRatio(leftMeasured.capHeightRatio),
        rightValue: formatRatio(rightMeasured.capHeightRatio),
      },
      {
        id: "width",
        label: sampleMode === "glyph" ? "proof width" : "word width",
        leftValue: sampleMode === "glyph" ? formatUnits(leftMeasured.averageGlyphWidth) : formatUnits(leftMeasured.sampleWordWidth),
        rightValue: sampleMode === "glyph" ? formatUnits(rightMeasured.averageGlyphWidth) : formatUnits(rightMeasured.sampleWordWidth),
      },
      {
        id: "ascender",
        label: "ascender",
        leftValue: formatRatio(leftMeasured.ascenderRatio),
        rightValue: formatRatio(rightMeasured.ascenderRatio),
      },
    ];

    const verdict = [
      `${getHigherLabel(leftMeasured.xHeightRatio, rightMeasured.xHeightRatio, left.label, right.label)} has the higher x-height.`,
      `${getHigherLabel(leftMeasured.sampleWordWidth, rightMeasured.sampleWordWidth, left.label, right.label)} takes more width in "${sampleWord}".`,
      feature === "xHeight"
        ? `The clearest difference sits between the x-height and the baseline.`
        : `The clearest difference appears in the ${feature === "contrast" ? "internal rhythm" : feature} zone.`,
    ];

    return {
      summary,
      columns,
      verdict,
      referenceLabel: sampleMode === "glyph" ? uniqueGlyphs.join(" ") || sampleWord : sampleWord,
    };
  }, [feature, left.family, left.label, right.family, right.label, sampleGlyphs, sampleMode, sampleWord, readyTick]);

  return (
    <section className="compare-metrics" aria-labelledby="compare-metrics-title">
      <div className="compare-metrics-head">
        <div>
          <p className="typo-demo-label">Measured delta</p>
          <h3 id="compare-metrics-title" className="compare-metrics-title">
            Compare the same reference before reading texture
          </h3>
        </div>
        <p className="compare-metrics-copy">
          The panel shows stable metric deltas first, then each typeface on its own column, so you can compare numbers and the shared stage at the same time.
        </p>
      </div>

      <div className="compare-metrics-summary">
        {metrics.summary.map((item) => (
          <article key={item.id} className="compare-metrics-summary-card">
            <p className="compare-metrics-summary-label">{item.label}</p>
            <p className="compare-metrics-summary-value">{item.delta}</p>
            <p className="compare-metrics-summary-note">{item.note}</p>
          </article>
        ))}
      </div>

      <div className="compare-metrics-columns">
        <article className="compare-metrics-column">
          <p className="compare-metrics-column-kicker">Left reference</p>
          <h4 className="compare-metrics-column-title">{left.label}</h4>
          <div className="compare-metrics-column-rows">
            {metrics.columns.map((row) => (
              <p key={`${row.id}-${left.label}`} className="compare-metrics-column-row">
                <span>{row.label}</span>
                {row.leftValue}
              </p>
            ))}
          </div>
        </article>

        <article className="compare-metrics-column">
          <p className="compare-metrics-column-kicker">Right reference</p>
          <h4 className="compare-metrics-column-title">{right.label}</h4>
          <div className="compare-metrics-column-rows">
            {metrics.columns.map((row) => (
              <p key={`${row.id}-${right.label}`} className="compare-metrics-column-row">
                <span>{row.label}</span>
                {row.rightValue}
              </p>
            ))}
          </div>
        </article>
      </div>

      <div className="compare-metrics-verdict">
        <p className="compare-metrics-verdict-chip">
          Reference <span>{metrics.referenceLabel}</span>
        </p>
        {metrics.verdict.map((line) => (
          <p key={line} className="compare-metrics-verdict-line">
            {line}
          </p>
        ))}
        <p className="compare-metrics-verdict-line compare-metrics-verdict-line--muted">{whatBreaksIt}</p>
      </div>
    </section>
  );
}
