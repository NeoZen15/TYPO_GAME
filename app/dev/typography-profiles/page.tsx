import { notFound } from "next/navigation";
import TypefaceProfileLab from "@/components/dev/typography/TypefaceProfileLab";
import { isDevRuntime } from "@/lib/dev-mode";
import { DEV_TYPEFACE_FAMILIES } from "@/lib/dev/typography/typeface-profile-dev-builder";
import { getSpecimenFontFaceCss } from "@/lib/typography/specimen-data";

export default function TypographyProfilesPage() {
  if (!isDevRuntime()) {
    notFound();
  }

  const devFontCss = DEV_TYPEFACE_FAMILIES.map((family) => getSpecimenFontFaceCss(family.fontId)).filter(Boolean).join("\n\n");

  return (
    <main className="metrics-validator-page">
      {devFontCss ? <style>{devFontCss}</style> : null}
      <section className="metrics-validator">
        <header className="metrics-validator-header">
          <p className="metrics-validator-kicker">Typeface Profiles</p>
          <h1 className="metrics-validator-title">Aggregate typeface measurement profiles</h1>
          <p className="metrics-validator-copy">
            This board aggregates the current glyph and word audit corpora into a first `TypefaceMeasurementProfile`
            snapshot for each test family. It is intentionally conservative: the goal is to expose the current
            measurement truth as structured font-level data before any batch pipeline or storage layer is added.
          </p>
        </header>

        <TypefaceProfileLab />
      </section>
    </main>
  );
}
