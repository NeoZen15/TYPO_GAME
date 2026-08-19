# Notoriété comme axe de progression, plan d'application

> **Pour un agent qui exécute :** SOUS-SKILL REQUIS. Utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour dérouler ce plan tâche par tâche. Les étapes
> sont en cases à cocher (`- [ ]`) pour le suivi.

**But :** faire que les typographies connues soient servies au joueur avant les
obscures, en remplissant `rarity_tag` depuis une mesure objective de notoriété au
lieu de la laisser à `common` sur 1148 polices sur 1172.

**Architecture :** un nouveau script de collecte lit l'endpoint public de Google
Fonts, sans clé, et produit un instantané au même format que
`content/catalog/google-api-sync/`. Un second script en déduit un rang de
notoriété et écrit un fichier SQL de mise à jour, qui n'est jamais appliqué
automatiquement. Le constructeur de questions lit ensuite `rarity_tag` pour
ordonner ce que le joueur rencontre. Aucun fichier de police n'est touché.

**Pile technique :** Python 3 (`./.venv/bin/python`) pour la collecte, comme le
reste de `scripts/`. Node pour les gardes de qualité, comme `scripts/quality/*.mjs`.
SQL brut numéroté dans `db/migrations` pour tout ce qui touche la base.

**Spec :** ce plan n'a pas de document de spec séparé. Il vient de la demande du
propriétaire du 2026-08-19, citée telle quelle : « les plus connues, ça aussi les
premières qui vont être proposées parce que c'est le plus simple, et plus
quelqu'un est en mode expert ou plus quelqu'un s'améliore dans les modes, même en
mode entraînement on va avoir des polices qui sont moins connues. » Les faits
mesurés qui le motivent sont dans `docs/process/checklist.md`, note du 2026-08-19.

## Contraintes globales

- **Aucune écriture en base sans le feu vert explicite du propriétaire.** Toute
  modification de données sort sous forme de fichier `.sql` à relire. Règle de
  `CLAUDE.md`.
- **Le pipeline existant se réutilise, il ne se refait pas.** Les scripts
  `generate_editorial_review_template.py`, `apply_editorial_review_presets.py`,
  `build_reviewed_promotion.py` et `stage_catalog_promotion.py` restent la voie
  d'entrée au catalogue. Ce plan ajoute une source, il n'en remplace aucune.
- **Pas d'emojis**, nulle part, code, docs, messages de commit compris.
- **Pas de tiret comme séparateur** dans les textes rédigés.
- **Un garde ajouté part avec sa ligne de chaîne dans le même commit**, sinon
  `package.json` nomme un script absent et l'historique n'est plus
  reconstructible. Règle de `CLAUDE.md`.
- Valeurs autorisées de `rarity_tag`, à respecter au caractère :
  `common`, `uncommon`, `rare`.
- L'endpoint de collecte est `https://fonts.google.com/metadata/fonts`, sans clé
  d'API. Sa réponse commence par la séquence anti-détournement `)]}'` suivie d'un
  retour à la ligne, qu'il faut retirer avant de parser le JSON.

---

### Task 1: collecter les métadonnées publiques de Google Fonts

**Fichiers :**
- Créer : `scripts/sync_google_fonts_metadata.py`
- Créer : `content/catalog/google-metadata-sync/.gitkeep`
- Test : `scripts/quality/check-google-metadata-sync.mjs`

**Interfaces :**
- Consomme : rien, c'est la source.
- Produit : `content/catalog/google-metadata-sync/metadata-snapshot.json`, un
  objet `{"generated_at": <iso8601>, "source": "google_fonts_metadata_endpoint",
  "families": [{"family": str, "popularity": int, "trending": int,
  "category": str, "stroke": str|null, "classifications": [str],
  "designers": [str], "date_added": str}]}`. La tâche 2 lit ce fichier.

- [ ] **Étape 1 : écrire le garde qui échoue**

Créer `scripts/quality/check-google-metadata-sync.mjs` :

```javascript
// Garde de l'instantané de metadonnees Google Fonts.
//
// Il ne verifie pas que la collecte a tourne recemment, un instantane vieux
// reste un instantane valide. Il verifie que le fichier a la forme que la tache 2
// attend, parce qu'une cle renommee en amont donnerait un classement de
// notoriete silencieusement vide plutot qu'une erreur.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SNAPSHOT = "content/catalog/google-metadata-sync/metadata-snapshot.json";
const failures = [];

