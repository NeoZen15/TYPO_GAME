import type { Metadata } from "next";
import LegalPage from "@/features/legal/components/LegalPage";
import { privacyCopy } from "@/content/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Ce que DWIGGINS conserve, pourquoi, où, et ce qu'il ne collecte pas.",
};

export default function PrivacyPage() {
  return <LegalPage current="/legal/confidentialite" {...privacyCopy} />;
}
