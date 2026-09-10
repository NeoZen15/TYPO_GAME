"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import TeacherHome from "@/features/teacher/components/TeacherHome";
import TeacherClasses from "@/features/teacher/components/TeacherClasses";
import TeacherClassPage from "@/features/teacher/components/TeacherClassPage";
import TeacherStudentPage from "@/features/teacher/components/TeacherStudentPage";
import TeacherExercises from "@/features/teacher/components/TeacherExercises";
import TeacherExercisePage from "@/features/teacher/components/TeacherExercisePage";
import TeacherComposePage from "@/features/teacher/components/TeacherComposePage";
import { MOCK_TEACHER, type TeacherExercise, type TeacherProfile } from "@/lib/teacher/mock-teacher";

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
  // A person is an address too, and for the same reason: "look at what Camille
  // is doing" has to be a link. It only ever exists under a class, since a
  // student is read through the exercises that class was given.
  const [studentId, setStudentId] = useState<string | null>(params.get("student"));
  // An exercise is reachable from TWO places, and the address says which one it
  // was opened from: under a class it goes back to that class, under the list it
  // goes back to the list. Same page, two contexts, one control.
  const [exerciseId, setExerciseId] = useState<string | null>(params.get("exercise"));
  // The composer is an overlay on whatever address you were on, so leaving it
  // puts you back exactly where you were and the back control can name it.
  const [composing, setComposing] = useState(params.get("new") === "1");
  // NOTHING IS SAVED ANYWHERE, because there is nothing to save into yet. A new
  // exercise lives in this state, the way a renamed class and an invited student
  // already do on the class page: the space behaves, and a reload forgets. The
  // day there is a backend, this state becomes its cache and no screen moves.
  const [created, setCreated] = useState<TeacherExercise[]>([]);
  const [scrolled, setScrolled] = useState(false);

  const showView = useCallback((next: ViewId) => {
    setComposing(false);
    setView(next);
    setClassId(null);
    setStudentId(null);
    setExerciseId(null);
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
    setComposing(false);
    setView("classes");
    setClassId(id);
    setStudentId(null);
    setExerciseId(null);
    if (typeof window === "undefined") return;
    window.history.pushState(null, "", `/teacher?view=classes&class=${id}`);
  }, []);

  // Opening a student is a navigation, like opening a class: it pushes, so the
  // browser's own Back comes out of the person and lands on their class.
  const showStudent = useCallback((cid: string, sid: string) => {
    setComposing(false);
    setView("classes");
    setClassId(cid);
    setStudentId(sid);
    setExerciseId(null);
    if (typeof window === "undefined") return;
    window.history.pushState(null, "", `/teacher?view=classes&class=${cid}&student=${sid}`);
  }, []);

  // The back control CORRECTS the address in place, exactly as the class page's
  // does: it is the same move up one level, not a new destination, and stacking
  // it would make Back walk through the same page twice.
  const closeStudent = useCallback((cid: string) => {
    setStudentId(null);
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", `/teacher?view=classes&class=${cid}`);
  }, []);

  // The group the list was on is kept in the address, so coming back out of an
  // exercise lands on the same shelf it was opened from.
  const groupParam = () => {
    if (typeof window === "undefined") return "";
    const g = new URLSearchParams(window.location.search).get("group");
    return g ? `&group=${g}` : "";
  };

  const showExercise = useCallback((id: string, fromClassId: string | null) => {
    setComposing(false);
    setExerciseId(id);
    setStudentId(null);
    if (fromClassId) {
      setView("classes");
      setClassId(fromClassId);
      if (typeof window === "undefined") return;
      window.history.pushState(null, "", `/teacher?view=classes&class=${fromClassId}&exercise=${id}`);
      return;
    }
    setView("exercises");
    setClassId(null);
    if (typeof window === "undefined") return;
    window.history.pushState(null, "", `/teacher?view=exercises${groupParam()}&exercise=${id}`);
  }, []);

  const closeExercise = useCallback((fromClassId: string | null) => {
    setExerciseId(null);
    if (typeof window === "undefined") return;
    window.history.replaceState(
      null,
      "",
      fromClassId ? `/teacher?view=classes&class=${fromClassId}` : `/teacher?view=exercises${groupParam()}`,
    );
  }, []);

  // Opening the composer keeps the address you were on and adds itself to it,
  // which is what lets one control take you back to the class, the list or the
  // cockpit by name.
  const openCompose = useCallback((cid: string | null) => {
    setComposing(true);
    setStudentId(null);
    setExerciseId(null);
    if (cid) {
      setView("classes");
      setClassId(cid);
    }
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    q.delete("student");
    q.delete("exercise");
    if (cid) {
      q.set("view", "classes");
      q.set("class", cid);
    }
    q.set("new", "1");
    window.history.pushState(null, "", `/teacher?${q.toString()}`);
  }, []);

  const closeCompose = useCallback(() => {
    setComposing(false);
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    q.delete("new");
    const rest = q.toString();
    window.history.replaceState(null, "", rest ? `/teacher?${rest}` : "/teacher");
  }, []);

  // Given, so it goes where a teacher would look next: its own page.
  const createExercise = useCallback((draft: Omit<TeacherExercise, "id">) => {
    const ex: TeacherExercise = { ...draft, id: `new-${created.length + 1}` };
    setCreated((prev) => [ex, ...prev]);
    setComposing(false);
    setView("exercises");
    setClassId(null);
    setStudentId(null);
    setExerciseId(ex.id);
    if (typeof window === "undefined") return;
    window.history.pushState(null, "", `/teacher?view=exercises&exercise=${ex.id}`);
  }, [created.length]);

  // An address naming a class that does not exist falls back to the list rather
  // than rendering nothing.
  const live = useMemo<TeacherProfile>(
    () => (created.length === 0 ? teacher : { ...teacher, exercises: [...created, ...teacher.exercises] }),
    [teacher, created],
  );

  const openClass = classId ? live.classes.find((c) => c.id === classId) ?? null : null;
  // An exercise carries its own class, so the page has its context even when the
  // address names the exercise alone.
  const openExercise = exerciseId ? live.exercises.find((e) => e.id === exerciseId) ?? null : null;
  const exerciseClass = openExercise
    ? live.classes.find((c) => c.id === openExercise.classId) ?? null
    : null;
  const fromList = view === "exercises";
  const exerciseScreen =
    openExercise && exerciseClass ? (
      <TeacherExercisePage
        teacher={live}
        cls={exerciseClass}
        ex={openExercise}
        backLabel={fromList ? "Exercises" : exerciseClass.name}
        onBack={() => closeExercise(fromList ? null : exerciseClass.id)}
        onOpenStudent={(sid) => showStudent(exerciseClass.id, sid)}
      />
    ) : null;

  // The address is the truth: when the browser walks the history, the screen
  // follows it rather than the other way round.
  useEffect(() => {
    const sync = () => {
      const q = new URLSearchParams(window.location.search);
      const v = q.get("view");
      setView(isViewId(v) ? v : "home");
      setClassId(q.get("class"));
      setStudentId(q.get("student"));
      setExerciseId(q.get("exercise"));
      setComposing(q.get("new") === "1");
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
          <button type="button" className="pf-top__cta" onClick={() => openCompose(null)}>
            New exercise
          </button>
          <ThemeSwitch />
        </div>
      </header>

      {composing && (
        <div className="pf-constellation-stage">
          <TeacherComposePage
            teacher={live}
            presetClassId={classId}
            backLabel={
              openClass ? openClass.name : view === "exercises" ? "Exercises" : view === "classes" ? "All classes" : "Home"
            }
            onBack={closeCompose}
            onCreate={createExercise}
          />
        </div>
      )}

      {!composing && view === "home" && (
        <div className="pf-constellation-stage">
          <TeacherHome
            teacher={live}
            onOpenClass={showClass}
            onOpenExercises={() => showView("exercises")}
            onCompose={openCompose}
          />
        </div>
      )}

      {!composing && view === "classes" && (
        <div className="pf-constellation-stage">
          {exerciseScreen ?? (openClass && studentId ? (
            <TeacherStudentPage
              teacher={live}
              cls={openClass}
              studentId={studentId}
              onBack={() => closeStudent(openClass.id)}
            />
          ) : openClass ? (
            <TeacherClassPage
              teacher={live}
              cls={openClass}
              onBack={() => showView("classes")}
              onOpenStudent={(sid) => showStudent(openClass.id, sid)}
              onOpenExercise={(eid) => showExercise(eid, openClass.id)}
              onCompose={() => openCompose(openClass.id)}
            />
          ) : (
            <TeacherClasses teacher={live} onOpenClass={showClass} />
          ))}
        </div>
      )}

      {!composing && view === "exercises" && (
        <div className="pf-constellation-stage">
          {exerciseScreen ?? (
            <TeacherExercises teacher={live} onOpenExercise={(eid) => showExercise(eid, null)} />
          )}
        </div>
      )}
    </main>
  );
}
