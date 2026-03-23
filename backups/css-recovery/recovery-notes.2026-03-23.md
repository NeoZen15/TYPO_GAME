# CSS Recovery Notes

Target file: `app/globals.css`

Recovered artifacts copied into this folder:

- `globals.current.2026-03-23.css`: safe copy of the current working file.
- `globals.cursor-Cj0X.2026-03-23-004855.css`: small Cursor snapshot from `2026-03-23 00:48:55`.
- `globals.cursor-mkgD.2026-03-23-105951.css`: Cursor snapshot from `2026-03-23 10:59:51`.
- `globals.cursor-Iilr.2026-03-23-142619.css`: Cursor snapshot from `2026-03-23 14:26:19`.
- `globals.cursor-MOuB.2026-03-23-142623.css`: Cursor snapshot from `2026-03-23 14:26:23`.
- `globals.recovery-merged.2026-03-23.css`: best-effort recovery candidate based on the current file plus the recent missing selectors found in Cursor snapshots.

What was confirmed:

- No local snapshot was found for `2026-03-21` or `2026-03-22`.
- Git history only preserves the initial `app/globals.css` version from `2026-02-19 21:49:17`.
- The current file is structurally closest to the recent Cursor snapshots from `2026-03-23 14:26`.

Best testing order:

1. `globals.current.2026-03-23.css`
2. `globals.recovery-merged.2026-03-23.css`
3. `globals.cursor-Iilr.2026-03-23-142619.css`
4. `globals.cursor-MOuB.2026-03-23-142623.css`
5. `globals.cursor-mkgD.2026-03-23-105951.css`

Notes:

- `globals.recovery-merged.2026-03-23.css` only adds selectors that were present in the recent snapshots but missing from the current file.
- The `Cj0X` snapshot is much older in style and much smaller; treat it as an archive, not the main recovery base.
