"""
import_massive_font_source.py

Scan a `google/fonts`-style snapshot and generate large candidate files without
touching the main import-ready catalog.

Expected source layout:
    <source-root>/ofl/<family_dir>/...
    <source-root>/apache/<family_dir>/...
    <source-root>/ufl/<family_dir>/...

Usage:
    python3 scripts/import_massive_font_source.py \
      --source-root /path/to/google-fonts-main \
      --catalog-dir content/catalog \
      --output-dir content/catalog/candidates/google-fonts-snapshot
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

FONT_EXTENSIONS = {".ttf", ".otf", ".woff2", ".woff"}
LICENSE_DIR_TO_TYPE = {"ofl": "ofl", "apache": "apache2", "ufl": "unknown"}
DEFAULT_CATALOG_DIR = Path("content/catalog")
DEFAULT_OUTPUT_DIR = Path("content/catalog/candidates/google-fonts-snapshot")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate candidate files from a google/fonts-style snapshot."
    )
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--catalog-dir", default=str(DEFAULT_CATALOG_DIR))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument(
        "--include-known",
        action="store_true",
        help="Include families already known by the current catalog instead of skipping them.",
    )
    return parser.parse_args()


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def load_known_slugs(catalog_dir: Path) -> set[str]:
    payload = json.loads((catalog_dir / "typefaces-core.json").read_text(encoding="utf-8"))
    return {record["typeface_slug"] for record in payload["records"]}


def normalize_ascii(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return "".join(ch for ch in normalized.lower() if ch.isalnum())


def camel_to_snake(value: str) -> str:
    first_pass = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", value)
    second_pass = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", first_pass)
    second_pass = re.sub(r"[^A-Za-z0-9]+", "_", second_pass)
    return re.sub(r"_+", "_", second_pass).strip("_").lower()


def dir_to_slug(directory_name: str) -> str:
    return camel_to_snake(directory_name)


def normalized_slug_key(value: str) -> str:
    return normalize_ascii(value.replace("_", " "))


def build_known_slug_aliases(known_slugs: set[str]) -> dict[str, str]:
    aliases: dict[str, str] = {}
    for slug in sorted(known_slugs):
        aliases[normalized_slug_key(slug)] = slug
    return aliases


def parse_metadata_pb(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    text = path.read_text(encoding="utf-8", errors="ignore")
    result: dict[str, str] = {}
    patterns = {
        "name": r'name:\s*"([^"]+)"',
        "designer": r'designer:\s*"([^"]+)"',
        "category": r'category:\s*"([^"]+)"',
        "date_added": r'date_added:\s*"([^"]+)"',
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, text)
        if match:
            result[key] = match.group(1)
    return result


def family_files(family_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in family_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in FONT_EXTENSIONS
    )


def main() -> None:
    args = parse_args()
    source_root = Path(args.source_root).expanduser().resolve()
    catalog_dir = Path(args.catalog_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()

    if not source_root.exists():
        raise SystemExit(f"Source root introuvable: {source_root}")

    known_slugs = load_known_slugs(catalog_dir)
    known_slug_aliases = build_known_slug_aliases(known_slugs)
    built_at = datetime.now(timezone.utc).isoformat()

    candidate_typefaces: list[dict] = []
    candidate_runtime_assets: list[dict] = []
    candidate_expert_answers: list[dict] = []
    family_count = 0
    skipped_known = 0
    skipped_known_exact = 0
    skipped_known_normalized = 0
    license_breakdown = {"ofl": 0, "apache2": 0, "unknown": 0}

    for license_dir_name in ("ofl", "apache", "ufl"):
        license_dir = source_root / license_dir_name
        if not license_dir.exists():
            continue

        license_type = LICENSE_DIR_TO_TYPE[license_dir_name]
        for family_dir in sorted(path for path in license_dir.iterdir() if path.is_dir()):
            family_count += 1
            slug = dir_to_slug(family_dir.name)
            slug_key = normalized_slug_key(slug)
            if not args.include_known and slug in known_slugs:
                skipped_known += 1
                skipped_known_exact += 1
                continue
            if not args.include_known and slug_key in known_slug_aliases:
                skipped_known += 1
                skipped_known_normalized += 1
                continue

            metadata = parse_metadata_pb(family_dir / "METADATA.pb")
            display_name = metadata.get("name") or family_dir.name.replace("_", " ")
            date_added = metadata.get("date_added")
            date_added_year = None
            if date_added:
                try:
                    date_added_year = int(date_added.split("-", 1)[0])
                except ValueError:
                    date_added_year = None
            files = family_files(family_dir)
            has_woff2 = any(path.suffix.lower() == ".woff2" for path in files)
            available_formats = sorted({path.suffix.lower().lstrip(".") for path in files})
            sample_paths = [str(path) for path in files[:5]]
            preferred_path = next((path for path in files if path.suffix.lower() == ".woff2"), files[0] if files else family_dir)

            license_breakdown[license_type] += 1

            candidate_typefaces.append(
                {
                    "typeface_slug": slug,
                    "display_name_guess": display_name,
                    "display_name_ascii": normalize_ascii(display_name),
                    "guessed_font_source": "google",
                    "guessed_license_type": license_type,
                    "guessed_designer": metadata.get("designer"),
                    "guessed_google_category": metadata.get("category"),
                    "google_date_added": date_added,
                    "google_date_added_year": date_added_year,
                    "available_formats": available_formats,
                    "source_file_count": len(files),
                    "sample_source_paths": sample_paths,
                    "runtime_candidate_status": "has_woff2" if has_woff2 else "needs_conversion_or_mirroring",
                    "review_status": "needs_editorial_review",
                    "notes": [
                        "auto-discovered from google/fonts snapshot",
                        "not import-ready until editorial fields are reviewed",
                    ],
                }
            )

            candidate_runtime_assets.append(
                {
                    "typeface_slug": slug,
                    "preferred_source_path": str(preferred_path),
                    "available_formats": available_formats,
                    "source_file_count": len(files),
                    "has_woff2": has_woff2,
                    "guessed_license_type": license_type,
                    "runtime_candidate_status": "ready_for_mirroring" if has_woff2 else "needs_conversion_or_mirroring",
                    "notes": [
                        "candidate runtime asset record from google/fonts snapshot",
                    ],
                }
            )

            candidate_expert_answers.append(
                {
                    "typeface_slug": slug,
                    "answer_text_guess": display_name,
                    "answer_normalized": normalize_ascii(display_name),
                    "locale": "any",
                    "review_status": "needs_editorial_review",
                    "notes": [
                        "auto-generated from snapshot metadata or family directory name",
                    ],
                }
            )

    meta_payload = {
        "generated_at": built_at,
        "source_root": str(source_root),
        "counts": {
            "known_catalog_slugs": len(known_slugs),
            "snapshot_family_dirs_total": family_count,
            "snapshot_family_dirs_skipped_as_known": skipped_known,
            "snapshot_family_dirs_skipped_as_known_exact": skipped_known_exact,
            "snapshot_family_dirs_skipped_as_known_normalized": skipped_known_normalized,
            "candidate_family_slugs_total": len(candidate_typefaces),
        },
        "license_breakdown": license_breakdown,
        "notes": [
            "These files are candidates only, not DB-ready records.",
            "This scan is designed for a google/fonts snapshot or clone.",
            "Use --include-known to emit a full refreshable candidate set, including already-known families.",
        ],
    }

    write_json(output_dir / "snapshot-scan-meta.json", meta_payload)
    write_json(
        output_dir / "typefaces-core.candidates.json",
        {"meta": {"generated_at": built_at, "record_count": len(candidate_typefaces)}, "records": candidate_typefaces},
    )
    write_json(
        output_dir / "font-runtime-assets.candidates.json",
        {"meta": {"generated_at": built_at, "record_count": len(candidate_runtime_assets)}, "records": candidate_runtime_assets},
    )
    write_json(
        output_dir / "expert-answer-keys.candidates.json",
        {"meta": {"generated_at": built_at, "record_count": len(candidate_expert_answers)}, "records": candidate_expert_answers},
    )


if __name__ == "__main__":
    main()
