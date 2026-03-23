"""
import_catalogue.py
JEUX DE TYPO -- import Excel -> PostgreSQL

Usage:
    python scripts/import_catalogue.py --excel path/to/catalogue.xlsx --db postgresql://user:pass@host/dbname
    python scripts/import_catalogue.py --excel path/to/catalogue.xlsx --dry-run

In dry-run mode, the script validates the Excel file and prints a QA report
without writing anything to the database.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone

import pandas as pd


SHEET_NAME = "typefaces"

VALID_PRIMARY_CATEGORY = {"sans_serif", "serif", "mono", "display"}
VALID_SUB_CATEGORY = {
    "neo_grotesk",
    "humanist",
    "geometric",
    "transitional",
    "old_style",
    "didone",
    "slab",
    "grotesk",
    "script",
}
VALID_DIFFICULTY_BASE = {"easy", "medium", "hard"}
VALID_RARITY_TAG = {"common", "uncommon", "rare"}
VALID_DREYFUS_TIER = {"N", "D", "C", "A", "E"}
VALID_FONT_SOURCE = {"google", "local", "future"}
VALID_YEAR_TAG = {"classic", "modern", "contemporary"}
VALID_WEIGHT_STRUCTURE = {"single_weight", "regular_to_bold", "light_to_black"}
VALID_CONTRAST_PROFILE = {"low", "medium", "high", "very_high"}
VALID_APERTURE_PROFILE = {"open", "semi_open", "closed"}

REQUIRED_COLUMNS = {
    "typeface_slug",
    "display_name",
    "primary_category",
    "sub_category",
    "difficulty_base",
    "rarity_tag",
    "visual_cluster_id",
    "dreyfus_tier",
    "activation_status",
    "font_source",
    "is_variable_font",
    "year_tag",
    "weight_structure",
    "contrast_profile",
    "aperture_profile",
    "structural_signature",
}

STRUCTURAL_SIGNATURE_KEYS = {
    "a_type",
    "e_aperture",
    "axis",
    "contrast",
    "terminals",
    "serifs",
    "x_height",
    "fixed_width",
    "width",
    "caps_only",
    "distinctive_w",
}

DEFAULTS = {
    "release_year": None,
    "designer": None,
    "foundry": None,
    "license_type": "unknown",
    "license_url": None,
    "fallback_stack": None,
    "expert_enabled": False,
    "min_mode": "training",
    "qa_status": "draft",
}


def normalize_answer(text: str) -> str:
    """Lowercase, remove accents, spaces, and punctuation."""
    normalized = text.lower()
    normalized = unicodedata.normalize("NFD", normalized)
    normalized = "".join(
        char for char in normalized if unicodedata.category(char) != "Mn"
    )
    return re.sub(r"[^a-z0-9]", "", normalized)


def run_qa(df: pd.DataFrame) -> list[dict[str, str]]:
    """Return blocking QA errors. Empty list means the import can continue."""
    errors: list[dict[str, str]] = []

    def err(row_idx: int, slug: str, rule: str, detail: str = "") -> None:
        errors.append(
            {
                "row": str(row_idx + 2),
                "slug": slug,
                "rule": rule,
                "detail": detail,
            }
        )

    missing_columns = sorted(REQUIRED_COLUMNS - set(df.columns))
    if missing_columns:
        errors.append(
            {
                "row": "header",
                "slug": "-",
                "rule": "MISSING_REQUIRED_COLUMNS",
                "detail": ", ".join(missing_columns),
            }
        )
        return errors

    duplicate_rows = df[df["typeface_slug"].duplicated(keep=False)]
    for idx, row in duplicate_rows.iterrows():
        err(idx, str(row["typeface_slug"]), "SLUG_NOT_UNIQUE")

    for idx, row in df.iterrows():
        slug = str(row["typeface_slug"])

        if not re.match(r"^[a-z0-9_]+$", slug):
            err(idx, slug, "SLUG_INVALID_FORMAT", f"valeur: '{slug}'")

        if pd.isna(row["display_name"]) or str(row["display_name"]).strip() == "":
            err(idx, slug, "DISPLAY_NAME_EMPTY")

        enum_checks = [
            ("primary_category", VALID_PRIMARY_CATEGORY),
            ("sub_category", VALID_SUB_CATEGORY),
            ("difficulty_base", VALID_DIFFICULTY_BASE),
            ("rarity_tag", VALID_RARITY_TAG),
            ("dreyfus_tier", VALID_DREYFUS_TIER),
            ("font_source", VALID_FONT_SOURCE),
            ("year_tag", VALID_YEAR_TAG),
            ("weight_structure", VALID_WEIGHT_STRUCTURE),
            ("contrast_profile", VALID_CONTRAST_PROFILE),
            ("aperture_profile", VALID_APERTURE_PROFILE),
        ]

        for column_name, valid_values in enum_checks:
            value = "" if pd.isna(row[column_name]) else str(row[column_name])
            if value not in valid_values:
                err(
                    idx,
                    slug,
                    f"INVALID_ENUM_{column_name.upper()}",
                    f"valeur: '{value}'",
                )

        try:
            signature = json.loads(row["structural_signature"])
        except (json.JSONDecodeError, TypeError):
            err(idx, slug, "STRUCTURAL_SIGNATURE_INVALID_JSON")
            continue

        missing_keys = STRUCTURAL_SIGNATURE_KEYS - set(signature.keys())
        extra_keys = set(signature.keys()) - STRUCTURAL_SIGNATURE_KEYS
        if missing_keys:
            err(
                idx,
                slug,
                "STRUCTURAL_SIGNATURE_MISSING_KEYS",
                f"manquantes: {sorted(missing_keys)}",
            )
        if extra_keys:
            err(
                idx,
                slug,
                "STRUCTURAL_SIGNATURE_EXTRA_KEYS",
                f"en trop: {sorted(extra_keys)}",
            )

        if signature.get("contrast") != row["contrast_profile"]:
            err(
                idx,
                slug,
                "CONTRAST_INCOHERENCE",
                f"sig={signature.get('contrast')} vs col={row['contrast_profile']}",
            )

        if signature.get("e_aperture") != row["aperture_profile"]:
            err(
                idx,
                slug,
                "APERTURE_INCOHERENCE",
                f"sig={signature.get('e_aperture')} vs col={row['aperture_profile']}",
            )

        if str(row["font_source"]) == "future" and bool(row["activation_status"]):
            err(idx, slug, "FUTURE_SOURCE_MUST_BE_INACTIVE")

    return errors


def build_row(row: pd.Series) -> dict[str, object]:
    """Transform one Excel row into a dict ready for SQL insertion."""
    signature = json.loads(row["structural_signature"])
    display_name = str(row["display_name"])

    return {
        "typeface_slug": str(row["typeface_slug"]),
        "display_name": display_name,
        "display_name_ascii": normalize_answer(display_name),
        "primary_category": str(row["primary_category"]),
        "sub_category": str(row["sub_category"]),
        "visual_cluster_id": str(row["visual_cluster_id"]),
        "dreyfus_tier": str(row["dreyfus_tier"]),
        "difficulty_base": str(row["difficulty_base"]),
        "rarity_tag": str(row["rarity_tag"]),
        "activation_status": bool(row["activation_status"]),
        "font_source": str(row["font_source"]),
        "is_variable_font": bool(row["is_variable_font"]),
        "year_tag": str(row["year_tag"]),
        "weight_structure": str(row["weight_structure"]),
        "contrast_profile": str(row["contrast_profile"]),
        "aperture_profile": str(row["aperture_profile"]),
        "structural_signature_json": json.dumps(signature),
        "release_year": DEFAULTS["release_year"],
        "designer": DEFAULTS["designer"],
        "foundry": DEFAULTS["foundry"],
        "license_type": DEFAULTS["license_type"],
        "license_url": DEFAULTS["license_url"],
        "fallback_stack": DEFAULTS["fallback_stack"],
        "expert_enabled": DEFAULTS["expert_enabled"],
        "min_mode": DEFAULTS["min_mode"],
        "qa_status": DEFAULTS["qa_status"],
        "updated_at_utc": datetime.now(timezone.utc),
    }


def import_to_db(rows: list[dict[str, object]], db_url: str) -> dict[str, object]:
    """Upsert rows into typefaces_core and return an import report."""
    try:
        import psycopg2
    except ImportError:
        print("ERREUR : psycopg2 non installe. Lance : pip install psycopg2-binary")
        sys.exit(1)

    report: dict[str, object] = {"inserted": 0, "updated": 0, "errors": []}

    select_existing_sql = "SELECT typeface_slug FROM typefaces_core"
    upsert_sql = """
        INSERT INTO typefaces_core (
            typeface_slug, display_name, display_name_ascii,
            primary_category, sub_category, visual_cluster_id,
            dreyfus_tier, difficulty_base, rarity_tag,
            activation_status, font_source, is_variable_font,
            year_tag, weight_structure, contrast_profile, aperture_profile,
            structural_signature_json,
            release_year, designer, foundry,
            license_type, license_url, fallback_stack,
            expert_enabled, min_mode, qa_status, updated_at_utc
        ) VALUES (
            %(typeface_slug)s, %(display_name)s, %(display_name_ascii)s,
            %(primary_category)s, %(sub_category)s, %(visual_cluster_id)s,
            %(dreyfus_tier)s, %(difficulty_base)s, %(rarity_tag)s,
            %(activation_status)s, %(font_source)s, %(is_variable_font)s,
            %(year_tag)s, %(weight_structure)s, %(contrast_profile)s, %(aperture_profile)s,
            %(structural_signature_json)s,
            %(release_year)s, %(designer)s, %(foundry)s,
            %(license_type)s, %(license_url)s, %(fallback_stack)s,
            %(expert_enabled)s, %(min_mode)s, %(qa_status)s, %(updated_at_utc)s
        )
        ON CONFLICT (typeface_slug) DO UPDATE SET
            display_name              = EXCLUDED.display_name,
            display_name_ascii        = EXCLUDED.display_name_ascii,
            primary_category          = EXCLUDED.primary_category,
            sub_category              = EXCLUDED.sub_category,
            visual_cluster_id         = EXCLUDED.visual_cluster_id,
            dreyfus_tier              = EXCLUDED.dreyfus_tier,
            difficulty_base           = EXCLUDED.difficulty_base,
            rarity_tag                = EXCLUDED.rarity_tag,
            activation_status         = EXCLUDED.activation_status,
            font_source               = EXCLUDED.font_source,
            is_variable_font          = EXCLUDED.is_variable_font,
            year_tag                  = EXCLUDED.year_tag,
            weight_structure          = EXCLUDED.weight_structure,
            contrast_profile          = EXCLUDED.contrast_profile,
            aperture_profile          = EXCLUDED.aperture_profile,
            structural_signature_json = EXCLUDED.structural_signature_json,
            license_type              = EXCLUDED.license_type,
            updated_at_utc            = EXCLUDED.updated_at_utc
    """

    conn = psycopg2.connect(db_url)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(select_existing_sql)
                existing_slugs = {row[0] for row in cur.fetchall()}

                for row in rows:
                    try:
                        cur.execute(upsert_sql, row)
                        if row["typeface_slug"] in existing_slugs:
                            report["updated"] += 1
                        else:
                            report["inserted"] += 1
                            existing_slugs.add(row["typeface_slug"])
                    except Exception as exc:  # pragma: no cover - DB dependent
                        report["errors"].append(
                            {
                                "slug": row["typeface_slug"],
                                "error": str(exc),
                            }
                        )
    finally:
        conn.close()

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Import catalogue Excel -> PostgreSQL")
    parser.add_argument("--excel", required=True, help="Chemin vers le fichier .xlsx")
    parser.add_argument("--db", help="URL PostgreSQL (ex: postgresql://user:pass@host/db)")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valide sans ecrire en DB",
    )
    args = parser.parse_args()

    print(f"Lecture : {args.excel}")
    try:
        dataframe = pd.read_excel(args.excel, sheet_name=SHEET_NAME)
        dataframe.columns = [str(column).strip() for column in dataframe.columns]
    except Exception as exc:
        print(f"ERREUR lecture Excel : {exc}")
        sys.exit(1)

    print(f"  {len(dataframe)} lignes trouvees dans la sheet '{SHEET_NAME}'")

    print("\nValidation QA...")
    errors = run_qa(dataframe)

    if errors:
        print(f"\n{len(errors)} erreur(s) bloquante(s) -- import annule\n")
        for error in errors:
            print(f"  Ligne {error['row']} | {error['slug']:25} | {error['rule']}")
            if error["detail"]:
                print(f"    -> {error['detail']}")
        sys.exit(1)

    print("  QA passee -- 0 erreur bloquante")
    rows = [build_row(row) for _, row in dataframe.iterrows()]

    if args.dry_run:
        print(f"\n[DRY-RUN] {len(rows)} lignes pretes a importer")
        print("\nApercu (3 premieres lignes) :")
        for row in rows[:3]:
            print(
                f"  {row['typeface_slug']:25} | ascii={row['display_name_ascii']:20} "
                f"| qa={row['qa_status']} | expert={row['expert_enabled']}"
            )
        print("\nAucune ecriture en DB (mode dry-run).")
        sys.exit(0)

    if not args.db:
        print("ERREUR : --db requis en dehors du mode --dry-run")
        sys.exit(1)

    print("\nImport en base...")
    report = import_to_db(rows, args.db)

    print("\nImport termine")
    print(f"  Inserees : {report['inserted']}")
    print(f"  Mises a jour : {report['updated']}")
    if report["errors"]:
        print(f"  Erreurs DB : {len(report['errors'])}")
        for error in report["errors"]:
            print(f"    {error['slug']} : {error['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
