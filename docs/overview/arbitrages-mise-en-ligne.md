# Mise en ligne, légal et marque — arbitrages et pièges

Les décisions qui engagent le projet vers l'extérieur : le dessin de marque, le cadre légal, le
référencement et la monétisation. Distillé de la checklist le 2026-09-18, sections E et G.

## Le symbole était un décalque, et ça s'est vu à l'œil

`dwiggins-symbol-standalone-black.svg` reproduisait une image trouvée sur Pinterest : mêmes contours,
mêmes trois têtes détachées, mêmes proportions. **Ce n'est pas une inspiration, c'est une
reproduction**, et il n'y avait aucun droit dessus. Constat du propriétaire le 2026-08-14, confirmé
image contre image.

**L'exposition a été mesurée avant de paniquer** : aucun déploiement n'existait, donc le dessin ne
vivait que sur la machine, dans la charte et dans le dossier envoyé à Adobe, seul endroit d'où il
avait pu sortir.

Redessiné au pinceau le 2026-08-19, une seule masse continue. **La direction tenait en une phrase :
des humains, pas des formes abstraites.** On garde l'esprit d'origine, corps pleins, mouvement, mains
qui se rejoignent, un seul aplat, et on change la structure, en ronde. Le vide central ne porte
volontairement aucun message, mais il doit être dessiné exprès et non subi.

**Piège en reprenant le dessin** : deux fragments parasites flottaient loin au dessus du tracé et
définissaient à eux seuls le haut du cadre de sélection, donc **tout calage pris dessus aurait été
faux**.

**Favicon : pas de version réduite**, le dessin entier dans un disque noir, qui fait le travail que
le tracé ne peut pas faire seul en petit.

## L'hébergement gratuit a une date de péremption

**Le plan gratuit de l'hébergeur est réservé à l'usage non commercial**, et le jeu deviendra payant
puisque la spécification des licences scolaires existe. L'hypothèse actuelle est donc datée, et le
choix d'hébergement doit être repris **avant** la première recette, pas après.

**Sur le domaine, une option payante écartée à raison** : le registre français anonymise déjà
gratuitement un titulaire personne physique, vérifié chez deux bureaux d'enregistrement. L'option de
confidentialité vendue à côté ne protège rien de plus.

## Le cadre légal, ce qui a été corrigé et ce qui reste

**Les données ne sont pas en Union européenne** mais à Londres, sous décision d'adéquation. La
politique de confidentialité le dit depuis le 2026-08-15, elle affirmait le contraire avant.

**Une notice de stockage, pas un mur de cookies** : le seul cookie est strictement nécessaire et
aucune mesure d'audience n'existe, donc le mur serait un mensonge poli.

**Sept informations n'appartiennent qu'à l'éditeur** et bloquent la mise en ligne, de l'identité
juridique à la durée de conservation ; la porte qualité les rappelle à chaque passage. La relecture
juridique reste à faire : le texte est fidèle au produit, ce qui ne veut pas dire suffisant.

**Une dérive plutôt qu'une faute, et c'est ce qui impose un contrôle récurrent.** La politique
affirmait que le navigateur n'appelait aucun tiers ; huit jours plus tard les polices Adobe passaient
en production. Personne n'a menti, le produit a bougé et le document est resté. Un audit ponctuel
corrige une fois, il n'empêche pas de recommencer.

## Trois états dans le contrôle de conformité, et pas deux

**Conforme**, **écart** (un défaut du dépôt, qui fait échouer), et **attente** (une information ou
une décision que seul le propriétaire détient, qui ne fait pas échouer mais revient chaque mois).
Sans ce troisième état, la porte serait rouge en permanence à cause des clés d'authentification, et
**une porte toujours rouge cesse d'être lue**. Pour un tiers inconnu, le contrôle refuse d'écrire
une phrase juridique et rend la main : corriger une dérive connue et rédiger à l'aveugle ne sont pas
le même geste.

## Ce que la sécurité posée n'arrête pas, et il faut le dire

**Un déploiement sans clés d'authentification n'aura aucune administration du tout, et c'est la
bonne façon d'échouer.** L'exception est bornée au hors production, et la règle est écrite une seule
fois au lieu d'être recopiée.

**La limite de débit vit en mémoire**, donc elle n'est pas partagée entre les instances de
l'hébergeur : elle arrête une boucle lancée depuis une machine, pas une attaque distribuée. La
limite partagée demande un magasin externe, c'est à dire une décision d'infrastructure.

**La politique de contenu garde `unsafe-inline` sur les scripts.** La version qui l'arrêterait
demande un jeton par requête, donc une lecture d'en-têtes dans la mise en page, ce qui rendrait
dynamiques toutes les pages aujourd'hui pré-rendues en statique. Arbitrage assumé, pas un oubli.

## L'authentification est branchée en mode tolérant, exprès

