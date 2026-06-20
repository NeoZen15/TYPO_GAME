# Backend — état réel & feuille de route

Status: draft (d'après un audit rapide du code, 2026-06-19)
Liés : `scoring-implementation-contract.md` (l'agrégation à écrire), `scoring-and-selection-math.md` (le modèle cible).

## ✅ Ce qui existe — c'est PLUS solide qu'il n'y paraît
- **DB Neon/Postgres** (`lib/server/neon.ts`) avec un **schéma sérieux** :
  `users`, `sessions`, **`user_typeface_state`** (maîtrise par user×typo), **`user_event_fact`** (télémétrie **partitionnée par mois** + `event_ingestion_guard` anti-doublon), `typefaces_core`, `font_runtime_assets`, `expert_answer_keys`.
- **Providers réels** (`lib/game/training|competition/provider.ts`) :
  créent/MAJ les users, lisent `mastery_level`, **choisissent les distracteurs selon la maîtrise + catégorie + cluster visuel** (= vraie difficulté adaptative), et **écrivent chaque réponse dans `user_event_fact`**.
- **Routes** training/compétition (answer, session start/timeout).

→ Le **jeu + la maîtrise par typo + la télémétrie** tournent **en vrai**. Ce n'est pas léger.

## ❌ Les vrais manques (ce qui fait que ça SEMBLE léger côté profil)
1. **L'agrégation « progression ».** Transformer `mastery_level` + events en **paliers → axes → `EyeProfile` → niveau/XP**. La matière brute existe, l'agrégation **non** → c'est exactement `scoring-implementation-contract.md` (`buildEyeProfile`). C'est ÇA que le profil affiche, et c'est mock.
2. **Auth réelle.** Les users sont **anonymes, auto-créés** (role/locale/consent) — pas de login. → la progression n'est rattachée à **aucun compte**.
3. **Arène.** Ligues, ELO, divisions, reset hebdo → **rien**.
   ⚠️ **Le mur n'est pas le code, c'est la population** : classement / matchmaking / ELO n'ont **aucun sens à 0 joueur**. → la faire **tard** (après avoir des users), **tout en async** (façon Duolingo, **pas de PvP temps réel**), et **gérer le cold-start** (pool unique ou bots/ghosts pour ne pas que ce soit désert).
   Décomposition : **Blitz** (sprint 2 min solo) ≈ déjà faisable (le mode compétition existe) · **Ligue** (hebdo, classement async) · **Duel** = le plus dur → le faire **en async** (les 2 reçoivent la **même série**, jouent séparément, on compare) **en dernier**. Saisons = un simple **cron**.

## ⚠️ LE point à trancher (ce que ton instinct a flairé)
Le back code **un modèle de maîtrise** (`mastery_level` entier + scoring par heuristique de distracteurs) **qui n'est PAS** celui de la math-spec (**boîtes Leitner 0-5**, intervalles, courbe XP, combo, allumage paliers/axes).

→ **À réconcilier** (pas maintenant, mais avant de brancher le profil en vrai). Trois voies :
- **(a) Migrer** le back vers la math-spec (boîtes Leitner, nouveau scoring) — propre, plus de travail.
- **(b) Aligner la math-spec** sur ce qui est déjà codé — plus rapide, mais on perd une partie du design.
- **(c) Hybride** *(reco)* : garder la sélection adaptative existante (elle marche), poser **l'agrégation `EyeProfile` + le nouveau XP/paliers par-dessus**, et **mapper `mastery_level ↔ boîtes**`.

## Le gros chantier data (souvent sous-estimé)
**Catalogue : ~28 typos validées → cible 1700+.** Pipeline d'ingestion + validation (`structural_signature`, `confusion_pairs`, `expert_answer_keys`) = un vrai morceau, indépendant du moteur.

## Ordre (après validation du concept)
1. **Trancher le modèle** (réconciliation ci-dessus).
2. **`buildEyeProfile`** : agrège `user_typeface_state` + events → `EyeProfile` → endpoint qui **remplace `MOCK_EYE`** (le type ne bouge pas).
3. **Auth** (rattacher la progression à un compte).
4. **Arène** — **async, tardive, cold-start géré** (Blitz → Ligue → Duel async ; saisons = cron). N'a de sens qu'avec une population de joueurs.
5. **Catalogue à l'échelle** (28 → 1700+).

> Rien de tout ça **avant** d'avoir validé le concept au test. Le mock suffit jusque-là.
