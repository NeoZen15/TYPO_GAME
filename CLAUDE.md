# Jeux de Typo V2

Expérience d'apprentissage typographique interactive. Next.js 16 (App Router), React 19, Tailwind 4, GSAP, Neon Postgres en serverless.

## Commandes

```bash
npm run dev        # serveur local sur 127.0.0.1:3000 (vide .next/dev au passage)
npm run dev:clean  # idem mais vide tout .next, quand le cache de build est suspect
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run quality    # la porte complète, à passer avant de merger
```

`dev` et `dev:3000` sont identiques, tous deux câblés sur le port 3000.

`npm run quality` enchaîne 40 étapes, énumérées depuis `package.json` et mesurées par exécution le 2026-08-24 (sortie 0) : `lint`, `typecheck`, `check:artifacts`, `check:google-metadata-sync`, `check:rarity-coverage`, `check:compat-bridges`, `check:dev-routes`, `check:runtime-boundaries`, `check:teacher-read-gate`, `check:identity-gate`, `check:copy`, `check:contrast`, `check:starfield`, `check:typography-contract`, `check:license-guard`, `check:font-licenses`, `check:latin-coverage`, `check:adobe-migration`, `check:font-renderable`, `check:session-lifecycle`, `check:session-sweep`, `check:session-convergence`, `check:session-counters`, `check:client-attempt-contract`, `check:event-writers`, `check:competition-integrity`, `check:assigned-integrity`, `check:pool-serialisation`, `check:day-keys`, `check:answer-position`, `check:distractor-ladder`, `check:assigned-contract`, `check:when-window`, `check:mastery-gauge`, `check:recap-view`, `check:legal-docs`, `check:misread-truth`, `check:token-secret`, `check:event-partitions`, puis `build`.

**Plus aucun garde hors de la porte depuis le 2026-08-04** : les 38 fichiers `check-*.mjs` de `scripts/quality` ont tous leur entrée `check:*` et sont tous dans la chaîne. Les sept derniers câblés viennent du plan double démarrage et sont groupés après `check:session-lifecycle`, dans l'ordre du plan, pour qu'un échec se lise comme une famille et non comme un contrôle isolé. Un garde ajouté doit désormais partir avec sa ligne de chaîne dans le même commit : un `package.json` qui nomme un script absent rend l'historique non reconstructible, et personne ne le voit avant le prochain clone.

Huit gardes lisent un module `.ts` directement, donc ils portent `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` (`check:session-lifecycle`, `check:day-keys`, `check:answer-position`, `check:distractor-ladder`, `check:assigned-contract`, `check:when-window`, `check:mastery-gauge` et `check:recap-view`). Le dernier passe en plus par `scripts/typography/alias-loader.mjs`, parce que les adaptateurs de récap importent en `@/` et que Node ne résout pas cet alias seul. C'est la contrepartie assumée : le module qu'ils gardent doit rester sans import de runtime, sinon Node ne peut pas le charger et le garde devient aveugle. Ne **pas** régler cette alerte en posant `"type": "module"` dans `package.json` comme le suggère Node, cela changerait la résolution de modules de tout le projet Next.

**Piège de mesure, à ne pas refaire.** `npm run quality | tail` rend le code de sortie de `tail` et non celui de la porte, zsh n'ayant pas `pipefail` par défaut. Rediriger vers un fichier puis lire `$?`, sinon une porte rouge passe pour verte.

`check:assigned-integrity`, ajouté le 2026-09-10 **avec l'écrivain qu'il garde** et pas six mois après, impose au chemin assigné les six propriétés d'un écrivain : un seul énoncé atomique arbitré par la garde d'ingestion, une soumission qui n'a rien écrit rendue et jamais jetée, des compteurs incrémentés dans l'instruction, la maîtrise touchée seulement sous `update_mastery` et au premier essai, la fenêtre vérifiée à chaque question **et** à chaque réponse, le budget venu du contrat et la face décidée par un jeton signé. Éprouvé sur huit mutations. La huitième a d'abord passé : le besoin `INSERT INTO event_ingestion_guard` restait satisfait par un `..._guard_x`, un préfixe étant toujours inclus dans le nom renommé. Le besoin porte donc sa parenthèse, et c'est la seule façon dont ce genre de trou se montre.

