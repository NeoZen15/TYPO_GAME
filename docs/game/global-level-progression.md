# Niveau global visible N.1 a E.5

Status: implemente (migration 009 ecrite, non appliquee)
Derniere maj: 2026-07-09
Docs lies: `training-engine-spec-v2-clean.md` (I-05, I-08, I7, N-22, N-24, N-25, P-04, POOL_TARGET_BY_TIER), `scoring-and-selection-math.md` (§6 XP, distinct du niveau Dreyfus), `perceptual-progression-spec.md`.

---

## 1. Le probleme : une colonne morte

`users.dreyfus_level` (le palier N, D, C, A, E) et `users.dreyfus_sub` (le sous-niveau 1 a 5) existent depuis la migration 003, mais `dreyfus_level` n'etait JAMAIS ecrit. Tout le monde restait bloque a `N`.

Consequence directe sur la migration 008 (croissance du pool) :

1. `try_unlock_one_typeface(p_user_id)` filtre les nouvelles typos par `users.dreyfus_level` (clause `dreyfus_tier <= niveau` et compatibilite `rarity_tag` de la table §7.2). Palier fige a `N` donc seules des typos `tier N`, `rarity common` pouvaient entrer.
2. `POOL_TARGET_BY_TIER` (spec §7.1, ligne 153 : N/D 30, C 32, A 34, E 36) fait grandir la cible du pool selon ce meme palier. Palier fige a `N` donc la cible restait a 30.

Resultat : le pool pouvait grandir en NOMBRE a l'interieur du tier N, mais jamais en DIFFICULTE. Le joueur ne montait jamais vers des typos plus dures. Cette tache fait vivre le niveau global visible pour que la difficulte du pool grimpe reellement avec la performance. C'est l'aboutissement de « le joueur n'est jamais bloque et continue de progresser ».

Apercu lecture seule confirmant le probleme (voir §8) : les 83 utilisateurs non supprimes sont tous a `stored = N.1` avec `n4 = 0` (aucune typo a mastery 4).

---

## 2. La formule : un compte de typos maitrisees

### 2.1 Ce que dit la spec

La spec fixe la NATURE du calcul, pas les seuils exacts :

- I-08 : « Le niveau global visible (N.1 a E.5) ne remplace jamais la logique interne de repetition espacee. Il en est la lecture agregee. »
- Ligne 708 (§9.2) : « Calcul niveau global visible : Agregation des mastery_level a chaque reponse. »
- I7 : la competition n'alimente que l'XP plafonnee, jamais le moteur training (boites, axes). Le niveau visible ne lit que la maitrise (`mastery_level`), donc par construction il est hors XP et hors competition. C'est une lecture de la maitrise, pas un score de points.
- Decisions figees (§13) : « Niveau global visible : Recalcule a chaque reponse. »

La spec fixe donc la nature (agregation des `mastery_level`, sans XP) mais PAS le mapping precis vers les 25 crans N.1 a E.5. Ce mapping est une calibration RAISONNEE et parametrique : les seuils ci-dessous sont des parametres de game-design ajustables, pas des constantes imposees par la spec.

Note importante : ce niveau Dreyfus visible est l'agregation de la MAITRISE (`mastery_level`). Il est distinct du « eye level » base sur l'XP (scoring-and-selection-math §6, deja porte par `progress.eyeLevel`), qui est un systeme de volume separe. Les deux coexistent dans le payload et ne se remplacent pas (I7 : le niveau Dreyfus reste hors XP).

### 2.2 La formule (expertise accumulee = compte de mastery >= 4)

Lecture retenue : le niveau visible mesure l'EXPERTISE ACCUMULEE, c'est a dire le NOMBRE de typos que le joueur a vraiment maitrisees. On lit un COMPTE, pas une fraction. L'ancienne piste (fraction du pool a `mastery_level >= 3` et `>= 4`) saturait beaucoup trop vite sur un catalogue de 1000+ typos : quelques typos stabilisees dans un petit pool suffisaient a atteindre les paliers hauts. Le compte, lui, passe a l'echelle du catalogue.

