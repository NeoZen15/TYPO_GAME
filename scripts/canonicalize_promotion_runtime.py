"""
canonicalize_promotion_runtime.py

Promote staged WOFF2 runtime assets into the main public/fonts namespace and
rewrite the runtime asset records to their canonical final paths.

Usage:
    .venv/bin/python scripts/canonicalize_promotion_runtime.py \
      --runtime-file content/catalog/batches/google-fonts-pilot-top-10/promotion-ready/font-runtime-assets.promotion-ready.json \
      --project-root . \
      --output-dir content/catalog/batches/google-fonts-pilot-top-10/promotion-ready
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Canonicalize staged runtime assets into public/fonts/<slug>/...")
    parser.add_argument("--runtime-file", required=True)
    parser.add_argument("--project-root", default=".")
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


def runtime_path_to_abs(project_root: Path, runtime_path: str) -> Path:
    if not runtime_path.startswith("/fonts/"):
        raise SystemExit(f"Unsupported runtime_path format: {runtime_path}")
    relative = Path(runtime_path.lstrip("/"))
    return project_root / "public" / relative


def main() -> None:
    args = parse_args()
    runtime_file = Path(args.runtime_file).expanduser().resolve()
    project_root = Path(args.project_root).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    payload = load_payload(runtime_file)
    canonical_records: list[dict] = []
    report_records: list[dict] = []

    for record in payload["records"]:
        runtime_path = record.get("runtime_path")
        if record.get("runtime_status") != "ready" or not runtime_path:
            canonical_records.append(record)
            report_records.append(
                {
                    "typeface_slug": record.get("typeface_slug"),
                    "status": "skipped",
                    "reason": "record is not runtime-ready",
                }
            )
            continue

        staged_abs = runtime_path_to_abs(project_root, runtime_path)
        if not staged_abs.exists():
            raise SystemExit(f"Staged runtime file not found: {staged_abs}")

        slug = record["typeface_slug"]
        sha256_hash = record["sha256_hash"]
        suffix = sha256_hash[:12] if sha256_hash else "promoted"
        file_name = f"{slug}__{suffix}.woff2"
        dest_rel = Path("public") / "fonts" / slug / file_name
        dest_abs = project_root / dest_rel
        dest_abs.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(staged_abs, dest_abs)

        canonical_record = dict(record)
        canonical_record["source_path"] = str(dest_rel).replace("\\", "/")
        canonical_record["runtime_path"] = f"/fonts/{slug}/{file_name}"
        canonical_record["asset_origin"] = "google_fonts_promoted_runtime"
        canonical_record["verified_at_utc"] = datetime.now(timezone.utc).isoformat()
        notes = list(canonical_record.get("notes") or [])
        notes.append("canonicalized from staged runtime path for main catalog promotion")
        canonical_record["notes"] = notes
        canonical_records.append(canonical_record)

        report_records.append(
            {
                "typeface_slug": slug,
                "status": "canonicalized",
                "from_runtime_path": runtime_path,
                "to_runtime_path": canonical_record["runtime_path"],
            }
        )

    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "runtime_file": str(runtime_file),
        "project_root": str(project_root),
        "counts": {
            "total": len(payload["records"]),
            "canonicalized": sum(1 for item in report_records if item["status"] == "canonicalized"),
            "skipped": sum(1 for item in report_records if item["status"] == "skipped"),
        },
        "notes": [
            "Canonical runtime records are suitable for main catalog overrides.",
            "This step copies assets out of public/fonts/staged into the main public/fonts namespace.",
        ],
    }

    write_json(output_dir / "font-runtime-assets.canonical.json", {"meta": meta, "records": canonical_records})
    write_json(output_dir / "runtime-canonicalization-report.json", {"meta": meta, "records": report_records})


if __name__ == "__main__":
    main()
