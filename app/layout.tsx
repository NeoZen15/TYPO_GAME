import type { Metadata } from "next";

import { FORCED_THEME, LIGHT_THEME_ENABLED } from "@/lib/theme-availability";
import "./globals.css";
import UiDebugProbe from "@/components/dev/UiDebugProbe";
import { isClerkConfigured } from "@/lib/server/clerk-availability";
import { ADOBE_KIT_STYLESHEETS } from "@/lib/game/fonts/runtime-catalog";
import StorageNotice from "@/components/ui/StorageNotice";
import BrandIntro from "@/components/brand/BrandIntro";
import { loadIntroSymbol } from "@/lib/brand/brand-intro-art";

// LE TITRE VIENT DU PRODUIT, IL N'A PAS ETE INVENTE. « a typeface recognition
// game » est deja la ligne que porte le h1 de l'accueil, dans son `aria-label`,
// et le nom de marque est DWIGGINS partout ailleurs. Le gabarit annoncait encore
// « Jeux de Typo V2 » dans l'onglet du navigateur et dans les resultats de
// recherche, seuls endroits du site ou le produit ne portait pas son nom.
//
// `metadataBase` est la pour que les adresses absolues des cartes de partage se
// resolvent, et il suit la variable d'environnement plutot que de figer un
// domaine que le proprietaire peut changer.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://dwiggins.fr"),
  title: "DWIGGINS — a typeface recognition game",
  description: "A game that trains your eye to recognise typefaces.",
};

// Le drapeau est interpolé dans la chaîne : quand le clair n'est pas proposé,
// le script n'a plus qu'une branche et une préférence "light" laissée par une
// visite précédente n'est PAS honorée. Voir lib/theme-availability.ts.
const themeBootstrapScript = `
(() => {
  try {
    const key = "jdt-theme";
    const stored = localStorage.getItem(key);
    const offered = ${LIGHT_THEME_ENABLED};
    const isValid = offered && (stored === "dark" || stored === "light");
    const theme = isValid
      ? stored
      : "${FORCED_THEME}";
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    // Le choix du profil, pose AVANT la premiere peinture pour la meme raison
    // que le theme : lu au montage, l'animation aurait le temps de demarrer
    // devant quelqu'un qui a demande qu'elle ne demarre pas. Voir lib/motion.ts.
    if (localStorage.getItem("jdt-reduced-motion") === "1") {
      root.dataset.reducedMotion = "1";
    }
  } catch {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;

// LE FOURNISSEUR N'EST MONTE QUE S'IL EST CONFIGURE, et l'import est dynamique
// pour la meme raison : sans cles, `ClerkProvider` jette au montage et le site
// entier tombe. Le produit ne doit pas dependre d'une action que seul le
// proprietaire peut faire (creer l'application Clerk et poser ses deux cles).
// Tant qu'elles ne sont pas la, tout le monde est invite, exactement comme avant.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const Provider = isClerkConfigured()
    ? (await import("@clerk/nextjs")).ClerkProvider
    : ({ children: inner }: { children: React.ReactNode }) => <>{inner}</>;

  return (
    <html lang="en" data-theme={FORCED_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {/* La feuille du projet web Adobe Fonts, chargee une fois pour tout le
            site. Elle declare les familles que le jeu se contente ensuite de
            nommer : Adobe interdit de telecharger et d'heberger ces fichiers, donc
            ils restent sur leur CDN et il n'y a rien a injecter par question.

            preconnect avant le lien, parce que la premiere police vient d'un autre
            domaine que le notre et que la poignee de main TLS se paierait sinon au
            moment ou le joueur attend son mot.

            Le projet declare aujourd'hui localhost et 127.0.0.1. Ajouter le
            domaine de production avant la mise en ligne est une OBLIGATION DE
            LICENCE, pas une condition d'affichage : mesure du 2026-08-31, la
            feuille et les fichiers repondent 200 avec access-control-allow-origin
            pour n'importe quel domaine. Le risque d'un domaine non declare est
            qu'Adobe coupe le kit, pas que le site paraisse casse le premier jour.

            PLUSIEURS FEUILLES depuis le 2026-09-14 : un projet web ne publie plus
            au dela de quelques milliers de familles, donc les polices de masse sont
            reparties sur plusieurs projets. La liste vit dans
            content/catalog/adobe-fonts-kits.json et vaut la seule feuille
            historique tant qu'aucune tranche n'y est declaree. */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        {ADOBE_KIT_STYLESHEETS.map((feuille) => (
          <link key={feuille} rel="stylesheet" href={feuille} />
        ))}
      </head>
      <body className="bg-background font-sans antialiased">
        {/* Lien d'evitement, premier element focusable de la page.
            Pose par scripts/conformite/conformite.py. */}
        <a href="#contenu" className="skip-link">
          Skip to content
        </a>
        {/* La feuille de marque qui couvre le site le temps de l'intro. Posée en
            tête du body pour être dans le HTML dès le premier octet. */}
        <BrandIntro symbol={loadIntroSymbol()} />
        {/* DANS le body et non autour de <html> : c'est ce que dit la
            documentation de Clerk, et c'est la seule place qui garde la balise
            racine rendue par le serveur. */}
        <Provider>
        <UiDebugProbe />
        <div id="contenu" tabIndex={-1} style={{ display: "contents" }}>
          {children}
        </div>
        {/* Sur toutes les pages : un visiteur doit être informé là où il arrive,
            pas seulement s'il passe par l'accueil. */}
        <StorageNotice />
        </Provider>
      </body>
    </html>
  );
}
