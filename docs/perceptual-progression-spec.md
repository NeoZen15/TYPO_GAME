# Perceptual Progression Spec — la carte du regard

Status: draft / proposal
Last update: 2026-06-16
Aligné avec `scoring-and-selection-math.md` v3.1 — modèle **palier→axe**, **XP = système**, **jetons**.

Vision source (joueur): `docs/NIVEAU.rtf`
Docs liés:

- `docs/training-database-master-recap-v7.md` — moteur mastery + scheduler + tables data cibles
- `docs/training-engine-spec-v2-clean.md` — moteur d'entraînement
- `docs/game-unified-spec-v1.md` — modes, routes, contrats
- `lib/profile/mock-profile.ts` — modèle profil actuel (à migrer)
- `features/profile/components/ProgressBoard.tsx` — board linéaire actuel (à migrer)

---

## 0. But de ce document

Traduire la vision « carte du regard » (`NIVEAU.rtf`) en modèle **implémentable**.

Ce doc **ne redéfinit pas** le moteur de répétition espacée ni le calcul de maîtrise par typo : ça vit déjà dans `training-database-master-recap-v7.md` et `training-engine-spec-v2-clean.md`. On spécifie ici **la couche qui se pose par-dessus** :

1. les 8 axes perceptifs et leur **mapping sur des champs data réels** ;
2. comment l'état d'un axe est **dérivé** de la maîtrise par typo ;
3. les **seuils** (provisoires) ;
4. la **migration** de la page profil (du board linéaire vers la carte).

---

## 1. Principes non négociables

- **Deux couches étanches** : l'**Œil** (perso, monotone — ne régresse jamais) et l'**Arène** (compétition, volatile — monte/descend). Le score d'arène n'affecte jamais la maîtrise.
- **Carte non-linéaire** : les axes s'allument par **seuils**, dans un **ordre personnel**. Pas de chapitres séquentiels.
- **La maîtrise par typo est la seule source de vérité.** Les axes en sont **dérivés** (vue agrégée), jamais l'inverse. On ne stocke pas un « niveau d'axe » qu'on incrémente à la main.

---

## 2. Les 8 axes — définition formelle et source de données

`structural_signature` (réel, par typo) contient :
`a_type`, `e_aperture`, `axis`, `contrast`, `terminals`, `serifs`, `x_height`, `fixed_width`, `width`, `caps_only`, `distinctive_w`.

`typefaces_core` contient notamment :
`primary_category`, `sub_category`, `visual_cluster_id`, `dreyfus_tier`, `difficulty_base`, `rarity_tag`, `designer`, `foundry`, `release_year`, `year_tag`, `expert_enabled`, `min_mode`, `contrast_profile`, `aperture_profile`.

| # | Axe (`id`) | Libellé joueur | Source de données | Statut |
|---|---|---|---|---|
| 1 | `shape` | Voir la forme | Pas de champ dédié — **proxy** : reconnaissance globale en début de parcours (silhouette / bouma). | live (proxy) |
| 2 | `families` | Voir les familles | `primary_category`, `sub_category`, `visual_cluster_id` | live |
| 3 | `structure` | Voir la structure | `structural_signature.{e_aperture, contrast, axis, terminals, x_height, width}` (sous-dimensions) | live |
| 4 | `rhythm` | Voir le rythme | texture/espacement — compare-stage `word-overlay` (pas de champ signature direct) | partiel |
| 5 | `signatures` | Voir les signatures | `structural_signature.{a_type, distinctive_w, terminals}` + marqueurs glyphe | live |
| 6 | `confusion` | Voir la confusion | `confusion_families`, `confusion_pairs`, `misread_cards` (tables cibles recap v7 — **à finaliser**) | live (cœur moteur) |
| 7 | `intention` | Voir l'intention | `designer`, `foundry`, `release_year`, `year_tag` + un champ **usage** à ajouter | **roadmap** |
| 8 | `designer` | Voir comme un designer | micro-variations (graisse / taille optique / révision / fonderie) — paires à construire | **roadmap** |

> Note `structure` : c'est un faisceau. Option A — un seul axe agrégé qui s'allume globalement. Option B — sous-axes allumables (`aperture`, `contrast`, `axis`, `terminals`, `x-height`). Recommandation : **agréger en un axe** pour le profil, mais **tracer les sous-dimensions** en coulisses pour le ciblage des questions. (Question ouverte §10.)

---

## 3. Modèle de progression : palier → axe (dérivé)

