"""
adobe_kit_trim.py

Ramene le projet web `ozq5yfs` a une taille que Adobe accepte de publier, en
retirant des familles UNE PAR UNE, puis publie.

POURQUOI. Mesure des 2026-09-12 et 2026-09-14 : le brouillon accepte 3 492 familles
sans broncher, mais sa publication repond 504, trois essais. La feuille publique est
donc restee a 108 familles et le site ne voit rien des 3 384 ajoutees. Il y a un
plafond de publication quelque part entre les deux, et personne ne le connait. Ce
script sert a le trouver par le bas : on redescend a une taille visee, on publie, et
si la feuille grossit c'est que la taille passe.

CE QU'IL NE TOUCHE JAMAIS. Les 108 familles du kit historique, celles des migrations
015 et 016, deja en production. Elles sont lues dans
content/catalog/adobe-fonts-kit.json et exclues du retrait, quoi qu'il arrive.

L'ORDRE DU RETRAIT suit la selection a l'envers : les dernieres familles ajoutees
partent les premieres. Aucune n'est perdue, elles sont toutes dans
/tmp/vague1.json et se rajoutent d'une commande.

A BLANC PAR DEFAUT. Sans --appliquer il ne fait que compter.

Usage :
    python3 scripts/adobe_kit_trim.py --cible 1200 --selection /tmp/vague1.json
    python3 scripts/adobe_kit_trim.py --cible 1200 --selection /tmp/vague1.json --appliquer
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.typekit.com/api/v1/json"
KIT = "ozq5yfs"
JETON_DEFAUT = Path.home() / ".config" / "dwiggins" / "adobe-typekit-token"


def jeton() -> str:
    chemin = Path(os.environ.get("ADOBE_TOKEN_FILE", JETON_DEFAUT))
    if not chemin.exists():
        sys.exit(f"Jeton absent. Cree {chemin}, il n'est jamais affiche.")
    v = chemin.read_text(encoding="utf-8").strip()
    if not v:
        sys.exit(f"{chemin} est vide.")
    return v


def appel(methode: str, chemin: str, j: str, delai: int = 300) -> dict:
    req = urllib.request.Request(
        f"{API}/{chemin}", method=methode,
        headers={"X-Typekit-Token": j, "User-Agent": "dwiggins-catalog/1.0"},
    )
    for essai in range(4):
        try:
            with urllib.request.urlopen(req, timeout=delai) as r:
                return json.loads(r.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and essai < 3:
                time.sleep(3 * (essai + 1))
                continue
            raise SystemExit(f"{methode} {chemin} -> HTTP {e.code} {e.read()[:200]!r}")
        except Exception:
            if essai < 3:
                time.sleep(3 * (essai + 1))
                continue
            raise
    raise SystemExit(f"{methode} {chemin} : quatre essais, aucun aboutissement")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cible", type=int, required=True, help="nombre de familles a garder")
    ap.add_argument("--selection", required=True, type=Path)
    ap.add_argument("--brouillon", type=Path, help="dump du brouillon, evite une lecture lente")
    ap.add_argument("--appliquer", action="store_true")
    ap.add_argument("--lot", type=int, default=0, help="s'arreter apres N retraits")
    ap.add_argument("--publier", action="store_true")
    args = ap.parse_args()

    j = jeton()
    historiques = {
        f["adobe_family_id"]
        for f in json.loads(
            Path("content/catalog/adobe-fonts-kit.json").read_text(encoding="utf-8")
        )["families"]
    }
    ordre = [f["adobe_family_id"] for f in
             json.loads(args.selection.read_text(encoding="utf-8"))["familles"]]

    if args.brouillon and args.brouillon.exists():
        brut = json.loads(args.brouillon.read_text(encoding="utf-8"))
        familles = (brut.get("kit") or brut)["families"]
        print(f"brouillon lu dans {args.brouillon} : {len(familles)} familles")
    else:
        print("lecture du brouillon, plusieurs minutes a cette taille ...", flush=True)
        familles = appel("GET", f"kits/{KIT}", j)["kit"]["families"]
        print(f"brouillon : {len(familles)} familles")

    presentes = {f["id"] for f in familles}
    # Ce qui peut partir : tout sauf les 108 historiques. On retire d'abord les
    # dernieres arrivees, donc l'ordre de la selection a l'envers.
    candidats = [i for i in reversed(ordre) if i in presentes and i not in historiques]
    a_retirer = max(0, len(presentes) - args.cible)
    lot = candidats[:a_retirer]

    print(f"cible                 {args.cible}")
    print(f"intouchables          {len(historiques & presentes)} familles historiques")
    print(f"a retirer             {len(lot)}")
    if not args.appliquer:
        print("\nA BLANC. Rien n'a ete retire.")
        return

    faits = 0
    for fid in lot:
        appel("DELETE", f"kits/{KIT}/families/{fid}", j)
        faits += 1
        if faits % 50 == 0:
            print(f"  {faits}/{len(lot)}", flush=True)
        if args.lot and faits >= args.lot:
            break
    print(f"retirees : {faits}")

    if args.publier:
        depart = time.time()
        appel("POST", f"kits/{KIT}/publish", j)
        print(f"publie en {round(time.time() - depart)} s")


main()
