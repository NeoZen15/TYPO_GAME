import type { Metadata } from "next";
import "./globals.css";
import UiDebugProbe from "@/components/dev/UiDebugProbe";
import StorageNotice from "@/components/ui/StorageNotice";

export const metadata: Metadata = {
  title: "Jeux de Typo V2",
  description: "Typographic learning experience.",
};

const themeBootstrapScript = `
(() => {
  try {
    const key = "jdt-theme";
    const stored = localStorage.getItem(key);
    const isValid = stored === "dark" || stored === "light";
    const theme = isValid
      ? stored
      : "dark";
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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
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
