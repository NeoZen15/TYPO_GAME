"""
mass_catalog_candidates.py

Promote all remaining Google Fonts candidates into the main catalog as
catalog-only entries:
- added to `typefaces_core`
- added to `expert_answer_keys`
- not activated by default
- not added to main runtime assets by default

This is the safe large-scale ingestion mode used to make the catalog heavy
without mirroring thousands of new fonts into the app runtime immediately.

Usage:
    .venv/bin/python scripts/mass_catalog_candidates.py \
      --candidate-dir content/catalog/candidates/google-fonts-snapshot \
      --catalog-dir content/catalog \
      --output-dir content/catalog/candidates/google-fonts-snapshot/mass-catalog-promotion
"""

from __future__ import annotations

import argparse
import json
import unicodedata
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Mass-promote remaining candidates into catalog-only review entries.")
    parser.add_argument("--candidate-dir", required=True)
    parser.add_argument("--catalog-dir", default="content/catalog")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument(
        "--refresh-existing-auto",
        action="store_true",
        help="Also emit refresh fragments for existing auto mass-catalogued review records.",
    )
    return parser.parse_args()


def load_payload(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or "records" not in payload or not isinstance(payload["records"], list):
        raise SystemExit(f"Invalid payload format in {path}")
    return payload


def normalize_ascii(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return "".join(ch for ch in normalized.lower() if ch.isalnum())


def normalized_slug_key(value: str) -> str:
    return normalize_ascii(value.replace("_", " "))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def infer_primary_category(guessed: str | None) -> str:
    mapping = {
        "SANS_SERIF": "sans_serif",
        "SERIF": "serif",
        "MONOSPACE": "mono",
        "DISPLAY": "display",
        "HANDWRITING": "display",
    }
    return mapping.get(guessed or "", "sans_serif")


def infer_is_variable_font(record: dict) -> bool:
    for path in record.get("sample_source_paths") or []:
        if "[" in path and "]" in path:
            return True
    return False


def contains_any(slug: str, needles: list[str]) -> bool:
    return any(needle in slug for needle in needles)


def infer_width(slug: str) -> str:
    if contains_any(slug, ["condensed", "narrow", "semicondensed"]):
        return "condensed"
    return "normal"


def infer_sub_category(primary_category: str, slug: str) -> str:
    if primary_category == "mono":
        if "slab" in slug:
            return "slab"
        return "neo_grotesk"

    if primary_category == "serif":
        if contains_any(slug, ["slab", "josefinslab", "arvo", "bitter", "domine"]):
            return "slab"
        if contains_any(slug, ["garamond", "cormorant", "crimson", "alegreya", "baskerville", "caslon"]):
            return "old_style"
        if contains_any(slug, ["bodoni", "didot", "vidaloka", "prata", "fraunces"]):
            return "didone"
        return "transitional"

    if primary_category == "display":
        if contains_any(slug, ["script", "hand", "brush", "cursive", "callig", "pen", "marker"]):
            return "script"
        return "grotesk"

    if contains_any(slug, ["grotesk"]):
        return "grotesk"
    if contains_any(
        slug,
        [
            "geometric",
            "futura",
            "montserrat",
            "poppins",
            "manrope",
            "outfit",
            "urbanist",
            "lexend",
            "sora",
            "josefin",
            "exo",
            "orbitron",
        ],
    ):
        return "geometric"
    if contains_any(
        slug,
        [
            "humanist",
            "open",
            "source",
            "fira",
            "noto",
            "cabin",
            "cantarell",
            "karla",
            "mulish",
            "heebo",
            "asap",
            "lato",
            "sans",
        ],
    ):
        return "humanist"
    return "neo_grotesk"


def infer_visual_cluster_id(primary_category: str, sub_category: str, width: str) -> str:
    if primary_category == "mono":
        return "cluster_mono_slab_A" if sub_category == "slab" else "cluster_mono_sans_A"
    if primary_category == "serif":
        if sub_category == "didone":
            return "cluster_didone_A"
        if sub_category == "old_style":
            return "cluster_oldstyle_A"
        if sub_category == "slab":
            return "cluster_slab_serif_A"
        return "cluster_transitional_A"
    if width == "condensed":
        return "cluster_display_condensed_A"
    if primary_category == "display":
        return "cluster_display_script_A" if sub_category == "script" else "cluster_display_condensed_A"
    if sub_category == "humanist":
        return "cluster_humanist_A"
    if sub_category == "geometric":
        return "cluster_geometric_A"
    if sub_category == "grotesk":
        return "cluster_grotesk_A"
    return "cluster_neo_grotesk_A"


def infer_difficulty(primary_category: str, sub_category: str) -> tuple[str, str, str]:
    if primary_category == "display":
        return "C", "hard", "uncommon"
    if primary_category == "mono":
        return "D", "medium", "common"
    if primary_category == "serif":
        if sub_category == "didone":
            return "C", "hard", "uncommon"
        return "D", "medium", "common"
    if sub_category == "geometric":
        return "N", "easy", "common"
    if sub_category == "humanist":
        return "N", "easy", "common"
    if sub_category == "grotesk":
        return "D", "medium", "common"
    return "N", "medium", "common"


def infer_weight_structure(record: dict, width: str, primary_category: str) -> str:
    if infer_is_variable_font(record):
        return "light_to_black"
    count = int(record.get("source_file_count") or 1)
    slug = record["typeface_slug"]
    if count <= 1 and primary_category == "display" and width == "normal":
        return "single_weight"
    if count <= 1 and contains_any(slug, ["black", "display", "poster"]):
        return "single_weight"
    if count >= 4:
        return "light_to_black"
    return "regular_to_bold"


def infer_year_tag(record: dict) -> str:
    year = record.get("google_date_added_year")
    if isinstance(year, int):
        if year <= 2013:
            return "classic"
        if year <= 2019:
            return "modern"
        return "contemporary"
    return "modern"


def infer_contrast_aperture(primary_category: str, sub_category: str) -> tuple[str, str]:
    if primary_category == "mono":
        return "low", "semi_open"
    if primary_category == "serif":
        if sub_category == "didone":
            return "very_high", "closed"
        if sub_category == "slab":
            return "low", "semi_open"
        if sub_category == "old_style":
            return "medium", "closed"
        return "medium", "closed"
    if primary_category == "display":
        if sub_category == "script":
            return "medium", "open"
        return "medium", "closed"
    if sub_category == "humanist":
        return "low", "open"
    if sub_category == "geometric":
        return "low", "open"
    if sub_category == "grotesk":
        return "low", "semi_open"
    return "low", "semi_open"


def infer_structural_signature(
    primary_category: str,
    sub_category: str,
    width: str,
    contrast: str,
    aperture: str,
    fixed_width: bool,
) -> dict:
    a_type = "double_storey"
    axis = "vertical"
    terminals = "cut_horizontal"
    serifs = None
    x_height = "large" if primary_category in {"sans_serif", "display"} else "medium"

    if primary_category == "mono":
        terminals = "cut_oblique"
        x_height = "medium"
    elif primary_category == "serif":
        serifs = "bracketed"
        if sub_category == "slab":
            serifs = "slab"
            terminals = "slab"
        elif sub_category == "old_style":
            axis = "slightly_inclined"
            terminals = "cut_oblique"
        elif sub_category == "didone":
            serifs = "hairline"
            terminals = "cut_horizontal"
        else:
            terminals = "cut_horizontal"
    elif primary_category == "display":
        a_type = "single_storey"
        terminals = "rounded" if sub_category == "script" else "cut_horizontal"
    else:
        if sub_category == "humanist":
            axis = "slightly_inclined"
            terminals = "rounded"
        elif sub_category == "geometric":
            a_type = "single_storey"
            terminals = "cut_horizontal"
        elif sub_category == "grotesk":
            terminals = "cut_horizontal"
        else:
            terminals = "cut_horizontal"

    return {
        "a_type": a_type,
        "e_aperture": aperture,
        "axis": axis,
        "contrast": contrast,
        "terminals": terminals,
        "serifs": serifs,
        "x_height": x_height,
        "fixed_width": fixed_width,
        "width": width,
        "caps_only": False,
        "distinctive_w": False,
    }


def build_typeface_record(record: dict, *, output_slug: str | None = None) -> dict:
    slug = output_slug or record["typeface_slug"]
    primary_category = infer_primary_category(record.get("guessed_google_category"))
    width = infer_width(slug)
    sub_category = infer_sub_category(primary_category, slug)
    visual_cluster_id = infer_visual_cluster_id(primary_category, sub_category, width)
    dreyfus_tier, difficulty_base, rarity_tag = infer_difficulty(primary_category, sub_category)
    weight_structure = infer_weight_structure(record, width, primary_category)
    contrast_profile, aperture_profile = infer_contrast_aperture(primary_category, sub_category)
    is_variable_font = infer_is_variable_font(record)
    structural_signature = infer_structural_signature(
        primary_category,
        sub_category,
        width,
        contrast_profile,
        aperture_profile,
        fixed_width=(primary_category == "mono"),
    )

    return {
        "typeface_slug": slug,
        "display_name": record["display_name_guess"],
        "display_name_ascii": record["display_name_ascii"],
        "primary_category": primary_category,
        "sub_category": sub_category,
        "visual_cluster_id": visual_cluster_id,
        "dreyfus_tier": dreyfus_tier,
        "difficulty_base": difficulty_base,
        "rarity_tag": rarity_tag,
        "activation_status": False,
        "font_source": record.get("guessed_font_source") or "google",
        "is_variable_font": is_variable_font,
        "year_tag": infer_year_tag(record),
        "weight_structure": weight_structure,
        "contrast_profile": contrast_profile,
        "aperture_profile": aperture_profile,
        "structural_signature": structural_signature,
        "release_year": None,
        "designer": record.get("guessed_designer"),
        "foundry": None,
        "license_type": record.get("guessed_license_type") or "unknown",
        "license_url": None,
        "fallback_stack": None,
        "expert_enabled": False,
        "min_mode": "training",
        "qa_status": "review",
        "notes": [
            "mass-catalogued automatically from google/fonts snapshot",
            "catalog-only promotion: not activated by default",
            "runtime asset is not mirrored into main public/fonts yet",
            "editorial fields were inferred heuristically and should be refined later if needed",
        ],
    }


def build_expert_record(record: dict, *, output_slug: str | None = None) -> dict:
    return {
        "typeface_slug": output_slug or record["typeface_slug"],
        "answer_text": record["answer_text_guess"],
        "answer_normalized": record["answer_normalized"],
        "is_canonical": True,
        "locale": record.get("locale", "any"),
        "qa_status": "review",
        "notes": [
            "mass-catalogued automatically from google/fonts snapshot",
            "canonical answer still pending editorial approval",
        ],
    }


def is_safe_auto_refresh(record: dict | None) -> bool:
    if not record:
        return False
    notes = record.get("notes") or []
    has_auto_note = any(
        isinstance(note, str) and "mass-catalogued automatically from google/fonts snapshot" in note
        for note in notes
    )
    if not has_auto_note:
        return False
    if record.get("qa_status") != "review":
        return False
    if bool(record.get("activation_status", False)):
        return False
    if bool(record.get("expert_enabled", False)):
        return False
    return True


def main() -> None:
    args = parse_args()
    candidate_dir = Path(args.candidate_dir).expanduser().resolve()
    catalog_dir = Path(args.catalog_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    current_catalog = load_payload(catalog_dir / "typefaces-core.json")
    current_records = {record["typeface_slug"]: record for record in current_catalog["records"]}
    current_slugs = set(current_records)
    current_slug_aliases = {
        normalized_slug_key(slug): slug
        for slug in current_slugs
    }

    typeface_candidates = load_payload(candidate_dir / "typefaces-core.candidates.json")
    expert_candidates = load_payload(candidate_dir / "expert-answer-keys.candidates.json")
    expert_lookup = {record["typeface_slug"]: record for record in expert_candidates["records"]}

    new_typefaces: list[dict] = []
    new_expert: list[dict] = []
    skipped_existing: list[str] = []
    refreshed_existing: list[str] = []

    for record in typeface_candidates["records"]:
        slug = record["typeface_slug"]
        matched_slug = slug
        if slug not in current_slugs:
            matched_slug = current_slug_aliases.get(normalized_slug_key(slug), slug)
        if matched_slug in current_slugs:
            if args.refresh_existing_auto and is_safe_auto_refresh(current_records.get(matched_slug)):
                if slug not in expert_lookup:
                    raise SystemExit(f"Missing Expert candidate record for slug: {slug}")
                new_typefaces.append(build_typeface_record(record, output_slug=matched_slug))
                new_expert.append(build_expert_record(expert_lookup[slug], output_slug=matched_slug))
                refreshed_existing.append(matched_slug)
                continue
            skipped_existing.append(matched_slug)
            continue
        if slug not in expert_lookup:
            raise SystemExit(f"Missing Expert candidate record for slug: {slug}")
        new_typefaces.append(build_typeface_record(record))
        new_expert.append(build_expert_record(expert_lookup[slug]))

    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "candidate_dir": str(candidate_dir),
        "catalog_dir": str(catalog_dir),
        "counts": {
            "candidate_total": len(typeface_candidates["records"]),
            "emitted_typefaces_total": len(new_typefaces),
            "new_typefaces_total": len(new_typefaces),
            "skipped_existing_total": len(skipped_existing),
            "refreshed_existing_total": len(refreshed_existing),
        },
        "skipped_existing_slugs": skipped_existing,
        "refreshed_existing_slugs": refreshed_existing,
        "notes": [
            "This is a catalog-only mass promotion.",
            "New records are inactive by default and remain qa_status=review.",
            "Main runtime assets are not mirrored in this step.",
            "When --refresh-existing-auto is enabled, untouched mass-catalogued review records can be refreshed safely.",
        ],
    }

    write_json(output_dir / "typefaces-core.mass-catalog.json", {"meta": meta, "records": new_typefaces})
    write_json(output_dir / "expert-answer-keys.mass-catalog.json", {"meta": meta, "records": new_expert})
    write_json(output_dir / "mass-catalog-report.json", meta)


if __name__ == "__main__":
    main()
