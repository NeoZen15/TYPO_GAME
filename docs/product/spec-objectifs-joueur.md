# Spécification produit — les objectifs du joueur

**Rang 4, ouverte sur trois décisions** (section 10). Applique la vision (`game/vision-produit-dwiggins.md`, I-17, I-26, I-27), la spec moteur (`game/training-engine-spec-v2-clean.md`), l'architecture backend (`game/architecture-backend.md` §2.2) et la méthode de recommandation de `spec-creation-exercice.md` §4, dont elle est le versant joueur. Ne redéfinit rien au dessus d'elle.

Écrit le 2026-09-23, sur décision du propriétaire le même jour (approche A, sur trois étudiées, section 9). Tout ce qui est affirmé sur l'existant a été mesuré dans le code, pas supposé.

---

## 1. Le principe

La carte du profil dit au joueur où il en est et ce qui reste éteint. Elle ne lui dit jamais **quoi faire maintenant**. Laissé seul avec sa carte, il ne revient pas. Le but de cette brique est qu'il reste : lui donner, à chaque visite, plusieurs raisons de rejouer, et le laisser choisir la sienne.

Trois objectifs, **toujours visibles ensemble** sur l'onglet Path, dans cet ordre : **Allumer** la prochaine étape de sa carte, **Corriger** ce qui le piège, la **Mission du jour**. Chacun porte un bouton, et le bouton lance vraiment ce que la carte promet.

Ce que ce n'est pas, parce que c'est vers là que ça glisse tout seul :

- **Pas un devoir.** Un objectif n'est pas un contrat stocké, n'a pas d'échéance, ne compte pas de questions et ne passe pas par la porte des assignations (section 9 dit pourquoi).
- **Pas un second moteur.** Un seul moteur, celui de l'entraînement libre, qui nourrit déjà la carte. On lui ajoute une consigne d'orientation, rien d'autre.
- **Pas une donnée.** Les objectifs se **calculent à la lecture**, jamais stockés, comme les recommandations du professeur (`spec-creation-exercice.md` §4). Seule la consigne choisie est notée sur la séance, pour mesurer (section 5).

---

## 2. Les trois objectifs

| Objectif | Ce que dit la carte | Comment il est choisi | Ce que lance le bouton | Quand il change |
|---|---|---|---|---|
| **Allumer** | le nom de l'étape, où en est le joueur (faces installées sur 5, justesse) | l'étape calculable la plus proche du seuil (section 3) | une séance orientée vers les faces de cette étape | dès que la carte a bougé |
| **Corriger** | la paire la plus confondue, et le nombre de paires retenues | les paires demandé / répondu les plus fréquentes (section 3) | une séance orientée vers ces faces, la jumelle servie en leurre | dès que l'historique a bougé |
| **Mission du jour** | la cible du jour et le compte (fait / cible) | fixe : N bonnes réponses aujourd'hui | une séance ordinaire | à minuit, heure de Paris |

**Une seule règle pour les trois : la carte ne promet que ce que le bouton tient.** La Mission du jour n'a pas de consigne d'orientation, donc elle n'annonce aucune police. Les deux autres n'annoncent une étape ou des polices que si la séance peut vraiment les servir (section 4).

---

## 3. Le choix

Un module pur, sans lecture d'exécution, comme `lib/game/assigned/contract.ts`. Il reçoit des données et rend trois objectifs. Il est exercé par un garde sur des profils inventés (section 8).

**Ses sources, et rien d'autre (I-27).** Les deux lectures que `buildEye` fait déjà (`lib/profile/profile-stats.ts`) : les réponses par face, l'état de maîtrise par face. Plus les paires confondues : dans `user_event_fact`, les réponses fausses avec la face demandée et la face choisie. Plus les attributs du catalogue. **Jamais** `assignments`, `assignment_recipients`, ni aucune donnée de classe : un joueur sans école reçoit exactement les mêmes objectifs qu'un élève, calculés de la même façon.

