// Le symbole de marque pour l'écran d'intro, lu une seule fois par processus.
//
// L'intro est montée par le layout racine, donc sur CHAQUE page servie. Passer
// par `loadBrandArt` à chaque requête coûterait trois lectures de fichier par
// page, pour un contenu qui ne bouge pas entre deux déploiements. Le nettoyage
// des tracés n'est pas réécrit ici : c'est le même que celui du blason et du
// Badge Lab, et deux nettoyages qui divergent finiraient par ne plus dessiner la
// même marque.
import { loadBrandArt } from "@/lib/brand/brand-art";

let cached: string | null = null;

export function loadIntroSymbol(): string {
  if (cached === null) {
    cached = loadBrandArt().symbol;
  }
  return cached;
}
