import { notFound } from "next/navigation";
import AnatomyMetricsValidator from "@/components/dev/typography/AnatomyMetricsValidator";
import { isDevRuntime } from "@/lib/dev-mode";

export default function TypographyMetricsValidationPage() {
  if (!isDevRuntime()) {
    notFound();
  }

  return (
    <main className="metrics-validator-page">
      <AnatomyMetricsValidator />
    </main>
  );
}
