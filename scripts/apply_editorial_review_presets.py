"""
apply_editorial_review_presets.py

Apply explicit editorial review presets to a generated review template.

Usage:
    .venv/bin/python scripts/apply_editorial_review_presets.py \
      --template content/catalog/batches/google-fonts-batch-001/editorial-review/editorial-review-template.json \
      --presets content/catalog/batches/google-fonts-batch-001/editorial-review/editorial-review.presets.json \
      --output content/catalog/batches/google-fonts-batch-001/editorial-review/editorial-review.completed.json
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply explicit editorial review presets to a review template.")
    parser.add_argument("--template", required=True)
    parser.add_argument("--presets", required=True)
    parser.add_argument("--output", required=True)
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
    template_path = Path(args.template).expanduser().resolve()
    presets_path = Path(args.presets).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    template = load_payload(template_path)
    presets = load_payload(presets_path)

    preset_by_slug = {record["typeface_slug"]: record for record in presets["records"]}
    missing_presets: list[str] = []

    for record in template["records"]:
        slug = record["typeface_slug"]
        preset = preset_by_slug.get(slug)
        if preset is None:
            missing_presets.append(slug)
            continue

        if "primary_category" in preset:
            record["primary_category"] = preset["primary_category"]
        if "review_fields" in preset:
            record["review_fields"] = preset["review_fields"]
        record["review_status"] = preset.get("review_status", "approved")
        record["review_notes"] = preset.get("review_notes", "")

    if missing_presets:
        raise SystemExit(f"Missing presets for slugs: {', '.join(sorted(missing_presets))}")

    template.setdefault("meta", {})
    template["meta"]["completed_at"] = datetime.now(timezone.utc).isoformat()
    template["meta"]["status"] = "completed_editorial_review"
    template["meta"]["source_presets"] = str(presets_path)
    write_json(output_path, template)


if __name__ == "__main__":
    main()