Les clés appartiennent au propriétaire, personne d'autre ne peut les créer, et **elles ne doivent
jamais passer par une conversation**. Le produit ne peut donc pas dépendre de leur présence pour
fonctionner : un seul module regarde si la clé publique est **présente**, jamais sa valeur, et tout
est conditionné à ça. Un intergiciel inconditionnel rendrait le site entier inaccessible sans clés,
ce qui est la mauvaise façon d'échouer.

## L'identité se pose à un seul endroit, et la dérive avait commencé

Un seul fichier nomme et lit le cookie d'identité. Ce n'était pas le cas : **quatre lectures
directes s'étaient ajoutées à côté du module, et deux avaient perdu la validation de format en
chemin**, de sorte qu'un cookie forgé passait. Quand l'authentification arrivera, c'est ce fichier
qui changera, et rien d'autre.

## Un seul instantané manuel, donc il se dépense

Le plan de la base n'autorise **qu'un** instantané manuel à la fois. Le supprimer pour couvrir une
migration additive sur une table vide aurait échangé un vrai filet contre un filet inutile.
Conséquence : **le prochain instantané demandera de décider du sort du précédent.**

## Le référencement est gelé exprès, et ce n'est pas de la plomberie

**Chantier repris plus tard et en grand, décidé le 2026-07-28.** L'intention n'est pas de brancher
trois pages, c'est de porter la page de comparaison au niveau attendu puis **d'en générer des
milliers**. Donc pas une demi-journée de plomberie sur l'existant : la plomberie n'est que le
préalable, le vrai sujet est le gabarit dupliqué des milliers de fois, et c'est le moteur de mesures
anatomiques qui fait la valeur de chaque page.

**Trois choses à trancher avant la génération de masse, elles coûtent bien plus cher après.**

**Le légal, tranché : les pages de masse seront bâties sur les polices Google, pas les commerciales.**
OFL, Apache 2.0 et UFL autorisent l'affichage, l'auto-hébergement et la publication, y compris à but
lucratif. Les commerciales restent nommables, décrivables et comparables en texte, mais leurs
fichiers ne peuvent pas être servis. Conséquence à exploiter plutôt qu'à subir : une comparaison où
la Google s'affiche vraiment et où la commerciale est décrite puis renvoyée vers l'abonnement est
légale **et** rémunérable.

**La différenciation.** Des milliers de pages d'un même gabarit à faible variation sont traitées
comme des pages satellites et peuvent faire sanctionner le domaine entier. Ce qui protège ici, c'est
que les mesures anatomiques diffèrent vraiment : **le gabarit doit exposer cette différence**, pas la
même phrase avec deux noms substitués.

**L'ordre de publication.** Interdiction totale d'indexation tant que le gabarit n'est pas arrêté :
c'est la seule action qui ne se rattrape pas vite, une page indexée restant dans les résultats après
son retrait.

## La monétisation, la bonne porte et la mauvaise

L'affiliation Adobe paie sur l'abonnement Creative Cloud, qui contient Adobe Fonts : réseau
Partnerize, entrée par `adobe.com/affiliates.html`. **`partners.adobe.com/join` est la mauvaise
porte.**

## Ce qui ne vit que dans une mémoire d'outil n'est pas écrit

Les règles de travail du propriétaire n'existaient que dans la mémoire locale de l'assistant, **donc
perdues au changement de machine**. C'est la raison d'être de `CLAUDE.md`.

## La base était l'angle mort de tout un audit

Plusieurs passes de vérification avaient lu des fichiers ; **personne n'avait interrogé la base**.
La lecture directe a corrigé trois affirmations tenues pour acquises, dont l'état réel des
migrations. Un audit qui ne sort pas du dépôt mesure ce que le dépôt prétend, pas ce qui tourne.

## Une documentation qui ne dit pas ce qui est périmé ne documente rien

Le vrai défaut n'a jamais été le nombre de fichiers : **cinquante-huit documents ne disaient pas
lesquels étaient encore valables**. La réponse tentée, un document d'accueil de 182 Ko, est morte
périmée en quelques semaines. Ce qui marche est l'inverse : des fiches courtes, thématiques,
réécrites, et un plafond qui l'impose.

## Ne pas afficher un secret ne suffit pas

Le mot de passe de la base a fuité **deux fois**, et la seconde sans que personne ne l'imprime : la
valeur avait été exportée dans l'environnement d'une commande, la bibliothèque a refusé l'URL et
**a recraché la chaîne entière dans son message d'erreur**, donc dans le terminal et dans la
conversation.

**La règle qui en sort : un secret ne doit pas transiter par une ligne de commande.** Laisser
l'exécutable lire le fichier d'environnement lui même, par exemple avec l'option prévue pour ça, et
la valeur ne passe par personne. C'est la seule forme qui résiste à une bibliothèque bavarde.
