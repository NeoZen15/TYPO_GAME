"use client";

import { useEffect, useRef } from "react";
import StarField from "@/features/profile/components/StarField";
import {
  BLUE,
  BOARD_SYSTEM_CSS,
  MODE_ACCENT,
} from "@/features/profile/components/board-system";
import { MOCK_ARENA, type EyeProfile, type PlayerProfile } from "@/lib/profile/mock-profile";

// ---------------------------------------------------------------------------
// Stats — same DA as the DWIGGINS map (black + beige, mono, fixed starfield),
// but built as real data-viz: a progress RING (catalogue), an area CHART
// (activity), a RADAR of the 8 axes (labelled D·W·I·G·G·I·N·S — ties to the
// map), and scaled BARS (accuracy). Monochrome — colour stays out.
// ---------------------------------------------------------------------------

// The recipes this board is built from now live in board-system.ts, so the
// recaps can use THE SAME classes rather than lookalikes, and the mode palette
// went with them: the recaps wear it too, and it is declared once.
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
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />

      <div className="st-bg" aria-hidden="true">
        <StarField />
      </div>

      <header className="st-intro st-sec">
        <span className="st-kicker">Your training</span>
        <h1 className="st-title">The numbers.</h1>
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

