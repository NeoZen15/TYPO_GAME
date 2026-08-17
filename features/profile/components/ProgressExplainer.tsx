import { progressionExplainerCopy } from "@/content/copy";
import { BOARD_SYSTEM_CSS } from "@/features/profile/components/board-system";

// The Path tab finally explains its own map.
//
// Checklist section A, "Page Profil : expliquer comment on monte", and part 3 of
// docs/ui/pages-explication-plan.md, the last of that plan's three blocks still
// open (the mode entrance and the rules page shipped on 2026-07-29).
//
// WHY. The constellation is plugged into the real EyeProfile, so a player reads
// eight galaxies, their steps and three states, and nothing on the page says
// what a galaxy is, what a step is, or what turns one on. The map is the main
// representation of the learner (vision §8), and a map nobody can read is
// decoration.
//
// NO ART DIRECTION IS DECLARED HERE. It composes the shared board system class
// for class: `st` for the board, `st-intro` for the head, `st-prose` for a text
// read in one go (the owner's ruling of 2026-08-15: a document is one centred
// column, never framed panels), `st-panel__title` for the section labels. Zero
// size, colour, radius or weight of its own, so it inherits every later change
// to that system.
//
// It reads NO data, on purpose. The constellation right above it carries the
// player's own state; this block carries the rules of the map. The Dreyfus level
// is never named (I-20: internal command variable of the engine, not a grade),
// and no mastery ladder is printed (I-18).
export default function ProgressExplainer() {
  return (
    <section className="st" aria-labelledby="progress-explainer-title">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />

      <header className="st-intro">
        <span className="st-kicker">{progressionExplainerCopy.kicker}</span>
        <h2 className="st-title" id="progress-explainer-title">
          {progressionExplainerCopy.title}
        </h2>
        <p className="st-lede">{progressionExplainerCopy.lede}</p>
      </header>

      <div className="st-prose">
        <section aria-label={progressionExplainerCopy.groupsTitle}>
          <h3 className="st-panel__title">{progressionExplainerCopy.groupsTitle}</h3>
          <p>{progressionExplainerCopy.groupsBody}</p>
        </section>

        <section aria-label={progressionExplainerCopy.methodTitle}>
          <h3 className="st-panel__title">{progressionExplainerCopy.methodTitle}</h3>
          <p>{progressionExplainerCopy.methodBody}</p>
        </section>

        <section aria-label={progressionExplainerCopy.climbTitle}>
          <h3 className="st-panel__title">{progressionExplainerCopy.climbTitle}</h3>
          <p>{progressionExplainerCopy.climbBody}</p>
        </section>
      </div>
    </section>
  );
}
