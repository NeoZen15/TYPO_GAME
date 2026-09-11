import type { Metadata } from "next";

import AdminGap from "@/features/admin/components/AdminGap";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { schoolsOverview } from "@/lib/admin/world";

export const metadata: Metadata = { title: "Établissements" };

// LES ETABLISSEMENTS, VUS DE LA GESTION.
//
// Un etablissement existe parce qu'une demande a ete acceptee, ou parce qu'un
// enseignant a rejoint un etablissement deja connu. Cette page dit lequel vit et
// lequel dort : un etablissement avec trois classes et aucune activite depuis un
// mois n'est pas le meme dossier qu'un etablissement sans classe du tout.

export default async function AdminEtablissementsPage() {
  const schools = await schoolsOverview();

  return (
    <>
      <AdminPageHead href="/admin/etablissements" />

      {schools.length === 0 ? (
        <AdminGap
          missing="Aucun établissement n'existe encore. Le premier sera créé en acceptant une demande d'accès, jamais à la main."
          fills={[
            "Une demande acceptée crée l'établissement, l'appartenance enseignante et l'invitation, d'un seul geste.",
            "Cette page listera alors les enseignants, les classes, les élèves rattachés et la dernière activité de chacun.",
          ]}
        />
      ) : (
        <section className="st-panel" aria-label="Établissements">
          <div className="st-panel__head">
            <h2 className="st-panel__title">{schools.length} établissements</h2>
            <span className="st-panel__meta">du plus récent au plus ancien</span>
          </div>
          <ul className="ad-rows">
            {schools.map((school) => (
              <li key={school.school_id}>
                <span className="ad-rows__name">
                  <em>{school.name}</em>
                  <b>
                    {school.teachers} enseignant{school.teachers > 1 ? "s" : ""} ·{" "}
                    {school.classes} classe{school.classes > 1 ? "s" : ""} ·{" "}
                    {school.students} élève{school.students > 1 ? "s" : ""} ·{" "}
                    {school.assignments} devoir{school.assignments > 1 ? "s" : ""}
                  </b>
                </span>
                <span className="ad-rows__value">
                  {school.last_seen_at
                    ? `vu le ${school.last_seen_at}`
                    : `créé le ${school.created_at}, jamais d'activité`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
