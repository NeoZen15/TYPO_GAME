"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import StarField from "@/features/profile/components/StarField";
import { trainingModeCopy } from "@/content/copy";

type RulesMode = "training" | "competition" | "expert";

type RulesRow = {
  label: string;
  help?: string;
  /* Right-hand figure when the rule has one. Real engine values only. */
  value?: string;
  /* 0 to 1. Draws the scale bar, width proportional to the real value. */
  bar?: number;
};

/* One rung of the mastery ladder: the level, what it means, how long before the
   face returns, and how wide that window is relative to the longest one. */
type RulesStep = {
  level: string;
  name: string;
  window: string;
  bar: number;
};

/* One move on the mastery ladder, drawn: where the face sits before, where it
   lands after. from === to means it holds. */
type RulesMove = {
  label: string;
  help: string;
  value: string;
  from: number;
  to: number;
};

/* The round, drawn as the screen the player actually meets: the sample word, the
   four names with the right one marked, and the rotation of the word. */

/* One axis on which competition differs from training, with both sides shown. */
type RulesCompare = {
  axis: string;
  training: string;
  competition: string;
  /* Which drawing carries this axis. Each one is the honest picture of its own
     quantity: a field of dots for a ratio, a line for a duration, the rung track
     for a movement. */
  kind: "dots" | "span" | "move";
};

type RulesSection = {
  title: string;
  /* Renders the training-against-competition comparison. */
  compare?: readonly RulesCompare[];
  /* How to read the drawing. A diagram without its convention is a decoration. */
  caption?: string;
  /* Renders the move diagram instead of rows. */
  moves?: readonly RulesMove[];
  /* Renders the ladder graphic instead of rows. */
  steps?: readonly RulesStep[];
  /* Sentences, not label-and-value pairs: rendered at lede scale. */
  statements?: readonly string[];
  /* Spans both columns: for the one panel whose shape carries meaning. */
  wide?: boolean;
  /* Dashed pill in the panel head, the profile's "NO SIGN-IN YET" device. */
  note?: string;
  /* Closing mono line under the content, the stats panels' __meta. */
  meta?: string;
  rows: readonly RulesRow[];
};

/* The stats board's "YOUR EYE" card: a hero figure with its mono label, the
   content beside it, then a divider and a footer of two small values. Optional,
   because a mode without an honest defining figure must not fake one. */
type RulesHero = {
  figure: string;
  figureLabel: string;
  name: string;
  line: string;
  /* Closing line, so the card fills the height it is stretched to. */
  meta: string;
  /* Draws a depleting track under the figure: for a mode whose defining resource
     is time running out, a static number says the wrong thing. */
  drains?: boolean;
  /* Facts that belong to the signature card rather than to a rules panel. */
  rows?: readonly RulesRow[];
  stats: readonly { value: string; label: string }[];
};

/* What the player came for: what moves them forward, what sets them back. It sits
   above everything because it is the question a rules page is opened to answer. */
type RulesStakes = {
  up: readonly { cause: string; effect: string }[];
  down: readonly { cause: string; effect: string }[];
};

type RulesTile = {
  value: string;
  label: string;
  help: string;
};

type RulesContent = {
  label: string;
  /* Mono caps eyebrow, the profile's "YOUR PROFILE" / "YOUR RHYTHM" slot. */
  kicker: string;
  /* Every profile tab titles itself with a short sentence that ends in a period. */
  title: string;
  subtitle: string;
  /* Mono footnote closing the page, like the achievements board's. */
  foot: string;
  /* Headline figures, the profile's stat-tile device. Empty when the mode has no
     honest number to show (Expert does not exist yet). */
  stakes: RulesStakes;
  hero?: RulesHero;
  tiles: readonly RulesTile[];
  sections: readonly RulesSection[];
};

type ModeRulesPageProps = {
  initialMode: RulesMode;
  /* The player's own figures, read server side from the guest cookie. Null for a
     visitor who has never played: the page then says so rather than showing a
     number that belongs to nobody. */
  progress: {
    eyeLevel: number;
    facesMastered: number;
    poolSize: number;
  } | null;
};

