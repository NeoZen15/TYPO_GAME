import type { Metadata } from "next";
import Link from "next/link";

import AdminDecision from "@/features/admin/components/AdminDecision";
import { BOARD_SYSTEM_CSS, CREAM } from "@/features/profile/components/board-system";
import { isClerkConfigured } from "@/lib/server/clerk-availability";
import { getCurrentIdentity } from "@/lib/server/current-user";
import {
  accessRequestCounts,
  accessRequests,
  type AccessRequestStatus,
} from "@/lib/admin/access-requests";

export const metadata: Metadata = {
  title: "Demandes d'accès",
};

// LE TABLEAU DE BORD DES DEMANDES D'ACCES.
//
// Le geste quotidien du proprietaire, et le seul : lire une demande, voir ce qui
// sera cree, accepter ou refuser. Les scripts restent des outils de secours.
//
// LA PORTE, ET SON EXCEPTION QUI SE REFERME TOUTE SEULE. La page exige le role
// `admin`. Mais l'authentification n'est pas encore branchee, donc personne ne
// porte ce role : la page serait invisible a son propre proprietaire. L'exception
// est donc la plus etroite possible et elle **disparait d'elle meme** : on n'ouvre
// sans compte que si Clerk n'est pas configure ET qu'il n'y a **aucune demande**.
// Autrement dit, on ne peut jamais montrer la moindre donnee personnelle a un
// visiteur non authentifie : le jour ou une vraie demande arrive, ou le jour ou
// les cles sont posees, la porte redevient la porte.
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

export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const status: AccessRequestStatus = isStatus(tab) ? tab : "pending";

  const [identity, counts] = await Promise.all([getCurrentIdentity(), accessRequestCounts()]);
  const total = counts.pending + counts.approved + counts.rejected;
  const clerkOn = isClerkConfigured();
  const allowed = identity.role === "admin" || (!clerkOn && total === 0);

  if (!allowed) {
    return (
      <main className="pf-page">
        <div className="st">
          <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
          <section className="st-panel st-sec">
            <h1 className="st-panel__title">Réservé à l&apos;administration</h1>
            <p className="st-empty">
              Cette page lit des demandes d&apos;accès, donc des noms et des
              adresses. Elle ne s&apos;ouvre qu&apos;à un compte administrateur.
            </p>
            <Link href="/" className="st-action st-action--compact">Retour à l&apos;accueil</Link>
          </section>
        </div>
      </main>
    );
  }

  const requests = await accessRequests(status);

  return (
    <main className="pf-page">
      <div className="st">
        <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
        <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />

        <header className="st-intro st-sec">
          <span className="st-kicker">Administration</span>
          <h1 className="st-title">Demandes d&apos;accès</h1>
          <p className="st-lede">
            Un enseignant demande, vous vérifiez, et tout est créé derrière. Un
            refus ne crée rien.
          </p>
        </header>

        <section className="st-panel st-sec" aria-label="Demandes">
          <div className="st-panel__head">
            <div className="st-choice" role="group" aria-label="Colonne">
              {TABS.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/access?tab=${item.id}`}
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
                const nouvelleEcole = request.matched_school_id === null;
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

                    {/* CE QUI SERA CREE, AVANT DE CLIQUER. La seule question qui
                        change ce que le bouton fait est l'établissement : déjà
                        connu, ou à créer. Elle se lit donc ici et pas après. */}
                    <p className="ad-card__preview">
                      <span>compte enseignant</span>
                      <span>
                        {nouvelleEcole
                          ? `nouvel établissement « ${request.school_name} »`
                          : `rattaché à « ${request.matched_school_name} », ${request.matched_school_classes} classe${request.matched_school_classes > 1 ? "s" : ""}`}
                      </span>
                      <span>invitation par courriel</span>
                    </p>

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
      </div>
    </main>
  );
}

/* Rien que les longueurs de cet écran. Le reste vient du système partagé. */
const ADMIN_CSS = `
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
  .ad-card__flag { margin: 0; font-family: var(--pf-mono); font-size: 0.58rem; color: rgb(${CREAM} / 0.7); }
  .ad-card__decided { margin: 0; font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.4); }
  .ad-decide { justify-content: flex-start; width: auto; margin: 0.2rem 0 0; align-items: center; }
  .ad-decide__why { font-size: 0.78rem; line-height: 1.4; color: rgb(${CREAM} / 0.45); max-width: 46ch; }
`;
