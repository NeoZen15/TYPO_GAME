import type { ReactNode } from "react";

import ThemeSwitch from "@/components/ui/ThemeSwitch";

type ErrorScreenProps = {
  /** Id given to the heading, used as the section label. */
  titleId: string;
  /** Uppercase meta label (styled by `.error-kicker`). */
  kicker: string;
  title: string;
  description: string;
  /** Pill actions, rendered in `.error-actions` (use `.lp-btn` recipes). */
  children: ReactNode;
};

/**
 * Shared shell of the terminal message screens (404 + render errors).
 * Nothing visual is invented here: the layout, frame, kicker and action row
 * reuse the validated `/play/{mode}` placeholder recipes (globals.css groups
 * `.mode-placeholder-page` / `.mode-placeholder-shell` / `.mode-placeholder-kicker`
 * / `.mode-placeholder-actions`, which now also carry the `.error-*` names), the
 * canonical `.ui-page-title` / `.ui-page-subtitle` classes, and the landing
 * buttons `.lp-btn` passed in by the caller.
 */
export default function ErrorScreen({
  titleId,
  kicker,
  title,
  description,
  children,
}: ErrorScreenProps) {
  return (
    <main className="error-page">
      <ThemeSwitch />

      <section className="error-shell" aria-labelledby={titleId}>
        <p className="error-kicker">{kicker}</p>
        <h1 id={titleId} className="ui-page-title">
          {title}
        </h1>
        <p className="ui-page-subtitle">{description}</p>

        <div className="error-actions">{children}</div>
      </section>
    </main>
  );
}
