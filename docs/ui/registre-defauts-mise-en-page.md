# Registre des défauts de mise en page

> **À quoi sert ce document.** Marion, le 2026-08-17 : « je voudrais que tu te notes les choses que je demande à régler, parce que peut-être qu'on aura cette erreur à d'autres endroits ». Chaque défaut qu'il signale entre ici avec sa **cause mesurée**, la **règle générale** qu'il faut en tirer, et la **liste des endroits à vérifier**. Un défaut réparé sur une page sans que la cause soit écrite se paie deux fois.
>
> **Rang documentaire.** Document de constat et de méthode. Il ne décide aucune valeur esthétique : les tailles, les couleurs et les espacements appartiennent au propriétaire, comme le dit `CLAUDE.md`. Il note quelle décision a été prise, par qui, et où elle s'applique.
>
> Chaque entrée porte l'état de sa propagation : `réparé ici`, `à vérifier ailleurs`, `réparé partout`.

---

## D1 — À droite, aucun espace pour respirer, la page paraît coupée

**Signalé le 2026-08-17**, sur `/compare/[slug]` en fenêtre téléphone. Mot pour mot : « à droite il y a aucun espace pour respirer, c'est la première chose, pire, on a l'impression que la page est coupée ».

**Cause, mesurée et non supposée.** `.typo-shell` se déclarait `width: min(99vw, 90rem)`, donc en fraction de la **fenêtre**, alors qu'elle vit dans un `main` qui porte déjà `padding: clamp(0.72rem, 2vw, 1.4rem)`. La coquille est donc plus large que la place qu'on lui laisse. Elle garde la gouttière de gauche, hérité du padding du parent, et **dépasse à droite de 7 à 10 px** selon la largeur. Comme `body` porte `overflow-x: hidden`, ce dépassement ne produit pas un défilement visible mais un **bord droit rogné**. D'où la sensation exacte décrite : de l'air d'un seul côté, et une page qui semble coupée.

Relevé avant correction, gouttière gauche puis droite : 12 / -8 à 320, 12 / -8 à 390, 12 / -7 à 430, 15 / -8 à 768, 20 / -10 à 1024, 22 / -8 à 1440. À 1920 le défaut disparaît de lui même, le plafond de 90 rem prenant le relais, ce qui explique qu'on ne le voyait jamais sur grand écran.

**La règle à retenir.** **Une largeur en `vw` est une erreur dès qu'un ancêtre porte du padding.** `vw` mesure la fenêtre, y compris la place déjà donnée aux gouttières, donc l'enfant reprend ce qu'on venait de lui retirer. Un bloc de contenu se dimensionne sur **son parent** (`width: auto` avec `max-width`, ou `100%`), jamais sur la fenêtre. Corollaire vérifié au passage : avec `justify-self: stretch` et une largeur maximale, il faut `margin-inline: auto`, sinon le bloc s'aligne à gauche dès qu'il touche son plafond, mesuré à 1920 avec 22 px à gauche contre 458 à droite.

**Deuxième règle, sur le diagnostic.** `body { overflow-x: hidden }` **cache le symptôme et garde la maladie** : il n'y a pas de barre de défilement horizontale, donc rien n'alerte, et pourtant le contenu est coupé. Ne jamais conclure « pas de débordement » depuis l'absence de défilement : comparer les gouttières gauche et droite, elles doivent être égales.

**Réparé le 2026-08-17 sur `/compare/[slug]` uniquement**, sur consigne (« pour le moment juste cette page »). Après : gouttières **égales des deux côtés** à toutes les largeurs, 12 / 12 à 320, 390 et 430, 15 / 15 à 768, 20 / 20 à 1024, 22 / 22 à 1440, et **zéro élément hors écran** contre 10 avant.

**État : `à vérifier ailleurs`.**

- `/type/[slug]` porte **exactement** le même défaut, même règle `.typo-shell`, et c'est la famille de pages qui sera dupliquée par milliers. À faire dès qu'il donne le feu vert.
- Les trois autres emplois de `vw` en largeur dans `app/globals.css` sont à relire avec cette règle en tête : `.section { width: 100vw }`, plus deux `calc(100vw - 1rem)` sur des panneaux flottants, qui sont eux légitimes puisqu'ils ne vivent pas dans un parent padded.
- Mesuré sain, pas besoin d'y toucher : l'accueil, `/play`, les pages de règles, l'onboarding, les documents légaux, la 404, les six boards du profil.

