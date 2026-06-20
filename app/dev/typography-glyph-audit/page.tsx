import { notFound } from "next/navigation";
import GlyphAuditMatrix from "@/components/dev/typography/GlyphAuditMatrix";
import { isDevRuntime } from "@/lib/dev-mode";

export default function TypographyGlyphAuditPage() {
  if (!isDevRuntime()) {
    notFound();
  }

  return (
    <main className="metrics-validator-page">
      <section className="metrics-validator">
        <header className="metrics-validator-header">
          <p className="metrics-validator-kicker">Glyph Audit Matrix</p>
          <h1 className="metrics-validator-title">Measured glyph stress test</h1>
          <p className="metrics-validator-copy">
            This board renders the current measured-glyph engine against a high-risk battery of lowercase, ascender,
            descender, overshoot, counterform, uppercase, and numeric glyphs. It is intended to validate the behavior
            of the actual compare-stage measurement component rather than isolated projection math.
          </p>
        </header>

        <GlyphAuditMatrix />
      </section>
    </main>
  );
}
