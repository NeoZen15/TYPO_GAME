import { notFound } from "next/navigation";
import WordAuditMatrix from "@/components/dev/typography/WordAuditMatrix";
import { isDevRuntime } from "@/lib/dev-mode";

export default function TypographyWordAuditPage() {
  if (!isDevRuntime()) {
    notFound();
  }

  return (
    <main className="metrics-validator-page">
      <section className="metrics-validator">
        <header className="metrics-validator-header">
          <p className="metrics-validator-kicker">Word Audit Matrix</p>
          <h1 className="metrics-validator-title">Measured word overlay stress test</h1>
          <p className="metrics-validator-copy">
            This board validates the current word overlay engine against the canonical word contract: global structure,
            projected geometry, and composition stability inside the compare-stage frame.
          </p>
        </header>

        <WordAuditMatrix />
      </section>
    </main>
  );
}
