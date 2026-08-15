import type { Metadata } from "next";
import LegalPage from "@/features/legal/components/LegalPage";
import { termsCopy } from "@/content/legal";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description: "Les règles d'usage de DWIGGINS, un service gratuit et sans compte.",
};

export default function TermsPage() {
  return <LegalPage {...termsCopy} />;
}
