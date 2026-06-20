# Game Unified Specification (V1)

Last update: 2026-03-13
Status: canonical merged spec

Related style governance:
- `docs/ui/ui-consistency-contract.md` (site-wide typography/spacing/theme-switch consistency)

## 1) Positionnement documentaire

Les documents source ne sont pas contradictoires.
Ils décrivent le même produit à deux niveaux:
- niveau 1: système d’apprentissage (logique pédagogique, progression, moteur)
- niveau 2: apparition dans l’interface et le flux de jeu (front/runtime)

Ce document fusionne les deux niveaux en supprimant les répétitions, sans réduire le contenu fonctionnel.

## 2) Scope

Ce document couvre:
- principes produit
- architecture d’information et routes
- règles pédagogiques du mode Entraînement
- règles d’interface et d’interaction front
- modèle de données et contrats API cibles
- checklist d’implémentation front V1

Ce document ne couvre pas:
- implémentation backend production complète
- auth/sécurité production
- ranking compétition final
- pipeline expert final côté backend

## 3) Architecture d’information (current)

Routes actives:
- `/` landing
- `/onboarding` onboarding non scroll
- `/play` sélection de mode
- `/play/training` entrée mode Entraînement (redirige vers runtime training actuel)
- `/play/competition` placeholder mode Compétition
- `/play/expert` placeholder mode Expert
- `/play/training/rules` page règles mode Entraînement (active)
- `/play/competition/rules` page règles mode Compétition (active)
- `/play/expert/rules` page règles mode Expert (active)
- `/game` écran de jeu non scroll (runtime front actuel)

Transitions actives:
- `/` -> bouton `Yes` -> `/onboarding`
- `/onboarding` -> `Start playing` -> `/play`
- `/play` -> choix du mode -> route de mode
- `/play` -> `Rules` sur une carte mode -> `/play/{mode}/rules`
- `/play/{mode}/rules` -> `Back to modes` -> `/play`
- `/game` -> `Play again` relance une session locale

Aucune autre route de sélection de mode n’est activée à ce stade.

## 4) Principe général produit

Le jeu montre une seule typographie à l’écran.
L’utilisateur doit identifier son nom.

Cadre général:
- mode par défaut en QCM 4 choix
- une seule typographie affichée par question
- une seule police chargée par question pour limiter la latence

Compte et session:
- compte requis à cible produit pour progression long terme
- mode invité possible pour test sans persistance durable

## 5) Modes de jeu

### 5.1 Mode Entraînement (V1 principal)

- QCM 4 choix
- pas de score visible
- répétition espacée active
- progression active
- typographies jamais supprimées du système

### 5.2 Mode Compétition

- inclus en V1
- durée fixe: 2 minutes
- QCM 4 choix fixe
- score:
  - bonne réponse: 1
  - bonne réponse < 2s: 2
  - mauvaise réponse: 0
- pénalité légère de temps possible anti-spam
- score n’influence pas la progression long terme
- sélection sur pool global pour comparabilité
- écran de fin riche recommandé:
  - score, précision, volume de réponses
  - vitesse moyenne / meilleure / pire réponse
  - fast answers
  - meilleure série
  - confusions et catégories à retravailler

### 5.3 Mode Expert

- mode distinct du QCM
- accessible à partir d’un niveau global défini
- réponse par saisie texte
- normalisation:
  - casse ignorée
  - accents ignorés
  - espaces ignorés
- seul nom officiel accepté

## 6) Système d’apprentissage

## 6.1 Niveaux internes (par typographie)

Niveaux `0 -> 4`:
- 0: jamais vue
- 1: vue mais ratée
- 2: réussie une fois
- 3: réussie deux fois
- 4: réussie trois fois sans erreur récente

Règle d’évolution:
- bonne réponse: +1 niveau (max 4)
- mauvaise réponse: -1 niveau (min 0)
- cas spécial: une typo niveau 4 ratée revient niveau 3

## 6.2 Fréquence de retour

Fenêtres de retour (en nombre de questions):
- niveau 0: `1..3`
- niveau 1: `3..6`
- niveau 2: `10..25`
- niveau 3: `25..50`
- niveau 4: `80..150`

## 6.3 Cooldowns et répétition

- typo ratée: jamais retour immédiat, minimum 2 questions d’écart
- typo réussie: pas de réapparition dans les 5 questions suivantes
- typo jamais supprimée définitivement

## 6.4 Pool actif utilisateur

- pool actif cible: ~30 typographies
- pool limité volontairement (charge cognitive)
- ajout progressif:
  - ajouter 1 nouvelle typo quand 3 typos différentes atteignent niveau 4 stable
  - maintenir le pool autour de 30

## 6.5 Difficulté adaptative

