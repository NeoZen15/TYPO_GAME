import { type GameFontFace } from "@/lib/game/fonts/contracts";

// Client-side @font-face injection, shared by every game screen.
//
// A game session shows a handful of faces drawn from a catalogue of 1172, so
// declaring all of them up front would ship a wall of CSS for faces the player
// will never see. Instead each question carries its own descriptor and the screen
// declares that one face just before showing it.
//
// This module deliberately imports NO data: the catalogue that produces
// descriptors is server-only. Only the type crosses the boundary.

const STYLE_ELEMENT_ID = "jdt-game-font-faces";

// Families already declared. The backing <style> lives in document.head, so this
// survives component remounts within THIS module's own screen. It is not shared
// across modes: at HEAD, CompetitionScreen keeps its own
// `injectedCompetitionFontFaces` Set and its own
// <style id="competition-font-faces"> element, entirely separate from this one.
// So a face declared during training is NOT still declared if the player moves
// to competition; competition re-declares it from scratch.
const injected = new Set<string>();

/**
 * Declares one face, once. SSR-safe (no-op without a document) and idempotent.
 * `font-display: swap` keeps a fallback visible until the woff2 lands, so the
 * word never renders invisible.
 */
export const ensureGameFontFace = (fontFace: GameFontFace | null | undefined) => {
  if (!fontFace || typeof document === "undefined") {
    return;
  }
  if (injected.has(fontFace.family)) {
    return;
  }

  let styleElement = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleElement);
  }

  styleElement.appendChild(
    document.createTextNode(
      `@font-face{font-family:"${fontFace.family}";src:url("${fontFace.src}") format("woff2");font-weight:${fontFace.weight};font-style:${fontFace.style};font-display:swap;}`
    )
  );

  // Marked declared only after the append actually succeeded: a throw above
  // (style element creation, head append, text node append) must not leave this
  // family recorded as declared when it was not.
  injected.add(fontFace.family);
};
