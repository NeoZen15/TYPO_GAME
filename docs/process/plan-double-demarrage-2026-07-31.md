# Double démarrage, convergence par clé primaire : plan d'implémentation

> **Pour un agent qui exécute ce plan** : utiliser `superpowers:subagent-driven-development` ou `superpowers:executing-plans`, tâche par tâche. Les étapes sont en cases à cocher.

**But.** Garantir qu'un même démarrage de séance, ou un simple rafraîchissement, ne puisse produire qu'une seule session et un seul invité, sans jamais fusionner deux tentatives réellement distinctes, sans perdre l'historique du jour et sans déplacer la progression pédagogique.

**Architecture.** Une tentative égale un identifiant. Le client frappe un uuid par tentative et le serveur l'utilise comme `sessions.session_id`, dont la clé primaire existe déjà : la base arbitre la course, aucun schéma ne change. L'identité vient du cookie httpOnly, résolue une fois et épinglée. La progression quotidienne quitte le comptage de sessions pour les événements, ce qui rend la déduplication invisible aux chiffres affichés.

**Pile.** Next.js 16.1.6, React 19.2.3, Neon Postgres, `@neondatabase/serverless` 1.0.2 (HTTP en autocommit pour le produit, `Client` en WebSocket pour les preuves).

## Contraintes globales

- **Aucune modification de schéma.** Pas de colonne, pas d'index, pas d'`ALTER TABLE`. La migration ne contient que des corps de fonctions.
- **Aucune écriture en production** sans feu vert explicite du propriétaire. Les preuves tournent sur une branche Neon jetable.
- **`npm run quality` ne lance pas les tests** et le repo n'a aucun runner de tests unitaires. L'idiome vérifiable de ce repo est un script `scripts/quality/check-*.mjs` autonome, qui **auto-teste sa logique pure sur des lignes synthétiques**. Les deux modèles à copier sont **suivis et verts depuis l'historique** : `scripts/quality/check-day-keys.mjs` et `scripts/quality/check-session-counters.mjs`. C'est la forme que prennent les tests de ce plan, plus des preuves d'exécution sur branche pour tout ce qui est SQL.

- **La seule preuve qui compte est le vert depuis une extraction propre de HEAD.** L'arbre de travail porte 48 fichiers d'une session parallèle arrêtée le 2026-07-29 : sa copie de `package.json` câble trois scripts non suivis (`check:session-lifecycle`, `check:font-renderable`, `check:misread-truth`), donc un `npm run quality` vert dans l'arbre de travail ne dit **rien** de l'état de l'historique. Deux tâches ont déjà payé cet écart. Recette unique, à rejouer après **chaque** commit de ce plan :

```bash
rm -rf /tmp/jdt-head && mkdir -p /tmp/jdt-head
git archive HEAD | tar -x -C /tmp/jdt-head
ln -s "$PWD/node_modules" /tmp/jdt-head/node_modules
cp .env.local /tmp/jdt-head/.env.local 2>/dev/null || true
(cd /tmp/jdt-head && node scripts/quality/check-<sujet>.mjs && npm run quality)
```

Les gardes n'utilisent que `node:fs` et `node:path`, donc ils tournent même sans le lien vers `node_modules`. Le lien ne sert qu'à `lint`, `typecheck` et `build`. Le `npm run quality` de l'extraction est celui de **HEAD**, ses 15 étapes, sans les trois scripts non suivis : c'est exactement ce qu'on veut mesurer.

- **`package.json` ne doit être touché par aucune tâche de ce plan.** Sa copie de travail appartient à la session parallèle, la stager reviendrait à committer les trois scripts non suivis ou une chaîne `quality` qui les appelle sans eux. **Conséquence assumée et consignée : les gardes créés par les tâches 3 à 7 ne sont pas câblés dans `npm run quality`.** Ils se lancent à la main, `node scripts/quality/check-<sujet>.mjs`, exactement comme `check-day-keys.mjs` et `check-session-counters.mjs` qui sont dans le même cas depuis les tâches 1 et 2. Le câblage des cinq entrées `check:*` est une tâche de rattrapage à écrire dans `docs/process/checklist.md` au moment où la session parallèle sera arbitrée, et **pas avant** : c'est le seul commit qui a le droit de toucher `package.json`.

- **`scripts/quality/check-session-lifecycle.mjs` est interdit de staging.** Le commit `457ab51` l'a délibérément dé-suivi parce qu'il décrit un refactor absent de l'historique et sort en 1 sur ses propres règles depuis une extraction de HEAD. Aucune des tâches restantes ne le lit, ne le modifie ni ne le `git add`. Chaque tâche qui a besoin d'un garde **crée le sien**, autonome, vert seul depuis l'extraction.

  Note de lecture pour les tâches 0 à 2, qui sont **faites** et dont le texte n'est pas retouché : elles disent « modifier `check-session-lifecycle.mjs` », mais ce n'est pas ainsi qu'elles ont atterri. La tâche 1 a livré `scripts/quality/check-day-keys.mjs` et la tâche 2 `scripts/quality/check-session-counters.mjs`, deux gardes autonomes et suivis, précisément après l'échec que `457ab51` a corrigé. Ce sont eux les modèles à copier, pas le texte de ces deux tâches.
- **Les preuves SQL de concurrence n'utilisent jamais `neon()` en HTTP** : chaque requête y étant sa propre transaction, deux appels en `Promise.all` ne se recouvrent pas et le test passe au vert sans avoir créé de course. Utiliser `Client` en WebSocket, laisser une transaction **ouverte**, et vérifier le blocage dans `pg_stat_activity`.
- **Pas d'emojis**, nulle part. **Pas de tiret** comme séparateur dans les textes rédigés.
- Le texte d'interface vit dans `content/copy.ts`, surveillé par `check:copy`, qui lit les clés **à plat** : une copie imbriquée itérée en boucle ne le satisfait pas.

## Faits établis par exécution le 2026-07-31

Branche `proof-h1-h5-convergence`, script `tmp/prove-h1.mjs`. Ces quatre faits fondent le plan et n'ont plus à être discutés.

- **H1** : le perdant d'un `INSERT ... ON CONFLICT (session_id) DO NOTHING` **bloque** (`wait_event_type=Lock`, `wait_event=transactionid`) jusqu'au commit du gagnant, rend zéro ligne, et sa relecture suivante voit la ligne validée **avec la graine du gagnant**.
- **H1b** : si le gagnant fait `ROLLBACK`, le perdant insère et devient gagnant. Auto-cicatrisant dans les deux sens.
- **H2** : le CTE `WITH g AS (INSERT ... ON CONFLICT DO NOTHING RETURNING 1) INSERT ... SELECT ... FROM g` est atomique. Une ligne de garde, un événement, jamais un divorce.
- **H5** : dans une fonction plpgsql VOLATILE, la requête interne qui suit un blocage sur `pg_advisory_xact_lock` prend un **snapshot frais** et voit la ligne validée pendant l'attente. Le verrou déduplique, il ne fait pas que sérialiser.

## Décision produit en attente, hors périmètre de ce plan

`buildEye` calcule la justesse de chaque palier sur **tous** les essais, avec un seuil d'allumage à 0,80 (`lib/profile/profile-stats.ts:45`, `const PALIER_ACCURACY_BAR = 0.8`, et la boucle de paliers `:129-139`). Ne pas confondre avec `:44`, `const AXIS_LIT_THRESHOLD = 0.7`, qui est un autre seuil et n'est pas le sujet. L'aligner sur le premier essai est cohérent avec le moteur, **mais déplacerait les paliers allumés, l'XP et le niveau des joueurs existants**. Cette décision appartient au propriétaire et **aucune tâche de ce plan ne la prend**. Les tâches ci-dessous ne touchent que le KPI global et la précision par session, qui sont incohérents aujourd'hui.

---

## Structure des fichiers

| Fichier | Responsabilité après ce plan |
|---|---|
| `db/migrations/012_pool_serialisation.sql` | **créé** : verrou par utilisateur dans les cinq fonctions de pool, plus `try_unlock_if_pool_stuck` |
| `lib/game/training/provider.ts` | **modifié** : convergence S3/S4, identité épinglée, incréments en base, écrivains d'événements atomiques, sweep d'inactivité, appel de la nouvelle fonction |
| `lib/profile/profile-stats.ts` | **modifié** : jour en Europe/Paris depuis SQL en texte, activité et régularité depuis les événements, précision depuis les événements, prédicat d'existence |
| `lib/profile/day-keys.ts` | **créé** : logique pure de séries de jours et d'index d'activité, seule partie auto-testable |
| `features/game/components/GameScreen.tsx` | **modifié** : contrat client, frappe avant envoi, garde de réentrance, clôture |
| `features/profile/components/ActivityBoard.tsx` | **modifié** : échelle relative, deux libellés, renommage |
| `app/api/training/session/end/route.ts` | **mis sous suivi** par la tâche 7 : la voie de fin n'a aujourd'hui aucune entrée HTTP dans l'historique |
| `features/modes/components/TrainingIntro.tsx` | **mis sous suivi** par la tâche 7 : unique consommateur des neuf clés `trainingIntroCopy` |
| `app/play/training/page.tsx` | **modifié** par la tâche 7 : rend `TrainingIntro` au lieu de rediriger vers `/game` |
| `content/copy.ts` | **modifié** par la tâche 7 : le bloc `trainingIntroCopy`, committé avec son consommateur |
| `scripts/quality/check-pool-serialisation.mjs` | **créé** par la tâche 3, autonome |
| `scripts/quality/check-session-sweep.mjs` | **créé** par la tâche 4, autonome |
| `scripts/quality/check-event-writers.mjs` | **créé** par la tâche 5, autonome |
| `scripts/quality/check-session-convergence.mjs` | **créé** par la tâche 6, autonome |
| `scripts/quality/check-client-attempt-contract.mjs` | **créé** par la tâche 7, autonome |
| `scripts/quality/check-session-counters.mjs` | **modifié** par la tâche 8 : règle 1 durcie (contournable par mutation, prouvé), plus la règle du compteur servi |
| `docs/game/architecture-backend.md` | **corrigé sur place, non stagé** par la tâche 5 : la ligne 54 prescrit une écriture dans une colonne générée |
| `scripts/quality/check-session-lifecycle.mjs` | **non suivi, et il le reste.** Aucune tâche ne le lit, ne le modifie ni ne le stage |
| `package.json` | **non touché.** Les cinq gardes ci-dessus ne sont pas câblés dans `npm run quality`, écart connu et consigné |
| `tmp/prove-*.mjs` | **créé, non suivi** : preuves d'exécution sur branche et pilotage de navigateur |

---

## Tâche 0 : prouver que l'interblocage existe, avant de le corriger

Aucune ligne de production. La discipline du chantier est de ne corriger que ce qui est mesuré.

**Fichiers**
- Créer : `tmp/prove-deadlock.mjs`

**Interfaces**
- Consomme : rien.
- Produit : la preuve, ou l'infirmation, que les deux surcharges de `init_user_pool` peuvent s'interbloquer. Si elles ne peuvent pas, la tâche 3 perd sa justification pour `init_user_pool` et se réduit aux trois autres fonctions.

- [ ] **Étape 1 : écrire la preuve qui doit échouer aujourd'hui**

Deux `Client` en WebSocket, deux transactions ouvertes, chacune appelant une surcharge différente sur le **même** utilisateur, dans l'ordre inverse l'une de l'autre. `init_user_pool(uuid)` parcourt tier N+D trié facile d'abord (`db/migrations/005_seed_pool_widen.sql:36`), `init_user_pool(uuid, text)` parcourt par quotas en ouvrant le tier C (`db/migrations/006_seed_pool_four_level.sql:88`).

```js
await A.query("BEGIN");
await B.query("BEGIN");
const a = A.query("SELECT init_user_pool($1::uuid)", [user]);
const b = B.query("SELECT init_user_pool($1::uuid, 'Designer')", [user]);
const results = await Promise.allSettled([a, b]);
const deadlock = results.some(r => r.status === "rejected" && r.reason?.code === "40P01");
```

- [ ] **Étape 2 : exécuter sur une branche jetable et consigner le résultat**

```
BRANCH_DATABASE_URL=... node tmp/prove-deadlock.mjs
```
Attendu : au moins un `40P01`, « deadlock detected ». Si aucun n'apparaît après cinq tentatives, écrire dans la checklist que l'interblocage n'est pas reproductible et **réduire la tâche 3**.

- [ ] **Étape 3 : consigner dans `docs/process/checklist.md`**, sous les hypothèses, le résultat obtenu avec la date.

---

## Tâche 1 : la progression quotidienne quitte le comptage de sessions

Elle passe **avant** la déduplication, sinon le correctif fait baisser la régularité et l'objectif du jour le jour du déploiement.

**Fichiers**
- Créer : `lib/profile/day-keys.ts`
- Modifier : `lib/profile/profile-stats.ts` (requêtes `activityRows` `:267-270`, `activeDayRows` `:271-272`, `modeRows` `:232-236`, `bestAccRow` `:250-252`, `recentRows` `:263-266`, et les dérivations `:299-342`)
- Modifier : `features/profile/components/ActivityBoard.tsx` (`heatLevel` `:21-24`, libellé `:110`, infobulle `:114`, variable `:62`)
- Modifier : `scripts/quality/check-session-lifecycle.mjs`

**Interfaces**
- Produit : `buildActivityWindow(dayKeys: string[], todayKey: string, windowDays: number): number[]`, `streakFromDayKeys(dayKeys: string[], todayKey: string): number`, `longestRunFromDayKeys(dayKeys: string[]): number`. Toutes pures, toutes sur des clés `YYYY-MM-DD` en **texte**, aucune arithmétique de date en JS.

- [ ] **Étape 1 : écrire les auto-tests qui échouent**

Dans `scripts/quality/check-session-lifecycle.mjs`, à la suite de l'auto-test du bilan, importer `lib/profile/day-keys.ts` et vérifier sur des clés synthétiques :

```js
const KEYS = ["2026-07-28", "2026-07-28", "2026-07-29", "2026-07-31"];
expect("activity window", buildActivityWindow(KEYS, "2026-07-31", 5), [0, 2, 1, 0, 1]);
expect("streak today counted", streakFromDayKeys(KEYS, "2026-07-31"), 1);
expect("streak tolerates today unplayed", streakFromDayKeys(["2026-07-29","2026-07-30"], "2026-07-31"), 2);
expect("longest run", longestRunFromDayKeys(["2026-07-01","2026-07-02","2026-07-03","2026-07-05"]), 3);
```

Le troisième cas encode la règle actuelle, un jour non encore joué ne casse pas la série (`profile-stats.ts:186-187`).

- [ ] **Étape 2 : exécuter, vérifier l'échec**

Run : `npm run check:session-lifecycle`
Attendu : ÉCHEC, « could not import lib/profile/day-keys.ts ».

- [ ] **Étape 3 : écrire `lib/profile/day-keys.ts`**

Fonctions pures, sans aucun import runtime pour que Node puisse effacer les types comme il le fait déjà pour `session-summary.ts`. Le décalage d'un jour se calcule en UTC **sur une clé déjà résolue en Europe/Paris par SQL**, ce qui est sûr : on ne convertit pas de fuseau ici, on énumère des jours calendaires consécutifs.

