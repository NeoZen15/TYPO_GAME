"use client";

import Link from "next/link";
import { useState } from "react";
import InlineMascot from "@/components/ui/InlineMascot";
import ThemeSwitch from "@/components/ui/ThemeSwitch";

type RulesMode = "training" | "competition" | "expert";

type RulesSection = {
  title: string;
  bullets: readonly string[];
};

type RulesContent = {
  label: string;
  subtitle: string;
  mascotComment: string;
  sections: readonly RulesSection[];
};

type ModeRulesPageProps = {
  initialMode: RulesMode;
};

const MODE_ORDER: readonly RulesMode[] = ["training", "competition", "expert"];

const MODE_RULES: Record<RulesMode, RulesContent> = {
  training: {
    label: "Training",
    subtitle: "Visual practice mode based on spaced repetition.",
    mascotComment: "Training mode: your eyes do reps, not your ego.",
    sections: [
      {
        title: "Round format",
        bullets: [
          "One typeface sample is shown at a time.",
          "Four choices are displayed.",
          "You can retry after a wrong click on the same round.",
        ],
      },
      {
        title: "Learning logic",
        bullets: [
          "No visible score in training.",
          "Mastered typefaces return later, confused ones return sooner.",
          "The same session word stays fixed during the session.",
        ],
      },
      {
        title: "Feedback",
        bullets: [
          "Correct answer turns green.",
          "Wrong answer turns red.",
          "Feedback is immediate, then flow continues.",
        ],
      },
      {
        title: "Detailed training rules",
        bullets: [
          "Training has no visible score. The goal is visual stability, not speed.",
          "A typeface has an internal mastery level from 0 to 4.",
          "Level 0 means never seen yet.",
          "Level 1 means seen but recently missed.",
          "Level 2 means recognized once.",
          "Level 3 means recognized twice.",
          "Level 4 means recognized repeatedly without recent errors.",
          "A correct answer increases the internal level by one step.",
          "A wrong answer reduces the internal level by one step.",
          "A missed typeface cannot return immediately after the same question.",
          "Confused typefaces return sooner. Stable ones return later.",
          "The session keeps one fixed display word to avoid reading bias.",
          "New typefaces are introduced progressively to keep cognitive load stable.",
          "Distractors become closer only when recognition is getting stronger.",
          "A just-missed typeface is reintroduced quickly to stabilize recognition.",
          "A repeatedly recognized typeface is delayed to reduce visual noise.",
          "The system favors recurring confusion pairs to train discrimination.",
          "Progress is based on repeated recognition, not a single success.",
          "Mistakes are signals for scheduling, not penalties.",
          "The objective is to improve structural reading of letters over time.",
        ],
      },
    ],
  },
  competition: {
    label: "Competition",
    subtitle: "Fast, comparable round with a strict time limit.",
    mascotComment: "Two minutes. Breathe first, click after.",
    sections: [
      {
        title: "Round format",
        bullets: [
          "Time limit is 2 minutes.",
          "Each question has 4 choices.",
          "The timer starts on the first question.",
        ],
      },
      {
        title: "Scoring",
        bullets: [
          "Correct answer gives 1 point.",
          "Correct answer under 2 seconds gives 2 points.",
          "Wrong answer gives 0 point.",
          "Immediate feedback shows the exact click time.",
        ],
      },
      {
        title: "Progression",
        bullets: [
          "Competition score does not change long-term progression.",
          "Mode is designed for speed and comparability.",
          "Training progression remains isolated.",
        ],
      },
      {
        title: "Detailed competition rules",
        bullets: [
          "Competition mode runs in a strict two-minute session.",
          "The timer starts on the first displayed question.",
          "Each round keeps a four-choice multiple-choice format.",
          "A correct answer grants one point.",
          "A correct answer under two seconds grants two points.",
          "A wrong answer grants zero point.",
          "Immediate feedback shows the exact click time for the submitted answer.",
          "Feedback remains short to preserve pace and comparability.",
          "Long-term training progression is not updated in this mode.",
          "Round selection is optimized for fairness across players.",
          "The focus is speed under visual ambiguity, not pedagogy depth.",
          "Results are intended for session performance, not mastery tracking.",
          "Use this mode when you want pressure and immediate ranking logic.",
        ],
      },
    ],
  },
  expert: {
    label: "Expert",
    subtitle: "No QCM. Direct naming with normalized input.",
    mascotComment: "Expert mode: no safety wheels, only letter structure.",
    sections: [
      {
        title: "Round format",
        bullets: [
          "No multiple choice.",
          "You type the name directly.",
          "Autocomplete may assist input.",
        ],
      },
      {
        title: "Validation",
        bullets: [
          "Case is ignored.",
          "Accents are ignored.",
          "Extra spaces are ignored.",
        ],
      },
      {
        title: "Access",
        bullets: [
          "Expert is a distinct mode, not just harder QCM.",
          "It is intended for advanced recognition.",
          "Only the official typeface name is accepted.",
        ],
      },
      {
        title: "Detailed expert rules",
        bullets: [
          "Expert mode removes multiple-choice assistance entirely.",
          "You must type the expected typeface name directly.",
          "Input is normalized before validation.",
          "Letter case is ignored during comparison.",
          "Accents and diacritics are ignored during comparison.",
          "Extra spaces are ignored during comparison.",
          "Only the official typeface name is accepted as correct.",
          "Autocomplete may help with spelling but not with identification.",
          "Visual similarity between options is no longer externalized.",
          "This mode targets stable recognition of fine structural cues.",
          "Use Expert after consolidating repeated confusion pairs in training.",
          "The objective is precise recall under minimal interface guidance.",
        ],
      },
    ],
  },
};

