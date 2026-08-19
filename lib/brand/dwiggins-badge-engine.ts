// Dwiggins badge engine — shippable, pure SVG-string builders.
//
// Extracted verbatim from the dev Badge Collection Lab so the SAME badge
// system can be reused outside /dev (the profile Arena blason, Achievements…).
// These functions return raw SVG inner-HTML strings (injected via
// dangerouslySetInnerHTML). The dev lab (`components/dev/badges/BadgeStickerLab`)
// now imports from here too — one source of truth, no divergence.
//
//  - RARITY VALUE (CoD-style): each badge = a concrete achievement; the FINISH
//    escalates: COMMON flat ivory · RARE flat blue · EPIC silver medallion ·
//    LEGENDARY gold medallion · MYTHIC holographic. High tiers are real 3D
//    medallions (domed shading, rim highlight, a light reflection sweeping
//    left→right) + glow / sparkles. Differentiation = design + material.
//
// The artwork (`Art`) is the REAL Dwiggins logo, loaded server-side from
// public/brand via `lib/brand/brand-art.ts` — no hand-copied path data.

export type Art = { symbol: string; dwig: string; full: string; folder: string; figures: string };

export type Tier = "common" | "rare" | "epic" | "legendary" | "mythic";
export type Shape =
  | "circle" | "ellipse" | "rrect" | "square" | "pill" | "arch" | "shield" | "hexagon" | "diamond" | "rosette" | "folder";
export type Layout =
  | "symbol" | "dwig" | "full" | "mono" | "symFull" | "seal" | "orbit" | "retro" | "repeat" | "stamp" | "tagline" | "phrase";
export type Badge = {
  name: string;
  tier: Tier;
  shape: Shape;
  layout: Layout;
  glyph?: string;
  ring?: string;
  line?: boolean;
  keyline?: boolean;
  text?: string;
};
export type Editorial = {
  name: string;
  tier: Tier;
  kind: "lockup" | "orbit";
  title: string;
  dl?: string;
  dr?: string;
  strip?: string[];
};

