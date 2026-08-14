"use client";

import { useEffect, useRef } from "react";
import StarField from "@/features/profile/components/StarField";
import { DwigginsBadge, DwigginsBadgeDefs } from "@/components/brand/DwigginsBadge";
import type { Art, Badge } from "@/lib/brand/dwiggins-badge-engine";
import type { PlayerProfile, ProfileBadge } from "@/lib/profile/mock-profile";
import { badgeRule, type BadgeRule } from "@/lib/profile/badge-rules";

// ---------------------------------------------------------------------------
// Achievements — badges (profile-tabs-spec §5). They render with the REAL
// Dwiggins badge engine (the /dev/badges system, reused here): rarity carried
// by the finish (ivory → blue → silver → gold → holo). Family + finish + the
// unlock threshold all come from `BADGE_RULES` (lib/profile/badge-rules.ts) —
// the single source of truth. Earned/progress state rides on `profile.badges`,
// swap-API later.
// ---------------------------------------------------------------------------

const CREAM = "from var(--pf-cream) r g b"; // theme-adaptive ink (flips beige<->warm-noir)

const FALLBACK_ART: BadgeRule["art"] = { tier: "common", shape: "circle", layout: "symbol" };

function badgeSpec(b: ProfileBadge): Badge {
  const a = badgeRule(b.key)?.art ?? FALLBACK_ART;
  return { name: b.label, tier: a.tier, shape: a.shape, layout: a.layout, glyph: a.glyph };
}

