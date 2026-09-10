// Les quatre couleurs des cartes de réponse, déclarées UNE fois.
//
// Elles vivaient en trois exemplaires : `GameScreen`, `CompetitionScreen` et la
// démo de la landing, deux en majuscules et une en minuscules. C'est une valeur
// de direction artistique, donc elle appartient au propriétaire du projet, et une
// valeur de DA en trois copies est une valeur qui divergera : il suffit qu'une
// retouche passe sur un écran et pas sur les autres pour que le jeu et sa démo ne
// montrent plus le même produit.
//
// L'ordre compte : la carte n de la question prend la couleur n. Il n'y a pas de
// couleur par bonne ou mauvaise réponse, jamais, et c'est ce que la quatrième
// copie aurait fini par introduire.
export const CARD_COLORS = ["#8EA2FF", "#67D6B6", "#F5BF6A", "#F39AB1"] as const;
