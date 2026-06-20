# Jeux de Typo V2

Interactive typographic learning experience built with Next.js (App Router), React, and GSAP.

## Development

Run the local server:

```bash
npm run dev
```

Then open `http://127.0.0.1:3000`.

## Commands

- `npm run dev`: start local development server on port 3000.
- `npm run lint`: run ESLint checks.
- `npm run typecheck`: run TypeScript checks.
- `npm run check:compat-bridges`: verify that compatibility wrappers stay thin re-export shims.
- `npm run check:dev-routes`: verify that internal dev routes are guarded from production.
- `npm run check:runtime-boundaries`: verify that product/runtime files do not import typography dev-lab modules directly.
- `npm run worktree:report`: classify the current worktree into onboarding, stabilization, and product-review buckets.
- `npm run quality`: run the internal non-regression suite, including the production build.
- `npm run build`: production build.
- `npm run start`: run production server.

## Project Structure

- `app/`: app router entry files and global styles.
- `app/dev/` and `app/api/dev/`: internal typography lab routes, guarded from production with `isDevRuntime`.
- `components/dev/typography/`: internal typography lab boards and validators.
- `components/typography/`: product-facing typography UI used by `compare` and `type`.
- `components/ui`: reusable UI primitives.
- `lib/dev/typography/`: dev-only typography builders, audit specs, and export runtimes.
- `lib/typography/`: shared runtime typography logic and product-facing helpers.
- `data/typography-profiles/`: versioned typography corpus and measurement snapshots.
- `data/typography-profiles/tmp/`: local-only export workspace; keep it untracked.
- `backups/`: historical recovery material, not an active work area.
- `content/`: centralized copy constants.
- `docs/`: implementation notes and product constraints.
- Reference contract: `docs/typography/typography-system-contract.md`.
- Repo boundary guide: `docs/overview/repo-organization.md`.
- Worktree review note: `docs/process/worktree-stabilization.md`.

## Notes

- Motion timing, trigger boundaries, and layout hierarchy are behavior-critical.
- `features/onboarding/` is treated as an active work area and is intentionally excluded from repo-organization refactors.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
