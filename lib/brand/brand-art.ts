// Server-only loader for the real Dwiggins brand artwork.
//
// Pulls the inner paths out of the SVG files in public/brand so the badge
// engine embeds the ACTUAL logo — no hand-copied path data. Used by both the
// dev Badge Lab (/dev/badges) and the profile (Arena blason, Achievements).
//
// node:fs ⇒ server components / route handlers only.
import { readFileSync } from "node:fs";
import path from "node:path";

import type { Art } from "@/lib/brand/dwiggins-badge-engine";

function brandArt(file: string): string {
  const raw = readFileSync(path.join(process.cwd(), "public/brand", file), "utf8");
  return raw
    .replace(/<\?xml[\s\S]*?\?>/, "")
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")
    .replace(/<defs>[\s\S]*?<\/defs>/, "")
    .trim();
}

export function loadBrandArt(): Art {
  // the "dossier" / folder shape — first <path d="…"> of the panel asset
  const panel = readFileSync(path.join(process.cwd(), "public/brand", "dwiggins-panel-ivory.svg"), "utf8");
  const folderMatch = panel.match(/<path[^>]*\bd="([^"]+)"/);

  // EXACT editorial-lockup geometry: the figures group, positioned as in the real lockup
  const lockup = readFileSync(path.join(process.cwd(), "public/brand", "dwiggins-lockup-editorial-panel-black.svg"), "utf8");
  const figuresMatch = lockup.match(/<g>([\s\S]*?)<\/g>/);

  return {
    symbol: brandArt("dwiggins-symbol-standalone-ivory.svg"),
    dwig: brandArt("dwiggins-wordmark-short-ivory.svg"),
    full: brandArt("dwiggins-wordmark-full-ivory.svg"),
    folder: folderMatch?.[1] ?? "",
    figures: (figuresMatch?.[1] ?? "").replace(/class="[^"]*"/g, ""),
  };
}
