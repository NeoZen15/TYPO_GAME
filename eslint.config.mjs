import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nested git worktrees live under .claude/worktrees/ and carry their own
    // build output. Linting them from the parent checkout reports the same
    // code twice and surfaces compiled Turbopack chunks as source errors.
    // ".next/**" above is root-anchored and does not cover them.
    ".claude/worktrees/**",
    // Root scratch directory, ignored by git (.gitignore line "/tmp/"). It holds
    // one-off probes, screenshots and throwaway scripts, not product source, so a
    // `let` that could be a `const` in a five-minute proof script must not fail
    // the quality gate. Same reasoning as the worktrees above.
    "tmp/**",
  ]),
]);

export default eslintConfig;
