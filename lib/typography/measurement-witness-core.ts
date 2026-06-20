import type { WitnessMeasurement, WitnessRole, WitnessSet } from "@/lib/typography/measurement-profile-contracts";

export type WitnessSetConfig = {
  role: WitnessRole;
  primaryGlyphs: string[];
  fallbackGlyphs?: string[];
  chosenGlyphs: string[];
  measurements: WitnessMeasurement[];
  rationale: string;
};

export const buildWitnessSet = ({
  role,
  primaryGlyphs,
  fallbackGlyphs = [],
  chosenGlyphs,
  measurements,
  rationale,
}: WitnessSetConfig): WitnessSet => ({
  role,
  primaryGlyphs,
  fallbackGlyphs,
  chosenGlyphs,
  confidence: measurements.length ? "high" : "medium",
  measurements,
  rationale,
});
