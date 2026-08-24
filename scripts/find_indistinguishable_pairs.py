"""
find_indistinguishable_pairs.py

Cherche les paires de polices ACTIVES ET JOUABLES dont le dessin latin est
identique a la mesure pres, et ecrit le rapport dans
data/typography-profiles/indistinguishable-pairs.json.

POURQUOI. Le jeu montre un mot et demande quelle police le dessine. Si deux
polices du catalogue dessinent le latin exactement pareil et peuvent sortir dans
la meme manche, l'une comme bonne reponse, l'autre comme leurre, la question n'a
pas de reponse : le joueur ne peut pas la trouver, il ne peut que deviner. C'est
le meme defaut que la police sans encre reparee par la 017, sous une autre forme.

LE CAS QUI A FAIT OUVRIR LA CHASSE. Noto Sans Bengali, Devanagari, Thai, Tamil,
Telugu et Khmer sont Noto Sans avec une ecriture supplementaire. Leur latin est le
meme trait pour trait, et six d'entre elles etaient dans la portee du debutant, aux
cotes de Noto Sans elle meme.

CE QUI COMPTE COMME IDENTIQUE. Neuf grandeurs mesurees, six de proportion et trois
de forme, toutes normalisees. Deux polices sont declarees indistinguables si CHAQUE
grandeur differe de moins du seuil, par defaut un pour cent en relatif. C'est un ET
et non une moyenne : deux polices qui different franchement sur une seule grandeur
restent distinguables, et c'est bien ce qu'on veut.

CE QUE LE SCRIPT NE FAIT PAS. Il ne decide rien. Il rapporte, et le choix de ce
qu'on fait des paires trouvees, eteindre la variante ou la rendre plus rare,
appartient au proprietaire du projet.

Usage :
    ./.venv/bin/python scripts/find_indistinguishable_pairs.py
    ./.venv/bin/python scripts/find_indistinguishable_pairs.py --seuil 0.02
"""

from __future__ import annotations

import argparse
import json
import re
from itertools import combinations
from pathlib import Path

GEOMETRIE = "data/typography-profiles/geometry-measured.json"
FORMES = "data/typography-profiles/shapes-measured.json"
CATALOGUE = "content/catalog/typefaces-core.json"
GARDE_LATIN = "lib/game/latin-coverage-guard.ts"
SORTIE = "data/typography-profiles/indistinguishable-pairs.json"

GRANDEURS = ["x_sur_cap", "hauteur_x", "chasse", "graisse", "contraste", "rondeur"]
GRANDEURS_FORME = ["regularite_anneau", "ouverture_c"]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Cherche les polices indistinguables.")
    p.add_argument("--seuil", type=float, default=0.01,
                   help="ecart relatif maximal sur CHAQUE grandeur")
    p.add_argument("--output", default=SORTIE)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    geo = json.loads(Path(GEOMETRIE).read_text(encoding="utf-8"))["mesures"]
    formes = json.loads(Path(FORMES).read_text(encoding="utf-8"))["mesures"]
    catalogue = {r["typeface_slug"]: r
                 for r in json.loads(Path(CATALOGUE).read_text(encoding="utf-8"))["records"]}
    source = Path(GARDE_LATIN).read_text(encoding="utf-8")
    ecartees = set(re.findall(r'"([^"]+)"',
                              source[source.index("LATIN_UNREADY_SLUGS = ["):source.index("] as const")]))

    jouables = sorted(
        s for s in geo
        if catalogue[s]["activation_status"] and s not in ecartees and s in formes
    )
    print(f"{len(jouables)} polices actives, jouables et mesurees")

    def profil(s):
        v = [geo[s].get(k) for k in GRANDEURS] + [formes[s].get(k) for k in GRANDEURS_FORME]
        v.append(formes[s].get("etages_g"))
        return v

    profils = {s: profil(s) for s in jouables}

    paires = []
    for a, b in combinations(jouables, 2):
        pa, pb = profils[a], profils[b]
        if pa[-1] != pb[-1]:          # construction du g differente : distinguables
            continue
        identique = True
        for x, y in zip(pa[:-1], pb[:-1]):
            if x is None or y and abs(y) < 1e-9:
                identique = False
                break
            if abs(x - y) / max(abs(x), abs(y), 1e-9) > args.seuil:
                identique = False
                break
        if identique:
            paires.append((a, b))

    # LES FAMILLES SE FORMENT PAR LIEN COMPLET, PAS PAR CHAINE.
    #
    # Premiere version : une union par proche en proche, si a ressemble a b et b a c
    # alors les trois font famille. Faux, et la verification l'a montre tout de
    # suite : elle produisait une famille de 156 polices ou Noto Sans et Noto Sans JP
    # se retrouvaient ensemble alors qu'elles different de 49 pour cent en graisse.
    # Une chaine de ressemblances n'est pas une ressemblance.
    #
    # Ici une famille n'est valide que si CHACUN de ses membres est indistinguable de
    # CHACUN des autres. On construit donc par ajout prudent : un candidat n'entre que
    # s'il passe le seuil contre tous les membres deja dedans.
    voisins = {s: set() for s in jouables}
    for a, b in paires:
        voisins[a].add(b)
        voisins[b].add(a)

    place = set()
    familles = []
    for graine in sorted(jouables, key=lambda s: -len(voisins[s])):
        if graine in place or not voisins[graine]:
            continue
        groupe = [graine]
        for candidat in sorted(voisins[graine]):
            if candidat in place:
                continue
            if all(candidat in voisins[membre] for membre in groupe):
                groupe.append(candidat)
        if len(groupe) > 1:
            familles.append(sorted(groupe))
            place.update(groupe)
    familles = {i: f for i, f in enumerate(familles)}

    rapport = []
    for membres in sorted(familles.values(), key=len, reverse=True):
        atteignables = [
            s for s in membres
            if catalogue[s]["rarity_tag"] == "common" and catalogue[s]["dreyfus_tier"] in ("N", "D")
        ]
        rapport.append({
            "membres": membres,
            "noms": [catalogue[s]["display_name"] for s in membres],
            "dans_la_portee_du_debutant": atteignables,
        })

    Path(args.output).write_text(
        json.dumps({"meta": {"seuil": args.seuil, "jouables": len(jouables),
                             "paires": len(paires), "familles": len(rapport)},
                    "familles": rapport}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")

    print(f"{len(paires)} paires indistinguables, formant {len(rapport)} familles\n")
    for f in rapport[:12]:
        marque = f" <- {len(f['dans_la_portee_du_debutant'])} dans la portee du debutant" \
            if f["dans_la_portee_du_debutant"] else ""
        print(f"  {len(f['membres'])} polices : {', '.join(f['noms'][:6])}"
              f"{' ...' if len(f['noms']) > 6 else ''}{marque}")
    if len(rapport) > 12:
        print(f"  ... et {len(rapport) - 12} autres familles")
    print(f"\nrapport complet dans {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
