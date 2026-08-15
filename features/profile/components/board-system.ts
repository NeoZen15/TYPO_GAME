// The board system of the profile: the recipes every board on `.pf-page` reads.
//
// WHY IT LEFT StatsBoard.tsx (2026-08-15). The competition recap was rebuilt on
// the Stats tab's art direction by COPYING its values under a prefix of its own.
// The owner named the result for what it was: a variant. It matched on the day
// it was written, it drifted at the first adjustment, and everything not copied
// stayed visibly from the old art direction. So the recipes now live here, once,
// and every board that wants this world imports them and uses THESE class names.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: no length, colour or weight of this
// system may be declared twice in the repo. A board needing something this file
// does not have adds it HERE, so every other board gets it too.
//
// Lifted byte for byte out of StatsBoard, so the profile renders exactly as it
// did. The `st-` prefix is kept for the same reason: renaming it would have
// touched every line of the validated page for no visual gain.

// Theme-adaptive ink, flips beige to warm-noir with the theme.
export const CREAM = "from var(--pf-cream) r g b";
// Validated /play palette, used lightly (contour + faint fill, never an aplat).
export const ORANGE = "#ff934a"; // competition → the arena
export const BLUE = "#58a9ff"; // the 3rd accent → activity over time

/**
 * One colour per mode, the validated /play palette. It lived in StatsBoard,
 * which paints the modes bar and the session chips with it. The recaps need the
 * same three, and this file's rule is that a value of this system is declared
 * once, so it moved here.
 */
export const MODE_ACCENT: Record<string, string> = {
  training: "#40d38f", // green
  competition: "#ff934a", // orange
  expert: "#58a9ff", // blue
};

export const BOARD_SYSTEM_CSS = `
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
  /* The accent panel. It was hardwired to orange because the profile's only use
     of it is the competition arena. A recap wears its own mode's colour, so the
     hue becomes a variable that FALLS BACK to exactly what was there: the
     profile sets nothing and renders the same, a recap sets --st-accent on its
     root and the panel inherits it. The fallback lives in the usage, not as a
     declaration on .st-arena, since declaring it here would beat the inherited
     value and every mode would come out orange.
     Ratios unchanged (30% contour, 45% tag border, 8% wash, 55% ink), which is
     the system's rule for this palette: contour and faint fill, never an aplat. */
  .st-arena { border-color: color-mix(in srgb, var(--st-accent, ${ORANGE}) 30%, transparent); }
  .st-arena__head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem 1rem; flex-wrap: wrap; }
  .st-arena__head .st-panel__title { margin: 0; }
  .st-arena__tag { font-family: var(--pf-mono); font-size: 0.54rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.16rem 0.55rem; border-radius: var(--radius-pill); border: 1px solid color-mix(in srgb, var(--st-accent, ${ORANGE}) 45%, transparent); background: color-mix(in srgb, var(--st-accent, ${ORANGE}) 8%, transparent); color: color-mix(in srgb, var(--st-accent, ${ORANGE}) 55%, var(--pf-cream)); }
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

  /* One-screen variant. The profile is a page you browse, so .st stacks and
     scrolls. The end of a session is a verdict you read at a glance, and a
     player who has to scroll to find the buttons has lost the thread. This
     holds the whole board inside the viewport and pins the action row at the
     bottom of it. Content that does not fit belongs on the profile, not here. */
  .st--screen {
    /* Centred, not stretched. On a tall screen space-between would push a
       hundred pixels between every block and the four would stop reading as one
       verdict. Centring keeps the group tight and still leaves the actions
       inside the viewport, which is the whole point. */
    min-height: 100svh; align-content: center;
    /* .st reserves up to 6rem at the bottom so a scrolling page does not end
       abruptly. Here nothing scrolls, so that reserve is pure overflow: on a
       phone it alone pushed the actions under the fold. Symmetric instead. */
    padding-bottom: clamp(1.2rem, 3vw, 2.2rem);
  }
  .st-kpis--four { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 900px) { .st-kpis--four { grid-template-columns: repeat(2, 1fr); } }
  /* On a phone the two panels stack and the columns stop paying for
     themselves, so the list gives up its last row rather than the type gives up
     its size. Scoped to the variant: the profile's own lists keep every row. */
  @media (max-width: 560px) {
    .st--screen .st-sessions .st-session:nth-child(n + 3) { display: none; }
    /* Same trade on a phone: the panel's qualifying figures wrap onto two lines
       there and push the actions under the fold. They give way, the type does
       not, and the profile carries them anyway. */
    .st--screen .st-arena .st-eye__foot { display: none; }
  }

  /* Action row. The one recipe this system did not have: the profile reads, it
     never asks for a decision, so nothing here needed a button until the end of
     a session did. Added HERE rather than in the recap, per this file's rule, so
     the training recap inherits it. Every value is one the system already uses:
     the mono caps of .st-panel__title, the hairline and pill of
     .st-session__mode, the section width of .st-panel, the grid gap of .st-kpis.
     Only the button's own padding is new, because a button is new. */
  .st-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: clamp(0.5rem, 1.2vw, 0.8rem); width: min(98%, 66rem); margin: 0 auto; }
  .st-action {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 11rem; padding: 0.75rem 1.5rem;
    border: 1px solid rgb(${CREAM} / 0.2); border-radius: var(--radius-pill);
    font-family: var(--pf-mono); font-size: 0.66rem; font-weight: 640;
    letter-spacing: 0.14em; text-transform: uppercase; line-height: 1;
    color: var(--pf-cream); background: transparent; text-decoration: none; cursor: pointer;
    transition: border-color 200ms ease, background-color 200ms ease;
  }
  .st-action:hover, .st-action:focus-visible { border-color: rgb(${CREAM} / 0.5); background: rgb(${CREAM} / 0.06); }
  .st-action--primary { border-color: transparent; background: var(--pf-cream); color: var(--pf-bg); }
  .st-action--primary:hover, .st-action--primary:focus-visible { border-color: transparent; background: rgb(${CREAM} / 0.86); }
  .st-action:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: 3px; }

  @media (prefers-reduced-motion: reduce) {
    .st-action { transition: none; }
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
