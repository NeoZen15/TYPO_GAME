"""
run_catalog_promotion_pipeline.py

Orchestrate the promotion-prep workflow for a candidate queue or review batch:
1. audit promotion readiness,
2. prepare runtime assets,
3. generate semi-automatic promotion staging.

Usage:
    python3 scripts/run_catalog_promotion_pipeline.py \
      --input-dir content/catalog/batches/google-fonts-pilot-top-10 \
      --catalog-dir content/catalog
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the catalog promotion pipeline on a batch or candidate queue.")
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--catalog-dir", default="content/catalog")
    parser.add_argument("--output-root", help="Defaults to input dir")
    parser.add_argument("--public-dir", help="Defaults to public/fonts/staged/<input-name>")
    return parser.parse_args()


def run_step(command: list[str], cwd: Path) -> None:
    result = subprocess.run(command, cwd=str(cwd), check=False)
    if result.returncode != 0:
        raise SystemExit(f"Step failed: {' '.join(command)}")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    cwd = Path.cwd()
    input_dir = Path(args.input_dir).expanduser().resolve()
    catalog_dir = Path(args.catalog_dir).expanduser().resolve()
    output_root = Path(args.output_root).expanduser().resolve() if args.output_root else input_dir
    public_dir = Path(args.public_dir).expanduser().resolve() if args.public_dir else (cwd / "public" / "fonts" / "staged" / input_dir.name)

    audit_output = output_root / "promotion-audit.json"
    runtime_dir = output_root / "runtime-prep"
    prepared_runtime = runtime_dir / "font-runtime-assets.prepared.json"
    stage_dir = output_root / "promotion-stage"
    stage_audit_output = output_root / "promotion-stage-audit.json"

    venv_python = cwd / ".venv" / "bin" / "python"
    python_exe = str(venv_python if venv_python.exists() else Path(sys.executable))

    run_step(
        [
            python_exe,
            "scripts/audit_catalog_promotion.py",
            "--input-dir",
            str(input_dir),
            "--catalog-dir",
            str(catalog_dir),
            "--output",
            str(audit_output),
        ],
        cwd,
    )

    run_step(
        [
            python_exe,
            "scripts/prepare_catalog_runtime.py",
            "--input-dir",
            str(input_dir),
            "--output-dir",
            str(runtime_dir),
            "--public-dir",
            str(public_dir),
        ],
        cwd,
    )

    run_step(
        [
            python_exe,
            "scripts/stage_catalog_promotion.py",
            "--input-dir",
            str(input_dir),
            "--runtime-prepared",
            str(prepared_runtime),
            "--output-dir",
            str(stage_dir),
        ],
        cwd,
    )

    run_step(
        [
            python_exe,
            "scripts/audit_catalog_promotion.py",
            "--input-dir",
            str(stage_dir),
            "--catalog-dir",
            str(catalog_dir),
            "--output",
            str(stage_audit_output),
        ],
        cwd,
    )

    audit_payload = load_json(audit_output)
    runtime_payload = load_json(runtime_dir / "runtime-prep-report.json")
    stage_payload = load_json(stage_dir / "promotion-stage-meta.json")
    stage_audit_payload = load_json(stage_audit_output)

    meta_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_dir": str(input_dir),
        "catalog_dir": str(catalog_dir),
        "public_dir": str(public_dir),
        "artifacts": {
            "promotion_audit": str(audit_output),
            "runtime_prep_report": str(runtime_dir / "runtime-prep-report.json"),
            "prepared_runtime": str(prepared_runtime),
            "promotion_stage_meta": str(stage_dir / "promotion-stage-meta.json"),
            "promotion_stage_audit": str(stage_audit_output),
        },
        "summary": {
            "initial_status_counts": audit_payload.get("status_counts", {}),
            "runtime_prep_counts": runtime_payload.get("counts", {}),
            "promotion_stage_counts": stage_payload.get("counts", {}),
            "post_stage_status_counts": stage_audit_payload.get("status_counts", {}),
        },
        "notes": [
            "This orchestrator does not promote into the main catalog.",
            "It prepares the batch and leaves remaining editorial review explicit.",
        ],
    }
    write_json(output_root / "promotion-pipeline-meta.json", meta_payload)


if __name__ == "__main__":
    main()