```
n4   = |{ user_typeface_state du user : mastery_level >= 4 }|   -- compte total, pas une fraction
step = plus haut index (0..24) dont le seuil <= n4             -- table de seuils ascendants ci-dessous
tier = ['N','D','C','A','E'][ floor(step / 5) ]                -- division entiere (0..4)
sub  = (step % 5) + 1                                          -- 1..5
```

`n4` est le compte TOTAL des typos a `mastery_level >= 4` pour l'utilisateur (pas de filtre `in_active_pool` : l'expertise acquise ne se perd pas). Comme `mastery_level` est borne a 4 au schema, `>= 4` vaut exactement `= 4`.

Table des seuils (n4 MINIMUM pour ENTRER dans chaque cran) :

| cran | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 |
|------|---|---|---|---|---|---|---|---|---|---|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|
| n4 min | 0 | 3 | 6 | 9 | 12 | 15 | 20 | 25 | 30 | 35 | 40 | 52 | 64 | 76 | 88 | 100 | 130 | 160 | 190 | 220 | 250 | 320 | 400 | 500 | 650 |
| niveau | N.1 | N.2 | N.3 | N.4 | N.5 | D.1 | D.2 | D.3 | D.4 | D.5 | C.1 | C.2 | C.3 | C.4 | C.5 | A.1 | A.2 | A.3 | A.4 | A.5 | E.1 | E.2 | E.3 | E.4 | E.5 |

Reperes de lecture : N.1 a n4=0, D.1 a n4=15, C.1 a n4=40, A.1 a n4=100, E.1 a n4=250, E.5 a partir de n4>=650.

Proprietes :

- Monotone : `n4` ne croit que lorsqu'une typo atteint `mastery 4`. Le cran cible ne peut donc que monter quand la maitrise progresse.
- Bornes : aucune typo maitrisee (n4=0) donne N.1 ; 650 typos maitrisees ou plus donne E.5 (cran plafonne a 24).
- Pas de saturation : ajouter des typos NON maitrisees au pool ne fait PAS bouger le niveau (contrairement a l'ancienne fraction). Seule la maitrise reelle compte.

Courbe : les seuils sont serres au debut (progression rapide dans N et D, pour recompenser les premiers acquis) puis s'espacent (A et E demandent un vrai volume d'expertise). E.5 vers 650 typos maitrisees represente un joueur expert sur une large part du catalogue 1000+.

Source de verite unique : cette table est identique au tableau en tete de `db/migrations/009_global_level.sql` (constante `v_thresholds` de la fonction et vue de preview). Recalibrer se fait aux deux endroits en meme temps.

Exemples verifies (apercu lecture seule, §8) : n4=0 donne N.1 ; n4=3 donne N.2 ; n4=15 donne D.1 ; n4=40 donne C.1 ; n4=100 donne A.1 ; n4=250 donne E.1 ; n4=650 donne E.5.

---

## 3. Mise a jour par reponse et regression bornee (P-04)

### 3.1 Recalcule apres CHAQUE reponse (N-22)

La fonction SQL `recompute_visible_level(p_user_id)` (migration 009) est appelee par le provider (`lib/game/training/provider.ts`, `submitTrainingAnswer`) apres CHAQUE reponse, juste apres l'ecriture du `mastery_level` et apres le declencheur d'unlock I-07. Elle tourne pour les reponses correctes, les erreurs au premier essai, et les retries. Elle est donc atomique avec l'ecriture de la reponse (un seul appel SQL derriere la mise a jour du mastery). C'est N-22 (« recalcule apres chaque reponse, pas uniquement en fin de session »).

### 3.2 Regression bornee (P-04)

