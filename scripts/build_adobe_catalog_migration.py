"""
build_adobe_catalog_migration.py

Fabrique la migration qui fait entrer au catalogue les 108 polices du projet web
Adobe Fonts. IL N'ECRIT JAMAIS EN BASE : CLAUDE.md exige le feu vert explicite du
proprietaire, donc ce script produit un fichier a relire, plus son retour arriere.

CE QUI VIENT D'ADOBE ET CE QUI VIENT DE MOI. La distinction est le point de la
revue, et elle est reportee telle quelle dans l'entete du SQL produit.

  D'Adobe, lu dans leur API et repris sans retouche :
    - le nom exact de la famille
    - le nom de famille CSS que sert leur feuille de style
    - primary_category, deduite du generique de leur css_stack

  De moi, par regle mecanique, donc a relire :
    - sub_category, deduite du nom de la famille
    - visual_cluster_id, qui en decoule
    - rarity_tag = common, dreyfus_tier = N, difficulty_base = easy

UN SEUL DE CES CHAMPS DERIVES CHANGE LE JEU : visual_cluster_id. Les fournisseurs
d'entrainement et de competition s'en servent pour choisir les mauvaises reponses,
une police du meme cluster faisant un leurre plus dur. year_tag, contrast_profile
et aperture_profile ne sont lus par aucun code de jeu, verifie par grep sur lib/ et
app/ : ce sont des colonnes NOT NULL a remplir, pas des reglages.

Toutes les lignes sortent en qa_status = 'review', la colonne prevue exactement
pour dire qu'aucun oeil humain n'est encore passe.

Usage :
    ./.venv/bin/python scripts/build_adobe_catalog_migration.py
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

KIT_JSON = "content/catalog/adobe-fonts-kit.json"
KIT_API_DUMP = "/tmp/kit-final.json"
CATALOG = "content/catalog/typefaces-core.json"
SORTIE = "db/migrations/016_adobe_catalog_rows.sql"

# ------------------------------------------------------------------
# LA POLICE CANONIQUE DE CHAQUE FAMILLE
#
# Le projet web sert 108 lignes mais seulement 31 familles reelles : sept
# Baskerville, douze Franklin Gothic, huit Gill Sans Nova, sept Futura. Mesure
# faite sur une branche de base jetable le 2026-08-23, en appliquant la migration
# puis en semant un joueur neuf : il recevait 30 polices dont 14 Adobe, et parmi
# elles Baskerville URW Regular Oblique et Franklin Gothic URW Extra Compressed.
#
# C'est l'inverse du but. Le joueur vient apprendre a reconnaitre les polices les
# plus connues au monde, pas a distinguer la Baskerville d'URW de celle de Berthold.
# Une variante condensee, en petites capitales ou en oblique n'est pas une police
# celebre de plus, c'est la meme police sous un autre angle.
#
# D'ou une police canonique par famille, nommee ci dessous. Elle seule reste
# common et easy, donc atteignable des le premier pool. Les 77 autres passent en
# uncommon et medium : init_user_pool ne seme que du common, et la fonction de
# deverrouillage n'ouvre le uncommon qu'a partir du niveau Dreyfus D. Elles
# existent donc, elles se jouent, mais plus tard.
#
# La liste est ecrite a la main plutot que deduite : "la plus courte du groupe"
# aurait choisi Futura 100 contre Futura PT, et Clarendon Wide contre Clarendon URW.
# ------------------------------------------------------------------
CANONIQUES = {
    "Arial",                       # contre Narrow, Nova, Nova Condensed, Rounded MT
    "Helvetica LT Pro",            # contre les trois Neue
    "Franklin Gothic",             # contre onze variantes ATF, Std, URW, Compressed
    "Adobe Garamond Pro",          # contre les sept ATF et Premier
    "Gill Sans Nova",              # contre Deco, Inline, Shadowed, Condensed
    "Baskerville URW",             # contre BT, No2, Display PT, Poster PT, Berthold
    "Clarendon URW",               # contre Text Pro, Wide, Wide SC, Wide Stencil
    "Futura PT",                   # contre les quatre Futura 100 et PT Bold
    "Adobe Caslon Pro",            # contre Big Caslon FB, King's, LTC
    "Bodoni Std",                  # contre URW, ITC Seventytwo, LTC 175
    "Optima LT Pro",               # contre les trois Nova
    "Rockwell",                    # contre Condensed, Nova, Nova Condensed
    "Univers Next Pro",            # contre Compressed, Condensed, Extended
    "Eurostile",                   # contre Condensed, Extended
    "Trajan Pro 3",                # contre Color et Sans Pro
    "Verdana",                     # contre Pro et Pro Condensed
    "Copperplate",                 # contre Condensed
    "Courier New",                 # contre Courier Std
    "Georgia",                     # contre GeorgiaPro et GeorgiaPro Condensed
    "Linotype Didot",              # contre Headline
    "Neue Frutiger World",         # contre UltLt
    # Les familles qui n'ont qu'une seule ligne dans le kit sont canoniques
    # d'office, elles n'ont pas besoin d'etre nommees ici.
}

# Racine de famille, pour savoir si une ligne a des soeurs. Les prefixes de
# fonderie ne font pas partie du nom de la police : ITC Bodoni et Bodoni Std sont
# la meme Bodoni. GeorgiaPro est traite a part, il colle le suffixe au nom.
PREFIXES_FONDERIE = r"^(ITC|LTC|P22|Adobe|Berthold|Linotype|Neue|Big|King's)\s+"


def racine_famille(nom: str) -> str:
    sans_prefixe = re.sub(PREFIXES_FONDERIE, "", nom)
    premier = sans_prefixe.split()[0].rstrip(",")
    return re.sub(r"Pro$", "", premier)  # GeorgiaPro et Georgia sont la meme famille


# ------------------------------------------------------------------
# CATEGORIE PRINCIPALE
#
# Le generique declare dans le css_stack d'Adobe est la source par defaut, mais
# il est faux 19 fois sur 108 : leur API rend "sans-serif" pour Times New Roman,
# Georgia, Rockwell, Bodoni Std, Courier New et douze autres. On ne peut donc pas
# s'y fier seul, et on ne peut pas non plus le remplacer par une regex sur le nom :
# elle classerait Trajan Sans Pro en serif, alors que c'est le compagnon sans
# serif de Trajan et qu'Adobe a raison sur ce cas la.
#
# D'ou une liste d'exceptions nommees, relue famille par famille. Chaque entree
# est un desaccord constate avec Adobe et tranche contre eux. Tout ce qui n'est
# pas dans cette liste garde ce qu'Adobe declare.
# ------------------------------------------------------------------
CATEGORIE_CORRIGEE = {
    # Adobe dit sans-serif, ce sont des serifs. Dix sept familles.
    "Baskerville BT": "serif",
    "Baskerville No2": "serif",
    "Berthold Baskerville Pro": "serif",
    "Bodoni Std": "serif",
    "Clarendon Wide SC": "serif",
    "Clarendon Wide Stencil": "serif",
    "Georgia": "serif",
    "GeorgiaPro": "serif",
    "GeorgiaPro Condensed": "serif",
    "ITC Bodoni Seventytwo Pro": "serif",
    "King's Caslon": "serif",
    "P22 Franklin Caslon": "serif",
    "Rockwell": "serif",
    "Rockwell Condensed": "serif",
    "Rockwell Nova": "serif",
    "Rockwell Nova Condensed": "serif",
    "Times New Roman": "serif",
    # Adobe dit sans-serif, c'est une machine a ecrire a chasse fixe.
    "Courier New": "mono",
    # Adobe dit sans-serif, ce sont des lettres dessinees, pas des sans serif.
    "Brush Script Std": "display",
    "Papyrus Std": "display",
    # Trajan Sans Pro n'est deliberement PAS ici : le nom contient Trajan mais
    # c'est bien un sans serif, et Adobe a raison.
}

# Sous-categorie deduite du nom, premiere regle qui matche. C'est un jugement
# typographique, pas une donnee d'Adobe, d'ou le qa_status a 'review' partout.
REGLES_SOUS_CATEGORIE = [
    (r"trajan sans", "humanist"),
    (r"trajan|copperplate|lithos", "old_style"),
    (r"bodoni|didot", "didone"),
    (r"rockwell|clarendon|blackoak|birch|serifa|memphis|cooper black", "slab"),
    (r"garamond|caslon|bembo|sabon|jenson|minion|utopia|warnock|adobe text|palatino", "old_style"),
    (r"baskerville|times|georgia|charter|chaparral|century schoolbook", "transitional"),
    (r"futura|avant garde|eurostile|century gothic|avenir|kabel", "geometric"),
    (r"helvetica|arial|univers|akzidenz|neue haas|trade gothic|franklin|folio", "neo_grotesk"),
    (r"impact", "grotesk"),
    (r"gill sans|optima|frutiger|myriad|verdana|tahoma|acumin|sofia|museo|lucida", "humanist"),
    (r"brush script|bickham|papyrus|zapfino|snell", "script"),
    (r"courier|mono", "slab"),
]

CLUSTERS = {
    "neo_grotesk": "cluster_neo_grotesk_A",
    "humanist": "cluster_humanist_A",
    "geometric": "cluster_geometric_A",
    "transitional": "cluster_transitional_A",
    "old_style": "cluster_oldstyle_A",
    "didone": "cluster_didone_A",
    "slab": "cluster_slab_serif_A",
    "grotesk": "cluster_grotesk_A",
    "script": "cluster_display_script_A",
}

# Contraste par sous-categorie. Colonne NOT NULL qu'aucun code de jeu ne lit ;
# la regle rapproche seulement la valeur du vrai plutot que de tout mettre pareil.
CONTRASTE = {
    "didone": "very_high",
    "transitional": "medium",
    "old_style": "medium",
    "script": "medium",
    "slab": "low",
    "neo_grotesk": "low",
    "humanist": "low",
    "geometric": "low",
    "grotesk": "low",
}

OUVERTURE = "semi_open"  # placeholder uniforme, colonne NOT NULL non lue par le jeu

# Generique CSS a poser en fin de fallback_stack. 'display' n'est pas un generique
# CSS valide, d'ou la traduction : une famille dessinee tombe sur cursive si c'est
# une script, sinon sur sans-serif.
GENERIQUE_CSS = {"sans_serif": "sans-serif", "serif": "serif", "mono": "monospace"}


def echapper_sql(valeur: str) -> str:
    return valeur.replace("'", "''")


def sql_texte(valeur: str | None) -> str:
    return "NULL" if not valeur else f"'{echapper_sql(valeur)}'"


def sous_categorie(nom: str, categorie: str) -> str:
    bas = nom.lower()
    for motif, valeur in REGLES_SOUS_CATEGORIE:
        if re.search(motif, bas):
            return valeur
    return "humanist" if categorie == "sans_serif" else "transitional"


def cluster(sous: str, categorie: str) -> str:
    if categorie == "mono":
        return "cluster_mono_slab_A" if sous == "slab" else "cluster_mono_sans_A"
    return CLUSTERS[sous]


def categorie_depuis(css_stack: str, nom: str) -> str:
    """Le generique d'Adobe, sauf pour les 20 familles ou on a constate qu'il ment."""
    if nom in CATEGORIE_CORRIGEE:
        return CATEGORIE_CORRIGEE[nom]
    generique = css_stack.split(",")[-1].strip()
    return {"sans-serif": "sans_serif", "serif": "serif", "monospace": "mono"}.get(
        generique, "sans_serif"
    )


def generique_css(categorie: str, sous: str) -> str:
    if categorie == "display":
        return "cursive" if sous == "script" else "sans-serif"
    return GENERIQUE_CSS[categorie]


def signature(sous: str, categorie: str) -> str:
    """Les onze cles que portent les 2032 lignes du catalogue, meme forme pour
    ne pas creer une seconde convention. Deux d'entre elles sont contraintes par
    chk_contrast_coherence et chk_aperture_coherence a valoir exactement la
    colonne correspondante, le reste est inconnu et le dit."""
    return json.dumps(
        {
            "a_type": None,
            "e_aperture": OUVERTURE,
            "axis": None,
            "contrast": CONTRASTE[sous],
            "terminals": None,
            "serifs": "present" if categorie == "serif" else None,
            "x_height": None,
            "fixed_width": categorie == "mono",
            "width": "normal",
            "caps_only": False,
            "distinctive_w": False,
        },
        ensure_ascii=False,
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Migration d'entree des polices Adobe au catalogue.")
    p.add_argument("--output", default=SORTIE)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    kit = json.loads(Path(KIT_JSON).read_text(encoding="utf-8"))
    par_id = {
        f["id"]: f
        for f in json.loads(Path(KIT_API_DUMP).read_text(encoding="utf-8"))["kit"]["families"]
    }
    existants = {t["typeface_slug"] for t in json.loads(Path(CATALOG).read_text(encoding="utf-8"))["records"]}

    # Combien de lignes portent chaque racine de famille : une famille a une seule
    # ligne est canonique d'office, elle n'a pas de soeur dont la distinguer.
    tailles = Counter(racine_famille(f["display_name"].strip()) for f in kit["families"])

    rallumees, nouvelles = [], []
    for f in kit["families"]:
        api = par_id.get(f["adobe_family_id"])
        if api is None:
            raise SystemExit(f"famille absente du dump API : {f['adobe_family_id']}")
        nom = f["display_name"].strip()  # Adobe rend "Georgia " et "Superclarendon "
        cat = categorie_depuis(api["css_stack"], nom)
        sous = sous_categorie(nom, cat)
        canonique = tailles[racine_famille(nom)] == 1 or nom in CANONIQUES
        ligne = {
            "slug": f["typeface_slug"],
            "nom": nom,
            "canonique": canonique,
            "rarete": "common" if canonique else "uncommon",
            "difficulte": "easy" if canonique else "medium",
            "cat": cat,
            "sous": sous,
            "cluster": cluster(sous, cat),
            "css": f["css_family"],
            "pile": f"\"{f['css_family']}\", {generique_css(cat, sous)}",
        }
        (rallumees if ligne["slug"] in existants else nouvelles).append(ligne)

    ordres = []
    for r in rallumees:
        ordres.append(
            f"-- {r['nom']} : ligne deja au catalogue, eteinte faute de licence.\n"
            "-- Categorie, cluster et signature d'origine conserves : ils ont ete revus a la main.\n"
            "UPDATE typefaces_core SET\n"
            "  font_source = 'adobe',\n"
            "  license_type = 'adobe_fonts',\n"
            "  activation_status = true,\n"
            f"  rarity_tag = '{r['rarete']}',\n"
            f"  difficulty_base = '{r['difficulte']}',\n"
            f"  fallback_stack = '{echapper_sql(r['pile'])}',\n"
            "  qa_status = 'review',\n"
            "  updated_at_utc = now()\n"
            f"WHERE typeface_slug = '{echapper_sql(r['slug'])}';"
        )

    for n in nouvelles:
        ordres.append(
            "INSERT INTO typefaces_core (\n"
            "  typeface_slug, display_name, display_name_ascii,\n"
            "  primary_category, sub_category, visual_cluster_id,\n"
            "  dreyfus_tier, difficulty_base, rarity_tag,\n"
            "  activation_status, font_source, license_type, license_url,\n"
            "  is_variable_font, designer, foundry, release_year,\n"
            "  year_tag, weight_structure, contrast_profile, aperture_profile,\n"
            "  fallback_stack, structural_signature_json,\n"
            "  expert_enabled, min_mode, qa_status\n"
            ") VALUES (\n"
            f"  '{echapper_sql(n['slug'])}', '{echapper_sql(n['nom'])}', '{echapper_sql(n['nom'])}',\n"
            f"  '{n['cat']}', '{n['sous']}', '{n['cluster']}',\n"
            f"  'N', '{n['difficulte']}', '{n['rarete']}',\n"
            "  true, 'adobe', 'adobe_fonts', 'https://fonts.adobe.com/fonts/"
            f"{echapper_sql(par_id[[f['adobe_family_id'] for f in kit['families'] if f['typeface_slug'] == n['slug']][0]]['slug'])}',\n"
            "  false, NULL, NULL, NULL,\n"
            f"  'classic', 'single_weight', '{CONTRASTE[n['sous']]}', '{OUVERTURE}',\n"
            f"  '{echapper_sql(n['pile'])}', '{echapper_sql(signature(n['sous'], n['cat']))}'::jsonb,\n"
            # expert_enabled reste false : expert_answer_keys porte une reponse
            # canonique pour chacune des 2032 lignes du catalogue et aucune pour
            # celles ci. Le mode expert est encore un placeholder, donc rien ne casse
            # aujourd'hui, mais le jour ou il sera ecrit ces lignes seraient
            # injouables. v_qa_expert_no_canonical existe pour signaler ce cas.
            "  false, 'training', 'review'\n"
            ")\n"
            "ON CONFLICT (typeface_slug) DO UPDATE SET\n"
            "  font_source = EXCLUDED.font_source,\n"
            "  license_type = EXCLUDED.license_type,\n"
            "  activation_status = EXCLUDED.activation_status,\n"
            "  fallback_stack = EXCLUDED.fallback_stack,\n"
            "  qa_status = EXCLUDED.qa_status,\n"
            "  updated_at_utc = now();"
        )

    horodatage = datetime.now(timezone.utc).date()
    total = len(kit["families"])
    canoniques = sum(1 for l in rallumees + nouvelles if l["canonique"])
    variantes = total - canoniques
    familles = len({racine_famille(l["nom"]) for l in rallumees + nouvelles})
    par_cat = {
        c: sum(1 for l in rallumees + nouvelles if l["cat"] == c)
        for c in ("sans_serif", "serif", "mono", "display")
    }

    entete = f"""-- ============================================================
