import { notFound } from "next/navigation";
import FallbackCalibrationLab from "@/components/dev/typography/FallbackCalibrationLab";
import { isDevRuntime } from "@/lib/dev-mode";
import { DEV_TYPEFACE_FAMILIES } from "@/lib/dev/typography/typeface-profile-dev-builder";
import { getSpecimenFontFaceCss } from "@/lib/typography/specimen-data";

export default function TypographyFallbackCalibrationPage() {
  if (!isDevRuntime()) {
    notFound();
  }

  const devFontCss = DEV_TYPEFACE_FAMILIES.map((family) => getSpecimenFontFaceCss(family.fontId)).filter(Boolean).join("\n\n");

  return (
    <main className="metrics-validator-page">
      {devFontCss ? <style>{devFontCss}</style> : null}
      <section className="metrics-validator">
        <header className="metrics-validator-header">
          <p className="metrics-validator-kicker">Fallback Calibration</p>
          <h1 className="metrics-validator-title">Browser vs fallback runtime calibration</h1>
          <p className="metrics-validator-copy">
            This board compares direct browser measurements with the current fallback runtime for the dev typeface
            corpus. It helps tune fallback presets with real deltas before we evolve the batch runtime further.
          </p>
        </header>

        <FallbackCalibrationLab />
      </section>
    </main>
  );
}
