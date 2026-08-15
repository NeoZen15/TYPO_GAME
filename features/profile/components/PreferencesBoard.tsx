"use client";

import { useEffect, useRef, useState } from "react";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import StarField from "@/features/profile/components/StarField";
import type { EyeProfile, PlayerProfile } from "@/lib/profile/mock-profile";

// ---------------------------------------------------------------------------
// Preferences — settings (profile-tabs-spec §6). Kept light for the test.
// Theme reuses the existing ThemeSwitch. Reduced motion is KEY here given the
// galaxy animations (§9 handoff) — persisted locally. Language + daily goal are
// local UI state for now (no backend yet); account actions await auth.
// ---------------------------------------------------------------------------

const CREAM = "from var(--pf-cream) r g b"; // theme-adaptive ink (flips beige<->warm-noir)
const RM_KEY = "jdt-reduced-motion";
const LANG_KEY = "jdt-lang";

export default function PreferencesBoard({
  profile,
  eye,
}: {
  profile: PlayerProfile;
  eye: EyeProfile;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Locally-persisted prefs — read lazily (SSR-safe), like ThemeSwitch.
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(RM_KEY) === "1";
  });
  const [lang, setLang] = useState<"en" | "fr">(() => {
    if (typeof window === "undefined") return "en";
    return window.localStorage.getItem(LANG_KEY) === "fr" ? "fr" : "en";
  });
  const [goal, setGoal] = useState(eye.dailyGoal.target);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("is-armed");
    const reveal = () => root.classList.add("is-in");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    io.observe(root);
    const fallback = window.setTimeout(reveal, 2200);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  const toggleReducedMotion = () => {
    setReducedMotion((prev) => {
      const next = !prev;
      window.localStorage.setItem(RM_KEY, next ? "1" : "0");
      return next;
    });
  };

  const pickLang = (l: "en" | "fr") => {
    setLang(l);
    window.localStorage.setItem(LANG_KEY, l);
  };

  return (
    <div ref={rootRef} className="pr">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="pr-bg" aria-hidden="true">
        <StarField />
      </div>

      <header className="pr-intro pr-sec">
        <span className="pr-kicker">Your settings</span>
        <h1 className="pr-title">Make it yours.</h1>
        <p className="pr-lede">A few knobs. The defaults are sensible — tune what you need.</p>
      </header>

      {/* ── Appearance ── */}
      <section className="pr-panel pr-sec" aria-label="Appearance">
        <h3 className="pr-panel__title">Appearance</h3>
        <div className="pr-row">
          <div className="pr-row__text">
            <span className="pr-row__label">Theme</span>
            <span className="pr-row__help">Dark is the home of the map. Light flips the canvas.</span>
          </div>
          <ThemeSwitch />
        </div>
        <div className="pr-row">
          <div className="pr-row__text">
            <span className="pr-row__label">Reduced motion</span>
            <span className="pr-row__help">Calms the galaxy animations. Content stays fully visible.</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reducedMotion}
            aria-label="Reduced motion"
            className={`pr-switch${reducedMotion ? " is-on" : ""}`}
            onClick={toggleReducedMotion}
          >
            <span className="pr-switch__thumb" />
          </button>
        </div>
      </section>

      {/* ── Training ── */}
      <section className="pr-panel pr-sec" aria-label="Training">
        <h3 className="pr-panel__title">Training</h3>
        <div className="pr-row">
          <div className="pr-row__text">
            <span className="pr-row__label">Daily goal</span>
            <span className="pr-row__help">Good answers to log each day to keep your streak.</span>
          </div>
          <div className="pr-stepper" role="group" aria-label="Daily goal target">
            <button type="button" className="pr-stepper__btn" aria-label="Lower goal" disabled={goal <= 1} onClick={() => setGoal((g) => Math.max(1, g - 1))}>−</button>
            <span className="pr-stepper__val">{goal}</span>
            <button type="button" className="pr-stepper__btn" aria-label="Raise goal" disabled={goal >= 10} onClick={() => setGoal((g) => Math.min(10, g + 1))}>+</button>
          </div>
        </div>
        <div className="pr-row">
          <div className="pr-row__text">
            <span className="pr-row__label">Language</span>
            <span className="pr-row__help">Interface language.</span>
          </div>
          <div className="pr-seg" role="group" aria-label="Language">
            <button type="button" className={`pr-seg__btn${lang === "en" ? " is-active" : ""}`} aria-pressed={lang === "en"} onClick={() => pickLang("en")}>EN</button>
            <button type="button" className={`pr-seg__btn${lang === "fr" ? " is-active" : ""}`} aria-pressed={lang === "fr"} onClick={() => pickLang("fr")}>FR</button>
          </div>
        </div>
      </section>

      {/* ── Account ── */}
      <section className="pr-panel pr-sec" aria-label="Account">
        <div className="pr-panel__head">
          <h3 className="pr-panel__title">Account</h3>
          <span className="pr-soon">No sign-in yet</span>
        </div>
        <div className="pr-row">
          <div className="pr-account">
            <span className="pr-account__avatar" aria-hidden="true">{profile.initials}</span>
            <span className="pr-account__who">
              <span className="pr-account__name">{profile.name}</span>
              <span className="pr-account__handle">{profile.handle} · {profile.memberSince}</span>
            </span>
          </div>
        </div>
        <div className="pr-row pr-row--actions">
          <button type="button" className="pr-action" disabled>Export my data</button>
          <button type="button" className="pr-action" disabled>Sign out</button>
        </div>
      </section>
    </div>
  );
}

