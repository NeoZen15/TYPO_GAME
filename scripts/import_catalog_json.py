"""
import_catalog_json.py

Import the final built catalog JSON files from `content/catalog/` into PostgreSQL.

This script is the DB-facing pair of:

1. `scripts/generate_catalog_seed.py`
2. `scripts/build_catalog.py`

Workflow:
    python3 scripts/generate_catalog_seed.py
    python3 scripts/build_catalog.py
    python3 scripts/import_catalog_json.py --catalog-dir content/catalog --dry-run
    python3 scripts/import_catalog_json.py --catalog-dir content/catalog --db "$DATABASE_URL"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_CATALOG_DIR = Path("content/catalog")
TYPEFACES_FILE = "typefaces-core.json"
RUNTIME_FILE = "font-runtime-assets.json"
EXPERT_FILE = "expert-answer-keys.json"

DB_RUNTIME_STATUSES = {"ready", "missing", "error"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import final built catalog JSON files into PostgreSQL."
    )
    parser.add_argument(
        "--catalog-dir",
        default=str(DEFAULT_CATALOG_DIR),
        help="Directory containing the built catalog JSON files.",
    )
    parser.add_argument(
        "--db",
        help="PostgreSQL URL (ex: postgresql://user:pass@host/dbname)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print the import plan without writing to DB.",
    )
    return parser.parse_args()


def load_payload(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"ERREUR : fichier JSON introuvable: {path}")
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"ERREUR : JSON invalide dans {path}: {exc}")
        sys.exit(1)

    if not isinstance(payload, dict) or "records" not in payload:
        print(f"ERREUR : {path} doit contenir un objet avec une cle 'records'")
        sys.exit(1)
    if not isinstance(payload["records"], list):
        print(f"ERREUR : la cle 'records' de {path} doit etre une liste")
        sys.exit(1)
    return payload


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def typeface_rows(records: list[dict]) -> list[dict]:
    rows: list[dict] = []
    timestamp = now_utc()

    for record in records:
        rows.append(
            {
                "typeface_slug": record["typeface_slug"],
                "display_name": record["display_name"],
                "display_name_ascii": record["display_name_ascii"],
                "primary_category": record["primary_category"],
                "sub_category": record["sub_category"],
                "visual_cluster_id": record["visual_cluster_id"],
                "dreyfus_tier": record["dreyfus_tier"],
                "difficulty_base": record["difficulty_base"],
                "rarity_tag": record["rarity_tag"],
                "activation_status": bool(record["activation_status"]),
                "font_source": record["font_source"],
                "is_variable_font": bool(record["is_variable_font"]),
                "release_year": record.get("release_year"),
                "designer": record.get("designer"),
                "foundry": record.get("foundry"),
                "license_type": record.get("license_type", "unknown"),
                "license_url": record.get("license_url"),
                "year_tag": record["year_tag"],
                "weight_structure": record["weight_structure"],
                "contrast_profile": record["contrast_profile"],
                "aperture_profile": record["aperture_profile"],
                "fallback_stack": record.get("fallback_stack"),
                "structural_signature_json": json.dumps(record["structural_signature"]),
                "expert_enabled": bool(record.get("expert_enabled", False)),
                "min_mode": record.get("min_mode", "training"),
                "qa_status": record.get("qa_status", "draft"),
                "updated_at_utc": timestamp,
            }
        )

    return rows


def normalize_runtime_row(record: dict) -> tuple[dict | None, str | None]:
    runtime_status = record.get("runtime_status")
    if runtime_status not in DB_RUNTIME_STATUSES:
        return None, f"runtime_status unsupported for DB import: {runtime_status}"

    relative_path = record.get("runtime_path") or record.get("source_path")
    if not relative_path:
        return None, "missing runtime_path/source_path"

    return (
        {
            "typeface_slug": record["typeface_slug"],
            "font_format": record["font_format"],
            "weight": record["weight"],
            "style": record["style"],
            "relative_path": relative_path,
            "file_size_bytes": record.get("file_size_bytes"),
            "sha256_hash": record.get("sha256_hash"),
            "runtime_status": runtime_status,
            "verified_at_utc": record.get("verified_at_utc"),
            "updated_at_utc": now_utc(),
        },
        None,
    )


def runtime_rows(records: list[dict]) -> tuple[list[dict], dict]:
    rows: list[dict] = []
    report = {
        "prepared": 0,
        "skipped_unsupported_status": 0,
        "skipped_incomplete": 0,
        "warnings": [],
    }

    for record in records:
        row, warning = normalize_runtime_row(record)
        if row is None:
            if record.get("runtime_status") not in DB_RUNTIME_STATUSES:
                report["skipped_unsupported_status"] += 1
            else:
                report["skipped_incomplete"] += 1
            report["warnings"].append(
                {
                    "typeface_slug": record.get("typeface_slug", "-"),
                    "warning": warning,
                }
            )
            continue

        rows.append(row)
        report["prepared"] += 1

    return rows, report


def expert_rows(records: list[dict]) -> list[dict]:
    timestamp = now_utc()
    return [
        {
            "typeface_slug": record["typeface_slug"],
            "answer_text": record["answer_text"],
            "answer_normalized": record["answer_normalized"],
            "is_canonical": bool(record.get("is_canonical", False)),
            "locale": record.get("locale", "any"),
            "qa_status": record.get("qa_status", "draft"),
            "updated_at_utc": timestamp,
        }
        for record in records
    ]


def import_typefaces(rows: list[dict], db_url: str) -> dict[str, object]:
    import psycopg2

    report: dict[str, object] = {"inserted": 0, "updated": 0, "errors": []}
    select_existing_sql = "SELECT typeface_slug FROM typefaces_core"
    upsert_sql = """
        INSERT INTO typefaces_core (
            typeface_slug, display_name, display_name_ascii,
            primary_category, sub_category, visual_cluster_id,
            dreyfus_tier, difficulty_base, rarity_tag,
            activation_status, font_source, is_variable_font,
            release_year, designer, foundry, license_type, license_url,
            year_tag, weight_structure, contrast_profile, aperture_profile,
            fallback_stack, structural_signature_json,
            expert_enabled, min_mode, qa_status, updated_at_utc
        ) VALUES (
            %(typeface_slug)s, %(display_name)s, %(display_name_ascii)s,
            %(primary_category)s, %(sub_category)s, %(visual_cluster_id)s,
            %(dreyfus_tier)s, %(difficulty_base)s, %(rarity_tag)s,
            %(activation_status)s, %(font_source)s, %(is_variable_font)s,
            %(release_year)s, %(designer)s, %(foundry)s, %(license_type)s, %(license_url)s,
            %(year_tag)s, %(weight_structure)s, %(contrast_profile)s, %(aperture_profile)s,
            %(fallback_stack)s, %(structural_signature_json)s,
            %(expert_enabled)s, %(min_mode)s, %(qa_status)s, %(updated_at_utc)s
        )
        ON CONFLICT (typeface_slug) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            display_name_ascii = EXCLUDED.display_name_ascii,
            primary_category = EXCLUDED.primary_category,
            sub_category = EXCLUDED.sub_category,
            visual_cluster_id = EXCLUDED.visual_cluster_id,
            dreyfus_tier = EXCLUDED.dreyfus_tier,
            difficulty_base = EXCLUDED.difficulty_base,
            rarity_tag = EXCLUDED.rarity_tag,
            activation_status = EXCLUDED.activation_status,
            font_source = EXCLUDED.font_source,
            is_variable_font = EXCLUDED.is_variable_font,
            release_year = EXCLUDED.release_year,
            designer = EXCLUDED.designer,
            foundry = EXCLUDED.foundry,
            license_type = EXCLUDED.license_type,
            license_url = EXCLUDED.license_url,
            year_tag = EXCLUDED.year_tag,
            weight_structure = EXCLUDED.weight_structure,
            contrast_profile = EXCLUDED.contrast_profile,
            aperture_profile = EXCLUDED.aperture_profile,
            fallback_stack = EXCLUDED.fallback_stack,
            structural_signature_json = EXCLUDED.structural_signature_json,
            expert_enabled = EXCLUDED.expert_enabled,
            min_mode = EXCLUDED.min_mode,
            qa_status = EXCLUDED.qa_status,
            updated_at_utc = EXCLUDED.updated_at_utc
    """

    conn = psycopg2.connect(db_url)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(select_existing_sql)
                existing_keys = {row[0] for row in cur.fetchall()}
                for row in rows:
                    try:
                        cur.execute(upsert_sql, row)
                        if row["typeface_slug"] in existing_keys:
                            report["updated"] += 1
                        else:
                            report["inserted"] += 1
                            existing_keys.add(row["typeface_slug"])
                    except Exception as exc:
                        report["errors"].append(
                            {"slug": row["typeface_slug"], "error": str(exc)}
                        )
    finally:
        conn.close()

    return report


def import_runtime_assets(rows: list[dict], db_url: str) -> dict[str, object]:
    import psycopg2

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
                    except Exception as exc:
                        report["errors"].append(
                            {"slug": row["typeface_slug"], "error": str(exc)}
                        )
    finally:
        conn.close()

    return report


def import_expert_answers(rows: list[dict], db_url: str) -> dict[str, object]:
    import psycopg2

    report: dict[str, object] = {"inserted": 0, "updated": 0, "errors": []}
    select_existing_sql = """
        SELECT typeface_slug, answer_normalized
        FROM expert_answer_keys
    """
    upsert_sql = """
        INSERT INTO expert_answer_keys (
            typeface_slug,
            answer_text,
            answer_normalized,
            is_canonical,
            locale,
            qa_status,
            updated_at_utc
        ) VALUES (
            %(typeface_slug)s,
            %(answer_text)s,
            %(answer_normalized)s,
            %(is_canonical)s,
            %(locale)s,
            %(qa_status)s,
            %(updated_at_utc)s
        )
        ON CONFLICT (typeface_slug, answer_normalized) DO UPDATE SET
            answer_text = EXCLUDED.answer_text,
            is_canonical = EXCLUDED.is_canonical,
            locale = EXCLUDED.locale,
            qa_status = EXCLUDED.qa_status,
            updated_at_utc = EXCLUDED.updated_at_utc
    """

    conn = psycopg2.connect(db_url)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(select_existing_sql)
                existing_keys = {(row[0], row[1]) for row in cur.fetchall()}
                for row in rows:
                    key = (row["typeface_slug"], row["answer_normalized"])
                    try:
                        cur.execute(upsert_sql, row)
                        if key in existing_keys:
                            report["updated"] += 1
                        else:
                            report["inserted"] += 1
                            existing_keys.add(key)
                    except Exception as exc:
                        report["errors"].append(
                            {"slug": row["typeface_slug"], "error": str(exc)}
                        )
    finally:
        conn.close()

    return report


def print_preview(rows: list[dict], label: str, preview_fields: tuple[str, ...]) -> None:
    print(f"\n[DRY-RUN] {label}: {len(rows)} lignes pretes")
    for row in rows[:5]:
        preview = " | ".join(f"{field}={row.get(field)}" for field in preview_fields)
        print(f"  {preview}")


def main() -> None:
    args = parse_args()
    catalog_dir = Path(args.catalog_dir).expanduser().resolve()
    typefaces_payload = load_payload(catalog_dir / TYPEFACES_FILE)
    runtime_payload = load_payload(catalog_dir / RUNTIME_FILE)
    expert_payload = load_payload(catalog_dir / EXPERT_FILE)

    typeface_import_rows = typeface_rows(typefaces_payload["records"])
    runtime_import_rows, runtime_report = runtime_rows(runtime_payload["records"])
    expert_import_rows = expert_rows(expert_payload["records"])

    print(f"Lecture catalogue JSON : {catalog_dir}")
    print(
        f"  Typefaces core       : {len(typeface_import_rows)}\n"
        f"  Runtime assets total : {len(runtime_payload['records'])}\n"
        f"  Runtime assets DB-ok : {len(runtime_import_rows)}\n"
        f"  Expert answer keys   : {len(expert_import_rows)}"
    )

    if runtime_report["warnings"]:
        print(
            f"  Runtime skipped      : {runtime_report['skipped_unsupported_status'] + runtime_report['skipped_incomplete']}"
        )
        for warning in runtime_report["warnings"][:10]:
            print(f"    {warning['typeface_slug']}: {warning['warning']}")

    if args.dry_run:
        print_preview(
            typeface_import_rows,
            "typefaces_core",
            ("typeface_slug", "qa_status", "expert_enabled"),
        )
        print_preview(
            runtime_import_rows,
            "font_runtime_assets",
            ("typeface_slug", "runtime_status", "relative_path"),
        )
        print_preview(
            expert_import_rows,
            "expert_answer_keys",
            ("typeface_slug", "answer_normalized", "qa_status"),
        )
        print("\nAucune ecriture en DB (mode dry-run).")
        sys.exit(0)

    if not args.db:
        env_db = os.environ.get("DATABASE_URL")
        if env_db:
            args.db = env_db
        else:
            print("ERREUR : --db requis en dehors du mode --dry-run")
            sys.exit(1)

    try:
        import psycopg2  # noqa: F401
    except ImportError:
        print("ERREUR : psycopg2 non installe. Lance : pip install psycopg2-binary")
        sys.exit(1)

    print("\nImport typefaces_core...")
    typeface_report = import_typefaces(typeface_import_rows, args.db)
    print("Import font_runtime_assets...")
    runtime_db_report = import_runtime_assets(runtime_import_rows, args.db)
    print("Import expert_answer_keys...")
    expert_report = import_expert_answers(expert_import_rows, args.db)

    print("\nImport termine")
    print(
        f"  typefaces_core       : +{typeface_report['inserted']} / ~{typeface_report['updated']}\n"
        f"  font_runtime_assets  : +{runtime_db_report['inserted']} / ~{runtime_db_report['updated']}\n"
        f"  expert_answer_keys   : +{expert_report['inserted']} / ~{expert_report['updated']}"
    )
    print(
        f"  runtime skipped      : {runtime_report['skipped_unsupported_status'] + runtime_report['skipped_incomplete']}"
    )

    errors = (
        list(typeface_report["errors"])
        + list(runtime_db_report["errors"])
        + list(expert_report["errors"])
    )
    if errors:
        print(f"  Erreurs DB           : {len(errors)}")
        for error in errors[:20]:
            print(f"    {error['slug']}: {error['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