> Calcul = source de vérité dans `scoring-and-selection-math.md` §2 et §4. Rappel ici.

La progression s'emboîte : **palier → axe → œil**. Tout est **dérivé** de la maîtrise par typo, jamais incrémenté à la main.

1. **Maîtrise par typo** = boîtes de Leitner `0..5` (math-spec §2). Une typo est **maîtrisée** quand sa boîte `≥ 4`.
2. **Palier** : `R(P)` = typos pertinentes (cf. §4·B) ; `a(P)` = précision récente du concept ; `m(P)` = nb de typos **distinctes** correctement traitées (= **généralisation**, pas mémorisation de typos).
   **Palier allumé** ⇔ `a(P) ≥ 0.80` ET `m(P) ≥ 5` typos distinctes.
3. **Axe allumé** ⇔ `≥ 70 %` de ses paliers (non-roadmap) sont allumés.

États (monotones, jamais régressifs), au niveau palier ET axe :

- `dormant` — pas encore assez d'exposition ;
- `emerging` — exposition suffisante, en progression mais < seuil ;
- `lit` — seuil franchi ; **reste `lit` à vie**.
- `needs_refresh` — drapeau d'**affichage** quand le dessous a décliné (oubli) ; **n'éteint jamais** `lit` (math-spec §4.1, I13).

> Pas d'état « locked » qui régresse. L'Œil ne recule pas (cf. §1) — c'est ce qui le distingue du rang d'Arène.

---

## 4. Seuils (provisoires — à calibrer en data)

| Mécanisme | Valeur provisoire |
|---|---|
| Typo « maîtrisée » | boîte de Leitner ≥ 4 (avance seulement si réponse juste **et** rapide pour le joueur — math-spec §2.1) |
| Palier « allumé » | `a(P) ≥ 0.80` ET ≥ 5 typos **distinctes** correctement traitées (généralisation, pas mémorisation) |
| Axe « allumé » | ≥ 70 % de ses paliers (non-roadmap) allumés |
| Intervalles répétition (Leitner) | 1 j → 3 j → 7 j → 21 j → 60 j (réussite +1 cran, échec −1 cran) |
| Une typo ratée ne revient pas avant | ~10 questions ET ~24 h (le plus tardif) |
| Passage en mode Expert | typo maîtrisée en reconnaissance + `expert_enabled = true` + pas de sosie non résolu |

Ces valeurs doivent vivre dans `scheduler_policy` / une table `axis_policy`, pas en dur dans le front.

---

## 4·B. Les paliers — libellés produit (35)

**Deux règles non négociables :**
1. **Un palier = un concept général, jamais une typo.** Les typos précises (Helvetica, tel Garamond) sont de la *data* (`confusion_pairs`, catalogue) — la matière, pas le nom du palier.
2. **« Allumé » = généralisation, pas mémorisation.** Un palier s'allume quand le joueur applique le concept correctement sur des typos **variées** (`a(P) ≥ 0.80` sur ≥ 5 typos **distinctes**), pas quand il a mémorisé 5 typos précises. Les boîtes par typo (math §2) ne servent qu'à la **planification** (répétition espacée).

Libellé produit = **terme (vrai mot typo)** — *phrase claire* · `donnée`. Langue : anglais (UI).

**01 · Seeing Shape** — *Read the silhouette before the letters.* (`R` = toutes typos vues)
- **Weight** — heavy or light? · `weight_structure`
- **Roundness** — round, or angular? · silhouette
- **Width** — narrow, or wide? · `width`
- **Ascenders & descenders** — tall, or short? · dérivé

**02 · Seeing Families** — *Place it in its family.*
- **Serif or sans** — feet, or none? · `serifs`
- **Monospace** — every letter the same width? · `fixed_width`
- **Script** — drawn by hand, or set in type? · `primary_category`
- **Text or display** — to read, or to show off? · `primary_category` / `caps_only`
- **Serif class** — old-style, transitional, didone or slab? · `sub_category`
- **Sans class** — grotesque, humanist or geometric? · `sub_category`

**03 · Seeing Structure** — *The anatomy of a letter.* (1 palier = 1 champ `SS`)
- **Aperture** — openings open up, or close in? · `e_aperture`
- **Contrast** — even strokes, or thick-and-thin? · `contrast`
- **Stress (axis)** — upright, or leaning? · `axis`
- **Terminals** — a foot, a ball, or a clean cut? · `terminals`
- **x-height** — tall lowercase, or short? · `x_height`
- **Set-width** — condensed, or extended? · `width`

