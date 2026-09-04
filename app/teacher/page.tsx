import { Suspense } from "react";
import type { Metadata } from "next";
import TeacherExperience from "@/features/teacher/components/TeacherExperience";
import { getTrainingFontFaceCss } from "@/lib/game/training/catalog";

export const metadata: Metadata = {
  title: "Teacher",
};

export default function TeacherPage() {
  // The real catalogue faces (JDT__<slug>), like the landing, the profile and
  // the onboarding already do. The home paints specimens of the families a
  // class is working on, and a specimen the browser had to invent would be the
  // one thing this product must never show.
  const fontFaceCss = getTrainingFontFaceCss();

  // Suspense because the experience reads ?view= to open on a tab, which is what
  // lets a signal or an email link land straight on the right part of the space.
  return (
    <>
      {fontFaceCss ? <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} /> : null}
      <Suspense fallback={null}>
        <TeacherExperience />
      </Suspense>
    </>
  );
}
