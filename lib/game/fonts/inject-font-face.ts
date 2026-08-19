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

/**
 * Résout quand la face est réellement utilisable, ou au bout du délai de garde.
 *
 * POURQUOI ELLE EXISTE. La pause de deux secondes après une bonne réponse servait
 * aussi de fenêtre de préchargement : la police suivante avait le temps d'arriver
 * avant que le mot change. Marion a demandé l'enchaînement instantané le
 * 2026-08-19, et sans cette attente le mot suivant s'afficherait dans la police de
 * repli le temps que le woff2 arrive, à cause de `font-display: swap`. Le joueur
 * jugerait alors des lettres qui ne sont pas celles de la typo demandée, ce que ce
 * jeu ne peut pas se permettre.
 *
 * Le plus souvent la police est déjà déclarée et en cache, la promesse se règle
 * en quelques millisecondes et l'enchaînement reste instantané. Le délai de garde
 * évite qu'un réseau lent fige la partie : passé ce délai on avance, et `swap`
 * remplacera le repli dès l'arrivée du fichier.
 */
export const GAME_FONT_READY_TIMEOUT_MS = 900;

export const whenGameFontReady = async (fontFace: GameFontFace | null | undefined) => {
  if (!fontFace || typeof document === "undefined" || !("fonts" in document)) {
    return;
  }

  const ready = document.fonts
    .load(`${fontFace.weight} 1em "${fontFace.family}"`)
    .then(() => undefined)
    .catch(() => undefined);

  const guard = new Promise<void>((resolve) => {
    window.setTimeout(resolve, GAME_FONT_READY_TIMEOUT_MS);
  });

  await Promise.race([ready, guard]);
};
