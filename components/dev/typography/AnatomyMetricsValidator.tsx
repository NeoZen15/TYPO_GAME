"use client";

import { useMemo } from "react";
import ProjectionCanvas from "@/components/dev/typography/ProjectionCanvas";
import {
  projectSampleToFrame,
  type ProjectionResult,
} from "@/lib/typography/anatomy-metrics";

type StageFrameKey = "comparisonGlyph" | "comparisonWord";
type GuideKey = "capHeight" | "xHeight" | "ascender" | "baseline" | "descender";

type ValidationCase = {
  id: string;
  sample: string;
  frame: StageFrameKey;
  expectation?: {
    topGuide?: GuideKey;
    bottomGuide?: GuideKey;
  };
};

const FONT_CASES = [
  { label: "Helvetica Neue", family: "Helvetica Neue" },
  { label: "Inter", family: "Inter" },
] as const;

const VALIDATION_CASES: ValidationCase[] = [
  { id: "x", sample: "x", frame: "comparisonGlyph", expectation: { topGuide: "xHeight" } },
  { id: "H", sample: "H", frame: "comparisonGlyph", expectation: { topGuide: "capHeight" } },
  { id: "h", sample: "h", frame: "comparisonGlyph", expectation: { topGuide: "ascender" } },
  { id: "p", sample: "p", frame: "comparisonGlyph", expectation: { bottomGuide: "descender" } },
  { id: "X", sample: "X", frame: "comparisonGlyph", expectation: { topGuide: "capHeight" } },
  { id: "A", sample: "A", frame: "comparisonGlyph", expectation: { topGuide: "capHeight" } },
  { id: "minimum", sample: "minimum", frame: "comparisonWord" },
  {
    id: "mix",
    sample: "hpx",
    frame: "comparisonWord",
    expectation: { topGuide: "ascender", bottomGuide: "descender" },
  },
] as const;

const STAGE_SIZES: Record<StageFrameKey, { width: number; height: number }> = {
  comparisonGlyph: { width: 320, height: 240 },
  comparisonWord: { width: 420, height: 240 },
};

const EPSILON_PX = 0.75;

const formatNumber = (value: number) => value.toFixed(2);

const getGuideValue = (projection: ProjectionResult, key: GuideKey) => projection.guides[key];

