#!/usr/bin/env python3
"""Registre de distillation de la checklist.

Ce script ne distille RIEN. Decider que trois phrases d'une note de 900 mots sont le
pourquoi durable et que le reste est du journal de bord releve du jugement, pas du
decoupage : un script qui s'en chargerait produirait du resume automatique.

Il tient la comptabilite, et c'est ce qui rend le chantier reprenable. Il decoupe la
checklist en notes numerotees, propose un theme a partir des mots du titre, et suit
pour chacune si elle est rangee, ecartee ou en attente. Le proprietaire du projet tombe
souvent hors reseau et les agents meurent : sans registre, une interruption a la note 82
oblige a tout relire, ou pire, a ignorer ou on s'est arrete.

La regle qu'il fait respecter : a la fin, chaque note est soit rangee dans un theme, soit
ecartee AVEC UN MOTIF ECRIT. Jamais perdue en silence.

    python3 scripts/distillation/registre.py            # construit ou met a jour
    python3 scripts/distillation/registre.py --verifier  # controle de completude, sort 1 si trou
"""

import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
# Pointe vers l'ARCHIVE depuis le 2026-09-18 : la distillation portait sur l'ancien
# journal, qui a ete bascule ce jour la. Le journal courant repart vide et n'a rien a
# distiller. Ce script reste ici pour que --verifier puisse rejouer le controle de
# completude sur le corpus d'origine.
SOURCE = RACINE / "docs/archive/checklist-2026-03-19-a-2026-09-18.md"
REGISTRE = RACINE / "scripts/distillation/registre.json"

# Les themes visent les dossiers de docs/ qui existent deja et qui fonctionnent :
# typography tient 11 fichiers pour 8000 mots, ui 8 fichiers pour 11 000. C'est le
# grain a viser, pas un fichier geant par theme.
THEMES = {
    "typographie": ["adobe", "kit", "police", "polices", "typo", "famille", "familles",
                    "webfont", "glyphe", "glyphes", "specimen", "specimens", "latin", "fonte",
                    "fontes", "caractere", "ozq5yfs", "typekit", "italique", "graisse",
                    "anatomie", "metrique", "metriques", "chasse", "empattement", "slug"],
    "jeu": ["competition", "chrono", "seance", "seances", "partie", "parties", "score",
            "scoring", "entrainement", "training", "question", "questions", "pool", "rarete",
            "moteur", "joueur", "joueurs", "badge", "badges", "maitrise", "confusion",
            "confusions", "distracteur", "reponse", "reponses", "cran d'exigence", "niveau",
            "progression", "serie", "streak", "jouer", "manche"],
    "interface": ["couleur", "couleurs", "violet", "bloc", "blocs", "boite", "boites",
                  "landing", "intro", "motion", "contraste", "panneau", "panneaux",
                  "etoile", "mise en page", "surface", "surfaces", "home", "recap",
                  "rythme", "composition", "rectangle",
                  "barre", "gouttiere", "filet", "ombre", "rayon", "espacement", "sombre", "clair",
                  "pastille", "animation", "defilement", "logo",
                  "pied de page", "nav", "lisible", "lisibilite"],
    "prof-ecole": ["prof", "professeur", "eleve", "eleves", "classe", "classes", "exercice",
                   "exercices", "devoir", "devoirs", "compositeur", "assigne", "assignee",
                   "enseignant", "ecole", "scolaire", "roster", "etablissement", "eleve"],
    "admin": ["admin", "administration", "tableau de bord", "signal", "signaux", "cockpit",
              "audience", "demandes", "poste d'observation", "metrique d'usage", "pouls"],
    "base": ["migration", "migrations", "base", "table", "tables", "neon", "sql", "schema",
             "compteur", "compteurs", "backfill", "postgres", "requete", "requetes",
             "en production", "branche jetable", "instantane", "021", "022", "023", "024",
             "025", "011", "013", "017"],
    "mise-en-ligne": ["legal", "rgpd", "conformite", "securite", "domaine", "vercel",
                      "deploiement", "mise en ligne", "politique", "cookie", "robots",
                      "sitemap", "clerk", "licence", "publication", "identite",
                      "fournisseur", "authentification", "connexion", "audit", "en-tete",
                      "faille", "secret", "jeton", "wcag", "accessibilite"],
}

