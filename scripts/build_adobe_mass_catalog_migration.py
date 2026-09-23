"""
build_adobe_mass_catalog_migration.py

Fabrique la migration qui fait entrer au catalogue les familles Adobe de la
premiere vague de masse, celles ajoutees au projet web le 2026-09-11. Il N'ECRIT
JAMAIS EN BASE : CLAUDE.md exige le feu vert explicite du proprietaire, donc ce
script produit un fichier a relire, plus son retour arriere.

CE QU'IL A DE DIFFERENT DE build_adobe_catalog_migration.py, QUI A FAIT LA 016.
Celui la traitait 108 familles, avec une liste de canoniques ecrite a la main et
une liste d'exceptions de categorie relue famille par famille. Ici il y a plus de
trois mille familles : aucune liste a la main ne tient, et une regle inventee
serait crue par le jeu. Donc le parti pris est l'inverse :

  - la categorie vient de la CLASSIFICATION D'ADOBE, pas du generique css_stack.
    C'est la donnee que leur API remplit vraiment, et la selection ne garde que
    les familles pour lesquelles elle est presente.
  - la sous categorie vient d'abord des regles de nom de la 016, qui portent les
    noms celebres, et a defaut de la classification d'Adobe.
  - TOUTES ces lignes partent en rare, hard, qa_status review. Elles ne sont pas
    des polices que le grand public sait nommer, et aucun oeil humain ne les a
    relues. Le debutant ne les verra pas : init_user_pool ne seme que du common.

LE POINT DE REVUE, ET IL EST REEL. `app.sub_category_enum` porte neuf valeurs et
aucune ne dit "dessinee". Les familles qu'Adobe classe en decorative, handmade ou
blackletter n'ont donc pas de case honnete. D'ou DEUX fichiers produits : la 024
ajoute la valeur 'display' a l'enum, la 025 pose les lignes. PostgreSQL interdit
d'utiliser une valeur d'enum neuve dans la transaction qui l'ajoute, c'est la meme
raison qui a separe la 015 de la 016.

Usage :
    python3 scripts/build_adobe_mass_catalog_migration.py \
        --selection /tmp/vague1.json --brouillon /tmp/kit-brouillon.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

CATALOG = "content/catalog/typefaces-core.json"
KIT_HISTORIQUE = "content/catalog/adobe-fonts-kit.json"
SORTIE = "db/migrations/025_adobe_mass_catalog.sql"
ROLLBACK = "db/migrations/025_adobe_mass_catalog.rollback.sql"

# Les regles de nom de la 016, reprises telles quelles pour que deux migrations ne
# rangent pas la meme police a deux endroits. Premiere regle qui matche.
REGLES_SOUS_CATEGORIE = [
    (r"trajan sans", "humanist"),
    (r"trajan|copperplate|lithos", "old_style"),
    (r"bodoni|didot|didone", "didone"),
    (r"rockwell|clarendon|blackoak|birch|serifa|memphis|cooper black", "slab"),
    (r"garamond|caslon|bembo|sabon|jenson|minion|utopia|warnock|adobe text|palatino", "old_style"),
    (r"baskerville|times|georgia|charter|chaparral|century schoolbook", "transitional"),
    (r"futura|avant garde|eurostile|century gothic|avenir|kabel", "geometric"),
    (r"helvetica|arial|univers|akzidenz|neue haas|trade gothic|franklin|folio", "neo_grotesk"),
    (r"impact", "grotesk"),
    (r"gill sans|optima|frutiger|myriad|verdana|tahoma|acumin|sofia|museo|lucida", "humanist"),
    (r"brush script|bickham|papyrus|zapfino|snell", "script"),
]

# A defaut de nom reconnu, la classification d'Adobe decide. 'grotesk' plutot que
# 'neo_grotesk' pour un sans inconnu : neo_grotesk est une affirmation historique
# precise, grotesk ne dit que "c'est un sans", ce qui est tout ce qu'on sait.
DEPUIS_ADOBE = {
    "sans-serif": ("sans_serif", "grotesk"),
    "serif": ("serif", "transitional"),
    "slab-serif": ("serif", "slab"),
    "monospaced": ("mono", "slab"),
    "script": ("display", "script"),
    "handmade": ("display", "script"),
    "blackletter": ("display", "display"),
    "decorative": ("display", "display"),
}

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
    "display": "cluster_display_drawn_A",
}

CONTRASTE = {
    "didone": "very_high",
    "transitional": "medium",
    "old_style": "medium",
    "script": "medium",
    "display": "medium",
    "slab": "low",
    "neo_grotesk": "low",
    "humanist": "low",
    "geometric": "low",
    "grotesk": "low",
}

OUVERTURE = "semi_open"
GENERIQUE_CSS = {"sans_serif": "sans-serif", "serif": "serif", "mono": "monospace"}


def echapper_sql(v: str) -> str:
    return v.replace("'", "''")


def slug_catalogue(nom: str) -> str:
    """Meme forme que les 108 lignes de la 016 : minuscules, tout le reste en _."""
    s = re.sub(r"[^a-z0-9]+", "_", nom.lower()).strip("_")
    return re.sub(r"_+", "_", s)


def sous_categorie(nom: str, classification: str) -> tuple[str, str, bool]:
    """Rend (categorie, sous categorie, le nom a-t-il decide)."""
    bas = nom.lower()
    for motif, valeur in REGLES_SOUS_CATEGORIE:
        if re.search(motif, bas):
            cat = DEPUIS_ADOBE.get(classification, ("sans_serif", "grotesk"))[0]
            return cat, valeur, True
    cat, sous = DEPUIS_ADOBE.get(classification, ("sans_serif", "grotesk"))
    return cat, sous, False


def generique_css(cat: str, sous: str) -> str:
    if cat == "display":
        return "cursive" if sous == "script" else "sans-serif"
    return GENERIQUE_CSS[cat]


def signature(sous: str, cat: str) -> str:
    return json.dumps(
        {
            "a_type": None,
            "e_aperture": OUVERTURE,
            "axis": None,
            "contrast": CONTRASTE[sous],
            "terminals": None,
            "serifs": "present" if cat == "serif" else None,
            "x_height": None,
            "fixed_width": cat == "mono",
            "width": "normal",
            "caps_only": False,
            "distinctive_w": False,
        },
        ensure_ascii=False,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--selection", required=True, type=Path)
    ap.add_argument("--brouillon", type=Path,
                    help="dump d'un seul kit, il porte les noms de famille CSS")
    ap.add_argument("--noms", type=Path,
                    help="releve de adobe_kits_shard.py --noms : noms CSS par famille "
                         "et liste de ce qui est reellement servi. A preferer.")
    ap.add_argument("--sortie", default=SORTIE)
    args = ap.parse_args()

    if not args.noms and not args.brouillon:
        sys.exit("donne --noms (releve des projets) ou --brouillon (un seul kit)")
    voulues = json.loads(args.selection.read_text(encoding="utf-8"))["familles"]
    if args.noms:
        # LA SOURCE JUSTE DES NOMS CSS, ET DE CE QUI EST SERVI.
        #
        # Deux mesures du 2026-09-15 imposent ce chemin. D'abord, chaque projet web
        # nomme les familles a sa facon : le projet historique declare
        # `lust-didone`, les projets de masse declarent `lust-didone-1`. La pile de
        # repli doit nommer EXACTEMENT ce que la feuille declare, sinon le
        # navigateur peint une police de repli et le jeu demande de nommer un dessin
        # qui n'est pas celui de la question. Ensuite, un projet peut porter des
        # familles qu'il ne sert pas : la publication est asynchrone et plafonnee,
        # `fbq4jus` porte 500 familles et n'en sert que 250. Seules les familles
        # presentes dans la feuille publiee entrent au catalogue.
        donnees = json.loads(args.noms.read_text(encoding="utf-8"))
        css_par_id = donnees["noms_css_par_famille"]
        servis = set(donnees["noms_css_servis"])
        css_par_id = {i: c for i, c in css_par_id.items() if c in servis}
        print(f"noms CSS servis retenus   {len(css_par_id)}")
    else:
        brut = json.loads(args.brouillon.read_text(encoding="utf-8"))
        brouillon = (brut.get("kit") or brut)["families"]  # l'API enveloppe, pas les dumps
        # LES NOMS CSS NE SE DEDUISENT PAS DU SLUG, mesure du 2026-09-12 :
        # "Franklin Gothic URW Extra Compressed" a pour nom CSS
        # "franklin-gothic-ext-comp-urw", qui n'est pas une troncature de son slug
        # "franklin-gothic-urw-extra-compressed". Adobe les nomme a la main, sous 28
        # signes. Ils ne peuvent donc venir que du kit lui meme.
        css_par_id = {}
        for f in brouillon:
            noms = f.get("css_names") or []
            if noms:
                css_par_id[f["id"]] = noms[0]

    catalogue = json.loads(Path(CATALOG).read_text(encoding="utf-8"))["records"]
    existants = {t["typeface_slug"] for t in catalogue}
    # LA COMPARAISON DE SLUG NE SUFFIT PAS, mesure du 2026-09-14. Adobe heberge
    # aussi des polices libres que nous servons deja depuis nos propres fichiers :
    # Alegreya, Oswald, Bitter, Lora, Fira Sans, Nunito Sans, IBM Plex, Source Code
    # Pro. Le catalogue les nomme 'sourcesans3', Adobe les nomme 'Source Sans 3' :
    # une comparaison de slug n'en voyait que 24, une comparaison sur la cle
    # normalisee en voit 176. Sans ce filtre le jeu contiendrait deux fois le meme
    # dessin, servi de deux endroits, avec deux reponses attendues differentes.
    def cle(v: str) -> str:
        return re.sub(r"[^a-z0-9]", "", v.lower())

    cles_existantes = {cle(t["typeface_slug"]) for t in catalogue}
    cles_existantes |= {cle(t["display_name"]) for t in catalogue}
    historiques = {
        f["adobe_family_id"]
        for f in json.loads(Path(KIT_HISTORIQUE).read_text(encoding="utf-8"))["families"]
    }

    lignes, sans_css, collisions, deja = [], [], [], []
    vus: set[str] = set()
    for f in voulues:
        fid = f["adobe_family_id"]
        if fid in historiques:
            deja.append(f["display_name"])
            continue
        css = css_par_id.get(fid)
        if not css:
            sans_css.append(f["display_name"])
            continue
        nom = (f["display_name"] or "").strip()
        slug = slug_catalogue(nom)
        if slug in existants or slug in vus or cle(nom) in cles_existantes:
            collisions.append((nom, slug))
            continue
        vus.add(slug)
        cles_existantes.add(cle(nom))
        cat, sous, par_le_nom = sous_categorie(nom, f["classification_adobe"] or "")
        lignes.append(
            {
                "slug": slug,
                "nom": nom,
                "cat": cat,
                "sous": sous,
                "par_le_nom": par_le_nom,
                "cluster": CLUSTERS[sous],
                "css": css,
                "pile": f'"{css}", {generique_css(cat, sous)}',
                "url": f"https://fonts.adobe.com/fonts/{f['slug']}" if f.get("slug") else None,
            }
        )

    if not lignes:
        print("rien a ecrire", file=sys.stderr)
        return 1

    horodatage = datetime.now(timezone.utc).date()
    par_cat = Counter(l["cat"] for l in lignes)
    par_sous = Counter(l["sous"] for l in lignes)
    nommees = sum(1 for l in lignes if l["par_le_nom"])
    besoin_display = any(l["sous"] == "display" for l in lignes)

    entete = f"""-- ============================================================
