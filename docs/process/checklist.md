# DWIGGINS — Checklist « Où on en est »

> Source de vérité de l'avancement produit, confrontée à l'état réel du code.
> Version visuelle interactive (miroir de ce fichier) : artifact `dwiggins-checklist` sur claude.ai.
>
> **Dernière mise à jour : 2026-06-29.**
> Les cases reflètent l'état du code à cette date — à re-vérifier avant d'affirmer comme acquis.

## Comment lire

- `- [x]` = considéré comme fait · `- [ ]` = reste à faire.
- Le **statut** entre `backticks` = lecture honnête de l'état du code, pas forcément « coché ».
- Statuts : `Fait` · `En cours` · `À faire` · `Bloqueur` · `À décider` / `Plus tard`.
- Une ligne avec des sous-cases est cochée quand toutes ses sous-étapes le sont.

## En résumé

L'essentiel du front (profil, badges, onboarding, pages typo) et le back sont **déjà là**.
Le vrai chantier urgent n'est **pas du code** mais du **légal / marque** (typo du logo PP Frama + licences des typos) avant toute mise en ligne.

État par sujet : **15 faits · 0 en cours · 17 à faire · 2 bloqueurs · 6 parkés / à décider** (40 sujets).

> Section **G — Transversal / mise en ligne** ajoutée le 2026-06-29 : sujets transversaux souvent oubliés (légal RGPD, déploiement, SEO, monétisation, erreurs, monitoring, a11y…), absents de la liste de départ.

---

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

## D — Pages typo (compare + spécimen)

- [x] **Pages Compare — 4 stages** : ouverture, contraste, terminaisons, hauteur d'x · `Fait` — aucun placeholder.
  - `app/compare/[slug]/page.tsx`, `lib/typography/compare-page-helpers.ts`
- [x] **Annotations + superposition de mots** · `Fait`
  - `components/typography/MeasuredGlyphSplit.tsx`, `lib/typography/word-overlay-engine.ts`
- [x] **Page Spécimen `/type/[slug]`** (hero, testeur, anatomie, fiche) · `Fait`
  - `app/type/[slug]/page.tsx`