```ts
/** Jour calendaire précédent une clé YYYY-MM-DD. Arithmétique sur une date déjà résolue. */
const previousDayKey = (key: string): string => {
  const [y, m, d] = key.split("-").map(Number);
  const stamp = Date.UTC(y, m - 1, d) - 86_400_000;
  return new Date(stamp).toISOString().slice(0, 10);
};

/** Nombre de réponses par jour, du plus ancien au plus récent, index final = aujourd'hui. */
export const buildActivityWindow = (
  dayKeys: readonly string[],
  todayKey: string,
  windowDays: number
): number[] => {
  const counts = new Map<string, number>();
  for (const key of dayKeys) counts.set(key, (counts.get(key) ?? 0) + 1);

  const window: number[] = [];
  let cursor = todayKey;
  for (let i = 0; i < windowDays; i += 1) {
    window.unshift(counts.get(cursor) ?? 0);
    cursor = previousDayKey(cursor);
  }
  return window;
};

/** Série en cours. Un jour non encore joué ne la casse pas, règle conservée de l'existant. */
export const streakFromDayKeys = (dayKeys: readonly string[], todayKey: string): number => {
  const played = new Set(dayKeys);
  let cursor = played.has(todayKey) ? todayKey : previousDayKey(todayKey);
  let streak = 0;
  while (played.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
};

/** Plus longue série de jours consécutifs jamais atteinte. */
export const longestRunFromDayKeys = (dayKeys: readonly string[]): number => {
  const played = new Set(dayKeys);
  let best = 0;
  for (const key of played) {
    if (played.has(previousDayKey(key))) continue; // pas un début de série
    let run = 0;
    let cursor = key;
    while (played.has(cursor)) {
      run += 1;
      // avance d'un jour : deux reculs depuis le lendemain seraient faux, on repart de la clé
      const [y, m, d] = cursor.split("-").map(Number);
      cursor = new Date(Date.UTC(y, m - 1, d) + 86_400_000).toISOString().slice(0, 10);
    }
    best = Math.max(best, run);
  }
  return best;
};
```

- [ ] **Étape 4 : exécuter, vérifier le succès**

Run : `npm run check:session-lifecycle`
Attendu : SUCCÈS, l'auto-test des clés de jour est mentionné dans la ligne finale.

- [ ] **Étape 5 : basculer les requêtes SQL sur les événements et sur Paris**

Remplacer dans `profile-stats.ts` :

```sql
-- activité, en texte pour qu'aucune frontière de jour ne soit calculée en JS
SELECT to_char((event_ts_utc AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD') AS day_key
FROM user_event_fact
WHERE user_id = $1::uuid AND event_type = 'answer'
  AND event_ts_utc >= now() - interval '31 days'
```

```sql
-- le jour courant, décidé par la base et non par le runtime
SELECT to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD') AS today_key
```

```sql
-- prédicat d'existence honnête, appliqué à la requête qui alimente à elle seule
-- « Games played », la répartition par mode et « Time trained »
SELECT mode, COUNT(*)::int AS games, COALESCE(SUM(duration_ms),0)::bigint AS time_ms
FROM sessions s
WHERE s.user_id = $1::uuid AND s.status <> 'invalid'
  AND EXISTS (SELECT 1 FROM user_event_fact e
              WHERE e.session_id = s.session_id AND e.event_type = 'answer')
GROUP BY mode
```

```sql
-- précision : premiers essais uniquement, cohérent avec maybeRebalancePool
SELECT session_id::text AS session_id,
       COUNT(*)::int AS first_tries,
       COUNT(*) FILTER (WHERE is_correct)::int AS first_correct
FROM user_event_fact
WHERE user_id = $1::uuid AND event_type = 'answer' AND attempt_index = 1
GROUP BY session_id
```

`bestSessionAccuracy` devient le maximum de `first_correct / first_tries` sur ces lignes. La précision de `recentSessions` vient de la même source. `dailyGoal.done` devient le **nombre de réponses du jour**, pas un nombre de jours : compté en jours il vaudrait 0 ou 1 contre une cible de 3, donc inatteignable à vie.

**Le KPI de justesse globale change lui aussi**, et c'est la correction technique que le propriétaire a validée comme distincte du débat `buildEye`. Aujourd'hui `overallAccuracy` dérive de `answerAgg` (`profile-stats.ts:237-241`), qui compte **tous** les essais. Laissé tel quel, il serait structurellement **inférieur** à la meilleure précision de session recalculée juste au dessus, donc le tableau se contredirait. Il passe donc au premier essai :

```sql
SELECT COUNT(*)::int AS first_tries,
       COUNT(*) FILTER (WHERE is_correct)::int AS first_correct,
       COUNT(DISTINCT typeface_slug)::int AS typefaces_seen,
       COUNT(*) FILTER (WHERE is_correct AND response_time_ms < 2000)::int AS fast
FROM user_event_fact
WHERE user_id = $1::uuid AND event_type = 'answer' AND attempt_index = 1
```

Conséquence à annoncer au propriétaire : ce chiffre **monte**, il ne baisse pas, puisqu'on retire les échecs de second essai du dénominateur. **Ne pas toucher** à `perTfAnswers` (`:273-276`), qui alimente `buildEye` : c'est la décision produit en attente, hors de ce plan.

- [ ] **Étape 6 : corriger le libellé qui mentirait**

`profile-stats.ts:317` imprime `${r.correct_count} / ${r.question_count} rounds`. Comme `correct_count` est égal à `question_count` par construction, ce libellé afficherait « 7 / 7 rounds » à côté d'une précision recalculée à 58 %, dans le même panneau. Le réduire à `${r.question_count} manches résolues`, et laisser la précision seule porter le ratio.

- [ ] **Étape 7 : `ActivityBoard`, échelle et vocabulaire**

`heatLevel` devient **relatif** au maximum du tableau, ce qui absorbe le changement d'échelle et évite que le tableau du mock (`lib/profile/mock-profile.ts:215`, valeurs de 0 à 3) s'affiche presque éteint. Les **deux** littéraux passent de « sessions » à « réponses », le résumé (`:110`) comme l'infobulle (`:114`), et la variable `sessions` (`:62`) est renommée, sinon le prochain lecteur remettra la sémantique d'avant.

- [ ] **Étape 8 : porte qualité et commit**

Run : `npm run quality`
Attendu : les 18 étapes vertes.

```bash
git add lib/profile/day-keys.ts lib/profile/profile-stats.ts features/profile/components/ActivityBoard.tsx scripts/quality/check-session-lifecycle.mjs
git commit -m "feat(profile): derive the daily progression from events, on the Paris day"
```

---

## Tâche 2 : les compteurs s'incrémentent en base

**Fichiers**
- Modifier : `lib/game/training/provider.ts` (`:1117-1134`, et les lectures de `resolvedCount` `:1116`, `:1173`)
- Modifier : `scripts/quality/check-session-lifecycle.mjs`

**Interfaces**
- Produit : `submitTrainingAnswer` sert un `resolvedCount` issu d'un `RETURNING`, jamais d'une lecture JS.

- [ ] **Étape 1 : écrire la règle de garde qui échoue**

```js
// Une assignation depuis une lecture JS perd des incréments dès que deux sessions
// actives répondent en parallèle, ce que le modèle autorise désormais.
if (/SET\s+global_q_index\s*=\s*\$\{/.test(provider)) {
  failures.push("provider assigns global_q_index from a JS read; increment it in SQL");
}
if (/question_count\s*=\s*\$\{/.test(provider)) {
  failures.push("provider assigns question_count from a JS read; increment it in SQL");
}
```

- [ ] **Étape 2 : exécuter, vérifier l'échec**

Run : `npm run check:session-lifecycle`
Attendu : ÉCHEC, les deux règles se déclenchent.

- [ ] **Étape 3 : incrémenter en base**

```sql
UPDATE users SET global_q_index = global_q_index + 1, last_seen_at = now()
WHERE user_id = $1::uuid
RETURNING global_q_index
```

```sql
UPDATE sessions SET question_count = question_count + 1, correct_count = correct_count + 1
WHERE session_id = $1::uuid
RETURNING question_count
```

Servir `resolvedCount` depuis ce `RETURNING`, et utiliser le `global_q_index` retourné pour la construction de la question suivante au lieu de `user.global_q_index + 1`.

- [ ] **Étape 4 : exécuter, vérifier le succès**

Run : `npm run check:session-lifecycle && npm run typecheck`
Attendu : SUCCÈS.

- [ ] **Étape 5 : commit**

```bash
git add lib/game/training/provider.ts scripts/quality/check-session-lifecycle.mjs
git commit -m "fix(training): increment the session counters in the database"
```

---

## Ordre d'exécution des tâches restantes, et pourquoi il n'est pas négociable

Les tâches 3 à 7 s'exécutent **dans l'ordre où elles sont écrites ici**, et cet ordre a changé le 2026-08-01 : l'ancienne tâche 6, le balayage, est devenue la tâche 4, et l'ancienne tâche 4, la convergence, est devenue la tâche 6. Les tâches 3, 5 et 7 gardent leur numéro.

La raison est mesurée, pas esthétique. Le balayage actuel (`provider.ts:766-779`) passe **toutes** les sessions training actives de l'utilisateur en `abandoned`, et il le fait **avant** l'insertion. Si la convergence atterrissait la première, un simple rechargement, qui renvoie le même `attemptId` par contrat de la tâche 7, ferait exactement ceci : le balayage marque `abandoned` la session que l'on s'apprête à rejoindre, l'`INSERT ... ON CONFLICT (session_id) DO NOTHING` rend zéro ligne, la relecture S4 lit un statut différent de `active`, et la règle de ré-entrée frappe un identifiant neuf. La convergence produirait le doublon qu'elle prétend supprimer, sur un rechargement séquentiel ordinaire, sans la moindre concurrence. La preuve exigée par la tâche 6 ne pourrait pas passer.

Second couplage, du même ordre : la tâche 5 rend les écrivains d'événements atomiques. Elle doit passer **avant** la convergence, sinon deux démarrages convergés sur le même `sessionId` écrivent deux lignes `${sessionId}:session_start` identiques, `insertSessionStartEvent` étant un `INSERT` sans garde (`:465-490`) appelé inconditionnellement (`:803`) dans une table qui n'a aucune unicité sur `idempotency_key`. Aucun chiffre affiché ne bouge, `lib/profile/profile-stats.ts` ne dérive que de `event_type = 'answer'`, mais le journal append-only deviendrait faux, et c'est précisément ce que la phase 2a interdit.

Troisième couplage, ajouté le 2026-08-01 : la **tâche 8**, la voie réponse, réutilise le CTE `event_ingestion_guard` de la tâche 5. Elle passe donc après elle. Elle est en revanche indépendante des tâches 6 et 7, la course qu'elle ferme étant « deux réponses à la même question » et non « deux démarrages ». Elle est placée en dernier parce que c'est la position qui minimise les recouvrements, pas parce qu'elle en dépendrait.

D'où : **3, puis 4 (balayage), puis 5 (écrivains et clôture), puis 6 (convergence), puis 7 (contrat client), puis 8 (voie réponse)**. Les cinq tâches qui touchent `provider.ts` opèrent dans des régions disjointes (`:625`, `:727-800`, `:471-489` et `:1252-1283`, et `:849-1200`) : aucun conflit textuel, les seuls couplages sont sémantiques et ils sont tous décrits ici.

---

## Tâche 3 : migration 012, sérialisation du pool par utilisateur

> **Justification révisée par la tâche 0, le 2026-07-31.** L'interblocage entre les deux arités de `init_user_pool` s'est révélé **non reproductible** : cinq tentatives, aucun 40P01, l'observation étant une attente unidirectionnelle et jamais un cycle. En revanche la tâche 0 a **mesuré** le vrai défaut : sous recouvrement, le pool monte à **47 lignes au lieu de 30, sur 5 tentatives sur 5, variance nulle**, avec les 12 faces tier C hard incluses, parce que le perdant attend puis insère les 17 lignes de sa propre sélection absentes du pool. Aucun SQLSTATE n'est levé, `ON CONFLICT DO NOTHING` absorbe la fusion en silence. Et le garde de comptage de `ensureUserPool` est prouvé **inopérant sous concurrence**. Le périmètre de la tâche ne change pas, les cinq corps restent à remplacer, seule la raison change.

