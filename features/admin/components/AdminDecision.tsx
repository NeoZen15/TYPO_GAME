"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Les deux seuls gestes du tableau de bord, et ils ne se ressemblent pas.
//
// REFUSER NE CREE RIEN, donc c'est possible des aujourd'hui. ACCEPTER CREE TOUT :
// le compte chez Clerk, l'ecole si elle n'existe pas, l'appartenance enseignante
// et l'invitation. Tant que les cles de Clerk ne sont pas posees, ce bouton est
// desactive et dit pourquoi, au lieu de creer la moitie d'un professeur.
//
// UN SEUL ENVOI EN VOL, comme sur l'ecran de jeu : deux clics sur Approve
// creeraient deux comptes, et c'est le genre de doublon qu'on ne repare pas d'un
// clic.
export default function AdminDecision({
  requestId,
  canApprove,
  whyNot,
}: {
  requestId: string;
  canApprove: boolean;
  whyNot: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "approve" | "reject") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/access/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, decision }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "la décision n'a pas été enregistrée");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="st-actions ad-decide">
      <button
        type="button"
        className="st-action st-action--compact st-action--primary"
        disabled={!canApprove || busy}
        onClick={() => void decide("approve")}
        title={canApprove ? undefined : whyNot}
      >
        Accepter
      </button>
      <button
        type="button"
        className="st-action st-action--compact"
        disabled={busy}
        onClick={() => void decide("reject")}
      >
        Refuser
      </button>
      {!canApprove && <span className="ad-decide__why">{whyNot}</span>}
      {error && (
        <span className="ad-decide__why" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
