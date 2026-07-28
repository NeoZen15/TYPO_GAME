import { expect, test, type Page } from "playwright/test";

// ---------------------------------------------------------------------------
// Mechanical accessibility contract.
//
// Four rules, chosen because none of them needs a visual arbitration: contrast
// and target size are design decisions and stay out of this spec on purpose.
//
//   1. exactly one h1 is rendered per page,
//   2. every image carries an alt attribute, empty when it is decorative,
//   3. every interactive control has a non empty accessible name,
//   4. <html> carries a lang attribute.
//
// Rule 3 leans on Playwright's own accessible name computation, through
// ariaSnapshot on each candidate element, instead of a hand rolled
// approximation of the algorithm.
//
// Pages under test: the landing, the onboarding, the mode selection, and one
// specimen page. None of them writes to the database: /game and /profile are
// excluded for that reason, and /compare is out of scope by owner decision.
// ---------------------------------------------------------------------------

const PAGES = ["/", "/onboarding", "/play", "/type/inter"] as const;

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  'input:not([type="hidden"])',
  "select",
  "textarea",
  '[role="button"]',
  '[role="link"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="tab"]',
].join(", ");

// An element inside an aria-hidden subtree is not exposed at all, so it has no
// accessible name to check. Known and accepted limit: a control with no box at
// all is also skipped, since Playwright reports it as not visible.
const isExposed = async (page: Page, index: number) => {
  const element = page.locator(INTERACTIVE_SELECTOR).nth(index);

  if (!(await element.isVisible())) return false;

  return element.evaluate((node) => node.closest('[aria-hidden="true"]') === null);
};

const readAccessibleName = async (page: Page, index: number) => {
  const element = page.locator(INTERACTIVE_SELECTOR).nth(index);
  const snapshot = await element.ariaSnapshot();
  const firstLine = snapshot.split("\n")[0] ?? "";
  const quoted = /"([^"]*)"/.exec(firstLine);

  return {
    name: quoted?.[1] ?? "",
    snapshot: firstLine.trim(),
    outerHtml: await element.evaluate((node) => node.outerHTML.slice(0, 160)),
  };
};

for (const path of PAGES) {
  test(`accessibility contract on ${path}`, async ({ page }) => {
    await page.goto(path);

    // Rule 1: one h1, no more and no less. Zero leaves the page without a title
    // in a screen reader outline, several make the outline meaningless.
    await expect(page.locator("h1")).toHaveCount(1);

    // Rule 2: an image with no alt attribute at all is announced by its file
    // name. alt="" is the correct answer for a decorative image, so presence is
    // what is asserted, never content.
    const imagesWithoutAlt = await page.locator("img:not([alt])").evaluateAll(
      (nodes) => nodes.map((node) => (node as HTMLElement).outerHTML.slice(0, 160))
    );
    expect(imagesWithoutAlt, `images missing an alt attribute on ${path}`).toEqual([]);

    // Rule 3: every exposed control is reachable by name.
    const controlCount = await page.locator(INTERACTIVE_SELECTOR).count();
    const unnamed: string[] = [];

    for (let index = 0; index < controlCount; index += 1) {
      if (!(await isExposed(page, index))) continue;

      const { name, snapshot, outerHtml } = await readAccessibleName(page, index);
      if (name.trim().length === 0) {
        unnamed.push(`${snapshot} -> ${outerHtml}`);
      }
    }

    expect(unnamed, `controls with no accessible name on ${path}`).toEqual([]);

    // Rule 4: without lang, a screen reader reads English copy with the voice of
    // whatever language it defaults to.
    await expect(page.locator("html")).toHaveAttribute("lang", /\S/);
  });
}
