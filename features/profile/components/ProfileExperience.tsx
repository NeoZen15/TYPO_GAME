"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import ProgressBoard from "@/features/profile/components/ProgressBoard";
import ProgressConstellation from "@/features/profile/components/ProgressConstellation";
import StatsBoard from "@/features/profile/components/StatsBoard";
import ProfileSummary from "@/features/profile/components/ProfileSummary";
import ActivityBoard from "@/features/profile/components/ActivityBoard";
import AchievementsBoard from "@/features/profile/components/AchievementsBoard";
import PreferencesBoard from "@/features/profile/components/PreferencesBoard";
import type { Art } from "@/lib/brand/dwiggins-badge-engine";
import {
  MOCK_ARENA,
  MOCK_EYE,
  MOCK_PROFILE,
  type ArenaProfile,
  type EyeProfile,
  type PlayerProfile,
} from "@/lib/profile/mock-profile";

// Path visual: the non-linear constellation (new) vs. the linear board-game
// snake (kept in ProgressBoard.tsx). Flip this to revisit the snake in 1 line.
const USE_CONSTELLATION = true;

// Identity hero (avatar + name + level + XP) — hidden for now per request.
const SHOW_IDENTITY = false;

type ViewId = "home" | "profile" | "stats" | "activity" | "achievements" | "preferences";

const NAV: ReadonlyArray<{ id: ViewId; label: string }> = [
  { id: "home", label: "Path" },
  { id: "profile", label: "Profile" },
  { id: "stats", label: "Stats" },
  { id: "activity", label: "Activity" },
  { id: "achievements", label: "Achievements" },
  { id: "preferences", label: "Preferences" },
];

type ProfileExperienceProps = {
  profile?: PlayerProfile;
  // Real eye constellation + arena, derived server-side. Default to the mock so
  // the page still renders for a fresh visitor with no play history.
  eye?: EyeProfile;
  arena?: ArenaProfile;
  art: Art;
};

