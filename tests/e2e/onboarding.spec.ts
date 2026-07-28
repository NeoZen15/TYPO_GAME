import { expect, test } from "playwright/test";

// ---------------------------------------------------------------------------
// Journey 2 — the onboarding is the gate to the game and it is the only place
// where `familiarity` is captured. That answer is persisted in localStorage
// (jdt-onboarding-v1) and read back by GameScreen to seed the Leitner pool, so
// a broken step gate or a broken write silently degrades every later session.
//
// The spec walks the 4 declared steps in order and checks the two real gates:
// step 2 cannot be left without an answer, step 3 cannot be left without
// resolving the warm up round.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "jdt-onboarding-v1";

// Declared familiarity "A little" maps to the level 2 warm up round in
// features/onboarding/warmup-rounds.ts: Poppins, the word "Layout", answer
// "Sans-serif".
const WARMUP_WORD = "Layout";
const WARMUP_PROMPT = "What kind of letters are these?";
const WARMUP_ANSWER = "Sans-serif";
const WARMUP_REVEAL = "Right. Even strokes, rounded shapes, and no feet at all.";

test.describe("onboarding", () => {
  test("walks the 4 steps and hands off to the game", async ({ page }) => {
    await page.goto("/onboarding");

    const continueButton = page.getByRole("button", { name: "Continue" });

    // Step 1 — welcome.
    await expect(page.getByText("Step 1 / 4")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Before we start." })
    ).toBeVisible();
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Step 2 — familiarity. Gated: no answer means no continue.
    await expect(page.getByText("Step 2 / 4")).toBeVisible();
    const familiarityGroup = page.getByRole("radiogroup", {
      name: "How familiar are you with typography?",
    });
    await expect(familiarityGroup).toBeVisible();
    await expect(familiarityGroup.getByRole("radio")).toHaveCount(4);
    await expect(continueButton).toBeDisabled();
    await expect(page.getByText("Select one option to continue.")).toBeVisible();

    const chosen = familiarityGroup.getByRole("radio", { name: /^A little/ });
    await chosen.click();
    await expect(chosen).toHaveAttribute("aria-checked", "true");
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Step 3 — the warm up. Gated: the round must be resolved.
    await expect(page.getByText("Step 3 / 4")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "You see a word."
    );
    await expect(page.getByText(WARMUP_PROMPT)).toBeVisible();
    await expect(page.getByText(WARMUP_WORD, { exact: true })).toBeVisible();
    await expect(continueButton).toBeDisabled();
    await expect(
      page.getByText("Your turn — tap the answer you think fits.")
    ).toBeVisible();

    await page.getByRole("button", { name: WARMUP_ANSWER }).click();
    await expect(page.getByText(WARMUP_REVEAL)).toBeVisible();
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Step 4 — launch recap.
    await expect(page.getByText("Step 4 / 4")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "ready to train"
    );
    await expect(page.getByText("Where you start")).toBeVisible();
    // "A little" resolves to the "Growing confidence" tier in the recap.
    await expect(page.getByText("Growing confidence")).toBeVisible();
    await expect(page.getByText("First mode")).toBeVisible();
    await expect(continueButton).toHaveCount(0);

    const startPlaying = page.getByRole("link", { name: "Start playing" });
    await expect(startPlaying).toBeVisible();
    await expect(startPlaying).toHaveAttribute("href", "/game");

    // The handoff contract with GameScreen: familiarity plus the graded warm up.
    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      STORAGE_KEY
    );
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toEqual({
      familiarity: "A little",
      warmupCorrect: true,
    });
  });

  test("a wrong warm up answer still unlocks the last step", async ({ page }) => {
    await page.goto("/onboarding");

    const continueButton = page.getByRole("button", { name: "Continue" });
    await continueButton.click();

    await page
      .getByRole("radiogroup", { name: "How familiar are you with typography?" })
      .getByRole("radio", { name: /^A little/ })
      .click();
    await continueButton.click();

    await expect(page.getByText(WARMUP_PROMPT)).toBeVisible();
    // "Script" is never the answer on this round.
    await page.getByRole("button", { name: "Script" }).click();
    await expect(
      page.getByText("Look again at the letters, then pick.")
    ).toBeVisible();
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    await expect(page.getByText("Step 4 / 4")).toBeVisible();

    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      STORAGE_KEY
    );
    expect(JSON.parse(stored as string)).toEqual({
      familiarity: "A little",
      warmupCorrect: false,
    });
  });
});
