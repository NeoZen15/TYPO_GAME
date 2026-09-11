import "server-only";

import { sql } from "@/lib/server/neon";

// LES DEMANDES D'ACCES, VUES PAR L'ADMINISTRATION.
//
// Le modele est arrete en architecture backend section 2.3 : pas d'inscription
// libre, un enseignant DEMANDE, le proprietaire VALIDE, et tout est cree
// derriere. Ce module lit, pre-verifie et preremplit ; il ne decide rien.
//
// CE QU'IL PRE-VERIFIE, ET POURQUOI CHAQUE VERIFICATION EXISTE.
//   - Les demandes de la meme adresse, pour qu'une personne qui insiste ne
//     ressorte pas comme deux enseignants.
//   - L'etablissement : deja connu, ou a creer. C'est la seule question qui
//     change ce que le bouton va faire, donc elle se lit avant de cliquer.
//
// CE QU'IL NE FAIT PAS. Il ne demande pas a Clerk si un compte existe deja : cet
// appel a besoin des cles, il vit donc du cote qui les possede, et l'ecran s'en
// passe tant qu'elles ne sont pas la. Et il ne cherche pas d'adresse dans
// `users`, qui n'en porte pas et n'en portera pas : l'adresse appartient a Clerk,
// la dupliquer creerait deux verites pour une personne.

const rows = async <T>(query: Promise<unknown>) => (await query) as T[];

export type AccessRequestStatus = "pending" | "approved" | "rejected";

export type AccessRequestRow = {
  request_id: string;
  full_name: string;
  email: string;
  school_name: string;
  teaches: string | null;
  message: string | null;
  status: AccessRequestStatus;
  created_at: string;
  decided_at: string | null;
  /** Combien d'autres demandes portent cette adresse, quel que soit leur etat. */
  same_email: number;
  /** L'etablissement deja connu qui porte ce nom, s'il existe. */
  matched_school_id: string | null;
  matched_school_name: string | null;
  /** Combien de classes cet etablissement tient deja. Un contexte, pas un critere. */
  matched_school_classes: number;
};

/**
 * Les demandes d'un etat, la plus recente d'abord, avec ce qu'il faut pour
 * decider sans ouvrir autre chose.
 *
 * Le rapprochement d'etablissement se fait sur le nom **normalise** : un
 * professeur ecrit rarement le nom de son ecole deux fois pareil, et proposer de
 * creer une deuxieme fois « Ecole de design » parce qu'il manque un accent est
 * exactement l'erreur que ce tableau doit eviter.
 */
export const accessRequests = (status: AccessRequestStatus) =>
  rows<AccessRequestRow>(sql`
    SELECT
      r.request_id::text,
      r.full_name,
      r.email,
      r.school_name,
      r.teaches,
      r.message,
      r.status::text AS status,
      r.created_at,
      r.decided_at,
      (
        SELECT count(*)::int FROM access_requests o
        WHERE lower(o.email) = lower(r.email) AND o.request_id <> r.request_id
      ) AS same_email,
      s.school_id::text AS matched_school_id,
      s.name AS matched_school_name,
      COALESCE((SELECT count(*)::int FROM classes c WHERE c.school_id = s.school_id), 0) AS matched_school_classes
    FROM access_requests r
    LEFT JOIN schools s
      ON lower(btrim(s.name)) = lower(btrim(r.school_name))
    WHERE r.status = ${status}::app.access_request_status_enum
    ORDER BY r.created_at DESC
  `);

/** Combien il y en a dans chaque colonne, pour les onglets. */
export const accessRequestCounts = async () => {
  const found = await rows<{ status: AccessRequestStatus; n: number }>(sql`
    SELECT status::text AS status, count(*)::int AS n
    FROM access_requests
    GROUP BY status
  `);
  return {
    pending: found.find((r) => r.status === "pending")?.n ?? 0,
    approved: found.find((r) => r.status === "approved")?.n ?? 0,
    rejected: found.find((r) => r.status === "rejected")?.n ?? 0,
  };
};

/**
 * Refuser. C'est la seule decision qui ne cree RIEN, donc la seule qui puisse
 * s'exercer avant que l'authentification soit branchee.
 *
 * Ne touche qu'une demande en attente : re-refuser une demande deja decidee
 * ecraserait une date de decision et la trace de qui a decide.
 */
export const rejectAccessRequest = async (
  requestId: string,
  decidedBy: string | null,
): Promise<"done" | "already_decided" | "unknown"> => {
  const done = await rows<{ request_id: string }>(sql`
    UPDATE access_requests
       SET status = 'rejected', decided_at = now(), decided_by = ${decidedBy}::uuid
     WHERE request_id = ${requestId}::uuid
       AND status = 'pending'
    RETURNING request_id::text
  `);
  if (done.length > 0) return "done";

  // DEUX ECHECS QUI NE SE RESSEMBLENT PAS, et les confondre ferait mentir
  // l'ecran : une demande qui n'existe pas n'a pas « deja ete decidee ».
  const found = await rows<{ request_id: string }>(sql`
    SELECT request_id::text FROM access_requests WHERE request_id = ${requestId}::uuid
  `);
  return found.length > 0 ? "already_decided" : "unknown";
};
