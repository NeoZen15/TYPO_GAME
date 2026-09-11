import type { Metadata } from "next";

import AdminGap from "@/features/admin/components/AdminGap";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { assignmentsOverview } from "@/lib/admin/world";

export const metadata: Metadata = { title: "Devoirs" };

// LES DEVOIRS DONNES, ET CE QU'ILS ONT PRODUIT.
//
// VU DE L'EXPLOITATION, PAS DE LA PEDAGOGIE. On regarde ici si le mecanisme
// fonctionne : est ce que les devoirs sont publies, est ce que les eleves les
// ouvrent, est ce qu'ils les finissent. Les resultats eleve par eleve
// appartiennent au professeur qui a donne le devoir, et la porte de lecture de
// l'espace professeur dit deja a quelles conditions il peut les voir.
//
// CE QUI SE COMPTE, ET RIEN D'AUTRE : des seances de contexte
// `teacher_assignment`. L'entrainement personnel d'un eleve ne rentre jamais dans
// le compte d'un devoir, meme s'il joue les memes polices le meme jour.

const LIBELLE_KIND: Record<string, string> = {
  exercise: "Exercice",
  control: "Contrôle",
  competition: "Compétition",
};

export default async function AdminDevoirsPage() {
  const assignments = await assignmentsOverview();

  return (
    <>
      <AdminPageHead href="/admin/devoirs" />

      {assignments.length === 0 ? (
        <AdminGap
          missing="Aucun devoir n'a encore été créé. Les tables sont en place depuis la migration 021, le compositeur existe, mais rien n'a encore été publié pour une vraie classe."
          fills={[
            "Un enseignant accepté crée sa classe, puis compose un exercice, un contrôle ou une compétition.",
            "Cette page dira alors combien de devoirs sont publiés, combien d'élèves les ouvrent et combien les terminent.",
            "Le taux d'ouverture est le premier chiffre à surveiller : un devoir publié que personne n'ouvre est un problème de notification, pas de pédagogie.",
          ]}
        />
      ) : (
        <section className="st-panel" aria-label="Devoirs">
          <div className="st-panel__head">
            <h2 className="st-panel__title">{assignments.length} devoirs</h2>
            <span className="st-panel__meta">du plus récent au plus ancien</span>
          </div>
          <ul className="ad-rows">
            {assignments.map((assignment) => (
              <li key={assignment.assignment_id}>
                <span className="ad-rows__name">
                  <em>{assignment.title}</em>
                  <b>
                    {LIBELLE_KIND[assignment.kind] ?? assignment.kind} ·{" "}
                    {assignment.class_name} · {assignment.school_name} ·{" "}
                    {assignment.exigence}
                    {assignment.adaptive ? " · adapté" : ""} · {assignment.state}
                  </b>
                </span>
                <span className="ad-rows__value">
                  {assignment.opened} ouverts sur {assignment.recipients} ·{" "}
                  {assignment.finished} terminés · pour le {assignment.due_at}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
