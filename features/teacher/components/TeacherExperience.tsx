"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import TeacherHome from "@/features/teacher/components/TeacherHome";
import TeacherClasses from "@/features/teacher/components/TeacherClasses";
import TeacherClassPage from "@/features/teacher/components/TeacherClassPage";
import TeacherExercises from "@/features/teacher/components/TeacherExercises";
import { MOCK_TEACHER, type TeacherProfile } from "@/lib/teacher/mock-teacher";

// ---------------------------------------------------------------------------
// Teacher space — the shell.
//
// Deliberately the SAME shell as the profile, not a variant of it: `.pf-page`
// publishes the token contract (--pf-bg / --pf-cream / --pf-mono / ink steps)
// and `.pf-top` is the third copy of the one bar the site already has. Entering
// through those is what makes this space feel like it was always here.
//
// Three parts: Home, Classes, Exercises. Account settings stay secondary and
// will reuse the profile's Preferences board rather than inventing a screen.
//
// No starfield anywhere in this space (owner, 2026-09-04). The profile boards
// float on a fixed star canvas; the teacher space is a work surface and reads
// better on the flat page.
// ---------------------------------------------------------------------------

type ViewId = "home" | "classes" | "exercises";

const VIEW_IDS: ReadonlyArray<ViewId> = ["home", "classes", "exercises"];

const isViewId = (value: string | null): value is ViewId =>
  value !== null && (VIEW_IDS as readonly string[]).includes(value);

const NAV: ReadonlyArray<{ id: ViewId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "classes", label: "Classes" },
  { id: "exercises", label: "Exercises" },
];

export default function TeacherExperience({
  teacher = MOCK_TEACHER,
}: {
  teacher?: TeacherProfile;
}) {
  // Addressable views, exactly like the profile and the rules page: the query
  // picks the view on arrival, and clicking a tab CORRECTS the address with
  // replaceState. Switching tab is not a navigation and must not stack history
  // entries the back button then has to walk through.
  const params = useSearchParams();
  const requestedView = params.get("view");
  const [view, setView] = useState<ViewId>(isViewId(requestedView) ? requestedView : "home");
  // A class page is an ADDRESS, not a state: "look at what the second years are
  // doing" has to be a link a teacher can send to themselves or to a colleague.
  const [classId, setClassId] = useState<string | null>(params.get("class"));
  const [scrolled, setScrolled] = useState(false);

  const showView = useCallback((next: ViewId) => {
    setView(next);
    setClassId(null);
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", next === "home" ? "/teacher" : `/teacher?view=${next}`);
  }, []);

  // PUSH, not replace, and the difference is the whole point. Switching TAB is
  // not a navigation, so it corrects the address in place, like the profile and
  // the rules page. Opening a CLASS is a navigation: you went somewhere, and the
  // browser's own Back must bring you out of it. Without this the back button
  // left the teacher space entirely from a sub-page, which is exactly the "stuck
  // in a sub-page" Marion asked us to avoid.
  const showClass = useCallback((id: string) => {
    setView("classes");
    setClassId(id);
    if (typeof window === "undefined") return;
    window.history.pushState(null, "", `/teacher?view=classes&class=${id}`);
  }, []);

  // An address naming a class that does not exist falls back to the list rather
  // than rendering nothing.
  const openClass = classId ? teacher.classes.find((c) => c.id === classId) ?? null : null;

  // The address is the truth: when the browser walks the history, the screen
  // follows it rather than the other way round.
  useEffect(() => {
    const sync = () => {
      const q = new URLSearchParams(window.location.search);
      const v = q.get("view");
      setView(isViewId(v) ? v : "home");
      setClassId(q.get("class"));
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="pf-page">
      <header className={`pf-top${scrolled ? " is-scrolled" : ""}`}>
        <Link href="/" className="pf-top__brand" aria-label="Dwiggins — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pf-top__figures mark--on-light"
            src="/brand/dwiggins-figures-dark.svg"
            alt=""
            aria-hidden="true"
            width={673}
            height={487}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pf-top__figures mark--on-dark"
            src="/brand/dwiggins-figures-cream.svg"
            alt=""
            aria-hidden="true"
            width={673}
            height={487}
          />
          <Image
            src="/brand/dwiggins-wordmark-full-black.svg"
            alt="Dwiggins"
            className="pf-top__logo mark--on-light"
            width={812}
            height={200}
            priority
          />
          <Image
            src="/brand/dwiggins-wordmark-full-ivory.svg"
            alt="Dwiggins"
            className="pf-top__logo mark--on-dark"
            width={812}
            height={200}
            priority
          />
        </Link>

        <nav className="pf-top__nav" aria-label="Teacher sections">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`pf-top__link${view === item.id ? " is-active" : ""}`}
              aria-current={view === item.id ? "true" : undefined}
              onClick={() => showView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pf-top__actions">
          {/* Two rooms of one house. Wording is a proposal, to be judged in
              the interface rather than in a document. */}
          <div className="pf-top__switch" role="group" aria-label="Space">
            <Link href="/profile" className="pf-top__switch-btn">
              Learn
            </Link>
            <Link href="/teacher" className="pf-top__switch-btn is-active" aria-current="true">
              Teach
            </Link>
          </div>
          {/* The main gesture of the whole space, so it lives in the bar and is
              reachable from every tab, not only from Home. */}
          <button type="button" className="pf-top__cta">
            New exercise
          </button>
          <ThemeSwitch />
        </div>
      </header>

      {view === "home" && (
        <div className="pf-constellation-stage">
          <TeacherHome
            teacher={teacher}
            onOpenClass={showClass}
            onOpenExercises={() => showView("exercises")}
          />
        </div>
      )}

      {view === "classes" && (
        <div className="pf-constellation-stage">
          {openClass ? (
            <TeacherClassPage
              teacher={teacher}
              cls={openClass}
              onBack={() => showView("classes")}
            />
          ) : (
            <TeacherClasses teacher={teacher} onOpenClass={showClass} />
          )}
        </div>
      )}

      {view === "exercises" && (
        <div className="pf-constellation-stage">
          <TeacherExercises teacher={teacher} />
        </div>
      )}
    </main>
  );
}
