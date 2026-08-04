# Brief de passation — page « Parcours » (carte-galaxie **DWIGGINS**, zoomable)

Pour le dev (Claude) qui implémente. À lire **avec** les 3 autres docs.
Direction **décidée le 2026-06-16** : carte-galaxie qui écrit **DWIGGINS** · **un seul écran zoomable** (le zoom = la navigation) · **HUD compact** (pas de bloc avatar).

> **Point à revoir depuis le 2026-07-29.** La carte-galaxie DWIGGINS est confirmée comme **la représentation principale** de la progression de l'élève, c'est le cœur de la vision (`docs/game/vision-produit-dwiggins.md` §8). En revanche le HUD compact du §3, `TRAINED EYE · LVL 7 · 320/700 XP · streak`, fait de l'XP la mesure du regard, ce que la vision interdit : l'XP est une couche d'engagement, jamais une preuve de compétence (invariant I-19), et le mastery n'est jamais présenté comme une note (I-18). Le HUD doit être repensé pour que ce qui mesure le regard vienne des faits pédagogiques, pas du compteur de points.
> Voir le registre des contradictions, entrée 4, dans le document de vision.

## 0. Les 4 docs (ordre de lecture)
1. `docs/game/NIVEAU.rtf` — la **vision joueur** (le pourquoi, le ton).
2. `docs/game/perceptual-progression-spec.md` — **modèle data + 35 paliers (§4·B) + types TS (§6.3) + migration profil**.
3. `docs/game/scoring-and-selection-math.md` — **formules + constantes (§13) + MVP (§18)**.
4. Ce brief — la **direction visuelle de la page Parcours**.

> ~~Règle : en cas de contradiction, **la spec maths fait foi**.~~
> **CORRIGÉ le 2026-07-29 : cette règle est renversée.** La math spec est sortie de la hiérarchie documentaire, elle est devenue un document de recherche sans autorité. En cas de contradiction, l'ordre est : **`docs/game/vision-produit-dwiggins.md`** (les principes), puis **`docs/game/training-engine-spec-v2-clean.md`** (leur traduction en règles pédagogiques), puis **`docs/game/architecture-backend.md`** (leur implémentation technique), puis les documents d'interface dont celui ci. Les renvois `math §X` de ce brief restent lisibles comme trace du raisonnement, ils ne sont plus des références applicables.

---

## 1. Le modèle, en une phrase (à NE PAS rater)
Le joueur **n'avance pas sur un rail**. Il **complète des paliers**, dans **son** ordre. Son **niveau = un pot général** (la somme de tout ce qu'il a fait), **pas une position**. → **Aucune barre de progression linéaire**, **aucun « niveau verrouillé tant que le précédent n'est pas fini »**.

- États d'un palier / axe : **`dormant` → `emerging` → `lit`** (+ `needs_refresh`). **Pas de `LOCKED`. Pas de pion unique. Pas de remplissage du début jusqu'à un point.**
- Allumage (math §4 / perceptual §3) : **palier `lit`** = précision récente ≥ 80 % **ET** ≥ 5 typos maîtrisées (boîte Leitner ≥ 4) ; **axe `lit`** = ≥ 70 % de ses paliers allumés.
- **Non-linéaire** : plusieurs galaxies peuvent être `emerging` **en même temps**. Une galaxie `lit` à côté d'une `dormant` est **normal** (pas un bug). L'œil **ne recule jamais** : `lit` reste `lit` (≠ rang d'Arène, cf. §7).

---

## 2. Direction visuelle : la carte-galaxie **DWIGGINS** (décidée)
On abandonne le serpent (un chemin « mentait » : il suggère un ordre obligé). On garde le **ciel étoilé**.

- **Chaque galaxie = un axe = une LETTRE-constellation.** Ses **étoiles = ses paliers** ; le **nombre d'étoiles d'une lettre = son nombre de paliers** (§4·B). Les paliers, par leur position, **tracent la lettre**.
- **Chaque galaxie s'allume seule**, dans l'ordre du joueur (cf. §1).
- 💡 **DWIGGINS = 8 lettres → les 8 galaxies écrivent le mot DWIGGINS** dans le ciel. Mapping (ordre du mot = facile → dur) :

| Galaxie | Axe | Lettre | Paliers |
|---|---|---|---|
| 01 | Seeing Shape | **D** | 4 |
| 02 | Seeing Families | **W** | 6 |
| 03 | Seeing Structure | **I** | 6 |
| 04 | Seeing Rhythm | **G** | 4 |
| 05 | Seeing Signatures | **G** | 8 |
| 06 | Seeing Confusion | **I** | 5 |
| 07 | Seeing Intention `roadmap` | **N** | 5 |
| 08 | Seeing like a Designer `roadmap` | **S** | 4 |

→ Quand les 8 sont allumées, **le mot DWIGGINS s'embrase en entier = maîtrise totale** (le moment « naissance d'un œil »).