**04 · Seeing Rhythm** — *The rhythm of a line.* (`R` = rendu paragraphe)
- **Cadence** — a steady beat, or uneven?
- **Type colour** — an even grey, or patchy?
- **Tracking** — tight, or loose?
- **Kerning** — spot the badly-fitted pair.

**05 · Seeing Signatures** — *The tells that give a face away.*
- **Storeys** — a one- or two-storey a and g? · `a_type`
- **Leg, tail & spur** — the R's leg, Q's tail, G's spur. · glyphes R/Q/G
- **Dot & bar** — the i's dot, the e's bar. · glyphes i/e, `distinctive_w`

**06 · Seeing Confusion** — *Near-identical twins.* (paires = `confusion_pairs`, **par famille**)
- **Grotesque twins** — grotesque sans that mirror each other.
- **Old-style twins** — old-style serifs that look alike.
- **Geometric twins** — round geometrics, easy to confuse.

**07 · Seeing Intention** `roadmap` — *What a face is made to do.* (nécessite champ `usage`)
- **Text faces** — drawn for long reading.
- **Signage faces** — read fast, from far.
- **Didones** — high contrast, made to feel refined.
- **Neutral grotesques** — made to disappear.
- **Humanist faces** — made to feel warm.

**08 · Seeing like a Designer** `roadmap` — *What only a trained eye catches.* (paires intra-famille)
- **Weights** — tell neighbouring weights apart.
- **Optical sizes** — a display cut, or a text cut?
- **Revivals** — the original, or a modern revival?
- **Foundry** — whose studio drew it?

**Total : 35 paliers** — live (axes 1-6) **26**, roadmap (axes 7-8) **9**.

---

## 5. Lien avec le moteur existant

- **Ne pas dupliquer** `scheduler_policy`. La maîtrise par typo provient du moteur (`user_typeface_mastery_snapshot`, recap v7).
- **À ajouter côté data** :
  - un **mapping `typeface → axes`**, dérivable de `structural_signature` + `primary_category` (déterministe, pas saisi à la main) ;
  - une **vue agrégée** `user_axis_progress(user_id, axis_id, exposed, mastered, pct, state, lit_at)` recalculée à partir du snapshot de maîtrise.
- S'inscrit dans les tables déjà prévues (recap v7 §5) : `user_typeface_mastery_snapshot`, `user_confusion_graph_edges`, `dashboard_metric_definitions`.

---

## 6. Migration de la page profil

### 6.1 Modèle actuel (`lib/profile/mock-profile.ts`)

- `ProfileBoard { currentChapter, chapters: ProfileBoardChapter[] }` avec `state: "done" | "current" | "locked"` → **linéaire**.
- `level`, `xpInLevel`, `xpForNext` → barre d'XP globale.
- `milestones[]` avec `done/current/locked` → doublon de progression.
- `ProgressBoard.tsx` rend un serpent où `CHAPTERS_ON_BOARD = 5` chapitres ordonnés.

### 6.2 Cible

- Remplacer `chapters` (linéaire, `done/current/locked`) par une **carte d'axes** (8 axes, état `dormant/emerging/lit`, non ordonné).
- **Conserver le rendu serpent** comme habillage visuel possible, mais **piloté par les axes** (pas un parcours ordonné) — ou le repenser en constellation (question ouverte §10).
- **XP / niveau joueur = système à part entière** (math-spec §6). Au total **3 monnaies distinctes** : XP→niveau (volume), maîtrise→axes (capacité), arène→rang (compétition) — plus les **jetons** (dépense pure, math-spec §16). Le titre d'œil est dérivé du nombre d'axes `lit`, **en complément** du niveau (pas à sa place).
- **Séparer visuellement** (cf. `NIVEAU.rtf` §8) : bloc **Œil** (axes + streak + titre) et bloc **Arène** (rang Bronze→Diamant). Le rang ne vit **pas** dans le serpent.

### 6.3 Nouveaux types proposés (TS)