export const INK = "#f4f3ee";
export const BLACK = "#0d0d0f";
export const BLUE = "#58a9ff";
export const FR = "'PP Frama', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
export const COND = "'Arial Narrow','Helvetica Neue',Arial,sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// editorial title size, faithful to the 119.787px DWIGGINS down-scaled by length
const tsize = (t: string) => (t.length <= 3 ? 119.787 : t.length <= 6 ? 98 : t.length <= 8 ? 80 : 62);
const Et = (
  tx: number, ty: number, s: string, fs: number, w: number, fill: string,
  st = "italic", anchor = "start", ls = 0,
) =>
  `<text transform="translate(${tx} ${ty})" font-family="${FR}" font-weight="${w}" font-style="${st}" font-size="${fs}" letter-spacing="${ls}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

// rarity → editorial colours (content metallised on a black panel)
export const EDIT_TIER: Record<Tier, { panel: string; content: string }> = {
  common: { panel: "#0d0d0f", content: "#f4f3ee" },
  rare: { panel: "#0d0d0f", content: "#58a9ff" },
  epic: { panel: "#0d0d0f", content: "url(#silver)" },
  legendary: { panel: "#0d0d0f", content: "url(#gold)" },
  mythic: { panel: "#0d0d0f", content: "url(#holo)" },
};

// EXACT layout from dwiggins-lockup / system-orbit panels — only the words + colour change
export function buildEditorial(b: Editorial, art: Art): string {
  const C = EDIT_TIER[b.tier];
  if (b.kind === "orbit") {
    const ell = [274.165, 421.292, 567.725]
      .map((cx) => `<ellipse cx="${cx}" cy="215.668" rx="113.184" ry="70.903" fill="none" stroke="${C.content}" stroke-opacity="0.35"/>`)
      .join("");
    const sx = [267.179, 329.983, 397.344, 488.023, 528.76];
    const strip = (b.strip ?? ["METRIC", "SYSTEM", "STRUCTURE", "AXIS", "ALIGN"])
      .map((w, i) => Et(sx[i] ?? 267, 308.175, w, 10, 200, C.content, "normal"))
      .join("");
    return `<path d="${art.folder}" fill="${C.panel}" stroke="rgba(244,243,238,0.16)" stroke-width="2.5"/>${ell}${Et(421, 246.829, b.title, 75.02, 800, C.content, "italic", "middle")}${strip}`;
  }
  return `<path d="${art.folder}" fill="${C.panel}" stroke="rgba(244,243,238,0.16)" stroke-width="2.5"/>
    <g fill="${C.content}">${art.figures}</g>
    ${Et(747.56, 137.281, "©", 47.353, 800, C.content)}
    ${Et(45.029, 295.932, b.title, tsize(b.title), 800, C.content)}
    ${Et(41.675, 331.599, b.dl ?? "FORM RECOGNITION", 16.144, 200, C.content, "normal")}
    ${Et(565.346, 331.688, b.dr ?? "STRUCTURE SYSTEM", 16.144, 200, C.content, "normal")}`;
}

type PlaceKey = "symbol" | "dwig" | "full";
const CROP: Record<PlaceKey, string> = { symbol: "84.4 82 673 486.9", dwig: "120 0 645 200", full: "44 44 760 124" };
const GLYPH_VB: Record<string, string> = { D: "113 14 176 172", W: "296 14 227 172", I: "493 14 93 172", G: "577 14 173 172" };

export const TIERS: Record<
  Tier,
  { label: string; drop: string; note: string; discFill: string; logoFill: string; medallion: boolean; glow: string | null; sparkle: boolean; lab: string }
> = {
  common: { label: "COMMON", drop: "70%", note: "plat — ivoire", discFill: BLACK, logoFill: INK, medallion: false, glow: null, sparkle: false, lab: "#8d8d94" },
  rare: { label: "RARE", drop: "20%", note: "plat — bleu", discFill: BLACK, logoFill: BLUE, medallion: false, glow: null, sparkle: false, lab: BLUE },
  epic: { label: "EPIC", drop: "7%", note: "médaillon argent 3D", discFill: "url(#silver)", logoFill: BLACK, medallion: true, glow: null, sparkle: false, lab: "#cfd2dc" },
  legendary: { label: "LEGENDARY", drop: "2.5%", note: "médaillon or 3D — halo pulsé", discFill: "url(#gold)", logoFill: BLACK, medallion: true, glow: "glowGold", sparkle: false, lab: "#ffd76b" },
  mythic: { label: "MYTHIC", drop: "0.5%", note: "logo holographique — glow + éclats", discFill: BLACK, logoFill: "url(#holo)", medallion: false, glow: "glowHolo", sparkle: true, lab: "#a9e4ff" },
};
export const ORDER: Tier[] = ["common", "rare", "epic", "legendary", "mythic"];

const FIT: Record<Shape, number> = { circle: 0.84, ellipse: 0.92, rrect: 0.92, square: 0.86, pill: 0.86, arch: 0.8, shield: 0.72, hexagon: 0.76, diamond: 0.62, rosette: 0.64, folder: 0.66 };
const M = 6;
export const VBW = 210;
export const VBH = 196;

// ---- builders ---------------------------------------------------------------

function place(art: Art, key: PlaceKey, x: number, y: number, w: number, h: number, fill: string, line?: boolean) {
  const g = line ? `<g fill="none" stroke="${fill}" stroke-width="8" stroke-linejoin="round">` : `<g fill="${fill}">`;
  return `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${CROP[key]}" preserveAspectRatio="xMidYMid meet">${g}${art[key]}</g></svg>`;
}
function placeRaw(raw: string, vb: string, x: number, y: number, w: number, h: number, fill: string) {
  return `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet"><g fill="${fill}">${raw}</g></svg>`;
}
// HVNTER-style die-cut sticker: stacked strokes = white die-cut + black keyline + colour fill on top
function placeKeyline(art: Art, key: PlaceKey, cx: number, cy: number, w: number, h: number, fill: string, line?: boolean) {
  const x = cx - w / 2, y = cy - h / 2;
  const lay = (col: string, sw: number, filled: boolean) =>
    `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${CROP[key]}" preserveAspectRatio="xMidYMid meet"><g fill="${filled ? col : "none"}" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round">${art[key]}</g></svg>`;
  return line
    ? lay(INK, 58, false) + lay(BLACK, 40, false) + lay(fill, 16, false)
    : lay(INK, 58, true) + lay(BLACK, 30, true) + lay(fill, 0, true);
}
function rosettePath(cx: number, cy: number, rO: number, rI: number, pts: number) {
  let d = "";
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 ? rI : rO;
    const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
    d += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(1) + " " + (cy + r * Math.sin(a)).toFixed(1) + " ";
  }
  return d + "Z";
}
function shapeEl(shape: Shape, cx: number, cy: number, hw: number, hh: number, style: string, folderD = ""): string {
  switch (shape) {
    case "circle": return `<circle cx="${cx}" cy="${cy}" r="${Math.min(hw, hh)}" ${style}/>`;
    case "ellipse": return `<ellipse cx="${cx}" cy="${cy}" rx="${hw}" ry="${hh}" ${style}/>`;
    case "rrect": return `<rect x="${cx - hw}" y="${cy - hh}" width="${2 * hw}" height="${2 * hh}" rx="14" ${style}/>`;
    case "square": { const s = Math.min(hw, hh); return `<rect x="${cx - s}" y="${cy - s}" width="${2 * s}" height="${2 * s}" rx="16" ${style}/>`; }
    case "pill": return `<rect x="${cx - hw}" y="${cy - hh}" width="${2 * hw}" height="${2 * hh}" rx="${hh}" ${style}/>`;
    case "arch": { const r = hw; return `<path d="M ${cx - hw} ${cy + hh} L ${cx - hw} ${cy - hh + r} A ${r} ${r} 0 0 1 ${cx + hw} ${cy - hh + r} L ${cx + hw} ${cy + hh} Z" ${style}/>`; }
    case "shield": return `<path d="M ${cx - hw} ${cy - hh} L ${cx + hw} ${cy - hh} L ${cx + hw} ${cy - hh * 0.1} Q ${cx + hw} ${cy + hh} ${cx} ${cy + hh} Q ${cx - hw} ${cy + hh} ${cx - hw} ${cy - hh * 0.1} Z" ${style}/>`;
    case "hexagon": return `<polygon points="${cx - hw / 2},${cy - hh} ${cx + hw / 2},${cy - hh} ${cx + hw},${cy} ${cx + hw / 2},${cy + hh} ${cx - hw / 2},${cy + hh} ${cx - hw},${cy}" ${style}/>`;
    case "diamond": return `<polygon points="${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}" ${style}/>`;
    case "rosette": return `<path d="${rosettePath(cx, cy, Math.min(hw, hh), Math.min(hw, hh) * 0.84, 20)}" ${style}/>`;
    case "folder": { const sc = (2 * hw) / 841.89, fh = 392.618 * sc; return `<g transform="translate(${(cx - hw).toFixed(1)} ${(cy - fh / 2).toFixed(1)}) scale(${sc.toFixed(4)})"><path d="${folderD}" ${style}/></g>`; }
  }
}
function ringText(cx: number, cy: number, r: number, str: string, fs: number, fill: string, start = -118) {
  const step = ((fs * 0.6) / r) * (180 / Math.PI);
  let a = start, s = "";
  for (const ch of str) {
    const rad = (a * Math.PI) / 180, x = cx + r * Math.sin(rad), y = cy - r * Math.cos(rad);
    s += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${COND}" font-size="${fs}" font-weight="700" fill="${fill}" text-anchor="middle" transform="rotate(${a.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${ch}</text>`;
    a += step;
  }
  return s;
}
const txt = (x: number, y: number, s: string, fs: number, w: number, fill: string, ls = 0) =>
  `<text x="${x}" y="${y}" font-family="${COND}" font-size="${fs}" font-weight="${w}" letter-spacing="${ls}" fill="${fill}" text-anchor="middle">${s}</text>`;
const txtStroke = (x: number, y: number, s: string, fs: number, w: number, col: string, sw: number) =>
  `<text x="${x}" y="${y}" font-family="${COND}" font-size="${fs}" font-weight="${w}" letter-spacing="0.5" text-anchor="middle" fill="${col}" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round" paint-order="stroke">${s}</text>`;
function starEl(cx: number, cy: number, r: number, fill: string, delay: number) {
  let d = "";
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.4 : r;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    d += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(1) + " " + (cy + rr * Math.sin(a)).toFixed(1) + " ";
  }
  return `<path d="${d}Z" fill="${fill}"><animate attributeName="opacity" values="0.15;1;0.15" dur="1.9s" begin="${delay}s" repeatCount="indefinite"/></path>`;
}

// Derive the four short-wordmark glyphs (D/W/I/G) from the real logo paths.
export function deriveGlyphs(artDwig: string): Record<string, string> {
  const p = artDwig.match(/<path[^>]*\/>/g) ?? [];
  return { D: p[0] ?? "", W: p[1] ?? "", I: p[2] ?? "", G: p[3] ?? "" } as Record<string, string>;
}

export function buildBadge(b: Badge, art: Art, glyph: Record<string, string>, idx: number): string {
  const T = TIERS[b.tier], cx = VBW / 2, cy = VBH / 2, HW = VBW / 2 - 18, HH = VBH / 2 - 18, f = FIT[b.shape];
  const discFill = T.discFill;
  const logoFill = T.logoFill;
  // shapeEl wrapper that threads the folder path (folder shape needs it).
  const se = (shape: Shape, x: number, y: number, hw: number, hh: number, style: string) =>
    shapeEl(shape, x, y, hw, hh, style, art.folder);
  let s = "";

  // HVNTER die-cut sticker (no disc): chunky keyline + white die-cut + shadow
  if (b.keyline) {
    let k = "";
    if (b.layout === "phrase") {
      const lines = (b.text ?? "DWIGGINS").split("|");
      const fs = lines.length > 1 ? 34 : 44, gap = fs * 1.02, y0 = cy - ((lines.length - 1) * gap) / 2 + fs * 0.34;
      let inner = "";
      ([[INK, 16], [BLACK, 9], [logoFill, 0]] as [string, number][]).forEach(([col, sw]) =>
        lines.forEach((ln, i) => (inner += txtStroke(cx, y0 + i * gap, ln, fs, 800, col, sw))),
      );
      k = `<g filter="url(#ds)">${inner}</g>`;
    } else {
      const w = VBW * 0.74, h = VBH * 0.74;
      k = `<g filter="url(#ds)">${placeKeyline(art, "symbol", cx, cy, w, h, logoFill, b.line)}</g>`;
    }
    if (T.sparkle) k += starEl(cx + HW * 0.62, cy - HH * 0.5, 9, "url(#holo)", 0) + starEl(cx - HW * 0.6, cy + HH * 0.46, 6, "url(#holo)", 0.7);
    return k;
  }

  if (T.glow) s += `<g><animate attributeName="opacity" values="0.5;1;0.5" dur="2.6s" repeatCount="indefinite"/>${se(b.shape, cx, cy, HW, HH, `fill="${BLACK}" filter="url(#${T.glow})"`)}</g>`;
  s += `<g filter="url(#sh)">${se(b.shape, cx, cy, HW + M, HH + M, `fill="${INK}"`)}${se(b.shape, cx, cy, HW, HH, `fill="${discFill}"`)}</g>`;

  // 3D medallion (epic/legendary): domed shading + rim highlight + light reflection sweeping left→right
  if (T.medallion) {
    s += se(b.shape, cx, cy, HW, HH, `fill="url(#dome)"`);
    s += se(b.shape, cx, cy, HW - 5, HH - 5, `fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"`);
    s += `<clipPath id="clip-${idx}">${se(b.shape, cx, cy, HW, HH, "")}</clipPath>`;
    s += `<g clip-path="url(#clip-${idx})"><g transform="rotate(16 ${cx} ${cy})"><rect x="${cx - 175}" y="${cy - HH - 28}" width="46" height="${2 * HH + 56}" fill="url(#sweep)" opacity="0.6"><animate attributeName="x" values="${cx - 175};${cx + 175};${cx + 175}" keyTimes="0;0.5;1" dur="3.8s" begin="${(idx % 6) * 0.4}s" repeatCount="indefinite"/></rect></g></g>`;
  }

  let bw = 2 * HW * f, bh = 2 * HH * f, bx = cx - bw / 2, by = cy - bh / 2 - (b.shape === "arch" ? HH * 0.12 : 0);
  if (b.shape === "folder") { const fh = (392.618 * (2 * HW)) / 841.89; bw = 2 * HW * 0.62; bh = fh * 0.6; bx = cx - bw / 2; by = cy - bh / 2; }
  const R = Math.min(HW, HH);
  const L = b.layout, fill = logoFill;
  if (L === "symbol") s += place(art, "symbol", bx, by, bw, bh, fill, b.line);
  else if (L === "dwig") s += place(art, "dwig", bx, by, bw, bh, fill);
  else if (L === "full") s += place(art, "full", bx + bw * 0.06, by, bw * 0.88, bh, fill);
  else if (L === "mono") { const sc = 0.62, mw = 2 * HW * sc, mh = 2 * HH * sc, gk = b.glyph ?? "D"; s += placeRaw(glyph[gk] ?? "", GLYPH_VB[gk] ?? "", cx - mw / 2, cy - mh / 2, mw, mh, fill); }
  else if (L === "symFull") s += place(art, "symbol", bx + bw * 0.12, by, bw * 0.76, bh * 0.56, fill) + place(art, "full", bx, by + bh * 0.64, bw, bh * 0.28, fill);
  else if (L === "orbit") s += place(art, "symbol", bx + bw * 0.08, by + bh * 0.06, bw * 0.84, bh * 0.88, fill) + `<ellipse cx="${cx}" cy="${cy}" rx="${HW * 0.92}" ry="${HH * 0.42}" fill="none" stroke="${fill}" stroke-width="4" transform="rotate(-22 ${cx} ${cy})"/>`;
  else if (L === "retro") { let bars = ""; for (let i = 0; i < 4; i++) bars += `<rect x="${cx - bw / 2}" y="${cy - 26 + i * 13}" width="${bw}" height="6" rx="3" fill="${fill}" opacity="${0.3 + i * 0.06}"/>`; s += bars + place(art, "dwig", bx, by + bh * 0.16, bw, bh * 0.6, fill); }
  else if (L === "repeat") { for (let i = 0; i < 4; i++) s += txt(cx, cy - 22 + i * 18, "DWIGGINS", 16, 800, fill, 1); }
  else if (L === "stamp") s += ringText(cx, cy, R - 16, "DWIGGINS ", 12, fill, -52) + txt(cx, cy + 6, "EST.", 15, 700, fill, 1) + txt(cx, cy + 30, "2026", 30, 800, fill, 1) + place(art, "symbol", cx - 34, cy + 34, 68, 30, fill);
  else if (L === "tagline") s += place(art, "symbol", bx + bw * 0.18, by, bw * 0.64, bh * 0.46, fill) + place(art, "full", bx + bw * 0.04, by + bh * 0.5, bw * 0.92, bh * 0.22, fill) + `<line x1="${cx - bw * 0.34}" y1="${by + bh * 0.82}" x2="${cx + bw * 0.34}" y2="${by + bh * 0.82}" stroke="${fill}" stroke-width="1.4"/>` + txt(cx, by + bh * 0.97, "JEUX DE TYPO", 11, 700, fill, 2);
  else if (L === "seal") s += ringText(cx, cy, R - 20, b.ring || "· DWIGGINS · LEGENDE ", 11, fill) + place(art, "symbol", cx - R * 0.5, cy - R * 0.38, R, R * 0.52, fill) + txt(cx, cy + R * 0.46, "N°1", 14, 800, fill, 1);
  else if (L === "phrase") { const lines = (b.text ?? "DWIGGINS").split("|"); const fs = lines.length > 1 ? 30 : 38, gap = fs * 1.04, y0 = cy - ((lines.length - 1) * gap) / 2 + fs * 0.34; lines.forEach((ln, i) => (s += txt(cx, y0 + i * gap, ln, fs, 800, fill, 0.5))); }

  if (T.sparkle) s += starEl(cx + HW * 0.6, cy - HH * 0.56, 9, INK, 0) + starEl(cx - HW * 0.58, cy + HH * 0.48, 6, INK, 0.6) + starEl(cx + HW * 0.5, cy + HH * 0.6, 5, INK, 1.1);
  return s;
}

export const DEFS = `
<linearGradient id="gold" x1="0" y1="0" x2="0.55" y2="1">
  <stop offset="0" stop-color="#f5e6b0"/><stop offset="0.34" stop-color="#d9b65a"/><stop offset="0.54" stop-color="#9c7a2e"/><stop offset="0.72" stop-color="#ecd690"/><stop offset="1" stop-color="#b8923c"/>
</linearGradient>
<linearGradient id="silver" x1="0" y1="0" x2="0.55" y2="1">
  <stop offset="0" stop-color="#f7f8fc"/><stop offset="0.34" stop-color="#c6cad4"/><stop offset="0.54" stop-color="#878b99"/><stop offset="0.72" stop-color="#e4e7ee"/><stop offset="1" stop-color="#a3a7b5"/>
</linearGradient>
<linearGradient id="holo" x1="0" y1="0" x2="1" y2="1" spreadMethod="reflect">
  <stop offset="0" stop-color="#a7ecff"/><stop offset="0.25" stop-color="#cdb6ff"/><stop offset="0.5" stop-color="#ffc2ec"/><stop offset="0.72" stop-color="#c4ffd6"/><stop offset="1" stop-color="#fff3a8"/>
  <animateTransform attributeName="gradientTransform" type="translate" values="-0.5 0;0.5 0;-0.5 0" dur="3.6s" repeatCount="indefinite"/>
</linearGradient>
<radialGradient id="dome" cx="0.5" cy="0.3" r="0.78">
  <stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#000" stop-opacity="0.26"/>
</radialGradient>
<linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
</linearGradient>
<filter id="sh" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#000" flood-opacity="0.5"/></filter>
<filter id="ds" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#000" flood-opacity="0.45"/></filter>
<filter id="glowGold" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#e6b53c" flood-opacity="0.85"/></filter>
<filter id="glowHolo" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#9fe9ff" flood-opacity="0.85"/></filter>`;
