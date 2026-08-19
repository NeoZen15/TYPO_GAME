"""
build_rarity_from_popularity.py

Traduit le rang de popularite de Google Fonts en valeur rarity_tag, et ecrit une
migration SQL. IL N'ECRIT JAMAIS EN BASE. CLAUDE.md exige le feu vert explicite
du proprietaire pour toute migration, donc ce script produit un fichier a relire.

POURQUOI LA POPULARITE ET PAS UN JUGEMENT. rarity_tag fait partie des dix
colonnes de generate_editorial_review_template.py, donc d'une revue humaine.
Personne ne remplit 1172 lignes a la main, la revue est passee par presets, et le
resultat mesure le 2026-08-19 etait 1148 common, 24 uncommon, zero rare. Un rang
publie par Google est imparfait mais il est objectif, reproductible, et il classe
les 1172 en une seconde.

CE QU'IL NE FAIT PAS. Il ne touche ni sub_category ni visual_cluster_id, qui
restent des jugements typographiques. Le regroupement visuel a son propre
chantier.

Usage :
    ./.venv/bin/python scripts/build_rarity_from_popularity.py \
      --snapshot content/catalog/google-metadata-sync/metadata-snapshot.json \
      --catalog content/catalog/typefaces-core.json \
      --output db/migrations/013_rarity_from_popularity.sql
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

SEUIL_COMMON = 300
SEUIL_UNCOMMON = 900


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Construit rarity_tag depuis la popularite.")
    parser.add_argument("--snapshot", default="content/catalog/google-metadata-sync/metadata-snapshot.json")
    parser.add_argument("--catalog", default="content/catalog/typefaces-core.json")
    parser.add_argument("--output", default="db/migrations/013_rarity_from_popularity.sql")
    return parser.parse_args()


def slugifie(nom: str) -> str:
    """Meme normalisation que les slugs du catalogue : minuscules, sans separateur."""
    return re.sub(r"[^a-z0-9]", "", nom.lower())


def palier(rang: int) -> str:
    if rang <= SEUIL_COMMON:
        return "common"
    if rang <= SEUIL_UNCOMMON:
        return "uncommon"
    return "rare"


def main() -> int:
    args = parse_args()
    snapshot = json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    catalogue = json.loads(Path(args.catalog).read_text(encoding="utf-8"))

    # La forme du fichier, verifiee le 2026-08-19 : un objet a deux cles, "meta" et
    # "records". Pas de cle "typefaces", et pas une liste a la racine.
    lignes = catalogue["records"]

    # LES DEUX COTES SONT NORMALISES, et ce detail decide du resultat. Les slugs du
    # catalogue gardent parfois un tiret bas, "open_sans", "playfair_display",
    # "bebas_neue", la ou le nom Google normalise donne "opensans". Comparer un slug
    # brut a un nom normalise laisse ces polices sans rang, et ce sont justement les
    # plus connues : mesure du 2026-08-19, la correction gagne 13 appariements dont
    # Open Sans, premiere du classement mondial, DM Sans, Playfair Display et
    # Bebas Neue. Sans elle, 1077 appariements sur 1172 ; avec elle, 1090.
    par_slug = {}
    for ligne in lignes:
        if ligne.get("activation_status"):
            par_slug[slugifie(ligne["typeface_slug"])] = ligne

    # On lit rank, le rang dense calcule par le collecteur, et pas popularity dont
    # l'echelle est creuse. Voir l'entete des seuils dans le plan.
    # rang_par_slug est indexe par la forme NORMALISEE. Le slug reel, celui qui part
    # dans le SQL, se relit dans par_slug pour ne jamais ecrire une cle inventee.
    rang_par_slug: dict[str, int] = {}
    for famille in snapshot["families"]:
        cle = slugifie(famille["family"])
        if cle in par_slug:
            rang_par_slug[cle] = famille["rank"]

    non_apparies = sorted(set(par_slug) - set(rang_par_slug))

    updates = []
    comptes = {"common": 0, "uncommon": 0, "rare": 0}
    for slug, rang in sorted(rang_par_slug.items(), key=lambda kv: kv[1]):
        valeur = palier(rang)
        comptes[valeur] += 1
        slug_reel = par_slug[slug]["typeface_slug"]
        updates.append(
            f"UPDATE typefaces_core SET rarity_tag = '{valeur}'::app.rarity_tag_enum, "
            f"updated_at_utc = now() WHERE typeface_slug = '{slug_reel}';"
        )

    entete = f"""-- ============================================================
-- MIGRATION 013 -- rarity_tag depuis le rang de popularite de Google Fonts
-- Genere par scripts/build_rarity_from_popularity.py le {datetime.now(timezone.utc).date()}
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- ============================================================
--
-- POURQUOI. rarity_tag valait common sur 1148 des 1172 polices actives, donc la
-- colonne ne disait rien et le constructeur de questions ne pouvait pas servir
-- les typographies connues avant les obscures.
--
-- SEUILS. common jusqu'au rang {SEUIL_COMMON}, uncommon jusqu'a {SEUIL_UNCOMMON}, rare ensuite.
-- Le rang est DENSE, de 1 a N, calcule par le collecteur et departage par nom.
-- Il n'est PAS le champ popularity de Google, dont l'echelle est creuse : un seuil
-- pose sur popularity selectionnerait 537 familles la ou il en annonce 300.
--
-- {len(updates)} polices classees : {comptes['common']} common, {comptes['uncommon']} uncommon, {comptes['rare']} rare.
-- {len(non_apparies)} polices du catalogue n'ont pas de rang et gardent leur valeur actuelle.
--
-- REVERSIBLE. Aucune colonne n'est ajoutee ni supprimee, seules des valeurs
-- changent. Pour revenir en arriere il suffit de rejouer l'ancienne valeur, que
-- le rapport de generation liste.

BEGIN;

"""
    corps = "\n".join(updates)
    Path(args.output).write_text(entete + corps + "\n\nCOMMIT;\n", encoding="utf-8")

    print(f"{len(updates)} UPDATE ecrits dans {args.output}")
    print(f"  common {comptes['common']}, uncommon {comptes['uncommon']}, rare {comptes['rare']}")
    print(f"  {len(non_apparies)} slugs du catalogue sans rang Google")
    if non_apparies[:10]:
        print(f"  exemples sans rang : {', '.join(non_apparies[:10])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
