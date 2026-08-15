"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import StarField from "@/features/profile/components/StarField";
import { DwigginsBadge, DwigginsBadgeDefs } from "@/components/brand/DwigginsBadge";
import type { Art, Badge, Tier } from "@/lib/brand/dwiggins-badge-engine";
import type { ArenaProfile, ArenaRank, EyeProfile, PlayerProfile, RankedMatchMode } from "@/lib/profile/mock-profile";

// ---------------------------------------------------------------------------
// Profile — the identity tab. TWO visually distinct blocks (perceptual-spec §6,
// profile-tabs-spec §2):
//   A · your EYE (durable, only goes up) — identity + title + level/XP + counts.
//   B · the ARENA — a full ranked-play screen (COD-style competitive):
//       rank crest + skill rating + division ladder (promotion/relegation) +
//       Bronze→Diamond track + Blitz/Duel/Ligue playlists (§1·B) + division
//       leaderboard + ranked match history + season banner (§7). Orange contour,
//       kept SEPARATE from the eye (NIVEAU §8). No emoji — pro typography.
// Same DA as the DWIGGINS map: cream-on-black, mono labels, fixed starfield.
// ---------------------------------------------------------------------------

const CREAM = "from var(--pf-cream) r g b"; // theme-adaptive ink (flips beige<->warm-noir)
const ORANGE = "#ff934a"; // the validated competition accent (contour + faint, never an aplat)

// Division ladder shape — math §13 (N_div / P_up / P_down).
const N_DIV = 30;
const P_UP = 7;
const P_DOWN = 5;

// Bronze → Diamond, the season rank track.
const RANKS: ArenaRank[] = ["bronze", "silver", "gold", "platinum", "diamond"];

// Competition sub-modes (math §1·B). minLevel gates the unlock (Blitz @5; Duel
// after Blitz → same gate here; Ligue auto).
const PLAYLISTS: { id: RankedMatchMode; name: string; blurb: string; note: string; minLevel: number }[] = [
  { id: "blitz", name: "Blitz", blurb: "2-min sprint · max score", note: "1–2 pts / answer", minLevel: 5 },
  { id: "duel", name: "Duel", blurb: "1 v 1 · same series", note: "ELO + capped XP", minLevel: 5 },
  { id: "ligue", name: "Ligue", blurb: "weekly · Bronze → Diamond", note: "ranked by season pts", minLevel: 0 },
];

