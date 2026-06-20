# Safety Workflow

This project should not rely on editor history as the source of truth.

## Before any risky UI pass

Run:

```bash
npm run safety:checkpoint
```

That command creates a dated snapshot in `backups/checkpoints/<timestamp>/` with:

- copies of critical UI files
- current branch name
- current `git status`
- full unstaged diff
- staged diff
- diff limited to the main high-risk UI files
- list of untracked files

## Critical files covered

- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `features/modes/components/ModeSelectPage.tsx`
- `features/game/components/GameScreen.tsx`
- `features/modes/components/ModeRulesPage.tsx`
- `features/onboarding/components/OnboardingFlow.tsx`
- `docs/ui/front-ui-master-spec.md`
- `docs/ui/ui-consistency-contract.md`
- `progress.md`

## The safe ritual

1. Run `npm run safety:checkpoint`
2. Create a checkpoint commit before major experimentation
3. Work in a dedicated branch for risky visual passes
4. Push to GitHub as soon as possible

## Minimum git policy

Before risky work:

```bash
git switch -c safe/<topic>
git add -A
git commit -m "checkpoint: before <topic>"
```

After the pass is validated:

```bash
git add -A
git commit -m "feat: <topic>"
```

## Most important missing protection right now

This repository currently has no configured remote.

Check:

```bash
git remote -v
```

As long as there is no GitHub remote, the project remains vulnerable to local loss.

## What not to trust alone

- Cursor history
- hot reload state
- `.next` output
- browser cache

Those can help in recovery, but they are not the source of truth.