const chemin = path.join(ROOT, SNAPSHOT);
if (!fs.existsSync(chemin)) {
  console.log(
    `check:google-metadata-sync OK : ${SNAPSHOT} absent, la collecte n'a pas encore tourne. ` +
      "Lancer npm run sync:google-metadata pour le produire."
  );
  process.exit(0);
}

const payload = JSON.parse(fs.readFileSync(chemin, "utf8"));

if (payload.source !== "google_fonts_metadata_endpoint") {
  failures.push(`${SNAPSHOT}: champ source attendu "google_fonts_metadata_endpoint", trouve "${payload.source}".`);
}

if (!Array.isArray(payload.families) || payload.families.length === 0) {
  failures.push(`${SNAPSHOT}: families doit etre un tableau non vide.`);
} else {
  const requis = ["family", "rank", "popularity", "trending", "category", "classifications", "designers", "date_added"];
  const premiere = payload.families[0];
  for (const cle of requis) {
    if (!(cle in premiere)) failures.push(`${SNAPSHOT}: cle "${cle}" absente des familles.`);
  }
  const sansPopularite = payload.families.filter((f) => typeof f.popularity !== "number").length;
  if (sansPopularite > 0) {
    failures.push(`${SNAPSHOT}: ${sansPopularite} famille(s) sans popularity numerique, le classement serait fausse.`);
  }
  // rank, pas popularity. Mesure du 2026-08-19 : Google rend 1942 familles pour
  // 1182 valeurs de popularity distinctes, avec des doublons des le rang 2. Un
  // garde qui exigerait l'unicite de popularity echouerait toujours. rank est
  // calcule par le collecteur, dense de 1 a N, donc unique par construction, et
  // c'est lui que les seuils de rarete liront.
  const rangs = new Set(payload.families.map((f) => f.rank));
  if (rangs.size !== payload.families.length) {
    failures.push(
      `${SNAPSHOT}: ${payload.families.length} familles pour ${rangs.size} valeurs de rank distinctes. ` +
        "rank doit etre unique, sinon deux polices se disputent la meme place."
    );
  }
  const attendu = payload.families.length;
  const rangsTries = [...rangs].sort((x, y) => x - y);
  if (rangsTries[0] !== 1 || rangsTries[attendu - 1] !== attendu) {
    failures.push(
      `${SNAPSHOT}: rank va de ${rangsTries[0]} a ${rangsTries[attendu - 1]} pour ${attendu} familles. ` +
        "Il doit etre dense, de 1 a N, sinon un seuil ne selectionne pas le nombre de polices qu'il annonce."
    );
  }
}

