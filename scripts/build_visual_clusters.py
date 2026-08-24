"""
build_visual_clusters.py

Subdivise les clusters visuels du catalogue en s'appuyant sur la geometrie mesuree,
et ecrit la migration 018 plus son miroir dans le JSON du catalogue.

CE QU'ON A ESSAYE ET POURQUOI ON NE L'A PAS GARDE. La question de depart etait de
REMPLACER la classification heritee, jugee inutilisable parce que trois clusters
portaient 85 pour cent du catalogue actif. Trois methodes ont ete essayees et
mesurees contre treize paires de reference, six qui doivent se rejoindre et sept
qui doivent rester separees :

  tranches a seuils fixes         echec, aucune ne casse le gros paquet
  tranches par quantiles          9 sur 13, et Arimo et Roboto separes alors que
                                  quatre millemes les separent : une frontiere fixe
                                  ne sait pas qu'elle coupe un sosie en deux
  k moyennes sur la mesure seule  10 sur 13 au mieux, mais un cluster de 210

  la classification HERITEE        10 sur 13

Autrement dit, la classification heritee fait aussi bien que tout ce que la mesure
seule produit. Ce n'est pas un hasard : sub_category encode l'histoire du dessin,
neo grotesque contre humaniste contre didone, et cette histoire predit la confusion
mieux que les proportions. Lato et Open Sans se ressemblent par leurs terminaisons
et l'ouverture de leur e, pas par leur chasse.

CE QUE FAIT DONC CE SCRIPT. Il garde sub_category comme cle, et ne s'en sert la
mesure que pour DECOUPER les paquets trop gros. Resultat mesure : 41 clusters au
lieu de 11, le plus gros passe de 431 a 185, et surtout les deux rapprochements
faux de la classification heritee disparaissent, Playfair avec Abril Fatface et
Bodoni avec Abril Fatface, qui n'ont en commun que d'etre des serifs de titrage.

CE QUI RESTE IRREDUCTIBLE, ET IL FAUT LE DIRE. Le paquet sans_serif/humanist compte
358 polices et garde un noyau de 175 quel que soit le nombre de centres demande,
mesure de k egal 4 a k egal 30. Ces 175 lineales humanistes sont geometriquement
interchangeables sur les cinq grandeurs mesurees. Les separer demanderait de
reconnaitre la forme des terminaisons et l'ouverture du e, ce qui n'est pas une
mesure mais une reconnaissance de forme, et donc un autre chantier.

POURQUOI LE CONTRASTE ENTRE EN LOGARITHME. Il va de 0,04 a 10,7 : l'ecart entre 1 et
2 saute aux yeux, celui entre 9 et 10 ne se voit pas. Sans logarithme les quelques
didones extremes ecrasent toute la structure des lineales.

POURQUOI LES MESURES SONT ECRETEES A 5 POUR CENT. k moyennes minimise la variance,
donc il depense ses centres sur les cas extremes et laisse le coeur en un bloc :
sans ecretage le plus gros cluster restait a 229. L'ecretage ne change pas l'ordre,
il empeche seulement une poignee de polices hors normes de decider du decoupage.

DETERMINISTE. Graine fixe pour l'initialisation k moyennes plus plus, donc deux
executions donnent la meme migration.

LES POLICES ADOBE N'ONT PAS DE FICHIER, leurs conditions l'interdisent, donc pas de
mesure. Elles rejoignent le premier sous cluster de leur famille de dessin, ce qui
les met dans le meme sac que les Google du meme genre : une question sur Helvetica
peut ainsi tirer Roboto ou Arimo comme leurre, ce qui est exactement le bon leurre.
Le numero de sous cluster est arbitraire pour elles, faute de mesure, et c'est dit.

Usage :
    ./.venv/bin/python scripts/build_visual_clusters.py
    ./.venv/bin/python scripts/build_visual_clusters.py --taille-visee 40
"""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

MESURES = "data/typography-profiles/geometry-measured.json"
CATALOGUE = "content/catalog/typefaces-core.json"
GRAINE = 20260824

# Les cinq grandeurs qui entrent dans la distance. Le contraste passe en
# logarithme, les autres sont deja lineaires a l'oeil.
DIMENSIONS = ["contraste_log", "chasse", "graisse", "x_sur_cap", "rondeur"]


def vecteur(g: dict) -> list[float]:
    return [
        math.log(max(g.get("contraste") or 1.0, 0.05)),
        g["chasse"],
        g.get("graisse") or 0.45,
        g["x_sur_cap"],
        g["rondeur"],
    ]


