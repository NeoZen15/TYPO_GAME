# Interface, le système — jetons, palettes et pièges de mesure

Comment le système qui dessine est construit, et les pièges qui ont fait conclure faux. Séparé de
`arbitrages.md` le 2026-09-18 : ce qu'on dessine et le système qui le dessine sont deux domaines, et
les tenir ensemble obligeait à couper dans l'un des deux.

## Trois pièges qui ont menti

**Le serveur de développement sert régulièrement une feuille périmée.** Il a fait conclure à tort au
moins quatre fois. Un `touch` force la recompilation, une fois il a fallu vingt secondes de plus.
Deux corollaires : **le nom du morceau CSS ne prouve rien**, il dérive du chemin du module et non du
contenu ; et **une mesure qui ne bouge pas après une édition ne prouve rien** tant que la règle n'a
pas été relue dans la feuille réellement servie.

**Une variable CSS absente n'atténue pas, elle invalide.** Dans un `color-mix()`, elle rend la
déclaration invalide, donc tout ce qui passe par l'accent tombe ensemble : fonds, encres, contours,
bouton, calendrier. Une seule ligne manquante fait dire « ça a tout cassé ». D'où le repli
systématique dans le `var()` : un défaut qui coûte une page entière ne doit pas dépendre d'un cache.

**Dépeindre une surface sans toucher à son garde le rend faux sans le faire échouer**, ce qui est
pire que de le casser : il mesure encore les encres contre un fond qui n'existe plus.

## Deux couleurs, et aucune inventée

La charte n'en a que deux. Une barre peinte en noir mélangé à douze pour cent de crème ne donne ni
l'un ni l'autre, **elle donne une dalle grise** qui n'appartient à rien.

Palette tranchée : vert `#00c853`, rouge `#ff0000`, neutre chaud `#2a1a20` contre le noir pur, rose
`#f39ab1` gardé pour un rôle distinct. **Plus de blanc pur** côté joueurs, `#fff` passe au beige
`#f4f3ee` ; les laboratoires `/dev` sont épargnés exprès.

**Jamais de couleur par logique sémantique.** On relève ce que le produit peint déjà, sinon on reste
neutre et on le signale. Les trois teintes de mode n'ont jamais servi qu'à nommer les trois modes ;
les donner au cran d'exigence leur ajoute un second emploi, assumé parce que **les trois modes sont
déjà une échelle d'exigence**. La teinte change de support, pas de sens.

**Une couleur nommée se choisit par mesure.** Le violet du contrôle a été retenu parce que sa
luminance tombe dans la bande des trois autres, 8,7 de contraste sur noir entre 8,5 et 9,5. Un
violet doit être plus clair en teinte et saturation que ses voisins pour peser autant. Et elle se
déclare dans le bloc canonique, jamais à côté : une quatrième valeur posée ailleurs est ce qu'un
commentaire du code a déjà dû défaire une fois.

## Il n'y a pas une palette, il y en a quatre

Le relevé l'a fait surgir là où la lecture du fichier ne le montrait pas : la principale, celle des
pages typo, et deux autres portées par des coquilles. **Une correction posée sur une seule ne
corrige rien ailleurs**, et c'est ce qui a laissé 97 textes illisibles en thème clair.

**Le thème clair est en réserve, pas supprimé**, derrière un seul drapeau, et le fichier porte le
raisonnement pour que le rallumage ne reparte pas de zéro.

## Un garde de jetons, jamais un garde de pixels

Mesurer le rendu demanderait un navigateur et un serveur **à l'intérieur** de la porte qualité, qui
deviendrait lente et fragile. Or **le défaut ne vit pas dans les pixels, il vit dans les jetons**.
Le garde compare donc les encres aux fonds déclarés, palette par palette.

## Un jeton se nomme par ce qu'il sert, pas par où il est né

Les jetons de la barre de navigation servaient en réalité **quatre** surfaces qui s'inversent contre
la page, les trois barres et le pied. Les laisser s'appeler « nav » aurait envoyé la prochaine
personne chercher au mauvais endroit. Renommés, 71 occurrences.

## Un rayon déclaré n'est pas un rayon peint

**Le point le plus contre-intuitif du système.** Le navigateur re-plafonne tout rayon à la moitié du
plus petit côté de la boîte : déclarer 16 px sur une bande de 24 px de haut en peint 13, sur une de
27 px en peint 14. **Généraliser un jeton de rayon ne généralise donc pas le rendu**, et c'est
pourquoi trente-six rayons apparaissaient là où deux jetons seulement sont déclarés. Le fichier est
discipliné, 159 déclarations sur 173 lisent un jeton : ce n'est pas là que ça se joue.

## Compter avant de conclure

« Cent dix-neuf ombres » mélangeait trois dispositifs sans rapport. Le compte réel donne 99
déclarations, dont 57 ombres portées, 7 filets internes, 3 anneaux de focus et 11 annulations
explicites. **Un inventaire qui ne distingue pas les dispositifs ne mesure rien.**

## Mesurer la vitesse sur un vrai build, jamais en développement

Et chercher le poids là où il est : une grosse bibliothèque d'animation n'était importée que par
deux pages, et le découpage par route fait qu'aucune autre ne la paie. **Le coût réel était dans le
nombre d'allers-retours du chemin de réponse**, pas dans la taille du paquet.

## Le responsive se mesure au navigateur, route par route et largeur par largeur

Vingt et une routes passées à huit largeurs, de 320 à 1920 pixels, avec relevé du débordement
horizontal, des éléments coupés par un parent, des grilles restées en plusieurs colonnes et des
tailles réellement rendues. **Les deux intuitions du propriétaire se sont vérifiées**, mais seule la
mesure a donné la liste complète.

## Deux pièges d'outillage

**Un arbre de travail imbriqué se fait analyser comme le reste.** Un dossier de branches parallèles
posé sous le dépôt a fait remonter 413 erreurs et plus de cinq mille avertissements qui
n'appartenaient à personne, et qui ont disparu en l'excluant.

**Un chiffre qui circule sans source n'est pas un chiffre.** Le nombre de polices jouables se
transmettait de document en document sans que personne sache d'où il sortait, et deux documents en
annonçaient des valeurs différentes. Le vérifier a pris dix minutes.

## Un garde rouge ne l'est pas toujours pour la raison annoncée

Un contrôle est resté rouge en laissant croire que la règle qu'il protège était enfreinte. La cause
réelle : **Node ne lit pas la configuration TypeScript**, donc un import par alias lui répond que le
paquet n'existe pas. Le jour où un adaptateur a eu besoin d'un module partagé, le garde est tombé
sur l'alias et pas sur son sujet. Lire le message d'erreur avant de corriger la règle.

## Consigner un diagnostic faux

Une lenteur avait été annoncée comme venant d'un transport de données au pire moment. **La mesure a
donné une autre cause.** Le chiffre final était bon, l'explication donnée en chemin ne l'était pas,
et c'est ce genre d'écart qui se recopie ensuite de document en document. Dire qu'on s'est trompé
coûte une phrase, le laisser passer coûte une enquête.