-- MIGRATION 025 : {len(lignes)} familles Adobe de plus au catalogue
-- Genere par scripts/build_adobe_mass_catalog_migration.py le {horodatage}
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- Requiert les migrations 015, 016 et 024, qui ajoute la sous categorie display.
-- Retour arriere : 025_adobe_mass_catalog.rollback.sql
-- ============================================================
--
-- NE PAS L'APPLIQUER AVANT QUE LES FEUILLES ADOBE SERVENT CES FAMILLES. Une ligne
-- active dont la police n'est pas servie fait afficher au joueur un dessin de repli
-- en lui demandant de le nommer, exactement ce que ce produit ne peut pas se
-- permettre. Au {horodatage} le brouillon du projet web porte 3 492 familles mais la
-- feuille publiee en sert 108, la publication repondant 504 au dela d'un certain
-- volume. Cette migration attend le decoupage en plusieurs projets web.
--
-- CE QUI VIENT D'ADOBE ET CE QUI VIENT DU SCRIPT.
--   D'Adobe, sans retouche : le nom exact de la famille, le nom de famille CSS que
--   sert leur feuille, et la classification, qui donne primary_category. La
--   selection n'a garde que les familles dont Adobe remplit la classification,
--   justement pour ne pas avoir a l'inventer.
--   Du script, par regle mecanique, donc a relire : sub_category, deduite du nom
--   pour {nommees} familles que les regles de la 016 reconnaissent et de la
--   classification d'Adobe pour les autres, visual_cluster_id qui en decoule,
--   dreyfus_tier a 'N', contrast_profile par sous categorie.
--
-- TOUTES EN RARE ET EN HARD, ET C'EST LE POINT IMPORTANT. Ce ne sont pas des
-- polices que le grand public sait nommer. init_user_pool ne seme que du common,
-- donc aucune n'entrera dans le premier pool d'un joueur. Elles se jouent, mais au
-- dernier palier. qa_status vaut 'review' partout : aucun oeil humain n'a relu ces
-- {len(lignes)} lignes, et le dire est plus utile que de faire semblant.
--
-- REPARTITION : {par_cat['sans_serif']} sans serif, {par_cat['serif']} serif, {par_cat['mono']} monospace, {par_cat['display']} dessinees.
-- Par sous categorie : {', '.join(f'{k} {v}' for k, v in par_sous.most_common())}.
--
-- PIEGE DE REIMPORT, le meme que pour la 016. content/catalog/typefaces-core.json
-- doit etre mis en miroir apres application, sinon un passage de
-- scripts/import_catalog_json.py rebasculerait ces lignes en 'local' et
-- 'proprietary', donc eteintes, sans erreur et sans bruit.

