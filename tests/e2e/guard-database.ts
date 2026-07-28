// ---------------------------------------------------------------------------
// Opt-in gate for the end to end suite.
//
// A full run writes into whatever database DATABASE_URL points at: 1 guest
// user, about 30 user_typeface_state rows, 1 session that is never finished,
// and 2 user_event_fact rows. Nothing existing is mutated, but none of those
// rows can be told apart from a real player's, and the foreign keys are
// ON DELETE RESTRICT (db/migrations/003_users_sessions_pool.sql), so removing
// them later means deleting in order: user_event_fact, sessions,
// user_typeface_state, users.
//
// Today that database is the production one, so a run has to be asked for
// explicitly. Playwright starts the web server plugin before global setup, so
// playwright.config.ts withholds the server as well when the opt-in is
// missing: refusing a run must not compile the app for nothing.
// ---------------------------------------------------------------------------

export const E2E_OPT_IN_ENV = "JDT_E2E_ALLOW_PROD";

export const allowsDatabaseWrites = () => process.env[E2E_OPT_IN_ENV] === "1";

// Host and database name only, never the raw value: DATABASE_URL carries a
// password. Playwright does not read .env.local, so an unset variable here
// says nothing about the dev server, which resolves its own.
const describeTarget = () => {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    return "not exported in this shell, the dev server reads it from .env.local";
  }

  try {
    const parsed = new URL(raw);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "set, but not parsable as a URL";
  }
};

const refusal = () =>
  [
    "",
    "Refusing to run the end to end suite.",
    "",
    "It writes into the database DATABASE_URL points at, and nothing marks",
    "those rows as test data.",
    `  DATABASE_URL: ${describeTarget()}`,
    "",
    "One full run adds: 1 guest user, about 30 user_typeface_state rows,",
    "1 session that is never finished, 2 user_event_fact rows.",
    "",
    "To run it anyway, accepting those writes, type:",
    "",
    `  ${E2E_OPT_IN_ENV}=1 npm run test:e2e`,
    "",
    "To keep real data untouched, point DATABASE_URL at a throwaway Neon",
    "branch in .env.local first, then use the same command.",
    "",
  ].join("\n");

export default function guardDatabase() {
  if (allowsDatabaseWrites()) return;

  console.error(refusal());
  throw new Error(`End to end run refused: ${E2E_OPT_IN_ENV} is not set to 1.`);
}
