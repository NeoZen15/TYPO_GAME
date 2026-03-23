"""
prepare_catalog_runtime.py

Prepare runtime-ready WOFF2 assets from candidate/review runtime records.

This script is intentionally conservative:
- it picks a single primary source file per typeface,
- converts it to WOFF2 when needed,
- writes assets under `public/fonts/staged/...`,
- emits a prepared runtime JSON payload plus a detailed report.

Usage:
    python3 scripts/prepare_catalog_runtime.py \
      --input-dir content/catalog/batches/google-fonts-pilot-top-10 \
      --output-dir content/catalog/batches/google-fonts-pilot-top-10/runtime-prep \
      --public-dir public/fonts/staged/google-fonts-pilot-top-10
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fontTools.ttLib import TTFont

FONT_EXTENSIONS = {".ttf", ".otf", ".woff2", ".woff"}
WEIGHT_KEYWORDS = (
    ("thin", 100),
    ("extralight", 200),
    ("ultralight", 200),
    ("light", 300),
    ("regular", 400),
    ("book", 400),
    ("text", 400),
    ("medium", 500),
    ("semibold", 600),
    ("demibold", 600),
    ("bold", 700),
    ("extrabold", 800),
    ("ultrabold", 800),
    ("black", 900),
    ("heavy", 900),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare runtime-ready WOFF2 files from candidate/review runtime assets.")
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--public-dir", required=True)
    return parser.parse_args()


def load_payload(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or "records" not in payload or not isinstance(payload["records"], list):
        raise SystemExit(f"Invalid payload format in {path}")
    return payload


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def detect_runtime_file(input_dir: Path) -> Path:
    review = input_dir / "font-runtime-assets.review.json"
    candidates = input_dir / "font-runtime-assets.candidates.json"
    if review.exists():
        return review
    if candidates.exists():
        return candidates
    raise SystemExit(f"No runtime review/candidates payload found in {input_dir}")


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rank_source(path: Path) -> tuple:
    name = path.name.lower()
    suffix = path.suffix.lower()
    is_italic = "italic" in name
    is_bold = "bold" in name
    is_regular = "regular" in name
    is_variable = "[" in path.name and "]" in path.name
    preferred_format = {".woff2": 0, ".woff": 1, ".ttf": 2, ".otf": 3}.get(suffix, 9)
    return (
        is_italic,
        not is_regular,
        is_bold,
        not is_variable,
        preferred_format,
        name,
    )


def discover_family_sources(preferred_source_path: Path) -> list[Path]:
    if preferred_source_path.exists() and preferred_source_path.is_file():
        parent = preferred_source_path.parent
        return sorted(
            [path for path in parent.iterdir() if path.is_file() and path.suffix.lower() in FONT_EXTENSIONS],
            key=rank_source,
        )
    return []


def choose_primary_source(runtime_record: dict) -> tuple[Path | None, list[str]]:
    warnings: list[str] = []
    preferred = runtime_record.get("preferred_source_path")
    if not preferred:
        return None, ["missing_preferred_source_path"]

    preferred_path = Path(preferred)
    candidates = discover_family_sources(preferred_path)
    if not candidates:
        return None, ["source_family_files_not_found"]

    chosen = candidates[0]
    if chosen != preferred_path:
        warnings.append(f"preferred path adjusted to better primary source: {chosen.name}")
    return chosen, warnings


def convert_to_woff2(source_path: Path, dest_path: Path) -> None:
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    if source_path.suffix.lower() == ".woff2":
        shutil.copy2(source_path, dest_path)
        return

    font = TTFont(str(source_path))
    font.flavor = "woff2"
    font.save(str(dest_path))


def infer_weight_and_style(source_path: Path) -> tuple[int, str]:
    name = source_path.name.lower()
    style = "italic" if "italic" in name else "normal"

    if "[" in name and "]" in name:
        return 400, style

    for keyword, weight in WEIGHT_KEYWORDS:
        if keyword in name:
            return weight, style
    return 400, style


def build_runtime_record(slug: str, source_path: Path, dest_path: Path, public_dir: Path) -> dict:
    public_root = next((parent for parent in dest_path.parents if parent.name == "public"), None)
    if public_root is None:
        raise ValueError(f"Could not derive public runtime path from {dest_path}")
    runtime_path = "/" + str(dest_path.relative_to(public_root)).replace("\\", "/")
    timestamp = datetime.now(timezone.utc).isoformat()
    weight, style = infer_weight_and_style(source_path)
    return {
        "typeface_slug": slug,
        "file_role": "primary",
        "font_format": "woff2",
        "weight": weight,
        "style": style,
        "source_path": str(source_path),
        "runtime_path": runtime_path,
        "file_size_bytes": dest_path.stat().st_size,
        "sha256_hash": file_sha256(dest_path),
        "runtime_status": "ready",
        "asset_origin": "google_fonts_snapshot_conversion",
        "verified_at_utc": timestamp,
        "notes": [
            "prepared automatically from candidate runtime source",
            f"source_file={source_path.name}",
        ],
    }


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    public_dir = Path(args.public_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    public_dir.mkdir(parents=True, exist_ok=True)

    runtime_payload = load_payload(detect_runtime_file(input_dir))
    prepared_records: list[dict] = []
    report_records: list[dict] = []
    counts = {"total": 0, "prepared": 0, "blocked": 0}

    for runtime_record in runtime_payload["records"]:
        slug = runtime_record["typeface_slug"]
        counts["total"] += 1
        chosen_source, warnings = choose_primary_source(runtime_record)

        if chosen_source is None:
            counts["blocked"] += 1
            report_records.append(
                {
                    "typeface_slug": slug,
                    "status": "blocked",
                    "warnings": warnings,
                    "source_path": runtime_record.get("preferred_source_path"),
                }
            )
            continue

        dest_path = public_dir / slug / f"{slug}-primary.woff2"
        try:
            convert_to_woff2(chosen_source, dest_path)
            prepared_record = build_runtime_record(slug, chosen_source, dest_path, public_dir)
            prepared_records.append(prepared_record)
            counts["prepared"] += 1
            report_records.append(
                {
                    "typeface_slug": slug,
                    "status": "prepared",
                    "warnings": warnings,
                    "source_path": str(chosen_source),
                    "runtime_path": prepared_record["runtime_path"],
                    "file_size_bytes": prepared_record["file_size_bytes"],
                    "sha256_hash": prepared_record["sha256_hash"],
                }
            )
        except Exception as exc:
            counts["blocked"] += 1
            report_records.append(
                {
                    "typeface_slug": slug,
                    "status": "blocked",
                    "warnings": warnings + [f"conversion_failed: {exc}"],
                    "source_path": str(chosen_source),
                }
            )

    built_at = datetime.now(timezone.utc).isoformat()
    write_json(
        output_dir / "font-runtime-assets.prepared.json",
        {
            "meta": {
                "built_at": built_at,
                "input_dir": str(input_dir),
                "public_dir": str(public_dir),
                "record_count": len(prepared_records),
            },
            "records": prepared_records,
        },
    )
    write_json(
        output_dir / "runtime-prep-report.json",
        {
            "generated_at": built_at,
            "input_dir": str(input_dir),
            "public_dir": str(public_dir),
            "counts": counts,
            "records": report_records,
        },
    )


if __name__ == "__main__":
    main()
