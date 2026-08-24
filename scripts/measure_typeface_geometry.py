"""
measure_typeface_geometry.py

Mesure la geometrie reelle des polices servies, dans leurs fichiers, et ecrit le
resultat dans data/typography-profiles/geometry-measured.json.

POURQUOI. Les clusters visuels du catalogue ne separent plus rien : trois d'entre
eux portent 85 pour cent des polices actives. Or le cluster decide des mauvaises
reponses proposees au joueur, une police du meme cluster faisant un leurre plus
dur. La signature structurelle ne sauve pas la mise, ses trois plus gros paquets
couvrent 81 pour cent du catalogue, parce qu'elle a ete inferee par heuristique en
juin et jamais mesuree.

CE QUI EST MESURE, ET POURQUOI CES GRANDEURS LA. Toutes sont normalisees par
l'unite em, donc comparables d'une police a l'autre quelle que soit sa grille.

  x_sur_cap     hauteur d'x divisee par hauteur de capitale. C'est le rapport le
                plus visible a l'oeil nu : il separe une Helvetica d'une Garamond
                avant meme qu'on regarde une seule lettre en detail.
  chasse        avance du n divisee par l'em. Condensee, normale, etendue.
  graisse       encre du n divisee par l'aire de sa boite. Maigre a noire.
  rondeur       largeur du o divisee par sa hauteur. Cercle contre ovale.
  contraste     epaisseur du fut vertical du o divisee par celle de sa barre
                horizontale, mesurees par balayage du contour aplati. C'est la
                grandeur qui separe une Didone d'une lineale, et la seule qui
                demande un vrai calcul geometrique.
  debord        depassement du o sous la ligne de base, rapporte a l'em.

LA PENTE A ETE MESUREE PUIS RETIREE. StatisticsPen donne une inclinaison, et elle
sortait a moins trois degres sur toutes les polices testees, romaines comprises :
c'est l'arche du n qui penche a droite en haut, pas un italique. Verification faite,
le catalogue d'assets ne contient AUCUN fichier en style italique, les 1172 polices
servies sont romaines. La grandeur n'avait donc rien a separer et mesurait du bruit.
Si des italiques entrent un jour, elle redeviendra utile et se remesure en trois
lignes.

CE QUI N'EST PAS MESURE, ET POURQUOI. La forme du a, l'ouverture du e et le
dessin des terminaisons demanderaient une reconnaissance de forme, pas une mesure.
Ils restent dans structural_signature, ou ils sont inferes, et ce script ne
pretend pas les remplacer.

LES POLICES ADOBE N'ONT PAS DE FICHIER CHEZ NOUS, leurs conditions l'interdisent.
Elles sont donc absentes de cette mesure et gardent le cluster attribue a la main.

Usage :
    ./.venv/bin/python scripts/measure_typeface_geometry.py
    ./.venv/bin/python scripts/measure_typeface_geometry.py --limit 40
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.statisticsPen import StatisticsPen
from fontTools.ttLib import TTFont

ASSETS = "content/catalog/font-runtime-assets.json"
CATALOGUE = "content/catalog/typefaces-core.json"
SORTIE = "data/typography-profiles/geometry-measured.json"


def aplatir(chemin: RecordingPen, pas: int = 12) -> list[list[tuple[float, float]]]:
    """Transforme les courbes en polygones. Un contour ferme par sous liste.

    Deux conventions TrueType sont traitees explicitement, parce que les ignorer
    faisait echouer 90 polices sur 1172 au premier passage.

    UNE CHAINE DE POINTS DE CONTROLE SE DECOMPOSE, elle ne se lisse pas d'un bloc.
    `qCurveTo(c1, c2, fin)` n'est pas une bezier de degre trois : c'est une suite de
    quadratiques dont les points de jonction sont les milieux des points de controle
    consecutifs. Lisser la chaine entiere reste dans l'enveloppe convexe, donc
    l'erreur serait petite, mais elle serait systematique sur les serifs, qui sont
    justement faits de ces chaines.

    UN CONTOUR PEUT N'AVOIR AUCUN POINT SUR LA COURBE. Le o de plusieurs polices
    dessine sa contreforme ainsi : `qCurveTo` arrive sans `moveTo` avant lui, et le
    point de depart implicite est le milieu du dernier et du premier point de
    controle. C'est ce cas qui levait IndexError.
    """
    contours: list[list[tuple[float, float]]] = []
    courant: list[tuple[float, float]] = []

    def milieu(a, b):
        return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)

    def fermer():
        nonlocal courant
        if len(courant) > 2:
            contours.append(courant)
        courant = []

    for op, args in chemin.value:
        if op == "moveTo":
            fermer()
            courant = [args[0]]
        elif op == "lineTo":
            courant.append(args[0])
        elif op == "qCurveTo":
            points = list(args)
            if points and points[-1] is None:
                # contour entierement hors courbe : depart implicite au milieu
                points = points[:-1]
                if not points:
                    continue
                depart = milieu(points[-1], points[0])
                courant = [depart]
                points = points + [depart]
            elif not courant:
                # qCurveTo sans moveTo : meme cas, la fin sert d'ancrage
                courant = [milieu(points[-1], points[0])] if len(points) > 1 else [points[-1]]
            controles, fin_seg = points[:-1], points[-1]
            for i, c in enumerate(controles):
                cible = fin_seg if i == len(controles) - 1 else milieu(c, controles[i + 1])
                depart_seg = courant[-1]
                for k in range(1, pas + 1):
                    courant.append(_quadratique(depart_seg, c, cible, k / pas))
        elif op == "curveTo":
            if len(args) < 3:
                courant.append(args[-1])
                continue
            p0 = courant[-1] if courant else args[0]
            if not courant:
                courant = [p0]
            for k in range(1, pas + 1):
                courant.append(_cubique(p0, args[0], args[1], args[2], k / pas))
        elif op == "closePath":
            fermer()
    fermer()
    return contours


def _quadratique(p0, p1, p2, t):
    u = 1 - t
    return (
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    )


def _cubique(p0, p1, p2, p3, t):
    u = 1 - t
    return (
        u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
        u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
    )


def epaisseur_horizontale(contours, y: float) -> float | None:
    """Epaisseur d'encre sur la ligne horizontale y, en unites de la police.

    On collecte les abscisses ou le contour croise la ligne, on les trie, et on
    somme les segments pleins. La regle pair impair suffit ici : les contours
    d'une lettre latine ne s'auto intersectent pas.
    """
    croisements: list[float] = []
    for contour in contours:
        for (x1, y1), (x2, y2) in zip(contour, contour[1:] + contour[:1]):
            if (y1 <= y < y2) or (y2 <= y < y1):
                if y2 != y1:
                    croisements.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
    if len(croisements) < 2:
        return None
    croisements.sort()
    return sum(b - a for a, b in zip(croisements[0::2], croisements[1::2]))


def epaisseur_verticale(contours, x: float) -> float | None:
    croisements: list[float] = []
    for contour in contours:
        for (x1, y1), (x2, y2) in zip(contour, contour[1:] + contour[:1]):
            if (x1 <= x < x2) or (x2 <= x < x1):
                if x2 != x1:
                    croisements.append(y1 + (x - x1) * (y2 - y1) / (x2 - x1))
    if len(croisements) < 2:
        return None
    croisements.sort()
    return sum(b - a for a, b in zip(croisements[0::2], croisements[1::2]))


def mesurer(chemin_fichier: str) -> dict | None:
    police = TTFont(chemin_fichier, lazy=True, fontNumber=0)
    upm = police["head"].unitsPerEm
    jeu = police.getGlyphSet()
    cmap = police.getBestCmap()

    def glyphe(caractere: str):
        nom = cmap.get(ord(caractere))
        return jeu[nom] if nom and nom in jeu else None

    def boite(caractere: str):
        g = glyphe(caractere)
        if g is None:
            return None
        pen = BoundsPen(jeu)
        g.draw(pen)
        return pen.bounds

    bx, bH, bo, bn = boite("x"), boite("H"), boite("o"), boite("n")
    if not (bx and bH and bo and bn):
        return None

    hauteur_x = bx[3] - bx[1]
    hauteur_cap = bH[3] - bH[1]
    if hauteur_x <= 0 or hauteur_cap <= 0:
        return None

    stats = StatisticsPen(jeu)
    glyphe("n").draw(stats)
    aire_n = abs(stats.area)
    boite_n = (bn[2] - bn[0]) * (bn[3] - bn[1])

    trace = RecordingPen()
    glyphe("o").draw(trace)
    contours = aplatir(trace)
    milieu_y = (bo[1] + bo[3]) / 2
    milieu_x = (bo[0] + bo[2]) / 2
    fut = epaisseur_horizontale(contours, milieu_y)      # les deux futs verticaux
    barre = epaisseur_verticale(contours, milieu_x)      # les deux barres horizontales
    contraste = (fut / barre) if (fut and barre and barre > 0) else None

    return {
        "upm": upm,
        "x_sur_cap": round(hauteur_x / hauteur_cap, 4),
        "hauteur_x": round(hauteur_x / upm, 4),
        "hauteur_cap": round(hauteur_cap / upm, 4),
        "chasse": round(jeu["n"].width / upm, 4) if "n" in jeu else round((bn[2] - bn[0]) / upm, 4),
        "graisse": round(aire_n / boite_n, 4) if boite_n > 0 else None,
        "rondeur": round((bo[2] - bo[0]) / (bo[3] - bo[1]), 4),
        "contraste": round(contraste, 4) if contraste else None,
        "debord": round(-bo[1] / upm, 4),
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Mesure la geometrie des polices servies.")
    p.add_argument("--limit", type=int, default=0, help="s'arreter apres N polices")
    p.add_argument("--output", default=SORTIE)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    actifs = {
        r["typeface_slug"]
        for r in json.loads(Path(CATALOGUE).read_text(encoding="utf-8"))["records"]
        if r["activation_status"] and r["font_source"] != "adobe"
    }
    primaires = [
        a for a in json.loads(Path(ASSETS).read_text(encoding="utf-8"))["records"]
        if a.get("file_role") == "primary"
        and a.get("runtime_status") == "ready"
        and a["typeface_slug"] in actifs
    ]
    if args.limit:
        primaires = primaires[: args.limit]

    mesures, echecs = {}, []
    for i, a in enumerate(primaires, 1):
        try:
            m = mesurer(a["source_path"])
        except Exception as e:  # un fichier illisible ne doit pas arreter les 1171 autres
            echecs.append((a["typeface_slug"], f"{type(e).__name__}: {e}"))
            continue
        if m is None:
            echecs.append((a["typeface_slug"], "lettres x, H, o ou n absentes"))
            continue
        mesures[a["typeface_slug"]] = m
        if i % 200 == 0:
            print(f"  {i}/{len(primaires)}")

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(
        json.dumps({"meta": {"mesurees": len(mesures), "echecs": len(echecs)},
                    "mesures": mesures}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")

    print(f"\n{len(mesures)} polices mesurees, {len(echecs)} echecs")
    for slug, raison in echecs[:12]:
        print(f"  {slug} : {raison}")
    if len(echecs) > 12:
        print(f"  ... et {len(echecs) - 12} autres")
    print(f"ecrit dans {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
