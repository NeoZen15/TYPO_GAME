"use client";

import { useEffect, useRef } from "react";
import StarField from "@/features/profile/components/StarField";
import type { EyeProfile, PlayerProfile } from "@/lib/profile/mock-profile";

// ---------------------------------------------------------------------------
// Activity — consistency (profile-tabs-spec §4): streak + record, a ~30-day
// heatmap calendar, today's goal, recent sessions. Same map DA (cream-on-black,
// mono labels, fixed starfield). The streak is the durable eye layer (math §5.6).
// ---------------------------------------------------------------------------

const CREAM = "from var(--pf-cream) r g b"; // theme-adaptive ink (flips beige<->warm-noir)
const MODE_ACCENT: Record<string, string> = {
  training: "#40d38f",
  competition: "#ff934a",
  expert: "#58a9ff",
};

// Relative to the busiest day in the window, not an absolute count: activity
// is now counted in answers, whose scale varies far more than the old
// sessions-per-day count did. 0 → faint; otherwise a third of the max → low,
// two thirds → mid, above → high. Monochrome (cream only).
function heatLevel(v: number, max: number): 0 | 1 | 2 | 3 {
  if (v <= 0 || max <= 0) return 0;
  const ratio = v / max;
  if (ratio <= 1 / 3) return 1;
  if (ratio <= 2 / 3) return 2;
  return 3;
}

