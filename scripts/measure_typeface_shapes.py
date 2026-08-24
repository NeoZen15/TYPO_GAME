"""
measure_typeface_shapes.py

Mesure la FORME des lettres, la ou measure_typeface_geometry.py mesure leurs
PROPORTIONS. Ecrit dans data/typography-profiles/shapes-measured.json.

POURQUOI CE SECOND MESUREUR. Le regroupement par proportions laisse un noyau
irreductible de 175 lineales humanistes : elles ont la meme chasse, la meme
graisse, le meme rapport de hauteur d'x, le meme contraste. Ce qui les distingue
est ailleurs, dans le dessin de la lettre, et c'est justement ce qu'un joueur
apprend a regarder.

CE QUI EST MESURE, ET POURQUOI CES TROIS LA.

  axe_contraste  Angle ou l'anneau du o est le plus mince, en degres. 90 veut dire
                 que les points minces sont en haut et en bas, donc un axe vertical,
                 celui des lineales et des didones. Un axe incline, vers 105 ou 110,
                 est la signature des anciennes : la plume tenue de biais. Mesure
                 sur EB Garamond : 105. Sur Lato et Open Sans : 90.

  regularite     Rapport entre le point le plus mince de l'anneau du o et le plus
                 epais. Proche de 1 : un trait d'epaisseur constante, la geometrique
                 monolineaire. Loin de 1 : un trait module, l'humaniste ou l'ancienne.
                 C'est aussi elle qui decide si l'axe ci dessus a un sens.

  ouverture_c    Part de la hauteur du c qui reste vide sur son flanc droit. Un c
                 tres ferme se rapproche du o, un c tres ouvert s'evase. Mesure :
                 0,63 pour Roboto, 0,89 pour Josefin Sans.

  etages_g       Nombre de contours du g. Un g a deux etages, celui de Lato ou de
                 Roboto, en a trois : la panse, la boucle du bas et le contour
                 exterieur. Un g a un seul etage, celui d'Inter ou de Futura, en a
                 deux. C'est une difference que le joueur voit tout de suite, et
                 aucune proportion ne la capte.

CE QUI N'EST PAS MESURE. La forme des terminaisons demanderait de suivre le
contour et d'en qualifier la coupe, ce qui est un cran au dessus. Le a a un ou
deux etages ne se lit pas au compte de contours, les deux en ont deux.

L'AXE SE MESURE PAR RAYONS, PAS PAR CORDES. Premiere version : balayer des cordes
a travers le centre du o en comptant les traversees d'encre. Correct mais beaucoup
trop lent pour 1136 polices. Ici on separe le contour exterieur de la contreforme,
puis on tire un rayon par angle : l'epaisseur est la difference des deux distances.

Usage :
    ./.venv/bin/python scripts/measure_typeface_shapes.py
    ./.venv/bin/python scripts/measure_typeface_shapes.py --limit 30
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

from measure_typeface_geometry import aplatir, epaisseur_verticale

ASSETS = "content/catalog/font-runtime-assets.json"
CATALOGUE = "content/catalog/typefaces-core.json"
SORTIE = "data/typography-profiles/shapes-measured.json"


def _aire(contour) -> float:
    """Aire signee, par la formule du lacet. Le signe donne le sens de parcours."""
    s = 0.0
    for (x1, y1), (x2, y2) in zip(contour, contour[1:] + contour[:1]):
        s += x1 * y2 - x2 * y1
    return s / 2


def _distance_rayon(contour, cx: float, cy: float, dx: float, dy: float) -> float | None:
    """Distance du centre au contour, le long du rayon. La plus proche traversee."""
    meilleure = None
    for (x1, y1), (x2, y2) in zip(contour, contour[1:] + contour[:1]):
        ex, ey = x2 - x1, y2 - y1
        den = dx * ey - dy * ex
        if abs(den) < 1e-9:
            continue
        t = ((x1 - cx) * ey - (y1 - cy) * ex) / den      # le long du rayon
        u = ((x1 - cx) * dy - (y1 - cy) * dx) / den      # le long du segment
        if t > 0 and 0 <= u <= 1 and (meilleure is None or t < meilleure):
            meilleure = t
    return meilleure


def anneau_du_o(contours, pas_degres: int = 3) -> tuple[float | None, float | None]:
    """Rend l'angle du point le plus mince et la regularite de l'anneau.

    LA REGULARITE DECIDE SI L'ANGLE VEUT DIRE QUELQUE CHOSE. Un o monolineaire,
    Josefin Sans ou Manrope, a la meme epaisseur tout autour : le point le plus
    mince y est du bruit, et deux methodes de mesure donnaient 75 et 90 degres pour
    le meme dessin. Au dela de 0,85 de regularite on ne rend donc AUCUN axe, parce
    qu'il n'y en a pas. La regularite est elle meme discriminante : elle separe une
    geometrique monolineaire d'une humaniste modulee.
    """
    if len(contours) < 2:
        return None
    tries = sorted(contours, key=lambda c: abs(_aire(c)), reverse=True)
    exterieur, interieur = tries[0], tries[1]
    xs = [p[0] for p in interieur]
    ys = [p[1] for p in interieur]
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)

    epaisseurs = []
    for deg in range(0, 360, pas_degres):
        a = math.radians(deg)
        dx, dy = math.cos(a), math.sin(a)
        r_int = _distance_rayon(interieur, cx, cy, dx, dy)
        r_ext = _distance_rayon(exterieur, cx, cy, dx, dy)
        if r_int is None or r_ext is None or r_ext <= r_int:
            continue
        epaisseurs.append((r_ext - r_int, deg))
    if len(epaisseurs) < 12:
        return None, None
    plus_mince, angle = min(epaisseurs)
    plus_epais = max(e for e, _ in epaisseurs)
    regularite = round(plus_mince / plus_epais, 4) if plus_epais > 0 else None
    if regularite is not None and regularite > 0.85:
        # anneau monolineaire : il n'y a pas d'axe, le dire plutot que l'inventer
        return None, regularite
    # l'anneau est mince deux fois par tour, on ramene l'axe dans [0, 180)
    return float(angle % 180), regularite


def mesurer(chemin: str) -> dict | None:
    police = TTFont(chemin, lazy=True)
    jeu = police.getGlyphSet()
    cmap = police.getBestCmap()

    def forme(lettre: str):
        nom = cmap.get(ord(lettre))
        if not nom or nom not in jeu:
            return None, None
        trace = RecordingPen()
        jeu[nom].draw(trace)
        bornes = BoundsPen(jeu)
        jeu[nom].draw(bornes)
        return aplatir(trace), bornes.bounds

    contours_o, boite_o = forme("o")
    contours_c, boite_c = forme("c")
    contours_g, _ = forme("g")
    if not contours_o or not boite_o:
        return None

    axe, regularite = anneau_du_o(contours_o)

    ouverture = None
    if contours_c and boite_c:
        hauteur = boite_c[3] - boite_c[1]
        x = boite_c[0] + (boite_c[2] - boite_c[0]) * 0.92
        pleine = epaisseur_verticale(contours_c, x)
        if pleine is not None and hauteur > 0:
            ouverture = round(1 - pleine / hauteur, 4)

    return {
        "axe_contraste": round(axe, 1) if axe is not None else None,
        "regularite_anneau": regularite,
        "ouverture_c": ouverture,
        "etages_g": len(contours_g) if contours_g else None,
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Mesure la forme des lettres.")
    p.add_argument("--limit", type=int, default=0)
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
        if a.get("file_role") == "primary" and a.get("runtime_status") == "ready"
        and a["typeface_slug"] in actifs
    ]
    if args.limit:
        primaires = primaires[: args.limit]

    mesures, echecs = {}, 0
    for i, a in enumerate(primaires, 1):
        try:
            m = mesurer(a["source_path"])
        except Exception:
            echecs += 1
            continue
        if m is None or m["regularite_anneau"] is None:
            echecs += 1
            continue
        mesures[a["typeface_slug"]] = m
        if i % 250 == 0:
            print(f"  {i}/{len(primaires)}")

    Path(args.output).write_text(
        json.dumps({"meta": {"mesurees": len(mesures), "echecs": echecs}, "mesures": mesures},
                   ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"\n{len(mesures)} polices mesurees, {echecs} echecs, ecrit dans {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
