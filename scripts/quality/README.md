# Quality Scripts

Internal non-visual checks to keep cleanup work safe.

- `check-tracked-artifacts.mjs`: fails if forbidden system files are tracked.
- `check-copy-usage.mjs`: fails if a key of any `*Copy` block in `content/copy.ts` is not referenced anywhere.
- `check-motion-contracts.mjs`: text-contract checks for behavior-critical motion/layout values.
- `check-typography-contract.mjs`: validates the typography hybrid contract (BLOCK/WARN/INFO + stable error codes).
- `check-license-guard.mjs`: fails if a pool query lost the runtime licence clause, or if a servable typeface has a licence that is not cleared.

Run all checks through `npm run quality`.