**Allumer.** Parmi les étapes **calculables** (celles qui ont un prédicat dans `lib/profile/palier-taxonomy.ts`, huit aujourd'hui : 2.1 à 2.6, 3.1, 3.2), on ne retient que celles dont **au moins cinq faces sont dans le pool actif du joueur** : une consigne ne peut orienter que vers ce que le pool contient (section 4). Parmi celles-là, la première **émergente** dans l'ordre suivant : le moins de faces manquantes pour atteindre les cinq installées, puis le plus petit écart de justesse au seuil de 0,8, puis l'ordre canonique. S'il n'y a aucune émergente : la première **dormante** calculable, dans l'ordre canonique. Si tout est allumé : l'étape allumée dont les faces ont le plus de révisions dues, et la carte dit « entretenir » au lieu d'« allumer ». Une étape dormante non calculable n'est **jamais** proposée : la carte ne promet pas une mécanique qui n'existe pas.

**Corriger.** Les paires de faces confondues, comptées sur tout l'historique personnel. **Une paire n'a pas de sens** : demander Helvetica et répondre Arial, ou l'inverse, c'est la même confusion, les deux sens s'additionnent et la paire s'affiche dans son sens le plus fréquent. **Au moins deux occurrences** pour compter. Les trois paires les plus fréquentes, les deux faces de chaque paire, soit six faces au plus, restreintes aux faces actives du catalogue. S'il n'y a aucune paire qui compte, la carte le dit en une ligne (« nothing to fix yet »), son bouton lance une séance ordinaire, et elle n'annonce aucune police.

**Mission du jour.** La cible est fixe, **N bonnes réponses dans la journée**, jour calendaire Europe/Paris, les clés de jour de `lib/profile/day-keys.ts`. Le compte lit les réponses `is_correct` du jour en **contexte `personal` seulement** : un devoir fait en classe ne remplit pas la mission personnelle, le mur est à sens unique dans les deux sens. La valeur de N est la décision 1 (section 10) ; par défaut **15**, la valeur que porte déjà `project-onboarding-2026-07-30.md`. Une fois la cible atteinte, la carte le dit et son bouton reste : la séance ne s'arrête jamais sur un compteur (I-17), la mission non plus.

---

## 4. La consigne d'orientation

Le démarrage d'une séance d'entraînement (`TrainingStartInput`, `lib/game/training/contracts.ts`) reçoit un champ **optionnel** `focus` :

- `{ kind: "palier", id: "2.6" }` : privilégier les faces qui vérifient le prédicat de l'étape ;
- `{ kind: "faces", slugs: [...] }` : privilégier ces faces, deux à six ;
- absent : la séance d'aujourd'hui, inchangée.

**Une orientation, jamais une restriction.** La consigne réordonne les candidates, elle n'en ajoute et n'en retire aucune. Concrètement, dans `pickEligibleTypeface` (`lib/game/training/question-shape.ts`), parmi les faces **dues** du pool, celles qui répondent à la consigne passent devant ; le reste du tri (échéance, maîtrise, difficulté, rareté, graine) demeure. Si aucune face due ne répond à la consigne, la sélection est celle d'aujourd'hui. Pour `faces`, les leurres privilégient la face jumelle de la paire quand elle est dans le pool : c'est tout l'objet de Corriger.

Ce qui ne bouge pas, et c'est ce qui rend l'approche sûre :

- `context = 'personal'`, `progression_policy = 'update_mastery'`, `assignment_id` nul ;
- `in_active_pool` n'est **jamais** touché par une consigne ; la croissance du pool reste celle de `try_unlock_one_typeface` ;
- les fenêtres d'intervalle, les cooldowns, les invariants I-01 à I-14 ;
- la séance n'a pas de longueur (I-17).

Conséquence assumée : une consigne ne peut orienter que vers ce que le pool actif contient déjà. C'est pour cela que la section 3 exige cinq faces de l'étape dans le pool avant de la proposer.

---

## 5. La trace, pour mesurer

Le but est la rétention, donc il faut pouvoir répondre à « les objectifs font ils rejouer ». **Décision 2** (section 10) : ajouter à `sessions` une colonne `focus jsonb` nulle par défaut, posée au démarrage, jamais relue par le jeu. Une migration courte, rejouable, avec retour arrière. Sans elle, on construit et on ne saura pas.

---

## 6. La surface

Sur l'onglet **Path**, sous la carte du professeur quand il y en a une (`AssignedBand`), à sa place sinon. Un élève voit donc le devoir puis ses trois objectifs ; un joueur sans école voit ses trois objectifs. Même gabarit que la carte du professeur : le panneau du système, une rangée par objectif, la puce de mode, le titre, une ligne de méta, le bouton **Play it**. Pas de compte à rebours, pas de date.

Ce que dit chaque rangée, à titre de proposition, jugée à l'écran et non sur papier :

| Objectif | Titre | Méta |
|---|---|---|
| Allumer | le libellé de l'étape (« Sans class ») | « step 2.6 · 3 of 5 faces settled · 74% right » |
| Corriger | la paire de tête (« Helvetica vs Arial ») | « confused 6 times · 3 pairs » |
| Mission du jour | « 15 right answers today » | « 9 of 15 » |

Règles héritées, non négociables : l'état se dit **en mots, jamais en couleur** (rouge et vert appartiennent au jeu) ; une étape **ne nomme jamais une police** (les paires de Corriger en nomment, ce ne sont pas des étapes) ; aucune direction artistique propre, tout vient du système de planches ; les textes vivent dans `content/copy.ts` et passent `check:copy`.

Le bouton **Play it** pointe vers `/game` avec la consigne. La forme exacte du passage (paramètre d'URL lu par `GameScreen`, ou stockage de session) se tranche à la construction, avec une contrainte : la consigne doit arriver **intacte au serveur** au démarrage, et une consigne mal formée est ignorée, jamais refusée. Aujourd'hui `/game` ne lit que `?preview=complete`.

---

## 7. Ce qui est hors périmètre, et pourquoi

- **Le bilan de fin de séance** (`SessionRecap`) liste déjà « what you confused » sans lien. C'est le meilleur moment pour proposer Corriger, avec la **même** consigne. Pas dans cette tranche : une fois la consigne construite, c'est un lien.
- **Les étapes de la constellation** pourraient porter le même bouton. Même remarque.
- **Les étapes non calculables** (3.3 et au delà, galaxies 4 à 8) attendent la vraie taxonomie pédagogique. Cette spec ne l'écrit pas.
- **La carte du professeur en maquette** : son bouton pointe aujourd'hui vers un identifiant de maquette (`e1`) que le moteur convertit en uuid et refuse ; d'après le code, la route répond 500. Défaut à part, à réparer à part.

---

## 8. Les contrôles

Ce projet ne garde rien hors de la porte (`npm run quality`). Ce que cette brique y ajoute :

1. **`check:objectives`** exerce le module de choix sur quatre profils inventés : joueur neuf (rien joué), joueur du milieu (une étape émergente, deux paires confondues), joueur tout allumé, joueur sans aucune confusion qui compte. Il vérifie qu'aucun objectif ne nomme une étape non calculable, qu'Allumer ne propose qu'une étape avec cinq faces dans le pool, que Corriger exige deux occurrences, et que la mission compte le seul contexte `personal`.
2. **`check:focus-bias`** exerce `pickEligibleTypeface` avec et sans consigne, et prouve que la consigne réordonne sans jamais ajouter ni retirer une candidate, et qu'elle est nulle quand aucune face due n'y répond.
3. **`check:copy`** pour les textes, **`check:etat`** après la mise à jour de « Où on en est ».
4. **Preuve en base** avant tout commit final : sur une branche Neon jetable, ouvrir une séance avec consigne, répondre, relire la carte, voir le compte bouger. Jamais sur la production.

---

## 9. Les trois approches étudiées, et le choix

**A, retenue : orienter l'entraînement normal.** Un moteur, une consigne, trois cartes calculées. La carte nourrit et la séance nourrit la carte, comme aujourd'hui.

**B, rejetée : passer par la porte des assignations.** Elle exige une vraie classe et un vrai professeur (clés étrangères de `assignments`), étiquette la séance `teacher_assignment` (contrainte de la migration 022) et écrit la maîtrise avec `in_active_pool = false`, ce qui **interdit ensuite à ces faces d'entrer dans le pool personnel** (`try_unlock_one_typeface`). On casserait le mur (I-25) et on abîmerait la carte du joueur pour économiser une consigne.

**C, écartée : les cartes sans moteur.** Trois cartes et un bouton vers l'entraînement ordinaire. Deux heures, mais le bouton ne tient pas sa promesse, le défaut exact que le bandeau du professeur a corrigé le 2026-09-10. Seule la Mission du jour y est honnête, et elle est de toute façon la première tranche de A.

---

## 10. Les décisions qui restent au propriétaire

1. **La cible de la Mission du jour.** Défaut proposé : 15 bonnes réponses.
2. **La trace sur la séance** (section 5) : une migration 026 courte, sur feu vert, ou rien pour l'instant et on ne mesure pas.
3. **La direction artistique de la carte** : le gabarit du professeur est repris tel quel ; toute variation (ordre des rangées, mots des titres, puce) se juge à l'écran.

---

## 11. Ordre de construction

| Tranche | Contenu | Preuve | Durée |
|---|---|---|---|
| 1 | le module de choix et `check:objectives` | garde vert sur les quatre profils | 3 h |
| 2 | la consigne dans le moteur et `check:focus-bias` | garde vert, séance ouverte sur branche jetable | 3 h |
| 3 | la carte, les textes, le passage de la consigne à `/game` | `check:copy`, carte vue sur `localhost:3002/profile` | 1 h 30 |
| 4 | la migration 026 si décision 2 est oui | testée sur branche, retour arrière rejoué | 1 h |

Une journée. La tranche 1 peut partir sans les décisions ; la 3 attend la décision 1 ; la 4 attend la décision 2.

**Tranche 2 faite le 2026-09-24.** Le démarrage accepte `focus`, validé par `normalizeFocus` (`lib/game/training/focus.ts`, module pur réexporté par `contracts.ts`) : une consigne mal formée vaut `null`, jamais un refus. `pickEligibleTypeface` fait passer devant les faces **dues** qui répondent à la consigne, et seulement elles ; `pickDistractors` donne un bonus aux faces de Corriger, jamais à une jumelle. La consigne voyage dans le **jeton de question signé** (champ optionnel `focus`), relue du jeton vérifié à chaque réponse, doublons compris : aucune écriture en base. `check:focus-bias` le garde, éprouvé sur six mutations, toutes attrapées ; la sixième (bonus donné aux jumelles) est d'abord passée, parce que `withoutTwins` les retire déjà quand il reste trois leurres propres, et le garde exerce désormais le repli où il n'en reste que deux. **Limite connue** : la ligne de séance ne garde pas la consigne, donc une séance **rejointe** (rechargement, même identifiant de tentative) repart avec ce que le client renvoie, et sans consigne s'il ne renvoie rien. La colonne `sessions.focus` de la tranche 4 la lèverait. La preuve sur branche Neon jetable prévue au tableau n'est **pas** faite : cette tranche a été construite sans accès à la base, elle reste à jouer avant la mise en ligne.

**Tranche 3 faite le 2026-09-25, sur la branche `objectifs-tranche3`, en attente de fusion.** Les lectures vivent dans `lib/profile/objectives-data.ts` (`loadObjectives`), à côté de `profile-stats.ts` et sans le toucher : paires confondues en premier essai, contexte `personal` ; bonnes réponses du jour, même jour de Paris que l'objectif quotidien du profil ; pool actif avec les quatre filtres de `getPoolRows` et l'échéance contre `users.global_q_index`, chaque face rangée dans ses étapes par `PALIER_TAXONOMY` ; les noms des seules faces des paires retenues. Les étapes viennent de l'œil que la page vient de calculer, donc la carte et les objectifs parlent des mêmes. Une erreur de lecture rend `null`, journalise le nom et le code de l'erreur sans son message, et la page s'affiche sans le bandeau. `ObjectivesBand` pose les trois rangées sous `AssignedBand`, avec le panneau, la puce, la liste `st-rows` et le bouton du système ; ses colonnes sont celles de `DEVOIR_CSS`, moins la colonne du compte à rebours. Les textes sont dans `objectivesCopy`. Le bouton passe la consigne par `?focus=` (`palier:2.6`, `faces:a,b`), écrit par `focusToParam` et relu par `parseFocusParam` dans `GameScreen`, qui l'envoie au seul démarrage de la séance ouverte par la page : la fin de cette séance et « Play again » la retirent, paramètre d'URL compris, donc recharger le récapitulatif n'ouvre pas une nouvelle séance avec la consigne. `check:focus-bias` prouve l'aller retour et qu'un paramètre mal formé vaut `null`. Deux choix à revoir à l'écran : la puce porte le nom de l'objectif (Light, Keep lit, Fix, Daily) dans l'accent de l'entraînement, et le panneau porte un titre, « What to play now ».

**Ce qui reste.** La décision 1 (la tranche 3 est partie avec la cible par défaut, 15) ; la relecture de direction artistique par le propriétaire, carte vue sur `localhost:3002/profile` (décision 3) ; la décision 2 et la tranche 4 qui en dépend ; la preuve sur branche jetable des tranches 2 et 3.
