# DWIGGINS — Checklist « Où on en est »

> Source de vérité de l'avancement produit, confrontée à l'état réel du code.
> Version visuelle interactive (miroir de ce fichier) : artifact `dwiggins-checklist` sur claude.ai.
>
> **Dernière mise à jour : 2026-07-27.**
> Les cases reflètent l'état du code à cette date — à re-vérifier avant d'affirmer comme acquis.

## Comment lire

- `- [x]` = considéré comme fait · `- [ ]` = reste à faire.
- Le **statut** entre `backticks` = lecture honnête de l'état du code, pas forcément « coché ».
- Statuts : `Fait` · `En cours` · `À faire` · `Bloqueur` · `À décider` / `Plus tard`.
- Une ligne avec des sous-cases est cochée quand toutes ses sous-étapes le sont.

## En résumé

L'essentiel du front (profil, badges, onboarding, pages typo) et le back sont **déjà là**.
Le vrai chantier urgent n'est **pas du code** mais du **légal / marque** (typo du logo PP Frama + licences des typos) avant toute mise en ligne.

État par sujet : **16 faits · 0 en cours · 17 à faire · 2 bloqueurs · 6 parkés / à décider** (41 sujets).

> Section **G — Transversal / mise en ligne** ajoutée le 2026-06-29 : sujets transversaux souvent oubliés (légal RGPD, déploiement, SEO, monétisation, erreurs, monitoring, a11y…), absents de la liste de départ.

---

## Journal — 2026-07-28 (mise en commits de la journée du 27, plan Ralph)

