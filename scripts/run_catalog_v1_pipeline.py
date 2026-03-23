"""
run_catalog_v1_pipeline.py

Orchestrate the V1 catalog workflow in the intended order:

1. generate seeds
2. build final catalog
3. optionally import into DB
4. generate broader candidate files

Usage:
    .venv/bin/python scripts/run_catalog_v1_pipeline.py
    .venv/bin/python scripts/run_catalog_v1_pipeline.py --with-db-import
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

DEFAULT_CATALOG_DIR = "content/catalog"
DEFAULT_CANDIDATES_DIR = "content/catalog/candidates"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the V1 catalog pipeline end-to-end.")
    parser.add_argument("--catalog-dir", default=DEFAULT_CATALOG_DIR)
    parser.add_argument("--candidates-dir", default=DEFAULT_CANDIDATES_DIR)
    parser.add_argument(
        "--with-db-import",
        action="store_true",
        help="Also run the JSON -> DB import step.",
    )
    parser.add_argument(
        "--source",
        action="append",
        dest="sources",
        help="Additional source directory for candidate scan. Can be repeated.",
    )
    return parser.parse_args()


def run_step(label: str, command: list[str], env: dict[str, str] | None = None) -> None:
    print(f"\n== {label} ==")
    print(" ".join(command))
    subprocess.run(command, check=True, env=env)


def main() -> None:
    args = parse_args()
    python = sys.executable
    base_env = os.environ.copy()

    run_step(
        "Generate catalog seed",
        [
            python,
            "scripts/generate_catalog_seed.py",
            "--output-dir",
            args.catalog_dir,
        ],
        env=base_env,
    )

    run_step(
        "Build final catalog",
        [
            python,
            "scripts/build_catalog.py",
            "--catalog-dir",
            args.catalog_dir,
        ],
        env=base_env,
    )

    if args.with_db_import:
        if "DATABASE_URL" not in base_env:
            raise SystemExit("DATABASE_URL is required for --with-db-import")
        run_step(
            "Import final catalog into DB",
            [
                python,
                "scripts/import_catalog_json.py",
                "--catalog-dir",
                args.catalog_dir,
            ],
            env=base_env,
        )

    candidate_command = [
        python,
        "scripts/generate_catalog_candidates.py",
        "--catalog-dir",
        args.catalog_dir,
        "--output-dir",
        args.candidates_dir,
    ]
    for source in args.sources or []:
        candidate_command.extend(["--source", source])

    run_step(
        "Generate candidate review queue",
        candidate_command,
        env=base_env,
    )

    print("\nPipeline V1 termine.")


if __name__ == "__main__":
    main()
