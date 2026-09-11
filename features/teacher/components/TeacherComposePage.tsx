"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOARD_SYSTEM_CSS, CREAM, MODE_ACCENT } from "@/features/profile/components/board-system";
import { ensureGameFontFace } from "@/lib/game/fonts/inject-font-face";
import TeacherBack from "@/features/teacher/components/TeacherBack";
import TeacherContract, {
  confusionKey,
  MIX_PRESETS,
  type ExerciseContract,
} from "@/features/teacher/components/TeacherContract";
import TeacherWhen from "@/features/teacher/components/TeacherWhen";
import { initialWindow, spellMoment, stampOf, windowContract, type WhenWindow } from "@/lib/teacher/when";
import type { ExerciseScope, TeacherExercise, TeacherProfile } from "@/lib/teacher/mock-teacher";
import type { FaceScope, FaceTree, PickableFace } from "@/lib/teacher/faces-contracts";

// ---------------------------------------------------------------------------
// Teacher — the composer. The one screen where a teacher writes instead of reads.
//
// SPEC: docs/product/spec-creation-exercice.md, closed on 2026-09-10. This file
// implements step 1 of its build order, and only that: the picker reasons on the
// REAL catalogue.
//
// WHAT CHANGED, AND WHY IT CHANGES THE SCREEN'S SHAPE. The first version read
// content/typefaces/font-manifest-v4.json, the project's starter list: 23
// servable faces in a single drop-down. The catalogue holds 1 279 playable ones.
// You cannot pick 406 serifs from a menu, so the panel now has the two gestures
// the spec describes, and they are NOT the same thing:
//
//   THE GROUND  — families, chosen with their real counts. The engine may draw
//                 from there.
//   THE STOPS   — faces named one by one, searched by name, GUARANTEED to be
//                 asked. "Travaille les grotesques, mais je veux absolument
//                 Univers" is a ground plus a stop.
//
// FONTS ARE INJECTED ON DEMAND, never declared in bulk. Each row comes back from
// the API with its own CSS family and, for a self hosted face, the descriptor
// this screen declares just before painting it. `font-display: block` in that
// injector means a face that has not arrived paints NOTHING rather than a
// fallback: on a product that trains the eye, a wrong specimen is worse than a
// blank. Adobe faces carry no descriptor, the project stylesheet in the root
// layout having already declared their family.
//
// Nothing is saved anywhere: there is no backend for this yet, so a new exercise
// is added to the space's own state, exactly as renaming a class already is.
// ---------------------------------------------------------------------------

const COUNTS = [10, 15, 20, 25, 30];

const scopeKey = (scope: FaceScope) => `${scope.kind}|${scope.key}`;

/** Le cran, dit au professeur et jamais en paramètre de moteur. */
const EXIGENCE_WORD: Record<string, string> = {
  accessible: "Accessible",
  balanced: "Balanced",
  challenging: "Challenging",
  expert: "Expert",
};

/** "Serif", or "Serif didone": a leaf is never named without its branch. */
const scopeName = (scope: FaceScope) =>
  scope.parent ? `${scope.parent} ${scope.label.toLowerCase()}` : scope.label;

const faceWord = (n: number) => (n === 1 ? "face" : "faces");

// Stable empties, so a derived "nothing chosen" never changes identity between
// renders.
const NO_FACES: PickableFace[] = [];
const NO_PAIRS: { left: string; right: string }[] = [];


