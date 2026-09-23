# Jeu — arbitrages et pièges

Pourquoi le moteur est comme il est, ce qui a été refusé, et ce qu'il ne faut pas refaire. Les
spécifications voisines décrivent le fonctionnement, ce fichier décrit les décisions.

## Le niveau déclaré ne fait pas la difficulté

Le niveau choisi à l'onboarding **n'est qu'un prior de contenu**, gelé après le seed : il dit quelles
polices entrent dans le pool, pas à quel niveau on démarre. Tout le monde part à maîtrise 0, donc un
faux expert reste coincé sur du difficile sans jamais redescendre. C'est le trou que comble le moteur
d'auto-correction.

**Le skew a d'abord été inerte** : 25 polices éligibles pour 30 à distribuer, donc les quatre
niveaux recevaient le même pool. **La correction ne vaut que pour les nouveaux joueurs.**

## Les invariants qu'on ne discute pas

**I-06**, on n'enlève jamais une police du pool, toute correction est additive. **I-07**, le pool ne
reste jamais gelé. **I-08**, le moteur lit le niveau visible, il ne l'écrit pas. **I-18 et I-20**, la
maîtrise ne s'affiche jamais comme une note : la représentation de l'élève est la carte du regard,
le niveau Dreyfus restant une variable interne.

**I-26, le parcours personnel est premier et autonome**, sans école ni professeur. En construisant
l'espace enseignant, le produit pouvait glisser vers un outil scolaire où l'élève ne joue que si on
lui donne quelque chose : l'assignation est un **second** parcours qui coexiste. **I-27**, symétrie
des recommandations entre le professeur et l'élève, même méthode et jamais les mêmes sources.

**Règle de lecture d'un audit** : le code est une **implémentation**, pas une intention. Un écart
avec la vision se tranche, il ne prouve pas que la vision avait tort.

**Une formule documentée était fausse** : le niveau visible n'est pas une moyenne de fractions mais
un **compte** de polices à maîtrise 4 ou plus, projeté sur 25 crans par une table de seuils.
Vérifier la base avant de citer une formule.

## Un levier, un conducteur par contexte de séance

Les crans d'exigence ne créent pas de système de difficulté parallèle : **ils ne touchent que la
proximité des mauvaises réponses**, le seul levier que la spécification autorise pour le choix
multiple, et laissent intacts la face demandée, la maîtrise, les intervalles, la rareté et le niveau
global. Ce levier a désormais deux conducteurs, **jamais en même temps**. Le cas à venir est nommé :
le niveau global voudra le même levier en séance personnelle.

## Un ratio élevé désigne une décision d'architecture, pas un usage

Motif le plus coûteux du produit. **Trois seuils de comportement proposés, trois démontés par la
mesure** : « refermées en moins d'une seconde » mesurait la latence entre deux écritures du serveur,
« séances sans question » le démarrage au chargement de la page, « terminées sans réponse » le
chronomètre. Aucun ne parlait d'un joueur.

**Cause commune : une séance est créée au chargement de la page, pas sur un clic.** Tout indicateur
bâti sur le nombre de séances mesure des ouvertures de page. D'où un vocabulaire fixé : **une
ouverture du jeu** est une séance sans réponse, **une partie** en porte au moins une, et c'est le
seul nombre qui a le droit de s'appeler ainsi. Le mot **actif est proscrit**, il avait désigné deux
populations en deux jours.

## Deux règles de garde apprises à leurs dépens

**Un contrôle qui signale le fonctionnement normal est pire qu'aucun contrôle** : l'un remontait 108
polices sans fichier déclaré, c'était le kit Adobe, qui se rend par nom de famille. **Un faux
« conforme » est pire qu'un manque** : un autre validait en trouvant le mot « rétention » dans un
fichier qui parlait de mémoire.

## Le catalogue ne se déverse pas

**Ne jamais activer les milliers de polices brutes** : beaucoup sont des display, donc du mauvais
matériel pédagogique. Vagues curées, et **le goulot est la curation, pas le code**. Les familles de
masse entrent en **rare et difficile**, donc aucune n'entre dans un premier pool.

