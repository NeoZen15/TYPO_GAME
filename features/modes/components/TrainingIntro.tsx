import Link from "next/link";
import InlineMascot from "@/components/ui/InlineMascot";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import { trainingIntroCopy } from "@/content/copy";

// Entrance of the Training mode. Static: it explains the mode and hands over to
// /game. No engine call, no data read.
//
// Layout reuses the recipes already in service on the sibling /play pages
// (`.mode-placeholder-*` for the shell and the actions, `.mode-rules-*` for the
// list) so this screen adds no CSS of its own.
export default function TrainingIntro() {
  return (
    <main className="mode-placeholder-page">
      <ThemeSwitch />
      <InlineMascot
        className="mode-page-mascot mode-page-mascot--placeholder"
        draggable
        comment={trainingIntroCopy.mascotComment}
        commentSide="left"
      />

      <section
        className="mode-placeholder-shell"
        aria-labelledby="training-intro-title"
      >
        <p className="mode-placeholder-kicker">{trainingIntroCopy.kicker}</p>
        <h1 id="training-intro-title" className="ui-page-title">
          {trainingIntroCopy.title}
        </h1>
        <p className="ui-page-subtitle">{trainingIntroCopy.subtitle}</p>

        <article className="mode-rules-section">
          <h2 className="mode-rules-section-title">
            {trainingIntroCopy.pointsTitle}
          </h2>
          <ul className="mode-rules-list">
            {trainingIntroCopy.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
            <li>{trainingIntroCopy.progressLine}</li>
          </ul>
        </article>

        <div className="mode-placeholder-actions">
          <Link
            href="/game"
            className="mode-placeholder-btn mode-placeholder-btn--solid"
          >
            {trainingIntroCopy.startLabel}
          </Link>
          <Link href="/play/training/rules" className="mode-placeholder-btn">
            {trainingIntroCopy.rulesLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
