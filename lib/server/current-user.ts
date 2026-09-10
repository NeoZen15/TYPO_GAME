import "server-only";

import { cookies } from "next/headers";

import { sql } from "@/lib/server/neon";

// QUI DEMANDE. Un seul endroit dans tout le produit répond à cette question, et
// c'est ce fichier.
//
// POURQUOI IL DOIT RESTER SEUL. Aujourd'hui l'identité est un cookie, demain elle
// sera une session d'authentification, et le jour de la bascule il ne faut pas
// avoir à retrouver les endroits qui lisaient le cookie « en attendant ». Ils
// existaient déjà : quatre lectures directes s'étaient ajoutées, dont trois de ma
// main le 2026-09-10, et deux d'elles avaient perdu la validation du format en
// chemin. `check:identity-gate` empêche la cinquième.
//
// LE COOKIE EST LU ICI, ET POSÉ AILLEURS. Les deux routes de démarrage de partie
// créent l'invité, donc elles écrivent le cookie ; elles en importent le nom
// plutôt que de le réécrire, pour qu'un renommage reste une seule ligne.
export const GUEST_COOKIE_NAME = "jdt_guest_user_id";

const GUEST_USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Resolve the current player's id from the guest cookie, or null if none/invalid
// (a fresh visitor who has never played). Server-only.
export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(GUEST_COOKIE_NAME)?.value ?? null;
  return value && GUEST_USER_ID_PATTERN.test(value) ? value : null;
}

/**
 * Le rôle de la personne qui demande, et son appartenance enseignante.
 *
 * DEUX QUESTIONS DIFFÉRENTES, et c'est le point. `role` dit ce qu'est le compte
 * dans le produit (invité, joueur, administrateur). `isTeacher` dit s'il tient
 * des classes, et cela ne se déduit pas du rôle : un enseignant est un joueur qui
 * appartient à un établissement, donc la réponse vit dans `school_members` et
 * nulle part ailleurs. C'est ce que la porte de lecture professeur exigera pour
 * savoir de qui elle lit les assignations.
 *
 * INVITÉ VEUT DIRE INVITÉ. Le schéma l'impose déjà : un rôle `player` ou `admin`
 * réclame un identifiant d'authentification, donc tant que l'authentification
 * n'est pas branchée, tout le monde est invité et `isTeacher` est faux pour tout
 * le monde. Cette fonction dira la vérité le jour où les comptes existent, sans
 * qu'aucun appelant change.
 */
export async function getCurrentIdentity(): Promise<{
  userId: string | null;
  role: "guest" | "player" | "admin";
  isGuest: boolean;
  isTeacher: boolean;
}> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { userId: null, role: "guest", isGuest: true, isTeacher: false };
  }

  const rows = (await sql`
    SELECT
      u.role::text AS role,
      EXISTS (SELECT 1 FROM school_members m WHERE m.user_id = u.user_id) AS is_teacher
    FROM users u
    WHERE u.user_id = ${userId}::uuid
    LIMIT 1
  `) as { role: "guest" | "player" | "admin"; is_teacher: boolean }[];

  const found = rows[0];
  if (!found) {
    // Un cookie qui nomme un compte disparu n'est pas une identité.
    return { userId: null, role: "guest", isGuest: true, isTeacher: false };
  }

  return {
    userId,
    role: found.role,
    isGuest: found.role === "guest",
    isTeacher: found.is_teacher,
  };
}
