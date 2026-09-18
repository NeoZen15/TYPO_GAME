import "server-only";

import { isAdminAccessAllowed } from "@/lib/admin/gate";
import { sql as baseSql } from "@/lib/server/neon";

// LE `sql` DE L'ADMINISTRATION, QUI REFUSE DE LIRE POUR UN NON-ADMINISTRATEUR.
//
// POURQUOI IL EXISTE, ET CE QU'IL FERME. Le pentest du 2026-09-18 a montre que la
// porte posee dans `app/admin/layout.tsx` garde l'ECRAN mais pas les DONNEES : un
// layout Next rend quand meme le composant de page en parallele, et sa sortie
// part dans la charge React du HTML. Resultat mesure : `/admin` affichait « Reserve
// a l'administration » et le meme HTML transportait `ad-pulse__value` a 22 et 39,
// les listes de `/admin/comptes` leurs lignes. Sur la copie de test, vide de monde
// scolaire, cela ne fuitait que des agregats ; en production, ce sont les noms et
// les adresses des demandeurs, exactement ce que la page de refus dit proteger.
//
// LA PROTECTION VIENT DONC DES DONNEES, comme partout ailleurs dans ce produit
// (voir `proxy.ts`, `lib/teacher/read-gate.ts`). Chaque module de donnees de
// l'administration lit par ce `sql` plutot que par celui de `lib/server/neon`, en
// changeant une seule ligne d'import. Une requete demandee par un non-administrateur
// jette avant de toucher la base : la page ne recoit rien, donc ne serialise rien.
//
// LE LAYOUT RESTE, ET GARDE SON ROLE : il affiche le panneau de refus lisible. Ce
// garde ci s'occupe de ce que le layout ne peut pas atteindre, la page rendue en
// parallele. Les deux ensemble, pas l'un a la place de l'autre.
//
// UNE PAGE D'ADMINISTRATION AJOUTEE DEMAIN est protegee sans y penser, du moment
// qu'elle lit par un module qui importe ce `sql`. C'est verifie par
// `check:admin-data-gate`.

export class AdminAccessDenied extends Error {
  constructor() {
    super("Lecture de donnees d'administration refusee : le demandeur n'est pas administrateur.");
    this.name = "AdminAccessDenied";
  }
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return (async () => {
    if (!(await isAdminAccessAllowed())) {
      throw new AdminAccessDenied();
    }
    return baseSql(strings, ...(values as never[]));
  })();
}