export default function ModeRulesPage({ initialMode }: ModeRulesPageProps) {
  const [activeMode, setActiveMode] = useState<RulesMode>(initialMode);
  const rules = MODE_RULES[activeMode];

  return (
    <main className="mode-rules-page">
      <ThemeSwitch />
      <InlineMascot
        className="mode-page-mascot mode-page-mascot--rules"
        draggable
        comment={rules.mascotComment}
        commentSide="left"
      />

      <section className="mode-rules-shell" data-mode={activeMode} aria-labelledby="mode-rules-title">
        <header className="mode-rules-header">
          <p className="mode-rules-kicker">{rules.label} rules</p>
          <h1 id="mode-rules-title" className="ui-page-title">
            How this mode works
          </h1>
          <p className="ui-page-subtitle">{rules.subtitle}</p>
        </header>

        <div className="mode-rules-tabs" role="tablist" aria-label="Rules mode tabs">
          {MODE_ORDER.map((mode) => {
            const tab = MODE_RULES[mode];
            const selected = mode === activeMode;
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                className="mode-rules-tab"
                aria-selected={selected}
                aria-controls={`mode-rules-panel-${mode}`}
                id={`mode-rules-tab-${mode}`}
                data-mode={mode}
                data-selected={selected ? "true" : "false"}
                onClick={() => setActiveMode(mode)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          id={`mode-rules-panel-${activeMode}`}
          role="tabpanel"
          aria-labelledby={`mode-rules-tab-${activeMode}`}
          className="mode-rules-content"
        >
          {rules.sections.map((section) => (
            <article key={section.title} className="mode-rules-section">
              <h2 className="mode-rules-section-title">{section.title}</h2>
              <ul className="mode-rules-list">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mode-rules-actions">
          <Link href="/play" className="mode-placeholder-btn mode-placeholder-btn--solid">
            Back to modes
          </Link>
          <Link href={`/play/${activeMode}`} className="mode-placeholder-btn">
            Open {rules.label}
          </Link>
        </div>
      </section>
    </main>
  );
}
