# Espace enseignant — arbitrages et pièges

Pourquoi l'espace professeur est comme il est, et ce qu'il refuse de faire. Séparé de
`arbitrages.md` le 2026-09-18 : les deux domaines avaient assez de décisions chacun pour que les
tenir ensemble force à en couper. La spécification de création d'exercice et celle de l'admin
décrivent le fonctionnement, ce fichier décrit les décisions.

## Le compositeur écrit une intention, jamais vingt questions

**Le professeur pose un contrat commun à toute la classe, et le moteur adapte à l'intérieur**
(I-25). Le compositeur n'écrit donc pas une liste de questions, il écrit une intention que le
serveur déroule.

C'est un **formulaire et non un document** : un professeur qui crée doit enchaîner, et trouver
toutes les options s'il les veut. Une colonne d'explication permanente revient à **payer le vide en
prose**. Et **une fenêtre se donne à la minute, pas en décalages** : « demain » ne permet pas
d'écrire « pour vendredi, avant le cours », et un raccourci d'échéance compte depuis l'ouverture.

## Le mur entre le professeur et l'élève est à sens unique

**Le professeur ne lit que ce que ses propres exercices ont produit, jamais l'entraînement libre.**
C'est la promesse gelée du produit. Sa contrepartie est que l'élève doit voir ce qu'on lui a donné
avec son échéance, parce qu'**une échéance que personne n'annonce n'est pas une échéance**. C'est la
seule chose qui traverse, dans un sens comme dans l'autre.

**Une fiche Élève n'est pas un profil en plus petit.** Le profil est la chambre de l'élève, son
entraînement libre, son pool, ses badges, sa carte : le professeur n'en voit rien et rien dans la
page ne va le chercher. Elle porte ce que **ses** exercices ont produit, plus la seule chose que le
profil ne dit jamais, où cette personne se situe dans sa classe.

**Sur un produit qui entraîne le regard, ce qu'on a demandé n'est pas une liste de noms, ce sont les
lettres.** Le panneau de spécimens est le sujet de la page, pas son illustration.

## Le signal le plus utile n'a jamais demandé de nouvelle donnée

Les confusions entre polices se lisent dans le journal, qui enregistre **depuis le premier jour** la
réponse choisie à côté de la réponse attendue. Il ne manquait que de quoi savoir à quel devoir une
réponse appartient. Chercher la donnée qu'on a déjà avant d'en collecter une nouvelle.

**La porte de lecture professeur porte deux bornes dans chaque requête** : « tes assignations » et
« pas la vie privée de l'élève ». Elle ne nomme jamais la table d'état personnel.

## L'administration observe, elle ne juge pas

**Pas d'usine à gaz avant d'avoir des utilisateurs** : ne rendre visible que ce que le système
collecte déjà. **La page des élèves sert au dépannage**, jamais à l'analyse individuelle : aucun
taux de réussite, aucun classement.

**Un rapprochement d'établissement se propose, il n'identifie jamais**, sur le nom normalisé, parce
qu'un professeur écrit rarement le nom de son école deux fois pareil ; une jointure par nom aurait
compté double les homonymes. Et **une porte qui s'ouvre sans compte le fait par l'exception la plus
étroite possible**, qui se referme toute seule.

## L'espace enseignant, le modèle est posé

C'est **l'école qui paie**, au niveau établissement, pas le professeur. Deux couches, l'identité
personnelle d'un côté, la licence et les sièges de l'autre. Invariant : **le compte appartient à la
personne, la licence conditionne l'accès**, jamais la propriété de l'identité ni de la progression.

## Une page ne montre que ce qu'aucune autre ne peut montrer

C'est le critère qui a réglé quatre écrans. Une fiche Classe connaît une classe, une fiche Exercice
connaît un devoir, donc **la liste des exercices est le seul endroit qui voit toute la pratique en
même temps** : ses panneaux sont des **comparaisons**, jamais des résumés. Le même critère a vidé le
Home de ce que les pages Classes et Exercices faisaient déjà mieux.

**Répartition et participation sont des questions qu'un professeur pose à voix haute**, et une liste
de vingt-deux lignes n'y répond pas. C'est ce qui justifie une figure, pas le fait que la donnée
existe : **un graphique ne se met pas là parce qu'on a le chiffre.**

