"""
build_017_tail_rarity.py

Ecrit db/migrations/017_tail_rarity.sql et met content/catalog/typefaces-core.json
en miroir dans le meme geste, pour que les deux ne puissent pas diverger.

CE QU'ELLE REPARE. La migration 013 classe 1090 polices d'apres le classement de
popularite de Google. Elle en laisse 88 de cote, tout simplement parce que Google
ne les classe pas : Batang, Gulim et Dotum, les polices coreennes d'un autre age,
les variantes UI de Noto, les betas de polices variables en vfbeta, les fontes
mathematiques de jsMath, Noto Color Emoji. Faute d'ordre, elles ont garde la
rarete par defaut, common, et se retrouvaient donc dans la portee du debutant au
meme titre qu'Helvetica.

L'absence du classement de popularite est en elle meme le signal : une police que
Google ne range nulle part n'est pas une police que le grand public sait nommer.
Elles passent donc en rare. Elles restent jouables, mais au dernier palier.

ET UNE LIGNE S'ETEINT. Adobe Blank porte les 52 lettres latines et n'en dessine
aucune : l'avance de chaque glyphe vaut zero, mesure faite avec fontkit. Une
manche l'aurait affichee comme un mot vide en demandant au joueur de la nommer.
Ce n'est pas une police a reconnaitre, c'est un outil de typographe. Elle sort du
jeu et le garde check:latin-coverage empeche desormais son retour.

NON APPLIQUEE. Elle demande le feu vert du proprietaire, comme toute migration.
    node scripts/apply_017_tail_rarity.mjs --dry-run
    node scripts/apply_017_tail_rarity.mjs

Usage :
    ./.venv/bin/python scripts/build_017_tail_rarity.py
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

CATALOGUE = "content/catalog/typefaces-core.json"
MIGRATION_013 = "db/migrations/013_rarity_from_popularity.sql"
SORTIE = "db/migrations/017_tail_rarity.sql"
RETOUR = "db/migrations/017_tail_rarity.rollback.sql"
SANS_ENCRE = "adobeblank"


def main() -> int:
    vises_013 = {
        m for m in re.findall(
            r"WHERE typeface_slug = '([^']+)';",
            Path(MIGRATION_013).read_text(encoding="utf-8"))
    }
    catalogue = json.loads(Path(CATALOGUE).read_text(encoding="utf-8"))

    queue = [
        r for r in catalogue["records"]
        if r["rarity_tag"] == "common"
        and r["font_source"] != "adobe"
        and r["typeface_slug"] not in vises_013
        and r["typeface_slug"] != SANS_ENCRE
    ]
    slugs = sorted(r["typeface_slug"] for r in queue)
    if not slugs:
        print("rien a faire, la queue est deja classee")
        return 0

    liste = ", ".join("'" + s.replace("'", "''") + "'" for s in slugs)
    horodatage = datetime.now(timezone.utc).date()
    exemples = ", ".join(sorted(r["display_name"] for r in queue)[:8])

    entete = f"""-- ============================================================
-- MIGRATION 017 : la queue du catalogue, que la 013 n'a pas pu classer
-- Genere par scripts/build_017_tail_rarity.py le {horodatage}
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- Requiert la migration 013.
-- Retour arriere : 017_tail_rarity.rollback.sql
-- ============================================================
--
-- CE QU'ELLE REPARE. La 013 classe 1090 polices d'apres le classement de popularite
-- de Google. Elle en laisse {len(slugs)} de cote, parce que Google ne les classe pas :
-- {exemples}
-- et les autres. Faute d'ordre, elles avaient garde la rarete par defaut, common, et
-- se retrouvaient dans la portee du debutant au meme titre qu'Helvetica.
--
-- L'absence du classement est en elle meme le signal. Une police que Google ne range
-- nulle part n'est pas une police que le grand public sait nommer. Elles passent donc
-- en rare, restent jouables, mais au dernier palier.
--
-- ET UNE LIGNE S'ETEINT. Adobe Blank porte les 52 lettres latines et n'en dessine
-- aucune : l'avance de chaque glyphe vaut zero, mesure avec fontkit. Une manche
-- l'aurait affichee comme un mot vide en demandant au joueur de la nommer. Ce n'est
-- pas une police a reconnaitre, c'est un outil de typographe. Le garde
-- check:latin-coverage teste desormais l'encre et empeche son retour.
--
-- PIEGE DE REIMPORT. content/catalog/typefaces-core.json a ete mis en miroir dans le
-- meme commit par scripts/build_017_tail_rarity.py, donc un reimport ne defera rien.

BEGIN;

UPDATE typefaces_core SET
  rarity_tag = 'rare'::app.rarity_tag_enum,
  updated_at_utc = now()
WHERE typeface_slug = ANY(ARRAY[{liste}]);

UPDATE typefaces_core SET
  activation_status = false,
  updated_at_utc = now()
WHERE typeface_slug = '{SANS_ENCRE}';

COMMIT;
"""
    Path(SORTIE).write_text(entete, encoding="utf-8")

    anciennes = {r["typeface_slug"]: r["rarity_tag"] for r in queue}
    retour = [
        "-- ============================================================",
        "-- RETOUR ARRIERE de la migration 017",
        f"-- Genere par scripts/build_017_tail_rarity.py le {horodatage}",
        "-- ============================================================",
        "--",
        f"-- Rend leur rarete d'origine aux {len(slugs)} lignes de la queue, et rallume Adobe Blank.",
        "-- Rallumer Adobe Blank remet dans le jeu une police qui n'affiche rien : ce",
        "-- fichier existe pour la symetrie, pas parce que ce retour est souhaitable.",
        "",
        "BEGIN;",
        "",
        f"UPDATE typefaces_core SET rarity_tag = 'common'::app.rarity_tag_enum, updated_at_utc = now()",
        f"WHERE typeface_slug = ANY(ARRAY[{liste}]);",
        "",
        f"UPDATE typefaces_core SET activation_status = true, updated_at_utc = now()",
        f"WHERE typeface_slug = '{SANS_ENCRE}';",
        "",
        "COMMIT;",
        "",
    ]
    Path(RETOUR).write_text("\n".join(retour), encoding="utf-8")

    for r in queue:
        r["rarity_tag"] = "rare"
        notes = r.setdefault("notes", [])
        note = "rarete rare : absente du classement de popularite de Google, migration 017"
        if note not in notes:
            notes.append(note)
    Path(CATALOGUE).write_text(
        json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    compte: dict[str, int] = {}
    portee = 0
    for r in catalogue["records"]:
        compte[r["rarity_tag"]] = compte.get(r["rarity_tag"], 0) + 1
        if r["activation_status"] and r["rarity_tag"] == "common" and r["dreyfus_tier"] in ("N", "D"):
            portee += 1
    print(f"{len(slugs)} lignes passent en rare, plus Adobe Blank eteinte")
    print(f"JSON mis en miroir : {compte}")
    print(f"portee du debutant dans le JSON : {portee}")
    print(f"ecrits : {SORTIE} et {RETOUR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
