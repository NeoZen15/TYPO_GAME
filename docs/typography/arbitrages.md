# Typographie — arbitrages et pièges

Les décisions prises sur les polices servies, leurs licences et leur conversion, et les pièges qui
ont cassé l'affichage sans rien casser d'autre. Distillé de la checklist le 2026-09-18, sections C,
E et F.

## Le piège qui affichait la mauvaise police

`scripts/mirror_fonts.py` choisissait le fichier de rendu avec `runtimeFiles[0]`, c'est à dire le
morceau au plus petit hachage. Pour plusieurs familles, ce morceau ne contenait presque aucun glyphe,
parfois juste l'espace. **Les mots héros s'affichaient donc dans la serif de secours**, ce qui est
grave dans un jeu de reconnaissance de polices : la question posée n'était pas celle qu'on croyait.

Le script est durci depuis le 2026-07-07, il choisit le morceau qui couvre le latin. Treize faces
cassées dans le manifeste d'entraînement, zéro après. **La leçon dépasse le script** : un fichier de
police présent et servi en 200 ne prouve pas que les glyphes du mot y sont.

## Deux familles qui tomberont toujours en secours

**Cinq polices système** sans fichier de rendu (arial, helvetica, times new roman, georgia, courier
new) sont désactivées et restent à remplacer par du libre avant le lancement. **Trente six faces non
latines** (tamoul, khmer, devanagari, emoji) s'afficheront toujours en secours dans un jeu de mots
latins : à exclure des manches ou à montrer dans leur propre écriture, décision produit non tranchée.

## Le garde des licences, et pourquoi il est là où il est

**Liste blanche, jamais liste noire.** Seules `ofl`, `apache2` et `ufl` passent. Nul, vide, inconnu,
propriétaire et tout label ajouté plus tard échouent en fermé.

**Le garde est posé dans les deux requêtes de pool**, celles qui décident ce qu'un joueur peut voir,
et pas dans un composant. La bonne réponse et les leurres sortent du même lot, donc filtrer plus haut
laisserait passer par le bas. Un garde-fou contournable ne sert à rien.

Cas particulier assumé : les cinq polices Ubuntu sont libres mais leur étiquette n'existe pas dans
l'énumération de la base, donc elles sont listées par leur nom dans le garde, avec une migration
écrite pour refermer proprement le jour où elle sera appliquée.

## Un fichier de police est un logiciel protégé

**Le télécharger ou le posséder sans licence est illégal, même sans le servir.** Il y a des procès
réels là dessus, à plusieurs millions. Donc **aucun fichier de police commerciale dans les dossiers
du projet**, jamais, y compris pour un essai local. Les libres sous OFL ou Apache sont l'exception,
et c'est ce sur quoi le produit est bâti.

**Une licence de bureau autorise en revanche à produire des images.** Un rendu en PNG ou en SVG
d'une police commerciale est utilisable, y compris commercialement, ce qui ouvre la seule voie
légale pour montrer une police qu'on n'a pas le droit de servir.

## Auto-héberger, c'est redistribuer

C'est la phrase qui tranche tout le sujet. La licence OFL autorise tout ce que fait le projet,
afficher, auto-héberger, sous-ensembler en latin, publier des pages, monétiser, et **n'exige aucune
mention dans le pied de page**. Sa seule condition est que le texte de la licence accompagne les
fichiers de police. Même exigence côté Apache 2.0 et côté Ubuntu.

État mesuré avant correction : 1179 dossiers de polices, **un seul fichier de licence**. Corrigé par
1177 fichiers **recopiés octet pour octet depuis l'instantané Google**, jamais rédigés : un texte de
licence qu'on réécrit n'est plus une licence.

## Six familles dont les sources se contredisent

Certaines familles déclarent une licence dans leur binaire et une autre dans la fiche de catalogue de
Google. **Règle uniforme retenue : livrer le fichier que Google livre avec la famille**, c'est à dire
redistribuer sous les termes sous lesquels nous avons reçu la police. Comme les deux licences
concernées autorisent l'une et l'autre ce que fait le projet, la divergence ne change pas ce qui est
permis, seulement la notice qui doit accompagner les fichiers. Les six cas sont nommés dans le script
de recopie **pour qu'un futur réimport ne les redécouvre pas de zéro**.

## Deux champs laissés vides exprès

**`foundry` reste vide.** Le seul champ disponible nomme une personne, pas une fonderie, et le
copyright n'est pas exploitable en masse : sur deux mille polices, cent quarante six seulement
portent une raison sociale, noyée dans du texte libre. Un remplissage automatique produirait de la
donnée fausse.

