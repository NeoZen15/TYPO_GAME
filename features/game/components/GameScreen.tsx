"use client";

import Link from "next/link";
import { trainingProgressCopy } from "@/content/copy";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSearchParams } from "next/navigation";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import SessionRecap from "@/features/game/components/SessionRecap";
import { isDevRuntime } from "@/lib/dev-mode";
import { ensureGameFontFace } from "@/lib/game/fonts/inject-font-face";
import { TRAINING_CORRECT_DELAY_MS } from "@/lib/game/training/catalog";
import {
  buildTrainingRecapView,
  TRAINING_RECAP_UNAVAILABLE,
} from "@/lib/game/training/recap-view";
import {
  type TrainingAnswerResponse,
  type TrainingProgress,
  type TrainingQuestion,
  type TrainingSessionSummary,
  type TrainingStartResponse,
} from "@/lib/game/training/contracts";

// Synthetic figures for ?preview=complete. Deliberately plausible rather than
// round, so the page is judged on real-looking data, and deliberately never
// written anywhere.
const PREVIEW_SUMMARY: TrainingSessionSummary = {
  durationMs: 247_000,
  questionsResolved: 18,
  answersSubmitted: 23,
  firstTryCorrect: 13,
  firstTryAccuracy: 0.72,
  retryCount: 5,
  typefacesSeen: 18,
  typefacesDiscovered: ["spectral", "tinos", "aleo"],
  typefacesReinforced: ["lora", "eb-garamond", "asap", "alumni-sans"],
  typefacesWeakened: ["playfair-display"],
  masteryNet: 3,
  confusions: [
    { shown: "spectral", shownLabel: "Spectral", chosen: "tinos", chosenLabel: "Tinos", count: 2 },
    {
      shown: "ibmplexmono",
      shownLabel: "IBM Plex Mono",
      chosen: "firacode",
      chosenLabel: "Fira Code",
      count: 1,
    },
    {
      shown: "playfairdisplay",
      shownLabel: "Playfair Display",
      chosen: null,
      chosenLabel: null,
      count: 1,
    },
  ],
  medianResponseMs: 1_640,
  fastestResponseMs: 720,
  slowestResponseMs: 4_180,
};

declare global {
  interface Window {
    advanceTime?: (ms: number) => void;
    render_game_to_text?: () => string;
  }
}

type InlineFeedback = {
  kind: "correct" | "wrong";
  text: string;
} | null;

// The server's own progress shape, not a copy of it. It WAS a copy, field for
// field, and the copy silently went stale the moment the payload gained a
// field: the screen could not read what the engine was already sending. One
// declaration, in the contract both sides share.
type ProgressState = TrainingProgress;

// Level-change toast lifetime (N-24/N-25). The global visible level is NEVER
// shown continuously in game; it surfaces only as this brief toast when it moves.
const LEVEL_TOAST_MS = 3200;

const CARD_COLORS = ["#8EA2FF", "#67D6B6", "#F5BF6A", "#F39AB1"] as const;

const getPreferredLocale = () =>
  typeof document !== "undefined" && document.documentElement.lang.startsWith("en")
    ? "en"
    : "fr";

// Mirror of features/onboarding/components/OnboardingFlow (ONBOARDING_STORAGE_KEY).
// The familiarity answer seeds the initial Leitner boxes on the first session.
const ONBOARDING_STORAGE_KEY = "jdt-onboarding-v1";

const readOnboarding = (): { familiarity: string | null; warmupCorrect: boolean | null } => {
  if (typeof window === "undefined") return { familiarity: null, warmupCorrect: null };
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return { familiarity: null, warmupCorrect: null };
    const parsed = JSON.parse(raw) as { familiarity?: string; warmupCorrect?: boolean };
    return {
      familiarity: parsed.familiarity ?? null,
      // Only forward a real boolean; a missing value means "no downgrade" downstream.
      warmupCorrect: typeof parsed.warmupCorrect === "boolean" ? parsed.warmupCorrect : null,
    };
  } catch {
    return { familiarity: null, warmupCorrect: null };
  }
};

// One attempt equals one identifier. sessionStorage, deliberately, and never
// React state: a reload has to replay the SAME identifier so the server rejoins
// the session it already wrote instead of opening a second one, and a value held
// in state would both die with the reload and re-run the mount effect every time
// it changed. Scoped to the tab, so a second tab is a second attempt, which is
// what it is.
const ATTEMPT_STORAGE_KEY = "jdt-training-attempt-v1";