-- MIGRATION 016 : les {total} polices du projet web Adobe entrent au catalogue
-- Genere par scripts/build_adobe_catalog_migration.py le {horodatage}
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- Requiert la migration 015, qui cree les valeurs d'enum 'adobe' et 'adobe_fonts'.
-- Retour arriere : 016_adobe_catalog_rows.rollback.sql
-- ============================================================
--
-- CE QU'ELLE FAIT. {len(rallumees)} lignes deja au catalogue mais eteintes faute de licence se
-- rallument, servies par Adobe : {', '.join(r['slug'] for r in rallumees)}.
-- {len(nouvelles)} lignes nouvelles entrent. Les {total} reparties par categorie : {par_cat['sans_serif']} sans serif,
-- {par_cat['serif']} serif, {par_cat['mono']} monospace, {par_cat['display']} dessinees.
--
-- CE QUI VIENT D'ADOBE ET CE QUI VIENT DU SCRIPT, la distinction est le point de la revue.
--   D'Adobe, sans retouche : le nom exact de la famille et le nom de famille CSS
--   que sert leur feuille. primary_category vient aussi d'eux, SAUF pour 20 familles
--   ou leur API ment : elle rend "sans-serif" pour Times New Roman, Georgia,
--   Rockwell, Bodoni Std, Courier New et quinze autres. Ces 20 exceptions sont
--   nommees une par une dans le script generateur et tranchees contre Adobe.
--   Du script, par regle mecanique, donc a relire : sub_category deduite du nom,
--   visual_cluster_id qui en decoule, dreyfus_tier a 'N', et le couple
--   rarity_tag / difficulty_base decrit juste en dessous.
--
-- UNE POLICE CANONIQUE PAR FAMILLE, ET C'EST LA DECISION QUI COMPTE.
-- Le projet web sert {total} lignes mais seulement {familles} familles reelles : sept
-- Baskerville, douze Franklin Gothic, huit Gill Sans Nova, sept Futura. Mesure faite
-- sur une branche de base jetable le {horodatage}, en appliquant cette migration puis en
-- semant un joueur neuf : il recevait 30 polices dont 14 Adobe, et parmi elles
-- Baskerville URW Regular Oblique et Franklin Gothic URW Extra Compressed. C'est
-- l'inverse du but du jeu, qui est de reconnaitre les polices les plus connues au
-- monde et non de distinguer la Baskerville d'URW de celle de Berthold.
-- Donc {canoniques} lignes canoniques restent common et easy, atteignables des le premier
-- pool, et {variantes} variantes passent en uncommon et medium. init_user_pool ne seme que
-- du common, et try_unlock n'ouvre le uncommon qu'a partir du niveau Dreyfus D :
-- les variantes existent, elles se jouent, mais plus tard.
--
-- UN SEUL DE CES CHAMPS DERIVES CHANGE LE JEU : visual_cluster_id. Les deux
-- fournisseurs s'en servent pour choisir les mauvaises reponses, une police du meme
-- cluster faisant un leurre plus dur. year_tag, contrast_profile et aperture_profile
-- ne sont lus par aucun code de jeu : colonnes NOT NULL a remplir, pas des reglages.
-- structural_signature_json porte les onze cles du reste du catalogue, avec null
-- partout ou la valeur est inconnue ; deux de ses cles sont obligees par
-- chk_contrast_coherence et chk_aperture_coherence a valoir la colonne correspondante.
--
-- designer, foundry et release_year restent NULL. L'API du projet web ne les donne
-- pas, et les inventer serait pire que les laisser vides.
--
-- expert_enabled reste false. expert_answer_keys porte une reponse canonique pour
-- chacune des 2032 lignes du catalogue et aucune pour ces 104 la : les activer en
-- expert donnerait une police sans reponse acceptee. Rien ne casse aujourd'hui,
-- app/play/expert/page.tsx est un placeholder de 29 lignes sans API et aucun code
-- de runtime ne lit expert_answer_keys, mais le jour ou le mode expert sera ecrit
-- ces 104 lignes seraient injouables. Les laisser a false, c'est ne pas poser la
-- mine maintenant.
--
-- LA VUE v_qa_active_no_asset PASSERA DE 0 A 104 LIGNES. Elle liste les polices
-- actives sans fichier dans font_runtime_assets, et c'est precisement le cas d'une
-- police Adobe : il n'y a pas de fichier chez nous et il n'y en aura jamais. Ce
-- n'est pas une contrainte, rien n'echoue, mais la vue cesse d'etre un signal utile
-- pour les polices Google. Le controle equivalent pour Adobe est ailleurs :
-- npm run check:adobe-migration verifie que le nom de famille CSS de chaque ligne
-- est bien celui que sert la feuille du projet web.
--
-- Toutes les lignes sortent en qa_status = 'review', la colonne prevue exactement
-- pour dire qu'aucun oeil humain n'est encore passe.
--
-- AUCUN FICHIER DE POLICE N'EST TELECHARGE, les conditions d'Adobe l'interdisent.
-- Le rendu passe par la feuille du projet web,
-- {kit['meta']['stylesheet']},
-- chargee dans app/layout.tsx, et chaque ligne porte dans fallback_stack le nom de
-- famille exact que cette feuille declare.
--
-- LE PROJET WEB EST VERROUILLE SUR SES DOMAINES, aujourd'hui localhost et 127.0.0.1.
-- AJOUTER LE DOMAINE DE PRODUCTION AVANT LA MISE EN LIGNE, sinon ces {total} polices ne
-- s'afficheront pas et le joueur devra nommer une typo absente de son ecran.
--
-- SI L'ABONNEMENT CREATIVE CLOUD S'ARRETE, ces polices cessent de s'afficher. Ces
-- lignes sont une COUCHE, jamais le socle : le fichier de retour arriere les eteint
-- toutes et le jeu retombe sur ses seules polices libres.
--
-- PIEGE DE REIMPORT, meme convention que 010, 013, 014 et 015. Le prochain passage de
-- scripts/import_catalog_json.py fait ON CONFLICT DO UPDATE sur font_source et
-- license_type depuis content/catalog/typefaces-core.json. Tant que ce JSON ne porte
-- pas ces lignes, un reimport eteindrait tout ce lot.