**`release_year` reste vide.** La seule date disponible est celle de mise en ligne chez Google, pas
l'année de dessin. La renseigner daterait Libre Baskerville de 2012 au lieu du dix-huitième siècle.

Proposition ouverte plutôt que de tordre ces deux champs : ajouter une colonne honnête pour la date
de mise en ligne. Changement de schéma, donc décision du propriétaire.

## PP Frama, deux problèmes et non un

Le bloqueur de mise en ligne ne porte pas sur le logo. **Le mot dessiné est entièrement vectorisé**,
aucun texte, aucune famille déclarée. Ce qui sert les fichiers `.otf` aux visiteurs, ce sont les
badges du profil et leurs trois déclarations de police. Donc deux questions distinctes : **la fonte
servie**, qui est de la distribution et qu'une licence de bureau interdit, et **le mot vectorisé**,
qui est une question d'usage. Seule la première bloque.

**Et la mesure change les termes de l'achat** : piloté au navigateur, **le site ne télécharge jamais
la police aujourd'hui**. Les déclarations existent sur deux onglets du profil, mais aucun glyphe
n'est demandé. L'exposition est donc ailleurs que là où on la croyait, ce qui vaut d'être vérifié
avant de payer une licence de diffusion.

## Le nom d'une police change d'un projet Adobe à l'autre

**Les noms de famille ne se déduisent jamais du slug.** `Franklin Gothic URW Extra Compressed` est
servie sous `franklin-gothic-ext-comp-urw`, qui n'est pas une troncature. Adobe les nomme à la main,
sous 28 signes. Ils ne peuvent venir que du kit lui même.

Un nouveau projet web ne déclare pas non plus ses polices sous le même nom que le projet historique :
`lust-didone-1` au lieu de `lust-didone`, **le suffixe appartient au projet**. La pile de repli du
catalogue doit nommer exactement ce que la feuille déclare, sinon le navigateur tombe sur une police
de secours et **le jeu demande de nommer un dessin qui n'est pas celui de la question**. C'est le
même défaut que le morceau sans glyphes latins, par une autre porte, et c'est celui que ce produit
ne peut pas se permettre. Toujours relever les noms projet par projet, jamais les déduire.

**La publication d'Adobe est asynchrone**, donc une couverture mesurée juste après un remplissage
est encore l'ancienne. Mesurer trop tôt fait conclure que la place manque et pousse à remplir
davantage, ce qui gâche la place.

## Adobe héberge aussi les polices libres qu'on sert déjà

**176 familles de la vague de masse étaient déjà au catalogue**, et une comparaison de slug brute
n'en voyait que 24 : le catalogue écrit `sourcesans3` là où Adobe écrit `Source Sans 3`. La
comparaison se fait donc sur une clé normalisée, lettres et chiffres seulement. **Sans ce filtre, le
jeu contiendrait deux fois le même dessin, servi de deux endroits, avec deux réponses attendues.**

## Parler à Adobe : ne jamais croire la réponse de l'interface

**Un 504 veut dire réessaye, pas trop gros.** Leur passerelle abandonne vers une minute et la durée
du travail varie avec leur charge. À 250 familles exactement, une tranche a rendu 504 quand une
autre publiait sans broncher, et une tranche a refusé cinq fois de suite avant de passer. Republier
jusqu'à cinq fois, et ne jamais conclure d'un code de retour.

**Vérifier la feuille servie, jamais la réponse de l'interface.** Une publication a rendu 200 sans
changer la feuille d'un octet. Et **un 404 sur la feuille veut dire jamais publié, pas cassé** : elle
n'existe pas avant la première publication réussie et met quelques secondes à apparaître, donc la
traiter comme une erreur fatale arrête tout pour rien.

**L'ajout se fait une famille à la fois**, environ une seconde, éprouvé sur plus de quatre mille.
Cinq cents d'un coup répond 504 : c'est la taille du travail qui coince, pas la forme de la requête.

**Un brouillon non publié ne sert à personne, dans les deux sens du terme** : tant que la publication
n'a pas abouti, la feuille publique ne bouge pas, donc le site ne voit rien et rien n'est cassé
pendant une injection de plusieurs heures.

**Le poids n'a jamais été le problème** : 57 octets compressés par famille, donc six mille familles
coûteraient 334 Ko, une fois, en cache.

## Le plafond Adobe est mesuré, pas supposé

Huit projets web poussés à environ 490 familles, publiés trois fois de suite avec quatre minutes
d'attente. Résultat identique aux trois tournées : **un projet web sert 250 à 300 familles, jamais
plus**. Au delà, la publication ne se termine jamais, quelle que soit la patience. Le script refuse
désormais au delà de 300, avec la mesure en commentaire, pour que personne ne recommence.