// uuid VERSION 4, and the version is not a detail. The server validates this
// value against ATTEMPT_ID_PATTERN (lib/game/training/contracts.ts), which
// demands a version nibble in 1 to 5 and a variant nibble in 8 to b. A uuidv7,
// or any other shape, is refused IN SILENCE: the server mints its own, the
// response stays valid, and a reload opens a second session again with nothing
// anywhere to say why. crypto.randomUUID emits v4, so it is pinned here.
const mintAttemptId = (): string => {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // crypto.randomUUID only exists in a secure context, so a phone hitting the
  // dev server over a local IP would throw on the very first render. This
  // fallback rebuilds the SAME v4 shape by hand: version nibble forced to 4,
  // variant nibble forced into 8 to b. A well formed uuid of another version
  // would pass every client-side test and still be refused in silence.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// Read on a retry, minted and persisted on a new attempt, all of it BEFORE the
// request leaves. Minting on the response would lose the identifier in exactly
// the case that creates the duplicate: a reload while the first call is in
// flight aborts the request, so no cookie is processed and nothing is stored
// here, while the server has already finished its write.
const takeAttemptId = ({ fresh }: { fresh: boolean }): string => {
  if (typeof window === "undefined") return mintAttemptId();
  try {
    const stored = fresh ? null : window.sessionStorage.getItem(ATTEMPT_STORAGE_KEY);
    if (stored) return stored;
    const minted = mintAttemptId();
    window.sessionStorage.setItem(ATTEMPT_STORAGE_KEY, minted);
    return minted;
  } catch {
    // Storage blocked (private mode, or a locked-down browser): the attempt
    // still gets an identifier, it just cannot survive a reload. A page load
    // must never throw over this.
    return mintAttemptId();
  }
};

// Adopt the identifier the server actually settled on. The server cannot always
// rejoin the one we sent: a session swept for inactivity, a closed one, or one
// owned by another player makes it mint its own and answer with a new session
// (lib/game/training/provider.ts, the bounded re-entry). Keeping ours would leave
// this tab sending, for ever, an identifier the server can never rejoin, so every
// single reload would open a new session. That is the reload guarantee lost
// permanently at the first thirty minute sweep, and this is the line that keeps it.
// The shape checked here rather than trusted, because whatever lands in storage
// goes back out as a primary key on the next start. The start route answers JSON
// even on a 500, so a response that carried no session at all would hand this
// function `undefined`, and String(undefined) is a perfectly storable "undefined"
// that would burn a session row on every later load. Anything that is not an
// identifier is therefore ignored rather than stored, which makes that whole
// class harmless instead of merely detectable. Same family as
// ATTEMPT_ID_PATTERN (lib/game/training/contracts.ts): version 1 to 5, variant
// 8 to b, since that is what the server will accept back.
const ATTEMPT_ID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const adoptAttemptId = (serverSessionId: string) => {
  if (typeof window === "undefined") return;
  if (!ATTEMPT_ID_SHAPE.test(serverSessionId)) return;
  try {
    window.sessionStorage.setItem(ATTEMPT_STORAGE_KEY, serverSessionId);
  } catch {
    // Same reasoning as above: never throw on a page load over storage.
  }
};

// Called only after a session was really closed. Dropping the identifier any
// earlier is the bug this closes: the next load would mint a new one and open a
// second session on a session that is still open.
const dropAttemptId = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    // A storage that cannot be written cannot be stale either.
  }
};

