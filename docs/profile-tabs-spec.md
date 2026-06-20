# Profile — spec des onglets

Status: draft
Last update: 2026-06-19

Liés : `perceptual-progression-spec.md` (modèle, 2 couches), `scoring-and-selection-math.md` (arène §7), `scoring-implementation-contract.md` (d'où vient chaque nombre), `handoff-page-parcours.md` (Path).

**Nav :** Path · Profile · Stats · Activity · Achievements · Preferences.
**HUD compact** (titre d'œil · niveau · XP · streak) = **persistant en haut de tous les onglets**.

**Règles transverses (à ne pas casser) :**
- **Œil** (perso, *monte seulement*) ≠ **Arène** (compétition, *monte/descend*, reset hebdo). **Jamais mélangés.**
- Les **Stats** se ventilent par les **8 axes / concepts** (pas de catégories random).
- Tout vient du **mock** aujourd'hui (`mock-profile.ts`) ; même swap mock→API que l'`EyeProfile` (cf. contrat).

---

## 1. Path — la galaxie *(déjà fait)*
L'Œil : DWIGGINS en 8 lettres-galaxies, 35 paliers, zoom. Voir `handoff-page-parcours.md`.

## 2. Profile — identité + ARÈNE ⭐ *(le seul à vrai design)*
**Deux blocs visuellement distincts :**

**A) Identité + résumé de l'Œil** (durable, monte seulement)
- avatar/initiales, nom, @handle, « membre depuis » ;
- **titre d'œil** (dérivé du nb d'axes `lit` : Novice → … → Trained eye → Œil de designer) ;
- mini-résumé : **niveau + barre XP**, `X/8 galaxies`, `X/35 paliers`, **streak 🔥** ;
- → bouton vers **Path**.

**B) Arène** (volatile, monte/descend, reset hebdo)
- **blason Bronze → Diamant**, division + ta place ;
- **points de la semaine** (`S_week`), compte à rebours de fin de semaine ;
- ELO masqué (ou discret) ;
- → bouton vers **Compétition**.

> Visuel : A = ton identité ; B = ta saison. **Séparés** (forme/couleur différente). Le rang ne vit jamais dans le bloc Œil. (cf. `perceptual-progression-spec.md` §6, math §7.)

**⚠️ Avant d'avoir des joueurs (lancement / test) — UNE seule histoire honnête :**
- **Blitz = le seul vrai maintenant** (sprint 2 min, solo) → affiché **jouable**, avec le **meilleur score perso** (marche sans personne).
- **Rang (Skill Rating, blason, division, promotion) + Duel + Ligue = état « preview »** : *« s'allume après le lancement, quand l'arène a une population »* (comme le panneau « arrives with the crowd »). **Pas de SR/rang factice** (pas de « 1240 · #9 · Silver II ») — ça contredit l'empty-state.
- Leaderboard « around you » + historique de matchs = déjà en empty-state ✅.
→ Toute la page doit raconter la même chose : **Blitz tourne dès maintenant ; l'arène classée s'allume avec la foule.**

## 3. Stats — les chiffres, **par axe**
- **KPIs** : parties jouées · précision globale · meilleur score (arène) · meilleur streak · typos vues (`X/catalogue`) · temps d'entraînement.
- **Précision par axe** : une barre pour chacune des 8 manières de voir (précision + nb vus). ← *remplace les anciennes « categories »*.
- **Vitesse** : temps moyen · nb de réponses < 2 s.
- *(option)* **Tes confusions** encore fréquentes (familles de sosies pas démêlées — `confusion_pairs`).

## 4. Activity — l'assiduité
- **Streak** actuel + record.
- **Calendrier** (heatmap ~30 j, sessions/jour) — `activity[]`.
- **Objectif du jour** (fait / cible) — `dailyGoal`.
- **Sessions récentes** : mode · précision · résultat · quand — `recentSessions`.

## 5. Achievements — badges *(branchés sur de vrais événements)*
Gagnés + à débloquer (barre de progression). Familles :
- **Progression** : 1ᵉʳ palier allumé · 1ᵉʳ axe · **les 8 axes (DWIGGINS complet)**.
- **Streak** : 7 / 30 / 100 / 365 j.
- **Vitesse** : X réponses < 2 s.
- **Exploration** : X typos vues.
- **Maîtrise** : une famille entière · sans-faute en Expert.

> Les badges se débloquent sur les **événements du scoring** (math §5.7 / §16), pas sur des compteurs inventés.

## 6. Preferences — réglages
- **Thème** clair / sombre (`ThemeSwitch` existe déjà).
- **Mouvement réduit** (accessibilité — **clé** vu les animations de la galaxie).
- **Langue** (si multi-langue).
- **Compte** : connexion / déconnexion, données.
- *(option)* cible de l'objectif quotidien.

---

## Données (mock → réel)
Aujourd'hui : `mock-profile.ts` (`kpis`, `categories`→axes, `recentSessions`, `activity[]`, `badges`, `streak`, `dailyGoal`, `ArenaProfile`).
Demain : un endpoint `/api/profile/*` qui renvoie les mêmes types (cf. `scoring-implementation-contract.md` §7). **Le type reste, la source change** → les pages ne bougent pas.

## Priorité (pour le test)
1. **Profile/Arène** (le seul à vrai design — révèle la 2ᵉ couche).
2. Stats (par axe) + Activity (standard).
3. Achievements + Preferences (standard, peuvent rester légers pour le test).
