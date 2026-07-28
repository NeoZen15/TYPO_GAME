import { expect, test, type Page } from "playwright/test";

// ---------------------------------------------------------------------------
// Journey 3 — the training round, the only mode that is playable end to end
// (Competition exists but is timed and stateful, Expert is still a
// ModePlaceholderPage). This is the deepest stack in the product: page, guest
// cookie, /api/training/session/start, the Leitner pool in Neon, the signed
// question token, then /api/training/answer.
//
// The spec reads the state through window.render_game_to_text(), the audit hook
// GameScreen already exposes for automation, instead of scraping CSS classes.
//
// Side effect to know about: starting a session creates one anonymous guest user
// and its pool rows in the database pointed at by DATABASE_URL. Nothing existing
// is mutated, but the run is not read only.
// ---------------------------------------------------------------------------

type GameState = {
  mode: string;
  status: "loading" | "error" | "complete" | "playing";
  sessionId: string | null;
  progress: {
    resolvedCount: number;
    totalRounds: number;
    facesMastered?: number;
    poolSize?: number;
  };
  question: {
    id: string;
    displayWord: string;
    typefaceSlug: string;
    options: { slug: string; label: string }[];
  } | null;
  result: "idle" | "correct" | "wrong";
  wrongAttemptIds: string[];
};

const readGameState = async (page: Page): Promise<GameState | null> => {
  const raw = await page.evaluate(() => window.render_game_to_text?.() ?? null);
  return raw ? (JSON.parse(raw) as GameState) : null;
};

test.describe("training round", () => {
  test("starts a session, shows a question, and accepts a correct answer", async ({
    page,
  }) => {
    await page.goto("/game");

    // The audit hook is installed by an effect, so wait for it before reading.
    await page.waitForFunction(() => typeof window.render_game_to_text === "function");

    // Wait for the session to leave "loading" without a fixed delay.
    await expect
      .poll(async () => (await readGameState(page))?.status, { timeout: 45_000 })
      .not.toBe("loading");

    const started = await readGameState(page);
    expect(
      started?.status,
      "the training session must start; check DATABASE_URL and the Neon pool"
    ).toBe("playing");
    expect(started?.sessionId).toBeTruthy();
    expect(started?.question?.displayWord?.length).toBeGreaterThan(0);
    expect(started?.question?.options).toHaveLength(4);

    // The rendered word must not fall back to the "unavailable" copy.
    const word = page.getByRole("heading", { level: 1 });
    await expect(word).toHaveText(started!.question!.displayWord);

    const options = page.getByRole("radiogroup", { name: "Typeface options" });
    await expect(options).toBeVisible();
    await expect(options.getByRole("radio")).toHaveCount(4);
    await expect(page.getByText(/faces mastered$/)).toBeVisible();

    // The payload carries the answer slug, so the round can be resolved
    // deterministically instead of guessing.
    const correctIndex = started!.question!.options.findIndex(
      (option) => option.slug === started!.question!.typefaceSlug
    );
    expect(
      correctIndex,
      "the correct typeface must be among the four options"
    ).toBeGreaterThanOrEqual(0);

    const firstQuestionId = started!.question!.id;
    // Targeted by position, never by label. `getByRole({ name })` matches on a
    // substring by default, and pickDistractors deliberately prefers distractors
    // from the same visual cluster and category as the answer, so the four
    // options are often superfamily siblings: "Alumni Sans" against "Alumni Sans
    // Inline One". 137 of the 1172 servable display names are a substring of
    // another one, so a label locator resolves two radios and Playwright raises
    // a strict mode violation before the click ever happens. The DOM order
    // follows question.options (GameScreen.tsx), so the index is exact.
    await options.getByRole("radio").nth(correctIndex).click();

    // Resolution: either the round counter moved, or the board advanced to the
    // next question, or the session finished.
    await expect
      .poll(
        async () => {
          const state = await readGameState(page);
          if (!state) return "missing";
          if (state.status === "error") return "error";
          if (state.progress.resolvedCount >= 1) return "resolved";
          if (state.question && state.question.id !== firstQuestionId) {
            return "advanced";
          }
          return "pending";
        },
        { timeout: 30_000 }
      )
      .toMatch(/resolved|advanced/);

    const answered = await readGameState(page);
    expect(answered?.status).not.toBe("error");
    expect(answered?.wrongAttemptIds).toEqual([]);
  });

  test("a failed session start surfaces a recoverable error", async ({ page }) => {
    // Contract check on the only user visible failure path: when the start
    // endpoint is down, the screen must offer a retry and a way back, not a
    // blank board.
    await page.route("**/api/training/session/start", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "training_session_start_failed" }),
      })
    );

    await page.goto("/game");

    await expect(
      page.getByText("Unable to start the training session.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry session" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to modes" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Training unavailable" })
    ).toBeVisible();
  });
});
