"use client";

/**
 * Badge Collection Lab — DEV ONLY scratch surface.
 *
 *  - PLURALITY: many distinct designs (shape × lockup × treatment — symbol, monogram,
 *    wordmark, orbit, retro, repeat, stamp, line-art, tagline, seal, rosette…), all
 *    built from the real Dwiggins logo. We prune badge-by-badge later.
 *  - RARITY VALUE (CoD-style): each badge = a concrete achievement; difficulty fixes its
 *    tier; the FINISH escalates: COMMON flat ivory · RARE flat blue · EPIC silver medallion
 *    · LEGENDARY gold medallion · MYTHIC holographic. High tiers are real 3D medallions
 *    (domed shading, rim highlight, a light reflection sweeping left→right) + glow / sparkles.
 *    Differentiation = design + material, never a plain hue swap. Animations are screen-only.
 *
 * NOTE: rough pass — graphic glitches remain, to be refined per badge.
 *
 * The badge ENGINE (builders, tiers, defs, types) now lives in the shippable
 * module `@/lib/brand/dwiggins-badge-engine` so the SAME system can be reused
 * outside /dev (the profile Arena blason, Achievements…). This file is only the
 * dev gallery shell + the candidate badge list.
 */

import { useMemo, useState } from "react";
import {
  buildBadge,
  buildEditorial,
  deriveGlyphs,
  DEFS,
  ORDER,
  TIERS,
  VBW,
  VBH,
  INK,
  BLACK,
  COND,
  type Art,
  type Badge,
  type Editorial,
} from "@/lib/brand/dwiggins-badge-engine";

const YELLOW = "#ffd213";

const EDITORIAL: Editorial[] = [
  { name: "Lockup maître", tier: "common", kind: "lockup", title: "DWIGGINS", dl: "FORM RECOGNITION", dr: "STRUCTURE SYSTEM" },
  { name: "Série de 100 jours", tier: "legendary", kind: "lockup", title: "100", dl: "STREAK SYSTEM", dr: "DAY COUNT" },
  { name: "Maître typographe", tier: "epic", kind: "lockup", title: "MASTER", dl: "FORM RECOGNITION", dr: "RANK SYSTEM" },
  { name: "Légende Dwiggins", tier: "mythic", kind: "lockup", title: "LÉGENDE", dl: "PANTHÉON", dr: "STRUCTURE SYSTEM" },
  { name: "Série de 7 jours", tier: "rare", kind: "orbit", title: "STREAK" },
  { name: "N°1 mondial", tier: "legendary", kind: "orbit", title: "N°1", strip: ["RANK", "SYSTEM", "GLOBAL", "AXIS", "ELITE"] },
  { name: "Niveau 25", tier: "epic", kind: "orbit", title: "LVL 25", strip: ["LEVEL", "SYSTEM", "STRUCTURE", "XP", "TIER"] },
  { name: "Sans faute intégral", tier: "mythic", kind: "orbit", title: "PARFAIT", strip: ["FORM", "SYSTEM", "PERFECT", "AXIS", "100%"] },
  { name: "Première partie", tier: "common", kind: "lockup", title: "DÉBUT", dl: "FORM RECOGNITION", dr: "FIRST GAME" },
  { name: "10 parties", tier: "common", kind: "orbit", title: "X10", strip: ["GAMES", "SYSTEM", "STRUCTURE", "AXIS", "PLAY"] },
  { name: "Série de 7 jours", tier: "rare", kind: "lockup", title: "7 JOURS", dl: "STREAK SYSTEM", dr: "DAY COUNT" },
  { name: "50 polices", tier: "rare", kind: "lockup", title: "X50", dl: "FORM RECOGNITION", dr: "TYPE COUNT" },
  { name: "Série de 30 jours", tier: "epic", kind: "lockup", title: "30 JOURS", dl: "STREAK SYSTEM", dr: "DAY COUNT" },
  { name: "Top 10 hebdo", tier: "epic", kind: "orbit", title: "TOP 10", strip: ["RANK", "SYSTEM", "WEEKLY", "AXIS", "TIER"] },
  { name: "1 an de jeu", tier: "mythic", kind: "lockup", title: "1 AN", dl: "PANTHÉON", dr: "STRUCTURE SYSTEM" },
  { name: "Panthéon", tier: "mythic", kind: "orbit", title: "100%", strip: ["FORM", "SYSTEM", "COMPLETE", "AXIS", "ELITE"] },
];