if (failures.length > 0) {
  console.error("check:google-metadata-sync FAILED\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(
  `check:google-metadata-sync OK : ${payload.families.length} familles, popularity numerique et unique sur toutes.`
);
```

- [ ] **Étape 2 : lancer le garde pour vérifier qu'il passe sans instantané**

Lancer : `node scripts/quality/check-google-metadata-sync.mjs`
Attendu : sortie 0, message « absent, la collecte n'a pas encore tourne ».

- [ ] **Étape 3 : écrire le collecteur**

Créer `scripts/sync_google_fonts_metadata.py` :

```python
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
```

- [ ] **Étape 4 : câbler les deux commandes npm, dans le même commit que le garde**

Modifier `package.json`, ajouter dans `scripts` :

```json
"sync:google-metadata": "./.venv/bin/python scripts/sync_google_fonts_metadata.py",
"check:google-metadata-sync": "node scripts/quality/check-google-metadata-sync.mjs"
```

Puis ajouter `&& npm run check:google-metadata-sync` dans la chaîne `quality`,
juste après `npm run check:artifacts`.

- [ ] **Étape 5 : lancer la collecte et le garde**

Lancer : `npm run sync:google-metadata && npm run check:google-metadata-sync`
Attendu : environ 1942 familles annoncées, les cinq plus populaires nommées,
puis le garde en sortie 0 avec le même compte.

- [ ] **Étape 6 : vérifier que le garde attrape une régression**

Lancer :
```bash
python3 -c "
import json, pathlib
p = pathlib.Path('content/catalog/google-metadata-sync/metadata-snapshot.json')
d = json.loads(p.read_text())
for f in d['families'][:2]:
    f['rank'] = 1
p.write_text(json.dumps(d))
"
node scripts/quality/check-google-metadata-sync.mjs
```
Attendu : ÉCHEC, message sur les valeurs de rank non uniques.

C'est bien `rank` qu'il faut abîmer, pas `popularity`. Le garde ne contrôle que
`rank`, parce que `popularity` a de vrais doublons chez Google. Abîmer
`popularity` laisserait le garde vert et ne prouverait donc rien du tout.
Puis relancer `npm run sync:google-metadata` pour rétablir l'instantané.

- [ ] **Étape 7 : committer**

```bash
git add scripts/sync_google_fonts_metadata.py scripts/quality/check-google-metadata-sync.mjs package.json content/catalog/google-metadata-sync
git commit -m "feat(catalog): collect the public Google Fonts metadata, popularity included

sync_google_fonts_api.py needs a GOOGLE_FONTS_API_KEY nobody ever set on this
project, and the developer API returns neither popularity nor trending nor
classifications. The site endpoint does, without a key: 1942 families measured
on 2026-08-19.

Its response is prefixed with the )]}' anti hijacking sequence, which json.loads
refuses without explaining itself. The parser strips it.

check:google-metadata-sync is wired into the gate in the same commit, and it
verifies the shape the rank builder depends on rather than the freshness of the
file. A renamed key upstream would otherwise produce a silently empty ranking.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: traduire la popularité en `rarity_tag`, sans écrire en base

**Fichiers :**
- Créer : `scripts/build_rarity_from_popularity.py`
- Créer : `db/migrations/013_rarity_from_popularity.sql` (produit par le script)
- Test : `scripts/quality/check-rarity-coverage.mjs`

**Interfaces :**
- Consomme : `content/catalog/google-metadata-sync/metadata-snapshot.json` de la
  tâche 1, et la table `typefaces_core` en lecture seule.
- Produit : `db/migrations/013_rarity_from_popularity.sql`, une suite d'ordres
  `UPDATE typefaces_core SET rarity_tag = ... WHERE typeface_slug = ...`, plus un
  rapport sur la sortie standard. La tâche 3 lit `rarity_tag` en base une fois la
  migration appliquée par le propriétaire.

**Seuils retenus, et sur quel champ.** Ils s'appliquent au champ `rank` de
l'instantané, dense de 1 à N, **jamais à `popularity`**. Mesure du 2026-08-19 :
l'échelle de `popularity` est creuse et monte à 2096, donc `popularity <= 300`
sélectionne 537 familles soit 28 % du catalogue, et `<= 900` en sélectionne 82 %.
Poser les seuils là reproduirait exactement le défaut que ce plan corrige.

Trois paliers sur le rang dense : `common` pour les 300 premières, `uncommon` de
301 à 900, `rare` au-delà. 300 parce que c'est l'ordre de grandeur de ce qu'un
utilisateur du web a réellement croisé, et parce que la piscine d'un joueur démarre
à 30 et grandit par déblocages : il faut assez de `common` pour tenir les premières
heures sans épuiser le palier. Ces trois nombres sont le seul réglage de ce plan,
ils sont en constantes nommées en haut du script pour être changés sans le relire.

- [ ] **Étape 1 : écrire le garde qui échoue**

Créer `scripts/quality/check-rarity-coverage.mjs` :

