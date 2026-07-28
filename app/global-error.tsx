"use client";

import { useEffect } from "react";

import "./globals.css";
import { errorCopy } from "@/content/copy";
import ErrorScreen from "@/features/errors/components/ErrorScreen";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Last resort boundary: it replaces the root layout, so it is the only screen
 * left when `app/layout.tsx` itself throws (theme bootstrap, `UiDebugProbe`).
 * It therefore renders its own `html` / `body` and re-imports the stylesheet,
 * mirroring the root layout element for element. `data-theme="dark"` is the
 * same static default the layout ships; the bootstrap script cannot run here,
 * so `ThemeSwitch` is what restores a stored light preference on mount.
 * Home is a plain anchor on purpose: the app shell is broken, so a full
 * document load is safer than a client-side navigation.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="bg-background font-sans antialiased">
        <ErrorScreen
          titleId="global-error-title"
          kicker={errorCopy.kicker}
          title={errorCopy.title}
          description={errorCopy.description}
        >
          <button type="button" className="lp-btn lp-btn--primary" onClick={() => reset()}>
            {errorCopy.retryLabel}
          </button>
          {/* Plain anchor on purpose: the root layout is the thing that failed,
              so a full document load is the only reliable way back home. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="lp-btn lp-btn--ghost">
            {errorCopy.homeLabel}
          </a>
        </ErrorScreen>
      </body>
    </html>
  );
}
