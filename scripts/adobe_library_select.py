"""
adobe_library_select.py

Choisit, dans la bibliotheque Adobe Fonts entiere, les familles a faire entrer au
projet web. N'ECRIT NI EN BASE NI CHEZ ADOBE : il produit un fichier de selection
a relire, plus un releve chiffre.

D'OU VIENNENT LES DONNEES. Deux points d'entree publics d'Adobe, qui repondent 200
sans aucun jeton :
    GET api.typekit.com/api/v1/json/libraries/full   la liste des familles
    GET api.typekit.com/api/v1/json/families/<id>    la fiche d'une famille
Le releve se fait a cote, un fichier JSON par famille, et ce script ne fait que le
lire. Aucun fichier de police n'est telecharge, leurs conditions l'interdisent.

CE QUI EST D'ADOBE ET CE QUI EST DE MOI, la distinction qui compte a la revue :
  d'Adobe, repris sans retouche : id, nom exact, slug, variations disponibles,
    le generique de css_stack, et browse_info quand elle est remplie
  de moi, par regle mecanique : le romain retenu, le groupe de familles, la
    famille canonique du groupe, et le fait de tenir une famille pour
    inclassable

LE PIEGE MESURE, A NE PAS REAPPRENDRE. browse_info est VIDE pour une bonne partie
de la bibliotheque : ni classification, ni langue, ni graisse. A 108 familles la
categorie se relisait a l'oeil, a plusieurs milliers c'est impossible. Donc une
famille sans classification Adobe entre avec la mention inclassable, et c'est au
code de jeu de ne pas s'en servir pour fabriquer des leurres. Une categorie
inventee par regle serait pire que pas de categorie : elle serait crue.

Usage :
    python3 scripts/adobe_library_select.py --releve <dossier> [--sortie <fichier>]
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

# Un seul romain par famille, decision du proprietaire du 2026-08-23, jamais de
# variation de graisse. Ordre de preference : le 400 d'abord, puis le poids le plus
# proche, l'italique seulement si la famille n'a aucun droit.
ROMAINS = ["n4", "n5", "n3", "n6", "n2", "n7", "n1", "n8", "n9"]
ITALIQUES = ["i4", "i5", "i3", "i6", "i2", "i7", "i1", "i8", "i9"]

# Ecritures non latines : le jeu demande de nommer un dessin latin, une famille qui
# ne dessine pas l'alphabet latin n'a rien a y faire. Reconnues au nom, faute de
# mieux : browse_info ne porte pas la langue pour tout le monde.
NON_LATIN = re.compile(
    r"\b(kozuka|ryo|hei|kaku|maru|mincho|gothic std b|source han|ten mincho|"
    r"tazugane|yu (gothic|mincho)|adobe (myungjo|song|fangsong|heiti|kaiti|ming)|"
    r"arabic|hebrew|thai|devanagari|bengali|tamil|telugu|gujarati|kannada|"
    r"malayalam|oriya|gurmukhi|sinhala|myanmar|khmer|lao|armenian|georgian|"
    r"cherokee|ethiopic|cyrillic asia|hanzi|kanji|hangul)\b",
    re.I,
)

# Polices qui ne dessinent rien ou ne dessinent pas des lettres. Adobe Blank etait
# jouable en aout, elle porte les 52 lettres latines sans en dessiner aucune.
#
# LES PLURIELS COMPTENT, mesure du 2026-09-11 : sans eux, Webdings, Noto Sans
# Symbols 2, Adorn Ornaments et Lullabies Extras entraient dans la selection. Et les
# bornes de mot aussi : sans elles, "Kepler Std Semicondensed" est ecartee parce que
# "semICONdensed" contient icon.
SANS_ENCRE = re.compile(
    r"\b(blank|dingbats?|webdings|wingdings|ornaments?|symbols?|icons?|extras?|"
    r"borders?|frames?|fleurons?|pi)\b",
    re.I,
)

# Suffixes qui disent une variante du meme dessin, pas une police celebre de plus.
VARIANTE = re.compile(
    r"\b(condensed|compressed|extended|narrow|wide|display|caption|subhead|text|"
    r"micro|poster|headline|titling|inline|shadowed|outline|stencil|deco|sc|"
    r"small caps|bold|light|black|thin|ultra|semibold|medium|book|regular|"
    r"oblique|italic|nova|next|pro|std|urw|bt|mt|lt|ot|no2|1|2|3)\b",
    re.I,
)


def fvds(variations: list) -> list[str]:
    """Les variations d'Adobe sont des objets, pas des chaines.

    PIEGE MESURE LE 2026-09-11, il aurait mis Proxima Nova THIN dans le kit :
    chaque variation arrive sous la forme {"id": "vcsm:n1", "name": "Proxima Nova
    Thin", "fvd": "n1"}. Un simple `"n4" in variations` est donc toujours faux, et
    le repli prenait la premiere variation, la plus maigre neuf fois sur dix.
    """
    out = []
    for v in variations:
        code = v.get("fvd") if isinstance(v, dict) else v
        if isinstance(code, str):
            out.append(code)
    return out


def romain(variations: list) -> str | None:
    codes = fvds(variations)
    for v in ROMAINS:
        if v in codes:
            return v
    for v in ITALIQUES:
        if v in codes:
            return v
    return codes[0] if codes else None


def racine(nom: str) -> str:
    """Le groupe d'une famille : son nom debarrasse de ses suffixes de variante."""
    mots = re.split(r"[\s\-]+", nom)
    garde: list[str] = []
    for m in mots:
        if VARIANTE.fullmatch(m):
            break
        garde.append(m)
    return " ".join(garde).strip().lower() or nom.lower()


def lire(releve: Path) -> list[dict]:
    fiches = []
    for p in sorted(releve.glob("*.json")):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        f = d.get("family")
        if f and f.get("id"):
            fiches.append(f)
    return fiches


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--releve", required=True, type=Path)
    ap.add_argument("--sortie", type=Path, default=Path("/tmp/adobe-selection.json"))
    args = ap.parse_args()

    fiches = lire(args.releve)
    ecarte = Counter()
    gardees: list[dict] = []

    for f in fiches:
        nom = (f.get("name") or "").strip()
        variations = f.get("variations") or []
        bi = f.get("browse_info") or {}
        if not nom or not variations:
            ecarte["sans nom ou sans variation"] += 1
            continue
        if NON_LATIN.search(nom):
            ecarte["ecriture non latine"] += 1
            continue
        if SANS_ENCRE.search(nom):
            ecarte["ne dessine pas de lettres"] += 1
            continue
        v = romain(variations)
        if not v:
            ecarte["aucun romain"] += 1
            continue
        classif = (bi.get("classification") or [None])[0]
        gardees.append(
            {
                "adobe_family_id": f["id"],
                "display_name": nom,
                "slug": f.get("slug"),
                "variation": v,
                "classification_adobe": classif,
                "css_stack_generique": (f.get("css_stack") or "").split(",")[-1].strip(),
                "inclassable": classif is None,
                "foundry": (f.get("foundry") or {}).get("name"),
                "groupe": racine(nom),
            }
        )

    # La canonique d'un groupe est celle au nom le plus court, a egalite la
    # premiere par ordre alphabetique. Regle mecanique, donc a relire : c'est elle
    # qui decide quelle police un debutant peut recevoir.
    groupes: dict[str, list[dict]] = defaultdict(list)
    for g in gardees:
        groupes[g["groupe"]].append(g)
    for nom_groupe, membres in groupes.items():
        canon = sorted(membres, key=lambda m: (len(m["display_name"]), m["display_name"]))[0]
        for m in membres:
            m["canonique"] = m is canon

    args.sortie.write_text(
        json.dumps({"familles": gardees}, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    print(f"fiches lues                 {len(fiches)}")
    for motif, n in ecarte.most_common():
        print(f"  ecartees, {motif:<28} {n}")
    print(f"familles gardees            {len(gardees)}")
    print(f"  groupes                   {len(groupes)}")
    print(f"  canoniques                {sum(1 for g in gardees if g['canonique'])}")
    print(f"  inclassables chez Adobe   {sum(1 for g in gardees if g['inclassable'])}")
    cl = Counter(g["classification_adobe"] or "(aucune)" for g in gardees)
    print("  classifications           " + ", ".join(f"{k} {v}" for k, v in cl.most_common()))
    print(f"selection ecrite dans       {args.sortie}")
    print(f"poids CSS estime            {len(gardees) * 623 // 1024} Ko brut, "
          f"{len(gardees) * 57 // 1024} Ko sur le reseau (mesure du 2026-09-11 : "
          f"623 octets par famille, 57 compresses)")


main()