const MODE_ORDER: readonly RulesMode[] = ["training", "competition", "expert"];

// Rebuilt on the two references the owner named: the landing and /profile.
//
// Three structural changes, each one fixing a defect of the previous version.
//
// 1. THE PAGE SCROLLS. It was locked to `height: 100svh` with the rules confined
//    to a `height: min(52svh, 26rem)` panel scrolling inside it, which cut a
//    section title in half while black space sat below the shell. The profile is a
//    normally scrolling page and it is the reference, so the rules follow it: the
//    content decides the height, nothing is clipped.
// 2. THE TABS MOVED INTO THE STICKY HEADER, like the profile's section nav. They
//    stay reachable while reading instead of scrolling away with the title, which
//    is what you want when comparing two modes.
// 3. THE TABS ARE LINKS, NOT STATE. The three /play/{mode}/rules routes already
//    exist; switching tabs now navigates, so a URL is shareable, the back button
//    works, and `initialMode` is the single source of truth (no client state left,
//    so this is a server component again).
//
// Every value in the stylesheet is copied from the profile, not chosen here.
const MODE_RULES: Record<RulesMode, RulesContent> = {
  training: {
    label: "Training",
    kicker: "The training mode",
    title: "Your eye, on a schedule.",
    subtitle: "No score, no clock. The engine decides when each typeface comes back.",
    foot: "Every figure on this page is read from the engine, not written by hand.",
    hero: {
      figure: "30",
      figureLabel: "Faces",
      name: "Your active set",
      line: "Drawn from the 1136 faces that can actually be played, and it widens as your level rises.",
      meta: "A new face joins once three others have reached stable, one at a time, and the set widens as your level rises.",
      stats: [
        { value: "4", label: "choices" },
        { value: "5", label: "questions per word" },
      ],
    },
    stakes: {
      up: [
        { cause: "You get it right first try", effect: "the face climbs a rung and waits longer before coming back" },
        { cause: "Three faces reach stable", effect: "a new typeface joins your set" },
        { cause: "Three right in a row on one face", effect: "it drifts up to twice as far away" },
      ],
      down: [
        { cause: "You miss", effect: "the face drops a rung and comes back much sooner" },
        { cause: "You miss it twice in a row", effect: "it comes back up to twice as soon" },
        { cause: "You retry, or click around", effect: "nothing at all, it is free" },
      ],
    },
    tiles: [
      { value: "4", label: "Choices", help: "one right, three close" },
      { value: "1-3", label: "Questions", help: "before a missed face returns" },
      { value: "80-150", label: "Questions", help: "before a stable one returns" },
      { value: "1136", label: "Faces", help: "playable, of 1172 in the catalogue" },
    ],
    sections: [
      {
        title: "A session",
        rows: [
          { label: "How long", help: "It lasts as long as you want it to.", value: "No limit" },
          { label: "How it ends", help: "You stop, and you get a summary of what you just did.", value: "Your call" },
          { label: "If you stop", help: "Progression resumes where you left it, tomorrow or in a month.", value: "Closes nothing" },
        ],
      },
      {
        title: "How a face moves",
        wide: true,
        caption: "Every face you train sits on one of five levels, from never seen on the left to stable on the right. Each little track is those five: the ring is where the face sat, the filled dot is where your answer puts it.",
        meta: "Only the first answer on a round is graded, and the adjustment can never break the floors above.",
        // Drawn rather than listed: each rule is one move on the five-rung ladder,
        // which is the whole mechanic in one glance. Levels shown are examples; the
        // rule applies from wherever the face currently sits. Source: I-03, I-04,
        // I-14 in submitTrainingAnswer.
        moves: [
          {
            label: "Right, first try",
            help: "The face climbs one rung.",
            value: "+1",
            from: 2,
            to: 3,
          },
          {
            label: "A miss",
            help: "It drops one rung, and comes back much sooner.",
            value: "-1",
            from: 3,
            to: 2,
          },
          {
            label: "A miss when stable",
            help: "It falls to solid and no further, never back to the start.",
            value: "4 to 3",
            from: 4,
            to: 3,
          },
          {
            label: "Right after a miss",
            help: "The question was already spent, so the rung holds.",
            value: "0",
            from: 2,
            to: 2,
          },
          {
            label: "Extra wrong clicks",
            help: "Clicking around after the first answer costs nothing.",
            value: "0",
            from: 2,
            to: 2,
          },
          {
            label: "The ceiling",
            help: "Stable is as high as a single face goes.",
            value: "4",
            from: 4,
            to: 4,
          },
        ],
        // The speed rules used to be a panel of their own. They answer the same
        // question as the moves ("what did my answer just do?"), so they sit under
        // the diagram instead of beside it.
        rows: [
          {
            label: "Two misses in a row",
            help: "On the same face in one session, it starts coming back sooner than its level says.",
            value: "Up to 2x sooner",
          },
          {
            label: "Three right in a row",
            help: "It earns more room and drifts towards the far end of its window.",
            value: "Up to 2x further",
          },
          {
            label: "Floor after a miss",
            help: "Never the very next question, whatever the adjustment.",
            value: "2 questions",
          },
          {
            label: "Floor after a hit",
            help: "A face you just recognised always gets some distance.",
            value: "5 questions",
          },
          {
            label: "The wrong choices",
            help: "They close in on the right one as the level rises, so the same face gets harder to pick out.",
          },
        ],
      },
      {
        title: "The ladder",
        note: "Spaced repetition",
        caption: "The same five levels, named, with what each one costs you in waiting. The bar is how long that face stays away before it comes back, drawn to scale.",
        wide: true,
        meta: "Every face you train sits on one of these five rungs, and moves one rung at a time.",
        // Bars are the real window midpoints (2, 4.5, 17.5, 37.5, 115 questions)
        // normalised on the longest, so the exponential shape IS the data.
        // Source: INTERVAL_WINDOW in the training provider.
        steps: [
          { level: "0", name: "Just missed", window: "1-3", bar: 2 / 115 },
          { level: "1", name: "Starting to hold", window: "3-6", bar: 4.5 / 115 },
          { level: "2", name: "Recognised", window: "10-25", bar: 17.5 / 115 },
          { level: "3", name: "Solid", window: "25-50", bar: 37.5 / 115 },
          { level: "4", name: "Stable", window: "80-150", bar: 1 },
        ],
        rows: [],
      },
      {
        title: "How the wrong names are picked",
        meta: "A face is never removed from your set. Only the wait before it returns changes.",
        rows: [
          {
            label: "Never at random",
            help: "The three wrong names are chosen from faces that look like the right one.",
            value: "3",
          },
          {
            label: "Same family first",
            help: "Faces sharing the category, and above all the visual cluster, are preferred.",
          },
          {
            label: "Closer as you climb",
            help: "The pull towards look-alikes roughly doubles between the first rungs and the last.",
            value: "About 2x",
          },
          {
            label: "You are never stuck",
            help: "If every face in your set is still cooling down, a new one is quietly brought in rather than breaking the wait.",
            value: "0 dead ends",
          },
        ],
      },
      {
        // Title and statements both come from content/copy.ts. The title used to
        // be hardcoded here while the identical sentence also sat in the copy
        // block, which is the drift this page is supposed to end: since the
        // static entrance was retired on 2026-08-15, this page is the only place
        // that states what Training is, so it states it from one source.
        title: trainingModeCopy.pointsTitle,
        statements: trainingModeCopy.points,
        rows: [],
      },
    ],
  },
  competition: {
    label: "Competition",
    kicker: "The competition mode",
    title: "Two minutes, nothing else.",
    subtitle: "Speed and comparison. It reads your eye, it never moves it.",
    foot: "Ranked play and your training progression are two separate things.",
    hero: {
      figure: "2:00",
      figureLabel: "Then it stops",
      name: "The clock",
      drains: true,
      line: "It starts the moment the round opens, before you have read anything, and it never pauses. Feedback time is your time.",
      // The catalogue fact moved to the comparison block, which draws it. What is
      // left here is the part nothing else on the page says: the round ends on the
      // clock, not on a number of questions, so there is no finish line to reach.
      meta: "The round ends on time, never on a question count. How many you answer is up to how fast you read.",
      // Verified: the deadline is started_at + 2 min, compared against the server
      // clock on every answer. Nothing about it lives in the browser.
      rows: [
        {
          label: "Where the clock lives",
          help: "On the server. Closing the tab or switching away pauses nothing, and coming back at 2:01 shows a finished round.",
          value: "Server",
        },
        {
          label: "What ends it",
          help: "Time, and only time. There is no score to reach and no last question.",
          value: "2:00",
        },
      ],
      stats: [
        { value: "0", label: "pauses" },
        { value: "0", label: "questions required" },
      ],
    },
    stakes: {
      up: [
        { cause: "A correct answer", effect: "1 point" },
        { cause: "A correct answer under two seconds", effect: "2 points" },
      ],
      down: [
        { cause: "A wrong answer", effect: "0, and the question closes on the spot" },
        { cause: "You take more than two seconds", effect: "1 point instead of 2" },
        { cause: "You answer after 2:00", effect: "nothing counts, the round is already over" },
      ],
    },
    tiles: [
      { value: "2:00", label: "Round", help: "fixed, from the moment it opens" },
      { value: "1", label: "Point", help: "per correct answer" },
      { value: "2", label: "Points", help: "under two seconds" },
      { value: "0", label: "Effect", help: "on your training progression" },
    ],
    sections: [
      {
        title: "The round",
        meta: "The catalogue is filtered the same way for everyone: licence cleared, Latin letters present, font file ready to render.",
        // Three rules verified in the competition provider and stated nowhere until
        // now: an answer past the deadline finalises the round instead of scoring,
        // a second answer on the same question is refused server side, and a face is
        // only served if its file is actually ready.
        rows: [
          { label: "How long", help: "The clock starts as soon as the round opens.", value: "2:00" },
          { label: "What you see", help: "The same four-name format as training.", value: "4" },
          {
            label: "If you miss",
            help: "Nothing. One answer per question, then the next one.",
            value: "None",
          },
          {
            label: "Answering too late",
            help: "Past two minutes your click no longer scores. The round closes on the spot and shows your result.",
            value: "0",
          },
          {
            label: "Answering twice",
            help: "Refused by the server, not just hidden by the screen. One question, one answer.",
            value: "Refused",
          },
        ],
      },
      {
        title: "What makes it competition",
        wide: true,
        caption: "Three differences, and the first one is the reason a score means anything: everyone answers on the same catalogue, not on their own set.",
        // Verified in the two providers: training selects FROM user_typeface_state
        // (your pool only), competition selects FROM typefaces_core and only joins
        // your state to calibrate distractors. It reads your mastery, never writes it.
        compare: [
          {
            axis: "Faces it can draw",
            training: "Your 30",
            competition: "All 1136",
            kind: "dots",
          },
          {
            axis: "How long",
            training: "No limit, you stop",
            competition: "2:00, then it stops",
            kind: "span",
          },
          {
            axis: "What it moves",
            training: "Your mastery, one rung",
            competition: "Nothing at all",
            kind: "move",
          },
        ],
        rows: [],
      },
      {
        title: "Scoring",
        rows: [
          { label: "A correct answer", value: "1 point" },
          { label: "Under two seconds", value: "2 points" },
          { label: "A wrong answer", value: "0" },
          { label: "After each answer", help: "Your exact click time is shown after each answer." },
        ],
      },
      {
        title: "What it does to your progression",
        rows: [
          { label: "On your progression", help: "Competition never moves your training progression.", value: "0" },
          { label: "What it reads", help: "Your mastery picks believable wrong answers, and nothing is written back." },
        ],
      },
    ],
  },
  expert: {
    label: "Expert",
    kicker: "The expert mode",
    title: "Name it, no options.",
    subtitle: "Recall instead of recognition. Not playable yet, and the reason is not code.",
    foot: "Training and Competition are the two modes you can play today.",
    // Measured in content/catalog/expert-answer-keys.json and typefaces-core.json:
    // 2032 keys written, qa_status 2004 review / 23 draft / 5 approved, and exactly
    // 5 faces carry expert_enabled. The gate is editorial review, not engineering.
    stakes: {
      up: [
        { cause: "You type the official name", effect: "it counts, spelled from memory instead of picked from four" },
        { cause: "You get the case, accents or spacing wrong", effect: "nothing, all three are dropped before anything is compared" },
      ],
      down: [
        { cause: "You type a synonym, even a fair one", effect: "refused, no validated alias table exists yet" },
        { cause: "A face whose key nobody approved", effect: "never asked, 5 of 2032 have been cleared so far" },
        { cause: "The mode is not open", effect: "so none of this moves points or mastery yet" },
      ],
    },
    tiles: [
      { value: "2032", label: "Answer keys", help: "written, one per face" },
      { value: "5", label: "Approved", help: "cleared by a human so far" },
      { value: "0", label: "Synonyms", help: "no accepted alias yet" },
      { value: "1", label: "Field", help: "instead of four names" },
    ],
    sections: [
      {
        title: "Why it is not open",
        note: "Not playable yet",
        meta: "Nothing here waits on engineering. It waits on someone reading 2032 names and saying yes.",
        rows: [
          {
            label: "The keys exist",
            help: "Every face already carries its official name and its normalised form.",
            value: "2032",
          },
          {
            label: "Almost none approved",
            help: "They were catalogued automatically from the Google Fonts snapshot, so each still needs a human pass.",
            value: "5 of 2032",
          },
          {
            label: "Faces cleared",
            help: "Exactly the five whose key was approved. The catalogue gates the mode face by face.",
            value: "5",
          },
          {
            label: "No aliases yet",
            help: "Only the official name would pass. A validated synonym table has still to be written.",
            value: "0",
          },
        ],
      },
      {
        title: "What it will be",
        rows: [
          {
            label: "You type, you do not pick",
            help: "One field instead of four names. Recall, not recognition.",
            value: "1 field",
          },
          {
            label: "Forgiving on form",
            help: "Case, accents and extra spaces are dropped before anything is compared.",
          },
          {
            label: "Strict on substance",
            help: "The official name, or a synonym someone has validated. Never a free alias.",
          },
          {
            label: "Meant for later",
            help: "After you have consolidated the pairs that keep confusing you.",
          },
        ],
      },
    ],
  },
};


