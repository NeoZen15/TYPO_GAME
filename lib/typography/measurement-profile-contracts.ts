export type MeasurementScript =
  | "latin"
  | "greek"
  | "cyrillic"
  | "arabic"
  | "devanagari"
  | "thai"
  | "hebrew"
  | "unknown";

export type MetricKey =
  | "baseline"
  | "xHeight"
  | "capHeight"
  | "ascender"
  | "descender"
  | "advanceWidth"
  | "leftInk"
  | "rightInk"
  | "topInk"
  | "bottomInk";

export type WitnessRole =
  | "baseline"
  | "xHeight"
  | "capHeight"
  | "ascender"
  | "descender"
  | "overshootTop"
  | "overshootBottom"
  | "aperture"
  | "terminal"
  | "contrast"
  | "counter";

export type ConfidenceLevel = "low" | "medium" | "high";

export type MetricStatus =
  | "measured"
  | "inferred"
  | "ambiguous"
  | "unsupported"
  | "missing";

export type AuditSeverity =
  | "info"
  | "warning"
  | "minor"
  | "major"
  | "blocking";

export type AuditStatus =
  | "not_run"
  | "pass"
  | "review"
  | "fail";

export type OvershootDirection = "top" | "bottom" | "left" | "right";

export type RenderEnvironment = "browser-canvas" | "browser-svg" | "server-raster" | "unknown";

export type MeasurementProvenanceKind =
  | "browser-derived"
  | "preset-derived"
  | "real-file-derived"
  | "sample-derived";

export type MeasurementPoint = {
  x: number;
  y: number;
};

export type MeasurementBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

export type MeasurementRange = {
  min: number;
  max: number;
};

export type MetricValue = {
  key: MetricKey;
  value: number;
  unit: "px" | "ratio";
  status: MetricStatus;
  confidence: ConfidenceLevel;
  source: "fontMetric" | "inkBounds" | "witnessGlyph" | "wordWitness" | "derived";
  tolerancePx?: number;
  note?: string;
};

export type WitnessMeasurement = {
  glyph: string;
  unicode?: string;
  role: WitnessRole;
  confidence: ConfidenceLevel;
  script: MeasurementScript;
  measuredBounds: MeasurementBounds;
  contactLine: MetricKey;
  contactPosition: number;
  deltaFromMetric: number;
  overshootPx?: number;
  expectedOvershoot: boolean;
  note?: string;
};

export type WitnessSet = {
  role: WitnessRole;
  primaryGlyphs: string[];
  fallbackGlyphs: string[];
  chosenGlyphs: string[];
  confidence: ConfidenceLevel;
  measurements: WitnessMeasurement[];
  rationale: string;
};

export type OvershootMeasurement = {
  glyph: string;
  direction: OvershootDirection;
  amountPx: number;
  expected: boolean;
  confidence: ConfidenceLevel;
  relatedMetric: MetricKey;
  note?: string;
};

export type GlyphMeasurementProfile = {
  glyph: string;
  unicode?: string;
  script: MeasurementScript;
  fontId: string;
  renderContextId: string;
  metrics: Partial<Record<MetricKey, MetricValue>>;
  inkBounds: MeasurementBounds;
  advanceWidthPx: number;
  overshoots: OvershootMeasurement[];
  witnessRoles: WitnessRole[];
  ambiguityFlags: string[];
  confidence: ConfidenceLevel;
  notes: string[];
};

export type WordLetterMeasurement = {
  index: number;
  glyph: string;
  bounds: MeasurementBounds;
  roles: WitnessRole[];
};

export type WordMeasurementProfile = {
  word: string;
  script: MeasurementScript;
  fontId: string;
  renderContextId: string;
  globalBounds: MeasurementBounds;
  metrics: Partial<Record<MetricKey, MetricValue>>;
  witnesses: Partial<Record<WitnessRole, WitnessSet>>;
  letters: WordLetterMeasurement[];
  overshoots: OvershootMeasurement[];
  featureSupport: {
    xHeight: ConfidenceLevel;
    aperture: ConfidenceLevel;
    terminals: ConfidenceLevel;
    contrast: ConfidenceLevel;
  };
  ambiguityFlags: string[];
  confidence: ConfidenceLevel;
  notes: string[];
};

export type AuditIssue = {
  id: string;
  severity: AuditSeverity;
  status: AuditStatus;
  scope: "font" | "glyph" | "word" | "script" | "comparison";
  metric?: MetricKey;
  witnessRole?: WitnessRole;
  glyph?: string;
  word?: string;
  message: string;
  expected?: string;
  observed?: string;
  suggestedAction?: string;
};

export type AuditDimensionScores = {
  structure: number;
  witnessReliability: number;
  overshootHandling: number;
  renderingStability: number;
  pedagogicalReadability: number;
};

export type AuditSummary = {
  status: AuditStatus;
  confidence: ConfidenceLevel;
  score: number;
  dimensions: AuditDimensionScores;
  issueCounts: Record<AuditSeverity, number>;
  issues: AuditIssue[];
  reviewedGlyphCount: number;
  reviewedWordCount: number;
  notes: string[];
};

export type RenderContextProfile = {
  id: string;
  environment: RenderEnvironment;
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  fontSizePx: number;
  fontWeight: number;
  sampleMode: "glyph" | "word" | "text";
  frameKey?: string;
  notes?: string[];
};

export type TypefaceSourceDescriptor = {
  fontId: string;
  familyName: string;
  styleName?: string;
  slug?: string;
  foundry?: string;
  sourcePath?: string;
  axes?: Record<string, number>;
  tags?: string[];
};

export type TypefaceMeasurementProfile = {
  fontId: string;
  familyName: string;
  version: string;
  script: MeasurementScript;
  source: TypefaceSourceDescriptor;
  provenance: {
    kind: MeasurementProvenanceKind;
    runtime: "browser" | "fallback" | "headless";
    metricsFile?: string;
    sourceFile?: string;
    sampleCoverage?: {
      glyphsExtracted: number;
      wordsExtracted: number;
      missingGlyphs: string[];
      missingWords: string[];
    };
    note?: string;
  };
  measurementConventions: {
    fontMetrics: string;
    inkMetrics: string;
    witnessMetrics: string;
  };
  engine: {
    measurementEngineVersion: string;
    generatedAt: string;
    renderContexts: RenderContextProfile[];
  };
  metrics: Partial<Record<MetricKey, MetricValue>>;
  witnesses: Partial<Record<WitnessRole, WitnessSet>>;
  overshoots: OvershootMeasurement[];
  glyphProfiles: Record<string, GlyphMeasurementProfile>;
  wordProfiles: Record<string, WordMeasurementProfile>;
  audit: AuditSummary;
  ambiguityFlags: string[];
  confidence: ConfidenceLevel;
  notes: string[];
};

export type TypefaceComparisonInsight = {
  leftFontId: string;
  rightFontId: string;
  feature: WitnessRole | MetricKey;
  winner: "left" | "right" | "tie" | "ambiguous";
  confidence: ConfidenceLevel;
  summary: string;
  supportingGlyphs: string[];
  supportingWords: string[];
};

export type MeasurementProfileManifest = {
  schemaVersion: string;
  generatedAt: string;
  fontCount: number;
  scripts: MeasurementScript[];
  profileIds: string[];
  notes?: string[];
};
