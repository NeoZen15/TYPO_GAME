import type { BoxMeasurement, FontMeasurement, ProjectionResult } from "@/lib/typography/anatomy-metrics";

export type MeasurementContext = CanvasRenderingContext2D | null;

export type TypographyMeasurementRuntime = {
  getMeasureContext(): MeasurementContext;
  createScratchContext(width: number, height: number, willReadFrequently?: boolean): MeasurementContext;
  waitForFontsReady(): Promise<void>;
};

export type TypographyProjectionRuntime = TypographyMeasurementRuntime & {
  measureFontMetrics(family: string, weight?: number): FontMeasurement;
  measureVisualBox(family: string, sample: string, weight?: number): BoxMeasurement;
  measureVisualBoxForFontString(fontString: string, sample: string): BoxMeasurement;
  measureAdvanceWidthForFontString(fontString: string, sample: string): number;
  projectSampleToFrame(args: {
    family: string;
    sample: string;
    width: number;
    height: number;
    frame: "comparisonGlyph" | "comparisonWord" | "testerGlyph";
    weight?: number;
  }): ProjectionResult;
  projectSampleToFrameAfterFontsReady(args: {
    family: string;
    sample: string;
    width: number;
    height: number;
    frame: "comparisonGlyph" | "comparisonWord" | "testerGlyph";
    weight?: number;
  }): Promise<ProjectionResult>;
};
