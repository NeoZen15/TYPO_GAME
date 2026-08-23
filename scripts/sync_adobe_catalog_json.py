"""
sync_adobe_catalog_json.py

Ecrit les 108 polices Adobe dans content/catalog/typefaces-core.json, en miroir
exact de ce que la migration 016 a pose en base.

POURQUOI CE SCRIPT EXISTE. scripts/import_catalog_json.py rejoue ce JSON dans la
base avec un ON CONFLICT DO UPDATE sur font_source, license_type et
activation_status. Tant que le JSON ignore les lignes Adobe, le prochain reimport
les rebasculerait en 'local' et 'proprietary', donc eteintes. Le piege etait
signale en commentaire dans les migrations 010, 013, 014, 015 et 016 ; depuis que
la 016 est APPLIQUEE en production, il n'est plus theorique.

Il derive tout du meme endroit que la migration : le SQL genere. Les deux ne
peuvent donc pas diverger sans que check:adobe-migration le voie.

Usage :
    ./.venv/bin/python scripts/sync_adobe_catalog_json.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

MIGRATION = "db/migrations/016_adobe_catalog_rows.sql"
CATALOGUE = "content/catalog/typefaces-core.json"

NOTES = [
    "servie par le projet web Adobe Fonts, aucun fichier chez nous",
    "champs editoriaux derives par regle, voir la migration 016",
    "qa_status review : aucun oeil humain n'est encore passe",
]


def decouper(bloc: str) -> list[str | None]:
    """Decoupe une liste de valeurs SQL en respectant les quotes doublees."""
    out: list[str | None] = []
    i = 0
    while i < len(bloc):
        if bloc[i] == "'":
            j, val = i + 1, ""
            while j < len(bloc):
                if bloc[j] == "'" and j + 1 < len(bloc) and bloc[j + 1] == "'":
                    val += "'"
                    j += 2
                    continue
                if bloc[j] == "'":
                    break
                val += bloc[j]
                j += 1
            out.append(val)
            i = j + 1
        elif bloc[i].isalpha():
            mot = re.match(r"[A-Za-z]+", bloc[i:]).group(0)
            if mot != "jsonb":
                out.append(None if mot == "NULL" else mot)
            i += len(mot)
        else:
            i += 1
    return out


def main() -> int:
    sql = Path(MIGRATION).read_text(encoding="utf-8")
    colonnes = [
        c.strip()
        for c in re.search(r"INSERT INTO typefaces_core \(\n(.*?)\n\) VALUES", sql, re.S).group(1).split(",")
        if c.strip()
    ]
    inserts = [
        dict(zip(colonnes, decouper(bloc)))
        for bloc in re.findall(r"\) VALUES \(\n(.*?)\n\)\nON CONFLICT", sql, re.S)
    ]
    # Les 4 rallumages : slug plus les colonnes que l'UPDATE pose.
    maj = {}
    for bloc in re.findall(r"UPDATE typefaces_core SET\n(.*?)\nWHERE typeface_slug = '([^']+)';", sql, re.S):
        corps, slug = bloc
        maj[slug] = dict(re.findall(r"(\w+) = '([^']*)'", corps))

    catalogue = json.loads(Path(CATALOGUE).read_text(encoding="utf-8"))
    par_slug = {r["typeface_slug"]: r for r in catalogue["records"]}

    ajoutees = 0
    for r in inserts:
        signature = json.loads(r["structural_signature_json"])
        ligne = {
            "typeface_slug": r["typeface_slug"],
            "display_name": r["display_name"],
            "display_name_ascii": r["display_name_ascii"],
            "primary_category": r["primary_category"],
            "sub_category": r["sub_category"],
            "visual_cluster_id": r["visual_cluster_id"],
            "dreyfus_tier": r["dreyfus_tier"],
            "difficulty_base": r["difficulty_base"],
            "rarity_tag": r["rarity_tag"],
            "activation_status": True,
            "font_source": "adobe",
            "is_variable_font": False,
            "year_tag": r["year_tag"],
            "weight_structure": r["weight_structure"],
            "contrast_profile": r["contrast_profile"],
            "aperture_profile": r["aperture_profile"],
            "structural_signature": signature,
            "release_year": None,
            "designer": None,
            "foundry": None,
            "license_type": "adobe_fonts",
            "license_url": r["license_url"],
            "fallback_stack": r["fallback_stack"],
            "expert_enabled": False,
            "min_mode": r["min_mode"],
            "qa_status": r["qa_status"],
            "notes": list(NOTES),
        }
        if ligne["typeface_slug"] in par_slug:
            par_slug[ligne["typeface_slug"]].update(ligne)
        else:
            catalogue["records"].append(ligne)
            par_slug[ligne["typeface_slug"]] = ligne
            ajoutees += 1

    # Les 4 rallumages gardent leur classification revue a la main, seules les
    # colonnes que l'UPDATE touche changent.
    for slug, champs in maj.items():
        ligne = par_slug[slug]
        ligne.update({
            "font_source": "adobe",
            "license_type": "adobe_fonts",
            "activation_status": True,
            "rarity_tag": champs["rarity_tag"],
            "difficulty_base": champs["difficulty_base"],
            "fallback_stack": champs["fallback_stack"],
            "qa_status": champs["qa_status"],
        })
        notes = ligne.setdefault("notes", [])
        if NOTES[0] not in notes:
            notes.append(NOTES[0])

    catalogue["records"].sort(key=lambda r: r["typeface_slug"])
    Path(CATALOGUE).write_text(
        json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"{ajoutees} lignes ajoutees, {len(maj)} rallumages repercutes")
    print(f"catalogue JSON : {len(catalogue['records'])} lignes, "
          f"{sum(1 for r in catalogue['records'] if r['activation_status'])} actives")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
