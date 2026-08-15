// Les trois documents légaux et la notice de stockage.
//
// POURQUOI ILS SONT COURTS. Ils décrivent ce que le produit fait vraiment, et il
// fait peu : pas de compte, pas d'email, pas d'adresse IP conservée, pas de
// mesure d'audience, pas de police appelée chez un tiers. Un texte long
// recopié d'un modèle décrirait un autre produit, et un texte qui décrit un
// autre produit est faux, donc inutilisable en cas de contrôle.
//
// INVENTAIRE FAIT LE 2026-08-15, dans le code, pas de mémoire :
//   - identité : un UUID aléatoire (`gen_random_uuid`) dans la table `users`,
//     porté par le cookie `jdt_guest_user_id` (httpOnly, SameSite=Lax, Secure en
//     production, sans date d'expiration donc effacé à la fermeture du
//     navigateur) ;
//   - jeu : `sessions`, `user_typeface_state`, `user_event_fact`, rattachés à cet
//     UUID ;
//   - aucune colonne `ip_address`, `user_agent` ni `email` dans les migrations ;
//   - navigateur : thème, langue, animations réduites, réponses d'onboarding
//     (localStorage) et identifiant de tentative (sessionStorage) ;
//   - aucun appel réseau vers un tiers depuis la page, polices auto-hébergées ;
//   - base : Neon sur AWS `eu-west-2`, donc Londres, Royaume-Uni.
//
// CE QUI RESTE À COMPLÉTER porte un marqueur « A COMPLETER » et fait rappeler
// `check:legal-docs` a chaque passage tant que c'est en place : seul l'éditeur connaît son
// identité, son adresse et son hébergeur. Publier des mentions légales qui ne
// nomment personne serait pire que ne pas en avoir.
//
// CE DOCUMENT N'EST PAS UN AVIS JURIDIQUE. Il est fidèle au produit, ce qui est
// la partie qu'un modèle ne peut pas faire. Une relecture juridique reste due.

export const privacyCopy = {
  kicker: "DWIGGINS",
  title: "Politique de confidentialité",
  updated: "Dernière mise à jour : 15 août 2026",
  intro:
    "DWIGGINS est un jeu qui entraîne l'œil à reconnaître les caractères typographiques. Pour se souvenir de votre progression d'une question à l'autre, il doit vous reconnaître. C'est la seule raison pour laquelle il conserve quoi que ce soit.",
  sections: [
    {
      title: "Qui traite vos données",
      body: "[A COMPLETER: identité de l'éditeur, statut juridique, adresse] est responsable du traitement. Vous pouvez écrire à [A COMPLETER: adresse email de contact] pour toute question ou pour exercer vos droits.",
    },
    {
      title: "Ce que nous collectons",
      body: "Un identifiant aléatoire, tiré au hasard par la base de données, qui ne contient aucune information sur vous. Il est déposé dans un cookie nommé jdt_guest_user_id. À cet identifiant sont rattachées vos parties : les typographies qui vous ont été montrées, vos réponses, si elles étaient justes, le temps que vous avez mis, et la progression qui en découle. Votre langue et vos préférences d'affichage restent dans votre navigateur.",
    },
    {
      title: "Ce que nous ne collectons pas",
      body: "Ni nom, ni adresse email, ni mot de passe : il n'y a pas de compte. Aucune adresse IP ni identifiant d'appareil n'est conservé dans notre base. Aucune mesure d'audience, aucun traceur publicitaire, aucun réseau social. Les polices de caractères sont hébergées sur notre propre serveur : votre navigateur n'appelle ni Google Fonts ni aucun autre tiers en affichant une page.",
    },
    {
      title: "Pourquoi",
      body: "Uniquement pour faire fonctionner le jeu : vous montrer la bonne typographie au bon moment, retenir ce que vous savez déjà, et vous rendre vos statistiques. Rien de ce qui est conservé ne sert à autre chose, n'est vendu, ni partagé.",
    },
    {
      title: "Base légale",
      body: "L'exécution du service que vous demandez en jouant, au sens de l'article 6.1.b du RGPD. Le cookie d'identifiant est strictement nécessaire au fonctionnement : sans lui, le jeu ne peut pas savoir où vous en êtes, et la loi n'exige donc pas votre consentement pour le déposer. Il exige en revanche que vous en soyez informé, ce que fait cette page.",
    },
    {
      title: "Combien de temps",
      body: "Le cookie n'a pas de date d'expiration : il disparaît quand vous fermez votre navigateur. Les parties rattachées à un identifiant devenu inutilisable sont conservées le temps de mesurer et d'améliorer la pédagogie du jeu, puis anonymisées. [A COMPLETER: durée de conservation retenue, par exemple 24 mois]",
    },
    {
      title: "Où vos données sont stockées",
      body: "Dans une base Neon hébergée sur AWS à Londres, région eu-west-2, donc au Royaume-Uni. Le Royaume-Uni n'est plus dans l'Union européenne, mais il bénéficie d'une décision d'adéquation de la Commission européenne : vos données y sont protégées à un niveau reconnu équivalent, et ce transfert ne nécessite pas d'autre formalité.",
    },
    {
      title: "Sous-traitants",
      body: "Neon, pour l'hébergement de la base de données. [A COMPLETER: hébergeur du site une fois le déploiement choisi] pour la mise en ligne des pages. Aucun autre prestataire ne reçoit vos données.",
    },
    {
      title: "Vos droits",
      body: "Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, et vous opposer à leur traitement. Une limite honnête : comme il n'existe aucun compte, nous ne pouvons vous identifier que par l'identifiant présent dans votre navigateur. Écrivez-nous depuis le navigateur concerné, en indiquant cet identifiant, sinon nous ne pourrons pas rattacher la demande à des données précises. Fermer votre navigateur suffit par ailleurs à couper le lien entre vous et vos parties.",
    },
    {
      title: "Cookies et stockage local",
      body: "Un seul cookie : jdt_guest_user_id, déposé au démarrage d'une partie, strictement nécessaire, illisible par le code de la page (httpOnly), limité à ce site (SameSite=Lax), chiffré en production (Secure), et effacé à la fermeture du navigateur. À côté, votre navigateur garde pour lui seul votre thème, votre langue, votre préférence d'animations réduites, vos réponses d'introduction et l'identifiant de la partie en cours. Ces éléments ne nous sont jamais envoyés et vous pouvez les effacer en vidant les données du site.",
    },
    {
      title: "Réclamation",
      body: "Si une réponse ne vous convient pas, vous pouvez saisir la Commission nationale de l'informatique et des libertés, la CNIL, 3 place de Fontenoy, 75007 Paris, ou sur cnil.fr.",
    },
  ],
} as const;

