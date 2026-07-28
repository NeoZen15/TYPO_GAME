"use client";

import Link from "next/link";
import { useEffect } from "react";

import { errorCopy } from "@/content/copy";
import ErrorScreen from "@/features/errors/components/ErrorScreen";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  /** Next re-renders the failed segment when this is called. */
  reset: () => void;
};

/**
 * Error boundary for every route under the root layout: a render throw inside
 * a page or a client component lands here instead of the raw Next screen.
 * The digest stays out of the UI (server-side log only) and goes to the console.
 */
export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <ErrorScreen
      titleId="error-title"
      kicker={errorCopy.kicker}
      title={errorCopy.title}
      description={errorCopy.description}
    >
      <button type="button" className="lp-btn lp-btn--primary" onClick={() => reset()}>
        {errorCopy.retryLabel}
      </button>
      <Link href="/" className="lp-btn lp-btn--ghost">
        {errorCopy.homeLabel}
      </Link>
    </ErrorScreen>
  );
}
