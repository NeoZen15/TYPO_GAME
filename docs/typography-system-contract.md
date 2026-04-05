# Typography System Contract

Ce document est la reference officielle pour le systeme hybride:

- fiche canonique typographie (source unique de verite),
- contenus derives (comparaisons, liens, SEO),
- overrides editoriaux (enrichissement controle).

Objectif: pouvoir iterer vite sans casser la logique produit `voir -> comprendre -> apprendre -> jouer`.

## 1) Portee et principe

Le contrat couvre:

- la structure des donnees,
- la fusion des donnees,
- les validations de build,
- la remontee d'erreurs lisible pour l'equipe.

Regle prioritaire:

1. Canonique
2. Genere
3. Override

Un override enrichit une page, mais ne doit jamais modifier les cles structurelles du systeme.

## 2) Couches de donnees

Arborescence canonique attendue:

```txt
content/typography/
  typefaces/
  concepts/
  overrides/
    type/
    compare/
    concept/
  generated/
    comparisons.json
    slug-history.json
    slug-redirects.json
```

### 2.1 Canonique

Entites editees a la main:

- `typeface`
- `concept`

Role:

- definir l'identite et les attributs stables,
- porter les references de base.

### 2.2 Genere

Entites produites par pipeline:

- `comparison` (paires canoniques),
- indexes de liens internes,
- donnees SEO derivees.

Role:

- automatiser les pages a grande echelle,
- garder une coherence globale.

### 2.3 Override editorial

Patchs manuels optionnels sur pages strategiques.

Role:

- ameliorer l'explication,
- reordonner des blocs,
- optimiser des CTA/SEO,
- sans casser le socle.

## 3) Contrat des entites

Legende:

- `OBL` obligatoire
- `OPT` optionnel
- `GEN` genere
- `OVR` surchargeable
- `LOCK` verrouille

### 3.1 Entite `typeface` (canonique)

| Champ | Statut | Regle |
| --- | --- | --- |
| `id` | OBL + LOCK | Cle immuable `tf_*` |
| `slug` | OBL + LOCK | Route canonique |
| `status` | OBL + LOCK | `draft` ou `published` |
| `name` | OBL + LOCK | Nom principal |
| `category` | OBL + LOCK | Ex: `sans-serif` |
| `subCategory` | OBL + LOCK | Ex: `humanist`, `grotesk` |
| `features.*` | OBL + LOCK | Attributs utilises pour comparaisons |
| `specimen.defaultText` | OBL + OVR | Surcharge autorisee |
| `specimen.glyphSets` | OPT + LOCK | Metadonnees |
| `conceptRefs[]` | OPT + LOCK | References vers `concept.id` |
| `comparisonSeeds.*` | OPT + LOCK | Aide au ranking genere |
| `seo.title` | OPT + OVR | Surcharge autorisee |
| `seo.description` | OPT + OVR | Surcharge autorisee |

### 3.2 Entite `concept` (canonique)

| Champ | Statut | Regle |
| --- | --- | --- |
| `id` | OBL + LOCK | Cle immuable `cp_*` |
| `slug` | OBL + LOCK | Route canonique |
| `status` | OBL + LOCK | `draft` ou `published` |
| `title` | OBL + OVR | Surcharge autorisee |
| `definitionShort` | OBL + OVR | Surcharge autorisee |
| `featureKeys[]` | OBL + LOCK | Clefs d'indexation |
| `exampleTypefaceIds[]` | OPT + OVR | Reordonnable |
| `body` | OBL + OVR | Contenu pedagogique |
| `seo.title` | OPT + OVR | Surcharge autorisee |
| `seo.description` | OPT + OVR | Surcharge autorisee |

### 3.3 Entite `comparison` (generee)

| Champ | Statut | Regle |
| --- | --- | --- |
| `pairId` | GEN + LOCK | Format canonique `min--max` |
| `slug` | GEN + LOCK | Ex: `helvetica-neue-vs-inter` |
| `leftId` / `rightId` | GEN + LOCK | Deduits de `pairId` |
| `status` | GEN + LOCK | Publie si les 2 cibles sont publiees |
| `diffHighlights[]` | GEN + LOCK | Differences calculees |
| `conceptRefs[]` | GEN + OVR | Pin possible par override |
| `score` | GEN + LOCK | Score de pertinence |
| `seo.title` | GEN + OVR | Surcharge autorisee |
| `seo.description` | GEN + OVR | Surcharge autorisee |

Checks internes minimaux attendus:

- `status` dans `draft|published`
- `diffHighlights[]` non vide et structure valide (`feature`, `left`, `right`)
- `conceptRefs[]` valide (ids existants et publies)
- `score` numerique (plage recommandee 0..1)

### 3.4 Entite `override`

Champs autorises:

- `heroTitle`
- `heroIntro`
- `introRichText`
- `orderedComparisons[]`
- `orderedConcepts[]`
- `pinnedConceptIds[]`
- `ctaGameVariant`
- `faq[]`
- `seo.title`
- `seo.description`
- `specimen.defaultText` (page type uniquement)

Validation de structure override:

- `seo` doit etre un objet avec `title`/`description` si presents (chaines non vides)
- `specimen` doit etre un objet et ne peut contenir que `defaultText`
- `specimen` n'est autorise que pour `target=type`

Champs interdits (LOCK absolu):

