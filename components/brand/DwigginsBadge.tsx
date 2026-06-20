"use client";

// Reusable single-badge renderer built on the shared Dwiggins badge engine
// (`lib/brand/dwiggins-badge-engine`). Drop <DwigginsBadgeDefs /> ONCE per page
// (it carries the shared gradient/filter ids + the PP Frama @font-face), then
// render any number of <DwigginsBadge /> / <DwigginsEditorialBadge />.

import { useMemo } from "react";
import {
  buildBadge,
  buildEditorial,
  deriveGlyphs,
  DEFS,
  VBW,
  VBH,
  type Art,
  type Badge,
  type Editorial,
} from "@/lib/brand/dwiggins-badge-engine";

// Shared <defs> (gradients + filters) and brand @font-face. Render once per page.
export function DwigginsBadgeDefs() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @font-face { font-family:'PP Frama'; src:url('/fonts/brand/PPFrama-BlackItalic.otf') format('opentype'); font-weight:800; font-style:italic; font-display:swap; }
        @font-face { font-family:'PP Frama'; src:url('/fonts/brand/PPFrama-Black.otf') format('opentype'); font-weight:800; font-style:normal; font-display:swap; }
        @font-face { font-family:'PP Frama'; src:url('/fonts/brand/PPFrama-Extralight.otf') format('opentype'); font-weight:200; font-style:normal; font-display:swap; }
      `,
        }}
      />
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden dangerouslySetInnerHTML={{ __html: DEFS }} />
    </>
  );
}

export function DwigginsBadge({
  badge,
  art,
  idx,
  className,
  style,
  title,
}: {
  badge: Badge;
  art: Art;
  idx: number; // must be unique on the page (drives the clip-path id)
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const glyph = useMemo(() => deriveGlyphs(art.dwig), [art.dwig]);
  const inner = useMemo(() => buildBadge(badge, art, glyph, idx), [badge, art, glyph, idx]);
  return (
    <svg
      viewBox={`0 0 ${VBW} ${VBH}`}
      className={className}
      style={{ display: "block", overflow: "visible", ...style }}
      role="img"
      aria-label={title ?? badge.name}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

export function DwigginsEditorialBadge({
  editorial,
  art,
  className,
  style,
}: {
  editorial: Editorial;
  art: Art;
  className?: string;
  style?: React.CSSProperties;
}) {
  const inner = useMemo(() => buildEditorial(editorial, art), [editorial, art]);
  return (
    <svg
      viewBox="0 0 841.89 392.618"
      className={className}
      style={{ display: "block", ...style }}
      role="img"
      aria-label={editorial.name}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
