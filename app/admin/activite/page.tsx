import type { Metadata } from "next";

import AdminBars from "@/features/admin/components/AdminBars";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { contextSplit, dailyActivity, productHealth, sessionShapes } from "@/lib/admin/usage";

export const metadata: Metadata = { title: "Activité" };

// CE QUI SE PASSE DANS LE PRODUIT.
//
// UNE OUVERTURE DU JEU N'EST PAS UNE PARTIE. Le jeu demarre au chargement de sa
// page : une ligne de `sessions` sans reponse est une visite, pas un abandon.
// Seules les seances portant au moins une reponse sont appelees des parties.
//
// LA SEULE COMPARAISON QUI COMPTE ICI : lance contre termine. Une seance ouverte
// et jamais refermee n'est pas un demi succes, c'est un abandon qui n'a pas dit
// son nom, et le distinguer d'une seance finie est ce qui empeche de lire une
// courbe d'usage a l'envers.
//
// PERSONNEL ET DEVOIR NE S'ADDITIONNENT PAS. Un controle impose et une seance
// libre ne produisent pas la meme forme : les melanger dans un seul total efface
// justement la difference qu'on cherche.

const part = (n: number, total: number) => (total === 0 ? 0 : (100 * n) / total);

const LIBELLE_CONTEXTE: Record<string, string> = {
  personal: "Entraînement personnel",
  teacher_assignment: "Devoir donné par un professeur",
};

export default async function AdminActivitePage() {
  const [health, split, daily, shapes] = await Promise.all([
    productHealth(),
    contextSplit(),
    dailyActivity(),
    sessionShapes(),
  ]);

  // Parties abandonnees = parties moins celles qui sont allees au bout, moins
  // celles qui tournent encore. On soustrait dans le monde des PARTIES et jamais
  // dans celui des ouvertures : une ouverture du jeu qui expire n'a rien
  // abandonne, personne n'avait commence.
  const partiesOuvertes = shapes.reduce((sum, shape) => sum + shape.played_open, 0);
  const partiesAbandonnees =
    health.sessions_played - health.sessions_played_completed - partiesOuvertes;
  const pointe = Math.max(1, ...daily.map((day) => day.answers));

  return (
    <>
      <AdminPageHead href="/admin/activite" />

      <section className="st-kpis ad-kpis" aria-label="Séances">
        <div className="st-kpi">
          <span className="st-kpi__value">{health.sessions_played}</span>
          <span className="st-kpi__label">Parties jouées</span>
          <span className="st-kpi__helper">sur {health.sessions} ouvertures du jeu</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{health.sessions_played_completed}</span>
          <span className="st-kpi__label">Parties terminées</span>
          <span className="st-kpi__helper">
            {Math.round(part(health.sessions_played_completed, health.sessions_played))} % des parties
          </span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{partiesAbandonnees < 0 ? 0 : partiesAbandonnees}</span>
          <span className="st-kpi__label">Parties abandonnées</span>
          <span className="st-kpi__helper">{partiesOuvertes} encore en cours</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{health.answers}</span>
          <span className="st-kpi__label">Réponses</span>
          <span className="st-kpi__helper">{health.first_tries} premiers essais</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{health.questions_per_session ?? "—"}</span>
          <span className="st-kpi__label">Questions par partie</span>
          <span className="st-kpi__helper">moyenne, sur les parties jouées</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{daily.reduce((sum, day) => sum + day.answers, 0)}</span>
          <span className="st-kpi__label">Réponses sur 30 jours</span>
          <span className="st-kpi__helper">{daily.length} jours avec au moins une</span>
        </div>
      </section>

      <section className="st-panel" aria-label="Ce qu'ils lancent">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Ce qu&apos;ils lancent</h2>
          <span className="st-panel__meta">{health.sessions_played} parties en tout</span>
        </div>
        <AdminBars
          rows={shapes.map((shape) => ({
            key: shape.mode,
            label: shape.mode,
            value: `${shape.played} parties sur ${shape.n} ouvertures`,
            pct: part(shape.played, health.sessions_played),
          }))}
        />
      </section>

      <section className="st-panel" aria-label="Personnel ou devoir">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Seul, ou pour un professeur</h2>
          <span className="st-panel__meta">deux mondes, jamais additionnés</span>
        </div>
        <ul className="ad-rows">
          {split.map((row) => (
            <li key={row.context}>
              <span className="ad-rows__name">
                <em>{LIBELLE_CONTEXTE[row.context] ?? row.context}</em>
              </span>
              <span className="ad-rows__value">
                {row.sessions} ouvertures · {row.answers} réponses
              </span>
            </li>
          ))}
        </ul>
        <p className="ad-note">
          Le parcours personnel est primaire et autonome : il n&apos;attend pas
          qu&apos;un professeur donne quelque chose. Un déséquilibre entre ces deux
          lignes ne se lit donc pas comme un défaut, mais comme l&apos;état de
          l&apos;adoption scolaire à un instant donné.
        </p>
      </section>

      <section className="st-panel" aria-label="Jour par jour">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Jour par jour</h2>
          <span className="st-panel__meta">30 derniers jours</span>
        </div>
        {daily.length === 0 ? (
          <p className="st-empty">Aucune réponse enregistrée sur les trente derniers jours.</p>
        ) : (
          <AdminBars
            rows={daily.map((day) => ({
              key: day.day,
              label: day.day,
              value: `${day.answers} réponses · ${day.players} joueur${day.players > 1 ? "s" : ""}`,
              pct: part(day.answers, pointe),
            }))}
          />
        )}
      </section>
    </>
  );
}