`recompute_visible_level` calcule d'abord le cran cible `target_idx` (via `n4` et la table de seuils), lit le cran persiste `prev_idx`, puis applique la transition :

```
si target_idx >= prev_idx :  new_idx = target_idx                 -- montee libre vers la cible
sinon                     :  new_idx = max(target_idx, prev_idx-1) -- descente d'AU PLUS un sous-niveau
```

Le niveau peut donc monter librement (rien ne borne la montee dans la spec) mais ne peut descendre que d'un sous-niveau par appel. Il ne « chute jamais de plusieurs sous-niveaux d'un coup » (P-04). En pratique une reponse ne fait varier le `mastery_level` que d'une seule typo, et comme `n4` ne compte que les typos deja a mastery 4, `n4` ne bouge que de 1 au plus par reponse (une typo franchit le seuil de mastery 4 vers le haut ou vers le bas). Les seuils etant espaces d'au moins 3, le cran cible se deplace lui aussi d'au plus un cran par reponse ; la borne P-04 s'ajoute par securite. A noter : contrairement a l'ancienne formule par fraction, debloquer une typo neuve (mastery 0) ne dilue plus rien et ne fait donc jamais baisser le niveau.

La fonction retourne `prev_tier, prev_sub, new_tier, new_sub, changed`. `changed` est vrai uniquement quand le cran persiste a bouge, ce qui pilote le toast.

---

## 4. Comment cela fait grandir la difficulte du pool (via 008)

Boucle complete :

1. Le joueur stabilise des typos (mastery monte vers 3 puis 4).
2. `recompute_visible_level` fait monter `users.dreyfus_level` / `dreyfus_sub`.
3. Au prochain franchissement d'un 3e mastery 4 (seuil I-07), `register_mastery_unlock` appelle `try_unlock_one_typeface`, qui lit desormais un `dreyfus_level` PLUS ELEVE : il peut introduire des typos de `dreyfus_tier` superieur et de `rarity_tag` plus rare (table §7.2).
4. `POOL_TARGET_BY_TIER` autorise une cible de pool plus grande (32, 34, 36 selon C, A, E).

Le pool grandit donc en difficulte, pas seulement en nombre. Le niveau reste un indicateur RETARDE : l'unlock d'une reponse donnee utilise le palier tel qu'il etait avant le recalcul de cette meme reponse ; le nouveau palier prend effet au unlock suivant. C'est le comportement voulu (le niveau est une lecture, pas un pilote direct).

---

## 5. Le toast de changement de niveau (N-24 / N-25)

- Le niveau global visible n'est JAMAIS affiche en continu sur l'ecran game (N-24, decision §13). L'indicateur discret existant montre « faces mastered », pas le palier.
- Le provider transporte `progress.visibleLevel` (chaine « N.3 ») et `progress.levelChanged` (booleen) dans `lib/game/training/contracts.ts` (`TrainingProgress`). `levelChanged` n'est present que sur les reponses (jamais sur le payload de demarrage, qui ne fait que lire le niveau comme baseline).
- `features/game/components/GameScreen.tsx` affiche un petit toast (`.game-v2-level-toast`, pilule jaune de marque, auto-disparition apres 3.2 s) UNIQUEMENT quand `levelChanged === true`. C'est N-25 (« un toast apparait quand level_changed=true »).

---

## 6. Invariants respectes

- I-05 : le `mastery_level` reste par utilisateur par typo. Le niveau global ne le remplace pas, il l'agrege.
- I-06 : aucune sortie de pool. `recompute_visible_level` ne touche jamais `in_active_pool`.
- I-08 : le niveau visible est une LECTURE du moteur. `recompute_visible_level` ne LIT que `user_typeface_state.mastery_level` et n'ECRIT que `users.dreyfus_level` et `dreyfus_sub`. Il ne modifie jamais mastery, intervalles, next_due ni pool. La repetition espacee (004 a 008) et l'autocorrection (007) ne sont pas touchees.
- P-04 : regression bornee a un sous-niveau par appel (voir §3.2).

