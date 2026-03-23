# Catalog Candidates

This folder contains auto-generated candidate families discovered from broader
font sources.

Unlike the main built catalog files, these records are not assumed to be ready
for DB import. They exist to widen the review queue without contaminating the
import-ready catalog.

## Purpose

Use this layer when we want to scan large font corpora and answer:

1. what new families exist locally,
2. which ones are already in the catalog,
3. which unknown families should enter editorial review next.

## Files

- `candidate-scan-meta.json`
  - source directories, counts, and scan summary
- `typefaces-core.candidates.json`
  - non-import-ready typeface candidates needing editorial review
- `font-runtime-assets.candidates.json`
  - runtime asset candidates associated with those families
- `expert-answer-keys.candidates.json`
  - default Expert answer candidates for the same families

## Important

- candidate files are review queues, not DB-ready truth
- built catalog files in `content/catalog/` remain the import source
- candidates can later be promoted into overrides or a reviewed catalog batch

## Current local reality

With the local sources currently available in this workspace, the candidate scan
finds only one unknown family beyond the existing 28-typeface catalog:

- `itc_garamond_std`

It is currently:

- local only
- `ttf` only
- not runtime-ready

So the candidate pipeline is working, but the local source corpus is still far
from a true `1000+` expansion input.

## Generator

- `scripts/generate_catalog_candidates.py`