BEGIN;
"""

    if besoin_display:
        # DEUX FICHIERS, ET CE N'EST PAS UN CHOIX DE STYLE. PostgreSQL accepte
        # ALTER TYPE ADD VALUE dans une transaction, mais INTERDIT d'utiliser la
        # valeur neuve avant que cette transaction soit validee. Une migration qui
        # ajoute 'display' puis insere des lignes 'display' echoue donc en bloc.
        # C'est exactement pour cela que la 015 et la 016 sont deux migrations et
        # pas une : meme contrainte, meme decoupage.
        enum_fichier = Path("db/migrations/024_sub_category_display.sql")
        enum_fichier.write_text(
            f"""-- ============================================================
-- MIGRATION 024 : une case honnete pour les polices dessinees
-- Genere par scripts/build_adobe_mass_catalog_migration.py le {horodatage}
-- NON APPLIQUEE. Elle demande le feu vert explicite du proprietaire.
-- A appliquer AVANT la 025, et dans sa propre transaction.
-- Retour arriere : 024_sub_category_display.rollback.sql
-- ============================================================
--
-- POURQUOI UNE VALEUR DE PLUS. app.sub_category_enum porte neuf valeurs, toutes
-- issues de la classification Vox : aucune ne dit "dessinee". Les familles
-- qu'Adobe classe en decorative ou en blackletter n'ont donc aucune case juste.
-- Les ranger en 'script' serait faux pour un blackletter et pour une decorative
-- sur deux, et ce champ n'est pas decoratif : il decide du visual_cluster_id, donc
-- des mauvaises reponses proposees au joueur. Une valeur de plus coute moins cher
-- qu'une donnee fausse crue par le jeu.
--
-- POURQUOI ELLE EST SEULE DANS SON FICHIER. PostgreSQL interdit d'utiliser une
-- valeur d'enum neuve dans la transaction qui l'ajoute. La 025, qui insere
-- {sum(1 for l in lignes if l['sous'] == 'display')} lignes en sub_category 'display', ne peut donc pas porter cet ALTER.