La difficulté QCM augmente par similarité visuelle des distracteurs:
- niveaux 0-1: distracteurs très contrastés
- niveau 2: même grande famille mais encore distincts
- niveaux 3-4: distracteurs très proches structurellement

Pondération adaptative par utilisateur (cible moteur):
- influencée par taux d’erreur, vitesse, confusions répétées
- agit sur fréquence de retour et proximité des distracteurs
- plafonnée pour éviter les dérives

Règle de dominance (non négociable):
- la répétition espacée reste la règle dominante du système
- la pondération adaptative ne peut pas casser l’ordre des items `due` défini par mastery + intervalles
- la pondération adaptative ne peut pas violer les cooldowns (`min 2` après erreur, `min 5` après succès)
- la pondération adaptative peut affiner la priorité et la proximité des distracteurs, mais jamais remplacer la logique de rappel

## 6.6 Fondements

Le système s’appuie sur:
- courbe de l’oubli d’Ebbinghaus
- principes Leitner
- principes SM2

Principe:
- chaque erreur rapproche le rappel
- chaque réussite espace le rappel

## 7) Logique des mots

## 7.1 Rôle du mot

Le mot sert à exposer la structure visuelle des lettres.
Il ne doit pas pousser à lire le sens plutôt qu’observer la forme.

## 7.2 Règle de rotation des mots (V2)

- Entraînement: changement toutes les 5 questions
- Compétition: changement à chaque question
- Expert: changement à chaque question

## 7.3 Pourquoi

- pas un seul mot pour toute la vie produit (éviter mémorisation pure)
- cadence contrôlée en Training pour limiter le bruit cognitif
- cadence rapide en Competition/Expert pour augmenter robustesse perceptive
- cible: ~20 mots pour équilibre variété/stabilité

## 7.4 Contraintes de mots

- pas de mots émotionnels
- pas de noms propres
- pas de mots trop courts
- pas de chiffres/symboles

Couverture lettres recherchée:
- `a`, `e`, `o`, `n`, `r`, `l`, `i`, `t`, `s`

## 7.5 Liste V1

- `alphabet`
- `typographie`
- `structure`
- `regular`
- `baseline`
- `contraste`
- `lecture`
- `espace`
- `ligne`
- `courbe`
- `hauteur`
- `epaisseur`
- `glyphes`
- `famille`
- `alignement`
- `rythme`
- `design`
- `caractere`
- `forme`
- `proportion`

## 8) Runtime front du jeu (`/game`)

## 8.1 Contrat d’affichage par round

À chaque round:
- 1 échantillon central dans la typo cible
- 4 options (labels neutres)
- 1 seule bonne réponse

Contraintes front:
- labels en typo UI neutre
- sample central en typo cible
- pas de scroll
- pas de cadre conteneur visible autour de la zone de jeu

## 8.2 Contrat de réponse (runtime actuel)

- clic immédiat (pas de bouton validate)
- si mauvais clic:
  - option cliquée passe en rouge
  - round reste actif
  - retry autorisé sur le même round
- si bon clic:
  - option cliquée passe en vert
  - transition round suivant après délai

Délai actuel front:
- correct -> next round: `2000ms`

Contrat retry (source de vérité backend):
- la première mauvaise tentative d’un round est une erreur complète (`full_error`) et peut produire un `masteryDelta`
- les mauvaises tentatives suivantes sur le même round sont des signaux partiels (`partial_signal`)
- un `partial_signal` n’applique pas de baisse supplémentaire de mastery sur ce round
- un `partial_signal` alimente la télémétrie de confusion et la pondération adaptative utilisateur

## 8.3 Session runtime actuelle

- rotation des mots pilotée par mode (`training=5 questions`, `competition=1`, `expert=1`)
- nouvelle session = nouveau tirage initial dans le pool de mots

## 9) Contrat UI (landing/onboarding/game)

## 9.1 Thème

Theme storage:
- localStorage key: `jdt-theme`

Valeurs:
- `light`
- `dark`

Boot default:
- `light`

Theme switch:
- top-right fixed
- one-click toggle
- applique `document.documentElement.dataset.theme`

## 9.2 Couleurs canon

- fond clair: `#ffffff`
- texte clair mode light: `#111114`
- fond dark: `#000000`
- texte dark mode: `#ffffff`
- accent jaune: `#ffd213`
- success: `#00c853`
- error: `#ff0000`

Progress gradient onboarding:
- `linear-gradient(90deg, #ffe160 0%, #ffd213 56%, #ffc901 100%)`

## 9.3 Radius canon

- pills/controls: `999px`
- onboarding shell: `1.15rem`
- game option desktop: `1.04rem`
- game option mobile: `0.94rem`
- micro sample: `0.90rem`

## 9.4 Timings UI canon