// ---- the collection: distinct designs × fixed rarity (prune later) ----------
const BADGES: Badge[] = [
  // COMMON
  { name: "Première partie", tier: "common", shape: "circle", layout: "symbol" },
  { name: "Premier mot trouvé", tier: "common", shape: "square", layout: "mono", glyph: "D" },
  { name: "10 parties jouées", tier: "common", shape: "pill", layout: "dwig" },
  { name: "Anatomie : chapitre 1", tier: "common", shape: "hexagon", layout: "mono", glyph: "W" },
  { name: "Mascotte", tier: "common", shape: "circle", layout: "symbol", keyline: true },

  // RARE
  { name: "Série de 7 jours", tier: "rare", shape: "circle", layout: "symbol" },
  { name: "50 polices explorées", tier: "rare", shape: "shield", layout: "symFull" },
  { name: "Niveau 10 atteint", tier: "rare", shape: "square", layout: "mono", glyph: "G" },
  { name: "Mascotte bleue", tier: "rare", shape: "circle", layout: "symbol", keyline: true },
  { name: "Mascotte monoline", tier: "rare", shape: "circle", layout: "symbol", keyline: true, line: true },

  // EPIC — silver medallion
  { name: "100 polices maîtrisées", tier: "epic", shape: "circle", layout: "symbol" },
  { name: "Série de 30 jours", tier: "epic", shape: "shield", layout: "symFull" },
  { name: "Niveau 25 atteint", tier: "epic", shape: "square", layout: "mono", glyph: "D" },

  // LEGENDARY — gold medallion
  { name: "Série de 100 jours", tier: "legendary", shape: "circle", layout: "symbol" },
  { name: "Maître typographe", tier: "legendary", shape: "shield", layout: "symFull" },
  { name: "Sans faute intégral", tier: "legendary", shape: "rosette", layout: "symbol" },
  { name: "Mascotte or", tier: "legendary", shape: "circle", layout: "symbol", keyline: true },

  // MYTHIC — holographic medallion
  { name: "1 an de jeu", tier: "mythic", shape: "circle", layout: "symbol" },
  { name: "Légende Dwiggins", tier: "mythic", shape: "shield", layout: "symFull" },
  { name: "Panthéon (100%)", tier: "mythic", shape: "rosette", layout: "symbol" },
  { name: "Mascotte holo", tier: "mythic", shape: "circle", layout: "symbol", keyline: true },
];

// ---- shell ------------------------------------------------------------------

