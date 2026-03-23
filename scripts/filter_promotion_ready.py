"""
filter_promotion_ready.py

Filter promotion-ready artifacts to keep only typefaces that are not already
present in the main catalog.

Usage:
    .venv/bin/python scripts/filter_promotion_ready.py \
      --promotion-dir content/catalog/batches/google-fonts-batch-001/promotion-ready \
      --catalog-dir content/catalog \
      --output-dir content/catalog/batches/google-fonts-batch-001/promotion-ready-new
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Filter promotion-ready artifacts against the current main catalog.")
    parser.add_argument("--promotion-dir", required=True)
    parser.add_argument("--catalog-dir", default="content/catalog")
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
    promotion_dir = Path(args.promotion_dir).expanduser().resolve()
    catalog_dir = Path(args.catalog_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    current_typefaces = load_payload(catalog_dir / "typefaces-core.json")
    current_slugs = {record["typeface_slug"] for record in current_typefaces["records"]}

    typefaces = load_payload(promotion_dir / "typefaces-core.promotion-ready.json")
    runtime = load_payload(promotion_dir / "font-runtime-assets.promotion-ready.json")
    expert = load_payload(promotion_dir / "expert-answer-keys.promotion-ready.json")

    keep_slugs = [record["typeface_slug"] for record in typefaces["records"] if record["typeface_slug"] not in current_slugs]
    keep_slug_set = set(keep_slugs)
    skipped_slugs = [record["typeface_slug"] for record in typefaces["records"] if record["typeface_slug"] in current_slugs]

    filtered_typefaces = [record for record in typefaces["records"] if record["typeface_slug"] in keep_slug_set]
    filtered_runtime = [record for record in runtime["records"] if record["typeface_slug"] in keep_slug_set]
    filtered_expert = [record for record in expert["records"] if record["typeface_slug"] in keep_slug_set]

    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "promotion_dir": str(promotion_dir),
        "catalog_dir": str(catalog_dir),
        "counts": {
            "input_typefaces_total": len(typefaces["records"]),
            "new_typefaces_total": len(filtered_typefaces),
            "skipped_existing_total": len(skipped_slugs),
        },
        "skipped_existing_slugs": skipped_slugs,
        "notes": [
            "This filter keeps only slugs not already present in the current main catalog.",
        ],
    }

    write_json(output_dir / "typefaces-core.promotion-ready.json", {"meta": meta, "records": filtered_typefaces})
    write_json(output_dir / "font-runtime-assets.promotion-ready.json", {"meta": meta, "records": filtered_runtime})
    write_json(output_dir / "expert-answer-keys.promotion-ready.json", {"meta": meta, "records": filtered_expert})
    write_json(output_dir / "promotion-filter-report.json", meta)


if __name__ == "__main__":
    main()