export default function TeacherComposePage({
  teacher,
  presetClassId,
  backLabel,
  onBack,
  onCreate,
}: {
  teacher: TeacherProfile;
  presetClassId: string | null;
  backLabel: string;
  onBack: () => void;
  /**
   * The composer hands over everything but the id: the space owns the list of
   * exercises given in this session, so it is the only place that can number
   * them without collision. A counter here would restart at zero, the composer
   * being unmounted the moment an exercise is given.
   */
  onCreate: (draft: Omit<TeacherExercise, "id">) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const classes = useMemo(() => teacher.classes.filter((c) => !c.archived), [teacher.classes]);

  const [classId, setClassId] = useState(presetClassId ?? classes[0]?.id ?? "");
  // Trois types, et ce sont des EFFETS et non des ambiances (spec section 15).
  // L'exercice compte dans la progression, le contrôle mesure sans y toucher, la
  // compétition fait performer. Le mode du moteur en découle, il n'est pas choisi.
  const [kind, setKind] = useState<"exercise" | "control" | "competition">("exercise");
  const mode = kind === "competition" ? "competition" : "training";
  // Le reste du contrat : exigence, adaptation, équilibre. Les paires retenues
  // sont stockées à l'envers, par ce qui a été DÉCOCHÉ, pour qu'un changement de
  // classe reparte de ses propres paires toutes cochées.
  const [terms, setTerms] = useState<Omit<ExerciseContract, "keptConfusions">>({
    exigence: "balanced",
    adaptive: false,
    mixBias: "even",
  });
  const [dropped, setDropped] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(20);
  // THE WINDOW IS TWO MOMENTS, and they cannot be initial state.
  //
  // '/teacher?new=1' is a real address, so this screen does get a server render,
  // and the server's clock is neither the visitor's instant nor their timezone:
  // a default window computed there is a different window after hydration, and
  // for a few hours every evening it is a different DAY. That is the defect the
  // header of TeacherExercise describes for countdowns. So the clock arrives on
  // mount, the two of them together, and TeacherWhen paints its furniture with
  // no values for the one frame before that.
  const [clock, setClock] = useState<{ now: number; when: WhenWindow } | null>(null);
  const now = clock?.now ?? 0;
  const when = clock?.when ?? null;
  const setWhen = useCallback(
    (next: WhenWindow) => setClock((prev) => (prev === null ? prev : { ...prev, when: next })),
    [],
  );

  // The ground, the stops, and what the catalogue answered about them.
  const [tree, setTree] = useState<FaceTree>([]);
  const [total, setTotal] = useState(0);
  const [openBranch, setOpenBranch] = useState<string | null>(null);
  const [scopes, setScopes] = useState<FaceScope[]>([]);
  const [slugs, setSlugs] = useState<string[]>([]);
  const [fetchedPicks, setPicks] = useState<PickableFace[]>([]);
  const [fetchedPairs, setPairs] = useState<{ left: string; right: string }[]>([]);
  const [query, setQuery] = useState("");
  const [fetchedHits, setHits] = useState<PickableFace[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("is-armed");
    const reveal = () => root.classList.add("is-in");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    io.observe(root);
    const fallback = window.setTimeout(reveal, 2200);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  // The clock, read through a callback and never bare in a function declared
  // during render: to the compiler's eye `Date.now()` there is an impure call
  // it cannot know is only ever reached from an event. Same shape as `getNowMs`
  // in CompetitionScreen, for the same reason.
  const readClock = useCallback(() => Date.now(), []);

  useEffect(() => {
    const stamp = readClock();
    // The clock IS the external system this effect synchronises with, which is
    // the case the rule's own text allows: reading it during render is what the
    // purity rule forbids two lines above, and reading it on the server is the
    // hydration defect described where `clock` is declared. It runs once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClock({ now: stamp, when: initialWindow(stamp) });
  }, [readClock]);

  // The tree is small (four branches and nine leaves with their counts), so it
  // arrives once and stays. The 3.4 MB it was computed from never leaves the
  // server.
  useEffect(() => {
    let alive = true;
    fetch("/api/teacher/faces")
      .then((r) => r.json())
      .then((data: { tree?: FaceTree; total?: number }) => {
        if (!alive) return;
        setTree(data.tree ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // ONE call whenever the chosen faces change, and it returns both the rows and
  // the confusable pairs. The pair rule therefore lives in exactly one place,
  // server side, rather than being reimplemented here where it would drift.
  useEffect(() => {
    if (slugs.length === 0) return;
    let alive = true;
    fetch(`/api/teacher/faces?slugs=${encodeURIComponent(slugs.join(","))}`)
      .then((r) => r.json())
      .then((data: { faces?: PickableFace[]; pairs?: { left: string; right: string }[] }) => {
        if (!alive) return;
        const faces = data.faces ?? [];
        faces.forEach((face) => ensureGameFontFace(face.fontFace));
        setPicks(faces);
        setPairs(data.pairs ?? []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [slugs]);

  // Search is debounced because a teacher types faster than a round trip, and
  // every hit paints its own name in its own face, so the fonts come with it.
  useEffect(() => {
    if (query.trim().length < 2) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      fetch(`/api/teacher/faces?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data: { faces?: PickableFace[] }) => {
          if (!alive) return;
          const faces = data.faces ?? [];
          faces.forEach((face) => ensureGameFontFace(face.fontFace));
          setHits(faces);
        })
        .catch(() => undefined);
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  // Filtered on the current slugs rather than trusted as they arrived: removing
  // a face is then instant, and a late answer can never resurrect one.
  const picks = slugs.length === 0 ? NO_FACES : fetchedPicks.filter((f) => slugs.includes(f.slug));
  const pairs = slugs.length < 2 ? NO_PAIRS : fetchedPairs;
  const hits = query.trim().length < 2 ? NO_FACES : fetchedHits;

  const cls = classes.find((c) => c.id === classId) ?? null;
  const accent = MODE_ACCENT[mode] ?? "var(--pf-cream)";

  const addSlug = useCallback((slug: string) => {
    setSlugs((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  }, []);

  const toggleScope = useCallback((scope: FaceScope) => {
    setScopes((prev) =>
      prev.some((s) => scopeKey(s) === scopeKey(scope))
        ? prev.filter((s) => scopeKey(s) !== scopeKey(scope))
        : [...prev, scope],
    );
  }, []);

  // The pair this class keeps getting wrong. The only place the composer looks
  // at what the class has already done, and it is a shortcut, not a default.
  const theirPair = cls?.confusions[0] ?? null;

  const groundCount = scopes.reduce((sum, s) => sum + s.count, 0);
  const keptPairs = (cls?.confusions ?? []).filter(
    (pair) => !dropped.includes(confusionKey(pair)),
  );

  const ready =
    cls !== null && when !== null && title.trim().length > 0 && (scopes.length > 0 || picks.length > 0);
  const missing = !cls
    ? "pick a class"
    : title.trim().length === 0
      ? "give it a name"
      : "choose a family, or name a typeface"; // one is enough: the wrong answers come from the whole catalogue

  const give = () => {
    if (!cls || !ready || !when) return;
    // The clock is read AGAIN here, not reused from mount: a composer left open
    // for an hour would otherwise write a window that started an hour ago.
    const contract = windowContract(when, readClock());
    onCreate({
      title: title.trim(),
      mode,
      classId: cls.id,
      className: cls.name,
      state: contract.scheduled ? "scheduled" : "running",
      dueInHours: contract.dueInHours,
      opensInHours: contract.opensInHours,
      openedForHours: contract.openedForHours,
      // Competition is two minutes for everyone (spec §20, decision 2), so its
      // length is not a question budget. The field still carries a number
      // because the mock's type demands one; the screen never asks for it.
      questionCount: mode === "competition" ? 0 : count,
      assigned: cls.studentCount,
      started: 0,
      finished: 0,
      // The resolved family travels with the face: an Adobe face is painted
      // under the name its stylesheet declares, never as "JDT__<slug>".
      typefaces: picks.map((face) => ({
        slug: face.slug,
        name: face.name,
        fontFamily: face.fontFamily,
      })),
      scope: scopes.map<ExerciseScope>((s) => ({ ...s })),
      // LE CONTRAT, tel que le professeur vient de le poser. Commun à toute la
      // classe : le moteur adaptera à l'intérieur, jamais au delà (I-25).
      kind,
      exigence: terms.exigence,
      adaptive: terms.adaptive,
      mix: MIX_PRESETS[terms.mixBias],
      confusions: keptPairs,
    });
  };

  // Read in the recap sentence. `when` is null for the first frame only.
  const opensSentence =
    when === null ? "…" : stampOf(when.opens) <= now ? "right away" : spellMoment(when.opens);
  const closesSentence = when === null ? "…" : spellMoment(when.due);

  return (
    <div ref={rootRef} className="st tc--new">
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: NEW_CSS }} />

      <TeacherBack label={backLabel} onClick={onBack} />

      <header className="st-intro st-sec">
        <span className="st-kicker">New exercise</span>
        <h1 className="st-title">Give them something to look at.</h1>
        <p className="st-lede">
          Who it is for, which faces it asks about, and until when. Nothing goes
          out until the last button.
        </p>
      </header>

      {/* ── 1. Who, and how it is played ── */}
      <section className="st-panel st-sec" aria-label="Who it is for">
        <h2 className="st-panel__title">Who it is for</h2>
        <div className="tc-new__grid">
          <label className="st-field">
            <span className="st-field__label">Class</span>
            <span className="st-selectwrap">
              <select className="st-select" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.studentCount} students
                  </option>
                ))}
              </select>
              <span className="st-select__caret" aria-hidden="true">▾</span>
            </span>
          </label>

          <label className="st-field">
            <span className="st-field__label">Name it</span>
            <input
              className="st-input"
              type="text"
              value={title}
              placeholder="Transitional serifs, second pass"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="st-field">
            <span className="st-field__label">How it is played</span>
            <div className="st-choice" role="group" aria-label="Type">
              {([
                ["exercise", "Exercice"],
                ["control", "Contrôle"],
                ["competition", "Compétition"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`st-choice__btn${kind === id ? " is-active" : ""}`}
                  aria-pressed={kind === id}
                  onClick={() => setKind(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="tc-new__hint">
              {kind === "exercise"
                ? "They can retry a question until they read it right, and it counts towards their progress."
                : kind === "control"
                  ? "They can retry, but it does not touch their progress: this one is a measurement."
                  : "One answer each, two minutes, and no effect on their progress."}
            </span>
          </div>

          {mode === "training" ? (
            <label className="st-field">
              <span className="st-field__label">How long</span>
              <span className="st-selectwrap">
                <select
                  className="st-select"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {COUNTS.map((n) => (
                    <option key={n} value={n}>{n} questions</option>
                  ))}
                </select>
                <span className="st-select__caret" aria-hidden="true">▾</span>
              </span>
              <span className="tc-new__hint">
                The same number for everyone. Who gets which faces is decided
                below, the length never is.
              </span>
            </label>
          ) : (
            <div className="st-field">
              <span className="st-field__label">How long</span>
              {/* Two minutes for everyone: it is what makes the mode comparable,
                  so it is stated and not offered as a setting (spec §20). */}
              <span className="tc-new__fixed">Two minutes, the same for everyone</span>
              <span className="tc-new__hint">
                A competition is not a number of questions, it is a window: as
                many as they can read in the time.
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ── 2. The ground, and the compulsory stops ── */}
      <section className="st-panel st-sec" aria-label="What it asks about">
        <div className="st-panel__head">
          <h2 className="st-panel__title">What it asks about</h2>
          <span className="st-panel__meta">
            <em>{total}</em> playable faces · only what the product can really serve
          </span>
        </div>

        {/* The ground */}
        <div className="tc-set">
          <div className="tc-set__main">
            <span className="st-field__label">The ground</span>
            <div className="tc-new__branches">
          {tree.map((branch) => {
            const isOn = scopes.some((s) => scopeKey(s) === scopeKey(branch.scope));
            const isOpen = openBranch === branch.scope.key;
            return (
              <div key={branch.scope.key} className="tc-new__branch">
                <div className="tc-new__branchhead">
                  <button
                    type="button"
                    className={`st-filter__btn${isOn ? " is-active" : ""}`}
                    aria-pressed={isOn}
                    onClick={() => toggleScope(branch.scope)}
                  >
                    {branch.scope.label} <em>{branch.scope.count}</em>
                  </button>
                  {branch.children.length > 1 && (
                    <button
                      type="button"
                      className="tc-new__more"
                      aria-expanded={isOpen}
                      onClick={() => setOpenBranch(isOpen ? null : branch.scope.key)}
                    >
                      {isOpen ? "less" : "narrow"}
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="tc-new__leaves">
                    {branch.children.map((leaf) => {
                      const leafOn = scopes.some((s) => scopeKey(s) === scopeKey(leaf));
                      return (
                        <button
                          key={leaf.key}
                          type="button"
                          className={`st-filter__btn${leafOn ? " is-active" : ""}`}
                          aria-pressed={leafOn}
                          onClick={() => toggleScope(leaf)}
                        >
                          {leaf.label} <em>{leaf.count}</em>
                        </button>
                      );
                    })}
                  </div>
                )}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="tc-set__say">
            Point at families. The engine draws from there, and the count on each
            one tells you how much you just opened.
          </p>
        </div>

        {/* The stops */}
        <div className="tc-set">
          <div className="tc-set__main tc-new__stops">
            {/* ONE label, not two. "Faces you want for sure" sat above a second
                label reading "Search the catalogue", on the same field: the
                placeholder says what to type, so the inner one was noise. */}
            <span className="st-field__label">Faces you want for sure</span>
            <div className="tc-new__addrow">
              <input
                className="st-input tc-new__add"
                type="search"
                value={query}
                aria-label="Search the catalogue by name"
                placeholder="Search by name: univers, baskerville, mono…"
                onChange={(e) => setQuery(e.target.value)}
              />

              {theirPair && (
                <button
                  type="button"
                  className="st-action st-action--compact tc-new__shortcut"
                  onClick={() => {
                    addSlug(theirPair.seen.slug);
                    addSlug(theirPair.chosen.slug);
                  }}
                >
                  Add the pair they keep missing
                </button>
              )}
            </div>
          </div>
          <p className="tc-set__say">
            Named here, asked to every student, whatever the families above draw.
          </p>
        </div>

        {hits.length > 0 && (
          <ul className="tc-new__hits">
            {hits.map((face) => (
              <li key={face.slug}>
                <button
                  type="button"
                  className="tc-new__hit"
                  disabled={slugs.includes(face.slug)}
                  onClick={() => addSlug(face.slug)}
                >
                  {/* The name, set in its own face: the specimen labels itself. */}
                  <span className="tc-new__hitname" style={{ fontFamily: face.fontFamily }}>
                    {face.name}
                  </span>
                  <span className="tc-new__hitmeta">
                    {face.subCategory.replace(/_/g, " ")} · {face.difficulty}
                    {slugs.includes(face.slug) ? " · already in" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {picks.length === 0 && scopes.length === 0 ? (
          <p className="st-empty">
            Nothing chosen yet. A family is enough to start: the three wrong
            answers come from the whole catalogue, not from your selection.
          </p>
        ) : (
          <>
            {scopes.length > 0 && (
              <p className="tc-new__ground">
                Drawing from <em>{scopes.map(scopeName).join(", ")}</em>, that is{" "}
                <em>{groundCount}</em> {faceWord(groundCount)}.
              </p>
            )}
            {picks.length > 0 && (
              <ul className="st-faces tc-new__picks">
                {picks.map((face) => (
                  <li key={face.slug} className="st-face tc-new__pick">
                    {/* Nothing on this element but a size: every typographic
                        property comes from the font file. */}
                    <span className="st-face__glyph" style={{ fontFamily: face.fontFamily }}>Aa</span>
                    <span className="st-face__name">{face.name}</span>
                    <span className="tc-new__diff">{face.difficulty}</span>
                    <button
                      type="button"
                      className="st-del tc-new__rm"
                      aria-label={`Remove ${face.name}`}
                      onClick={() => setSlugs((prev) => prev.filter((s) => s !== face.slug))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* MEASURED IN THE FILES, and the only judgement this screen makes. */}
        {picks.length >= 2 && (
          <p className="tc-new__read">
            {pairs.length === 0 ? (
              <>
                None of these look alike, so this asks them to tell apart faces
                that are already far apart. Two from one visual cluster is what
                makes it a real question.
              </>
            ) : (
              <>
                <em>{pairs.length}</em> confusable {pairs.length > 1 ? "pairs" : "pair"} in there:{" "}
                {pairs.slice(0, 3).map((pair, i) => (
                  <span key={`${pair.left}-${pair.right}`}>
                    {i > 0 ? ", " : ""}
                    {pair.left} against {pair.right}
                  </span>
                ))}
                {pairs.length > 3 && `, and ${pairs.length - 3} more`}. Same visual
                cluster, measured in the files, which is what makes it worth
                asking.
              </>
            )}
          </p>
        )}
      </section>

      <TeacherContract
        value={{
          ...terms,
          // Toutes les paires de la classe sont retenues par défaut, sauf celles
          // que le professeur a décochées : c'est lui qui retire, pas lui qui ajoute.
          keptConfusions: (cls?.confusions ?? [])
            .map(confusionKey)
            .filter((key) => !dropped.includes(key)),
        }}
        onChange={(next) => {
          setTerms({ exigence: next.exigence, adaptive: next.adaptive, mixBias: next.mixBias });
          const all = (cls?.confusions ?? []).map(confusionKey);
          setDropped(all.filter((key) => !next.keptConfusions.includes(key)));
        }}
        confusions={cls?.confusions ?? []}
        className={cls?.name ?? "this class"}
      />

      {/* ── 3. When ── */}
      <TeacherWhen value={when} now={now} onChange={setWhen} />

      {/* ── 4. What is about to go out, in one sentence ── */}
      <section className="st-panel st-sec tc-new__recap" aria-label="About to go out">
        <div className="st-panel__head">
          <h2 className="st-panel__title">About to go out</h2>
          <span className="st-panel__meta">read it back, then give it</span>
        </div>
        <p className="tc-new__sentence">
          <em>{mode === "competition" ? "Two minutes" : `${count} questions`}</em> on{" "}
          {scopes.length > 0 ? <em>{scopes.map(scopeName).join(", ")}</em> : null}
          {scopes.length > 0 && picks.length > 0 ? " with " : null}
          {picks.length > 0 ? <em>{picks.length} named faces</em> : null}
          {scopes.length === 0 && picks.length === 0 ? <em>nothing yet</em> : null} for{" "}
          <em>{cls?.name ?? "no class yet"}</em>, {cls ? `${cls.studentCount} students, ` : ""}
          played as{" "}
          <span
            className="st-session__mode tc-new__mode"
            style={{
              borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
              color: `color-mix(in srgb, ${accent} 62%, var(--pf-cream))`,
            }}
          >
            {mode}
          </span>
          . It opens <em>{opensSentence}</em> and closes <em>{closesSentence}</em>.
        </p>

        {/* L'APERCU, ET IL NE PROMET QUE CE QUE LE CONTRAT PORTE. Pas les vingt
            questions exactes : le moteur les compose au moment ou l'eleve joue, et
            avec l'adaptation elles ne sont meme pas les memes pour tout le monde.
            Ce qui est montre est ce qui est decide ici. */}
        <p className="tc-new__preview">
          <span>{cls ? `${cls.studentCount} students` : "no class yet"}</span>
          <span>{kind === "competition" ? "2 minutes" : `${count} questions`}</span>
          <span>{EXIGENCE_WORD[terms.exigence]}{terms.adaptive ? ", tuned per student" : ""}</span>
          {scopes.length > 0 && <span>{scopes.map(scopeName).join(", ")}</span>}
          {picks.length > 0 && <span>{picks.length} {faceWord(picks.length)} asked for sure</span>}
          {keptPairs.length > 0 && (
            <span>
              {keptPairs.length} confusion{keptPairs.length > 1 ? "s" : ""} targeted
            </span>
          )}
        </p>

        {picks.length > 0 && (
          <ul className="st-faces tc-new__previewfaces">
            {picks.slice(0, 6).map((face) => (
              <li key={face.slug} className="st-face">
                {/* Rien que la taille sur cet element : le reste vient du fichier
                    de police, sinon ce n'est pas un specimen. */}
                <span className="st-face__glyph" style={{ fontFamily: face.fontFamily }}>Aa</span>
                <span className="st-face__name">{face.name}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="tc-new__actions">
          <button
            type="button"
            className="st-action st-action--primary"
            disabled={!ready}
            onClick={give}
          >
            {cls ? `Give it to ${cls.name}` : "Give it"}
          </button>
          <button type="button" className="st-action st-action--compact" onClick={onBack}>
            Cancel
          </button>
        </div>
        {!ready && <span className="tc-new__hint">{missing}</span>}
      </section>
    </div>
  );
}

/* Only what belongs to this screen. Everything else reads the site's system. */
const NEW_CSS = `
  .tc-new__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(1rem, 2vw, 1.5rem) clamp(0.9rem, 2vw, 1.4rem); align-items: start; }
  @media (max-width: 760px) { .tc-new__grid { grid-template-columns: 1fr; } }

  /* ── THE ANATOMY OF A SETTING, and the reason this screen was redone ──
     A panel is 1011 px wide inside and a readable line of this text is 440.
     Prose left-aligned in a box that wide leaves fifty-five per cent void
     beside every sentence, which is what "everything is stuck to the left,
     it makes no sense" was pointing at. So a setting is two columns: what you
     touch on the left, what it means on the right, both starting on the same
     line. Declared here and used by TeacherContract and TeacherWhen too: the
     composer is their parent and is always mounted, so one declaration is
     enough and the three panels cannot drift apart. */
  .tc-set { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 0.55rem clamp(1.5rem, 3.2vw, 2.8rem); align-items: start; }
  .tc-set + .tc-set { margin-top: 1.75rem; }
  @media (max-width: 780px) {
    .tc-set { grid-template-columns: 1fr; }
    .tc-set + .tc-set { margin-top: 1.45rem; }
  }
  .tc-set__main { display: grid; gap: 0.5rem; justify-items: start; min-width: 0; }
  .tc-set__main > .st-choice, .tc-set__main > .tc-new__branches, .tc-set__main > .tc-ct__pairs { margin: 0; }
  .tc-set__say { margin: 0; max-width: 60ch; text-wrap: pretty; font-size: 0.78rem; line-height: 1.55; color: rgb(${CREAM} / 0.45); }
  .tc-set__say em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  /* On a narrow screen the explanation follows its control instead of sitting
     in a column of its own, so it must not keep the two-column top gap. */
  @media (max-width: 780px) { .tc-set__say { margin-top: -0.15rem; } }
  @media (max-width: 460px) {
    .tc-set__main > .st-choice { max-width: 100%; flex-wrap: wrap; border-radius: var(--radius); }
  }
  .tc-new__hint { display: block; margin-top: 0.45rem; max-width: 56ch; text-wrap: pretty; font-size: 0.78rem; line-height: 1.5; color: rgb(${CREAM} / 0.45); }
  .st-panel .st-empty { margin-top: 1.5rem; }
  .tc-new__fixed { font-size: 0.9rem; color: var(--pf-cream); padding: 0.6rem 0; }


  /* The ground: four branches, nine leaves, counts in the label. */
  .tc-new__branches { display: flex; flex-wrap: wrap; gap: 0.6rem 1.2rem; align-items: flex-start; }
  .tc-new__branch { display: grid; gap: 0.4rem; }
  .tc-new__branchhead { display: flex; align-items: center; gap: 0.4rem; }
  .tc-new__more { appearance: none; border: none; background: transparent; cursor: pointer; font-family: var(--pf-mono); font-size: 0.54rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(${CREAM} / 0.4); padding: 0.2rem; }
  .tc-new__more:hover { color: var(--pf-cream); }
  .tc-new__leaves { display: flex; flex-wrap: wrap; gap: 0.4rem; max-width: 26rem; }
  .st-filter__btn em { font-style: normal; font-variant-numeric: tabular-nums; opacity: 0.55; }
  .tc-new__ground { margin: 1.5rem 0 0; font-size: 0.84rem; line-height: 1.5; color: rgb(${CREAM} / 0.55); }
  .tc-new__ground em { font-style: normal; font-weight: 640; color: var(--pf-cream); }

  .tc-new__addrow { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; width: 100%; }
  .tc-new__add { flex: 1 1 16rem; min-width: 0; }
  .tc-new__shortcut { flex: none; }
  .tc-new__stops { width: 100%; }

  /* Search results: the name in its own face, so the eye chooses. */
  .tc-new__hits { display: grid; gap: 0; margin: 1.1rem 0 0; padding: 0; list-style: none; max-height: 17rem; overflow-y: auto; }
  .tc-new__hit { width: 100%; appearance: none; border: none; background: transparent; cursor: pointer; text-align: left; display: grid; gap: 0.1rem; padding: 0.5rem 0.6rem; border-radius: var(--radius-pill); border-top: 1px solid rgb(${CREAM} / 0.08); transition: background-color 140ms ease; }
  .tc-new__hits li:first-child .tc-new__hit { border-top: none; }
  .tc-new__hit:hover:not(:disabled) { background: rgb(${CREAM} / 0.05); }
  .tc-new__hit:disabled { cursor: default; opacity: 0.45; }
  .tc-new__hitname { font-size: 1.15rem; line-height: 1.25; color: var(--pf-cream); }
  .tc-new__hitmeta { font-family: var(--pf-mono); font-size: 0.54rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(${CREAM} / 0.38); }

  .tc-new__picks { grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); margin-top: 1.5rem; }
  .tc-new__pick { position: relative; align-content: start; }
  .tc-new__diff { font-family: var(--pf-mono); font-size: 0.5rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(${CREAM} / 0.32); }
  .tc-new__rm { position: absolute; top: -0.35rem; right: -0.35rem; }

  .tc-new__read { margin: 1.5rem 0 0; max-width: 62ch; text-wrap: pretty; font-size: 0.82rem; line-height: 1.55; color: rgb(${CREAM} / 0.55); }
  .tc-new__read em { font-style: normal; font-weight: 640; color: var(--pf-cream); }

  .tc-new__recap { border-color: rgb(${CREAM} / 0.22); }
  /* L'apercu : des faits separes, lisibles d'un coup d'oeil, jamais une phrase. */
  .tc-new__preview { display: flex; flex-wrap: wrap; gap: 0.3rem 0.9rem; margin: 0 0 1.1rem; font-family: var(--pf-mono); font-size: 0.62rem; letter-spacing: 0.04em; text-transform: uppercase; color: rgb(${CREAM} / 0.5); }
  .tc-new__preview span + span::before { content: "·"; margin-right: 0.9rem; color: rgb(${CREAM} / 0.3); }
  .tc-new__previewfaces { grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr)); margin-bottom: 1.2rem; }
  .tc-new__sentence { margin: 0 0 1.1rem; max-width: 62ch; text-wrap: pretty; font-size: 0.95rem; line-height: 1.6; color: rgb(${CREAM} / 0.6); }
  .tc-new__sentence em { font-style: normal; font-weight: 640; color: var(--pf-cream); }
  .tc-new__mode { display: inline-block; vertical-align: 0.05em; }
  .tc-new__actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
  .tc-new__actions + .tc-new__hint { margin-top: 1.1rem; }
`;
