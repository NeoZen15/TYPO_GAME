#!/usr/bin/env python3
"""
AUDIT DE CONFORMITE, A LANCER UNE FOIS PAR MOIS.

POURQUOI UN SCRIPT RECURRENT ET PAS UNE CORRECTION UNIQUE. Le defaut le plus
grave trouve le 2026-09-18 n'etait pas une faute d'inattention : la politique de
confidentialite, ecrite le 15 aout, affirmait qu'aucun tiers n'etait appele. Le
23 aout, Adobe Fonts est passe en production. Personne n'a menti, le produit a
bouge et le document est reste. C'est une DERIVE, et une derive ne se corrige pas
une fois, elle se surveille. Ce fichier existe pour que le mois suivant la
rattrape.

CE QUE LE SCRIPT FAIT, ET CE QU'IL NE FERA JAMAIS.

Il classe chaque constat dans trois etats, et la distinction est tout l'interet
du fichier :

  CONFORME  le produit et ses documents disent la meme chose, rien a faire.
  ECART     le code et les documents se contredisent, ou une regle mecanique
            n'est pas tenue. Le script sait corriger une partie de ces cas, et
            `--corriger` les applique.
  ATTENTE   il manque une decision ou une information que SEUL LE PROPRIETAIRE
            peut fournir : les cles Clerk, l'identite de l'editeur, la licence
            webfont de PP Frama. Ce n'est pas un echec du code, et le script ne
            le compte pas comme tel. Mais il le REDIT CHAQUE MOIS, parce qu'un
            manque qu'on cesse d'afficher est un manque qu'on oublie.

Un ECART fait sortir en 1. Une ATTENTE sort en 0 : sinon la porte serait rouge
en permanence pour une raison qui n'appartient pas au depot, et une porte
toujours rouge ne se lit plus.

IL N'AFFICHE JAMAIS LA VALEUR D'UN SECRET. Les cles sont testees en PRESENCE,
jamais en contenu, jamais en fragment, jamais en longueur. Un audit qui
journalise une cle a cree le probleme qu'il pretendait mesurer.

IL NE TOUCHE PAS A LA DIRECTION ARTISTIQUE. Couleurs, espacements, tailles,
rayons, animations, rythme : le script les signale, il ne les arbitre pas. Les
deux seules corrections qui posent quelque chose de visible, le lien d'evitement
et la mention de langue, le disent dans le rapport pour que le proprietaire
regarde.

IL N'ECRIT PAS DE DROIT. Deux textes juridiques sont pre-ecrits ici, ceux qui
decrivent Adobe Fonts et Clerk, parce qu'ils ont ete verifies dans le code le
2026-09-18. Pour tout tiers INCONNU qui apparaitrait plus tard, le script refuse
d'inventer une phrase et rend la main. C'est la difference entre corriger une
derive connue et rediger a l'aveugle.

USAGE

    python3 scripts/conformite/conformite.py              # audit seul
    python3 scripts/conformite/conformite.py --corriger   # audit puis corrections
    python3 scripts/conformite/conformite.py --json       # sortie machine

Le rapport du mois est ecrit dans docs/process/conformite/AAAA-MM.md.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Callable, Iterable

RACINE = Path(__file__).resolve().parents[2]

LEGAL = RACINE / "content" / "legal.ts"
LAYOUT = RACINE / "app" / "layout.tsx"
GLOBALS_CSS = RACINE / "app" / "globals.css"
NEXT_CONFIG = RACINE / "next.config.ts"
PAGE_LEGALE = RACINE / "features" / "legal" / "components" / "LegalPage.tsx"
GATE_ADMIN = RACINE / "lib" / "admin" / "gate.ts"
ENV_LOCAL = RACINE / ".env.local"
DOSSIER_RAPPORTS = RACINE / "docs" / "process" / "conformite"

# Les dossiers ou vit le code du produit. `scripts` et `tests` sont dehors : ce
# qui ne part pas chez un visiteur ne cree pas d'obligation envers lui.
SOURCES = ["app", "lib", "features", "components", "content"]
EXTENSIONS = {".ts", ".tsx", ".css", ".mjs", ".js"}

CONFORME = "CONFORME"
ECART = "ECART"
ATTENTE = "ATTENTE"

BLOQUANT = "bloquant"
MAJEUR = "majeur"
MINEUR = "mineur"

ORDRE_GRAVITE = {BLOQUANT: 0, MAJEUR: 1, MINEUR: 2}


@dataclass
class Constat:
    id: str
    titre: str
    gravite: str
    etat: str
    constat: str
    correction: Callable[[], str] | None = None
    renvoi: str = ""
    details: list[str] = field(default_factory=list)

    @property
    def corrigeable(self) -> bool:
        return self.etat == ECART and self.correction is not None


# ---------------------------------------------------------------------------
# Lecture du depot
# ---------------------------------------------------------------------------

_cache_fichiers: list[tuple[Path, str]] | None = None


def fichiers_source() -> list[tuple[Path, str]]:
    """Tous les fichiers du produit, lus une fois et gardes."""
    global _cache_fichiers
    if _cache_fichiers is not None:
        return _cache_fichiers

    trouves: list[tuple[Path, str]] = []
    for nom in SOURCES:
        racine = RACINE / nom
        if not racine.is_dir():
            continue
        for chemin in racine.rglob("*"):
            if not chemin.is_file() or chemin.suffix not in EXTENSIONS:
                continue
            if "node_modules" in chemin.parts:
                continue
            try:
                trouves.append((chemin, chemin.read_text(encoding="utf-8")))
            except (UnicodeDecodeError, OSError):
                continue
    _cache_fichiers = trouves
    return trouves


def texte_legal() -> str:
    return LEGAL.read_text(encoding="utf-8") if LEGAL.exists() else ""


def relatif(chemin: Path) -> str:
    try:
        return str(chemin.relative_to(RACINE))
    except ValueError:
        return str(chemin)


def npm(script: str) -> tuple[int, str]:
    """Lance un garde existant. Le code de sortie est celui de npm, pas d'un tube."""
    try:
        issue = subprocess.run(
            ["npm", "run", "--silent", script],
            cwd=RACINE,
            capture_output=True,
            text=True,
            timeout=600,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as erreur:
        return 127, f"{script} n'a pas pu etre lance : {erreur}"
    return issue.returncode, (issue.stdout + issue.stderr).strip()


# ---------------------------------------------------------------------------
# Ce que le produit appelle vraiment, et ce que ses documents en disent
# ---------------------------------------------------------------------------

# Les hotes connus, verifies dans le code le 2026-09-18, avec le nom sous lequel
# un document legal doit les nommer. Un hote absent de cette table est un hote
# que personne n'a encore examine : le script le signale et refuse d'ecrire une
# phrase a sa place.
HOTES_CONNUS = {
    "use.typekit.net": "Adobe",
    "p.typekit.net": "Adobe",
    "esm.sh": "esm.sh",
    "en.wikipedia.org": "Wikipedia",
}

# Les marqueurs qui font d'une URL un APPEL AUTOMATIQUE, c'est a dire un appel
# que le navigateur passe sans que personne ait clique. C'est la seule categorie
# qui cree une obligation d'information : un lien sortant n'envoie rien tant que
# le visiteur ne le suit pas.
MARQUEURS_AUTOMATIQUES = (
    "preconnect",
    "dns-prefetch",
    "stylesheet",
    "<script",
    "src=",
    "fetch(",
    "import(",
    "new Worker",
    "@import",
)


def appels_tiers() -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    """Separe les appels automatiques des liens que le visiteur choisit de suivre."""
    automatiques: dict[str, list[str]] = {}
    sortants: dict[str, list[str]] = {}

    motif = re.compile(r"https?://([a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,})")
    for chemin, contenu in fichiers_source():
        for numero, ligne in enumerate(contenu.splitlines(), start=1):
            nu = ligne.strip()
            # Une URL cite dans un commentaire ne declenche aucun appel.
            if nu.startswith(("//", "*", "/*", "#")):
                continue
            for correspondance in motif.finditer(ligne):
                hote = correspondance.group(1).lower()
                ou = f"{relatif(chemin)}:{numero}"
                minuscule = ligne.lower()
                auto = any(marqueur in minuscule for marqueur in MARQUEURS_AUTOMATIQUES)
                cible = automatiques if auto else sortants
                cible.setdefault(hote, [])
                if ou not in cible[hote]:
                    cible[hote].append(ou)
    return automatiques, sortants


def verif_tiers_non_declares() -> Constat:
    automatiques, sortants = appels_tiers()
    legal = texte_legal().lower()

    manquants: list[str] = []
    inconnus: list[str] = []
    for hote, endroits in sorted(automatiques.items()):
        nom = HOTES_CONNUS.get(hote)
        if nom is None:
            inconnus.append(f"{hote} ({endroits[0]})")
            continue
        if hote in legal or nom.lower() in legal:
            continue
        manquants.append(f"{nom} via {hote}, appele depuis {endroits[0]}")

    details = [f"appel automatique : {h} ({len(o)} endroit(s))" for h, o in sorted(automatiques.items())]
    details += [f"lien sortant : {h}" for h in sorted(sortants)]

    if inconnus:
        return Constat(
            id="tiers-inconnu",
            titre="Un tiers appele automatiquement n'a jamais ete examine",
            gravite=BLOQUANT,
            etat=ECART,
            constat=(
                "Le produit appelle un hote que ce script ne connait pas : "
                + ", ".join(inconnus)
                + ". Le script REFUSE d'ecrire une phrase juridique a son sujet. "
                "Il faut etablir ce que cet hote recoit, puis l'ajouter a HOTES_CONNUS "
                "et a la politique de confidentialite."
            ),
            details=details,
        )

    if manquants:
        return Constat(
            id="tiers-non-declares",
            titre="La politique de confidentialite ne nomme pas un tiers reellement appele",
            gravite=BLOQUANT,
            etat=ECART,
            constat=(
                "Le navigateur du visiteur contacte "
                + " ; ".join(manquants)
                + ". La politique ne le nomme pas. C'est exactement la derive du 2026-09-18."
            ),
            correction=corriger_declaration_tiers,
            renvoi="content/legal.ts",
            details=details,
        )

    return Constat(
        id="tiers-non-declares",
        titre="Tiers appeles et tiers declares",
        gravite=BLOQUANT,
        etat=CONFORME,
        constat="Chaque hote appele automatiquement est nomme dans la politique de confidentialite.",
        details=details,
    )


# Les paquets qui font d'un editeur un sous traitant : ils traitent de la donnee
# personnelle pour le compte du site. Un paquet purement local, comme gsap ou
# fontkit, n'en est pas un.
SOUS_TRAITANTS = {
    "@clerk/nextjs": "Clerk",
    "@neondatabase/serverless": "Neon",
    "@sentry/nextjs": "Sentry",
    "posthog-js": "PostHog",
    "@vercel/analytics": "Vercel Analytics",
    "@vercel/speed-insights": "Vercel Speed Insights",
    "plausible-tracker": "Plausible",
    "@stripe/stripe-js": "Stripe",
    "mixpanel-browser": "Mixpanel",
}


def verif_sous_traitants() -> Constat:
    paquets = RACINE / "package.json"
    if not paquets.exists():
        return Constat("sous-traitants", "Sous-traitants", MAJEUR, ECART, "package.json introuvable.")

    declares = json.loads(paquets.read_text(encoding="utf-8")).get("dependencies", {})
    legal = texte_legal().lower()

    manquants = [
        nom
        for paquet, nom in SOUS_TRAITANTS.items()
        if paquet in declares and nom.lower() not in legal
    ]
    presents = [nom for paquet, nom in SOUS_TRAITANTS.items() if paquet in declares]

    if manquants:
        return Constat(
            id="sous-traitants",
            titre="Un sous-traitant installe n'est pas nomme dans la politique",
            gravite=BLOQUANT,
            etat=ECART,
            constat=(
                "Ces editeurs sont dans les dependances et absents de la politique : "
                + ", ".join(manquants)
                + ". La liste des sous-traitants doit etre exhaustive."
            ),
            correction=corriger_declaration_tiers,
            renvoi="content/legal.ts",
            details=[f"installe : {n}" for n in presents],
        )

    return Constat(
        id="sous-traitants",
        titre="Sous-traitants installes et sous-traitants declares",
        gravite=BLOQUANT,
        etat=CONFORME,
        constat="Tous les editeurs installes qui traitent de la donnee sont nommes.",
        details=[f"installe : {n}" for n in presents],
    )


def verif_cookies() -> Constat:
    """Tout cookie pose par le code doit etre nomme dans la politique."""
    noms: dict[str, str] = {}
    motif = re.compile(r'COOKIE_NAME\s*=\s*"([^"]+)"|cookies\(\)[^\n]*\.set\(\s*"([^"]+)"')
    for chemin, contenu in fichiers_source():
        for numero, ligne in enumerate(contenu.splitlines(), start=1):
            for correspondance in motif.finditer(ligne):
                nom = correspondance.group(1) or correspondance.group(2)
                if nom:
                    noms.setdefault(nom, f"{relatif(chemin)}:{numero}")

    legal = texte_legal()
    manquants = [n for n in noms if n not in legal]

    if manquants:
        return Constat(
            id="cookies",
            titre="Un cookie pose par le code n'est pas nomme dans la politique",
            gravite=MAJEUR,
            etat=ECART,
            constat="Cookies poses et non nommes : " + ", ".join(manquants),
            renvoi="content/legal.ts",
            details=[f"{n} pose en {ou}" for n, ou in sorted(noms.items())],
        )

    return Constat(
        id="cookies",
        titre="Cookies poses et cookies declares",
        gravite=MAJEUR,
        etat=CONFORME,
        constat=f"{len(noms)} cookie(s) pose(s) par le code, tous nommes dans la politique.",
        details=[f"{n} pose en {ou}" for n, ou in sorted(noms.items())],
    )


# ---------------------------------------------------------------------------
# Ce qui n'appartient qu'au proprietaire
# ---------------------------------------------------------------------------

# Chaque cle est decrite par ce qui CASSE sans elle. Une liste de noms de
# variables ne dit rien a qui doit decider ; « sans ca, pas d'administration du
# tout en production » se decide en dix secondes.
CLES = [
    (
        "DATABASE_URL",
        "la base Neon",
        "Sans elle le jeu ne demarre pas. Elle est posee en local.",
        True,
    ),
    (
        "GAME_PROVIDER_SECRET",
        "la signature des jetons de question",
        "Le produit REFUSE de demarrer en production sans elle, par construction "
        "(check:token-secret). Elle existe en local depuis le 2026-08-17 et doit "
        "etre recopiee telle quelle chez l'hebergeur, sous le meme nom.",
        True,
    ),
    (
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "l'authentification, cote navigateur",
        "Sans elle : aucun compte, aucun espace professeur reel, et AUCUNE "
        "administration en production depuis que la porte se ferme du bon cote. "
        "Le jeu lui-meme continue de tourner, tout le monde est invite.",
        False,
    ),
    (
        "CLERK_SECRET_KEY",
        "l'authentification, cote serveur",
        "Inseparable de la precedente : l'une sans l'autre ne sert a rien.",
        False,
    ),
]


def cle_presente(nom: str) -> tuple[bool, bool]:
    """(dans .env.local, dans l'environnement courant). JAMAIS la valeur."""
    dans_fichier = False
    if ENV_LOCAL.exists():
        for ligne in ENV_LOCAL.read_text(encoding="utf-8").splitlines():
            nu = ligne.strip()
            if nu.startswith(f"{nom}=") and len(nu) > len(nom) + 1:
                dans_fichier = True
                break
    return dans_fichier, bool(os.environ.get(nom))


def verif_cles() -> Constat:
    manquantes: list[str] = []
    details: list[str] = []

    for nom, role, consequence, indispensable in CLES:
        fichier, environnement = cle_presente(nom)
        if fichier or environnement:
            ou = "fichier local" if fichier else "environnement"
            details.append(f"{nom} : presente ({ou}), pour {role}")
            continue
        details.append(f"{nom} : ABSENTE, pour {role}. {consequence}")
        manquantes.append(nom)

    if not manquantes:
        return Constat(
            id="cles",
            titre="Cles d'environnement",
            gravite=BLOQUANT,
            etat=CONFORME,
            constat="Les quatre cles sont posees. Presence testee, valeur jamais lue.",
            details=details,
        )

    return Constat(
        id="cles",
        titre="Des cles manquent, et elles n'appartiennent qu'au proprietaire",
        gravite=BLOQUANT,
        etat=ATTENTE,
        constat=(
            "Absentes : "
            + ", ".join(manquantes)
            + ". Aucun script ne peut les creer a votre place, et elles ne doivent "
            "jamais passer par une conversation. Ce constat reviendra chaque mois "
            "tant qu'elles ne sont pas posees."
        ),
        details=details,
    )


def verif_marqueurs_editeur() -> Constat:
    texte = texte_legal()
    marqueurs = re.findall(r"\[A COMPLETER[^\]]*\]", texte)
    if not marqueurs:
        return Constat(
            id="identite-editeur",
            titre="Identite de l'editeur",
            gravite=BLOQUANT,
            etat=CONFORME,
            constat="Plus aucun marqueur a completer dans les documents legaux.",
        )
    return Constat(
        id="identite-editeur",
        titre="Les documents legaux attendent une information que seul l'editeur detient",
        gravite=BLOQUANT,
        etat=ATTENTE,
        constat=(
            f"{len(marqueurs)} marqueur(s) a remplir dans content/legal.ts avant toute "
            "mise en ligne. Publier des mentions legales qui ne nomment personne serait "
            "pire que ne pas en avoir."
        ),
        renvoi="content/legal.ts",
        details=marqueurs,
    )


def verif_licence_marque() -> Constat:
    code, sortie = npm("check:font-licenses")
    ligne_frama = next((l for l in sortie.splitlines() if "Frama" in l), "")
    if code != 0:
        return Constat(
            id="licences-polices",
            titre="Le garde des licences de polices echoue",
            gravite=BLOQUANT,
            etat=ECART,
            constat=sortie[-800:],
        )
    if ligne_frama:
        return Constat(
            id="licences-polices",
            titre="PP Frama, police de marque, sans licence webfont",
            gravite=BLOQUANT,
            etat=ATTENTE,
            constat=(
                "La police de marque est servie depuis public/fonts/brand sans licence "
                "webfont redistribuable. Servir une fonte commerciale en webfont sans la "
                "licence correspondante est une infraction au contrat de la fonderie. "
                "Le script NE SUPPRIME RIEN : retirer la police de marque casserait "
                "l'identite. Deux sorties, toutes deux hors code : acheter la licence "
                "webfont chez Pangram Pangram, ou remplacer la police de marque."
            ),
            details=[ligne_frama],
        )
    return Constat(
        id="licences-polices",
        titre="Licences des polices auto-hebergees",
        gravite=BLOQUANT,
        etat=CONFORME,
        constat=sortie.splitlines()[-1] if sortie else "Garde vert.",
    )


# ---------------------------------------------------------------------------
# Accessibilite
# ---------------------------------------------------------------------------


def verif_lien_evitement() -> Constat:
    for _, contenu in fichiers_source():
        if "skip-link" in contenu or "Aller au contenu" in contenu:
            return Constat(
                id="lien-evitement",
                titre="Lien d'evitement",
                gravite=MAJEUR,
                etat=CONFORME,
                constat="Un lien d'evitement existe.",
            )
    return Constat(
        id="lien-evitement",
        titre="Aucun lien d'evitement",
        gravite=MAJEUR,
        etat=ECART,
        constat=(
            "WCAG 2.4.1, niveau A. Sans lui, qui navigue au clavier retraverse toute "
            "la navigation a chaque page. Le site a 78 elements de repere et des etats "
            "de focus soignes : c'est la derniere piece mecanique qui manque."
        ),
        correction=corriger_lien_evitement,
        renvoi="app/layout.tsx",
    )


def verif_langue_documents() -> Constat:
    """Trois pages en francais servies sous la langue declaree du site, l'anglais."""
    if not PAGE_LEGALE.exists():
        return Constat("langue", "Langue des documents", MAJEUR, CONFORME, "Page legale introuvable.")

    racine = LAYOUT.read_text(encoding="utf-8") if LAYOUT.exists() else ""
    langue_site = re.search(r'<html[^>]*lang="([a-z-]+)"', racine)
    langue_site = langue_site.group(1) if langue_site else "?"

    page = PAGE_LEGALE.read_text(encoding="utf-8")
    if 'lang="fr"' in page:
        return Constat(
            id="langue-documents",
            titre="Langue des documents legaux",
            gravite=MAJEUR,
            etat=CONFORME,
            constat=f'Le site est declare en "{langue_site}" et les documents legaux portent lang="fr".',
        )

    return Constat(
        id="langue-documents",
        titre="Des pages en francais servies sous une langue declaree anglaise",
        gravite=MAJEUR,
        etat=ECART,
        constat=(
            f'Le site entier est declare lang="{langue_site}", et les trois documents '
            "legaux sont ecrits en francais. WCAG 3.1.1 : un lecteur d'ecran les prononce "
            "avec la phonetique anglaise, ce qui les rend inecoutables."
        ),
        correction=corriger_langue_documents,
        renvoi="features/legal/components/LegalPage.tsx",
    )


# LES PREFERENCES QUI PROMETTENT QUELQUE CHOSE A TOUT LE SITE, et ce que chacune
# promet. Une cle de travail local, comme l'identifiant de la tentative en cours,
# n'est pas ici : elle est ecrite et relue par le meme ecran, c'est normal, et la
# premiere version de ce controle la signalait a tort.
#
# La question posee est etroite et verifiable : ce reglage promet d'agir sur des
# ecrans que son propre composant ne dessine pas, donc quelqu'un d'autre doit le
# lire. Si personne ne le lit, le bouton ne fait rien.
PREFERENCES_GLOBALES = {
    "jdt-theme": "le theme sombre ou clair de tout le site",
    "jdt-lang": "la langue de toute l'interface",
    "jdt-reduced-motion": "la reduction des animations sur tous les ecrans",
}


def verif_controles_inertes() -> Constat:
    """Un bouton qui ecrit une preference que personne ne lit est un bouton qui ment."""
    inertes: list[str] = []
    servies: list[str] = []

    for cle, promesse in sorted(PREFERENCES_GLOBALES.items()):
        ecrivains = {
            relatif(c) for c, contenu in fichiers_source() if f'"{cle}"' in contenu
        }
        if not ecrivains:
            continue
        # Le composant qui porte le bouton relit toujours sa propre valeur pour
        # afficher l'etat du bouton. Cette relecture ne prouve rien : ce qu'on
        # cherche, c'est un lecteur AILLEURS, celui qui applique le reglage.
        porteur = sorted(ecrivains)[0] if len(ecrivains) == 1 else None
        if porteur is not None:
            inertes.append(f'"{cle}" promet {promesse}, et seul {porteur} la touche')
        else:
            servies.append(f'"{cle}" est lue par {len(ecrivains)} fichiers')

    # Une cle nouvelle posee dans l'ecran des reglages et absente de la table
    # ci-dessus n'a jamais ete classee : il faut decider si elle promet quelque
    # chose de global avant de la laisser passer.
    reglages = RACINE / "features" / "profile" / "components" / "PreferencesBoard.tsx"
    inconnues: list[str] = []
    if reglages.exists():
        texte = reglages.read_text(encoding="utf-8")
        for valeur in re.findall(r'"(jdt-[a-z0-9-]+)"', texte):
            if valeur not in PREFERENCES_GLOBALES:
                inconnues.append(valeur)

    if inconnues:
        return Constat(
            id="controles-inertes",
            titre="Un reglage nouveau n'a pas ete classe",
            gravite=MAJEUR,
            etat=ECART,
            constat=(
                "Ces cles sont posees par l'ecran des reglages sans figurer dans "
                "PREFERENCES_GLOBALES : "
                + ", ".join(sorted(set(inconnues)))
                + ". Decider si elles promettent un effet global, puis les y ajouter."
            ),
            renvoi="scripts/conformite/conformite.py",
        )

    if not inertes:
        return Constat(
            id="controles-inertes",
            titre="Controles de preference",
            gravite=MAJEUR,
            etat=CONFORME,
            constat="Chaque reglage global est applique par un lecteur hors de son propre ecran.",
            details=servies,
        )

    return Constat(
        id="controles-inertes",
        titre="Des controles visibles n'ont aucun effet",
        gravite=MAJEUR,
        etat=ECART,
        constat=(
            "Ces reglages promettent d'agir sur tout le site et personne ne les applique : "
            + " ; ".join(inertes)
            + ". Le reducteur d'animations est le plus grave, c'est un controle "
            "d'accessibilite : les ecrans n'interrogent que la preference systeme du "
            "navigateur, donc le bouton du profil ne change rien. "
            "LE SCRIPT NE CORRIGE PAS : retirer un controle visible ou lui donner un "
            "effet est une decision de produit et de DA, elle appartient au proprietaire."
        ),
        renvoi="features/profile/components/PreferencesBoard.tsx",
        details=inertes + servies,
    )


def verif_liens_externes() -> Constat:
    fautifs: list[str] = []
    for chemin, contenu in fichiers_source():
        for numero, ligne in enumerate(contenu.splitlines(), start=1):
            if 'target="_blank"' not in ligne:
                continue
            if "noopener" in ligne or "noreferrer" in ligne:
                continue
            fautifs.append(f"{relatif(chemin)}:{numero}")

    if not fautifs:
        return Constat(
            id="liens-externes",
            titre="Liens ouverts dans un nouvel onglet",
            gravite=MINEUR,
            etat=CONFORME,
            constat="Chaque lien en nouvel onglet porte noopener ou noreferrer.",
        )
    return Constat(
        id="liens-externes",
        titre="Un lien en nouvel onglet sans protection",
        gravite=MINEUR,
        etat=ECART,
        constat="Sans rel, la page ouverte peut manipuler la page d'origine et recoit le referrer.",
        correction=corriger_liens_externes,
        details=fautifs,
    )


# ---------------------------------------------------------------------------
# Mise en ligne
# ---------------------------------------------------------------------------


def verif_robots_sitemap() -> Constat:
    robots = RACINE / "app" / "robots.ts"
    plan = RACINE / "app" / "sitemap.ts"
    manquants = [relatif(p) for p in (robots, plan) if not p.exists()]
    if not manquants:
        return Constat(
            id="robots-sitemap",
            titre="Indexation",
            gravite=MAJEUR,
            etat=CONFORME,
            constat="robots.ts et sitemap.ts existent.",
        )
    return Constat(
        id="robots-sitemap",
        titre="Aucune consigne d'indexation",
        gravite=MAJEUR,
        etat=ECART,
        constat=(
            "Manquant : "
            + ", ".join(manquants)
            + ". Sans robots.txt, /admin et /dev sont proposes a l'indexation. "
            "L'administration lit des noms et des adresses : une page d'administration "
            "dans un moteur de recherche est une fuite qui ne demande aucune competence."
        ),
        correction=corriger_robots_sitemap,
    )


def verif_entetes() -> Constat:
    if not NEXT_CONFIG.exists():
        return Constat("entetes", "En-tetes", MAJEUR, ECART, "next.config.ts introuvable.")
    config = NEXT_CONFIG.read_text(encoding="utf-8")
    attendus = {
        "Referrer-Policy": "le referrer part sinon chez Adobe a chaque chargement",
        "X-Content-Type-Options": "empeche le navigateur de deviner un type",
        "Content-Security-Policy": "borne les hotes que la page a le droit d'appeler",
        "X-Frame-Options": "empeche l'encadrement du site dans une autre page",
    }
    manquants = [f"{nom} ({raison})" for nom, raison in attendus.items() if nom not in config]
    if manquants:
        return Constat(
            id="entetes",
            titre="Des en-tetes de securite manquent",
            gravite=MAJEUR,
            etat=ECART,
            constat="Absents de next.config.ts : " + " ; ".join(manquants),
            renvoi="next.config.ts",
        )
    return Constat(
        id="entetes",
        titre="En-tetes de securite",
        gravite=MAJEUR,
        etat=CONFORME,
        constat="Les quatre en-tetes attendus sont poses, dont une politique de contenu.",
    )


def verif_metadata() -> Constat:
    if not LAYOUT.exists():
        return Constat("metadata", "Metadonnees", MINEUR, CONFORME, "layout introuvable.")
    layout = LAYOUT.read_text(encoding="utf-8")
    restes = [
        marque
        for marque in ('title: "Jeux de Typo V2"', 'description: "Typographic learning experience."')
        if marque in layout
    ]
    if not restes:
        return Constat(
            id="metadata",
            titre="Metadonnees du site",
            gravite=MINEUR,
            etat=CONFORME,
            constat="Le titre et la description ne sont plus ceux du gabarit.",
        )
    return Constat(
        id="metadata",
        titre="Le titre et la description sont restes ceux du gabarit",
        gravite=MINEUR,
        etat=ECART,
        constat=(
            "Le site s'appelle DWIGGINS partout sauf dans l'onglet du navigateur et dans "
            "les resultats de recherche, ou il s'appelle encore « Jeux de Typo V2 ». "
            "LE SCRIPT NE CORRIGE PAS : un titre et une accroche sont de la marque, "
            "donc du proprietaire."
        ),
        renvoi="app/layout.tsx",
        details=restes,
    )


def verif_retention() -> Constat:
    texte = texte_legal()
    promesse = "anonymis" in texte.lower()
    if not promesse:
        return Constat(
            id="retention",
            titre="Retention",
            gravite=MAJEUR,
            etat=CONFORME,
            constat="Aucune promesse d'anonymisation dans les documents.",
        )

    # UN MOT NE PROUVE PAS UN MECANISME, et la premiere version de ce controle s'y
    # est laissee prendre : `lib/game/training/provider.ts` parle de RETENTION au
    # sens mnemonique, celle du joueur qui retient une police, et porte des UPDATE
    # pour une raison sans rapport. Le controle rendait donc CONFORME sur une
    # promesse qui n'est pas tenue, ce qui est pire que de la manquer.
    #
    # Un mecanisme d'anonymisation est une chose qu'on NOMME : un fichier de
    # migration, un script planifie. Chercher un nom de fichier ne donne ni faux
    # positif ni faux negatif, la ou chercher un mot dans du code donne les deux.
    mecanisme = [
        relatif(chemin)
        for dossier in ("db", "scripts", "lib")
        for chemin in (RACINE / dossier).rglob("*")
        if chemin.is_file()
        and re.search(r"(anonymis|purge|retention)", chemin.name, re.IGNORECASE)
    ]

    if mecanisme:
        return Constat(
            id="retention",
            titre="Retention",
            gravite=MAJEUR,
            etat=CONFORME,
            constat="La promesse d'anonymisation a un mecanisme nomme : " + ", ".join(mecanisme),
        )

    return Constat(
        id="retention",
        titre="La politique promet une anonymisation qui n'existe pas",
        gravite=MAJEUR,
        etat=ECART,
        constat=(
            "La politique annonce que les donnees rattachees a un identifiant devenu "
            "inutilisable sont conservees vingt-quatre mois au plus, puis anonymisees. "
            "Aucun mecanisme ne le fait. Une duree de conservation annoncee et jamais "
            "appliquee est une declaration fausse. "
            "LE SCRIPT NE CORRIGE PAS : ecrire dans la base de production est un geste "
            "qui demande le feu vert du proprietaire, et le choix entre construire le "
            "mecanisme ou corriger la phrase lui appartient."
        ),
        renvoi="content/legal.ts",
    )


def verif_code_distant() -> Constat:
    trouves: list[str] = []
    for chemin, contenu in fichiers_source():
        for numero, ligne in enumerate(contenu.splitlines(), start=1):
            if re.search(r'(import|from)\s*\(?\s*["\']https?://', ligne) or (
                "esm.sh" in ligne and not ligne.strip().startswith("//")
            ):
                trouves.append(f"{relatif(chemin)}:{numero}")
    if not trouves:
        return Constat(
            id="code-distant",
            titre="Code execute depuis un tiers",
            gravite=MAJEUR,
            etat=CONFORME,
            constat="Aucun module n'est charge depuis un CDN a l'execution.",
        )
    return Constat(
        id="code-distant",
        titre="Du code est charge depuis un CDN a l'execution",
        gravite=MAJEUR,
        etat=ECART,
        constat=(
            "Un module tiers est importe depuis une adresse distante : "
            + ", ".join(trouves)
            + ". Qui controle ce domaine execute du code dans la page. Les routes de "
            "developpement sont gardees, donc ce n'est pas servi au public aujourd'hui, "
            "mais le garde est la seule chose qui l'en empeche. A verifier avant toute "
            "reprise de ce composant en production."
        ),
    )


# Les tournures qui affirment sans preuve. Volontairement courte : une liste
# large rendrait le rapport illisible et on cesserait de le lire.
ALLEGATIONS = [
    (r"\bn°\s*1\b|\bnumero un\b", "une position de marche"),
    (r"\bgaranti(e|es|s)?\b", "une garantie"),
    (r"\bcertifi(e|ee|es|ees)\b|\bcertified\b", "une certification"),
    (r"\ble meilleur\b|\bthe best\b", "un superlatif"),
    (r"\bprouv(e|ee|es)\b|\bscientifically proven\b", "une preuve"),
    (r"\b\d[\d\s.,]*\s*(utilisateurs|joueurs|clients|users|players|ecoles|professeurs)\b", "un volume d'audience"),
    (r"\b\d+\s*(etoiles|stars)\b|\bavis client", "un avis client"),
]


def verif_allegations() -> Constat:
    # NE LIRE QUE CE QU'UN VISITEUR PEUT LIRE, et seulement dans les chaines.
    #
    # La premiere version lisait tout le depot ligne par ligne et rendait quatre
    # faux positifs : le « N°1 » grave sur un medaillon dessine par
    # lib/brand/dwiggins-badge-engine.ts, un commentaire SQL contenant « prouve »,
    # et un texte interne disant qu'un stage est « le meilleur arbitre » du corpus.
    # Aucun n'est une allegation commerciale, et un rapport qui en contient quatre
    # cesse d'etre lu.
    #
    # Deux bornes, donc : la copie destinee au public vit dans `content/` et dans
    # les composants d'ecran, jamais dans `lib/` ni dans les outils de
    # developpement ; et le motif doit tomber DANS une chaine de caracteres, pas
    # dans du code ni dans un commentaire.
    chaine = re.compile(r'"([^"\\]*(?:\\.[^"\\]*)*)"')
    trouves: list[str] = []
    for chemin, contenu in fichiers_source():
        ou = relatif(chemin)
        if ou.endswith("legal.ts") or "/legal/" in ou:
            continue
        if not (ou.startswith("content/") or "/components/" in ou):
            continue
        if "/dev/" in ou:
            continue
        for numero, ligne in enumerate(contenu.splitlines(), start=1):
            nu = ligne.strip()
            if nu.startswith(("//", "*", "/*")):
                continue
            for texte in chaine.findall(ligne):
                for motif, genre in ALLEGATIONS:
                    if re.search(motif, texte, re.IGNORECASE):
                        trouves.append(f"{ou}:{numero} porte {genre}")
                        break

    if not trouves:
        return Constat(
            id="allegations",
            titre="Contenu commercial",
            gravite=MAJEUR,
            etat=CONFORME,
            constat=(
                "Aucun faux avis, faux volume d'audience, superlatif ni garantie. "
                "Le produit ne revendique que ce qu'il fait."
            ),
        )
    return Constat(
        id="allegations",
        titre="Une affirmation demande une preuve",
        gravite=MAJEUR,
        etat=ECART,
        constat=(
            "A relire a la main, le script ne juge pas du contexte : " + " ; ".join(trouves[:10])
        ),
        details=trouves,
    )


def verif_formulaires() -> Constat:
    """Un formulaire qui collecte une donnee personnelle doit dire ou elle va."""
    sensibles: list[str] = []
    for chemin, contenu in fichiers_source():
        if "<form" not in contenu and "<input" not in contenu:
            continue
        # AFFICHER UNE DONNEE N'EST PAS LA COLLECTER. La premiere version signalait
        # TeacherClassPage parce qu'il REND l'adresse d'un eleve deja en base. Ce
        # n'est pas un defaut d'information au moment de la collecte, c'est une
        # lecture, et elle est gardee ailleurs par la porte enseignant. Seul un
        # CHAMP DE SAISIE cree l'obligation visee ici.
        collecte = re.search(
            r'<input[^>]*(type="email"|name="(email|nom|name|full_name)")'
            r"|<input[^>]*type=\{?[\"']email",
            contenu,
            re.IGNORECASE,
        )
        if not collecte:
            continue
        if "confidentialite" in contenu or "privacy" in contenu.lower():
            continue
        sensibles.append(relatif(chemin))

    if not sensibles:
        return Constat(
            id="formulaires",
            titre="Formulaires",
            gravite=MAJEUR,
            etat=CONFORME,
            constat="Aucun formulaire ne collecte de donnee personnelle sans renvoyer a la politique.",
        )
    return Constat(
        id="formulaires",
        titre="Un formulaire collecte une donnee personnelle sans renvoyer a la politique",
        gravite=MAJEUR,
        etat=ECART,
        constat=(
            "Ces ecrans touchent a un nom ou une adresse sans lien vers la politique de "
            "confidentialite : "
            + ", ".join(sensibles)
            + ". L'information doit etre donnee au moment de la collecte, pas seulement "
            "dans une page qu'il faut aller chercher."
        ),
        details=sensibles,
    )


def verif_admin_ferme() -> Constat:
    if not GATE_ADMIN.exists():
        return Constat(
            id="admin",
            titre="La porte de l'administration n'est pas isolee",
            gravite=BLOQUANT,
            etat=ECART,
            constat=(
                "lib/admin/gate.ts n'existe pas. La reponse a « qui a le droit d'entrer » "
                "doit etre ecrite une fois, sinon la page et la route d'ecriture divergent."
            ),
        )
    porte = GATE_ADMIN.read_text(encoding="utf-8")
    if "isDevRuntime()" in porte and "isClerkConfigured()" in porte:
        return Constat(
            id="admin",
            titre="Porte de l'administration",
            gravite=BLOQUANT,
            etat=CONFORME,
            constat=(
                "L'exception sans compte est bornee au hors production. Un deploiement "
                "sans Clerk n'a pas d'administration du tout, et c'est la bonne facon d'echouer."
            ),
        )
    return Constat(
        id="admin",
        titre="L'administration peut s'ouvrir sans compte en production",
        gravite=BLOQUANT,
        etat=ECART,
        constat=(
            "La porte ne verifie pas a la fois le hors production et l'absence de Clerk. "
            "Dix-sept pages affichent l'usage reel du produit et des demandes d'acces."
        ),
        renvoi="lib/admin/gate.ts",
    )


def verif_gardes() -> list[Constat]:
    """Les gardes que le depot possede deja. Inutile de les reecrire ici."""
    constats: list[Constat] = []
    for script, titre in (
        ("check:legal-docs", "Structure des documents legaux"),
        ("check:contrast", "Contraste des encres"),
        ("check:license-guard", "Licences servies a l'execution"),
    ):
        code, sortie = npm(script)
        derniere = sortie.splitlines()[-1] if sortie.strip() else "(sans sortie)"
        constats.append(
            Constat(
                id=script,
                titre=titre,
                gravite=MAJEUR,
                etat=CONFORME if code == 0 else ECART,
                constat=derniere if code == 0 else sortie[-800:],
            )
        )
    return constats


# ---------------------------------------------------------------------------
# Corrections
#
# Chacune est IDEMPOTENTE : elle regarde avant d'ecrire, et relancee le mois
# suivant elle ne fait rien. C'est la condition pour qu'un script mensuel ne
# devienne pas une source de bruit dans l'historique.
# ---------------------------------------------------------------------------

PHRASE_FAUSSE = (
    "Les polices de caractères sont hébergées sur notre propre serveur : votre navigateur "
    "n'appelle ni Google Fonts ni aucun autre tiers en affichant une page."
)

PHRASE_VRAIE = (
    "Aucune mesure d'audience, aucun traceur publicitaire, aucun réseau social."
)

SECTION_POLICES = """    {
      title: "Les polices, et le seul tiers que votre navigateur contacte",
      body: "La très grande majorité des polices du jeu sont hébergées sur notre propre serveur. Une partie du catalogue appartient en revanche à Adobe, qui interdit de télécharger ses fichiers : ces polices restent chez lui, et votre navigateur les demande à use.typekit.net et p.typekit.net en affichant une page. Adobe Inc., société américaine, reçoit alors votre adresse IP, le type de votre navigateur et la page depuis laquelle la demande part. Ce n'est pas un traceur et cela ne dépose aucun cookie chez vous, mais c'est bien un appel à un tiers, et vous devez le savoir. Il est nécessaire au service : ces polices ne sont pas une décoration, elles sont la question que le jeu vous pose.",
    },
"""

ANCIENS_SOUS_TRAITANTS = (
    "Neon, pour l'hébergement de la base de données. Vercel Inc., 440 N Barranca Ave #4133, "
    "Covina, CA 91723, États-Unis, pour la mise en ligne des pages. Aucun autre prestataire "
    "ne reçoit vos données."
)

NOUVEAUX_SOUS_TRAITANTS = (
    "Neon, pour l'hébergement de la base de données. Vercel Inc., 440 N Barranca Ave #4133, "
    "Covina, CA 91723, États-Unis, pour la mise en ligne des pages. Adobe Inc., États-Unis, "
    "pour les polices de caractères qu'il ne permet pas d'héberger, décrites plus haut. "
    "Clerk Inc., États-Unis, pour l'authentification des comptes enseignants et "
    "administrateurs : ce prestataire conserve l'adresse email du titulaire d'un compte, et "
    "tant qu'aucun compte n'est ouvert il ne reçoit rien. Aucun autre prestataire ne reçoit "
    "vos données."
)

ANCIEN_SANS_COMPTE = "Ni nom, ni adresse email, ni mot de passe : il n'y a pas de compte."
NOUVEAU_SANS_COMPTE = (
    "Pour jouer : ni nom, ni adresse email, ni mot de passe, il n'y a aucun compte à créer. "
    "Un compte n'existe que pour un enseignant ou un administrateur, et il est alors décrit "
    "plus bas."
)


def corriger_declaration_tiers() -> str:
    texte = LEGAL.read_text(encoding="utf-8")
    origine = texte
    faits: list[str] = []

    # LE NETTOYAGE EST LOCAL, ET IL DOIT L'ETRE. Une premiere version retirait la
    # phrase puis passait un `replace("  ", " ")` sur TOUT le fichier pour ravaler
    # le double espace laisse derriere : elle a reindente les 175 lignes du
    # document d'un cran et rendu le diff illisible. Le typecheck ne l'a pas vu,
    # TypeScript ne juge pas l'indentation. On coupe donc la phrase AVEC l'espace
    # qui la precede, et rien d'autre du fichier n'est touche.
    if f"{PHRASE_VRAIE} {PHRASE_FAUSSE}" in texte:
        texte = texte.replace(f"{PHRASE_VRAIE} {PHRASE_FAUSSE}", PHRASE_VRAIE)
        faits.append("phrase fausse sur les polices retiree")
    elif PHRASE_FAUSSE in texte:
        texte = texte.replace(f" {PHRASE_FAUSSE}", "").replace(PHRASE_FAUSSE, "")
        faits.append("phrase fausse sur les polices retiree")
    if PHRASE_VRAIE in texte and "Les polices, et le seul tiers" not in texte:
        # La section neuve se pose juste apres « Ce que nous ne collectons pas ».
        ancre = texte.find(PHRASE_VRAIE)
        fin = texte.find("},", ancre)
        if fin != -1:
            texte = texte[: fin + 3] + "\n" + SECTION_POLICES + texte[fin + 3 :]
            faits.append("section sur Adobe Fonts ajoutee")
    if ANCIENS_SOUS_TRAITANTS in texte:
        texte = texte.replace(ANCIENS_SOUS_TRAITANTS, NOUVEAUX_SOUS_TRAITANTS)
        faits.append("Adobe et Clerk ajoutes aux sous-traitants")
    if ANCIEN_SANS_COMPTE in texte:
        texte = texte.replace(ANCIEN_SANS_COMPTE, NOUVEAU_SANS_COMPTE)
        faits.append("la mention « pas de compte » precise le cas des enseignants")

    if texte == origine:
        return "rien a changer"
    LEGAL.write_text(texte, encoding="utf-8")
    return ", ".join(faits)


CSS_LIEN_EVITEMENT = """
/* LIEN D'EVITEMENT, pose par scripts/conformite/conformite.py.
   WCAG 2.4.1, niveau A. Hors de l'ecran tant qu'il n'a pas le focus, visible des
   qu'on l'atteint au clavier. Il n'invente aucune couleur : il reprend les
   jetons de fond, d'encre et de focus de la page, donc il suit le theme et la
   charte sans decider quoi que ce soit a leur place. */
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 1000;
  padding: 0.75rem 1.25rem;
  background: var(--background);
  color: var(--foreground);
  text-decoration: underline;
}

.skip-link:focus {
  left: 0;
  outline: 2px solid var(--focus, currentColor);
  outline-offset: 2px;
}
"""


def corriger_lien_evitement() -> str:
    layout = LAYOUT.read_text(encoding="utf-8")
    faits: list[str] = []

    if "skip-link" not in layout:
        ancre = '<body className="bg-background font-sans antialiased">'
        if ancre not in layout:
            return "ancre du body introuvable, correction abandonnee"
        layout = layout.replace(
            ancre,
            ancre
            + "\n        {/* Lien d'evitement, premier element focusable de la page.\n"
            "            Pose par scripts/conformite/conformite.py. */}\n"
            '        <a href="#contenu" className="skip-link">\n'
            "          Skip to content\n"
            "        </a>",
        )
        faits.append("lien pose en tete du body")

    if 'id="contenu"' not in layout:
        # Une cible focusable sans quoi le lien deplace le defilement sans deplacer
        # le focus. `display: contents` garde la boite hors du flux, et aucun
        # selecteur `body > ` n'existe dans la feuille, verifie le 2026-09-18.
        layout = layout.replace(
            "        {children}",
            '        <div id="contenu" tabIndex={-1} style={{ display: "contents" }}>\n'
            "          {children}\n"
            "        </div>",
            1,
        )
        faits.append("cible #contenu posee autour des pages")

    if faits:
        LAYOUT.write_text(layout, encoding="utf-8")

    feuille = GLOBALS_CSS.read_text(encoding="utf-8")
    if ".skip-link" not in feuille:
        GLOBALS_CSS.write_text(feuille.rstrip() + "\n" + CSS_LIEN_EVITEMENT, encoding="utf-8")
        faits.append("style ajoute a globals.css")

    return ", ".join(faits) if faits else "rien a changer"


def corriger_langue_documents() -> str:
    page = PAGE_LEGALE.read_text(encoding="utf-8")
    if 'lang="fr"' in page:
        return "rien a changer"
    ancre = '<main className="st pf-page">'
    if ancre not in page:
        return "ancre de la page legale introuvable, correction abandonnee"
    page = page.replace(ancre, '<main className="st pf-page" lang="fr">', 1)
    PAGE_LEGALE.write_text(page, encoding="utf-8")
    return "lang=fr pose sur les trois documents legaux"


def corriger_liens_externes() -> str:
    faits: list[str] = []
    for chemin, contenu in fichiers_source():
        if 'target="_blank"' not in contenu:
            continue
        lignes = contenu.splitlines(keepends=True)
        change = False
        for index, ligne in enumerate(lignes):
            if 'target="_blank"' in ligne and "noopener" not in ligne and "noreferrer" not in ligne:
                lignes[index] = ligne.replace(
                    'target="_blank"', 'target="_blank" rel="noopener noreferrer"'
                )
                change = True
        if change:
            chemin.write_text("".join(lignes), encoding="utf-8")
            faits.append(relatif(chemin))
    global _cache_fichiers
    _cache_fichiers = None
    return ("rel ajoute dans " + ", ".join(faits)) if faits else "rien a changer"


ROBOTS = '''import type { MetadataRoute } from "next";

// CE QUI NE DOIT PAS ETRE INDEXE, ET POURQUOI.
//
// Pose par scripts/conformite/conformite.py.
//
// `/admin` lit l'usage reel du produit et des demandes d'acces, donc des noms et
// des adresses. `/dev` expose les outils du laboratoire typographique. `/api`
// n'a rien a faire dans un moteur de recherche. `/assigned` porte le devoir d'un
// eleve, adresse par adresse : une adresse indexee est un devoir lisible par
// n'importe qui.
//
// Une consigne d'indexation n'est PAS un controle d'acces : elle demande, elle
// n'empeche pas. La porte de `/admin` est dans lib/admin/gate.ts, celle des
// routes de developpement dans lib/dev-mode.ts. Ce fichier evite la fuite la plus
// betement evitable, celle qui ne demande aucune competence.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/dev", "/assigned", "/sign-in"],
      },
    ],
  };
}
'''

SITEMAP = '''import type { MetadataRoute } from "next";

// LES PAGES PUBLIQUES, ET RIEN D'AUTRE.
//
// Pose par scripts/conformite/conformite.py.
//
// Volontairement tenu a la main plutot que derive des routes : `app/` contient
// des routes d'administration, de developpement et de devoir, et une generation
// automatique les ferait entrer ici au premier ajout. Une liste courte qu'on
// met a jour est plus sure qu'une liste complete qu'on ne relit jamais.
//
// L'adresse de base vient de l'environnement pour que le fichier ne fige pas un
// domaine que le proprietaire pourrait changer.
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dwiggins.fr";

const PAGES = [
  "/",
  "/play",
  "/compare",
  "/legal/mentions-legales",
  "/legal/confidentialite",
  "/legal/cgu",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const maintenant = new Date();
  return PAGES.map((chemin) => ({
    url: `${BASE}${chemin}`,
    lastModified: maintenant,
  }));
}
'''


def corriger_robots_sitemap() -> str:
    faits: list[str] = []
    robots = RACINE / "app" / "robots.ts"
    plan = RACINE / "app" / "sitemap.ts"
    if not robots.exists():
        robots.write_text(ROBOTS, encoding="utf-8")
        faits.append("app/robots.ts cree")
    if not plan.exists():
        plan.write_text(SITEMAP, encoding="utf-8")
        faits.append("app/sitemap.ts cree")
    return ", ".join(faits) if faits else "rien a changer"


# ---------------------------------------------------------------------------
# Deroule
# ---------------------------------------------------------------------------

VERIFICATIONS: list[Callable[[], Constat]] = [
    verif_tiers_non_declares,
    verif_sous_traitants,
    verif_cookies,
    verif_cles,
    verif_marqueurs_editeur,
    verif_admin_ferme,
    verif_licence_marque,
    verif_lien_evitement,
    verif_langue_documents,
    verif_controles_inertes,
    verif_liens_externes,
    verif_robots_sitemap,
    verif_entetes,
    verif_metadata,
    verif_retention,
    verif_code_distant,
    verif_allegations,
    verif_formulaires,
]


def auditer() -> list[Constat]:
    constats = [verification() for verification in VERIFICATIONS]
    constats.extend(verif_gardes())
    constats.sort(key=lambda c: (ORDRE_GRAVITE.get(c.gravite, 9), c.id))
    return constats


def sauvegarder() -> str:
    """Un filet avant d'ecrire. Une correction annulable n'est plus une correction risquee."""
    horodatage = subprocess.run(
        ["git", "stash", "create"], cwd=RACINE, capture_output=True, text=True
    )
    empreinte = horodatage.stdout.strip()
    if empreinte:
        subprocess.run(
            ["git", "tag", f"conformite-avant-{date.today():%Y-%m-%d}-{empreinte[:7]}", empreinte],
            cwd=RACINE,
            capture_output=True,
            text=True,
        )
        return f"etat sauvegarde dans l'objet git {empreinte[:7]}"
    return "arbre propre, rien a sauvegarder"


def corriger(constats: list[Constat]) -> list[tuple[str, str]]:
    applique: list[tuple[str, str]] = []
    for constat in constats:
        if not constat.corrigeable:
            continue
        try:
            resultat = constat.correction()  # type: ignore[misc]
        except Exception as erreur:  # une correction ratee ne doit pas tuer l'audit
            resultat = f"ECHEC : {erreur}"
        applique.append((constat.id, resultat))
    return applique


def compter(constats: Iterable[Constat]) -> dict[str, int]:
    compte = {CONFORME: 0, ECART: 0, ATTENTE: 0}
    for constat in constats:
        compte[constat.etat] = compte.get(constat.etat, 0) + 1
    return compte


def afficher(constats: list[Constat]) -> None:
    compte = compter(constats)
    print()
    print(f"AUDIT DE CONFORMITE  ·  {date.today():%Y-%m-%d}")
    print(f"{compte[CONFORME]} conformes  ·  {compte[ECART]} ecarts  ·  {compte[ATTENTE]} en attente du proprietaire")
    print()

    for etat, entete in (
        (ECART, "ECARTS, a corriger"),
        (ATTENTE, "EN ATTENTE, personne d'autre que le proprietaire ne peut les lever"),
        (CONFORME, "CONFORMES"),
    ):
        groupe = [c for c in constats if c.etat == etat]
        if not groupe:
            continue
        print(entete)
        for constat in groupe:
            marque = "corrigeable" if constat.corrigeable else ""
            print(f"  [{constat.gravite}] {constat.titre}" + (f"  ({marque})" if marque else ""))
            if etat != CONFORME:
                for ligne in envelopper(constat.constat):
                    print(f"      {ligne}")
                if constat.renvoi:
                    print(f"      -> {constat.renvoi}")
        print()


def envelopper(texte: str, largeur: int = 88) -> list[str]:
    mots = texte.split()
    lignes: list[str] = []
    courante = ""
    for mot in mots:
        if len(courante) + len(mot) + 1 > largeur:
            lignes.append(courante)
            courante = mot
        else:
            courante = f"{courante} {mot}".strip()
    if courante:
        lignes.append(courante)
    return lignes


def ecrire_rapport(constats: list[Constat], applique: list[tuple[str, str]]) -> Path:
    DOSSIER_RAPPORTS.mkdir(parents=True, exist_ok=True)
    chemin = DOSSIER_RAPPORTS / f"{date.today():%Y-%m}.md"
    compte = compter(constats)

    lignes = [
        f"# Conformite — {date.today():%B %Y}",
        "",
        f"Passage du {date.today():%Y-%m-%d}, par `scripts/conformite/conformite.py`.",
        "",
        f"**{compte[CONFORME]} conformes, {compte[ECART]} ecarts, {compte[ATTENTE]} en attente du proprietaire.**",
        "",
        "Un ecart est un defaut du depot. Une attente est une information ou une decision "
        "que seul le proprietaire detient : elle ne fait pas echouer la porte, et elle "
        "revient ici chaque mois tant qu'elle n'est pas levee.",
        "",
    ]

    if applique:
        lignes += ["## Corrections appliquees ce mois-ci", ""]
        lignes += [f"- `{identifiant}` : {resultat}" for identifiant, resultat in applique]
        lignes += [""]

    for etat, entete in (
        (ECART, "## Ecarts"),
        (ATTENTE, "## En attente du proprietaire"),
        (CONFORME, "## Conformes"),
    ):
        groupe = [c for c in constats if c.etat == etat]
        if not groupe:
            continue
        lignes += [entete, ""]
        for constat in groupe:
            lignes.append(f"### {constat.titre}")
            lignes.append("")
            lignes.append(f"Gravite : {constat.gravite}.")
            lignes.append("")
            lignes.append(constat.constat)
            if constat.renvoi:
                lignes += ["", f"Fichier : `{constat.renvoi}`"]
            if constat.details and etat != CONFORME:
                lignes += [""] + [f"- {d}" for d in constat.details[:20]]
            lignes.append("")

    chemin.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    return chemin


def principal() -> int:
    analyseur = argparse.ArgumentParser(
        description="Audit de conformite mensuel du site DWIGGINS.",
    )
    analyseur.add_argument(
        "--corriger",
        action="store_true",
        help="applique les corrections automatiques, apres sauvegarde de l'etat",
    )
    analyseur.add_argument("--json", action="store_true", help="sortie machine")
    analyseur.add_argument(
        "--sans-rapport", action="store_true", help="n'ecrit pas docs/process/conformite/AAAA-MM.md"
    )
    options = analyseur.parse_args()

    constats = auditer()
    applique: list[tuple[str, str]] = []

    if options.corriger:
        corrigeables = [c for c in constats if c.corrigeable]
        if corrigeables:
            print(sauvegarder())
            applique = corriger(constats)
            global _cache_fichiers
            _cache_fichiers = None
            constats = auditer()

    if options.json:
        print(
            json.dumps(
                {
                    "date": f"{date.today():%Y-%m-%d}",
                    "compte": compter(constats),
                    "corrections": [{"id": i, "resultat": r} for i, r in applique],
                    "constats": [
                        {
                            "id": c.id,
                            "titre": c.titre,
                            "gravite": c.gravite,
                            "etat": c.etat,
                            "constat": c.constat,
                        }
                        for c in constats
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        afficher(constats)
        if applique:
            print("CORRECTIONS APPLIQUEES")
            for identifiant, resultat in applique:
                print(f"  {identifiant} : {resultat}")
            print()
            print("A REGARDER A L'ECRAN : le lien d'evitement et la mention de langue")
            print("posent quelque chose de visible. Le script ne juge pas de l'apparence.")
            print()

    if not options.sans_rapport:
        chemin = ecrire_rapport(constats, applique)
        if not options.json:
            print(f"Rapport : {relatif(chemin)}")

    restants = compter(constats)[ECART]
    if not options.json:
        if restants:
            print(f"\nSortie 1 : {restants} ecart(s) non corrige(s).")
        else:
            print("\nSortie 0 : aucun ecart. Les attentes ci-dessus ne sont pas des echecs du depot.")
    return 1 if restants else 0


if __name__ == "__main__":
    sys.exit(principal())
