"""
build_catalog.py

Merge machine-generated seed JSON files with human override JSON files to
produce final import-ready catalog files in `content/catalog/`.

Usage:
    .venv/bin/python scripts/build_catalog.py
    .venv/bin/python scripts/build_catalog.py --catalog-dir content/catalog
"""

from __future__ import annotations

import argparse
import copy
import json
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_CATALOG_DIR = Path("content/catalog")

SPECIAL_OVERRIDE_FIELDS = {"_delete", "notes_append", "notes_remove"}

DATASETS = (
    {
        "name": "typefaces_core",
        "seed": "typefaces-core.seed.json",
        "overrides": "overrides/typefaces-core.overrides.json",
        "output": "typefaces-core.json",
        "key_fields": ("typeface_slug",),
    },
    {
        "name": "font_runtime_assets",
        "seed": "font-runtime-assets.seed.json",
        "overrides": "overrides/font-runtime-assets.overrides.json",
        "output": "font-runtime-assets.json",
        "key_fields": ("typeface_slug", "file_role", "weight", "style"),
    },
    {
        "name": "expert_answer_keys",
        "seed": "expert-answer-keys.seed.json",
        "overrides": "overrides/expert-answer-keys.overrides.json",
        "output": "expert-answer-keys.json",
        "key_fields": ("typeface_slug", "answer_normalized", "locale"),
    },
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build final catalog JSON from seeds + overrides.")
    parser.add_argument("--catalog-dir", default=str(DEFAULT_CATALOG_DIR))
    return parser.parse_args()


def load_payload(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or "records" not in payload:
        raise ValueError(f"{path} must be an object with a 'records' key")
    if not isinstance(payload["records"], list):
        raise ValueError(f"{path} records must be a list")
    if "meta" not in payload:
        payload["meta"] = {}
    return payload


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def record_key(record: dict, key_fields: tuple[str, ...], path: Path) -> tuple:
    missing = [field for field in key_fields if field not in record]
    if missing:
        raise ValueError(f"{path} record missing key fields {missing}: {record}")
    return tuple(record[field] for field in key_fields)


def dedupe_notes(notes: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for note in notes:
        if note not in seen:
            seen.add(note)
            deduped.append(note)
    return deduped


def merge_record(base: dict | None, override: dict) -> dict:
    merged = copy.deepcopy(base) if base is not None else {}

    for field, value in override.items():
        if field in SPECIAL_OVERRIDE_FIELDS:
            continue
        merged[field] = copy.deepcopy(value)

    notes = list(merged.get("notes") or [])
    if "notes" in override:
        notes = list(copy.deepcopy(override.get("notes") or []))

    notes_remove = override.get("notes_remove") or []
    if notes_remove:
        notes = [note for note in notes if note not in set(notes_remove)]

    notes_append = override.get("notes_append") or []
    if notes_append:
        notes.extend(notes_append)

    if notes or "notes" in override or notes_append or notes_remove:
        merged["notes"] = dedupe_notes(notes)

    return merged


def apply_overrides(seed_records: list[dict], override_records: list[dict], key_fields: tuple[str, ...], seed_path: Path, override_path: Path) -> tuple[list[dict], dict]:
    merged_by_key: dict[tuple, dict] = {}

    for record in seed_records:
        key = record_key(record, key_fields, seed_path)
        if key in merged_by_key:
            raise ValueError(f"Duplicate key {key} in {seed_path}")
        merged_by_key[key] = copy.deepcopy(record)

    stats = {"patched": 0, "added": 0, "deleted": 0}

    for override in override_records:
        key = record_key(override, key_fields, override_path)
        should_delete = bool(override.get("_delete"))
        existing = merged_by_key.get(key)

        if should_delete:
            if existing is None:
                raise ValueError(f"Cannot delete missing record {key} in {override_path}")
            del merged_by_key[key]
            stats["deleted"] += 1
            continue

        merged_record = merge_record(existing, override)
        if existing is None:
            stats["added"] += 1
        else:
            stats["patched"] += 1
        merged_by_key[key] = merged_record

    merged_records = [merged_by_key[key] for key in sorted(merged_by_key)]
    return merged_records, stats


def build_dataset(catalog_dir: Path, dataset: dict, built_at: str) -> tuple[dict, dict]:
    seed_path = catalog_dir / dataset["seed"]
    override_path = catalog_dir / dataset["overrides"]
    output_path = catalog_dir / dataset["output"]

    seed_payload = load_payload(seed_path)
    override_payload = load_payload(override_path)

    records, stats = apply_overrides(
        seed_payload["records"],
        override_payload["records"],
        dataset["key_fields"],
        seed_path,
        override_path,
    )

    output_payload = {
        "meta": {
            "built_at": built_at,
            "source_seed": str(seed_path.relative_to(catalog_dir.parent.parent if catalog_dir.parts[-2:] == ("content", "catalog") else catalog_dir.parent)),
            "source_overrides": str(override_path.relative_to(catalog_dir.parent.parent if catalog_dir.parts[-2:] == ("content", "catalog") else catalog_dir.parent)),
            "record_count": len(records),
            "override_stats": stats,
        },
        "records": records,
    }
    write_json(output_path, output_payload)

    return output_payload, stats


def build_meta_payload(catalog_dir: Path, built_at: str, outputs: dict[str, dict], stats: dict[str, dict]) -> dict:
    typeface_records = outputs["typefaces_core"]["records"]
    runtime_records = outputs["font_runtime_assets"]["records"]
    expert_records = outputs["expert_answer_keys"]["records"]

    return {
        "built_at": built_at,
        "status": "built",
        "sources": {
            "catalog_dir": str(catalog_dir),
            "seeds": [dataset["seed"] for dataset in DATASETS],
            "overrides": [dataset["overrides"] for dataset in DATASETS],
        },
        "counts": {
            "typefaces_total": len(typeface_records),
            "typefaces_active": sum(1 for item in typeface_records if item.get("activation_status")),
            "expert_enabled_total": sum(1 for item in typeface_records if item.get("expert_enabled")),
            "runtime_assets_total": len(runtime_records),
            "runtime_assets_ready": sum(1 for item in runtime_records if item.get("runtime_status") == "ready"),
            "runtime_assets_system_local": sum(1 for item in runtime_records if item.get("runtime_status") == "system_local"),
            "expert_answer_keys_total": len(expert_records),
            "expert_answer_keys_approved": sum(1 for item in expert_records if item.get("qa_status") == "approved"),
        },
        "override_stats": stats,
        "notes": [
            "Built catalog files are the import-ready outputs for DB ingestion.",
            "Do not edit built files manually; rerun the seed generator or update overrides instead.",
        ],
    }


def main() -> None:
    args = parse_args()
    catalog_dir = Path(args.catalog_dir).expanduser().resolve()
    catalog_dir.mkdir(parents=True, exist_ok=True)

    built_at = datetime.now(timezone.utc).isoformat()
    outputs: dict[str, dict] = {}
    stats: dict[str, dict] = {}

    for dataset in DATASETS:
        output_payload, dataset_stats = build_dataset(catalog_dir, dataset, built_at)
        outputs[dataset["name"]] = output_payload
        stats[dataset["name"]] = dataset_stats

    meta_payload = build_meta_payload(catalog_dir, built_at, outputs, stats)
    write_json(catalog_dir / "catalog-build-meta.json", meta_payload)


if __name__ == "__main__":
    main()