export default function ProfileExperience({
  profile = MOCK_PROFILE,
  eye = MOCK_EYE,
  arena = MOCK_ARENA,
  art,
}: ProfileExperienceProps) {
  const [view, setView] = useState<ViewId>("home");
  const [scrolled, setScrolled] = useState(false);
  // The eye layer drives level / XP / title (title is derived from lit axes).
  const xpPct = Math.round((eye.xpInLevel / eye.xpForNext) * 100);

  // Every view now owns its own full-bleed intro (the constellation, the stats
  // board, and the four boards below). The shell only carries the optional
  // identity hero or the legacy board head — skip it (and its top margin) when
  // neither applies.
  const showLegacyHead = view === "home" && !USE_CONSTELLATION;
  const shellIsEmpty = !SHOW_IDENTITY && !showLegacyHead;

  // Condense the header once scrolled — mirrors the landing's `.lp-header`.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="pf-page">
      {/* Shell CSS injected as a plain stylesheet (reliable; styled-jsx was
          dropping a second global block under Turbopack). */}
      <style dangerouslySetInnerHTML={{ __html: SHELL_CSS }} />

      {/* ── Top pill header — visually identical to the landing's `.lp-header`
          (cream pill, dark ink, figures + black wordmark), profile nav info ── */}
      <header className={`pf-top${scrolled ? " is-scrolled" : ""}`}>
        <Link href="/" className="pf-top__brand" aria-label="Dwiggins — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pf-top__figures"
            src="/brand/dwiggins-figures-dark.svg"
            alt=""
            aria-hidden="true"
            width={182}
            height={122}
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

        <nav className="pf-top__nav" aria-label="Profile sections">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`pf-top__link${view === item.id ? " is-active" : ""}`}
              aria-current={view === item.id ? "true" : undefined}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pf-top__actions">
          <Link href="/play" className="pf-top__cta">
            Play
          </Link>
          <ThemeSwitch />
        </div>
      </header>

      {/* The shell only carries the identity hero / section head. For the
          constellation home (it owns its own intro) and the stats view, both
          are empty — skip it, otherwise its margin pushes the content far down
          the page. */}
      {!shellIsEmpty && (
      <div className="pf-shell">
        {/* ── Identity hero (hidden for now — see SHOW_IDENTITY) ── */}
        {SHOW_IDENTITY && (
          <section className="pf-id" aria-label="Player identity">
            <div className="pf-id__avatar" aria-hidden="true">
              {profile.initials}
            </div>
            <div className="pf-id__meta">
              <span className="pf-id__eyebrow">{profile.memberSince}</span>
              <h1 className="pf-id__name">{profile.name}</h1>
              <div className="pf-id__row">
                <span className="pf-id__rank">{eye.title}</span>
                <span className="pf-id__sep" aria-hidden="true" />
                <span className="pf-id__level">Level {eye.level}</span>
              </div>
              <div className="pf-id__xp" role="img" aria-label={`${xpPct}% to level ${eye.level + 1}`}>
                <span className="pf-id__xp-fill" style={{ width: `${xpPct}%` }} />
              </div>
              <span className="pf-id__xp-text">
                {eye.xpInLevel} / {eye.xpForNext} XP to level {eye.level + 1}
              </span>
            </div>
          </section>
        )}

        {/* ── Section head — only the legacy board fallback needs it; every
            other view owns its own full-bleed intro. ── */}
        {showLegacyHead && (
          <header className="pf-board__head">
            <span className="pf-kicker">Your progression</span>
            <h2 className="pf-board__title">Eight ways of seeing.</h2>
            <p className="pf-board__sub">
              Each one a shift in how you read type. Follow the path &mdash; your eye
              lights up, one way at a time.
            </p>
          </header>
        )}
      </div>
      )}

      {/* ── Path stage ── */}
      {view === "home" &&
        (USE_CONSTELLATION ? (
          <div className="pf-constellation-stage">
            <ProgressConstellation eye={eye} />
          </div>
        ) : (
          // Legacy linear board-game snake — kept on purpose as a fallback.
          <div className="pf-board-stage">
            <ProgressBoard
              chapters={profile.board.chapters}
              currentChapter={profile.board.currentChapter}
            />
          </div>
        ))}

      {/* ── Stats stage (same DA as the map) ── */}
      {view === "stats" && (
        <div className="pf-constellation-stage">
          <StatsBoard profile={profile} eye={eye} />
        </div>
      )}

      {/* ── Profile stage — identity + eye (A) and the arena (B), kept apart ── */}
      {view === "profile" && (
        <div className="pf-constellation-stage">
          <ProfileSummary
            profile={profile}
            eye={eye}
            arena={arena}
            art={art}
            onNavigate={setView}
          />
        </div>
      )}

      {/* ── Activity stage — streak, heatmap, goal, sessions ── */}
      {view === "activity" && (
        <div className="pf-constellation-stage">
          <ActivityBoard profile={profile} eye={eye} />
        </div>
      )}

      {/* ── Achievements stage — badges (Dwiggins badge engine) ── */}
      {view === "achievements" && (
        <div className="pf-constellation-stage">
          <AchievementsBoard profile={profile} art={art} />
        </div>
      )}

      {/* ── Preferences stage — settings ── */}
      {view === "preferences" && (
        <div className="pf-constellation-stage">
          <PreferencesBoard profile={profile} eye={eye} />
        </div>
      )}
    </main>
  );
}