# Les sections qui ne sont pas des notes : elles decrivent la checklist elle-meme ou
# pointent ailleurs. Les router serait une erreur de categorie.
#
# Le test porte sur le DEBUT du titre et non sur une sous-chaine quelconque. La premiere
# version cherchait « reprise » n'importe ou, et a donc ecarte deux vraies notes de
# journal intitulees « ... et point de reprise » et « Ou en est la charte a la reprise ».
# Un tri qui ecarte en silence est precisement ce que ce registre existe pour empecher,
# et il s'est fait prendre par son propre defaut.
STRUCTURELLES = ["comment lire", "en resume", "reprise —", "reprise -"]

SANS_ACCENT = str.maketrans("àâäéèêëîïôöùûüç", "aaaeeeeiioouuuc")


def normaliser(texte: str) -> str:
    return texte.lower().translate(SANS_ACCENT)


def proposer_theme(titre: str, corps: str) -> tuple[str, dict[str, int]]:
    """Rend le theme le mieux note et le detail du score.

    Le titre pese 3 et le corps 1 : chez ce proprietaire les titres portent deja la
    trouvaille, mais seul le corps nomme les fichiers et les notions, et router sur le
    titre seul laissait 45 % des notes sans theme.

    L'ambiguite reste VISIBLE : si le premier ne devance pas le second d'au moins moitie,
    la note sort en « ? » plutot que d'etre rangee en silence du cote qui a gagne d'un
    point. Une note sur la couleur de la fiche Classe est legitimement interface ET
    prof-ecole, et c'est a un humain de trancher.
    """
    tn, cn = normaliser(titre), normaliser(corps)
    if any(tn.startswith(s) for s in STRUCTURELLES):
        return "structurelle", {}
    scores = {}
    for theme, mots in THEMES.items():
        # mots DISTINCTS touches, pas occurrences : une note qui repete « police »
        # quarante fois n'est pas quarante fois plus typographique.
        dans_titre = sum(1 for m in mots if re.search(rf"\b{re.escape(m)}", tn))
        dans_corps = sum(1 for m in mots if re.search(rf"\b{re.escape(m)}", cn))
        brut = 3 * dans_titre + dans_corps
        if brut:
            # normalise par la taille de la liste, sinon le theme au vocabulaire le
            # plus large gagne par volume et avale tout le reste.
            scores[theme] = round(100 * brut / len(mots))
    if not scores:
        return "?", {}
    classement = sorted(scores.values(), reverse=True)
    if len(classement) > 1 and classement[0] < 1.5 * classement[1]:
        return "?", scores
    meilleur = max(scores, key=lambda k: scores[k])
    return meilleur, scores


def nature(titre: str) -> str:
    """Trois natures cohabitent dans ce fichier, et elles ne se distillent pas pareil.

    Le JOURNAL (158 sections, 107 000 mots) est chronologique : c'est lui qui demande le
    vrai travail de distillation, puisque le pourquoi durable y est noye dans le recit de
    la journee. Les sections LETTREES A a I (9 sections, 15 700 mots) sont la checklist
    d'origine, deja rangee par sujet : elles se deplacent presque telles quelles. Le reste
    est heteroclite, dont « Gains rapides » qui pese a lui seul 28 200 mots.
    """
    tn = normaliser(titre)
    if any(tn.startswith(s) for s in STRUCTURELLES):
        return "structurelle"
    if re.match(r"^[A-Z] —", titre):
        return "lettree"
    if titre.startswith(("Note —", "Journal —")) or re.match(r"^\d{4}-\d{2}-\d{2}", titre):
        return "journal"
    return "autre"


