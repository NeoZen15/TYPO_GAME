import { defineConfig, devices } from "playwright/test";

// ---------------------------------------------------------------------------
// End to end gate. The 8 home made checks of `npm run quality` verify static
// contracts (imports, copy keys, motion order). Nothing verified that a real
// player journey completes in a browser, so this suite covers the three paths
// that actually carry risk: the landing entry point, the full onboarding
// sequence, and a training round served by the API.
//
// The test runner ships inside the already installed `playwright` package
// (subpath `playwright/test`), so no extra dependency is required.
// ---------------------------------------------------------------------------

const HOST = "127.0.0.1";
const PORT = 3000;
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // The dev server is a single shared instance and the training journey writes
  // a guest session, so the specs run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // `list` only, on purpose: the HTML reporter would write playwright-report/
  // into the working tree on every run.
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
    // The landing and the onboarding warm up drive GSAP timelines and
    // IntersectionObserver reveals. Reduced motion keeps the DOM in its final
    // state immediately, so assertions never race an animation.
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // A cold Turbopack start plus the font manifest read is slow on first hit.
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