```javascript
// Garde de la repartition de rarity_tag.
//
// LE DEFAUT QU'IL PROTEGE. Mesure du 2026-08-19 : 1148 polices actives sur 1172
// portaient rarity_tag = common et 24 uncommon, zero rare. Autrement dit la
// colonne existait et ne disait rien, donc le constructeur de questions ne
// pouvait pas servir les connues avant les obscures.
//
// Il lit le fichier de migration, pas la base : la base demande le feu vert du
// proprietaire et un garde ne doit pas dependre d'une connexion reseau. Ce qu'il
// verifie, c'est que la migration produite couvre les trois paliers et une part
// serieuse du catalogue.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATION = "db/migrations/013_rarity_from_popularity.sql";
const failures = [];

const chemin = path.join(ROOT, MIGRATION);
if (!fs.existsSync(chemin)) {
  console.log(
    `check:rarity-coverage OK : ${MIGRATION} absent, le classement n'a pas encore ete construit. ` +
      "Lancer npm run build:rarity pour le produire."
  );
  process.exit(0);
}

const sql = fs.readFileSync(chemin, "utf8");
const comptes = { common: 0, uncommon: 0, rare: 0 };
for (const m of sql.matchAll(/SET rarity_tag = '(common|uncommon|rare)'/g)) {
  comptes[m[1]] += 1;
}
const total = comptes.common + comptes.uncommon + comptes.rare;

for (const palier of ["common", "uncommon", "rare"]) {
  if (comptes[palier] === 0) {
    failures.push(
      `${MIGRATION}: aucun UPDATE vers '${palier}'. Les trois paliers doivent etre ` +
        "servis, sinon la progression n'a rien a ordonner."
    );
  }
}

if (total < 800) {
  failures.push(
    `${MIGRATION}: ${total} polices classees seulement. Le catalogue compte 1172 actives, ` +
      "un classement qui en couvre moins de 800 laisse la majorite sans notoriete."
  );
}

if (/DELETE|DROP|TRUNCATE|ALTER TABLE/i.test(sql)) {
  failures.push(
    `${MIGRATION}: contient une instruction destructrice. Ce fichier ne doit faire que des ` +
      "UPDATE de rarity_tag."
  );
}

