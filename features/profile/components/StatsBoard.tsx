"use client";

import { useEffect, useRef } from "react";
import StarField from "@/features/profile/components/StarField";
import { MOCK_ARENA, type EyeProfile, type PlayerProfile } from "@/lib/profile/mock-profile";

// ---------------------------------------------------------------------------
// Stats — same DA as the DWIGGINS map (black + beige, mono, fixed starfield),
// but built as real data-viz: a progress RING (catalogue), an area CHART
// (activity), a RADAR of the 8 axes (labelled D·W·I·G·G·I·N·S — ties to the
// map), and scaled BARS (accuracy). Monochrome — colour stays out.
// ---------------------------------------------------------------------------

const CREAM = "from var(--pf-cream) r g b"; // theme-adaptive ink (flips beige<->warm-noir)
// Validated /play palette — used lightly (contour + faint fill, never an aplat).
const ORANGE = "#ff934a"; // competition → the arena
const BLUE = "#58a9ff"; // the 3rd accent → activity over time
const MODE_ACCENT: Record<string, string> = {
  training: "#40d38f", // green
  competition: "#ff934a", // orange
  expert: "#58a9ff", // blue
};
const WORD = "DWIGGINS"; // axis order = the word

// 8-point radar geometry (octagon), 0 at top, clockwise.
const RC = 86; // centre
const RMAX = 58; // outer radius
function radarPt(i: number, r: number): [number, number] {
  const a = ((-90 + i * 45) * Math.PI) / 180;
  return [RC + Math.cos(a) * r, RC + Math.sin(a) * r];
}
function poly(r: number): string {
  return Array.from({ length: 8 }, (_, i) => radarPt(i, r).map((n) => n.toFixed(1)).join(",")).join(" ");
}

