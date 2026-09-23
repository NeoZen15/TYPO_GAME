"""
adobe_kits_shard.py

Repartit les familles Adobe sur PLUSIEURS projets web, et publie chacun.

POURQUOI PLUSIEURS PROJETS. Mesure du 2026-09-12 : le kit `ozq5yfs` accepte sans
broncher 3 492 familles dans son brouillon, mais sa PUBLICATION repond 504 a chaque
fois, trois essais, dont un qui a rendu 200 sans rien changer. Le brouillon n'est
pas servi : la feuille publique est restee a 108 familles et le site n'a rien vu.

DEUX ETAPES SEPAREES, ET C'EST UNE MESURE, PAS UNE PREFERENCE. Le 2026-09-14, creer
un projet en y mettant 500 familles dans la meme requete repond 504 lui aussi. Toute
requete qui traite des centaines de familles d'un coup depasse leur passerelle. Le
seul geste qui tient est l'ajout UNE PAR UNE, environ une seconde chacune, eprouve
sur 3 384 ajouts. D'ou :

    --creer N        cree N projets VIDES. Deux secondes chacun. C'est le seul geste
                     refuse au classifieur de permissions, il part du proprietaire.
    --remplir T      remplit le projet de la tranche T, famille par famille, publie
                     et verifie la feuille servie. Reprenable : relance apres une
                     coupure, il repart des absentes.

LA TAILLE SE CHERCHE PAR LE HAUT, JAMAIS PAR LE BAS. Retirer une famille est refuse
au classifieur, ajouter ne l'est pas. Donc `--remplir` monte par paliers de
`--palier` familles, publie a chaque palier et verifie la feuille. Le jour ou la
publication ne prend plus, le palier precedent reste servi et on connait le plafond,
sans avoir jamais eu besoin d'enlever quoi que ce soit.

Le kit historique `ozq5yfs` n'est PAS touche ici : il porte les 108 familles deja en
production et reste la reference des migrations 015 et 016.

LE JETON est lu dans ~/.config/dwiggins/adobe-typekit-token, envoye dans l'entete
X-Typekit-Token, jamais affiche, jamais place dans une URL.

Usage :
    python3 scripts/adobe_kits_shard.py --creer 8 --selection /tmp/vague1.json
    python3 scripts/adobe_kits_shard.py --remplir 0 --selection /tmp/vague1.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.typekit.com/api/v1/json"
KIT_HISTORIQUE = "ozq5yfs"
MANIFESTE = Path("content/catalog/adobe-fonts-kits.json")
DOMAINES = ["localhost", "127.0.0.1"]
JETON_DEFAUT = Path.home() / ".config" / "dwiggins" / "adobe-typekit-token"


def jeton() -> str:
    chemin = Path(os.environ.get("ADOBE_TOKEN_FILE", JETON_DEFAUT))
    if not chemin.exists():
        sys.exit(f"Jeton absent. Cree {chemin}, il n'est jamais affiche.")
    v = chemin.read_text(encoding="utf-8").strip()
    if not v:
        sys.exit(f"{chemin} est vide.")
    return v


def appel(methode: str, chemin: str, j: str, donnees: dict | None = None,
          delai: int = 120) -> dict:
    corps = urllib.parse.urlencode(donnees, doseq=True).encode() if donnees else None
    entetes = {"X-Typekit-Token": j, "User-Agent": "dwiggins-catalog/1.0"}
    if corps:
        entetes["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(f"{API}/{chemin}", data=corps, method=methode, headers=entetes)
    for essai in range(4):
        try:
            with urllib.request.urlopen(req, timeout=delai) as r:
                return json.loads(r.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and essai < 3:
                time.sleep(3 * (essai + 1))
                continue
            raise SystemExit(f"{methode} {chemin} -> HTTP {e.code} {e.read()[:200]!r}")
        except Exception:
            if essai < 3:
                time.sleep(3 * (essai + 1))
                continue
            raise
    raise SystemExit(f"{methode} {chemin} : quatre essais, aucun aboutissement")


def familles_servies(kit_id: str) -> tuple[int, int]:
    """Lit la FEUILLE publiee, seul temoin fiable : sur `ozq5yfs` un publish a
    rendu 200 sans que la feuille change d'un octet.

    LE 404 EST NORMAL JUSTE APRES LA PREMIERE PUBLICATION, mesure du 2026-09-14 :
    la feuille d'un projet neuf met quelques secondes a exister sur leur CDN. Un
    404 ne veut donc pas dire que la publication a echoue, il veut dire pas
    encore. D'ou les essais espaces, et un echec seulement s'il dure.
    """
    for essai in range(4):
        url = f"https://use.typekit.net/{kit_id}.css?t={int(time.time())}"
        try:
            with urllib.request.urlopen(
                urllib.request.Request(url, headers={"User-Agent": "dwiggins/1.0"}), timeout=90
            ) as r:
                css = r.read().decode("utf-8", "ignore")
            return len(css), len(set(re.findall(r'font-family:"([^"]+)"', css)))
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
            time.sleep(5)
    # UN 404 QUI DURE VEUT DIRE JAMAIS PUBLIE, pas casse : la feuille d'un projet
    # n'existe pas avant sa premiere publication reussie. On rend donc zero servie,
    # ce qui laisse publier() reessayer, au lieu de lever et de tout arreter.
    return 0, 0


def publier(kit_id: str, j: str, attendu: int, essais: int = 5) -> tuple[int, int]:
    """Publie, puis verifie la feuille, et recommence tant qu'elle ne suit pas.

    LE 504 N'EST PAS UNE QUESTION DE TAILLE, mesure du 2026-09-14 : a 250 familles
    exactement, le projet de la tranche 1 a rendu 504 et celui de la tranche 2 a
    publie sans broncher. Leur passerelle coupe a environ une minute et la duree du
    travail varie avec leur charge. Un 504 veut donc dire reessaye, pas trop gros.
    Et comme un publish a deja rendu 200 sans rien changer, la seule preuve est la
    feuille servie.
    """
    for essai in range(essais):
        try:
            appel("POST", f"kits/{kit_id}/publish", j, delai=300)
        except SystemExit as e:
            if "504" not in str(e) and "502" not in str(e):
                raise
        octets, servies = familles_servies(kit_id)
        if servies >= attendu * 0.99:
            return octets, servies
        print(f"    publication pas encore prise ({servies}/{attendu}), essai "
              f"{essai + 2}/{essais}", flush=True)
        time.sleep(15)
    return familles_servies(kit_id)


def noms_css_servis(man: dict) -> set[str]:
    """L'union des noms de famille CSS que servent toutes les feuilles publiees.

    POURQUOI L'UNION ET PAS LE MANIFESTE. Ce qui compte pour le jeu n'est pas
    quelle police est dans quel projet, mais qu'elle soit servie par une des
    feuilles que la page charge. Les tranches se sont desalignees en chemin, a
    force de paliers et de reprises : la couverture ne se deduit donc plus des
    intervalles, elle se mesure.
    """
    servis: set[str] = set()
    for t in man["tranches"].values():
        try:
            url = f"https://use.typekit.net/{t['kit_id']}.css?t={int(time.time())}"
            with urllib.request.urlopen(
                urllib.request.Request(url, headers={"User-Agent": "dwiggins/1.0"}), timeout=90
            ) as r:
                css = r.read().decode("utf-8", "ignore")
            # On enleve le suffixe de projet : `lust-didone-1` sert bien lust-didone.
            servis |= {re.sub(r"-\d+$", "", n) for n in re.findall(r'font-family:"([^"]+)"', css)}
        except urllib.error.HTTPError:
            continue
    return servis


def manifeste_lire() -> dict:
    if MANIFESTE.exists():
        return json.loads(MANIFESTE.read_text(encoding="utf-8"))
    return {
        "note": "Projets web Adobe Fonts servant le catalogue, en plus du projet "
                "historique. Ecrit par scripts/adobe_kits_shard.py.",
        "historique": KIT_HISTORIQUE,
        "tranches": {},
    }


def manifeste_ecrire(man: dict) -> None:
    MANIFESTE.write_text(json.dumps(man, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def a_repartir(selection: Path) -> list[dict]:
    toutes = json.loads(selection.read_text(encoding="utf-8"))["familles"]
    # ON N'EXCLUT QUE LES 108 FAMILLES PUBLIEES, pas ce que contient le brouillon de
    # `ozq5yfs`. Ce brouillon en porte 3 492 mais ne se publie pas : ces familles ne
    # sont servies a personne, les sauter ici les perdrait pour de bon.
    historiques = {
        f["adobe_family_id"]
        for f in json.loads(
            Path("content/catalog/adobe-fonts-kit.json").read_text(encoding="utf-8")
        )["families"]
    }
    return [f for f in toutes if f["adobe_family_id"] not in historiques]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--selection", required=True, type=Path)
    ap.add_argument("--taille", type=int, default=500, help="familles par tranche")
    ap.add_argument("--etat", action="store_true", help="mesure les feuilles servies")
    ap.add_argument("--publier-tout", action="store_true", help="publie tous les projets")
    ap.add_argument("--tours", type=int, default=3, help="tournees de publication")
    ap.add_argument("--attente", type=int, default=180, help="secondes entre demande et mesure")
    ap.add_argument("--noms", type=Path, help="releve les noms CSS de chaque projet")
    ap.add_argument("--combler", type=int, help="verse les familles non servies dans ce projet")
    ap.add_argument("--plafond", type=int, default=250, help="familles par projet")
    ap.add_argument("--creer", type=int, help="cree N projets vides")
    ap.add_argument("--remplir", type=int, help="remplit la tranche T et la publie")
    ap.add_argument("--palier", type=int, default=250,
                    help="publier et verifier tous les N ajouts")
    args = ap.parse_args()

    j = jeton()
    reste = a_repartir(args.selection)
    man = manifeste_lire()
    man["taille_de_tranche"] = args.taille
    print(f"familles a repartir : {len(reste)}")

    if args.publier_tout:
        # UNE TOURNEE DE PUBLICATION AVEC DE VRAIES ATTENTES. La publication est
        # asynchrone chez Adobe : `tcp7tby` a servi 300 familles alors que cinq
        # essais espaces de quinze secondes disaient 250. Quinze secondes ne sont
        # donc pas une attente, c'est du bruit. Ici on demande a tous les projets de
        # publier, puis on attend des minutes, puis on mesure.
        for tour in range(args.tours):
            print(f"--- tournee {tour + 1}/{args.tours}", flush=True)
            for cle in sorted(man["tranches"], key=int):
                t = man["tranches"][cle]
                vise = len(t.get("familles_posees") or [])
                if t.get("familles_servies", 0) >= vise > 0:
                    continue
                try:
                    appel("POST", f"kits/{t['kit_id']}/publish", j, delai=300)
                    print(f"  {t['kit_id']} : publication demandee", flush=True)
                except SystemExit as e:
                    print(f"  {t['kit_id']} : {str(e)[-24:]}", flush=True)
            print(f"  attente de {args.attente} s ...", flush=True)
            time.sleep(args.attente)
            total = 0
            for cle in sorted(man["tranches"], key=int):
                t = man["tranches"][cle]
                octets, servies = familles_servies(t["kit_id"])
                t["familles_servies"] = servies
                t["octets_feuille"] = octets
                total += servies
                print(f"  tranche {cle} {t['kit_id']} : {servies}/"
                      f"{len(t.get('familles_posees') or [])} servies", flush=True)
            manifeste_ecrire(man)
            print(f"  total servi : {total}", flush=True)
        return

    if args.noms:
        # LE NOM CSS N'EST PAS LE MEME D'UN PROJET A L'AUTRE, mesure du 2026-09-15.
        # Le projet historique declare `lust-didone`, les projets neufs declarent
        # `lust-didone-1`. Le suffixe est propre au projet. Or la pile de repli du
        # catalogue doit nommer EXACTEMENT ce que la feuille declare, sinon le
        # navigateur tombe sur une police de repli et le jeu demande de nommer un
        # dessin qui n'est pas celui de la question. D'ou ce relevé, pris projet par
        # projet et non devine.
        noms: dict[str, str] = {}
        for cle in sorted(man["tranches"], key=int):
            t = man["tranches"][cle]
            kit = appel("GET", f"kits/{t['kit_id']}", j, delai=300)["kit"]
            t["familles_posees"] = [f["id"] for f in kit.get("families", [])]
            for f in kit.get("families", []):
                css = (f.get("css_names") or [None])[0]
                if css:
                    noms[f["id"]] = css
            print(f"tranche {cle} {t['kit_id']} : {len(kit.get('families', []))} familles lues")
        # ET CE QUI EST VRAIMENT SERVI, qui n'est pas la meme chose que ce que
        # portent les brouillons : `fbq4jus` porte 500 familles et n'en sert que
        # 250, `tcp7tby` en porte 300 pour 250 servies. Le catalogue ne doit
        # recevoir que les familles reellement servies, sans quoi le jeu demande de
        # nommer un dessin de repli.
        servis: set[str] = set()
        for cle in sorted(man["tranches"], key=int):
            t = man["tranches"][cle]
            try:
                url = f"https://use.typekit.net/{t['kit_id']}.css?t={int(time.time())}"
                with urllib.request.urlopen(
                    urllib.request.Request(url, headers={"User-Agent": "dwiggins/1.0"}),
                    timeout=90,
                ) as r:
                    css = r.read().decode("utf-8", "ignore")
                trouves = set(re.findall(r'font-family:"([^"]+)"', css))
                servis |= trouves
                print(f"  feuille {t['kit_id']} : {len(trouves)} familles servies")
            except urllib.error.HTTPError:
                print(f"  feuille {t['kit_id']} : rien de publie")
        Path(args.noms).write_text(
            json.dumps(
                {"noms_css_par_famille": noms, "noms_css_servis": sorted(servis)},
                ensure_ascii=False, indent=1,
            ),
            encoding="utf-8",
        )
        manifeste_ecrire(man)
        print(f"{len(noms)} noms CSS releves, {len(servis)} reellement servis, "
              f"ecrits dans {args.noms}")
        return

    if args.combler is not None:
        # COMBLER : on prend les familles que PERSONNE ne sert encore et on les
        # verse dans le projet donne, jusqu'a son plafond, puis on publie et on
        # verifie. Le decoupage en intervalles n'entre plus en jeu.
        cle = str(args.combler)
        tranche = man["tranches"].get(cle)
        if not tranche:
            sys.exit(f"tranche {cle} pas encore creee. Le proprietaire lance --creer.")
        kit_id = tranche["kit_id"]
        print("mesure de ce qui est deja servi ...", flush=True)
        deja_servis = noms_css_servis(man)
        # CE QUI EST POSE COMPTE AUTANT QUE CE QUI EST SERVI, faute commise le
        # 2026-09-15 : la publication d'Adobe est asynchrone, donc la couverture
        # mesuree juste apres un remplissage est encore celle d'avant. Six projets
        # remplis de suite ont ainsi recu LES MEMES 250 familles, 1 250 places pour
        # 250 familles distinctes. Le registre des familles posees, tenu dans le
        # manifeste au moment de l'ajout, est la seule comptabilite fiable.
        posees: set[str] = set()
        for t in man["tranches"].values():
            posees |= set(t.get("familles_posees") or [])
        # Le nom CSS est la cle de correspondance cote feuille. La selection porte le
        # slug Adobe, presque toujours egal au nom CSS sauf troncature a 28 signes.
        manquantes = [
            f for f in reste
            if f["adobe_family_id"] not in posees
            and f["slug"] not in deja_servis
            and f["slug"][:28] not in deja_servis
        ]
        # LE PLAFOND EST DE 250, ET IL EST MESURE, PAS PRUDENTIEL. Le 2026-09-15,
        # les huit projets ont ete pousses a environ 490 familles chacun puis publies
        # trois fois de suite avec quatre minutes d'attente : aucun n'a jamais servi
        # plus de 250, sauf `tcp7tby` qui en sert 300. Au dela, la publication ne
        # se termine jamais. Et comme retirer une famille est refuse, ces 240
        # familles en trop par projet sont figees dans les brouillons pour rien.
        # C'est la faute a ne pas refaire : ne jamais remplir au dela du plafond.
        if args.plafond > 300:
            sys.exit(
                f"plafond {args.plafond} refuse. Mesure du 2026-09-15 : un projet ne "
                "sert jamais plus de 250 a 300 familles, et le trop plein ne se "
                "retire pas. Reste a 250."
            )
        kit = appel("GET", f"kits/{kit_id}", j, delai=300)["kit"]
        presentes = kit.get("families", [])
        place = max(0, args.plafond - len(presentes))
        lot = manquantes[:place]
        print(f"servies aujourd'hui : {len(deja_servis)} | non servies : {len(manquantes)}")
        print(f"kit {kit_id} : {len(presentes)} familles, place pour {place}, "
              f"j'en verse {len(lot)}")
        if not lot:
            return
        faits = 0
        registre = list(tranche.get("familles_posees") or [f["id"] for f in presentes])
        for f in lot:
            appel("POST", f"kits/{kit_id}/families/{f['adobe_family_id']}", j,
                  {"subset": "default", "variations": f["variation"]})
            faits += 1
            registre.append(f["adobe_family_id"])
            if faits % 50 == 0:
                # Le registre s'ecrit en chemin : une coupure ne doit pas faire
                # oublier ce qui est deja pose, sinon le prochain passage le repose.
                tranche["familles_posees"] = registre
                manifeste_ecrire(man)
                print(f"  {faits}/{len(lot)}", flush=True)
        tranche["familles_posees"] = registre
        octets, servies = publier(kit_id, j, len(presentes) + faits)
        tranche["familles_servies"] = servies
        tranche["octets_feuille"] = octets
        manifeste_ecrire(man)
        print(f"kit {kit_id} : {servies} servies, {octets} octets")
        return

    if args.etat:
        # Mesure la feuille de chaque tranche et remet le manifeste d'accord avec
        # la realite : un remplissage interrompu laisse des comptes faux dedans.
        total = 0
        for cle in sorted(man["tranches"], key=int):
            t = man["tranches"][cle]
            octets, servies = familles_servies(t["kit_id"])
            t["familles_servies"] = servies
            t["octets_feuille"] = octets
            total += servies
            etiquette = "servies" if servies else "RIEN DE PUBLIE"
            print(f"tranche {cle:>2} {t['kit_id']} : {servies:>4} {etiquette}, "
                  f"{octets} octets")
        manifeste_ecrire(man)
        print(f"total servi par les tranches : {total} familles, plus 108 par le "
              f"projet historique")
        return

    if args.creer:
        for t in range(args.creer):
            cle = str(t)
            if man["tranches"].get(cle, {}).get("kit_id"):
                print(f"tranche {t} : deja creee, {man['tranches'][cle]['kit_id']}")
                continue
            # Le corps est une LISTE de paires et non un dictionnaire, a cause de
            # domains[] qui se repete : d'ou la requete montee a la main ici plutot
            # que par le parametre `donnees` de appel().
            corps = urllib.parse.urlencode(
                [("name", f"DWIGGINS catalogue {t}")] + [("domains[]", d) for d in DOMAINES]
            ).encode()
            req = urllib.request.Request(
                f"{API}/kits", data=corps, method="POST",
                headers={"X-Typekit-Token": j, "User-Agent": "dwiggins-catalog/1.0",
                         "Content-Type": "application/x-www-form-urlencoded"},
            )
            with urllib.request.urlopen(req, timeout=120) as r:
                kit = json.loads(r.read().decode("utf-8"))["kit"]
            debut, fin = t * args.taille, min((t + 1) * args.taille, len(reste))
            man["tranches"][cle] = {
                "kit_id": kit["id"],
                "css": f"https://use.typekit.net/{kit['id']}.css",
                "familles_visees": max(0, fin - debut),
                "familles_servies": 0,
            }
            print(f"tranche {t} : projet vide cree, {kit['id']}, "
                  f"{max(0, fin - debut)} familles a y mettre")
            manifeste_ecrire(man)
        print(f"manifeste ecrit : {MANIFESTE}")
        return

    if args.remplir is None:
        sys.exit("donne --creer N ou --remplir T")

    cle = str(args.remplir)
    tranche = man["tranches"].get(cle)
    if not tranche:
        sys.exit(f"tranche {cle} pas encore creee. Le proprietaire lance --creer.")
    kit_id = tranche["kit_id"]
    debut = args.remplir * args.taille
    lot = reste[debut:debut + args.taille]

    kit = appel("GET", f"kits/{kit_id}", j, delai=300)["kit"]
    presentes = {f["id"] for f in kit.get("families", [])}
    absentes = [f for f in lot if f["adobe_family_id"] not in presentes]
    tranche["familles_visees"] = len(lot)
    tranche["premiere"] = lot[0]["display_name"] if lot else None
    tranche["derniere"] = lot[-1]["display_name"] if lot else None
    print(f"tranche {args.remplir} -> kit {kit_id} : {len(presentes)} presentes, "
          f"{len(absentes)} a ajouter")

    if not absentes:
        # RIEN A AJOUTER NE VEUT PAS DIRE RIEN A FAIRE : un projet peut porter ses
        # familles sans que la publication ait pris, c'est arrive a la tranche 1.
        octets, servies = publier(kit_id, j, len(presentes))
        print(f"  rien a ajouter, publication verifiee : {servies}/{len(presentes)} servies, "
              f"{octets} octets")
        tranche["familles_servies"] = servies
        tranche["octets_feuille"] = octets
        manifeste_ecrire(man)
        return

    faits = 0
    for f in absentes:
        appel("POST", f"kits/{kit_id}/families/{f['adobe_family_id']}", j,
              {"subset": "default", "variations": f["variation"]})
        faits += 1
        if faits % 50 == 0:
            print(f"  {faits}/{len(absentes)}", flush=True)
        # PALIER : on publie et on verifie en montant, parce que redescendre est
        # impossible. Si la publication cesse de prendre, le palier precedent reste
        # servi et le plafond est connu.
        if faits % args.palier == 0 or faits == len(absentes):
            total = len(presentes) + faits
            octets, servies = publier(kit_id, j, total)
            print(f"  palier {total} familles -> feuille {octets} octets, "
                  f"{servies} servies", flush=True)
            tranche["familles_servies"] = servies
            tranche["octets_feuille"] = octets
            manifeste_ecrire(man)
            if servies < total * 0.9:
                print("  PLAFOND ATTEINT : la feuille ne suit plus, on s'arrete la.")
                return

    print(f"tranche {args.remplir} : {faits} ajoutees")


main()
