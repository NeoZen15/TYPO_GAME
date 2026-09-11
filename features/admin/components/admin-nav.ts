// LA CARTE DE L'ADMINISTRATION, ecrite une fois.
//
// L'ORDRE EST UNE DECISION, PAS UN RANGEMENT. Le proprietaire ouvre cet espace
// pour deux raisons, dans cet ordre : ce qui demande son intervention, puis
// l'etat de son produit. L'analyse pedagogique vient apres, et le systeme en
// dernier. La barre suit donc cette priorite et pas l'ordre dans lequel les
// pages ont ete construites.
//
// UNE ENTREE = UN SUJET QU'ON PEUT NOMMER A VOIX HAUTE. Beaucoup d'entrees bien
// rangees valent mieux qu'un ecran dense : la question « ou est cette
// information » ne doit jamais se poser.
//
// L'ADMIN REGARDE L'AGREGE, PAS LES INDIVIDUS. Ce que le proprietaire cherche
// ici, c'est comprendre et ameliorer le moteur : quelles polices sont reconnues,
// lesquelles resistent, combien de repetitions avant qu'une police tienne, quels
// leurres provoquent vraiment une confusion. L'analyse pedagogique d'UN eleve
// appartient a son professeur, dans l'espace professeur. Le repertoire des
// comptes existe pour la gestion et le depannage, pas pour juger un regard.
//
// DEUX COUCHES QU'ON NE MELANGE PAS. Les comptes, les joueurs et les seances
// viennent de DWIGGINS. Les visiteurs, les sources de trafic et la conversion
// visite vers inscription relevent d'une couche d'analyse d'audience qui n'existe
// pas : sa place est prete, ses donnees ne sont pas inventees.

export type AdminEntry = {
  href: string;
  label: string;
  /** Ce que la page repond, en une phrase. Sert de sous titre a la page. */
  question: string;
};

export type AdminGroup = { title: string; entries: AdminEntry[] };

export const ADMIN_HOME: AdminEntry = {
  href: "/admin",
  label: "Vue d'ensemble",
  question: "L'état de DWIGGINS en dix secondes, et ce qui demande votre attention.",
};

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    title: "Administration",
    entries: [
      {
        href: "/admin/demandes",
        label: "Demandes d'accès",
        question: "Qui demande à enseigner avec DWIGGINS, et ce qui sera créé si vous acceptez.",
      },
      {
        href: "/admin/etablissements",
        label: "Établissements",
        question: "Les écoles, leurs enseignants, leurs classes et leur activité.",
      },
      {
        href: "/admin/classes",
        label: "Classes",
        question: "Les classes, leurs effectifs et ce qu'elles ont réellement rendu.",
      },
      {
        href: "/admin/enseignants",
        label: "Enseignants",
        question: "Qui enseigne, dans quel établissement, et ce qu'il donne.",
      },
      {
        href: "/admin/comptes",
        label: "Élèves et comptes",
        // GESTION ET DEPANNAGE, ET RIEN D'AUTRE. Correction du proprietaire le
        // 2026-09-11 : savoir si un eleve est bon ou mauvais regarde son
        // professeur, dans son espace. Ici on ouvre un compte pour comprendre un
        // rattachement ou debloquer quelqu'un, jamais pour juger un regard.
        question: "Le répertoire, pour la gestion et le dépannage : un compte, son état, ses classes.",
      },
    ],
  },
  {
    title: "Produit et activité",
    entries: [
      {
        href: "/admin/activite",
        label: "Activité",
        question: "Ce qui se passe dans le produit : séances lancées, terminées, abandonnées.",
      },
      {
        href: "/admin/utilisateurs",
        label: "Utilisateurs",
        question: "Combien de personnes, arrivées quand, et lesquelles reviennent.",
      },
      {
        href: "/admin/sessions",
        label: "Sessions",
        question: "La forme d'une séance : longueur, durée, ce qui la termine ou l'interrompt.",
      },
      {
        href: "/admin/audience",
        label: "Audience et acquisition",
        question: "Les visites du site et la conversion visite vers inscription. Autre couche que l'usage.",
      },
    ],
  },
  {
    title: "Pédagogie",
    entries: [
      {
        href: "/admin/progression",
        label: "Progression",
        question: "Est ce que la répétition espacée fait son travail : stabilisation, rechutes, distribution des niveaux, temps de passage de 0 à 4.",
      },
      {
        href: "/admin/confusions",
        label: "Confusions",
        question: "Quelles paires reviennent, et à quelle fréquence.",
      },
      {
        href: "/admin/typographies",
        label: "Typographies",
        question: "La cartographie de la reconnaissance : ce qui est reconnu, ce qui résiste, ce qui demande le plus de répétitions, ce qui n'apparaît jamais.",
      },
      {
        href: "/admin/devoirs",
        label: "Devoirs",
        question: "Les exercices, contrôles et compétitions donnés, et ce qu'ils ont produit.",
      },
    ],
  },
  {
    title: "Système",
    entries: [
      {
        href: "/admin/moteur",
        label: "Moteur",
        question: "Comment les questions sont composées, quels leurres sortent, et ce qui cloche.",
      },
      {
        href: "/admin/donnees",
        label: "Données et qualité",
        question: "Ce qui casse, ce qui traîne, ce qui fait douter d'un chiffre.",
      },
      {
        href: "/admin/parametres",
        label: "Paramètres",
        question: "Ce que l'opérateur règle, et rien d'autre.",
      },
    ],
  },
];

/** L'entrée d'un chemin, pour que la page connaisse sa propre question. */
export const adminEntry = (href: string): AdminEntry =>
  href === ADMIN_HOME.href
    ? ADMIN_HOME
    : ADMIN_GROUPS.flatMap((group) => group.entries).find((entry) => entry.href === href) ?? ADMIN_HOME;