## La frise chronologique a été jetée, et la raison vaut pour toute figure

Deux défauts, dont un grave. **Les points n'étaient pas comparables** : classes, effectifs, durées et
échéances différentes, les aligner sur la complétion brute compare ce qui ne se compare pas. Et
surtout **la figure se lisait à l'envers** : les exercices les plus récents tombaient en bas parce
qu'ils sont encore ouverts et que personne n'a pu les finir, donc le graphe racontait le contraire
de la vérité.

## La couleur dans l'espace enseignant

**Une seule couleur ajoutée, parce qu'une seule est établie** : chaque exercice porte la pastille de
son mode, recette copiée telle quelle des boards du profil, contour et encre, **aucun remplissage**.
**La classe reste neutre à côté, volontairement : une identité n'est pas un état.**

Les dispositifs graphiques sont repris du profil sans en inventer un seul, anneau, barres segmentées,
courbe d'évolution.

## Des rangées, pas des cartes

Un professeur qui a quinze classes doit **balayer une colonne de noms**, pas faire défiler un mur de
cartes. La liste des exercices suit la même règle, et le tableau de bord générique a été écarté
d'avance.

**Un compte se dérive, il ne se stocke pas** : le nombre d'exercices ouverts d'une classe est compté
depuis les exercices eux mêmes, jamais posé sur la classe, sinon les deux divergent au premier oubli.

## L'espace prof réutilise le système du site, il ne le recopie pas

Le système de blocs n'appartient pas au profil, c'est **celui du site** : les pages légales, le bilan
de fin de partie et l'explication de progression le lisent déjà. L'espace enseignant avait recopié
les mêmes recettes sous son propre préfixe, **exactement la dérive que ce fichier existe pour
empêcher**. Le doublon a été supprimé.

**À savoir avant de croire un chiffre affiché ici** : le domaine enseignant n'existait nulle part
avant le 2026-09-04, ni en base ni ailleurs. Tout ce qu'on voit vient d'un jeu de données factices
écrit pour construire les écrans, comme le profil l'a fait avant lui.

## Une porte qui garde l'écran ne garde pas les données

**La faille la plus grave trouvée sur ce produit, et elle est invisible à l'écran.** Un layout rend
le composant de page **en parallèle** de sa propre décision d'accès, et la sortie de ce composant
part dans la charge sérialisée du HTML. Résultat mesuré : la page d'administration affichait
« Réservé à l'administration » et **le même HTML transportait les chiffres et les lignes**. En
production ce sont les noms et les adresses des demandeurs, exactement ce que l'écran de refus
prétend protéger.

**Pourquoi aucune vérification ne l'avait vue** : toutes regardaient le statut de la réponse et ce
qui s'affiche, jamais la charge sérialisée.

**Le correctif se pose au niveau des données, pas de l'écran** : un client SQL qui refuse de lire si
le demandeur n'est pas administrateur, et tous les modules de données passent par lui. L'écran de
refus garde son rôle, qui est d'expliquer, pas de protéger.

## La porte des assignations n'est pas une porte pour le joueur

Le 2026-09-23, pour donner au joueur ses propres objectifs (spec `product/spec-objectifs-joueur.md`),
la piste évidente était de fabriquer un contrat personnel et de le passer par `/assigned`, la seule
porte qui sait ouvrir une séance sur des faces choisies. Mesuré dans le code, elle coûte trois
choses : elle exige une vraie classe et un vrai professeur (clés étrangères de `assignments`),
elle étiquette la séance `teacher_assignment` par contrainte (migration 022), et elle écrit la
maîtrise avec `in_active_pool = false`, ce qui interdit ensuite à ces faces d'entrer dans le pool
personnel par `try_unlock_one_typeface`. Le joueur aurait donc joué pour abîmer sa propre carte.

**Règle** : le parcours personnel s'oriente par une consigne donnée au moteur d'entraînement, qui
réordonne les candidates dues sans en ajouter ni en retirer. La porte des assignations reste celle
du professeur, et le mur (I-25) ne se traverse pas pour économiser une consigne.
