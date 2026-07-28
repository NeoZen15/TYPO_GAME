# Quality Scripts

Internal non-visual checks to keep cleanup work safe.

- `check-tracked-artifacts.mjs`: fails if forbidden system files are tracked.
- `check-copy-usage.mjs`: fails if a key of any `*Copy` block in `content/copy.ts` is not referenced anywhere.
- `check-motion-contracts.mjs`: text-contract checks for behavior-critical motion/layout values.
- `check-typography-contract.mjs`: validates the typography hybrid contract (BLOCK/WARN/INFO + stable error codes).
- `check-license-guard.mjs`: fails if a pool query lost the runtime licence clause, or if a servable typeface has a licence that is not cleared.
- `check-font-licenses.mjs`: fails if a directory of `public/fonts` hosts font files without its licence text, if that text is empty, truncated or not the licence it claims to be, or if a servable typeface has no licensed directory. The texts are copied verbatim from the google/fonts snapshot by `scripts/sync-font-licenses.mjs`. The file name expected per licence and the directories out of perimeter come from `scripts/font-licenses.config.json`, shared with that script and with `scripts/mirror_fonts.py`.

Run all checks through `npm run quality`.