**Comment le vérifier partout, en une mesure.** Pour chaque page et chaque largeur, comparer `shell.getBoundingClientRect().left` et `viewportWidth - shell.right`. Si les deux ne sont pas égaux, le défaut est là, même sans débordement de document.

---

## D2 — Sur téléphone, les commandes se posent sur le spécimen

**Signalé le 2026-08-17**, capture à l'appui, sur la scène de `/compare/[slug]`. Mot pour mot : « alors tout s'est cassé, j'ai aucune idée comment bien le présenter, mais pour le moment ça marche pas, il faut penser mobile, mobile ». Sur l'image, le grand « a » passe derrière les deux noms de typo, FLIP FOCUS, WORD, LETTER et la rangée de glyphes.

**Cause, mesurée.** La scène est un empilement pensé pour un écran large : les commandes sont en `position: absolute` en bas, et la scène leur **réserve** de la place avec un `padding-bottom` de 9,2 rem, soit 147 px. Sur téléphone ce groupe de commandes mesure **362 px**, donc il remonte de 215 px dans la zone du spécimen, et la lettre, centrée dans ce qui reste, débordait de **143 px** dans la réserve. Une réserve fixe ne peut pas tenir contre un contenu qui grandit quand la largeur diminue.

**La règle à retenir.** **Sur téléphone, on ne superpose pas, on empile.** Ce qu'on regarde, puis ce qu'on touche, dans le flux, sans réserve à calculer. Le positionnement absolu avec réserve de place est une technique d'écran large : elle suppose que la hauteur disponible est grande devant la hauteur des commandes, ce qui est faux sur un téléphone.

**Trois pièges de spécificité rencontrés en réparant**, et ils valent pour toute la feuille, qui compte plus de 9000 lignes avec beaucoup de variantes de deux et trois classes.

1. La réserve de `.compare-stage-view` est posée par une règle de **deux classes située plus bas** dans la feuille. À spécificité égale, la dernière gagne : une règle mobile d'une seule classe ne peut pas la battre.
2. `.compare-stage-overlay` gardait **48 px en haut et 122 px en bas** plus `min-height: 100%`, une seconde réserve invisible qui laissait 277 px de vide après la première correction.
3. La largeur du panneau d'alphabet venait de `min(16rem, 34vw)`, soit **132,6 px à 390**, mesuré au pixel, posé par une règle de trois classes. Des colonnes ajustables dans 133 px ont produit **dix rangées** au lieu de trois, ce qui a empiré le résultat avant de l'améliorer.

**Méthode qui a marché** : ne jamais supposer quelle règle gagne. Parcourir le CSSOM (`document.styleSheets`) à la recherche du sélecteur, lire la **valeur calculée** sur l'élément, et remonter la chaîne des ancêtres en relevant largeur, padding et `min-height` de chacun. C'est ce qui a nommé les trois coupables l'un après l'autre.

**Réparé le 2026-08-17 sur `/compare/[slug]` uniquement**, tout sous `@media (max-width: 768px)`. Après, à 390 px : spécimen 190 px, un vide de 16 px, puis les commandes, **zéro chevauchement** et **zéro élément hors écran**. À 320 px pareil. Le bureau à 1440 est inchangé, spécimen 289 px et commandes toujours en flottant.

**Reste ouvert, et c'est une décision de proportion qui appartient à Marion** : le bloc de commandes mesure 405 px contre 190 px pour le spécimen, parce que l'alphabet des 26 lettres est déplié en permanence sur téléphone, en 7 rangées de cellules de 39 px. Soit on le replie derrière son étiquette, ce qui demande de rendre l'étiquette cliquable dans le composant, soit on assume.

**État : `à vérifier ailleurs`.** Tout écran qui réserve de la place à des commandes flottantes est suspect. À relire avec cette règle : les deux écrans de jeu, qui superposent aussi des commandes à un spécimen.

---

## D3 — Une commande déplacée hérite d'une place qu'elle ne mérite pas

