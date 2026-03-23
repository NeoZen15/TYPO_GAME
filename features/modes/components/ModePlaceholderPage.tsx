import Link from "next/link";
import InlineMascot from "@/components/ui/InlineMascot";
import ThemeSwitch from "@/components/ui/ThemeSwitch";

type ModePlaceholderPageProps = {
  modeLabel: string;
  description: string;
};

export default function ModePlaceholderPage({
  modeLabel,
  description,
}: ModePlaceholderPageProps) {
  return (
    <main className="mode-placeholder-page">
      <ThemeSwitch />
      <InlineMascot
        className="mode-page-mascot mode-page-mascot--placeholder"
        draggable
      />

      <section className="mode-placeholder-shell" aria-labelledby="mode-placeholder-title">
        <p className="mode-placeholder-kicker">{modeLabel}</p>
        <h1 id="mode-placeholder-title" className="ui-page-title">
          This mode is being prepared
        </h1>
        <p className="ui-page-subtitle">{description}</p>

        <div className="mode-placeholder-actions">
          <Link href="/play" className="mode-placeholder-btn mode-placeholder-btn--solid">
            Back to modes
          </Link>
          <Link href="/game" className="mode-placeholder-btn">
            Open visual reference
          </Link>
        </div>
      </section>
    </main>
  );
}
