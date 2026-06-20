# Typography Profiles Data

This directory is the versioned home for typography measurement data that is intentionally kept in the repository.

## Tracked

- `corpus/`: versioned measurement corpora used by runtime compare logic and validation workflows.
- `diffs/`: durable comparisons between corpus revisions that are useful to keep in history.
- top-level JSON manifests that are part of the current source of truth for the typography pipeline.

## Untracked

- `tmp/`: local export workspace for intermediate files, scratch manifests, and one-off measurements.

## Rule

If a new file is useful only for a local experiment or a one-time export, it belongs in `tmp/` and should not be committed.
