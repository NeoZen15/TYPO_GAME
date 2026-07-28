# Comptes & classes : espace enseignant (auth + paiement)

Date : 2026-07-09.

## Contexte

Les élèves sont des adultes en école supérieure (jamais des mineurs). Il n'y a
donc pas de contrainte RGPD spécifique aux mineurs à traiter ici.

Aujourd'hui il n'existe aucune authentification réelle : le joueur est identifié
par un cookie anonyme (`jdt_guest_user_id`) auto-créé. Cette feature introduit
l'auth ET le paiement en même temps. C'est la plus grosse brique du projet
(cf. checklist F « Auth réelle / comptes », dite f4, et G « Monétisation », dite
h4). Tout le reste (moteur adaptatif, profil, scoring) est déjà construit et
attend seulement une vraie identité pour rattacher durablement la progression.

## Trois rôles et une hiérarchie

L'acheteur n'est PAS le prof individuel : c'est l'ÉCOLE (l'établissement). C'est
elle qui paye, au niveau établissement. Il faut donc une couche au-dessus des
profs. Le système compte trois rôles.

- Admin école : achète la licence pour l'établissement, gère les profs et leur
  donne accès (distribue des accès pro selon les besoins).
- Prof : gère ses classes et ses élèves.
- Élève : apprend en autonomie, rattaché à une classe.

La hiérarchie s'emboîte ainsi : école (établissement), puis plusieurs profs,
puis une ou plusieurs classes par prof, puis des élèves par classe.

Cette hiérarchie est FLEXIBLE. L'école arrange comme elle veut : un seul prof
avec 200 élèves répartis sur 6 classes, ou 4 profs avec 4 classes, ou n'importe
quelle combinaison. L'admin école distribue les accès pro à ses profs selon les
besoins réels de l'établissement.

## Modèle en deux couches (façon Adobe)

Le principe central : deux couches SÉPARÉES, l'identité d'un côté, la licence de
l'autre.

### 1. Couche IDENTITÉ (l'ID)

Tout le monde possède son PROPRE compte : l'admin école, le prof, l'élève, le
joueur solo. Le compte appartient à la personne, pas à celui qui paye.

Notre propre auth, email plus mot de passe, ZÉRO Google. Google est jugé trop
lourd à mettre en place et n'est pas nécessaire ici. Le SSO et le LTI ne sont pas
prévus pour les paliers de base : ils sont réservés aux offres Établissement /
Enterprise, et pour plus tard.

La progression est rattachée au compte, donc portable partout, tout le temps. La
personne garde son compte et sa progression même si la licence expire ou si elle
quitte la classe, exactement comme on garde son Adobe ID sans abonnement actif.

### 2. Couche LICENCE / PAIEMENT

Séparée, posée par-dessus l'identité.

L'ÉCOLE paye une licence au niveau établissement. Cette licence est DIMENSIONNÉE
PAR LE NOMBRE D'ÉLÈVES : ce sont des sièges. L'école prend N sièges élèves, comme
une organisation Adobe attribue des sièges à ses membres, puis donne accès pro à
ses profs autant que nécessaire. Les élèves ont donc un compte GRATUIT, activé
par le simple fait d'appartenir à une classe couverte par la licence de l'école.

Les paliers et les prix sont PARAMÉTRABLES et NON FIGÉS. Les chiffres de l'étude
de marché ne sont qu'une direction non validée (voir la section « Références »).

Le moyen de paiement est À ÉTUDIER. Stripe est un candidat, mais rien n'est
verrouillé : on comparera les meilleures options avant de trancher.

Un joueur solo peut aussi payer pour lui-même, hors classe.

La licence est une couche d'accès posée au-dessus de l'ID. Elle ne possède pas
l'ID, elle conditionne seulement ce à quoi il donne droit.

## Provisionnement des élèves par le prof

Le prof provisionne ses élèves, à la manière d'une console admin ou d'un LMS.
L'admin école lui a préalablement donné un accès pro.

1. Le prof crée son compte (email plus mot de passe). La licence, elle, est déjà
   posée par l'école au niveau établissement.
2. Il crée une classe : un nom, un code de jonction court, et un QR code qui
   encode l'URL de jonction.
3. Il colle sa liste d'élèves (une liste d'emails).
4. Le système envoie à chaque élève un email automatique : une invitation à
   rejoindre la classe de [Prof], avec un bouton (lien d'invitation à usage
   unique) et le code de classe donné en information.
