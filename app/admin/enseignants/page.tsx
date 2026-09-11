import type { Metadata } from "next";

import AdminGap from "@/features/admin/components/AdminGap";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { teachersOverview } from "@/lib/admin/world";

export const metadata: Metadata = { title: "Enseignants" };

// QUI ENSEIGNE, ET CE QU'IL DONNE.
//
// CE QUE CETTE PAGE NE PEUT PAS AFFICHER, ET POURQUOI ELLE LE DIT. La table des
// comptes ne porte ni nom ni adresse : l'identite vit chez Clerk, et `clerk_id`
// est le seul fil entre les deux. Un enseignant se reconnait donc ici a son
// etablissement et a ce qu'il a cree, pas a son nom. Le jour ou l'acceptation
// d'une demande creera vraiment le compte, le nom viendra de Clerk et se lira a
// cote, sans que cette page ait a le stocker une deuxieme fois.

const court = (id: string) => id.slice(0, 8);

export default async function AdminEnseignantsPage() {
  const teachers = await teachersOverview();
  const sansCompte = teachers.filter((teacher) => !teacher.has_account).length;

  return (
    <>
      <AdminPageHead href="/admin/enseignants" />

      {teachers.length === 0 ? (
        <AdminGap
          missing="Aucun enseignant n'est encore rattaché à un établissement."
          fills={[
            "Accepter une demande d'accès crée le compte enseignant et son appartenance à l'établissement.",
            "Cette page dira alors qui enseigne où, combien de classes il a ouvertes et combien de devoirs il a donnés.",
            "Le nom et l'adresse viendront de Clerk au moment de l'affichage : la base ne les stockera pas une deuxième fois.",
          ]}
        />
      ) : (
        <section className="st-panel" aria-label="Enseignants">
          <div className="st-panel__head">
            <h2 className="st-panel__title">{teachers.length} enseignants</h2>
            <span className="st-panel__meta">
              {sansCompte > 0
                ? `${sansCompte} sans compte authentifié`
                : "tous authentifiés"}
            </span>
          </div>
          <ul className="ad-rows">
            {teachers.map((teacher) => (
              <li key={teacher.user_id}>
                <span className="ad-rows__name">
                  <em>{court(teacher.user_id)}</em>
                  <b>
                    {teacher.school_name} · {teacher.role}
                    {teacher.has_account ? "" : " · sans compte"}
                  </b>
                </span>
                <span className="ad-rows__value">
                  {teacher.classes} classe{teacher.classes > 1 ? "s" : ""} ·{" "}
                  {teacher.assignments} devoir{teacher.assignments > 1 ? "s" : ""} · vu le{" "}
                  {teacher.last_seen_at}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
