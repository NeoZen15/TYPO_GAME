// D'OU VIENT CET APPEL, ET FAUT IL LE LAISSER ECRIRE.
//
// FONCTION PURE, ET C'EST TOUT L'INTERET. Le controle vivait dans `proxy.ts`, ou
// il ne pouvait etre verifie qu'en demarrant Next. Ici il prend trois chaines et
// rend un booleen, donc `check:security-gates` l'exerce pour de vrai sur la table
// des cas au lieu de relire le fichier en esperant que le texte dise la verite.
//
// CE QU'IL FERME. Le cookie d'identite est en `SameSite=Lax`, donc un formulaire
// poste depuis un autre site n'emporte deja pas l'identite du joueur. Ce controle
// est la deuxieme serrure : il refuse l'origine litterale `null`, celle d'une
// iframe en bac a sable ou d'un document ouvert depuis un fichier local, dont
// plusieurs contournements publies en 2026 se servent precisement parce qu'elle
// ne ressemble a aucun domaine.
//
// UNE ORIGINE ABSENTE EST ACCEPTEE, et ce n'est pas un oubli. Un navigateur pose
// toujours `Origin` sur une methode qui ecrit ; son absence signale donc un appel
// qui n'est pas un navigateur, et un appel qui n'est pas un navigateur ne porte
// pas les cookies de quelqu'un d'autre a son insu, ce qui est toute la definition
// du CSRF. Refuser l'absence casserait les scripts sans proteger personne.

const METHODES_QUI_ECRIVENT = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const methodeQuiEcrit = (methode: string) =>
  METHODES_QUI_ECRIVENT.has(methode.toUpperCase());

export const origineAcceptee = ({
  methode,
  origine,
  hote,
}: {
  methode: string;
  origine: string | null;
  hote: string | null;
}): boolean => {
  if (!methodeQuiEcrit(methode)) return true;
  if (!origine) return true;
  if (origine === "null") return false;
  if (!hote) return false;

  try {
    return new URL(origine).host === hote;
  } catch {
    return false;
  }
};