**Difficulté = la MISE EN PAGE, pas un verrou.** L'ordre du mot (D = Shape, le plus lisible … S = Designer, le plus subtil — cf. `dreyfus_tier` / `difficulty_base`) range les galaxies du facile au fort. Mais **ce n'est qu'une disposition** : chaque lettre s'allume selon **ses** seuils, dans l'ordre du joueur. Deux joueurs voient **le même mot** mais ne l'allument **pas dans le même ordre**.

---

## 3. Le cosmos est fait de TYPO — et la LÉGIBILITÉ passe avant la beauté
**C'est ce qui rattache la beauté à la typo ET ce qui montre l'avancement. À ne pas négliger.**

**a) Le cosmos est FAIT de typo (pas des ronds génériques) :**
- les **étoiles = de vrais glyphes** (a, g, R, e…), pas des points ;
- le **cœur de chaque galaxie = un glyphe-héros** de l'axe (Forme = silhouette de mot floutée · Structure = un « e » ouvert · Signatures = un « g » à deux étages · Confusion = un « R » d'Helvetica…) ;
- **chaque palier montre son exemple typo réel** (ex. palier « ouvert / fermé » → deux « e » côte à côte, un ouvert un fermé) ;
- la **poussière d'étoiles du fond = des micro-lettres** éparpillées (police de catalogue `JDT__<slug>`, comme la landing).

**b) ⚠️ LÉGIBILITÉ D'ABORD (leçon de la 1ʳᵉ constellation, rejetée : « je comprends pas »).**
Des points dispersés, sans légende, **ne se lisent pas**. Chaque galaxie-lettre doit être une **UNITÉ LISIBLE** :
- son **nom** (« Seeing Structure »), son **état en toutes lettres** (`lit` / `emerging` / `dormant`), ses **paliers nommés** + leur exemple typo ;
- l'état doit se **distinguer d'un coup d'œil** (cf. §9) — la beauté (cosmos, glyphes) ne doit **jamais** coûter la lecture de l'état / de l'avancement.

---

## 4. UN écran, zoomable — le ZOOM est la navigation (décidé)
Pas deux pages : **un seul écran zoomable**. Le niveau de zoom décide ce qu'on voit.

### Vue large (dézoomée) = TA PROGRESSION — c'est l'accueil
- le mot **DWIGGINS** en 8 lettres-galaxies, chacune rendue selon **ton état** :
  - **`lit`** → lettre **tracée, qui brille** ; **`emerging`** → **à moitié tracée** (étoiles allumées + pointillés) ; **`dormant`** → **fantôme en pointillés sombres** ; **`roadmap`** (N, S) → **galaxie « non cartographiée »** (grisée, jamais faussement allumée).
- + le **HUD** (§5).
→ D'un coup d'œil : **où j'en suis**, quelle galaxie commencée / finie / pas touchée, et **quelle part de DWIGGINS est allumée**.

### Zoom dans une lettre = LA DÉCOUVERTE
- on clique / scrolle vers une galaxie → **zoom** → la lettre-constellation **se trace** ;
- on voyage **point par point** : chaque point = un **palier**, avec un encart qui l'explique (+ **exemple typo réel**) et son état ;
- **dézoomer** = revenir à la vue progression.

→ Le **zoom remplace la navigation entre pages** : reculer = *« où j'en suis »*, plonger = *« apprendre ce qu'il y a dedans »*. **Une seule expérience continue.**

---

## 5. HUD compact + mini-carte (toujours visible) — décidé
**PAS** le gros bloc avatar / nom (retiré). Une barre **compacte** d'avancement, toujours présente :

```
✦ TRAINED EYE · LVL 7 · ▓▓▓▓░ 320/700 XP · 🔥12      ← HUD compact
5/8 galaxies · 13/35 paliers · émerge : Rythme 1/4    ← compteurs + « ce qui émerge »
```

