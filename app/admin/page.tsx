import type { Metadata } from "next";
import Link from "next/link";

import AdminNav from "@/features/admin/components/AdminNav";
import { BOARD_SYSTEM_CSS, CREAM } from "@/features/profile/components/board-system";
import { isClerkConfigured } from "@/lib/server/clerk-availability";
import { getCurrentIdentity } from "@/lib/server/current-user";
import { accessRequestCounts } from "@/lib/admin/access-requests";
import {
  hardestFaces,
  learningShape,
  productHealth,
  SEUIL_PAIRE,
  SEUIL_POLICE,
  topConfusions,
} from "@/lib/admin/usage";

export const metadata: Metadata = {
  title: "Santé du produit",
};

// LE POSTE D'OBSERVATION, PREMIER ETAGE.
//
// L'ordre decide par le proprietaire le 2026-09-11 : d'abord comptes,
// etablissements et demandes, PUIS l'usage reel, puis l'apprentissage et les
// confusions, puis le diagnostic moteur, puis les analyses avancees. Cette page
// est le deuxieme etage, et elle ne montre **que** ce que le systeme collecte
// deja. Les vues suivantes sont decrites dans l'architecture backend, pas
// esquissees ici en panneaux vides : une maquette de donnee qui n'existe pas est
// exactement ce qui transforme un tableau de bord en usine a gaz.
//
// CHAQUE CHIFFRE PORTE SON EFFECTIF, et ce qui n'a pas l'effectif n'est pas
// classe. C'est le regime des analyses internes (I-24) applique honnetement sur un
// produit jeune : masquer les petites cohortes n'est pas une precaution ici, c'est
// la situation normale.

