# Pages d'explication : plan

> **Rang documentaire.** Ce document est un **plan de réalisation front**, pas une source de vérité. Toute règle de fonctionnement qu'il évoque appartient à `docs/game/vision-produit-dwiggins.md` (vision et invariants) et à `docs/game/training-engine-spec-v2-clean.md` (fonctionnement du moteur) : il les **cite** et les traduit en interface, il ne les redéfinit jamais. En cas de divergence, ce sont ces deux documents qui font foi.
>
> **Deux faits ont changé depuis sa rédaction, le 2026-07-29 en fin de journée.** 1. Le plan d'architecture backend n'est plus « en cours de réflexion » : il est écrit (`docs/game/architecture-backend.md`) et validé dans sa logique générale, et les phases 0, 0 bis, 1 et 2a sont autorisées. 2. Par conséquent, **l'écart 3 est en cours de levée** : le plafond de 8 manches disparaît au profit d'une séance sans limite, arrêtée par l'élève et close par un bilan. La ligne `sessionShapeLine`, que ce plan a eu la bonne idée d'isoler pour cette raison exacte, devra donc basculer vers le comportement cible. Coordonner les deux chantiers pour ne pas décrire un plafond qui n'existera plus.

Date : 2026-07-29.
Statut : **plan entièrement réalisé.** Les blocs 1 (entrée du mode) et 2 (page de règles) sont sortis le 2026-07-29, le bloc 3 (explicatif du profil) le 2026-08-17, en `features/profile/components/ProgressExplainer.tsx`. Détail de chaque passage au journal de `docs/process/checklist.md`. Une réserve tient toujours sur le bloc 1 : l'entrée statique du mode Entraînement a été retirée le 2026-08-15, elle redisait les règles une seconde fois et le bouton Jouer tombait sur un écran de règles au lieu du jeu.
Portée : front uniquement. **Aucune de ces pages n'est branchée à quoi que ce soit.** Contenu statique, zéro appel au moteur, zéro lecture en base, zéro nouvelle colonne.

## Pourquoi ce chantier maintenant

Le plan d'architecture backend est en cours de réflexion dans une autre session, et la consigne du propriétaire est claire : rien ne s'implémente côté moteur avant sa validation, y compris les P0 de la section I de la checklist. Les pages d'explication sont le seul chantier qui avance le produit sans rien présupposer de ce plan, et c'est en même temps une exigence directe de la vision figée.

`docs/game/vision-produit-dwiggins.md` §2.1 : « L'élève ne vient pas jouer une partie, il vient entraîner son regard. Cela doit être dit à l'entrée du mode Entraînement, pas déduit. »

Items de checklist couverts, section A : « Page Règles : expliquer les règles du jeu au joueur » et « Page Profil : expliquer comment on monte » (ses trois sous-items : les groupes, la méthode, comment on monte).

## État mesuré de l'existant, 2026-07-29

**La page Règles existe et elle est déjà unifiée.** `app/play/training/rules/page.tsx`, `competition/rules` et `expert/rules` rendent le même composant `features/modes/components/ModeRulesPage.tsx`, qui porte trois onglets et bascule en `useState`. Les cartes de `/play` pointent déjà dessus. Le travail restant n'est donc pas structurel.

**L'entrée du mode Entraînement n'explique rien.** `app/play/training/page.tsx` est un `redirect("/game")` de trois lignes. Le joueur qui choisit Entraînement sur `/play` arrive directement sur la première question, sans avoir lu une seule phrase sur la philosophie du mode. C'est exactement ce que §2.1 interdit.

**Le profil n'explique pas sa propre carte.** La constellation DWIGGINS est branchée sur le vrai `EyeProfile` (`features/profile/components/ProgressConstellation.tsx`, onglet « Path »), mais rien ne dit au joueur ce que sont les axes, ce qu'est un palier, ni ce qui les allume.

### Erreurs factuelles du contenu actuel des règles

Confrontées au code du moteur, pas à la spec.

