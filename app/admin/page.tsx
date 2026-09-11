import type { Metadata } from "next";
import Link from "next/link";

import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { accessRequestCounts } from "@/lib/admin/access-requests";
import { dataHealth } from "@/lib/admin/quality";
import { productHealth } from "@/lib/admin/usage";
import { worldCounts } from "@/lib/admin/world";
import { isClerkConfigured } from "@/lib/server/clerk-availability";

export const metadata: Metadata = {
  title: "Vue d'ensemble",
};

// LE COCKPIT, ET PAS UNE PAGE D'ANALYSE.
//
// Regle donnee par le proprietaire le 2026-09-11 : cette page se lit en dix
// secondes. Elle repond a deux questions, dans cet ordre : est ce que quelque
// chose m'attend, et est ce que le produit va bien. Tout ce qui demande a etre
// etudie plutot que constate appartient a une autre entree de la barre, et un
// lien y mene.
//
// CE QUI N'EST PAS UN INDICATEUR D'ACCUEIL. Le temps de reponse median est une
// donnee interessante et elle vit dans Sessions : interessante n'est pas vital,
// et un accueil qui montre tout ne montre rien.
//
// LA LISTE D'ALERTES NE S'INVENTE PAS DE LIGNES. Chaque ligne est une condition
// vraie au moment du rendu. Quand il n'y en a aucune, la page le dit en une
// phrase plutot que d'afficher un cadre vide, et c'est un bon jour.

const part = (n: number, total: number) => (total === 0 ? "—" : `${Math.round((100 * n) / total)} %`);

export default async function AdminOverviewPage() {
  const [requests, health, world, data] = await Promise.all([
    accessRequestCounts(),
    productHealth(),
    worldCounts(),
    dataHealth(),
  ]);

  const attention: { key: string; text: string; href: string }[] = [];

  if (requests.pending > 0) {
    attention.push({
      key: "demandes",
      text: `${requests.pending} demande${requests.pending > 1 ? "s" : ""} d'accès en attente`,
      href: "/admin/demandes",
    });
  }
  if (!isClerkConfigured()) {
    attention.push({
      key: "clerk",
      text: "L'authentification n'est pas branchée : aucune demande ne peut être acceptée",
      href: "/admin/parametres",
    });
  }
  if (data.sessions_stuck > 0) {
    attention.push({
      key: "coincees",
      text: `${data.sessions_stuck} séance${data.sessions_stuck > 1 ? "s" : ""} ouverte${data.sessions_stuck > 1 ? "s" : ""} depuis plus de 24 h`,
      href: "/admin/donnees",
    });
  }
  if (data.sessions_mismatch > 0) {
    attention.push({
      key: "ecart",
      text: `${data.sessions_mismatch} séance${data.sessions_mismatch > 1 ? "s" : ""} dont le compteur ne correspond pas au journal`,
      href: "/admin/donnees",
    });
  }
  if (data.events_default_partition > 0) {
    attention.push({
      key: "partition",
      text: `${data.events_default_partition} réponses rangées dans la partition par défaut : des mois manquent au journal`,
      href: "/admin/donnees",
    });
  }
  if (data.faces_without_asset > 0) {
    attention.push({
      key: "asset",
      text: `${data.faces_without_asset} polices jouables n'ont aucun fichier déclaré`,
      href: "/admin/donnees",
    });
  }

  return (
    <>
      <AdminPageHead href="/admin" />

      <section className="st-panel" aria-label="Ce qui demande votre attention">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Ce qui vous attend</h2>
          <span className="st-panel__meta">à l&apos;instant</span>
        </div>
        {attention.length === 0 ? (
          <p className="st-empty">
            Rien en attente, rien de cassé. Les demandes d&apos;accès arrivent dans
            la première entrée de la barre, et les contrôles de données sont au
            vert.
          </p>
        ) : (
          <ul className="ad-rows ad-rows--flag">
            {attention.map((item) => (
              <li key={item.key}>
                <span className="ad-rows__name">{item.text}</span>
                <Link href={item.href} className="ad-rows__value ad-go">
                  y aller
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Les signes vitaux, et rien de plus ── */}
      <section className="st-kpis ad-kpis" aria-label="Signes vitaux">
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
            {health.sessions_completed} sur {health.sessions}
          </span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">
            {health.first_try_right_pct === null ? "—" : `${health.first_try_right_pct} %`}
          </span>
          <span className="st-kpi__label">Justes au premier essai</span>
          <span className="st-kpi__helper">sur {health.first_tries} premiers essais</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{world.schools}</span>
          <span className="st-kpi__label">Établissements</span>
          <span className="st-kpi__helper">
            {world.classes} classes, {world.students} élèves rattachés
          </span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{world.assignments_published}</span>
          <span className="st-kpi__label">Devoirs publiés</span>
          <span className="st-kpi__helper">sur {world.assignments} créés</span>
        </div>
      </section>

      <p className="ad-note">
        Six chiffres, et ce qui demande un geste. Tout ce qui s&apos;étudie plutôt
        que se constate a son entrée dans la barre : l&apos;usage dans{" "}
        <Link href="/admin/activite" className="ad-link">Activité</Link>,
        l&apos;apprentissage dans{" "}
        <Link href="/admin/progression" className="ad-link">Progression</Link>, et
        la cartographie du catalogue dans{" "}
        <Link href="/admin/typographies" className="ad-link">Typographies</Link>.
      </p>
    </>
  );
}
