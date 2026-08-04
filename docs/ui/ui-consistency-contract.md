# Contrat de cohérence UI, direction artistique du site

Dernière mise à jour : 2026-07-29.
Statut : **autorité unique en matière de direction artistique.**

Réécrit le 2026-07-29 sur décision du propriétaire. La version précédente datait du 13 mars, donc d'avant tout le travail DA de juin et juillet, et trois autres documents revendiquaient la même autorité. Écrit en français comme les documents de rang supérieur récents (`docs/game/vision-produit-dwiggins.md`, `docs/game/architecture-backend.md`), les identifiants techniques restant en anglais.

## 0. Rang, et la règle qui gouverne tout

**La landing tranche.** La page principale du site, en local sur le port qui tourne, est la référence. En cas de doute sur une couleur, une graisse, un rayon, un timing ou une forme de bouton, on regarde ce qu'elle fait et on le reprend. Ce document n'invente rien : il **consigne** ce que la landing fait déjà, pour qu'un nouvel écran n'ait plus besoin de le redécouvrir ni de l'inventer.

Cette règle venait de l'oral et n'était écrite dans aucun document, ce qui est la cause racine de la dérive : quatre documents se disaient canoniques, aucun ne nommait la landing.

Hiérarchie, désormais explicite :

| Rang | Document | Rôle |
|---|---|---|
| 1 | la landing elle même, dans le navigateur | la référence, elle tranche |
| 2 | **ce document** | consigne ses règles, autorité unique en cas de conflit documentaire |
| 3 | `docs/ui/ui-palette-reference.md` | inventaire descriptif des couleurs présentes dans le code, utile pour repérer les contradictions, ne décide rien |
| 3 | `docs/ui/front-ui-master-spec.md` | architecture des routes et valeurs de timing par écran, ne décide pas la DA |
| 3 | `docs/typography/typography-system-contract.md` | système typo des **spécimens** (la typo à deviner, les pages typo), pas la typo d'interface |
| 3 | `docs/ui/motion.md`, `docs/ui/gate.md`, `docs/ui/profile-tabs-spec.md` | contrats locaux d'un écran |

## 1. La bichromie

Le site est en **deux couleurs**, et ce n'est pas une contrainte subie, c'est l'identité. Le beige est le papier historique de la marque.

- `--beige: #f4f3ee`, `--beige-raised: #faf9f5`
- `--noir: #191510` (une encre chaude, pas un noir pur)
- thème clair : fond beige, encre noire. Thème sombre : fond noir, encre beige.
- **Le blanc pur est banni** de tout ce que voit un joueur. Le balayage du 2026-06-30 a remplacé `#fff` par le beige de marque partout, seuls les labos `/dev` restent à faire.

Encres dérivées, à utiliser plutôt que d'inventer une opacité : `--ink-strong` (0.94), `--ink-muted` (0.58), `--ink-soft` (0.34).

Correction d'une erreur de l'ancienne version : elle donnait encore `background light: #ffffff` et `foreground light: #111114`, périmés depuis juin.

## 2. Chaque couleur a un rôle, et un seul

| Token | Valeur | Rôle exclusif |
|---|---|---|
| `--accent-yellow` | `#ffd213` | accent de marque : soulignement, pastille, trait de guide, état actif. **Jamais un aplat de CTA.** |
| `--success-green` | `#00c853` | validation « correct », rien d'autre |
| `--error-red` | `#ff0000` | validation « erreur », rien d'autre |
| `--ink-warm` | `#2a1a20` | neutre chaud de lecture, pages typo et jeu en clair |
| `--mode-training` | `#40d38f` | identité du mode Entraînement |
| `--mode-competition` | `#ff934a` | identité du mode Compétition |
| `--mode-expert` | `#58a9ff` | identité du mode Expert |
| `--card-1` à `--card-4` | bleu, mint, ambre, rose | palette décorative de cartes, hors validation et hors identité de mode |

**Collision sémantique à trancher, notée et pas encore résolue.** Les trois couleurs de mode servent aussi, sur la landing, de traits de guide dans le schéma d'anatomie de lettre (`.lp-guide-inner`, `.lp-guide-ellipse`, `.lp-guide-diagonal` dans `app/globals.css`). Une même couleur porte donc deux sens sans rapport : « ce mode » et « cette mesure ». Tant que ce n'est pas tranché, ne pas étendre l'usage des `--mode-*` à de nouvelles surfaces.

## 3. Typographie

**Une seule famille d'interface.** Inter, auto-hébergée en variable font dans `public/fonts/ui/`, via `--ui-sans`. Aucune autre famille n'entre dans l'interface. Le mono `--lp-mono` est une **face utilitaire** réservée aux micro-labels techniques (label de coin, données de spécimen), jamais du texte courant.

Exception unique, et elle est le produit : le mot à deviner s'affiche dans la typographie cible.

**Deux régimes d'interlettrage, c'est la signature typographique de la landing.**

- Grand corps : interlettrage **négatif** et interlignage serré. Titre héros `clamp(3.8rem, 13vw, 9.5rem)`, `line-height: 0.86`, `letter-spacing: -0.05em`, graisse 650. Titre de section `clamp(2.2rem, 5vw, 3.85rem)`, `line-height: 1.02`, `letter-spacing: -0.04em`, graisse 650, `text-wrap: balance`.
- Petit corps en capitales : interlettrage **large positif**. Kicker `0.72rem`, graisse 700, `letter-spacing: 0.16em`, capitales, `--ink-soft`. Label de coin en mono `0.62rem`, `0.06em`.

