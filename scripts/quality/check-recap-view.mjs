#!/usr/bin/env node

// End-of-session frame guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. The three modes share one page, SessionRecap, and each
// ships a pure function turning its own session summary into a RecapView. The
// page renders whatever it is handed, so nothing stops an adapter from handing
// it a shape the frame cannot hold. This checks the shape, mode by mode, on the
// real adapters.
//
// WHY EACH RULE IS HERE.
//
// FOUR FIGURES, NOT THREE, NOT FIVE. The KPI row is `repeat(4, 1fr)`, the
// owner's cut of 2026-08-15. Five would wrap onto a second line and push the
// actions under the fold on a short screen, which is the one thing this page
// was rebuilt to avoid. Three would leave a hole. The Expert placeholder counts
// too: it has no engine, but it has four columns to fill.
//
// A COLOUR PER MODE. Green, orange, blue, the validated /play palette. A missing
// accent falls back to competition's orange through the CSS, so training would
// silently wear the wrong colour rather than break.
//
// A TITLE, A KICKER, A LEDE, AND TWO NAMED PANELS. An empty string renders an
// empty element, which is invisible in review and obvious to a player.
//
// NO SCORE, NO CLOCK, IN TRAINING. The mode says it in its own rules: "There is
// no score to beat and no clock to race." An adapter that borrowed competition's
// vocabulary would contradict the page a player can open from the same screen.

const MODULE = "lib/game/{competition,training,expert}/recap-view.ts";
const failures = [];

const expectString = (label, value) => {
  if (typeof value !== "string" || value.trim() === "") {
    failures.push(`${label}: expected a non-empty string, got ${JSON.stringify(value)}`);
  }
};

const checkView = (label, view, { kpis = 4 } = {}) => {
  if (!view) {
    failures.push(`${label}: no view returned`);
    return;
  }

  expectString(`${label}.kicker`, view.kicker);
  expectString(`${label}.title`, view.title);
  expectString(`${label}.lede`, view.lede);
  expectString(`${label}.accent`, view.accent);

  if (!/^#[0-9a-f]{6}$/i.test(view.accent ?? "")) {
    failures.push(`${label}.accent: expected a hex colour from MODE_ACCENT, got ${view.accent}`);
  }

  if (!Array.isArray(view.kpis) || view.kpis.length !== kpis) {
    failures.push(
      `${label}.kpis: the row is a four column grid, so it takes exactly ${kpis} figures, got ` +
        `${Array.isArray(view.kpis) ? view.kpis.length : typeof view.kpis}. Five wrap onto a ` +
        `second line and push the actions under the fold.`
    );
  } else {
    view.kpis.forEach((kpi, index) => {
      expectString(`${label}.kpis[${index}].value`, kpi.value);
      expectString(`${label}.kpis[${index}].label`, kpi.label);
      expectString(`${label}.kpis[${index}].helper`, kpi.helper);
    });
  }

  for (const side of ["left", "right"]) {
    const panel = view[side];
    if (!panel) {
      failures.push(`${label}.${side}: missing panel`);
      continue;
    }
    expectString(`${label}.${side}.title`, panel.title);
    const hasContent = Boolean(panel.figures?.length || panel.rows?.length);
    if (!hasContent && !panel.empty) {
      failures.push(
        `${label}.${side}: no content and no empty line, so the panel renders as a bare title.`
      );
    }
  }
};

try {
  const [{ buildCompetitionRecapView }, { buildTrainingRecapView }, { EXPERT_RECAP_PREVIEW }] =
    await Promise.all([
      import("../../lib/game/competition/recap-view.ts"),
      import("../../lib/game/training/recap-view.ts"),
      import("../../lib/game/expert/recap-view.ts"),
    ]);

  const competition = buildCompetitionRecapView(
    {
      wrongCount: 2,
      accuracyRate: 75,
      fastAnswerCount: 5,
      answersPerMinute: 4,
      pointsPerMinute: 5.5,
      averagePointsPerAnswer: 1.4,
      averageResponseTimeMs: 1840,
      averageCorrectResponseTimeMs: 2430,
      averageWrongResponseTimeMs: 80,
      fastestResponseTimeMs: 40,
      slowestResponseTimeMs: 14290,
      bestCorrectStreak: 2,
      uniqueTypefacesSeenCount: 8,
      categoryPerformance: [],
      strongestCategories: [],
      weakestCategories: [],
      commonConfusions: [],
      recentMisses: [],
      answerTimeline: [],
      speedBuckets: [],
    },
    { answeredCount: 8, correctCount: 6, score: 11, totalDurationMs: 120000, remainingMs: 0, deadlineUtc: "" }
  );

  const training = buildTrainingRecapView({
    durationMs: 247000,
    questionsResolved: 6,
    answersSubmitted: 8,
    firstTryCorrect: 4,
    firstTryAccuracy: 0.67,
    retryCount: 2,
    typefacesSeen: 6,
    typefacesDiscovered: ["a"],
    typefacesReinforced: ["b", "c"],
    typefacesWeakened: [],
    masteryNet: 4,
    confusions: [],
    medianResponseMs: 3960,
    fastestResponseMs: 40,
    slowestResponseMs: 10980,
  });

  checkView("competition", competition);
  checkView("training", training);
  checkView("expert", EXPERT_RECAP_PREVIEW);

  // Training must not borrow competition's vocabulary. Checked on the rendered
  // strings rather than on the code, because that is what a player reads.
  const trainingWords = JSON.stringify([training.kicker, training.title, training.lede, training.kpis])
    .toLowerCase();
  for (const forbidden of ["score", "time is up", "points", "clock"]) {
    if (trainingWords.includes(forbidden)) {
      failures.push(
        `training: the word "${forbidden}" appears in its headline figures. The mode's own rules ` +
          `state there is no score to beat and no clock to race.`
      );
    }
  }

  if (competition.accent === training.accent || training.accent === EXPERT_RECAP_PREVIEW.accent) {
    failures.push("the three modes must not share an accent colour.");
  }
} catch (error) {
  failures.push(
    `could not import ${MODULE} to exercise the adapters: ${error.message}. ` +
      `They must stay free of runtime imports so Node can strip their types.`
  );
}

if (failures.length > 0) {
  console.error("check:recap-view FAILED\n");
  for (const failure of failures) {
    console.error(`  - ${failure}\n`);
  }
  process.exit(1);
}

console.log(
  "check:recap-view OK : the three modes each hand the frame four figures, their own accent, " +
    "a kicker, a title, a lede and two named panels, and training borrows none of competition's " +
    "vocabulary."
);