| Affirmation dans `ModeRulesPage.tsx` | Réalité |
|---|---|
| « The same session word stays fixed during the session » | Faux. `getTrainingDisplayWord` (`lib/game/training/catalog.ts:46`) change de mot tous les 5 index de question : `Math.floor(globalQIndex / 5)`. |
| « Level 1 means seen but recently missed » | Faux. Le seed pose tout le monde à L0 (`init_user_pool`). L1 est atteint par une bonne réponse, ou par une redescente depuis L2. |
| « A wrong answer reduces the internal level by one step » | Incomplet. Seule la **première** mauvaise tentative pénalise (I-14, `provider.ts:888`). Un retry ne coûte rien. |
| Onglet Expert, 12 puces détaillées | Le mode n'existe pas. `app/play/expert/page.tsx` est un `ModePlaceholderPage`. Aucun provider, aucune route, aucun écran. |

### Tensions avec la vision, et arbitrages retenus

**Échelle de mastery numérotée.** Les règles détaillées exposent « an internal mastery level from 0 to 4 » avec un barreau par niveau. I-18 dit que le mastery brut n'est jamais affiché comme une note et n'existe qu'à l'état traduit. Nommer les niveaux invite le joueur à les collectionner, donc à traiter le mastery comme un score. **Retenu : remplacer l'échelle chiffrée par sa traduction qualitative** (une typo ratée revient vite, une typo stable attend longtemps, la stabilité vient de la répétition et pas d'un succès isolé). La méthode reste expliquée, c'est le barème qui disparaît.

**Séance sans limite.** La vision §2.1 et I-17 décrivent une séance sans plafond de questions, arrêtée par l'élève, close par un bilan. Le code plafonne à 8 manches (`TRAINING_TOTAL_ROUNDS`, `lib/game/training/catalog.ts:3`) et passe la session en `completed`. L'écart 3 est décidé mais explicitement non implémentable avant validation du plan. **Retenu : les pages décrivent le comportement d'aujourd'hui**, sinon le front promet une expérience que le joueur ne vivra pas. La phrase concernée est isolée dans une seule entrée de copie (`sessionShapeLine`) pour que la bascule soit un remplacement de ligne le jour où l'écart 3 tombe.

**Mode Expert.** Décrire un mode absent est une promesse non tenue. **Retenu : l'onglet Expert conserve la description de son format** (nommer sans QCM, c'est utile pour comprendre l'offre) mais perd les 12 puces de mécanique inventée et gagne une mention d'état, alignée sur ce que `ModePlaceholderPage` dit déjà de lui.

## Ce qui est livré

Trois blocs, indépendants, dans cet ordre.

### 1. Entrée du mode Entraînement

Nouveau composant `features/modes/components/TrainingIntro.tsx`, rendu par `app/play/training/page.tsx` en remplacement du `redirect`.

Contenu, les quatre énoncés de §2.1, dans cet ordre :

1. ni score à battre, ni temps à respecter ;
2. chaque bonne réponse espace les rappels, chaque erreur les rapproche ;
3. le parcours est personnalisé, chaque typographie revient au moment où elle est la plus susceptible d'être oubliée ;
4. l'objectif n'est pas de finir une session, c'est une compétence visuelle durable.

Plus la forme réelle de la séance aujourd'hui (`sessionShapeLine`), et deux sorties : « Start training » vers `/game`, « Read the rules » vers `/play/training/rules`.

Points d'attention :

- **ne pas doubler l'onboarding.** `/onboarding` est le parcours de première visite et porte déjà son propre discours de découverte. Cet écran est l'entrée du mode, pas une seconde introduction. Ton plus court, aucune reprise du warm-up.
- **vérifier les autres portes vers `/game`** avant de conclure que l'explication est vue : la landing, l'onboarding et `ModePlaceholderPage` pointent tous vers `/game` en direct. L'écran n'est donc pas un passage obligé, et c'est acceptable, mais il faut le savoir.

### 2. Réécriture du contenu des règles