const secondes = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`);
const part = (n: number, total: number) => (total === 0 ? "—" : `${Math.round((100 * n) / total)} %`);

export default async function AdminHealthPage() {
  const [identity, requests] = await Promise.all([getCurrentIdentity(), accessRequestCounts()]);
  const clerkOn = isClerkConfigured();
  const total = requests.pending + requests.approved + requests.rejected;
  const allowed = identity.role === "admin" || (!clerkOn && total === 0);

  if (!allowed) {
    return (
      <main className="pf-page">
        <div className="st">
          <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
          <section className="st-panel st-sec">
            <h1 className="st-panel__title">Réservé à l&apos;administration</h1>
            <p className="st-empty">Cette page lit l&apos;usage réel du produit.</p>
            <Link href="/" className="st-action st-action--compact">Retour à l&apos;accueil</Link>
          </section>
        </div>
      </main>
    );
  }

  const [health, shape, hard, confusions] = await Promise.all([
    productHealth(),
    learningShape(),
    hardestFaces(),
    topConfusions(),
  ]);

  return (
    <main className="pf-page">
      <div className="st">
        <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
        <style dangerouslySetInnerHTML={{ __html: HEALTH_CSS }} />

        <header className="st-intro st-sec">
          <span className="st-kicker">Administration</span>
          <h1 className="st-title">Santé du produit</h1>
          <p className="st-lede">
            Ce que le système collecte déjà, et rien d&apos;autre. Chaque chiffre
            porte son effectif.
          </p>
        </header>

        <AdminNav active="health" />

        {/* ── Est ce qu'ils jouent, ou est ce qu'ils disparaissent ── */}
        <section className="st-kpis ad-kpis st-sec" aria-label="Usage">
          <div className="st-kpi">
            <span className="st-kpi__value">{health.active_7d}</span>
            <span className="st-kpi__label">Actifs sur 7 jours</span>
            <span className="st-kpi__helper">{health.active_30d} sur 30 jours</span>
          </div>
          <div className="st-kpi">
            <span className="st-kpi__value">{health.accounts}</span>
            <span className="st-kpi__label">Comptes</span>
            <span className="st-kpi__helper">{health.accounts_30d} créés sur 30 jours</span>
          </div>
          <div className="st-kpi">
            <span className="st-kpi__value">{part(health.sessions_completed, health.sessions)}</span>
            <span className="st-kpi__label">Séances terminées</span>
            <span className="st-kpi__helper">
              {health.sessions_completed} sur {health.sessions}, {health.sessions_open} encore ouvertes
            </span>
          </div>
          <div className="st-kpi">
            <span className="st-kpi__value">{health.questions_per_session ?? "—"}</span>
            <span className="st-kpi__label">Questions par séance</span>
            <span className="st-kpi__helper">en moyenne</span>
          </div>
          <div className="st-kpi">
            <span className="st-kpi__value">
              {health.first_try_right_pct === null ? "—" : `${health.first_try_right_pct} %`}
            </span>
            <span className="st-kpi__label">Justes au premier essai</span>
            <span className="st-kpi__helper">sur {health.first_tries} premiers essais</span>
          </div>
          <div className="st-kpi">
            <span className="st-kpi__value">{secondes(health.median_answer_ms)}</span>
            <span className="st-kpi__label">Temps de réponse</span>
            <span className="st-kpi__helper">médiane, premier essai</span>
          </div>
        </section>

        <section className="st-panel st-sec" aria-label="Par mode">
          <div className="st-panel__head">
            <h2 className="st-panel__title">Ce qu&apos;ils lancent</h2>
            <span className="st-panel__meta">{health.sessions} séances en tout</span>
          </div>
          <ul className="st-axes">
            {health.by_mode.map((row) => (
              <li key={row.mode} className="st-axis st-axis--emerging">
                <span className="st-axis__name">{row.mode}</span>
                <span className="st-axis__state">{row.n} séances</span>
                <span className="st-axis__bar">
                  <span
                    className="st-axis__fill"
                    style={{ width: `${health.sessions === 0 ? 0 : (100 * row.n) / health.sessions}%` }}
                  />
                </span>
                <span className="st-axis__frac"><em>{part(row.n, health.sessions)}</em></span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── L'apprentissage, dans ce que la répétition espacée porte ── */}
        <section className="st-panel st-sec" aria-label="Apprentissage">
          <div className="st-panel__head">
            <h2 className="st-panel__title">Où en est l&apos;apprentissage</h2>
            <span className="st-panel__meta">
              {shape.faces_seen} polices vues · {shape.faces_above_threshold} au dessus de {SEUIL_POLICE} essais
            </span>
          </div>
          <p className="ad-facts">
            <span><em>{shape.stabilised}</em> polices stabilisées</span>
            <span><em>{shape.in_pool}</em> dans un pool actif</span>
            <span><em>{shape.states}</em> états suivis</span>
            <span><em>{shape.relapses}</em> rechutes après stabilisation</span>
          </p>
          <p className="ad-note">
            Une police stabilisée est une police réussie trois fois sans erreur
            récente. Une rechute est une réponse qui la fait redescendre : c&apos;est
            la seule mesure qui dit si elle tient vraiment.{" "}
            {shape.in_pool === shape.states
              ? "Les deux premiers chiffres sont égaux, et ce n'est pas une erreur : aujourd'hui un état n'existe que pour une police entrée dans un pool. Le premier devoir joué changera ça, en enregistrant la maîtrise de polices choisies par un professeur sans les faire entrer dans le pool."
              : ""}
          </p>
        </section>

        <section className="st-panel st-sec" aria-label="Polices les plus ratées">
          <div className="st-panel__head">
            <h2 className="st-panel__title">Ce qui résiste</h2>
            <span className="st-panel__meta">au premier essai, à partir de {SEUIL_POLICE} essais</span>
          </div>
          {hard.length === 0 ? (
            <p className="st-empty">
              Aucune police n&apos;a encore atteint {SEUIL_POLICE} premiers essais.
              Classer avant ce seuil donnerait du bruit présenté comme un résultat.
            </p>
          ) : (
            <ul className="st-axes">
              {hard.map((face) => {
                const state = face.right_pct >= 75 ? "lit" : face.right_pct >= 55 ? "emerging" : "dormant";
                return (
                  <li key={face.typeface_slug} className={`st-axis st-axis--${state}`}>
                    <span className="st-axis__letter">{face.display_name.charAt(0)}</span>
                    <span className="st-axis__name">{face.display_name}</span>
                    <span className="st-axis__state">{face.first_tries} essais</span>
                    <span className="st-axis__bar">
                      <span className="st-axis__fill" style={{ width: `${face.right_pct}%` }} />
                    </span>
                    <span className="st-axis__frac"><em>{face.right_pct}</em>%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="st-panel st-sec" aria-label="Confusions">
          <div className="st-panel__head">
            <h2 className="st-panel__title">Ce qu&apos;ils confondent</h2>
            <span className="st-panel__meta">premiers essais, à partir de {SEUIL_PAIRE} fois</span>
          </div>
          {confusions.length === 0 ? (
            <p className="st-empty">
              Aucune paire n&apos;est encore revenue {SEUIL_PAIRE} fois. Le journal
              enregistre la réponse choisie à côté de la réponse attendue depuis le
              premier jour : il n&apos;y a rien à ajouter, seulement à attendre.
            </p>
          ) : (
            <ul className="ad-pairs">
              {confusions.map((pair) => (
                <li key={`${pair.seen_name}-${pair.chosen_name}`}>
                  <em>{pair.seen_name}</em> lu comme <em>{pair.chosen_name}</em>
                  <span>{pair.times} fois</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

/* Rien que les longueurs de cet écran. */
const HEALTH_CSS = `
  .ad-nav { width: min(98%, 66rem); margin: 0 auto; }
  .ad-kpis { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 760px) { .ad-kpis { grid-template-columns: repeat(2, 1fr); } }
  .ad-facts { display: flex; flex-wrap: wrap; gap: 0.3rem 1.2rem; margin: 0 0 0.8rem; font-family: var(--pf-mono); font-size: 0.62rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.5); }
  .ad-facts em { font-style: normal; font-weight: 640; font-size: 0.9rem; color: var(--pf-cream); }
  .ad-note { margin: 0; max-width: 62ch; text-wrap: pretty; font-size: 0.8rem; line-height: 1.5; color: rgb(${CREAM} / 0.45); }
  .ad-pairs { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
  .ad-pairs li { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: 0.6rem 0; border-top: 1px solid rgb(${CREAM} / 0.08); font-size: 0.86rem; color: rgb(${CREAM} / 0.6); }
  .ad-pairs li:first-child { border-top: none; padding-top: 0; }
  .ad-pairs em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .ad-pairs span { font-family: var(--pf-mono); font-size: 0.6rem; color: rgb(${CREAM} / 0.4); white-space: nowrap; }
`;
