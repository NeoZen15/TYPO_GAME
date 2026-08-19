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
    parser.add_argument(
        "--designers-output",
        default="db/migrations/014_designers_from_metadata.sql",
        help="Migration des designers manquants. Ecrite en plus de celle de rarity_tag.",
    )
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


def echapper_sql(valeur: str) -> str:
    """Échappe les apostrophes pour le SQL en doublant."""
    return valeur.replace("'", "''")


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
    rollbacks = []
    comptes = {"common": 0, "uncommon": 0, "rare": 0}
    comptes_rollback = {"avec_ancienne_valeur": 0, "sans_rarity_tag": 0}
    for slug, rang in sorted(rang_par_slug.items(), key=lambda kv: kv[1]):
        valeur = palier(rang)
        comptes[valeur] += 1
        slug_reel = par_slug[slug]["typeface_slug"]
        slug_sql = echapper_sql(slug_reel)
        updates.append(
            f"UPDATE typefaces_core SET rarity_tag = '{valeur}'::app.rarity_tag_enum, "
            f"updated_at_utc = now() WHERE typeface_slug = '{slug_sql}';"
        )

        # Rollback : relit la valeur actuelle et génère l'UPDATE inverse
        valeur_actuelle = par_slug[slug].get("rarity_tag")
        if valeur_actuelle is not None:
            comptes_rollback["avec_ancienne_valeur"] += 1
            rollbacks.append(
                f"UPDATE typefaces_core SET rarity_tag = '{valeur_actuelle}'::app.rarity_tag_enum, "
                f"updated_at_utc = now() WHERE typeface_slug = '{slug_sql}';"
            )
        else:
            comptes_rollback["sans_rarity_tag"] += 1

    entete = f"""-- ============================================================
-- MIGRATION 013 : rarity_tag depuis le rang de popularite de Google Fonts
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
-- CE QUE CETTE MIGRATION FAIT AU DELA DE CHANGER DES VALEURS. rarity_tag n'est
-- pas une colonne inerte : c'est un predicat dur dans quatre fonctions SQL de
-- db/migrations/012_pool_serialisation.sql (lignes 261, 340, 441 et 532 a 534).
-- init_user_pool ne seme que du common, et try_unlock_one_typeface ouvre le
-- catalogue par niveau Dreyfus : un joueur N ne voit que common, un joueur D
-- voit common et uncommon. Appliquer cette migration ne pose donc pas un critere
-- de tri, ca ferme une porte. Mesures faites avant application :
--   - catalogue atteignable d'un joueur N : de 746 a 213
--   - catalogue atteignable d'un joueur D : de 1154 a 665
--   - catalogue atteignable d'un joueur C, A ou E : 1172, inchange
--   - polices eligibles au pool de depart : de 1148 a 311, les quotas restent
--     tous remplissables
--   - injection easy plus common de l'etape 4 (rebalance_user_pool) : de 296 a 74
-- Rien ne casse et les quotas continuent d'etre servis : ce sont des reservoirs
-- qui retrecissent, pas des reservoirs qui se vident. Mais un joueur N ou D voit
-- reellement moins de polices apres cette migration qu'avant, et c'est le
-- proprietaire qui doit en decider en connaissance de cause.
--
-- PIEGE DE REIMPORT, meme piege documente par db/migrations/010_license_type_ufl.sql.
-- scripts/import_catalog_json.py fait ON CONFLICT (typeface_slug) DO UPDATE SET
-- rarity_tag = EXCLUDED.rarity_tag, et content/catalog/typefaces-core.json porte
-- encore 'common' sur 1148 des 1172 lignes actives. Un reimport du catalogue
-- APRES cette migration ECRASE en silence le classement qu'elle vient de poser,
-- sans erreur, sans avertissement. Tant que le JSON n'a pas ete regenere avec les
-- valeurs issues du rang Google, ne pas relancer l'import du catalogue une fois
-- 013 appliquee.
--
-- REVERSIBLE. Aucune colonne n'est ajoutee ni supprimee, seules des valeurs
-- changent. Pour revenir en arriere, une migration de retour arriere est generee
-- a cote de celle-ci : db/migrations/013_rarity_from_popularity.rollback.sql.

BEGIN;

"""
    corps = "\n".join(updates)
    Path(args.output).write_text(entete + corps + "\n\nCOMMIT;\n", encoding="utf-8")

    # Génère le fichier de rollback
    rollback_path = args.output.replace(".sql", ".rollback.sql")
    entete_rollback = f"""-- ============================================================
-- ROLLBACK 013 : annule la migration rarity_tag
-- Genere par scripts/build_rarity_from_popularity.py le {datetime.now(timezone.utc).date()}
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- ============================================================
--
-- Ce fichier contient les UPDATE inverses de la migration 013. Il remet chaque
-- police a la valeur qu'elle porte AUJOURD'HUI dans content/catalog/typefaces-core.json,
-- celle relue par le script au moment de sa generation. Cette valeur concorde
-- avec la base tant que personne n'a modifie rarity_tag directement en base
-- depuis le dernier import du catalogue : ce fichier ne relit jamais Postgres,
-- donc si une telle edition existe, ce rollback l'ecrase au lieu de la restaurer.
-- {len(rollbacks)} ordres valides pour {len(updates)} polices classees.
-- {comptes_rollback['sans_rarity_tag']} polices n'avaient pas de rarity_tag et ne sont pas listees ici.
--
-- PIEGE DE REIMPORT, meme piege documente par db/migrations/010_license_type_ufl.sql.
-- scripts/import_catalog_json.py fait ON CONFLICT (typeface_slug) DO UPDATE SET
-- rarity_tag = EXCLUDED.rarity_tag. Appliquer ce rollback puis relancer un import
-- du catalogue ne change rien de plus (le JSON et la base concordent deja a ce
-- moment la), mais l'inverse est faux : appliquer 013 puis un import AVANT ce
-- rollback ecraserait le classement sans que ce fichier ait pu servir.

BEGIN;

"""
    corps_rollback = "\n".join(rollbacks)
    Path(rollback_path).write_text(entete_rollback + corps_rollback + "\n\nCOMMIT;\n", encoding="utf-8")

    print(f"{len(updates)} UPDATE ecrits dans {args.output}")
    print(f"  common {comptes['common']}, uncommon {comptes['uncommon']}, rare {comptes['rare']}")
    print(f"  {len(non_apparies)} slugs du catalogue sans rang Google")
    print(f"{len(rollbacks)} UPDATE ecrits dans {rollback_path}")
    print(f"  {comptes_rollback['avec_ancienne_valeur']} avec ancienne valeur")
    print(f"  {comptes_rollback['sans_rarity_tag']} sans rarity_tag (sautees)")
    if non_apparies[:10]:
        print(f"  exemples sans rang : {', '.join(non_apparies[:10])}")

    # Les designers, depuis le meme appel reseau. On ne remplit QUE les vides :
    # ecraser un designer deja saisi effacerait un travail humain par une donnee
    # automatique, et l'instantane de Google n'est pas plus fiable qu'une saisie.
    #
    # designers_par_slug est indexe par le slug REEL du catalogue, jamais par la
    # cle normalisee `slug`. Meme piege que rang_par_slug plus haut : le slug reel
    # se relit dans par_slug pour ne jamais ecrire une cle inventee dans le WHERE.
    # Sans cette relecture, 13 des 23 ordres visaient une cle qui n'existe pas
    # (abrilfatface, bebasneue, dmsans, opensans, playfairdisplay... la ou le
    # catalogue porte abril_fatface, bebas_neue, dm_sans, open_sans,
    # playfair_display) et l'UPDATE ne touchait aucune ligne, sans erreur.
    designers_par_slug: dict[str, str] = {}
    for famille in snapshot["families"]:
        slug = slugifie(famille["family"])
        noms = [n for n in famille.get("designers", []) if n]
        if slug in par_slug and noms and not (par_slug[slug].get("designer") or "").strip():
            slug_reel = echapper_sql(par_slug[slug]["typeface_slug"])
            designers_par_slug[slug_reel] = ", ".join(noms)

    lignes_designers = [
        "UPDATE typefaces_core SET designer = '{}', updated_at_utc = now() "
        "WHERE typeface_slug = '{}' AND (designer IS NULL OR designer = '');".format(
            echapper_sql(nom), slug
        )
        for slug, nom in sorted(designers_par_slug.items())
    ]

    entete_designers = f"""-- ============================================================
-- MIGRATION 014 -- designers manquants, depuis les metadonnees Google Fonts
-- Genere par scripts/build_rarity_from_popularity.py le {datetime.now(timezone.utc).date()}
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- ============================================================
--
-- {len(lignes_designers)} polices actives n'avaient pas de designer.
--
-- LA CLAUSE WHERE EST DOUBLEE, exprès. Le script ne selectionne que les vides, et
-- le SQL le revérifie : entre la generation du fichier et son application,
-- quelqu'un peut avoir saisi un nom a la main, et une donnee automatique ne doit
-- pas ecraser un travail humain.
--
-- foundry et release_year restent vides et ne sont pas traites ici. L'instantane
-- ne les contient pas, et dateAdded est la date d'entree chez Google, pas
-- l'annee de creation de la typographie. Les confondre serait inventer une histoire.
--
-- PIEGE DE REIMPORT, meme piege documente par db/migrations/010_license_type_ufl.sql.
-- scripts/import_catalog_json.py fait ON CONFLICT (typeface_slug) DO UPDATE SET
-- designer = EXCLUDED.designer, et content/catalog/typefaces-core.json garde ces
-- 23 slugs a vide. Un reimport du catalogue APRES cette migration REVIDE en
-- silence les designers qu'elle vient de remplir, sans erreur, sans avertissement.
-- Tant que le JSON n'a pas ete regenere avec ces noms, ne pas relancer l'import
-- du catalogue une fois 014 appliquee.

BEGIN;

"""
    Path(args.designers_output).write_text(
        entete_designers + "\n".join(lignes_designers) + "\n\nCOMMIT;\n", encoding="utf-8"
    )
    print(f"{len(lignes_designers)} designers ecrits dans {args.designers_output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
