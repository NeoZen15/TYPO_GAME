"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_GROUPS, ADMIN_HOME } from "@/features/admin/components/admin-nav";

// La barre de gauche, permanente. Elle ne se replie pas et ne se cache pas : un
// espace ou l'on navigue par la barre doit toujours montrer ou l'on est.
//
// Elle marque l'entree courante par le chemin exact, jamais par un prefixe : sans
// ca, `/admin` s'allumerait sur toutes les pages puisque toutes commencent par
// lui.
export default function AdminSidebar() {
  const pathname = usePathname();
  const isHere = (href: string) => pathname === href;

  return (
    <nav className="ad-side" aria-label="Administration">
      <Link href={ADMIN_HOME.href} className={`ad-side__link ad-side__link--home${isHere(ADMIN_HOME.href) ? " is-here" : ""}`}>
        {ADMIN_HOME.label}
      </Link>

      {ADMIN_GROUPS.map((group) => (
        <div key={group.title} className="ad-side__group">
          <span className="ad-side__title">{group.title}</span>
          {group.entries.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className={`ad-side__link${isHere(entry.href) ? " is-here" : ""}`}
              aria-current={isHere(entry.href) ? "page" : undefined}
            >
              {entry.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
