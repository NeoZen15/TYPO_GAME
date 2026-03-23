"""
generate_editorial_review_template.py

Generate a human-review template from staged typeface promotion files.

Outputs:
- JSON template (machine-friendly)
- CSV template (easy to open in spreadsheet tools)

Usage:
    python3 scripts/generate_editorial_review_template.py \
      --staged-typefaces content/catalog/batches/google-fonts-pilot-top-10/promotion-stage/typefaces-core.staged.json \
      --output-dir content/catalog/batches/google-fonts-pilot-top-10/editorial-review
"""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

REVIEW_FIELDS = [
    "sub_category",
    "visual_cluster_id",
    "dreyfus_tier",
    "difficulty_base",
    "rarity_tag",
    "year_tag",
    "weight_structure",
    "contrast_profile",
    "aperture_profile",
    "structural_signature",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate editorial review templates from staged promotion records.")
    parser.add_argument("--staged-typefaces", required=True)
    parser.add_argument("--output-dir", required=True)
    return parser.parse_args()


def load_payload(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or "records" not in payload or not isinstance(payload["records"], list):
        raise SystemExit(f"Invalid payload format in {path}")
    return payload


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    staged_path = Path(args.staged_typefaces).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    payload = load_payload(staged_path)
    records = payload["records"]
    built_at = datetime.now(timezone.utc).isoformat()

    review_records = []
    for record in records:
        review_records.append(
            {
                "typeface_slug": record["typeface_slug"],
                "display_name": record.get("display_name"),
                "primary_category": record.get("primary_category"),
                "designer": record.get("designer"),
                "license_type": record.get("license_type"),
                "priority": record.get("_priority"),
                "lane": record.get("_lane"),
                "runtime_ready": record.get("_runtime_ready"),
                "review_fields": {field: None for field in REVIEW_FIELDS},
                "review_status": "pending",
                "review_notes": "",
            }
        )

    json_payload = {
        "meta": {
            "generated_at": built_at,
            "source_staged_typefaces": str(staged_path),
            "record_count": len(review_records),
            "notes": [
                "Fill the review_fields object for each typeface.",
                "Once completed, use the reviewed-batch promotion builder to emit promotion-ready artifacts.",
            ],
        },
        "records": review_records,
    }
    write_json(output_dir / "editorial-review-template.json", json_payload)

    csv_path = output_dir / "editorial-review-template.csv"
    fieldnames = [
        "typeface_slug",
        "display_name",
        "primary_category",
        "designer",
        "license_type",
        "priority",
        "lane",
        "runtime_ready",
        *REVIEW_FIELDS,
        "review_status",
        "review_notes",
    ]
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for record in review_records:
            row = {
                "typeface_slug": record["typeface_slug"],
                "display_name": record["display_name"],
                "primary_category": record["primary_category"],
                "designer": record["designer"],
                "license_type": record["license_type"],
                "priority": record["priority"],
                "lane": record["lane"],
                "runtime_ready": record["runtime_ready"],
                "review_status": record["review_status"],
                "review_notes": record["review_notes"],
            }
            for field in REVIEW_FIELDS:
                row[field] = None
            writer.writerow(row)


if __name__ == "__main__":
    main()