def decouper() -> list[dict]:
    texte = SOURCE.read_text(encoding="utf-8")
    lignes = texte.split("\n")
    notes, courante = [], None
    for ligne in lignes:
        if ligne.startswith("## "):
            if courante:
                notes.append(courante)
            titre = ligne[3:].strip()
            date = m.group(1) if (m := re.search(r"(\d{4}-\d{2}-\d{2})", titre)) else ""
            courante = {"titre": titre, "date": date, "corps": []}
        elif courante:
            courante["corps"].append(ligne)
    if courante:
        notes.append(courante)

    registre = []
    for i, note in enumerate(notes, start=1):
        corps = "\n".join(note["corps"])
        theme, scores = proposer_theme(note["titre"], corps)
        registre.append({
            "id": i,
            "date": note["date"],
            "titre": note["titre"],
            "mots": len(corps.split()),
            "theme_propose": theme,
            "scores": scores,
            "nature": nature(note["titre"]),
            "theme_retenu": None,
            "etat": "a_faire",       # a_faire | rangee | ecartee
            "motif": None,            # obligatoire si ecartee
            # liste et non chaine : une note de 3000 mots sur l'audit de securite
            # nourrit legitimement deux ou trois fiches, et forcer une destination
            # unique obligerait a en perdre.
            "destinations": [],
        })
    return registre


def charger_ou_construire() -> list[dict]:
    neuf = decouper()
    if not REGISTRE.exists():
        return neuf
    # Une reconstruction ne doit jamais effacer le travail deja fait : on reprend
    # l'etat des notes connues par leur titre, qui est stable.
    ancien = {n["titre"]: n for n in json.loads(REGISTRE.read_text(encoding="utf-8"))}
    for note in neuf:
        if (a := ancien.get(note["titre"])):
            note.update({k: a[k] for k in ("theme_retenu", "etat", "motif", "destinations")})
    return neuf


def verifier(registre: list[dict]) -> int:
    trous = []
    for n in registre:
        if n["etat"] == "ecartee" and not n["motif"]:
            trous.append(f"note {n['id']} ecartee sans motif : {n['titre'][:70]}")
        if n["etat"] == "rangee" and not n["destinations"]:
            trous.append(f"note {n['id']} rangee sans destination : {n['titre'][:70]}")
    restantes = [n for n in registre if n["etat"] == "a_faire"]
    if trous:
        print("Registre incomplet :")
        for t in trous:
            print(f"- {t}")
        return 1
    if restantes:
        print(f"Distillation en cours : {len(restantes)} notes sur {len(registre)} restent a traiter.")
        return 0
    print(f"Distillation complete : les {len(registre)} notes sont rangees ou ecartees avec motif.")
    return 0


def resumer(registre: list[dict]) -> None:
    total_mots = sum(n["mots"] for n in registre)
    print(f"{len(registre)} notes, {total_mots} mots.\n")
    par_nature: dict[str, list[dict]] = {}
    for n in registre:
        par_nature.setdefault(n["nature"], []).append(n)
    print("Par nature, parce qu'elles ne se distillent pas pareil :")
    for nat, notes in sorted(par_nature.items(), key=lambda kv: -sum(n["mots"] for n in kv[1])):
        print(f"  {len(notes):3d} sections · {sum(n['mots'] for n in notes):6d} mots · {nat}")
    print("\nPar theme propose :")
    par_theme: dict[str, list[dict]] = {}
    for n in registre:
        par_theme.setdefault(n["theme_propose"], []).append(n)
    for theme, notes in sorted(par_theme.items(), key=lambda kv: -len(kv[1])):
        mots = sum(n["mots"] for n in notes)
        libelle = "A TRANCHER (aucun theme net)" if theme == "?" else theme
        print(f"  {len(notes):3d} notes · {mots:6d} mots · {libelle}")
    faites = sum(1 for n in registre if n["etat"] != "a_faire")
    print(f"\nAvancement : {faites}/{len(registre)}")


def main() -> int:
    registre = charger_ou_construire()
    REGISTRE.write_text(json.dumps(registre, ensure_ascii=False, indent=2), encoding="utf-8")
    if "--verifier" in sys.argv:
        return verifier(registre)
    resumer(registre)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
