import type { Metadata } from "next";

import AdminBars from "@/features/admin/components/AdminBars";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { contextSplit, dailyActivity, productHealth } from "@/lib/admin/usage";

export const metadata: Metadata = { title: "Activité" };

// CE QUI SE PASSE DANS LE PRODUIT.
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
  const [health, split, daily] = await Promise.all([
    productHealth(),
    contextSplit(),
    dailyActivity(),
  ]);

  const abandoned = health.sessions - health.sessions_completed - health.sessions_open;
  const pointe = Math.max(1, ...daily.map((day) => day.answers));

  return (
    <>
      <AdminPageHead href="/admin/activite" />

      <section className="st-kpis ad-kpis" aria-label="Séances">
        <div className="st-kpi">
          <span className="st-kpi__value">{health.sessions}</span>
          <span className="st-kpi__label">Séances lancées</span>
          <span className="st-kpi__helper">depuis le premier jour</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{health.sessions_completed}</span>
          <span className="st-kpi__label">Terminées</span>
          <span className="st-kpi__helper">
            {Math.round(part(health.sessions_completed, health.sessions))} % du total
          </span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{abandoned < 0 ? 0 : abandoned}</span>
          <span className="st-kpi__label">Abandonnées</span>
          <span className="st-kpi__helper">{health.sessions_open} encore ouvertes</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{health.answers}</span>
          <span className="st-kpi__label">Réponses</span>
          <span className="st-kpi__helper">{health.first_tries} premiers essais</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{health.questions_per_session ?? "—"}</span>
          <span className="st-kpi__label">Questions par séance</span>
          <span className="st-kpi__helper">en moyenne</span>
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
          <span className="st-panel__meta">{health.sessions} séances en tout</span>
        </div>
        <AdminBars
          rows={health.by_mode.map((row) => ({
            key: row.mode,
            label: row.mode,
            value: `${row.n} séances`,
            pct: part(row.n, health.sessions),
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
                {row.sessions} séances · {row.answers} réponses
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