- [ ] **Harmoniser la DA des pages typo avec le reste** · `À faire` — incohérences couleur déjà recensées.
  - `app/globals.css`, `docs/ui/ui-palette-reference.md`
  - [ ] Choisir 1 vert canonique (3 familles aujourd'hui)
  - [ ] Choisir 1 rouge canonique
  - [ ] Officialiser le neutre chaud `#2a1a20` (vs noir pur)
  - [ ] Officialiser ou retirer le rose `#F39AB1`
  - [ ] Appliquer dans `globals.css` + mettre à jour le contrat UI
- [x] **Nav partagée alignée sur la home (DA + outils) sur `/compare` et `/type`** · `Fait` (2026-06-29)
  _La nav des pages typo était restée sur l'ancien skin « néon noir » (fond `#000`, glow, wordmark ivory, CTA clair) alors que la home (`lp-header`) est la **référence DA**. Refondue en **composant partagé `SiteNav`** (`components/ui/SiteNav.tsx`) → une seule source de vérité, appliquée via les templates `[slug]`, donc les **~2000 pages specimen `/type` l'héritent sans travail par-slug** (« calibré »)._
  _**DA** = pill crème `lp-header` : fond `#f4f3ee`, encre `#141019`, glow/`::before`/`::after` retirés, wordmark **noir + figures**, CTA **foncé**, ThemeSwitch dans le pill. Classe CSS renommée `compare-site-nav` → `site-nav`._
  _**Outils** = repris de la home verbatim : liens **How it works / Compare / Typefaces / Modes** (ancres `/#…`) + CTA **Start training** (`/onboarding`). (`/type` n'avait aucune nav avant, juste un ThemeSwitch flottant.)_
  _Typecheck OK. Vérifié à l'écran : home (réf) intacte, `/compare`, `/type/inter` (fond noir) et `/type/helvetica-neue` rendent une nav identique. Piège rencontré : le dev server servait un CSS périmé après le renommage de classe (HMR CSS manqué) — re-déclenché par un édit trivial de `globals.css`._
  - `components/ui/SiteNav.tsx`, `app/globals.css` (`.site-nav*`), `app/compare/[slug]/page.tsx`, `app/type/[slug]/page.tsx`

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
- [ ] **Remplir `license_url` / `foundry` / `release_year`** (0/73 aujourd'hui) · `À faire`
- [ ] **Garde-fou : ne jamais servir une typo « unknown » au runtime** · `À faire`
  _La vue QA existe mais n'est pas appliquée par le moteur._
  - `db/migrations/002_catalog_tables.sql`

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
- [ ] **Affiner le classement + vagues futures** · `Plus tard` (optionnel, non bloquant)
  - [ ] Classement fin (niveau 2) : sous-catégories grossières (tout en « neo_grotesk ») + difficulté par défaut (`qa_status=review` sur 1122/1172) — à affiner par LLM/agent et/ou télémétrie.
  - [ ] Sous-ensembler aussi les 81 anciennes polices (encore charset complet).
  - [ ] Vague « display » à part.
- [ ] **Arène (back) : ELO, ligues, duel** · `À faire`
  _Zéro code aujourd'hui — à faire après le lancement (le vrai mur = la population de joueurs)._

## G — Transversal / mise en ligne

> Sujets transversaux (pas des « pages ») souvent oubliés. Confirmés absents du code au 2026-06-29.

- [ ] **Légal RGPD : confidentialité + cookies + mentions légales / CGU** · `Bloqueur`
  _Données joueurs stockées en UE — obligatoire au même titre que les licences de typo._
  - [ ] Politique de confidentialité (RGPD)
  - [ ] Bandeau / consentement cookies
  - [ ] Mentions légales + CGU (+ CGV si paiement)
- [ ] **Déploiement prod** (domaine, env, build qui passe) · `À faire`
  _Le build prod échouait sur le chargement des polices (`next/font` Google Fonts)._
  - [ ] Faire passer le build prod (fonts via `next/font` ou assets locaux)
  - [ ] Variables d'env en prod (`DATABASE_URL`…)
  - [ ] Domaine + hébergement
  - [ ] Vérifier le site en ligne de bout en bout
- [ ] **SEO** (metadata, sitemap, robots, OpenGraph) · `À faire`
  _Les pages specimen sont un aimant à trafic Google — levier d'acquisition gratuit inexploité._
  - [ ] `generateMetadata` sur les pages (surtout `/type` et `/compare`)
  - [ ] `sitemap.xml` + `robots.txt`
  - [ ] Images OpenGraph (partage)
- [ ] **Monétisation : paiement / abonnement Pro / jetons** · `À faire`
  _Business model sur le papier, aucune caisse intégrée._
  - [ ] Choisir le modèle (affiliation / Pro / B2B)
  - [ ] Intégrer Stripe (checkout)
  - [ ] Abonnement Pro + achat de jetons
- [ ] **Mode Expert jouable de bout en bout** · `À faire` — audité 2026-06-29 : **pas commencé** (au-delà des données).
  _Existe : les *answer keys* (`expert_answer_keys` + JSON), le flag `expert_enabled`, la page de règles `/play/expert/rules`._
  _Manque **tout le jeu** : `app/play/expert/page.tsx` n'est qu'un `ModePlaceholderPage` (« will be implemented after Competition mode ») ; **aucun** `lib/game/expert/` provider, **aucune** route `/api/expert/*`, **aucun** `ExpertScreen`. Chantier = créer le flux « nommer la typo » (saisie libre, sans QCM), sur le modèle de Competition (`lib/game/competition/` + `CompetitionScreen.tsx`)._
- [ ] **Pages d'erreur** (404 + écran d'erreur) · `À faire`
- [ ] **Monitoring + analytics produit** · `À faire`
  _Pour régler les constantes avec la télémétrie (Sentry + analytics produit)._
- [ ] **Accessibilité** (contraste, clavier, lecteurs d'écran) · `À faire`
- [ ] **Emails / rappels de rétention** (style Duolingo) · `Plus tard`
- [ ] **Langue FR / EN (i18n)** — à trancher · `À décider` — UI en anglais aujourd'hui.

## H — Parkés / à décider

- [ ] **Page Prof / espace enseignant** · `À décider`
  _N'existe pas — hors scope MVP actuel. À décider (et ça suppose l'auth réelle, section F)._
- [ ] **Grille de vérification logo typo** · `Plus tard`
  _Truc à inventer, parké volontairement._

---

## Gains rapides (purement code, faisables tout de suite)

1. **Brancher familiarité onboarding → seed Leitner** (C) — TODO déjà identifié, le plus net.
2. **Métriques de badges → vraies données** (B).
3. **Streak + objectif quotidien réels** (A).
