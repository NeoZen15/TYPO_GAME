"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type GlyphMetrics = {
  width: number;
  actualTop: number;
  baseline: number;
  guideTop: number;
  left: number;
  right: number;
  meterLeft: number;
  fontSize: number;
  drawX: number;
};

type MeasuredGlyphPaneProps = {
  label: string;
  family: string;
  glyph: string;
  guideLabel: string;
  paneClassName: string;
};

type MeasuredGlyphSplitProps = {
  glyph: string;
  guideLabel: string;
  left: {
    label: string;
    family: string;
  };
  right: {
    label: string;
    family: string;
  };
};

const measureGlyph = ({
  family,
  glyph,
  width,
  height,
}: {
  family: string;
  glyph: string;
  width: number;
  height: number;
}): GlyphMetrics => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const fontSize = Math.min(width * 0.52, height * 0.78, 420);
  const baseline = height * 0.58;
  const guideTop = height * 0.36;

  if (!context) {
    const fallbackWidth = fontSize * 0.52;
    const actualTop = baseline - fontSize * 0.76;
    return {
      width: fallbackWidth,
      actualTop,
      baseline,
      guideTop,
      left: width * 0.5 - fallbackWidth / 2,
      right: width * 0.5 + fallbackWidth / 2,
      meterLeft: Math.max(18, width * 0.5 - fontSize * 0.26 - 26),
      fontSize,
      drawX: width * 0.5,
    };
  }

  context.font = `500 ${fontSize}px ${family}`;
  const measured = context.measureText(glyph);
  const ascent = measured.actualBoundingBoxAscent || fontSize * 0.74;
  const actualLeft = measured.actualBoundingBoxLeft || 0;
  const actualRight = measured.actualBoundingBoxRight || measured.width || fontSize * 0.5;
  const bboxWidth = Math.max(
    actualLeft + actualRight,
    measured.width || fontSize * 0.5
  );
  const centerX = width / 2;
  const drawX = centerX + (actualLeft - actualRight) / 2;
  const actualTop = baseline - ascent;
  const left = drawX - actualLeft;
  const right = drawX + actualRight;

  return {
    width: bboxWidth,
    actualTop,
    baseline,
    guideTop,
    left,
    right,
    meterLeft: Math.max(18, left - 22),
    fontSize,
    drawX,
  };
};

function MeasuredGlyphPane({ label, family, glyph, guideLabel, paneClassName }: MeasuredGlyphPaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

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

  const metrics = useMemo(() => {
    if (!size.width || !size.height) return null;
    return measureGlyph({
      family,
      glyph,
      width: size.width,
      height: size.height,
    });
  }, [family, glyph, size.height, size.width]);

  return (
    <article className={`compare-stage-pane ${paneClassName} compare-stage-pane--measured`}>
      <p className="compare-stage-pane-label">{label}</p>
      <div ref={paneRef} className="compare-stage-pane-measured-shell">
        {metrics ? (
          <svg
            className="compare-stage-pane-measured-svg"
            viewBox={`0 0 ${Math.max(size.width, 1)} ${Math.max(size.height, 1)}`}
            aria-hidden="true"
            preserveAspectRatio="none"
          >
            <line
              className="compare-stage-pane-guide compare-stage-pane-guide--focus"
              x1="20"
              y1={metrics.guideTop}
              x2={size.width - 20}
              y2={metrics.guideTop}
            />
            <line
              className="compare-stage-pane-guide compare-stage-pane-guide--baseline"
              x1="20"
              y1={metrics.baseline}
              x2={size.width - 20}
              y2={metrics.baseline}
            />
            <line
              className="compare-stage-pane-guide compare-stage-pane-guide--meter"
              x1={metrics.meterLeft}
              y1={metrics.guideTop}
              x2={metrics.meterLeft}
              y2={metrics.baseline}
            />
            <line
              className="compare-stage-pane-guide compare-stage-pane-guide--meter-cap"
              x1={metrics.meterLeft - 5}
              y1={metrics.guideTop}
              x2={metrics.meterLeft + 5}
              y2={metrics.guideTop}
            />
            <line
              className="compare-stage-pane-guide compare-stage-pane-guide--meter-cap"
              x1={metrics.meterLeft - 5}
              y1={metrics.baseline}
              x2={metrics.meterLeft + 5}
              y2={metrics.baseline}
            />
            <line
              className="compare-stage-pane-guide compare-stage-pane-guide--width"
              x1={metrics.left}
              y1={metrics.baseline + 26}
              x2={metrics.right}
              y2={metrics.baseline + 26}
            />
            <line
              className="compare-stage-pane-guide compare-stage-pane-guide--width-cap"
              x1={metrics.left}
              y1={metrics.baseline + 20}
              x2={metrics.left}
              y2={metrics.baseline + 32}
            />
            <line
              className="compare-stage-pane-guide compare-stage-pane-guide--width-cap"
              x1={metrics.right}
              y1={metrics.baseline + 20}
              x2={metrics.right}
              y2={metrics.baseline + 32}
            />
            <line
              className="compare-stage-pane-guide compare-stage-pane-guide--actual"
              x1={metrics.left}
              y1={metrics.actualTop}
              x2={metrics.right}
              y2={metrics.actualTop}
            />
            <text className="compare-stage-pane-guide-label" x={size.width - 20} y={metrics.guideTop - 8} textAnchor="end">
              {guideLabel}
            </text>
            <text className="compare-stage-pane-guide-label" x={size.width - 20} y={metrics.baseline - 8} textAnchor="end">
              baseline
            </text>
            <text className="compare-stage-pane-guide-label" x={metrics.meterLeft + 8} y={metrics.actualTop - 8}>
              measured
            </text>
            <text
              className="compare-stage-pane-guide-label"
              x={(metrics.left + metrics.right) / 2}
              y={metrics.baseline + 46}
              textAnchor="middle"
            >
              width / spacing
            </text>
            <text
              x={metrics.drawX}
              y={metrics.baseline}
              textAnchor="middle"
              className="compare-stage-pane-measured-glyph"
              style={{ fontFamily: family, fontSize: `${metrics.fontSize}px` }}
            >
              {glyph}
            </text>
          </svg>
        ) : null}
      </div>
    </article>
  );
}

export default function MeasuredGlyphSplit({ glyph, guideLabel, left, right }: MeasuredGlyphSplitProps) {
  return (
    <div className="compare-stage-split compare-stage-split--measured">
      <MeasuredGlyphPane
        label={left.label}
        family={left.family}
        glyph={glyph}
        guideLabel={guideLabel}
        paneClassName="compare-stage-pane--left"
      />
      <MeasuredGlyphPane
        label={right.label}
        family={right.family}
        glyph={glyph}
        guideLabel={guideLabel}
        paneClassName="compare-stage-pane--right"
      />
    </div>
  );
}
