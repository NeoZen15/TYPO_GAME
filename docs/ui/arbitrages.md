# Interface — arbitrages et pièges

Pourquoi l'interface est comme elle est et ce qui a été refusé. Le contrat de cohérence reste
l'autorité, ce fichier garde les décisions.

## La landing tranche, et c'est écrit une seule fois

**Quatre documents revendiquaient l'autorité**, tous antérieurs au travail de juin et juillet, et la
règle réelle n'était écrite dans aucun. C'est la cause de la dérive, pas un défaut de goût. Depuis le
2026-07-29, `ui-consistency-contract.md` est l'autorité unique.

**Une recette validée qui vit dans un commentaire CSS n'existe pas.** « Pas de jaune en aplat sur un
bouton d'action » était respectée depuis le début, écrite au dessus de `.lp-btn`, invisible de toute
documentation. Trois écrans l'enfreignent pour cette seule raison.

## La sensation de bloc vient de la typographie, jamais d'un contour

`.lp-section` n'a ni bordure, ni fond, ni rayon. Elle sépare par un grand pas vertical et un grand
titre, rien d'autre. **Des blocs dans des blocs sont un enfer** et la landing prouve qu'ils sont
inutiles : ce qu'une carte apporte vraiment, la largeur et le centrage, se garde sans son contour.

**Enlever tous les conteneurs marche, et c'est mieux.** Ce qui disait « agis là dessus » n'a jamais
été la bordure, c'était la phrase et les boutons dessous. Sans cadre, des spécimens sont des lettres
posées sur la page et non des vignettes dans des boîtes. Quand une page ne va pas, le défaut est
souvent qu'il y a **trop** de blocs, pas qu'ils sont mal rangés.

**On retire sans remplacer.** Une inclinaison au survol était l'effet le plus gadget de la page et le
seul dont elle ne dit rien une fois parti.

**Une ligne lisible fait 440 pixels dans un panneau qui en fait 1011.** Toute prose posée en pleine
largeur est donc un ruban collé à gauche avec 55 % de vide à côté de chaque phrase. D'où l'anatomie
en deux colonnes, ce qu'on touche à gauche, ce que ça veut dire à droite, déclarée chez le parent
pour que les panneaux ne puissent pas diverger.

## Lire la feuille de style ne remplace pas regarder la page

Quatre tours de correction sur une même page s'expliquent par une seule chose : **la landing avait
été lue dans son CSS, jamais ouverte**. Une capture a suffi. Sa figure est toujours la même, un
surtitre en monospace, un grand titre aligné à gauche sur deux ou trois lignes, un lede court, un
bouton fantôme, et l'objet à droite dans la même rangée. **Rien de centré, une seule asymétrie
répétée, et beaucoup d'air.**

## Retirer un effet global, c'est inverser un défaut

Le champ d'étoiles a quitté tout le site sauf la constellation, où les étoiles **sont** le dessin et
non une ambiance. Ce n'était pas une suppression : le système posait « il y a un ciel » comme règle
et le plat comme variante. **Inverser le défaut est la seule façon propre de le faire**, sinon dix
surfaces continuent de monter leur propre calque.

## Deux recettes de mise en page qui tiennent

**Une page écran se verrouille avec `height: 100svh`**, pas `min-height`. Mais le verrou doit être
borné aux largeurs où le contenu tient : trois cartes empilées font 975 pixels sur un écran de 844,
et le verrou coupait la troisième. **Une page qui coupe n'est pas une page qui ne défile pas.**

**Une barre de récapitulation se pose en `sticky`, jamais en `fixed`.** Mesuré, elle reste au bas de
la fenêtre pendant le défilement puis **se repose à sa place naturelle en fin de page** : elle ne
recouvre donc jamais la fin du formulaire et n'oblige à réserver aucune marge.

**Une commande est toute sa ligne.** Un bouton poussé au bord droit par un `space-between` se
retrouve sept cents pixels plus loin que la phrase qu'il ouvre, invisible même pour qui a construit
la page. La rangée entière devient la cible.

**Le flou dit ce qui n'est pas encore atteint**, sans rien cacher : la forme des étapes reste
lisible, seul le détail attend. Et **une étape nette le reste** : reflouter en remontant
reviendrait à brouiller ses propres réponses, la faute que ce genre d'effet commet presque toujours.

**Un réglage qu'on ne voit plus ne peut pas commander la page.** L'accent suivait un bloc replié par
défaut, donc on ouvrait sur une couleur dont la cause était cachée. Il est passé au premier contrôle
visible.