export default function StatsBoard({
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
    const fallback = window.setTimeout(reveal, 2600);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  const cat = profile.catalog;
  const catPct = Math.round((cat.mastered / cat.total) * 100);

  // Activity area chart geometry
  const act = profile.activity;
  const actMax = Math.max(1, ...act);
  const AW = 300;
  const AH = 78;
  const pad = 6;
  const ax = (i: number) => pad + (i / (act.length - 1)) * (AW - 2 * pad);
  const ay = (v: number) => AH - pad - (v / actMax) * (AH - 2 * pad);
  const lineD = act.map((v, i) => `${i ? "L" : "M"} ${ax(i).toFixed(1)} ${ay(v).toFixed(1)}`).join(" ");
  const areaD = `${lineD} L ${ax(act.length - 1).toFixed(1)} ${AH - pad} L ${ax(0).toFixed(1)} ${AH - pad} Z`;

  // Radar data polygon (litRatio per axis)
  const dataPoly = eye.axes
    .map((a, i) => radarPt(i, RMAX * a.litRatio).map((n) => n.toFixed(1)).join(","))
    .join(" ");

  const modeTotal = profile.modes.training + profile.modes.competition + profile.modes.expert;

  // Eye / level / palier breakdown — ties the Stats tab to the DWIGGINS map.
  const liveAxes = eye.axes.filter((a) => !a.roadmap);
  const litAxes = liveAxes.filter((a) => a.state === "lit").length;
  const xpPct = Math.round((eye.xpInLevel / eye.xpForNext) * 100);
  const allPaliers = eye.axes.flatMap((a) => a.paliers);
  const pLit = allPaliers.filter((p) => !p.roadmap && p.state === "lit").length;
  const pEmerging = allPaliers.filter((p) => !p.roadmap && p.state === "emerging").length;
  const pDormant = allPaliers.filter((p) => !p.roadmap && p.state === "dormant").length;
  const pRoadmap = allPaliers.filter((p) => p.roadmap).length;
  const emerging = liveAxes
    .filter((a) => a.state === "emerging")
    .sort((a, b) => b.litRatio - a.litRatio)[0];
  const emLit = emerging ? emerging.paliers.filter((p) => p.state === "lit").length : 0;

  return (
    <div ref={rootRef} className="st">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="st-bg" aria-hidden="true">
        <StarField />
      </div>

      <header className="st-intro st-sec">
        <span className="st-kicker">Your training</span>
        <h2 className="st-title">The numbers.</h2>
        <p className="st-lede">Where your eye stands — across every mode, face and session.</p>
      </header>

      {/* ── KPI grid ── */}
      <section className="st-kpis st-sec" aria-label="Key figures">
        {profile.kpis.map((k) => (
          <div key={k.key} className="st-kpi">
            <span className="st-kpi__value">{k.value}</span>
            <span className="st-kpi__label">{k.label}</span>
            <span className="st-kpi__helper">{k.helper}</span>
          </div>
        ))}
      </section>

      {/* ── Eye / level + palier breakdown ── */}
      <section className="st-cols st-sec" aria-label="Eye and progression">
        <div className="st-panel st-panel--eye" aria-label="Your eye">
          <h3 className="st-panel__title">Your eye</h3>
          <div className="st-eye">
            <span className="st-eye__lvl">
              <span className="st-eye__lvlnum">{eye.level}</span>
              <span className="st-eye__lvllabel">level</span>
            </span>
            <div className="st-eye__main">
              <span className="st-eye__name">{eye.title}</span>
              <span className="st-bar">
                <span className="st-bar__fill" style={{ width: `${xpPct}%` }} />
              </span>
              <span className="st-eye__xp">
                <em>{eye.xpInLevel}</em> / {eye.xpForNext} XP to level {eye.level + 1}
              </span>
            </div>
          </div>
          <div className="st-eye__foot">
            <span className="st-eye__stat">
              <em>{litAxes}</em>/{liveAxes.length} ways lit
            </span>
            <span className="st-eye__stat">
              <em>{eye.coins}</em> coins
            </span>
          </div>
        </div>

        <div className="st-panel" aria-label="Paliers by state">
          <h3 className="st-panel__title">Paliers · {pLit}/{allPaliers.length} lit</h3>
          <div
            className="st-seg"
            role="img"
            aria-label={`${pLit} lit, ${pEmerging} emerging, ${pDormant} dormant, ${pRoadmap} roadmap`}
          >
            <span className="st-seg__part st-seg__part--lit" style={{ flexGrow: pLit }} />
            <span className="st-seg__part st-seg__part--emerging" style={{ flexGrow: pEmerging }} />
            <span className="st-seg__part st-seg__part--dormant" style={{ flexGrow: pDormant }} />
            <span className="st-seg__part st-seg__part--roadmap" style={{ flexGrow: pRoadmap }} />
          </div>
          <ul className="st-legend">
            <li><span className="st-legend__sw st-legend__sw--lit" /><em>{pLit}</em> lit</li>
            <li><span className="st-legend__sw st-legend__sw--emerging" /><em>{pEmerging}</em> emerging</li>
            <li><span className="st-legend__sw st-legend__sw--dormant" /><em>{pDormant}</em> dormant</li>
            <li><span className="st-legend__sw st-legend__sw--roadmap" /><em>{pRoadmap}</em> roadmap</li>
          </ul>
          {emerging && (
            <span className="st-panel__meta">
              Closest to lighting: <em>{emerging.label}</em> · {emLit}/{emerging.paliers.length}
            </span>
          )}
        </div>
      </section>

      {/* ── Ring + activity ── */}
      <section className="st-cols st-sec">
        <div className="st-panel st-panel--ring" aria-label="Catalogue mastery">
          <h3 className="st-panel__title">Catalogue mastered</h3>
          <div className="st-ringwrap">
            <svg className="st-ring" viewBox="0 0 140 140" aria-hidden="true">
              <circle className="st-ring__track" cx="70" cy="70" r="52" />
              <circle
                className="st-ring__arc"
                cx="70"
                cy="70"
                r="52"
                pathLength={100}
                strokeDasharray={`${catPct} 100`}
                transform="rotate(-90 70 70)"
              />
              <text className="st-ring__pct" x="70" y="68">
                {catPct}%
              </text>
              <text className="st-ring__sub" x="70" y="86">
                mastered
              </text>
            </svg>
            <div className="st-ring__legend">
              <span className="st-ring__big">
                <em>{cat.mastered}</em> / {cat.total}
              </span>
              <span className="st-ring__line">{cat.seen} seen</span>
              <span className="st-ring__line">{cat.total - cat.seen} unseen</span>
            </div>
          </div>
        </div>

        <div className="st-panel" aria-label="Activity, last 14 days">
          <h3 className="st-panel__title">Last 14 days</h3>
          <svg className="st-area" viewBox={`0 0 ${AW} ${AH}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="st-area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={`color-mix(in srgb, ${BLUE} 26%, transparent)`} />
                <stop offset="1" stopColor="transparent" />
              </linearGradient>
            </defs>
            <line className="st-area__grid" x1="0" y1={AH / 2} x2={AW} y2={AH / 2} />
            <line className="st-area__base" x1="0" y1={AH - pad} x2={AW} y2={AH - pad} />
            <path className="st-area__fill" d={areaD} fill="url(#st-area-grad)" />
            <path className="st-area__line" d={lineD} fill="none" />
          </svg>
          <span className="st-panel__meta">
            <em>{profile.streak}</em>-day streak<span className="st-dot">·</span>
            today <em>{profile.dailyGoal.done}</em>/{profile.dailyGoal.target} goal
          </span>
        </div>
      </section>

      {/* ── Radar + accuracy ── */}
      <section className="st-cols st-cols--b st-sec">
        <div className="st-panel st-panel--radar" aria-label="The eight ways of seeing">
          <h3 className="st-panel__title">The eight ways of seeing</h3>
          <svg className="st-radar" viewBox="0 0 172 172" aria-hidden="true">
            {[0.25, 0.5, 0.75, 1].map((r) => (
              <polygon key={r} className="st-radar__ring" points={poly(RMAX * r)} />
            ))}
            {eye.axes.map((_, i) => {
              const [x, y] = radarPt(i, RMAX);
              return <line key={i} className="st-radar__spoke" x1={RC} y1={RC} x2={x} y2={y} />;
            })}
            <polygon className="st-radar__data" points={dataPoly} />
            {eye.axes.map((a, i) => {
              const [x, y] = radarPt(i, RMAX + 11);
              const litDot = a.paliers.filter((p) => p.state === "lit").length === a.paliers.length && !a.roadmap;
              return (
                <text
                  key={a.id}
                  className={`st-radar__label${litDot ? " is-full" : ""}`}
                  x={x}
                  y={y + 3}
                  textAnchor="middle"
                >
                  {WORD[i]}
                </text>
              );
            })}
          </svg>
          <span className="st-panel__meta">share of each axis lit · centre = nothing, rim = fully lit</span>
        </div>

        <div className="st-panel" aria-label="Precision by axis">
          {/* Precision broken down by the 8 ways of seeing — NOT random
              categories (profile-tabs-spec §3). Per axis: mean recent accuracy
              a(P) over its exposed (mastered > 0) non-roadmap paliers. */}
          <h3 className="st-panel__title">Precision by axis</h3>
          <ul className="st-rows">
            {eye.axes.map((a) => {
              const exposed = a.paliers.filter((p) => !p.roadmap && p.mastered > 0);
              const acc = exposed.length
                ? Math.round((exposed.reduce((s, p) => s + p.a, 0) / exposed.length) * 100)
                : null;
              const mastered = a.paliers.reduce((s, p) => s + p.mastered, 0);
              const short = a.label.replace(/^Seeing /, "");
              const sub = a.roadmap ? "roadmap" : acc === null ? "not started" : `${mastered} mastered`;
              return (
                <li key={a.id} className={`st-row${a.roadmap || acc === null ? " st-row--idle" : ""}`}>
                  <span className="st-row__label">{short}</span>
                  <span className="st-bar st-bar--scaled">
                    <span className="st-bar__fill" style={{ width: `${acc ?? 0}%` }} />
                  </span>
                  <span className="st-row__val">
                    <em>{acc === null ? "—" : `${acc}%`}</em>
                    <span className="st-row__sub">{sub}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <span className="st-scale" aria-hidden="true">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </span>
        </div>
      </section>

      {/* ── Games by mode (the 3 validated mode colours) ── */}
      <section className="st-panel st-sec" aria-label="Games by mode">
        <h3 className="st-panel__title">Games by mode · {modeTotal} total</h3>
        <div className="st-modebar" role="img" aria-label={`${profile.modes.training} training, ${profile.modes.competition} competition, ${profile.modes.expert} expert`}>
          <span className="st-modebar__part" style={{ flexGrow: profile.modes.training, background: MODE_ACCENT.training }} />
          <span className="st-modebar__part" style={{ flexGrow: profile.modes.competition, background: MODE_ACCENT.competition }} />
          <span className="st-modebar__part" style={{ flexGrow: profile.modes.expert, background: MODE_ACCENT.expert }} />
        </div>
        <ul className="st-modelegend">
          <li><span className="st-modelegend__sw" style={{ background: MODE_ACCENT.training }} /><em>{profile.modes.training}</em> Training</li>
          <li><span className="st-modelegend__sw" style={{ background: MODE_ACCENT.competition }} /><em>{profile.modes.competition}</em> Competition</li>
          <li><span className="st-modelegend__sw" style={{ background: MODE_ACCENT.expert }} /><em>{profile.modes.expert}</em> Expert</li>
        </ul>
      </section>

      {/* ── Every way of seeing (per-axis detail) ── */}
      <section className="st-panel st-sec" aria-label="Every way of seeing">
        <h3 className="st-panel__title">Every way of seeing</h3>
        <ul className="st-axes">
          {eye.axes.map((a, i) => {
            const lit = a.paliers.filter((p) => p.state === "lit").length;
            const st = a.roadmap ? "roadmap" : a.state;
            return (
              <li key={a.id} className={`st-axis st-axis--${st}`}>
                <span className="st-axis__letter">{WORD[i]}</span>
                <span className="st-axis__name">{a.label}</span>
                <span className="st-axis__state">{a.roadmap ? "Roadmap" : a.state}</span>
                <span className="st-axis__bar">
                  <span className="st-axis__fill" style={{ width: `${Math.round(a.litRatio * 100)}%` }} />
                </span>
                <span className="st-axis__frac">
                  <em>{lit}</em>/{a.paliers.length}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── The arena — the SEPARATE competition layer (NIVEAU §8) ── */}
      <section className="st-panel st-sec st-arena" aria-label="The arena">
        <div className="st-arena__head">
          <h3 className="st-panel__title">The arena</h3>
          <span className="st-arena__tag">Competition · separate from your eye</span>
        </div>
        <div className="st-arena__grid">
          <div className="st-arena__rank">
            <span className="st-arena__rankname">
              {MOCK_ARENA.rank.charAt(0).toUpperCase() + MOCK_ARENA.rank.slice(1)}
            </span>
            <span className="st-arena__div">Division {MOCK_ARENA.division}</span>
          </div>
          <div className="st-arena__stat">
            <span className="st-arena__num">{MOCK_ARENA.elo}</span>
            <span className="st-arena__lbl">ELO rating</span>
          </div>
          <div className="st-arena__stat">
            <span className="st-arena__num">{MOCK_ARENA.weeklyPoints}</span>
            <span className="st-arena__lbl">points this week</span>
          </div>
        </div>
        <span className="st-panel__meta">Bronze → Diamond · this rank rises and falls — your eye never does.</span>
      </section>

      {/* ── Recent sessions ── */}
      <section className="st-panel st-sec" aria-label="Recent sessions">
        <h3 className="st-panel__title">Recent sessions</h3>
        <ul className="st-sessions">
          {profile.recentSessions.map((s) => (
            <li key={s.id} className="st-session">
              <span
                className="st-session__mode"
                style={{
                  borderColor: `color-mix(in srgb, ${MODE_ACCENT[s.mode] ?? "var(--pf-cream)"} 45%, transparent)`,
                  color: `color-mix(in srgb, ${MODE_ACCENT[s.mode] ?? "var(--pf-cream)"} 62%, var(--pf-cream))`,
                }}
              >
                {s.modeLabel}
              </span>
              <span className="st-session__detail">{s.detail}</span>
              <span className="st-session__acc">{s.accuracy}%</span>
              <span className="st-session__when">{s.when}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Badges — placeholder only (slots reserved, not built yet) ── */}
      <section className="st-panel st-sec" aria-label="Badges">
        <div className="st-arena__head">
          <h3 className="st-panel__title">Badges</h3>
          <span className="st-soon">Coming soon</span>
        </div>
        <div className="st-badges" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="st-badge-slot" />
          ))}
        </div>
        <span className="st-panel__meta">Earn stickers as your eye sharpens — reserved here for later.</span>
      </section>
    </div>
  );
}

const CSS = `
  .st {
    position: relative; isolation: isolate; width: 100%;
    display: grid; gap: clamp(1.1rem, 3vh, 2rem);
    padding: clamp(1.2rem, 3vw, 2.2rem) clamp(1rem, 4vw, 3rem) clamp(3rem, 8vh, 6rem);
  }
  .st-bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
  .st-bg .dw-stars { position: absolute; inset: 0; width: 100%; height: 100%; }

  .st.is-armed .st-sec { opacity: 0; transform: translateY(16px); }
  .st.is-armed.is-in .st-sec { opacity: 1; transform: none; transition: opacity 600ms ease, transform 700ms cubic-bezier(0.22, 1, 0.36, 1); }

  .st-intro { text-align: center; display: grid; gap: 0.45rem; justify-items: center; max-width: 52rem; margin: 0 auto; }
  .st-kicker { font-family: var(--pf-mono); font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .st-title { margin: 0; font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 640; letter-spacing: -0.04em; line-height: 1.02; color: var(--pf-cream); }
  .st-lede { margin: 0; max-width: 46ch; font-size: 0.86rem; line-height: 1.5; color: rgb(${CREAM} / 0.6); }

  /* KPI grid */
  .st-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: clamp(0.5rem, 1.2vw, 0.8rem); width: min(98%, 66rem); margin: 0 auto; }
  @media (max-width: 900px) { .st-kpis { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 540px) { .st-kpis { grid-template-columns: repeat(2, 1fr); } }
  .st-kpi {
    display: grid; gap: 0.22rem; padding: clamp(0.7rem, 1.5vw, 0.95rem);
    border: 1px solid rgb(${CREAM} / 0.1); border-radius: var(--radius);
    background: color-mix(in srgb, var(--pf-bg) 90%, transparent);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  }
  .st-kpi__value { font-size: clamp(1.2rem, 2.2vw, 1.55rem); font-weight: 660; letter-spacing: -0.03em; line-height: 1; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .st-kpi__label { font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.7); }
  .st-kpi__helper { font-family: var(--pf-mono); font-size: 0.52rem; letter-spacing: 0.03em; color: rgb(${CREAM} / 0.38); }

  /* panels + columns */
  .st-cols { display: grid; grid-template-columns: 1fr 1.4fr; gap: clamp(0.7rem, 1.6vw, 1.1rem); width: min(98%, 66rem); margin: 0 auto; }
  .st-cols--b { grid-template-columns: 1fr 1.2fr; }
  @media (max-width: 820px) { .st-cols, .st-cols--b { grid-template-columns: 1fr; } }
  .st-panel {
    width: min(98%, 66rem); margin: 0 auto;
    padding: clamp(1rem, 2.2vw, 1.4rem);
    border: 1px solid rgb(${CREAM} / 0.1); border-radius: var(--radius);
    background: color-mix(in srgb, var(--pf-bg) 90%, transparent);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  }
  .st-cols .st-panel { width: 100%; margin: 0; }
  .st-panel__title { margin: 0 0 0.9rem; font-family: var(--pf-mono); font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgb(${CREAM} / 0.58); }
  .st-panel__meta { display: block; margin-top: 0.8rem; font-family: var(--pf-mono); font-size: 0.64rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.42); font-variant-numeric: tabular-nums; }
  .st-panel__meta em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .st-dot { margin: 0 0.45rem; }

  /* Eye / level panel */
  .st-eye { display: flex; align-items: center; gap: clamp(0.9rem, 2.2vw, 1.5rem); }
  .st-eye__lvl { display: grid; justify-items: center; flex: none; }
  .st-eye__lvlnum { font-size: clamp(2.2rem, 5vw, 3rem); font-weight: 680; line-height: 1; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .st-eye__lvllabel { font-family: var(--pf-mono); font-size: 0.52rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .st-eye__main { flex: 1; display: grid; gap: 0.42rem; min-width: 0; }
  .st-eye__name { font-family: var(--pf-mono); font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgb(${CREAM} / 0.72); }
  .st-eye__xp { font-family: var(--pf-mono); font-size: 0.66rem; color: rgb(${CREAM} / 0.44); font-variant-numeric: tabular-nums; }
  .st-eye__xp em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .st-eye__foot { display: flex; gap: 1.4rem; margin-top: 1rem; padding-top: 0.9rem; border-top: 1px solid rgb(${CREAM} / 0.1); }
  .st-eye__stat { font-family: var(--pf-mono); font-size: 0.68rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.5); }
  .st-eye__stat em { font-style: normal; font-weight: 640; font-size: 0.92rem; color: var(--pf-cream); }
  .st-eye__main .st-bar__fill { background: var(--pf-cream); } /* XP fill — cream (no yellow here) */

  /* Palier breakdown — segmented bar + legend */
  .st-seg { display: flex; gap: 2px; height: 0.34rem; border-radius: var(--radius-pill); overflow: hidden; margin-bottom: 0.95rem; }
  .st-seg__part { flex-basis: 0; min-width: 0; border-radius: 2px; }
  .st-seg__part--lit { background: var(--pf-cream); }
  .st-seg__part--emerging { background: rgb(${CREAM} / 0.5); }
  .st-seg__part--dormant { background: rgb(${CREAM} / 0.2); }
  .st-seg__part--roadmap { background: repeating-linear-gradient(45deg, rgb(${CREAM} / 0.2) 0 3px, transparent 3px 6px); box-shadow: inset 0 0 0 1px rgb(${CREAM} / 0.16); }
  .st.is-armed .st-seg__part { transform: scaleX(0); transform-origin: left; }
  .st.is-armed.is-in .st-seg__part { transform: scaleX(1); transition: transform 800ms cubic-bezier(0.22, 1, 0.36, 1) 200ms; }
  .st-legend { display: flex; flex-wrap: wrap; gap: 0.5rem 1.1rem; margin: 0; padding: 0; list-style: none; }
  .st-legend li { display: inline-flex; align-items: center; gap: 0.42rem; font-family: var(--pf-mono); font-size: 0.66rem; color: rgb(${CREAM} / 0.55); }
  .st-legend em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .st-legend__sw { width: 0.62rem; height: 0.62rem; border-radius: 2px; flex: none; }
  .st-legend__sw--lit { background: var(--pf-cream); }
  .st-legend__sw--emerging { background: rgb(${CREAM} / 0.5); }
  .st-legend__sw--dormant { background: rgb(${CREAM} / 0.2); }
  .st-legend__sw--roadmap { background: repeating-linear-gradient(45deg, rgb(${CREAM} / 0.2) 0 2px, transparent 2px 4px); box-shadow: inset 0 0 0 1px rgb(${CREAM} / 0.16); }

  /* Per-axis detail list (Eye layer → yellow on the lit axes) */
  .st-axes { display: grid; gap: 0.6rem; margin: 0; padding: 0; list-style: none; }
  .st-axis { display: grid; grid-template-columns: 1.2rem minmax(0, 1fr) auto minmax(4rem, 7rem) 2.8rem; align-items: center; gap: 0.5rem 0.8rem; }
  .st-axis__letter { font-family: var(--pf-mono); font-weight: 700; font-size: 0.86rem; color: rgb(${CREAM} / 0.5); text-align: center; }
  .st-axis--lit .st-axis__letter { color: var(--pf-cream); }
  .st-axis__name { font-size: 0.82rem; color: rgb(${CREAM} / 0.84); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .st-axis--dormant .st-axis__name, .st-axis--roadmap .st-axis__name { color: rgb(${CREAM} / 0.5); }
  .st-axis__state { font-family: var(--pf-mono); font-size: 0.5rem; letter-spacing: 0.12em; text-transform: uppercase; padding: 0.12rem 0.45rem; border-radius: var(--radius-pill); border: 1px solid rgb(${CREAM} / 0.18); color: rgb(${CREAM} / 0.55); white-space: nowrap; }
  .st-axis--lit .st-axis__state { border-color: rgb(${CREAM} / 0.55); color: var(--pf-cream); }
  .st-axis--emerging .st-axis__state { border-color: rgb(${CREAM} / 0.36); color: rgb(${CREAM} / 0.8); }
  .st-axis--roadmap .st-axis__state { border-style: dashed; }
  .st-axis__bar { height: 0.4rem; border-radius: var(--radius-pill); background: rgb(${CREAM} / 0.1); overflow: hidden; }
  .st-axis__fill { display: block; height: 100%; border-radius: var(--radius-pill); background: rgb(${CREAM} / 0.5); }
  .st-axis--lit .st-axis__fill { background: rgb(${CREAM} / 0.85); }
  .st-axis__frac { font-family: var(--pf-mono); font-size: 0.7rem; color: rgb(${CREAM} / 0.55); text-align: right; font-variant-numeric: tabular-nums; }
  .st-axis__frac em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .st.is-armed .st-axis__fill { transform: scaleX(0); transform-origin: left; }
  .st.is-armed.is-in .st-axis__fill { transform: scaleX(1); transition: transform 800ms cubic-bezier(0.22, 1, 0.36, 1) 200ms; }
  @media (max-width: 560px) {
    .st-axis { grid-template-columns: 1.1rem 1fr auto; row-gap: 0.3rem; }
    .st-axis__bar { grid-column: 1 / -1; }
  }

  /* The arena — competition layer, orange accent (contour + faint, never aplat) */
  .st-arena { border-color: color-mix(in srgb, ${ORANGE} 30%, transparent); }
  .st-arena__head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem 1rem; flex-wrap: wrap; }
  .st-arena__head .st-panel__title { margin: 0; }
  .st-arena__tag { font-family: var(--pf-mono); font-size: 0.54rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.16rem 0.55rem; border-radius: var(--radius-pill); border: 1px solid color-mix(in srgb, ${ORANGE} 45%, transparent); background: color-mix(in srgb, ${ORANGE} 8%, transparent); color: color-mix(in srgb, ${ORANGE} 55%, var(--pf-cream)); }
  .st-arena__grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: clamp(0.8rem, 2vw, 1.4rem); align-items: center; margin-top: 1rem; }
  @media (max-width: 560px) { .st-arena__grid { grid-template-columns: 1fr 1fr; } }
  .st-arena__rank { display: grid; gap: 0.2rem; }
  .st-arena__rankname { font-size: clamp(1.3rem, 3vw, 1.7rem); font-weight: 680; letter-spacing: -0.02em; line-height: 1; color: var(--pf-cream); }
  .st-arena__div { font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .st-arena__stat { display: grid; gap: 0.16rem; }
  .st-arena__num { font-size: clamp(1.1rem, 2.4vw, 1.5rem); font-weight: 660; color: var(--pf-cream); font-variant-numeric: tabular-nums; line-height: 1; }
  .st-arena__lbl { font-family: var(--pf-mono); font-size: 0.52rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.45); }

  /* Games by mode — the 3 validated mode colours (contour-light legend) */
  .st-modebar { display: flex; gap: 2px; height: 0.4rem; border-radius: var(--radius-pill); overflow: hidden; margin-bottom: 0.85rem; }
  .st-modebar__part { flex-basis: 0; min-width: 0; opacity: 0.85; }
  .st-modelegend { display: flex; flex-wrap: wrap; gap: 0.5rem 1.2rem; margin: 0; padding: 0; list-style: none; }
  .st-modelegend li { display: inline-flex; align-items: center; gap: 0.42rem; font-family: var(--pf-mono); font-size: 0.66rem; color: rgb(${CREAM} / 0.6); }
  .st-modelegend em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .st-modelegend__sw { width: 0.62rem; height: 0.62rem; border-radius: 2px; flex: none; opacity: 0.9; }

  /* Badges — reserved placeholder slots (not built yet) */
  .st-soon { font-family: var(--pf-mono); font-size: 0.54rem; letter-spacing: 0.12em; text-transform: uppercase; padding: 0.16rem 0.55rem; border-radius: var(--radius-pill); border: 1px dashed rgb(${CREAM} / 0.22); color: rgb(${CREAM} / 0.45); }
  .st-badges { display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.6rem; margin: 1rem 0 0.2rem; }
  @media (max-width: 560px) { .st-badges { grid-template-columns: repeat(4, 1fr); } }
  .st-badge-slot { aspect-ratio: 1; border-radius: 50%; border: 1px dashed rgb(${CREAM} / 0.18); background: rgb(${CREAM} / 0.03); }

  /* Ring */
  .st-ringwrap { display: flex; align-items: center; gap: clamp(0.8rem, 2vw, 1.4rem); }
  .st-ring { width: clamp(7rem, 16vw, 9rem); height: auto; flex: none; }
  .st-ring__track { fill: none; stroke: rgb(${CREAM} / 0.1); stroke-width: 9; }
  .st-ring__arc { fill: none; stroke: var(--pf-cream); stroke-width: 9; stroke-linecap: round; }
  .st.is-armed .st-ring__arc { stroke-dasharray: 0 100 !important; }
  .st.is-armed.is-in .st-ring__arc { transition: stroke-dasharray 1100ms cubic-bezier(0.22, 1, 0.36, 1) 200ms; }
  .st-ring__pct { fill: var(--pf-cream); font-size: 24px; font-weight: 680; text-anchor: middle; dominant-baseline: middle; font-variant-numeric: tabular-nums; }
  .st-ring__sub { fill: rgb(${CREAM} / 0.5); font-family: var(--pf-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; text-anchor: middle; }
  .st-ring__legend { display: grid; gap: 0.3rem; }
  .st-ring__big { font-family: var(--pf-mono); font-size: 0.9rem; color: rgb(${CREAM} / 0.6); font-variant-numeric: tabular-nums; }
  .st-ring__big em { font-style: normal; font-size: 1.5rem; font-weight: 660; color: var(--pf-cream); }
  .st-ring__line { font-family: var(--pf-mono); font-size: 0.66rem; color: rgb(${CREAM} / 0.44); }

  /* Area chart */
  .st-area { width: 100%; height: clamp(4.5rem, 10vw, 6rem); display: block; overflow: visible; }
  .st-area__grid { stroke: rgb(${CREAM} / 0.08); stroke-width: 1; stroke-dasharray: 3 4; vector-effect: non-scaling-stroke; }
  .st-area__base { stroke: rgb(${CREAM} / 0.16); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .st-area__line { stroke: ${BLUE}; stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .st-area__dot { fill: var(--pf-cream); }
  .st.is-armed .st-area__fill, .st.is-armed .st-area__line, .st.is-armed .st-area__dot { opacity: 0; }
  .st.is-armed.is-in .st-area__fill, .st.is-armed.is-in .st-area__line, .st.is-armed.is-in .st-area__dot { opacity: 1; transition: opacity 700ms ease 250ms; }

  /* Radar */
  .st-panel--radar { display: grid; justify-items: center; }
  .st-radar { width: clamp(11rem, 26vw, 15rem); height: auto; overflow: visible; }
  .st-radar__ring { fill: none; stroke: rgb(${CREAM} / 0.1); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .st-radar__spoke { stroke: rgb(${CREAM} / 0.08); stroke-width: 1; vector-effect: non-scaling-stroke; }
  .st-radar__data { fill: rgb(${CREAM} / 0.16); stroke: var(--pf-cream); stroke-width: 1.6; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .st-radar__label { fill: rgb(${CREAM} / 0.42); font-family: var(--pf-mono); font-size: 10px; font-weight: 600; }
  .st-radar__label.is-full { fill: var(--pf-cream); }
  .st.is-armed .st-radar__data { transform: scale(0.05); transform-origin: 86px 86px; opacity: 0; }
  .st.is-armed.is-in .st-radar__data { transform: scale(1); opacity: 1; transition: transform 900ms cubic-bezier(0.22, 1, 0.36, 1) 200ms, opacity 500ms ease 200ms; }

  /* rows + bars */
  .st-rows { display: grid; gap: 0.7rem; margin: 0; padding: 0; list-style: none; }
  .st-row { display: grid; grid-template-columns: 6.5rem 1fr auto; align-items: center; gap: 0.8rem; }
  .st-row__label { font-size: 0.82rem; color: rgb(${CREAM} / 0.84); }
  .st-bar { position: relative; height: 0.5rem; border-radius: var(--radius-pill); background: rgb(${CREAM} / 0.1); overflow: hidden; }
  .st-bar--scaled {
    background-color: rgb(${CREAM} / 0.06);
    background-image: repeating-linear-gradient(to right, rgb(${CREAM} / 0.16) 0 1px, transparent 1px 25%);
  }
  .st-bar__fill { position: absolute; inset: 0 auto 0 0; height: 100%; border-radius: var(--radius-pill); background: var(--pf-cream); }
  .st.is-armed .st-bar__fill { transform: scaleX(0); transform-origin: left; }
  .st.is-armed.is-in .st-bar__fill { transform: scaleX(1); transition: transform 850ms cubic-bezier(0.22, 1, 0.36, 1) 200ms; }
  .st-row__val { text-align: right; display: grid; gap: 0.04rem; min-width: 4rem; padding-left: 1.1rem; font-variant-numeric: tabular-nums; }
  .st-row__val em { font-style: normal; font-family: var(--pf-mono); font-size: 0.8rem; font-weight: 640; color: var(--pf-cream); }
  .st-row__sub { font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.03em; color: rgb(${CREAM} / 0.4); }
  .st-row--idle .st-row__label { color: rgb(${CREAM} / 0.45); }
  .st-row--idle .st-row__val em { color: rgb(${CREAM} / 0.45); }
  .st-scale { display: flex; justify-content: space-between; margin-top: 0.6rem; padding-left: 7.3rem; font-family: var(--pf-mono); font-size: 0.56rem; color: rgb(${CREAM} / 0.32); }

  /* sessions */
  .st-sessions { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
  .st-session { display: grid; grid-template-columns: 8rem 1fr auto auto; align-items: center; gap: 0.9rem; padding: 0.65rem 0; border-top: 1px solid rgb(${CREAM} / 0.08); }
  .st-session:first-child { border-top: none; }
  .st-session__mode { justify-self: start; font-family: var(--pf-mono); font-size: 0.56rem; letter-spacing: 0.12em; text-transform: uppercase; padding: 0.18rem 0.5rem; border: 1px solid rgb(${CREAM} / 0.2); border-radius: var(--radius-pill); color: rgb(${CREAM} / 0.7); }
  .st-session__detail { font-size: 0.82rem; color: rgb(${CREAM} / 0.82); }
  .st-session__acc { font-family: var(--pf-mono); font-size: 0.8rem; font-weight: 640; color: var(--pf-cream); font-variant-numeric: tabular-nums; }
  .st-session__when { font-family: var(--pf-mono); font-size: 0.64rem; color: rgb(${CREAM} / 0.42); text-align: right; min-width: 5rem; }
  @media (max-width: 560px) {
    .st-session { grid-template-columns: 1fr auto; row-gap: 0.2rem; }
    .st-session__detail { grid-column: 1 / -1; }
    .st-scale { padding-left: 0; }
    .st-row { grid-template-columns: 5rem 1fr auto; }
  }

  @media (prefers-reduced-motion: reduce) {
    .st.is-armed.is-in .st-sec,
    .st.is-armed.is-in .st-bar__fill,
    .st.is-armed.is-in .st-ring__arc,
    .st.is-armed.is-in .st-radar__data,
    .st.is-armed.is-in .st-area__fill,
    .st.is-armed.is-in .st-area__line,
    .st.is-armed.is-in .st-area__dot,
    .st.is-armed.is-in .st-seg__part,
    .st.is-armed.is-in .st-axis__fill { transition: none; }
  }
`;
