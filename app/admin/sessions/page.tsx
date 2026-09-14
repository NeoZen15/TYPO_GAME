import type { Metadata } from "next";

import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { productHealth, sessionShapes } from "@/lib/admin/usage";

export const metadata: Metadata = { title: "Sessions" };

// LA FORME D'UNE SEANCE.
//
// UNE OUVERTURE DU JEU N'EST PAS UNE PARTIE. Le jeu demarre au chargement de sa
// page : 445 des 595 lignes de `sessions` n'ont jamais recu de question, et ce
// sont des visites, pas des abandons. Seules les seances portant au moins une
// reponse sont appelees des parties, ici et partout ailleurs.
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
  const vides = shapes.reduce((sum, shape) => sum + shape.empty, 0);
  const ouvertures = shapes.reduce((sum, shape) => sum + shape.n, 0);
  const muettes = shapes.reduce((sum, shape) => sum + shape.completed_empty, 0);

  return (
    <>
      <AdminPageHead href="/admin/sessions" />

      <section className="st-kpis ad-kpis" aria-label="Séances">
        <div className="st-kpi">
          <span className="st-kpi__value">{health.sessions_played}</span>
          <span className="st-kpi__label">Parties jouées</span>
          <span className="st-kpi__helper">au moins une réponse</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{vides}</span>
          <span className="st-kpi__label">Ouvertures sans partie</span>
          <span className="st-kpi__helper">sur {ouvertures} ouvertures du jeu</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{health.questions_per_session ?? "—"}</span>
          <span className="st-kpi__label">Questions par partie</span>
          <span className="st-kpi__helper">moyenne, sur les parties jouées</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{secondes(health.median_answer_ms)}</span>
          <span className="st-kpi__label">Temps de réponse</span>
          <span className="st-kpi__helper">médiane, premier essai</span>
        </div>
      </section>

      <section className="st-panel" aria-label="Par mode">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Ce que dure une partie</h2>
          <span className="st-panel__meta">médianes des parties terminées, par mode</span>
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
                    {shape.n - shape.empty} parties sur {shape.n} ouvertures ·{" "}
                    {shape.completed} terminées · {shape.abandoned} abandonnées
                    {shape.open > 0 ? ` · ${shape.open} encore en cours` : ""}
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
          <strong>Une ouverture du jeu n&apos;est pas une partie.</strong> Le jeu
          démarre au chargement de sa page, sans écran intermédiaire : charger la
          page crée donc une séance, et le serveur crée le compte invité au même
          instant. {vides} des {ouvertures} lignes n&apos;ont jamais reçu de
          question, et ce ne sont pas {vides} abandons, ce sont des visites. Le
          choix produit est assumé, c&apos;est le vocabulaire qui s&apos;y adapte :
          on ne compte comme <strong>partie</strong> qu&apos;une séance portant au
          moins une réponse.
        </p>
        {muettes > 0 && (
          <p className="ad-note">
            <strong>{muettes} parties ont pourtant été terminées explicitement sans
            une seule réponse</strong>, et celles-là ne s&apos;expliquent par aucun
            mécanisme : quelqu&apos;un a lancé, est resté, et a fermé proprement sans
            jamais répondre. Mesuré le 2026-09-14, presque toutes en compétition,
            pour une durée moyenne de deux minutes et demie. C&apos;est le seul
            signal de cette page qui mérite une enquête.
          </p>
        )}
        <p className="ad-note">
          Les médianes ne portent que sur les parties <strong>terminées</strong>, et
          c&apos;est une question de vérité, pas de prudence. Les parties terminées
          portent toutes un événement de fin explicite. Les abandonnées n&apos;en
          portent aucun : elles sont fermées par le balayage, qui prend comme heure
          de fin le dernier événement enregistré. Pour une séance sans réponse, ce
          dernier événement est son propre démarrage, écrit quelques dizaines de
          millisecondes plus tôt. <strong>La durée d&apos;une séance abandonnée ne
          mesure donc pas un temps vécu</strong> mais l&apos;écart entre deux
          écritures du serveur, et une séance restée ouverte n&apos;a pas de durée du
          tout.
        </p>
      </section>
    </>
  );
}
