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

`npm run quality` enchaîne 15 étapes, vérifiées dans `package.json` le 2026-07-28 : `lint`, `typecheck`, `check:artifacts`, `check:compat-bridges`, `check:dev-routes`, `check:runtime-boundaries`, `check:copy`, `check:contracts`, `check:typography-contract`, `check:license-guard`, `check:font-licenses`, `check:latin-coverage`, `check:token-secret`, `check:event-partitions`, puis `build`.

Les cinq derniers contrôles avant `build` gardent chacun une règle qui a déjà été enfreinte une fois : ne servir que des licences validées, livrer le texte de la licence dans chaque dossier de `public/fonts` qui héberge une police, ne servir que des polices qui ont l'alphabet latin, refuser de démarrer en production sans `GAME_PROVIDER_SECRET`, et signaler les partitions d'événements manquantes. `check:event-partitions` rappelle à chaque passage que les migrations écrites ne sont pas appliquées, c'est voulu. `check:font-licenses` rappelle de la même façon que PP Frama, la police de marque, n'a toujours pas de licence webfont.

Certaines sessions lancent une seconde instance sur le port 3002 (`npx next dev --hostname 127.0.0.1 -p 3002`). Vérifier quel port tourne avant de conclure qu'une page est cassée.

Checks ciblés, selon ce qu'on touche :

- nouvelle route interne : `npm run check:dev-routes`
- pont de compatibilité ajouté ou modifié : `npm run check:compat-bridges`
- déplacement de modules du labo typo : `npm run check:runtime-boundaries`
- nouvelle police ajoutée sous `public/fonts` : `npm run check:font-licenses`. `scripts/mirror_fonts.py` pose déjà le texte de licence en fin de conversion et échoue en nommant le slug s'il ne le trouve pas. Pour un ajout fait à la main : `node scripts/sync-font-licenses.mjs` (instantané google/fonts par défaut, sinon `GOOGLE_FONTS_SNAPSHOT` ou `--snapshot <chemin>`, `--dry-run` disponible)
- avant un commit de stabilisation : `npm run worktree:report`

Outillage du corpus de recherche, à lancer à la main : `npm run profiles:diff`, `profiles:export:dev` et `profiles:metrics:extract` (Node en `--experimental-strip-types` avec un loader d'alias maison, sur des fichiers `.mts`), et `npm run specimens:extract-data`, qui exige l'environnement Python du repo (`./.venv/bin/python`, à créer avant de s'en servir). `npm run safety:checkpoint` déclenche `scripts/safety/create_ui_checkpoint.sh` : c'est un geste délibéré, pas une routine, cohérent avec le fait que `backups/` ne reçoit pas de checkpoints réguliers.

## Tests

Suite end to end Playwright : `tests/e2e/landing.spec.ts`, `training`, `onboarding`, `accessibility`, plus le garde `guard-database.ts`. `testDir` est `./tests/e2e`, le rapporteur est `list` volontairement, pour ne pas écrire de `playwright-report/`.

**`npm run quality` ne lance PAS les tests.** Passer la porte des 15 étapes ne dit donc rien de l'état de la suite.

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

Jaune de marque : `--accent-yellow: #ffd213`, défini dans `app/globals.css`.

Jamais suivis par git : `.DS_Store`, `Thumbs.db`, `backups/checkpoints/`, `data/typography-profiles/tmp/`. `check:artifacts` échoue si l'un d'eux est tracké.

## Base de données

Neon Postgres via `@neondatabase/serverless`. Pas d'ORM : les migrations sont du SQL brut numéroté dans `db/migrations` (`001_user_event_fact.sql` et suivants).

**Toute migration sur la vraie base demande le feu vert explicite du propriétaire du projet.** Le plugin `neon` permet de créer une branche de base jetable pour tester une migration sans toucher aux données réelles : c'est la voie à privilégier.

## Documentation

`docs/README.md` est le sommaire, rangé par thème. Les entrées à connaître :

- `docs/process/checklist.md` : « Où on en est ». Avancement produit par sujet, confronté à l'état réel du code. **C'est la source de vérité de l'avancement.**
- `docs/game/NIVEAU.rtf` : vision joueur, le pourquoi et le ton (DWIGGINS, l'entraînement du regard). Document de référence textuelle uniquement, les visuels sont sur le site.
- `docs/ui/ui-consistency-contract.md` : contrat de cohérence UI, typo, espacement, casse, thème.
- `docs/ui/motion.md` : règles d'animation et de timing. `check:contracts` vérifie le contrat de motion sur `Gate.tsx`.
- `docs/typography/typography-system-contract.md` : contrat de référence du système typo.
- `docs/overview/site-system-overview.md` : point d'entrée pour comprendre le système.

`docs/` décrit des comportements durables, des contrats ou des workflows opérateur. Une note temporaire n'y devient pas permanente par défaut.

## Façon de travailler attendue

Ces règles viennent du propriétaire du projet et valent pour tout le travail sur ce repo.

**Consigner l'avancement.** Chaque action, finie ou en cours, se note dans `docs/process/checklist.md` avec une phrase qui explique pourquoi. C'est ce qui évite de se perdre entre deux sessions.

**Pas d'emojis.** Nulle part : ni dans le code, ni dans les docs, ni dans la checklist, ni dans les messages de commit.

**Pas de tiret comme séparateur** dans les textes rédigés. Virgules, deux-points, parenthèses ou phrases séparées à la place.

**Référence direction artistique.** En cas de doute sur la DA, se référer à la landing, la page principale du site en local. C'est elle qui tranche.

**Pas de captures d'écran de vérification.** Le propriétaire regarde le site en live. Vérifier autrement : `typecheck`, `curl`, inspection du code, ou pilotage du navigateur via le plugin `playwright`.

**Décider et avancer.** Ne pas demander validation à chaque étape. Faire le travail, puis montrer le résultat. Les seules exceptions sont les migrations en base et tout ce qui touche à la DA.
