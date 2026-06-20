# Scoring — contrat d'implémentation

Status: draft
Last update: 2026-06-16

**Ce doc = le branchement, PAS les formules.** Les formules vivent dans `docs/game/scoring-and-selection-math.md` (référencé ici par `math §X`). On ne les recopie pas — en cas de doute, **la math-spec fait foi**.

But : dire au dev **d'où vient chaque nombre affiché**, **quand** on le calcule, **où** vit l'état, et **quelles fonctions** écrire pour passer du **mock** au **vrai jeu**.

---

## 1. Trois niveaux de données (à ne pas confondre)

| Niveau | Quoi | Stocké ? | Source |
|---|---|---|---|
| **A — Faits** | la vérité brute par joueur | ✅ stocké (serveur) | écrit à chaque réponse |
| **B — Dérivés** | états calculés à partir de A | ❌ jamais stocké (recalculé) | fonctions pures |
| **C — Instant** | calcul d'une réponse | ❌ (résultat → écrit dans A) | au moment du jeu |

### A — Faits stockés (la seule source de vérité)
```
par (user, typeface) :  box ∈ {0..5}, last_seen
par user :              xp_total, streak, last_played_day, daily_progress,
                        coins, rt_med (médiane glissante des temps),
                        arena { s_week, elo, division }
historique :            les N dernières réponses par palier (pour a(P)) — math §4
```
Tables cibles (recap v7) : `user_typeface_mastery_snapshot` (box, last_seen), `user_event_fact` (historique), `user_axis_progress` (cache optionnel des dérivés).

### B — Dérivés (recalculés, jamais stockés en dur)
```
level, xpInLevel, xpForNext   ← levelFromXp(xp_total)              math §6
m(P) (typos maîtrisées)       ← compter box ≥ 4 dans R(P)          math §4
a(P) (précision récente)      ← moyenne des N derniers            math §4
état palier (dormant/emerging/lit) + needs_refresh                 math §4 / §2.2
état axe + litRatio                                                math §4
```

### C — Calculé à l'instant d'une réponse
```
points         ← scoreAnswer(...)        math §5
nouvelle box   ← updateBox(...)          math §2.1
arena_pts/elo  ← arenaScore/updateElo    math §7
coins gagnés   ← earnCoins(events)       math §16
```

> **Règle d'or :** on stocke les **faits** (A) et on **recalcule** les dérivés (B). On ne stocke jamais « niveau 7 » ou « palier allumé » comme un fait figé — sinon ça se désynchronise.

---

## 2. D'où vient chaque nombre affiché (page Parcours)

| À l'écran | Calcul | Réf |
|---|---|---|
| `LVL 7` | `levelFromXp(xp_total).level` | math §6 |
| `320/700 XP` | `xpInLevel / xpForNext` (= 100 × niveau) | math §6 |
| `🔥 4` (streak) | fait stocké `streak` | math §5.6 |
| `2/8 galaxies` | nb d'axes dont `state === "lit"` | math §4 |
| `13/35 paliers` | somme des paliers `lit` / **total** | voir §6 ci-dessous |
| `emerging : Seeing Structure 3/6` | axe `emerging` au plus haut `litRatio` | math §4 |
| `+1300 XP` (par axe, zoom) | `axisXp(axis)` = `paliers·100 + 500` | math §5.7 (E) |
| `2/8 paliers lit` (zoom) | compter paliers `lit` de l'axe | math §4 |
| état lettre (lit/emerging/dormant/roadmap) | `axis.state` (dérivé B) | math §4 |
| tags paliers (allumé/éteint) | `palier.state` (dérivé B) | math §4 |

> `axisXp` existe déjà (`lib/profile/mock-profile.ts`) et donne bien +1300 pour Signatures (8·100+500) — cohérent. ✅

---

## 3. Le pipeline (quand on calcule)

### À chaque réponse (serveur — `resolve`)
Suivre le pseudocode **math §9**. En clair :
```
1. applyDecay(user, typeface)          // oubli      math §2.2
2. box = updateBox(box, correct, t, tau, rt_med)     math §2.1
3. pushAnswer(palier, correct)         // pour a(P)
4. events = evalLighting(palier, axe)  // palier/axe vient de s'allumer ? math §4
5. points = scoreAnswer(...) ; xp_total += points     math §5
   (si mode compétition : s_week += arenaScore ; updateElo ; xp plafonné §6.2)
6. coins += earnCoins(events)          math §16
7. updateStreakCombo / daily_progress  math §5.5-5.6
8. log(event_row)                      math §11
9. last_seen = now ; update rt_med
```

