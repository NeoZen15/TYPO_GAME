# Espace prof — architecture

Date : 2026-09-04.
Statut : **architecture arrêtée en conversation avec le propriétaire, rien n'est
construit.** Ce document consigne ce qui a été décidé, pour que la construction
n'ait pas à le redécouvrir.

Rang : subordonné à `docs/game/vision-produit-dwiggins.md`. Il remplace la
section « Tableau de bord prof » de `docs/game/classes-comptes-spec.md`, déjà
marquée caduque le 2026-07-29.

## La règle qui gouverne tout le reste

Tout ce que le professeur lit d'une classe ou d'un élève est construit
**uniquement à partir des exercices qu'il a donnés**. Jamais de l'entraînement
libre, jamais du mastery global, jamais du pool personnel, et jamais un agrégat
de ces données. La lecture s'enrichit à mesure qu'il donne des exercices.

Conséquence commerciale, assumée et retenue : l'étanchéité est un argument de
vente auprès d'élèves adultes, pas une contrainte à contourner.

## Deux faces liées

- **Professeur** : il donne, il suit, il comprend, il adapte.
- **Élève** : il voit ce qu'on lui demande, combien de temps il lui reste, il
  joue, et il comprend sa propre progression.

Les deux lisent des informations proches, avec des objectifs différents. La
lecture de l'élève par le professeur et la lecture de l'élève par lui même ne
sont pas la même page et n'ont pas le même but.

## L'appareil, et la correction du 2026-09-04

**Les élèves jouent sur ordinateur.** La règle d'origine de
`classes-comptes-spec.md` tient : en contexte classe, la reconnaissance fine des
formes de lettres demande un vrai écran.

Le téléphone a été évoqué puis **corrigé le jour même par le propriétaire**, avec
une conséquence à retenir : le mobile n'ouvre aucun chantier côté élève, et
aucune contrainte de mise en page téléphone ne pèse sur l'espace prof.

Le QR code de jonction sort quand même du périmètre. La façon dont un élève rejoint une
classe la première fois est **parkée**, probablement un code court ou un lien.
Une fois l'élève dans une classe, les exercices apparaissent simplement sur son
compte.

## Direction artistique

Référence unique : la partie **Profil** du site, dans son ensemble, pas seulement
son écran principal. Une seule page à onglets, la barre en pastille du haut, un
fond étoilé fixe, une intro centrée par vue (surtitre en capitales mono, titre
serré, lede court), puis des panneaux qui se révèlent au défilement. Contour fin
et voile faible, jamais d'aplat de couleur.

L'objectif énoncé par le propriétaire : que l'espace prof donne l'impression
d'avoir toujours fait partie de DWIGGINS.

Le monde du profil publie déjà un contrat de jetons que toute page portant
`.pf-page` hérite, et un système de boards réutilisable. L'espace prof entre par
là, pas par la direction artistique de la landing.

Ce qui existe déjà et se réutilise : panneaux, rangées de chiffres, rangées
libellé/valeur, barres, barres segmentées avec légende, anneau, calendrier de
régularité, puces de séance, interrupteur, compteur plus/moins, bouton à deux
choix, pastille pointillée pour ce qui n'est pas encore actif.

Ce qui n'existe nulle part et reste à dessiner : un champ où taper, un sélecteur
de typographies dans le catalogue, une liste de personnes, un tableau de
résultats.

Point de DA ouvert, décision du propriétaire : **l'urgence ne peut pas être
rouge**, le rouge signifie déjà « mauvaise réponse » dans le jeu. Elle devra se
dire par le contour ou par le poids du compte à rebours.

## Trois parties, plus le compte

`ACCUEIL`, `CLASSES`, `EXERCICES`. Le compte et les paramètres restent
secondaires et reprennent la logique de l'onglet Préférences du profil.

## Accueil, le cockpit

Il montre ce qui se passe **maintenant**. Pas de rangée de compteurs type
tableau de bord (nombre de classes, d'élèves, d'exercices) : le propriétaire l'a
explicitement écartée comme peu utile et déjà vue ailleurs.