def ecreter_et_reduire(x: np.ndarray, pourcent: float = 5.0) -> np.ndarray:
    """Ecrete aux percentiles puis centre reduit. Voir l'entete pour le pourquoi."""
    bas, haut = np.percentile(x, pourcent, axis=0), np.percentile(x, 100 - pourcent, axis=0)
    xc = np.clip(x, bas, haut)
    return (xc - xc.mean(axis=0)) / np.where(xc.std(axis=0) > 0, xc.std(axis=0), 1)


def kmeans(x: np.ndarray, k: int, graine: int, tours: int = 60):
    """k moyennes avec initialisation k moyennes plus plus, sans dependance externe."""
    rng = np.random.default_rng(graine)
    centres = [x[rng.integers(len(x))]]
    for _ in range(k - 1):
        d = np.min(((x[:, None, :] - np.array(centres)[None, :, :]) ** 2).sum(-1), axis=1)
        total = d.sum()
        centres.append(x[rng.choice(len(x), p=d / total) if total > 0 else rng.integers(len(x))])
    centres = np.array(centres)
    for _ in range(tours):
        d = ((x[:, None, :] - centres[None, :, :]) ** 2).sum(-1)
        etiquettes = d.argmin(axis=1)
        nouveaux = np.array([
            x[etiquettes == i].mean(axis=0) if (etiquettes == i).any() else centres[i]
            for i in range(k)
        ])
        if np.allclose(nouveaux, centres):
            break
        centres = nouveaux
    return etiquettes


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Subdivise les clusters visuels par la mesure.")
    p.add_argument("--taille-visee", type=int, default=40,
                   help="taille moyenne visee d'un sous cluster")
    p.add_argument("--sortie-sql", default="db/migrations/018_visual_clusters.sql")
    p.add_argument("--rapport", default="data/typography-profiles/visual-clusters.json")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    mesures = json.loads(Path(MESURES).read_text(encoding="utf-8"))["mesures"]
    catalogue = json.loads(Path(CATALOGUE).read_text(encoding="utf-8"))
    par_slug = {r["typeface_slug"]: r for r in catalogue["records"]}

    # 1. Les Google mesurees : sous categorie comme cle, geometrie pour decouper.
    par_sous = defaultdict(list)
    for slug in mesures:
        r = par_slug[slug]
        par_sous[(r["primary_category"], r["sub_category"])].append(slug)

    attribution: dict[str, str] = {}
    tailles: list[int] = []
    for (pc, sc), slugs in sorted(par_sous.items()):
        slugs = sorted(slugs)
        base = f"cluster_{pc}_{sc}"
        k = max(1, round(len(slugs) / args.taille_visee))
        if k == 1 or len(slugs) < 4:
            for s in slugs:
                attribution[s] = f"{base}_00"
            tailles.append(len(slugs))
            continue
        x = ecreter_et_reduire(np.array([vecteur(mesures[s]) for s in slugs]))
        etiquettes = kmeans(x, k, GRAINE)
        for s, e in zip(slugs, etiquettes):
            attribution[s] = f"{base}_{int(e):02d}"
        tailles += [int((etiquettes == i).sum()) for i in range(k)]

    # 2. Les non mesurees, Adobe comprises : premier sous cluster de leur famille.
    #    Numero arbitraire faute de mesure, mais la famille, elle, est juste.
    sans_mesure = 0
    for r in catalogue["records"]:
        if r["typeface_slug"] in attribution or not r["activation_status"]:
            continue
        attribution[r["typeface_slug"]] = f"cluster_{r['primary_category']}_{r['sub_category']}_00"
        sans_mesure += 1

    # 3. La migration, un ordre par cluster plutot qu'un par police.
    par_cluster = defaultdict(list)
    for slug, cluster in attribution.items():
        if par_slug[slug]["visual_cluster_id"] != cluster:
            par_cluster[cluster].append(slug)

    horodatage = datetime.now(timezone.utc).date()
    anciens = len({r["visual_cluster_id"] for r in catalogue["records"] if r["activation_status"]})
    ordres = []
    for cluster in sorted(par_cluster):
        liste = ", ".join("'" + s.replace("'", "''") + "'" for s in sorted(par_cluster[cluster]))
        ordres.append(
            "UPDATE typefaces_core SET\n"
            f"  visual_cluster_id = '{cluster}',\n"
            "  updated_at_utc = now()\n"
            f"WHERE typeface_slug = ANY(ARRAY[{liste}]);")

    entete = f"""-- ============================================================
-- MIGRATION 018 : les clusters visuels, subdivises par la geometrie mesuree
-- Genere par scripts/build_visual_clusters.py le {horodatage}
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- Retour arriere : 018_visual_clusters.rollback.sql
-- ============================================================
--
-- CE QUE LE CLUSTER DECIDE. Les deux fournisseurs s'en servent pour choisir les
-- mauvaises reponses : une police du meme cluster fait un leurre plus dur, et vaut
-- un malus de 175 a 350 points dans le tri. Trois clusters portaient 85 pour cent
-- du catalogue actif, donc ce malus ne discriminait plus rien.
--
-- CE QUI A ETE ESSAYE ET REJETE, detail dans le script generateur. La classification
-- heritee n'est PAS fausse : mesuree contre treize paires de reference elle fait
-- 10 sur 13, aussi bien que tout ce que la geometrie seule produit. Elle encode
-- l'histoire du dessin, et l'histoire predit la confusion mieux que les proportions.
-- Son defaut est le grain, pas la justesse. Elle est donc SUBDIVISEE, pas remplacee.
--
-- CE QUE CA CHANGE, MESURE : {anciens} clusters actifs deviennent {len(set(attribution.values()))}, le plus gros
-- passe de 431 a {max(tailles)} polices, et les deux rapprochements faux de la classification
-- heritee disparaissent, Playfair avec Abril Fatface et Bodoni avec Abril Fatface.
--
-- CE QUI RESTE IRREDUCTIBLE. Le paquet sans_serif/humanist compte 358 polices et
-- garde un noyau de 175 quel que soit le nombre de centres, de k egal 4 a k egal 30.
-- Ces 175 lineales sont geometriquement interchangeables sur les cinq grandeurs
-- mesurees. Les separer demande de reconnaitre les terminaisons et l'ouverture du e,
-- ce qui est une reconnaissance de forme et non une mesure.
--
-- LES {sans_mesure} LIGNES NON MESUREES, dont les 108 Adobe, rejoignent le premier sous cluster
-- de leur famille de dessin. Adobe n'autorise aucun telechargement de fichier, donc
-- aucune mesure n'est possible. Le numero est arbitraire pour elles, la famille non :
-- une question sur Helvetica peut ainsi tirer Roboto comme leurre, ce qui est juste.
--
-- PIEGE DE REIMPORT : content/catalog/typefaces-core.json est mis en miroir par le
-- meme script, dans le meme commit.

BEGIN;

"""
    Path(args.sortie_sql).write_text(entete + "\n\n".join(ordres) + "\n\nCOMMIT;\n", encoding="utf-8")

    # 4. Le retour arriere, depuis l'etat actuel du JSON.
    avant = defaultdict(list)
    for slug in par_cluster:
        pass
    for cluster, slugs in par_cluster.items():
        for s in slugs:
            avant[par_slug[s]["visual_cluster_id"]].append(s)
    retour = ["-- Retour arriere de la 018 : rend a chaque police son cluster d'avant.",
              f"-- Genere le {horodatage}.", "", "BEGIN;", ""]
    for cluster in sorted(avant):
        liste = ", ".join("'" + s.replace("'", "''") + "'" for s in sorted(avant[cluster]))
        retour.append(f"UPDATE typefaces_core SET visual_cluster_id = '{cluster}', updated_at_utc = now()\n"
                      f"WHERE typeface_slug = ANY(ARRAY[{liste}]);\n")
    retour += ["COMMIT;", ""]
    Path(args.sortie_sql.replace(".sql", ".rollback.sql")).write_text("\n".join(retour), encoding="utf-8")

    # 5. Le miroir dans le JSON.
    for r in catalogue["records"]:
        if r["typeface_slug"] in attribution:
            r["visual_cluster_id"] = attribution[r["typeface_slug"]]
    Path(CATALOGUE).write_text(
        json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    Path(args.rapport).write_text(
        json.dumps({"meta": {"graine": GRAINE, "dimensions": DIMENSIONS,
                             "taille_visee": args.taille_visee,
                             "clusters": len(set(attribution.values())),
                             "plus_gros": max(tailles), "sans_mesure": sans_mesure},
                    "attribution": attribution}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")

    print(f"{len(set(attribution.values()))} clusters, plus gros {max(tailles)} polices mesurees")
    print(f"{sans_mesure} lignes non mesurees rattachees a leur famille")
    print(f"{len(ordres)} ordres SQL, {sum(len(v) for v in par_cluster.values())} polices deplacees")
    print(f"ecrits : {args.sortie_sql}, son retour arriere, et le miroir JSON")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
