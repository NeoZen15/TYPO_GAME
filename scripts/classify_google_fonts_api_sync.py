"""
classify_google_fonts_api_sync.py

Post-process a Google Fonts Developer API sync and classify findings into:
- ignore
- watch
- candidate

This keeps the live sync readable by separating:
- obvious non-product families (icon fonts, experimental entries, legacy drift),
- source-drift items worth keeping an eye on,
- real candidate families that may deserve future catalog promotion.

Usage:
    .venv/bin/python scripts/classify_google_fonts_api_sync.py \
      --sync-dir content/catalog/google-api-sync
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_SYNC_DIR = Path("content/catalog/google-api-sync")

LEGACY_KOREAN = {
    "batang",
    "batangche",
    "dotum",
    "dotumche",
    "gulim",
    "gulimche",
    "gungsuh",
    "gungsuhche",
    "hanna",
    "hannari",
    "jejugothic",
    "jejuhallasan",
    "jejumyeongjo",
    "kopubbatang",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Classify a Google Fonts API sync into ignore/watch/candidate buckets.")
    parser.add_argument("--sync-dir", default=str(DEFAULT_SYNC_DIR))
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def is_material(slug: str) -> bool:
    return slug.startswith("material_")


def is_edu(slug: str) -> bool:
    return slug.startswith("edu_")


def is_google_sans(slug: str) -> bool:
    return slug.startswith("google_sans")


def is_bigshoulders(slug: str) -> bool:
    return slug.startswith("bigshoulders")


def is_noto_ui(slug: str) -> bool:
    return (slug.startswith("notosans") and slug.endswith("ui")) or slug.startswith("notonaskharabicui")


def is_experimental(slug: str) -> bool:
    return "vfbeta" in slug or slug.endswith("alpha") or slug == "notocoloremojicompattest"


def is_jsmath(slug: str) -> bool:
    return slug.startswith("jsmath")


def classify_new(record: dict[str, Any]) -> tuple[str, str]:
    slug = record["typeface_slug"]
    if is_material(slug):
        return "ignore", "icon_font_not_typography_game_candidate"
    if is_edu(slug):
        return "watch", "educational_handwriting_family_low_product_priority"
    if is_google_sans(slug):
        return "candidate", "real_text_family_not_yet_in_local_catalog"
    return "candidate", "new_google_family_requires_editorial_review"


def classify_missing(record: dict[str, Any]) -> tuple[str, str]:
    slug = record["catalog_slug"]
    if record.get("activation_status") or record.get("expert_enabled"):
        return "candidate", "active_or_product_relevant_family_missing_from_api_requires_manual_check"
    if is_material(slug):
        return "ignore", "icon_family_missing_from_api_not_product_relevant"
    if is_jsmath(slug):
        return "ignore", "math_support_family_not_product_relevant"
    if is_experimental(slug):
        return "ignore", "experimental_or_beta_family_not_product_relevant"
    if slug in LEGACY_KOREAN:
        return "watch", "legacy_family_present_in_snapshot_but_not_in_current_api"
    if is_bigshoulders(slug):
        return "watch", "family_variant_group_missing_from_api_worth_tracking"
    if is_noto_ui(slug):
        return "watch", "ui_variant_missing_from_api_worth_tracking"
    return "watch", "inactive_catalog_family_missing_from_api_no_immediate_action"


def main() -> None:
    args = parse_args()
    sync_dir = Path(args.sync_dir).expanduser().resolve()

    new_payload = load_json(sync_dir / "new-to-local.json")
    missing_payload = load_json(sync_dir / "missing-from-api.json")
    meta_payload = load_json(sync_dir / "sync-meta.json")

    buckets: dict[str, list[dict[str, Any]]] = {"ignore": [], "watch": [], "candidate": []}

    for record in new_payload["records"]:
        bucket, reason = classify_new(record)
        buckets[bucket].append(
            {
                "source": "new_to_local",
                "reason": reason,
                **record,
            }
        )

    for record in missing_payload["records"]:
        bucket, reason = classify_missing(record)
        buckets[bucket].append(
            {
                "source": "missing_from_api",
                "reason": reason,
                **record,
            }
        )

    triage_meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sync_dir": str(sync_dir),
        "sync_counts": meta_payload.get("counts", {}),
        "triage_counts": {key: len(value) for key, value in buckets.items()},
        "notes": [
            "candidate = worth future editorial/product review",
            "watch = no immediate action, but useful to keep visible in future syncs",
            "ignore = expected low-value noise for current product goals",
        ],
    }

    write_json(sync_dir / "triage-meta.json", triage_meta)
    for bucket, records in buckets.items():
        write_json(sync_dir / f"triage-{bucket}.json", {"meta": triage_meta, "records": records})

    print(
        json.dumps(
            {
                "sync_dir": str(sync_dir),
                "ignore_total": len(buckets["ignore"]),
                "watch_total": len(buckets["watch"]),
                "candidate_total": len(buckets["candidate"]),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
