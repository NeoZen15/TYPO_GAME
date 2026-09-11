import type { Metadata } from "next";

import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { accountsSummary, recentAccounts } from "@/lib/admin/world";

export const metadata: Metadata = { title: "Élèves et comptes" };

// LE REPERTOIRE : GESTION ET DEPANNAGE, ET RIEN D'AUTRE.
//
// DECISION DU PROPRIETAIRE, 2026-09-11. Cette page ne sert pas a savoir si un
// eleve est bon ou mauvais, ni a consulter sa progression. Ca, c'est le travail
// du professeur, dans l'espace professeur, ou la porte de lecture dit deja a
// quelles conditions il peut regarder. Ici on ouvre un compte parce que quelqu'un
// est bloque : il ne voit pas sa classe, son invitation n'est pas arrivee, son
// compte invite n'a pas ete repris. On regarde donc un ETAT, jamais un niveau.
//
// CE QU'ON NE MONTRE PAS, VOLONTAIREMENT : aucun taux de reussite, aucun
// classement, aucun tri par performance. Un tri par performance transformerait ce
// repertoire en palmares, et c'est exactement ce qu'on ne veut pas construire.
// L'analyse qui interesse l'operateur est agregee, et elle vit dans Progression,
// Confusions et Typographies.
//
// CE QUE LA BASE NE SAIT PAS : ni nom ni adresse, l'identite vit chez Clerk. Un
// compte se reconnait donc a son identifiant court, son role et son rattachement.

const court = (id: string) => id.slice(0, 8);

export default async function AdminComptesPage() {
  const [summary, accounts] = await Promise.all([accountsSummary(), recentAccounts()]);

  return (
    <>
      <AdminPageHead href="/admin/comptes" />

      <section className="st-kpis ad-kpis" aria-label="Volumes">
        <div className="st-kpi">
          <span className="st-kpi__value">{summary.total}</span>
          <span className="st-kpi__label">Comptes</span>
          <span className="st-kpi__helper">{summary.seen_7d} vus sur 7 jours</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{summary.with_clerk}</span>
          <span className="st-kpi__label">Authentifiés</span>
          <span className="st-kpi__helper">{summary.guests} en visiteur</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{summary.in_a_class}</span>
          <span className="st-kpi__label">Rattachés à une classe</span>
          <span className="st-kpi__helper">le reste joue seul</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{summary.never_played}</span>
          <span className="st-kpi__label">Sans une seule question</span>
          <span className="st-kpi__helper">compte créé, jamais joué</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{summary.players + summary.admins}</span>
          <span className="st-kpi__label">Rôles nommés</span>
          <span className="st-kpi__helper">
            {summary.players} joueurs, {summary.admins} administrateurs
          </span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{summary.deleted}</span>
          <span className="st-kpi__label">Supprimés</span>
          <span className="st-kpi__helper">effacement demandé</span>
        </div>
      </section>

      <section className="st-panel" aria-label="Derniers comptes">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Les derniers arrivés</h2>
          <span className="st-panel__meta">par ordre d&apos;arrivée</span>
        </div>
        {accounts.length === 0 ? (
          <p className="st-empty">Aucun compte.</p>
        ) : (
          <ul className="ad-rows">
            {accounts.map((account) => (
              <li key={account.user_id}>
                <span className="ad-rows__name">
                  <em>{court(account.user_id)}</em>
                  <b>
                    {account.role}
                    {account.has_account ? "" : " · sans compte"}
                    {account.classes > 0
                      ? ` · ${account.classes} classe${account.classes > 1 ? "s" : ""}`
                      : " · aucune classe"}
                    {account.deleted ? " · supprimé" : ""}
                  </b>
                </span>
                <span className="ad-rows__value">
                  {account.sessions} séance{account.sessions > 1 ? "s" : ""} ·{" "}
                  {account.questions} question{account.questions > 1 ? "s" : ""} · vu le{" "}
                  {account.last_seen_at}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="ad-note">
          Aucun taux de réussite ici, et aucun classement : la lecture individuelle
          d&apos;un élève appartient à son professeur. Ce répertoire sert à
          comprendre un rattachement ou à débloquer quelqu&apos;un. Les noms et les
          adresses vivent chez Clerk et n&apos;existent pas dans cette base.
        </p>
      </section>
    </>
  );
}
