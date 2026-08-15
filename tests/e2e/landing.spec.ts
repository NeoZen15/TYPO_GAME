import { expect, test } from "playwright/test";

// ---------------------------------------------------------------------------
// Journey 1 — the landing is the only entry point, and its hero is a live type
// specimen fed by the runtime font manifest. If the manifest read or the
// catalog resolution breaks, the page still renders but the whole funnel is
// dead, so this spec asserts the hero, the section anchors and the two calls to
// action that lead into the product.
//
// Note: the landing no longer mounts the `Gate` sequence. `Gate.tsx` is still
// present under features/landing/components and is still contract checked by
// check:motion-contracts, but nothing imports it, so there is no gate to test.
// ---------------------------------------------------------------------------

const HERO_LABEL = "Typeface recognition game";

test.describe("landing", () => {
  test("renders the hero specimen and the section anchors", async ({ page }) => {
    // Both channels, because they catch different failures: pageerror only sees
    // uncaught exceptions, so a component logging console.error on every render
    // would go unnoticed.
    const clientErrors: string[] = [];
    page.on("pageerror", (error) => clientErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        clientErrors.push(`console: ${message.text()}`);
      }
    });

    await page.goto("/");

    const hero = page.getByRole("region", { name: HERO_LABEL });
    await expect(hero).toBeVisible();

    // The h1 carries the accessible name; the visible word is aria-hidden
    // because it swaps typeface every 2.4s.
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveAttribute(
      "aria-label",
      /a typeface recognition game$/
    );
    // The specimen word must actually be painted, not an empty box.
    await expect(title).toContainText("Character");

    await expect(
      hero.getByText("Every typeface has one. Train your eye to read it.")
    ).toBeVisible();

    // Section anchors drive the scroll spy nav; a missing id silently breaks it.
    const nav = page.getByRole("navigation", { name: "Sections" });
    for (const label of ["How it works", "Compare", "Typefaces", "Modes"]) {
      // exact, so that a future "Compare typefaces" entry fails on the assertion
      // rather than on an unreadable strict mode violation.
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }

    expect(clientErrors).toEqual([]);
  });

  test("the hero call to action opens the onboarding", async ({ page }) => {
    await page.goto("/");

    const hero = page.getByRole("region", { name: HERO_LABEL });
    await hero.getByRole("link", { name: "Start training" }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByText("Step 1 / 4")).toBeVisible();
  });

  test("the secondary call to action opens the mode selection", async ({ page }) => {
    await page.goto("/");

    const hero = page.getByRole("region", { name: HERO_LABEL });
    await hero.getByRole("link", { name: "See the modes" }).click();

    await expect(page).toHaveURL(/\/play$/);
    // The board was rebuilt on 2026-08-04 (commit 13e405f, owner's direction):
    // the cards stopped overlapping and each one carries its own Rules and Play
    // actions, so the single "Open X mode" link is gone and the heading changed.
    // This spec had been red ever since, unseen, because the quality gate does
    // not run the tests.
    await expect(
      page.getByRole("heading", { name: "Pick how you want to play." })
    ).toBeVisible();
    // Every mode offers its rules; Training and Competition are playable and
    // Expert still previews, so its own action is checked by href, not by word.
    for (const mode of ["training", "competition", "expert"]) {
      await expect(page.locator(`a[href="/play/${mode}/rules"]`)).toBeVisible();
      await expect(page.locator(`a[href="/play/${mode}"]`)).toBeVisible();
    }
  });
});
