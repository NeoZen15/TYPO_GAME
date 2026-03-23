"""
stage_catalog_promotion.py

Build semi-automatic staging files from a candidate queue or review batch.

The goal is to fill the safe fields automatically and isolate the remaining
editorial fields that still need review before promotion into the main catalog.

Usage:
    python3 scripts/stage_catalog_promotion.py \
      --input-dir content/catalog/batches/google-fonts-pilot-top-10 \
      --runtime-prepared content/catalog/batches/google-fonts-pilot-top-10/runtime-prep/font-runtime-assets.prepared.json \
      --output-dir content/catalog/batches/google-fonts-pilot-top-10/promotion-stage
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
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

CATEGORY_MAP = {
    "SANS_SERIF": "sans_serif",
    "SERIF": "serif",
    "MONOSPACE": "mono",
    "DISPLAY": "display",
    "HANDWRITING": "display",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create semi-automatic promotion staging files.")
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--runtime-prepared", help="Prepared runtime JSON file produced by prepare_catalog_runtime.py")
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


def detect_input_files(input_dir: Path) -> dict[str, Path]:
    review = {
        "typefaces": input_dir / "typefaces-core.review.json",
        "runtime": input_dir / "font-runtime-assets.review.json",
        "expert": input_dir / "expert-answer-keys.review.json",
    }
    candidates = {
        "typefaces": input_dir / "typefaces-core.candidates.json",
        "runtime": input_dir / "font-runtime-assets.candidates.json",
        "expert": input_dir / "expert-answer-keys.candidates.json",
    }

    if all(path.exists() for path in review.values()):
        return review
    if all(path.exists() for path in candidates.values()):
        return candidates
    raise SystemExit(f"No compatible input payloads found in {input_dir}")


def lookup_by_slug(records: list[dict]) -> dict[str, dict]:
    lookup: dict[str, dict] = {}
    for record in records:
        slug = record.get("typeface_slug")
        if slug:
            lookup[slug] = record
    return lookup


def infer_primary_category(record: dict) -> str | None:
    guessed = record.get("guessed_google_category")
    if not guessed:
        return None
    return CATEGORY_MAP.get(guessed)


def infer_is_variable_font(record: dict) -> bool:
    sample_paths = record.get("sample_source_paths") or []
    return any("[" in path and "]" in path for path in sample_paths)


def stage_typeface_record(typeface_record: dict, runtime_record: dict | None) -> dict:
    display_name = typeface_record.get("display_name") or typeface_record.get("display_name_guess")
    staged = {
        "typeface_slug": typeface_record["typeface_slug"],
        "display_name": display_name,
        "display_name_ascii": typeface_record.get("display_name_ascii"),
        "primary_category": infer_primary_category(typeface_record),
        "sub_category": None,
        "visual_cluster_id": None,
        "dreyfus_tier": None,
        "difficulty_base": None,
        "rarity_tag": None,
        "activation_status": False,
        "font_source": typeface_record.get("guessed_font_source") or "google",
        "is_variable_font": infer_is_variable_font(typeface_record),
        "year_tag": None,
        "weight_structure": None,
        "contrast_profile": None,
        "aperture_profile": None,
        "structural_signature": None,
        "release_year": None,
        "designer": typeface_record.get("guessed_designer"),
        "foundry": None,
        "license_type": typeface_record.get("guessed_license_type") or "unknown",
        "license_url": None,
        "fallback_stack": None,
        "expert_enabled": False,
        "min_mode": "training",
        "qa_status": "review",
        "notes": [
            "staged automatically from candidate/review batch",
            "safe fields were auto-filled; editorial fields still require review",
        ],
        "_review_required": [field for field in REVIEW_FIELDS],
        "_runtime_ready": bool(runtime_record and runtime_record.get("runtime_status") == "ready"),
        "_source_batch": typeface_record.get("batch_id"),
        "_priority": typeface_record.get("priority"),
        "_lane": typeface_record.get("lane"),
    }
    return staged


def stage_expert_record(expert_record: dict) -> dict:
    answer_text = expert_record.get("answer_text") or expert_record.get("answer_text_guess")
    return {
        "typeface_slug": expert_record["typeface_slug"],
        "answer_text": answer_text,
        "answer_normalized": expert_record["answer_normalized"],
        "is_canonical": True,
        "locale": expert_record.get("locale", "any"),
        "qa_status": "review",
        "notes": [
            "staged automatically from candidate/review batch",
            "canonical answer should be editor-reviewed before approval",
        ],
    }


def stage_runtime_record(typeface_slug: str, prepared_runtime_record: dict | None) -> dict:
    if prepared_runtime_record is None:
        return {
            "typeface_slug": typeface_slug,
            "runtime_status": "blocked",
            "notes": ["runtime preparation has not produced a ready asset yet"],
        }
    return prepared_runtime_record


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    files = detect_input_files(input_dir)
    typefaces_payload = load_payload(files["typefaces"])
    expert_payload = load_payload(files["expert"])
    prepared_runtime_lookup: dict[str, dict] = {}
    if args.runtime_prepared:
        prepared_runtime_payload = load_payload(Path(args.runtime_prepared).expanduser().resolve())
        prepared_runtime_lookup = lookup_by_slug(prepared_runtime_payload["records"])

    expert_lookup = lookup_by_slug(expert_payload["records"])

    staged_typefaces: list[dict] = []
    staged_runtime: list[dict] = []
    staged_expert: list[dict] = []
    review_field_counter: Counter[str] = Counter()
    runtime_ready = 0

    for typeface_record in typefaces_payload["records"]:
        slug = typeface_record["typeface_slug"]
        staged_typeface = stage_typeface_record(typeface_record, prepared_runtime_lookup.get(slug))
        staged_runtime_record = stage_runtime_record(slug, prepared_runtime_lookup.get(slug))
        staged_expert_record = stage_expert_record(expert_lookup[slug])

        staged_typefaces.append(staged_typeface)
        staged_runtime.append(staged_runtime_record)
        staged_expert.append(staged_expert_record)
        review_field_counter.update(staged_typeface["_review_required"])
        if staged_typeface["_runtime_ready"]:
            runtime_ready += 1

    built_at = datetime.now(timezone.utc).isoformat()
    write_json(
        output_dir / "typefaces-core.staged.json",
        {"meta": {"built_at": built_at, "record_count": len(staged_typefaces)}, "records": staged_typefaces},
    )
    write_json(
        output_dir / "font-runtime-assets.staged.json",
        {"meta": {"built_at": built_at, "record_count": len(staged_runtime)}, "records": staged_runtime},
    )
    write_json(
        output_dir / "expert-answer-keys.staged.json",
        {"meta": {"built_at": built_at, "record_count": len(staged_expert)}, "records": staged_expert},
    )
    write_json(
        output_dir / "promotion-stage-meta.json",
        {
            "built_at": built_at,
            "input_dir": str(input_dir),
            "counts": {
                "typefaces_total": len(staged_typefaces),
                "runtime_ready_total": runtime_ready,
                "runtime_blocked_total": len(staged_typefaces) - runtime_ready,
                "expert_total": len(staged_expert),
            },
            "review_field_counts": dict(review_field_counter),
            "notes": [
                "These staging files are semi-automatic promotion inputs, not yet main catalog overrides.",
                "Only safe fields are auto-filled; editorial classification still needs review.",
            ],
        },
    )


if __name__ == "__main__":
    main()
