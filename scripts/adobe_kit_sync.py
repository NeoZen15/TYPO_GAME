"""
adobe_kit_sync.py

Fait entrer dans le projet web Adobe Fonts `ozq5yfs` les familles choisies par
adobe_library_select.py, puis publie le kit. C'est le SEUL geste de toute la
chaine qui ecrit dans le compte Adobe du proprietaire, et donc le seul qui demande
son jeton.

LE JETON NE PASSE JAMAIS PAR LE CHAT NI PAR LA LIGNE DE COMMANDE. Il est lu dans un
fichier hors du depot, par defaut ~/.config/dwiggins/adobe-typekit-token, et il
part dans l'entete X-Typekit-Token. Ce script ne l'affiche pas, ne le journalise
pas, et n'ecrit jamais une URL qui le contiendrait. Si le fichier manque, il dit
seulement qu'il manque.

CE QU'IL FAIT, DANS L'ORDRE
  1. lit le brouillon du kit, pour savoir ce qui y est deja
  2. ajoute les familles absentes, une par requete, avec UN SEUL romain chacune
     et le sous ensemble par defaut, qui est le latin
  3. publie le kit, sans quoi la feuille servie ne change pas
Il est reprenable : relance le apres une coupure, il repart des absentes.

A BLANC PAR DEFAUT. Sans --appliquer il ne fait que lire et compter. Meme
prudence que pour les migrations : rien d'irreversible sans intention ecrite.

API : documentee sur fonts.adobe.com/docs/api/kits
  GET  api.typekit.com/api/v1/json/kits/<kit>
  POST api.typekit.com/api/v1/json/kits/<kit>/families/<famille>  subset, variations
  POST api.typekit.com/api/v1/json/kits/<kit>/publish

Usage :
    python3 scripts/adobe_kit_sync.py --selection /tmp/adobe-selection.json
    python3 scripts/adobe_kit_sync.py --selection /tmp/adobe-selection.json --appliquer
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
        sys.exit(
            f"Jeton absent. Cree {chemin} avec le jeton d'API Adobe Fonts dedans,\n"
            "puis relance. Le fichier est hors du depot et n'est jamais affiche."
        )
    valeur = chemin.read_text(encoding="utf-8").strip()
    if not valeur:
        sys.exit(f"{chemin} est vide.")
    return valeur


def appel(methode: str, chemin: str, jeton_valeur: str, donnees: dict | None = None,
          delai: int = 300) -> dict:
    """DELAI LARGE PAR DEFAUT, mesure du 2026-09-12 : lire le brouillon prend 22
    secondes a 1 238 familles et davantage ensuite, la lecture depassait les 30
    secondes des que le kit a passe les trois mille. L'ajout d'une famille, lui,
    reste sous la seconde."""
    corps = urllib.parse.urlencode(donnees, doseq=True).encode() if donnees else None
    entetes = {"X-Typekit-Token": jeton_valeur, "User-Agent": "dwiggins-catalog/1.0"}
    if corps:
        entetes["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(f"{API}/{chemin}", data=corps, method=methode, headers=entetes)
    for essai in range(5):
        try:
            with urllib.request.urlopen(req, timeout=delai) as r:
                return json.loads(r.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            # Le corps d'erreur d'Adobe ne contient pas le jeton, l'entete n'est
            # jamais renvoyee. On peut donc le montrer tel quel.
            if e.code in (429, 500, 502, 503, 504) and essai < 4:
                time.sleep(2 ** essai)
                continue
            raise SystemExit(f"{methode} {chemin} -> HTTP {e.code} {e.read()[:300]!r}")
        except Exception:
            if essai < 4:
                time.sleep(2 ** essai)
                continue
            raise
    raise SystemExit(f"{methode} {chemin} : cinq essais, aucun aboutissement")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--selection", type=Path)
    ap.add_argument("--appliquer", action="store_true", help="ecrit chez Adobe")
    ap.add_argument("--lot", type=int, default=0, help="s'arreter apres N ajouts")
    ap.add_argument("--sans-publier", action="store_true")
    ap.add_argument("--dump", type=Path, help="ecrit le brouillon dans un fichier")
    ap.add_argument("--etat", action="store_true", help="compte le brouillon et le publie")
    ap.add_argument("--publier-seulement", action="store_true",
                    help="publie le brouillon tel qu'il est, sans le relire")
    args = ap.parse_args()

    j = jeton()
    if args.dump:
        # Le brouillon porte les noms de famille CSS que servira la feuille, et
        # c'est la seule source fiable : Adobe TRONQUE ses noms CSS a 28 signes,
        # "Baskerville URW Regular Oblique" devient "baskerville-urw-regular-obli".
        kit = appel("GET", f"kits/{KIT}", j)["kit"]
        args.dump.write_text(json.dumps({"kit": kit}, ensure_ascii=False), encoding="utf-8")
        print(f"brouillon ecrit dans {args.dump} : {len(kit.get('families', []))} familles")
        return
    if args.etat:
        for quoi in ("kits/ozq5yfs", "kits/ozq5yfs/published"):
            try:
                k = appel("GET", quoi, j)["kit"]
                print(f"{quoi:<26} {len(k.get('families', []))} familles")
            except SystemExit as e:
                print(f"{quoi:<26} {e}")
        return
    if args.publier_seulement:
        # Ne lit pas le brouillon : la lecture est la partie lente, et publier
        # n'en a pas besoin.
        depart = time.time()
        appel("POST", f"kits/{KIT}/publish", j)
        print(f"kit publie en {round(time.time() - depart)} s")
        return

    if not args.selection:
        sys.exit("--selection est requis, sauf avec --publier-seulement")
    voulues = json.loads(args.selection.read_text(encoding="utf-8"))["familles"]

    kit = appel("GET", f"kits/{KIT}", j)["kit"]
    presentes = {f["id"] for f in kit.get("families", [])}
    absentes = [f for f in voulues if f["adobe_family_id"] not in presentes]

    print(f"kit {KIT} ({kit.get('name')}) : {len(presentes)} familles au brouillon")
    print(f"selection                  : {len(voulues)} familles")
    print(f"a ajouter                  : {len(absentes)}")
    if not args.appliquer:
        print("\nA BLANC. Rien n'a ete ecrit. Ajoute --appliquer pour le faire.")
        for f in absentes[:10]:
            print(f"  exemple  {f['display_name']}  {f['variation']}")
        return

    faits = 0
    for f in absentes:
        appel(
            "POST",
            f"kits/{KIT}/families/{f['adobe_family_id']}",
            j,
            {"subset": "default", "variations": f["variation"]},
        )
        faits += 1
        if faits % 50 == 0:
            print(f"  {faits}/{len(absentes)}", flush=True)
        if args.lot and faits >= args.lot:
            break

    print(f"ajoutees : {faits}")
    if args.sans_publier:
        print("kit NON publie, la feuille servie ne change pas encore")
        return
    appel("POST", f"kits/{KIT}/publish", j)
    print("kit publie")


main()