**La notoriété est l'axe de progression** : les polices les plus connues sont proposées les
premières parce qu'elles sont les plus simples à nommer, les moins connues arrivent quand le joueur
progresse. Le champ existait depuis longtemps mais valait « commun » sur 1148 des 1172 polices
actives, donc il ne triait rien : il est reconstruit depuis le rang de popularité.

**Les familles proposées viennent du manifeste, jamais d'une liste écrite à la main** : ce qui entre
au manifeste entre dans le choix, sans qu'un fichier soit à retoucher.

## L'anti-triche est résolu par le dessin du jeu

La bonne réponse **est** la police affichée, que le navigateur doit connaître puisque c'est lui qui
peint le mot : chiffrer ne cacherait rien que la feuille de style ne dise déjà. Le serveur reste seul
juge, un score n'est pas forgeable. Reste un sujet produit : **un élève peut lire la réponse en
inspectant la page**, à trancher le jour où un devoir compte.

## Un exercice se choisit par son effet, pas par un mode

Exercice, Contrôle, Compétition sont dits en **effets** : ça compte dans leur progression, ça mesure
sans y toucher, ça fait performer. **Le mode du moteur en découle**, il n'est plus choisi à la main.
Pour le moteur un contrôle vaut d'ailleurs `training`, ce qui n'est pas ce qu'il est pour le
professeur.

**Toute comparaison à la classe porte sa qualification à côté du chiffre** : on qualifie, on ne
masque pas. Et les mauvaises réponses sont choisies pour leur proximité visuelle **dans tout le
catalogue jouable**, jamais dans un sous ensemble.

## Un défaut que seul quelqu'un qui joue pouvait voir

**La bonne réponse était toujours le premier bouton en entraînement**, invisible à la lecture du
code et vidant le jeu de son sens. Un garde le vérifie désormais.

## Une jumelle ne peut pas être un leurre

Le jeu pouvait montrer un mot et proposer quatre variantes d'une même famille qui **dessinent le
latin à l'identique** : la question n'avait alors pas de réponse. Le correctif n'enlève **aucune
police du catalogue**, il interdit à deux dessins indiscernables de se retrouver dans le même choix.

## Les clusters visuels se mesurent dans les fichiers, ils ne se déduisent pas

Le cluster décide des mauvaises réponses, une police du même cluster valant un fort malus dans le
tri des leurres. Or **trois clusters portaient 85 % du catalogue actif**, donc ce malus ne
discriminait plus rien. La géométrie est désormais relevée dans les fichiers de police eux mêmes.

**Et un chantier qui échoue sur sa question peut valoir par ce qu'il trouve à côté** : la
reconnaissance de forme n'a pas su séparer les linéales humanistes, mais elle a mis au jour un défaut
plus grave en chemin.

## Un profil mesuré peut décrire une police que le joueur ne voit pas

Le profil géométrique d'une famille se calcule sur un fichier ; ce que le joueur voit est ce que le
navigateur peint, avec la graisse réellement servie. **Les deux peuvent diverger**, et c'est le
navigateur qui a raison. Toute mesure qui nourrit le jeu se vérifie donc à l'écran, pas seulement
dans le fichier.

## Le bonus de vitesse repose sur un temps déclaré par le client

Le doublement des points est décidé par la durée que **le navigateur annonce**, et l'horloge du
serveur ne retombe au point simple qu'au delà de sept secondes réelles. Un joueur qui déclare zéro
touche donc le bonus à chaque bonne réponse, même s'il a mis six secondes. **Ce n'est pas une faille
de sécurité, c'est une question d'équité en compétition**, et elle attend un arbitrage.

## Ce qui reste non tranché

**Maîtrise 0 à 4 contre boîtes Leitner 0 à 5**, à trancher avant de figer le scoring. **Le mode
Expert n'existe pas**, seules les clés de réponse. **L'Arène attend le lancement**, son mur est la
population de joueurs.
