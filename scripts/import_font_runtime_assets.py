"""
import_font_runtime_assets.py
JEUX DE TYPO -- import manifest JSON -> font_runtime_assets

This importer intentionally picks one canonical runtime file per mapped typeface
for V1. The current manifest does not expose reliable weight/style metadata per
WOFF2 file, so this script imports a deterministic "primary asset" only:
- preferred: manifest runtimePath if present (after mirroring into public/fonts)
- fallback: first mapped .woff2 file in sorted order from --woff2-dir
- weight=400
- style=normal

This is sufficient to populate `font_runtime_assets` with one usable runtime
record per mapped typeface, while keeping local/system fonts out of the table
until they are replaced by libre alternatives.

Usage:
    python scripts/import_font_runtime_assets.py \
      --manifest content/typefaces/font-manifest-v4.json \
      --woff2-dir /abs/path/to/01_woff2 \
      --dry-run

    python scripts/import_font_runtime_assets.py \
      --manifest content/typefaces/font-manifest-v4.json \
      --woff2-dir /abs/path/to/01_woff2 \
      --db postgresql://user:pass@host/dbname
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import font runtime assets from manifest JSON into PostgreSQL."
    )
    parser.add_argument("--manifest", required=True, help="Path to font-manifest JSON")
    parser.add_argument(
        "--woff2-dir",
        help="Absolute path to WOFF2 directory (required only if runtimePath is absent in manifest)",
    )
    parser.add_argument(
        "--db", help="URL PostgreSQL (ex: postgresql://user:pass@host/dbname)"
    )
    parser.add_argument(
        "--project-root",
        default=".",
        help="Project root used to compute relative paths (default: current directory)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print the import plan without writing to DB",
    )
    return parser.parse_args()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_manifest(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"ERREUR : manifest introuvable: {path}")
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"ERREUR : manifest JSON invalide: {exc}")
        sys.exit(1)


def build_rows(
    manifest: dict, woff2_dir: Path | None, project_root: Path
) -> tuple[list[dict], dict]:
    fonts = manifest.get("fonts")
    if not isinstance(fonts, list):
        print("ERREUR : le manifest doit contenir une liste 'fonts'")
        sys.exit(1)

    rows: list[dict] = []
    report = {
        "mapped_candidates": 0,
        "prepared": 0,
        "skipped_system_local": 0,
        "skipped_missing": 0,
        "errors": [],
    }

    seen_slugs: set[str] = set()

    for entry in fonts:
        slug = str(entry.get("slug", "")).strip()
        asset_status = str(entry.get("assetStatus", "")).strip()
        files = entry.get("woff2Files") or []
        runtime_path = str(entry.get("runtimePath", "")).strip()

        if not slug:
            report["errors"].append({"slug": "-", "error": "missing slug in manifest"})
            continue

        if slug in seen_slugs:
            report["errors"].append({"slug": slug, "error": "duplicate slug in manifest"})
            continue
        seen_slugs.add(slug)

        if asset_status == "system_local":
            report["skipped_system_local"] += 1
            continue

        if asset_status != "mapped" or (not files and not runtime_path):
            report["skipped_missing"] += 1
            continue

        report["mapped_candidates"] += 1

        if runtime_path:
            normalized_runtime_path = runtime_path.lstrip("/")
            relative_path = runtime_path
            file_path = project_root / "public" / normalized_runtime_path
        else:
            if woff2_dir is None:
                report["errors"].append(
                    {
                        "slug": slug,
                        "error": "runtimePath absent in manifest and --woff2-dir not provided",
                    }
                )
                continue

            primary_file = sorted(str(file_name) for file_name in files)[0]
            file_path = woff2_dir / primary_file
            relative_path = os.path.relpath(file_path.resolve(), project_root.resolve())

        if not file_path.exists():
            report["errors"].append(
                {"slug": slug, "error": f"mapped file missing on disk: {file_path}"}
            )
            continue

        if not runtime_path and relative_path.startswith(".."):
            report["errors"].append(
                {
                    "slug": slug,
                    "error": (
                        "asset path is outside project root; current row points to an external source path, "
                        "mirror fonts into the project before browser runtime"
                    ),
                }
            )

        now_utc = datetime.now(timezone.utc)
        rows.append(
            {
                "typeface_slug": slug,
                "font_format": "woff2",
                "weight": 400,
                "style": "normal",
                "relative_path": relative_path,
                "file_size_bytes": file_path.stat().st_size,
                "sha256_hash": sha256_file(file_path),
                "runtime_status": "ready",
                "verified_at_utc": now_utc,
                "updated_at_utc": now_utc,
            }
        )
        report["prepared"] += 1

    return rows, report


def import_to_db(rows: list[dict], db_url: str) -> dict[str, object]:
    try:
        import psycopg2
    except ImportError:
        print("ERREUR : psycopg2 non installe. Lance : pip install psycopg2-binary")
        sys.exit(1)

    report: dict[str, object] = {"inserted": 0, "updated": 0, "errors": []}

    select_existing_sql = """
        SELECT typeface_slug, weight, style
        FROM font_runtime_assets
    """
    upsert_sql = """
        INSERT INTO font_runtime_assets (
            typeface_slug,
            font_format,
            weight,
            style,
            relative_path,
            file_size_bytes,
            sha256_hash,
            runtime_status,
            verified_at_utc,
            updated_at_utc
        ) VALUES (
            %(typeface_slug)s,
            %(font_format)s,
            %(weight)s,
            %(style)s,
            %(relative_path)s,
            %(file_size_bytes)s,
            %(sha256_hash)s,
            %(runtime_status)s,
            %(verified_at_utc)s,
            %(updated_at_utc)s
        )
        ON CONFLICT (typeface_slug, weight, style) DO UPDATE SET
            font_format = EXCLUDED.font_format,
            relative_path = EXCLUDED.relative_path,
            file_size_bytes = EXCLUDED.file_size_bytes,
            sha256_hash = EXCLUDED.sha256_hash,
            runtime_status = EXCLUDED.runtime_status,
            verified_at_utc = EXCLUDED.verified_at_utc,
            updated_at_utc = EXCLUDED.updated_at_utc
    """

    conn = psycopg2.connect(db_url)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(select_existing_sql)
                existing_keys = {(row[0], row[1], row[2]) for row in cur.fetchall()}

                for row in rows:
                    key = (row["typeface_slug"], row["weight"], row["style"])
                    try:
                        cur.execute(upsert_sql, row)
                        if key in existing_keys:
                            report["updated"] += 1
                        else:
                            report["inserted"] += 1
                            existing_keys.add(key)
                    except Exception as exc:  # pragma: no cover - DB dependent
                        report["errors"].append(
                            {"slug": row["typeface_slug"], "error": str(exc)}
                        )
    finally:
        conn.close()

    return report


def main() -> None:
    args = parse_args()
    manifest_path = Path(args.manifest).expanduser().resolve()
    woff2_dir = Path(args.woff2_dir).expanduser().resolve() if args.woff2_dir else None
    project_root = Path(args.project_root).expanduser().resolve()

    if not manifest_path.exists():
        print(f"ERREUR : manifest introuvable: {manifest_path}")
        sys.exit(1)
    if woff2_dir is not None and not woff2_dir.exists():
        print(f"ERREUR : dossier WOFF2 introuvable: {woff2_dir}")
        sys.exit(1)

    print(f"Lecture manifest : {manifest_path}")
    manifest = load_manifest(manifest_path)
    rows, report = build_rows(manifest, woff2_dir, project_root)

    if report["errors"]:
        print(f"  Avertissements/erreurs collectes : {len(report['errors'])}")
        for error in report["errors"][:10]:
            print(f"    {error['slug']}: {error['error']}")

    print(f"  Typefaces mapped candidates : {report['mapped_candidates']}")
    print(f"  Rows preparees           : {report['prepared']}")
    print(f"  Skipped system local     : {report['skipped_system_local']}")
    print(f"  Skipped missing/unmapped : {report['skipped_missing']}")
    print("  Strategie V1            : 1 asset canonique par typeface mapped (400/normal)")

    if args.dry_run:
        print("\n[DRY-RUN] Apercu (5 premieres lignes):")
        for row in rows[:5]:
            print(
                f"  {row['typeface_slug']:20} | {row['relative_path']} | "
                f"{row['file_size_bytes']} bytes"
            )
        print("\nAucune ecriture en DB (mode dry-run).")
        sys.exit(0)

    if not args.db:
        print("ERREUR : --db requis en dehors du mode --dry-run")
        sys.exit(1)

    print("\nImport en base...")
    db_report = import_to_db(rows, args.db)
    print("\nImport termine")
    print(f"  Inserees : {db_report['inserted']}")
    print(f"  Mises a jour : {db_report['updated']}")
    if db_report["errors"]:
        print(f"  Erreurs DB : {len(db_report['errors'])}")
        for error in db_report["errors"]:
            print(f"    {error['slug']} : {error['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
