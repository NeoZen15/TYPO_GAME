"""
build_candidate_batch.py

Create a curated review batch from a large candidate queue.

Usage:
    python3 scripts/build_candidate_batch.py \
      --selection content/catalog/batches/google-fonts-batch-001.selection.json \
      --candidates-dir content/catalog/candidates/google-fonts-snapshot \
      --output-dir content/catalog/batches/google-fonts-batch-001
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a curated review batch from candidate files.")
    parser.add_argument("--selection", required=True)
    parser.add_argument("--candidates-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    return parser.parse_args()


def load_payload(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or "records" not in payload:
        raise ValueError(f"{path} must contain an object with 'records'")
    return payload


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def build_lookup(records: list[dict], key: str) -> dict[str, dict]:
    lookup: dict[str, dict] = {}
    for record in records:
        lookup[record[key]] = record
    return lookup


def annotate(record: dict, selection_entry: dict, batch_id: str) -> dict:
    merged = dict(record)
    merged["batch_id"] = batch_id
    merged["promotion_status"] = "selected_for_review"
    merged["priority"] = selection_entry["priority"]
    merged["lane"] = selection_entry["lane"]
    merged["rationale"] = selection_entry["rationale"]
    merged["next_steps"] = [
        "review editorial classification",
        "decide promotion order",
        "prepare runtime-ready asset path if selected for activation",
    ]
    return merged


def main() -> None:
    args = parse_args()
    selection_path = Path(args.selection).expanduser().resolve()
    candidates_dir = Path(args.candidates_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    selection_payload = load_payload(selection_path)
    typefaces_payload = load_payload(candidates_dir / "typefaces-core.candidates.json")
    runtime_payload = load_payload(candidates_dir / "font-runtime-assets.candidates.json")
    expert_payload = load_payload(candidates_dir / "expert-answer-keys.candidates.json")

    batch_id = selection_payload["meta"]["batch_id"]
    selected = selection_payload["records"]

    typeface_lookup = build_lookup(typefaces_payload["records"], "typeface_slug")
    runtime_lookup = build_lookup(runtime_payload["records"], "typeface_slug")
    expert_lookup = build_lookup(expert_payload["records"], "typeface_slug")

    selected_typefaces = []
    selected_runtime = []
    selected_expert = []
    missing = []

    for entry in selected:
        slug = entry["typeface_slug"]
        if slug not in typeface_lookup or slug not in runtime_lookup or slug not in expert_lookup:
            missing.append(slug)
            continue
        selected_typefaces.append(annotate(typeface_lookup[slug], entry, batch_id))
        selected_runtime.append(annotate(runtime_lookup[slug], entry, batch_id))
        selected_expert.append(annotate(expert_lookup[slug], entry, batch_id))

    if missing:
        raise SystemExit(f"Missing selected slugs in candidate queue: {missing}")

    built_at = datetime.now(timezone.utc).isoformat()
    lane_counts = Counter(entry["lane"] for entry in selected)
    priority_counts = Counter(entry["priority"] for entry in selected)

    meta_payload = {
        "built_at": built_at,
        "batch_id": batch_id,
        "selection_file": str(selection_path),
        "source_candidates_dir": str(candidates_dir),
        "counts": {
            "selected_total": len(selected),
            "typefaces_records": len(selected_typefaces),
            "runtime_records": len(selected_runtime),
            "expert_records": len(selected_expert),
        },
        "lane_counts": dict(lane_counts),
        "priority_counts": dict(priority_counts),
        "notes": [
            "This batch is a curated review packet, not a DB-ready import batch.",
            "Selected families should be reviewed and then promoted into main catalog overrides in smaller validated waves.",
        ],
    }

    write_json(output_dir / "batch-meta.json", meta_payload)
    write_json(
        output_dir / "typefaces-core.review.json",
        {"meta": {"built_at": built_at, "record_count": len(selected_typefaces)}, "records": selected_typefaces},
    )
    write_json(
        output_dir / "font-runtime-assets.review.json",
        {"meta": {"built_at": built_at, "record_count": len(selected_runtime)}, "records": selected_runtime},
    )
    write_json(
        output_dir / "expert-answer-keys.review.json",
        {"meta": {"built_at": built_at, "record_count": len(selected_expert)}, "records": selected_expert},
    )


if __name__ == "__main__":
    main()