- `id`, `slug`, `pairId`, `leftId`, `rightId`
- `status` des entites canoniques
- `features.*`, `category`, `subCategory`
- toute cle structurelle de routage

## 4) Checklist validation build

### 4.1 Niveau `BLOCK` (build stoppe, exit code 1)

- Champ `OBL` manquant, type invalide, enum invalide.
- `id` duplique ou `slug` duplique.
- Reference casse (`*_Refs` vers entite absente ou non `published`).
- `pairId` non canonique ou incoherent.
- Collision de route finale (`/type/*`, `/compare/*`, `/learn/*`).
- Override contenant un champ `LOCK`.
- Override cible introuvable.
- Changement de slug publie sans redirection declaree.

### 4.2 Niveau `WARN` (build passe, correction recommandee)

- SEO incomplet sur page publiee.
- Maillage trop faible (pas assez de liens sortants/entrants).
- Page type publiee avec trop peu de comparaisons utiles.
- Page concept publiee avec trop peu d'exemples.
- Override stale sur cible en `draft`.
- Qualite faible detectee (comparaison score bas mais publiee).

### 4.3 Niveau `INFO` (diagnostic)

- Volume de pages generees par type.
- Concepts les plus/moins relies.
- Paires exclues par regles.
- Delta par rapport au build precedent.

## 5) Codes d'erreur stables

Convention: `VAL_<DOMAINE>_<NNN>`

### 5.1 Codes `BLOCK`

- `VAL_SCHEMA_001` champ obligatoire manquant
- `VAL_SCHEMA_002` type invalide
- `VAL_SCHEMA_003` enum invalide
- `VAL_UNIQUE_001` duplication `id`
- `VAL_UNIQUE_002` duplication `slug`
- `VAL_REF_001` reference introuvable
- `VAL_REF_002` reference vers entite non publiee
- `VAL_PAIR_001` `pairId` non canonique
- `VAL_PAIR_002` incoherence `pairId` vs `leftId/rightId`
- `VAL_ROUTE_001` collision de route
- `VAL_LOCK_001` champ verrouille dans override
- `VAL_LOCK_002` tentative de modification de structure de routing
- `VAL_OVERRIDE_001` cible override introuvable
- `VAL_SLUG_001` slug publie modifie sans redirection

### 5.2 Codes `WARN`

- `VAL_SEO_001` `seo.title` manquant
- `VAL_SEO_002` `seo.description` manquante
- `VAL_MESH_001` liens sortants insuffisants
- `VAL_MESH_002` aucun lien entrant detecte
- `VAL_CONTENT_001` comparaisons recommandees insuffisantes
- `VAL_CONTENT_002` exemples conceptuels insuffisants
- `VAL_OVERRIDE_101` override stale sur cible draft
- `VAL_QUALITY_001` comparaison a score faible mais publiee

### 5.3 Codes `INFO`

- `VAL_INFO_001` nombre de pages generees
- `VAL_INFO_002` top concepts relies
- `VAL_INFO_003` paires exclues
- `VAL_INFO_004` delta vs build precedent
- `VAL_INFO_005` racine canonique absente (`content/typography`)

## 6) Format de rapport lisible

### 6.1 Console (humaine)

Resume en tete:

`BLOCK <n> | WARN <n> | INFO <n>`

Format de ligne:

`[SEVERITY][CODE] <path>:<field> - <message>. Action: <action>`

Exemple:

`[BLOCK][VAL_LOCK_001] content/overrides/compare/helvetica-neue--inter.md:pairId - Champ verrouille surcharge. Action: retirer pairId de l'override.`

### 6.2 JSON (CI / annotation PR)

Structure minimale recommandee:

```json
{
  "summary": { "block": 1, "warn": 2, "info": 4 },
  "issues": [
    {
      "severity": "BLOCK",
      "code": "VAL_LOCK_001",
      "path": "content/overrides/compare/helvetica-neue--inter.md",
      "field": "pairId",
      "message": "Champ verrouille surcharge.",
      "action": "Retirer pairId de l'override.",
      "context": { "target": "compare", "pairId": "tf_a--tf_b" }
    }
  ]
}
```

## 7) Politique de build par environnement

### 7.1 Local

- `BLOCK` fait echouer.
- `WARN` n'empeche pas l'iteration.
- Option conseillee: validation sur fichiers modifies seulement.

### 7.2 CI standard

- `BLOCK` fait echouer.
- `WARN` autorise mais publie dans les logs/annotations.

### 7.3 CI release stricte

`WARN` critiques promus en `BLOCK`:

- `VAL_SEO_001`
- `VAL_SEO_002`
- `VAL_MESH_001`
- `VAL_MESH_002`

## 8) Regles de verrouillage absolu

Ces champs ne doivent jamais etre modifiables par override:

- Identite et routage: `id`, `slug`, `pairId`, `leftId`, `rightId`
- Taxonomie technique: `category`, `subCategory`, `features.*`
- Etats canoniques: `status`

Raison:

- conserver une URL stable,
- garantir un graphe de liens coherent,
- eviter les regressions silencieuses.

## 9) Procedure d'evolution du contrat

Toute evolution de ce document doit:

1. ajouter ou deprecier explicitement les codes concernes,
2. decrire l'impact sur `BLOCK/WARN/INFO`,
3. rester retro-compatible ou fournir une migration claire,
4. etre relue avant merge.

Ce document est la base de reference pour toutes les discussions futures sur le systeme de pages typographiques.