`check:assigned-contract`, ajouté le 2026-09-10, exerce les deux modules purs du chemin assigné sur des contrats synthétiques. Il garde la frontière que rien dans le code ne montre : le **contrat** est commun à la classe, l'**adaptation** joue à l'intérieur (I-25). Une face imposée passe avant tout, la sélection ne sort jamais du contrat, les parts du mix sont servies et un panier vide se redistribue seul, l'adaptation se déplace d'un cran au plus, sans adaptation deux élèves reçoivent la même difficulté, le contrôle et la compétition n'écrivent jamais la maîtrise, et la fenêtre se ferme à l'échéance. Éprouvé sur quatre mutations, il échoue sur les quatre.

`check:when-window`, ajouté le 2026-09-11 avec le calendrier du compositeur, garde une promesse produit avant d'être un type : un exercice dont l'échéance précède l'ouverture n'est faisable par personne. `lib/teacher/when.ts` y répond en **réparant** au lieu de signaler, chaque geste rendant une fenêtre valide, ce qui est la raison pour laquelle aucun message d'erreur n'existe sur l'écran. Ce choix ne tient que tant que les fonctions sont totales, donc elles sont exercées sur un balayage de **15 376 fenêtres** plutôt que relues. Il fige aussi trois décisions faciles à défaire sans le voir : un moment est une **heure murale** et pas un instant (sept jours à travers un changement d'heure font 169 heures réelles et disent toujours la même heure), une échéance encore atteignable ne bouge pas quand l'ouverture bouge, et une échéance posée le jour de l'ouverture veut dire 23 h 59. Éprouvé sur six mutations, il échoue sur les six. La deuxième est d'abord passée : le test de changement d'heure était écrit à 08 h 00, et une implémentation en instants y tombe une heure à côté, donc encore le bon **jour**. Un test de calendrier ne prouve quelque chose qu'écrit près de minuit.

`check:distractor-ladder`, ajouté le 2026-09-10, exerce la vraie fonction de choix des leurres sur des pools synthétiques et vérifie que les quatre crans d'exigence produisent quatre questions différentes. Il garde un défaut mesuré ce jour là : les trois paliers historiques préféraient **tous** les faces les plus proches, donc le palier bas de la spec moteur, « mauvaises réponses très contrastées et issues de catégories différentes », n'existait pas. Un cran accessible ne se fabrique pas en préférant moins la proximité, il se fabrique en la pénalisant. Le garde vérifie aussi que l'entraînement personnel, qui ne passe aucun cran, n'a pas bougé.

`check:identity-gate`, ajouté le 2026-09-10, tient la réponse à « qui demande ». Le nom du cookie d'identité n'est écrit qu'une fois, personne d'autre que `lib/server/current-user.ts` ne le lit, ce qui le pose importe son nom, et le module valide le format avant de rendre une identité. La dérive avait déjà commencé : un module d'identité existait et **quatre lectures directes** s'étaient ajoutées à côté, dont deux avaient perdu la validation en chemin, de sorte qu'un cookie forgé partait dans un cast uuid et rendait 500 au lieu d'un refus propre. Le garde a aussi attrapé les deux routes de démarrage de partie, antérieures, qui lisaient le cookie brut. Éprouvé sur trois mutations.

`check:teacher-read-gate`, ajouté le 2026-09-10, garde l'étanchéité élève / professeur, qui est une promesse produit gelée (invariants I-15, I-16 et I-23). Trois propriétés, toutes lisibles dans le texte : aucun module destiné au professeur ne nomme la table d'état pédagogique personnel **ni n'importe, même au deuxième rang, un module qui la nomme** ; dans `lib/teacher/read-gate.ts`, toute requête est bornée sur `teacher_id` et toute requête qui touche le journal est bornée sur `context = 'teacher_assignment'` ; et la porte est le seul module du monde professeur à parler à la base. Le garde a été éprouvé sur trois mutations, il échoue sur les trois. Il lit du texte, donc il ne prouve pas que le SQL est juste : la preuve par exécution est dans la note du 2026-09-10 de la checklist.

`check:starfield`, ajouté le 2026-09-08, garde une décision de DA plutôt qu'un contrat technique : le champ d'étoiles n'appartient qu'à la constellation du profil, et aucune surface ne se peint en lavis de la couleur de la page, ce remplissage qui ne se lit que s'il y a un ciel derrière. C'est ce second point qui protège vraiment, il a déjà cassé les panneaux de l'espace prof une fois.

