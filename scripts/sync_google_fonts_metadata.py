"""
sync_google_fonts_metadata.py

Collecte l'endpoint public de metadonnees de Google Fonts et en fait un
instantane exploitable par le pipeline de catalogue.

POURQUOI CET ENDPOINT ET PAS L'API DEVELOPPEUR. scripts/sync_google_fonts_api.py
interroge https://www.googleapis.com/webfonts/v1/webfonts, qui exige une cle
GOOGLE_FONTS_API_KEY. Personne n'en a pose sur ce projet, et cette API ne rend
de toute facon ni popularity ni trending ni classifications. L'endpoint utilise
ici est celui du site fonts.google.com, public, sans cle, et il rend les six
champs dont le classement de notoriete a besoin. Mesure du 2026-08-19 :
1942 familles.

PIEGE DE PARSING. La reponse commence par la sequence anti detournement JSON
)]}' suivie d'un retour a la ligne. json.loads echoue dessus sans rien
expliquer, il faut retirer la premiere ligne.

Usage :
    ./.venv/bin/python scripts/sync_google_fonts_metadata.py \
      --output-dir content/catalog/google-metadata-sync
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

ENDPOINT = "https://fonts.google.com/metadata/fonts"
DEFAULT_OUTPUT_DIR = Path("content/catalog/google-metadata-sync")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collecte les metadonnees publiques de Google Fonts."
    )
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument(
        "--input-json",
        help="Lire un fichier deja telecharge au lieu d'appeler le reseau.",
    )
    return parser.parse_args()


def strip_xssi_prefix(raw: str) -> str:
    """Retire la sequence anti detournement )]}' que Google prefixe."""
    if raw.startswith(")]}'"):
        return raw.split("\n", 1)[1]
    return raw


def fetch_payload(input_json: str | None) -> dict:
    if input_json:
        raw = Path(input_json).read_text(encoding="utf-8")
    else:
        with urlopen(ENDPOINT, timeout=60) as response:
            raw = response.read().decode("utf-8")
    return json.loads(strip_xssi_prefix(raw))


def normalise(payload: dict) -> list[dict]:
    familles = []
    for entry in payload.get("familyMetadataList", []):
        familles.append(
            {
                "family": entry["family"],
                # rank est ajoute apres le tri, plus bas.
                "popularity": entry["popularity"],
                "trending": entry.get("trending"),
                "category": entry.get("category"),
                "stroke": entry.get("stroke"),
                "classifications": entry.get("classifications", []),
                "designers": entry.get("designers", []),
                "date_added": entry.get("dateAdded"),
            }
        )
    # Rang DENSE de 1 a N, departage par nom de famille.
    #
    # POURQUOI PAS popularity DIRECTEMENT. Mesure du 2026-08-19 : Google rend
    # 1942 familles pour 1182 valeurs de popularity distinctes, l'echelle est
    # creuse et monte a 2096. Un seuil pose sur popularity ne selectionne donc pas
    # le nombre de polices qu'il annonce : popularity <= 300 rend 537 familles.
    # Le rang dense rend l'inverse vrai, les 300 premieres valent 300.
    #
    # Le departage par nom rend le classement reproductible : sans lui, deux
    # familles a egalite de popularity changeraient de place d'une collecte a
    # l'autre, et le palier d'une police bougerait sans raison.
    familles.sort(key=lambda f: (f["popularity"], f["family"]))
    for position, famille in enumerate(familles, start=1):
        famille["rank"] = position
    return familles


def main() -> int:
    args = parse_args()
    payload = fetch_payload(args.input_json)
    familles = normalise(payload)

    if not familles:
        print("Aucune famille collectee, l'endpoint a repondu sans familyMetadataList.")
        return 1

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    snapshot = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "google_fonts_metadata_endpoint",
        "families": familles,
    }
    cible = output_dir / "metadata-snapshot.json"
    cible.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"{len(familles)} familles ecrites dans {cible}")
    print(f"les cinq plus populaires : {', '.join(f['family'] for f in familles[:5])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
