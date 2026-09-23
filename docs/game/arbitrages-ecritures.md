# Écritures et concurrence — arbitrages et pièges

Comment les écritures du jeu tiennent, et les pièges de concurrence qui ne lèvent aucune erreur.
Séparé de `arbitrages.md` le 2026-09-18 : ce que le moteur enseigne et la façon dont ses écritures
tiennent sont deux domaines, et les tenir ensemble obligeait à couper dans l'un des deux.

## Un refus n'est pas une panne

Session expirée, jeton d'une autre manche, question déjà répondue, identifiant inexistant : toutes
les erreurs sortaient nues, donc les routes les repliaient **en panne serveur**. Un refus légitime
doit se distinguer d'un incident, sinon l'écran ne dit rien d'utile et la supervision ne voit que du
bruit.

## Trois règles pour toute route qui sert une séance

**L'identité vient du cookie, jamais du corps de la requête** : un élève ne peut pas se déclarer
quelqu'un d'autre, et le jour des vrais comptes c'est cette ligne qui change et rien d'autre.

**La fin n'est pas une erreur** : plus de question à servir rend un succès explicite, sinon l'écran
devrait traiter la réussite comme un incident. **Un doublon non plus** : une soumission rejouée rend
ce que la base a déjà enregistré.

## Les six propriétés d'un écrivain se posent dès la première ligne

La facture de l'oubli est écrite dans le dépôt : livrée sans elles, la compétition écrivait deux
faits pour une même question sur deux réponses simultanées, et **121 sessions sont restées actives
cinq mois** parce que le balayage ne portait que sur l'entraînement. Énoncé atomique, indice de
tentative dérivé dans l'instruction, doublons arbitrés par la clé primaire, compteurs incrémentés
dans la même instruction.

## Un invariant perdu, à ne pas redécouvrir

**« Au plus une session d'entraînement active par joueur » n'est plus imposé.** L'ancien balayage le
garantissait par la force ; depuis qu'il a été déplacé après l'insertion, avec exclusion par
identifiant et plancher d'âge, **deux démarrages rapprochés laissent deux sessions actives pour le
même joueur**. C'est un état supporté et non un défaut, mais tout code qui suppose l'unicité est
faux.

## Trois pièges de concurrence, tous silencieux

**Une fusion absorbée sans erreur reste une fusion.** Deux initialisations de pool concurrentes le
remplissaient deux fois, 47 lignes au lieu de 30, **sans qu'aucun code d'erreur soit levé** : la
clause qui ignore les conflits avalait la collision en silence.

**Un compteur lu puis réécrit perd des incréments** dès que deux sessions répondent en parallèle,
les deux lectures voyant la même valeur de départ. Ils s'incrémentent donc dans l'instruction.

**C'est la base qui arbitre une course**, pas le code : la clé primaire plus une clause de conflit,
sans aucune modification de schéma, le perdant relisant la ligne validée.

## Durcir le serveur ne sert à rien tant que le client ne s'en sert pas

Six tâches avaient durci le démarrage côté serveur, et **tout restait dormant** parce que l'écran
n'envoyait aucun identifiant : un rechargement créait toujours une session neuve. La dernière tâche,
la plus courte, a rendu les six précédentes utiles.

**Et l'ordre de déploiement compte** : la progression quotidienne a dû cesser de compter des sessions
**avant** la déduplication, sinon la série aurait visiblement chuté le jour de la mise en production.

## Ce qui rend une réponse infalsifiable

Le jeton de question lie **quatre champs sous signature** : la session, le joueur, la question et la
police attendue. On ne peut donc ni changer un champ sans casser la signature, ni forger un jeton
sans le secret. L'écriture vérifie en plus que la session appartient bien au joueur du jeton.

**Le seul geste qui reste possible est le rejeu d'un jeton volé**, qui n'écrit que dans la
progression de son propriétaire et ne lit rien. Faible, et conditionné à un vol préalable.
