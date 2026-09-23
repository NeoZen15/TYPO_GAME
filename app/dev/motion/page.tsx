import { notFound } from "next/navigation";
import MotionLab from "@/components/dev/motion/MotionLab";
import { loadBrandArt } from "@/lib/brand/brand-art";
import { isDevRuntime } from "@/lib/dev-mode";

export default function MotionLabPage() {
  if (!isDevRuntime()) {
    notFound();
  }

  // Une des adaptations du métal liquide découpe la surface à la forme du
  // symbole : il lui faut le vrai dessin, chargé côté serveur comme ailleurs.
  const art = loadBrandArt();

  return <MotionLab symbol={art.symbol} />;
}