export default function GameScreen() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<TrainingQuestion | null>(null);
  // No total: a training session has no planned length (I-17).
  const [progress, setProgress] = useState<ProgressState>({
    resolvedCount: 0,
  });
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [wrongAttemptIds, setWrongAttemptIds] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  // The end route has always returned a full TrainingSessionSummary and this
  // screen threw the body away: it showed one sentence and two buttons while the
  // server had already counted what moved, what was confused and how fast the
  // answers came. Kept now, and read by the recap.
  const [summary, setSummary] = useState<TrainingSessionSummary | null>(null);
  // ?preview=complete paints the end of a session without playing one, the same
  // affordance the competition screen already had. Read-only: it writes nothing,
  // starts no session, and the figures below are visibly synthetic.
  const previewComplete = useSearchParams().get("preview") === "complete";
  const [isRoundLocked, setIsRoundLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Closing is an optional gesture, so its failure must not take the game down.
  // The render gates the question, the options and the progress line on `error`
  // being null, so writing a refused close into that same state would make a 500
  // on an optional button destroy the question in progress. This one gates nothing.
  const [closeError, setCloseError] = useState<string | null>(null);
  const [inlineFeedback, setInlineFeedback] = useState<InlineFeedback>(null);
  const [levelToast, setLevelToast] = useState<string | null>(null);

  const advanceTimerRef = useRef<number | null>(null);
  const attemptStartedAtRef = useRef<number>(0);
  const pendingAdvanceRef = useRef<(() => void) | null>(null);
  const levelToastTimerRef = useRef<number | null>(null);
  // Re-entrance guards. A ref, not a piece of state: disabled={isLoading} only
  // becomes true on the next render, so a fast double click, or a mount effect
  // that runs twice, fires two requests before React has repainted anything.
  const inFlightRef = useRef(false);
  const answerInFlightRef = useRef(false);
  const endInFlightRef = useRef(false);

  const showLevelToast = useCallback((level: string) => {
    if (levelToastTimerRef.current !== null) {
      window.clearTimeout(levelToastTimerRef.current);
    }
    setLevelToast(`New level ${level}`);
    levelToastTimerRef.current = window.setTimeout(() => {
      setLevelToast(null);
      levelToastTimerRef.current = null;
    }, LEVEL_TOAST_MS);
  }, []);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    pendingAdvanceRef.current = null;
  }, []);

  const beginQuestion = useCallback((nextQuestion: TrainingQuestion) => {
    // Declare this face before showing it. Idempotent, so calling it here covers
    // every question (first and subsequent) even when the earlier preload below
    // already ran. Without this the specimen renders in a fallback font and the
    // question asks for a typeface that is not on screen.
    ensureGameFontFace(nextQuestion.fontFace);
    setQuestion(nextQuestion);
    setSelectedId("");
    setResult("idle");
    setWrongAttemptIds([]);
    setInlineFeedback(null);
    setIsRoundLocked(false);
    attemptStartedAtRef.current = performance.now();
  }, []);

  const flushAdvance = useCallback(() => {
    if (!pendingAdvanceRef.current) return;

    const pending = pendingAdvanceRef.current;
    clearAdvanceTimer();
    pending();
  }, [clearAdvanceTimer]);

  const queueAdvance = useCallback(
    (nextStep: () => void, delayMs: number) => {
      clearAdvanceTimer();
      pendingAdvanceRef.current = nextStep;
      advanceTimerRef.current = window.setTimeout(() => {
        flushAdvance();
      }, delayMs);
    },
    [clearAdvanceTimer, flushAdvance]
  );

  // `fresh` decides whether this is the same attempt or a new one. A retry
  // replays the identifier already stored, because a retry is the same attempt;
  // only a closed session and "Play again" mint a new one. The parameter has a
  // default so the mount effect keeps calling startSession() with no argument
  // and the callback identity, which feeds that effect's dependency array,
  // does not change.
  const startSession = useCallback(async ({ fresh = false }: { fresh?: boolean } = {}) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    clearAdvanceTimer();
    setIsLoading(true);
    setError(null);
    setCloseError(null);
    setIsComplete(false);
    setSessionId(null);
    setQuestion(null);
    setSelectedId("");
    setResult("idle");
    setWrongAttemptIds([]);
    setInlineFeedback(null);
    setIsRoundLocked(false);

    try {
      const onboarding = readOnboarding();
      const attemptId = takeAttemptId({ fresh });
      const response = await fetch("/api/training/session/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale: getPreferredLocale(),
          familiarity: onboarding.familiarity,
          warmupCorrect: onboarding.warmupCorrect,
          // The only value this client chooses that reaches a primary key. The
          // database arbitrates two concurrent starts on it, so a reload that
          // sends it back rejoins its own session instead of opening a second.
          attemptId,
        }),
      });

      if (!response.ok) {
        throw new Error("training_session_start_failed");
      }

      const payload = (await response.json()) as TrainingStartResponse;
      // Reconcile, and this line is load bearing. When the server could not
      // rejoin what we sent it answered with an identifier of its own, so the
      // stored value now points at a session this tab can never rejoin. Adopting
      // the server's keeps "a reload rejoins its session" true past the first
      // inactivity sweep, instead of turning every later reload into a new session.
      if (payload.sessionId !== attemptId) {
        adoptAttemptId(payload.sessionId);
      }
      setSessionId(payload.sessionId);
      setProgress(payload.progress);
      beginQuestion(payload.question);
    } catch (sessionError) {
      console.error(sessionError);
      setError("Unable to start the training session.");
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [beginQuestion, clearAdvanceTimer]);

  // Voluntary end of a session (I-17). A training session has no round cap any
  // more, so nothing closes it on its own: without this call the row stays
  // active for ever, and the "Session complete" branch below stays dead code.
  const endSession = useCallback(async () => {
    if (!sessionId || endInFlightRef.current) return;
    endInFlightRef.current = true;
    setCloseError(null);

    try {
      // Identity is NOT sent: the route reads it from the httpOnly guest cookie
      // and refuses a body that disagrees with it.
      const response = await fetch("/api/training/session/end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error("training_session_end_failed");
      }

      // Read before completing, and tolerated when absent: a session that closes
      // without figures still closes, the recap says so rather than waiting.
      const payload = (await response.json().catch(() => null)) as {
        summary?: TrainingSessionSummary;
      } | null;

      clearAdvanceTimer();
      setIsRoundLocked(false);
      setInlineFeedback(null);
      setSummary(payload?.summary ?? null);
      setIsComplete(true);
      // Released only now, once the session is really closed. A failed close
      // keeps the identifier, so the next load rejoins the same session rather
      // than opening a second one next to a session still open.
      dropAttemptId();
    } catch (endError) {
      console.error(endError);
      // Its own state, never the one the render gates on: a refused close leaves
      // the question, the options and the progress line exactly where they were.
      setCloseError("Unable to close this session. It is still open.");
    } finally {
      endInFlightRef.current = false;
    }
  }, [clearAdvanceTimer, sessionId]);

  useEffect(() => {
    void startSession();

    return () => {
      clearAdvanceTimer();
      if (levelToastTimerRef.current !== null) {
        window.clearTimeout(levelToastTimerRef.current);
        levelToastTimerRef.current = null;
      }
    };
  }, [clearAdvanceTimer, startSession]);

  useEffect(() => {
    // Automation hooks, development only. They expose the whole session state
    // and let a caller skip the answer delay, so production never installs them.
    if (!isDevRuntime()) return;

    window.render_game_to_text = () =>
      JSON.stringify({
        mode: "training",
        status: isLoading ? "loading" : error ? "error" : isComplete ? "complete" : "playing",
        // Exposed so a browser proof can assert that a refused close reports
        // itself WITHOUT changing the status above.
        closeError,
        sessionId,
        progress,
        levelToast,
        question: question
          ? {
              id: question.id,
              displayWord: question.displayWord,
              typefaceSlug: question.typefaceSlug,
              options: question.options,
            }
          : null,
        selectedId,
        result,
        wrongAttemptIds,
        uiAudit:
          typeof document === "undefined"
            ? null
            : (() => {
                const shell = document.querySelector<HTMLElement>(".game-v1-shell.game-v2-shell");
                const word = document.querySelector<HTMLElement>(".game-v2-word");
                const options = document.querySelector<HTMLElement>(".game-v2-options");
                const option = document.querySelector<HTMLElement>(".game-v2-option");

                const rectFor = (node: HTMLElement | null) =>
                  node
                    ? {
                        width: Math.round(node.getBoundingClientRect().width),
                        height: Math.round(node.getBoundingClientRect().height),
                      }
                    : null;

                return {
                  shell: rectFor(shell),
                  word: word
                    ? {
                        ...rectFor(word),
                        fontSize: window.getComputedStyle(word).fontSize,
                        lineHeight: window.getComputedStyle(word).lineHeight,
                        color: window.getComputedStyle(word).color,
                      }
                    : null,
                  options: rectFor(options),
                  option: option
                    ? {
                        ...rectFor(option),
                        borderRadius: window.getComputedStyle(option).borderRadius,
                        backgroundColor: window.getComputedStyle(option).backgroundColor,
                      }
                    : null,
                };
              })(),
      });

    window.advanceTime = (ms: number) => {
      if (ms >= TRAINING_CORRECT_DELAY_MS) {
        flushAdvance();
      }
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [closeError, error, flushAdvance, isComplete, isLoading, levelToast, progress, question, result, selectedId, sessionId, wrongAttemptIds]);

  const handleSelect = useCallback(
    async (optionId: string) => {
      if (!sessionId || !question || isComplete || isLoading || isRoundLocked) {
        return;
      }

      // Re-entrance, on a ref rather than on isRoundLocked, and the reasoning is
      // the one already written above startSession: state and `disabled` only
      // land on the next render, so several clicks inside one tick all read the
      // old value and all fire. The guard was on the start path and not on this
      // one. Harmless here, the answer writer being idempotent since the double
      // start plan, but two wasted requests all the same.
      if (answerInFlightRef.current) return;
      answerInFlightRef.current = true;

      setSelectedId(optionId);
      setError(null);
      setIsRoundLocked(true);

      try {
        const response = await fetch("/api/training/answer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            questionToken: question.token,
            answerSlug: optionId,
            responseTimeMs: Math.max(0, Math.round(performance.now() - attemptStartedAtRef.current)),
          }),
        });

        if (!response.ok) {
          throw new Error("training_answer_failed");
        }

        const payload = (await response.json()) as TrainingAnswerResponse;
        // Merge: wrong turns omit the mastery aggregate, so keep the last values
        // instead of blanking the indicator between a miss and the next resolve.
        setProgress((prev) => ({ ...prev, ...payload.progress }));
        // N-24/N-25: the global visible level is never shown continuously; raise a
        // brief toast ONLY when the level actually moved on this answer.
        if (payload.progress.levelChanged && payload.progress.visibleLevel) {
          showLevelToast(payload.progress.visibleLevel);
        }
        setInlineFeedback({
          kind: payload.result,
          text: payload.feedbackText,
        });

        if (payload.result === "wrong") {
          setResult("wrong");
          setWrongAttemptIds((current) =>
            current.includes(optionId) ? current : [...current, optionId]
          );
          setIsRoundLocked(false);
          attemptStartedAtRef.current = performance.now();
          return;
        }

        setResult("correct");

        // A session no longer ends on its own: there is no round cap, so answering
        // always continues. Closing is an explicit act, endSession above, reached
        // from the button under the options. Its shape and its wording belong to
        // the owner; what matters here is that answering never closes anything.

        if (payload.nextQuestion) {
          // Declare the next face as soon as it arrives, not when it is shown: the
          // feedback delay becomes a preload window, so the woff2 is usually in
          // cache before the swap (spec §9.1, "précharger la police suivante").
          ensureGameFontFace(payload.nextQuestion.fontFace);
          queueAdvance(() => {
            beginQuestion(payload.nextQuestion!);
          }, TRAINING_CORRECT_DELAY_MS);
          return;
        }

        setIsRoundLocked(false);
      } catch (submitError) {
        console.error(submitError);
        setError("Unable to submit this answer.");
        setIsRoundLocked(false);
      } finally {
        // Released whichever way the call left, the wrong-answer early return
        // included. A ref left true on one path is a screen that never accepts
        // another answer.
        answerInFlightRef.current = false;
      }
    },
    [
      beginQuestion,
      isComplete,
      isLoading,
      isRoundLocked,
      question,
      queueAdvance,
      sessionId,
      showLevelToast,
    ]
  );

  const currentQuestion = question;

  if (previewComplete) {
    return (
      <SessionRecap view={buildTrainingRecapView(PREVIEW_SUMMARY)} onPlayAgain={() => {}} />
    );
  }

  // The end of a session is its own page, like competition's. Returned before
  // the shell so the recap is not fighting the fixed-height, centred layout the
  // playing screen needs. Every hook above still runs on every render.
  //
  // Training borrows nothing from competition's vocabulary here: no score, no
  // clock, no points. Its adapter reads mastery movement, first-attempt
  // accuracy and confusions, which is what this mode actually measures.
  if (isComplete) {
    return (
      <SessionRecap
        view={summary ? buildTrainingRecapView(summary) : TRAINING_RECAP_UNAVAILABLE}
        onPlayAgain={() => void startSession({ fresh: true })}
      />
    );
  }

  return (
    <main className="game-v1-page game-v2-page">
      <ThemeSwitch />
      <section
        className="game-v1-shell game-v2-shell"
        aria-label="Guess the typeface"
        aria-busy={isLoading || isRoundLocked}
      >
        {levelToast ? (
          <div className="game-v2-level-toast" role="status" aria-live="polite">
            {levelToast}
          </div>
        ) : null}

        <div className="game-v2-word-wrap">
          {/* No complete branch here any more: a finished session returns the
              recap above, before this shell is ever reached. */}
          {isLoading ? (
            <h1 className="game-v2-word">Loading session</h1>
          ) : currentQuestion ? (
            <h1
              className="game-v2-word"
              // Le poids que le fichier déclare, pas celui que la mise en page
              // aimerait : demander autre chose laisse le navigateur le fabriquer.
              style={{
                fontFamily: currentQuestion.fontFamily,
                fontWeight: currentQuestion.fontFace?.weight ?? 400,
              }}
            >
              {currentQuestion.displayWord}
            </h1>
          ) : (
            <h1 className="game-v2-word">Training unavailable</h1>
          )}
        </div>

        {error ? (
          <div className="game-v2-actions">
            <p className="game-v2-feedback" data-state="wrong" aria-live="polite">
              {error}
            </p>
            <button type="button" className="game-v2-validate" onClick={() => void startSession()}>
              Retry session
            </button>
            <Link href="/play" className="game-link">
              Back to modes
            </Link>
          </div>
        ) : null}

        {!error && !isLoading && !isComplete && currentQuestion && progress.masteryPercent !== undefined ? (
          // Unobtrusive progression indicator. Deliberately NOT the global eye
          // level, which spec §15 / N-24 keep OFF the game screen except on a
          // level-change toast.
          //
          // D3, 2026-08-15. Was `X / Y faces mastered`, which counted only the
          // top rung of a 0 to 4 ladder that rises by at most one per first
          // attempt success on faces spaced apart: a first session read 0 / 30
          // and could not move. The gauge reads the whole ladder, so a session
          // shows. Gated on masteryPercent rather than poolSize, since it is now
          // the value being printed.
          <p className="game-v2-progress" aria-live="polite">
            {progress.masteryPercent}% {trainingProgressCopy.gaugeLabel}
          </p>
        ) : null}

        {!error && !isLoading && !isComplete && currentQuestion ? (
          <>
            <section className="game-v2-options" role="radiogroup" aria-label="Typeface options">
              {currentQuestion.options.map((option, index) => {
                const selected = selectedId === option.slug;
                const isCorrect = result === "correct" && selected;
                const isWrong = wrongAttemptIds.includes(option.slug);

                return (
                  <button
                    key={`${currentQuestion.id}-${option.slug}`}
                    type="button"
                    className={`game-v2-option${selected ? " is-selected" : ""}${isCorrect ? " is-correct" : ""}${isWrong ? " is-wrong" : ""}`}
                    style={{ ["--card-color" as string]: CARD_COLORS[index] ?? CARD_COLORS[0] }}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => void handleSelect(option.slug)}
                    disabled={isRoundLocked}
                  >
                    <span className="game-v2-option-label">{option.label}</span>
                  </button>
                );
              })}
            </section>

            <p className="game-v2-feedback" data-state={inlineFeedback?.kind ?? "idle"} aria-live="polite">
              {inlineFeedback?.text ?? "\u00A0"}
            </p>

            {/* Minimal affordance for the voluntary close, on the classes already
                in service on this screen so it adds no CSS. Placement and wording
                are the owner's call; the session simply has to be closable. */}
            <div className="game-v2-actions">
              <button
                type="button"
                className="game-link"
                onClick={() => void endSession()}
                disabled={isRoundLocked}
              >
                End session
              </button>
              {/* Reported next to the gesture that failed, and gating nothing:
                  the question above stays playable. */}
              {closeError ? (
                <p className="game-v2-feedback" data-state="wrong" aria-live="polite">
                  {closeError}
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {/* The end of a session lives in SessionRecap, returned above. Keeping a
            second copy here is what made two callers ask for a fresh attempt,
            which check:client-attempt-contract refuses: only Play again may open
            a new attempt. */}
      </section>
    </main>
  );
}
