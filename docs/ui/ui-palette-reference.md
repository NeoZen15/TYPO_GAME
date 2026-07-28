# UI Palette Reference

Dernière mise à jour: 2026-06-30
Statut: working reference

> **Décision 2026-06-30 — plus de blanc pur dans le site.** Tout `#ffffff` / `#fff` /
> `rgba(255,255,255,a)` / le mot-clé `white` (hors propriété `white-space` et hors
> commentaires) a été remplacé par le **beige de marque `#f4f3ee` (rgb 244, 243, 238)**.
> Appliqué à `app/globals.css` + composants user-facing (Gate, CompetitionScreen,
> profil, TypefaceTester). Les labs internes `/dev` ne sont volontairement pas touchés.
> Donc partout où ce document dit encore « blanc » / `#ffffff`, lire désormais le beige
> `#f4f3ee`. Le dark-theme « blanc » était déjà documenté comme étant ce beige (voir `.lp`).

> **Décision 2026-07-07 — verts et rouges de feedback unifiés.** Les valeurs canoniques
> sont désormais fixées, source de vérité unique dans `app/globals.css` :
> succès / correct = **`#00c853`** (`--success-green`) ; erreur / wrong = **`#ff0000`**
> (`--error-red`) ; neutre chaud gameplay = **`#2a1a20`** (`--ink-warm`, réutilisé par
> `--typo-ink` en light). Les doublons arbitraires `#22c55e` (vert) et `#ef4444` (rouge),
> portés par les règles mortes `.onboarding-micro-answer` / `.onboarding-micro-feedback`
> (l'ancien step « micro » remplacé par `OnboardingWarmup`, plus référencé en JSX), ont été
> **supprimés**. Sur les pages typo, `--typo-positive` pointe maintenant sur `--success-green`
> en dark (fin de la menthe inventée `#9ef0d4`) et garde en light une seule forme assombrie
> lisible sur beige (`#21785e`), car `#00c853` en texte échoue au contraste sur le beige.
> À arbitrer encore (hors de cette passe) : les verts / rouges spécifiques de `competition`
> (`#21785e`, `#b33636`) et les feedbacks dark historiques (`#4ade80`, `#f87171`).

Ce document sert de base commune pour relire le design sans se perdre.

Il répond à 4 questions:
1. quelles sont les vraies couleurs du site aujourd'hui,
2. quels sont les vrais styles de texte,
3. quelle palette a été validée pour `competition`,
4. où il reste des incohérences à revoir ensemble.

## 1) Source réelle

Les sources réelles pour cette fiche sont:
- `app/globals.css`
- `features/modes/components/ModeSelectPage.tsx` (page `/play`, **référence couleur validée**)
- `features/game/components/CompetitionScreen.tsx`
- `docs/ui/ui-consistency-contract.md`
- `docs/ui/front-ui-master-spec.md`

Important:
- cette fiche décrit l'état actuel du code,
- elle ne veut pas dire que tout est parfait,
- au contraire, elle sert aussi à repérer les contradictions.

## 2) Base globale du site

### Fond / texte globaux

Mode light:
- background: `#f4f3ee` (beige de marque — était `#ffffff`)
- foreground: `#111114`
- ink strong: `rgba(16, 16, 20, 0.94)`
- ink muted: `rgba(16, 16, 20, 0.58)`
- ink soft: `rgba(16, 16, 20, 0.30)`

Mode dark:
- background: `#000000`
- foreground: `#f4f3ee` (beige de marque — était `#ffffff`)
- ink strong: `rgba(244, 243, 238, 0.96)`
- ink muted: `rgba(244, 243, 238, 0.56)`
- ink soft: `rgba(244, 243, 238, 0.30)`

### Neutres de lecture utilisés dans le jeu light

Sur les écrans de jeu et de summary en light, on voit souvent ce neutre chaud:
- ink deep warm: `#2a1a20`
- muted warm text: `rgba(58, 38, 48, 0.68)`
- light borders / lines: `rgba(58, 38, 48, 0.08 -> 0.20)`

Conclusion:
- le site n'est pas en noir pur partout,
- une partie du gameplay utilise un neutre chaud brun-prune,
- il faut l'assumer ou le corriger, mais il faut le documenter.

## 3) Typographie et texte écran

### Stack UI canonique

Stack UI du site (token `--ui-sans`):
- `"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif`
- **Inter** (SIL OFL) est **auto-hébergé** dans `public/fonts/ui/` — deux *variable fonts* : `InterVariable.woff2` (romain) + `InterVariable-Italic.woff2` (italique), chacune couvrant **toutes les graisses 100–900 + l'optical sizing (opsz 14–32)** en un seul fichier. Embarqué via deux `@font-face` → **la même police pour tous les appareils** (Apple / Windows / Android), pas de rendu système qui change d'un OS à l'autre.
- SF Pro n'est **jamais** nommé ni embarqué (licence Apple). `system-ui` ne reste qu'en **fallback** le temps du chargement d'Inter.

Règle:
- tout le texte UI doit rester sur cette stack,
- seule la grande typo à deviner peut utiliser la font cible.

### Tokens principaux

Dans `app/globals.css`:
- `--ui-title-size: clamp(2rem, 3.2vw, 2.75rem)`
- `--ui-title-line: 1.06`
- `--ui-subtitle-size: clamp(0.98rem, 1.35vw, 1.12rem)`
- `--ui-subtitle-line: 1.42`
- `--ui-title-gap: 0.72rem`

### Classes canoniques

- `.ui-page-title`
- `.ui-page-subtitle`

### Styles de texte gameplay actuellement visibles

Mot à deviner:
- `font-size: clamp(2.5rem, 7.3vw, 5.2rem)`
- largeur max: `10.5ch`

Labels de réponse:
- UI stack neutre
- `font-size: clamp(0.92rem, 1.32vw, 1.04rem)`
- `font-weight: 610`
- `letter-spacing: 0.004em`

Feedback sous les réponses:
- taille: `0.84rem`
- couleur neutre en idle,
- vert sur correct,
- rouge sur wrong

### Casse / hiérarchie

Règles actuellement cohérentes:
- titres de page: sentence case ou caps éditoriales selon écran
- méta labels / mini labels: uppercase
- valeurs importantes: plus lourdes et plus grandes

## 4) Palette validée du mode competition

### Palette d'identité de jeu validée

Couleurs d'accent actuellement validées dans `competition`:
- info / time / bleu: `#455cc7`
- positif / score / vert: `#21785e`
- attention / answered / ambre: `#9b5c0e`
- négatif / warning / rouge: `#b33636`

Versions soft de fond:
- bleu soft: `rgba(142, 162, 255, 0.12 -> 0.14)`
- vert soft: `rgba(103, 214, 182, 0.13 -> 0.14)`
- ambre soft: `rgba(245, 191, 106, 0.14 -> 0.15)`
- rouge soft: `rgba(179, 54, 54, 0.08)`

Versions dark:
- bleu dark text: `#b9c4ff`
- vert dark text: `#9ef0d4`
- ambre dark text: `#ffd79a`
- rouge dark text: `#fca5a5`

### Palette des 4 cartes réponses

Ces couleurs sont utilisées comme accents latéraux des options:
- card 1: `#8EA2FF`
- card 2: `#67D6B6`
- card 3: `#F5BF6A`
- card 4: `#F39AB1`

Important:
- le rose `#F39AB1` existe bien dans le gameplay,
- il n'est pas encore assez bien documenté dans les docs de contrat.

## 5) Où la couleur doit servir

Logique recommandée pour `competition summary`:
- structure: neutre
- données principales: couleur légère
- signaux positifs: vert
- signaux moins bons: rouge
- accent analytique / info: bleu
- accent secondaire / volume / review: ambre

Donc:
- axes, bordures, grille: neutres
- lignes de graphes: colorées mais fines
- points de graphes: colorés selon le signal
- cartes de stats: fond très léger + top line ou valeur colorée
- gros titres: neutres sauf décision explicite

## 6) État actuel de la page Competition Summary

Aujourd'hui la page `summary` utilise:
- hero neutre
- ligne de synthèse avec accents bleu / vert / ambre
- cartes de stats colorées par ton
- panneaux majoritairement neutres
- graphes scientifiques fins avec lignes colorées
- barres de catégories colorées selon la performance

Page de preview:
- `/play/competition?preview=complete`

## 7) Incohérences détectées à revoir ensemble

### A. Docs de contrat trop strictes vs code réel

`docs/ui/ui-consistency-contract.md` dit aujourd'hui:
- noir / blanc / jaune pour la structure
- vert / rouge seulement pour validation
- accents mode surtout sur `/play` et `/rules`

Mais le code réel de `competition` utilise aussi:
- bleu info
- ambre attention
- rose d'accent de carte

Donc:
- soit on durcit le code pour revenir à ce contrat,
- soit on met le contrat à jour pour refléter la vraie direction.

### B. Deux familles de verts différentes

On a aujourd'hui:
- vert canonique docs: `#00c853`
- vert competition: `#21785e`
- vert feedback dark: `#4ade80`

Donc il y a une vraie incohérence.

### C. Deux familles de rouges différentes

On a aujourd'hui:
- rouge canonique docs: `#ff0000`
- rouge competition summary: `#b33636`
- rouge dark feedback: `#f87171`

Donc là aussi il faut arbitrer.

### D. Neutre global vs neutre gameplay

Les docs globales parlent surtout de:
- `#111114`
- `#ffffff`

Mais le gameplay light travaille beaucoup avec:
- `#2a1a20`
- `rgba(58, 38, 48, ...)`

Ce n'est pas forcément mauvais,
mais ce n'est pas encore écrit clairement comme choix de direction.

### E. Rose non contractualisé

Le rose `#F39AB1` existe comme 4e accent d'option.
Il est visuellement réel,
mais pas encore intégré comme accent officiellement documenté.

## 8) Proposition de validation à faire ensemble

Je te propose qu'on fixe explicitement ces 5 points:

1. Neutre principal du gameplay light
- option A: `#111114`
- option B: `#2a1a20`

2. Vert canonique unique
- TRANCHÉ (2026-07-07) : `#00c853` (`--success-green`) est le vert de succès canonique.
  `#21785e` reste seulement comme variante light lisible sur beige des pages typo.

3. Rouge canonique unique
- TRANCHÉ (2026-07-07) : `#ff0000` (`--error-red`) est le rouge d'erreur canonique.
  `#b33636` reste, pour l'instant, la nuance propre au summary competition (à arbitrer).

4. Bleu / ambre dans competition
- oui, autorisés comme palette analytique
- ou non, trop éloignés de la règle site-wide

5. Rose des cartes
- oui, on le garde et on le documente
- ou non, on le remplace

## 9) Reco pragmatique

Ma reco actuelle:
- garder les neutres globaux du site pour la structure générale,
- garder le neutre chaud gameplay `#2a1a20` pour les écrans de jeu light,
- garder la palette competition bleu / vert / ambre / rouge,
- documenter officiellement le rose de carte,
- unifier ensuite les verts et rouges des feedbacks interactifs.

## 10) Si on veut nettoyer proprement ensuite

Ordre recommandé:
1. valider la palette canonique finale
2. corriger `docs/ui/ui-consistency-contract.md`
3. corriger `docs/ui/front-ui-master-spec.md`
4. faire un passage CSS pour unifier les teintes incohérentes
5. refaire une mini passe visuelle sur `competition` et `training`

## 11) Palette validée — page `/play` (mode-select, RÉFÉRENCE)

`/play` (`ModeSelectPage`) est la **référence couleur validée** du projet.
Ce qu'elle utilise réellement (vérifié dans `app/globals.css`, classes `.mode-select-*`):

### Conteneur (shell, en dark)
- bordure + halo: **jaune de marque `#ffd213`** à faible opacité
  - bordure: `rgba(255, 210, 19, 0.22)`
  - halo radial: `rgba(255, 210, 19, 0.045)`
- fond: blanc translucide très léger sur fond noir

### Les 3 identités de mode (un accent par carte)
- training → **vert `#40d38f`** (`--mode-training`)
- competition → **orange `#ff934a`** (`--mode-competition`)
- expert → **bleu `#58a9ff`** (`--mode-expert`)

### Comment l'accent est appliqué sur chaque carte
- bordure de carte: `color-mix(accent 28%, ligne)` → **contour coloré, basse intensité**
- fond de carte: teinte d'accent **très faible** (5–6 %)
- petit chip label: bordure accent 36 %, fond accent 5 %
- halo flou décoratif: accent 8 %
- **jamais** de remplissage plein en couleur, **jamais** de gros bouton coloré

### ⚠️ Note orange / ambre
`/play` utilise l'orange `#ff934a` (`--mode-competition`), alors que §4 documente
l'ambre `#9b5c0e` / dark `#ffd79a` comme couleur « attention ».
Il y a donc deux oranges/ambres concurrents → à trancher (cf §7).
Le jaune `#ffd213` reste, lui, l'accent de marque non négociable.

## 12) RÈGLE COULEUR — la couleur vit sur les contours, jamais sur le texte

Règle confirmée par `/play` (surtout en dark):

- **Contours / bordures / chips**: peuvent porter la couleur (accent à 24–36 %)
- **Fonds**: teinte d'accent **très faible** seulement (3–8 %)
- **Texte**: reste **neutre**
  - titres → `--ink-strong` / blanc
  - corps → `--ink-muted`
  - en dark, même le texte **dans** un chip coloré reste blanc (`rgba(255,255,255,0.84)`),
    seul le **contour** est coloré
- **Jaune `#ffd213`** = accent de **marque** (conteneurs, focus, glow), pas une couleur de catégorie
- **Vert / orange / bleu** = identités de **catégorie / mode**, en **traits fins** uniquement

Conséquence directe:
- un accent en **aplat plein** (gros CTA coloré, fond d'option colorié) est **hors-règle**
- il faut ramener la couleur sur le **contour** + une teinte de fond minime
- le neutre porte la structure, la couleur ne fait que **signaler**

## 13) RÈGLE TEXTE

- Stack UI unique (token `--ui-sans`): `"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif`
  (Inter OFL auto-hébergé = même police partout ; seule la grande typo à deviner peut utiliser la font cible)
- **Titres de page**: neutres (`--ink-strong` / blanc), poids ~640, tracking serré négatif (~ -0.04em)
- **Corps / sous-titres**: `--ink-muted`, line-height ~1.4
- **Mini-labels / méta / kickers**: UPPERCASE, `letter-spacing ~0.16em`, poids 700,
  couleur `--ink-soft` (**neutre — jamais coloré**)
- Le texte n'est **jamais** la surface qui porte la couleur d'accent (cf §12)
- **Seule exception**: le feedback interactif (vert sur correct, rouge sur wrong)
