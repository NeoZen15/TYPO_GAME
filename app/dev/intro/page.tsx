import { notFound } from "next/navigation";
import IntroLab from "@/components/dev/intro/IntroLab";
import { loadBrandArt } from "@/lib/brand/brand-art";
import { isDevRuntime } from "@/lib/dev-mode";

export default function IntroLabPage() {
  if (!isDevRuntime()) {
    notFound();
  }

  // Le vrai dessin de marque, chargé côté serveur comme le Badge Lab : les trois
  // intros animent les formes du logo et pas une copie faite à la main.
  const art = loadBrandArt();

  return <IntroLab art={art} />;
}
