"""
sync_catalog_rarity_json.py

Repercute la migration 013 dans content/catalog/typefaces-core.json.

POURQUOI. scripts/import_catalog_json.py rejoue ce JSON dans la base et ecrase
rarity_tag depuis lui. Tant que le JSON garde l'ancienne rarete, le prochain
reimport annulerait la 013 en silence : les polices obscures redeviendraient
communes et le premier pool du joueur reperdrait Helvetica au profit de
Chocolate Classical Sans. C'est le meme piege que celui referme pour Adobe avec
scripts/sync_adobe_catalog_json.py, sur une autre colonne.

A LANCER JUSTE APRES scripts/apply_013_rarity.mjs, jamais avant : le JSON et la
base doivent bouger ensemble.

Usage :
    ./.venv/bin/python scripts/sync_catalog_rarity_json.py
    ./.venv/bin/python scripts/sync_catalog_rarity_json.py --rollback
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

CATALOGUE = "content/catalog/typefaces-core.json"
MIGRATION = "db/migrations/013_rarity_from_popularity.sql"
RETOUR = "db/migrations/013_rarity_from_popularity.rollback.sql"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Met le JSON du catalogue en miroir de la 013.")
    p.add_argument("--rollback", action="store_true", help="rejoue le retour arriere")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    fichier = RETOUR if args.rollback else MIGRATION
    ordres = re.findall(
        r"rarity_tag = '(\w+)'::app\.rarity_tag_enum.*?WHERE typeface_slug = '([^']+)';",
        Path(fichier).read_text(encoding="utf-8"),
    )
    if len(ordres) != 1090:
        raise SystemExit(f"{fichier} porte {len(ordres)} ordres, 1090 attendus")

    catalogue = json.loads(Path(CATALOGUE).read_text(encoding="utf-8"))
    par_slug = {r["typeface_slug"]: r for r in catalogue["records"]}

    change, absents, adobe = 0, [], []
    for rarete, slug in ordres:
        ligne = par_slug.get(slug)
        if ligne is None:
            absents.append(slug)
            continue
        if ligne.get("font_source") == "adobe":
            adobe.append(slug)
            continue
        if ligne["rarity_tag"] != rarete:
            ligne["rarity_tag"] = rarete
            change += 1

    if absents:
        raise SystemExit(f"{len(absents)} slugs absents du JSON, rien ecrit : {absents[:10]}")
    if adobe:
        raise SystemExit(f"la 013 viserait {len(adobe)} lignes Adobe, rien ecrit : {adobe[:10]}")

    Path(CATALOGUE).write_text(
        json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    compte: dict[str, int] = {}
    for r in catalogue["records"]:
        compte[r["rarity_tag"]] = compte.get(r["rarity_tag"], 0) + 1
    portee = sum(
        1 for r in catalogue["records"]
        if r["activation_status"] and r["rarity_tag"] == "common" and r["dreyfus_tier"] in ("N", "D")
    )
    print(f"{change} raretes modifiees dans le JSON")
    print(f"repartition : {compte}")
    print(f"portee du debutant dans le JSON : {portee}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
