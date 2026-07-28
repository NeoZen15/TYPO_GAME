# Croissance du pool actif (I-07 et fallback §4.5)

## Le problème

Le pool actif d'un joueur restait GELÉ à son seed initial. Aucune nouvelle
typographie n'entrait jamais, ce qui contredit directement l'invariant I-07 :
une nouvelle typo doit entrer dans le pool actif dès que 3 typographies
différentes atteignent mastery_level 4, une seule à la fois.

Cause racine : l'implémentation était incomplète. Il manquait le compteur au
niveau utilisateur (spec §7.2 : `user_profile.pending_unlock_count`), la fonction
de sélection d'une nouvelle typo (spec §7.2), et le câblage applicatif du
déclencheur I-07 ainsi que du fallback §4.5. Le catalogue n'est pourtant pas le
frein : un utilisateur de niveau N dispose de plusieurs centaines de candidates
(vérifié en lecture seule : 746 typos tier N common actives, 724 candidates
réelles pour un pool déjà rempli à 30).

## Table concernée

La spec parle de `user_profile`. Dans ce schéma, la ligne au niveau utilisateur
vit dans la table `users` (colonnes `dreyfus_level`, `global_q_index`, etc.).
C'est donc `users` qui reçoit `pending_unlock_count`. La colonne cible des états
par typo est `user_typeface_state`, avec `next_due_after_q` (et non
`next_due_at_q` comme le nomme le doc de spec) et la contrainte unique
`(user_id, typeface_slug)`.

## Ce que fait la migration 008

Fichier : `db/migrations/008_pool_growth.sql`. Idempotente (ADD COLUMN IF NOT
EXISTS, ADD VALUE IF NOT EXISTS, CREATE OR REPLACE FUNCTION). Elle :

1. Ajoute `pending_unlock_count int NOT NULL DEFAULT 0` (avec CHECK >= 0) à la
   table `users`.
2. Ajoute deux valeurs à l'enum `app.event_type_enum` :
   `pool_recovered_by_unlock` et `pool_recovered_by_cursor_jump`
   (`pool_unlocked` existe déjà depuis 001b). Ce sont les cibles de log du
   fallback §4.5 (events spec §10.1).
3. Crée `try_unlock_one_typeface(p_user_id uuid) RETURNS text` : sélection §7.2
   à la lettre. Exclut les typos déjà présentes dans l'état de l'utilisateur
   (sur ensemble de « in_active_pool = TRUE », identique sous I-06), exclut
   `activation_status = FALSE`, filtre `dreyfus_tier <= niveau Dreyfus`, filtre
   `rarity_tag` selon la table de compatibilité (N : common ; D : +uncommon ;
   C, A, E : +rare), choisit la `sub_category` la moins représentée dans le pool
   actif courant, départage par rarity_tag (common, uncommon, rare) puis
   dreyfus_tier (N, D, C, A, E) puis random(). Ajoute UNE SEULE typo via
   INSERT ... ON CONFLICT DO NOTHING (mastery_level 0, next_due_after_q 0,
   in_active_pool TRUE). Retourne le slug ajouté, ou NULL.
4. Crée `register_mastery_unlock(p_user_id uuid) RETURNS text` : incrémente
   `pending_unlock_count` ; au 3e passage (seuil POOL_UNLOCK_THRESHOLD) tente
   `try_unlock_one_typeface` et, si une typo a été introduite, remet le compteur
   à 0 (reset après introduction). Retourne le slug introduit, sinon NULL. Le
   compteur et l'unlock restent ainsi atomiques côté base, l'appel applicatif
   devient un unique appel sûr.

## Add only, respect de I-06

La migration est STRICTEMENT ADDITIVE : uniquement des INSERT ... ON CONFLICT
DO NOTHING. Aucun DELETE, aucun passage de `in_active_pool` de TRUE à FALSE.
Une typographie n'est jamais retirée du pool ni du système (I-06). Une entrée
au pool ne fait que passer `in_active_pool` de FALSE à TRUE sur une ligne
nouvellement insérée.

## Câblage applicatif

Fichier : `lib/game/training/provider.ts`. Tous les appels base sont FAIL SAFE
(try/catch, `console.warn`, jamais de throw) : tant que 008 n'est pas appliquée,
les fonctions manquent, les appels sont de simples no op, et le training
continue de fonctionner à l'identique.