**Signalé le 2026-08-17**, sur la scène passée en colonne (D2), trois remarques d'un coup : « overlay et mesure en haut, trop bizarre », « le flip au milieu comme ça ? », « alphabet tout en bas ? ».

**Cause commune, et c'est la leçon.** Sortir un élément du positionnement absolu ne suffit pas : il retombe dans le flux **avec la place et le poids que le flux lui donne**, pas ceux qu'il avait. Trois exemples dans la même scène.

1. Les bascules OVERLAY et MEASURE étaient ancrées en haut à droite, hors du regard. Rendues statiques, elles sont devenues **la première chose dans le cadre du spécimen**, donc l'endroit exact où il ne faut rien mettre. Réparé par un `order`, la grille de la scène les fait descendre sous la lettre, avec les autres commandes.
2. FLIP FOCUS, en absolu, était un petit inverseur. Dans une grille à deux colonnes il a pris **toute la largeur en crème**, donc il se lisait comme le bouton principal de la page. Réparé en lui rendant sa largeur naturelle, 110 px, centré.
3. Le panneau d'alphabet a **pris ses 230 px de place sans s'afficher** : les mêmes règles à trois classes le gardaient à `opacity: 0`, puisque sur un téléphone le survol qui le révélait n'existe pas. D'où un grand vide avec une étiquette seule. Réparé en reprenant `opacity` et `pointer-events` en même temps que la largeur, et en posant l'étiquette au dessus du panneau au lieu de à côté, ce qui fait passer les 26 lettres de sept rangées à six.

**La règle à retenir.** Quand on fait passer un élément de `absolute` à `static`, reprendre **toutes** ses propriétés de flottant dans le même geste : position, décalages, transformation, largeur, **opacité** et `pointer-events`. Une seule oubliée et l'élément occupe sans montrer, ou montre au mauvais endroit.

**État : `réparé ici`.** À relire avec cette règle dès qu'un autre écran passera en colonne sur téléphone.

**Ce qui reste ouvert sur cette scène, et c'est une décision de présentation qui appartient à Marion.** Les commandes pèsent 406 px contre 190 px pour le spécimen, parce que l'alphabet reste déplié. Deux sorties : replier l'alphabet derrière son étiquette, ce qui demande de rendre l'étiquette cliquable dans le composant plutôt que survolable, ou retirer la rangée des cinq glyphes suggérés sur téléphone puisque l'alphabet complet est juste dessous et les contient.

---

## Méthode de travail arrêtée le 2026-08-17

**Comment Marion regarde.** Une **petite fenêtre Chrome ouverte en direct** à la largeur d'un téléphone sur la page en cours, et rien d'autre. Ses mots : « la page Google Chrome ouverte en direct, on sait très bien, pour que je puisse faire mes corrections, pas besoin de faire une page d'export, je le vois très bien quand tu ouvres une petite page Google Chrome ». Donc pas de galerie de captures, pas d'artifact de rendu. La commande :

```bash
open -na "Google Chrome" --args \
  --user-data-dir=/tmp/chrome-mobile-profile \
  --window-size=390,900 --window-position=40,60 \
  --app="http://127.0.0.1:3002/<la page>"
```

**Piège du serveur de développement, rencontré deux fois le même jour.** L'instance de longue durée du 3002 a servi `globals.css` **avec une révision de retard**, puis a **cessé de le recompiler** : les règles étaient dans le fichier, absentes du navigateur, pendant plus d'une minute. Deux conséquences pratiques.

1. `curl` sur le chunk CSS **ne dit pas la vérité** en développement : Turbopack pousse les mises à jour par HMR au navigateur sans que le fichier servi change. La seule preuve fiable est le **CSSOM du navigateur**, `document.styleSheets` parcouru à la recherche de la règle, plus la valeur calculée sur l'élément.
2. Devant une règle qui semble inopérante, **poser une sonde jetable** (`:root { --sonde: 1 }`) tranche en dix secondes entre « ma règle est mauvaise » et « la feuille n'est pas arrivée ». Et si la sonde n'arrive pas non plus : arrêter le serveur, `rm -rf .next/dev`, relancer. Ne pas chercher plus loin dans le CSS.
