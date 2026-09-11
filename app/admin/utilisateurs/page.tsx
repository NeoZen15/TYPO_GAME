import type { Metadata } from "next";

import AdminBars from "@/features/admin/components/AdminBars";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { arrivals, productHealth, retention } from "@/lib/admin/usage";
import { accountsSummary } from "@/lib/admin/world";

export const metadata: Metadata = { title: "Utilisateurs" };

// COMBIEN DE PERSONNES, ARRIVEES QUAND, ET LESQUELLES REVIENNENT.
//
// LA DEFINITION DU RETOUR EST VOLONTAIREMENT SEVERE : une personne est revenue si
// son activite s'etale sur au moins DEUX jours differents. Une longue premiere
// visite reste une premiere visite, et une definition genereuse du retour est la
// facon la plus courante de se mentir sur la retention d'un produit jeune.
//
// CE N'EST PAS L'AUDIENCE DU SITE. Ici, une personne est un compte qui a joue.
// Les visiteurs, les sources et la conversion visite vers inscription sont une
// autre couche, et elle a sa propre entree dans la barre.

const part = (n: number, total: number) => (total === 0 ? 0 : (100 * n) / total);

export default async function AdminUtilisateursPage() {
  const [health, summary, back, days] = await Promise.all([
    productHealth(),
    accountsSummary(),
    retention(),
    arrivals(),
  ]);

  const pointe = Math.max(1, ...days.map((day) => day.accounts));

  return (
    <>
      <AdminPageHead href="/admin/utilisateurs" />

      <section className="st-kpis ad-kpis" aria-label="Population">
        <div className="st-kpi">
          <span className="st-kpi__value">{health.accounts}</span>
          <span className="st-kpi__label">Comptes</span>
          <span className="st-kpi__helper">{health.accounts_30d} sur 30 jours</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{back.cohort_size}</span>
          <span className="st-kpi__label">Ont joué au moins une fois</span>
          <span className="st-kpi__helper">{summary.never_played} n&apos;ont jamais joué</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{back.came_back}</span>
          <span className="st-kpi__label">Sont revenus un autre jour</span>
          <span className="st-kpi__helper">
            {Math.round(part(back.came_back, back.cohort_size))} % de ceux qui ont joué
          </span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{health.active_7d}</span>
          <span className="st-kpi__label">Actifs sur 7 jours</span>
          <span className="st-kpi__helper">{health.active_30d} sur 30 jours</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{summary.with_clerk}</span>
          <span className="st-kpi__label">Authentifiés</span>
          <span className="st-kpi__helper">{summary.guests} jouent en visiteur</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{back.came_back_7d}</span>
          <span className="st-kpi__label">Revenus et encore actifs</span>
          <span className="st-kpi__helper">vus dans les 7 derniers jours</span>
        </div>
      </section>

      <p className="ad-note">
        Un compte visiteur est un vrai joueur : DWIGGINS se joue sans créer de
        compte, et la progression suit le cookie tant que personne ne s&apos;est
        authentifié. Le rapport entre ces deux lignes dit donc ce que
        l&apos;inscription apporte, pas qui joue vraiment.
      </p>

      <section className="st-panel" aria-label="Arrivées">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Les arrivées</h2>
          <span className="st-panel__meta">30 derniers jours</span>
        </div>
        {days.length === 0 ? (
          <p className="st-empty">Aucun compte créé sur les trente derniers jours.</p>
        ) : (
          <AdminBars
            rows={days.map((day) => ({
              key: day.day,
              label: day.day,
              value: `${day.accounts} compte${day.accounts > 1 ? "s" : ""}`,
              pct: part(day.accounts, pointe),
            }))}
          />
        )}
      </section>
    </>
  );
}
