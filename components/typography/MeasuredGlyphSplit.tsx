"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildGlyphOverlayModel,
  formatPixelLabel,
  measureGlyph,
  type GlyphMetrics,
} from "@/lib/typography/glyph-overlay-engine";

type CompareFeature = "aperture" | "xHeight" | "terminals" | "contrast" | string;

type AnnotationKey = "aperture" | "counter" | "opening";

type HorizontalMeasure = {
  key: string;
  label: string;
  x1: number;
  x2: number;
  y: number;
  accent?: "primary" | "secondary";
};

type FocusZone = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  ry: number;
  label?: string;
  labelX?: number;
  labelY?: number;
};

type FocusBadge = {
  x: number;
  y: number;
  text: string;
  tone?: "primary" | "secondary";
};

type AnnotationLabelProps = {
  connectorX1: number;
  connectorY1: number;
  connectorX2: number;
  connectorY2: number;
  text: string;
  textX: number;
  textY: number;
  textAnchor?: "start" | "middle" | "end";
};

type MeasuredGlyphPaneProps = {
  label: string;
  family: string;
  glyph: string;
  feature: CompareFeature;
  paneClassName: string;
  activeAnnotation: AnnotationKey | null;
  showMeasurements?: boolean;
};

type MeasuredGlyphSplitProps = {
  glyph: string;
  feature: CompareFeature;
  guideLabel: string;
  left: {
    label: string;
    family: string;
  };
  right: {
    label: string;
    family: string;
  };
  showMeasurements?: boolean;
};

const APERTURE_GLYPHS = new Set(["e", "c", "s", "a", "g"]);

function AnnotationLabel({
  connectorX1,
  connectorY1,
  connectorX2,
  connectorY2,
  text,
  textX,
  textY,
  textAnchor = "start",
}: AnnotationLabelProps) {
  return (
    <>
      <line
        className="compare-stage-pane-callout compare-stage-pane-callout--primary"
        x1={connectorX1}
        y1={connectorY1}
        x2={connectorX2}
        y2={connectorY2}
      />
      <text className="compare-stage-pane-callout-label" x={textX} y={textY} textAnchor={textAnchor}>
        {text}
      </text>
    </>
  );
}

const getCounterZone = (metrics: GlyphMetrics): FocusZone | null => {
  const glyphWidth = metrics.right - metrics.left;
  const x = metrics.left + glyphWidth * 0.28;
  const y = metrics.xHeight + (metrics.baseline - metrics.xHeight) * 0.16;
  const width = glyphWidth * 0.3;
  const height = Math.max((metrics.baseline - metrics.xHeight) * 0.24, metrics.fontSize * 0.14);

  if (width <= metrics.fontSize * 0.08) return null;

  return {
    key: "counter",
    x,
    y,
    width,
    height,
    rx: metrics.fontSize * 0.08,
    ry: metrics.fontSize * 0.08,
    label: "COUNTER",
    labelX: metrics.left - metrics.fontSize * 0.18,
    labelY: Math.max(metrics.top - metrics.fontSize * 0.08, 24),
  };
};

const getApertureMeasure = (glyph: string, metrics: GlyphMetrics): HorizontalMeasure | null => {
  const apertureY = metrics.xHeight + (metrics.baseline - metrics.xHeight) * 0.45;
  const x1 = metrics.left + (metrics.right - metrics.left) * 0.45;
  const x2 = metrics.right - metrics.fontSize * 0.08;

  if (x2 - x1 < metrics.fontSize * 0.06) return null;

  return {
    key: "aperture",
    label: "APERTURE",
    x1,
    x2,
    y: apertureY,
    accent: "primary",
  };
};

const getApertureBadge = (glyph: string, metrics: GlyphMetrics, measure: HorizontalMeasure | null): FocusBadge | null => {
  if (!measure) return null;

  return {
    x: metrics.right + metrics.fontSize * 0.22,
    y: measure.y,
    text: glyph.toLowerCase() === "e" ? "APERTURE" : "OPENING",
    tone: glyph.toLowerCase() === "e" ? "primary" : "secondary",
  };
};