- **HUD** : titre d'œil (dérivé du nb d'axes `lit`) · niveau · barre XP · streak.
- **Compteurs** : `galaxies lit / 8` · `paliers lit / 42` (live = 33 ; 9 roadmap exclus des dénominateurs d'allumage, math I9).
- **« Ce qui émerge »** : la galaxie la plus proche de s'allumer (ex. *Rythme 1/4*).
- Quand on est **zoomé dans** une galaxie, la **mini-carte des 8** devient un petit repère de coin ; dézoomé, c'est la vue large elle-même.

---

## 6. Rappels de cohérence chiffrée (ne pas reproduire les erreurs de l'ancienne page)
- **Ne jamais allumer en dessous du seuil** : un palier `lit` exige ≥ 80 % (pas « cleared » à 74 %).
- **Courbe d'XP** (math §6) : niveau N→N+1 = **100 × N** → donc **7→8 = 700 XP** (pas 500).
- **Paliers** : suivre **§4·B** (libellés = vrai terme typo + phrase). Total **35** (live 26 / roadmap 9).
- **Vocabulaire d'état** : `lit / emerging / dormant` (jamais `cleared / in progress / locked`).

---

## 7. Séparation Œil / Arène (ne pas mélanger)
Cette page = la couche **Œil** (perso, **monte seulement**). Le **rang Bronze→Diamant** (Arène = compétition, **monte/descend**) vit **ailleurs** (autre onglet — `ArenaProfile`, déjà typé), **jamais dans les galaxies**. Raison : une galaxie ne fait que s'allumer ; un rang fluctue.

---

## 8. Par où commencer (MVP) — math §18
1. **Priorité : la vue large (progression)** — DWIGGINS en 8 lettres par état + HUD + compteurs. C'est l'accueil : le joueur doit d'abord **voir où il en est**.
2. Puis le **zoom dans une galaxie** (voir ses paliers, version simple, avec exemples typo).
3. Le **tour cinématique** (le zoom qui trace la lettre, glyphes-étoiles animés) = **polish, après le test**, pas avant.
4. **Ne pas régler finement les constantes** (κ, seuils…) maintenant → c'est la télémétrie qui tranche (math §13 = provisoire).

---

## 9. Technique & accessibilité (important)
- **Lisibilité de l'état = priorité n°1** (cf. §3b) : une galaxie `lit` doit **vraiment briller / fourmiller**, une `dormant` être **quasi noire**, avec en plus son **nom + état écrits**. Si on ne distingue pas l'état d'un regard, la page rate son but.
- **Perf** : starfield + zoom + glyphes-étoiles = lourd (GPU) → optimiser, prévoir **`reduced-motion`** (état final = défaut visible ; animations en pur enrichissement, cf. landing).
- **Scroll-jacking / zoom** : la navigation au zoom peut agacer si mal calibrée → tester finement, garder une sortie au clavier (a11y).
- `needs_refresh` : une galaxie allumée puis « oubliée » **pâlit** (étoiles qui s'éteignent) **sans jamais s'éteindre complètement** (math invariant I13) — **affichage seul**.
- DA = la **landing** (référence graphique) : beige `#e1e1d7` sur noir, labels mono, grille design-canvas, reveal visible-par-défaut.

---

## 10. État du code (au 2026-06-16)
- ✅ **`lib/profile/mock-profile.ts`** — modèle **`EyeProfile`** en place (8 axes / paliers §4·B — cible 35, **mock à resync sur les nouveaux libellés**, états `dormant/emerging/lit`, helpers `buildAxis`/`eyeTitle`/`litAxisCount`/`axisXp`, `coins`, `ArenaProfile`). `level`/`xp` conservés (= le « pot »). L'ancien `ProfileBoard`/`chapters` reste pour le fallback serpent.
- ⚠️ **`features/profile/components/ProgressConstellation.tsx`** — **prototype existant à RÉALIGNER sur ce brief.** Il diverge encore : voyage **vertical au scroll** (→ remplacer par **un écran zoomable**, §4), galaxies en **spirales** + vue d'ensemble en **une seule lettre « a »** (→ **8 lettres = DWIGGINS**, §2), **étoiles = points génériques** (→ **vrais glyphes**, §3a), **pas de HUD** (→ **HUD compact**, §5).
- **`features/profile/components/ProfileExperience.tsx`** — `const USE_CONSTELLATION` (serpent gardé en fallback dans `ProgressBoard.tsx`, ne rien supprimer) ; `const SHOW_IDENTITY = false` (gros bloc avatar retiré — le **HUD compact** §5 le remplace, ce n'est PAS le même bloc).

**Travail restant (ordre §8) :** réaligner `ProgressConstellation` → vue large DWIGGINS par état + HUD compact (1) ; zoom dans une lettre + paliers/exemples (2) ; cinématique + glyphes-étoiles animés (3).
