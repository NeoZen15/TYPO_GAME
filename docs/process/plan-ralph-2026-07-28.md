# Plan de travail Ralph, 2026-07-28

> **Pour l'agent qui exécute** : ce plan est fait pour la boucle autonome `ralph` installée sur cette machine (`~/.local/bin/ralph`, qui délègue à `~/.ralph/ralph_loop.sh`). Une boucle égale une tâche. Chaque tâche se termine par une COMMANDE de preuve, dont la sortie décide si la case se coche. Aucune case ne se coche sur une impression.

**Objectif** : donner à Ralph une file de tâches mécaniques et prouvables par commande, qui font avancer « jeux de typo » sans jamais toucher à la direction artistique, aux pages compare, à la vraie base, ni aux zones de travail en cours du propriétaire.

**Architecture réelle de la boucle** (vérifiée dans `~/.ralph/ralph_loop.sh`, pas supposée) :

- Ralph pipe le contenu de `.ralph/PROMPT.md` dans le CLI `claude`, une fois par boucle, avec un timeout par boucle (`CLAUDE_TIMEOUT_MINUTES`, 15 par défaut).
- Il lit `.ralph/fix_plan.md` et compte les lignes `- [ ]` et `- [x]` (motif `^[[:space:]]*- \[ \]`). Quand il ne reste plus d'item non coché hors sections optionnelles, il sort.
- Les sections dont les items non cochés ne bloquent PAS la sortie sont, par défaut : `Optional`, `Future`, `Future Enhancements`, `Nice to Have`. C'est pour cela que `.ralph/fix_plan.md` garde des titres de section en anglais, alors que ce plan est en français : ce sont des mots clés que l'outil parse.
- Ralph attend en fin de réponse un bloc `---RALPH_STATUS---`. Sans ce bloc, son analyseur ne sait pas s'il progresse.
- Disjoncteur : circuit ouvert après 3 boucles sans changement de fichier, ou 5 boucles avec la même erreur.
- Les outils autorisés viennent de `ALLOWED_TOOLS` dans `.ralphrc`. **Le défaut n'autorise que `Bash(npm *)` et `Bash(pytest)` côté shell.** C'est la contrainte qui a façonné ce plan : chaque critère d'acceptation est soit un `npm run …`, soit une commande explicitement ajoutée à l'autorisation en section 0.2.

**Pile technique** : Next.js 16.1.6 (App Router, Turbopack), React 19.2.3, Tailwind 4, GSAP, Neon Postgres via `@neondatabase/serverless` (aucun ORM), Playwright 1.58 (runner embarqué dans le paquet `playwright`, aucune dépendance de test supplémentaire), Node 25.9.

**État de la porte au 2026-07-28, mesuré** : `typecheck` exit 0. Les 8 checks maison exit 0 (`check:license-guard` compte 1172 typos servables). `lint` exit 0 avec 1 avertissement (`PAPER` inutilisé dans `ProgressBoard.tsx:469`). `tests/e2e/landing.spec.ts` : 3 tests verts en 5,1 s. `npm run build` non relancé dans cette session pour ne pas écrire dans `.next` pendant que le propriétaire regarde le site.

---

## Contraintes globales

Elles s'appliquent à toutes les tâches, sans exception, et sont reprises mot pour mot dans `.ralph/PROMPT.md`.

- **`app/compare/*` est hors périmètre.** Aucune modification de ces fichiers, de leur rendu, de leur SEO, de leur DA. Le levier existe, il attend un feu vert (section 5).
- **Aucune décision de direction artistique.** Pas de couleur, pas d'échelle typo, pas d'espacement, pas de copie inventée. Toute question de DA se tranche en regardant la landing en local, avec le propriétaire.
- **Aucune migration jouée sur la vraie base.** Écrire un fichier SQL numéroté dans `db/migrations` est permis. L'exécuter demande le feu vert explicite du propriétaire. Une tâche qui suppose une migration s'arrête au fichier et le dit dans son rapport.
- **`features/onboarding/*` est gelé.** Zone de travail en cours du propriétaire. Ni déplacement, ni refacto de rangement, ni retouche d'imports.
- **`lib/game/training/provider.ts` contient du travail non fini** (migrations 007, 008, 009 câblées en fail safe). Deux tâches y touchent, chacune avec un plafond de diff explicite et vérifiable. _Correction du 2026-07-29 : ces trois migrations **sont appliquées** en base, constaté en lecture seule, donc les appels correspondants ne sont plus des no op. Le garde reste valable, mais la raison n'est plus « code inerte »._
- **Aucune nouvelle dépendance npm.** Tout ce dont ces tâches ont besoin est déjà installé (`fontkit`, `playwright`, `@types/fontkit`).
- **Pas de captures d'écran de vérification.** La preuve est une commande, un `typecheck`, un `curl`, une inspection de code, ou un test Playwright.
- **Zéro emoji, nulle part.** Ni code, ni doc, ni message de commit.
- **Pas de tiret utilisé comme séparateur** dans les textes rédigés. Virgules, deux-points, parenthèses, ou phrases séparées.
- **`docs/process/checklist.md` est interdit à Ralph.** C'est la source de vérité du propriétaire et un autre agent y écrit. Ralph consigne son avancement dans `docs/process/journal-ralph.md`, qu'il crée à sa première boucle, en ajout seulement. Le propriétaire replie ce journal dans la checklist quand il veut.

---

## 0. Pré-vol propriétaire, obligatoire, environ 10 minutes

Ces cinq points ne sont pas du confort. Le premier est un vrai risque de perte de travail.

### 0.1 Ralph a le droit de commiter, et il est sur `main`

Au moment de l'audit, `git status --porcelain` renvoyait 68 entrées non commitées sur `main`, dont `lib/game/training/provider.ts`, `features/onboarding/*` et `app/globals.css`. Elles ont été commitées pendant la rédaction de ce plan (commit `fc369dd`, « feat(training): owner's in-progress engine and onboarding rework »). L'arbre ne porte plus, à cette heure, qu'une seule modification en cours : `docs/process/checklist.md`, éditée en parallèle.

Le risque reste entier pour deux raisons. L'autorisation Ralph par défaut contient `Bash(git add *)` et `Bash(git commit *)`, et le `PROMPT.md` livré avec l'outil dit littéralement « Commit working changes with descriptive messages ». Donc Ralph commitera, et un `git add -A` emporterait la modification en cours de la checklist dans un commit qu'il aurait signé. Et la branche courante est `main`.

Deux gestes du propriétaire, dans cet ordre :

```bash
# 1. Verifier ce qui traine encore, et le traiter (commit ou stash, a son choix)
git status --porcelain

# 2. Travailler sur une branche dediee, jamais sur main
git switch -c ralph/2026-07-28
```

Le `PROMPT.md` de la section 0.3 ordonne à Ralph de commiter par chemins explicites, jamais avec `git add -A`, et de ne jamais toucher `docs/process/checklist.md`.

**Ne pas lancer Ralph dans un git worktree.** Le hook de typecheck automatique vit dans `.claude/settings.local.json`, non suivi par git : un worktree neuf ne l'aurait pas. Ce hook lance `npm run typecheck` après chaque `Write` ou `Edit` de `.ts` ou `.tsx`, en asynchrone avec réveil sur échec. C'est un filet gratuit pour Ralph, il faut rester dans ce répertoire de travail.

### 0.2 `.ralphrc` à créer à la racine du repo

Trois écarts au défaut, chacun pour une raison mesurée.

```bash
PROJECT_NAME="jeux-de-typo-v2"
PROJECT_TYPE="typescript"

# 15 minutes ne suffisent pas: la porte `npm run quality` termine par `next build`.
CLAUDE_TIMEOUT_MINUTES=30
MAX_CALLS_PER_HOUR=20

# Outils. Retire du defaut: git push, pull, fetch, checkout, branch, merge, stash, tag
# (tous capables de perdre le travail du proprietaire). Ajoute: les lectures shell
# dont les criteres d'acceptation de ce plan ont besoin.
ALLOWED_TOOLS="Read,Write,Edit,Grep,Glob,Bash(npm run *),Bash(npx playwright test*),Bash(node scripts/*),Bash(grep *),Bash(ls *),Bash(wc *),Bash(find *),Bash(cat *),Bash(head *),Bash(tail *),Bash(sed -n *),Bash(git status*),Bash(git diff*),Bash(git log*),Bash(git add *),Bash(git commit *),Bash(mv progress.md docs/archive/progress-2026-06-20.md),Bash(rm -f public/next.svg public/vercel.svg public/globe.svg public/window.svg public/file.svg)"

SESSION_CONTINUITY=true
CB_NO_PROGRESS_THRESHOLD=3
CB_SAME_ERROR_THRESHOLD=5
OPTIONAL_SECTIONS="Optional,Future,Nice to Have"
```

Note sur les deux dernières entrées de `ALLOWED_TOOLS` : ce sont des commandes exactes, pas des motifs. `Bash(rm *)` n'est pas autorisé, une boucle autonome ne doit pas disposer d'un `rm` libre.

Limite honnête de ce mécanisme : le motif `Bash(git add *)` autorise aussi `git add -A`. Une liste d'autorisation ne sait pas exprimer « add oui, mais pas en masse ». Le `PROMPT.md` de la section 0.3 l'interdit en clair, ce qui suffit en pratique, mais si le propriétaire veut une garantie dure et pas une consigne, le plugin `hookify` pose un hook `PreToolUse` qui refuse la commande avant exécution. Une règle, deux minutes.

### 0.3 `.ralph/PROMPT.md` à créer

