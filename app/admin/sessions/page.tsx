import type { Metadata } from "next";

import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { productHealth, sessionShapes } from "@/lib/admin/usage";

export const metadata: Metadata = { title: "Sessions" };

// LA FORME D'UNE SEANCE.
//
// MEDIANE ET PAS MOYENNE. Une poignee de seances tres longues tire une moyenne
// vers le haut et fait croire que tout le monde joue longtemps. La mediane dit ce
// que vit la personne du milieu, qui est la question posee ici.
//
// LE TEMPS DE REPONSE VIT ICI, ET PAS SUR L'ACCUEIL. C'est une donnee
// interessante, elle n'est pas vitale : un accueil qui montre tout ne montre
// rien. Elle se lit a cote de la longueur d'une seance, ou elle a un sens.

const secondes = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`);
const duree = (s: number | null) => {
  if (s === null) return "—";
  if (s < 90) return `${s} s`;
  return `${Math.round(s / 60)} min`;
};

export default async function AdminSessionsPage() {
  const [health, shapes] = await Promise.all([productHealth(), sessionShapes()]);
  const mortesNees = shapes.reduce((sum, shape) => sum + shape.stillborn, 0);
  const vides = shapes.reduce((sum, shape) => sum + shape.empty, 0);
  const seances = shapes.reduce((sum, shape) => sum + shape.n, 0);

  return (
    <>
      <AdminPageHead href="/admin/sessions" />

      <section className="st-kpis ad-kpis" aria-label="Séances">
        <div className="st-kpi">
          <span className="st-kpi__value">{health.sessions}</span>
          <span className="st-kpi__label">Séances</span>
          <span className="st-kpi__helper">{health.sessions_open} encore ouvertes</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{health.questions_per_session ?? "—"}</span>
          <span className="st-kpi__label">Questions par séance</span>
          <span className="st-kpi__helper">moyenne des séances qui en ont eu au moins une</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{mortesNees}</span>
          <span className="st-kpi__label">Séances mortes-nées</span>
          <span className="st-kpi__helper">ouvertes puis refermées en moins d&apos;une seconde</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{secondes(health.median_answer_ms)}</span>
          <span className="st-kpi__label">Temps de réponse</span>
          <span className="st-kpi__helper">médiane, premier essai</span>
        </div>
      </section>

      <section className="st-panel" aria-label="Par mode">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Ce que dure une séance</h2>
          <span className="st-panel__meta">médianes des séances terminées, par mode</span>
        </div>
        {shapes.length === 0 ? (
          <p className="st-empty">Aucune séance enregistrée.</p>
        ) : (
          <ul className="ad-rows">
            {shapes.map((shape) => (
              <li key={shape.mode}>
                <span className="ad-rows__name">
                  <em>{shape.mode}</em>
                  <b>
                    {shape.n} séances · {shape.completed} terminées · {shape.abandoned} abandonnées
                    {shape.open > 0 ? ` · ${shape.open} ouvertes` : ""}
                    {shape.stillborn > 0 ? ` · dont ${shape.stillborn} mortes-nées` : ""}
                  </b>
                </span>
                <span className="ad-rows__value">
                  {shape.median_questions ?? "—"} questions · {duree(shape.median_seconds)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="ad-note">
          {vides} séances sur {seances} n&apos;ont reçu <strong>aucune</strong>{" "}
          question, et c&apos;est ce qui explique les deux chiffres ci-dessus : la
          moyenne les écarte, la médiane les compte. Les médianes ne portent que sur
          les séances <strong>terminées</strong>, et
          cette restriction est la mesure elle-même : en comptant tout, la médiane
          de durée tombait à un dixième de seconde, écrasée par les séances
          mortes-nées. Une séance ouverte puis refermée en moins d&apos;une seconde
          n&apos;est pas une partie courte, c&apos;est une partie qui n&apos;a jamais
          commencé, et {mortesNees} d&apos;entre elles disent quelque chose du
          démarrage, pas des joueurs. Une séance restée ouverte n&apos;a pas de durée
          du tout.
        </p>
      </section>
    </>
  );
}