### Au chargement de la page Parcours
```
eye = buildEyeProfile(userState)   // assemble l'EyeProfile que lit ProgressConstellation
```
`buildEyeProfile` recalcule **tous les dérivés (B)** à partir des **faits (A)**. La page ne calcule QUE de l'affichage (xpPct, comptages) à partir de cet objet.

### En fin de session / changement de jour
```
clôture combo (math §5.5) ; objectif du jour atteint ? (+50 XP, +coins) ; reset daily_progress au nouveau jour.
```

---

## 4. Les fonctions à écrire (signatures)

```ts
// — instant (C) —
scoreAnswer(input): { points: number; events: ScoreEvent[] }      // math §5
updateBox(box, correct, t, tau, rtMed): number                     // math §2.1
isDue(box, lastSeen, now): boolean                                 // math §2.2
arenaScore(correct, t): number                                     // math §7.1
updateElo(elo, oppElo, win): number                                // math §7.2
earnCoins(events): number                                          // math §16

// — dérivés (B) —
levelFromXp(xp): { level; xpInLevel; xpForNext }                   // math §6
palierState(palier, recentAnswers): "dormant"|"emerging"|"lit"     // math §4
axisState(axis): { state; litRatio; needsRefresh }                 // math §4
buildEyeProfile(userState): EyeProfile                             // assemble pour la page

// — sélection (pour jouer pour de vrai) —
selectNextChallenge(userState): Challenge                          // math §8
```
Toutes **pures** (sauf I/O DB), pour être testables avec des exemples (math §12).

---

## 5. Client vs serveur (intégrité)

- **Serveur = vérité.** Il stocke les faits (A), exécute `resolve` (C) et `buildEyeProfile` (B). Le client **n'écrit jamais** les scores (sinon triche).
- **Client = affichage.** Il reçoit un `EyeProfile` et fait des calculs **d'affichage** uniquement (xpPct, comptages `litPaliers`/`litGalaxies`) — c'est déjà ce que fait `ProgressConstellation`. ✅
- Le mode **Compétition** doit être jugé **serveur** (temps, score) — pas de confiance au client.

---

## 6. Un point à trancher : le dénominateur des paliers
La page affiche `13/35 paliers`. **35** = tous les paliers (live 26 + roadmap 9).
- **Affichage HUD** : reco **/35** (la collection complète = le mot DWIGGINS entier, motivant).
- **Seuils d'allumage** : excluent les 9 roadmap (axe lit = 70 % des paliers **non-roadmap**, math I9).
→ Deux dénominateurs différents, c'est normal : l'un pour montrer, l'autre pour décider. À documenter dans le code pour ne pas confondre.

---

## 7. Mock → réel (le swap)
- **Aujourd'hui** : `lib/profile/mock-profile.ts` exporte un `EyeProfile` écrit à la main (`MOCK_PROFILE`). La page le lit. Parfait pour tester l'UI.
- **Demain** : on garde **le type `EyeProfile` inchangé** (la page ne bouge pas). On remplace **la source** :
  ```
  MOCK_PROFILE  →  GET /api/profile/eye  →  buildEyeProfile(userState)  ← DB (faits A)
  ```
- Donc : tant que tu **testes l'UI**, le mock suffit. Ce contrat sert **au moment de brancher le vrai calcul** (phase 2, math §18).

---

## 8. Ordre d'implémentation
1. **Schéma des faits (A)** : box + last_seen par (user, typo) ; xp_total ; streak.
2. **`scoreAnswer` + `updateBox` + `levelFromXp`** (la boucle d'une réponse) — testés sur les exemples math §12.
3. **`buildEyeProfile`** (assembler l'`EyeProfile` depuis A) → l'API qui remplace le mock.
4. **`selectNextChallenge`** (math §8) → pour jouer pour de vrai.
5. **Arène / coins** (math §7, §16) → phase 3.

> Ne pas régler finement les constantes (κ, ω, seuils) ici — elles vivent en §13 de la math-spec et se calibrent avec la **télémétrie** (`user_event_fact`), pas à la main.