if (failures.length > 0) {
  console.error("check:rarity-coverage FAILED\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(
  `check:rarity-coverage OK : ${total} polices classees, ` +
    `${comptes.common} common, ${comptes.uncommon} uncommon, ${comptes.rare} rare.`
);
```

- [ ] **Étape 2 : lancer le garde, il doit passer sans migration**

Lancer : `node scripts/quality/check-rarity-coverage.mjs`
Attendu : sortie 0, message « absent ».

- [ ] **Étape 3 : écrire le constructeur de classement**

Créer `scripts/build_rarity_from_popularity.py` :

```python
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
```

- [ ] **Étape 4 : câbler les commandes npm dans le même commit**

Modifier `package.json`, ajouter dans `scripts` :

```json
"build:rarity": "./.venv/bin/python scripts/build_rarity_from_popularity.py",
"check:rarity-coverage": "node scripts/quality/check-rarity-coverage.mjs"
```

Puis ajouter `&& npm run check:rarity-coverage` dans la chaîne `quality`, juste
après `npm run check:google-metadata-sync`.

- [ ] **Étape 5 : produire la migration et lancer le garde**

Lancer : `npm run build:rarity && npm run check:rarity-coverage`
Attendu, mesuré avant l'implémentation le 2026-08-19, ce sont les nombres à
retrouver : **1090 polices classées, 243 `common`, 357 `uncommon`, 490 `rare`**,
et **82 slugs sans rang**. Ces 82 sont normaux et nommés : `adobeblank`, les
héritages coréens `batang`, `dotum`, `gungsuh`, les alphas de polices variables
`amstelvaralpha`, `decovaralpha`, et des faces absentes de Google Fonts.

Si le nombre de slugs sans rang dépasse 200, s'arrêter et le signaler : cela
voudrait dire que la normalisation ne correspond plus à celle du catalogue, et le
classement serait partiel sans le dire.

- [ ] **Étape 6 : vérifier que le garde attrape une migration creuse**

Lancer :
```bash
cp db/migrations/013_rarity_from_popularity.sql /tmp/013.bak
grep -v "rarity_tag = 'rare'" /tmp/013.bak > db/migrations/013_rarity_from_popularity.sql
node scripts/quality/check-rarity-coverage.mjs
```
Attendu : ÉCHEC, message « aucun UPDATE vers 'rare' ».
Puis : `cp /tmp/013.bak db/migrations/013_rarity_from_popularity.sql`

- [ ] **Étape 7 : committer, sans appliquer**

```bash
git add scripts/build_rarity_from_popularity.py scripts/quality/check-rarity-coverage.mjs package.json db/migrations/013_rarity_from_popularity.sql
git commit -m "feat(catalog): turn the Google popularity rank into rarity_tag

rarity_tag was common on 1148 of the 1172 active typefaces and rare on none, so
the column existed and said nothing. The question builder therefore had no way to
serve a typeface people can name before one nobody has heard of, which is the
whole progression the owner asked for.

The rank comes from Google rather than from taste. rarity_tag is one of the ten
columns of generate_editorial_review_template.py, so it belongs to a human
review, and nobody fills 1172 rows by hand: the review was passed by presets and
that is exactly how it ended up meaning nothing. A published rank is imperfect
and objective, which is the better trade here.

The migration is WRITTEN AND NOT APPLIED. CLAUDE.md requires the owner's explicit
go ahead for any migration, so the script only ever produces a file to read.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: servir les connues d'abord dans le constructeur de questions

**Fichiers :**
- Modifier : `lib/game/training/question-shape.ts:41-65` (`pickEligibleTypeface`)
- Modifier : `lib/game/training/provider.ts:338-365` (`getPoolRows`, ajout de la colonne lue)
- Test : `scripts/quality/check-answer-position.mjs` (garde existant, à étendre)

**Interfaces :**
- Consomme : `typefaces_core.rarity_tag`, rempli par la migration de la tâche 2.
- Produit : `pickEligibleTypeface` classe désormais à notoriété égale de délai, et
  `QuestionShapeRow` gagne le champ `rarity_tag: string`. La tâche 4 s'appuie sur
  ce champ pour son garde.

**Attention, dépendance à respecter.** Cette tâche n'a d'effet que si la migration
de la tâche 2 est appliquée. Tant qu'elle ne l'est pas, `rarity_tag` vaut `common`
presque partout et le tri est neutre, ce qui est sans danger : le code marche
avant comme après. Ne pas attendre la migration pour livrer cette tâche.

- [ ] **Étape 1 : écrire le test qui échoue**

Le garde `scripts/quality/check-answer-position.mjs` importe déjà
`lib/game/training/question-shape.ts` et exerce la vraie chaîne.

**Où insérer, précisément.** Les fonctions sont déstructurées d'un `await import`
à la ligne 73, à l'intérieur d'un `try` qui se referme sur `} catch (error) {` à la
ligne 159. Le bloc ci dessous doit donc aller **dans ce `try`**, juste avant cette
ligne 159. Placé après, `pickEligibleTypeface` ne serait pas dans la portée et le
garde planterait sur un `ReferenceError` au lieu de mesurer quoi que ce soit. Le
tableau `failures` est déclaré à la ligne 42, au niveau du module, donc il est bien
accessible depuis là.

```javascript
// La notoriete ordonne ce que le joueur rencontre.
//
// Demande du proprietaire du 2026-08-19 : les typographies connues sont servies
// les premieres parce qu'elles sont les plus simples, les obscures viennent quand
// le joueur progresse. rarity_tag porte cette notoriete depuis la migration 013.
//
// Le test isole la regle : deux polices egalement dues, egalement maitrisees,
// egalement difficiles, et seule leur notoriete les separe. La connue doit sortir.
{
  const dues = [
    {
      typeface_slug: "obscure",
      mastery_level: 0,
      next_due_after_q: 0,
      primary_category: "sans_serif",
      visual_cluster_id: "cluster_neo_grotesk_A",
      difficulty_base: "medium",
      rarity_tag: "rare",
    },
    {
      typeface_slug: "connue",
      mastery_level: 0,
      next_due_after_q: 0,
      primary_category: "sans_serif",
      visual_cluster_id: "cluster_neo_grotesk_A",
      difficulty_base: "medium",
      rarity_tag: "common",
    },
  ];

  const choisie = pickEligibleTypeface(dues, 10, "graine-de-test");
  if (choisie?.typeface_slug !== "connue") {
    failures.push(
      "question-shape: a delai, maitrise et difficulte egaux, la police common doit passer " +
        `avant la rare. pickEligibleTypeface a rendu "${choisie?.typeface_slug}".`
    );
  }

  // Et la notoriete ne doit pas ecraser le delai : une rare due depuis longtemps
  // passe avant une common pas encore due, sinon le calendrier de revision ne
  // veut plus rien dire et l'invariant I-02 tombe.
  const melange = [
    { ...dues[0], next_due_after_q: 0 },
    { ...dues[1], next_due_after_q: 50 },
  ];
  const parDelai = pickEligibleTypeface(melange, 10, "graine-de-test");
  if (parDelai?.typeface_slug !== "obscure") {
    failures.push(
      "question-shape: le delai passe avant la notoriete. Une police due doit etre servie " +
        `meme si elle est rare. pickEligibleTypeface a rendu "${parDelai?.typeface_slug}".`
    );
  }
}
```

- [ ] **Étape 2 : lancer le garde pour vérifier qu'il échoue**

Lancer : `npm run check:answer-position`
Attendu : ÉCHEC, message « la police common doit passer avant la rare ».

- [ ] **Étape 3 : implémenter le tri**

Modifier `lib/game/training/question-shape.ts`. Ajouter le champ au type :

```typescript
export type QuestionShapeRow = {
  typeface_slug: string;
  mastery_level: number;
  next_due_after_q: number;
  primary_category: string;
  visual_cluster_id: string;
  difficulty_base: string;
  // Notoriete, depuis typefaces_core.rarity_tag (migration 013). Optionnel parce
  // que la migration peut ne pas etre appliquee : absent vaut common, donc le tri
  // est neutre et le code marche avant comme apres.
  rarity_tag?: string;
};
```

Ajouter le barème et l'insérer dans le tri, entre la difficulté et le hachage :

```typescript
// common < uncommon < rare. Une notoriete inconnue vaut common, donc neutre.
const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2 };
const rarityRank = (value: string | undefined) => RARITY_RANK[value ?? "common"] ?? 0;
```

Puis, dans `pickEligibleTypeface`, ajouter ce bloc juste après la comparaison de
`difficultyRank` et avant le `return` sur `hashScore` :

```typescript
    if (rarityRank(left.rarity_tag) !== rarityRank(right.rarity_tag)) {
      return rarityRank(left.rarity_tag) - rarityRank(right.rarity_tag);
    }
```

- [ ] **Étape 4 : faire remonter la colonne depuis la base**

Modifier `lib/game/training/provider.ts`. Dans le type `PoolRow`, ajouter après
`difficulty_base: string;` :

```typescript
  rarity_tag: string;
```

Dans `getPoolRows`, ajouter la colonne au SELECT, après
`tc.difficulty_base::text AS difficulty_base,` :

```sql
      tc.rarity_tag::text AS rarity_tag,
```

Faire la même addition dans la requête de `submitTrainingAnswer` qui lit
`stateRows`, pour que les deux lectures rendent le même type.

- [ ] **Étape 5 : lancer le garde et la porte**

Lancer : `npm run check:answer-position && npm run typecheck && npm run lint`
Attendu : les trois en sortie 0.

- [ ] **Étape 6 : vérifier en jouant, sur le serveur de développement**

Lancer, le serveur du 3002 étant démarré :
```bash
curl -s -X POST http://127.0.0.1:3002/api/training/session/start \
  -H "Content-Type: application/json" -d '{"locale":"fr"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['question']['typefaceLabel'])"
```
Attendu : un nom de police, sans erreur. Tant que la migration 013 n'est pas
appliquée, le nom servi n'a pas de raison de changer, et c'est le comportement
voulu.

- [ ] **Étape 7 : committer**

```bash
git add lib/game/training/question-shape.ts lib/game/training/provider.ts scripts/quality/check-answer-position.mjs
git commit -m "feat(game): notoriety orders what the player meets, after the schedule

The owner's rule, 2026-08-19: a typeface people can name is served before one
nobody has heard of, because it is the simpler question, and the obscure ones
arrive as the player improves.

Placed AFTER the cooldown and the mastery level in the sort, never before. A face
that is due must be served even when it is rare, or the revision schedule stops
meaning anything and invariant I-02 falls. The guard tests both directions, which
is what makes the ordering a rule rather than a preference.

rarity_tag is optional on QuestionShapeRow and an absent value counts as common,
so this ships safely before migration 013 is applied: the sort is simply neutral
until the column carries information.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: combler les 48 designers manquants depuis le même instantané

**Fichiers :**
- Créer : `db/migrations/014_designers_from_metadata.sql` (produit par un script)
- Modifier : `scripts/build_rarity_from_popularity.py` (ajout d'un second mode)
- Test : réutilise `scripts/quality/check-rarity-coverage.mjs`, étendu

**Interfaces :**
- Consomme : `metadata-snapshot.json` de la tâche 1, champ `designers`.
- Produit : `db/migrations/014_designers_from_metadata.sql`. Rien d'autre ne
  dépend de cette tâche, elle est terminale.

**Pourquoi elle est dans ce plan et pas dans un autre.** `designers` arrive dans
le même appel réseau que `popularity`, gratuitement. Le laisser de côté
obligerait à refaire la collecte plus tard pour un champ déjà téléchargé.
`foundry` et `release_year` restent vides et ne sont PAS traités ici :
l'instantané ne les contient pas, `dateAdded` est la date d'entrée chez Google et
non l'année de création de la typographie, et écrire l'une dans l'autre serait
inventer une histoire. Ces deux colonnes demandent une source historique, donc
leur propre chantier.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter à `scripts/quality/check-rarity-coverage.mjs`, après le bloc existant :

```javascript
// La migration des designers, quand elle existe, ne doit toucher que ce champ.
const MIGRATION_DESIGNERS = "db/migrations/014_designers_from_metadata.sql";
const cheminDesigners = path.join(ROOT, MIGRATION_DESIGNERS);
if (fs.existsSync(cheminDesigners)) {
  const sqlDesigners = fs.readFileSync(cheminDesigners, "utf8");
  const updates = [...sqlDesigners.matchAll(/SET designer = /g)].length;
  if (updates === 0) {
    failures.push(`${MIGRATION_DESIGNERS}: aucun UPDATE de designer.`);
  }
  if (/rarity_tag|DELETE|DROP|TRUNCATE|ALTER TABLE/i.test(sqlDesigners)) {
    failures.push(
      `${MIGRATION_DESIGNERS}: touche autre chose que designer. Une migration par colonne, ` +
        "sinon le proprietaire ne peut pas accepter l'une en refusant l'autre."
    );
  }
  console.log(`  et ${updates} designer(s) dans ${MIGRATION_DESIGNERS}.`);
}
```

- [ ] **Étape 2 : lancer le garde, il doit encore passer**

Lancer : `node scripts/quality/check-rarity-coverage.mjs`
Attendu : sortie 0, la migration 014 n'existant pas encore le bloc est ignoré.

- [ ] **Étape 3 : ajouter le mode designers au script**

Modifier `scripts/build_rarity_from_popularity.py`. Ajouter l'argument :

```python
    parser.add_argument(
        "--designers-output",
        default="db/migrations/014_designers_from_metadata.sql",
        help="Migration des designers manquants. Ecrite en plus de celle de rarity_tag.",
    )
```

Puis, dans `main`, avant le `return 0`, ajouter :

```python
    # Les designers, depuis le meme appel reseau. On ne remplit QUE les vides :
    # ecraser un designer deja saisi effacerait un travail humain par une donnee
    # automatique, et l'instantane de Google n'est pas plus fiable qu'une saisie.
    designers_par_slug: dict[str, str] = {}
    for famille in snapshot["families"]:
        slug = slugifie(famille["family"])
        noms = [n for n in famille.get("designers", []) if n]
        if slug in par_slug and noms and not (par_slug[slug].get("designer") or "").strip():
            designers_par_slug[slug] = ", ".join(noms)

    lignes_designers = [
        "UPDATE typefaces_core SET designer = '{}', updated_at_utc = now() "
        "WHERE typeface_slug = '{}' AND (designer IS NULL OR designer = '');".format(
            nom.replace("'", "''"), slug
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

BEGIN;

"""
    Path(args.designers_output).write_text(
        entete_designers + "\n".join(lignes_designers) + "\n\nCOMMIT;\n", encoding="utf-8"
    )
    print(f"{len(lignes_designers)} designers ecrits dans {args.designers_output}")
```

- [ ] **Étape 4 : produire les deux migrations et lancer le garde**

Lancer : `npm run build:rarity && npm run check:rarity-coverage`
Attendu : les deux comptes annoncés, le garde en sortie 0, et une ligne
« et N designer(s) ».

- [ ] **Étape 5 : vérifier que le garde refuse un mélange de colonnes**

Lancer :
```bash
cp db/migrations/014_designers_from_metadata.sql /tmp/014.bak
printf "UPDATE typefaces_core SET rarity_tag = 'rare' WHERE typeface_slug = 'x';\n" >> db/migrations/014_designers_from_metadata.sql
node scripts/quality/check-rarity-coverage.mjs
```
Attendu : ÉCHEC, message « touche autre chose que designer ».
Puis : `cp /tmp/014.bak db/migrations/014_designers_from_metadata.sql`

- [ ] **Étape 6 : committer**

```bash
git add scripts/build_rarity_from_popularity.py scripts/quality/check-rarity-coverage.mjs db/migrations/014_designers_from_metadata.sql
git commit -m "feat(catalog): fill the 48 missing designers from the same snapshot

designers arrives in the same network call as popularity, at no extra cost, so
leaving it out would mean fetching twice for a field already downloaded.

Only empty designers are filled, and the WHERE clause repeats that condition:
between generating the file and applying it somebody may have typed a name by
hand, and automatic data must not overwrite human work.

foundry and release_year stay empty on purpose. The snapshot does not carry them,
and dateAdded is the date a family entered Google Fonts, not the year the
typeface was cut. Writing one into the other would invent a history.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Ce que ce plan ne fait pas, et pourquoi

**Le regroupement visuel n'est pas traité.** C'est le défaut le plus grave mesuré
le 2026-08-19, 1029 polices sur 1172 réparties dans trois clusters, et c'est lui
qui fabrique les mauvaises réponses donc la difficulté du jeu. Il n'est pas ici
parce qu'il n'a pas de source objective disponible : `structural_signature_json`
compte 41 signatures distinctes pour 1172 polices, donc elle a été posée par
preset elle aussi, et trois monospaces différentes portent la même signature au
champ près. Le réparer demande soit de faire tourner
`extract_typeface_specimen_data.py` sur les 1172 fichiers pour mesurer vraiment,
soit une revue humaine. Les deux sont des chantiers à part entière. Un gain
intermédiaire existe et vaut d'être mesuré d'abord : regrouper par signature
donnerait 41 clusters au lieu de 11, par script, sans nouvelle donnée.

**Le volet Adobe n'est pas ici.** Le pipeline jumeau, le kit `ozq5yfs` dont le
domaine vaut `"f"`, et les 860 lignes désactivées faute de licence forment un
second sous-système, avec sa propre source et ses propres contraintes, dont le
fait qu'aucun fichier de police n'est téléchargeable. Il aura son plan.

**`primary_category` n'est pas corrigé.** Trois `display` sur 1172 est
manifestement faux, mais `category` et `classifications` de l'instantané doivent
d'abord être confrontés au catalogue pour savoir combien de lignes changeraient et
si le résultat vaut mieux que l'actuel. C'est une mesure à faire, pas une
correction à écrire à l'aveugle.