function MeasuredGlyphPane({
  label,
  family,
  glyph,
  feature,
  paneClassName,
  activeAnnotation,
  showMeasurements = false,
}: MeasuredGlyphPaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isGuideActive, setIsGuideActive] = useState(false);
  const [metrics, setMetrics] = useState<GlyphMetrics | null>(null);

  useEffect(() => {
    const node = paneRef.current;
    if (!node) return;

    const update = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: rect.width,
        height: rect.height,
      });
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);

    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) {
      fonts.ready.then(update).catch(() => undefined);
    }

    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [family, glyph]);

  useEffect(() => {
    setIsGuideActive(showMeasurements);
  }, [showMeasurements]);

  useEffect(() => {
    let cancelled = false;

    const runMeasurement = async () => {
      if (!size.width || !size.height) {
        setMetrics(null);
        return;
      }

      const nextMetrics = await measureGlyph({
        family,
        glyph,
        width: size.width,
        height: size.height,
      });

      if (!cancelled) {
        setMetrics(nextMetrics);
      }
    };

    runMeasurement().catch(() => {
      if (!cancelled) {
        setMetrics(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [family, glyph, size.height, size.width]);

  const overlayState = showMeasurements ? "pedagogical" : isGuideActive ? "active" : "resting";
  const normalizedGlyph = glyph.trim().toLowerCase();

  const overlayModel = useMemo(
    () => (metrics ? buildGlyphOverlayModel(glyph, metrics, size) : null),
    [glyph, metrics, size]
  );
  const guideLines = overlayModel?.guideLines ?? [];
  const metricChips = overlayModel?.metricChips ?? [];
  const verticalMeasures = overlayModel?.verticalMeasures ?? [];
  const apertureEnabled = feature === "aperture" && Boolean(metrics) && APERTURE_GLYPHS.has(normalizedGlyph);
  const apertureMeasure = useMemo(() => {
    if (!apertureEnabled || !metrics) return null;

    return (
      getApertureMeasure(glyph, metrics) ?? {
        key: "aperture",
        label: "Opening",
        x1: metrics.left + metrics.fontSize * 0.3,
        x2: metrics.right - metrics.fontSize * 0.14,
        y: metrics.xHeight + (metrics.baseline - metrics.xHeight) * 0.5,
        accent: "primary" as const,
      }
    );
  }, [apertureEnabled, glyph, metrics]);
  const apertureBadge = useMemo(
    () => (apertureEnabled && metrics ? getApertureBadge(glyph, metrics, apertureMeasure) : null),
    [apertureEnabled, apertureMeasure, glyph, metrics]
  );
  const counterZone = useMemo(
    () => (apertureEnabled && metrics ? getCounterZone(metrics) : null),
    [apertureEnabled, metrics]
  );
  const showAperture = showMeasurements && apertureEnabled && Boolean(apertureMeasure) && normalizedGlyph === "e";
  const showCounter = showMeasurements && apertureEnabled && Boolean(counterZone);
  const showOpening = showMeasurements && apertureEnabled && Boolean(apertureMeasure) && normalizedGlyph !== "e";
  const widthLineY = metrics ? Math.min(metrics.bottom + 22, Math.max(size.height - 16, 16)) : 0;
  const widthLabelY = metrics ? Math.min(widthLineY + 16, Math.max(size.height - 2, 2)) : 0;

  return (
    <article
      className={`compare-stage-pane ${paneClassName} compare-stage-pane--measured`}
      data-overlay-state={overlayState}
    >
      <div className="compare-stage-pane-head">
        <p className="compare-stage-pane-label">{label}</p>
      </div>
      {metrics && showMeasurements && metricChips.length > 0 ? (
        <div className="compare-stage-pane-measure-strip" aria-label={`${label} measurements`}>
          {metricChips.map((chip) => (
            <p key={chip.key} className="compare-stage-pane-measure-chip">
              {chip.label} <span>{chip.value}</span>
            </p>
          ))}
        </div>
      ) : null}
      <div
        ref={paneRef}
        className="compare-stage-pane-measured-shell"
        onPointerEnter={() => setIsGuideActive(true)}
        onPointerLeave={() => {
          if (!showMeasurements) setIsGuideActive(false);
        }}
        onFocusCapture={() => setIsGuideActive(true)}
        onBlurCapture={() => {
          if (!showMeasurements) setIsGuideActive(false);
        }}
      >
        {metrics ? (
          <svg
            className="compare-stage-pane-measured-svg"
            width={Math.max(size.width, 1)}
            height={Math.max(size.height, 1)}
            viewBox={`0 0 ${Math.max(size.width, 1)} ${Math.max(size.height, 1)}`}
            overflow="visible"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${label} ${glyph} anatomy overlay`}
          >
            {guideLines.map((guide) => (
              <g key={guide.key}>
                {guide.segments.map((segment, index) => (
                  <line
                    key={`${guide.key}-${index}`}
                    className={`compare-stage-pane-guide ${guide.tone === "subtle" ? "compare-stage-pane-guide--subtle" : ""}`}
                    x1={segment.x1}
                    y1={guide.y}
                    x2={segment.x2}
                    y2={guide.y}
                  />
                ))}
                {showMeasurements ? (
                  <text
                    className="compare-stage-pane-guide-label"
                    x={guide.placement.x}
                    y={guide.placement.y}
                    textAnchor={guide.placement.textAnchor}
                    dominantBaseline="hanging"
                  >
                    {guide.valueText ? `${guide.label} ${guide.valueText}` : guide.label}
                  </text>
                ) : null}
              </g>
            ))}
            {showMeasurements ? (
              <>
                <text
                  x={metrics.drawX}
                  y={metrics.baseline}
                  dominantBaseline="auto"
                  textAnchor="start"
                  fontFamily={family}
                  fontSize={metrics.fontSize}
                  fontWeight={500}
                  fill="currentColor"
                  style={{ userSelect: "none" }}
                >
                  {glyph}
                </text>
                {verticalMeasures.map((measure) => (
                  <g key={measure.key}>
                    <line
                      className={`compare-stage-pane-axis ${measure.tone === "secondary" ? "compare-stage-pane-axis--secondary" : ""}`}
                      x1={measure.x}
                      y1={measure.y1}
                      x2={measure.x}
                      y2={measure.y2}
                    />
                    <line
                      className={`compare-stage-pane-axis-tick ${measure.tone === "secondary" ? "compare-stage-pane-axis-tick--secondary" : ""}`}
                      x1={measure.x - 5}
                      y1={measure.y1}
                      x2={measure.x + 5}
                      y2={measure.y1}
                    />
                    <line
                      className={`compare-stage-pane-axis-tick ${measure.tone === "secondary" ? "compare-stage-pane-axis-tick--secondary" : ""}`}
                      x1={measure.x - 5}
                      y1={measure.y2}
                      x2={measure.x + 5}
                      y2={measure.y2}
                    />
                  </g>
                ))}
                <line
                  className="compare-stage-pane-dimension-line"
                  x1={metrics.left}
                  y1={widthLineY}
                  x2={metrics.right}
                  y2={widthLineY}
                />
                <line
                  className="compare-stage-pane-dimension-tick"
                  x1={metrics.left}
                  y1={widthLineY - 6}
                  x2={metrics.left}
                  y2={widthLineY + 6}
                />
                <line
                  className="compare-stage-pane-dimension-tick"
                  x1={metrics.right}
                  y1={widthLineY - 6}
                  x2={metrics.right}
                  y2={widthLineY + 6}
                />
                <text
                  className="compare-stage-pane-dimension-label"
                  x={(metrics.left + metrics.right) / 2}
                  y={widthLabelY}
                  textAnchor="middle"
                >
                  {`WIDTH ${formatPixelLabel(Math.abs(metrics.right - metrics.left))}`}
                </text>
              </>
            ) : null}
            {showMeasurements && apertureEnabled ? (
              <g>
                {activeAnnotation === "aperture" && showAperture && apertureBadge && apertureMeasure ? (
                  <g>
                    <AnnotationLabel
                      key="aperture"
                      connectorX1={apertureBadge.x}
                      connectorY1={apertureBadge.y}
                      connectorX2={metrics.right + 8}
                      connectorY2={apertureMeasure.y}
                      text="APERTURE"
                      textX={apertureBadge.x + 2}
                      textY={apertureBadge.y - 6}
                    />
                    <circle
                      className="compare-stage-pane-anchor compare-stage-pane-anchor--primary"
                      cx={metrics.right + 8}
                      cy={apertureMeasure.y}
                      r="2.25"
                    />
                  </g>
                ) : null}
                {activeAnnotation === "counter" && showCounter && counterZone ? (
                  <g>
                    <rect
                      className="compare-stage-pane-focus-zone compare-stage-pane-focus-zone--secondary"
                      x={counterZone.x}
                      y={counterZone.y}
                      width={counterZone.width}
                      height={counterZone.height}
                      rx={counterZone.rx}
                      ry={counterZone.ry}
                    />
                    {counterZone.label ? (
                      <AnnotationLabel
                        key="counter"
                        connectorX1={counterZone.labelX ?? counterZone.x}
                        connectorY1={(counterZone.labelY ?? counterZone.y - 8) - 4}
                        connectorX2={counterZone.x + counterZone.width * 0.25}
                        connectorY2={counterZone.y}
                        text={counterZone.label}
                        textX={counterZone.labelX ?? counterZone.x}
                        textY={counterZone.labelY ?? counterZone.y - 8}
                        textAnchor="end"
                      />
                    ) : null}
                  </g>
                ) : null}
                {activeAnnotation === "opening" && showOpening && apertureBadge && apertureMeasure ? (
                  <g>
                    <AnnotationLabel
                      key="opening"
                      connectorX1={apertureBadge.x}
                      connectorY1={apertureBadge.y}
                      connectorX2={(apertureMeasure.x1 + apertureMeasure.x2) / 2}
                      connectorY2={apertureMeasure.y}
                      text="OPENING"
                      textX={apertureBadge.x + 2}
                      textY={apertureBadge.y - 6}
                    />
                    <circle
                      className="compare-stage-pane-anchor compare-stage-pane-anchor--primary"
                      cx={(apertureMeasure.x1 + apertureMeasure.x2) / 2}
                      cy={apertureMeasure.y}
                      r="2.25"
                    />
                  </g>
                ) : null}
                {(activeAnnotation === "aperture" || activeAnnotation === "opening") && apertureMeasure ? (
                  <>
                    <line
                      className="compare-stage-pane-dimension-line compare-stage-pane-dimension-line--primary"
                      x1={apertureMeasure.x1}
                      y1={apertureMeasure.y}
                      x2={apertureMeasure.x2}
                      y2={apertureMeasure.y}
                    />
                    <line
                      className="compare-stage-pane-dimension-tick compare-stage-pane-dimension-tick--primary"
                      x1={apertureMeasure.x1}
                      y1={apertureMeasure.y - 6}
                      x2={apertureMeasure.x1}
                      y2={apertureMeasure.y + 6}
                    />
                    <line
                      className="compare-stage-pane-dimension-tick compare-stage-pane-dimension-tick--primary"
                      x1={apertureMeasure.x2}
                      y1={apertureMeasure.y - 6}
                      x2={apertureMeasure.x2}
                      y2={apertureMeasure.y + 6}
                    />
                  </>
                ) : null}
              </g>
            ) : null}
          </svg>
        ) : null}
      </div>
    </article>
  );
}

export default function MeasuredGlyphSplit({
  glyph,
  feature,
  left,
  right,
  showMeasurements = false,
}: MeasuredGlyphSplitProps) {
  const activeAnnotation: AnnotationKey | null = null;

  return (
    <div className="compare-stage-split compare-stage-split--measured">
      <MeasuredGlyphPane
        label={left.label}
        family={left.family}
        glyph={glyph}
        feature={feature}
        paneClassName="compare-stage-pane--left"
        activeAnnotation={activeAnnotation}
        showMeasurements={showMeasurements}
      />
      <MeasuredGlyphPane
        label={right.label}
        family={right.family}
        glyph={glyph}
        feature={feature}
        paneClassName="compare-stage-pane--right"
        activeAnnotation={activeAnnotation}
        showMeasurements={showMeasurements}
      />
    </div>
  );
}
