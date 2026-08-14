import Image from "next/image";
import Link from "next/link";
import ThemeSwitch from "@/components/ui/ThemeSwitch";

export type SiteNavItem = {
  label: string;
  href: string;
  isActive?: boolean;
};

/**
 * The home header's menu, verbatim (see LandingExperience `NAV`). Sub-pages reuse
 * the SAME tools as the landing — links point at the home sections (`/#id`), and
 * the CTA is "Start training". Keeping this in one place means every typo page
 * (and the ~2000 `/type/[slug]` specimens) carries identical nav controls.
 */
const HOME_NAV_ITEMS: SiteNavItem[] = [
  { label: "How it works", href: "/#how" },
  { label: "Compare", href: "/#compare" },
  { label: "Typefaces", href: "/#typefaces" },
  // D4, 2026-08-15. Was `/#modes`, the landing's own section anchor. On the
  // landing that anchor is right, the section is a few screens down. Everywhere
  // else this nav is in service (every sub-page, every /type/[slug] specimen) it
  // meant the only entry named after the modes threw the player back to the home
  // page, and the rules of a mode were reachable from nowhere in the header. The
  // landing keeps the anchor through its own NAV array in LandingExperience, so
  // this default only changes the pages where it was misleading.
  { label: "Modes", href: "/play" },
];

type SiteNavProps = {
  /** Section links. Defaults to the home menu; override per page if needed. */
  items?: SiteNavItem[];
  /** Primary CTA (defaults to the home's "Start training" → onboarding). */
  ctaHref?: string;
  ctaLabel?: string;
};

/**
 * Shared cream-pill top nav — the validated DA (mirrors the landing `lp-header`).
 * Skin lives in `globals.css` under `.site-nav*`; only links/CTA vary per page.
 */
export default function SiteNav({
  items = HOME_NAV_ITEMS,
  ctaHref = "/onboarding",
  ctaLabel = "Start training",
}: SiteNavProps) {
  return (
    <header className="site-nav" aria-label="Primary navigation">
      <Link href="/" className="site-nav__brand" aria-label="Dwiggins home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="site-nav__figures"
          src="/brand/dwiggins-figures-dark.svg"
          alt=""
          aria-hidden="true"
          width={182}
          height={122}
        />
        <Image
          src="/brand/dwiggins-wordmark-full-black.svg"
          alt="Dwiggins"
          className="site-nav__brand-mark site-nav__brand-mark--full"
          width={1394}
          height={200}
        />
      </Link>

      <nav className="site-nav__links" aria-label="Site sections">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`site-nav__link ${item.isActive ? "is-active" : ""}`}
            aria-current={item.isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="site-nav__actions">
        <Link href={ctaHref} className="site-nav__cta">
          {ctaLabel}
        </Link>
        <ThemeSwitch />
      </div>
    </header>
  );
}