1. **Créer un exercice**, en haut. C'est le geste principal de la page.
2. **Ce qui demande ton attention.** Deux ou trois signaux, chacun écrit en une
   phrase qui donne la raison, avec l'action qui va avec. Exemples de la forme
   attendue : « la moitié de la 3A n'a pas commencé, c'est à rendre vendredi » ;
   « dans la 2B, Garamond et Baskerville se confondent depuis trois exercices »,
   suivi d'un bouton qui propose un exercice là dessus. C'est ici que
   l'intelligence pédagogique se montre en premier.
3. **Les exercices en cours**, triés par temps restant, avec où en est chacun.
4. **Reprendre** : les deux ou trois classes travaillées en ce moment, pas
   toutes, avec un lien vers la liste complète. Une liste de cartes qui explose
   dès qu'un professeur a beaucoup de classes est explicitement refusée.

## Classes

Liste sobre en lignes, pas en cartes. Les classes archivées sont masquées par
défaut.

### Une classe

Deux moitiés, dans cet ordre d'importance.

**La gestion, discrète mais présente** : créer et renommer une classe, voir et
gérer les élèves, ajouter, retirer, archiver, et le code qui permet de
rejoindre.

**La lecture, qui est le cœur** : ce que la classe sait voir, ce qui résiste,
les confusions qui reviennent, l'évolution dans le temps, les exercices donnés à
cette classe, et la liste des élèves avec le minimum utile pour repérer qui
décroche.

**Le bloc de proposition** : DWIGGINS dit ce qu'il observe sur cette classe et
propose un exercice pertinent en expliquant brièvement pourquoi. Le professeur
l'ouvre, le modifie, l'envoie.

### Un élève, vu par le professeur

Ce n'est **pas** la page de classe en réduit. Quatre questions, dans cet ordre :

1. ce qu'il reconnaît de façon fiable maintenant ;
2. ce qui a progressé depuis le début ;
3. ce qui résiste malgré plusieurs exercices ;
4. les confusions qui lui reviennent.

Plus ses exercices et sa participation. Aucune note, aucun classement entre
élèves, et pas de mur de données. Critère de réussite de la page : le professeur
doit pouvoir dire une phrase juste à l'élève juste après l'avoir lue.

## Exercices

Liste avec les états lus par le temps : en cours, programmés, terminés. Le
**temps restant** est la clé de tri et il est très visible. En haut ce qui se
termine bientôt, en bas ce qui est fini. Filtre par classe.

### Un exercice, deux vies à la même adresse

**Avant et pendant, la fiche.** Ce que le professeur a créé, pour quelle classe,
quelles typographies et quels réglages, quand il a été donné, pour quand il est
à rendre, combien de temps il reste, qui a commencé. Actions : modifier,
dupliquer, relancer les retardataires, annuler.

**Après, l'analyse**, qui se remplit dessous à mesure que les élèves jouent :
participation, réussite globale, typographies bien reconnues, typographies
difficiles, confusions observées, résultats par élève, et comparaison avec les
exercices précédents de la même classe.

Une seule page qui se remplit, pas une page fiche et une page résultats.

## Le temps

Deux durées à ne jamais confondre, et deux mots différents dans l'interface.

- **L'échéance** : jusqu'à quand l'élève a le droit de le faire.
- **La durée** : la longueur de l'exercice lui même, nombre de questions ou
  chronomètre.

L'élève doit lire les deux d'un coup d'œil : il me reste deux jours, et ça me
prendra cinq minutes.

## Créer un exercice

Parcours retenu le 2026-09-04, un mélange de deux pistes : **une seule page, où
DWIGGINS conseille et où le professeur décide.**

- On arrive sur une page simple, pas un enchaînement de questions.
- En haut, DWIGGINS propose immédiatement **quelques intentions**, adaptées à la
  classe quand il la connaît. Un clic remplit tout l'exercice, et le contenu
  change visiblement dessous pour que le professeur voie ce qu'il vient
  d'accepter.
- Le professeur peut **ignorer les intentions** et composer directement.
- **Tout est prérempli intelligemment.** On ne touche que ce qu'on veut changer.
- L'exercice reste entièrement visible et modifiable : typographies ou familles,
  difficulté, nombre de questions ou durée, échéance, classe, élèves concernés
  (tous cochés par défaut, on peut en décocher).
