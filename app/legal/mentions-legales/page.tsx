import type { Metadata } from "next";
import LegalPage from "@/features/legal/components/LegalPage";
import { legalNoticeCopy } from "@/content/legal";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Éditeur, directeur de la publication, hébergeur et contact.",
};

export default function LegalNoticePage() {
  return <LegalPage current="/legal/mentions-legales" {...legalNoticeCopy} />;
}