export default function AchievementsBoard({
  profile,
  art,
}: {
  profile: PlayerProfile;
  art: Art;
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

  const badges = profile.badges;
  const earned = badges.filter((b) => b.earned).length;

  return (
    <div ref={rootRef} className="av">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <DwigginsBadgeDefs />

      <div className="av-bg" aria-hidden="true">
        <StarField />
      </div>

      <header className="av-intro av-sec">
        <span className="av-kicker">Your collection</span>
        <h2 className="av-title">Stickers for a sharper eye.</h2>
        <p className="av-lede">
          Each badge marks a real milestone — the rarer the finish, the harder it was to earn.
          <span className="av-count"> <em>{earned}</em> of {badges.length} unlocked.</span>
        </p>
      </header>

      <section className="av-grid av-sec" aria-label="Badges">
        {badges.map((b, i) => {
          const family = badgeRule(b.key)?.family;
          const pct = b.progress ? Math.round((b.progress.current / b.progress.total) * 100) : 0;
          return (
            <article key={b.key} className={`av-badge${b.earned ? " is-earned" : " is-locked"}`}>
              <div className="av-badge__art">
                <DwigginsBadge badge={badgeSpec(b)} art={art} idx={i + 1} title={b.label} />
              </div>
              <div className="av-badge__meta">
                <div className="av-badge__top">
                  <h3 className="av-badge__label">{b.label}</h3>
                  {family && <span className="av-badge__family">{family}</span>}
                </div>
                <p className="av-badge__hint">{b.hint}</p>
                {b.earned ? (
                  <span className="av-badge__state av-badge__state--earned">
                    <span aria-hidden="true">✦</span> Unlocked
                  </span>
                ) : b.progress ? (
                  <div className="av-badge__progress">
                    <span className="av-bar">
                      <span className="av-bar__fill" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="av-badge__frac">
                      <em>{b.progress.current}</em> / {b.progress.total}
                    </span>
                  </div>
                ) : (
                  <span className="av-badge__state">Locked</span>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <p className="av-foot av-sec">
        Badges unlock on real scoring events — first palier lit, the eight axes complete, streaks,
        fast answers, faces explored. More on the way.
      </p>
    </div>
  );
}

const CSS = `
  .av {
    position: relative; isolation: isolate; width: 100%;
    display: grid; gap: clamp(1.1rem, 3vh, 2rem);
    padding: clamp(1.2rem, 3vw, 2.2rem) clamp(1rem, 4vw, 3rem) clamp(3rem, 8vh, 6rem);
  }
  .av-bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
  .av-bg .dw-stars { position: absolute; inset: 0; width: 100%; height: 100%; }

  .av.is-armed .av-sec { opacity: 0; transform: translateY(16px); }
  .av.is-armed.is-in .av-sec { opacity: 1; transform: none; transition: opacity 600ms ease, transform 700ms cubic-bezier(0.22, 1, 0.36, 1); }

  .av-intro { text-align: center; display: grid; gap: 0.45rem; justify-items: center; max-width: 52rem; margin: 0 auto; }
  .av-kicker { font-family: var(--pf-mono); font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .av-title { margin: 0; font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 640; letter-spacing: -0.04em; line-height: 1.02; color: var(--pf-cream); }
  .av-lede { margin: 0; max-width: 50ch; font-size: 0.86rem; line-height: 1.5; color: rgb(${CREAM} / 0.6); }
  .av-count em { font-style: normal; font-weight: 660; color: var(--pf-cream); }

  .av-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(0.7rem, 1.8vw, 1.2rem); width: min(98%, 60rem); margin: 0 auto; }
  @media (max-width: 760px) { .av-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 460px) { .av-grid { grid-template-columns: 1fr; } }

  .av-badge {
    display: grid; grid-template-columns: clamp(3.6rem, 9vw, 4.6rem) 1fr; gap: 0.9rem; align-items: center;
    padding: clamp(0.9rem, 2vw, 1.2rem);
    border: 1px solid rgb(${CREAM} / 0.1); border-radius: var(--radius);
    background: color-mix(in srgb, var(--pf-bg) 90%, transparent);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  }
  .av-badge.is-earned { border-color: rgb(${CREAM} / 0.2); }
  .av-badge__art { display: grid; place-items: center; }
  .av-badge__art svg { width: 100%; height: auto; }
  .av-badge.is-locked .av-badge__art { filter: grayscale(1) brightness(0.6); opacity: 0.55; }

  .av-badge__meta { display: grid; gap: 0.32rem; min-width: 0; }
  .av-badge__top { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
  .av-badge__label { margin: 0; font-size: 0.92rem; font-weight: 620; letter-spacing: -0.01em; color: var(--pf-cream); }
  .av-badge.is-locked .av-badge__label { color: rgb(${CREAM} / 0.7); }
  .av-badge__family { flex: none; font-family: var(--pf-mono); font-size: 0.5rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.12rem 0.45rem; border-radius: var(--radius-pill); border: 1px solid rgb(${CREAM} / 0.18); color: rgb(${CREAM} / 0.5); }
  .av-badge__hint { margin: 0; font-size: 0.74rem; line-height: 1.4; color: rgb(${CREAM} / 0.5); }
  .av-badge__state { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(${CREAM} / 0.4); }
  .av-badge__state--earned { color: var(--pf-cream); display: inline-flex; align-items: center; gap: 0.3rem; }

  .av-badge__progress { display: flex; align-items: center; gap: 0.6rem; margin-top: 0.1rem; }
  .av-bar { flex: 1; position: relative; height: 0.36rem; border-radius: var(--radius-pill); background: rgb(${CREAM} / 0.1); overflow: hidden; }
  .av-bar__fill { position: absolute; inset: 0 auto 0 0; height: 100%; border-radius: var(--radius-pill); background: rgb(${CREAM} / 0.7); }
  .av.is-armed .av-bar__fill { transform: scaleX(0); transform-origin: left; }
  .av.is-armed.is-in .av-bar__fill { transform: scaleX(1); transition: transform 850ms cubic-bezier(0.22, 1, 0.36, 1) 250ms; }
  .av-badge__frac { flex: none; font-family: var(--pf-mono); font-size: 0.62rem; color: rgb(${CREAM} / 0.5); font-variant-numeric: tabular-nums; }
  .av-badge__frac em { font-style: normal; font-weight: 640; color: var(--pf-cream); }

  .av-foot { width: min(98%, 60rem); margin: 0 auto; text-align: center; font-family: var(--pf-mono); font-size: 0.64rem; line-height: 1.5; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.4); }

  @media (prefers-reduced-motion: reduce) {
    .av.is-armed.is-in .av-sec, .av.is-armed.is-in .av-bar__fill { transition: none; }
  }
`;