export default function ActivityBoard({
  profile,
  eye,
}: {
  profile: PlayerProfile;
  eye: EyeProfile;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  const act = profile.activity;
  const days = act.length;
  const answers = act.reduce((s, v) => s + v, 0);
  const activeDays = act.filter((v) => v > 0).length;
  const maxActivity = Math.max(0, ...act);
  const goal = eye.dailyGoal;
  const goalDots = Array.from({ length: Math.max(goal.target, goal.done) });

  return (
    <div ref={rootRef} className="ac">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="ac-bg" aria-hidden="true">
        <StarField />
      </div>

      <header className="ac-intro ac-sec">
        <span className="ac-kicker">Your rhythm</span>
        <h2 className="ac-title">Show up. Keep the streak.</h2>
        <p className="ac-lede">A little, often. The eye sharpens with regularity — not cramming.</p>
      </header>

      {/* ── Streak + goal cards ── */}
      <section className="ac-cards ac-sec" aria-label="Streak and goal">
        <div className="ac-card ac-card--hero">
          <span className="ac-card__big">{eye.streak}</span>
          <span className="ac-card__label">Day streak</span>
          <span className="ac-card__helper">going right now</span>
        </div>
        <div className="ac-card">
          <span className="ac-card__big">{eye.streakRecord}</span>
          <span className="ac-card__label">Best streak</span>
          <span className="ac-card__helper">your record, in days</span>
        </div>
        <div className="ac-card ac-card--goal">
          <span className="ac-card__label">Today&rsquo;s goal</span>
          <div className="ac-goal" role="img" aria-label={`${goal.done} of ${goal.target} done today`}>
            {goalDots.map((_, i) => (
              <span key={i} className={`ac-goal__dot${i < goal.done ? " is-done" : ""}`} />
            ))}
          </div>
          <span className="ac-card__helper">
            <em>{goal.done}</em> / {goal.target} good answers
          </span>
        </div>
      </section>

      {/* ── Heatmap calendar ── */}
      <section className="ac-panel ac-sec" aria-label={`Last ${days} days`}>
        <div className="ac-panel__head">
          <h3 className="ac-panel__title">Last {days} days</h3>
          <span className="ac-panel__meta"><em>{answers}</em> answers · <em>{activeDays}</em> active days</span>
        </div>
        <div className="ac-heat" role="img" aria-label={`${activeDays} active days out of ${days}`}>
          {act.map((v, i) => (
            <span key={i} className={`ac-heat__cell ac-heat__cell--l${heatLevel(v, maxActivity)}`} style={{ transitionDelay: `${Math.min(i * 14, 420)}ms` }} title={`${v} answer${v === 1 ? "" : "s"}`} />
          ))}
        </div>
        <div className="ac-heat__legend">
          <span>less</span>
          <span className="ac-heat__cell ac-heat__cell--l0" />
          <span className="ac-heat__cell ac-heat__cell--l1" />
          <span className="ac-heat__cell ac-heat__cell--l2" />
          <span className="ac-heat__cell ac-heat__cell--l3" />
          <span>more</span>
        </div>
      </section>

      {/* ── Recent sessions ── */}
      <section className="ac-panel ac-sec" aria-label="Recent sessions">
        <h3 className="ac-panel__title">Recent sessions</h3>
        <ul className="ac-sessions">
          {profile.recentSessions.map((s) => (
            <li key={s.id} className="ac-session">
              <span
                className="ac-session__mode"
                style={{
                  borderColor: `color-mix(in srgb, ${MODE_ACCENT[s.mode] ?? "var(--pf-cream)"} 45%, transparent)`,
                  color: `color-mix(in srgb, ${MODE_ACCENT[s.mode] ?? "var(--pf-cream)"} 62%, var(--pf-cream))`,
                }}
              >
                {s.modeLabel}
              </span>
              <span className="ac-session__detail">{s.detail}</span>
              <span className="ac-session__acc">{s.accuracy}%</span>
              <span className="ac-session__when">{s.when}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const CSS = `
  .ac {
    position: relative; isolation: isolate; width: 100%;
    display: grid; gap: clamp(1.1rem, 3vh, 2rem);
    padding: clamp(1.2rem, 3vw, 2.2rem) clamp(1rem, 4vw, 3rem) clamp(3rem, 8vh, 6rem);
  }
  .ac-bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
  .ac-bg .dw-stars { position: absolute; inset: 0; width: 100%; height: 100%; }

  .ac.is-armed .ac-sec { opacity: 0; transform: translateY(16px); }
  .ac.is-armed.is-in .ac-sec { opacity: 1; transform: none; transition: opacity 600ms ease, transform 700ms cubic-bezier(0.22, 1, 0.36, 1); }

  .ac-intro { text-align: center; display: grid; gap: 0.45rem; justify-items: center; max-width: 52rem; margin: 0 auto; }
  .ac-kicker { font-family: var(--pf-mono); font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .ac-title { margin: 0; font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 640; letter-spacing: -0.04em; line-height: 1.02; color: var(--pf-cream); }
  .ac-lede { margin: 0; max-width: 46ch; font-size: 0.86rem; line-height: 1.5; color: rgb(${CREAM} / 0.6); }

  /* Cards */
  .ac-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(0.6rem, 1.6vw, 1rem); width: min(98%, 60rem); margin: 0 auto; }
  @media (max-width: 640px) { .ac-cards { grid-template-columns: 1fr; } }
  .ac-card {
    display: grid; gap: 0.3rem; align-content: center; padding: clamp(1.1rem, 2.4vw, 1.5rem);
    border: 1px solid rgb(${CREAM} / 0.1); border-radius: 0.9rem;
    background: color-mix(in srgb, var(--pf-bg) 90%, transparent);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  }
  .ac-card--hero { border-color: rgb(${CREAM} / 0.2); }
  .ac-card__big { font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 680; line-height: 1; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .ac-card__label { font-family: var(--pf-mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgb(${CREAM} / 0.7); }
  .ac-card__helper { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.03em; color: rgb(${CREAM} / 0.4); }
  .ac-card__helper em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .ac-card--goal { gap: 0.5rem; }
  .ac-goal { display: flex; gap: 0.4rem; }
  .ac-goal__dot { width: 0.85rem; height: 0.85rem; border-radius: 999px; border: 1px solid rgb(${CREAM} / 0.28); background: rgb(${CREAM} / 0.05); }
  .ac-goal__dot.is-done { background: var(--pf-cream); border-color: var(--pf-cream); }

  /* Panel */
  .ac-panel {
    width: min(98%, 60rem); margin: 0 auto;
    padding: clamp(1rem, 2.4vw, 1.5rem);
    border: 1px solid rgb(${CREAM} / 0.1); border-radius: 0.9rem;
    background: color-mix(in srgb, var(--pf-bg) 90%, transparent);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  }
  .ac-panel__head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .ac-panel__title { margin: 0 0 1rem; font-family: var(--pf-mono); font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgb(${CREAM} / 0.58); }
  .ac-panel__head .ac-panel__title { margin: 0; }
  .ac-panel__meta { font-family: var(--pf-mono); font-size: 0.64rem; color: rgb(${CREAM} / 0.42); font-variant-numeric: tabular-nums; }
  .ac-panel__meta em { font-style: normal; font-weight: 640; color: var(--pf-cream); }

  /* Heatmap */
  .ac-heat { display: grid; grid-template-columns: repeat(15, 1fr); gap: clamp(0.3rem, 0.8vw, 0.5rem); }
  @media (max-width: 720px) { .ac-heat { grid-template-columns: repeat(10, 1fr); } }
  @media (max-width: 420px) { .ac-heat { grid-template-columns: repeat(7, 1fr); } }
  .ac-heat__cell { aspect-ratio: 1; border-radius: 0.28rem; background: rgb(${CREAM} / 0.05); border: 1px solid rgb(${CREAM} / 0.08); }
  .ac-heat__cell--l0 { background: rgb(${CREAM} / 0.05); }
  .ac-heat__cell--l1 { background: rgb(${CREAM} / 0.22); }
  .ac-heat__cell--l2 { background: rgb(${CREAM} / 0.5); }
  .ac-heat__cell--l3 { background: rgb(${CREAM} / 0.85); border-color: rgb(${CREAM} / 0.4); }
  .ac.is-armed .ac-heat__cell { opacity: 0; transform: scale(0.6); }
  .ac.is-armed.is-in .ac-heat__cell { opacity: 1; transform: none; transition: opacity 380ms ease, transform 420ms cubic-bezier(0.22, 1, 0.36, 1); }
  .ac-heat__legend { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.9rem; font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.06em; text-transform: uppercase; color: rgb(${CREAM} / 0.4); }
  .ac-heat__legend .ac-heat__cell { width: 0.8rem; height: 0.8rem; aspect-ratio: auto; }

  /* Sessions (same pattern as the Stats tab) */
  .ac-sessions { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
  .ac-session { display: grid; grid-template-columns: 8rem 1fr auto auto; align-items: center; gap: 0.9rem; padding: 0.65rem 0; border-top: 1px solid rgb(${CREAM} / 0.08); }
  .ac-session:first-child { border-top: none; }
  .ac-session__mode { justify-self: start; font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.12em; text-transform: uppercase; padding: 0.18rem 0.5rem; border: 1px solid rgb(${CREAM} / 0.2); border-radius: 999px; color: rgb(${CREAM} / 0.7); }
  .ac-session__detail { font-size: 0.82rem; color: rgb(${CREAM} / 0.82); }
  .ac-session__acc { font-family: var(--pf-mono); font-size: 0.8rem; font-weight: 640; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .ac-session__when { font-family: var(--pf-mono); font-size: 0.64rem; color: rgb(${CREAM} / 0.42); text-align: right; min-width: 5rem; }
  @media (max-width: 560px) {
    .ac-session { grid-template-columns: 1fr auto; row-gap: 0.2rem; }
    .ac-session__detail { grid-column: 1 / -1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ac.is-armed.is-in .ac-sec, .ac.is-armed.is-in .ac-heat__cell { transition: none; }
  }
`;