export default function BadgeStickerLab({ art }: { art: Art }) {
  const [dark, setDark] = useState(true);
  const sheetBg = dark ? "#0c0c0e" : "#e9e7e0";
  const glyph = useMemo(() => deriveGlyphs(art.dwig), [art]);

  let n = 0;
  return (
    <div style={{ minHeight: "100vh", background: sheetBg, color: dark ? INK : BLACK, fontFamily: "'Helvetica Neue',Arial,sans-serif", padding: "28px clamp(20px,4vw,48px) 90px", transition: "background 0.2s" }}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden dangerouslySetInnerHTML={{ __html: DEFS }} />
      <style>{`
        @font-face { font-family:'PP Frama'; src:url('/fonts/brand/PPFrama-BlackItalic.otf') format('opentype'); font-weight:800; font-style:italic; font-display:swap; }
        @font-face { font-family:'PP Frama'; src:url('/fonts/brand/PPFrama-Black.otf') format('opentype'); font-weight:800; font-style:normal; font-display:swap; }
        @font-face { font-family:'PP Frama'; src:url('/fonts/brand/PPFrama-Extralight.otf') format('opentype'); font-weight:200; font-style:normal; font-display:swap; }
      `}</style>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 30 }}>
        <div>
          <p style={{ margin: 0, fontFamily: COND, fontSize: 13, fontWeight: 700, letterSpacing: 4, color: dark ? "rgba(244,243,238,0.42)" : "rgba(13,13,15,0.45)" }}>DEV · NE SHIPPE PAS · PASSE BRUTE</p>
          <h1 style={{ margin: "6px 0 4px", fontSize: 30, fontWeight: 800, letterSpacing: -0.6 }}>Dwiggins — Badge Collection</h1>
          <p style={{ margin: 0, fontSize: 14, color: dark ? "rgba(244,243,238,0.55)" : "rgba(13,13,15,0.6)", maxWidth: 720 }}>
            {BADGES.length} badges = {BADGES.length} hauts faits distincts. Rareté portée par la <b>matière</b> : ivoire → bleu → médaillon argent → or → holographique. Epic+ = vrais médaillons 3D (dôme, reflet qui balaie, glow). Erreurs graphiques à nettoyer badge par badge.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Toggle label="Fond noir" active={dark} onClick={() => setDark(true)} dark={dark} />
          <Toggle label="Fond clair" active={!dark} onClick={() => setDark(false)} dark={dark} />
        </div>
      </div>

      {/* ÉDITORIAL — gabarit exact (coords du lockup, seul le mot change) */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${dark ? "rgba(244,243,238,0.1)" : "rgba(13,13,15,0.12)"}` }}>
          <span style={{ fontFamily: COND, fontSize: 18, fontWeight: 800, letterSpacing: 3, color: dark ? INK : BLACK }}>ÉDITORIAL — GABARIT EXACT</span>
          <span style={{ fontFamily: COND, fontSize: 13, fontWeight: 600, letterSpacing: 1, color: dark ? "rgba(244,243,238,0.4)" : "rgba(13,13,15,0.45)" }}>PP Frama · ta mise en page au pixel · seul le mot + la rareté changent</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 18 }}>
          {EDITORIAL.map((b, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column" }}>
              <svg viewBox="0 0 841.89 392.618" style={{ width: "100%", height: "auto", display: "block", borderRadius: "var(--radius)", filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.45))" }} dangerouslySetInnerHTML={{ __html: buildEditorial(b, art) }} />
              <p style={{ margin: "10px 0 1px", fontSize: 13, fontWeight: 650 }}>{b.name}</p>
              <p style={{ margin: 0, fontFamily: COND, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: TIERS[b.tier].lab }}>{TIERS[b.tier].label} · {b.kind}</p>
            </div>
          ))}
        </div>
      </section>

      {ORDER.map((tier) => {
        const T = TIERS[tier];
        const list = BADGES.filter((b) => b.tier === tier);
        return (
          <section key={tier} style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${dark ? "rgba(244,243,238,0.1)" : "rgba(13,13,15,0.12)"}` }}>
              <span style={{ fontFamily: COND, fontSize: 18, fontWeight: 800, letterSpacing: 3, color: T.lab }}>{T.label}</span>
              <span style={{ fontFamily: COND, fontSize: 13, fontWeight: 600, letterSpacing: 1, color: dark ? "rgba(244,243,238,0.4)" : "rgba(13,13,15,0.45)" }}>drop {T.drop} · {T.note} · {list.length} badges</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
              {list.map((b) => {
                const idx = n++;
                return (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                    <svg viewBox={`0 0 ${VBW} ${VBH}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }} dangerouslySetInnerHTML={{ __html: buildBadge(b, art, glyph, idx) }} />
                    <p style={{ margin: "10px 0 1px", fontSize: 13, fontWeight: 650 }}>{b.name}</p>
                    <p style={{ margin: 0, fontFamily: COND, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: T.lab }}>{T.label}</p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Toggle({ label, active, onClick, dark }: { label: string; active: boolean; onClick: () => void; dark: boolean }) {
  return (
    <button onClick={onClick} style={{ appearance: "none", cursor: "pointer", fontFamily: COND, fontSize: 14, fontWeight: 700, letterSpacing: 1, padding: "8px 16px", borderRadius: "var(--radius-pill)", border: active ? `1px solid ${YELLOW}` : `1px solid ${dark ? "rgba(244,243,238,0.2)" : "rgba(13,13,15,0.2)"}`, background: active ? "rgba(255,210,19,0.12)" : "transparent", color: active ? (dark ? YELLOW : "#7a6400") : dark ? "rgba(244,243,238,0.7)" : "rgba(13,13,15,0.7)" }}>
      {label}
    </button>
  );
}