```markdown
# Ralph, projet « jeux de typo »

Tu travailles dans un repo Next.js 16 / React 19 / Neon Postgres. Le proprietaire est
designer, pas developpeur. Il regarde le site en local et il tranche seul tout ce qui
touche au visuel.

## Une boucle, une tache

1. Lis `docs/process/plan-ralph-2026-07-28.md`, c'est le plan de reference.
2. Lis `.ralph/fix_plan.md` et prends le PREMIER item non coche des sections
   High Priority puis Medium Priority puis Low Priority.
3. Fais cette tache, entierement, et rien d'autre.
4. Lance la COMMANDE DE PREUVE ecrite dans le plan pour cette tache. Si la sortie
   attendue n'est pas obtenue, tu n'as pas fini: corrige, ou signale BLOCKED.
5. Coche l'item dans `.ralph/fix_plan.md` seulement apres avoir vu la preuve.
6. Ajoute une ligne dans `docs/process/journal-ralph.md` (cree le fichier s'il
   n'existe pas): date, tache, ce qui a change, la commande de preuve et sa sortie.
7. Commit avec un message court, sans emoji, sans tiret separateur. Ajoute les
   fichiers UN PAR UN, par chemin explicite. `git add -A`, `git add .` et
   `git add -u` sont interdits: l'arbre peut contenir du travail en cours qui
   n'est pas le tien.

## Interdits absolus

- N'ecris JAMAIS dans `docs/process/checklist.md`. Un humain et un autre agent y ecrivent.
- Ne fais JAMAIS `git add -A`, `git add .` ni `git add -u`. Chemins explicites seulement.
- Ne modifie JAMAIS `app/compare/*`, ni son rendu, ni son SEO, ni sa DA.
- Ne modifie JAMAIS `features/onboarding/*`, zone de travail en cours.
- Ne prends AUCUNE decision de direction artistique: pas de couleur, pas d'echelle
  typo, pas d'espacement, pas de copie inventee. Si une tache t'y amene, arrete la
  tache et signale BLOCKED avec la question exacte a poser.
- N'execute JAMAIS de SQL sur la base. Ecrire un fichier dans `db/migrations` est
  permis, l'appliquer demande le feu vert du proprietaire.
- N'installe AUCUNE dependance npm.
- Pas d'emoji. Pas de tiret utilise comme separateur dans les textes rediges.
- Ne touche pas a `.ralph/` ni a `.ralphrc`.

## Precautions

- `lib/game/training/provider.ts` contient du travail non fini. Si une tache t'y
  amene, respecte le plafond de diff indique dans le plan et prouve le avec
  `git diff --stat`.
- Avant de conclure qu'une chose n'est pas implementee, cherche dans le repo.
  Exclus `.claude/worktrees/` de tes recherches: c'est un checkout complet imbrique
  de 702 Mo qui double tous les resultats.
- La porte complete est `npm run quality` (lint, typecheck, 8 checks maison, build).
- Les tests end to end sont `npm run test:e2e`. Lis la tache R7 avant de les lancer:
  ils ecrivent dans la vraie base Neon.

## Statut a renvoyer, obligatoire, en fin de chaque reponse

---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: <nombre>
FILES_MODIFIED: <nombre>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
WORK_TYPE: IMPLEMENTATION | TESTING | DOCUMENTATION | REFACTORING
EXIT_SIGNAL: false | true
RECOMMENDATION: <une ligne>
---END_RALPH_STATUS---
```

### 0.4 `.ralph/fix_plan.md` à créer

Items plats, un par tâche, pas de sous-cases : Ralph compte toutes les lignes `- [ ]`, sous-cases incluses, et son comptage de progression deviendrait faux.

```markdown
# Ralph Fix Plan, jeux de typo, 2026-07-28

Detail de chaque item: docs/process/plan-ralph-2026-07-28.md

## High Priority
- [ ] R1 git ignore le worktree imbrique de 702 Mo et check:artifacts l'interdit en suivi
- [ ] R2 lint a zero avertissement, verrouille par --max-warnings 0
- [ ] R3 check:copy ne depend plus de ripgrep et ne compte plus les docs
- [ ] R4 les sondes d'audit ne partent plus en production, un check l'empeche de revenir
- [ ] R5 aucune manche ne peut tomber sur une police sans lettres latines
- [ ] R6 le theme ne provoque plus d'ecart d'hydratation

## Medium Priority
- [ ] R7 la suite end to end refuse d'ecrire dans la base de production sans opt-in
- [ ] R8 la suite end to end passe trois fois de suite
- [ ] R9 le site expose robots.txt, sitemap.xml et des metadonnees par page de specimen
- [ ] R10 le secret de signature des jetons de question echoue en ferme en production
- [ ] R11 les 15 ponts de compatibilite sans consommateur sont supprimes

## Low Priority
- [ ] R12 contrat d'accessibilite mecanique prouve par une spec end to end
- [ ] R13 migration 011 ecrite pour les partitions manquantes de user_event_fact

## Optional
- [ ] R14 exports morts hors perimetre compare supprimes
- [ ] R15 progress.md archive et ses deux references mises a jour
- [ ] R16 la seule chaine francaise d'une page anglaise corrigee
- [ ] R17 les cinq svg par defaut de Next supprimes de public/

## Completed
```

### 0.5 Lancement

```bash
cd /Users/launaymarion/Documents/JEUX_DE_TYPO/09_DEV/08_jeux-de-typo-v2
ralph --notify
```

Regarder la première boucle en entier avant de laisser tourner. R1 est volontairement trivial : c'est le canari qui montre que Ralph lit le plan, produit la preuve, coche, journalise et commite proprement.

---

## 1. Ce que Ralph fait seul en boucle

Classées par rapport valeur sur effort.

### R1. Le worktree imbriqué de 702 Mo ne peut plus entrer dans un commit

**Objectif** : un `git status` ne propose plus jamais d'ajouter le checkout imbriqué, et la porte échoue si un fichier de ce checkout se retrouve suivi.

**Pourquoi maintenant** : `.claude/worktrees/da-compare-spec-beige/` est un checkout Next.js complet de 702 Mo avec son `.next/dev` compilé. Aucune règle de `.gitignore` ni de `.git/info/exclude` ne le couvre. `eslint.config.mjs:19` le neutralise déjà côté lint, avec un commentaire qui explique pourquoi (`.next/**` est ancré à la racine et ne couvre pas les worktrees imbriqués), mais rien d'équivalent n'existe côté git. Comme Ralph a le droit de commiter, c'est le premier trou à boucher, avant tout le reste.

**Fichiers** : `.gitignore`, `scripts/quality/check-tracked-artifacts.mjs`.

**Preuve** :

```bash
git status --porcelain -uall | grep -c "\.claude/worktrees"
npm run check:artifacts
```

Attendu : la première commande affiche `0` (elle affiche `1` avant la tâche, mesuré). La seconde exit 0 avec son message habituel.

**Garde-fous** : ne pas ignorer `.claude/` en entier, le propriétaire peut vouloir suivre un `settings.json` de projet un jour. Ignorer exactement `/.claude/worktrees/`. Ne pas supprimer le worktree, ne pas y toucher.

- [ ] **Étape 1** : ajouter `/.claude/worktrees/` dans `.gitignore`, dans la section `# misc`, avec un commentaire d'une ligne qui dit pourquoi (checkout imbriqué, 702 Mo, son propre `.next`).
- [ ] **Étape 2** : dans `scripts/quality/check-tracked-artifacts.mjs`, ajouter `.claude/worktrees/` à la liste des chemins interdits en suivi, sur le même modèle que les entrées existantes.
- [ ] **Étape 3** : lancer les deux commandes de preuve, vérifier `0` puis exit 0.
- [ ] **Étape 4** : journaliser dans `docs/process/journal-ralph.md`, puis commiter.

**Taille** : petite.

---

### R2. La porte lint ne laisse plus passer un avertissement

**Objectif** : `npm run lint` sort à zéro problème, et un avertissement futur fait échouer la porte au lieu de s'accumuler.

**Pourquoi maintenant** : mesuré aujourd'hui, `npm run lint` renvoie 0 erreur et 1 avertissement, `'PAPER' is assigned a value but never used` à `features/profile/components/ProgressBoard.tsx:469`. C'est une constante de couleur, déclarée une seule fois, utilisée zéro fois (son commentaire dit « used for the dark inner rule knockout », l'usage a disparu). Le journal de la checklist du 2026-07-27 parle de « 413 erreurs et 5378 avertissements tombés à 0 et 1 » : cet avertissement est le dernier reste. Le verrouiller maintenant coûte une ligne et garantit que toutes les boucles suivantes travaillent sur une porte qui veut dire quelque chose.

**Fichiers** : `features/profile/components/ProgressBoard.tsx`, `package.json`.

**Preuve** :

```bash
npm run lint
```

Attendu : exit 0, aucune ligne `warning`, aucune ligne `problem`.

**Garde-fous** : supprimer uniquement la ligne 469 et rien d'autre dans `ProgressBoard.tsx`. `PAPER` est une couleur : ne pas la « réutiliser » quelque part pour la justifier, ce serait une décision de DA. Les constantes voisines `CREAM`, `BEIGE`, `INK` sont utilisées, ne pas y toucher.

- [ ] **Étape 1** : supprimer la ligne `const PAPER = "#0c0d11";` et son commentaire de fin de ligne.
- [ ] **Étape 2** : dans `package.json`, remplacer `"lint": "eslint"` par `"lint": "eslint --max-warnings 0"`.
- [ ] **Étape 3** : `npm run lint`, vérifier exit 0 et zéro avertissement.
- [ ] **Étape 4** : `npm run typecheck`, vérifier exit 0.
- [ ] **Étape 5** : journaliser, commiter.

**Taille** : petite.

---

### R3. `check:copy` ne peut plus casser la porte pour une raison qui n'a rien à voir

**Objectif** : `npm run check:copy` donne le même verdict sans dépendre d'un binaire absent de `package.json`, et ne considère plus qu'une clé citée seulement dans un `.md` est utilisée.

**Pourquoi maintenant** : `scripts/quality/check-copy-usage.mjs:41` appelle `execFileSync("rg", ...)`. `ripgrep` n'est ni une dépendance ni vendored. Sur une machine sans `rg`, le script lève au lieu de rapporter, et `npm run quality` échoue pour une raison sans lien avec la copie : exactement le genre de faux négatif qui fait tourner une boucle autonome dans le vide pendant cinq itérations avant que le disjoncteur s'ouvre. Deuxième défaut, ligne 35 : `docs` figure dans les cibles de recherche, donc une clé de `copy.ts` mentionnée uniquement dans un fichier de documentation compte comme utilisée alors qu'aucun composant ne l'affiche.

**Fichiers** : `scripts/quality/check-copy-usage.mjs`.

**Preuve** :

```bash
npm run check:copy
```

Attendu : exit 0, et la sortie liste toujours les 3 blocs et leurs 11 clés (`gateCopy`, `notFoundCopy`, `errorCopy`). Le verdict ne doit pas changer : les 11 clés sont référencées dans du code, pas seulement en doc.

**Garde-fous** : ne pas élargir le check à la détection inverse (les chaînes en dur dans les composants). Il y a 99 nœuds de texte en dur dans du code produit et 74 attributs : c'est un chantier de copie, donc du ressort du propriétaire (section 3). Ici on répare la robustesse, pas la portée.

- [ ] **Étape 1** : remplacer l'appel `rg` par une recherche récursive en Node pur (`fs.readdirSync` avec `withFileTypes`, filtre sur `.ts`, `.tsx`, `.mjs`, `.mts`, `.md` selon la cible), sur le modèle de `collectFiles` déjà écrit dans `scripts/quality/check-dev-routes.mjs:18`.
- [ ] **Étape 2** : retirer `"docs"` de `searchTargets` ligne 35, avec un commentaire d'une ligne qui explique pourquoi une clé citée en doc n'est pas une clé utilisée.
- [ ] **Étape 3** : `npm run check:copy`, vérifier exit 0 et les 11 clés listées.
- [ ] **Étape 4** : vérifier que le script ne mentionne plus `rg` : `grep -c '"rg"' scripts/quality/check-copy-usage.mjs` attendu `0`.
- [ ] **Étape 5** : journaliser, commiter.

**Taille** : petite.

---

### R4. Les sondes d'audit ne partent plus en production

**Objectif** : en production, aucune page n'installe `window.render_game_to_text`, et un check de la porte échoue si un composant de `components/dev/` revient dans le rendu produit sans garde.

**Pourquoi maintenant** : trois faits vérifiés.

1. `components/dev/UiDebugProbe.tsx` est monté sans condition dans le layout racine (`app/layout.tsx:40`), avant `{children}`. Il n'importe pas `isDevRuntime` et ne teste pas `NODE_ENV`. Il part donc en production, sur toutes les pages, et y exécute 23 requêtes de sélecteurs avec `getBoundingClientRect` et `getComputedStyle` (`UiDebugProbe.tsx:11` à `:60`). C'est une violation directe de la frontière que `CLAUDE.md` pose (« Les composants dev vont dans `components/dev/typography/*` », labo interne), et aucun check ne l'attrape : `check-dev-routes.mjs:7` ne scanne que `app/dev` et `app/api/dev`, et `check-runtime-boundaries.mjs:32` n'interdit que `@/components/dev/typography/` et `@/lib/dev/typography/`, pas `@/components/dev/`.
2. `features/game/components/GameScreen.tsx:193` et `features/game/components/CompetitionScreen.tsx:1234` réinstallent la même fonction globale sans garde, en exposant l'état de session complet (`sessionId`, `progress`, `question`). Le slug de la bonne réponse est de toute façon présent côté client, c'est la police affichée : il n'y a donc pas de secret nouveau qui fuite, et il ne faut pas survendre l'argument anti-triche. Ce qui reste vrai : une fonction globale non documentée, présente en production, qui rend l'état de jeu scriptable en un appel.
3. C'est la cause numéro un de l'instabilité du test de training. `tests/e2e/training.spec.ts:50` attend seulement `typeof window.render_game_to_text === "function"`. La version de `UiDebugProbe` renvoie `{ mode: "ui-audit", ... }` sans champ `status`. Si le layout s'hydrate avant la page, le `waitForFunction` est satisfait par la mauvaise sonde, le poll ligne 53 passe puisque `undefined !== "loading"`, et l'assertion ligne 57 échoue avec le message trompeur « check DATABASE_URL and the Neon pool ». Le diagnostic écrit dans la checklist le 2026-07-27 portait sur un autre motif (les noms sous chaîne) et il était juste, mais il ne couvrait pas celui là.

**Fichiers** : `components/dev/UiDebugProbe.tsx`, `features/game/components/GameScreen.tsx`, `features/game/components/CompetitionScreen.tsx`, `scripts/quality/check-dev-routes.mjs`, `lib/dev-mode.ts` (lecture seule, `isDevRuntime = () => process.env.NODE_ENV !== "production"`).

**Preuve** :

```bash
npm run check:dev-routes
npm run typecheck
grep -c "isDevRuntime" components/dev/UiDebugProbe.tsx features/game/components/GameScreen.tsx features/game/components/CompetitionScreen.tsx
```

Attendu : les deux premières exit 0, la troisième affiche au moins `1` pour chacun des trois fichiers. Contre épreuve obligatoire avant de cocher : retirer temporairement le garde de `UiDebugProbe.tsx`, relancer `npm run check:dev-routes`, vérifier qu'il échoue en nommant le fichier, puis remettre le garde. Un check qui ne sait pas échouer ne prouve rien.

**Garde-fous** : ne pas supprimer `UiDebugProbe`, c'est un outil du propriétaire pour ses audits d'interface. Le garder pleinement fonctionnel en développement. Ne pas retirer le montage dans `app/layout.tsx`, le garde va dans le composant (`if (!isDevRuntime()) return null;`) : c'est l'idiome déjà vérifié par `check-dev-routes.mjs` pour les pages `app/dev/*`. Ne rien changer au contenu du payload d'audit, les specs end to end le lisent. Aucune modification de style, de mise en page ou de copie.

- [ ] **Étape 1** : ajouter le garde dans `UiDebugProbe.tsx` (import de `isDevRuntime`, sortie précoce `return null`).
- [ ] **Étape 2** : entourer l'effet d'installation de `GameScreen.tsx:192` et de `CompetitionScreen.tsx` d'un `if (!isDevRuntime()) return;` en tête d'effet, sans toucher au reste de l'effet ni au cleanup.
- [ ] **Étape 3** : étendre `check-dev-routes.mjs` avec un troisième cas : pour tout fichier de `components/dev/` importé depuis un fichier hors de `app/dev/`, `app/api/dev/`, `components/dev/`, `lib/dev/`, exiger la présence littérale de `import { isDevRuntime } from "@/lib/dev-mode";` et d'un garde `if (!isDevRuntime()) { return null; }` (motif regex, sur le modèle de `PAGE_GUARD_PATTERN` ligne 13).
- [ ] **Étape 4** : lancer les trois commandes de preuve.
- [ ] **Étape 5** : faire la contre épreuve (retirer le garde, voir le check échouer, remettre le garde).
- [ ] **Étape 6** : journaliser en nommant les trois fichiers gardés, commiter.

**Taille** : moyenne.

---

### R5. Aucune manche ne peut tomber sur une police sans lettres latines

**Objectif** : une typo dépourvue des 52 lettres latines de base ne peut plus être servie comme bonne réponse ni comme distracteur, et la porte échoue si l'un des fichiers de police servis perd sa couverture latine.

**Pourquoi maintenant** : c'est le seul point de ce plan qui change ce que vit un joueur, et il est mesuré, pas supposé. Sur les 1172 typos servables (activation vraie plus asset runtime prêt, exactement le compte que `check:license-guard` affiche), **36 n'ont aucune des 52 lettres `A` à `Z` et `a` à `z`** : `aksarabaligalang`, `hannari`, `karlatamilinclined`, `karlatamilupright`, `khmer`, `kokoro`, `lohitbengali`, `lohitdevanagari`, `lohittamil`, `myanmarsanspro`, `nikukyu`, `notoemoji`, `notonaskharabicui`, `notosansarabicui`, `notosansbengaliui`, `notosansdevanagariui`, `notosansgujaratiui`, `notosansgurmukhiui`, `notosanskannadaui`, `notosanskhmerui`, `notosanslaoui`, `notosansmalayalamui`, `notosansmyanmarui`, `notosansnko_todelist`, `notosansoriyaui`, `notosanssharada`, `notosanssinhalaui`, `notosanstamilui`, `notosansteluguui`, `notosansthaiui`, `notoserifmyanmar`, `notoserifnyiakengpuachuehmong`, `phetsarath`, `siemreap`, `sitara`, `souliyo`. Toutes sont classées `sans_serif` ou `serif` dans le catalogue, ce qui n'a aucun sens pour une face devanagari, khmère ou emoji.

Conséquence concrète dans un jeu de reconnaissance de mots latins : quand l'une des 36 est tirée comme bonne réponse, le mot s'affiche dans la police de secours du navigateur, et la question demande de reconnaître une police qui n'est pas affichée. Soit environ 3,1 pour cent des tirages de bonne réponse. La checklist connaît le fait (« 36 faces non-latines à exclure des manches ou à montrer dans leur écriture », 2026-07-07) et il n'a jamais été traité. Le motif de correction existe déjà, entièrement écrit, dans `lib/game/license-guard.ts` : allowlist ou exception par slug posée dans les deux seules requêtes de pool.

Mesure de référence à reproduire, elle a servi à établir les 36 :

```bash
node -e "const fs=require('fs'),fk=require('fontkit');const a=require('./content/catalog/font-runtime-assets.json').records.filter(r=>r.runtime_status==='ready'&&r.file_role==='primary');let bad=[];for(const r of a){const f=fk.openSync(r.source_path);let m=0;for(let c=0x41;c<=0x5a;c++)if(!f.hasGlyphForCodePoint(c))m++;for(let c=0x61;c<=0x7a;c++)if(!f.hasGlyphForCodePoint(c))m++;if(m>0)bad.push(r.typeface_slug);}console.log(bad.length, bad.join(','))"
```

**Fichiers** : nouveau `lib/game/latin-coverage-guard.ts`, nouveau `scripts/quality/check-latin-coverage.mjs`, `lib/game/training/provider.ts` (clause SQL uniquement, autour de la ligne 391), `lib/game/competition/provider.ts` (clause SQL uniquement, autour de la ligne 144), `package.json`.

**Preuve** :

```bash
npm run check:latin-coverage
npm run quality
git diff --stat lib/game/training/provider.ts lib/game/competition/provider.ts
```

Attendu : le nouveau check exit 0 en affichant le compte de faces servables et le compte d'exclusions (`1136 servables couvrant le latin, 36 exclues`). `npm run quality` exit 0. Le `git diff --stat` montre au plus 5 lignes changées par fichier de provider. Contre épreuve obligatoire : retirer un slug de la liste d'exclusion, relancer `npm run check:latin-coverage`, vérifier qu'il échoue en nommant ce slug, puis remettre le slug.

**Garde-fous** : dans les deux providers, n'ajouter QUE la clause d'exclusion, immédiatement sous la clause de licence existante, et ne toucher à aucune autre ligne. Le plafond de diff est vérifiable et il est là pour protéger le travail non fini du propriétaire dans `lib/game/training/provider.ts`. Ne pas modifier la clause de licence : `scripts/quality/check-license-guard.mjs:70` la valide par un regex qui inclut les parenthèses, avec un commentaire qui explique pourquoi les enlever changerait la sémantique. Ne pas désactiver les 36 en base, ce serait une migration. Ne pas les supprimer du catalogue : elles restent au catalogue, elles cessent seulement d'être jouables. Ne pas inventer de nouvelle catégorie ni retoucher leur `primary_category`, c'est une décision de données pour le propriétaire.

- [ ] **Étape 1** : créer `lib/game/latin-coverage-guard.ts` sur le modèle exact de `lib/game/license-guard.ts` : un commentaire d'en tête qui dit pourquoi le filtre vit dans la requête et pas dans un composant, puis `export const LATIN_UNREADY_SLUGS = [...] as const;` avec les 36 slugs, puis un prédicat `isLatinCoverageCleared(typefaceSlug)` pour tout code qui a déjà chargé une ligne.
- [ ] **Étape 2** : dans `lib/game/training/provider.ts`, importer la constante et ajouter dans `getPoolRows` une ligne `AND tc.typeface_slug <> ALL(${[...LATIN_UNREADY_SLUGS]}::text[])` juste après la parenthèse fermante de la clause de licence.
- [ ] **Étape 3** : même ajout dans `getCompetitionPoolRows` de `lib/game/competition/provider.ts`.
- [ ] **Étape 4** : créer `scripts/quality/check-latin-coverage.mjs`, sur le modèle de `check-license-guard.mjs`. Trois vérifications : (a) le module de garde déclare toujours la liste, parsée depuis le fichier comme le fait `parseStringArray` ligne 39 du check licence ; (b) les deux requêtes de pool portent toujours la clause, par regex ; (c) pour chaque asset runtime `ready` et `primary`, le fichier `source_path` existe, sa taille correspond à `file_size_bytes`, et `fontkit` confirme la couverture `A` à `Z` et `a` à `z`, sauf pour les slugs de la liste, qui doivent au contraire échouer la couverture (une exclusion qui n'a plus de raison d'être est du poids mort dans un garde-fou, même argument que les notes du check licence).
- [ ] **Étape 5** : brancher `"check:latin-coverage"` dans `package.json` et l'ajouter à la chaîne `quality`, juste après `check:license-guard`.
- [ ] **Étape 6** : lancer les trois commandes de preuve, faire la contre épreuve.
- [ ] **Étape 7** : journaliser avec les chiffres avant et après (1172 servables, 1136 après exclusion), commiter.

**Taille** : moyenne.

---

### R6. Le thème ne provoque plus d'écart d'hydratation

**Objectif** : charger n'importe quelle page avec un thème clair mémorisé n'émet plus d'erreur d'hydratation dans la console.

**Pourquoi maintenant** : `components/ui/ThemeSwitch.tsx:19` lit `window.localStorage` dans l'initialiseur de `useState`. Le serveur rend donc `"dark"` et le client peut rendre `"light"` au même instant d'hydratation, sur le `data-theme` et l'`aria-label` du bouton. `suppressHydrationWarning` est posé sur `<html>` (`app/layout.tsx:35`) mais pas sur ce bouton. Le repo a déjà rencontré et résolu exactement ce défaut : `features/profile/components/ProgressBoard.tsx:130` utilise `useSyncExternalStore` pour la préférence de mouvement réduit, avec un commentaire ligne 10 qui explique que la version naïve en initialiseur `useState` casse le rendu serveur. Le correctif est donc un motif maison déjà validé, pas une invention. Bénéfice second : `tests/e2e/landing.spec.ts:57` assère `expect(clientErrors).toEqual([])`, donc toute erreur de console rend ce test fragile. Il passe aujourd'hui (3 sur 3 mesuré), il passera de façon robuste après.

**Fichiers** : `components/ui/ThemeSwitch.tsx`.

**Preuve** :

```bash
npm run typecheck && npm run lint
npx playwright test tests/e2e/landing.spec.ts --repeat-each=3 --reporter=list
```

Attendu : exit 0 sur les deux, et `9 passed` sur la seconde. `landing.spec.ts` n'écrit rien dans la base (aucune session n'est démarrée sur `/`, `/onboarding` et `/play`), elle est donc sûre à répéter.

**Garde-fous** : aucun changement visuel. Le thème par défaut reste `dark`, le script de bootstrap de `app/layout.tsx:10` reste intact, la clé `jdt-theme` reste la même, le comportement du bouton reste le même. Ne pas ajouter `suppressHydrationWarning` sur le bouton : ce serait masquer le défaut au lieu de le corriger.

- [ ] **Étape 1** : remplacer l'initialiseur `useState` par un `useSyncExternalStore` qui s'abonne à l'événement `storage` et lit `localStorage` dans `getSnapshot`, avec `getServerSnapshot` qui renvoie `"dark"`. Copier la forme utilisée dans `ProgressBoard.tsx:130`.
- [ ] **Étape 2** : conserver l'`useEffect` qui applique le thème au `documentElement` et la fonction de bascule, qui écrit dans `localStorage`.
- [ ] **Étape 3** : lancer les deux commandes de preuve.
- [ ] **Étape 4** : journaliser, commiter.

**Taille** : petite à moyenne.

---

### R7. La suite end to end refuse d'écrire dans la base de production sans opt-in

**Objectif** : lancer `npm run test:e2e` sur la base de production s'arrête avec un message clair, et les sessions créées par un run autorisé sont identifiables en base.

**Pourquoi maintenant** : c'est la réserve laissée ouverte le 2026-07-27, et elle empêche d'utiliser la suite comme porte de routine, donc elle limite ce que Ralph peut prouver. Volume mesuré par run complet : 1 ligne `users` de rôle `guest`, environ 30 lignes `user_typeface_state`, 1 ligne `sessions` jamais terminée, 2 lignes `user_event_fact`. Aucune n'est distinguable d'un vrai joueur, et le nettoyage est contraint par des `ON DELETE RESTRICT` (`db/migrations/003_users_sessions_pool.sql:90` et `:160`), donc il faudrait supprimer dans l'ordre `user_event_fact`, `sessions`, `user_typeface_state`, `users`.

Bonne nouvelle vérifiée : le marquage est possible **sans migration**. `sessions.integrity_flags` est un `jsonb NOT NULL DEFAULT '[]'::jsonb` avec la contrainte `chk_integrity_flags_is_array` (`003:125` et `:136`), prévu pour du marquage et jamais écrit par le code applicatif. Un tag `["e2e"]` y est naturel.

**Fichiers** : `playwright.config.ts`, nouveau `tests/e2e/guard-database.ts` ou équivalent en `globalSetup`, `app/api/training/session/start/route.ts`, `lib/game/training/provider.ts` (écriture du tag uniquement), `tests/e2e/training.spec.ts`.

**Preuve** :

```bash
npm run test:e2e
```

Attendu, sans variable d'environnement : la suite s'arrête avant de démarrer le serveur, sortie non nulle, message qui nomme `JDT_E2E_ALLOW_PROD` et rappelle le volume écrit. Puis :

```bash
JDT_E2E_ALLOW_PROD=1 npx playwright test tests/e2e/training.spec.ts --reporter=list
```

Attendu : `2 passed`, et le rapport de Ralph indique que la session créée porte `integrity_flags` contenant `e2e`.

**Garde-fous** : ne pas écrire de SQL de nettoyage, ne pas supprimer de lignes, ne pas créer de route de fixtures qui supprime quoi que ce soit. Ne pas détourner `users.clerk_id` (réservé à l'identité Clerk et sous contrainte `UNIQUE`) ni `users.onboarding_familiarity` (lu par la logique de rééquilibrage, `provider.ts:292`). Le tag ne s'écrit que si `isDevRuntime()` est vrai ET qu'un en tête de requête dédié est présent : jamais en production. Le passage dans `lib/game/training/provider.ts` doit rester sous 10 lignes ajoutées, prouvé par `git diff --stat`.

- [ ] **Étape 1** : ajouter un `globalSetup` à `playwright.config.ts` qui lit `process.env.DATABASE_URL`, et sort en erreur si `JDT_E2E_ALLOW_PROD` n'est pas à `1`. Le message doit dire quoi faire : soit exporter la variable en acceptant le coût, soit pointer `DATABASE_URL` sur une branche Neon de test (voir section 3).
- [ ] **Étape 2** : dans `app/api/training/session/start/route.ts`, lire un en tête `x-jdt-e2e` et ne le propager que si `isDevRuntime()`.
- [ ] **Étape 3** : dans `lib/game/training/provider.ts`, à l'INSERT de session (autour de la ligne 722), écrire `integrity_flags` à `'["e2e"]'::jsonb` quand le drapeau est présent, et laisser le défaut sinon.
- [ ] **Étape 4** : dans `tests/e2e/training.spec.ts`, poser l'en tête via `extraHTTPHeaders` sur le contexte de la spec.
- [ ] **Étape 5** : lancer les deux commandes de preuve, vérifier `git diff --stat`.
- [ ] **Étape 6** : journaliser, commiter.

**Taille** : moyenne.

---

### R8. La suite end to end passe trois fois de suite

**Objectif** : `npm run test:e2e:repeat` sort vert sur trois répétitions consécutives des 7 tests, sans aucun échec intermittent.

**Pourquoi maintenant** : c'est la tâche qui rend toutes les suivantes vérifiables. Le motif « noms sous chaîne » a bien été corrigé le 2026-07-27, mais l'audit de cette session a trouvé cinq autres attentes fragiles, chacune identifiée à la ligne :

1. `tests/e2e/training.spec.ts:50` attend la présence de la fonction d'audit, pas la bonne sonde. Correctif : poller jusqu'à `mode === "training"`. Traité en partie par R4, à finir ici.
2. `training.spec.ts:53` à `:55` : `.not.toBe("loading")` sur une valeur potentiellement `undefined` ne peut pas échouer utilement.
3. `training.spec.ts:73` : `expect(page.getByText(/faces mastered$/)).toBeVisible()` dépend de `progress.poolSize`, produit par `safeTrainingProgress` (`lib/game/training/provider.ts:628`) qui avale toute erreur et renvoie `null`. Un démarrage à froid du compute Neon fait disparaître l'indicateur sans que la session soit cassée, et le test échoue sur une non régression.
4. `training.spec.ts:64` : `toHaveLength(4)` dépend du contenu réel de la base. `pickDistractors` fait un `slice(0, 3)` sur le pool privé de la bonne réponse : sous 4 lignes servables, il y a moins de 4 options.
5. `tests/e2e/onboarding.spec.ts:91` : `expect(stored).not.toBeNull()` ne teste rien. L'effet d'écriture tourne au montage et pose la chaîne `"{}"`, donc la clé existe dès l'étape 1. Il faut assérer le contenu parsé.

**Fichiers** : `tests/e2e/training.spec.ts`, `tests/e2e/onboarding.spec.ts`, `package.json`.

**Preuve** :

```bash
JDT_E2E_ALLOW_PROD=1 npm run test:e2e:repeat
```

Attendu : `21 passed`, exit 0. Coût assumé et à écrire dans le journal : 3 invités et environ 99 lignes de pool créés en base.

**Garde-fous** : ne pas affaiblir un test pour le faire passer. Une attente qui dépend d'un agrégat facultatif devient conditionnelle et le dit en commentaire, elle ne disparaît pas. Ne pas toucher au code produit dans cette tâche, sauf si un test révèle un vrai défaut, et dans ce cas s'arrêter et le signaler. Ne pas modifier `features/onboarding/*`, seulement la spec qui l'observe. Ne pas passer `retries` à une valeur non nulle en local : cela masquerait exactement ce qu'on cherche à mesurer.

- [ ] **Étape 1** : ajouter `"test:e2e:repeat": "playwright test --repeat-each=3"` dans `package.json`.
- [ ] **Étape 2** : lancer la commande de preuve une première fois et consigner les échecs réels observés, avant toute correction.
- [ ] **Étape 3** : corriger les cinq points ci dessus, un par un, en relançant la spec concernée après chaque correction.
- [ ] **Étape 4** : relancer la commande de preuve, exiger `21 passed`.
- [ ] **Étape 5** : journaliser en listant les cinq attentes corrigées, commiter.

**Taille** : moyenne.

---

### R9. Le site expose robots.txt, sitemap.xml et des métadonnées par page

**Objectif** : `/robots.txt` et `/sitemap.xml` répondent 200, et une page de spécimen porte un titre et une description qui lui sont propres.

**Pourquoi maintenant** : deux corrections de cadrage par rapport à la checklist, à assumer franchement.

Premièrement, il n'y a **pas 2000 pages de spécimen**. `app/type/[slug]/page.tsx` sert les slugs présents dans `content/typography/typefaces/`, et ce dossier contient exactement 3 fichiers : `frutiger.json`, `helvetica-neue.json`, `inter.json`, tous en `status: "published"`. Le levier SEO massif n'existe pas encore, il attend une génération de contenu qui est une décision produit (section 3).

Deuxièmement, le câblage manquant est presque gratuit : les 3 fichiers portent déjà un objet `seo` avec `title` et `description`, `lib/typography/content.ts:139` le fusionne déjà avec les overrides, et **personne ne le lit**. Les 3 pages héritent donc du titre global « Jeux de Typo V2 ». Il n'y a aucun `generateMetadata` dans tout `app/` (seuls `app/layout.tsx:5` et `app/profile/page.tsx:8` exportent un `metadata` statique), aucun `app/sitemap.ts`, aucun `app/robots.ts`, aucun `robots.txt` dans `public/`.

Point légal à respecter dans le filtre du sitemap : `frutiger` et `helvetica-neue` sont **absents du catalogue de jeu** et sont des typos commerciales, or ces pages affichent des jeux de glyphes complets. La note légale du projet dit explicitement que l'alphabet complet d'une commerciale est interdit. Le sitemap ne doit donc lister que les slugs dont la licence est établie via `isRuntimeLicenseCleared` (`lib/game/license-guard.ts:43`), ce qui aujourd'hui laisse `/type/inter` seulement. Le sort de `/type/frutiger` et `/type/helvetica-neue` est une décision du propriétaire, en section 4.

**Fichiers** : nouveaux `app/robots.ts`, `app/sitemap.ts`, nouveau `tests/e2e/seo.spec.ts`, `app/type/[slug]/page.tsx` (ajout d'un `generateMetadata` seulement).

**Preuve** :

```bash
npx playwright test tests/e2e/seo.spec.ts --reporter=list
npm run quality
```

Attendu : la spec SEO passe (statut 200 et type de contenu sur `/robots.txt` et `/sitemap.xml`, présence du titre propre et de la meta description sur `/type/inter`, absence de toute URL `/compare` dans le sitemap), et `npm run quality` exit 0. Cette spec ne touche pas la base : `/type/[slug]` lit le système de fichiers via `lib/typography/content.ts` et `lib/typography/specimen-data.ts`, jamais Neon.

**Garde-fous** : ne pas inventer de nom de domaine. Le domaine n'est pas décidé (checklist, section G). Lire `process.env.NEXT_PUBLIC_SITE_URL` et retomber sur `http://127.0.0.1:3000` en local, ce qui rend le blocage visible au lieu de le camoufler. Ne pas ajouter d'URL `/compare` au sitemap, dans un sens comme dans l'autre : c'est une décision en attente. Ne pas écrire de nouveaux textes SEO : utiliser les valeurs `seo.title` et `seo.description` existantes telles quelles, et si elles manquent, retomber sur le `name` de la typo. Les valeurs existantes sont en français alors que l'interface est en anglais : ne pas les traduire, le signaler dans le journal (la question de langue est en section 3). Interdire `/game`, `/profile`, `/api/` et `/dev/` dans `robots.txt`, ce sont des surfaces privées ou internes.

- [ ] **Étape 1** : créer `app/robots.ts` avec l'export par défaut attendu par Next 16, base d'URL lue dans l'environnement.
- [ ] **Étape 2** : créer `app/sitemap.ts` : routes statiques publiques (`/`, `/onboarding`, `/play`, `/play/training`, `/play/competition`, `/play/expert`), puis les `/type/<slug>` publiés dont la licence est établie.
- [ ] **Étape 3** : ajouter `generateMetadata` à `app/type/[slug]/page.tsx`, alimenté par le record déjà chargé.
- [ ] **Étape 4** : écrire `tests/e2e/seo.spec.ts` avec les quatre assertions listées dans la preuve.
- [ ] **Étape 5** : lancer les deux commandes de preuve.
- [ ] **Étape 6** : journaliser, en notant les 3 pages de spécimen réelles et la langue des textes SEO, commiter.

**Taille** : moyenne.

---

### R10. Le secret de signature des jetons de question échoue en fermé en production

**Objectif** : démarrer l'application en production sans `GAME_PROVIDER_SECRET` échoue immédiatement, au lieu de signer les jetons avec une valeur devinable.

**Pourquoi maintenant** : `lib/game/training/question-token.ts:13` définit la chaîne de repli suivante : `GAME_PROVIDER_SECRET`, sinon `DATABASE_URL`, sinon le littéral `"jeux-de-typo-dev-secret"`, écrit en clair dans le repo. Ce secret signe le jeton HMAC qui porte `typefaceSlug`, c'est à dire la validation d'une réponse. En production, si la variable n'est pas posée, le jeton est signé soit avec la chaîne de connexion à la base, soit avec un littéral public. La checklist a « Variables d'env en prod » en case non cochée, donc l'oubli est le scénario par défaut, pas un cas tordu. Corriger avant la mise en ligne coûte quelques lignes, corriger après demande de faire tourner le secret.

**Fichiers** : `lib/game/training/question-token.ts`, nouveau `scripts/quality/check-token-secret.mjs`, `package.json`.

**Preuve** :

```bash
npm run check:token-secret
npm run quality
```

Attendu : exit 0 sur les deux. Le check doit faire deux choses, et le prouver dans sa sortie : lancer un sous processus avec `NODE_ENV=production` et sans `GAME_PROVIDER_SECRET`, en attendant une levée d'erreur ; puis relancer avec un secret posé, en attendant une signature valide. Le module est importable directement, mesuré dans cette session : `node --experimental-strip-types` sur ce fichier fonctionne, il n'importe que `node:crypto`.

**Garde-fous** : ne rien changer au format du jeton ni à l'algorithme, sinon toutes les sessions en cours cassent. Garder le littéral de développement, mais le rendre inatteignable en production. Ne pas supprimer le repli sur `DATABASE_URL` sans le dire : le supprimer est le bon geste, il faut le documenter dans le journal et dans le commentaire d'en tête du fichier.

- [ ] **Étape 1** : dans `getSigningSecret`, lever une erreur explicite si `process.env.NODE_ENV === "production"` et que `GAME_PROVIDER_SECRET` est absent ou vide. Conserver le littéral pour le développement uniquement.
- [ ] **Étape 2** : créer `scripts/quality/check-token-secret.mjs` avec les deux cas de la preuve, via `child_process` et `node --experimental-strip-types`.
- [ ] **Étape 3** : brancher `"check:token-secret"` dans `package.json` et l'ajouter à la chaîne `quality`.
- [ ] **Étape 4** : lancer les deux commandes de preuve.
- [ ] **Étape 5** : journaliser en nommant la variable `GAME_PROVIDER_SECRET` comme nouvelle variable d'environnement obligatoire en production, commiter.

**Taille** : petite à moyenne.

---

### R11. Les 15 ponts de compatibilité sans consommateur sont supprimés

**Objectif** : les réexports temporaires de `components/typography/*` et `lib/typography/*` ont disparu, la porte reste verte, et aucun import ne casse.

**Pourquoi maintenant** : `CLAUDE.md:35` dit que ces ponts « sont temporaires et doivent rester de simples réexports fins pendant la migration ». La migration est terminée sans que personne ne le constate : les 14 ponts déclarés dans `scripts/quality/check-compatibility-bridges.mjs:5` ont **zéro consommateur**, vérifié par recherche sur le chemin d'import exact et non sur le nom de base (une recherche par nom de base fait faussement remonter les cibles réelles). Les pages `app/dev/*` importent directement les cibles, exemple `app/dev/typography-metrics/page.tsx:2`. Il existe en plus un quinzième pont hors contrat, `components/typography/XHeightWordSplit.tsx`, 3 lignes, zéro consommateur, surveillé par aucun check.

**Fichiers** : les 14 fichiers listés dans `check-compatibility-bridges.mjs:5` à `:62`, plus `components/typography/XHeightWordSplit.tsx`, plus `scripts/quality/check-compatibility-bridges.mjs`, `scripts/quality/check-runtime-boundaries.mjs` (le `Set ALLOWED_COMPATIBILITY_BRIDGES` lignes 15 à 30), `scripts/quality/report-worktree-categories.mjs` (lignes 53 à 66), `CLAUDE.md` (le paragraphe des ponts, ligne 35, uniquement).

**Preuve** :

```bash
npm run quality
npm run worktree:report
ls components/typography/ lib/typography/
```

Attendu : les deux premières exit 0. Le `ls` ne montre plus aucun des 15 noms supprimés. Avant suppression, prouver l'absence de consommateur pour chaque pont, chemin par chemin :

```bash
grep -rn '"@/components/typography/AnatomyMetricsValidator"' app components features lib tests scripts
```

Attendu : aucune sortie, pour chacun des 15 chemins.

**Garde-fous** : supprimer les ponts, jamais leurs cibles sous `components/dev/typography/*` et `lib/dev/typography/*`, qui font de 67 à 444 lignes chacune et sont vivantes. Ne pas toucher aux 7 fichiers de `components/typography/*` qui portent de la vraie logique (`MeasuredGlyphSplit.tsx`, `TypefaceTester.tsx`, `MeasuredWordSplit.tsx`, `CompareQuickHelpWidget.tsx`, et voir la section 5 pour les trois autres). Dans `CLAUDE.md`, modifier seulement le paragraphe des ponts, laisser tout le reste identique à l'octet, et le prouver avec `git diff --stat CLAUDE.md` qui doit montrer au plus 3 lignes changées. Ne pas supprimer les checks eux mêmes : `check:compat-bridges` reste dans la chaîne, avec une liste vide et un message qui dit que la migration est terminée.

- [ ] **Étape 1** : pour chacun des 15 chemins, lancer le `grep` de preuve et consigner l'absence de résultat.
- [ ] **Étape 2** : supprimer les 15 fichiers.
- [ ] **Étape 3** : vider la liste `BRIDGES` de `check-compatibility-bridges.mjs` et adapter son message de sortie, vider `ALLOWED_COMPATIBILITY_BRIDGES` dans `check-runtime-boundaries.mjs`, nettoyer les entrées de `report-worktree-categories.mjs`.
- [ ] **Étape 4** : réécrire le paragraphe des ponts de `CLAUDE.md` au passé, en une phrase.
- [ ] **Étape 5** : lancer les trois commandes de preuve et `git diff --stat CLAUDE.md`.
- [ ] **Étape 6** : journaliser avec le compte de fichiers supprimés, commiter.

**Taille** : moyenne.

---

### R12. Contrat d'accessibilité mécanique prouvé par une spec end to end

**Objectif** : chaque page publique respecte quatre règles vérifiables par machine, et une régression future les fait échouer.

**Pourquoi maintenant** : la checklist a « Accessibilité » en case vide, sans rien de mesuré. La part mécanique est faisable sans toucher à la DA, et le repo est déjà propre sur le sujet des images : les 5 balises `<img>` brutes sont décoratives, avec `alt=""`, `aria-hidden="true"` et un `eslint-disable-next-line @next/next/no-img-element` de portée minimale. Il reste à figer les invariants avant qu'ils ne dérivent.

Les quatre règles, choisies parce qu'aucune ne demande d'arbitrage visuel : exactement un `<h1>` rendu par page ; toute image porte un `alt`, éventuellement vide si elle est décorative ; tout contrôle interactif a un nom accessible non vide ; `<html>` porte un `lang`. Le contraste et la taille de cible sont exclus : ce sont des décisions de DA.

**Fichiers** : nouveau `tests/e2e/accessibility.spec.ts`. Corrections éventuelles limitées à des ajouts d'attributs.

**Preuve** :

```bash
npx playwright test tests/e2e/accessibility.spec.ts --reporter=list
```

Attendu : tous les tests verts, une page par test, sur `/`, `/onboarding`, `/play`, `/type/inter`. Aucune de ces pages n'écrit dans la base.

**Garde-fous** : n'ajouter que des attributs (`alt`, `aria-label`, `aria-hidden`, `lang`, `role`). Ne changer aucune mise en page, aucune couleur, aucune taille, aucun texte visible. Si une règle échoue et que la seule correction possible touche la structure visuelle, **arrêter la tâche et signaler BLOCKED** avec la page, la règle et la correction envisagée. Ne pas inclure `/compare` dans la spec. Ne pas inclure `/game` ni `/profile`, qui créent une session ou lisent un profil. Tout nouveau texte destiné à l'assistance est de la copie : il va dans `content/copy.ts`, sinon `check:copy` et la convention du repo sont contournés.

- [ ] **Étape 1** : écrire la spec avec les quatre règles, une assertion par règle et par page.
- [ ] **Étape 2** : lancer la spec et consigner les échecs réels avant toute correction.
- [ ] **Étape 3** : corriger uniquement par ajout d'attribut, ou signaler BLOCKED.
- [ ] **Étape 4** : relancer la spec, exiger le vert.
- [ ] **Étape 5** : journaliser, commiter.

**Taille** : moyenne.

---

### R13. Migration 011 écrite pour les partitions manquantes de `user_event_fact`

**Objectif** : le fichier de migration qui crée les partitions mensuelles manquantes existe, et la porte signale désormais quand le mois courant n'a pas sa partition déclarée. Rien n'est appliqué.

**Pourquoi maintenant** : `user_event_fact` est partitionnée par `RANGE (event_ts_utc)` et `db/migrations/001_user_event_fact.sql:107` à `:116` ne déclare que `uef_2026_03`, `uef_2026_04`, `uef_2026_05`, plus `uef_default`. Nous sommes en juillet 2026 : tous les événements depuis juin tombent dans la partition fourre tout. Ça fonctionne, il n'y a pas d'urgence fonctionnelle, mais la dette a une propriété désagréable : on ne peut pas attacher plus tard une partition dont la plage recouvre des lignes déjà présentes dans la partition par défaut sans les déplacer d'abord. Plus on attend, plus le déplacement est gros. Écrire le fichier maintenant coûte quinze minutes.

**Fichiers** : nouveau `db/migrations/011_uef_partitions_2026.sql`, nouveau `scripts/quality/check-event-partitions.mjs`, `package.json`.

**Preuve** :

```bash
npm run check:event-partitions
npm run quality
```

Attendu : exit 0 sur les deux. Le check lit les fichiers de `db/migrations/` et échoue si le mois courant n'a pas de partition `uef_YYYY_MM` déclarée. Après écriture de la 011, il passe. Sa sortie doit dire, en clair, que la 011 n'est pas appliquée.

**Garde-fous** : n'exécuter aucun SQL. Le fichier doit être idempotent (`CREATE TABLE IF NOT EXISTS`) et contenir en tête un commentaire qui explique l'ordre à respecter : déplacer les lignes de `uef_default` avant d'attacher les nouvelles partitions, sinon `ATTACH PARTITION` échoue. Ne pas supprimer `uef_default`. Suivre exactement le style des migrations existantes, en particulier la numérotation et le schéma `app`.

- [ ] **Étape 1** : lire `001_user_event_fact.sql:100` à `:120` et reprendre son style de déclaration à l'identique.
- [ ] **Étape 2** : écrire `011_uef_partitions_2026.sql` pour juin 2026 à décembre 2026, avec le commentaire d'ordre et la mention explicite « non appliquée, feu vert propriétaire requis ».
- [ ] **Étape 3** : écrire `scripts/quality/check-event-partitions.mjs` et le brancher dans `package.json` et dans la chaîne `quality`.
- [ ] **Étape 4** : lancer les deux commandes de preuve.
- [ ] **Étape 5** : journaliser avec la mention « migration écrite, NON appliquée », commiter.

**Taille** : petite.

---

## 2. Optional

Ces items ne bloquent pas la sortie de boucle. La section est nommée `Optional` dans `.ralph/fix_plan.md` parce que c'est un mot clé que le script parse.

### R14. Exports morts hors périmètre compare supprimés

**Objectif** : cinq exports jamais référencés ont disparu, et la porte reste verte.

**Pourquoi** : `lib/game/competition/catalog.ts:78` `getCompetitionFontFaceCss` est mort depuis que la page compétition a abandonné l'injection globale d'`@font-face` (commentaire de `app/play/competition/page.tsx:4`). Les quatre autres n'ont jamais eu de consommateur : `lib/profile/palier-taxonomy.ts:39` `isPalierDerivable`, `lib/typography/content.ts:252` `getTypefaceNameById`, `lib/typography/content.ts:257` `getTypographyRoot`, `lib/dev/typography/headless-runtime.ts:40` le type `HeadlessFontMetricsFile`.

**Fichiers** : les cinq fichiers ci dessus.

**Preuve** :

```bash
grep -rn "getCompetitionFontFaceCss\|isPalierDerivable\|getTypefaceNameById\|getTypographyRoot\|HeadlessFontMetricsFile" app components features lib scripts tests
npm run quality
```

Attendu : le `grep` ne renvoie rien, `npm run quality` exit 0.

**Garde-fous** : rien d'autre. Les 13 autres exports morts trouvés lors de l'audit portent tous sur la chaîne compare (`compare-assistant-composer.ts`, `compare-profile-insights.ts`, `compare-page-helpers.ts`, `anatomy-metrics.ts`) et sont en attente de décision, section 5. Ne pas toucher aux 78 exports utilisés dans leur propre fichier : retirer un mot clé `export` sur 78 symboles, c'est du bruit de diff pour zéro comportement.

**Taille** : petite.

### R15. `progress.md` archivé et ses deux références mises à jour

**Objectif** : la racine du repo n'a plus deux journaux d'avancement concurrents.

**Pourquoi** : `progress.md` fait 68 Ko, il est suivi par git, il n'a pas bougé depuis le 20 juin, et `CLAUDE.md:68` désigne `docs/process/checklist.md` comme la source de vérité de l'avancement. Deux journaux coexistent, un seul est canonique, et un agent qui découvre le repo lit d'abord le mauvais.

**Fichiers** : `progress.md` déplacé en `docs/archive/progress-2026-06-20.md`, `scripts/safety/create_ui_checkpoint.sh` (lignes 25 et 56), `docs/process/safety-workflow.md` (ligne 34).

**Preuve** :

```bash
ls progress.md
grep -rn "progress.md" scripts docs CLAUDE.md
bash -n scripts/safety/create_ui_checkpoint.sh
npm run quality
```

Attendu : le `ls` échoue avec « No such file ». Le `grep` ne montre plus aucun chemin racine `progress.md`, seulement le nouveau chemin. Le `bash -n` exit 0. `npm run quality` exit 0.

**Garde-fous** : déplacer, ne pas supprimer. Ne pas éditer le contenu du fichier. Ne pas modifier `docs/README.md` ni `docs/process/checklist.md`.

**Taille** : petite.

### R16. La seule chaîne française d'une page anglaise corrigée

**Objectif** : la page de spécimen ne mélange plus deux langues à l'écran.

**Pourquoi** : `app/type/[slug]/page.tsx:347` affiche `Aucune comparaison disponible.` dans une page dont tout le reste est en anglais (« Specimen strips », « Continuous reading », « Concepts to observe », « Pedagogical intent »).

**Fichiers** : `app/type/[slug]/page.tsx`, `content/copy.ts`.

**Preuve** :

```bash
grep -n "Aucune comparaison" app/type/'[slug]'/page.tsx
npm run check:copy && npm run typecheck
```

Attendu : le `grep` ne renvoie rien, les deux commandes exit 0.

**Garde-fous** : le texte de remplacement est imposé, à recopier tel quel, pour que Ralph n'écrive aucune copie : `No comparison available yet.` Le placer dans un bloc `specimenCopy` de `content/copy.ts`, comme le veut la convention. Ne toucher à aucune autre chaîne de la page, il y en a une dizaine en dur et c'est un chantier de copie qui appartient au propriétaire.

**Taille** : petite.

### R17. Les cinq svg par défaut de Next supprimés de `public/`

**Objectif** : la racine de `public/` ne contient plus les assets du gabarit `create-next-app`.

**Pourquoi** : `public/next.svg`, `vercel.svg`, `globe.svg`, `window.svg`, `file.svg` ont zéro référence dans tout le repo, vérifié sur `app`, `components`, `features`, `lib`, `content`, `scripts`, `docs`.

**Fichiers** : les cinq fichiers.

**Preuve** :

```bash
grep -rn "next.svg\|vercel.svg\|globe.svg\|window.svg\|file.svg" app components features lib content scripts docs
ls public/
npm run quality
```

Attendu : le `grep` ne renvoie rien, le `ls` ne montre plus les cinq noms, `npm run quality` exit 0.

**Garde-fous** : **ne pas supprimer `public/TITRE_.svg`**, qui n'a lui non plus aucune référence mais qui est un asset de marque, donc une décision du propriétaire. Ne rien toucher sous `public/brand/` ni `public/fonts/`. La commande de suppression exacte est la seule autorisée dans `.ralphrc`.

**Taille** : petite.

---

## 3. Ce qui demande un aller-retour avec le propriétaire

Ces sujets ont de la valeur, parfois plus que certaines tâches Ralph, mais ils supposent un arbitrage qu'une machine ne peut pas prendre seule.

**Appliquer les migrations 007, 008, 009, 010.** Quatre fichiers écrits, aucun appliqué, quatre fonctionnalités en attente : rééquilibrage additif du pool, croissance du pool (invariant I-07), niveau global visible N.1 à E.5, label `ufl` dans l'enum de licence. Le code est câblé en fail safe, donc l'application est la seule chose qui manque. L'ordre de la 010 est impératif et documenté dans la checklist : appliquer l'étape 1, puis basculer le JSON du catalogue, jamais l'inverse. La voie recommandée par `CLAUDE.md` est une branche Neon jetable via le plugin `neon`, ce qui permet de tester la migration sans toucher aux données réelles.

**Créer une branche Neon de test pour la suite end to end.** R7 pose un garde-fou et un marquage, mais l'isolation propre demande une base séparée, donc une action Neon du propriétaire, une fois. Avec elle, R8 devient gratuit et répétable, et les tests peuvent entrer dans une porte de routine.

**Le sort de `/type/frutiger` et `/type/helvetica-neue`.** Deux des trois pages de spécimen publiées portent des typos commerciales absentes du catalogue de jeu, et affichent des jeux de glyphes complets. La note légale du projet interdit l'alphabet complet pour une commerciale. Trois issues : dépublier, remplacer par une libre équivalente, ou acheter une licence. C'est un choix éditorial et juridique.

**Générer les pages de spécimen en masse.** Le levier SEO dont parle la checklist n'existe pas : 3 pages, pas 2000. La matière première existe (`content/catalog/typefaces-core.json`, `content/typography/generated/font-specimen-data.json`, et 1136 faces à licence libre couvrant le latin après R5). Générer 1136 pages est mécanique, mais c'est aussi une décision produit et SEO lourde : des pages générées et minces peuvent être traitées par Google comme des pages passerelles. À cadrer avant, pas après.

**La grappe `Gate`, 1455 lignes injoignables.** `features/landing/components/Gate.tsx` fait 582 lignes et **zéro fichier ne l'importe**. Il entraîne `components/ui/ScrollMascot.tsx` (858 lignes) et `components/ui/ScrollHint.tsx` (12 lignes), tous deux consommés par Gate seul, plus `gateCopy` dans `content/copy.ts`. Trois verrous imbriqués rendent la suppression non triviale : `scripts/quality/check-motion-contracts.mjs:14` lève une erreur si `Gate.tsx` disparaît (il y valide 15 contrats de motion), `check:copy` échoue si `gateCopy` reste sans consommateur, et le typecheck casse si `gateCopy` part sans `ScrollHint`. Surtout, Gate est la porte animée de la landing, documentée dans `docs/ui/gate.md` et citée dans `CLAUDE.md`. C'est de la DA en sommeil, pas du déchet : **Ralph n'y touche pas**, c'est une décision du propriétaire, réactiver ou retirer.

**Les 99 chaînes d'interface en dur.** `CLAUDE.md:52` affirme que la copie est centralisée dans `content/copy.ts`. Le fichier fait 23 lignes, 3 blocs, 11 clés, 4 consommateurs dont un mort. En face, hors zones gelées et hors labos, il y a 99 nœuds de texte JSX en dur et 74 attributs en dur. La convention n'est pas tenue à environ 90 pour cent, et `check:copy` ne peut pas le voir : il vérifie seulement qu'une clé déclarée est utilisée, jamais l'inverse. Rapatrier 99 chaînes est un chantier de copie et d'internationalisation, pas une refacto : c'est au propriétaire de dire s'il veut y aller, et dans quelle langue.

**La lecture de catalogue complète à chaque réponse.** `lib/profile/profile-stats.ts:418` fait `SELECT typeface_slug, primary_category, sub_category, aperture_profile, contrast_profile FROM typefaces_core` sans clause `WHERE`, soit 2032 lignes et 5 colonnes, à chaque appel de `loadTrainingProgress`, donc à chaque réponse de joueur. C'est aussi pourquoi l'indicateur « X / Y faces maîtrisées » peut disparaître sur un démarrage à froid du compute Neon (`safeTrainingProgress` avale l'erreur et renvoie `null`). Restreindre la requête au pool du joueur changerait le dénominateur de `buildEye`, donc le niveau d'œil affiché : ce n'est pas mécanique, c'est un choix de modèle. À traiter avec le propriétaire, la compétence `neon:neon-postgres-egress-optimizer` est faite pour ce diagnostic.

**Trois dérives de `CLAUDE.md`, trois lignes à corriger.** `CLAUDE.md:14` énumère la chaîne `quality` sans `check:license-guard`, qui y figure pourtant deux fois dans `package.json`. `CLAUDE.md:47` déclare `components/blocks` intouchable, or ce dossier n'existe pas. `CLAUDE.md:50` décrit `lib` comme portant la logique de motion, or `lib/motion/` et `lib/utils/` ne contiennent qu'un `.gitkeep`. C'est le fichier que tout agent lit en premier : une instruction fausse coûte à chaque boucle. Volontairement laissé au propriétaire, un agent autonome ne réécrit pas ses propres instructions.

**Décider `mastery_level` 0 à 4 contre boîtes Leitner 0 à 5.** Toujours ouvert dans la checklist, section F. C'est une décision d'architecture qui conditionne le scoring, donc préalable à tout travail sur les constantes.

---

## 4. Ce qui est bloqué par autre chose que du code

Les vrais bloqueurs de mise en ligne du projet. Aucune boucle autonome n'y changera quoi que ce soit.

**La typo du logo, PP Frama, propriétaire.** Servie à tous les visiteurs sans licence webfont (`public/fonts/brand/PPFrama-*.otf`). Il faut retrouver la licence, vérifier les droits webfont en usage commercial, puis acheter ou remplacer par une libre, et ajouter le fichier de licence et l'attribution. C'est un achat et une vérification juridique, pas une tâche de développement.

**Le dossier RGPD.** Politique de confidentialité, consentement cookies, mentions légales et conditions générales. Des données de joueurs sont stockées dans l'Union européenne. Obligatoire au même titre que les licences de police.

**Le domaine et l'hébergement.** Le build de production passe (vérifié le 2026-07-27, 26 routes), mais il n'y a ni domaine ni variables d'environnement de production. C'est ce qui rend impossible d'écrire une URL absolue honnête dans le sitemap de R9.

**L'avis juridique avant lancement commercial.** La France protège davantage les dessins de caractères que d'autres droits européens. La stratégie « mode grandes typos commerciales » de la checklist en dépend entièrement.

**Le partenariat et les visuels officiels.** Démarche cadrée dans `docs/overview/partenariat-adobe.md`, deck de 11 slides prêt dans Figma. Il manque un contact réel sur l'appel à l'action. C'est de la prise de contact.

Deux nuances honnêtes sur cette section. Premièrement, les 23 typos anciennement en licence inconnue ne sont plus un bloqueur, elles sont toutes en OFL depuis le 2026-06-29. Deuxièmement, le garde-fou runtime de licence est en place et vérifié par un check dans la porte, donc le risque de servir une police non autorisée est déjà fermé côté code : ce qui reste est purement contractuel.

---

## 5. En attente de décision, non planifié

**Les pages compare.** Le propriétaire a dit qu'il ne veut pas y toucher pour le moment. Le levier existe et il est réel : `app/compare/[slug]/page.tsx` est la page la plus riche du site, avec 4 stages, des annotations mesurées et des superpositions de mots, et elle n'a aucun `generateMetadata`, aucune entrée de sitemap, aucune image de partage. Une seule comparaison est publiée sur les deux existantes (`helvetica-neue-vs-inter` publiée, `frutiger-vs-inter` en brouillon), et les deux portent des typos commerciales. Rien de tout cela n'est planifié ici. Quand le feu vert viendra, trois choses se tiennent prêtes : les métadonnées par comparaison, l'entrée sitemap, et la question du contenu commercial.

**Le code mort de la chaîne compare.** L'audit a trouvé un îlot fermé de 5 fichiers et 436 lignes, entièrement injoignable depuis une route : `lib/typography/compare-assistant-composer.ts`, `compare-assistant-playbooks.ts`, `compare-trap-library.ts`, `compare-assistant-contracts.ts`, `components/typography/CompareInterventionPanel.tsx`. Plus `components/typography/ComparisonMetricsPanel.tsx`, 267 lignes, zéro référence même en documentation, seul consommateur hors `anatomy-metrics.ts` de `measureFontMetrics` et `measureVisualBox`. Plus 13 exports morts de la même chaîne. Aucun de ces fichiers n'est sous `app/compare/`, ils sont donc techniquement dans le périmètre, et supprimer 700 lignes injoignables ne peut pas changer le rendu de compare. Je les sors quand même : le propriétaire a peur de toucher à compare, et un assistant qui supprime sept fichiers nommés `compare*` la semaine où on lui demande de ne pas y toucher a raison sur la lettre et tort sur l'esprit. À rouvrir avec le feu vert compare.

**La direction artistique.** Aucune tâche de ce plan ne tranche une question visuelle. Quatre sujets restent ouverts dans la checklist et se règlent devant la landing en local, avec le propriétaire : appliquer la palette canonique dans `globals.css` et mettre à jour le contrat UI, l'arbitrage du bouton principal des écrans d'erreur (pilule crème de la landing contre dégradé jaune des placeholders), la revue visuelle des badges (direction déjà donnée : ne rien supprimer, rareté en couleur pleine, référence de qualité les lockups éditoriaux), et le passage du blanc au beige dans les labos `/dev`. Ce dernier est mécanique et documenté comme décidé depuis le 2026-06-30, mais il reste du travail de couleur, et le propriétaire est le seul juge : je ne le confie pas à Ralph.

---

## 6. Écarté, et pourquoi

Un plan qui prétendrait que tout est automatisable serait un mauvais plan. Voici ce que j'ai regardé et retiré.

**Le mode Expert jouable de bout en bout.** C'est le plus gros trou fonctionnel du produit : `app/play/expert/page.tsx` n'est qu'un `ModePlaceholderPage`, il n'existe aucun `lib/game/expert/`, aucune route `/api/expert/*`, aucun `ExpertScreen`. Mais construire un flux de saisie libre « nommer la typo » demande des décisions de produit à chaque écran, et aucune commande ne peut prouver qu'un jeu est amusant. Hors périmètre Ralph.

**L'authentification réelle, l'arène, la monétisation, l'espace enseignant.** Chacun suppose un fournisseur à choisir, un modèle économique à trancher, ou une population de joueurs qui n'existe pas encore. Ce sont des projets, pas des tâches.

**Le monitoring et l'analytique produit.** Suppose un compte Sentry et un choix d'outil, donc une décision et une dépendance nouvelle, tous deux interdits ici.

**Retirer le mot clé `export` des 78 symboles utilisés seulement dans leur propre fichier.** Mesuré, réel, et sans intérêt : 78 fichiers touchés, zéro changement de comportement, un diff qui noie tout le reste. Mauvais rapport valeur sur effort.

**La factorisation des deux moteurs d'overlay.** `lib/typography/word-overlay-engine.ts` (1220 lignes) et `glyph-overlay-engine.ts` (895 lignes) partagent 120 lignes strictement identiques et une symétrie de nommage systématique. Une factorisation demande de comprendre finement la géométrie typographique des deux, et de la prouver visuellement, donc des captures, donc l'inverse de ce que ce projet autorise pour vérifier. À faire à la main, par quelqu'un qui a la spec en tête.

**Chasser les TODO, les `console.log`, les `any`, les `@ts-ignore`, les imports inutilisés, les fichiers dupliqués.** Cherché, mesuré : **zéro occurrence** dans tous ces cas. Les 26 « placeholder » du repo sont des noms de classes CSS d'un écran produit assumé, un nom de composant, et un attribut HTML standard. Les 13 `console.error` sont des frontières React et des blocs `catch` de routes API. Les 10 `console.warn` sont tous dans `lib/game/training/provider.ts` et signalent une dégradation contrôlée quand une migration n'est pas appliquée, ce qui est le comportement voulu. Les 7 `eslint-disable` sont des règles Next d'image ou de lien, de portée minimale. Aucun fichier n'est byte identique à un autre. Ce codebase est propre sur ces axes, et inventer une tâche de nettoyage aurait été de la boucle pour rien.

**La chaîne `backups/` partiellement suivie.** `backups/css-recovery/`, `translator-recovery/` et deux dossiers de graines typographiques sont suivis par git, soit 272 Ko et 22 fichiers, alors que `backups/checkpoints/` est ignoré. `CLAUDE.md` décrit `backups/` comme de l'archive de récupération. C'est probablement un choix, pas un oubli, et le supprimer serait irréversible. Signalé, pas planifié.

**Le contrat de motion attaché à un fichier mort.** `scripts/quality/check-motion-contracts.mjs` valide 19 contrats, dont 15 sur `Gate.tsx`, qui n'est importé par personne. La porte vérifie donc scrupuleusement le comportement d'un composant qui ne s'affiche jamais. C'est un vrai symptôme, mais le traiter suppose de décider du sort de Gate, donc section 3.

---

## 7. Auto-revue

Passe de relecture faite sur le plan, contre les contraintes du brief.

**Couverture.** Chaque tâche des sections 1 et 2 porte les six champs demandés : objectif en comportement observable, valeur, fichiers vérifiés dans le repo, commande de preuve avec sortie attendue, garde-fous, taille. Aucune tâche n'est décrite par le fichier qu'elle modifie.

**Commandes de preuve.** 17 tâches, 17 commandes. Trois d'entre elles (R4, R5, R11) exigent en plus une contre épreuve, parce qu'un check neuf qui n'a jamais échoué ne prouve rien. Toutes les commandes tiennent dans l'autorisation prescrite en 0.2, et j'ai vérifié dans cette session que les briques existent : `fontkit` ouvre bien un woff2 et répond à `hasGlyphForCodePoint`, `node --experimental-strip-types` importe bien `question-token.ts`, `npx playwright test --list` liste bien 7 tests, chromium est bien installé, `landing.spec.ts` passe bien en 5,1 s sans toucher la base.

**Périmètre.** Aucune tâche ne modifie `app/compare/*`. Aucune ne modifie `features/onboarding/*`, R8 modifie seulement la spec qui l'observe. Deux tâches touchent `lib/game/training/provider.ts` (R5 et R7), chacune avec un plafond de diff vérifiable par `git diff --stat`. Aucune n'exécute de SQL. Aucune ne tranche une question de DA, et R12 a l'ordre explicite de s'arrêter si elle y arrive.

**Cohérence des noms.** Les scripts créés (`check-latin-coverage.mjs`, `check-token-secret.mjs`, `check-event-partitions.mjs`) suivent le nommage de `scripts/quality/`, et leurs entrées npm suivent le préfixe `check:` existant. Le module `lib/game/latin-coverage-guard.ts` reprend la forme de `lib/game/license-guard.ts`, y compris le commentaire d'en tête qui explique pourquoi le filtre vit dans la requête.

**Ce que ce plan ne fait pas.** Il ne fait avancer aucun des cinq vrais bloqueurs de mise en ligne, qui sont juridiques et contractuels. Il ne rend pas le mode Expert jouable. Il n'ajoute pas une ligne de contenu au produit. Il rend le socle vérifiable, il ferme un défaut de jeu mesuré à 3,1 pour cent des tirages, il sort le labo interne de la production, et il pose les trois surfaces SEO qui manquaient. C'est tout, et c'est déjà ce qu'une boucle autonome peut faire honnêtement.
