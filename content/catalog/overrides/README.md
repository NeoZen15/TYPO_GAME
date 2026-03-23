# Catalog Overrides

This folder contains the human-edited layer of the catalog.

Use it when the machine-generated seeds are structurally correct, but still need
editorial or product decisions.

The intent is simple:

- machine output stays rerunnable,
- human edits stay small and reviewable,
- final import files are rebuilt from both.

## Files

- `typefaces-core.overrides.json`
- `font-runtime-assets.overrides.json`
- `expert-answer-keys.overrides.json`

Each file follows the same wrapper format:

```json
{
  "meta": {
    "purpose": "human overrides for ...",
    "last_reviewed_at": null,
    "notes": []
  },
  "records": []
}
```

## Merge rules

Every override record is matched against an existing seed record by its key:

- `typefaces-core`: `typeface_slug`
- `font-runtime-assets`: `typeface_slug + file_role + weight + style`
- `expert-answer-keys`: `typeface_slug + answer_normalized + locale`

If the key already exists:

- scalar/object fields replace the seed value
- `notes_append` adds notes without duplicating them
- `notes_remove` removes exact matching note strings
- `notes` replaces the full notes array if you want explicit control

If the key does not exist:

- the record is added as a new record

If `_delete` is `true`:

- the matching record is removed from the final built output

## Special fields

These fields are reserved for override behavior and are never written to the
final built catalog:

- `_delete`
- `notes_append`
- `notes_remove`

## Example

```json
{
  "typeface_slug": "arial",
  "activation_status": false,
  "license_type": "proprietary",
  "notes_append": [
    "disabled until a libre replacement is mirrored"
  ]
}
```

## Rule of thumb

- edit seeds only by rerunning the generator
- edit overrides for human decisions
- import only the built outputs