Les cinq derniers contrôles avant `build` gardent chacun une règle qui a déjà été enfreinte une fois : ne servir que des licences validées, livrer le texte de la licence dans chaque dossier de `public/fonts` qui héberge une police, ne servir que des polices qui ont l'alphabet latin, refuser de démarrer en production sans `GAME_PROVIDER_SECRET`, et signaler les partitions d'événements manquantes. `check:event-partitions` rappelle à chaque passage que les migrations écrites ne sont pas appliquées, c'est voulu. `check:font-licenses` rappelle de la même façon que PP Frama, la police de marque, n'a toujours pas de licence webfont, et `check:legal-docs` rappelle les informations d'éditeur que seul le propriétaire peut remplir dans `content/legal.ts`.

Certaines sessions lancent une seconde instance sur le port 3002 (`npx next dev --hostname 127.0.0.1 -p 3002`). Vérifier quel port tourne avant de conclure qu'une page est cassée.

**PIÈGE MAJEUR, rencontré trois fois le 2026-08-15 : deux serveurs de dev qui partagent `.next` corrompent le cache Turbopack.** `npm run test:e2e` démarre **son propre serveur sur le port 3000** (`playwright.config.ts`, bloc `webServer`), qui écrit dans le **même** `.next` que l'instance du 3002. Le journal se remplit alors de `Persisting failed: Another write batch or compaction is already active`, puis un thread panique :

```
Failed to restore task data (corrupted database or bug)
Unable to open static sorted file 00000020.sst : No such file or directory
```

**Symptôme trompeur** : certaines routes ne répondent plus du tout, sans erreur, sans journal, pendant que les autres répondent en 30 ms. On croit à un défaut du code, on cherche dans la base, dans les verrous, dans son propre diff. Ce jour là ça a coûté trois diagnostics : `/profile`, `/legal/cgu`, puis `POST /api/training/answer` qui restait en attente indéfiniment.

**Règle** : ne pas lancer la suite pendant qu'un serveur de dev tourne, ou accepter de tout arrêter et de faire `rm -rf .next` (le dossier entier, pas seulement `.next/dev`) avant de relancer. Et devant une route qui pend sans erreur, **lire le journal du serveur avant de soupçonner le code**.

Checks ciblés, selon ce qu'on touche :

- nouvelle route interne : `npm run check:dev-routes`
- pont de compatibilité ajouté ou modifié : `npm run check:compat-bridges`
- déplacement de modules du labo typo : `npm run check:runtime-boundaries`
- nouvelle police ajoutée sous `public/fonts` : `npm run check:font-licenses`. `scripts/mirror_fonts.py` pose déjà le texte de licence en fin de conversion et échoue en nommant le slug s'il ne le trouve pas. Pour un ajout fait à la main : `node scripts/sync-font-licenses.mjs` (instantané google/fonts par défaut, sinon `GOOGLE_FONTS_SNAPSHOT` ou `--snapshot <chemin>`, `--dry-run` disponible)
- avant un commit de stabilisation : `npm run worktree:report`

