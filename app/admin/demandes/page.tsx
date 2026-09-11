import type { Metadata } from "next";
import Link from "next/link";

import AdminDecision from "@/features/admin/components/AdminDecision";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { CREAM } from "@/features/profile/components/board-system";
import { isClerkConfigured } from "@/lib/server/clerk-availability";
import {
  accessRequestCounts,
  accessRequests,
  type AccessRequestStatus,
} from "@/lib/admin/access-requests";

export const metadata: Metadata = {
  title: "Demandes d'accès",
};

// LE GUICHET : lire une demande, voir ce qui sera cree, accepter ou refuser.
//
// LA PORTE N'EST PLUS ICI. Elle est posee une fois dans `app/admin/layout.tsx`,
// avec son exception qui se referme toute seule, et couvre donc cette page comme
// toutes les autres. Les routes d'ecriture portent la meme regle de leur cote :
// une page gardee derriere une route ouverte ne garde rien.
//
// AUCUNE DA NOUVELLE. Les panneaux, les onglets, les rangees et les boutons sont
// ceux du systeme partage. L'habillage de cet espace appartient au proprietaire.

const TABS: ReadonlyArray<{ id: AccessRequestStatus; label: string }> = [
  { id: "pending", label: "En attente" },
  { id: "approved", label: "Acceptées" },
  { id: "rejected", label: "Refusées" },
];

const isStatus = (value: string | undefined): value is AccessRequestStatus =>
  value === "pending" || value === "approved" || value === "rejected";

const jour = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default async function AdminDemandesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const status: AccessRequestStatus = isStatus(tab) ? tab : "pending";
  const clerkOn = isClerkConfigured();

  const [counts, requests] = await Promise.all([accessRequestCounts(), accessRequests(status)]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DEMANDES_CSS }} />
      <AdminPageHead href="/admin/demandes" />

      <section className="st-panel" aria-label="Demandes">
        <div className="st-panel__head">
          <div className="st-choice" role="group" aria-label="Colonne">
            {TABS.map((item) => (
              <Link
                key={item.id}
                href={`/admin/demandes?tab=${item.id}`}
                className={`st-choice__btn${status === item.id ? " is-active" : ""}`}
              >
                {item.label} {counts[item.id]}
              </Link>
            ))}
          </div>
          {!clerkOn && (
            <span className="st-panel__meta">
              authentification pas encore branchée, acceptation impossible
            </span>
          )}
        </div>

        {requests.length === 0 ? (
          <p className="st-empty">
            {status === "pending"
              ? "Aucune demande en attente. Elles arriveront ici, et vous n'aurez qu'à vérifier puis trancher."
              : status === "approved"
                ? "Aucune demande acceptée pour l'instant."
                : "Aucune demande refusée."}
          </p>
        ) : (
          <ul className="ad-list">
            {requests.map((request) => {
              const candidats = request.school_candidates;
              return (
                <li key={request.request_id} className="ad-card">
                  <div className="ad-card__head">
                    <span className="ad-card__name">{request.full_name}</span>
                    <span className="ad-card__when">{jour(request.created_at)}</span>
                  </div>
                  <p className="ad-card__id">
                    <span>{request.email}</span>
                    <span>{request.school_name}</span>
                    {request.teaches ? <span>{request.teaches}</span> : null}
                  </p>
                  {request.message ? <p className="ad-card__message">{request.message}</p> : null}

                  {/* CE QUI SERA CREE, AVANT DE CLIQUER. L'établissement est la
                      seule question qui change ce que le bouton fait, donc elle
                      se lit ici. Et elle se lit comme une QUESTION : le
                      rapprochement par le nom est une proposition, jamais une
                      identité. Deux établissements peuvent porter le même nom,
                      et c'est l'humain qui tranche. */}
                  <p className="ad-card__preview">
                    <span>compte enseignant</span>
                    <span>
                      {candidats.length === 0
                        ? `nouvel établissement « ${request.school_name} »`
                        : `établissement à confirmer, ${candidats.length} déjà connu${candidats.length > 1 ? "s" : ""} sous ce nom`}
                    </span>
                    <span>invitation par courriel</span>
                  </p>

                  {candidats.length > 0 && (
                    <ul className="ad-card__candidates">
                      {candidats.map((candidat) => (
                        <li key={candidat.school_id}>
                          <em>{candidat.name}</em>
                          {" · "}
                          {candidat.classes} classe{candidat.classes > 1 ? "s" : ""}
                          {" · "}
                          {candidat.why.join(", ")}
                        </li>
                      ))}
                      <li className="ad-card__candidates--new">ou en créer un nouveau</li>
                    </ul>
                  )}

                  {request.same_email > 0 && (
                    <p className="ad-card__flag">
                      {request.same_email} autre demande
                      {request.same_email > 1 ? "s" : ""} porte
                      {request.same_email > 1 ? "nt" : ""} cette adresse.
                    </p>
                  )}

                  {status === "pending" ? (
                    <AdminDecision
                      requestId={request.request_id}
                      canApprove={clerkOn}
                      whyNot="Accepter crée le compte chez Clerk : impossible tant que ses clés ne sont pas posées."
                    />
                  ) : (
                    <p className="ad-card__decided">
                      {status === "approved" ? "Acceptée" : "Refusée"}
                      {request.decided_at ? ` le ${jour(request.decided_at)}` : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

/* Rien que la fiche d'une demande. Le reste vient de la coquille. */
const DEMANDES_CSS = `
  .ad-list { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
  .ad-card { display: grid; gap: 0.5rem; padding: 1.1rem 0; border-top: 1px solid rgb(${CREAM} / 0.08); }
  .ad-card:first-child { border-top: none; padding-top: 0; }
  .ad-card__head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
  .ad-card__name { font-size: 1rem; color: var(--pf-cream); }
  .ad-card__when { font-family: var(--pf-mono); font-size: 0.58rem; color: rgb(${CREAM} / 0.4); white-space: nowrap; }
  .ad-card__id, .ad-card__preview { display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; margin: 0; font-family: var(--pf-mono); font-size: 0.6rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.45); }
  .ad-card__id span + span::before, .ad-card__preview span + span::before { content: "·"; margin-right: 0.8rem; color: rgb(${CREAM} / 0.3); }
  .ad-card__preview { text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.55rem; color: rgb(${CREAM} / 0.55); }
  .ad-card__message { margin: 0; max-width: 62ch; text-wrap: pretty; font-size: 0.84rem; line-height: 1.5; color: rgb(${CREAM} / 0.6); }
  /* Les candidats : une liste à lire, pas une case déjà cochée. */
  .ad-card__candidates { display: grid; gap: 0.2rem; margin: 0; padding: 0 0 0 0.9rem; list-style: none; font-family: var(--pf-mono); font-size: 0.58rem; color: rgb(${CREAM} / 0.45); border-left: 1px solid rgb(${CREAM} / 0.14); }
  .ad-card__candidates em { font-style: normal; color: var(--pf-cream); }
  .ad-card__candidates--new { color: rgb(${CREAM} / 0.32); }
  .ad-card__flag { margin: 0; font-family: var(--pf-mono); font-size: 0.58rem; color: rgb(${CREAM} / 0.7); }
  .ad-card__decided { margin: 0; font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.4); }
  .ad-decide { justify-content: flex-start; width: auto; margin: 0.2rem 0 0; align-items: center; }
  .ad-decide__why { font-size: 0.78rem; line-height: 1.4; color: rgb(${CREAM} / 0.45); max-width: 46ch; }
`;
