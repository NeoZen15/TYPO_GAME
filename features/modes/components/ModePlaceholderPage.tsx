import Link from "next/link";
import Image from "next/image";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import StarField from "@/features/profile/components/StarField";

type ModePlaceholderPageProps = {
  modeLabel: string;
  description: string;
};

// Same move as /play and the rules pages: inside the profile's token contract
// rather than beside it. One panel, because there is exactly one thing to say.
export default function ModePlaceholderPage({
  modeLabel,
  description,
}: ModePlaceholderPageProps) {
  return (
    <main className="pf-page">
      <header className="pf-top">
        <Link href="/" className="pf-top__brand" aria-label="Dwiggins — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pf-top__figures"
            src="/brand/dwiggins-figures-dark.svg"
            alt=""
            aria-hidden="true"
            width={673}
            height={487}
          />
          <Image
            src="/brand/dwiggins-wordmark-full-black.svg"
            alt="Dwiggins"
            className="pf-top__logo"
            width={812}
            height={200}
            priority
          />
        </Link>

        <div className="pf-top__actions">
          <Link href="/play" className="pf-top__cta">
            Modes
          </Link>
          <ThemeSwitch />
        </div>
      </header>

      <div className="pb">
        <div className="pb-bg" aria-hidden="true">
          <StarField />
        </div>

        <header className="pb-intro pb-sec">
          <span className="pb-kicker">{modeLabel}</span>
          <h1 className="pb-title">Being prepared.</h1>
          <p className="pb-lede">{description}</p>
        </header>

        <section className="pb-panels" aria-label={`${modeLabel} status`}>
          <article className="pb-panel pb-sec" style={{ "--pb-stagger": "60ms" } as React.CSSProperties}>
            <h2 className="pb-panel__label">What you can do today</h2>
            <ul className="pb-list">
              <li>Training and Competition are the two modes you can play now.</li>
              <li>The rules of this mode are already written, if you want to read ahead.</li>
            </ul>
          </article>
        </section>

        <div className="pb-actions pb-sec">
          <Link href="/play" className="lp-btn lp-btn--primary">
            Back to modes
          </Link>
          <Link href="/play/expert/rules" className="lp-btn lp-btn--ghost">
            Read the rules
          </Link>
        </div>
      </div>
    </main>
  );
}
