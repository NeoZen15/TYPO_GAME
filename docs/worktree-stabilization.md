# Worktree Stabilization Notes

This note classifies the current worktree so the repository-organization changes stay mergeable without disturbing active onboarding work.

## Category A — Active external work, keep untouched

- `features/onboarding/*`
  - Current observed active file: `features/onboarding/components/OnboardingFlow.tsx`
- Do not move, rename, or structurally refactor onboarding files during repo stabilization.

## Category B — Repository stabilization and guardrails

These files belong to the stabilization wave and can be reviewed together:

- `app/dev/*` and `app/api/dev/*`
- `components/dev/typography/*`
- compatibility wrappers in `components/typography/*`
- `lib/dev/typography/*`
- compatibility wrappers in `lib/typography/*`
- `scripts/quality/check-dev-routes.mjs`
- `scripts/quality/check-compatibility-bridges.mjs`
- `scripts/quality/check-runtime-boundaries.mjs`
- `scripts/quality/check-tracked-artifacts.mjs`
- `scripts/quality/report-worktree-categories.mjs`
- `docs/repo-organization.md`
- `docs/worktree-stabilization.md`
- `data/typography-profiles/README.md`
- `data/typography-profiles/tmp/.gitignore`
- `backups/README.md`
- `package.json`
- `package-lock.json` when it only reflects stabilization tooling dependencies

## Category C — Runtime/product changes to review separately

These files affect user-facing behavior and should be reviewed as product changes, not only as repo-rangement:

- `app/compare/[slug]/page.tsx`
- `app/type/[slug]/page.tsx`
- `app/play/competition/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `components/dev/UiDebugProbe.tsx`
- `components/typography/MeasuredGlyphSplit.tsx`
- `components/typography/TypefaceTester.tsx`
- `docs/ui-palette-reference.md`

## Current commit assembly rule

- Run `npm run worktree:report` before preparing the stabilization wave.
- Only Category B files belong to the pure repo-rangement commit by default.
- Category C files travel separately unless they are strictly required to keep `build` and `quality` green.
- Category A stays untouched during this wave.

## Merge strategy

- Prefer one logical block for stabilization/guardrails.
- Keep onboarding work separate.
- If product-facing runtime changes must travel with the stabilization wave, call that out explicitly in review because they are not pure organization changes.
- Use `npm run check:compat-bridges` and `npm run check:runtime-boundaries` together to keep the bridge layer honest while the migration remains incremental.