**Fichiers**
- Créer : `db/migrations/012_pool_serialisation.sql`
- Créer : `scripts/quality/check-pool-serialisation.mjs` (garde **autonome**, suivi, vert seul depuis une extraction de HEAD)
- Modifier : `lib/game/training/provider.ts` (`recoverPoolIfStuck` `:610-649`, l'appel `:625`, le `catch` `:643-645`)
- **Ne pas toucher `package.json`.** **Ne pas toucher `scripts/quality/check-session-lifecycle.mjs`.**

**Interfaces**
- Produit : `try_unlock_if_pool_stuck(uuid) RETURNS text`, appelée uniquement par `recoverPoolIfStuck`.
- Consomme : `try_unlock_one_typeface(uuid)`, dont le corps reste inchangé hors le verrou.

- [ ] **Étape 1 : écrire la règle de garde qui échoue**

Créer `scripts/quality/check-pool-serialisation.mjs`, sur la forme exacte de `scripts/quality/check-session-counters.mjs` : en-tête qui explique la règle protégée, lecture par `node:fs` depuis `process.cwd()`, accumulation dans `failures`, sortie 1 avec un message par échec, sortie 0 avec une ligne de résumé. Il ne lit que des fichiers **suivis** ou qu'il crée lui-même, donc il est vert seul depuis une extraction de HEAD dès que la tâche est finie.

```js
#!/usr/bin/env node

// Pool serialisation guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. Under overlap, two pool initialisations for the same
// user fill the pool twice: measured at 47 rows instead of 30, 5 runs out of 5,
// zero variance, because the loser waits, then inserts the 17 rows of its own
// selection that are missing. No SQLSTATE is raised, ON CONFLICT DO NOTHING
// absorbs the merge in silence, and ensureUserPool's count guard is proven
// inoperative under concurrency. Migration 012 serialises the five pool bodies
// on a per-user advisory lock, which is the only thing that closes it.
//
// THE PRECONDITION MUST NOT LIVE IN try_unlock_one_typeface. That function is
// also the I-07 growth primitive, called by register_mastery_unlock at the
// three-stabilisation threshold, a moment when the pool almost always has an
// eligible face. A precondition there would disable growth in silence and
// pending_unlock_count would climb for ever. Hence a NEW name,
// try_unlock_if_pool_stuck, and never an overload with a default parameter:
// CREATE OR REPLACE cannot change a signature, and
// try_unlock_one_typeface(uuid, boolean DEFAULT false) would make the
// one-argument call at 008_pool_growth.sql:191 ambiguous, error 42725.
//
// This script is standalone on purpose: it guards
// db/migrations/012_pool_serialisation.sql and the single call site in
// lib/game/training/provider.ts, nothing else, so it stays green on its own.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATION = "db/migrations/012_pool_serialisation.sql";
const PROVIDER = "lib/game/training/provider.ts";

const failures = [];
const readOrNull = (relative) => {
  const full = path.join(ROOT, relative);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
};

const migration = readOrNull(MIGRATION);

if (migration === null) {
  failures.push(`${MIGRATION} does not exist.`);
} else {
  // The two arities are both called (provider.ts:279 and :289) and both must be
  // replaced. The closing parenthesis in the needle is what keeps the
  // one-argument signature from matching the two-argument one.
  const BODIES = [
    "init_user_pool(p_user_id uuid)",
    "init_user_pool(p_user_id uuid, p_familiarity text)",
    "rebalance_user_pool",
    "try_unlock_one_typeface",
    "register_mastery_unlock",
  ];
  for (const fn of BODIES) {
    if (!migration.includes(fn)) {
      failures.push(`${MIGRATION}: does not replace ${fn}. All five pool bodies take the lock, or none of them serialises anything.`);
    }
  }
  if (!migration.includes("try_unlock_if_pool_stuck")) {
    failures.push(`${MIGRATION}: does not create try_unlock_if_pool_stuck.`);
  }
  if (!migration.includes("pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0))")) {
    failures.push(`${MIGRATION}: no per-user advisory lock. The lock key must be derived from p_user_id, identically in every body, or two bodies serialise on different keys and nothing is serialised at all.`);
  }
  if (migration.includes("boolean DEFAULT")) {
    failures.push(`${MIGRATION}: introduces a default-parameter overload. The one-argument call at 008_pool_growth.sql:191 would become ambiguous, error 42725. Use a new function name.`);
  }
}

const provider = readOrNull(PROVIDER);

if (provider === null) {
  failures.push(`${PROVIDER} does not exist.`);
} else {
  const start = provider.indexOf("const recoverPoolIfStuck");
  if (start === -1) {
    failures.push(`${PROVIDER}: no longer defines recoverPoolIfStuck.`);
  } else {
    const next = provider.indexOf("\nconst ", start + 24);
    const body = provider.slice(start, next === -1 ? provider.length : next);

    if (!body.includes("try_unlock_if_pool_stuck")) {
      failures.push(`${PROVIDER}: recoverPoolIfStuck still calls the growth primitive directly. The §4.5 stuck-pool path must go through try_unlock_if_pool_stuck.`);
    }
    // The fallback is not optional. Migration 012 is deliberately NOT applied in
    // production, so between this commit and the migration the new function does
    // not exist and the call raises 42883. Without a retry on the old function,
    // the §4.5 path would fall straight to the cursor jump and the silent unlock
    // of a new face would disappear from production, a regression on behaviour
    // that works today.
    if (!body.includes("42883")) {
      failures.push(`${PROVIDER}: recoverPoolIfStuck does not name 42883 in its fallback. Until 012 is applied, try_unlock_if_pool_stuck does not exist and the catch must retry try_unlock_one_typeface before falling to the cursor jump.`);
    }
    const catchAt = body.indexOf("} catch");
    if (catchAt === -1 || !body.slice(catchAt).includes("try_unlock_one_typeface")) {
      failures.push(`${PROVIDER}: the catch of recoverPoolIfStuck does not retry try_unlock_one_typeface. A pre-migration deployment would silently lose the unlock path.`);
    }
    if (body.includes("migration 008 not applied")) {
      failures.push(`${PROVIDER}: the warning still names try_unlock_one_typeface and migration 008. The failing call is try_unlock_if_pool_stuck and the missing migration is 012.`);
    }
  }
}

if (failures.length > 0) {
  console.error("check:pool-serialisation FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  "check:pool-serialisation OK : 012 replaces the five pool bodies with a per-user advisory lock, " +
    "creates try_unlock_if_pool_stuck under a new name, and recoverPoolIfStuck calls it with a 42883 " +
    "fallback onto try_unlock_one_typeface."
);
```

- [ ] **Étape 2 : exécuter, vérifier l'échec**

Run : `node scripts/quality/check-pool-serialisation.mjs`
Attendu : ÉCHEC, `db/migrations/012_pool_serialisation.sql does not exist`, plus les trois règles de `recoverPoolIfStuck`, qui appelle encore `try_unlock_one_typeface` et porte encore l'avertissement « migration 008 not applied ».

- [ ] **Étape 3 : écrire la migration**

Cinq corps remplacés, pas quatre : `init_user_pool` existe en **deux arités** (`005:21` et `006:53`), les deux sont appelées (`provider.ts:279` et `:289`), et l'interblocage est précisément entre elles. Chaque corps reçoit, en **première** instruction :

```sql
PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
```

Puis la fonction neuve, avec un **nom neuf** et surtout pas une surcharge à paramètre par défaut : `CREATE OR REPLACE` ne peut pas changer une signature, et `try_unlock_one_typeface(uuid, boolean DEFAULT false)` rendrait l'appel à un argument de `008:191` ambigu, erreur 42725.

```sql
CREATE OR REPLACE FUNCTION try_unlock_if_pool_stuck(p_user_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Réévaluation sous verrou. H5 garantit que cette lecture voit ce qu'un appel
  -- concurrent vient de valider, donc le second appelant sort ici.
  IF EXISTS (
    SELECT 1 FROM user_typeface_state uts
    JOIN users u ON u.user_id = uts.user_id
    WHERE uts.user_id = p_user_id
      AND uts.in_active_pool = true
      AND uts.next_due_after_q <= u.global_q_index
  ) THEN
    RETURN NULL;
  END IF;

  RETURN try_unlock_one_typeface(p_user_id);
END $$;
```

En tête du fichier : `BEGIN;` et `COMMIT;`, avec la note que le driver HTTP étant en autocommit, ce fichier doit être appliqué par psql pour être atomique.

- [ ] **Étape 4 : brancher l'appelant, avec un repli qui ne dégrade pas la production**

Dans `recoverPoolIfStuck`, remplacer l'appel `:625` par `try_unlock_if_pool_stuck`. **Le `try/catch` existant ne suffit pas et le plan avait tort de le qualifier de dégradation propre.** L'étape 6 dit explicitement que 012 n'est **pas** appliquée en production : entre ce commit et la migration, l'appel lève 42883, le `catch` l'avale, et la voie §4.5 tombe **systématiquement** sur le saut de curseur. Le déblocage silencieux d'une face neuve, qui fonctionne aujourd'hui, disparaîtrait de la production. Le `catch` doit donc retenter l'ancienne fonction avant de renoncer :

```ts
  // Step 1 — controlled injection of a new typeface (spec §4.5), serialised per
  // user by migration 012. 012 is deliberately NOT applied in production yet, so
  // this call can raise 42883 "function does not exist" for as long as it is not.
  // In that window the OLD primitive is still the correct behaviour: falling
  // straight to the cursor jump would remove an unlock that works today.
  const tryUnlock = async (): Promise<string | null> => {
    try {
      const rows = await queryRows<{ slug: string | null }>(
        sql`SELECT try_unlock_if_pool_stuck(${userId}::uuid) AS slug`
      );
      return rows[0]?.slug ?? null;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "42883") throw error;
      console.warn(
        "try_unlock_if_pool_stuck missing (migration 012 not applied); retrying try_unlock_one_typeface.",
        error
      );
      const rows = await queryRows<{ slug: string | null }>(
        sql`SELECT try_unlock_one_typeface(${userId}::uuid) AS slug`
      );
      return rows[0]?.slug ?? null;
    }
  };
```

Le reste du corps est inchangé : `const unlocked = await tryUnlock();` remplace la lecture de `rows[0]?.slug`, et le `catch` extérieur qui subsiste avale ce qui n'est pas un 42883 en journalisant. **Supprimer** l'ancien texte d'avertissement `:644`, qui nomme la mauvaise fonction et la mauvaise migration ; c'est aussi ce que la règle `migration 008 not applied` du garde interdit désormais.

- [ ] **Étape 5 : prouver sur branche**

Créer `tmp/prove-pool.mjs` : deux `try_unlock_if_pool_stuck` concurrents sur un pool gelé donnent **exactement une** ligne neuve ; deux `register_mastery_unlock` au seuil donnent **un** déblocage et un `pending_unlock_count` cohérent ; deux `init_user_pool` concurrents, une arité chacun, laissent le pool à **30** lignes et non 47, ce qui est la mesure que la tâche 0 a effectivement produite, l'interblocage 40P01 s'étant révélé non reproductible.

- [ ] **Étape 6 : porte qualité et commit** (la migration n'est **pas** appliquée en production)

Run : `node scripts/quality/check-pool-serialisation.mjs && npm run typecheck`

```bash
git add db/migrations/012_pool_serialisation.sql \
        lib/game/training/provider.ts \
        scripts/quality/check-pool-serialisation.mjs
git commit -m "feat(pool): serialise the per-user unlock and split the stuck-pool path"
```

Rien d'autre. Pas de `git add -a`, pas de `git add .`, pas de `package.json`, pas de `check-session-lifecycle.mjs`. L'arbre porte 48 fichiers sales et `backups/backfill-2026-07-29-training-sessions-before.json` **n'est pas gitignoré** (`.gitignore` ne couvre que `/backups/checkpoints/`), donc un staging large l'emporterait.

- [ ] **Étape 7 : prouver le commit depuis une extraction propre de HEAD**

Rejouer la recette des contraintes globales, avec `check-pool-serialisation.mjs` comme garde.
Attendu : le garde vert, et `npm run quality` vert sur ses 15 étapes de HEAD.

---

## Tâche 4 : le sweep devient un balayage d'inactivité, et il passe après l'insertion

> **Correction apportée au plan après la revue de la tâche 4, le 2026-08-01.** Le texte de garde que cette tâche prescrivait à l'origine testait la **présence** de quatre chaînes dans une clause `WHERE`, et aucun **sens**. Un relecteur l'a défait neuf fois, dont trois de façon parfaitement plausible : commenter les trois prédicats en `--`, ce qui restaure le défaut d'origine en pire et fait imprimer au garde une phrase fausse ; ajouter un second balayage destructeur avant l'insertion sans l'alias `AS s`, invisible à une règle qui n'inspecte que la première occurrence ; et inverser `) < now()` en `) > now()`, ce qui retourne la fenêtre d'inactivité contre son intention. Un garde doit donc **retirer les commentaires SQL avant de chercher**, exiger l'identifiant inséré **littéralement**, exiger l'**opérateur** et pas seulement l'intervalle, et compter les occurrences plutôt que constater une présence.
>
> **Second correctif : le balayage doit être protégé.** Le plan prescrivait sa position sans prescrire sa protection. Placé après le commit de la ligne `sessions`, il devient une instruction dont l'échec empêche l'écriture de l'événement de démarrage : le joueur prend un 500, le journal a un trou, et il reste une session active orpheline, exactement ce que ce plan combat. L'ancien ordre échouait proprement, sans ligne. Toute instruction de bookkeeping placée après un commit sur ce chemin doit être enveloppée dans un `try/catch` avec avertissement, sur le motif `safeTrainingProgress` déjà présent dans le fichier.

> **Cette tâche était la tâche 6. Elle est remontée le 2026-08-01 et elle est bloquante pour la tâche 6, la convergence.** Voir « Ordre d'exécution des tâches restantes » ci-dessus : le balayage actuel abandonne **toutes** les sessions actives de l'utilisateur avant l'insertion, donc il détruirait la session que la convergence s'apprête à rejoindre, sur un simple rechargement.

**Fichiers**
- Modifier : `lib/game/training/provider.ts` (le balayage `:765-779`, son commentaire de justification `:745-763`, et sa **position** relativement à l'`INSERT INTO sessions` `:781-800`)
- Créer : `scripts/quality/check-session-sweep.mjs` (garde **autonome**, suivi)
- **Ne pas toucher `package.json`.** **Ne pas toucher `scripts/quality/check-session-lifecycle.mjs`.**

**Interfaces**
- Consomme : rien des tâches précédentes. La tâche 3 touche `recoverPoolIfStuck` (`:610-649`), région disjointe.
- Produit : un `startTrainingSession` dont le balayage ne peut plus fermer ni la session courante, ni une session jeune, ni une session vivante. **C'est la précondition de la tâche 6** : sans elle, la relecture S4 lirait un statut `abandoned` posé une milliseconde plus tôt par le balayage du même appel.

- [ ] **Étape 1 : règle de garde qui échoue**

Créer `scripts/quality/check-session-sweep.mjs`. Le découpage du segment est **borné à l'instruction**, et ce point n'est pas cosmétique : découper jusqu'à la fin du fichier ferait passer le motif `session_id <> ` pour satisfait par la voie réponse, qui en contient déjà un à `:1311`, et le garde serait vert avant toute correction.

```js
#!/usr/bin/env node

// Session sweep guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. A training session no longer closes itself on a round
// counter, so one left open stays open for ever: 73 were measured in that state
// on 2026-07-29, every one 'active'. The sweep that closes them is necessary,
// but as written it runs BEFORE the insert and matches every active training
// session of the user with no other predicate, which makes it a demolition
// charge: once one attempt equals one identifier (task 6), a plain page reload
// sends the same identifier back, the sweep marks that very session 'abandoned',
// the ON CONFLICT insert returns zero rows, the re-read sees a status that is
// not 'active', and the server mints a second session. The convergence would
// produce the duplicate it exists to remove, sequentially, with no concurrency
// at all.
//
// Three cumulative predicates, and the sweep AFTER the insert so the current
// session id exists to be excluded. Without all three, two concurrent starts
// abandon each other and leave ZERO active sessions, which is worse than the
// original defect.
//
// This script is standalone on purpose: it guards the sweep inside
// startTrainingSession and nothing else.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PROVIDER = "lib/game/training/provider.ts";
const failures = [];

const provider = fs.readFileSync(path.join(ROOT, PROVIDER), "utf8");

const startAt = provider.indexOf("export const startTrainingSession");
if (startAt === -1) {
  failures.push(`${PROVIDER}: no longer exports startTrainingSession.`);
} else {
  const nextExport = provider.indexOf("\nexport const ", startAt + 33);
  const fn = provider.slice(startAt, nextExport === -1 ? provider.length : nextExport);

  const sweepAt = fn.indexOf("UPDATE sessions AS s");
  const insertAt = fn.indexOf("INSERT INTO sessions");

  if (sweepAt === -1) {
    failures.push(`${PROVIDER}: startTrainingSession no longer contains the sweep (UPDATE sessions AS s).`);
  } else if (insertAt === -1) {
    failures.push(`${PROVIDER}: startTrainingSession no longer contains INSERT INTO sessions.`);
  } else {
    // 1. Position. The sweep must run after the insert, because the only sound
    //    way not to close the current session is to name it, and its id does not
    //    exist before the insert resolves.
    if (sweepAt < insertAt) {
      failures.push(
        `${PROVIDER}: the sweep runs BEFORE INSERT INTO sessions. It cannot exclude the current ` +
          "session because that session does not exist yet, so it abandons the very row the next " +
          "step is about to converge on."
      );
    }

    // 2. Content, bounded to the statement. Slicing to end of file would let
    //    `session_id <> ` be satisfied by the answer path at :1311 and the guard
    //    would be green before any fix.
    const end = provider.indexOf("`;", startAt + sweepAt);
    const sweep = provider.slice(startAt + sweepAt, end === -1 ? startAt + sweepAt : end);

    // Narrowed further, to the WHERE clause. The SET clause already computes
    // MAX(uef.event_ts_utc) to date ended_at, and has done so all along, so a
    // rule looking for it anywhere in the statement would be green before the
    // fix and could never fail. The inactivity predicate is a SECOND read of
    // that same maximum, in the WHERE.
    const whereAt = sweep.indexOf("WHERE s.user_id");
    const where = whereAt === -1 ? "" : sweep.slice(whereAt);

    const NEEDLES = [
      ["session_id <> ", "it can close the session that was just created or joined"],
      ["started_at < now() - interval", "it can close a session that is only seconds old"],
      ["30 minutes", "it has no age floor and no inactivity window"],
      ["MAX(uef.event_ts_utc)", "its WHERE clause never looks at the last answer, so it closes a session that is still being played in another tab"],
    ];
    for (const [needle, why] of NEEDLES) {
      if (!where.includes(needle)) {
        failures.push(`${PROVIDER}: the sweep's WHERE clause lacks ${needle}: ${why}.`);
      }
    }
  }

  // 3. The old justification is now false and must not survive as a comment: it
  //    claims safety comes from ordering, when it now comes from an explicit
  //    exclusion.
  if (fn.includes("before the new row exists so the new one is never caught by its own sweep")) {
    failures.push(
      `${PROVIDER}: the sweep still carries its old justification. Safety no longer comes from ` +
        "running before the insert, it comes from naming the current session in an exclusion."
    );
  }
}

if (failures.length > 0) {
  console.error("check:session-sweep FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  "check:session-sweep OK : the sweep runs after the insert, excludes the current session by id, " +
    "and closes only sessions older than 30 minutes with no event in the last 30 minutes."
);
```

- [ ] **Étape 2 : exécuter, vérifier l'échec**

Run : `node scripts/quality/check-session-sweep.mjs`
Attendu : ÉCHEC, six règles au moins. Le balayage est avant l'insertion, il n'a aucun des quatre motifs, et il porte encore son ancienne justification.

- [ ] **Étape 3 : implémenter les trois prédicats cumulés, et déplacer le balayage**

Le balayage descend **après** `const session = insertedSessions[0];`, et avant `insertSessionStartEvent`. Il reçoit trois prédicats cumulés : jamais la session courante, jamais une session de moins de 30 minutes, jamais une session avec de l'activité dans les 30 dernières minutes.

```ts
  // Spec §2.1 step 5 — abandon. A session that no longer closes itself on a round
  // counter stays open for ever if nothing sweeps it: 73 were measured in that
  // state on 2026-07-29, every one 'active', not one 'completed'.
  //
  // THE SWEEP RUNS AFTER THE INSERT, and the current session is excluded BY ID.
  // It used to run before, on the argument that a row that does not exist cannot
  // be caught by its own sweep. That argument dies the moment one attempt equals
  // one identifier: a reload sends the same id back, and a sweep with no
  // exclusion would abandon the session we are about to join.
  //
  // Two more predicates, because excluding the current session is not enough.
  // Without an age floor, two starts a few milliseconds apart abandon each
  // other and leave ZERO active sessions. Without an inactivity window, a
  // player answering in another tab is closed under them.
  //
  // NO PEDAGOGICAL CONSEQUENCE, and that is the point: mastery, intervals and the
  // pool are written answer by answer, so the work done inside an abandoned
  // session is already acquired and nothing here revisits it.
  //
  // ended_at is taken from the LAST RECORDED EVENT of that session, not from now:
  // the player left when they stopped answering, not when we noticed. With no
  // event at all it falls back to started_at, giving a zero duration. No
  // session_end event is written either, because no end ever happened, and phase
  // 2a is precisely about the fact table never claiming something that did not
  // occur.
  await sql`
    UPDATE sessions AS s
    SET status = 'abandoned'::app.session_status_enum,
        ended_at = COALESCE(
          (
            SELECT MAX(uef.event_ts_utc)
            FROM user_event_fact uef
            WHERE uef.session_id = s.session_id
          ),
          s.started_at
        )
    WHERE s.user_id = ${user.user_id}::uuid
      AND s.mode = 'training'
      AND s.status = 'active'
      AND s.session_id <> ${session.session_id}::uuid
      AND s.started_at < now() - interval '30 minutes'
      AND COALESCE(
            (
              SELECT MAX(uef.event_ts_utc)
              FROM user_event_fact uef
              WHERE uef.session_id = s.session_id
            ),
            s.started_at
          ) < now() - interval '30 minutes'
  `;
```

Le prédicat d'inactivité est écrit en `COALESCE(MAX(...))` et **pas** en `NOT EXISTS` : c'est la même forme que le `ended_at` juste au dessus, donc une seule idée à relire, et cela évite d'introduire un `WHERE NOT EXISTS` dans `provider.ts` au moment précis où la tâche 5 travaille à en supprimer un.

- [ ] **Étape 4 : prouver sur branche**

`tmp/prove-sweep.mjs`, sur une branche Neon jetable : une session créée il y a deux minutes **survit** à un démarrage ; une session ouverte il y a deux heures et sans aucun événement est bien passée `abandoned` avec `ended_at = started_at` ; une session ouverte il y a deux heures mais avec une réponse il y a cinq minutes **survit** ; deux `startTrainingSession` entrelacés ne laissent **jamais** zéro session active.

- [ ] **Étape 5 : porte qualité et commit**

Run : `node scripts/quality/check-session-sweep.mjs && npm run typecheck`

```bash
git add lib/game/training/provider.ts \
        scripts/quality/check-session-sweep.mjs
git commit -m "fix(training): close stale sessions by inactivity, never at start time"
```

Rien d'autre. Ni `package.json`, ni `check-session-lifecycle.mjs`, ni un staging large qui emporterait `backups/backfill-2026-07-29-training-sessions-before.json`, non gitignoré.

- [ ] **Étape 6 : prouver le commit depuis une extraction propre de HEAD**

Recette des contraintes globales, avec `check-session-sweep.mjs`. Attendu : garde vert, `npm run quality` vert.

---

## Tâche 5 : les écrivains d'événements deviennent atomiques

> **Bloquante pour la tâche 6.** Après la convergence, deux démarrages sur le même `sessionId` appellent deux fois `insertSessionStartEvent`, qui est un `INSERT` **sans aucune garde** (`:465-490`) appelé inconditionnellement (`:803`), dans une table qui n'a pas d'index unique sur `idempotency_key`. Deux lignes `${sessionId}:session_start` identiques atterriraient. C'est cette tâche qui ferme le trou, donc elle passe avant.

**Fichiers**
- Modifier : `lib/game/training/provider.ts` (`insertSessionStartEvent` `:465-490`, l'écriture de `session_end` **`:1252-1276`** avec son commentaire de justification `:1243-1251`, et l'`UPDATE` de statut `:1277-1283`)
- Créer : `scripts/quality/check-event-writers.mjs` (garde **autonome**, suivi)
- Corriger sur place, **sans le stager** : `docs/game/architecture-backend.md:54`
- **Ne pas toucher `package.json`.** **Ne pas toucher `scripts/quality/check-session-lifecycle.mjs`.**

**Interfaces**
- Consomme : rien de la tâche 4, région disjointe. Les deux tâches touchent `provider.ts` mais l'une le balayage (`:727-800`), l'autre la fin de session (`:471-489` et `:1252-1283`).
- Produit : deux écrivains dont la ligne de garde et l'événement naissent ou meurent ensemble, prouvé par H2, et une clôture de session qui ne peut plus écraser le verdict d'un balayage concurrent. **Produit aussi le mécanisme que la tâche 8 réutilise** pour la voie réponse.

- [ ] **Étape 1 : règle de garde qui échoue**

Créer `scripts/quality/check-event-writers.mjs`. Les règles sont **bornées au corps de chaque écrivain**, pas testées sur le fichier entier : un `WHERE NOT EXISTS` légitime ailleurs dans `provider.ts` rendrait un garde global rouge pour toujours.

```js
#!/usr/bin/env node

// Event writer atomicity guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. The engine runs on autocommit statements through the
// HTTP driver, so a guard row and its event written as two statements can end
// up divorced: the guard says the event was ingested and the event is not
// there, or the reverse. H2, proven by execution on 2026-07-31, says the CTE
// form (WITH g AS (INSERT INTO event_ingestion_guard ... ON CONFLICT DO NOTHING
// RETURNING 1) INSERT INTO user_event_fact ... SELECT ... FROM g) is atomic:
// one guard row, one event, never a divorce, in a single statement.
//
// WHY NOT ON CONFLICT ON user_event_fact ITSELF. That table is PARTITIONED BY
// RANGE (event_ts_utc), and Postgres requires a unique index on a partitioned
// table to carry the partition key: the only one is uq_event_id (event_id,
// event_ts_utc). There is no unique constraint on idempotency_key alone, so
// `ON CONFLICT (idempotency_key)` raises 42P10. Verified on a throwaway Neon
// branch on 2026-07-29. The uniqueness therefore has to live in
// event_ingestion_guard, whose primary key IS (user_id, session_id,
// idempotency_key), db/migrations/001_user_event_fact.sql:13-23.
//
// This script is standalone on purpose: it guards the two training event
// writers and nothing else.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PROVIDER = "lib/game/training/provider.ts";
const failures = [];

const provider = fs.readFileSync(path.join(ROOT, PROVIDER), "utf8");

// Bounded slices. A rule tested against the whole file would be red for ever
// the day an unrelated statement legitimately needs NOT EXISTS.
const sliceBody = (anchor, boundary) => {
  const start = provider.indexOf(anchor);
  if (start === -1) return null;
  const end = provider.indexOf(boundary, start + anchor.length);
  return provider.slice(start, end === -1 ? provider.length : end);
};

const WRITERS = [
  ["insertSessionStartEvent", sliceBody("const insertSessionStartEvent", "\nconst ")],
  ["endTrainingSession", sliceBody("export const endTrainingSession", "\nexport const ")],
];

for (const [name, body] of WRITERS) {
  if (body === null) {
    failures.push(`${PROVIDER}: cannot locate ${name}.`);
    continue;
  }
  if (!body.includes("event_ingestion_guard")) {
    failures.push(
      `${PROVIDER}: ${name} does not write through event_ingestion_guard. Its event and its ` +
        "idempotency guard are two separate autocommit statements, so one can land without the other."
    );
  }
  if (!body.includes("ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING")) {
    failures.push(
      `${PROVIDER}: ${name} does not deduplicate on the guard's primary key ` +
        "(user_id, session_id, idempotency_key). Any other conflict target raises 42P10 or " +
        "deduplicates on the wrong thing."
    );
  }
  if (/WHERE NOT EXISTS/.test(body)) {
    failures.push(
      `${PROVIDER}: ${name} still uses the non-atomic WHERE NOT EXISTS. Two concurrent calls both ` +
        "see no row, both insert, and the journal gets a duplicate."
    );
  }
}

// The end writer must keep reading global_q_index from the users table. It does
// not have that value in scope, unlike the start writer which receives it as an
// argument, so a template that passes it as a parameter cannot be applied here.
const endBody = WRITERS[1][1];
if (endBody !== null && !endBody.includes("SELECT global_q_index FROM users")) {
  failures.push(
    `${PROVIDER}: the session_end writer no longer reads global_q_index from the users table. ` +
      "endTrainingSession has no such value in scope; the subquery is not optional here."
  );
}

// The old justification explains why ON CONFLICT was impossible ON user_event_fact.
// Left in place next to a CTE that does use ON CONFLICT, on the guard table, it
// reads as a contradiction to the next person.
if (endBody !== null && endBody.includes("NOT EXISTS rather than ON CONFLICT")) {
  failures.push(
    `${PROVIDER}: the session_end writer still carries the "NOT EXISTS rather than ON CONFLICT" ` +
      "comment. Rewrite it: the 42P10 measurement stays true about user_event_fact, but the " +
      "conflict target now legitimately exists on event_ingestion_guard."
  );
}

// The status write must be a compare and set. Between the SELECT that read the
// row and this UPDATE, another tab's sweep can have moved the session to
// 'abandoned' with an honest ended_at taken from its last event. An
// unconditional UPDATE then flips it back to 'completed' and overwrites that
// honest timestamp with the server's own clock, which is the fact table
// claiming something that did not happen. Task 4's sweep exclusion narrows this
// window, it does not close it: a second tab is a second session, and the sweep
// only ever excludes the session of the call it runs in.
if (endBody !== null) {
  const updAt = endBody.indexOf("UPDATE sessions");
  if (updAt === -1) {
    failures.push(`${PROVIDER}: endTrainingSession no longer updates the sessions row.`);
  } else {
    const updEnd = endBody.indexOf("`;", updAt);
    const upd = endBody.slice(updAt, updEnd === -1 ? endBody.length : updEnd);
    if (!upd.includes("AND status = 'active'")) {
      failures.push(
        `${PROVIDER}: the session close is not a compare and set. Add AND status = 'active' to ` +
          "its WHERE clause, or a concurrent sweep's honest 'abandoned' is silently overwritten " +
          "with 'completed' and a wrong ended_at."
      );
    }
  }
}

if (failures.length > 0) {
  console.error("check:event-writers FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  "check:event-writers OK : session_start and session_end both write through the " +
    "event_ingestion_guard CTE, deduplicated on its primary key, with no NOT EXISTS left."
);
```

- [ ] **Étape 2 : exécuter, vérifier l'échec**

Run : `node scripts/quality/check-event-writers.mjs`
Attendu : ÉCHEC. `insertSessionStartEvent` n'a aucune garde du tout, et `endTrainingSession` a bien son `WHERE NOT EXISTS` (`:1270`) et son commentaire.

- [ ] **Étape 3 : implémenter le CTE, prouvé par H2**

Gabarit commun. Les colonnes sont **exactement** celles que le code écrit aujourd'hui : un `session_start` ne porte ni `answer_slug` ni `reason_code`, que la migration 001b a rendus nullables. En inventer d'autres déclenche `chk_answer_slug`.

```sql
WITH g AS (
  INSERT INTO event_ingestion_guard (idempotency_key, user_id, session_id, ingestion_status)
  VALUES ($1, $2::uuid, $3::uuid, 'accepted')
  ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING
  RETURNING 1
)
INSERT INTO user_event_fact (idempotency_key, user_id, session_id, mode, global_q_index, event_type, engine_version)
SELECT $1, $2::uuid, $3::uuid, 'training', $4, $5::app.event_type_enum, $6
FROM g
```

**Le `$4` du gabarit ne s'applique qu'à l'écrivain de départ.** `insertSessionStartEvent` reçoit `globalQIndex` en argument, donc il l'interpole. `endTrainingSession` **n'a pas cette valeur en portée** : il lit `(SELECT global_q_index FROM users WHERE user_id = ${userId}::uuid)` à `:1267`, et cette sous-requête **reste**. Le CTE de fin s'écrit donc ainsi :

```ts
    await sql`
      WITH g AS (
        INSERT INTO event_ingestion_guard (idempotency_key, user_id, session_id, ingestion_status)
        VALUES (${`${sessionId}:session_end`}, ${userId}::uuid, ${sessionId}::uuid, 'accepted')
        ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING
        RETURNING 1
      )
      INSERT INTO user_event_fact (
        idempotency_key, user_id, session_id, mode, global_q_index, event_type, engine_version
      )
      SELECT
        ${`${sessionId}:session_end`},
        ${userId}::uuid,
        ${sessionId}::uuid,
        'training',
        (SELECT global_q_index FROM users WHERE user_id = ${userId}::uuid),
        'session_end',
        ${TRAINING_ENGINE_VERSION}
      FROM g
    `;
```

**Remplacer le commentaire `:1243-1251`, ne pas le laisser en place.** Ce qu'il mesure reste vrai et doit être conservé : `user_event_fact` est partitionnée par `event_ts_utc`, le seul index unique est `uq_event_id`, donc `ON CONFLICT (idempotency_key)` sur cette table lève 42P10, vérifié sur branche le 2026-07-29. Ce qui devient faux, c'est la conclusion « donc pas d'`ON CONFLICT` » : la cible de conflit existe, elle est simplement sur `event_ingestion_guard`, dont la clé primaire est `(user_id, session_id, idempotency_key)` (`db/migrations/001_user_event_fact.sql:13-23`). Le nouveau commentaire dit les deux.

Conserver aussi l'ordre événement puis statut, et sa justification : statut d'abord rendrait `wasActive` faux au retry et le journal perdrait la fin de session pour toujours.

Écrire enfin la règle de rétention : `event_ingestion_guard` ne doit **jamais** recevoir les événements `answer` sans partitionnement ni TTL, et tout TTL doit être plus long que la plus longue fenêtre de rejeu client, puisque supprimer la ligne de garde rend l'événement réinscriptible. La tâche 8 fera précisément entrer les `answer` dans cette table : la règle de rétention doit donc être écrite ici en la nommant.

- [ ] **Étape 4 : la clôture devient un « compare and set »**

Trois mots, et ils manquent. L'`UPDATE` de statut (`:1277-1283`) est aujourd'hui inconditionnel :

```sql
      UPDATE sessions
      SET status = 'completed'::app.session_status_enum,
          ended_at = ${endedAt}
      WHERE session_id = ${sessionId}::uuid
```

Entre le `SELECT` qui a lu la ligne (`:1210-1221`) et cet `UPDATE`, le balayage d'un **autre onglet** a pu passer la session en `abandoned` avec un `ended_at` honnête, pris sur son dernier événement. Cet `UPDATE` la repasse alors en `completed` et écrase cet horodatage par l'horloge du serveur. C'est exactement ce que la phase 2a interdit : la table de faits affirme quelque chose qui n'a pas eu lieu.

```sql
      UPDATE sessions
      SET status = 'completed'::app.session_status_enum,
          ended_at = ${endedAt}
      WHERE session_id = ${sessionId}::uuid
        AND status = 'active'
```

**Interaction avec la tâche 4, à écrire dans le commentaire :** le balayage corrigé exclut désormais la session courante, ce qui **rétrécit** la fenêtre sans la fermer. L'exclusion ne vaut que pour la session de l'appel qui balaie ; un second onglet est une seconde session, et son balayage, lui, ne connaît pas celle-ci. Seul le `compare and set` ferme la course.

Conséquence à gérer côté retour : `wasActive` (`:1228`) est calculé depuis la lecture, pas depuis l'écriture. Il devient le nombre de lignes affectées par l'`UPDATE`, donc `closedByThisCall` dit enfin la vérité. La ligne de garde de l'événement `session_end`, elle, reste écrite dans tous les cas où la session était vue active : c'est l'ordre événement puis statut, déjà justifié.

- [ ] **Étape 5 : corriger le document qui prescrit une écriture impossible**

`docs/game/architecture-backend.md:54` dit aujourd'hui : « La session passe en `completed`, `ended_at` et `duration_ms` sont écrits. » C'est faux et cette erreur a déjà provoqué une panne à l'exécution. `duration_ms` est une colonne **calculée** :

```sql
  duration_ms           int
                            GENERATED ALWAYS AS (
                              CASE
                                WHEN ended_at IS NOT NULL
                                THEN (EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000)::int
                                ELSE NULL
                              END
                            ) STORED,
```

`db/migrations/003_users_sessions_pool.sql:115-122`. Postgres refuse toute écriture directe dessus, erreur 428C9. Remplacer la ligne par : « La session passe en `completed` et `ended_at` est écrit. `duration_ms` **n'est pas écrit** : c'est une colonne `GENERATED ALWAYS AS ... STORED` que la base calcule seule depuis `ended_at` et `started_at` (`db/migrations/003_users_sessions_pool.sql:115-122`). Toute écriture directe est rejetée par Postgres, erreur 428C9. »

**Corriger la ligne, mais ne pas stager le fichier.** `docs/game/architecture-backend.md` est **non suivi** : mesuré, `git ls-files` ne le connaît pas, et aucun document suivi ne porte cette erreur. La prescription fausse n'est donc pas dans l'historique, elle est dans l'arbre de travail, c'est à dire exactement là où elle a fait sa panne. La corriger sur place règle le problème réel. La stager reviendrait à adopter dans l'historique un document entier de la session parallèle du 2026-07-29, non relu, comme effet de bord d'une correction de trois mots : c'est la même faute que celle qui a fait dé-suivre `check-session-lifecycle.mjs`. Consigner le fichier dans `docs/process/checklist.md` parmi les éléments de la session parallèle à arbitrer.

Aucune règle de garde sur ce point, et c'est délibéré, pour deux raisons. Le fichier n'est pas dans HEAD, donc un garde sur son contenu serait rouge depuis une extraction propre, pour l'éternité. Et une règle textuelle sur un document ne pourrait devenir rouge que si quelqu'un écrivait dans une colonne générée, ce que Postgres rejette déjà seul à l'exécution. Ce serait précisément le genre de règle qui n'assure rien.

- [ ] **Étape 6 : porte qualité et commit**

Run : `node scripts/quality/check-event-writers.mjs && npm run typecheck`

```bash
git add lib/game/training/provider.ts \
        scripts/quality/check-event-writers.mjs
git commit -m "fix(training): atomic event writers and a compare-and-set session close"
```

Rien d'autre, mêmes interdits que les tâches précédentes, et **pas** `docs/game/architecture-backend.md`, corrigé sur place mais laissé non suivi.

- [ ] **Étape 7 : prouver le commit depuis une extraction propre de HEAD**

Recette des contraintes globales, avec `check-event-writers.mjs`. Attendu : garde vert, `npm run quality` vert.

---

## Tâche 6 : convergence de session par la clé primaire

> **Arête vive, signalée par la revue de la tâche 4 et à ne pas découvrir en revue.** La relecture S4 doit se placer **exactement** là où le code prend la ligne insérée, `const session = insertedSessions[0]`, donc **avant le balayage**. Le perdant de `ON CONFLICT (session_id) DO NOTHING` rend zéro ligne, donc si la relecture passe après le balayage, la lecture de `session.session_id` par la clause d'exclusion lève un `TypeError`. La position choisie par la tâche 4 **rend** la convergence possible, elle ne la garantit pas.

> **Cette tâche était la tâche 4. Elle est descendue le 2026-08-01 et elle dépend maintenant de deux tâches.** Elle ne peut pas être exécutée avant elles, et l'entrée « Consomme » ci-dessous n'est pas une formalité.

**Fichiers**
- Modifier : `lib/game/training/contracts.ts` (ajouter `attemptId` à l'entrée de démarrage)
- Modifier : `app/api/training/session/start/route.ts`
- Modifier : `lib/game/training/provider.ts` (`startTrainingSession` `:727-810`)
- Créer : `scripts/quality/check-session-convergence.mjs` (garde **autonome**, suivi)
- **Ne pas toucher `package.json`.** **Ne pas toucher `scripts/quality/check-session-lifecycle.mjs`.**

**Interfaces**
- **Consomme : la tâche 4 et la tâche 5.** De la tâche 4, le balayage d'inactivité, qui passe après l'insertion et exclut la session courante : sans lui, un rechargement renvoyant le même `attemptId` verrait sa propre session marquée `abandoned` juste avant la relecture S4, et la règle de ré-entrée créerait le doublon que cette tâche supprime. De la tâche 5, l'écrivain `session_start` atomique : sans lui, deux démarrages convergés écriraient deux lignes `${sessionId}:session_start` identiques dans le journal.
- Produit : `startTrainingSession({ locale, guestUserId, familiarity, warmupCorrect, attemptId })`, et un payload dont `sessionId` est **toujours** l'identifiant effectif, que le client l'ait frappé ou que le serveur l'ait fait.

- [ ] **Étape 1 : règle de garde qui échoue**

Créer `scripts/quality/check-session-convergence.mjs`. La règle sur le filtre de mode est **bornée à la relecture S4**, et ce point compte : testée sur le fichier entier, elle serait verte avant même l'implémentation, `AND mode = 'training'` existant déjà à `:1219` dans `endTrainingSession` et `AND s.mode = 'training'` à `:777` dans le balayage. Un garde vert d'avance ne peut pas échouer, donc il n'assure rien.

```js
#!/usr/bin/env node

// Session convergence guard. No build, no database, no network.
//
// THE RULE IT PROTECTS. One attempt equals one identifier. The client mints a
// uuid per attempt and the server uses it as sessions.session_id, whose primary
// key already exists, so the database arbitrates the race and no schema
// changes. H1, proven by execution on 2026-07-31: the loser of
// INSERT ... ON CONFLICT (session_id) DO NOTHING blocks on the winner's
// transaction, returns zero rows, and its next read sees the committed row WITH
// THE WINNER'S SEED. H1b: if the winner rolls back, the loser inserts and
// becomes the winner. Self-healing both ways.
//
// THE SEED IS NOT OPTIONAL IN THE RE-READ. buildQuestion reads session.seed
// (provider.ts:820) and the answer path writes it back into the fact
// (provider.ts:1083). A loser that kept its own seed would serve a word and a
// token that disagree.
//
// This script is standalone on purpose: it guards startTrainingSession, the
// start route and the start contract, nothing else.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PROVIDER = "lib/game/training/provider.ts";
const ROUTE = "app/api/training/session/start/route.ts";
const CONTRACTS = "lib/game/training/contracts.ts";
const failures = [];

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const provider = read(PROVIDER);
const route = read(ROUTE);
const contracts = read(CONTRACTS);

if (!/attemptId/.test(contracts)) {
  failures.push(`${CONTRACTS}: the start input carries no attemptId.`);
}
if (!/attemptId/.test(route)) {
  failures.push(`${ROUTE}: the start route does not accept an attemptId.`);
}
// Identity must keep coming from the httpOnly cookie and never from the body.
// It already does today; this rule exists so a future rewrite cannot quietly
// take the user id from the payload while adding attemptId to it.
if (/body\.(userId|guestUserId)/.test(route)) {
  failures.push(`${ROUTE}: reads an identity out of the request body. Identity comes from the httpOnly cookie, only the attempt identifier comes from the client.`);
}

const conflictAt = provider.indexOf("ON CONFLICT (session_id) DO NOTHING");
if (conflictAt === -1) {
  failures.push(
    `${PROVIDER}: startTrainingSession does not converge on sessions_pkey. Two starts still ` +
      "insert two rows, which is the whole defect."
  );
} else {
  // S4, the re-read, bounded to itself. Anything looked for in the whole file
  // would already be satisfied by endTrainingSession or by the sweep.
  const afterConflict = provider.slice(conflictAt);
  const reReadAt = afterConflict.indexOf("WHERE session_id = ");
  if (reReadAt === -1) {
    failures.push(
      `${PROVIDER}: no re-read by session_id after the ON CONFLICT. The loser of the race returns ` +
        "zero rows and has nothing to serve."
    );
  } else {
    // 200 characters is the whole WHERE clause of that statement and nothing
    // else, so a mode filter belonging to endTrainingSession (:1219) or to the
    // sweep (:777) cannot satisfy this rule by accident. Tested against the
    // whole file it would be green before the implementation even starts, and a
    // rule that cannot fail asserts nothing.
    const reRead = afterConflict.slice(reReadAt, reReadAt + 200);
    if (!/AND mode = 'training'/.test(reRead)) {
      failures.push(
        `${PROVIDER}: the S4 re-read is not scoped by mode. A competition session sharing the id ` +
          "would be served as a training session."
      );
    }
    if (!/AND user_id = /.test(reRead)) {
      failures.push(
        `${PROVIDER}: the S4 re-read is not scoped by user_id. A client that guesses an id would ` +
          "be handed someone else's session."
      );
    }

    // The projection of that same statement, between its SELECT and its WHERE.
    const selectAt = afterConflict.lastIndexOf("SELECT", reReadAt);
    const projection = selectAt === -1 ? "" : afterConflict.slice(selectAt, reReadAt);
    if (!projection.includes("seed")) {
      failures.push(
        `${PROVIDER}: the S4 re-read does not select seed. buildQuestion reads it (:820) and the ` +
          "answer path writes it back into the fact (:1083), so a loser keeping its own seed serves " +
          "a word and a token that disagree."
      );
    }
  }
}

// Re-entry must be bounded. An unbounded retry loop on a permanently non-active
// id spins for ever, and re-entering the identity or the pool step would undo
// the pinning this task exists to create.
if (!/attemptsLeft|reentered|retriedOnce/.test(provider)) {
  failures.push(
    `${PROVIDER}: no visible bound on the re-entry. Mint-once-and-retry must be limited to a ` +
      "single extra attempt, and it must re-enter the insert only, never the identity or the pool."
  );
}

if (failures.length > 0) {
  console.error("check:session-convergence FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  "check:session-convergence OK : the start path takes an attemptId, converges on sessions_pkey, " +
    "and its re-read is scoped by session, user and mode, selects the winner's seed, and re-enters " +
    "at most once."
);
```

- [ ] **Étape 2 : exécuter, vérifier l'échec**

Run : `node scripts/quality/check-session-convergence.mjs`
Attendu : ÉCHEC. `contracts.ts` et la route n'ont pas d'`attemptId`, `provider.ts` n'a pas d'`ON CONFLICT (session_id) DO NOTHING`, et la borne de ré-entrée n'existe pas.

- [ ] **Étape 3 : implémenter**

**Ordre exact, séquence complète, y compris les deux appels que la version précédente de ce plan omettait, le balayage et `recordOnboardingFamiliarity`.** Un implémenteur littéral qui suivait l'ancienne liste les supprimait ou les replaçait au mauvais endroit.

1. identité depuis le cookie, jamais depuis le corps, résolue **une fois** par `getGuestUser` (`:738`) et épinglée ; `attemptId` validé comme uuid, frappé par le serveur s'il est absent ou mal formé, jamais de 500 ;
2. `ensureUserPool` (`:739`), **avant** l'insertion de session, comme aujourd'hui ;
3. `recordOnboardingFamiliarity` (`:741`), **inchangé, conservé à sa place**, toujours conditionné à `familiarity` non nul. Il écrit la réponse d'onboarding et n'a rien à voir avec la convergence ;
4. S3, insertion avec `session_id = attemptId`, `ON CONFLICT (session_id) DO NOTHING RETURNING session_id, seed, question_count, status` ;
5. S4 si zéro ligne : `SELECT session_id, seed, question_count, status FROM sessions WHERE session_id = $1 AND user_id = $2 AND mode = 'training'`. **Le `seed` est indispensable** : la construction de la question le lit (`:820`) et la voie réponse le réécrit dans le fait (`:1083`), donc un perdant qui garderait sa propre graine produirait un mot et un jeton incohérents ;
6. zéro ligne, ou statut non `active` : le serveur frappe un identifiant neuf et **ré-entre au point 4 uniquement**, jamais aux points 1, 2 ni 3, borné à **un** essai. Au delà, erreur explicite, jamais une boucle ;
7. **le balayage d'inactivité de la tâche 4**, ici, **après** que la session effective est connue, en l'excluant par son identifiant. Sa place n'est pas négociable : avant le point 4 il abandonnerait la session que le point 5 s'apprête à rejoindre ;
8. `insertSessionStartEvent`, **appelé une seule fois**, avec l'identifiant effectif. La branche S4 ne le rappelle pas : le CTE de la tâche 5 rend l'écriture idempotente sur `(user_id, session_id, idempotency_key)`, donc un second appel serait sans effet, mais ne pas l'appeler du tout dans la branche perdante est plus clair et évite une requête inutile.

- [ ] **Étape 4 : prouver sur branche**

`tmp/prove-convergence.mjs`, deux `Client` en WebSocket appelant le **vrai** `startTrainingSession` : même `attemptId` avec le même cookie donne **une** session, deux `attemptId` donnent deux sessions, un rejeu après clôture donne une session neuve. Ajouter la preuve que la tâche 4 rend possible : un appel, puis un second appel séquentiel deux minutes plus tard avec le **même** `attemptId`, doit rendre la **même** session et non un identifiant neuf. C'est exactement le rechargement de page, et c'est le cas que le balayage non corrigé cassait.

Vérifier aussi, en base, qu'il n'y a **qu'une seule** ligne `${sessionId}:session_start` dans `user_event_fact` après les deux appels convergés. C'est la tâche 5 qui le garantit, cette preuve la confirme en situation.

- [ ] **Étape 5 : porte qualité et commit**

Run : `node scripts/quality/check-session-convergence.mjs && npm run typecheck`

```bash
git add lib/game/training/contracts.ts \
        app/api/training/session/start/route.ts \
        lib/game/training/provider.ts \
        scripts/quality/check-session-convergence.mjs
git commit -m "feat(training): converge concurrent starts on the session primary key"
```

Rien d'autre, mêmes interdits que les tâches précédentes.

- [ ] **Étape 6 : prouver le commit depuis une extraction propre de HEAD**

Recette des contraintes globales, avec `check-session-convergence.mjs`. Rejouer aussi `node scripts/quality/check-session-sweep.mjs` et `node scripts/quality/check-event-writers.mjs` **dans la même extraction** : cette tâche réécrit la région que les deux précédentes ont corrigée, c'est le seul endroit du plan où trois gardes se recouvrent.

---

## Tâche 7 : le contrat client, et son garde

> **Piège inter-tâches, trouvé par la revue de la tâche 6 le 2026-08-01, à traiter dans cette tâche.** Le serveur valide l'identifiant reçu contre `ATTEMPT_ID_PATTERN`, qui impose une **version 1 à 5** et le variant `[89ab]`. Un client qui frapperait un **uuidv7** verrait donc **tous** ses identifiants refusés **en silence** : le serveur en frapperait un de son côté, la réponse serait valide, et un rechargement recréerait une session. Aucun garde ne le verrait, et la tâche 7 semblerait fonctionner alors que le bug d'entête resterait ouvert. Épingler `crypto.randomUUID()`, qui produit un uuidv4, et ajouter une règle de garde qui échoue si le client frappe autrement, ou élargir le motif côté serveur. Ne pas laisser ce choix implicite.
>
> **Et rappel de ce que cette tâche ferme.** Après la tâche 6, le serveur converge, c'est prouvé sur base, mais **le client ne frappe aucun identifiant** : un rechargement crée encore une session neuve. Cette tâche est donc celle qui ferme le bug qui donne son nom au plan, et celle qui rend atteignable la clôture de séance durcie par la tâche 5, aujourd'hui sans aucun appelant dans l'historique.

> **Cette tâche livre un ensemble cohérent, pas seulement `GameScreen.tsx`.** La voie de fin qu'elle appelle, `app/api/training/session/end/route.ts`, **n'est pas dans l'historique** : tout le répertoire est non suivi. Committer un client qui appelle `/api/training/session/end` sans elle mettrait un 404 dans l'historique. Symétriquement, `content/copy.ts` porte 30 lignes non committées, le bloc `trainingIntroCopy` et ses neuf clés, dont l'unique consommateur, `features/modes/components/TrainingIntro.tsx`, est non suivi lui aussi : committer `copy.ts` seul casse `check:copy`, donc `npm run quality`, depuis l'historique. Les fichiers partent donc **ensemble**.

**Fichiers**
- Modifier : `features/game/components/GameScreen.tsx` (`startSession` `:143`, l'effet de montage `:186`, son tableau de dépendances `:196`, les boutons `:397` et `:450`, la branche « Session complete » `:381`, le bloc « Play again » `:446-458`)
- **Mettre sous suivi** : `app/api/training/session/end/route.ts`. Elle est autonome, mesuré : elle n'importe que `endTrainingSession` (`provider.ts`) et `getCurrentUserId` (`lib/server/current-user.ts`), tous deux suivis. Elle est committable telle quelle.
- **Mettre sous suivi** : `features/modes/components/TrainingIntro.tsx`. Il consomme les **neuf** clés du bloc, `kicker`, `title`, `subtitle`, `pointsTitle`, `points`, `progressLine`, `startLabel`, `rulesLabel`, `mascotComment`. Il suffit **à lui seul** à satisfaire `check:copy`.
- Modifier : `content/copy.ts` (le bloc `trainingIntroCopy` déjà écrit, committé tel quel avec son consommateur)
- Modifier : `app/play/training/page.tsx` (7 lignes, rend `TrainingIntro` au lieu de rediriger vers `/game`), pour que le composant ne soit pas du code mort dès son premier commit
- Créer : `scripts/quality/check-client-attempt-contract.mjs` (garde **autonome**, suivi)
- Créer, **non suivi** : `tmp/prove-client-contract.mjs`
- **Ne pas committer `features/modes/components/ModeRulesPage.tsx`.** Il importe bien `trainingIntroCopy.points`, mais `check:copy` n'en a **pas** besoin : `TrainingIntro.tsx` couvre déjà les neuf clés. Sa copie de travail porte +1293 lignes de la session parallèle, sans rapport avec ce plan. Hors périmètre.
- **Ne pas toucher `package.json`.** **Ne pas toucher `scripts/quality/check-session-lifecycle.mjs`.** **Ne pas toucher `tests/e2e/training.spec.ts`** ni `lib/game/training/catalog.ts`, dont les copies sales appartiennent aussi à la session parallèle.

**Interfaces**
- Consomme : la tâche 6. Le client frappe l'identifiant que le serveur accepte désormais sous le nom `attemptId`.
- Produit : un chargement, un rechargement et une reprise qui envoient le **même** identifiant ; une clôture qui en frappe un neuf.

- [ ] **Étape 1 : écrire la preuve qui échoue, sans e2e et sans aucune écriture en base**

**Ne pas créer de spec Playwright sous `tests/e2e/`, et ne pas lancer `npx playwright test`.** Mesuré : `playwright.config.ts` déclare `globalSetup: "./tests/e2e/guard-database.ts"`, ce garde **jette** si `JDT_E2E_ALLOW_PROD` ne vaut pas `1`, et le même fichier retire le bloc `webServer` en l'absence de cet opt-in. La commande sortirait donc en erreur **sans avoir chargé la moindre page** : l'implémenteur verrait le rouge annoncé et conclurait que son test échoue correctement, alors qu'il n'aurait rien testé. C'est un faux rouge. L'interception de route n'y change rien, le garde est un `globalSetup` et ne sait rien des interceptions d'un spec. Et l'opt-in n'est pas une option : `DATABASE_URL` pointe aujourd'hui sur la production.

La technique, qui n'a besoin ni du runner, ni de la config, ni du garde, ni d'une écriture :

1. l'opérateur laisse tourner son serveur de dev habituel, `npm run dev` sur `127.0.0.1:3000`, ou l'instance `:3002` si c'est celle qui tourne. Rien n'est démarré par le script ;
2. le script est un fichier **`.mjs` sous `tmp/`**, qui est gitignoré (`/tmp/` dans `.gitignore`). Il utilise la **bibliothèque** Playwright, `import { chromium } from "playwright"`, présente en devDependency. Aucun `@playwright/test`, donc **aucun `playwright.config.ts` n'est lu et `guard-database.ts` n'est jamais exécuté** ;
3. `context.route("**/api/training/session/start", ...)` intercepte l'appel **avant** qu'il ne sorte, enregistre `route.request().postDataJSON()`, puis répond par un `fulfill` synthétique. La vraie route n'est jamais atteinte, donc **aucune ligne n'est créée nulle part** ;
4. les assertions portent sur ce que le client a **envoyé** : le nombre d'appels, et l'`attemptId` de chacun ;
5. la page visée est **`/game`**, comme `tests/e2e/training.spec.ts:49` et `:133`, et surtout pas `/play/training`, qui redirige vers `/game` dans HEAD mais affichera un écran d'intro sans démarrage automatique une fois cette tâche committée.

```js
// tmp/prove-client-contract.mjs, non suivi, gitignoré.
// Preuve du contrat client SANS le runner e2e et SANS aucune écriture en base.
// Prérequis : un serveur de dev déjà lancé. BASE=http://127.0.0.1:3000 par défaut.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Charge utile synthétique, forme exacte de TrainingStartResponse
// (lib/game/training/contracts.ts). fontFace null est accepté par le client, il
// se contente de ne pas injecter de descripteur.
const FAKE = {
  sessionId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  question: {
    id: "q1",
    token: "tok",
    displayWord: "Hamburgefonstiv",
    typefaceSlug: "fake-face",
    typefaceLabel: "Fake Face",
    fontFamily: "serif",
    fontFace: null,
    options: [
      { slug: "fake-face", label: "Fake Face" },
      { slug: "other-face", label: "Other Face" },
    ],
  },
  progress: { resolvedCount: 0 },
};

const failures = [];
const browser = await chromium.launch();
const context = await browser.newContext();
const sent = [];

await context.route("**/api/training/session/start", async (route) => {
  let body = {};
  try {
    body = route.request().postDataJSON() ?? {};
  } catch {
    body = {};
  }
  sent.push(body);
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(FAKE),
  });
});

const page = await context.newPage();

const waitForCalls = async (n) => {
  const deadline = Date.now() + 10_000;
  while (sent.length < n && Date.now() < deadline) await page.waitForTimeout(100);
  if (sent.length < n) failures.push(`expected ${n} start calls, saw ${sent.length}`);
};

// 1. Premier chargement : un appel, un identifiant bien formé.
await page.goto(`${BASE}/game`, { waitUntil: "domcontentloaded" });
await waitForCalls(1);
if (sent[0] && !UUID.test(String(sent[0].attemptId))) {
  failures.push(`first call sent no valid attemptId, got ${JSON.stringify(sent[0].attemptId)}`);
}

// 2. Rechargement : le MEME identifiant. C'est le cas qui crée le doublon
//    aujourd'hui, et c'est le seul qui compte.
await page.reload({ waitUntil: "domcontentloaded" });
await waitForCalls(2);
if (sent[1] && sent[0] && sent[1].attemptId !== sent[0].attemptId) {
  failures.push(
    `reload minted a NEW attemptId (${sent[0]?.attemptId} then ${sent[1]?.attemptId}); ` +
      "a reload is the same attempt and must replay the same identifier"
  );
}

// 3. Un seul appel par chargement : la garde de reentrance tient.
if (sent.length > 2) {
  failures.push(`${sent.length} start calls for two loads; the in-flight guard let a duplicate through`);
}

await browser.close();

if (failures.length > 0) {
  console.error("prove:client-contract FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}
console.log(`prove:client-contract OK : ${sent.length} calls, same attemptId across the reload.`);
```

- [ ] **Étape 2 : exécuter, vérifier l'échec, et coller le texte de l'assertion**

```
node tmp/prove-client-contract.mjs
```
Attendu : ÉCHEC, et **le message exact** `first call sent no valid attemptId, got undefined`, parce que `startSession` (`:143`) n'envoie aujourd'hui que `locale`, `familiarity` et `warmupCorrect`. Un code de sortie non nul ne suffit pas comme preuve : coller la ligne. Si le message est autre chose, notamment `expected 1 start calls, saw 0`, c'est que le serveur de dev n'est pas sur le port visé, et la preuve n'a rien mesuré.

- [ ] **Étape 3 : implémenter le contrat**

Cinq règles, et la première est celle qui manquait :

1. **frapper et persister l'identifiant AVANT l'envoi**, pas à la réception. Un rechargement pendant que le premier appel est en vol abandonne la requête, aucun cookie n'est traité, rien n'est stocké, mais le serveur a terminé son écriture.
2. garde de réentrance dans un `ref`, posé **synchroniquement** avant le `fetch`. `disabled={isLoading}` ne suffit pas, il dépend d'un rendu.
3. l'identifiant est lu et écrit **dans** la fonction via `sessionStorage`, comme `readOnboarding` (`:52-66`). Il ne devient jamais un état React et n'entre jamais dans un tableau de dépendances, sinon l'effet se relance à chaque réponse.
4. la reprise rejoue le **même** identifiant, c'est un retry et pas une tentative. Seuls la clôture réussie et « Play again » en frappent un neuf.
5. repli `crypto.getRandomValues` : `crypto.randomUUID` n'existe pas hors contexte sécurisé, donc un test sur mobile en IP locale jetterait.

**Les deux boutons appellent aujourd'hui la même fonction sans argument**, `onClick={() => void startSession()}` à `:397` et à `:450`, alors que la règle 4 leur demande des comportements opposés. `startSession` doit donc prendre un paramètre :

```tsx
const startSession = useCallback(async ({ fresh = false }: { fresh?: boolean } = {}) => {
```

« Retry session » (`:397`) appelle `startSession()`, « Play again » (`:450`) appelle `startSession({ fresh: true })`. **Attention à l'effet de montage** : `startSession` est un `useCallback` (`:143`) dont l'identité alimente le tableau de dépendances de l'effet `:196`, `[clearAdvanceTimer, startSession]`. Le nouvel argument ne doit **pas** entrer dans ce tableau, et l'effet continue d'appeler `void startSession()` sans argument.

Livrer dans la même tâche `setIsComplete(true)`, qui n'est appelé **nulle part** aujourd'hui (la seule occurrence est `setIsComplete(false)` à `:147`, ce qui rend morts la branche `:381` et le bloc `:446-458`), et l'appel à `POST /api/training/session/end`, et ne larguer l'identifiant de `sessionStorage` **qu'après** un succès.

- [ ] **Étape 4 : le garde qui empêche la régression**

Créer `scripts/quality/check-client-attempt-contract.mjs`. Le cas sans cookie est fermé **par le client** : toute réécriture qui perd le `ref` ou remet l'identifiant dans les dépendances rouvre le doublon sans que la base ne s'en aperçoive.

```js
#!/usr/bin/env node

// Client attempt-contract guard. No build, no database, no network, no browser.
//
// THE RULE IT PROTECTS. One attempt equals one identifier, minted and persisted
// BEFORE the call, not on the response. A reload while the first call is in
// flight aborts the request: no cookie is processed and nothing is stored on
// the client, but the server has already finished its write. The database can
// only converge on an identifier the client actually resends, so this contract
// is the half of the fix no SQL can enforce.
//
// This script is standalone on purpose: it guards
// features/game/components/GameScreen.tsx and nothing else.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCREEN = "features/game/components/GameScreen.tsx";
const END_ROUTE = "app/api/training/session/end/route.ts";
const failures = [];

const screen = fs.readFileSync(path.join(ROOT, SCREEN), "utf8");

if (!/inFlightRef/.test(screen)) {
  failures.push(`${SCREEN}: lost its in-flight guard ref. disabled={isLoading} depends on a render and lets a fast double click through.`);
}

// Anchored on the shape of a hook call, `}, [ ... ]`, NOT on any bracket pair
// containing the substring. The loose form /\[[^\]]*attemptId[^\]]*\]/ matches a
// destructuring like `const [attemptId, setAttemptId]` and any array literal
// mentioning attemptIdRef, so it would fire on correct code.
if (/\}\s*,\s*\[[^\]]*attemptId/.test(screen)) {
  failures.push(`${SCREEN}: attemptId entered a React dependency array. The mount effect would re-run on every answer and restart the session.`);
}

// The identifier is minted before the request leaves, so its storage access has
// to appear before the fetch in the source of startSession.
const fetchAt = screen.indexOf('fetch("/api/training/session/start"');
const storageAt = screen.indexOf("sessionStorage");
if (fetchAt === -1) {
  failures.push(`${SCREEN}: no call to /api/training/session/start.`);
} else if (storageAt === -1 || storageAt > fetchAt) {
  failures.push(`${SCREEN}: the attempt identifier is not read or written from sessionStorage before the start request. Minting it on the response loses it whenever a reload aborts the call in flight.`);
}
if (!/attemptId/.test(screen.slice(0, fetchAt === -1 ? screen.length : fetchAt + 600))) {
  failures.push(`${SCREEN}: the start request does not carry an attemptId.`);
}

// crypto.randomUUID does not exist outside a secure context, so a phone hitting
// the dev server on a local IP would throw on the very first render.
if (/crypto\.randomUUID/.test(screen) && !/getRandomValues/.test(screen)) {
  failures.push(`${SCREEN}: crypto.randomUUID with no getRandomValues fallback. It is undefined outside a secure context, so testing on a device over a local IP throws.`);
}

// The two buttons must stop calling the same argument-less function: a retry
// replays the identifier, Play again mints a new one.
if (/onClick=\{\(\) => void startSession\(\)\}[\s\S]*onClick=\{\(\) => void startSession\(\)\}/.test(screen)) {
  failures.push(`${SCREEN}: "Retry session" and "Play again" still call the same argument-less startSession. One is a retry on the same attempt, the other is a new attempt.`);
}
if (!/startSession\(\{\s*fresh/.test(screen)) {
  failures.push(`${SCREEN}: no caller asks startSession for a fresh attempt. Play again must mint a new identifier.`);
}

// The completion branch is dead code until something sets it, and the end route
// is what sets it.
if (!/setIsComplete\(true\)/.test(screen)) {
  failures.push(`${SCREEN}: setIsComplete(true) is called nowhere, so the "Session complete" branch and the "Play again" block are unreachable.`);
}
// A real call, not a mention. GameScreen already NAMES the end path in the
// comment at :326-330 that explains why the completion branch is dead, so a
// bare /api\/training\/session\/end/ test is green today and asserts nothing.
if (!/fetch\(\s*["'`]\/api\/training\/session\/end/.test(screen)) {
  failures.push(`${SCREEN}: nothing closes the session. A training session has no round cap any more, so it stays active for ever unless the client actually calls the end path, not merely mentions it in a comment.`);
}

// The route the client now calls must exist in the same commit, or the client
// ships a 404 into history. NOTE: this rule is green in the working tree, where
// the file exists but is untracked, and red from a clean extraction of HEAD.
// The extraction is the run that counts, per the global constraints.
if (!fs.existsSync(path.join(ROOT, END_ROUTE))) {
  failures.push(`${END_ROUTE} does not exist, but ${SCREEN} calls it. Commit the route in the same commit as its caller.`);
}

if (failures.length > 0) {
  console.error("check:client-attempt-contract FAILED\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  "check:client-attempt-contract OK : the attempt identifier is minted before the request, kept " +
    "out of every dependency array, guarded against re-entrance, replayed on retry and renewed on " +
    "Play again, and the end route it calls exists."
);
```

- [ ] **Étape 5 : exécuter, prouver dans le navigateur, porte qualité**

```
node scripts/quality/check-client-attempt-contract.mjs
node tmp/prove-client-contract.mjs
npm run typecheck
```
Attendu : garde vert, preuve verte avec la ligne `prove:client-contract OK : 2 calls, same attemptId across the reload.`

- [ ] **Étape 6 : commit, l'ensemble cohérent en une fois**

```bash
git add features/game/components/GameScreen.tsx \
        app/api/training/session/end/route.ts \
        features/modes/components/TrainingIntro.tsx \
        app/play/training/page.tsx \
        content/copy.ts \
        scripts/quality/check-client-attempt-contract.mjs
git commit -m "feat(training): one attempt equals one identifier, minted before the call"
```

Six fichiers, pas un de plus. Vérifier avant de committer, par `git status --porcelain` et par `git diff --cached --name-only`, que ni `package.json`, ni `features/modes/components/ModeRulesPage.tsx`, ni `tests/e2e/training.spec.ts`, ni `lib/game/training/catalog.ts`, ni `scripts/quality/check-session-lifecycle.mjs`, ni `backups/backfill-2026-07-29-training-sessions-before.json` ne sont dans l'index.

- [ ] **Étape 7 : prouver que l'ensemble est complet, depuis une extraction propre de HEAD**

C'est l'étape qui décide si la sélection de fichiers était la bonne. La porte de copie est celle qui tranche : elle échoue si une clé de `content/copy.ts` n'a aucun consommateur dans le code **suivi**.

```bash
rm -rf /tmp/jdt-head && mkdir -p /tmp/jdt-head
git archive HEAD | tar -x -C /tmp/jdt-head
(cd /tmp/jdt-head && node scripts/quality/check-copy-usage.mjs)
```

Attendu : `All copy keys are used: ...`, avec `trainingIntroCopy (kicker, title, subtitle, pointsTitle, points, progressLine, startLabel, rulesLabel, mascotComment)` dans le résumé. Si la sortie liste `Unused copy keys detected` suivi de clés `trainingIntroCopy.*`, c'est que `TrainingIntro.tsx` n'est pas dans le commit et l'ensemble est incomplet : le corriger par un `git add` du fichier manquant et un `git commit --amend`, **pas** par un commit de rattrapage qui laisserait un HEAD rouge dans l'historique.

Puis la recette complète des contraintes globales, avec `check-client-attempt-contract.mjs`, plus les trois gardes des tâches 4, 5 et 6, tous dans la même extraction.

---

## Tâche 8 : la voie réponse, son index de tentative et son compteur servi

> **Ajoutée le 2026-08-01, après la revue du moteur qui a suivi le commit `3916a3e`.** Cette tâche ferme un risque que la version précédente de ce plan se contentait d'assumer dans ses risques résiduels : « deux réponses simultanées à la même question peuvent écrire deux lignes identiques ». La revue a montré que ce n'est pas seulement une ligne en double, c'est **l'écriture de mastery qui tourne deux fois avec le même `mastery_before`**, donc une double pénalisation ou une double promotion du joueur.

**Fichiers**
- Modifier : `scripts/quality/check-session-counters.mjs` (durcissement de la règle 1, plus une règle sur le compteur servi)
- Modifier : `lib/game/training/provider.ts` (`submitTrainingAnswer` `:849-1200` : la lecture de tentative `:920-928`, l'insertion du fait `:1042-1096`, la voie fausse `:1098-1113`)
- **Ne pas toucher `package.json`.** **Ne pas toucher `scripts/quality/check-session-lifecycle.mjs`.**

**Interfaces**
- **Consomme : la tâche 5.** Elle réutilise le CTE `event_ingestion_guard` que la tâche 5 introduit, et rien d'autre. Aucune dépendance envers les tâches 6 et 7 : la course visée ici est « deux réponses à la même question », pas « deux démarrages », les deux sont orthogonales.
- Produit : une voie réponse dont l'index de tentative est dérivé en SQL, dont l'écriture pédagogique ne peut pas tourner deux fois, et dont le compteur servi n'est jamais périmé.

- [ ] **Étape 1 : durcir un garde déjà committé, prouvé insuffisant par mutation**

`scripts/quality/check-session-counters.mjs` est suivi, vert, et **à moitié efficace**. Sa règle 1 exige `SET` immédiatement avant `global_q_index` :

```js
  if (/SET\s+global_q_index\s*=\s*\$\{/.test(submitBody)) {
```

Il suffit d'écrire une autre colonne en premier pour la contourner intégralement, `SET last_seen_at = now(), global_q_index = ${jsNext} ... RETURNING global_q_index` : le bug est entièrement de retour, le garde sort 0. La règle 2, sur `question_count`, est écrite **sans** ce préfixe et attrape la même mutation. Aligner la 1 sur la 2, et écrire la mutation en commentaire pour que personne ne la reverte :

```js
  // -------------------------------------------- 1. global_q_index increments in SQL
  // Catches `global_q_index = ${someJsValue}`, the shape a JS-computed
  // `user.global_q_index + 1` assignment takes once interpolated into the query.
  // The safe form (`global_q_index = global_q_index + 1`) has no `${` right after
  // the `=` and does not match.
  //
  // NO `SET\s+` PREFIX, AND THAT IS NOT AN OVERSIGHT. This rule used to read
  // /SET\s+global_q_index\s*=\s*\$\{/ and was defeated by writing any other column
  // first: `SET last_seen_at = now(), global_q_index = ${jsNext} ... RETURNING
  // global_q_index` reintroduces the lost-increment bug in full and the guard
  // exited 0. Verified by mutation on 2026-08-01. Rule 2 below never had the
  // prefix and always caught that mutation; this rule now matches it.
  if (/global_q_index\s*=\s*\$\{/.test(submitBody)) {
```

Ajouter dans le même fichier la règle du compteur servi sur la voie fausse, qui est le défaut D de la revue :

```js
  // ------------------------------------ 4. the wrong-answer path serves a fresh count
  // The wrong path writes nothing to sessions, so there is no RETURNING to serve
  // from, and it currently answers with `session.question_count` read at the very
  // top of the call (:1110). Nothing is lost, but under the concurrency this plan
  // postulates (two active sessions, a second tab resolving a question) the client
  // is told a number that is already out of date. The fact-insert statement can
  // return the fresh value in the same round trip.
  if (/resolvedCount:\s*session\.question_count/.test(submitBody)) {
    failures.push(
      `${PROVIDER}: the wrong-answer path serves resolvedCount from the session row read at the ` +
        "start of the call. It must come from the answer statement's RETURNING, like the correct " +
        "path already does."
    );
  }
```

- [ ] **Étape 2 : prouver le durcissement, par mutation et sur le vrai code**

Trois exécutions, les trois exigées comme preuve. La mutation est celle ci, appliquée dans une **copie jetable** de `provider.ts`, jamais dans l'arbre. Ancre réelle, `:1123-1128` :

```ts
    UPDATE users
    SET global_q_index = global_q_index + 1,
        last_seen_at = now()
    WHERE user_id = ${user.user_id}::uuid
    RETURNING global_q_index
```

devient

```ts
    UPDATE users
    SET last_seen_at = now(),
        global_q_index = ${user.global_q_index + 1}
    WHERE user_id = ${user.user_id}::uuid
    RETURNING global_q_index
```

Le bug de la tâche 2 est intégralement de retour : `RETURNING` est toujours là, mais la valeur écrite vient d'une lecture JS.

```bash
# a) garde COMMITTÉ contre le code MUTÉ, pour établir le défaut
node scripts/quality/check-session-counters.mjs   # depuis la copie mutée
# b) garde DURCI contre le code MUTÉ
node scripts/quality/check-session-counters.mjs   # depuis la copie mutée
# c) garde DURCI contre le VRAI code
node scripts/quality/check-session-counters.mjs
```

Résultats obtenus le 2026-08-01, à reproduire à l'identique :

```
(a) check:session-counters OK : global_q_index and question_count both increment in SQL
    (no JS-read-then-write), and resolvedCount is served from the sessions RETURNING clause.
    EXIT=0            <-- le garde committé déclare vert un code entièrement bogué

(b) check:session-counters FAILED
      - provider assigns global_q_index from a JS read; increment it in SQL. [...]
    EXIT=1            <-- la règle 1 durcie attrape la mutation

(c) la règle 1 durcie NE se déclenche PAS sur le vrai code, `SET global_q_index =
    global_q_index + 1` n'ayant pas de `${` après le `=`. Seule la règle 4 sort
    rouge, la voie fausse servant encore session.question_count, ce qui est
    précisément ce que l'étape 5 corrige.
```

C'est la démonstration exigée : rouge contre le code muté, vert contre le vrai, et la preuve que l'ancienne règle ne l'était ni l'un ni l'autre.

- [ ] **Étape 3 : dériver l'index de tentative en SQL, dans l'instruction qui insère le fait**

Le défaut mesuré (`:920-928`) est exactement le motif que la tâche 2 a éliminé pour les deux compteurs, laissé en place sur une colonne régie par `chk_reason_coherence` :

```ts
  const previousAttemptRows = await queryRows<CountRow>(sql`
    SELECT COUNT(*)::text AS count
    FROM user_event_fact
    WHERE session_id = ${sessionId}::uuid
      AND event_type = 'answer'
      AND question_id = ${payload.questionId}::uuid
  `);

  const attemptCount = Number.parseInt(previousAttemptRows[0]?.count ?? "0", 10) + 1;
```

Deux réponses parallèles à la même question, double clic ou jeton rejoué puisque le jeton n'est **pas** à usage unique, calculent toutes les deux 1, produisent deux lignes avec la même `idempotency_key` `${sessionId}:${questionId}:1` que rien n'unicise sur `user_event_fact`, et font tourner l'écriture de mastery deux fois avec le même `mastery_before`.

**On réutilise le mécanisme de la tâche 5, on n'en invente pas un second, et voici pourquoi.** La clé d'idempotence embarque l'index de tentative. La dériver en SQL ne suffirait donc pas seule : `COUNT(*)` reste soumis à la course, deux transactions concurrentes lisent toutes les deux 0 et construisent toutes les deux la même clé. Ce qui tranche la course, ce n'est pas le comptage, c'est la **clé primaire de `event_ingestion_guard`**, `(user_id, session_id, idempotency_key)`, sur laquelle le perdant bloque puis repart à vide, exactement le mécanisme H1. Et ce comportement est **sémantiquement juste** : l'index dérivé n'avance que lorsque le fait précédent est **validé**, donc deux soumissions en vol dérivent toutes deux 1 et entrent en collision, tandis qu'une vraie seconde tentative, envoyée après que la première a été validée, dérive 2 et ne collisionne pas. La dérivation SQL et la garde d'ingestion ne sont pas deux corrections, c'est une seule.

```ts
  // attempt_index is derived HERE, inside the statement that inserts the fact,
  // never by a COUNT read back into JavaScript. Two submissions for the same
  // question in flight at the same time both read a count of 0, both build the
  // same idempotency key, and the event_ingestion_guard primary key is what
  // arbitrates: the loser blocks on the winner's transaction, DO NOTHING leaves
  // `g` empty, the outer INSERT writes nothing, and RETURNING yields zero rows.
  // Zero rows means "this submission is a duplicate", and NOTHING else runs.
  //
  // The derived index is also the correct semantics, not just the pure one: it
  // only advances once the previous fact is COMMITTED, so a genuine retry sent
  // after the first answer resolved derives 2 and never collides.
  const written = await queryRows<{ attempt_index: number; resolved_count: number }>(sql`
    WITH n AS (
      SELECT COUNT(*)::int + 1 AS attempt_index
      FROM user_event_fact
      WHERE session_id = ${sessionId}::uuid
        AND event_type = 'answer'
        AND question_id = ${payload.questionId}::uuid
    ),
    g AS (
      INSERT INTO event_ingestion_guard (idempotency_key, user_id, session_id, ingestion_status)
      SELECT
        ${sessionId} || ':' || ${payload.questionId} || ':' || n.attempt_index,
        ${user.user_id}::uuid,
        ${sessionId}::uuid,
        'accepted'
      FROM n
      ON CONFLICT (user_id, session_id, idempotency_key) DO NOTHING
      RETURNING idempotency_key
    )
    INSERT INTO user_event_fact (
      idempotency_key, user_id, session_id, mode, global_q_index, question_id,
      attempt_index, event_type, typeface_slug, answer_slug, is_correct,
      response_time_ms, mastery_before, mastery_after, misread_shown,
      reading_shown, display_word, reason_code, seed, engine_version
    )
    SELECT
      g.idempotency_key,
      ${user.user_id}::uuid,
      ${sessionId}::uuid,
      'training',
      ${user.global_q_index},
      ${payload.questionId}::uuid,
      n.attempt_index,
      'answer',
      ${payload.typefaceSlug},
      ${answerSlug},
      ${isCorrect},
      ${responseTimeMs},
      ${currentState.mastery_level},
      CASE WHEN n.attempt_index = 1 THEN ${masteryAfterFirstTry} ELSE ${currentState.mastery_level} END,
      ${misreadShown},
      ${readingShown},
      ${payload.displayWord},
      CASE WHEN n.attempt_index = 1
           THEN ${isCorrect ? "correct_first_try" : "wrong_first_try"}
           ELSE ${isCorrect ? "correct_after_retry" : "wrong_retry"} END,
      ${session.seed},
      ${TRAINING_ENGINE_VERSION}
    FROM n, g
    RETURNING
      attempt_index,
      (SELECT question_count FROM sessions WHERE session_id = ${sessionId}::uuid) AS resolved_count
  `);
```

Deux points à ne pas rater dans cette instruction.

`mastery_after` et `reason_code` dépendent de l'index, qui n'est connu qu'à l'intérieur de l'instruction. Les deux se résolvent par un `CASE` à deux branches et pas davantage : `isCorrect` est connu en JS sans aucune lecture, donc seule l'alternative « première tentative ou non » reste ouverte. `masteryAfterFirstTry` est la valeur déjà calculée aujourd'hui pour la première tentative, `Math.min(4, m + 1)` si correct, la descente si faux ; au delà de la première tentative le niveau ne bouge pas, ce que confirment les trois branches existantes, `wrong_retry` n'écrivant rien du tout.

Le `RETURNING` sert **aussi** le compteur frais, par sous-requête scalaire sur `sessions`, ce qui règle le défaut D sans aucun aller-retour supplémentaire.

- [ ] **Étape 4 : conditionner l'écriture pédagogique au gain de la garde**

C'est la moitié qui compte. Aujourd'hui les trois branches `wrongFirstTry`, `correctFirstTry` et `correctAfterRetry` (`:944-1017`), plus `registerMasteryUnlock` (`:1005`), tournent inconditionnellement. Elles deviennent conditionnées, et l'index vient de la base :

```ts
  // Zero rows: another submission for this same attempt won the guard. It has
  // already moved mastery, already written the fact, already advanced the
  // counters. Re-running any of that here would apply the same transition twice
  // from the same mastery_before, which is a double penalty or a double promotion
  // for the player, not a harmless duplicate.
  if (written.length === 0) {
    return duplicateAnswerResponse(session, currentState, levelFields);
  }

  const attemptCount = written[0].attempt_index;
  const resolvedCount = written[0].resolved_count;
```

`duplicateAnswerResponse` sert l'état tel qu'il a été lu, sans rien écrire : c'est la réponse honnête à une soumission dupliquée. Les trois branches de mastery, l'`UPDATE users`, l'`UPDATE sessions` et `maybeRebalancePool` passent toutes **après** ce point de contrôle.

**Réordonnancement à assumer, et il est du même type que celui déjà justifié pour `session_end`.** Le fait s'écrit désormais **avant** l'écriture de mastery, alors qu'il s'écrivait après. C'est sans effet sur les valeurs inscrites, `mastery_before` et `mastery_after` étant tous deux calculés en JS avant l'une comme l'autre des deux écritures. Le mode de panne change en revanche : une interruption entre le fait et l'écriture de mastery laisse le fait écrit et le mastery en retard d'un pas, au lieu de laisser aujourd'hui un mastery écrit deux fois. C'est strictement meilleur, et c'est réparable, le fait portant `mastery_after`, donc un travail de reprise peut recalculer. Écrire ce raisonnement dans le commentaire.

- [ ] **Étape 5 : servir le compteur frais sur les deux voies**

La voie fausse (`:1105-1113`) rend `resolvedCount: session.question_count`, lu tout en haut de l'appel. Elle rend désormais `resolvedCount`, issu du `RETURNING` de l'étape 3. La voie correcte continue de servir `resolvedCountAfter`, issu du `RETURNING question_count` de l'`UPDATE sessions` (`:1136-1142`), qui est déjà juste depuis la tâche 2.

- [ ] **Étape 6 : prouver sur branche**

`tmp/prove-answer-dedup.mjs`, sur une branche Neon jetable, deux `Client` en WebSocket appelant le **vrai** `submitTrainingAnswer` sur la même question, transactions recouvrantes : exactement **une** ligne dans `user_event_fact` pour cette question, exactement **une** ligne dans `event_ingestion_guard`, et `user_typeface_state` ayant bougé d'**un seul** pas. Puis, séquentiellement, une vraie seconde tentative après une première réponse fausse validée : elle doit passer, avec `attempt_index = 2` et `reason_code` cohérent avec `chk_reason_coherence`.

- [ ] **Étape 7 : porte qualité et commit**

Run : `node scripts/quality/check-session-counters.mjs && node scripts/quality/check-event-writers.mjs && npm run typecheck`

```bash
git add lib/game/training/provider.ts \
        scripts/quality/check-session-counters.mjs
git commit -m "fix(training): derive attempt_index in SQL and make the answer write idempotent"
```

Rien d'autre, mêmes interdits que les tâches précédentes.

- [ ] **Étape 8 : prouver le commit depuis une extraction propre de HEAD**

Recette des contraintes globales, avec `check-session-counters.mjs`. Rejouer `check-event-writers.mjs` dans la même extraction : cette tâche réécrit une région voisine de celle de la tâche 5 et réutilise son mécanisme.

---

## Après le plan

Ce qui reste, et qui n'est pas dans ce plan : la décision `buildEye`, la décision de remise à zéro de `session_errors` détaillée dans les risques résiduels, l'application de la migration 012 en production (feu vert propriétaire), le câblage des sept gardes non appelés par `npm run quality`, l'arbitrage des 48 fichiers de la session parallèle, les 84 sessions de compétition actives (chantier séparé, explicitement reporté par le propriétaire), et une purge éventuelle des invités sans aucune réponse de plus de 24 heures.

## Risques résiduels à assumer

**Limite de mécanisme, assumée et documentée plutôt que cachée.** Le balayage d'inactivité ne s'exécute qu'au démarrage d'une séance. **Il n'existe aucun faucheur** : rien ne ferme la session périmée d'un joueur qui ne revient jamais, ni avant ni après ce plan. Mesuré le 2026-08-01 : les 73 sessions historiques sont toutes closes depuis le rattrapage, donc il reste **zéro session d'entraînement active** et le balayage n'a aujourd'hui rien à balayer, il ne protège que l'avenir. Le bouclage réel demande soit un travail planifié, soit la route de clôture explicite appelée par le client, livrée par la tâche 7. Ce plan rend le mécanisme juste, il ne rend pas le système complet.

**Sur le produit.** Deux sessions actives simultanées sont un état supporté : **aucun code ne doit dépendre de « au plus une »**. Un onglet dupliqué partage le stockage donc l'identifiant donc la session. La double écriture de la voie réponse, que la version précédente de ce plan assumait, est désormais **fermée par la tâche 8** : `attempt_index` est dérivé en SQL et la soumission est admise par la clé primaire de `event_ingestion_guard`. Ce qui reste ouvert, c'est le jeton de question, qui n'est **pas à usage unique** : un rejeu tardif, après validation du fait précédent, dérive un index de tentative supérieur et sera donc accepté comme une tentative légitime. Une session peut être balayée après 30 minutes d'inactivité pendant que le client la détient : il recevra une erreur au prochain envoi et son bouton de reprise frappera une session neuve. La voie réponse est la seule sans contrôle de cookie, l'identité venant du jeton signé. Sans cookie, du déchet en base subsiste par deux voies séquentielles, réponse perdue puis reprise, et client bloquant les cookies, à environ 31 lignes par occurrence, sans incohérence visible pour le joueur.

**Question produit ouverte, à trancher par le propriétaire, aucune tâche de ce plan ne la prend : quand `user_typeface_state.session_errors` doit-il être remis à zéro ?**

Le fait mesuré. `session_errors` est un compteur **par séance** qui vit sur une ligne **par utilisateur et par typographie** (`db/migrations/003_users_sessions_pool.sql:188`, `smallint NOT NULL DEFAULT 0 CHECK (>= 0)`). Il est incrémenté sur chaque première tentative fausse (`provider.ts:949`) et écrit (`:968`). **Il n'est remis à zéro nulle part**, ni dans le code, ni dans une migration : la recherche sur tout le dépôt ne rend que sa déclaration, deux lectures et une écriture. Tant que la séance avait un plafond de 8 manches, l'écart entre « par séance » et « à vie » restait borné et invisible. Le plafond ayant disparu, la colonne est devenue un compteur d'erreurs **à vie** portant un nom qui promet le contraire.

Ce qu'il faut savoir avant de trancher, et qui corrige une lecture répandue. **Cette colonne ne pilote rien aujourd'hui.** `adaptive_coef`, qui gouverne les intervalles réels du moteur, est piloté par `consecutive_session_errors` (`provider.ts:952`, seuil à 2), une **autre** colonne, qui est bel et bien remise à zéro à chaque bonne réponse (`:995`, `:1013`). `session_errors` est écrit et **jamais relu pour une décision**. Le risque n'est donc pas un moteur faussé aujourd'hui, il est en aval : la Misread Type Card, explicitement reportée et documentée à `provider.ts:1030-1040`, est spécifiée en §6.1 comme se déclenchant à « la première erreur sur cette face **dans la séance** ». C'est exactement cette colonne qu'elle lira. Implémentée contre un compteur à vie, la carte ne se déclencherait pour ainsi dire jamais.

Ce que la décision engage. Remettre à zéro « au démarrage de session » demande d'écrire sur **toutes** les lignes de pool de l'utilisateur à chaque ouverture, sur une table déjà sérialisée par la tâche 3. Remettre à zéro « à la première apparition de la face dans la séance » demande de savoir ce qu'est une séance pour une ligne qui n'en porte pas la trace. Ne pas remettre à zéro du tout demande de renommer la colonne et de réécrire §6.1. Les trois sont défendables et **ce sont trois pédagogies différentes**, pas trois implémentations d'une même règle. La décision appartient au propriétaire.

**Sur l'outillage, et c'est le risque le plus facile à oublier.** Les cinq gardes créés par les tâches 3 à 7 sont suivis, autonomes et verts depuis une extraction de HEAD, mais **ils ne sont câblés dans aucune chaîne** : `package.json` est interdit de modification tant que la session parallèle n'est pas arbitrée. Concrètement, `npm run quality` ne les appellera pas, une régression future ne sera donc pas attrapée automatiquement, et un lecteur pressé conclura que les règles sont mortes. Deux gardes des tâches 1 et 2 sont déjà dans ce cas, `check-day-keys.mjs` et `check-session-counters.mjs`. Mitigation, à faire dès la fin de la tâche 7 : consigner dans `docs/process/checklist.md` la liste des **sept** scripts non câblés et la commande qui les lance tous, et en faire une tâche de rattrapage explicite, à exécuter dans le même commit que l'arbitrage de la session parallèle.

**Sur l'arbre de travail.** Les 48 fichiers sales de la session parallèle du 2026-07-29 restent sales après ce plan, à quatre exceptions près que la tâche 7 commit. Tant qu'ils sont là, tout `git commit -a`, tout `git add .` et tout `git add -u` sont dangereux : `backups/backfill-2026-07-29-training-sessions-before.json` n'est pas gitignoré, `.gitignore` ne couvrant que `/backups/checkpoints/`, et `check:artifacts` ne le surveille pas. Chaque tâche de ce plan donne sa liste `git add` exacte pour cette raison.

**Sur la migration.** `db/migrations/012_pool_serialisation.sql` est écrite et prouvée sur branche, mais **pas appliquée en production**, comme 008 et les autres avant elle, ce que `check:event-partitions` rappelle à chaque passage. Tant qu'elle ne l'est pas, `try_unlock_if_pool_stuck` n'existe pas côté production et le repli 42883 de la tâche 3 est ce qui tient le comportement actuel. Ce repli est du code temporaire : il devra être retiré une fois la migration appliquée, sinon il masquera un jour une vraie disparition de fonction.
