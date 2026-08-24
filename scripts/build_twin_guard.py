"""
build_twin_guard.py

Ecrit lib/game/twin-guard.ts depuis le rapport de
scripts/find_indistinguishable_pairs.py.

POURQUOI UN MODULE ET PAS UNE COLONNE EN BASE. Meme raison que pour
LATIN_UNREADY_SLUGS : la liste doit etre lisible dans le diff, verifiable hors
ligne par un garde de la porte, et modifiable sans migration. Elle decrit une
propriete des FICHIERS de police, pas une donnee de jeu.

Usage :
    ./.venv/bin/python scripts/build_twin_guard.py
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

RAPPORT = "data/typography-profiles/indistinguishable-pairs.json"
SORTIE = "lib/game/twin-guard.ts"


def main() -> int:
    rapport = json.loads(Path(RAPPORT).read_text(encoding="utf-8"))
    familles = rapport["familles"]
    total = sum(len(f["membres"]) for f in familles)
    horodatage = datetime.now(timezone.utc).date()

    lignes = [
        "// GENERE PAR scripts/build_twin_guard.py, ne pas editer a la main.",
        f"// Derniere generation : {horodatage}.",
        "//",
        "// DES POLICES QUI DESSINENT LE LATIN A L'IDENTIQUE.",
        "//",
        "// Le jeu montre un mot et demande quelle police le dessine. Si deux polices du",
        "// catalogue tracent le latin exactement pareil et sortent dans la meme manche,",
        "// l'une comme bonne reponse et l'autre comme leurre, la question n'a pas de",
        f"// reponse : le joueur ne peut que deviner. {total} polices jouables sont dans ce cas,",
        f"// reparties en {len(familles)} familles.",
        "//",
        "// LE CAS QUI A FAIT OUVRIR LA CHASSE. Noto Sans JP, KR, SC et TC sont la meme",
        "// police latine avec une ecriture supplementaire, et quatre d'entre elles etaient",
        "// atteignables des le premier pool d'un debutant.",
        "//",
        "// COMMENT LA LISTE EST ETABLIE. Neuf grandeurs mesurees dans les fichiers, six de",
        "// proportion et trois de forme. Deux polices sont jumelles si CHACUNE des",
        "// grandeurs differe de moins d'un pour cent, et une famille n'existe que si",
        "// CHAQUE membre est jumeau de CHAQUE autre. Un groupement de proche en proche",
        "// reunissait Noto Sans et Noto Sans JP, qui different de 49 pour cent en graisse :",
        "// une chaine de ressemblances n'est pas une ressemblance.",
        "//",
        "// CE QUE CA NE FAIT PAS. Aucune police n'est retiree du catalogue. Elles restent",
        "// toutes jouables comme bonne reponse ; c'est seulement leur presence SIMULTANEE",
        "// dans une meme manche qui est empechee. Retirer des polices serait une decision",
        "// de produit, celle ci est une reparation de correction.",
        "",
        "export const TWIN_FAMILIES: readonly (readonly string[])[] = [",
    ]
    for f in familles:
        noms = ", ".join(f["noms"][:3]) + (" ..." if len(f["noms"]) > 3 else "")
        lignes.append(f"  // {len(f['membres'])} polices : {noms}")
        membres = ", ".join(f'"{s}"' for s in f["membres"])
        lignes.append(f"  [{membres}],")
    lignes += [
        "] as const;",
        "",
        "// Index construit une fois : slug vers l'ensemble de ses jumelles, elle comprise.",
        "const TWINS_BY_SLUG = new Map<string, ReadonlySet<string>>();",
        "for (const family of TWIN_FAMILIES) {",
        "  const set = new Set(family);",
        "  for (const slug of family) {",
        "    TWINS_BY_SLUG.set(slug, set);",
        "  }",
        "}",
        "",
        "/** Vrai si les deux polices dessinent le latin a l'identique. Faux pour une police",
        " *  comparee a elle meme : l'appelant filtre deja la bonne reponse separement. */",
        "export const isIndistinguishableFrom = (slug: string, other: string): boolean =>",
        "  slug !== other && (TWINS_BY_SLUG.get(slug)?.has(other) ?? false);",
        "",
        "/** Les jumelles d'une police, elle exclue. Vide si elle n'en a pas. */",
        "export const twinsOf = (slug: string): readonly string[] =>",
        "  [...(TWINS_BY_SLUG.get(slug) ?? [])].filter((other) => other !== slug);",
        "",
    ]
    Path(SORTIE).write_text("\n".join(lignes), encoding="utf-8")
    print(f"{len(familles)} familles, {total} polices, ecrit dans {SORTIE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
