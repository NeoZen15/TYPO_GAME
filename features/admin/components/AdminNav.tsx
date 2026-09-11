import Link from "next/link";

// La barre de l'administration. Deux entrées aujourd'hui, et la liste des vues à
// venir vit dans la documentation, pas dans une barre pleine de liens morts.
export default function AdminNav({ active }: { active: "health" | "access" }) {
  return (
    <nav className="st-filter ad-nav" aria-label="Administration">
      <Link href="/admin" className={`st-filter__btn${active === "health" ? " is-active" : ""}`}>
        Santé du produit
      </Link>
      <Link href="/admin/access" className={`st-filter__btn${active === "access" ? " is-active" : ""}`}>
        Demandes d&apos;accès
      </Link>
    </nav>
  );
}
