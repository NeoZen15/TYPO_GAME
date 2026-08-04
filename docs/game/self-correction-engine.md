# Moteur d'auto-correction du niveau declare

Status: draft
Last update: 2026-07-07

**Ce doc = comment le niveau declare en onboarding cesse d'etre un prior fige et devient un prior qui S'EFFACE quand la performance reelle le contredit.** Il decrit cinq changements branches sur le moteur Leitner existant (docs/game/training-engine-spec-v2-clean.md), sans rien reecrire de ce qui fonctionne deja.

Regle de lecture : la spec moteur v2 fait foi pour les invariants (I-01 a I-14) et les fenetres d'intervalle (§4.1). Ce doc dit ou et comment chaque piece se branche.

---

## 1. Le probleme

La familiarite declaree ("Not at all", "A little", "Quite familiar", "Designer") ne servait qu'a une chose : choisir QUEL contenu seeder au cold-start (`init_user_pool(uuid, familiarite)`, migrations 004 a 006). C'etait un prior de CONTENU fige :

- Tous les joueurs, quel que soit le niveau declare, demarrent a `mastery_level = 0` sur chaque typo (spec §7.1, migration 003). Le niveau declare ne pose donc aucun mastery de depart, il ne fait que biaiser la difficulte des 30 faces seedees.
- Consequence : un faux expert (declare "Designer", seede avec beaucoup de faces `hard` tier C, cf. migration 006) restait coince sur des specimens trop durs. Il ratait, le mastery redescendait certes d'un cran par erreur (I-04), mais l'intervalle de retour etait FIXE (`+2` apres erreur, `+10` apres reussite) et ne dependait pas du mastery. Le poids adaptatif prevu par la spec (§4.6) existait en base (`adaptive_coef`, migration 003) mais n'etait JAMAIS ecrit. Rien ne poussait activement le joueur vers de la matiere qu'il pouvait reussir, et sa progression n'etait pas visible en jeu.

Objectif : faire du niveau declare un prior qui FOND vite. La performance reelle doit reprendre la main rapidement, un faux expert doit redescendre vers du contenu passable, et la progression doit se voir. Tout en reutilisant le modele Leitner deja calibre (promotion/demotion 0 a 4, difficulte des distracteurs indexee sur le mastery, seed par session).

---

## 2. Les cinq changements

### Stage 1 : activer le poids adaptatif dormant (spec §4.6)

Quoi : la colonne `adaptive_coef` (defaut 1.0, bornes [0.5, 2.0], migration 003) etait LUE dans le calcul d'intervalle mais jamais ECRITE. On l'ecrit desormais dans `submitTrainingAnswer`.

