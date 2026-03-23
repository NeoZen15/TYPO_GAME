# Catalog Batches

This folder contains explicit promotion batches selected from larger candidate
queues.

These files sit between:

1. large auto-generated candidates
2. the main import-ready catalog

They answer a practical need:

- we do not want to promote `2000+` families at once,
- we do want a clear, reviewable first lot.

## Workflow

1. generate a large candidate queue
2. create a batch selection file
3. build review batch outputs
4. run promotion prep (`audit` -> `runtime prep` -> `staging`)
5. generate an editorial review template
6. review and enrich the selected records
7. validate the completed review with the promotion builder
8. only then promote into catalog overrides / main catalog

## Important

Batch files are not DB-ready import files.

They are curated review packets.

## Current batches

- `google-fonts-batch-001`
  - broad first batch of 50 families from the Google Fonts snapshot
  - runtime prep completed
  - editorial review template generated
  - editorial presets applied
  - `40` new slugs promoted into the main catalog
  - `10` already-known slugs filtered out before merge
- `google-fonts-pilot-top-10`
  - compact pilot batch used to validate the workflow before promoting larger waves
  - runtime prep completed
  - editorial review template generated
  - promotion validator in place and tested in blocked state
  - then fully promoted and synced into DB