- Récapitulatif d'une ligne, puis envoyer.

Quand il n'y a encore aucune donnée (première classe, premier exercice), les
intentions ne peuvent pas être savantes : elles retombent sur des intentions
générales, découvrir des classiques, réviser de grandes familles.

## La proposition automatique

Elle ne se limite pas au choix des typographies dans le compositeur. Elle vit
aussi **depuis une classe** : DWIGGINS identifie ce qu'il observe et propose un
exercice pertinent, en expliquant brièvement pourquoi.

Règle de composition, énoncée par le propriétaire : **jamais un exercice fait
uniquement de faiblesses**, ce serait répétitif et frustrant. Le mélange associe
de l'acquis, de la consolidation, des difficultés ciblées et éventuellement de
la nouveauté. C'est la même idée que le moteur applique déjà dans le temps, où
le difficile revient plus souvent sans que le maîtrisé disparaisse, appliquée
cette fois à l'intérieur d'un seul exercice.

### Les proportions, arrêtées le 2026-09-04

**Base de départ, à tester et non gravée** : 45 pour cent de consolidation,
20 d'acquis, 20 de difficultés ciblées, 15 de nouveautés.

**Plafond qui ne bouge jamais**, quelle que soit l'intention : les difficultés ne
dépassent pas environ **un tiers** de l'exercice. C'est la protection contre
l'exercice punitif.

**Le mélange se déplace selon l'intention.** Un contrôle ne comporte aucune
nouveauté. Une découverte en comporte davantage. Une révision insiste sur les
difficultés, sans franchir le plafond.

### Ce qui n'est PAS une règle du système

Deux points corrigés par le propriétaire le 2026-09-04, à ne pas réintroduire par
inadvertance.

**Le taux de réussite visé de trois sur quatre est une hypothèse de départ, pas
une vérité pédagogique.** Rien dans DWIGGINS ne démontre aujourd'hui que 75 pour
cent soit le bon taux. C'est une cible à tester et à mesurer, jamais une règle à
coder comme un invariant.

**L'ordre des questions n'est pas imposé.** Ouvrir facile, mettre les
difficultés au milieu et finir sur une réussite se défend pour un exercice
d'apprentissage. Pour un contrôle, cela biaise l'évaluation, et l'ordre doit être
équilibré ou mélangé. Plus profondément, un rythme systématique finirait par être
appris inconsciemment par les élèves, ce qui contredit l'objet même de DWIGGINS,
la reconnaissance réelle et durable. L'ordre est donc une propriété de
l'intention, et il varie.

Contrainte de vie privée qui s'applique ici aussi : la proposition se calcule
sur les résultats des exercices donnés par ce professeur, jamais sur
l'entraînement libre des élèves.

## Côté élève

Sa lecture de sa propre progression **existe déjà** : la carte du regard, les
statistiques par axe, l'activité. Ce n'est pas à réinventer.

Ce qui est nouveau est un seul endroit : là où les exercices demandés
atterrissent.

**Pas un septième onglet**, et c'est un choix, pas une contrainte : un devoir
n'est pas une rubrique de plus, c'est ce qui doit sauter aux yeux en arrivant.
Décision retenue : quand l'élève a un exercice à faire, cela devient la
**première chose de son espace**, avec la classe concernée, ce qui est
demandé, l'échéance et le temps restant. Quand il n'a rien, cela disparaît et
son profil redevient exactement ce qu'il est aujourd'hui. Un bandeau sur l'écran
de jeu l'emmène directement. Ses exercices passés rejoignent son activité, avec
ses séances libres.

## La boucle complète

Le professeur crée un exercice et l'envoie à une classe. L'exercice apparaît en
tête du profil de chaque élève de cette classe, avec le temps restant. L'élève
joue depuis son ordinateur. La participation bouge en direct chez le professeur.
À la fin, l'analyse de l'exercice se remplit. Ce que la classe a montré nourrit
la proposition suivante.

## Ce qui reste à décider

- Comment se dit l'urgence, puisque le rouge est pris.
- Comment un élève rejoint une classe la première fois.