/* The three drawings of the comparison. Each is the honest picture of its own
 * quantity: a field of dots for a ratio, a line for a duration, the rung track
 * for a movement. */
function VsFigure({ kind, side }: { kind: "dots" | "span" | "move"; side: "training" | "competition" }) {
  const mine = side === "competition";

  if (kind === "dots") {
    return (
      <span className="pb-field" aria-hidden="true">
        {Array.from({ length: 38 }, (_, i) => (
          <span key={i} className={`pb-field__dot${mine || i === 18 ? " is-on" : ""}`} />
        ))}
      </span>
    );
  }

  if (kind === "span") {
    return (
      <span className={`pb-span${mine ? " is-bounded" : ""}`} aria-hidden="true">
        <span className="pb-span__line" />
      </span>
    );
  }

  return (
    <span className="pb-vs__track" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((slot) => (
        <span
          key={slot}
          className={"pb-dot" + (!mine && slot === 2 ? " is-from" : "") + (!mine && slot === 3 ? " is-to" : "")}
        />
      ))}
    </span>
  );
}


export default function ModeRulesPage({ initialMode, progress }: ModeRulesPageProps) {

  // ONE page, clicked inside. Decided 2026-07-29, built 2026-07-30.
  //
  // The three /play/{mode}/rules routes stay as deep links, so nothing that points
  // at them breaks (the /play cards, the expert placeholder) and a URL is still
  // shareable per mode. But clicking a mode no longer NAVIGATES: it switches the
  // panel in place, and the address bar is corrected with history.replaceState.
  //
  // replaceState rather than a router push on purpose: switching mode is not a
  // journey step, so it must not stack history entries. The back button returns
  // where the reader came from instead of walking back through three tabs.
  const [mode, setMode] = useState<RulesMode>(initialMode);
  const rules = MODE_RULES[mode];

  // Where the player stands, in their own figures. The static hero says what a new
  // set looks like; once someone has played, their real pool and their real number
  // of stabilised faces replace it. A rules page is opened to answer this.
  const hero =
    mode === "training" && progress
      ? {
          ...rules.hero!,
          figure: String(progress.poolSize),
          figureLabel: "Faces in your set",
          line: `${progress.facesMastered} of them are stable. Your set is drawn from the 1136 faces that can be played, and widens as your level rises.`,
          stats: [
            { value: String(progress.facesMastered), label: "stable" },
            { value: String(progress.eyeLevel), label: "eye level" },
          ],
        }
      : rules.hero;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const select = useCallback((next: RulesMode) => {
    setMode(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/play/${next}/rules`);
    }
  }, []);

  // Arrow keys move between tabs, which is what the tab pattern owes a keyboard
  // user. They were links before, so the browser gave this for free; buttons do not.
  const onTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (delta === 0) return;
      event.preventDefault();
      const current = MODE_ORDER.indexOf(mode);
      const next = MODE_ORDER[(current + delta + MODE_ORDER.length) % MODE_ORDER.length];
      select(next);
      tabRefs.current[next]?.focus();
    },
    [mode, select]
  );

  return (
    // .pf-page enters the profile's token contract: --pf-bg, --pf-cream, --pf-mono
    // and the ink steps are published there, so this page lives in the same world
    // instead of restating its values.
    <main className="pf-page">
      <header className="pf-top">
        <Link href="/" className="pf-top__brand" aria-label="Dwiggins — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pf-top__figures"
            src="/brand/dwiggins-figures-dark.svg"
            alt=""
            aria-hidden="true"
            width={182}
            height={122}
          />
          <Image
            src="/brand/dwiggins-wordmark-full-black.svg"
            alt="Dwiggins"
            className="pf-top__logo"
            width={812}
            height={200}
            priority
          />
        </Link>

        {/* Same buttons-in-a-pill as the profile nav: .pf-top__link is already
            written for <button> (appearance, border, cursor, font-family reset). */}
        <div className="pf-top__nav" role="tablist" aria-label="Rules by mode">
          {MODE_ORDER.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`rules-tab-${item}`}
              aria-selected={item === mode}
              aria-controls="rules-panel"
              tabIndex={item === mode ? 0 : -1}
              ref={(node) => {
                tabRefs.current[item] = node;
              }}
              className={`pf-top__link${item === mode ? " is-active" : ""}`}
              onClick={() => select(item)}
              onKeyDown={onTabKeyDown}
            >
              {MODE_RULES[item].label}
            </button>
          ))}
        </div>

        <div className="pf-top__actions">
          <Link href={`/play/${mode}`} className="pf-top__cta">
            Play
          </Link>
          <ThemeSwitch />
        </div>
      </header>

      <div className="pb" data-mode={mode}>
        <div className="pb-bg" aria-hidden="true">
          <StarField />
        </div>

        {/* key={mode} remounts the panel on every switch, so the stagger replays and
            the change is felt rather than guessed. */}
        {/* pb-stack, not a bare div: .pb is a grid, so this wrapper is one cell and
            its own children got no spacing at all. That is what jammed the chip
            against the tiles and the actions against the footnote. */}
        <div
          key={mode}
          id="rules-panel"
          role="tabpanel"
          aria-labelledby={`rules-tab-${mode}`}
          className="pb-stack"
        >
          <header className="pb-intro pb-sec">
            <span className="pb-kicker">{rules.kicker}</span>
            <h1 className="pb-title">{rules.title}</h1>
            <p className="pb-lede">{rules.subtitle}</p>
            <span className="pb-chip">{rules.label}</span>
          </header>

          <section className="pb-stakes pb-sec" aria-label="What moves you forward and what sets you back">
            <div className="pb-stakes__col">
              <h2 className="pb-stakes__head">What moves you forward</h2>
              {rules.stakes.up.map((item) => (
                <p key={item.cause} className="pb-stakes__line">
                  <span className="pb-stakes__sign is-up" aria-hidden="true" />
                  <span className="pb-stakes__cause">{item.cause}</span>
                  <span className="pb-stakes__effect">{item.effect}</span>
                </p>
              ))}
            </div>
            <div className="pb-stakes__col">
              <h2 className="pb-stakes__head">What sets you back</h2>
              {rules.stakes.down.map((item) => (
                <p key={item.cause} className="pb-stakes__line">
                  <span className="pb-stakes__sign" aria-hidden="true" />
                  <span className="pb-stakes__cause">{item.cause}</span>
                  <span className="pb-stakes__effect">{item.effect}</span>
                </p>
              ))}
            </div>
          </section>

          {rules.tiles.length > 0 && (
            <section className="pb-tiles pb-sec" aria-label="Key figures">
              {rules.tiles.map((tile) => (
                <article key={tile.label + tile.value} className="pb-tile">
                  <span className="pb-tile__big">{tile.value}</span>
                  <span className="pb-tile__label">{tile.label}</span>
                  <span className="pb-tile__help">{tile.help}</span>
                </article>
              ))}
            </section>
          )}

          <section className="pb-panels" aria-label={`${rules.label} rules`}>
            {hero ? (
              <article className="pb-panel pb-panel--accent pb-sec" style={{ "--pb-stagger": "40ms" } as React.CSSProperties}>
                <h2 className="pb-panel__label">{hero.name}</h2>
                <div className="pb-hero">
                  <span className="pb-hero__fig">
                    <span className="pb-hero__num">{hero.figure}</span>
                    <span className="pb-hero__unit">{hero.figureLabel}</span>
                  </span>
                  <span className="pb-hero__main">
                    <span className="pb-hero__line">{hero.line}</span>
                    {hero.drains ? (
                      <span className="pb-drain" aria-hidden="true">
                        <span className="pb-drain__fill" />
                      </span>
                    ) : null}
                  </span>
                </div>
                {hero.rows ? (
                  <div className="pb-rows pb-hero__rows">
                    {hero.rows.map((row) => (
                      <div key={row.label} className="pb-row">
                        <span className="pb-row__text">
                          <span className="pb-row__label">{row.label}</span>
                          {row.help ? <span className="pb-row__help">{row.help}</span> : null}
                        </span>
                        {row.value ? <span className="pb-row__value">{row.value}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                <span className="pb-panel__meta">{hero.meta}</span>
                <div className="pb-hero__foot">
                  {hero.stats.map((stat) => (
                    <span key={stat.label} className="pb-hero__stat">
                      <em>{stat.value}</em> {stat.label}
                    </span>
                  ))}
                </div>
              </article>
            ) : null}
            {rules.sections.map((section, index) => (
              <article
                key={section.title}
                className={`pb-panel pb-sec${section.wide ? " pb-panel--wide" : ""}`}
                style={{ "--pb-stagger": `${(index + 1) * 60}ms` } as React.CSSProperties}
              >
                <div className="pb-panel__head">
                  <h2 className="pb-panel__label">{section.title}</h2>
                  {section.note ? <span className="pb-note">{section.note}</span> : null}
                </div>

                {section.caption ? <p className="pb-caption">{section.caption}</p> : null}

                {section.compare ? (
                  <div className="pb-vs">
                    <div className="pb-vs__head">
                      <span className="pb-vs__axis" />
                      <span className="pb-vs__side">Training</span>
                      <span className="pb-vs__side is-this">Competition</span>
                    </div>
                    {section.compare.map((row) => (
                      <div key={row.axis} className="pb-vs__row">
                        <span className="pb-vs__axis">{row.axis}</span>

                        <span className="pb-vs__cell">
                          <VsFigure kind={row.kind} side="training" />
                          <span className="pb-vs__val">{row.training}</span>
                        </span>

                        <span className="pb-vs__cell is-this">
                          <VsFigure kind={row.kind} side="competition" />
                          <span className="pb-vs__val">{row.competition}</span>
                        </span>
                      </div>
                    ))}
                    <p className="pb-vs__note">
                      One lit dot in thirty-eight: that is the share your training set covers today,
                      thirty faces out of the 1136 that can be played. The catalogue holds 1172, but
                      36 carry no Latin letters, so they are never served. And no face is held back
                      for one mode over the other: the catalogue can reserve one, none is reserved
                      today, so both modes draw from exactly the same set.
                    </p>
                  </div>
                ) : null}

                {section.moves ? (
                  <div className="pb-moves">
                    {section.moves.map((move) => (
                      <div key={move.label} className="pb-move">
                        <div className="pb-move__head">
                          <span className="pb-move__label">{move.label}</span>
                          <span className="pb-move__delta">{move.value}</span>
                        </div>
                        <div
                          className="pb-move__track"
                          role="img"
                          aria-label={
                            move.from === move.to
                              ? `Stays on level ${move.from}`
                              : `Level ${move.from} to level ${move.to}`
                          }
                        >
                          {[0, 1, 2, 3, 4].map((slot) => (
                            <span
                              key={slot}
                              className={
                                "pb-dot" +
                                (slot === move.from ? " is-from" : "") +
                                (slot === move.to ? " is-to" : "") +
                                (move.from === move.to && slot === move.from ? " is-hold" : "")
                              }
                            />
                          ))}
                        </div>
                        <span className="pb-move__help">{move.help}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {section.steps ? (
                  <div className="pb-ladder">
                    <div className="pb-ladder__scale">
                      {section.steps.map((step, i) => (
                        <div
                          key={step.level}
                          className="pb-step"
                          style={{ "--pb-step": String((i + 1) / section.steps!.length) } as React.CSSProperties}
                        >
                          <span className="pb-step__level">{step.level}</span>
                          <span className="pb-step__name">{step.name}</span>
                          <span className="pb-step__bar">
                            <span
                              className="pb-step__fill"
                              style={{ width: `${Math.max(3, Math.round(step.bar * 100))}%` }}
                            />
                          </span>
                          <span className="pb-step__window">{step.window}</span>
                          <span className="pb-step__unit">questions</span>
                        </div>
                      ))}
                    </div>
                    <p className="pb-ladder__key">
                      <span className="pb-ladder__up">Right, first try, climbs one rung</span>
                      <span className="pb-ladder__down">A miss drops one rung</span>
                      <span className="pb-ladder__hold">Stable falls only to solid, never further</span>
                    </p>
                  </div>
                ) : null}

                {section.statements ? (
                  <div className="pb-statements">
                    {section.statements.map((statement) => (
                      <p key={statement} className="pb-statement">
                        {statement}
                      </p>
                    ))}
                  </div>
                ) : null}

                <div className="pb-rows">
                  {section.rows.map((row) => (
                    <div
                      key={row.label}
                      className={`pb-row${row.bar === undefined ? "" : " pb-row--scaled"}`}
                    >
                      <span className="pb-row__text">
                        <span className="pb-row__label">{row.label}</span>
                        {row.help ? <span className="pb-row__help">{row.help}</span> : null}
                      </span>
                      {row.value ? <span className="pb-row__value">{row.value}</span> : null}
                      {row.bar === undefined ? null : (
                        <span className="pb-bar" aria-hidden="true">
                          <span
                            className="pb-bar__fill"
                            style={{ width: `${Math.max(2, Math.round(row.bar * 100))}%` }}
                          />
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {section.meta ? <span className="pb-panel__meta">{section.meta}</span> : null}
              </article>
            ))}
          </section>

          <div className="pb-actions pb-sec">
            <Link href={`/play/${mode}`} className="pb-cta pb-cta--strong">
              Open {rules.label}
            </Link>
            <Link href="/play" className="pb-cta">
              Back to modes
            </Link>
          </div>

          <p className="pb-foot pb-sec">{rules.foot}</p>
        </div>
      </div>
    </main>
  );
}
