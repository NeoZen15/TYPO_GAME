import type { Metadata } from "next";

import AdminBars from "@/features/admin/components/AdminBars";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { arrivals, productHealth, pulse, retention } from "@/lib/admin/usage";
import { accountsSummary } from "@/lib/admin/world";

export const metadata: Metadata = { title: "Utilisateurs" };

// COMBIEN DE PERSONNES, ARRIVEES QUAND, ET LESQUELLES REVIENNENT.
//
// CINQ MOTS, CINQ POPULATIONS, ET AUCUN NE S'APPELLE « ACTIF » (proprietaire,
// 2026-09-12). Un VISITEUR charge une page, et rien ne le mesure. Un COMPTE est
// une ligne de `users`, creee au premier lancement. Un COMPTE AUTHENTIFIE porte
// un `clerk_id`. Quelqu'un A LANCE une partie si une seance a demarre. Quelqu'un
// A REPONDU s'il a repondu a au moins une question. Les deux derniers different
// d'un facteur deux, et c'est l'ecart le plus interessant de cette page.
//
// LA DEFINITION DU RETOUR EST VOLONTAIREMENT SEVERE : une personne est revenue si
// son activite s'etale sur au moins DEUX jours differents. Une longue premiere
// visite reste une premiere visite, et une definition genereuse du retour est la
// facon la plus courante de se mentir sur la retention d'un produit jeune.
//
// QUATRE POPULATIONS, QUATRE NOMS, ET JAMAIS LE MOT « ACTIF ». Un compte, un
// compte authentifie, quelqu'un qui a LANCE une partie, quelqu'un qui a REPONDU.
// Les deux derniers different d'un facteur deux (177 contre 78 sur trente jours
// le 2026-09-12), et c'est justement l'ecart qu'on veut voir.
//
// CE N'EST PAS L'AUDIENCE DU SITE. Ici, une personne est un compte qui a joue.
// Les visiteurs, les sources et la conversion visite vers inscription sont une
// autre couche, et elle a sa propre entree dans la barre.

const part = (n: number, total: number) => (total === 0 ? 0 : (100 * n) / total);

export default async function AdminUtilisateursPage() {
  const [health, summary, back, days, vital] = await Promise.all([
    productHealth(),
    accountsSummary(),
    retention(),
    arrivals(),
    pulse(),
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
          <span className="st-kpi__label">Ont répondu au moins une fois</span>
          <span className="st-kpi__helper">{summary.never_played} n&apos;ont jamais répondu</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{back.came_back}</span>
          <span className="st-kpi__label">Revenus un autre jour</span>
          <span className="st-kpi__helper">
            {Math.round(part(back.came_back, back.cohort_size))} % de ceux qui ont répondu
          </span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{vital.answered_7d}</span>
          <span className="st-kpi__label">Ont répondu · 7 jours</span>
          <span className="st-kpi__helper">{vital.answered_30d} sur 30 jours</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{summary.with_clerk}</span>
          <span className="st-kpi__label">Comptes authentifiés</span>
          <span className="st-kpi__helper">{summary.guests} comptes invités</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{vital.launched_30d - vital.answered_30d}</span>
          <span className="st-kpi__label">Ont ouvert sans répondre · 30 jours</span>
          <span className="st-kpi__helper">
            {vital.launched_30d} ont ouvert le jeu, {vital.answered_30d} ont répondu
          </span>
        </div>
      </section>

      <p className="ad-note">
        Un <strong>compte invité</strong> est un vrai joueur : DWIGGINS se joue sans
        s&apos;inscrire, et la progression suit le cookie tant que personne ne
        s&apos;est authentifié. Le mot <strong>visiteur</strong> est réservé à
        quelqu&apos;un qui charge une page sans lancer de partie, et personne ne le
        mesure aujourd&apos;hui : il ne désigne donc jamais un compte.
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
