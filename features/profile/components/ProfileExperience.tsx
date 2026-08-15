"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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

const VIEW_IDS: ReadonlyArray<ViewId> = [
  "home",
  "profile",
  "stats",
  "activity",
  "achievements",
  "preferences",
];

const isViewId = (value: string | null): value is ViewId =>
  value !== null && (VIEW_IDS as readonly string[]).includes(value);

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
  // ADDRESSABLE VIEWS, 2026-08-15. The board was chosen in React state alone, so
  // /profile always opened on the constellation and no link could reach a tab:
  // the recap's "See my statistics" landed on the path, not on the numbers, and
  // no tab could be shared or bookmarked either.
  //
  // Same treatment as the rules page of 2026-07-30: the parameter picks the
  // board on arrival, and clicking a tab corrects the address with replaceState
  // rather than a router push. Switching board is not a navigation, it must not
  // stack history entries a back button then has to walk through.
  const requestedView = useSearchParams().get("view");
  const [view, setView] = useState<ViewId>(isViewId(requestedView) ? requestedView : "home");
  const [scrolled, setScrolled] = useState(false);

  const showView = useCallback((next: ViewId) => {
    setView(next);
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", next === "home" ? "/profile" : `/profile?view=${next}`);
  }, []);
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
      {/* Shell CSS now lives in app/globals.css so every page can enter the same
          token contract: .pf-page publishes --pf-bg / --pf-cream / --pf-mono / ink
          steps, and every board consumes them without defining any. */}

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
              onClick={() => showView(item.id)}
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


