"""
adobe_kit_bulk.py

Meme but que adobe_kit_sync.py, mais en UNE requete au lieu d'une par famille.

POURQUOI CE SECOND SCRIPT EXISTE. Mesure du 2026-09-11 : l'ajout famille par
famille part a moins d'une seconde sur un kit de 108 familles, et tombe a SEIZE
SECONDES par famille une fois le kit a plus de mille. Le temps monte avec la
taille du kit, chaque POST semblant resserialiser l'ensemble. A ce rythme les
3 443 familles de la premiere vague demandaient plus de dix heures. L'API sait
pourtant tout prendre d'un coup, par `families[N][id]`, documente sur
fonts.adobe.com/docs/api/kits.

CE QU'IL FAUT SAVOIR AVANT DE LE LANCER. Le parametre `families` REMPLACE la liste
entiere du kit. Ce script envoie donc toujours l'union de ce qui est deja au
brouillon et de ce qui est demande, et il ecrit d'abord le brouillon d'avant dans
un fichier, qui est la matiere du retour arriere. Les familles deja presentes
gardent leurs variations et leur sous ensemble, on n'y touche pas.

LE JETON ne passe ni par le chat ni par la ligne de commande : lu dans
~/.config/dwiggins/adobe-typekit-token, envoye dans l'entete X-Typekit-Token,
jamais affiche, jamais mis dans une URL.

Usage :
    python3 scripts/adobe_kit_bulk.py --selection <fichier>            # a blanc
    python3 scripts/adobe_kit_bulk.py --selection <fichier> --appliquer
    python3 scripts/adobe_kit_bulk.py --selection <fichier> --appliquer --publier
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.typekit.com/api/v1/json"
KIT = "ozq5yfs"
JETON_DEFAUT = Path.home() / ".config" / "dwiggins" / "adobe-typekit-token"


def jeton() -> str:
    chemin = Path(os.environ.get("ADOBE_TOKEN_FILE", JETON_DEFAUT))
    if not chemin.exists():
        sys.exit(f"Jeton absent. Cree {chemin}, il n'est jamais affiche.")
    valeur = chemin.read_text(encoding="utf-8").strip()
    if not valeur:
        sys.exit(f"{chemin} est vide.")
    return valeur


def appel(methode: str, chemin: str, jeton_valeur: str, corps: bytes | None = None,
          delai: int = 600) -> dict:
    entetes = {"X-Typekit-Token": jeton_valeur, "User-Agent": "dwiggins-catalog/1.0"}
    if corps:
        entetes["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(f"{API}/{chemin}", data=corps, method=methode, headers=entetes)
    for essai in range(4):
        try:
            with urllib.request.urlopen(req, timeout=delai) as r:
                return json.loads(r.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and essai < 3:
                time.sleep(5 * (essai + 1))
                continue
            raise SystemExit(f"{methode} {chemin} -> HTTP {e.code} {e.read()[:300]!r}")
        except Exception as ex:
            if essai < 3:
                time.sleep(5 * (essai + 1))
                continue
            raise SystemExit(f"{methode} {chemin} -> {type(ex).__name__}")
    raise SystemExit(f"{methode} {chemin} : quatre essais, aucun aboutissement")


def fvd(variation) -> str | None:
    """Les variations d'Adobe arrivent en objets a la lecture, en chaines a l'ecriture."""
    if isinstance(variation, dict):
        return variation.get("fvd")
    return variation if isinstance(variation, str) else None


def corps_familles(familles: list[dict]) -> bytes:
    paires: list[tuple[str, str]] = []
    for i, f in enumerate(familles):
        paires.append((f"families[{i}][id]", f["id"]))
        paires.append((f"families[{i}][subset]", f.get("subset") or "default"))
        for v in f["variations"]:
            paires.append((f"families[{i}][variations][]", v))
    return urllib.parse.urlencode(paires).encode()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--selection", required=True, type=Path)
    ap.add_argument("--appliquer", action="store_true")
    ap.add_argument("--publier", action="store_true")
    ap.add_argument("--sauvegarde", type=Path, default=Path("/tmp/kit-avant.json"))
    ap.add_argument("--remplacer", action="store_true",
                    help="repart des 108 familles historiques au lieu du brouillon actuel")
    ap.add_argument("--maximum", type=int, default=0, help="ne garder que N familles en tout")
    args = ap.parse_args()

    j = jeton()
    voulues = json.loads(args.selection.read_text(encoding="utf-8"))["familles"]

    if args.remplacer:
        # Le miroir du kit d'origine, celui que servent les migrations 015 et 016.
        # Il sert de socle : ces 108 familles sont en production, elles ne sortent
        # jamais du projet web.
        socle = json.loads(Path("content/catalog/adobe-fonts-kit.json").read_text(encoding="utf-8"))
        base = [{"id": f["adobe_family_id"], "subset": "default",
                 "variations": list(f["variations"])} for f in socle["families"]]
        print(f"socle historique : {len(base)} familles, le brouillon actuel est ignore")
    else:
        print("lecture du brouillon, elle est lente sur un gros kit ...", flush=True)
        kit = appel("GET", f"kits/{KIT}", j)["kit"]
        args.sauvegarde.write_text(json.dumps(kit, ensure_ascii=False), encoding="utf-8")
        print(f"brouillon actuel : {len(kit['families'])} familles, "
              f"sauvegarde dans {args.sauvegarde}")
        base = [{"id": f["id"], "subset": f.get("subset") or "default",
                 "variations": [v for v in (fvd(x) for x in f.get("variations", [])) if v] or ["n4"]}
                for f in kit["families"]]

    finale: list[dict] = []
    vues: set[str] = set()
    for f in base:
        finale.append(f)
        vues.add(f["id"])
    ajouts = 0
    for f in voulues:
        if f["adobe_family_id"] in vues:
            continue
        finale.append({"id": f["adobe_family_id"], "subset": "default",
                       "variations": [f["variation"]]})
        vues.add(f["adobe_family_id"])
        ajouts += 1
        if args.maximum and len(finale) >= args.maximum:
            break

    corps = corps_familles(finale)
    print(f"a envoyer        : {len(finale)} familles, dont {ajouts} nouvelles, "
          f"{len(corps) // 1024} Ko de formulaire")
    if not args.appliquer:
        print("\nA BLANC. Rien n'a ete ecrit.")
        return

    depart = time.time()
    retour = appel("POST", f"kits/{KIT}", j, corps)
    apres = retour.get("kit", {}).get("families", [])
    print(f"ecrit en {round(time.time() - depart)} s, le brouillon porte maintenant "
          f"{len(apres)} familles")

    if not args.publier:
        print("kit NON publie, la feuille servie ne change pas encore")
        return
    depart = time.time()
    appel("POST", f"kits/{KIT}/publish", j)
    print(f"kit publie en {round(time.time() - depart)} s")


main()
