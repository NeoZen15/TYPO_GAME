import { notFound } from "next/navigation";
import BadgeStickerLab from "@/components/dev/badges/BadgeStickerLab";
import { loadBrandArt } from "@/lib/brand/brand-art";
import { isDevRuntime } from "@/lib/dev-mode";

export default function BadgeStickerLabPage() {
  if (!isDevRuntime()) {
    notFound();
  }

  // The REAL Dwiggins artwork (inner logo paths), loaded server-side — shared
  // with the profile via `@/lib/brand/brand-art`.
  const art = loadBrandArt();

  return <BadgeStickerLab art={art} />;
}
