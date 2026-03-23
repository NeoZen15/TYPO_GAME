# Quality Scripts

Internal non-visual checks to keep cleanup work safe.

- `check-tracked-artifacts.mjs`: fails if forbidden system files are tracked.
- `check-copy-usage.mjs`: fails if a `gateCopy` key is not referenced anywhere.
- `check-motion-contracts.mjs`: text-contract checks for behavior-critical motion/layout values.

Run all checks through `npm run quality`.