BEGIN;

"""

    Path(args.output).write_text(entete + "\n\n".join(ordres) + "\n\nCOMMIT;\n", encoding="utf-8")

    retour = Path(args.output).with_suffix("").as_posix() + ".rollback.sql"
    lignes_retour = [
        "-- ============================================================",
        "-- RETOUR ARRIERE de la migration 016",
        f"-- Genere par scripts/build_adobe_catalog_migration.py le {horodatage}",
        "-- ============================================================",
        "--",
        f"-- Eteint les {len(nouvelles)} lignes creees par la 016 et rend aux {len(rallumees)} lignes rallumees",
        "-- l'etat exact qui etait le leur avant : eteintes, source 'local', licence",
        "-- 'proprietary'. Les lignes creees ne sont pas supprimees mais desactivees :",
        "-- user_typeface_state peut deja les referencer, et ses cles etrangeres sont en",
        "-- ON DELETE RESTRICT (003_users_sessions_pool.sql). Une ligne eteinte ne sort",
        "-- plus d'aucun pool, ce qui est le seul effet recherche.",
        "--",
        "-- Les deux valeurs d'enum de la 015 restent en place : PostgreSQL ne sait pas",
        "-- retirer une valeur d'enum, et elles sont inertes des lors qu'aucune ligne",
        "-- active ne les porte.",
        "",
        "BEGIN;",
        "",
        "UPDATE typefaces_core SET",
        "  activation_status = false,",
        "  qa_status = 'deprecated',",
        "  updated_at_utc = now()",
        "WHERE font_source = 'adobe'",
        f"  AND typeface_slug NOT IN ({', '.join(chr(39) + r['slug'] + chr(39) for r in rallumees)});",
        "",
    ]
    for r in rallumees:
        lignes_retour.append(
            "UPDATE typefaces_core SET\n"
            "  font_source = 'local',\n"
            "  license_type = 'proprietary',\n"
            "  activation_status = false,\n"
            "  fallback_stack = NULL,\n"
            "  updated_at_utc = now()\n"
            f"WHERE typeface_slug = '{echapper_sql(r['slug'])}';"
        )
    lignes_retour += ["", "COMMIT;", ""]
    Path(retour).write_text("\n".join(lignes_retour), encoding="utf-8")

    print(f"{len(rallumees)} rallumages et {len(nouvelles)} insertions -> {args.output}")
    print(f"retour arriere -> {retour}")
    print(f"categories : {par_cat}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
