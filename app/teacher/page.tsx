import { Suspense } from "react";
import type { Metadata } from "next";
import TeacherExperience from "@/features/teacher/components/TeacherExperience";
import { getRuntimeFontFaceCss } from "@/lib/game/fonts/runtime-catalog";
import { MOCK_TEACHER } from "@/lib/teacher/mock-teacher";

export const metadata: Metadata = {
  title: "Teacher",
};

export default function TeacherPage() {
  // THE FACES THE READING SCREENS PAINT, declared here, from the runtime
  // catalogue and no longer from font-manifest-v4.json.
  //
  // The reading screens (Home band, exercise page, student page) render
  // specimens server-side for a KNOWN, small set: the families the exercises
  // carry. Those get static rules here. The composer is the opposite case, a
  // picker over 1 279 faces, so it receives a descriptor per row and declares
  // each face on demand (see lib/game/fonts/inject-font-face).
  //
  // Both paths now build their rules from the same source, which is what
  // check:font-renderable requires. A face chosen in the composer that also
  // appears in an exercise ends up declared twice, once here and once on
  // demand: the two rules are identical, so it costs a duplicate and nothing
  // else. Adobe faces are in neither list, their family being declared by the
  // project stylesheet in the root layout.
  const fontFaceCss = getRuntimeFontFaceCss([
    ...new Set(MOCK_TEACHER.exercises.flatMap((e) => e.typefaces.map((f) => f.slug))),
  ]);

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
