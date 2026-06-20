# Repo Organization

This repository currently mixes three kinds of work:

- Runtime product code: pages, components, content, and server logic required by the user-facing app.
- Internal typography lab code: `app/dev/*`, `app/api/dev/*`, and supporting measurement utilities used to inspect and tune the compare-stage system.
- Research artifacts: corpus snapshots, diffs, backups, and exploratory documents.

The goal is not to remove that lab surface, but to keep the boundaries explicit so the repo stays safe to ship.

## Active Freeze

- `features/onboarding/*` is an active work area and is temporarily out of scope for repository-organization refactors.
- Do not move onboarding files, refactor onboarding imports, or repack shared onboarding dependencies as part of typography-lab cleanup.

## Runtime Rules

- Anything under `app/`, `components/`, `features/`, and `lib/` should be assumed production-facing unless clearly marked otherwise.
- Product-facing typography primitives remain under `components/typography/*` and `lib/typography/*`.
- Internal dev routes must live under `app/dev/*` or `app/api/dev/*`.
- Every internal dev route must import `isDevRuntime` from `@/lib/dev-mode` and fail closed in production.
- `npm run quality` is expected to catch both lint/type regressions and production build regressions.

## Dev Lab Rules

- `app/dev/*` pages are allowed for visual probes, calibration boards, and audit surfaces.
- `app/api/dev/*` routes are allowed for local-only exports and measurement helpers.
- Dev-only typography components should live under `components/dev/typography/*`.
- Dev-only typography builders, audit specs, and export runtimes should live under `lib/dev/typography/*`.
- Compatibility bridges under `components/typography/*` and `lib/typography/*` are temporary only and must stay as thin re-export shims while the migration is in flight.
- New lab code should prefer reusing shared `lib/typography/*` runtime primitives rather than duplicating measurement logic in components.
- If a dev-only utility becomes part of the product experience, move it out of the `dev` tree and remove the dev guard.

## Data And Artifact Rules

- `data/typography-profiles/` is treated as a versioned corpus area, not a scratch directory.
- `data/typography-profiles/tmp/` is reserved for local exports and must stay untracked.
- Generated snapshots that are part of the source of truth may stay tracked there, but ad hoc exports should not accumulate without a reason.
- `backups/` is historical recovery material and archive-only. It should not receive new routine checkpoints unless there is a concrete recovery need.
- `docs/` should describe durable system behavior, contracts, or operator workflows. Temporary notes should not become permanent by default.

## Practical Workflow

- Use `npm run quality` before merging changes that touch routing, compare-stage logic, or dev-lab measurement code.
- Use `npm run worktree:report` before assembling a stabilization commit so active onboarding work and product review files stay out of the repo-rangement wave.
- If you add a new internal route, run `npm run check:dev-routes`.
- If you add or edit a compatibility bridge, run `npm run check:compat-bridges`.
- If you move typography lab modules, run `npm run check:runtime-boundaries` to confirm product/runtime files do not import the dev-lab namespace.
- If a file does not clearly belong to product runtime, dev-lab, or versioned corpus, pause and classify it before committing.
