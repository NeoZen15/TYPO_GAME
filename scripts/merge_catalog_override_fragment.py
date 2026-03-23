"""
merge_catalog_override_fragment.py

Merge a fragment payload into one of the main catalog override files.

Usage:
    .venv/bin/python scripts/merge_catalog_override_fragment.py \
      --catalog-dir content/catalog \
      --dataset typefaces_core \
      --fragment content/catalog/candidates/google-fonts-snapshot/mass-catalog-promotion/typefaces-core.mass-catalog.json \
      --note "google-fonts mass catalog promotion merged into overrides"
"""

from __future__ import annotations

import argparse
import copy
import json
from datetime import datetime, timezone
from pathlib import Path

DATASETS = {
    "typefaces_core": {
        "overrides": "overrides/typefaces-core.overrides.json",
        "key_fields": ("typeface_slug",),
    },
    "font_runtime_assets": {
        "overrides": "overrides/font-runtime-assets.overrides.json",
        "key_fields": ("typeface_slug", "file_role", "weight", "style"),
    },
    "expert_answer_keys": {
        "overrides": "overrides/expert-answer-keys.overrides.json",
        "key_fields": ("typeface_slug", "answer_normalized", "locale"),
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Merge a fragment into a catalog override file.")
    parser.add_argument("--catalog-dir", default="content/catalog")
    parser.add_argument("--dataset", choices=sorted(DATASETS))
    parser.add_argument("--fragment", required=True)
    parser.add_argument("--note", required=True)
    parser.add_argument(
        "--merge-mode",
        choices=("smart", "preserve_existing", "prefer_incoming"),
        default="smart",
        help="How to handle keys that already exist in overrides.",
    )
    return parser.parse_args()


def load_payload(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or "records" not in payload or not isinstance(payload["records"], list):
        raise SystemExit(f"Invalid payload format in {path}")
    payload.setdefault("meta", {})
    return payload


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def record_key(record: dict, key_fields: tuple[str, ...], path: Path) -> tuple:
    missing = [field for field in key_fields if field not in record]
    if missing:
        raise SystemExit(f"Missing key fields {missing} in {path}: {record}")
    return tuple(record[field] for field in key_fields)


def dedupe_notes(notes: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for note in notes:
        if note not in seen:
            seen.add(note)
            result.append(note)
    return result


def is_auto_mass_review_record(record: dict | None, dataset_name: str) -> bool:
    if not record:
        return False
    notes = record.get("notes") or []
    has_auto_note = any(
        isinstance(note, str) and "mass-catalogued automatically from google/fonts snapshot" in note
        for note in notes
    )
    if not has_auto_note:
        return False
    if record.get("qa_status") != "review":
        return False
    # Only typefaces_core records are safe to refresh automatically in smart mode.
    # Expert answer keys may already contain human edits while still being in review.
    if dataset_name != "typefaces_core":
        return False
    if bool(record.get("activation_status", False)):
        return False
    if bool(record.get("expert_enabled", False)):
        return False
    return True


def merge_notes(existing: dict | None, incoming: dict) -> list[str] | None:
    notes: list[str] = []
    if existing and existing.get("notes"):
        notes.extend(existing["notes"])
    if incoming.get("notes"):
        notes.extend(incoming["notes"])
    return dedupe_notes(notes) if notes else None


def merge_records(existing: dict | None, incoming: dict, merge_mode: str, dataset_name: str) -> dict:
    if existing is None:
        return copy.deepcopy(incoming)

    if merge_mode == "prefer_incoming":
        merged = copy.deepcopy(incoming)
        notes = merge_notes(existing, incoming)
        if notes is not None:
            merged["notes"] = notes
        return merged

    if (
        merge_mode == "smart"
        and is_auto_mass_review_record(existing, dataset_name)
        and is_auto_mass_review_record(incoming, dataset_name)
    ):
        merged = copy.deepcopy(incoming)
        notes = merge_notes(existing, incoming)
        if notes is not None:
            merged["notes"] = notes
        return merged

    merged = copy.deepcopy(existing)
    for field, value in incoming.items():
        if field == "notes":
            continue
        if field not in merged or merged[field] is None:
            merged[field] = copy.deepcopy(value)
    notes = merge_notes(existing, incoming)
    if notes is not None:
        merged["notes"] = notes
    return merged


def main() -> None:
    args = parse_args()
    catalog_dir = Path(args.catalog_dir).expanduser().resolve()
    fragment_path = Path(args.fragment).expanduser().resolve()
    dataset = DATASETS[args.dataset]
    overrides_path = catalog_dir / dataset["overrides"]
    key_fields = dataset["key_fields"]

    overrides_payload = load_payload(overrides_path)
    fragment_payload = load_payload(fragment_path)

    merged_by_key: dict[tuple, dict] = {}
    for record in overrides_payload["records"]:
        merged_by_key[record_key(record, key_fields, overrides_path)] = record

    added = 0
    patched = 0
    for record in fragment_payload["records"]:
        key = record_key(record, key_fields, fragment_path)
        if key in merged_by_key:
            patched += 1
        else:
            added += 1
        merged_by_key[key] = merge_records(merged_by_key.get(key), record, args.merge_mode, args.dataset)

    overrides_payload["records"] = [merged_by_key[key] for key in sorted(merged_by_key)]
    notes = list(overrides_payload.get("meta", {}).get("notes") or [])
    notes.append(args.note)
    overrides_payload.setdefault("meta", {})
    overrides_payload["meta"]["last_reviewed_at"] = datetime.now(timezone.utc).isoformat()
    overrides_payload["meta"]["notes"] = dedupe_notes(notes)
    overrides_payload["meta"]["last_merge"] = {
        "dataset": args.dataset,
                "fragment": str(fragment_path),
                "added": added,
                "patched": patched,
                "merge_mode": args.merge_mode,
                "merged_at": datetime.now(timezone.utc).isoformat(),
            }

    write_json(overrides_path, overrides_payload)
    print(
        json.dumps(
            {
                "dataset": args.dataset,
                "overrides_path": str(overrides_path),
                "fragment": str(fragment_path),
                "added": added,
                "patched": patched,
                "merge_mode": args.merge_mode,
                "total_override_records": len(overrides_payload["records"]),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