5. L'élève clique le lien d'invitation, CHOISIT SON PROPRE mot de passe (le prof
   ne peut jamais le définir à sa place), son compte est activé et rattaché à la
   classe, il peut jouer.
6. Ensuite, connexion classique email plus mot de passe pour tout le monde,
   partout.

Le lien reçu par email n'est PAS un lien magique récurrent. C'est un lien
d'invitation à usage unique, uniquement pour l'activation et le choix du mot de
passe. Après cette étape, l'accès se fait par login classique, de façon
permanente. C'est cohérent avec le fait que l'école paye et attend un accès
permanent pour ses classes.

## Apprentissage et progression

Une classe est un GROUPE PERMANENT, pas une session live. L'élève rejoint une
fois, puis apprend en AUTONOMIE quand il veut. Le moteur adaptatif est déjà
construit (migrations 006 à 009). Le prof n'a rien à lancer pour que l'élève
travaille.

La progression est stockée côté serveur, liée au `user_id`. Elle s'accumule dans
le profil et réutilise `profile-stats` et le moteur existant.

Se connecter est très exactement le mécanisme qui garde et partage la
progression. Sans identité, le serveur n'a aucune clé pour rattacher la
progression : elle resterait purement locale au navigateur, donc fragile. C'est
la raison de fond de l'auth, au-delà du seul contrôle d'accès.

Les évaluations ou les sessions live déclenchées par le prof sont une brique
optionnelle prévue en V2. Elles ne sont pas nécessaires au fonctionnement de
base.

## Appareil

Un ordinateur est OBLIGATOIRE pour jouer en mode classe. La reconnaissance fine
des formes de lettres demande un vrai écran.

Concrètement, un verrou d'appareil est posé sur la page de jeu en contexte
classe : sous une certaine largeur ou sur petit écran, on n'ouvre pas le jeu, on
affiche un écran « ouvre sur un ordinateur » avec le code de classe pour
reprendre plus tard.

Le jeu solo grand public reste, lui, responsive, avec un simple bandeau « mieux
sur ordinateur ». On garde ainsi le trafic mobile de découverte.

Rejoindre reste possible au téléphone (scanner le QR, activer le compte). Seul le
fait de JOUER en classe est réservé à l'ordinateur.

## Navigation

Ajouter sur la landing un lien discret « Se connecter / Rejoindre », en style
secondaire. Le CTA jaune reste réservé au training solo, il ne bouge pas.

Ce lien mène à une page login/jonction qui bifurque entre élève et prof. La
plupart des élèves arriveront par le QR ou par l'email du prof. Ce lien est le
chemin secondaire, pour une arrivée à froid sur le site.

## Tableau de bord prof

Le tableau de bord prof est LE différenciateur commercial. On vise donc le plus
loin possible (V2, voire V3), pas seulement la consultation.

### V1 : consultation

Le prof voit la progression et la maîtrise de chaque élève (réutilise
`profile-stats` : niveau visible, typos maîtrisées, axes, dernière activité).
S'y ajoutent la gestion du roster et l'affichage du code et du QR de la classe.

### V2 / V3 : diagnostic complet (ambition)

Aller bien au-delà de la simple lecture, vers un vrai outil de diagnostic :

- Matrices de confusion : quelle typo est confondue avec quelle typo.
- Vitesses de décision.
- Faiblesses perceptives, par élève, par classe, par cohorte.
- Suivi dans le temps.
- Export de rapports.

Ajouter une VUE ADMIN ÉCOLE transverse, qui donne à l'établissement une lecture
sur toutes les classes et tous les profs.

En V2 également : l'assignation, où le prof peut imposer des axes ou des typos à
travailler, plus les évaluations et sessions live.

### Prérequis data à sécuriser en premier (côté diagnostic)

