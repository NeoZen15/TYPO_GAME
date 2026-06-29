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

État par sujet : **13 faits · 1 en cours · 17 à faire · 3 bloqueurs · 4 parkés / à décider** (38 sujets).

> Section **G — Transversal / mise en ligne** ajoutée le 2026-06-29 : sujets transversaux souvent oubliés (légal RGPD, déploiement, SEO, monétisation, erreurs, monitoring, a11y…), absents de la liste de départ.

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
  _⚠️ **Le test a révélé que le skew était inerte** : le set éligible (tier N · common · actif) ne comptait que **25 typos** < les 30 seedées → même pool pour tous._
  _✅ **Correctif trouvé & écrit (`db/migrations/005_seed_pool_widen.sql`)** : élargir l'éligibilité à **tier N+D common** (~55 typos actives, déjà runtime-ready — aucune conversion). C'est conforme à la spec moteur (`training-engine-spec-v2-clean.md §3` : compléter avec tier D common). Prévisualisé en lecture seule : **débutant 16 easy/14 med · designer 3 easy/27 med** → vraie différence. Aucun changement de code (la fonction est juste remplacée)._
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

## E — Légal & marque · le chantier urgent avant mise en ligne

- [ ] **Régler la typo du logo (PP Frama, propriétaire)** · `Bloqueur`
  _Servie à tous les visiteurs sans licence webfont._
  - `public/fonts/brand/PPFrama-*.otf`
  - [ ] Retrouver / contrôler la licence PP Frama actuelle
  - [ ] Vérifier les droits webfont en usage commercial
  - [ ] Acheter la licence **OU** choisir une font libre de remplacement
  - [ ] Ajouter le fichier LICENSE + attribution
- [ ] **Régler les 23 typos actives en licence « unknown »** · `Bloqueur`
  _23 / 73 typos actives sans licence connue = bloqueur légal._
  - `content/catalog/typefaces-core.json`
  - [ ] Lister les 23 typos actives en licence unknown
  - [ ] Retrouver la licence de chacune (metadata Google Fonts / source)
  - [ ] Remplir `license_type` (ofl / apache2 / …)
  - [ ] Repasser la vue QA `v_qa_unknown_license` à 0
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
- [ ] **Faire grossir le pool servi : 73 actives sur 2032 au catalogue** · `En cours`
  _Le pipeline marche ; le goulot = conversion + review éditoriale, pas le code. Grossir le pool éligible (tier N · common) débloque aussi le skew familiarité (C3, aujourd'hui inerte faute de typos)._
  - `scripts/`, `content/catalog/`
  - [x] Pipeline d'ingestion (seed → build → import)
  - [x] Snapshot Google Fonts absorbé — 2032 au catalogue
  - [x] Première vague de 50 typos passée en review
  - [ ] Convertir TTF → WOFF2 par vagues
  - [ ] Review éditoriale des lots suivants
  - [ ] Importer + vérifier au runtime
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