const SHELL_CSS = `
  .pf-page {
    /* Theme-adaptive. LIGHT is the default: beige canvas, warm-noir ink.
       The dark override (below) flips it to the black canvas + beige ink. */
    --pf-bg: var(--background);
    --pf-cream: #191510;
    --pf-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
    --pf-ink: var(--ink-strong);
    --pf-muted: var(--ink-muted);
    --pf-soft: var(--ink-soft);
    --pf-surface: rgba(25, 21, 16, 0.04);
    --pf-line: var(--line);
    --pf-line-strong: var(--line-strong);
    --profile-mono: var(--pf-mono);
    min-height: 100svh;
    padding: clamp(0.7rem, 1.6vw, 1rem) clamp(1rem, 3vw, 2rem) clamp(2.4rem, 6vh, 4rem);
    background: var(--pf-bg);
    color: var(--pf-ink);
  }

  /* DARK theme — the brand "Dwiggins" canvas: pure black + beige #f4f3ee ink. */
  :root[data-theme="dark"] .pf-page {
    --pf-bg: #000000;
    --pf-cream: #f4f3ee;
    --pf-ink: rgba(244, 243, 238, 0.96);
    --pf-muted: rgba(244, 243, 238, 0.62);
    --pf-soft: rgba(244, 243, 238, 0.36);
    --pf-surface: rgba(244, 243, 238, 0.05);
    --pf-line: rgba(244, 243, 238, 0.12);
    --pf-line-strong: rgba(244, 243, 238, 0.22);
  }

  /* ── Top pill header — cloned from the landing's .lp-header (cream pill,
       dark ink, mono caps links, dark CTA, dark-on-cream theme switch). ── */
  .pf-top {
    position: sticky;
    top: clamp(0.6rem, 1.6vw, 1rem);
    z-index: 90;
    isolation: isolate;
    width: min(94vw, 70rem);
    margin: 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.46rem 1rem;
    padding: 0.5rem 0.7rem 0.5rem 0.95rem;
    border: 1px solid rgba(25, 21, 16, 0.10);
    border-radius: 1.4rem;
    background: var(--surface-strong);
    color: #141019;
    box-shadow:
      inset 0 1px 0 rgba(244, 243, 238, 0.55),
      0 0.5rem 1.5rem rgba(0, 0, 0, 0.34);
    transition: padding 220ms ease, box-shadow 220ms ease;
  }
  /* In dark mode the pill stays a light "paper" chip (beige), like the landing. */
  :root[data-theme="dark"] .pf-top { background: #f4f3ee; }
  .pf-top.is-scrolled {
    padding-block: 0.4rem;
    box-shadow:
      inset 0 1px 0 rgba(244, 243, 238, 0.6),
      0 0.7rem 1.9rem rgba(0, 0, 0, 0.46);
  }

  .pf-top__brand {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    min-width: 0;
    padding-inline: 0.2rem 0.15rem;
  }
  .pf-top__figures {
    display: block;
    width: auto;
    height: clamp(0.92rem, 1.3vw, 1.08rem);
    flex: none;
  }
  .pf-top__logo {
    display: block;
    width: auto;
    height: clamp(1.05rem, 1.5vw, 1.2rem);
    flex: none;
  }

  .pf-top__nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.1rem;
  }
  .pf-top__link {
    appearance: none;
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    padding: 0.3rem 0.5rem;
    border-radius: 999px;
    color: rgba(20, 16, 25, 0.55);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    line-height: 1;
    transition: color 160ms ease, background-color 160ms ease;
  }
  .pf-top__link:hover { color: rgba(20, 16, 25, 0.95); }
  .pf-top__link.is-active {
    color: rgba(20, 16, 25, 0.95);
    background: rgba(20, 16, 25, 0.07);
  }

  .pf-top__actions { display: flex; align-items: center; gap: 0.55rem; }
  .pf-top__cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.34rem 0.8rem;
    border-radius: 999px;
    border: 1px solid rgba(20, 16, 25, 0.12);
    background: #141019;
    color: #f4f3ee;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    line-height: 1;
    text-decoration: none;
    box-shadow:
      inset 0 1px 0 rgba(244, 243, 238, 0.08),
      0 0.2rem 0.5rem rgba(0, 0, 0, 0.18);
    transition: transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
  }
  .pf-top__cta:hover {
    transform: translateY(-1px);
    background: #000;
    box-shadow:
      inset 0 1px 0 rgba(244, 243, 238, 0.12),
      0 0.32rem 0.7rem rgba(0, 0, 0, 0.26);
  }

  /* Theme toggle reads as a dark control on the cream pill (like the landing). */
  .pf-top .theme-switch { position: static; top: auto; right: auto; }
  .pf-top .theme-switch__track {
    border-color: rgba(20, 16, 25, 0.28);
    background: rgba(20, 16, 25, 0.1);
    box-shadow: inset 0 1px 0 rgba(244, 243, 238, 0.45);
  }
  .pf-top .theme-switch__thumb {
    background: #141019;
    box-shadow: 0 1px 3px rgba(20, 16, 25, 0.35);
  }

  @media (max-width: 720px) {
    .pf-top { justify-content: center; }
    .pf-top__nav {
      order: 3;
      width: 100%;
      overflow-x: auto;
      flex-wrap: nowrap;
      justify-content: flex-start;
    }
    .pf-top__link { white-space: nowrap; }
  }

  /* ── Shell ── */
  .pf-shell {
    width: min(96vw, 70rem);
    margin: clamp(1.8rem, 5vh, 3.4rem) auto 0;
    display: grid;
    gap: clamp(1.8rem, 4vh, 3rem);
  }

  /* ── Identity hero ── */
  .pf-id {
    display: flex;
    align-items: center;
    gap: clamp(1rem, 2.4vw, 1.6rem);
  }
  .pf-id__avatar {
    display: grid;
    place-items: center;
    width: clamp(3.4rem, 7vw, 4.4rem);
    aspect-ratio: 1;
    flex-shrink: 0;
    border-radius: 999px;
    border: 1px solid var(--pf-line-strong);
    background: var(--pf-surface);
    font-size: clamp(1.1rem, 2.4vw, 1.4rem);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--pf-ink);
  }
  .pf-id__meta { display: grid; gap: 0.28rem; min-width: 0; }
  .pf-id__eyebrow {
    font-family: var(--pf-mono);
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--pf-soft);
  }
  .pf-id__name {
    margin: 0;
    font-size: clamp(1.5rem, 3.4vw, 2.2rem);
    font-weight: 640;
    letter-spacing: -0.04em;
    line-height: 1.02;
    color: var(--pf-ink);
  }
  .pf-id__row { display: flex; align-items: center; gap: 0.7rem; margin-top: 0.12rem; }
  .pf-id__rank {
    font-family: var(--pf-mono);
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--pf-muted);
  }
  .pf-id__sep { width: 0.28rem; height: 0.28rem; border-radius: 999px; background: var(--pf-soft); }
  .pf-id__level {
    font-family: var(--pf-mono);
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--pf-muted);
  }
  .pf-id__xp {
    margin-top: 0.5rem;
    width: min(22rem, 60vw);
    height: 0.32rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--pf-cream) 10%, transparent);
    overflow: hidden;
  }
  .pf-id__xp-fill { display: block; height: 100%; border-radius: 999px; background: var(--pf-cream); }
  .pf-id__xp-text {
    font-family: var(--pf-mono);
    font-size: 0.66rem;
    letter-spacing: 0.06em;
    color: var(--pf-soft);
  }

  /* ── Board section ── */
  .pf-board__head { max-width: 40rem; display: grid; gap: 0.5rem; }
  /* Wide, full-bleed board stage — breaks out of the 70rem text shell. */
  .pf-board-stage {
    width: min(98vw, 92rem);
    margin: clamp(1.2rem, 3vh, 2.2rem) auto clamp(2rem, 6vh, 4rem);
  }
  /* Constellation journey — full-bleed (no rectangle): break out of the page's
     horizontal padding so it runs edge-to-edge, on its own starfield. */
  .pf-constellation-stage {
    margin-inline: calc(-1 * clamp(1rem, 3vw, 2rem));
    /* No shell head sits above it (constellation/stats own their intros), so
       keep only a small gap under the sticky header. */
    margin-top: clamp(0.5rem, 1.8vh, 1.2rem);
  }
  .pf-kicker {
    font-family: var(--pf-mono);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--pf-soft);
  }
  .pf-board__title {
    margin: 0;
    font-size: clamp(1.5rem, 3vw, 2.1rem);
    font-weight: 640;
    letter-spacing: -0.04em;
    line-height: 1.04;
    color: var(--pf-ink);
  }
  .pf-board__sub { margin: 0; font-size: 0.98rem; line-height: 1.5; color: var(--pf-muted); }

  /* ── Empty (not-yet-built) sections ── */
  .pf-empty {
    display: grid;
    gap: 0.6rem;
    place-items: center;
    text-align: center;
    padding: clamp(3rem, 12vh, 7rem) 1rem;
    border: 1px dashed var(--pf-line);
    border-radius: 1.2rem;
  }
  .pf-empty__text { margin: 0; color: var(--pf-muted); font-size: 0.98rem; }

  @media (prefers-reduced-motion: reduce) {
    .pf-top__cta { transition: none; }
  }
`;
