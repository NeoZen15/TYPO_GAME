"""
font_instance.py

Ouvre un fichier de police A L'INSTANCE QUE LE JEU AFFICHE, et pas a celle que le
fichier declare par defaut.

POURQUOI CE MODULE EXISTE. Mesure du 2026-08-31 : sur les 1136 polices profilees,
136 sont variables et leur instance PAR DEFAUT n'est pas le poids que le jeu
demande. Archivo par defaut est un demi gras, wght 600 ; Alumni Sans est une
maigre, wght 100 ; 42 polices sont dans ce dernier cas. Or le jeu injecte un
`@font-face` qui declare `font-weight: 400` (lib/game/fonts/runtime-catalog.ts,
buildFontFaceRule), et une valeur unique sur une variable EPINGLE l'axe a cette
valeur. Le joueur voit donc une reguliere pendant que le profil decrit une maigre.

CE QUE CA FAUSSAIT. Les neuf grandeurs mesurees alimentent le garde des jumelles
et les clusters visuels, et les clusters decident des leurres. Ecart mesure entre
l'instance par defaut et celle rendue, sur cinq polices : 12 pour cent de rondeur
sur Alumni Sans, 7,6 sur Akshar, 5,9 sur Ancizar Sans. Le seuil qui declare deux
polices jumelles est de UN pour cent. Un profil pris sur la mauvaise instance fait
donc a la fois manquer des jumelles reelles et en inventer.

LES TROIS AXES QUE LE NAVIGATEUR PILOTE, ET CE QU'ON LEUR DONNE.

  wght  le poids declare par l'asset, 400 partout aujourd'hui. C'est la valeur
        ecrite dans le `@font-face`, donc celle a laquelle l'axe est epingle.
  wdth  100, parce que le jeu ne pose aucun `font-stretch` et que la valeur
        initiale de cette propriete, `normal`, vaut 100 pour cent. Six polices
        du catalogue ont un defaut different, jusqu'a 62,5 pour Georama.
  opsz  la taille en pixels du texte rendu, parce que `font-optical-sizing`
        vaut `auto` par defaut et qu'aucune feuille du projet ne la desactive.
        Dix neuf polices portent cet axe. Fraunces le fait courir de 9 a 144 :
        mesuree a 9 quand le joueur la voit a 144, ce n'est pas la meme police.

LE CHOIX DE LA TAILLE OPTIQUE EST UN CHOIX, ET LE VOICI. `.game-v2-word` demande
`clamp(3rem, 9vw, 8rem)`, donc de 48 a 128 pixels selon la largeur de fenetre. La
borne haute est atteinte des 1422 pixels de large, ce qui couvre un ecran de bureau
ordinaire, et c'est la taille a laquelle le specimen est regarde le plus souvent.
On mesure donc a 128. Une police dont le dessin change entre 48 et 128 restera mal
decrite aux petites largeurs : c'est une limite assumee de la mesure, pas un oubli.

CE QUE CE MODULE NE FAIT PAS. Il ne touche a aucun autre axe. Une police qui porte
GRAD, CASL ou SOFT garde le defaut de son fichier, parce que le jeu ne les pilote
pas non plus.
"""

from __future__ import annotations

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# Taille en pixels a laquelle on regle l'axe optique. Voir l'en tete.
TAILLE_OPTIQUE = 128.0

# Largeur CSS `normal`, en pour cent, valeur initiale de `font-stretch`.
LARGEUR_CSS_NORMALE = 100.0


def instance_rendue(chemin: str, poids: float = 400.0) -> tuple[TTFont, dict[str, float]]:
    """Rend la police epinglee sur l'instance que le joueur voit, et le lieu retenu.

    Le lieu est vide quand la police est statique ou qu'aucun axe pilote ne
    s'ecarte deja de sa valeur cible : dans ce cas rien n'est instancie et le
    fichier est rendu tel quel, ce qui evite un travail inutile sur les 743
    polices statiques du catalogue.
    """
    police = TTFont(chemin)
    if "fvar" not in police:
        return police, {}

    cibles = {"wght": float(poids), "wdth": LARGEUR_CSS_NORMALE, "opsz": TAILLE_OPTIQUE}
    lieu: dict[str, float] = {}
    for axe in police["fvar"].axes:
        cible = cibles.get(axe.axisTag)
        if cible is None:
            continue
        # Un axe ne va pas au dela de ses bornes : le navigateur serre de la meme
        # facon, une Fraunces demandee a 128 s'arrete a son maximum de 144.
        serre = min(max(cible, axe.minValue), axe.maxValue)
        if abs(serre - axe.defaultValue) > 1e-6:
            lieu[axe.axisTag] = serre

    if not lieu:
        return police, {}

    instanciee = instancer.instantiateVariableFont(police, lieu, inplace=True, updateFontNames=False)
    return instanciee, lieu