- onboarding option transition: `160ms`
- onboarding progress fill: `240ms`
- mascot beat: `2.2s` loop
- pop success/error onboarding micro: `560ms`
- game option transitions: `180ms`
- game correct delay runtime: `2000ms`

## 9.5 Contrat `/play` (sélection de mode)

Layout:
- non scroll, centré
- shell desktop: `min(94vw, 58rem)`
- grille cartes:
  - desktop: 3 colonnes
  - `<=980px`: 2 colonnes
  - `<=640px`: 1 colonne

Couleurs d’identité modes (accent uniquement):
- training: `#40d38f`
- competition: `#ff934a`
- expert: `#58a9ff`

Contrat de lisibilité:
- texte des descriptions de cartes toujours en wrap (pas de coupe horizontale)
- labels de mode (`TRAINING`, `COMPETITION`, `EXPERT`) centrés dans leurs capsules
- `RULES` visible et actionnable dans chaque carte

Mascotte:
- positionnée à gauche du shell principal
- déplaçable (drag)
- commentaire contextuel au survol/focus d’un mode
- bulle forcée côté gauche sur `/play`

## 9.6 Contrat `/play/{mode}/rules` (pages règles actives)

Structure:
- page non scroll au niveau viewport (shell centré)
- shell unique avec en-tête, tabs de mode, panneau de contenu, actions bas de page
- pas de barre de progression sur la page Rules

En-tête:
- badge mode (`TRAINING RULES`, etc.) centré visuellement dans sa capsule
- titre: `How this mode works`
- sous-titre contextualisé par mode

Tabs de mode:
- 3 tabs pills (`TRAINING`, `COMPETITION`, `EXPERT`)
- mode actif coloré avec l’accent du mode courant

Panneau de contenu règles:
- scroll global du panneau (un seul scroll)
- aucun scroll imbriqué à l’intérieur d’une carte individuelle
- hauteur front actuelle: `min(52svh, 26rem)`
- overflow front actuel:
  - `overflow-y: auto`
  - `overflow-x: hidden`
  - `overscroll-behavior: contain`

Sections Training:
- `Round format`
- `Learning logic`
- `Feedback`
- `Detailed training rules` (bloc long)

Sections Competition:
- `Round format`
- `Scoring`
- `Progression`
- `Detailed competition rules` (bloc long)
- feedback court avec affichage du temps de clic exact après chaque réponse

Sections Expert:
- `Round format`
- `Validation`
- `Access`
- `Detailed expert rules` (bloc long)

Actions bas de page:
- gauche: `Back to modes` (CTA plein)
- droite: `Open {Mode}` (CTA contour accentué)

Mascotte sur pages Rules:
- positionnée à gauche du shell
- déplaçable
- bulle de commentaire côté gauche (ne doit pas masquer le shell)

## 10) Type Cards

## 10.1 Définition

Type Card = carte plein écran, temporaire, non interactive, pédagogique.

## 10.2 Familles

- Reading Card
- Misread Card

## 10.3 Reading Card

Rôle:
- renforcer une bonne reconnaissance

Contenu obligatoire:
- nom de la typographie
- phrase courte d’identité visuelle
- une instruction visuelle unique

Interdit:
- encyclopédie
- histoire longue
- multi-thèmes

Politique:
- non systématique
- échantillonnage pour garder le rythme

## 10.4 Misread Card

Rôle:
- transformer l’erreur en correction visuelle immédiate

Contenu obligatoire:
- nom correct
- phrase de confusion plausible
- instruction “quoi regarder la prochaine fois”

Déclenchement:
- première erreur sur la typo dans la session
- ou confusion répétée deux fois d’affilée

Sinon:
- feedback court puis continuation

## 10.5 État implémentation actuel

- Reading Card: implémentée
- Misread Card: logique complète backend non finalisée (runtime front simplifié)

## 11) Modèle de données (canon)

## 11.1 Enums

`GameMode`:
- `training`
- `competition`
- `expert`

`MasteryLevel`:
- `0`
- `1`
- `2`
- `3`
- `4`

`TypeCardKind`:
- `reading`
- `misread`

`AnswerState`:
- `correct`
- `wrong`

## 11.2 Entités

`WordEntry`
```json
{
  "id": "word-alphabet",
  "value": "alphabet",
  "lettersCoverage": ["a", "e", "l", "p", "h", "b", "t"]
}
```

`TypefaceEntry`
```json
{
  "id": "helvetica",
  "label": "Helvetica",
  "fontFamilyCss": "\"Helvetica Neue\", Helvetica, Arial, sans-serif",
  "family": "sans",
  "subfamily": "neo-grotesk",
  "confusionFamilies": ["neo_grotesk_vs_humanist", "tight_spacing_vs_open_spacing"]
}
```

