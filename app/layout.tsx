import type { Metadata } from "next";

import { FORCED_THEME, LIGHT_THEME_ENABLED } from "@/lib/theme-availability";
import "./globals.css";
import UiDebugProbe from "@/components/dev/UiDebugProbe";
import { ADOBE_KIT_STYLESHEET } from "@/lib/game/fonts/runtime-catalog";
import StorageNotice from "@/components/ui/StorageNotice";

export const metadata: Metadata = {
  title: "Jeux de Typo V2",
  description: "Typographic learning experience.",
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
  } catch {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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

            Le projet est verrouille sur les domaines qu'il declare. Il porte
            aujourd'hui localhost et 127.0.0.1 : AJOUTER LE DOMAINE DE PRODUCTION
            AVANT LA MISE EN LIGNE, sinon ces polices ne s'afficheront pas et le
            joueur devra nommer une typo qui n'est pas a l'ecran. */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={ADOBE_KIT_STYLESHEET} />
      </head>
      <body className="bg-background font-sans antialiased">
        <UiDebugProbe />
        {children}
        {/* Sur toutes les pages : un visiteur doit être informé là où il arrive,
            pas seulement s'il passe par l'accueil. */}
        <StorageNotice />
      </body>
    </html>
  );
}
