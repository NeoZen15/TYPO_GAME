import manifest from "@/content/typefaces/font-manifest-v4.json";

// TRAINING_TOTAL_ROUNDS is gone on purpose. A training session had a cap of 8
// resolved questions and closed itself; a session has no planned length any more
// and is closed only by an explicit call to endTrainingSession (vision §2, I-17).
// Any constant reintroducing a round count here would recreate the defect, which
// is what check:session-lifecycle watches for.
// Enchaînement instantané, demandé par Marion le 2026-08-19 : « le joueur peut
// répondre hyper vite et avoir la suite hyper vite, pas de seconde ».
// Valait 2000, ce qui laissait voir la bonne réponse mais faisait attendre à
// chaque question. Ce que ces deux secondes assuraient aussi, le préchargement de
// la police suivante, est repris par `whenGameFontReady`, qui enchaîne dès que la
// face est utilisable au lieu d'attendre une durée fixe.
export const TRAINING_CORRECT_DELAY_MS = 0;

// LE VERT DURE UN TEMPS FIXE DEPUIS LE CLIC, pas depuis la reponse du serveur.
//
// Demande de Marion le 2026-08-26 : « un tout petit temps d'attente pour le vert et 0
// pour le rouge ». Le rouge ne compte rien, la main est rendue des le clic et le joueur
// retente immediatement. Le vert, lui, a besoin d'etre vu.
//
// POURQUOI 250 ET PAS UN CHIFFRE AU HASARD. Mesure du 2026-08-17 sur un vrai build de
// production : une reponse d'entrainement met **250 ms en mediane**, 103 ms en
// competition. Avant ce jour, la couleur n'apparaissait qu'au retour du serveur et
// l'enchainement partait aussitot : le vert n'etait visible que quelques millisecondes,
// ce qui est exactement le « trop court » signale. Depuis que la couleur part au clic,
// le vert dure naturellement le temps de l'aller-retour, soit ces 250 ms.
//
// LE PALIER EXISTE POUR LA PRODUCTION, PAS POUR LE DEVELOPPEMENT. Les 250 ms mesurees
// viennent d'un Mac en France qui parle a une base a Londres. En production, le site
// sera a Londres lui aussi, epingle sur lhr1 dans vercel.json, a cote de la base : la
// reponse tombera bien plus bas et le vert redeviendrait trop court sans qu'on ait rien
// touche. Le palier fige donc la sensation a ce que Marion valide sur sa machine, quelle
// que soit la latence reelle. Il ne ralentit personne : quand l'aller-retour depasse
// deja 250 ms, il ne reste rien a attendre.
//
// C'est une valeur de ressenti, elle appartient au proprietaire : une seule ligne a
// changer ici, rien d'autre dans le code.
export const TRAINING_GREEN_HOLD_MS = 250;
export const TRAINING_ENGINE_VERSION = "training-provider-v1";

export const TRAINING_WORD_POOL = [
  "alphabet",
  "typographie",
  "structure",
  "regular",
  "baseline",
  "contraste",
  "lecture",
  "espace",
  "ligne",
  "courbe",
  "hauteur",
  "epaisseur",
  "glyphes",
  "famille",
  "alignement",
  "rythme",
  "design",
  "caractere",
  "forme",
  "proportion",
] as const;

type ManifestFont = (typeof manifest.fonts)[number];

const LOCAL_FONT_FAMILIES: Record<string, string> = {
  arial: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  courier_new: '"Courier New", Courier, monospace',
  georgia: 'Georgia, "Times New Roman", serif',
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  times_new_roman: '"Times New Roman", Times, serif',
};

const manifestBySlug = new Map<string, ManifestFont>(
  manifest.fonts.map((font) => [font.slug, font])
);

export const getManifestFont = (slug: string) => manifestBySlug.get(slug) ?? null;

export const getTrainingDisplayWord = (seed: string | number, globalQIndex: number) => {
  const seedNumber = Number.parseInt(String(seed).slice(-6), 10) || 0;
  const wordIndex =
    (Math.floor(globalQIndex / 5) + seedNumber) % TRAINING_WORD_POOL.length;
  return TRAINING_WORD_POOL[wordIndex] ?? TRAINING_WORD_POOL[0];
};

export const getTypefaceFontFamily = (slug: string, displayName: string) => {
  const font = getManifestFont(slug);
  if (!font) return `"${displayName}", serif`;

  if (font.runtimePath) {
    return `"JDT__${slug}"`;
  }

  if (font.fontSource === "local") {
    return LOCAL_FONT_FAMILIES[slug] ?? `"${displayName}", serif`;
  }

  return `"${displayName}", serif`;
};

/**
 * Runtime paths for a given set of slugs, in the order asked, skipping any slug
 * the manifest cannot serve.
 *
 * Exists for one reason: `@font-face` alone never tells the browser to fetch
 * anything early. The landing hero swaps its word through seven faces at 2.4 s
 * intervals, so without a preload the first paint shows a fallback and the
 * visitor watches seven substitutions on the one word the page is built around.
 * A `rel="preload"` on those faces moves the request to the start of the
 * document instead of the moment the family is first painted.
 *
 * Deliberately takes an explicit slug list rather than preloading the whole
 * manifest: preloading a face the page never paints is wasted bandwidth and
 * earns a console warning.
 */
export const getTrainingFontPreloadHrefs = (slugs: readonly string[]) =>
  slugs
    .map((slug) => getManifestFont(slug)?.runtimePath)
    .filter((path): path is string => typeof path === "string" && path.length > 0);

export const getTrainingFontFaceCss = () => {
  const lines = manifest.fonts.flatMap((font) => {
    if (!font.runtimePath) return [];

    return [
      `@font-face {`,
      `  font-family: "JDT__${font.slug}";`,
      `  src: url("${font.runtimePath}") format("woff2");`,
      `  font-weight: 400;`,
      `  font-style: normal;`,
      `  font-display: swap;`,
      `}`,
    ];
  });

  return lines.join("\n");
};