// Arena rank → blason finish. The crest reuses the Dwiggins badge engine; the
// rank reads through the metal (silver → silver medallion). bronze/platinum have
// no dedicated gradient yet → nearest finish (refine when those ranks ship).
const RANK_TIER: Record<ArenaRank, Tier> = {
  bronze: "common",
  silver: "epic",
  gold: "legendary",
  platinum: "epic",
  diamond: "mythic",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const roman = (n: number) => ROMAN[n] ?? String(n);

type ViewId = "home" | "profile" | "stats" | "activity" | "achievements" | "preferences";

export default function ProfileSummary({
  profile,
  eye,
  arena,
  art,
  onNavigate,
}: {
  profile: PlayerProfile;
  eye: EyeProfile;
  arena: ArenaProfile;
  art: Art;
  onNavigate?: (view: ViewId) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [remaining, setRemaining] = useState("");

  // Reveal — visible by default, IntersectionObserver enriches (reduced-motion safe).
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

  // Season window countdown (client-side; the S_week reset, math §7).
  useEffect(() => {
    const end = new Date(arena.weekEndsAt).getTime();
    const tick = () => {
      if (Number.isNaN(end)) return setRemaining("");
      const ms = end - Date.now();
      if (ms <= 0) return setRemaining("resetting");
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setRemaining(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [arena.weekEndsAt]);

  // Eye-layer derived figures (display only — see scoring-implementation-contract §2).
  const liveAxes = eye.axes.filter((a) => !a.roadmap);
  const litGalaxies = liveAxes.filter((a) => a.state === "lit").length;
  const totalPaliers = eye.axes.reduce((s, a) => s + a.paliers.length, 0); // 35 (incl. roadmap, contract §6)
  const litPaliers = eye.axes.reduce((s, a) => s + a.paliers.filter((p) => p.state === "lit").length, 0);
  const xpPct = Math.round((eye.xpInLevel / eye.xpForNext) * 100);

  // Arena ladder geometry.
  const hold = N_DIV - P_UP - P_DOWN;
  const markerPct = ((arena.place - 0.5) / N_DIV) * 100;
  const inPromo = arena.place <= P_UP;
  const inDrop = arena.place > N_DIV - P_DOWN;
  const toPromo = arena.place - P_UP;
  const standing = inPromo
    ? "In the promotion zone"
    : inDrop
      ? "In the drop zone — climb out"
      : `${toPromo} ${toPromo === 1 ? "spot" : "spots"} from promotion`;

  const blason: Badge = { name: `${cap(arena.rank)} rank`, tier: RANK_TIER[arena.rank], shape: "shield", layout: "symFull" };
  const reward: Badge = { name: `${cap(arena.rank)} season crest`, tier: RANK_TIER[arena.rank], shape: "rosette", layout: "symbol" };
  const rankIndex = RANKS.indexOf(arena.rank);

  return (
    <div ref={rootRef} className="ps">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <DwigginsBadgeDefs />

      <div className="ps-bg" aria-hidden="true">
        <StarField />
      </div>

      <header className="ps-intro ps-sec">
        <span className="ps-kicker">Your profile</span>
        <h1 className="ps-title">Two things, kept apart.</h1>
        <p className="ps-lede">
          Your <em>eye</em> only ever sharpens. Your <em>rank</em> rises and falls every season. They
          never mix.
        </p>
      </header>

      {/* ── BLOCK A — the eye (durable identity) ── */}
      <section className="ps-panel ps-eye ps-sec" aria-label="Your eye">
        <span className="ps-tag ps-tag--eye">The eye · only goes up</span>

        <div className="ps-eye__id">
          <div className="ps-eye__avatar" aria-hidden="true">{profile.initials}</div>
          <div className="ps-eye__who">
            <span className="ps-eye__since">{profile.memberSince}</span>
            <h3 className="ps-eye__name">{profile.name}</h3>
            <span className="ps-eye__handle">{profile.handle}</span>
          </div>
          <span className="ps-eye__title" aria-label={`Eye title: ${eye.title}`}>
            <span className="ps-eye__star" aria-hidden="true">✦</span>
            {eye.title}
          </span>
        </div>

        <div className="ps-eye__lvl">
          <span className="ps-eye__lvlnum">{eye.level}</span>
          <div className="ps-eye__xp">
            <span className="ps-eye__xplabel">Level {eye.level}</span>
            <span className="ps-bar" role="img" aria-label={`${xpPct}% to level ${eye.level + 1}`}>
              <span className="ps-bar__fill" style={{ width: `${xpPct}%` }} />
            </span>
            <span className="ps-eye__xptext">
              <em>{eye.xpInLevel}</em> / {eye.xpForNext} XP to level {eye.level + 1}
            </span>
          </div>
        </div>

        <ul className="ps-eye__counts">
          <li><em>{litGalaxies}</em><span>/ 8 galaxies</span></li>
          <li><em>{litPaliers}</em><span>/ {totalPaliers} paliers</span></li>
          <li><em>{eye.streak}</em><span>day streak</span></li>
          <li><em>{eye.coins}</em><span>coins</span></li>
        </ul>

        <button type="button" className="ps-eye__cta" onClick={() => onNavigate?.("home")}>
          Open your path <span aria-hidden="true">→</span>
        </button>
      </section>

      {/* ── BLOCK B — the arena: ranked play (COD-style) ── */}
      <section className="ps-arena ps-sec" aria-label="Ranked play">
        <div className="ps-arena__head">
          <span className="ps-tag ps-tag--arena">Ranked play · rises &amp; falls</span>
          <span className="ps-arena__season">
            <span className="ps-arena__seasonlbl">Season {arena.season}</span>
            {remaining && <span className="ps-arena__seasonval">ends {remaining}</span>}
          </span>
        </div>

        <div className="ps-arena__body">
          {/* Rank crest */}
          <div className="ps-arena__crestcol">
            <DwigginsBadge badge={blason} art={art} idx={0} className="ps-arena__crest" title={`${cap(arena.rank)} — Division ${roman(arena.division)}`} />
            <span className="ps-arena__rankname">{cap(arena.rank)}</span>
            <span className="ps-arena__div">Division {roman(arena.division)}</span>
          </div>

          {/* Competitive stats */}
          <div className="ps-arena__stats">
            <div className="ps-arena__sr">
              <div className="ps-arena__srmain">
                <span className="ps-arena__srnum">{arena.elo}</span>
                <span className="ps-arena__srlbl">Skill rating</span>
              </div>
              <div className="ps-arena__srside">
                <span className="ps-arena__srval">{arena.weeklyPoints}</span>
                <span className="ps-arena__srsub">pts this season</span>
              </div>
            </div>

            {/* Division ladder — promotion / hold / relegation */}
            <div className="ps-ladder">
              <div className="ps-ladder__track" role="img" aria-label={`Place ${arena.place} of ${N_DIV} in the division`}>
                <span className="ps-ladder__band ps-ladder__band--promo" style={{ flexGrow: P_UP }} />
                <span className="ps-ladder__band ps-ladder__band--hold" style={{ flexGrow: hold }} />
                <span className="ps-ladder__band ps-ladder__band--drop" style={{ flexGrow: P_DOWN }} />
                <span className="ps-ladder__marker" style={{ left: `${markerPct}%` }}>
                  <span className="ps-ladder__pin" />
                  <span className="ps-ladder__you">#{arena.place}</span>
                </span>
              </div>
              <div className="ps-ladder__legend">
                <span className="ps-ladder__leg ps-ladder__leg--promo">▲ promote · top {P_UP}</span>
                <span className="ps-ladder__leg">hold</span>
                <span className="ps-ladder__leg ps-ladder__leg--drop">drop · bottom {P_DOWN} ▼</span>
              </div>
              <span className="ps-ladder__status">{standing}</span>
            </div>

            {/* Bronze → Diamond track */}
            <div className="ps-ranks" role="img" aria-label={`Rank: ${cap(arena.rank)}, ${rankIndex + 1} of ${RANKS.length}`}>
              {RANKS.map((r, i) => (
                <span
                  key={r}
                  className={`ps-rank${r === arena.rank ? " is-current" : ""}${i <= rankIndex ? " is-reached" : ""}`}
                >
                  <span className="ps-rank__node" aria-hidden="true" />
                  <span className="ps-rank__lbl">{cap(r)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Playlists (the competition sub-modes, §1·B) ── */}
        <div className="ps-arena__section">
          <span className="ps-arena__seclbl">Playlists</span>
          <div className="ps-playlists">
            {PLAYLISTS.map((p) => {
              const unlocked = eye.level >= p.minLevel;
              return (
                <div key={p.id} className={`ps-play${unlocked ? "" : " is-locked"}`}>
                  <span className="ps-play__name">{p.name}</span>
                  <span className="ps-play__blurb">{p.blurb}</span>
                  <span className="ps-play__foot">
                    {unlocked ? (
                      <span className="ps-play__note">{p.note}</span>
                    ) : (
                      <span className="ps-play__lock">Unlocks · LVL {p.minLevel}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live standings + match history need a real player population — they
            wake up after launch (docs/process/backend-todo.md). Honest placeholder until
            then (no fake opponents / fake matches). */}
        <div className="ps-arena__soon">
          <span className="ps-arena__soontag">Arrives with the crowd</span>
          <span className="ps-arena__soontitle">Live standings &amp; match history</span>
          <span className="ps-arena__soontext">
            The division leaderboard and your ranked matches need real players to rank against — they
            switch on once the arena has a population, after launch.
          </span>
        </div>

        {/* ── Season banner ── */}
        <div className="ps-season">
          <div className="ps-season__reward">
            <DwigginsBadge badge={reward} art={art} idx={1} className="ps-season__crest" title="Season reward crest" />
          </div>
          <div className="ps-season__text">
            <span className="ps-season__title">Season {arena.season} reward</span>
            <span className="ps-season__sub">
              Finish above the cut to keep your crest. Seasons soft-reset quarterly toward the mean —
              a fresh climb, your eye untouched.
            </span>
          </div>
        </div>

        <div className="ps-arena__foot">
          <Link href="/play/competition" className="ps-arena__cta">
            Enter ranked play <span aria-hidden="true">→</span>
          </Link>
          <span className="ps-arena__note">Bronze → Diamond — this rank moves both ways. Your eye never does.</span>
        </div>
      </section>
    </div>
  );
}

const CSS = `
  .ps {
    position: relative; isolation: isolate; width: 100%;
    display: grid; gap: clamp(1.1rem, 3vh, 2rem);
    padding: clamp(1.2rem, 3vw, 2.2rem) clamp(1rem, 4vw, 3rem) clamp(3rem, 8vh, 6rem);
  }
  .ps-bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
  .ps-bg .dw-stars { position: absolute; inset: 0; width: 100%; height: 100%; }

  .ps.is-armed .ps-sec { opacity: 0; transform: translateY(16px); }
  .ps.is-armed.is-in .ps-sec { opacity: 1; transform: none; transition: opacity 600ms ease, transform 700ms cubic-bezier(0.22, 1, 0.36, 1); }

  .ps-intro { text-align: center; display: grid; gap: 0.45rem; justify-items: center; max-width: 52rem; margin: 0 auto; }
  .ps-kicker { font-family: var(--pf-mono); font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .ps-title { margin: 0; font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 640; letter-spacing: -0.04em; line-height: 1.02; color: var(--pf-cream); }
  .ps-lede { margin: 0; max-width: 48ch; font-size: 0.9rem; line-height: 1.5; color: rgb(${CREAM} / 0.6); }
  .ps-lede em { font-style: normal; color: var(--pf-cream); }

  /* Shared panel + tag */
  .ps-panel {
    width: min(98%, 60rem); margin: 0 auto; position: relative;
    padding: clamp(1.2rem, 2.6vw, 1.8rem);
    border: 1px solid rgb(${CREAM} / 0.1); border-radius: var(--radius);
    background: color-mix(in srgb, var(--pf-bg) 90%, transparent);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  }
  .ps-tag {
    display: inline-flex; align-items: center; font-family: var(--pf-mono);
    font-size: 0.54rem; letter-spacing: 0.12em; text-transform: uppercase;
    padding: 0.18rem 0.6rem; border-radius: var(--radius-pill); border: 1px solid rgb(${CREAM} / 0.2);
    color: rgb(${CREAM} / 0.6);
  }
  .ps-tag--arena { border-color: color-mix(in srgb, ${ORANGE} 45%, transparent); background: color-mix(in srgb, ${ORANGE} 8%, transparent); color: color-mix(in srgb, ${ORANGE} 55%, var(--pf-cream)); }

  .ps-bar { display: block; position: relative; height: 0.4rem; border-radius: var(--radius-pill); background: rgb(${CREAM} / 0.1); overflow: hidden; }
  .ps-bar__fill { position: absolute; inset: 0 auto 0 0; height: 100%; border-radius: var(--radius-pill); background: var(--pf-cream); }
  .ps.is-armed .ps-bar__fill { transform: scaleX(0); transform-origin: left; }
  .ps.is-armed.is-in .ps-bar__fill { transform: scaleX(1); transition: transform 850ms cubic-bezier(0.22, 1, 0.36, 1) 250ms; }

  /* ── Block A — eye ── */
  .ps-eye { display: grid; gap: clamp(1rem, 2.4vh, 1.5rem); }
  .ps-eye__id { display: flex; align-items: center; gap: clamp(0.9rem, 2vw, 1.3rem); flex-wrap: wrap; }
  .ps-eye__avatar {
    display: grid; place-items: center; width: clamp(3.2rem, 6vw, 4rem); aspect-ratio: 1; flex: none;
    border-radius: var(--radius-pill); border: 1px solid rgb(${CREAM} / 0.22); background: rgb(${CREAM} / 0.05);
    font-size: clamp(1.1rem, 2.2vw, 1.35rem); font-weight: 600; letter-spacing: 0.02em; color: var(--pf-cream);
  }
  .ps-eye__who { display: grid; gap: 0.1rem; min-width: 0; flex: 1; }
  .ps-eye__since { font-family: var(--pf-mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgb(${CREAM} / 0.42); }
  .ps-eye__name { margin: 0; font-size: clamp(1.3rem, 2.8vw, 1.8rem); font-weight: 640; letter-spacing: -0.03em; line-height: 1.04; color: var(--pf-cream); }
  .ps-eye__handle { font-family: var(--pf-mono); font-size: 0.72rem; color: rgb(${CREAM} / 0.5); }
  .ps-eye__title { display: inline-flex; align-items: center; gap: 0.4rem; align-self: flex-start; font-family: var(--pf-mono); font-size: 0.66rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--pf-cream); padding: 0.32rem 0.7rem; border-radius: var(--radius-pill); border: 1px solid rgb(${CREAM} / 0.22); background: rgb(${CREAM} / 0.04); }
  .ps-eye__star { color: var(--pf-cream); }

  .ps-eye__lvl { display: flex; align-items: center; gap: clamp(0.9rem, 2.2vw, 1.5rem); padding-top: 0.3rem; }
  .ps-eye__lvlnum { font-size: clamp(2.4rem, 5.5vw, 3.2rem); font-weight: 680; line-height: 0.9; color: var(--pf-cream); font-variant-numeric: tabular-nums; flex: none; }
  .ps-eye__xp { flex: 1; display: grid; gap: 0.4rem; min-width: 0; }
  .ps-eye__xplabel { font-family: var(--pf-mono); font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgb(${CREAM} / 0.55); }
  .ps-eye__xptext { font-family: var(--pf-mono); font-size: 0.66rem; color: rgb(${CREAM} / 0.44); font-variant-numeric: tabular-nums; }
  .ps-eye__xptext em { font-style: normal; font-weight: 640; color: var(--pf-cream); }

  .ps-eye__counts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin: 0; padding: 0.95rem 0 0; list-style: none; border-top: 1px solid rgb(${CREAM} / 0.1); }
  .ps-eye__counts li { display: grid; gap: 0.12rem; }
  .ps-eye__counts em { font-style: normal; font-size: clamp(1rem, 2vw, 1.25rem); font-weight: 660; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .ps-eye__counts span { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.06em; text-transform: uppercase; color: rgb(${CREAM} / 0.45); }
  @media (max-width: 560px) { .ps-eye__counts { grid-template-columns: repeat(2, 1fr); } }

  .ps-eye__cta {
    justify-self: start; display: inline-flex; align-items: center; gap: 0.45rem;
    padding: 0.5rem 1rem; border-radius: var(--radius-pill); cursor: pointer; text-decoration: none;
    font-family: var(--pf-mono); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    border: 1px solid rgb(${CREAM} / 0.28); background: rgb(${CREAM} / 0.06); color: var(--pf-cream);
    transition: background-color 160ms ease, transform 160ms ease;
  }
  .ps-eye__cta:hover { background: rgb(${CREAM} / 0.12); transform: translateY(-1px); }

  /* ── Block B — ranked play (orange contour, distinct from the eye) ── */
  .ps-arena {
    width: min(98%, 60rem); margin: 0 auto; position: relative;
    padding: clamp(1.2rem, 2.6vw, 1.8rem);
    border: 1px solid color-mix(in srgb, ${ORANGE} 32%, transparent); border-radius: var(--radius);
    background:
      radial-gradient(120% 80% at 85% 0%, color-mix(in srgb, ${ORANGE} 7%, transparent), transparent 60%),
      color-mix(in srgb, var(--pf-bg) 88%, transparent);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
    display: grid; gap: clamp(1.1rem, 2.6vh, 1.6rem);
  }
  .ps-arena__head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem 1rem; flex-wrap: wrap; }
  .ps-arena__season { display: inline-flex; align-items: baseline; gap: 0.5rem; font-family: var(--pf-mono); }
  .ps-arena__seasonlbl { font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: rgb(${CREAM} / 0.7); }
  .ps-arena__seasonval { font-size: 0.74rem; font-weight: 640; color: color-mix(in srgb, ${ORANGE} 55%, var(--pf-cream)); font-variant-numeric: tabular-nums; }

  .ps-arena__body { display: grid; grid-template-columns: auto 1fr; gap: clamp(1.2rem, 3vw, 2.4rem); align-items: center; }
  @media (max-width: 620px) { .ps-arena__body { grid-template-columns: 1fr; justify-items: center; text-align: center; } }
  .ps-arena__crestcol { display: grid; justify-items: center; gap: 0.25rem; }
  .ps-arena__crest { width: clamp(7rem, 18vw, 10rem); height: auto; filter: drop-shadow(0 8px 18px rgba(0,0,0,0.55)); }
  .ps-arena__rankname { font-size: clamp(1.4rem, 3.2vw, 1.9rem); font-weight: 680; letter-spacing: -0.02em; line-height: 1; color: var(--pf-cream); margin-top: 0.25rem; }
  .ps-arena__div { font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }

  .ps-arena__stats { display: grid; gap: clamp(0.9rem, 2vh, 1.3rem); min-width: 0; width: 100%; }

  /* Skill rating headline */
  .ps-arena__sr { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; padding-bottom: 0.85rem; border-bottom: 1px solid rgb(${CREAM} / 0.1); }
  @media (max-width: 620px) { .ps-arena__sr { justify-content: center; gap: 1.6rem; } }
  .ps-arena__srmain { display: grid; gap: 0.1rem; }
  .ps-arena__srnum { font-size: clamp(2rem, 5vw, 2.8rem); font-weight: 700; line-height: 0.9; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .ps-arena__srlbl { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .ps-arena__srside { display: grid; gap: 0.1rem; text-align: right; }
  @media (max-width: 620px) { .ps-arena__srside { text-align: center; } }
  .ps-arena__srval { font-size: clamp(1.1rem, 2.4vw, 1.4rem); font-weight: 660; line-height: 1; color: color-mix(in srgb, ${ORANGE} 50%, var(--pf-cream)); font-variant-numeric: tabular-nums; }
  .ps-arena__srsub { font-family: var(--pf-mono); font-size: 0.52rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.42); }

  /* Division ladder */
  .ps-ladder { display: grid; gap: 0.5rem; }
  .ps-ladder__track { position: relative; display: flex; gap: 2px; height: 0.5rem; border-radius: var(--radius-pill); overflow: visible; }
  .ps-ladder__band { flex-basis: 0; min-width: 0; height: 100%; border-radius: 2px; }
  .ps-ladder__band--promo { background: rgb(${CREAM} / 0.62); border-radius: 999px 2px 2px 999px; }
  .ps-ladder__band--hold { background: rgb(${CREAM} / 0.16); }
  .ps-ladder__band--drop { background: color-mix(in srgb, ${ORANGE} 42%, transparent); border-radius: 2px 999px 999px 2px; }
  .ps-ladder__marker { position: absolute; top: 50%; transform: translate(-50%, -50%); display: grid; justify-items: center; }
  .ps-ladder__pin { width: 0.7rem; height: 0.7rem; border-radius: var(--radius-pill); background: var(--pf-cream); box-shadow: 0 0 0 3px var(--pf-bg), 0 0 0 4px rgb(${CREAM} / 0.5); }
  .ps-ladder__you { position: absolute; top: 0.85rem; font-family: var(--pf-mono); font-size: 0.6rem; font-weight: 700; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .ps.is-armed .ps-ladder__marker { opacity: 0; }
  .ps.is-armed.is-in .ps-ladder__marker { opacity: 1; transition: opacity 500ms ease 400ms; }
  .ps-ladder__legend { display: flex; justify-content: space-between; gap: 0.5rem; margin-top: 0.7rem; font-family: var(--pf-mono); font-size: 0.5rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.38); }
  .ps-ladder__leg--promo { color: rgb(${CREAM} / 0.6); }
  .ps-ladder__leg--drop { color: color-mix(in srgb, ${ORANGE} 55%, var(--pf-cream)); }
  .ps-ladder__status { font-family: var(--pf-mono); font-size: 0.66rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.55); }

  /* Bronze → Diamond track */
  .ps-ranks { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.3rem; position: relative; padding-top: 0.4rem; }
  .ps-ranks::before { content: ""; position: absolute; top: calc(0.4rem + 0.34rem); left: 6%; right: 6%; height: 1px; background: rgb(${CREAM} / 0.14); }
  .ps-rank { position: relative; display: grid; justify-items: center; gap: 0.35rem; flex: 1; min-width: 0; }
  .ps-rank__node { width: 0.7rem; height: 0.7rem; border-radius: var(--radius-pill); border: 1px solid rgb(${CREAM} / 0.28); background: var(--pf-bg); }
  .ps-rank.is-reached .ps-rank__node { background: rgb(${CREAM} / 0.5); border-color: rgb(${CREAM} / 0.5); }
  .ps-rank.is-current .ps-rank__node { width: 0.95rem; height: 0.95rem; background: var(--pf-cream); border-color: var(--pf-cream); box-shadow: 0 0 0 3px var(--pf-bg), 0 0 0 4px color-mix(in srgb, ${ORANGE} 45%, transparent); }
  .ps-rank__lbl { font-family: var(--pf-mono); font-size: 0.5rem; letter-spacing: 0.06em; text-transform: uppercase; color: rgb(${CREAM} / 0.4); white-space: nowrap; }
  .ps-rank.is-current .ps-rank__lbl { color: var(--pf-cream); font-weight: 700; }
  @media (max-width: 420px) { .ps-rank__lbl { font-size: 0.44rem; } }

  /* Sub-sections inside the arena */
  .ps-arena__section { display: grid; gap: 0.7rem; padding-top: clamp(0.9rem, 2vh, 1.3rem); border-top: 1px solid rgb(${CREAM} / 0.1); }
  .ps-arena__seclbl { font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .ps-arena__cols { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(1rem, 2.4vw, 1.6rem); }
  @media (max-width: 620px) { .ps-arena__cols { grid-template-columns: 1fr; } }
  .ps-arena__cols .ps-arena__section { padding-top: clamp(0.9rem, 2vh, 1.3rem); }

  /* Playlists */
  .ps-playlists { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
  @media (max-width: 560px) { .ps-playlists { grid-template-columns: 1fr; } }
  .ps-play { display: grid; gap: 0.3rem; padding: 0.8rem 0.9rem; border: 1px solid rgb(${CREAM} / 0.14); border-radius: var(--radius); background: rgb(${CREAM} / 0.03); }
  .ps-play.is-locked { opacity: 0.55; }
  .ps-play__name { font-size: 0.92rem; font-weight: 640; letter-spacing: -0.01em; color: var(--pf-cream); }
  .ps-play__blurb { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.04em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .ps-play__foot { margin-top: 0.2rem; }
  .ps-play__note { font-family: var(--pf-mono); font-size: 0.56rem; color: color-mix(in srgb, ${ORANGE} 48%, var(--pf-cream)); }
  .ps-play__lock { font-family: var(--pf-mono); font-size: 0.54rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.4); }

  /* "Not yet" placeholder — live standings + match history need a population */
  .ps-arena__soon { display: grid; gap: 0.4rem; justify-items: center; text-align: center; padding: clamp(1.1rem, 2.6vw, 1.6rem); border: 1px dashed color-mix(in srgb, ${ORANGE} 28%, transparent); border-radius: var(--radius); background: color-mix(in srgb, ${ORANGE} 4%, transparent); }
  .ps-arena__soontag { font-family: var(--pf-mono); font-size: 0.54rem; letter-spacing: 0.12em; text-transform: uppercase; padding: 0.16rem 0.6rem; border-radius: var(--radius-pill); border: 1px dashed color-mix(in srgb, ${ORANGE} 40%, transparent); color: color-mix(in srgb, ${ORANGE} 55%, var(--pf-cream)); }
  .ps-arena__soontitle { font-size: 0.95rem; font-weight: 620; letter-spacing: -0.01em; color: var(--pf-cream); }
  .ps-arena__soontext { max-width: 46ch; font-family: var(--pf-mono); font-size: 0.62rem; line-height: 1.5; color: rgb(${CREAM} / 0.5); }

  /* Season banner */
  .ps-season { display: flex; align-items: center; gap: clamp(0.9rem, 2.4vw, 1.4rem); padding: clamp(0.9rem, 2vw, 1.1rem); border: 1px solid color-mix(in srgb, ${ORANGE} 24%, transparent); border-radius: var(--radius); background: color-mix(in srgb, ${ORANGE} 5%, transparent); }
  .ps-season__reward { flex: none; display: grid; place-items: center; }
  .ps-season__crest { width: clamp(3rem, 8vw, 4rem); height: auto; filter: drop-shadow(0 5px 12px rgba(0,0,0,0.5)); }
  .ps-season__text { display: grid; gap: 0.22rem; min-width: 0; }
  .ps-season__title { font-family: var(--pf-mono); font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: color-mix(in srgb, ${ORANGE} 50%, var(--pf-cream)); }
  .ps-season__sub { font-size: 0.74rem; line-height: 1.45; color: rgb(${CREAM} / 0.55); }

  .ps-arena__foot { display: flex; align-items: center; gap: 0.8rem 1.2rem; flex-wrap: wrap; padding-top: 0.9rem; border-top: 1px solid rgb(${CREAM} / 0.1); }
  .ps-arena__cta {
    display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none;
    padding: 0.62rem 1.2rem; border-radius: var(--radius-pill);
    font-family: var(--pf-mono); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    border: 1px solid color-mix(in srgb, ${ORANGE} 55%, transparent);
    background: color-mix(in srgb, ${ORANGE} 14%, transparent);
    color: color-mix(in srgb, ${ORANGE} 62%, var(--pf-cream));
    box-shadow: inset 0 1px 0 rgba(244, 243, 238,0.06);
    transition: background-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
  }
  .ps-arena__cta:hover { background: color-mix(in srgb, ${ORANGE} 22%, transparent); transform: translateY(-1px); box-shadow: 0 0.4rem 1rem color-mix(in srgb, ${ORANGE} 18%, transparent); }
  .ps-arena__note { flex: 1; min-width: 13rem; font-family: var(--pf-mono); font-size: 0.6rem; line-height: 1.4; color: rgb(${CREAM} / 0.42); }

  @media (prefers-reduced-motion: reduce) {
    .ps.is-armed.is-in .ps-sec, .ps.is-armed.is-in .ps-bar__fill, .ps.is-armed.is-in .ps-ladder__marker { transition: none; }
  }
`;