Le diagnostic n'est calculable que si les données brutes existent. AVANT tout, le
moteur doit loguer, dans `user_event_fact`, le DISTRACTEUR CHOISI et le TEMPS DE
RÉPONSE. Aujourd'hui la table de faits n'écrit que `event_type`, `typeface_slug`
et `global_q_index` (choix volontairement minimal, aucune colonne de payload) :
sans le distracteur ni le temps, les matrices de confusion et les vitesses de
décision ne sont tout simplement pas calculables. C'est le premier verrou à
lever pour rendre le diagnostic possible.

## Modèle de données (esquisse révisée)

Étendre `users` : email, mot de passe hashé, rôle (`admin_ecole`, `prof` ou
`eleve`).

Nouvelle entité `ecole` (l'établissement) : c'est ELLE qui porte la LICENCE et le
compteur de SIÈGES, plus le prof.

Nouvelles tables :

- `ecole` : l'établissement, porteur de la licence et du compteur de sièges.
- appartenance prof vers école : rattachement d'un prof à son établissement.
- `classe` : `prof_id`, `ecole_id`, `nom`, `code_jonction`.
- `classe_eleve` : rattachement entre une classe et un `user`.
- `invitation` : `email`, `jeton`, `statut` (en attente / activé).

La licence et les sièges vivent sur `ecole`, PAS sur le prof.

C'est une esquisse volontairement légère, à affiner au moment de
l'implémentation.

## Liste de mise en place

Checklist actionnable, regroupée par bloc.

- Auth / comptes : comptes email plus mot de passe, sessions, hash des mots de
  passe, « mot de passe oublié », page login/jonction.
- École + admin : entité `ecole`, rôle admin école, achat de la licence,
  distribution des accès pro aux profs.
- Classes + roster + invitations : création de classe (nom, code, QR), collage de
  la liste d'emails, envoi des invitations à usage unique.
- Activation élève : lien d'invitation, choix du mot de passe par l'élève,
  rattachement à la classe.
- Apprentissage + verrou ordi : autonomie sur le moteur existant, verrou
  d'appareil en contexte classe, bandeau responsive en solo.
- Tableau prof : consultation d'abord (réutilise `profile-stats`), puis
  diagnostic (matrices de confusion, vitesses, faiblesses, suivi, export, vue
  admin école transverse).
- Licence / paiement : sièges dimensionnés par élèves, paliers et prix
  paramétrables, fournisseur de paiement à étudier.
- Nav : lien discret « Se connecter / Rejoindre » sur la landing.
- Modèle de données : `users` étendu, `ecole`, appartenance prof vers école,
  `classe`, `classe_eleve`, `invitation`.

## Ordre d'implémentation

1. Auth plus service email : comptes email plus mot de passe, sessions, envoi
   d'email.
2. École plus profs plus rôle admin école : l'établissement, son admin, le
   rattachement des profs.
3. Classes plus roster plus invitations plus activation élève.
4. Verrou ordi en classe plus lien de navigation.
5. Tableau de bord prof : consultation d'abord, puis diagnostic (viser loin,
   après avoir sécurisé le prérequis data côté `user_event_fact`).
6. Licence plus paiement (fournisseur à étudier).

## Prérequis externes

- Un service d'envoi d'email pour les invitations et le « mot de passe oublié ».
  Resend par défaut, sinon Postmark ou SES.
- Un fournisseur de paiement, À ÉTUDIER (Stripe est un candidat parmi d'autres,
  rien n'est verrouillé).

## Références

La direction produit et commerciale s'appuie sur
`docs/overview/Etude-Marche-B2B-SaaS-Ecoles-de-Design.pdf`. Cette étude n'est PAS
validée, surtout ses prix : elle donne une direction, pas une décision.

## Invariant de principe

Le compte appartient à la personne, pas au payeur. La progression est personnelle
et portable, elle survit à l'expiration de la licence (façon Adobe). La licence,
payée par l'école au niveau établissement et dimensionnée par le nombre d'élèves,
conditionne l'ACCÈS, jamais la propriété de l'identité ni de la progression.
