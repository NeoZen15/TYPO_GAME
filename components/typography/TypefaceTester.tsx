"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buildGlyphOverlayModel, measureGlyph } from "@/lib/typography/glyph-overlay-engine";

type TypefaceAxis = {
  tag: string;
  name?: string | null;
  min: number;
  default: number;
  max: number;
};

type TypefaceTesterProps = {
  availableWeights: number[];
  axes: TypefaceAxis[];
  fontFamily: string;
  glyphGroups: Array<{
    id: string;
    label: string;
    chars: string[];
  }>;
  initialText: string;
};

const QUICK_FONT_SIZES = [32, 48, 64] as const;
const QUICK_LINE_HEIGHTS = [1, 1.2, 1.4] as const;
const ALIGNMENT_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
] as const;

const getCleanWeightStops = (availableWeights: number[], weightAxis: TypefaceAxis | null) => {
  const cleanStops = [300, 400, 500, 700];
  const source = availableWeights.length > 1 ? availableWeights : cleanStops;

  return [...new Set(source)]
    .filter((value) => (weightAxis ? value >= weightAxis.min && value <= weightAxis.max : true))
    .sort((left, right) => left - right);
};

export default function TypefaceTester({
  availableWeights,
  axes,
  fontFamily,
  glyphGroups,
  initialText,
}: TypefaceTesterProps) {
  const textId = useId();
  const sizeId = useId();
  const lineHeightId = useId();
  const weightAxis = axes.find((axis) => axis.tag === "wght") ?? null;
  const weightOptions = useMemo(() => (availableWeights.length > 0 ? availableWeights : [400]), [availableWeights]);

  const [text, setText] = useState(initialText);
  const [fontSize, setFontSize] = useState(51);
  const [lineHeight, setLineHeight] = useState(1.34);
  const [alignment, setAlignment] = useState<"left" | "center" | "right">("left");
  const [weight, setWeight] = useState(
    weightOptions.includes(400) ? 400 : weightAxis ? weightAxis.default : weightOptions[0]
  );
  const cleanWeightStops = useMemo(() => getCleanWeightStops(weightOptions, weightAxis), [weightAxis, weightOptions]);
  const availableGlyphs = useMemo(() => glyphGroups.flatMap((group) => group.chars), [glyphGroups]);
  const [selectedGlyph, setSelectedGlyph] = useState(availableGlyphs[0] ?? "A");
  const textCharacterCount = text.length;
  const textLineCount = text.length > 0 ? text.split(/\r?\n/).length : 1;
  const wordCount = text.trim().length > 0 ? text.trim().split(/\s+/).length : 0;
  const glyphCodepoint = selectedGlyph.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0") ?? "0000";
  const glyphCanvasRef = useRef<HTMLCanvasElement>(null);
  const glyphCanvasWrapRef = useRef<HTMLDivElement>(null);
  const [glyphLabSize, setGlyphLabSize] = useState({ width: 0, height: 0 });
  const [glyphLabOverlay, setGlyphLabOverlay] = useState<{
    metrics: Awaited<ReturnType<typeof measureGlyph>>;
    guideLines: ReturnType<typeof buildGlyphOverlayModel>["guideLines"];
  } | null>(null);
  const glyphGuides = useMemo(() => {
    if (!glyphLabOverlay || glyphLabSize.height <= 0) return [];

    return glyphLabOverlay.guideLines.map((guide) => ({
      id: guide.key,
      label: guide.label[0] + guide.label.slice(1).toLowerCase(),
      topPercent: (guide.y / glyphLabSize.height) * 100,
    }));
  }, [glyphLabOverlay, glyphLabSize.height]);

  const previewStyle = {
    fontFamily,
    fontSize: `${fontSize}px`,
    lineHeight,
    textAlign: alignment,
    fontVariationSettings: weightAxis ? `"wght" ${weight}` : undefined,
    fontWeight: weightAxis ? undefined : weight,
  } as const;
  const editorStyle = {
    ...previewStyle,
    "--editor-baseline-step": `${fontSize * lineHeight}px`,
    "--editor-text-inset": "1rem",
    "--editor-panel-min-height": `${Math.max(fontSize * lineHeight * 3.5 + 24, 184)}px`,
  } as React.CSSProperties;

  useEffect(() => {
    const wrap = glyphCanvasWrapRef.current;
    if (!wrap) return;

    const updateSize = () => {
      const rect = wrap.getBoundingClientRect();
      setGlyphLabSize({
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      });
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(wrap);
    updateSize();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runMeasurement = async () => {
      if (!glyphLabSize.width || !glyphLabSize.height) {
        setGlyphLabOverlay(null);
        return;
      }

      const metrics = await measureGlyph({
        family: fontFamily,
        glyph: selectedGlyph,
        width: glyphLabSize.width,
        height: glyphLabSize.height,
        weight,
      });
      const overlay = buildGlyphOverlayModel(selectedGlyph, metrics, glyphLabSize);

      if (!cancelled) {
        setGlyphLabOverlay({
          metrics,
          guideLines: overlay.guideLines,
        });
      }
    };

    runMeasurement().catch(() => {
      if (!cancelled) {
        setGlyphLabOverlay(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fontFamily, glyphLabSize, selectedGlyph, weight]);

  useEffect(() => {
    const canvas = glyphCanvasRef.current;
    const metrics = glyphLabOverlay?.metrics;
    if (!canvas || !metrics) return;

    const width = Math.max(glyphLabSize.width, 1);
    const height = Math.max(glyphLabSize.height, 1);
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.font = `${weight} ${metrics.fontSize}px ${fontFamily}`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(selectedGlyph, metrics.drawX, metrics.baseline);
  }, [fontFamily, glyphLabOverlay, glyphLabSize.height, glyphLabSize.width, selectedGlyph, weight]);

  return (
    <div className="typo-tester">
      <div className="typo-tester-controls">
        <div className="typo-tester-field typo-tester-field--text typo-tester-field--text-wide">
          <div className="typo-tester-editor">
            <div className="typo-tester-editor-head">
              <div className="typo-tester-editor-heading">
                <label htmlFor={textId} className="typo-demo-label">
                  Test text
                </label>
                <p className="typo-tester-editor-copy">
                  Type or replace the sample text, then adjust size, line height, weight and alignment to inspect the
                  typography directly in the field.
                </p>
              </div>
              <dl className="typo-tester-editor-stats" aria-label="Text sample metrics">
                <div className="typo-tester-editor-stat">
                  <dt>Chars</dt>
                  <dd>{textCharacterCount}</dd>
                </div>
                <div className="typo-tester-editor-stat">
                  <dt>Lines</dt>
                  <dd>{textLineCount}</dd>
                </div>
                <div className="typo-tester-editor-stat">
                  <dt>Words</dt>
                  <dd>{wordCount}</dd>
                </div>
                <div className="typo-tester-editor-stat">
                  <dt>Size</dt>
                  <dd>{fontSize}px</dd>
                </div>
                <div className="typo-tester-editor-stat">
                  <dt>Leading</dt>
                  <dd>{lineHeight.toFixed(2)}</dd>
                </div>
              </dl>
            </div>
            <div className="typo-tester-editor-body" style={editorStyle}>
              <textarea
                id={textId}
                className="typo-tester-textarea typo-tester-textarea--editor"
                value={text}
                onChange={(event) => setText(event.target.value)}
                spellCheck={false}
                placeholder="Type your own text here to test the typeface."
                style={previewStyle}
              />
            </div>
          </div>
        </div>

        <div className="typo-tester-toolbar">
          <div className="typo-tester-field typo-tester-field--compact">
            <div className="typo-tester-field-head">
              <label htmlFor={sizeId} className="typo-demo-label">
                Size
              </label>
              <span className="typo-tester-field-value">{fontSize}px</span>
            </div>
            <div className="typo-tester-chip-list">
              {QUICK_FONT_SIZES.map((option) => (
                <button
                  key={`font-size-${option}`}
                  type="button"
                  className={`typo-tester-chip ${option === fontSize ? "is-active" : ""}`}
                  onClick={() => setFontSize(option)}
                >
                  {option}px
                </button>
              ))}
            </div>
            <input
              id={sizeId}
              className="typo-tester-range"
              type="range"
              min="24"
              max="144"
              step="1"
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
            />
          </div>

          <div className="typo-tester-field typo-tester-field--compact">
            <div className="typo-tester-field-head">
              <label htmlFor={lineHeightId} className="typo-demo-label">
                Leading
              </label>
              <span className="typo-tester-field-value">{lineHeight.toFixed(2)}</span>
            </div>
            <div className="typo-tester-chip-list">
              {QUICK_LINE_HEIGHTS.map((option) => (
                <button
                  key={`leading-${option}`}
                  type="button"
                  className={`typo-tester-chip ${option === lineHeight ? "is-active" : ""}`}
                  onClick={() => setLineHeight(option)}
                >
                  {option.toFixed(2)}
                </button>
              ))}
            </div>
            <input
              id={lineHeightId}
              className="typo-tester-range"
              type="range"
              min="0.8"
              max="1.6"
              step="0.01"
              value={lineHeight}
              onChange={(event) => setLineHeight(Number(event.target.value))}
            />
          </div>

          <div className="typo-tester-field typo-tester-field--compact">
            <div className="typo-tester-field-head">
              <p className="typo-demo-label">Alignment</p>
              <span className="typo-tester-field-value">{alignment}</span>
            </div>
            <div className="typo-tester-chip-list">
              {ALIGNMENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`typo-tester-chip ${option.value === alignment ? "is-active" : ""}`}
                  onClick={() => setAlignment(option.value)}
                  aria-pressed={option.value === alignment}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="typo-tester-field typo-tester-field--compact typo-tester-field--weight">
            <div className="typo-tester-field-head">
              <p className="typo-demo-label">Text weight</p>
              <span className="typo-tester-field-value">{Math.round(weight)}</span>
            </div>
            <div className="typo-tester-weight-list">
              {cleanWeightStops.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`typo-tester-weight-button ${option === weight ? "is-active" : ""}`}
                  onClick={() => setWeight(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            {weightAxis ? (
              <input
                className="typo-tester-range"
                type="range"
                min={weightAxis.min}
                max={weightAxis.max}
                step="1"
                value={weight}
                onChange={(event) => setWeight(Number(event.target.value))}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="typo-tester-body typo-glyph-lab">
        <div className="typo-glyph-lab-focus">
          <div className="typo-glyph-lab-meta">
            <div className="typo-glyph-lab-meta-main">
              <p className="typo-demo-label">Glyph lab</p>
              <p className="typo-glyph-lab-name">{selectedGlyph}</p>
            </div>
            <p className="typo-glyph-caption">U+{glyphCodepoint}</p>
          </div>
          <div className="typo-glyph-canvas" ref={glyphCanvasWrapRef}>
            {glyphGuides.map((guide) => (
              <div key={guide.id} className="typo-glyph-guide" style={{ top: `${guide.topPercent}%` }}>
                <span>{guide.label}</span>
              </div>
            ))}
            <canvas ref={glyphCanvasRef} className="typo-glyph-canvas-element" aria-label={`Glyph preview for ${selectedGlyph}`} />
          </div>

        </div>
        {availableGlyphs.length > 0 ? (
          <div className="typo-glyph-panel">
            <div className="typo-glyph-panel-head">
              <p className="typo-demo-label">Glyph matrix</p>
              <p className="typo-glyph-caption">{availableGlyphs.length} visible characters</p>
            </div>
            <div className="typo-glyph-grid typo-glyph-grid--matrix">
              {availableGlyphs.map((char) => (
                <button
                  key={`matrix-${char}`}
                  type="button"
                  className={`typo-glyph-button typo-glyph-button--matrix ${selectedGlyph === char ? "is-active" : ""}`}
                  onClick={() => setSelectedGlyph(char)}
                  style={{ fontFamily }}
                  aria-pressed={selectedGlyph === char}
                  aria-label={`Preview glyph ${char}`}
                >
                  {char}
                </button>
              ))}
            </div>
            <div className="typo-glyph-groups">
              {glyphGroups.map((group) => (
                <div key={group.id} className="typo-glyph-group">
                  <p className="typo-demo-label">{group.label}</p>
                  <p className="typo-glyph-group-sample" style={{ fontFamily }}>
                    {group.chars.join(" ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
}
