import type { Metadata } from "next";

import AdminGap from "@/features/admin/components/AdminGap";
import AdminPageHead from "@/features/admin/components/AdminPageHead";

export const metadata: Metadata = { title: "Audience et acquisition" };

// L'AUDIENCE DU SITE, QUI N'EST PAS L'USAGE DU PRODUIT.
//
// DEUX COUCHES QU'ON NE MELANGE PAS, et c'est la raison d'etre de cette page
// vide. Les comptes, les joueurs et les seances viennent de DWIGGINS lui meme :
// le journal les connait ligne par ligne. Les visiteurs, les sources de trafic et
// la conversion visite vers inscription viennent d'ailleurs, et DWIGGINS n'en
// sait rien aujourd'hui. Melanger les deux produirait un taux de conversion dont
// le numerateur et le denominateur ne parlent pas de la meme population.
//
// LA PLACE EST PRETE, LA DONNEE N'EST PAS INVENTEE. L'entree existe dans la barre
// pour que personne n'aille chercher l'audience dans Utilisateurs, et la page dit
// ce qui manque plutot que d'afficher un graphique gris.

export default function AdminAudiencePage() {
  return (
    <>
      <AdminPageHead href="/admin/audience" />

      <AdminGap
        missing="DWIGGINS ne mesure aucune visite aujourd'hui. Le journal commence à la première question jouée : avant ça, personne n'est compté, ni la page d'accueil, ni les pages d'explication, ni d'où vient la personne."
        fills={[
          "Une mesure d'audience, à choisir : hébergeur, page vue côté serveur, ou outil dédié respectueux de la vie privée.",
          "La première question qu'elle devra trancher : combien de visiteurs arrivent sur l'accueil et combien lancent une première partie.",
          "Puis la conversion vers un compte, qui n'a de sens qu'une fois les deux bouts mesurés dans la même population.",
        ]}
      />

      <p className="ad-note">
        Tant que cette page est vide, les chiffres d&apos;Utilisateurs comptent des
        comptes qui ont joué, jamais des visiteurs. C&apos;est une population plus
        petite et plus engagée, et la confondre avec l&apos;audience ferait paraître
        la conversion bien meilleure qu&apos;elle n&apos;est.
      </p>
    </>
  );
}
