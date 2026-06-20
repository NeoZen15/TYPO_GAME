"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildWordOverlayModel,
  measureWordOverlay,
  type WordOverlayMetrics,
} from "@/lib/typography/word-overlay-engine";

type MeasuredWordPaneProps = {
  label: string;
  family: string;
  word: string;
  feature?: string;
  paneClassName: string;
  showMeasurements?: boolean;
};

type MeasuredWordSplitProps = {
  word: string;
  left: {
    label: string;
    family: string;
  };
  right: {
    label: string;
    family: string;
  };
  feature?: string;
  showMeasurements?: boolean;
};

function MeasuredWordPane({ label, family, word, feature, paneClassName, showMeasurements = false }: MeasuredWordPaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isGuideActive, setIsGuideActive] = useState(false);
  const [metrics, setMetrics] = useState<WordOverlayMetrics | null>(null);

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
  }, [family, word]);

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

      const nextMetrics = await measureWordOverlay({
        family,
        word,
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
  }, [family, size.height, size.width, word]);

  const overlayState = showMeasurements ? "pedagogical" : isGuideActive ? "active" : "resting";
  const overlayModel = metrics ? buildWordOverlayModel({ word, metrics, feature }) : null;
  const widthMeasure = overlayModel?.verticalMeasures.find((measure) => measure.key === "width") ?? null;

  return (
    <article
      className={`compare-stage-pane ${paneClassName} compare-stage-pane--x-height`}
      data-overlay-state={overlayState}
    >
      <p className="compare-stage-pane-label">{label}</p>
      {overlayModel && showMeasurements ? (
        <div className="compare-stage-pane-measure-strip" aria-label={`${label} measurements`}>
          {overlayModel.metricChips.map((chip) => (
            <p key={`${label}-${chip.key}`} className="compare-stage-pane-measure-chip">
              {chip.label} <span>{chip.value}</span>
            </p>
          ))}
        </div>
      ) : null}
      <div
        ref={paneRef}
        className="compare-stage-pane-x-height-shell"
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
            className="compare-stage-pane-x-height-svg"
            viewBox={`0 0 ${Math.max(size.width, 1)} ${Math.max(size.height, 1)}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${label} ${word} word comparison`}
          >
            <text
              className="compare-stage-pane-x-height-word"
              x={metrics.layout.drawX}
              y={metrics.baseline}
              dominantBaseline="auto"
              textAnchor="start"
              fontFamily={family}
              fontSize={metrics.layout.fontSize}
              fontWeight={500}
              fill="currentColor"
              style={{ userSelect: "none" }}
            >
              {word}
            </text>
            {overlayModel?.guideLines.map((guide) => (
              <line
                key={`${label}-${guide.key}`}
                className={`compare-stage-pane-x-height-guide ${guide.key === "x" ? "compare-stage-pane-x-height-guide--x" : guide.key === "baseline" ? "compare-stage-pane-x-height-guide--base" : "compare-stage-pane-x-height-guide--cap"}`}
                x1={guide.x1}
                y1={guide.y}
                x2={guide.x2}
                y2={guide.y}
              />
            ))}

            {showMeasurements && overlayModel ? (
              <>
                {overlayModel.bands.map((band) => (
                  <g key={`${label}-${band.key}`}>
                    <rect
                      className="compare-stage-pane-band"
                      x={band.x}
                      y={band.y}
                      width={band.width}
                      height={band.height}
                      rx="10"
                      ry="10"
                    />
                    <text
                      className="compare-stage-pane-band-label"
                      x={band.labelX}
                      y={band.labelY}
                      textAnchor={band.labelAnchor}
                    >
                      {band.label}
                    </text>
                  </g>
                ))}

                {overlayModel.focusZones.map((zone) => (
                  <g key={`${label}-${zone.key}`}>
                    {zone.shape === "ellipse" ? (
                      <ellipse
                        className={`compare-stage-pane-focus-zone ${zone.tone === "secondary" ? "compare-stage-pane-focus-zone--secondary" : "compare-stage-pane-focus-zone--primary"}`}
                        cx={zone.x + zone.width / 2}
                        cy={zone.y + zone.height / 2}
                        rx={zone.width / 2}
                        ry={zone.height / 2}
                      />
                    ) : (
                      <rect
                        className={`compare-stage-pane-focus-zone ${zone.tone === "secondary" ? "compare-stage-pane-focus-zone--secondary" : "compare-stage-pane-focus-zone--primary"}`}
                        x={zone.x}
                        y={zone.y}
                        width={zone.width}
                        height={zone.height}
                        rx={zone.rx}
                        ry={zone.ry}
                      />
                    )}
                    {zone.label ? (
                      <>
                        {zone.tone === "primary" ? (
                          <line
                            className="compare-stage-pane-callout compare-stage-pane-callout--primary"
                            x1={zone.labelX}
                            y1={zone.labelY - 4}
                            x2={zone.connectorX}
                            y2={zone.connectorY}
                          />
                        ) : null}
                        <text
                          className={`compare-stage-pane-callout-label ${zone.tone === "primary" ? "compare-stage-pane-callout-label--primary" : "compare-stage-pane-callout-label--secondary"}`}
                          x={zone.labelX}
                          y={zone.labelY}
                          textAnchor={zone.labelAnchor}
                        >
                          {zone.label}
                        </text>
                      </>
                    ) : null}
                  </g>
                ))}

                {overlayModel.guideLines.map((guide) => (
                  <text
                    key={`${label}-${guide.key}-label`}
                    className={`compare-stage-pane-x-height-label ${guide.key === "x" ? "compare-stage-pane-x-height-label--primary" : ""}`}
                    x={guide.labelX}
                    y={guide.labelY}
                    textAnchor={guide.textAnchor}
                  >
                    {guide.valueText ? `${guide.label} ${guide.valueText}` : guide.label}
                  </text>
                ))}

                {overlayModel.verticalMeasures.map((measure) => (
                  <line
                    key={`${label}-${measure.key}`}
                    className={`compare-stage-pane-dimension-line ${measure.tone === "primary" ? "compare-stage-pane-dimension-line--primary" : "compare-stage-pane-dimension-line--secondary"}`}
                    x1={measure.x1}
                    y1={measure.y1}
                    x2={measure.x2}
                    y2={measure.y2}
                  />
                ))}

                {widthMeasure ? (
                  <>
                    <line
                      className="compare-stage-pane-dimension-tick compare-stage-pane-dimension-tick--primary"
                      x1={widthMeasure.x1}
                      y1={widthMeasure.y1 - 5}
                      x2={widthMeasure.x1}
                      y2={widthMeasure.y1 + 5}
                    />
                    <line
                      className="compare-stage-pane-dimension-tick compare-stage-pane-dimension-tick--primary"
                      x1={widthMeasure.x2}
                      y1={widthMeasure.y2 - 5}
                      x2={widthMeasure.x2}
                      y2={widthMeasure.y2 + 5}
                    />
                    <text
                      className="compare-stage-pane-dimension-label compare-stage-pane-dimension-label--primary"
                      x={metrics.bounds.centerX}
                      y={Math.max(widthMeasure.y1 - 10, 10)}
                      textAnchor="middle"
                    >
                      {`WORD WIDTH ${Math.round(metrics.rawWordWidth)}px`}
                    </text>
                  </>
                ) : null}
              </>
            ) : null}
          </svg>
        ) : null}
      </div>
    </article>
  );
}

export default function MeasuredWordSplit({ word, left, right, feature, showMeasurements = false }: MeasuredWordSplitProps) {
  return (
    <div className="compare-stage-split compare-stage-split--x-height">
      <MeasuredWordPane
        label={left.label}
        family={left.family}
        word={word}
        feature={feature}
        paneClassName="compare-stage-pane--left"
        showMeasurements={showMeasurements}
      />
      <MeasuredWordPane
        label={right.label}
        family={right.family}
        word={word}
        feature={feature}
        paneClassName="compare-stage-pane--right"
        showMeasurements={showMeasurements}
      />
    </div>
  );
}
