"""
generate_catalog_candidates.py

Scan broader local font sources and generate non-import-ready catalog candidate
files in `content/catalog/candidates/`.

This script is intentionally separate from the main catalog build:

- built catalog files remain import-ready truth
- candidate files widen the editorial queue

Usage:
    python3 scripts/generate_catalog_candidates.py
    python3 scripts/generate_catalog_candidates.py \
      --source /path/to/fonts_a \
      --source /path/to/fonts_b \
      --catalog-dir content/catalog \
      --output-dir content/catalog/candidates
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_CATALOG_DIR = Path("content/catalog")
DEFAULT_OUTPUT_DIR = Path("content/catalog/candidates")
DEFAULT_SOURCES = (
    Path("/Users/launaymarion/Documents/JEUX_DE_TYPO/02_TYPO_ASSETS/07_google_fonts/01_woff2"),
    Path("/Users/launaymarion/Documents/JEUX_DE_TYPO/02_TYPO_ASSETS/01_fonts"),
)
FONT_EXTENSIONS = {".woff2", ".woff", ".ttf", ".otf"}
EDITORIAL_FIELDS_REQUIRING_REVIEW = [
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
    "license_type",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate non-import-ready catalog candidate files from broader font sources."
    )
    parser.add_argument(
        "--catalog-dir",
        default=str(DEFAULT_CATALOG_DIR),
        help="Directory containing the current built catalog JSON files.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory where candidate JSON files will be written.",
    )
    parser.add_argument(
        "--source",
        action="append",
        dest="sources",
        help="Font source directory to scan. Can be repeated.",
    )
    return parser.parse_args()


def normalize_ascii(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return "".join(ch for ch in normalized.lower() if ch.isalnum())


def slug_to_display_name(slug: str) -> str:
    words = slug.split("_")
    return " ".join(word.upper() if len(word) <= 3 else word.capitalize() for word in words)


def camel_to_snake(value: str) -> str:
    first_pass = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", value)
    second_pass = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", first_pass)
    second_pass = re.sub(r"[^A-Za-z0-9]+", "_", second_pass)
    return re.sub(r"_+", "_", second_pass).strip("_").lower()


def infer_family_slug(path: Path) -> str:
    stem = path.stem

    if "__" in stem:
        return stem.split("__", 1)[0].lower()

    family_part = stem.split("-", 1)[0]
    return camel_to_snake(family_part)


def guess_font_source(path: Path) -> str:
    as_posix = path.as_posix()
    return "google" if "/07_google_fonts/" in as_posix else "local"


def load_known_slugs(catalog_dir: Path) -> set[str]:
    typefaces_path = catalog_dir / "typefaces-core.json"
    payload = json.loads(typefaces_path.read_text(encoding="utf-8"))
    return {record["typeface_slug"] for record in payload["records"]}


def scan_sources(source_dirs: list[Path]) -> list[Path]:
    files: list[Path] = []
    for source_dir in source_dirs:
        if not source_dir.exists():
            continue
        for path in source_dir.rglob("*"):
            if path.is_file() and path.suffix.lower() in FONT_EXTENSIONS:
                files.append(path)
    return sorted(files)


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    catalog_dir = Path(args.catalog_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    source_dirs = (
        [Path(source).expanduser().resolve() for source in args.sources]
        if args.sources
        else [source.resolve() for source in DEFAULT_SOURCES]
    )

    known_slugs = load_known_slugs(catalog_dir)
    scanned_files = scan_sources(source_dirs)

    grouped_files: dict[str, list[Path]] = defaultdict(list)
    for file_path in scanned_files:
        grouped_files[infer_family_slug(file_path)].append(file_path)

    candidate_typefaces: list[dict] = []
    candidate_runtime_assets: list[dict] = []
    candidate_expert_answers: list[dict] = []

    for slug in sorted(grouped_files):
        if slug in known_slugs:
            continue

        files = sorted(grouped_files[slug])
        has_woff2 = any(file.suffix.lower() == ".woff2" for file in files)
        guessed_source = guess_font_source(files[0])
        display_name = slug_to_display_name(slug)
        source_paths = [str(path) for path in files]
        sample_paths = source_paths[:5]
        primary_file = next((path for path in files if path.suffix.lower() == ".woff2"), files[0])

        candidate_typefaces.append(
            {
                "typeface_slug": slug,
                "display_name_guess": display_name,
                "display_name_ascii": normalize_ascii(display_name),
                "guessed_font_source": guessed_source,
                "available_formats": sorted({path.suffix.lower().lstrip(".") for path in files}),
                "source_file_count": len(files),
                "sample_source_paths": sample_paths,
                "runtime_candidate_status": "has_woff2" if has_woff2 else "non_runtime_source_only",
                "suggested_activation_status": False,
                "suggested_expert_enabled": False,
                "review_status": "needs_editorial_review",
                "missing_editorial_fields": EDITORIAL_FIELDS_REQUIRING_REVIEW,
                "notes": [
                    "auto-discovered from local font sources",
                    "not import-ready until editorial fields are reviewed",
                ],
            }
        )

        candidate_runtime_assets.append(
            {
                "typeface_slug": slug,
                "preferred_source_path": str(primary_file),
                "source_file_count": len(files),
                "available_formats": sorted({path.suffix.lower().lstrip(".") for path in files}),
                "has_woff2": has_woff2,
                "runtime_candidate_status": "ready_for_mirroring" if has_woff2 else "source_only",
                "notes": [
                    "candidate runtime asset record",
                    "must be mirrored into the project before production runtime import",
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
                    "auto-generated from guessed display name",
                ],
            }
        )

    built_at = datetime.now(timezone.utc).isoformat()
    meta_payload = {
        "generated_at": built_at,
        "sources": [str(source) for source in source_dirs],
        "counts": {
            "known_catalog_slugs": len(known_slugs),
            "scanned_files_total": len(scanned_files),
            "grouped_family_slugs_total": len(grouped_files),
            "candidate_family_slugs_total": len(candidate_typefaces),
            "candidate_family_slugs_with_woff2": sum(
                1
                for record in candidate_typefaces
                if record["runtime_candidate_status"] == "has_woff2"
            ),
            "candidate_family_slugs_source_only": sum(
                1
                for record in candidate_typefaces
                if record["runtime_candidate_status"] == "non_runtime_source_only"
            ),
        },
        "notes": [
            "Candidates are not DB-ready records.",
            "They widen the review queue without altering the main built catalog.",
        ],
    }

    write_json(output_dir / "candidate-scan-meta.json", meta_payload)
    write_json(
        output_dir / "typefaces-core.candidates.json",
        {
            "meta": {
                "generated_at": built_at,
                "record_count": len(candidate_typefaces),
            },
            "records": candidate_typefaces,
        },
    )
    write_json(
        output_dir / "font-runtime-assets.candidates.json",
        {
            "meta": {
                "generated_at": built_at,
                "record_count": len(candidate_runtime_assets),
            },
            "records": candidate_runtime_assets,
        },
    )
    write_json(
        output_dir / "expert-answer-keys.candidates.json",
        {
            "meta": {
                "generated_at": built_at,
                "record_count": len(candidate_expert_answers),
            },
            "records": candidate_expert_answers,
        },
    )


if __name__ == "__main__":
    main()