Outillage du corpus de recherche, à lancer à la main : `npm run profiles:diff`, `profiles:export:dev` et `profiles:metrics:extract` (Node en `--experimental-strip-types` avec un loader d'alias maison, sur des fichiers `.mts`), et `npm run specimens:extract-data`, qui exige l'environnement Python du repo (`./.venv/bin/python`, à créer avant de s'en servir). `npm run safety:checkpoint` déclenche `scripts/safety/create_ui_checkpoint.sh` : c'est un geste délibéré, pas une routine, cohérent avec le fait que `backups/` ne reçoit pas de checkpoints réguliers.

## Tests

Suite end to end Playwright : `tests/e2e/landing.spec.ts`, `training`, `onboarding`, `accessibility`, plus le garde `guard-database.ts`. `testDir` est `./tests/e2e`, le rapporteur est `list` volontairement, pour ne pas écrire de `playwright-report/`.

**`npm run quality` ne lance PAS les tests.** Passer la porte des 27 étapes ne dit donc rien de l'état de la suite, et ce n'est pas théorique : le 2026-08-15, deux specs étaient rouges depuis des jours sans que personne le voie. `landing.spec.ts` attendait encore le sélecteur de modes d'avant la refonte du 2026-08-04, et `training.spec.ts` attendait le compteur `faces mastered` remplacé le matin même. **Lancer la suite après toute modification d'écran**, la porte ne le fera pas à ta place.

```bash
JDT_E2E_ALLOW_PROD=1 npm run test:e2e                                # toute la suite
JDT_E2E_ALLOW_PROD=1 npx playwright test tests/e2e/landing.spec.ts   # un seul fichier
JDT_E2E_ALLOW_PROD=1 npx playwright test -g "fragment du titre"      # un seul test
```

**Pourquoi cet opt-in, et pourquoi ne pas le contourner à la légère.** La suite écrit dans la base pointée par `DATABASE_URL`, qui est aujourd'hui la production. Un passage complet ajoute 1 utilisateur invité, une trentaine de lignes `user_typeface_state`, 1 session jamais terminée et 2 lignes `user_event_fact`. Rien ne distingue ces lignes de celles d'un vrai joueur, et les clés étrangères sont en `ON DELETE RESTRICT` (`db/migrations/003_users_sessions_pool.sql`), donc les retirer impose un ordre précis : `user_event_fact`, `sessions`, `user_typeface_state`, `users`.

Sans `JDT_E2E_ALLOW_PROD=1`, `guard-database.ts` refuse le lancement et `playwright.config.ts` s'abstient même de démarrer le serveur, pour ne pas compiler l'app inutilement.

La voie propre est la même que pour les migrations : pointer `DATABASE_URL` sur une branche Neon jetable dans `.env.local`, puis lancer avec le même opt-in. Playwright ne lit pas `.env.local`, donc une variable absente de ton shell ne dit rien de ce que voit le serveur de dev.

## Frontières du repo

Le repo mélange trois natures de travail. Les garder explicitement séparées est ce qui permet de livrer sans risque. Référence complète : `docs/overview/repo-organization.md`.

**Code produit (runtime).** Tout ce qui est sous `app/`, `components/`, `features/`, `lib/` est considéré comme destiné à la production sauf mention contraire explicite. Les primitives typo produit restent dans `components/typography/*` et `lib/typography/*`.

**Labo typo interne.** Les routes internes vivent uniquement sous `app/dev/*` ou `app/api/dev/*`. Chaque route interne doit importer `isDevRuntime` depuis `@/lib/dev-mode` et échouer en fermé en production. Les composants dev vont dans `components/dev/typography/*`, les builders et runtimes d'export dans `lib/dev/typography/*`.

**Artefacts de recherche.** `data/typography-profiles/` est un corpus versionné, pas un répertoire de brouillon. `data/typography-profiles/tmp/` est réservé aux exports locaux et doit rester non suivi par git. `backups/` est de l'archive de récupération, il ne reçoit pas de nouveaux checkpoints de routine.

La migration du labo typo est terminée : les 15 ponts de compatibilité de `components/typography/*` et `lib/typography/*` n'avaient plus aucun consommateur et ont été supprimés, `check:compat-bridges` garde une liste vide pour qu'un nouveau pont reste un réexport fin et déclaré.

Si un fichier n'appartient clairement ni au produit, ni au labo, ni au corpus versionné, s'arrêter et le classer avant de committer.

**Gel actif :** `features/onboarding/*` est une zone de travail en cours, hors périmètre des refactos de rangement. Ne pas déplacer ces fichiers, ne pas retoucher leurs imports, ne pas repacker leurs dépendances partagées.

## Conventions de code

Noms courts et explicites, qui portent le domaine : `Gate`, `ScrollHint`, `gateCopy` plutôt que des noms génériques. Détail dans `docs/overview/naming.md`.

Structure de dossiers à ne pas bouger :

- `components/blocks` : composants de niveau section
- `components/ui` : atomes réutilisables
- `content` : copie statique centralisée
- `lib` : utilitaires et logique de motion

Le texte de l'interface est centralisé dans `content/copy.ts`. `check:copy` vérifie que la copie déclarée y est bien utilisée, donc ne pas écrire de chaîne en dur dans un composant.

**Deux pièges de ce garde, rencontrés deux fois.** Il cherche **littéralement** `nomDuBloc.clé` dans le code, donc importer la copie sous un alias (`import { xCopy as copy }`) le fait échouer alors que la clé est bien rendue, et il collecte les clés à **toute profondeur**, donc un bloc à clés imbriquées exige de voir `xCopy.title` écrit tel quel, ce qu'un composant qui itère sur des sections ne produit jamais. Écrire la copie **à plat** et importer **sans alias**. C'est ce second piège qui a empêché de centraliser le texte des pages de règles, resté en dur dans `ModeRulesPage.tsx` par arbitrage assumé.

Jaune de marque : `--accent-yellow: #ffd213`, défini dans `app/globals.css`.

Jamais suivis par git : `.DS_Store`, `Thumbs.db`, `backups/checkpoints/`, `data/typography-profiles/tmp/`. `check:artifacts` échoue si l'un d'eux est tracké.

## Base de données

Neon Postgres via `@neondatabase/serverless`. Pas d'ORM : les migrations sont du SQL brut numéroté dans `db/migrations` (`001_user_event_fact.sql` et suivants).

**Quelles migrations sont appliquées, et comment le savoir.** Le fichier le dit dans son bandeau. Une migration non exécutée porte `NON APPLIQUEE` (010, 011, 013 à 017 notamment), une migration passée porte `APPLIQUEE EN PRODUCTION` avec sa date, sa branche et ce qui a été vérifié après coup. **021 (monde scolaire), 022 (trois axes de session) et 023 (demandes d'accès enseignant) sont appliquées en production**, 021 et 022 le 2026-09-10 et 023 le 2026-09-11, sur feu vert explicite du propriétaire, avec un instantané pris avant. Toute nouvelle migration part en `NON APPLIQUEE` et ne change de bandeau que le jour où elle passe.

**Toute migration sur la vraie base demande le feu vert explicite du propriétaire du projet.** Le plugin `neon` permet de créer une branche de base jetable pour tester une migration sans toucher aux données réelles : c'est la voie à privilégier.

## Documentation

`docs/README.md` est le sommaire, rangé par thème. Les entrées à connaître :

- `docs/process/checklist.md` : « Où on en est ». Avancement produit par sujet, confronté à l'état réel du code. **C'est la source de vérité de l'avancement.**
- `docs/game/NIVEAU.rtf` : vision joueur, le pourquoi et le ton (DWIGGINS, l'entraînement du regard). Document de référence textuelle uniquement, les visuels sont sur le site.
- `docs/ui/ui-consistency-contract.md` : contrat de cohérence UI, typo, espacement, casse, thème.
- `docs/ui/motion.md` : règles d'animation et de timing. **Plus aucun garde ne les vérifie depuis le 2026-08-15** : `check:contracts` inspectait `Gate.tsx`, l'ancienne landing, remplacée le 2026-06-07 et supprimée avec lui. Ses 19 contrats décrivaient une page que plus personne ne rendait, donc ils passaient au vert sans rien protéger. Réécrire un garde sur la landing actuelle est un chantier ouvert.
- `docs/typography/typography-system-contract.md` : contrat de référence du système typo.
- `docs/overview/site-system-overview.md` : point d'entrée pour comprendre le système.

`docs/` décrit des comportements durables, des contrats ou des workflows opérateur. Une note temporaire n'y devient pas permanente par défaut.

## Façon de travailler attendue

Ces règles viennent du propriétaire du projet et valent pour tout le travail sur ce repo.

**Consigner l'avancement.** Chaque action, finie ou en cours, se note dans `docs/process/checklist.md` avec une phrase qui explique pourquoi. C'est ce qui évite de se perdre entre deux sessions.

**Pas d'emojis.** Nulle part : ni dans le code, ni dans les docs, ni dans la checklist, ni dans les messages de commit.

**Pas de tiret comme séparateur** dans les textes rédigés. Virgules, deux-points, parenthèses ou phrases séparées à la place.

**La direction artistique appartient au propriétaire du projet, entièrement.** Règle posée le 2026-07-29. Ce qui est de son ressort exclusif : les couleurs et leurs proportions sur une page, les espacements, les tailles, les alignements, les rayons, les ombres, les animations, la typographie visuelle, la hiérarchie graphique, le rythme, l'équilibre des masses, l'identité de marque, et plus généralement toute décision esthétique. On peut signaler un problème ou proposer une piste, on ne la valide jamais et on ne l'implémente jamais sans son accord explicite.

Ce qui reste ouvert sans accord préalable : penser l'interface sous un angle **fonctionnel et systémique**. Organisation, parcours, hiérarchie de l'information, incohérences UX, proposition d'un composant ou d'un comportement qui améliore le produit.

**Référence en cas de doute.** Quand une décision visuelle est déjà prise et qu'il s'agit de la retrouver, la landing tranche. Les règles qu'elle porte sont consignées dans `docs/ui/ui-consistency-contract.md`, autorité documentaire unique en matière de DA.

**Pas de captures d'écran de vérification.** Le propriétaire regarde le site en live. Vérifier autrement : `typecheck`, `curl`, inspection du code, ou pilotage du navigateur via le plugin `playwright`.

**Décider et avancer.** Ne pas demander validation à chaque étape. Faire le travail, puis montrer le résultat. Les seules exceptions sont les migrations en base et tout ce qui touche à la DA.