- Sur mauvaise reponse avec `consecutive_session_errors >= 2` (valeur APRES increment, conforme a l'ordre de la spec §5.2) : `coef = min(coef + 0.1, 2.0)`. Une typo repetee en erreur devient plus frequente.
- Sur bonne reponse avec un streak de bonnes reponses `>= 3` (`consecutive_correct + 1`, valeur apres cette reponse) : `coef = max(coef - 0.05, 0.5)`. Une typo stabilisee s'espace.

Pourquoi : c'est le levier fin de la spec (§4.6) qui module l'intervalle sans toucher au mastery ni casser les cooldowns (I-13).

Fichiers et fonctions : `lib/game/training/provider.ts`, `submitTrainingAnswer`. La colonne `adaptive_coef` est persistee DANS les UPDATE existants (branche `wrongFirstTry` et branche `correctFirstTry`), sans requete nouvelle. La lecture de `consecutive_correct` a ete ajoutee a la requete `stateRows` (et au type `PoolRow`, plus a `getPoolRows` pour rester coherent).

Reutilisation Leitner : aucun nouveau modele. On alimente une variable que le moteur consommait deja (`provider.ts` calcul d'intervalle).

### Stage 2 : intervalles indexes sur le mastery (spec §4.1)

Quoi : `computeWrongNextDue` et `computeCorrectNextDue` renvoyaient `+2` et `+10` fixes et IGNORAIENT le mastery. On les reecrit pour prendre le mastery SUIVANT (celui apres promotion/demotion) et utiliser les fenetres par niveau de la spec :

```
L0 : 1..3     L1 : 3..6     L2 : 10..25     L3 : 25..50     L4 : 80..150
```

Mecanique (`intervalForLevel`) : point deterministe = milieu de la fenetre (testable, la spec §4.2 tire un uniforme, un milieu fixe reste reproductible), puis `adjusted = round(base / adaptive_coef)` (§4.2), puis plancher au cooldown absolu EN DERNIER (`>= 2` apres erreur pour I-01, `>= 5` apres reussite pour I-02). Le coef ne peut donc jamais casser les cooldowns (I-13).

Pourquoi : c'est ce qui fait qu'une face fraichement retombee en L0/L1 revient tres vite (1 a 6 questions) alors qu'une face L4 attend 80 a 150 questions. La redescente devient visible et rapide.

Fichiers et fonctions : `lib/game/training/provider.ts`, nouvelles constantes `INTERVAL_WINDOW` et helper `intervalForLevel`, fonctions `computeWrongNextDue` / `computeCorrectNextDue` (signature enrichie du `nextMastery`), appelees dans `submitTrainingAnswer` avec `nextMastery` et le `nextAdaptiveCoef` calcule au Stage 1 (ordre spec §5.2 : poids d'abord, cooldown ensuite).

Reutilisation Leitner : les fenetres sont exactement celles de la spec §4.1 ; on branche le mastery deja gere (promotion I-03 / demotion I-04 inchangees).

### Stage 3 : exploiter le resultat du warm-up d'onboarding (jusqu'ici jete)

Quoi : `OnboardingWarmup` n'emettait qu'un booleen "resolu". On capture maintenant si la manche de warm-up a ete reussie, et on s'en sert pour calculer une familiarite EFFECTIVE : un declarant avance ("Quite familiar" ou "Designer") qui rate le warm-up est retrograde d'UN cran AVANT le seeding. Un cran seulement, uniquement pour les declarants avances qui echouent. Repli sur : signal absent (`warmupCorrect` manquant), debutant, ou reussite, aucune retrogradation.

Chaine de bout en bout :

1. `features/onboarding/components/OnboardingWarmup.tsx` : la prop `onResolvedChange(resolved, correct)` transporte desormais la justesse. Mode auto (demo fantome debutant) : `correct = null` (rien a noter, un debutant n'est de toute facon jamais retrograde).
2. `features/onboarding/components/OnboardingFlow.tsx` : etat `warmupCorrect`, handler stable `handleWarmupResolved`, persistance dans `localStorage` cle `jdt-onboarding-v1` a cote de `familiarity` (type `StoredOnboardingAnswers.warmupCorrect`).
3. `features/game/components/GameScreen.tsx` : `readOnboarding()` relit `familiarity` + `warmupCorrect` et les envoie a `/api/training/session/start`.
4. `app/api/training/session/start/route.ts` : lit `warmupCorrect` du body (seul un vrai booleen est un signal) et le passe a `startTrainingSession`.
5. `lib/game/training/provider.ts` : `startTrainingSession` -> `ensureUserPool` -> `seedUserPool`. Le helper pur `effectiveFamiliarity(familiarity, warmupCorrect)` (avec `downgradeOneNotch` : Designer vers Quite familiar, Quite familiar vers A little) est applique juste avant `init_user_pool`. La familiarite DECLAREE reste enregistree telle quelle (`recordOnboardingFamiliarity`) pour l'analytics et pour le Stage 4.

Le contenu et les faces du warm-up ne changent pas.

Reutilisation Leitner : on ne change pas le moteur, on affine seulement l'argument passe a `init_user_pool` (migrations 004 a 006, deja calibrees). Un declarant avance qui rate demarre sur un pool un cran plus accessible.

### Stage 4 : rebalance descendant du pool (le vrai "redescendre") — code + migration, NON appliquee

Quoi : apres la fenetre de debut (environ 8 a 12 premieres reponses au premier essai, lues dans `user_event_fact`), si un joueur declare avance a une precision de debut basse (< 0.40), on AJOUTE des faces faciles au pool. Invariant I-06 respecte : on ne retire ni ne desactive JAMAIS une face, on ajoute seulement.

Trois pieces :

1. `db/migrations/007_pool_rebalance.sql` : `CREATE OR REPLACE FUNCTION rebalance_user_pool(p_user_id uuid)`, ADD-ONLY (`INSERT ... ON CONFLICT DO NOTHING`, aucun DELETE, aucun UPDATE qui retire), idempotente. Elle ajoute des typos `dreyfus_tier = 'N'`, `rarity_tag = 'common'`, `difficulty_base = 'easy'` (le plus bas), pas deja dans l'etat de l'utilisateur, diversifiees par `primary_category`, bornees par les slots libres jusqu'a la taille cible du pool (spec §7.1 : N/D=30, C=32, A=34, E=36 selon `users.dreyfus_level`), donc jamais de debordement. NON appliquee (voir §3).
2. `lib/game/training/provider.ts`, `maybeRebalancePool(userId)` : le code applicatif qui APPELLE la fonction. FAIL-SAFE : tout est enveloppe dans un try/catch, donc si `rebalance_user_pool` n'existe pas encore en base (007 pas appliquee) l'appel echoue silencieusement avec un `console.warn` et ne casse rien. L'app fonctionne a l'identique avant 007 ; la feature s'active des que le user applique 007. Le declenchement (niveau declare avance, fenetre 8 a 12, precision < 0.40) est decide ici, pas dans la fonction SQL. Appele dans `submitTrainingAnswer` juste apres l'UPDATE de session, AVANT le calcul de l'agregat et la question suivante, pour que les faces injectees soient comptees et eligibles tout de suite.
3. `lib/game/training/provider.ts`, `pickEligibleTypeface` : ajout d'un tiebreak `difficulty_base ASC` (helper `difficultyRank`, easy < medium < hard) AVANT le hash de seed. Code pur et sur, il fait remonter les faces faciles injectees (mastery 0) parmi les egalites. La colonne `difficulty_base` a ete ajoutee au type `PoolRow` et aux deux requetes (`getPoolRows`, `stateRows`).

Le preview DB du Stage 4 n'a pas ete lance dans cette session (regle anti-blocage, lecture DB optionnelle).

Reutilisation Leitner : les faces ajoutees entrent avec `mastery_level = 0`, exactement comme une entree de pool normale (P-09). Elles remontent naturellement via la selection existante (`pickEligibleTypeface`), le tiebreak ne fait que les prioriser parmi les egalites.

### Stage 5 : progression visible en jeu (reutilisation de profile-stats)

Quoi : on renvoie un agregat de progression dans le payload training et on affiche un indicateur discret dans `GameScreen`.

- `lib/profile/profile-stats.ts` : nouvelle fonction exportee `loadTrainingProgress(userId)` qui REUTILISE `buildEye` (lequel reutilise `levelFromXp`), donc le niveau d'oeil est calcule EXACTEMENT comme sur la page profil, sans formule parallele. Elle renvoie `eyeLevel`, `facesMastered`, `poolSize`, `avgMastery` a partir de 3 lectures seulement (contre le fan-out complet de `loadRealProfile`), assez leger pour tourner a chaque question resolue.
- `lib/game/training/contracts.ts` : le type `progress` est etendu (nouveau type `TrainingProgress` avec `eyeLevel?`, `facesMastered?`, `poolSize?`), partage par `TrainingStartResponse` et `TrainingAnswerResponse`.
- `lib/game/training/provider.ts` : helper fail-safe `safeTrainingProgress` (try/catch, la manche revient meme si l'agregat echoue). Calcule au demarrage de session et sur chaque question resolue (branches "correct"). Absent sur une mauvaise reponse non resolvante ; `GameScreen` fusionne le progress (`setProgress((prev) => ({ ...prev, ...payload.progress }))`) pour ne pas faire clignoter l'indicateur.
- `features/game/components/GameScreen.tsx` : indicateur discret `X / Y faces mastered`. Choix delibere : on affiche le COMPTE de faces maitrisees (signal de progression qui monte), PAS le niveau global d'oeil, que la spec (§15, cas N-24) garde hors de l'ecran de jeu sauf toast de changement de niveau. `eyeLevel` reste dans le payload (disponible pour un futur toast) mais n'est pas affiche en continu. Style CSS `.game-v2-progress` ajoute a `app/globals.css`, petit et attenue.

Reutilisation Leitner et profil : aucun recalcul, on importe et on reutilise `buildEye` / `levelFromXp` deja en place.

---

## 3. Migration 007 : statut et application

- Fichier : `db/migrations/007_pool_rebalance.sql`.
- Nature : additive, idempotente (`CREATE OR REPLACE`, corps a `INSERT ... ON CONFLICT DO NOTHING`, retourne 0 si le pool est deja plein), respecte I-06 (aucun retrait ni desactivation).
- Etat : **APPLIQUEE**, constate le 2026-07-29 en lecture seule (`rebalance_user_pool` presente en base). Le Stage 4 est donc actif et l'appel applicatif n'est plus un no-op. La commande ci dessous n'a plus a etre lancee, elle reste pour l'historique.
- Jamais observe en conditions reelles : le declencheur demande une fenetre de 8 a 12 premieres reponses chez un declarant avance, et la base ne compte que 10 premieres tentatives training au total (audit du 2026-07-29).

Commande d'application EXACTE (a lancer par le user, non executee ici) :

```
node --input-type=module <<'EOF'
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
const line = readFileSync(".env.local","utf8").split("\n").find(l => l.startsWith("DATABASE_URL="));
const url = line.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g,"");
await neon(url).query(readFileSync("db/migrations/007_pool_rebalance.sql","utf8"));
console.log("APPLIED 007");
EOF
```

---

## 4. Comportement concret d'un faux expert

Un joueur se declare "Designer" mais lit mal.

1. Warm-up rate (Stage 3) : la familiarite effective passe de "Designer" a "Quite familiar" avant le seeding. Le pool de depart est deja un cran moins dur (moins de faces hard tier C, cf. migration 006).
2. Des les premieres reponses (Stages 1 et 2) : chaque erreur fait redescendre le mastery d'un cran (I-04) ET, grace aux intervalles indexes sur le mastery, la face revient tres vite (fenetre L0 1..3 ou L1 3..6 questions, encore raccourcie si `adaptive_coef` monte apres 2 erreurs consecutives). Le joueur re-affronte donc rapidement ce qu'il rate, au lieu d'attendre un intervalle fixe.
3. Fenetre de debut, precision < 0.40 (Stage 4, une fois 007 appliquee) : des faces faciles tier N common easy sont AJOUTEES au pool, et le tiebreak `difficulty_base ASC` les fait surface tout de suite. Le joueur a enfin de la matiere passable, sans qu'aucune face dure ait ete retiree (I-06).
4. Progression visible (Stage 5) : l'indicateur "faces mastered" monte a mesure qu'il stabilise les faces faciles.

Vitesse : la redescente est immediate cote intervalles (Stages 1 et 2 actifs des maintenant), et l'ajout de matiere facile intervient vers la 8e a 12e reponse (Stage 4, seulement apres application de 007). Avant 007, la redescente repose entierement sur Stages 1 a 3, deja suffisants pour ne plus rester coince, mais sans injection de nouvelles faces faciles.

---

## 5. Anti-collusion

- En jeu : deja randomise par session (seed par session, `provider.ts`, ordre des options et selection melanges). Partager les reponses d'une session ne transfere pas a une autre.
- Warm-up : reste un script partageable (memes faces, meme bonne reponse par niveau declare, `features/onboarding/warmup-rounds.ts`). Enjeu faible : le warm-up ne sert qu'a un prior de cold-start et, au pire, a eviter une retrogradation d'un cran. TODO basse priorite : varier la manche de warm-up ou la rendre non deterministe si l'on veut fermer ce vecteur.

---

## 6. Invariants respectes

- I-01 / I-02 : cooldowns plancher (`>= 2` erreur, `>= 5` reussite) appliques APRES le poids adaptatif dans `intervalForLevel`.
- I-03 / I-04 : promotion/demotion du mastery inchangees (`submitTrainingAnswer`).
- I-06 : aucune face retiree ni desactivee. Stage 4 est strictement additif (007 : INSERT only ; runtime : appel fail-safe).
- I-13 : le poids adaptatif reste borne [0.5, 2.0] et ne peut pas casser les cooldowns.
- Spec §15 / cas N-24 : le niveau global d'oeil n'est pas affiche en continu en jeu ; l'indicateur Stage 5 montre un compte de maitrise, pas le niveau global.
- P-09 : les faces ajoutees par le rebalance entrent a `mastery_level = 0`.

---

## 7. Comment verifier chaque piece

- Stage 1 : jouer, rater 2 fois de suite la meme typo dans une session, verifier en base que `adaptive_coef` de cette ligne est passe a 1.1 ; enchainer 3 bonnes reponses sur une typo, verifier qu'il baisse de 0.05. Requete : `SELECT typeface_slug, adaptive_coef, consecutive_correct, consecutive_session_errors FROM user_typeface_state WHERE user_id = ...`.
- Stage 2 : apres une bonne reponse a mastery 0 (promotion vers L1), verifier `interval_questions` proche du milieu de fenetre L1 divise par le coef, jamais sous 5 ; apres une erreur, jamais sous 2. Lecture `interval_questions` / `next_due_after_q`.
- Stage 3 : dans l'onboarding, se declarer "Designer", rater le warm-up, verifier dans `localStorage` (`jdt-onboarding-v1`) que `warmupCorrect = false`, puis que le pool seede correspond a "Quite familiar" (moins de hard) et non a "Designer". `onboarding_familiarity` en base reste "Designer".
- Stage 4 (apres application de 007) : simuler un declarant avance a faible precision sur 8 a 12 reponses, verifier que des faces `tier N common easy` apparaissent en plus dans `user_typeface_state` (`in_active_pool = true`, `mastery_level = 0`) sans depasser la taille cible, et qu'aucune face n'a disparu. Avant 007 : verifier dans les logs le `console.warn` "rebalance_user_pool skipped" et l'absence de crash.
- Stage 5 : en jeu, verifier l'indicateur "X / Y faces mastered" et sa mise a jour apres une question resolue ; verifier via `render_game_to_text` que `progress` porte `facesMastered` / `poolSize`.