Ce contraste (titres compressés contre labels dilatés) est ce qui donne son caractère à la page. Un écran qui pose un titre à interlettrage neutre ne ressemble pas à la landing, même avec les bonnes couleurs.

**Textes de soutien** : `--ink-muted`, mesure limitée (`34ch` sous un héros, `46ch` sous un titre de section), interlignage 1.45 à 1.5. Une ligne de lede ne court jamais sur toute la largeur.

**Casse** : titres en casse de phrase, labels et pastilles en capitales. Inchangé.

**Discordance à trancher.** Les pages intérieures utilisent `--ui-title-size`, plafonné à `2.75rem`, sans règle d'interlettrage, alors que la référence monte à `3.85rem` avec `-0.04em`. Les écrans intérieurs sont donc typographiquement plus faibles que la page qui les arbitre. À décider : soit `--ui-title-size` s'aligne sur l'échelle de la landing, soit on assume deux niveaux de hiérarchie et on l'écrit ici.

## 4. Boutons

Recette validée, et elle était enterrée dans un commentaire de `app/globals.css` au dessus de `.lp-btn`. Elle est désormais ici.

- Forme : pastille (`--radius-pill`), hauteur minimale `2.9rem`, padding `0.82rem 1.4rem`, corps `0.96rem`, graisse 620.
- **Primaire = l'inverse de la page.** Pastille claire et texte sombre sur fond sombre, pastille sombre et texte clair sur fond clair.
- Fantôme : bordure `1px` de `--line-strong`, fond translucide, encre `--ink-strong`.
- **Aucun jaune en aplat sur un CTA.** Sans exception.

**Écart ouvert, et il est de moi.** `.mode-placeholder-btn--solid` et `.choice-btn--yes` posent un dégradé jaune plein (`#ffe160 → #ffd213 → #ffc901`). Cette recette est utilisée par `/play/expert`, les trois pages de règles et l'écran d'entrée d'Entraînement que j'ai construit le 2026-07-29 en héritant de cette famille. Les pages d'erreur, elles, avaient déjà tranché correctement en prenant les pastilles de la landing. À aligner.

## 5. Formes, rythme, gouttières

- Rayons : `--radius-pill` 999px, `--radius-shell` 1.15rem, `--radius-card` 1.04rem, `--radius-soft` 0.94rem. Pas de valeur intermédiaire inventée.
- Rythme vertical d'une section : `clamp(4.5rem, 12vh, 9rem)` en padding vertical, `--page-gutter-x` en horizontal.
- Largeurs de coquille : `--shell-width-wide`, `--shell-width-game`, `--shell-width-narrow`. Une nouvelle largeur se justifie ou n'existe pas.
- Écart titre vers sous-titre : `--ui-title-gap`.
- Pas d'espacement à la main non documenté.

## 6. Mouvement

- Changement d'état interactif : `180ms ease`. C'est la valeur de la landing, sur `transform`, `border-color`, `background-color` et `box-shadow`.
- Entrée d'un élément : `0.6s cubic-bezier(0.4, 0, 0.2, 1)`.
- Survol : élévation d'un pixel (`translateY(-1px)`) plus renforcement de l'ombre. Pas de changement de couleur brutal.
- `prefers-reduced-motion` respecté partout.
- Détail et exceptions : `docs/ui/motion.md`, vérifié par `npm run check:contracts`.

## 7. Thème

Toute page pleine rend `ThemeSwitch` : fixé en haut à droite, mêmes dimensions, même mouvement, même clé `localStorage` (`jdt-theme`). Une page sans commutateur est un bug.

## 8. Pages de modes

`/play` reste le point de passage avant un mode. Les accents de mode y sont admis comme identité, ainsi que sur les trois pages de règles, sous réserve de la collision sémantique du §2.

Exigences locales conservées de l'ancienne version : la pastille de kicker reste centrée, le contenu des règles défile comme un seul panneau, aucune zone de défilement imbriquée dans une carte.

## 9. Écarts à aligner, mesurés le 2026-07-29

Par ordre de visibilité pour un joueur.

1. **CTA en jaune plein** sur `/play/expert`, `/play/{mode}/rules` et `/play/training`. Contredit le §4.
2. **Titres intérieurs plus faibles que la référence**, sans règle d'interlettrage. §3, à trancher.
3. **Les trois couleurs de mode portent deux sens.** §2, à trancher.
4. **Labos `/dev` encore en blanc pur.** Reste du balayage de juin, non vu par les joueurs, dernier de la liste.
5. **Ce document ne couvre pas encore les pages typo** (`/compare`, `/type`). Leur harmonisation DA est un item ouvert de la checklist, section D.

## 10. Ce que ce document ne décide pas

Il ne redessine rien. La landing reste la référence, ce contrat n'est que sa transcription, et toute divergence entre les deux se règle en faveur de la landing puis se corrige ici.

Il ne décide pas non plus des trois écarts marqués « à trancher » : ils demandent un arbitrage du propriétaire, et rien ne doit être implémenté dessus avant.