export default function AnatomyMetricsValidator() {
  const results = useMemo(
    () =>
      FONT_CASES.map((font) => ({
        font,
        cases: VALIDATION_CASES.map((validationCase) => {
          const stageSize = STAGE_SIZES[validationCase.frame];
          const projection = projectSampleToFrame({
            family: font.family,
            sample: validationCase.sample,
            width: stageSize.width,
            height: stageSize.height,
            frame: validationCase.frame,
          });

          const topDelta = validationCase.expectation?.topGuide
            ? projection.debug.placement.top - getGuideValue(projection, validationCase.expectation.topGuide)
            : null;
          const bottomDelta = validationCase.expectation?.bottomGuide
            ? projection.debug.placement.bottom - getGuideValue(projection, validationCase.expectation.bottomGuide)
            : null;
          const passes =
            (topDelta === null || Math.abs(topDelta) <= EPSILON_PX) &&
            (bottomDelta === null || Math.abs(bottomDelta) <= EPSILON_PX);

          return {
            ...validationCase,
            stageSize,
            projection,
            topDelta,
            bottomDelta,
            passes,
          };
        }),
      })),
    []
  );

  return (
    <div className="metrics-validator">
      <header className="metrics-validator-header">
        <p className="metrics-validator-kicker">Projection Validator</p>
        <h1 className="metrics-validator-title">End-to-end typography metrics validation</h1>
        <p className="metrics-validator-copy">
          This board exposes the exact chain used by the compare stage: measure at calibration size, normalize to
          ratios, project into the stage frame, compute scale, then place the final sample. The specimen is rendered in
          canvas with the same baseline used for the metrics, and the debug values below each card are the real numbers
          produced by the shared pipeline.
        </p>
      </header>

      <section className="metrics-validator-fonts">
        {results.map(({ font, cases }) => (
          <article key={font.family} className="metrics-validator-font">
            <div className="metrics-validator-font-head">
              <h2 className="metrics-validator-font-label">{font.label}</h2>
              <p className="metrics-validator-font-family">{font.family}</p>
            </div>

            <div className="metrics-validator-grid">
              {cases.map(({ id, sample, stageSize, projection, passes, topDelta, bottomDelta, expectation }) => (
                <section key={`${font.family}-${id}`} className="metrics-validator-card">
                  <div className="metrics-validator-card-head">
                    <h3 className="metrics-validator-card-title">
                      {sample} · {projection.debug.frame.key}
                    </h3>
                    <span className={`metrics-validator-badge ${passes ? "is-pass" : "is-fail"}`}>
                      {passes ? "aligned" : "drift"}
                    </span>
                  </div>

                  <div
                    className="metrics-validator-stage"
                    style={{ width: `${stageSize.width}px`, height: `${stageSize.height}px` }}
                  >
                    <ProjectionCanvas
                      className="compare-stage-pane-canvas"
                      family={font.family}
                      sample={sample}
                      layout={projection.layout}
                      baseline={projection.guides.baseline}
                      width={stageSize.width}
                      height={stageSize.height}
                    />
                    <svg
                      className="metrics-validator-stage-svg"
                      viewBox={`0 0 ${stageSize.width} ${stageSize.height}`}
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <line className="metrics-validator-guide" x1="12" y1={projection.guides.ascender} x2={stageSize.width - 12} y2={projection.guides.ascender} />
                      <line className="metrics-validator-guide" x1="12" y1={projection.guides.capHeight} x2={stageSize.width - 12} y2={projection.guides.capHeight} />
                      <line className="metrics-validator-guide metrics-validator-guide--primary" x1="12" y1={projection.guides.xHeight} x2={stageSize.width - 12} y2={projection.guides.xHeight} />
                      <line className="metrics-validator-guide metrics-validator-guide--strong" x1="12" y1={projection.guides.baseline} x2={stageSize.width - 12} y2={projection.guides.baseline} />
                      <line className="metrics-validator-guide" x1="12" y1={projection.guides.descender} x2={stageSize.width - 12} y2={projection.guides.descender} />

                      <rect
                        className="metrics-validator-box"
                        x={projection.debug.placement.left}
                        y={projection.debug.placement.top}
                        width={projection.debug.scaledSampleBox.width}
                        height={projection.debug.scaledSampleBox.ascent + projection.debug.scaledSampleBox.descent}
                        rx="8"
                      />

                      <line className="metrics-validator-sample-edge" x1="12" y1={projection.debug.placement.top} x2={stageSize.width - 12} y2={projection.debug.placement.top} />
                      <line className="metrics-validator-sample-edge" x1="12" y1={projection.debug.placement.bottom} x2={stageSize.width - 12} y2={projection.debug.placement.bottom} />

                      <text className="metrics-validator-stage-label" x={stageSize.width - 12} y={projection.guides.capHeight - 8} textAnchor="end">
                        CAP
                      </text>
                      <text className="metrics-validator-stage-label" x={stageSize.width - 12} y={projection.guides.xHeight - 8} textAnchor="end">
                        X
                      </text>
                      <text className="metrics-validator-stage-label" x={stageSize.width - 12} y={projection.guides.baseline - 8} textAnchor="end">
                        BASELINE
                      </text>
                      <text className="metrics-validator-stage-label" x={stageSize.width - 12} y={projection.guides.descender - 8} textAnchor="end">
                        DESC
                      </text>
                    </svg>
                  </div>

                  <div className="metrics-validator-debug">
                    <div className="metrics-validator-debug-group">
                      <p className="metrics-validator-debug-title">Validation</p>
                      <dl className="metrics-validator-debug-list">
                        <div className="metrics-validator-debug-item">
                          <dt>top guide</dt>
                          <dd>{expectation?.topGuide ?? "n/a"}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>top delta px</dt>
                          <dd>{topDelta === null ? "n/a" : formatNumber(topDelta)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>bottom guide</dt>
                          <dd>{expectation?.bottomGuide ?? "n/a"}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>bottom delta px</dt>
                          <dd>{bottomDelta === null ? "n/a" : formatNumber(bottomDelta)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="metrics-validator-debug-group">
                      <p className="metrics-validator-debug-title">Font metrics</p>
                      <dl className="metrics-validator-debug-list">
                        <div className="metrics-validator-debug-item">
                          <dt>capAscent</dt>
                          <dd>{formatNumber(projection.debug.fontMetrics.capAscent)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>xAscent</dt>
                          <dd>{formatNumber(projection.debug.fontMetrics.xAscent)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>ascenderAscent</dt>
                          <dd>{formatNumber(projection.debug.fontMetrics.ascenderAscent)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>descenderDepth</dt>
                          <dd>{formatNumber(projection.debug.fontMetrics.descenderDepth)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="metrics-validator-debug-group">
                      <p className="metrics-validator-debug-title">Visual box</p>
                      <dl className="metrics-validator-debug-list">
                        <div className="metrics-validator-debug-item">
                          <dt>left</dt>
                          <dd>{formatNumber(projection.debug.sampleBox.left)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>right</dt>
                          <dd>{formatNumber(projection.debug.sampleBox.right)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>width</dt>
                          <dd>{formatNumber(projection.debug.sampleBox.width)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>ascent</dt>
                          <dd>{formatNumber(projection.debug.sampleBox.ascent)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>descent</dt>
                          <dd>{formatNumber(projection.debug.sampleBox.descent)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="metrics-validator-debug-group">
                      <p className="metrics-validator-debug-title">Projection</p>
                      <dl className="metrics-validator-debug-list">
                        <div className="metrics-validator-debug-item">
                          <dt>scale width</dt>
                          <dd>{formatNumber(projection.debug.scale.byWidth)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>scale height</dt>
                          <dd>{formatNumber(projection.debug.scale.byHeight)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>scale applied</dt>
                          <dd>{formatNumber(projection.debug.scale.applied)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>drawX</dt>
                          <dd>{formatNumber(projection.debug.placement.drawX)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>baseline</dt>
                          <dd>{formatNumber(projection.debug.placement.baseline)}</dd>
                        </div>
                        <div className="metrics-validator-debug-item">
                          <dt>top / bottom</dt>
                          <dd>
                            {formatNumber(projection.debug.placement.top)} / {formatNumber(projection.debug.placement.bottom)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
