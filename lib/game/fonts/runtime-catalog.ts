import "server-only";

import runtimeCatalog from "@/content/catalog/font-runtime-assets.json";
import { type GameFontFace } from "@/lib/game/fonts/contracts";

// COPY OF THE COMPETITION FONT RESOLVER, not yet a single runtime source.
//
// WHY THIS MODULE EXISTS. The engine picks the typeface, the screen must render
// THAT typeface. Before this module, training resolved its font family from
// content/typefaces/font-manifest-v4.json (28 entries, 23 with a runtime path)
// while its pool was drawn from the full catalogue (1172 active faces). Any face
// outside those 23 fell back to `"Display Name", serif`, a family declared
// nowhere, so the word rendered in a fallback font and the question asked the
// player to name a typeface that was not on screen. Measured on two real pools:
// 8 renderable out of 25, and 2 out of 30.
//
// The competition path already read the right source, content/catalog/font-runtime-assets.json,
// and injected each face on demand. This module is a copy of that resolver,
// meant to become the single place this logic lives once the other two are
// retired. That retirement has NOT happened: at the time of writing,
// lib/game/competition/catalog.ts still carries its own full copy of this same
// mechanism (its own runtimeBySlug, its own getCompetitionFontFace), and
// lib/game/training/catalog.ts resolves faces a third way, from the older
// font-manifest-v4.json. Three implementations of "which face can this slug
// render" exist in this repository today, not one.
//
// SERVER-ONLY on purpose. The backing JSON is ~800 kB; it belongs to the question
// builder, never to a browser bundle. Clients receive only the small per-question
// descriptor (GameFontFace) and inject it themselves (see ./inject-font-face).

// The five system faces the catalogue keeps for reference. All are proprietary,
// all are deactivated, and none ships an asset under public/fonts, so they can
// never be served. The stack is kept so that a face reaching a screen through
// some other path still resolves to something readable rather than a bare name.
const LOCAL_FONT_FAMILIES: Record<string, string> = {
  arial: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  courier_new: '"Courier New", Courier, monospace',
  georgia: 'Georgia, "Times New Roman", serif',
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  times_new_roman: '"Times New Roman", Times, serif',
};

type RuntimeRecord = (typeof runtimeCatalog.records)[number];

// runtime_path is `string | null` in the JSON-inferred type. A record is usable
// only if it is the primary woff2 of its slug, marked ready, and actually
// carries a path; anything else is metadata, not a servable face. Written as a
// type guard, not a plain predicate, so the compiler itself knows runtime_path
// is a string past this point, with no cast at any read site below.
type RenderableRecord = RuntimeRecord & { runtime_path: string };

const isRenderableRecord = (record: RuntimeRecord): record is RenderableRecord =>
  record.runtime_status === "ready" &&
  record.file_role === "primary" &&
  record.font_format === "woff2" &&
  typeof record.runtime_path === "string";

const runtimeBySlug = new Map<string, RenderableRecord>(
  runtimeCatalog.records
    .filter(isRenderableRecord)
    .map((record) => [record.typeface_slug, record])
);

/** True when a question on this slug can actually render its own typeface. */
export const hasRuntimeFace = (slug: string) => runtimeBySlug.has(slug);

/**
 * Every slug this project can render. Not called anywhere in this repository at
 * present; kept as the read path a future renderability guard would use.
 */
export const listRenderableSlugs = () => [...runtimeBySlug.keys()];

/**
 * The CSS font-family to apply to the specimen. Returns the injected family when
 * the slug has a runtime asset, so it pairs with getRuntimeFontFace below.
 */
export const getRuntimeFontFamily = (slug: string, displayName: string) => {
  if (runtimeBySlug.has(slug)) {
    return `"JDT__${slug}"`;
  }

  return LOCAL_FONT_FAMILIES[slug] ?? `"${displayName}", serif`;
};

/**
 * Descriptor to send with a question so the client can declare the face just
 * before showing it. Null when the slug has no runtime asset, which is also the
 * signal that getRuntimeFontFamily fell back.
 */
export const getRuntimeFontFace = (slug: string): GameFontFace | null => {
  const record = runtimeBySlug.get(slug);
  if (!record) {
    return null;
  }

  return {
    family: `JDT__${record.typeface_slug}`,
    src: record.runtime_path,
    weight: record.weight ?? 400,
    style: record.style ?? "normal",
  };
};

const buildFontFaceRule = (record: RenderableRecord) =>
  [
    "@font-face {",
    `  font-family: "JDT__${record.typeface_slug}";`,
    `  src: url("${record.runtime_path}") format("woff2");`,
    `  font-weight: ${record.weight ?? 400};`,
    `  font-style: ${record.style ?? "normal"};`,
    "  font-display: swap;",
    "}",
  ].join("\n");

/**
 * Static @font-face rules for a known set of slugs. Kept for pages that render a
 * fixed, small set of specimens server-side. A game screen should NOT use this:
 * it receives descriptors per question and injects on demand.
 */
export const getRuntimeFontFaceCss = (slugs: readonly string[]) =>
  slugs
    .map((slug) => runtimeBySlug.get(slug))
    .filter((record): record is RenderableRecord => record !== undefined)
    .map(buildFontFaceRule)
    .join("\n");
