// Clerk est branche, ou il ne l'est pas, et le produit doit marcher dans les deux
// cas.
//
// POURQUOI CE FICHIER EXISTE. Le fournisseur d'authentification a ete choisi le
// 2026-09-10 (Clerk, que le schema nomme depuis la migration 003), mais ses cles
// appartiennent au proprietaire : personne d'autre ne peut les creer, et elles ne
// doivent jamais passer par une conversation. Tant qu'elles ne sont pas posees
// dans l'environnement, le produit continue **exactement** comme avant : tout le
// monde est invite, le jeu tourne, et rien ne plante. C'est la seule facon de
// livrer le branchement sans bloquer le produit sur une action qui ne m'appartient
// pas.
//
// UNE SEULE FONCTION LIT L'ENVIRONNEMENT, et elle ne lit jamais la valeur d'une
// cle : elle regarde seulement si elle est presente. La valeur d'un secret ne
// doit ni etre affichee, ni journalisee, ni comparee ailleurs qu'ici.
export const isClerkConfigured = () =>
  typeof process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === "string" &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.length > 0;