Déclencheur I-07 (dans `submitTrainingAnswer`) : dans la branche
`correctFirstTry`, juste après l'UPDATE de l'état, on détecte le PREMIER
franchissement vers mastery 4 par la condition
`currentState.mastery_level === 3 && nextMastery === 4`. Seul `correct_first_try`
peut franchir (le `correct_after_error` ne porte pas de +1), et une typo déjà à
4 y reste (min(4, 5) = 4) donc sans franchissement : c'est ce qui évite de
recompter les bonnes réponses répétées à 4. Sur franchissement, on appelle
`registerMasteryUnlock` (helper provider) qui appelle
`register_mastery_unlock` en base et logue `pool_unlocked` si une typo est
introduite.

Fallback §4.5 (chemin de SÉLECTION) : le helper `recoverPoolIfStuck` est appelé
avant chaque construction de question, aux deux points de sélection
(`startTrainingSession` et `submitTrainingAnswer`). S'il existe au moins un item
éligible (`next_due_after_q <= global_q_index`), c'est un no op. Sinon :

1. Il tente `try_unlock_one_typeface` (unlock silencieux) ; la nouvelle typo
   entre avec `next_due_after_q = 0` donc immédiatement éligible. Log
   `pool_recovered_by_unlock`.
2. Si aucun candidat injectable, `recoverByCursorJump` avance le curseur du
   scheduler (`users.global_q_index`) jusqu'au plus petit `next_due_after_q` du
   pool, rendant l'item le moins en retard éligible. Log
   `pool_recovered_by_cursor_jump`.

I-01 et I-02 ne sont jamais assouplis : on déplace le curseur pour satisfaire le
cooldown, on ne raccourcit jamais le cooldown lui même. La reprise est invisible
côté joueur.

## Note de fidélité

Le compteur repose sur le franchissement (chaque premier passage 3 vers 4). Une
typo qui redescend de 4 puis re franchit sera recomptée : lecture raisonnable de
« atteint mastery 4 », conforme au design de compteur demandé. Les payloads
détaillés de la spec (trigger_count, from_q, to_q) ne sont pas persistés car
`user_event_fact` n'a pas de colonne JSONB de payload ; seuls `event_type`,
`typeface_slug` et `global_q_index` sont écrits (aucune colonne ajoutée à la
table de faits, choix volontairement minimal).

## État : 008 n'est PAS encore appliquée

La migration est écrite mais non appliquée (consigne : pas d'apply, pas de
mutation en base). Tant qu'elle n'est pas appliquée, le training tourne
normalement (les appels sont fail safe). Commande d'application (à lancer
manuellement, hors de cette session) :

```
node --input-type=module <<'EOF'
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
const line = readFileSync(".env.local","utf8").split("\n").find(l => l.startsWith("DATABASE_URL="));
const url = line.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g,"");
await neon(url).query(readFileSync("db/migrations/008_pool_growth.sql","utf8"));
console.log("APPLIED 008");
EOF
```

## Vérification

Avant apply (lecture seule) : la sélection §7.2 a été validée en preview sur un
utilisateur réel (724 candidates, diversification par sub_category la moins
représentée, aucune erreur SQL).

Après apply :

1. `pending_unlock_count` existe :
   `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='pending_unlock_count';`
2. Les fonctions existent :
   `SELECT proname FROM pg_proc WHERE proname IN ('try_unlock_one_typeface','register_mastery_unlock');`
3. Unlock à sec (lecture, sans écrire) : `SELECT try_unlock_one_typeface('<user_id>'::uuid);` insère UNE typo ; comparer le pool avant/après avec
   `SELECT count(*) FROM user_typeface_state WHERE user_id='<user_id>'::uuid AND in_active_pool=true;`
4. En jeu : amener 3 typos différentes à mastery 4 (bonnes réponses successives)
   et vérifier qu'une 31e typo apparaît dans le pool, avec un event
   `pool_unlocked` dans `user_event_fact`.
5. Never stuck : forcer tous les `next_due_after_q` du pool au delà du
   `global_q_index` et vérifier qu'une question valide est tout de même servie
   (event `pool_recovered_by_unlock` ou `pool_recovered_by_cursor_jump`).