## Chercher le geste existant avant d'en dessiner un

**Le site a déjà une façon de faire, il faut la trouver.** Une animation d'entrée avait été écrite à
la main alors que `lp-specimen-in` existe et **est** la façon dont ce site change une police. Deux
façons de revenir en arrière existaient déjà, un fil de navigation et un retour d'un niveau : la
troisième a pris la structure du premier et la peau du second, rien n'a été inventé. Et **un libellé
de retour nomme la destination, pas l'action**.

## Un contrôle qui n'existe nulle part ailleurs ne s'invente pas

Le curseur renforcement contre découverte est un **choix à trois positions et non une réglette**,
délibérément : une réglette n'existe nulle part dans le produit, donc son dessin appartient au
propriétaire. Trois positions se composent avec ce qui est déjà validé.

Même logique côté écrans : **l'écran du devoir ne déclare aucune direction artistique**, il compose
les classes déjà en service.

## Deux décisions de composition

**Une seule barre de navigation** partagée, appliquée par les gabarits, donc les quelque deux mille
pages de spécimen l'héritent sans travail page par page.

**Les cartes des modes ne sont pas en éventail.** Sur la landing le chevauchement est une accroche.
Sur la page de choix, le choix se fait vraiment, donc une carte qui en couvre une autre masque la
ligne qu'on vient comparer. Même logique pour les chiffres : ce qui fait cliquer n'est pas ce que le
mode **est** mais où le joueur **en est**, et un joueur sans historique est prévenu au lieu de voir
un zéro qui se lit comme un échec.

## Ce qui appartient au propriétaire

**Badges** : ne supprimer aucun candidat, rareté en couleur pleine, référence de qualité le bloc
éditorial.

**Trois arbitrages ouverts** : le jaune en aplat des boutons `/play`, l'échelle de titre intérieure
qui plafonne à `2.75rem` contre `3.85rem`, et la collision des trois couleurs de mode avec les traits
de guide du schéma d'anatomie.

## Quand une page ressemble à une voiture de course, retirer des données

« On est sur la NASCAR » désigne une page couverte d'informations qui se disputent l'attention. La
réponse est de **retirer**, pas de mieux ranger. Et **un menu de téléphone s'ouvre discrètement**, il
ne prend pas tout l'écran.

## Compter les écrans qui séparent du premier geste

Le chemin le plus court vers une question faisait **quatre écrans**. Sur un produit qui se juge à la
première question jouée, cette distance est le premier chiffre à mesurer, avant toute discussion de
composition.

## Une référence sert à comprendre la méthode, pas à être copiée

Après une passe où j'avais reproduit un modèle trait pour trait : « ce que je t'ai envoyé, c'est pour
que tu comprennes comment on le fait, pas pour que tu fasses exactement la même chose ». Une
référence donne une anatomie, pas les couleurs ni les habitudes de la maison.

## Une page de règles répond à une seule question

**Ce qui te fait avancer, ce qui te fait reculer.** C'est la question pour laquelle on ouvre une page
de règles, et elle n'y était répondue nulle part avant six panneaux. En tête, deux colonnes, cause
puis conséquence, sans vocabulaire de mécanique. Et **une page de règles n'est pas un terrain de
jeu**.

## Un graphique prouve une idée déjà comprise

La phrase du propriétaire règle tout le sujet : « le graphique doit venir prouver une idée que j'ai
déjà comprise, et non me demander de comprendre le produit à travers le graphique ». Une série de
planches avait raconté le produit **comme un audit du code**, relevés en titres et noms de variables
en légende : le lecteur apprenait beaucoup et n'obtenait rien. Le texte pose l'idée, la figure la
démontre, jamais l'inverse.

## Les trois réflexes de machine, ceux qui font dire « trop Claude »

Diagnostic posé sur une planche jugée ainsi, et ce n'était pas un défaut de contenu.

**Une grosse carte arrondie qui contient tout**, réflexe qui enferme au lieu de composer. **Des
cotes écrites sous chaque objet**, qui transforment une présentation en fiche technique. **Une
régularité parfaite** là où la page demandait un rythme. Ce sont trois automatismes, pas des choix,
et ils se reconnaissent à ce qu'aucun ne répond à une question posée par la page.

**Un bloc de composants doit présenter, pas spécifier.** Hauteurs, rayons, pourcentages et cotes
appartiennent au code et au contrat, pas à la planche qui montre l'objet.
