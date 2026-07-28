import { notFound, redirect } from "next/navigation";
import { getPublishedComparisons } from "@/lib/typography/content";

// The landing links to /compare from the hero call to action and from the
// footer, but only /compare/[slug] existed, so both links returned a 404 for
// every visitor. This route sends them to the first published comparison
// instead of hardcoding a slug, so adding or reordering comparisons keeps
// working without touching this file.
export default async function ComparePage() {
  const comparisons = await getPublishedComparisons();
  const first = comparisons[0];

  if (!first) {
    notFound();
  }

  redirect(`/compare/${first.slug}`);
}
