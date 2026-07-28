import Link from "next/link";

import { notFoundCopy } from "@/content/copy";
import ErrorScreen from "@/features/errors/components/ErrorScreen";

/**
 * Root 404 (unknown URL, or any `notFound()` call that is not caught closer).
 * Two ways out only: home (validated primary pill) and the modes page, the
 * same secondary destination the landing hero offers ("See the modes").
 */
export default function NotFound() {
  return (
    <ErrorScreen
      titleId="not-found-title"
      kicker={notFoundCopy.kicker}
      title={notFoundCopy.title}
      description={notFoundCopy.description}
    >
      <Link href="/" className="lp-btn lp-btn--primary">
        {notFoundCopy.homeLabel}
      </Link>
      <Link href="/play" className="lp-btn lp-btn--ghost">
        {notFoundCopy.modesLabel}
      </Link>
    </ErrorScreen>
  );
}