- **Tout le travail du 27 juillet est committé.** Il vivait encore entièrement dans le working tree, 68 fichiers, donc à un `git checkout` malheureux près il était perdu. **8 commits sur `main`** au-dessus de `ba44383`, 73 fichiers, rien poussé, aucune branche créée, aucune migration jouée : `8a9505f` porte qualité, `12d11b3` palette crème à la place du blanc pur, `5aa7e6d` pages d'erreur, `37ad372` garde-fou licence, `7c35214` polices (runtimePath latin + injection à la demande), `7bf5298` tests e2e, `2983e93` docs, `fc369dd` le chantier en cours du propriétaire (moteur training + refonte onboarding), isolé exprès dans son propre commit.
- **Six fichiers portaient deux sujets à la fois**, l'entrelacement étant à l'intérieur des fichiers (`app/globals.css` en portait trois). Découpés bloc de diff par bloc de diff, avec double validation : le recollage de tous les paquets reproduit l'original octet pour octet, et les six fichiers correspondent toujours à leurs empreintes sha256 d'avant l'opération.
- **Vérifié sur l'arbre final** : `npm run quality` exit 0 sur 11 étapes, `npm run test:e2e` 7 tests verts en 9,1 s, `check:license-guard` 1172 typos servables toutes validées. Reste un avertissement de lint, `PAPER` déclaré et jamais utilisé dans `ProgressBoard.tsx:469`. Les commits intermédiaires n'ont pas été vérifiés un par un, seulement le résultat.
- **`.claude/` n'était pas ignoré par git**, donc `settings.local.json` et les worktrees imbriqués étaient candidats au commit. Ligne `/.claude/` ajoutée au `.gitignore` dans `7bf5298`.
- **Quatre constats gênants remontés par la relecture du diff, non corrigés volontairement.** 1. La refonte onboarding réintroduit du blanc pur, `rgba(255, 255, 255, 0.25)` et `0.42` sur `.onboarding-btn--solid` (`globals.css` 2118 et 2125), les deux seules occurrences restantes du fichier, ce qui contredit la décision du 2026-06-30 consignée dans `docs/ui/ui-palette-reference.md`. C'est de la DA, donc arbitrage du propriétaire. 2. `Gate.tsx`, 582 lignes, n'a plus aucun importeur et n'est plus monté par la landing, alors que `check:contracts` continue de valider son contrat de motion. 3. `buildCorpusPedagogyLine` est mort depuis la coupe du hero `/compare/[slug]`, toujours exporté, laissé en place pour que la décision de copie reste réversible. 4. Les quatre nouveaux `docs/game/*.md` ne sont pas au sommaire `docs/README.md`.
- **Le commit `fc369dd` atterrit inerte** : les migrations 007, 008, 009 et 010 sont écrites mais pas appliquées, les appels moteur sont enveloppés en échec silencieux, donc la fonctionnalité ne s'allume qu'au feu vert du propriétaire sur chaque migration. Piège d'ordre à respecter sur la 010 : le catalogue doit garder `license_type: "unknown"` sur les cinq slugs Ubuntu jusqu'à l'étape 1, sinon un réimport est rejeté. Vérifié conforme aujourd'hui.
- **Réserve sur les tests e2e, à trancher** : la suite écrit dans la vraie base Neon à chaque exécution (1 invité, une trentaine de lignes de pool, une session jamais terminée, des événements), indistinguable de vraies données de joueur. Elle a tourné une fois de plus aujourd'hui, donc un jeu de plus existe.
- **Plan Ralph écrit** : `docs/process/plan-ralph-2026-07-28.md`, 805 lignes, 13 tâches bloquantes plus 4 optionnelles, chacune avec sa commande de preuve. Périmètre imposé : les pages compare sont exclues, le propriétaire préfère ne pas y toucher pour le moment, donc le levier SEO qu'elles portent part en attente de décision au lieu d'être planifié. Le plan est calé sur le vrai format du script, `~/.ralph/ralph_loop.sh` pipe `.ralph/PROMPT.md` dans `claude` et compte les cases de `.ralph/fix_plan.md`, et sur sa contrainte décisive : `ALLOWED_TOOLS` n'autorise par défaut que `Bash(npm *)` et `Bash(pytest)`, donc chaque critère d'acceptation est un `npm run`. Plugin `ralph-loop` réactivé dans les réglages, il fonctionne par hook `Stop` qui réinjecte le même prompt, la boucle ne se souvient que de l'état du disque.
- **Quatre défauts trouvés hors checklist, tous vérifiés à la main aujourd'hui.** 1. **`components/dev/UiDebugProbe.tsx` est monté sans condition dans `app/layout.tsx:40`**, donc il partirait en production sur toutes les pages, sans garde `isDevRuntime`. Aucun check ne l'attrape, `check:dev-routes` ne scanne que `app/dev` et `app/api/dev`, `check:runtime-boundaries` n'interdit que `@/components/dev/typography/`. 2. **36 des 1172 typos servables n'ont aucune lettre latine** (mesuré avec `fontkit` sur les assets prêts, liste nominative dans le plan), toutes classées `sans_serif` ou `serif` : quand l'une sort en bonne réponse, le mot s'affiche en police de secours, donc la question demande de reconnaître une police qui n'est pas affichée, environ 3,1 pour cent des tirages. 3. **`lib/game/training/question-token.ts:13` signe les jetons avec, à défaut de `GAME_PROVIDER_SECRET`, la chaîne de connexion à la base, puis le littéral `"jeux-de-typo-dev-secret"` écrit en clair dans le repo** ; « variables d'env en prod » étant une case non cochée, l'oubli est le scénario par défaut. 4. `ThemeSwitch` lit `localStorage` dans un initialiseur `useState`, le défaut déjà corrigé dans `ProgressBoard.tsx`.
- **Deuxième cause de l'instabilité du test de training, distincte de celle du 27 juillet.** `tests/e2e/training.spec.ts:50` attend la présence de `window.render_game_to_text` et peut être satisfait par la sonde d'audit d'interface, dont le payload n'a pas de champ `status`, d'où l'échec avec le message trompeur « check DATABASE_URL and the Neon pool ». La correction du locator par sous-chaîne reste valable, elle ne couvrait pas ce cas.
- **Contenu éditorial de spécimen : il n'y en a que trois**, `content/typography/typefaces/` contient `inter.json`, `helvetica-neue.json` et `frutiger.json`, chacun avec un objet `seo` que personne ne lit. Deux sur trois sont des typos commerciales et les trois slugs sont absents de `content/catalog/typefaces-core.json`. Nuance mesurée aujourd'hui, contre l'alerte initiale du plan : **aucun asset de police n'est livré pour `frutiger` ni `helvetica-neue`** (rien dans `public/fonts/`), donc le repo ne distribue pas leurs glyphes, l'exposition porte sur le contenu éditorial et le nom, pas sur la fonte.
- **Tâche R1 du plan déjà faite avant d'être écrite** : le worktree imbriqué de 702 Mo est couvert depuis la ligne 24 du `.gitignore`, ajoutée dans `7bf5298` par la session de commits du matin. Vérifié avec `git check-ignore -v .claude/worktrees`. À rayer du plan avant de lancer la boucle.
- **Tâche R4 faite : les sondes d'audit ne partent plus en production** (commit `59b0ae7`). `components/dev/UiDebugProbe.tsx` était monté sans condition par `app/layout.tsx`, donc l'outil d'audit interne du propriétaire partait sur toutes les pages en production. Les trois installations de fonction globale sont désormais gardées par `isDevRuntime()` : la sonde, `GameScreen` et `CompetitionScreen`. La sonde reste intacte en local, le garde vit dans le rendu et l'effet est passé dans un composant interne, une sortie précoce au dessus d'un `useEffect` appelant le hook conditionnellement. **La collision de noms est traitée à la racine** : la sonde installe `render_ui_audit_to_text`, les écrans de jeu gardent `render_game_to_text`. C'était la deuxième cause d'instabilité du test de training consignée plus haut, le `waitForFunction` pouvait être satisfait par la mauvaise sonde et l'échec sortait sur le message trompeur « check DATABASE_URL and the Neon pool ». `check:dev-routes` gagne un troisième cas : tout fichier de `components/dev/` atteint depuis `app/`, `components/`, `features/` ou `lib/` doit porter l'import `isDevRuntime` et un garde exécutable, et les chaînes d'import sont suivies à travers les ponts de compatibilité d'une ligne, pour qu'un pont ne puisse pas cacher un montage. Le check était déjà l'étape 5 de `npm run quality`, la couverture entre donc dans la porte sans câblage nouveau. **Preuves mesurées** : `npm run check:dev-routes` exit 0 en annonçant 1 montage gardé ; garde retiré, il exit 1 en nommant `components/dev/UiDebugProbe.tsx: reached from app/layout.tsx`, contre épreuve faite puis garde remis ; dans le bundle client de production `isDevRuntime` se compile en `()=>!1`, donc ni `window.render_game_to_text` ni `window.render_ui_audit_to_text` n'y est jamais défini. **Reste ouvert** : le nouveau cas ne couvre que `components/dev/`, un module de `lib/dev/` hors sous dossier `typography` importé par du code produit n'est toujours vérifié par aucun check.
- **Tâche R7 faite : la suite end to end refuse d'écrire dans la base de production sans opt-in** (commit du jour, avec cette mise à jour). `tests/e2e/guard-database.ts` est branché en `globalSetup` de `playwright.config.ts` : sans `JDT_E2E_ALLOW_PROD=1`, la suite s'arrête avant tout test, rappelle le volume écrit (1 invité, environ 30 lignes de pool, 1 session jamais terminée, 2 lignes d'événements), affiche l'hôte et le nom de la base visés sans jamais montrer le mot de passe, et donne la commande exacte à taper. Le serveur de développement est retenu dans ce cas, parce que Playwright démarre ses plugins, dont le serveur web, **avant** le `globalSetup` : le plan annonçait un arrêt avant le démarrage du serveur, ce n'est vrai qu'avec cette retenue explicite, vérifié dans `node_modules/playwright/lib/runner/tasks.js`. **Preuves mesurées** : `npm run test:e2e` exit 1 avec le message et sans démarrer le serveur ; `JDT_E2E_ALLOW_PROD=1 npx playwright test tests/e2e/landing.spec.ts` exit 0, 3 tests verts en 5,0 s. **Rien n'a été écrit dans la vraie base** : la spec de landing ne démarre aucune session, et la spec de training n'a volontairement pas été relancée. **Reste ouvert** : le marquage `integrity_flags` à `["e2e"]` prévu par les étapes 2 à 4 du plan n'est pas fait, il demande d'écrire dans `lib/game/training/provider.ts`, gelé par consigne, donc les lignes d'un run autorisé restent indistinguables de vraies données de joueur ; l'isolation propre demande toujours une branche Neon de test, action du propriétaire.
- **État de la porte mesuré autour de ces deux tâches** : `npm run quality` exit 0 avant le commit R4 sur 11 étapes avec l'avertissement `PAPER` préexistant, puis exit 0 avant le commit R7 sur 12 étapes et zéro avertissement. Les étapes et l'avertissement ont changé entre les deux parce que les tâches R2, R3 et R5 du plan ont été committées en parallèle par une autre session (`e9f11c2`, `7e835f0`, `8ec3382`), qui a ajouté `check:latin-coverage` à la chaîne et verrouillé le lint à zéro avertissement.

## Journal — 2026-07-27 (outillage, licences, mise en ligne)

- **`CLAUDE.md` créé à la racine** (commit `ba44383`) : conventions du repo tirées de `docs/`, plus les règles de travail qui n'existaient que dans la mémoire locale de l'assistant, donc perdues au changement de machine.
- **`npm run quality` est VERT pour la première fois**, exit 0 sur 11 étapes. Trois causes réglées : le worktree imbriqué `.claude/worktrees/` que ESLint lintait entièrement (**413 erreurs et 5378 avertissements tombés à 0 et 1**, l'ignore `.next/**` est ancré à la racine et ne le couvrait pas), le contrat de motion qui exigeait encore `color: white` dans `.block-2` alors que la bichromie beige a posé `#f4f3ee` (contrat élargi aux deux, le rôle « bloc sombre à encre claire » est conservé), et l'erreur `react-hooks/set-state-in-effect` de `ProgressBoard.tsx` (passé en `useSyncExternalStore` pour la préférence de mouvement réduit, aucun changement visuel, la version naïve en initialiseur `useState` cassait le SSR).
- **Le build prod passait déjà.** La note du 29 juin sur `next/font` était périmée : zéro occurrence dans le repo, polices déjà auto-hébergées. Case corrigée en section G.
- **Garde-fou licence au runtime** (`lib/game/license-guard.ts`) : liste blanche `ofl` / `apache2` / `ufl` posée dans les deux seules requêtes qui exposent une typo à un joueur, `getPoolRows` (training) et `getCompetitionPoolRows` (competition). Nul, vide, `unknown`, `proprietary` et tout label futur échouent en fermé. Vérifié en lecture seule contre la base : **1172 typos servables avant, 1172 après**, et 1167 sans l'exception Ubuntu, donc l'exception sauve exactement les 5 attendues. Nouveau check `check:license-guard` branché dans la chaîne `quality`.
- **`license_url` renseigné sur 2027 des 2032 enregistrements** depuis le snapshot Google du projet (1975 OFL, 47 Apache, 5 UFL). Les 5 restants sont des polices système déjà désactivées.
- **`foundry` et `release_year` volontairement laissés vides**, ce n'est pas un oubli. Sur les 2027, le champ `copyright` dit « The X Project Authors » pour 1296, nomme une personne pour 560, et ne porte une raison sociale que pour 146 : un remplissage automatique aurait fabriqué de la fausse donnée. Et `date_added` est la date d'ajout chez Google, pas l'année de dessin, elle daterait Libre Baskerville de 2012. Proposition à trancher : ajouter une colonne `google_fonts_date_added`, renseignable sur 2002 du catalogue.
- **Suite de tests end to end créée** (`playwright.config.ts`, `tests/e2e/`) : 7 tests sur la landing, l'onboarding avec ses deux vraies portes, et une session training jusqu'à la réponse validée. Aucune dépendance ajoutée, le paquet `playwright` déjà présent embarque le runner. **L'instabilité du test training est diagnostiquée et corrigée.** Cause : `getByRole("radio", { name })` de Playwright fait une correspondance par **sous-chaîne** par défaut, et `pickDistractors` privilégie délibérément les distracteurs du même cluster visuel et de la même catégorie que la bonne réponse, donc des frères de superfamille. Quand la bonne réponse est préfixe d'un distracteur (« Alumni Sans » contre « Alumni Sans Inline One »), le locator résout deux radios et Playwright abandonne avant le clic. **137 des 1172 noms servables sont sous-chaîne d'un autre**, taux d'échec mesuré à 3,5 % par run, et le run fautif a été identifié nominativement en base. Corrigé en ciblant par index dans `question.options` plutôt que par libellé, donc insensible aux noms. **Réserve qui reste ouverte : la suite écrit dans la vraie base Neon à chaque run** (1 invité, 30 lignes de pool, 1 session jamais terminée, 2 lignes d'événements), sans distinction possible d'avec de vraies données de joueur.
- **Hook de typecheck automatique** posé dans `.claude/settings.local.json`, en async avec re-réveil sur échec, sur `PostToolUse` / `Write|Edit` pour les fichiers `.ts` et `.tsx`.
- **Lien `/compare` réparé.** La landing y pointait au CTA héros et au footer alors que seule `/compare/[slug]` existait : tous les visiteurs tombaient en 404. `app/compare/page.tsx` redirige vers la première comparaison publiée, sans slug en dur.
- **Pages d'erreur créées** : `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, coquille partagée `features/errors/`. Aucune couleur ni échelle typo inventée, uniquement des sélecteurs ajoutés dans des groupes de règles déjà validés. Textes dans `content/copy.ts`. Reste à trancher : le bouton principal suit la pilule crème de la landing, pas le dégradé jaune des écrans placeholder, les deux recettes se contredisant.
- **Migration `010_license_type_ufl.sql` écrite mais NON APPLIQUÉE** (ajout du label `ufl` à l'enum, bascule des 5 Ubuntu, vue QA alignée sur la liste blanche). Tant qu'elle n'est pas passée, ces 5 polices tiennent grâce à l'exception par slug dans le code. **Ordre impératif :** appliquer l'étape 1, puis basculer le JSON du catalogue sur `ufl`, sinon un réimport repousserait `unknown` par dessus.
- **Deux trouvailles.** `Gate.tsx`, 582 lignes importées par personne, et c'est pourtant lui que `check:contracts` vérifie. Et une incohérence dans le snapshot Google : `robotomono` est en dossier `ofl/` avec un `OFL.txt` SIL, mais son `METADATA.pb` déclare `APACHE2`.

## Journal — 2026-06-29 (grosse session)

- **Checklist** interactive créée (cet outil) + section transversale (légal/déploiement/SEO…).
- **Familiarité → seed Leitner** : câblé bout-en-bout, **migrations 004 & 005 appliquées** en base, testé. Seed élargi tier N+D → skew débutant/designer réel.
- **Audits correctifs** (la réalité ≠ ce qu'on croyait) : badges (B2) & streak/objectif (A4) étaient **déjà faits** ; **mode Expert = coquille** (placeholder, aucun jeu) ; les **23 licences « unknown » = toutes OFL** (libre, vérifié via le snapshot Google).
- **F5 — vague typos : 81 → 1172 jouables.** Tout le non-display converti + **sous-ensemblé Latin** (35 Mo au lieu de 356), activé en base, **durable** (catalogue source synchronisé), **familles corrigées** via Google `METADATA.pb`.
- **Recherche juridique** sur les typos commerciales/Adobe → voir ci-dessous.
- ~20 commits, **tous locaux** (le `push` GitHub attend tes identifiants).

## NOTE HYPER IMPORTANTE — montrer des typos commerciales / Adobe (légal + business)

**Le fichier de police = logiciel protégé.** Le **télécharger/posséder sans licence est illégal**, même sans le « servir » (procès réels, ex. Font Bureau/P22 vs NBCUniversal = 2 M$). → **On ne peut PAS** mettre des polices Adobe/payantes dans nos dossiers. (Libres OFL/Apache = OK, c'est ce qu'on a.)

**Mais une licence _desktop_ autorise à rendre des IMAGES** (PNG/SVG) et à les utiliser commercialement — **sauf** montrer « la totalité des caractères ». → **mot-spécimen = OK** ; alphabet complet = interdit. Le jeu de reconnaissance (un mot → devine) rentre dans le permis ; la page `/type` (alphabet) non, pour les commerciales.

**→ Stratégie « mode grandes typos commerciales » (légal + monétisation) :**
1. liste curée d'iconiques (Helvetica, Futura, Gotham, Avenir…) ;
2. copie **légitime** : acheter une licence desktop OU assets de preview via affiliation — **jamais** de fichier non licencié ;
3. **rendre des images de MOTS** (pas l'alphabet) → stocker les **images**, pas les polices ;
4. afficher l'image + **lien d'affiliation** → couverture juridique (les fonderies veulent l'expo) **+ revenu** : **Monotype/MyFonts ~10 %**, **Fontspring 20 %**.

**Cas Adobe (comment les obtenir) :** PAS via Adobe Fonts / Creative Cloud (abonnement, interdiction d'extraire/héberger, aucune licence perpétuelle). Acheter la **licence desktop perpétuelle** de la typo précise chez un **revendeur** — **Type Network** (boutique officielle Adobe Originals) ou **MyFonts/Monotype** — ou via **Adobe Font Folio** (collection perpétuelle). Avec licence desktop, les revendeurs autorisent même le « subset en PDF non-éditable pour usage commercial » → donc **rendre des images/tracés = OK**. (Et **Source Sans / Serif / Code**, polices Adobe **libres**, sont déjà dans le catalogue.)

**Affiliation Adobe = OUI** (programme officiel, géré par Partnerize) : commission quand un joueur **s'abonne à Creative Cloud** (qui inclut Adobe Fonts) via ton lien — **~85 % du 1er mois**. → bouton « obtiens-la sur Adobe Fonts ». Avantage : en tant que partenaire qui leur amène des abonnés, **montrer leurs polices sert LEURS intérêts** (pub pour eux). Pour acheter UNE typo Adobe à vie → MyFonts/Monotype (aussi affilié). L'affiliation rapporte de l'argent mais ne « donne » pas automatiquement le droit d'afficher — ça reste l'usage « petite image, pas le fichier » ; demander des **visuels d'aperçu officiels** au programme.

Zone grise en **UE** (la France protège davantage les dessins de caractères) → **avis juridique avant lancement commercial**. (Ceci n'est pas un avis légal.)

**Démarche partenariat cadrée** (2026-07-07) : voir `docs/overview/partenariat-adobe.md` — à qui s'adresser (Partnerize/Type Network/MyFonts/Fontspring), quoi demander (affiliation + visuels officiels + droit d'affichage), argumentaire, séquencement (libre d'abord, commerciales/Adobe en phase 2 avec du trafic), et liste d'actions.

**Deck de pitch Adobe** (2026-07-07) : 11 slides dans Figma (Drafts). Fichier : https://www.figma.com/design/q1K9Z782nLKcrBHzpqO1RA. DA fidèle à la landing : bichromie beige #f4f3ee + noir, jaune réduit au strict minimum (juste la bordure or authentique du plateau), titres serif Playfair, vrai wordmark Dwiggins (SVG) en tête, footer mono à la signature landing ("© 2026 DWIGGINS · JEUX DE TYPO"). Structure : Cover, le jeu, how it works, l'œil/anatomie, compare, la librairie, l'audience/funnel, la demande de partenariat, le modèle commercial, roadmap+CTA, + slide de clôture = footer crème de la landing (wordmark noir, tagline, colonnes, strip mono). Démos animées = **vrais GIF de l'animation du site** capturés via Playwright sur localhost:3002 (jeu slide 3, compare slide 5), ré-encodés propres, uploadés dans Figma (s'animent dans l'éditeur). Reste : contact réel sur la CTA, éventuelle version FR. Pipeline GIF réutilisable : `scratchpad/capture-demo.js` (Playwright) + magick + upload_assets Figma.

---

## A — Profil & progression joueur

- [x] **Page profil — 6 onglets opérationnels** (Parcours, Profil, Stats, Activité, Succès, Préférences) · `Fait`
  - `app/profile/page.tsx`, `features/profile/components/ProfileExperience.tsx`
- [x] **Constellation DWIGGINS (la carte du regard)** · `Fait` — branchée sur le vrai EyeProfile.
  - `features/profile/components/ProgressConstellation.tsx`
- [ ] **Arène (côté profil) : classements + historique réels** · `À faire`
  _Placeholder assumé — se réveille après le lancement (dépend d'une population de joueurs)._
  - `features/profile/components/ProfileSummary.tsx`
- [x] **Streak + objectif quotidien réels** · `Fait` — déjà câblé (vérifié par lecture du code, 2026-06-29).
  _`loadRealProfile` calcule le streak depuis l'activité (issue de `user_event_fact`), le record, et `dailyGoal = { done: sessions du jour, target: 3 }`, puis les pose sur l'EyeProfile + le profil (`profile-stats.ts` §307-342, 385-386). Le « 0 en dur » ne subsiste que dans le **mock** (fallback)._
  - `lib/profile/profile-stats.ts`
  - [x] Streak calculé depuis l'activité (`user_event_fact`)
  - [x] Objectif quotidien (done / target) calculé
  - [x] EyeProfile + profil alimentés par ces valeurs réelles (0 en dur seulement dans le mock fallback)
- [ ] **Économie « jetons » (coins)** · `À faire` — `coins:0` en dur, pas encore d'économie de jeu.
  - `lib/profile/mock-profile.ts`
- [ ] **Page Règles : expliquer les règles du jeu au joueur** · `À faire`
  _Des règles par mode existent déjà (`/play/*/rules`) — à unifier ou faire une page Règles claire._
- [ ] **Page Profil : expliquer comment on monte** · `À faire`
  _Présenter les groupes + la méthode d'apprentissage, et comment on progresse._
  - [ ] Expliquer les groupes (axes / familles de typos)
  - [ ] Expliquer la méthode (boîtes Leitner / répétition espacée)
  - [ ] Montrer comment on monte (maîtrise, paliers qui s'allument)

## B — Badges

- [x] **Système de badges — 15 badges, raretés, moteur d'art SVG** · `Fait`
  UI + génération visuelle complètes (common → mythic).
  - `features/profile/components/AchievementsBoard.tsx`, `lib/brand/dwiggins-badge-engine.ts`, `lib/profile/badge-rules.ts`
- [x] **Brancher les métriques de badges sur les vraies données** · `Fait` — déjà câblé (vérifié par lecture du code, 2026-06-29).
  _Le chemin réel `loadRealProfile` (`lib/profile/profile-stats.ts` §344-388) dérive les **8 métriques** des vraies données DB (paliersLit, axesLit, roundsWon, typefacesSeen, bestSessionAccuracy, streakDays, fastAnswers, displayMastered) puis appelle `buildBadges`. `app/profile/page.tsx` appelle bien `loadRealProfile(userId)`. `MOCK_BADGE_METRICS` ne sert plus que de **fallback** zéro-historique (à garder)._
  - `lib/profile/profile-stats.ts`, `lib/profile/badge-rules.ts`, `app/profile/page.tsx`
  - [x] Les 8 métriques de badges dérivées des vraies données DB
  - [x] `buildBadges` appelé sur les vraies métriques (+ page profil branchée sur `loadRealProfile`)
  - [x] Mock conservé uniquement comme fallback zéro-historique (par design)
- [ ] **Revue visuelle des badges (en cours, 2026-07-06)** · page de revue partagée en artifact (rendu réel : 12 shippés + 21 candidats labo + éditorial).
  _Piste 1 REVERTÉE : j'avais élagué le labo (mascottes die-cut, mono « W ») et diversifié les formes des 12 shippés + nettoyé le sceau. Rejeté : le user adorait des candidats supprimés, et trouvait les 12 diversifiés fades. `git checkout` sur `badge-rules.ts`, `BadgeStickerLab.tsx`, `dwiggins-badge-engine.ts`, tout est revenu à l'état committé._
  _Direction user à appliquer : (1) NE PAS supprimer de candidats, il veut choisir lui-même ; (2) rareté par couleur PLEINE (si bleu, tout le badge bleu, pas juste le mascotte bleu sur disque noir) ; (3) référence qualité = les lockups éditoriaux (« ceux d'en bas beaucoup mieux faits »). Attendre son go sur quoi produire._

## C — Onboarding

- [x] **Flow en 4 étapes** (UI jouable, mini-test inclus) · `Fait`
  - `features/onboarding/components/OnboardingFlow.tsx`, `features/onboarding/components/OnboardingWarmup.tsx`
- [x] **Stockage du niveau de familiarité (localStorage)** · `Fait`
  - `features/onboarding/components/OnboardingFlow.tsx`
- [x] **Brancher familiarité → seed des boîtes Leitner dans /game** · `Fait` — câblé + migrations 004 & 005 appliquées ; skew confirmé (2026-06-29).
  _**Fait** : câblage bout-en-bout (5 fichiers, typecheck OK, repli sûr), **migration 004 appliquée en base** (colonne `onboarding_familiarity` + fonction `init_user_pool(uuid, text)` confirmées), et **testé en lecture seule**._
  _**Le test a révélé que le skew était inerte** : le set éligible (tier N · common · actif) ne comptait que **25 typos** < les 30 seedées → même pool pour tous._
  _**Correctif trouvé & écrit (`db/migrations/005_seed_pool_widen.sql`)** : élargir l'éligibilité à **tier N+D common** (~55 typos actives, déjà runtime-ready — aucune conversion). C'est conforme à la spec moteur (`training-engine-spec-v2-clean.md §3` : compléter avec tier D common). Prévisualisé en lecture seule : **débutant 16 easy/14 med · designer 3 easy/27 med** → vraie différence. Aucun changement de code (la fonction est juste remplacée)._
  - `db/migrations/005_seed_pool_widen.sql`, `features/game/components/GameScreen.tsx`, `app/api/training/session/start/route.ts`, `lib/game/training/provider.ts`, `lib/game/training/contracts.ts`
  - [x] Lire la familiarité (localStorage) et l'envoyer au démarrage de session
  - [x] Câbler le training provider + repli sûr (code)
  - [x] Appliquer la migration 004 en base (colonne + fonction `init_user_pool(uuid, text)`)
  - [x] Tester les 4 niveaux (lecture seule) — révèle l'inertie
  - [x] Diagnostic + correctif écrit : migration 005 (seed élargi N+D common, conforme spec, prévisualisé OK)
  - [x] **Migration 005 appliquée en base + skew confirmé** (débutant facile-lourd vs designer moyen-lourd)
  - _Nuances honnêtes : (1) l'effet ne concerne que les **nouveaux** joueurs — les pools déjà seedés ne sont pas refaits ; (2) spread easy/medium seulement (pas de `hard` en tier N+D — raffinement futur possible en incluant tier C)._

- [x] **Étape « A first look » alignée pixel-près sur la landing** · `Fait` (2026-06-30)
  _DA : la landing est la référence sans exception. La carte de l'onboarding (warm-up) reprend désormais la carte « how it works » de la home **à l'identique** : suppression des overrides `onboarding-warmup-*` (fond near-black, padding/gap serrés, hints) → la carte hérite verbatim de `.lp-demo-board` / `.lp-demo-opt` (bordure dorée, verre crème, ombres, grille 2x2, barres d'accent, tailles de typo). Comme la page onboarding est déjà en noir, le verre crème rend comme sur la landing (pas de forçage beige)._
  _**Colonne de gauche** : discours adapté au ton onboarding (« premier regard », pas de score, observer) en gardant **les tailles et le nombre de caractères de la landing 1:1** (titre L2 ≈ 22 car., lede ≈ 147) → wrap identique, zéro décalage. Titre « You see a word. / You learn to read it. » ; lede « No score here — just notice the letters. Look where the strokes end — the bowls, the terminals, the contrast. Wrong turns red, right turns green. »._
  _**Carte (droite)** : à l'origine le bloc landing verbatim (prompt « Which typeface is this? », mot « Aperture », réponses Playfair Display · PT Serif · Libre Baskerville · Lora). **Contenu remplacé depuis** (2026-07-06) par un rendu adaptatif à la familiarité (`getWarmupRound`) : la carte n'affiche plus le placeholder « Aperture » / « Which typeface is this? » de la landing. Détails à l'item « Warm-up adaptatif à la familiarité » plus bas._
  - `app/globals.css` (overrides `onboarding-warmup-*` supprimés), `features/onboarding/components/OnboardingWarmup.tsx`, `features/onboarding/components/OnboardingFlow.tsx`
  - _Vérifié visuellement (Playwright, 1440px) : carte onboarding superposable à la section « how it works » ; typecheck + lint + check:copy OK, check:typography-contract BLOCK 0._

- [x] **Onboarding non scrollable (verrou plein écran)** · `Fait` (2026-07-02)
  _Consigne : rien ne doit scroller sur l'onboarding. `.onboarding-page` passe de `min-height: 100svh` à `height: 100svh` (+ `overflow: clip` déjà présent + `overscroll-behavior: none`) : l'élément ne peut plus dépasser la fenêtre, donc le document reste bloqué et le contenu se centre/compresse dedans. Mesuré (Playwright) : `docScrollable=false` et `scrollY=0` même après molette, à toutes les tailles testées (900 → 520px de haut) ; bouton Continue toujours visible. Vaut pour les 4 étapes._
  - `app/globals.css` (`.onboarding-page`)

- [x] **Warm-up adaptatif à la familiarité** · `Fait` (2026-07-06)
  _Le rendu du warm-up dépend désormais du niveau déclaré. Nouveau module `features/onboarding/warmup-rounds.ts` (`getWarmupRound(familiarity)`) branché dans `OnboardingWarmup.tsx`, en remplacement de l'ancien `buildRound` qui ignorait la familiarité. Échelle par niveau, appuyée sur le vrai catalogue : Not at all = mot « Reading » en Libre Baskerville, question catégorie, réponse Serif ; A little (défaut) = « Layout » en Poppins, réponse Sans-serif ; Quite familiar = « Fashion » en Playfair Display, « Which serif style is this? », réponse Didone ; Designer = « Grotesk » en IBM Plex Sans, « Which face is this? » parmi IBM Plex Sans / Roboto / Inter / Work Sans (terminaisons coupées à plat). 4 options fixes (grille 2x2), palette d'accent conservée. typecheck OK._
  - `features/onboarding/warmup-rounds.ts`, `features/onboarding/components/OnboardingWarmup.tsx`

- [x] **Invite au clic + affordance sur les manches interactives** · `Fait` (2026-07-06)
  _Le mode débutant (« Not at all ») était clair (ghost-cursor auto : on regarde), mais les manches jouables n'indiquaient pas qu'il faut cliquer. Ajout d'un hint « Your turn, tap the answer you think fits. » (modes non débutants) dans `OnboardingWarmup.tsx`. Côté `globals.css` : au survol la carte se soulève et sa bordure passe au jaune DWIGGINS (rgba(255,210,19,.5)), anneau de focus `--accent-yellow`. Les états correct / wrong gardent leur couleur._
  - `features/onboarding/components/OnboardingWarmup.tsx`, `app/globals.css`

- [x] **Bug de police du warm-up corrigé (mots héros en serif de secours)** · `Fait` (2026-07-06)
  _Les mots héros s'affichaient en serif de secours faute de glyphes. Cause : `scripts/mirror_fonts.py` fixe `runtimePath = runtimeFiles[0]` (le split au plus petit hash), qui pour poppins / ibm_plex_sans / playfair_display / libre_baskerville tombait sur un fragment quasi vide (juste l'espace, ou « a, b »). Correctif : re-subset des 4 faces en Latin complet (U+0020..007E) via fontTools, nouveaux fichiers dans `public/fonts/<slug>/`, `runtimePath` mis à jour dans `content/typefaces/font-manifest-v4.json`. Couverture des glyphes de « Reading / Layout / Fashion / Grotesk » vérifiée, polices en HTTP 200._
  _Bug latent noté : `mirror_fonts.py` recasserait ces faces à une prochaine exécution tant qu'il ne sait pas choisir le split qui couvre le Latin (raffinement futur, faible priorité)._
  - `scripts/mirror_fonts.py`, `content/typefaces/font-manifest-v4.json`, `public/fonts/<slug>/`

- [x] **Bouton onboarding en beige de marque + descendu** · `Fait` (2026-07-06)
  _`.onboarding-btn--solid` quitte le bleu-blanc froid (inventé) pour les tokens de marque : `linear-gradient(--beige-raised, --beige)`, texte `--noir`, bordure `--line`. `.onboarding-actions` reçoit `margin-top: clamp(0.6rem, 1.8vh, 1.25rem)` pour descendre le bouton._
  - `app/globals.css`

- [x] **Migration 006 appliquée : seed cold-start 4 niveaux distincts** · `Fait` (2026-07-06)
  _`db/migrations/006_seed_pool_four_level.sql` : `CREATE OR REPLACE` de `init_user_pool(uuid, text)`. Avant, la 005 restait binaire (Not at all = A little, Quite familiar = Designer, zéro hard) ; la 006 donne 4 seeds distincts sur 30 faces (easy / medium / hard) : Not at all 22/8/0, A little 12/18/0, Quite familiar 4/20/6, Designer 2/16/12. Le palier hard vient du tier C (uncommon, 18 faces runtime-ready), ouvert au SEED des seuls niveaux avancés (déviation assumée de la spec §7.2 ; la checklist prévoyait déjà « inclure tier C » pour le hard, voir la nuance de l'item seed plus haut). N'affecte que les nouveaux cold-starts. Vérifié en lecture seule : la fonction live est bien la version 4 niveaux._
  - `db/migrations/006_seed_pool_four_level.sql`

- [ ] **Moteur d'auto-correction : niveau vécu ≠ niveau déclaré** · `En cours` (2026-07-07)
  _**Avancement 2026-07-07** : les étapes 1, 2, 3 et 5 sont construites et actives ; il ne reste que l'étape 4 (rééquilibrage additif du pool), dont la migration 007 est écrite mais pas encore appliquée en base. Détail complet et fichiers à l'item « Moteur d'auto-correction construit » de la section F._
  _Le niveau déclaré n'est qu'un prior de CONTENU (quelles faces) gelé après le seed ; tout le monde démarre à maîtrise 0. Conséquence : un faux expert reste coincé sur du dur sans jamais redescendre. Plan réutilisant le modèle Leitner déjà calé, à séquencer 1+2+3 (sûr) puis 4 : (1) activer `adaptive_coef` (colonne existante, jamais écrite) ; (2) intervalles indexés sur la maîtrise (spec §4.1, non implémentée) ; (3) exploiter le résultat du warm-up d'onboarding (aujourd'hui jeté) pour ajuster la familiarité effective avant le seed ; (4) rééquilibrage ADDITIF du pool vers le facile si les ~8 à 12 premières réponses sont mauvaises (jamais retirer de face, invariant I-06) ; (5) surface de progression en jeu en réutilisant le eye level / % maîtrisé déjà calculés sur le profil._
  _Anti-triche : la variation in-game est déjà satisfaisante (graine par session qui randomise l'ordre des faces, la position de la bonne réponse et le mot ; la réponse EST la police affichée, pas de clé cachée). Seul le warm-up d'onboarding est un script partageable (`correctIndex` fixe), enjeu faible._

- [ ] **Croissance du pool (I-07 + fallback §4.5) : plus jamais de pool gelé** · `En cours` (2026-07-07)
  _Le pool restait gelé au seed (aucune entrée), en contradiction avec I-07. Écrit `db/migrations/008_pool_growth.sql` (pas encore appliquée) : colonne `users.pending_unlock_count`, valeurs enum `pool_recovered_by_unlock` / `pool_recovered_by_cursor_jump`, fonctions `try_unlock_one_typeface` (sélection §7.2 à la lettre) et `register_mastery_unlock` (compteur + unlock atomiques). Câblage `lib/game/training/provider.ts` fail safe : déclencheur I-07 au franchissement mastery 3 vers 4 dans `submitTrainingAnswer`, fallback §4.5 `recoverPoolIfStuck` avant chaque construction de question (unlock silencieux puis saut de curseur, jamais de rupture I-01/I-02). Add only, respect strict de I-06. Typecheck et lint scoped OK. Preview lecture seule : 724 candidates pour un pool N, diversification par sub_category validée. Doc : `docs/game/pool-growth.md`._
  - `db/migrations/008_pool_growth.sql`, `lib/game/training/provider.ts`, `docs/game/pool-growth.md`
  - [ ] Appliquer la migration 008 en base (feu vert user requis)

- [ ] **Niveau global visible N.1 à E.5 : la difficulté du pool grimpe enfin** · `En cours` (2026-07-07)
  _`users.dreyfus_level` était une colonne morte (jamais écrite, figée à `N`), donc 008 ne débloquait que des typos tier N et `POOL_TARGET_BY_TIER` restait à 30 : le pool grandissait en nombre mais jamais en difficulté. Écrit `db/migrations/009_global_level.sql` (pas encore appliquée) : garde `ADD COLUMN IF NOT EXISTS dreyfus_sub` (no-op, 003 la définit déjà), fonction `recompute_visible_level` (agrégation des mastery_level du pool actif, recalcul par réponse N-22, régression bornée à un sous-niveau P-04, lecture seule du moteur I-08), vue de preview `v_user_visible_level`. Formule = hypothèse documentée (la spec ne donne que « Agrégation des mastery_level », ligne 708) : `p = (frac≥3 + frac≥4) / 2` mappé sur 25 crans N.1 à E.5, monotone. Câblage `lib/game/training/provider.ts` fail safe : `safeRecomputeVisibleLevel` après chaque réponse dans `submitTrainingAnswer`, baseline lecture seule au démarrage. Payload étendu (`contracts.ts` : `visibleLevel`, `levelChanged`) et toast N-24/N-25 dans `GameScreen.tsx` (pilule jaune, jamais d'affichage continu). Typecheck et lint scoped OK. Preview lecture seule : tous les users de test à N.1 (0 mastery ≥ 3), mapping validé sur tout l'intervalle. Doc : `docs/game/global-level-progression.md`._
  - `db/migrations/009_global_level.sql`, `lib/game/training/provider.ts`, `lib/game/training/contracts.ts`, `features/game/components/GameScreen.tsx`, `app/globals.css`, `docs/game/global-level-progression.md`
  - [ ] Appliquer la migration 009 en base (feu vert user requis)

## D — Pages typo (compare + spécimen)

- [x] **Pages Compare — 4 stages** : ouverture, contraste, terminaisons, hauteur d'x · `Fait` — aucun placeholder.
  - `app/compare/[slug]/page.tsx`, `lib/typography/compare-page-helpers.ts`
- [x] **Annotations + superposition de mots** · `Fait`
  - `components/typography/MeasuredGlyphSplit.tsx`, `lib/typography/word-overlay-engine.ts`
- [x] **Page Spécimen `/type/[slug]`** (hero, testeur, anatomie, fiche) · `Fait`
  - `app/type/[slug]/page.tsx`
- [ ] **Harmoniser la DA des pages typo avec le reste** · `À faire` — incohérences couleur déjà recensées.
  _Palette success / error tranchée le 2026-07-07 : vert « correct » canonique `#00c853`, rouge « erreur » canonique `#ff0000`, neutre chaud `#2a1a20` officialisé. Doublons Tailwind `#22c55e` et `#ef4444` supprimés (CSS mort, vestige de l'ancienne étape « micro » remplacée par le warm-up) ; le mint inventé `#9ef0d4` repointé sur le token canonique ; `#21785e` gardé comme variante lisible sur fond beige clair ; `#40d38f`, `#67d6b6`, `#f39ab1` intacts (rôles distincts, pas « success »). Reste l'harmonisation DA plus large des pages typo. Fichiers : `app/globals.css`, `docs/ui/ui-palette-reference.md`._
  - `app/globals.css`, `docs/ui/ui-palette-reference.md`
  - [x] Choisir 1 vert canonique : `#00c853` (3 familles avant)
  - [x] Choisir 1 rouge canonique : `#ff0000`
  - [x] Officialiser le neutre chaud `#2a1a20` (vs noir pur)
  - [x] Officialiser ou retirer le rose `#F39AB1` (gardé, rôle distinct)
  - [ ] Appliquer dans `globals.css` + mettre à jour le contrat UI
- [x] **Nav partagée alignée sur la home (DA + outils) sur `/compare` et `/type`** · `Fait` (2026-06-29)
  _La nav des pages typo était restée sur l'ancien skin « néon noir » (fond `#000`, glow, wordmark ivory, CTA clair) alors que la home (`lp-header`) est la **référence DA**. Refondue en **composant partagé `SiteNav`** (`components/ui/SiteNav.tsx`) → une seule source de vérité, appliquée via les templates `[slug]`, donc les **~2000 pages specimen `/type` l'héritent sans travail par-slug** (« calibré »)._
  _**DA** = pill crème `lp-header` : fond `#f4f3ee`, encre `#141019`, glow/`::before`/`::after` retirés, wordmark **noir + figures**, CTA **foncé**, ThemeSwitch dans le pill. Classe CSS renommée `compare-site-nav` → `site-nav`._
  _**Outils** = repris de la home verbatim : liens **How it works / Compare / Typefaces / Modes** (ancres `/#…`) + CTA **Start training** (`/onboarding`). (`/type` n'avait aucune nav avant, juste un ThemeSwitch flottant.)_
  _Typecheck OK. Vérifié à l'écran : home (réf) intacte, `/compare`, `/type/inter` (fond noir) et `/type/helvetica-neue` rendent une nav identique. Piège rencontré : le dev server servait un CSS périmé après le renommage de classe (HMR CSS manqué) — re-déclenché par un édit trivial de `globals.css`._
  - `components/ui/SiteNav.tsx`, `app/globals.css` (`.site-nav*`), `app/compare/[slug]/page.tsx`, `app/type/[slug]/page.tsx`
- [x] **Page Compare alignée sur le langage de la home + plus de blanc pur** · `Fait` (2026-06-30)
  _Passage DA sur `/compare` pour matcher la home (réf) : chips métadonnées multicolores (bleu/vert/or) → **pastilles beige `#f4f3ee` à texte noir** ; eyebrow « Guided comparison » vert → gris discret ; **suppression du bloc texte sous le titre** (directive + « Corpus cue… » + « Best entry: glyph · a ») qui faisait doublon avec le « Comparison stage » juste dessous (+ code mort retiré : `unifiedHeroNote`, `corpusPedagogyLine`, `heroSupportLine`, `fallbackIntro`, import `buildCorpusPedagogyLine`)._
  _**Sweep « plus de blanc pur » (tout le site)** : `#fff`/`#ffffff`/`rgba(255,255,255,a)`/`white` → beige de marque `#f4f3ee` (rgb 244,243,238) dans `globals.css` + composants user-facing (Gate, CompetitionScreen, profil, TypefaceTester). `white-space` et commentaires épargnés ; labs `/dev` volontairement non touchés. Doc palette mis à jour (`docs/ui/ui-palette-reference.md`)._
  _Reste pour finir D4 : trancher 1 vert / 1 rouge canoniques + le rose `#F39AB1`. Typecheck OK._
  - `app/globals.css`, `app/compare/[slug]/page.tsx`, `docs/ui/ui-palette-reference.md`
- [ ] **Finir le blanc → beige sur les labs `/dev`** · `À faire` (plus tard)
  _Le sweep blanc → beige a été fait sur tout le site user-facing (2026-06-30) ; restent les **outils internes `/dev`** encore en `rgba(255,255,255,a)` : `TypefaceProfileLab`, `FallbackCalibrationLab`, `GlyphAuditMatrix`, `WordAuditMatrix`. Non bloquant (pas vus par les joueurs) — à passer pour cohérence quand on y touchera._
  - `components/dev/typography/*`

## E — Légal & marque · le chantier urgent avant mise en ligne

- [ ] **Régler la typo du logo (PP Frama, propriétaire)** · `Bloqueur`
  _Servie à tous les visiteurs sans licence webfont._
  - `public/fonts/brand/PPFrama-*.otf`
  - [ ] Retrouver / contrôler la licence PP Frama actuelle
  - [ ] Vérifier les droits webfont en usage commercial
  - [ ] Acheter la licence **OU** choisir une font libre de remplacement
  - [ ] Ajouter le fichier LICENSE + attribution
- [x] **Régler les 23 typos actives en licence « unknown »** · `Fait` (2026-06-29) — trou de données, pas un risque légal. **23 passées en OFL** ; restent seulement 5 Ubuntu (licence UFL = libre, mais l'enum n'a pas « ufl »).
  _Les 23 sont **toutes des Google Fonts** (`font_source=google`) : Inter, Roboto, Montserrat, Open Sans, Lato, Poppins, Merriweather… Le champ `license_type` n'avait juste jamais été rempli sur ce lot d'origine._
  _**Vérifié contre le snapshot Google Fonts du projet** (`02_ASSETS_TYPO/google_fonts/.../fonts-main`) : les **23 sont en dossier `ofl/` → licence OFL** (SIL Open Font License, libre, usage commercial OK). Aucune en apache/ufl. Donc plus un bloqueur — juste à remplir le champ._
  - `content/catalog/overrides/typefaces-core.overrides.json`, `content/catalog/typefaces-core.json`
  - [x] Lister les 23 typos actives en licence unknown
  - [x] Retrouver la licence de chacune — **toutes OFL** (confirmé via le snapshot Google Fonts du projet)
  - [x] **Posé `license_type='ofl'` sur les 23** (base + override + build, commit `0584549`)
  - [x] Vue QA : reste seulement 5 Ubuntu (UFL/libre, hors enum) — tout le reste en OFL, aucun risque
- [ ] **Remplir `license_url` / `foundry` / `release_year`** · `En cours` (2026-07-27) : `license_url` fait, `foundry` et `release_year` volontairement laissés vides, décision à trancher
  _**`license_url` : 2027/2032 renseignés** (les 5 restants sont les polices système locales arial, courier_new, georgia, helvetica, times_new_roman, absentes du snapshot et déjà désactivées). Valeurs déduites du dossier de licence dans le snapshot du projet (`02_ASSETS_TYPO/google_fonts/06_repo_snapshot/fonts-main`) : `ofl/` 1975 vers `https://openfontlicense.org/`, `apache/` 47 vers `https://www.apache.org/licenses/LICENSE-2.0`, `ufl/` 5 vers `https://canonical.com/legal/font-licence`. Chaque URL est citée telle quelle dans les textes de licence du snapshot. Les 2027 ont au moins une source corroborante en plus du dossier : fichier de licence présent (2018) ou champ `license` du `METADATA.pb` (9 sans fichier)._
  _**`foundry` laissé vide, choix assumé** : le seul champ disponible est `designer` du `METADATA.pb`, qui nomme une personne, pas une fonderie (« Marcelo Magalhães » n'est pas une fonderie). Le champ `copyright` n'est pas exploitable en masse : sur 2027, 1296 disent « The X Project Authors » (aucune fonderie), 560 nomment une personne, 146 seulement portent une raison sociale (Ltd, Inc, GmbH, Corp, Foundry) noyée dans du texte libre avec mails et clauses Reserved Font Name. Un remplissage automatique produirait de la donnée fausse. Reste faisable à la main sur un petit lot avéré (exemple : Indian Type Foundry, 19 polices)._
  _**`release_year` laissé vide, choix assumé** : `date_added` est la date de mise en ligne chez Google (plage 2010-02-19 à 2026-02-25), pas l'année de dessin. La renseigner daterait Libre Baskerville de 2012 au lieu du XVIIIe siècle. Aucune source d'année de création dans le snapshot._
  _**Proposition ouverte** : plutôt que de tordre les deux champs existants, ajouter une colonne honnête `google_fonts_date_added date` et finir de remplir `designer` (déjà rempli sur 1979/2032 ; le snapshot en fournit un pour 2002, dont 1147 des 1172 servies, et **zéro divergence** avec les valeurs déjà en place). Les 23 slugs d'origine sont les seuls à avoir un `designer` vide alors que le snapshot en donne un. Changement de schéma, donc décision du propriétaire._
  - `content/catalog/overrides/typefaces-core.overrides.json`, `content/catalog/typefaces-core.json`
- [x] **Garde-fou : ne jamais servir une typo « unknown » au runtime** · `Fait` (2026-07-27)
  _Le filtre est posé dans les **deux requêtes de pool** qui décident ce qu'un joueur peut voir (bonne réponse et distracteurs sortent du même lot) : `getPoolRows` (training) et `getCompetitionPoolRows` (competition). Pas dans un composant : un garde-fou contournable ne sert à rien._
  _**Liste blanche, pas liste noire** : seules `ofl`, `apache2`, `ufl` passent, comparées en `license_type::text`. Nul, vide, `unknown`, `proprietary` et tout label ajouté plus tard échouent en fermé. Source de vérité unique : `lib/game/license-guard.ts`._
  _**Cas Ubuntu (5 polices, licence UFL, libre)** : l'enum `app.license_type_enum` n'a pas de valeur `ufl`, ces 5 lignes valent donc encore `unknown` et la liste blanche seule les exclurait à tort. Exception explicite par slug dans le garde-fou, documentée et supprimable. Migration `010_license_type_ufl.sql` écrite pour ajouter le label et passer les 5 en `ufl`, **non exécutée** (base en prod, feu vert propriétaire)._
  _**Vérifié en lecture seule sur la base réelle** : pool competition avant 1172, avec garde-fou 1172 (aucune régression), sans l'exception Ubuntu 1167. `lint` et `typecheck` OK._
  _Nouveau check maison `scripts/quality/check-license-guard.mjs` (ni build ni base) : échoue si une requête perd la clause, ou si une typo servie n'a pas une licence validée. **Branché dans `npm run quality`** (vérifié le 2026-07-28 dans `package.json`, il tourne juste avant `build`)._
  - `lib/game/license-guard.ts`, `lib/game/training/provider.ts`, `lib/game/competition/provider.ts`, `scripts/quality/check-license-guard.mjs`, `db/migrations/010_license_type_ufl.sql`
- [ ] **Livrer le fichier de licence avec chaque police auto-hébergée** · `À faire` — mesuré le 2026-07-28, avant mise en ligne.
  _La licence OFL autorise tout ce que fait le projet, afficher, auto-héberger, sous-ensembler en latin, publier des pages, monétiser, et n'exige aucune mention dans le pied de page du site. Sa seule condition de redistribution est que **le texte de la licence accompagne les fichiers de police**. Or auto-héberger, c'est redistribuer._
  _**État mesuré : 1179 dossiers dans `public/fonts`, zéro fichier de licence dedans.** Les deux résultats que remonte une recherche naïve sont un faux positif, une police qui s'appelle `oflsortsmillgoudytt`._
  _Ce n'est pas un sujet de SEO ni de pages futures, ça concerne le jeu tel qu'il existe déjà, et c'est un préalable de mise en ligne au même titre que le RGPD. La donnée nécessaire existe : `license_url` est renseigné sur 2027 des 2032 enregistrements, et l'instantané Google du projet contient les fichiers `OFL.txt` d'origine. Correction mécanique et vérifiable par commande, donc candidate directe à la boucle autonome : chaque dossier de `public/fonts/<slug>/` doit contenir le fichier de licence de sa police, et un check doit échouer si un dossier en manque._
  _Piège connu, déjà consigné plus haut : `robotomono` est rangé dans le dossier `ofl/` de l'instantané avec un `OFL.txt`, alors que son `METADATA.pb` déclare `APACHE2`. Trancher au cas par cas sur la source, pas sur le dossier._
  - `public/fonts/`, `scripts/mirror_fonts.py`, `content/catalog/typefaces-core.json`

## F — Back & « implémenter toutes les typos »

- [x] **DB Neon + schéma + providers training/competition** · `Fait`
  Plus solide qu'il n'y paraît : DB réelle, sélection adaptative, télémétrie écrite.
  - `lib/server/neon.ts`, `lib/game/training/provider.ts`, `lib/game/competition/provider.ts`
- [x] **Agrégation EyeProfile** (`buildEye` lit la vraie DB) · `Fait`
  - `lib/profile/profile-stats.ts`
- [ ] **Trancher : `mastery_level` (0-4) ↔ boîtes Leitner (0-5)** · `À faire`
  _Décision d'architecture à prendre avant de figer le scoring._
  - `docs/process/backend-todo.md`
  - [ ] Choisir la voie (garder `mastery_level` / migrer Leitner / hybride)
  - [ ] Mapper `mastery_level` ↔ boîtes 0-5
  - [ ] Documenter la décision (la spec maths fait foi)
- [ ] **Auth réelle / comptes** · `À faire`
  _Aujourd'hui cookie anonyme auto-créé ; colonne `clerk_id` réservée mais zéro intégration._
- [x] **Faire grossir le pool servi : vague non-display FAITE → 1172 typos jouables (était 81)** · `Fait` (2026-06-29) — converties, allégées (35 Mo), activées, durables, familles corrigées.
  _État vérifié 2026-06-29 : 2032 au catalogue (2027 Google) mais seulement **73 game-ready** (converties + ~50 approuvées) ; les **1959 catalog-only ne sont NI converties (0 asset runtime) NI revues**. « Avoir au catalogue » ≠ jouable : il faut **convertir (TTF→WOFF2)** + **curer** (catégorie/difficulté/ce qu'elle enseigne). Goulot = la **curation**, pas le code._
  _Ne **pas** activer les 2027 brutes : beaucoup de Google Fonts sont display/fantaisie = mauvais matériel pédagogique. Stratégie = **vagues curées** (cf. docs/catalog). Chaque vague enrichit le jeu, renforce le skew familiarité (C3) et crée des pages specimen (SEO, H3)._
  _**Décision 2026-06-29 : activer TOUT le non-display (~1103), par lots** (display = plus tard)._
  _**Conversion TTF→WOFF2 PROUVÉE le 2026-06-29 sur un lot test de 8 polices** (quicksand, jost, urbanist, lexend, sora, cormorant, vollkorn, newsreader) → 8/8 valides dans `public/fonts/<slug>/`. Piège réparé : le dossier d'assets a été renommé `02_TYPO_ASSETS`→`02_ASSETS_TYPO` (scripts d'origine cassés). Reste : activer (catalogue override + DB) + dérouler les lots._
  - `scripts/`, `content/catalog/`
  - [x] Historique : pipeline d'ingestion + snapshot (2032) + 1ère vague de 50 en review
  - [x] Pipeline de conversion réparé + prouvé (lot test de 8, pool 73→81)
  - [x] **Vague non-display convertie + sous-ensemblée Latin** : 1095 converties → **1091 prêtes**, **35 Mo** au lieu de 356 (axes de graisse préservés, 0 erreur)
  - [x] **Activées en base + WOFF2 commités** (`0fd7b47`) → **pool 81 → 1172 typos jouables**
  - [x] **Durabilité faite** : overrides + rebuild synchronisés avec la base (1172 actives / 1172 assets, commit `f32a083`) → un ré-import ne reviendra plus en arrière.
  - [x] **Famille (niveau 1) corrigée via Google `METADATA.pb`** (2026-06-29, commit `250ec98`) : 11 fautes réparées — 8 monos taguées sans → `mono` (martianmono, redhatmono, victormono, fragmentmono…) + 3 sans taguées display → `sans_serif` (archivoblack, josefinsans, oswald). Base + override + build cohérents : **sans 757 · serif 358 · mono 54 · display 3**.
- [x] **Classement fin (niveau 2) : sous-catégories corrigées via les tags Google** · `Fait` (2026-06-29, commit `0e4dd4d`)
  _**980 typos classées** depuis la base de tags officielle de Google (`tags/all/families.csv`, donnée curée + scores) → **546 sous-catégories corrigées** (ex. `quicksand`/`jost` → geometric, qui étaient faux). Tags Google (Sans/Geometric, Serif/Old Style Garalde, Slab…) mappés sur nos sous-catégories (humanist/geometric/neo_grotesk/grotesk/old_style/transitional/didone/slab). Base + override + build cohérents._
  - [x] Mapper les tags structurels Google → nos sous-catégories
  - [x] Appliquer sur les 980 taggées (base + override + build)
  - [ ] _Restent : 192 typos sans tag Google (« à vérifier ») + la **difficulté** (encore heuristique) → télémétrie._
- [ ] **Vagues futures (optionnel, plus tard)** · `Plus tard`
  - [ ] Sous-ensembler les 81 anciennes polices (encore charset complet)
  - [ ] Vague « display » à part
- [ ] **Arène (back) : ELO, ligues, duel** · `À faire`
  _Zéro code aujourd'hui — à faire après le lancement (le vrai mur = la population de joueurs)._
- [ ] **Moteur d'auto-correction construit (5 étapes, réutilise le Leitner déjà calé)** · `En cours` (2026-07-07)
  _Étapes 1, 2, 3 et 5 actives immédiatement. Étape 1 : `adaptive_coef` (colonne existante jamais écrite) enfin écrit, il monte de 0.1 après au moins 2 erreurs de suite, descend de 0.05 après au moins 3 bonnes de suite, bornes 0.5 à 2.0. Étape 2 : intervalles indexés sur la maîtrise (fenêtres par palier L0 à L4, divisées par `adaptive_coef`, plancher aux cooldowns). Étape 3 : le résultat du warm-up d'onboarding est enfin exploité (un « Designer » ou « Quite familiar » qui rate est seedé un cran plus bas). Étape 5 : indicateur « X / Y faces maîtrisées » affiché en jeu._
  _Étape 4 (rééquilibrage additif du pool vers le facile si précision faible, sous 40 %, sur les 8 à 12 premières réponses) : migration `007_pool_rebalance.sql` écrite + appel runtime fail-safe (no-op tant que la 007 n'est pas appliquée), respecte l'invariant I-06 (jamais retirer de face). Typecheck + lint scopé OK, rien committé, base non modifiée._
  _Fichiers : `lib/game/training/provider.ts`, `contracts.ts`, `features/game/components/GameScreen.tsx`, `features/onboarding/components/OnboardingWarmup.tsx` + `OnboardingFlow.tsx`, `app/api/training/session/start/route.ts`, `lib/profile/profile-stats.ts`, `app/globals.css`, `db/migrations/007_pool_rebalance.sql`. Doc explicatif : `docs/game/self-correction-engine.md`._
  - [x] Étape 1 : `adaptive_coef` activé (monte de 0.1, descend de 0.05, bornes 0.5 à 2.0)
  - [x] Étape 2 : intervalles indexés sur la maîtrise (fenêtres L0 à L4 divisées par `adaptive_coef`, plancher cooldowns)
  - [x] Étape 3 : résultat du warm-up d'onboarding exploité (seed abaissé si raté)
  - [x] Étape 5 : indicateur « X / Y faces maîtrisées » en jeu
  - [ ] Étape 4 : rééquilibrage additif (007 écrite + appel fail-safe), à activer en appliquant la migration 007 en base
- [x] **Bug de police systémique corrigé sur tout le catalogue** · `Fait` (2026-07-07)
  _Beaucoup de faces pointaient leur `runtimePath` sur un split woff2 sans glyphes latins, donc s'affichaient en serif de secours (grave pour un jeu de reconnaissance de typos). Training manifest : 13 faces cassées → 0. Catalogue compétition : plus aucune face latine ne tombe en secours (16 faces latines repointées sur un split couvrant le Latin, déjà présent). `scripts/mirror_fonts.py` durci pour choisir le split couvrant le Latin (fini le `sorted()[0]` qui recassait, ce qui lève le « à durcir » noté en section C sur le bug du warm-up)._
  _Décision produit restante : 5 polices système sans woff2 (arial, helvetica, times_new_roman, georgia, courier_new) à remplacer par du libre avant lancement ; 36 faces non-latines (Tamil, Khmer, Devanagari, emoji…) qui s'afficheront toujours en secours dans un jeu de mots latins, à exclure des manches ou à montrer dans leur écriture._
  - `scripts/mirror_fonts.py`, `content/typefaces/font-manifest-v4.json`, `content/catalog/font-runtime-assets.json`, `public/fonts/`
- [x] **Payload compétition allégé (224 Ko → 0 up-front)** · `Fait` (2026-07-07)
  _La page compétition injectait 1172 règles `@font-face` (~224 Ko de CSS inline) à chaque visite. Remplacé par une injection `@font-face` à la demande (une police par question, préchargée pendant le délai de feedback, idempotente, SSR-safe). Payload up-front : 224 Ko → 0._
  - `lib/game/competition/contracts.ts`, `catalog.ts`, `provider.ts`, `features/game/components/CompetitionScreen.tsx`, `app/play/competition/page.tsx`

## G — Transversal / mise en ligne

> Sujets transversaux (pas des « pages ») souvent oubliés. Confirmés absents du code au 2026-06-29.

- [ ] **Légal RGPD : confidentialité + cookies + mentions légales / CGU** · `Bloqueur`
  _Données joueurs stockées en UE — obligatoire au même titre que les licences de typo._
  - [ ] Politique de confidentialité (RGPD)
  - [ ] Bandeau / consentement cookies
  - [ ] Mentions légales + CGU (+ CGV si paiement)
- [ ] **Déploiement prod** (domaine, env, build qui passe) · `À faire`
  _Note du 2026-06-29 périmée, corrigée le 2026-07-27 : le build prod **passe**. `next/font` n'est plus utilisé nulle part dans le repo (zéro occurrence), les polices sont déjà auto-hébergées via deux `@font-face` dans `app/globals.css` plus l'injection runtime de `getTrainingFontFaceCss()`. `npm run build` sort en exit 0, 26 routes générées. La migration vers les assets locaux avait donc déjà été faite sans que la checklist soit mise à jour._
  - [x] Faire passer le build prod — **fait**, polices déjà en assets locaux (vérifié 2026-07-27)
  - [ ] Variables d'env en prod (`DATABASE_URL`…)
  - [ ] Domaine + hébergement
  - [ ] Vérifier le site en ligne de bout en bout
- [ ] **SEO** (metadata, sitemap, robots, OpenGraph) · `À faire`
  _Les pages specimen sont un aimant à trafic Google — levier d'acquisition gratuit inexploité._
  - [ ] `generateMetadata` sur les pages (surtout `/type` et `/compare`)
  - [ ] `sitemap.xml` + `robots.txt`
  - [ ] Images OpenGraph (partage)
  _**État mesuré le 2026-07-28 : zéro.** Aucun `generateMetadata` dans tout `app/`, aucun `sitemap.ts`, aucun `robots.ts`, aucun `robots.txt`, aucune image de partage. La seule métadonnée du site est le couple statique de `app/layout.tsx:5`, titre `Jeux de Typo V2` et description `Typographic learning experience.`, donc **les 19 pages partagent le même titre et la même description**. Contenu prêt à porter du trafic : une seule comparaison publiée (`helvetica-neue-vs-inter`) et trois textes de spécimen (`inter`, `helvetica-neue`, `frutiger`), ces trois derniers portant déjà un objet `seo` complet que rien ne lit._
  _**Décision du propriétaire, 2026-07-28 : chantier gelé volontairement, à reprendre « bien plus tard » et en grand.** L'intention n'est pas de brancher trois pages, c'est de finir la page comparaison au niveau SEO puis **de générer ces pages par milliers**, et de faire pareil pour la page de typo seule (`/type/[slug]`). Donc ne pas traiter le SEO comme une demi-journée de plomberie sur l'existant : la plomberie n'est que le préalable, le vrai sujet est le gabarit qui sera dupliqué des milliers de fois. Le levier est réel, le moteur de mesures anatomiques existe déjà et c'est lui qui fait la valeur de chaque page._
  _**Décision du propriétaire, 2026-07-28, sur le point 1 ci-dessous : les pages de masse seront bâties sur les typos Google, pas sur les commerciales.** Ce qui tranche la question du droit : OFL, Apache 2.0 et UFL autorisent l'affichage, l'auto-hébergement et la publication de pages, y compris à but lucratif. Les typos commerciales restent nommables, décrivables et comparables en texte, mais leurs fichiers ne peuvent pas être servis, les conditions d'Adobe Fonts imposant leur propre code d'intégration. Conséquence à exploiter plutôt qu'à subir : une comparaison où la Google s'affiche vraiment et où la commerciale est décrite puis renvoyée vers l'abonnement est légale ET rémunérable, l'affiliation Adobe payant sur l'abonnement Creative Cloud qui contient Adobe Fonts (réseau Partnerize, entrée `adobe.com/affiliates.html`, chiffres à confirmer sur la page officielle). `partners.adobe.com/join`, exploré le 2026-07-27, est la mauvaise porte, c'est leur programme grands comptes sur la suite marketing._
  _**Trois choses à trancher avant la génération de masse, elles coûtent infiniment plus cher après qu'avant.** 1. **Légal** : tranché ci-dessus, Google uniquement. Deux des trois textes de spécimen existants portent sur des typos commerciales (`frutiger`, `helvetica-neue`), absentes du catalogue, donc à traiter en texte sans fichier de police. Voir la note « montrer des typos commerciales / Adobe » plus haut. 2. **Différenciation** : des milliers de pages issues d'un même gabarit avec peu de variation réelle sont traitées par Google comme des pages satellites et peuvent faire sanctionner le domaine entier. Ce qui protège ici, c'est que les mesures anatomiques diffèrent vraiment d'une typo à l'autre : le gabarit doit exposer cette différence, pas la même phrase avec deux noms substitués. 3. **Ordre de publication** : `robots.txt` en interdiction totale tant que le gabarit n'est pas arrêté, l'indexation étant la seule action de ce chantier qui ne se rattrape pas vite, une page indexée restant dans les résultats un moment après son retrait._
- [ ] **Monétisation : paiement / abonnement Pro / jetons** · `À faire`
  _Business model sur le papier, aucune caisse intégrée._
  - [ ] Choisir le modèle (affiliation / Pro / B2B)
  - [ ] Intégrer Stripe (checkout)
  - [ ] Abonnement Pro + achat de jetons
- [ ] **Mode Expert jouable de bout en bout** · `À faire` — audité 2026-06-29 : **pas commencé** (au-delà des données).
  _Existe : les *answer keys* (`expert_answer_keys` + JSON), le flag `expert_enabled`, la page de règles `/play/expert/rules`._
  _Manque **tout le jeu** : `app/play/expert/page.tsx` n'est qu'un `ModePlaceholderPage` (« will be implemented after Competition mode ») ; **aucun** `lib/game/expert/` provider, **aucune** route `/api/expert/*`, **aucun** `ExpertScreen`. Chantier = créer le flux « nommer la typo » (saisie libre, sans QCM), sur le modèle de Competition (`lib/game/competition/` + `CompetitionScreen.tsx`)._
- [x] **`CLAUDE.md` à la racine** · `Fait` — 2026-07-27, commit `ba44383`.
  _Le repo n'avait aucun fichier d'instructions : les conventions (frontières runtime/dev-lab, porte `npm run quality`, nommage, chemins interdits en suivi git, `#ffd213`, migrations Neon en SQL brut) n'existaient que dispersées dans `docs/`, et les règles de travail du propriétaire uniquement dans la mémoire locale de l'assistant, donc perdues au changement de machine. Écrit à partir du repo seul, rien d'inventé._
- [x] **Pages d'erreur** (404 + écran d'erreur) · `Fait` — 2026-07-27, commit `5aa7e6d` le 2026-07-28.
  _Le site n'avait ni 404 ni frontière d'erreur : une URL fausse ou un plantage de rendu tombait sur l'écran brut de Next. Créés : `app/not-found.tsx` (404, sorties « Back home » et « See the modes »), `app/error.tsx` (frontière d'erreur, bouton « Try again » branché sur la prop `reset` de Next, erreur loguée en console), `app/global-error.tsx` (seul filet si `app/layout.tsx` lui même casse, donc il rend son propre `html` / `body` et réimporte `globals.css`), et le shell partagé `features/errors/components/ErrorScreen.tsx`. Aucun visuel inventé : le layout réutilise les recettes validées de l'écran placeholder de mode (les groupes `.mode-placeholder-page`, `.mode-placeholder-shell`, `.mode-placeholder-kicker`, `.mode-placeholder-actions` de `app/globals.css` accueillent en plus les noms `.error-*`, zéro nouvelle déclaration CSS), titres en `.ui-page-title` / `.ui-page-subtitle`, boutons en pilules de la landing `.lp-btn--primary` / `.lp-btn--ghost` (la landing tranche l'arbitrage : pas de jaune en aplat sur un CTA, contrairement à `.mode-placeholder-btn--solid`), `ThemeSwitch` présent comme l'impose le contrat UI. Textes anglais centralisés dans `content/copy.ts` (`notFoundCopy`, `errorCopy`). Passés : lint sur les fichiers créés, `typecheck`, `check:copy`, `check:dev-routes`. Rendu jamais regardé en local, à relire en live._
- [ ] **Monitoring + analytics produit** · `À faire`
  _Pour régler les constantes avec la télémétrie (Sentry + analytics produit)._
- [ ] **Accessibilité** (contraste, clavier, lecteurs d'écran) · `À faire`
- [ ] **Emails / rappels de rétention** (style Duolingo) · `Plus tard`
- [ ] **Langue FR / EN (i18n)** — à trancher · `À décider` — UI en anglais aujourd'hui.

## H — Parkés / à décider

- [ ] **Page Prof / espace enseignant** · `À décider`
  _N'existe pas — hors scope MVP actuel. À décider (et ça suppose l'auth réelle, section F)._
- [ ] **Comptes & classes (auth + paiement) : espace enseignant** · `À faire`
  _Spec écrite le 2026-07-09. Trois rôles (admin école, prof, élève) : c'est l'école payeuse qui achète la licence au niveau établissement (sièges dimensionnés par nombre d'élèves), pas le prof. Modèle deux couches façon Adobe (identité personnelle d'un côté, licence/sièges de l'autre), provisionnement des élèves par le prof (invitation à usage unique, l'élève choisit son mot de passe), classe = groupe permanent en autonomie, verrou ordi en contexte classe, tableau de bord prof (consultation puis diagnostic, LE différenciateur). C'est la plus grosse brique : elle introduit l'AUTH réelle (cf. F « Auth réelle / comptes ») ET le PAIEMENT (cf. G « Monétisation », fournisseur à étudier). Invariant : le compte appartient à la personne, la licence conditionne l'accès, jamais la propriété de l'identité ni de la progression._
  - `docs/game/classes-comptes-spec.md`
- [ ] **Grille de vérification logo typo** · `Plus tard`
  _Truc à inventer, parké volontairement._

---

## Gains rapides (purement code, faisables tout de suite)

1. **Brancher familiarité onboarding → seed Leitner** (C) — TODO déjà identifié, le plus net.
2. **Métriques de badges → vraies données** (B).
3. **Streak + objectif quotidien réels** (A).
