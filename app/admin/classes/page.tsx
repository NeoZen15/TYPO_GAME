import type { Metadata } from "next";

import AdminGap from "@/features/admin/components/AdminGap";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { classesOverview } from "@/lib/admin/world";

export const metadata: Metadata = { title: "Classes" };

// LES CLASSES, ET CE QU'ELLES ONT RECU.
//
// LA DISTINCTION QUI COMPTE ICI : une classe creee, une classe remplie et une
// classe qui a recu un devoir sont trois etats differents, et c'est le passage de
// l'un a l'autre qui dit si le produit sert. Une classe avec zero eleve un mois
// apres sa creation est un signal, pas une ligne de plus.

export default async function AdminClassesPage() {
  const classes = await classesOverview();
  const vides = classes.filter((classe) => classe.members === 0).length;

  return (
    <>
      <AdminPageHead href="/admin/classes" />

      {classes.length === 0 ? (
        <AdminGap
          missing="Aucune classe n'existe encore. Une classe est créée par un enseignant depuis son espace, jamais depuis l'administration."
          fills={[
            "Un enseignant crée sa classe et invite ses élèves avec un code à six caractères.",
            "Cette page dira alors combien de classes sont remplies, lesquelles ont reçu un devoir, et lesquelles sont restées vides.",
          ]}
        />
      ) : (
        <section className="st-panel" aria-label="Classes">
          <div className="st-panel__head">
            <h2 className="st-panel__title">{classes.length} classes</h2>
            <span className="st-panel__meta">
              {vides === 0 ? "toutes ont au moins un élève" : `${vides} encore vide${vides > 1 ? "s" : ""}`}
            </span>
          </div>
          <ul className="ad-rows">
            {classes.map((classe) => (
              <li key={classe.class_id}>
                <span className="ad-rows__name">
                  <em>{classe.name}</em>
                  <b>
                    {classe.school_name}
                    {classe.level ? ` · ${classe.level}` : ""}
                    {classe.archived ? " · archivée" : ""}
                  </b>
                </span>
                <span className="ad-rows__value">
                  {classe.members} élève{classe.members > 1 ? "s" : ""} ·{" "}
                  {classe.published} devoir{classe.published > 1 ? "s" : ""} publié
                  {classe.published > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