export const legalNoticeCopy = {
  kicker: "DWIGGINS",
  title: "Mentions légales",
  updated: "Dernière mise à jour : 15 août 2026",
  intro: "Informations sur l'éditeur et l'hébergeur de ce site, prévues par la loi pour la confiance dans l'économie numérique.",
  sections: [
    {
      title: "Éditeur",
      body: "[A COMPLETER: nom ou raison sociale, statut juridique, adresse postale, numéro SIRET, et numéro de TVA intracommunautaire le cas échéant]",
    },
    {
      title: "Directeur de la publication",
      body: "[A COMPLETER: nom du directeur de la publication]",
    },
    {
      title: "Hébergeur",
      body: "[A COMPLETER: nom, adresse et téléphone de l'hébergeur du site]. La base de données est hébergée par Neon sur AWS, région eu-west-2, à Londres, Royaume-Uni.",
    },
    {
      title: "Contact",
      body: "[A COMPLETER: adresse email de contact]",
    },
  ],
} as const;

export const termsCopy = {
  kicker: "DWIGGINS",
  title: "Conditions générales d'utilisation",
  updated: "Dernière mise à jour : 15 août 2026",
  intro: "En utilisant DWIGGINS, vous acceptez ce qui suit. Le texte est court parce que le service l'est : un jeu, sans compte et sans paiement.",
  sections: [
    {
      title: "Objet",
      body: "DWIGGINS est un service gratuit d'entraînement à la reconnaissance typographique. Il vous montre un mot composé dans une police et vous demande de la reconnaître, puis suit votre progression pour ajuster la difficulté.",
    },
    {
      title: "Accès au service",
      body: "L'accès est libre, sans inscription. Le service est fourni en l'état, et peut être modifié, interrompu ou arrêté sans préavis, notamment pour maintenance. Aucune disponibilité n'est garantie.",
    },
    {
      title: "Compte et progression",
      body: "Il n'existe pas de compte. Votre progression est rattachée à un identifiant déposé dans votre navigateur, décrit dans la politique de confidentialité. Fermer votre navigateur, effacer vos cookies ou changer d'appareil vous fait repartir de zéro, et cette progression ne peut pas être restaurée.",
    },
    {
      title: "Propriété intellectuelle",
      body: "Les textes, l'interface, la marque DWIGGINS et les contenus pédagogiques appartiennent à l'éditeur. Les polices de caractères présentées appartiennent à leurs fondeurs respectifs et ne sont montrées qu'à des fins d'apprentissage et d'identification ; leurs licences sont respectées et vérifiées avant toute mise à disposition. Vous ne pouvez pas extraire, copier ou redistribuer ces polices depuis ce site.",
    },
    {
      title: "Responsabilité",
      body: "Le service est éducatif et ludique. L'éditeur ne garantit pas l'exactitude complète des informations typographiques présentées et ne saurait être tenu responsable d'un dommage résultant de leur usage, notamment dans un cadre professionnel.",
    },
    {
      title: "Modification",
      body: "Ces conditions peuvent être modifiées. La date de dernière mise à jour figure en tête de page, et la version applicable est celle en ligne au moment où vous utilisez le service.",
    },
    {
      title: "Droit applicable",
      body: "Ces conditions sont soumises au droit français. À défaut de résolution amiable, les tribunaux français sont compétents.",
    },
  ],
} as const;

export const storageNoticeCopy = {
  // Une notice d'information, pas un mur de consentement : le seul cookie est
  // strictement nécessaire et aucune mesure d'audience n'existe. Poser un
  // bandeau « accepter / refuser » ici serait un théâtre trompeur, puisqu'il n'y
  // aurait rien à refuser. Le jour où une mesure d'audience arrive, c'est ce
  // composant qui devient une vraie demande de consentement.
  message:
    "Ce site dépose un seul cookie, nécessaire pour retenir votre progression pendant que vous jouez. Aucune mesure d'audience, aucun traceur.",
  linkLabel: "En savoir plus",
  dismissLabel: "J'ai compris",
} as const;