`features/modes/components/ModeRulesPage.tsx` garde sa structure, ses onglets et son CSS. Seul le contenu change, et il déménage.

- Les erreurs factuelles du tableau ci-dessus sont corrigées.
- L'échelle chiffrée de mastery est remplacée par sa version qualitative.
- Les quatre énoncés de §2.1 apparaissent en tête de l'onglet Entraînement, pour que la page des règles et l'entrée du mode ne se contredisent pas.
- Le pavé « Detailed rules » de 20 puces est resserré. Une liste que personne ne lit n'explique rien.
- L'onglet Expert perd sa mécanique inventée et gagne sa mention d'état.
- Les puces conservées sur la compétition sont vraies et le restent : deux minutes, 1 point, 2 points sous 2 secondes, et surtout « la compétition ne déplace pas la progression », qui est l'invariant I-11 vérifié dans le code.

### 3. Bloc explicatif du profil

Nouveau composant `features/profile/components/ProgressExplainer.tsx`, inséré dans l'onglet « Path » de `ProfileExperience.tsx`, sous la constellation.

Trois volets, qui sont les trois sous-items de la checklist :

- **les groupes** : ce que sont les axes et les paliers de la carte du regard, et pourquoi ils sont organisés comme ça ;
- **la méthode** : la répétition espacée, en une phrase qui ne cite aucun barème ;
- **comment on monte** : ce qui allume un palier, et pourquoi ça ne peut pas s'obtenir en une séance.

La carte DWIGGINS est la représentation principale de l'élève (vision §8), donc ce bloc explique **la carte**, pas un niveau. Le niveau Dreyfus n'y est pas mentionné : c'est une variable de commande interne (I-20), pas une note à expliquer au joueur.

## Contraintes de réalisation

**Copie centralisée.** `CLAUDE.md` impose que le texte d'interface vive dans `content/copy.ts` et interdit les chaînes en dur dans un composant, ce que `check:copy` surveille. Le contenu des règles est aujourd'hui en dur dans `ModeRulesPage.tsx`, en écart avec cette règle. Comme on réécrit ce contenu de bout en bout, il est écrit directement dans sa maison canonique. Trois exports : `trainingIntroCopy`, `modeRulesCopy`, `progressionExplainerCopy`.

**Zéro CSS inventé.** Même méthode que les pages d'erreur du 27 juillet, qui n'ont ajouté aucune déclaration : on réutilise les recettes existantes. Pour l'entrée du mode, les groupes `.mode-placeholder-*` et les pilules de la landing `.lp-btn--primary` et `.lp-btn--ghost`. Pour le bloc profil, les recettes de carte déjà en service dans l'onglet Path. Titres en `.ui-page-title` et `.ui-page-subtitle`, `ThemeSwitch` présent, comme l'impose `docs/ui/ui-consistency-contract.md`.

**Référence DA.** En cas de doute, la landing tranche. Aucune couleur nouvelle, aucun aplat de jaune sur un CTA.

**Langue.** L'interface est en anglais aujourd'hui (l'i18n est un sujet non tranché, section G). Ces trois blocs sont donc écrits en anglais, comme le reste.

## Vérification

Aucune capture d'écran, le propriétaire regarde le site en live.

- `npm run typecheck`
- `npm run lint`
- `npm run check:copy`, qui est précisément le garde de la copie centralisée
- `npm run check:contracts`
- relecture des trois écrans en live sur le port qui tourne

Pas de test end to end ajouté : `tests/e2e` écrit dans la base de production et ces trois blocs n'ont aucune écriture à tester.

## Ce que ce plan ne fait pas

- Il ne touche **aucune ligne du moteur** : ni sélection, ni mastery, ni intervalles, ni pool, ni télémétrie.
- Il ne branche **aucune donnée**. Le bloc profil explique la carte, il ne lit pas l'`EyeProfile`.
- Il ne retire pas le plafond de 8 manches, il le décrit.
- Il ne construit pas le mode Expert, il arrête de le promettre.