`TypefaceProgress`
```json
{
  "typefaceId": "helvetica",
  "masteryLevel": 2,
  "lastSeenRound": 18,
  "lastResult": "correct",
  "errorCountSession": 1
}
```

`TypeCardEntry`
```json
{
  "id": "misread-neo-grotesk-vs-humanist",
  "kind": "misread",
  "title": "HELVETICA",
  "lineA": "Often confused with Arial because of its neutral appearance.",
  "lineB": "Next time look at tighter spacing and a more rigid rhythm."
}
```

## 12) Contrat API cible (post local)

## 12.1 Start session

`POST /api/game/session/start`

Request:
```json
{
  "mode": "training",
  "onboarding": {
    "pace": "Balanced",
    "familiarity": "A little",
    "onboardingVersion": "v1"
  }
}
```

Response:
```json
{
  "sessionId": "sess_123",
  "mode": "training",
  "sessionWord": "structure",
  "activePoolSize": 30,
  "round": {
    "roundId": "r_1",
    "sampleTypefaceId": "helvetica",
    "sampleFontFamilyCss": "\"Helvetica Neue\", Helvetica, Arial, sans-serif",
    "options": [
      { "id": "helvetica", "label": "Helvetica" },
      { "id": "arial", "label": "Arial" },
      { "id": "inter", "label": "Inter" },
      { "id": "roboto", "label": "Roboto" }
    ]
  }
}
```

## 12.2 Submit answer

`POST /api/game/session/{sessionId}/answer`

Request:
```json
{
  "roundId": "r_1",
  "selectedTypefaceId": "arial",
  "attemptIndex": 1,
  "responseTimeMs": 1460
}
```

Response (wrong, retry possible):
```json
{
  "result": "wrong",
  "attemptClassification": "full_error",
  "roundStatus": "in_progress",
  "correctTypefaceId": "helvetica",
  "masteryDelta": { "typefaceId": "helvetica", "from": 2, "to": 1 },
  "typeCard": {
    "kind": "misread",
    "title": "HELVETICA",
    "lineA": "Often confused with Arial because of its neutral appearance.",
    "lineB": "Next time look at tighter spacing and a more rigid rhythm.",
    "durationMs": 1200
  }
}
```

Contrat:
- `nextRound` requis sur réponse correcte
- `nextRound` optionnel sur mauvaise réponse quand retry-on-same-round est actif
- `attemptClassification` doit valoir `full_error` pour la première erreur du round et `partial_signal` pour les erreurs suivantes du même round

## 13) Contrat local front-only (V1)

Jusqu’au backend:
- simuler la shape de réponse backend côté store/service local
- persister minimal onboarding + seed de session

Local keys proposées:
- `jdt-onboarding-v1`
- `jdt-game-seed-v1`
- `jdt-game-session-v1` (optionnel pour reprise)

## 14) Checklist d’implémentation front V1

A. Catalogues
- `wordPool` typé
- `typefaces` typé
- `readingCardsByTypeface`
- `misreadCardsByConfusionFamily`
- validation schema au chargement

B. Session engine
- `createSession(mode, onboarding)`
- sélection et freeze du `sessionWord`
- initialisation pool actif + map progression

C. Round generator
- `buildRound(sessionState)`
- choix target avec fenêtres de rappel + cooldown
- construction 4 options selon tier de similarité
- unicité et fallback déterministe

D. Answer resolver
- `resolveAnswer(round, selectedId, responseTimeMs)`
- update progression interne
- update prochaine fenêtre de retour
- décision Type Card

E. Renderer Type Card
- overlay plein écran
- interactions bloquées pendant affichage
- auto-dismiss `durationMs`
- reprise flow après disparition

F. UI contracts
- labels options en typo neutre UI
- sample central fidèle à la typo cible
- feedback visuel explicite correct/incorrect
- no scroll sur onboarding/game

G. QA manuel
- mot identique pendant une session Entraînement
- mot changé sur nouvelle session
- mauvais clic rouge / bon clic vert
- retry possible après erreur
- transition 2000ms après bonne réponse
- déclenchement Type Cards conforme règles
- lisibilité mode clair/sombre

## 15) Critères d’acceptation

Fonctionnel:
- 1 typo cible affichée par round
- 4 options affichées
- mapping correct réponse/typo cible
- progression interne respectant niveaux et retours

Pédagogique:
- Type Cards réellement pédagogiques (pas décoratives)
- instruction visuelle unique par carte
- erreurs converties en guidance visuelle

UX:
- aucun blocage inattendu de flux
- transitions cohérentes et lisibles
- cohérence visuelle light/dark

## 16) Out of scope (phase actuelle)

- backend production complet
- auth production
- scoring/ranking compétition final
- moteur expert final côté serveur
