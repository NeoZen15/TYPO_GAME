# Google Fonts API Strategy

Ce document décrit comment utiliser les APIs Google Fonts dans JEUX DE TYPO sans casser notre architecture actuelle.

## 1) Décision

On distingue clairement 3 choses:

1. le **catalogue produit**,
2. le **runtime du jeu**,
3. la **veille externe**.

La bonne stratégie est:

- **Google Fonts Developer API** = veille, vérification, priorisation, sync metadata
- **Google Fonts CSS API** = preview ponctuel éventuel, pas moteur principal
- **self-hosting local** = runtime principal du jeu

## 2) Pourquoi la Developer API est utile

Source officielle:
- https://developers.google.com/fonts/docs/developer_api

La Developer API fournit du metadata pour les familles servies par Google Fonts:
- `family`
- `variants`
- `subsets`
- `version`
- `lastModified`
- `files`
- `category`
- `axes` sur demande
- `tags` sur demande

Elle permet aussi de:
- trier par `alpha`, `date`, `popularity`, `style`, `trending`
- filtrer par `family`, `subset`, `category`
- demander des capacités comme `WOFF2`, `VF`, `FAMILY_TAGS`

Pour nous, cela sert surtout à:
1. détecter les nouvelles familles
2. repérer les familles mises à jour
3. vérifier qu'une famille Google reste visible côté API
4. prioriser un prochain lot à intégrer

## 3) Pourquoi elle ne remplace pas notre pipeline

La Developer API ne connaît pas nos champs métier:
- `visual_cluster_id`
- `dreyfus_tier`
- `difficulty_base`
- `rarity_tag`
- `structural_signature`
- `contrast_profile`
- `aperture_profile`

Donc elle ne remplace pas:
- notre pipeline catalogue
- notre review éditoriale
- notre runtime sélectionné et contrôlé

Elle aide le pipeline, mais n'est pas la source produit finale.

## 4) Pourquoi la CSS API n'est pas le cœur du runtime

Source officielle:
- https://developers.google.com/fonts/docs/css2

La CSS API est utile pour:
- charger rapidement une famille en preview
- tester des axes de variable fonts
- demander des styles précis
- utiliser `text=` pour des previews ciblées

Mais elle ne doit pas être le moteur principal du jeu, pour 3 raisons:
1. on veut un sous-ensemble runtime maîtrisé
2. on veut éviter une dépendance externe directe pour le cœur du produit
3. on veut garder le contrôle sur les fichiers réellement servis

## 5) Point privacy important

Source officielle:
- https://developers.google.com/fonts/faq/privacy

Quand un site charge des fonts directement via la Web API Google Fonts:
- Google reçoit l'adresse IP de l'utilisateur
- l'URL demandée
- des headers HTTP comme le user agent et le referer

Si on self-host les fonts du runtime actif:
- ces requêtes ne partent pas chez Google
- le cœur du produit reste sous notre contrôle

Donc la stratégie retenue est cohérente:
- **veille API Google**
- **runtime self-hosted**

## 6) Intégration recommandée dans notre pipeline

Ordre recommandé:

1. **Developer API sync**
- voir les nouvelles familles
- voir les changements
- produire un rapport local

2. **Sélection / batches**
- choisir un sous-ensemble intéressant pour JEUX DE TYPO

3. **Pipeline local existant**
- candidate import
- runtime prep
- staging
- review éditoriale
- promotion

4. **Activation produit**
- seulement quand la typo est prête

## 7) Script ajouté dans le repo

Script:
- `scripts/sync_google_fonts_api.py`
- `scripts/classify_google_fonts_api_sync.py`

But:
- appeler la Developer API
- comparer avec `content/catalog/`
- produire un état local sans modifier le catalogue principal
- classer ensuite les résultats en `ignore`, `watch`, `candidate`

Sorties:
- `content/catalog/google-api-sync/google-api-snapshot.json`
- `content/catalog/google-api-sync/sync-meta.json`
- `content/catalog/google-api-sync/known-families.json`
- `content/catalog/google-api-sync/new-to-local.json`
- `content/catalog/google-api-sync/missing-from-api.json`
- `content/catalog/google-api-sync/changed-since-last-sync.json`
- `content/catalog/google-api-sync/triage-meta.json`
- `content/catalog/google-api-sync/triage-ignore.json`
- `content/catalog/google-api-sync/triage-watch.json`
- `content/catalog/google-api-sync/triage-candidate.json`

## 8) Ce que le script répond concrètement

Le script permet de répondre à des questions comme:
- quelles familles Google existent côté API mais pas encore chez nous ?
- quelles familles connues ont changé de version ou de metadata depuis le dernier sync ?
- quelles familles Google de notre catalogue ne sont plus visibles côté API ?
- parmi les familles connues, lesquelles sont déjà actives / runtime-ready ?
- lesquelles sont du bruit attendu pour notre produit (`ignore`) ?
- lesquelles méritent juste une veille (`watch`) ?
- lesquelles sont de vraies candidates produit (`candidate`) ?

## 9) Utilisation prévue

Avec API key:

```bash
.venv/bin/python scripts/sync_google_fonts_api.py \
  --catalog-dir content/catalog \
  --output-dir content/catalog/google-api-sync \
  --api-key "$GOOGLE_FONTS_API_KEY"
```

Ou via variable d'environnement:

```bash
export GOOGLE_FONTS_API_KEY="..."
.venv/bin/python scripts/sync_google_fonts_api.py
```

Mode offline pour debug/test:

```bash
.venv/bin/python scripts/sync_google_fonts_api.py \
  --catalog-dir content/catalog \
  --output-dir content/catalog/google-api-sync \
  --input-json /path/to/webfonts-api-response.json
```

## 10) Recommandation pratique

À court terme:
- le script est surtout utile comme **radar externe**
- il n'est pas bloquant pour continuer le jeu

À moyen terme:
- il devient utile si on veut
  - surveiller les nouveautés Google Fonts
  - vérifier les métadonnées
  - prioriser les prochaines vagues d'intégration

Conclusion:
- **oui, utile**
- **non, pas central au runtime**
- **très bon outil de veille et de vérification**