BEGIN;

ALTER TYPE app.sub_category_enum ADD VALUE IF NOT EXISTS 'display';

COMMIT;
""",
            encoding="utf-8",
        )
        Path("db/migrations/024_sub_category_display.rollback.sql").write_text(
            f"""-- ============================================================
-- RETOUR ARRIERE de la migration 025
-- Genere par scripts/build_adobe_mass_catalog_migration.py le {horodatage}
-- ============================================================
--
-- IL N'Y EN A PAS, et ce fichier existe pour le dire. PostgreSQL ne sait pas
-- retirer une valeur d'un enum. 'display' reste donc dans le type, sans gener
-- personne tant qu'aucune ligne ne la porte : la 025 se retire, elle, ligne par
-- ligne. Retirer vraiment la valeur demanderait de recreer le type et toutes les
-- colonnes qui s'en servent, ce qui est hors de proportion avec le probleme.
""",
            encoding="utf-8",
        )

    corps = [entete, "-- ---------- Les lignes ----------\n"]
    for l in lignes:
        corps.append(
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
            f"  '{echapper_sql(l['slug'])}', '{echapper_sql(l['nom'])}', "
            f"'{echapper_sql(l['nom'])}',\n"
            f"  '{l['cat']}', '{l['sous']}', '{l['cluster']}',\n"
            "  'N', 'hard', 'rare',\n"
            f"  true, 'adobe', 'adobe_fonts', "
            f"{'NULL' if not l['url'] else chr(39) + echapper_sql(l['url']) + chr(39)},\n"
            "  false, NULL, NULL, NULL,\n"
            f"  'classic', 'single_weight', '{CONTRASTE[l['sous']]}', '{OUVERTURE}',\n"
            f"  '{echapper_sql(l['pile'])}', "
            f"'{echapper_sql(signature(l['sous'], l['cat']))}'::jsonb,\n"
            "  false, 'training', 'review'\n"
            ")\n"
            "ON CONFLICT (typeface_slug) DO UPDATE SET\n"
            "  font_source = EXCLUDED.font_source,\n"
            "  license_type = EXCLUDED.license_type,\n"
            "  activation_status = EXCLUDED.activation_status,\n"
            "  fallback_stack = EXCLUDED.fallback_stack,\n"
            "  qa_status = EXCLUDED.qa_status,\n"
            "  updated_at_utc = now();\n"
        )

    # Le bloc de controle en fin de transaction, patron etabli par la 013 : une
    # prevision fausse annule tout plutot que de laisser la base a moitie faite.
    corps.append(f"""
