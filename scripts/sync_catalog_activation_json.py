#!/usr/bin/env python3
"""Met content/catalog/typefaces-core.json en miroir de la migration 020.

    python3 scripts/sync_catalog_activation_json.py
    python3 scripts/sync_catalog_activation_json.py --rollback

POURQUOI CE SCRIPT EXISTE. Le JSON du catalogue est reinjecte en base par
import_catalog_json.py. Si la base eteint 285 lignes et que le JSON les declare
encore actives, le prochain passage les rallume, sans erreur et sans bruit.
C'est exactement le piege rencontre en aout sur les 108 lignes Adobe, qui
seraient reparties en `local` et `proprietary`, donc eteintes, sans que rien ne
le signale.

La liste vient de content/catalog/jumelles-eteintes.json, la meme source que la
migration, pour que les deux ne puissent pas divercher.
"""

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CATALOGUE = RACINE / "content/catalog/typefaces-core.json"
DECISIONS = RACINE / "content/catalog/jumelles-eteintes.json"
ROLLBACK = "--rollback" in sys.argv

decisions = json.loads(DECISIONS.read_text(encoding="utf-8"))
a_eteindre = {s for f in decisions["familles"] for s in f["eteintes"]}
attendu = decisions["meta"]["a_eteindre"]
if len(a_eteindre) != attendu:
    sys.exit(f"la source annonce {attendu} polices a eteindre, la liste en contient {len(a_eteindre)}")

catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
records = catalogue["records"]
par_slug = {r["typeface_slug"]: r for r in records}

manquants = sorted(a_eteindre - par_slug.keys())
if manquants:
    sys.exit(f"{len(manquants)} slugs absents du catalogue, dont {manquants[:5]}")

cible = ROLLBACK
avant = sum(1 for r in records if r.get("activation_status"))
touchees = 0
for slug in a_eteindre:
    r = par_slug[slug]
    if r.get("activation_status") is not cible:
        r["activation_status"] = cible
        touchees += 1

apres = sum(1 for r in records if r.get("activation_status"))
CATALOGUE.write_text(
    json.dumps(catalogue, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
)
print(f"{touchees} lignes changees, actives {avant} -> {apres}")
print("miroir remis en place." if ROLLBACK else "miroir aligne sur la 020.")