```ts
export type PerceptualAxisId =
  | "shape" | "families" | "structure" | "rhythm"
  | "signatures" | "confusion" | "intention" | "designer";

// monotone : jamais "locked" (qui régresserait)
export type AxisState = "dormant" | "emerging" | "lit";

export type PerceptualPalier = {
  id: string;          // ex. "3.1"
  label: string;       // nom de jeu, ex. "Ouvert / Fermé"
  state: AxisState;
  a: number;           // précision récente 0..1
  mastered: number;    // typos en boîte ≥ 4
  needsRefresh?: boolean;
  roadmap?: boolean;
};

export type PerceptualAxis = {
  id: PerceptualAxisId;
  label: string;
  state: AxisState;
  paliers: PerceptualPalier[];   // axe = agrégat de ses paliers
  litRatio: number;              // part de paliers allumés 0..1
  litAt?: string;                // ISO, posé une fois au passage "lit"
  needsRefresh?: boolean;        // affichage seul, n'éteint jamais "lit"
  roadmap?: boolean;
};

export type EyeProfile = {
  title: string;                 // dérivé du nb d'axes "lit"
  level: number;                 // niveau joueur (système à part entière)
  xpInLevel: number;
  xpForNext: number;
  coins: number;                 // monnaie de dépense (jetons)
  axes: PerceptualAxis[];
  streak: number;
  dailyGoal: { done: number; target: number };
};

export type ArenaRank =
  | "bronze" | "silver" | "gold" | "platinum" | "diamond";

export type ArenaProfile = {
  rank: ArenaRank;
  division: number;
  weeklyPoints: number;
  elo: number;
};
```

### 6.4 Compat

Garder la forme `MOCK_PROFILE` fonctionnelle pendant la migration : ajouter `EyeProfile`/`ArenaProfile` **à côté**, faire lire les axes par `ProgressBoard`, puis retirer `chapters`/`milestones` (doublons linéaires) une fois la carte branchée. **`level`/`xp` restent** (= le système de niveau).

### 6.5 Recâblage des chapitres actuels → axes

Les titres existants recoupent déjà les axes — on **recâble**, on ne jette pas :

| Chapitre actuel | Axe cible |
|---|---|
| The big picture (sans/serif) | `families` |
| Serif structure | `structure` |
| Monospace & numerals | `families` (`fixed_width`) |
| Contrast & axis | `structure` |
| Display & character | `signatures` |

---

## 7. Modes — accroche data

> Taxonomie complète (**3 modes · 10 sous-modes · 7 formats**) : `scoring-and-selection-math.md` §1·B. Ici, seulement l'accroche data.

- **Expert** : `typefaces_core.expert_enabled` + `min_mode` existent déjà. Règle d'ouverture = typo maîtrisée en reconnaissance ET `expert_enabled`. Normalisation via `expert_answer_keys` (alias validés, casse/accents ignorés).
- **Compétition** : pool global pour comparabilité ; arène séparée ; n'affecte pas la maîtrise (invariant).

---

## 8. Difficulté & anti-frustration

- Ordre d'exposition piloté par `dreyfus_tier` / `difficulty_base` / `rarity_tag` (du plus lisible au sosie subtil).
- Garde-fous (invariants moteur, recap v7) : pas de retour immédiat d'une typo ratée, fallback sans casser l'UX, pas de score visible en entraînement.

---

## 9. Roadmap — niveaux 7 & 8

- **`intention`** : mécanique « match the brief ». Prérequis data : champ **usage/contexte** par typo (à ajouter à `typefaces_core` ou table dédiée).
- **`designer`** : discrimination de micro-variations. Prérequis data : **paires** « même famille, graisse / taille optique / révision / fonderie différente ».

Tant que ces mécaniques n'existent pas, les deux axes restent `roadmap: true` (affichés grisés, jamais faussement allumés).

---

## 10. Questions ouvertes

1. Rendu **serpent conservé** (habillage) ou **constellation** (mieux aligné sur le non-linéaire) ?
2. Titre d'œil : **liste figée** ou généré depuis le nombre d'axes `lit` ?
3. Valeurs de seuils **définitives** (§4) — à caler sur la télémétrie (math-spec §11).

*Tranchées :* `shape` = proxy assumé · `structure` = un axe agrégé dont les **sous-axes sont les paliers** (§4·B).

---

## 11. Découpage d'implémentation

Séquencement produit canonique : `scoring-and-selection-math.md` §18 (MVP v0 → phases 2-4). Travail data/profil correspondant :

- **MVP v0** (Entraînement seul) : mapping `typeface → axes` (§4·B), vue `user_axis_progress`, table `axis_policy` ; type `EyeProfile` ; `ProgressBoard` lit les axes ; carte + niveau/XP + streak.
- **Phase 2** : séparation visuelle Œil/Arène, `needs_refresh`, jetons.
- **Phase 3** : `ArenaProfile` (rang/ligue/compétition).
- **Phase 4** : Expert (`expert_enabled`/`min_mode`) ; mécaniques `intention`/`designer` (axes roadmap) ; mode Maître.