-- ---------- Le compte, et il leve si la prevision est fausse ----------
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM typefaces_core
   WHERE font_source = 'adobe' AND rarity_tag = 'rare' AND activation_status;
  IF n <> {len(lignes)} THEN
    RAISE EXCEPTION 'attendu {len(lignes)} lignes Adobe rares actives, trouve %', n;
  END IF;
END $$;

COMMIT;
""")

    Path(args.sortie).write_text("".join(corps), encoding="utf-8")

    retour = f"""-- ============================================================
-- RETOUR ARRIERE de la migration 025
-- Genere par scripts/build_adobe_mass_catalog_migration.py le {horodatage}
-- ============================================================
--
-- Retire les {len(lignes)} lignes entrees par la 025. La valeur d'enum 'display' n'est PAS
-- retiree, elle appartient a la 024 et PostgreSQL ne sait pas supprimer une valeur
-- d'enum. Elle ne gene personne tant qu'aucune ligne ne la porte.

BEGIN;

DELETE FROM typefaces_core WHERE typeface_slug = ANY(ARRAY[
{',\n'.join('  ' + chr(39) + echapper_sql(l['slug']) + chr(39) for l in lignes)}
]);

COMMIT;
"""
    rollback = Path(str(args.sortie).replace(".sql", ".rollback.sql"))
    rollback.write_text(retour, encoding="utf-8")

    print(f"lignes ecrites            {len(lignes)}")
    print(f"  categorie du nom        {nommees}")
    print(f"  categories              {', '.join(f'{k} {v}' for k, v in par_cat.most_common())}")
    print(f"deja dans le kit d'origine {len(deja)}")
    print(f"sans nom CSS, ecartees    {len(sans_css)}")
    print(f"collisions de slug        {len(collisions)}")
    for nom, slug in collisions[:8]:
        print(f"    {nom} -> {slug}")
    print(f"migration                 {args.sortie}")
    print(f"retour arriere            {rollback}")
    return 0


raise SystemExit(main())
