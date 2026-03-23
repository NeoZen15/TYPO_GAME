"""
audit_catalog_promotion.py

Audit a candidate queue or review batch and classify each typeface by promotion
readiness.

This script does not promote records. It answers a simpler question:
- what is already known,
- what is blocked by editorial gaps,
- what is blocked by runtime preparation,
- what is close to promotion.

Usage:
    python3 scripts/audit_catalog_promotion.py \
      --input-dir content/catalog/batches/google-fonts-pilot-top-10 \
      --catalog-dir content/catalog \
      --output content/catalog/batches/google-fonts-pilot-top-10/promotion-audit.json

    python3 scripts/audit_catalog_promotion.py \
      --input-dir content/catalog/candidates/google-fonts-snapshot \
      --catalog-dir content/catalog \
      --output content/catalog/candidates/google-fonts-snapshot/promotion-audit.json
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

EDITORIAL_REQUIRED_FIELDS = (
    "primary_category",
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
)

READY_RUNTIME_STATUSES = {"ready", "ready_for_mirroring"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit promotion readiness for catalog candidates or review batches.")
    parser.add_argument("--input-dir", required=True, help="Directory containing candidate or review JSON files.")
    parser.add_argument("--catalog-dir", default="content/catalog", help="Built catalog directory for known-slug comparison.")
    parser.add_argument("--output", required=True, help="Output JSON report path.")
    return parser.parse_args()


def detect_dataset_files(input_dir: Path) -> dict[str, Path]:
    candidates = {
        "typefaces": input_dir / "typefaces-core.candidates.json",
        "runtime": input_dir / "font-runtime-assets.candidates.json",
        "expert": input_dir / "expert-answer-keys.candidates.json",
    }
    review = {
        "typefaces": input_dir / "typefaces-core.review.json",
        "runtime": input_dir / "font-runtime-assets.review.json",
        "expert": input_dir / "expert-answer-keys.review.json",
    }
    staged = {
        "typefaces": input_dir / "typefaces-core.staged.json",
        "runtime": input_dir / "font-runtime-assets.staged.json",
        "expert": input_dir / "expert-answer-keys.staged.json",
    }

    if all(path.exists() for path in review.values()):
        return review
    if all(path.exists() for path in staged.values()):
        return staged
    if all(path.exists() for path in candidates.values()):
        return candidates
    raise SystemExit(f"No compatible candidate/review payload set found in {input_dir}")


def load_payload(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or "records" not in payload or not isinstance(payload["records"], list):
        raise SystemExit(f"Invalid payload format in {path}")
    return payload


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def load_known_slugs(catalog_dir: Path) -> set[str]:
    payload = load_payload(catalog_dir / "typefaces-core.json")
    return {record["typeface_slug"] for record in payload["records"]}


def lookup_by_slug(records: list[dict]) -> dict[str, dict]:
    lookup: dict[str, dict] = {}
    for record in records:
        slug = record.get("typeface_slug")
        if slug:
            lookup[slug] = record
    return lookup


def display_name(record: dict) -> str | None:
    return record.get("display_name") or record.get("display_name_guess")


def collect_editorial_blockers(typeface_record: dict) -> list[str]:
    missing = [field for field in EDITORIAL_REQUIRED_FIELDS if not typeface_record.get(field)]
    blockers: list[str] = []

    if missing:
        blockers.append("missing_editorial_fields")
    if "structural_signature" in missing:
        blockers.append("missing_structural_signature")
    return list(dict.fromkeys(blockers))


def collect_runtime_blockers(runtime_record: dict | None) -> list[str]:
    if runtime_record is None:
        return ["missing_runtime_record"]

    blockers: list[str] = []
    runtime_status = runtime_record.get("runtime_candidate_status") or runtime_record.get("runtime_status")
    has_woff2 = runtime_record.get("has_woff2")
    available_formats = set(runtime_record.get("available_formats") or [])

    if runtime_status == "blocked":
        blockers.append("runtime_blocked")
    elif runtime_status == "system_local":
        blockers.append("system_local_only")
    elif has_woff2 is False or (runtime_status and "conversion" in str(runtime_status)):
        blockers.append("needs_runtime_conversion_or_mirroring")
    elif not has_woff2 and "woff2" not in available_formats and runtime_status not in READY_RUNTIME_STATUSES:
        blockers.append("runtime_not_ready")

    preferred_source_path = runtime_record.get("preferred_source_path") or runtime_record.get("relative_path") or runtime_record.get("runtime_path")
    if not preferred_source_path:
        blockers.append("missing_runtime_source_path")

    return list(dict.fromkeys(blockers))


def collect_warnings(typeface_record: dict, runtime_record: dict | None, expert_record: dict | None) -> list[str]:
    warnings: list[str] = []

    if "display_name" not in typeface_record and typeface_record.get("display_name_guess"):
        warnings.append("display_name_is_still_a_guess")
    if typeface_record.get("guessed_license_type") and not typeface_record.get("license_type"):
        warnings.append("license_is_still_guessed")
    if typeface_record.get("guessed_google_category"):
        warnings.append("google_category_needs_local_mapping")
    if expert_record and expert_record.get("review_status") == "needs_editorial_review":
        warnings.append("expert_answer_not_reviewed")
    if runtime_record and runtime_record.get("runtime_candidate_status") == "needs_conversion_or_mirroring":
        warnings.append("runtime_source_exists_but_is_not_web_ready")

    return warnings


def classify_record(slug: str, typeface_record: dict, runtime_record: dict | None, expert_record: dict | None, known_slugs: set[str]) -> dict:
    blockers: list[str] = []
    warnings: list[str] = []

    if slug in known_slugs:
        status = "already_in_catalog"
        warnings.append("slug_already_exists_in_main_catalog")
    else:
        blockers.extend(collect_editorial_blockers(typeface_record))
        blockers.extend(collect_runtime_blockers(runtime_record))
        warnings.extend(collect_warnings(typeface_record, runtime_record, expert_record))

        if not blockers:
            status = "ready_for_promotion"
        elif all(blocker in {"needs_runtime_conversion_or_mirroring", "runtime_not_ready"} for blocker in blockers):
            status = "editorial_ready_runtime_blocked"
        else:
            status = "needs_review"

    return {
        "typeface_slug": slug,
        "display_name": display_name(typeface_record),
        "status": status,
        "priority": typeface_record.get("priority"),
        "lane": typeface_record.get("lane"),
        "promotion_status": typeface_record.get("promotion_status"),
        "blockers": sorted(set(blockers)),
        "warnings": sorted(set(warnings)),
        "summary": {
            "available_formats": runtime_record.get("available_formats") if runtime_record else [],
            "runtime_candidate_status": (runtime_record or {}).get("runtime_candidate_status") or (runtime_record or {}).get("runtime_status"),
            "guessed_license_type": typeface_record.get("guessed_license_type") or typeface_record.get("license_type"),
            "source_file_count": typeface_record.get("source_file_count") or (runtime_record or {}).get("source_file_count"),
        },
    }


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input_dir).expanduser().resolve()
    catalog_dir = Path(args.catalog_dir).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    dataset_files = detect_dataset_files(input_dir)
    typefaces_payload = load_payload(dataset_files["typefaces"])
    runtime_payload = load_payload(dataset_files["runtime"])
    expert_payload = load_payload(dataset_files["expert"])
    known_slugs = load_known_slugs(catalog_dir)

    runtime_lookup = lookup_by_slug(runtime_payload["records"])
    expert_lookup = lookup_by_slug(expert_payload["records"])

    audited_records: list[dict] = []
    status_counts: Counter[str] = Counter()
    blocker_counts: Counter[str] = Counter()
    warning_counts: Counter[str] = Counter()

    for typeface_record in typefaces_payload["records"]:
        slug = typeface_record["typeface_slug"]
        audited = classify_record(slug, typeface_record, runtime_lookup.get(slug), expert_lookup.get(slug), known_slugs)
        audited_records.append(audited)
        status_counts[audited["status"]] += 1
        blocker_counts.update(audited["blockers"])
        warning_counts.update(audited["warnings"])

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_dir": str(input_dir),
        "catalog_dir": str(catalog_dir),
        "counts": {
            "records_total": len(audited_records),
            "known_catalog_slugs": len(known_slugs),
        },
        "status_counts": dict(status_counts),
        "blocker_counts": dict(blocker_counts),
        "warning_counts": dict(warning_counts),
        "notes": [
            "This is a promotion readiness audit, not an import operation.",
            "A typeface can exist as a candidate while still being blocked for promotion.",
        ],
        "records": audited_records,
    }

    write_json(output_path, payload)


if __name__ == "__main__":
    main()