Aucune regression des migrations 004 a 008 ni du code d'autocorrection (007) / croissance de pool (008) : 009 est strictement additif (une fonction, une vue, une garde de colonne idempotente).

---

## 7. Migration 009 (ecrite, NON appliquee)

Fichier : `db/migrations/009_global_level.sql`. Idempotente : `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `CREATE OR REPLACE VIEW`. Contenu :

1. Garde defensive `ADD COLUMN IF NOT EXISTS dreyfus_sub` (no-op : 003 la definit deja avec la contrainte 1 a 5).
2. `recompute_visible_level(p_user_id uuid)` : recalcul, regression bornee, persistance, retour `prev/new/changed`.
3. `v_user_visible_level` : vue de preview lecture seule (niveau cible calcule sans persistance).

Le code provider est FAIL-SAFE : avant l'application de 009, `recompute_visible_level` n'existe pas, l'appel leve une erreur, le provider log un `console.warn` et la manche continue sans le niveau. `safeReadVisibleLevel` (demarrage de session) ne lit que des colonnes de 003, donc fonctionne meme sans 009.

### Commande d'application (a lancer manuellement, NON executee ici)

```
node --input-type=module <<'EOF'
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
const line = readFileSync(".env.local","utf8").split("\n").find(l => l.startsWith("DATABASE_URL="));
const url = line.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g,"");
await neon(url).query(readFileSync("db/migrations/009_global_level.sql","utf8"));
console.log("APPLIED 009");
EOF
```

---

## 8. Comment verifier

1. `npm run typecheck` : doit passer (verifie).
2. `npx eslint lib/game/training/provider.ts lib/game/training/contracts.ts features/game/components/GameScreen.tsx` : doit etre propre (verifie).
3. Apercu lecture seule (avant application de 009), qui confirme la colonne morte et la formule :
   - les 83 utilisateurs non supprimes sont tous a `stored = N.1` avec `n4 = 0` (aucune typo a mastery 4), donc cible calculee `N.1` (coherent : rien de maitrise encore).
   - le mapping des seuils, teste sur des valeurs de `n4` synthetiques, tombe exactement sur les reperes : n4=0 donne N.1, n4=3 donne N.2, n4=15 donne D.1, n4=40 donne C.1, n4=100 donne A.1, n4=250 donne E.1, n4=650 (et au-dela) donne E.5.
4. Apres application de 009 : `SELECT * FROM v_user_visible_level ORDER BY n4 DESC LIMIT 5;` (lecture seule) montre le niveau cible par utilisateur ; en jeu, faire monter des typos a mastery 4 fait apparaitre le toast quand le palier bouge, et `window.render_game_to_text()` expose `progress.visibleLevel`, `progress.levelChanged` et `levelToast` pour un controle sans capture d'ecran.

---

## 9. Deviations et risques

- Calibration parametrique de la formule : la spec fixe la nature (compte des `mastery_level`, hors XP par I7) mais pas les seuils exacts. Les seuils sont donc des parametres de game-design assumes, a recalibrer avec la telemetrie si besoin. Source de verite unique : le tableau en tete de `009_global_level.sql`, la constante `v_thresholds` de `recompute_visible_level`, la vue `v_user_visible_level` et la table du §2.2 doivent rester alignes (un seul `CREATE OR REPLACE`).
- P-04 est implemente comme une borne d'UN sous-niveau par appel (unite atomique = la reponse). Lecture defendable de « jamais plusieurs sous-niveaux d'un coup ». Une borne stricte par session entiere demanderait de stocker un niveau de debut de session, non present au schema ; la borne par appel empeche deja tout effondrement soudain.
- Le toast s'affiche pour toute variation (montee comme descente rare et bornee), fidele a N-25 (« toast quand level_changed=true »). Le libelle est neutre (« New level X.Y »).