const CSS = `
  .pr {
    position: relative; isolation: isolate; width: 100%;
    display: grid; gap: clamp(1.1rem, 3vh, 2rem);
    padding: clamp(1.2rem, 3vw, 2.2rem) clamp(1rem, 4vw, 3rem) clamp(3rem, 8vh, 6rem);
  }
  .pr-bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
  .pr-bg .dw-stars { position: absolute; inset: 0; width: 100%; height: 100%; }

  .pr.is-armed .pr-sec { opacity: 0; transform: translateY(16px); }
  .pr.is-armed.is-in .pr-sec { opacity: 1; transform: none; transition: opacity 600ms ease, transform 700ms cubic-bezier(0.22, 1, 0.36, 1); }

  .pr-intro { text-align: center; display: grid; gap: 0.45rem; justify-items: center; max-width: 52rem; margin: 0 auto; }
  .pr-kicker { font-family: var(--pf-mono); font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .pr-title { margin: 0; font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 640; letter-spacing: -0.04em; line-height: 1.02; color: var(--pf-cream); }
  .pr-lede { margin: 0; max-width: 44ch; font-size: 0.86rem; line-height: 1.5; color: rgb(${CREAM} / 0.6); }

  .pr-panel {
    width: min(98%, 46rem); margin: 0 auto;
    padding: clamp(1rem, 2.4vw, 1.5rem) clamp(1.1rem, 2.6vw, 1.6rem);
    border: 1px solid rgb(${CREAM} / 0.1); border-radius: var(--radius);
    background: color-mix(in srgb, var(--pf-bg) 90%, transparent);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  }
  .pr-panel__head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem; }
  .pr-panel__title { margin: 0 0 0.6rem; font-family: var(--pf-mono); font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgb(${CREAM} / 0.58); }
  .pr-panel__head .pr-panel__title { margin: 0; }
  .pr-soon { font-family: var(--pf-mono); font-size: 0.52rem; letter-spacing: 0.12em; text-transform: uppercase; padding: 0.14rem 0.5rem; border-radius: var(--radius-pill); border: 1px dashed rgb(${CREAM} / 0.22); color: rgb(${CREAM} / 0.42); }

  .pr-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.8rem 0; border-top: 1px solid rgb(${CREAM} / 0.08); }
  .pr-row:first-of-type { border-top: none; }
  .pr-row__text { display: grid; gap: 0.18rem; min-width: 0; }
  .pr-row__label { font-size: 0.88rem; font-weight: 560; color: var(--pf-cream); }
  .pr-row__help { font-family: var(--pf-mono); font-size: 0.6rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.42); }

  /* The theme switch reads on the dark surface (default styles) */
  .pr-row .theme-switch { position: static; top: auto; right: auto; flex: none; }

  /* Toggle switch */
  .pr-switch { flex: none; appearance: none; cursor: pointer; width: 2.6rem; height: 1.5rem; border-radius: var(--radius-pill); border: 1px solid rgb(${CREAM} / 0.22); background: rgb(${CREAM} / 0.08); padding: 0; position: relative; transition: background-color 180ms ease, border-color 180ms ease; }
  .pr-switch__thumb { position: absolute; top: 50%; left: 0.18rem; transform: translateY(-50%); width: 1.05rem; height: 1.05rem; border-radius: var(--radius-pill); background: rgb(${CREAM} / 0.7); transition: left 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms ease; }
  .pr-switch.is-on { background: rgb(${CREAM} / 0.85); border-color: var(--pf-cream); }
  .pr-switch.is-on .pr-switch__thumb { left: calc(100% - 1.23rem); background: var(--pf-bg); }

  /* Stepper */
  .pr-stepper { flex: none; display: inline-flex; align-items: center; gap: 0.2rem; border: 1px solid rgb(${CREAM} / 0.18); border-radius: var(--radius-pill); padding: 0.16rem; }
  .pr-stepper__btn { appearance: none; cursor: pointer; width: 1.7rem; height: 1.7rem; border-radius: var(--radius-pill); border: none; background: transparent; color: var(--pf-cream); font-size: 1.1rem; line-height: 1; display: grid; place-items: center; transition: background-color 140ms ease; }
  .pr-stepper__btn:hover:not(:disabled) { background: rgb(${CREAM} / 0.1); }
  .pr-stepper__btn:disabled { color: rgb(${CREAM} / 0.25); cursor: not-allowed; }
  .pr-stepper__val { min-width: 1.6rem; text-align: center; font-family: var(--pf-mono); font-size: 0.92rem; font-weight: 640; color: var(--pf-cream); font-variant-numeric: tabular-nums; }

  /* Segmented (language) */
  .pr-seg { flex: none; display: inline-flex; border: 1px solid rgb(${CREAM} / 0.18); border-radius: var(--radius-pill); padding: 0.16rem; gap: 0.1rem; }
  .pr-seg__btn { appearance: none; cursor: pointer; border: none; background: transparent; color: rgb(${CREAM} / 0.55); font-family: var(--pf-mono); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.08em; padding: 0.28rem 0.7rem; border-radius: var(--radius-pill); transition: background-color 140ms ease, color 140ms ease; }
  .pr-seg__btn.is-active { background: rgb(${CREAM} / 0.12); color: var(--pf-cream); }

  /* Account */
  .pr-account { display: flex; align-items: center; gap: 0.8rem; }
  .pr-account__avatar { display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border-radius: var(--radius-pill); border: 1px solid rgb(${CREAM} / 0.22); background: rgb(${CREAM} / 0.05); font-size: 0.9rem; font-weight: 600; color: var(--pf-cream); }
  .pr-account__who { display: grid; gap: 0.1rem; }
  .pr-account__name { font-size: 0.92rem; font-weight: 560; color: var(--pf-cream); }
  .pr-account__handle { font-family: var(--pf-mono); font-size: 0.6rem; color: rgb(${CREAM} / 0.42); }
  .pr-row--actions { justify-content: flex-start; gap: 0.7rem; flex-wrap: wrap; }
  .pr-action { appearance: none; font-family: var(--pf-mono); font-size: 0.64rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.5rem 0.9rem; border-radius: var(--radius-pill); border: 1px solid rgb(${CREAM} / 0.18); background: rgb(${CREAM} / 0.04); color: rgb(${CREAM} / 0.45); cursor: not-allowed; }

  @media (max-width: 460px) {
    .pr-row { flex-wrap: wrap; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pr.is-armed.is-in .pr-sec { transition: none; }
    .pr-switch, .pr-switch__thumb { transition: none; }
  }
`;
