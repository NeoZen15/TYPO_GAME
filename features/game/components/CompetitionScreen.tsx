"use client";

import Link from "next/link";
import { competitionModeCopy } from "@/content/copy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import SessionRecap from "@/features/game/components/SessionRecap";
import {
  buildCompetitionRecapView,
  COMPETITION_RECAP_UNAVAILABLE,
} from "@/lib/game/competition/recap-view";
import { isDevRuntime } from "@/lib/dev-mode";
import { formatClickTime } from "@/lib/game/competition/format";
import {
  COMPETITION_COLOR_HOLD_MS,
  COMPETITION_FEEDBACK_DELAY_MS,
  COMPETITION_FEEDBACK_PERSIST_MS,
} from "@/lib/game/competition/constants";
import { ensureGameFontFace } from "@/lib/game/fonts/inject-font-face";
import {
  type CompetitionAnswerResponse,
  type CompetitionQuestion,
  type CompetitionSessionSummary,
  type CompetitionStartResponse,
  type CompetitionStats,
  type CompetitionTimeoutResponse,
} from "@/lib/game/competition/contracts";
import { CARD_COLORS } from "@/lib/game/card-colors";

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



const getPreferredLocale = () =>
  typeof document !== "undefined" && document.documentElement.lang.startsWith("en")
    ? "en"
    : "fr";

// On-demand @font-face injection now lives in lib/game/fonts/inject-font-face,
// shared with the training screen: one style element, one dedupe set, one
// mechanism. A face declared here stays declared if the player switches mode.

// ---------------------------------------------------------------------------
// ONE ROUND EQUALS ONE IDENTIFIER, the client half of the convergence the
// competition provider gained on 2026-08-17. Without it the server-side
// ON CONFLICT (session_id) is unreachable: two calls that each let the server
// mint an identifier can never collide, and two rounds open. Measured before:
// two starts fired together returned two session ids.
//
// WHY THESE FOUR HELPERS ARE COPIED HERE AND NOT IMPORTED. They already exist,
// character for character, in GameScreen.tsx, and
// scripts/quality/check-client-attempt-contract.mjs guards them by READING THAT
// FILE AS TEXT. Extracting them into a shared module would leave that guard
// looking at a file where its patterns no longer appear, so it would fail on the
// training path this change does not touch. The duplication is deliberate and
// costed: sharing them means moving the guard first, which is its own change.
//
// sessionStorage, and never React state: a reload has to replay the SAME
// identifier so the server rejoins the round it already wrote instead of opening
// a second one, and a value held in state would die with the reload. Scoped to
// the tab, so a second tab is a second round, which is what it is.
const ATTEMPT_STORAGE_KEY = "jdt-competition-attempt-v1";

// uuid VERSION 4, and the version is not a detail. The server validates this
// against ATTEMPT_ID_PATTERN (lib/game/training/contracts.ts), which demands a
// version nibble in 1 to 5 and a variant nibble in 8 to b. Any other shape is
// refused IN SILENCE: the server mints its own, the response stays valid, and a
// reload opens a second round again with nothing anywhere to say why.
const mintAttemptId = (): string => {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // crypto.randomUUID only exists in a secure context, so a phone hitting the
  // dev server over a local IP would throw on the very first render. This
  // rebuilds the same v4 shape by hand.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// Read on a reload or a retry, minted and persisted on a new round, all of it
// BEFORE the request leaves. Minting on the response would lose the identifier in
// exactly the case that creates the duplicate: a reload while the first call is
// in flight aborts the request, so nothing is stored here while the server has
// already finished its write.
const takeAttemptId = ({ fresh }: { fresh: boolean }): string => {
  if (typeof window === "undefined") return mintAttemptId();
  try {
    const stored = fresh ? null : window.sessionStorage.getItem(ATTEMPT_STORAGE_KEY);
    if (stored) return stored;
    const minted = mintAttemptId();
    window.sessionStorage.setItem(ATTEMPT_STORAGE_KEY, minted);
    return minted;
  } catch {
    // Storage blocked (private mode, or a locked-down browser): the round still
    // gets an identifier, it just cannot survive a reload. A page load must never
    // throw over this.
    return mintAttemptId();
  }
};

const ATTEMPT_ID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Adopt the identifier the server actually settled on. It cannot always rejoin
// the one we sent: a round already finished, already swept, or owned by another
// player makes it mint its own. Keeping ours would leave this tab sending, for
// ever, an identifier the server can never rejoin. The shape is checked rather
// than trusted, because whatever lands in storage goes back out as a primary key.
const adoptAttemptId = (serverSessionId: string) => {
  if (typeof window === "undefined") return;
  if (!ATTEMPT_ID_SHAPE.test(serverSessionId)) return;
  try {
    window.sessionStorage.setItem(ATTEMPT_STORAGE_KEY, serverSessionId);
  } catch {
    // Same reasoning as above: never throw on a page load over storage.
  }
};

// Called only once a round is really over. Dropping it earlier is the bug this
// closes: the next load would mint a new identifier and open a second round
// beside one still running.
const dropAttemptId = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    // Never throw over storage.
  }
};

const formatRemaining = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

// LA FEUILLE LOCALE DE COMPETITION EST PARTIE, demande du proprietaire du
// 2026-08-26 : « on refait cette page exactement comme la training en DA, mais
// avec le monde competition ». Il y avait ici 320 lignes de CSS injectees en
// `<style jsx global>` APRES app/globals.css, donc qui gagnaient sur elle : une
// deuxieme direction artistique pour le meme jeu. Elles redeclaraient le fond de
// page, la coquille encadree, les pastilles du haut, le mot, les cartes de
// reponse, le retour de reponse et les boutons, avec leurs propres couleurs
// ecrites en dur (`--competition-*`) au lieu des jetons du site. C'est de la que
// venaient les deux ecarts visibles : un rectangle autour du plateau, retire de
// training le 2026-08-19, et des pastilles de score en trois couleurs quand
// training porte une seule barre de relevee.
//
// Ce mode n'a donc plus de CSS a lui. Il joue sur les classes `game-v2-*` de
// app/globals.css, exactement celles de l'entrainement, et ne change qu'une
// chose : la couleur d'accent du relevee, prise dans la palette des modes qui
// existe deja (`--mode-competition`), via `data-mode="competition"` pose sur la
// page. Le monde competition est dans les CHIFFRES du relevee (points, reponses,
// temps qui descend), pas dans une mise en page separee.

const buildPreviewSummary = (): CompetitionSessionSummary => ({
  wrongCount: 7,
  accuracyRate: 65,
  fastAnswerCount: 6,
  answersPerMinute: 9.5,
  pointsPerMinute: 6,
  averagePointsPerAnswer: 0.6,
  averageResponseTimeMs: 1480,
  averageCorrectResponseTimeMs: 1280,
  averageWrongResponseTimeMs: 1870,
  fastestResponseTimeMs: 620,
  slowestResponseTimeMs: 2890,
  bestCorrectStreak: 4,
  uniqueTypefacesSeenCount: 19,
  categoryPerformance: [
    { category: "sans_serif", answeredCount: 8, correctCount: 6, accuracyRate: 75 },
    { category: "serif", answeredCount: 7, correctCount: 4, accuracyRate: 57.1 },
    { category: "mono", answeredCount: 4, correctCount: 3, accuracyRate: 75 },
    { category: "display", answeredCount: 1, correctCount: 0, accuracyRate: 0 },
  ],
  strongestCategories: [
    { category: "sans_serif", answeredCount: 8, correctCount: 6, accuracyRate: 75 },
    { category: "mono", answeredCount: 4, correctCount: 3, accuracyRate: 75 },
  ],
  weakestCategories: [
    { category: "display", answeredCount: 1, correctCount: 0, accuracyRate: 0 },
    { category: "serif", answeredCount: 7, correctCount: 4, accuracyRate: 57.1 },
  ],
  commonConfusions: [
    {
      correctSlug: "ibmplexmono",
      correctLabel: "IBM Plex Mono",
      guessedSlug: "firacode",
      guessedLabel: "Fira Code",
      count: 2,
    },
    {
      correctSlug: "spectral",
      correctLabel: "Spectral",
      guessedSlug: "tinos",
      guessedLabel: "Tinos",
      count: 2,
    },
    {
      correctSlug: "publicsans",
      correctLabel: "Public Sans",
      guessedSlug: "inter",
      guessedLabel: "Inter",
      count: 1,
    },
  ],
  recentMisses: [
    {
      correctSlug: "spectral",
      correctLabel: "Spectral",
      guessedSlug: "tinos",
      guessedLabel: "Tinos",
      responseTimeMs: 1680,
      displayWord: "contraste",
      category: "serif",
    },
    {
      correctSlug: "ibmplexmono",
      correctLabel: "IBM Plex Mono",
      guessedSlug: "firacode",
      guessedLabel: "Fira Code",
      responseTimeMs: 1140,
      displayWord: "epaisseur",
      category: "mono",
    },
    {
      correctSlug: "playfair_display",
      correctLabel: "Playfair Display",
      guessedSlug: "ebgaramond",
      guessedLabel: "EB Garamond",
      responseTimeMs: 2220,
      displayWord: "ligne",
      category: "serif",
    },
  ],
  answerTimeline: [
    { answerIndex: 1, responseTimeMs: 1820, isCorrect: false, awardedPoints: 0 },
    { answerIndex: 2, responseTimeMs: 890, isCorrect: true, awardedPoints: 2 },
    { answerIndex: 3, responseTimeMs: 1430, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 4, responseTimeMs: 1190, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 5, responseTimeMs: 2260, isCorrect: false, awardedPoints: 0 },
    { answerIndex: 6, responseTimeMs: 980, isCorrect: true, awardedPoints: 2 },
    { answerIndex: 7, responseTimeMs: 1340, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 8, responseTimeMs: 1510, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 9, responseTimeMs: 2720, isCorrect: false, awardedPoints: 0 },
    { answerIndex: 10, responseTimeMs: 640, isCorrect: true, awardedPoints: 2 },
    { answerIndex: 11, responseTimeMs: 830, isCorrect: true, awardedPoints: 2 },
    { answerIndex: 12, responseTimeMs: 1570, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 13, responseTimeMs: 1710, isCorrect: false, awardedPoints: 0 },
    { answerIndex: 14, responseTimeMs: 1280, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 15, responseTimeMs: 760, isCorrect: true, awardedPoints: 2 },
    { answerIndex: 16, responseTimeMs: 1450, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 17, responseTimeMs: 2890, isCorrect: false, awardedPoints: 0 },
    { answerIndex: 18, responseTimeMs: 1030, isCorrect: true, awardedPoints: 1 },
    { answerIndex: 19, responseTimeMs: 920, isCorrect: true, awardedPoints: 2 },
    { answerIndex: 20, responseTimeMs: 1680, isCorrect: false, awardedPoints: 0 },
  ],
  speedBuckets: [
    { label: "<1s", count: 6, percentage: 30, tone: "positive" },
    { label: "1-2s", count: 9, percentage: 45, tone: "neutral" },
    { label: "2-3s", count: 5, percentage: 25, tone: "warning" },
    { label: "3s+", count: 0, percentage: 0, tone: "negative" },
  ],
});

export default function CompetitionScreen() {
  const searchParams = useSearchParams();
  const previewMode = searchParams.get("preview");
  const isCompletePreview = previewMode === "complete";
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<CompetitionQuestion | null>(null);
  const [stats, setStats] = useState<CompetitionStats | null>(null);
  const [summary, setSummary] = useState<CompetitionSessionSummary | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [isComplete, setIsComplete] = useState(false);
  const [isRoundLocked, setIsRoundLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inlineFeedback, setInlineFeedback] = useState<InlineFeedback>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const advanceTimerRef = useRef<number | null>(null);
  const feedbackClearTimerRef = useRef<number | null>(null);
  const pendingAdvanceRef = useRef<(() => void) | null>(null);
  const clockOffsetRef = useRef(0);
  const attemptStartedAtRef = useRef<number>(Date.now());
  const timeoutTriggeredRef = useRef(false);
  const inFlightRef = useRef(false);
  const answerInFlightRef = useRef(false);

  const getNowMs = useCallback(() => Date.now() + clockOffsetRef.current, []);

  // THE ROUND IS A DURATION, NOT A DATE, and that is the whole of this fix.
  //
  // The countdown used to be `new Date(stats.deadlineUtc) - Date.now()`: an
  // instant computed on the DATABASE clock, compared against the clock of
  // whatever device is playing. A phone two minutes fast saw the round already
  // over at the second it opened, zero questions, straight to the recap, and
  // nothing anywhere to say why. Not exotic on a public launch, only rare.
  //
  // The payload already carried the honest value. stats.remainingMs is how much
  // of the round is left, measured entirely server-side, and a duration cannot be
  // skewed by the reader's clock. So the arrival is stamped with the LOCAL clock
  // and everything after is a local difference: the absolute offset cancels, and
  // only the local rate of time matters, which is the one thing every clock
  // agrees on. deadlineUtc stays in the contract, it is simply no longer what the
  // screen counts down against.
  const remainingAnchorRef = useRef<{ atMs: number; remainingMs: number } | null>(null);

  // Every setStats goes through here. Four call sites set stats (start, answer,
  // timeout, preview) and an anchor stamped at three of them is a countdown that
  // silently keeps using a stale one at the fourth.
  const applyStats = useCallback(
    (next: CompetitionStats | null) => {
      setStats(next);
      remainingAnchorRef.current = next
        ? { atMs: getNowMs(), remainingMs: next.remainingMs }
        : null;
      setClockNow(getNowMs());
    },
    [getNowMs]
  );

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    pendingAdvanceRef.current = null;
  }, []);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackClearTimerRef.current !== null) {
      window.clearTimeout(feedbackClearTimerRef.current);
      feedbackClearTimerRef.current = null;
    }
  }, []);

  const scheduleFeedbackClear = useCallback((delayMs: number) => {
    clearFeedbackTimer();
    feedbackClearTimerRef.current = window.setTimeout(() => {
      setInlineFeedback(null);
      feedbackClearTimerRef.current = null;
    }, delayMs);
  }, [clearFeedbackTimer]);

  const beginQuestion = useCallback((nextQuestion: CompetitionQuestion) => {
    ensureGameFontFace(nextQuestion.fontFace);
    setQuestion(nextQuestion);
    setSelectedId("");
    setResult("idle");
    setIsRoundLocked(false);
    attemptStartedAtRef.current = getNowMs();
  }, [getNowMs]);

  const flushAdvance = useCallback(() => {
    if (!pendingAdvanceRef.current) return;
    const next = pendingAdvanceRef.current;
    clearAdvanceTimer();
    next();
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

  // `fresh` decides whether this is the same round or a new one. A reload and the
  // error retry replay the identifier already stored, because they are the same
  // round; only "Play again" mints a new one. The parameter has a default so the
  // mount effect keeps calling startSession() with no argument and the callback
  // identity, which feeds that effect's dependency array, does not change.
  const startSession = useCallback(async ({ fresh = false }: { fresh?: boolean } = {}) => {
    // A ref, not a piece of state: disabled={isLoading} only becomes true on the
    // next render, so a fast double click, or a mount effect that runs twice,
    // fires two requests before React has repainted anything. The training screen
    // has had this guard since the double start plan; this one never got it.
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    clearAdvanceTimer();
    timeoutTriggeredRef.current = false;
    clockOffsetRef.current = 0;
    setClockNow(Date.now());
    setIsLoading(true);
    setError(null);
    setIsComplete(false);
    setSessionId(null);
    setQuestion(null);
    applyStats(null);
    setSummary(null);
    setSelectedId("");
    setResult("idle");
    setInlineFeedback(null);
    setIsRoundLocked(false);

    try {
      const attemptId = takeAttemptId({ fresh });
      const response = await fetch("/api/competition/session/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale: getPreferredLocale(),
          // The only value this client chooses that reaches a primary key. The
          // database arbitrates two concurrent starts on it, so a reload rejoins
          // the round already running, with the time it has left, instead of
          // opening a second one and buying itself a fresh two minutes.
          attemptId,
        }),
      });

      if (!response.ok) {
        throw new Error("competition_session_start_failed");
      }

      const payload = (await response.json()) as CompetitionStartResponse;
      // Reconcile. When the server could not rejoin what we sent, because the
      // round was finished, expired or swept, it answered with an identifier of
      // its own, and keeping ours would make every later reload open a new round.
      if (payload.sessionId !== attemptId) {
        adoptAttemptId(payload.sessionId);
      }
      setSessionId(payload.sessionId);
      applyStats(payload.stats);
      beginQuestion(payload.question);
    } catch (sessionError) {
      console.error(sessionError);
      setError("Unable to start the competition session.");
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [applyStats, beginQuestion, clearAdvanceTimer]);

  useEffect(() => {
    if (isCompletePreview) {
      const totalDurationMs = 120_000;
      setSessionId("competition-preview-complete");
      setQuestion(null);
      applyStats({
        answeredCount: 20,
        correctCount: 13,
        score: 12,
        totalDurationMs,
        remainingMs: 0,
        deadlineUtc: new Date(Date.now() - totalDurationMs).toISOString(),
      });
      setSummary(buildPreviewSummary());
      setSelectedId("");
      setResult("idle");
      setInlineFeedback(null);
      setError(null);
      setIsRoundLocked(false);
      setIsComplete(true);
      setIsLoading(false);
      timeoutTriggeredRef.current = true;
      return () => {
        clearAdvanceTimer();
        clearFeedbackTimer();
      };
    }

    void startSession();

    return () => {
      clearAdvanceTimer();
      clearFeedbackTimer();
    };
  }, [applyStats, clearAdvanceTimer, clearFeedbackTimer, isCompletePreview, startSession]);

  useEffect(() => {
    if (!sessionId || !stats || isComplete) {
      return;
    }

    const timer = window.setInterval(() => {
      setClockNow(getNowMs());
    }, 200);

    return () => {
      window.clearInterval(timer);
    };
  }, [getNowMs, isComplete, sessionId, stats]);

  // Released only once the round is really over, whichever of the three paths
  // ended it: the timeout call, an answer that ran out the clock, or a timeout
  // response served in place of an answer. Dropping it any earlier is the bug
  // this closes, the next load would mint a new identifier and open a second
  // round beside one still running. Dropping it here rather than at each of the
  // three sites means a fourth ending, added later, cannot forget to.
  useEffect(() => {
    if (isCompletePreview || !isComplete) return;
    dropAttemptId();
  }, [isComplete, isCompletePreview]);

  const remainingMs = useMemo(() => {
    const anchor = remainingAnchorRef.current;
    if (!stats || !anchor) return 0;
    // Local difference only. clockNow and anchor.atMs come from the same clock,
    // so whatever that clock is set to cancels out.
    return Math.max(0, anchor.remainingMs - (clockNow - anchor.atMs));
  }, [clockNow, stats]);

  useEffect(() => {
    // Automation hooks, development only. `advanceTime` moves the competition
    // clock, so production must never install them.
    if (!isDevRuntime()) return;

    window.render_game_to_text = () =>
      JSON.stringify({
        mode: "competition",
        status: isLoading ? "loading" : error ? "error" : isComplete ? "complete" : "playing",
        sessionId,
        stats: stats
          ? {
              ...stats,
              remainingMs,
            }
          : null,
        question: question
          ? {
              id: question.id,
              displayWord: question.displayWord,
              typefaceSlug: question.typefaceSlug,
              options: question.options,
            }
          : null,
        summary,
        inlineFeedback,
        selectedId,
        result,
      });

    window.advanceTime = (ms: number) => {
      clockOffsetRef.current += ms;
      setClockNow(getNowMs());
      if (ms >= COMPETITION_FEEDBACK_DELAY_MS) {
        flushAdvance();
      }
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [error, flushAdvance, getNowMs, inlineFeedback, isComplete, isLoading, question, remainingMs, result, selectedId, sessionId, stats, summary]);

  useEffect(() => {
    if (
      !sessionId ||
      !stats ||
      isComplete ||
      isLoading ||
      error ||
      isRoundLocked ||
      timeoutTriggeredRef.current ||
      remainingMs > 0
    ) {
      return;
    }

    timeoutTriggeredRef.current = true;

    void (async () => {
      try {
        const response = await fetch("/api/competition/session/timeout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          throw new Error("competition_timeout_failed");
        }

        const payload = (await response.json()) as CompetitionTimeoutResponse;
        applyStats(payload.stats);
        setSummary(payload.summary);
        setQuestion(null);
        setSelectedId("");
        setResult("idle");
        setInlineFeedback({ kind: "wrong", text: payload.feedbackText });
        setIsComplete(true);
      } catch (timeoutError) {
        console.error(timeoutError);
        setError("Unable to close the competition session.");
      }
    })();
  }, [applyStats, error, isComplete, isLoading, isRoundLocked, remainingMs, sessionId, stats]);

  const handleSelect = useCallback(
    async (optionId: string) => {
      if (!sessionId || !question || isComplete || isLoading || isRoundLocked) {
        return;
      }

      // Re-entrance, on a ref rather than on isRoundLocked. That state IS set
      // first, but React only applies it, and `disabled`, on the next render, so
      // several clicks inside one tick all read the old value and all fire.
      // Measured in a real browser on 2026-08-17: three synchronous click() on
      // one option sent THREE answer POST carrying the same token. The server
      // dedupes them correctly now, so this is no longer a correctness fix, only
      // two wasted requests competing for bandwidth in a timed round.
      if (answerInFlightRef.current) return;
      answerInFlightRef.current = true;

      setSelectedId(optionId);
      setError(null);
      clearFeedbackTimer();
      setInlineFeedback(null);
      setIsRoundLocked(true);

      // LA COULEUR NE DOIT PAS ATTENDRE LE RESEAU, meme correction qu'en entrainement.
      // Le client connait deja la bonne reponse, `question.typefaceSlug` arrive avec la
      // question. Le serveur reste l'autorite et ecrase cet etat quelques dizaines de
      // millisecondes plus tard. Le calcul des points n'est pas touche :
      // `responseTimeMs` est fige dans le corps de la requete juste en dessous, avant
      // toute mise a jour d'affichage.
      const instantDuClic = performance.now();
      setResult(optionId === question.typefaceSlug ? "correct" : "wrong");

      try {
        const response = await fetch("/api/competition/answer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            questionToken: question.token,
            answerSlug: optionId,
            responseTimeMs: Math.max(0, Math.round(getNowMs() - attemptStartedAtRef.current)),
          }),
        });

        if (!response.ok) {
          throw new Error("competition_answer_failed");
        }

        const payload = (await response.json()) as CompetitionAnswerResponse | CompetitionTimeoutResponse;
        applyStats(payload.stats);

        if (!("result" in payload)) {
          setSummary(payload.summary);
          setQuestion(null);
          setSelectedId(optionId);
          setResult("idle");
          setInlineFeedback({ kind: "wrong", text: payload.feedbackText });
          setIsRoundLocked(false);
          setIsComplete(true);
          return;
        }

        if (payload.sessionComplete) {
          setSummary(payload.summary ?? null);
          setQuestion(null);
          setSelectedId(optionId);
          setResult("idle");
          setInlineFeedback({
            kind: payload.result,
            text: `${payload.feedbackText} · ${formatClickTime(payload.responseTimeMs)}`,
          });
          setIsRoundLocked(false);
          setIsComplete(true);
          return;
        }

        setResult(payload.result);
        setInlineFeedback({
          kind: payload.result,
          text: `${payload.feedbackText} · ${formatClickTime(payload.responseTimeMs)}`,
        });
        scheduleFeedbackClear(COMPETITION_FEEDBACK_PERSIST_MS);

        // Inject the next face now so its woff2 has a head start during the
        // short feedback delay before beginQuestion renders it.
        ensureGameFontFace(payload.nextQuestion?.fontFace);

        // Ce qui reste a tenir pour que la couleur ait dure COMPETITION_COLOR_HOLD_MS
        // DEPUIS LE CLIC. Quand l'aller-retour a deja pris plus longtemps, il ne reste
        // rien a attendre et le mot suivant part sans delai supplementaire.
        const resteATenir = Math.max(
          COMPETITION_FEEDBACK_DELAY_MS,
          COMPETITION_COLOR_HOLD_MS - (performance.now() - instantDuClic)
        );

        queueAdvance(() => {
          if (payload.nextQuestion) {
            beginQuestion(payload.nextQuestion);
            return;
          }

          setIsComplete(true);
          setQuestion(null);
          setSelectedId("");
          setResult("idle");
          setInlineFeedback(null);
          setIsRoundLocked(false);
        }, resteATenir);
      } catch (submitError) {
        console.error(submitError);
        setError("Unable to submit this answer.");
        setIsRoundLocked(false);
      } finally {
        // Released whichever way the call left, including the early returns of
        // the two completion branches above. A ref left true on one path is a
        // screen that never accepts another answer.
        answerInFlightRef.current = false;
      }
    },
    [
      applyStats,
      beginQuestion,
      clearFeedbackTimer,
      getNowMs,
      isComplete,
      isLoading,
      isRoundLocked,
      question,
      queueAdvance,
      scheduleFeedbackClear,
      sessionId,
    ]
  );


  const currentQuestion = question;

  // The end of a session is its own page, not a card inside the game shell.
  // Owner's brief of 2026-08-15: same figures, art direction rebuilt on the
  // profile's Stats tab. Returned before the shell so the recap is not fighting
  // the fixed-height, centred, framed layout the playing screen needs. Every
  // hook above still runs on every render, this only swaps what is painted.
  if (isComplete) {
    return (
      <SessionRecap
        view={
          summary
            ? buildCompetitionRecapView(summary, stats)
            : COMPETITION_RECAP_UNAVAILABLE
        }
        onPlayAgain={() => void startSession({ fresh: true })}
      />
    );
  }

  // `data-mode` est le SEUL endroit ou cet ecran se distingue de l entrainement :
  // il fait basculer `--hud-accent` du vert des modes vers l orange, dans
  // app/globals.css. Pose sur la page et non sur la coquille, parce que le releve
  // est en position absolue par rapport a la page.
  return (
    <main className="game-v1-page game-v2-page" data-mode="competition">
      <ThemeSwitch />
      <section
        /* `competition-v1-shell` portait le rectangle : filet, fond, ombre et
           hauteur fixe. Training l a perdu le 2026-08-19 (« supprime le
           rectangle »), donc il part ici aussi. `data-state` visait le seul etat
           `complete`, or une seance finie repart en SessionRecap au dessus et
           n atteint jamais cette coquille : l attribut ne decrivait plus rien. */
        className="game-v1-shell game-v2-shell"
        aria-label="Competition mode"
        aria-busy={isLoading || isRoundLocked}
      >
        {/* RELEVE DE SEANCE, la barre exacte de l entrainement : trois zones sur
            une ligne, les compteurs a gauche, la pastille du mode au centre
            exact, le temps a droite. Meme balisage, donc meme repli sur
            telephone (le mode seul sur la premiere ligne) sans une regle de
            plus, et l ordre du DOM suit l ordre visuel pour qu un lecteur d
            ecran lise la barre comme elle se voit.
            Ce qui change est le CONTENU, et c est bien le monde competition : des
            points au lieu de bonnes reponses, un total de reponses, et un temps
            qui DESCEND la ou l entrainement compte celui qui monte. La forme des
            pastilles reste « nombre + mot ».
            Trois pastilles remplacaient ici trois couleurs differentes, une par
            valeur ; la regle de la palette des modes veut une seule couleur de
            mode par ecran, en contour et en lavis. Le rouge ne revient que pour
            la derniere demi minute, ou il dit quelque chose. */}
        {stats ? (
          <div className="game-v2-hud">
            <span className="game-v2-hud__side game-v2-hud__side--start">
              <span className="game-v2-hud__stat" aria-label="Score">
                <em>{stats.score}</em> {competitionModeCopy.scoreLabel}
              </span>
              <span className="game-v2-hud__stat" aria-label="Answers given">
                <em>{stats.answeredCount}</em> {competitionModeCopy.answeredLabel}
              </span>
            </span>

            <span className="game-v2-hud__mode">{competitionModeCopy.badge}</span>

            <span className="game-v2-hud__side game-v2-hud__side--end">
              {/* Le seul modificateur d accent de la barre. Il ne s allume que
                  sous 30 secondes, donc le rouge reste un signal et pas une
                  decoration. Le libelle accessible dit le compte a rebours,
                  parce qu une duree seule ne dit pas dans quel sens elle va. */}
              <span
                className={`game-v2-hud__stat${
                  remainingMs <= 30_000 ? " game-v2-hud__stat--urgent" : ""
                }`}
                aria-label="Time left"
              >
                {formatRemaining(remainingMs)}
              </span>
            </span>
          </div>
        ) : null}

        <div className="game-v2-word-wrap">
          {isLoading ? (
            /* NI L ATTENTE NI L ECHEC NE SONT DES SPECIMENS, la meme correction
               qu en training. Les deux messages portaient `game-v2-word`, donc la
               taille, la couleur et l emplacement reserves au mot a reconnaitre :
               un message d interface empruntait la typographie de la question, ce
               que la regle de cette classe interdit precisement. Ils passent sur
               la typographie de titre du site. Le `h1` reste. */
            <h1 className="game-v2-status">Loading competition</h1>
          ) : currentQuestion ? (
            <h1
              className="game-v2-word"
              // Même règle qu'en training : le poids du fichier, jamais un poids
              // que le navigateur devrait fabriquer.
              style={{
                fontFamily: currentQuestion.fontFamily,
                fontWeight: currentQuestion.fontFace?.weight ?? 400,
              }}
            >
              {currentQuestion.displayWord}
            </h1>
          ) : (
            <h1 className="game-v2-status game-v2-status--down">Competition unavailable</h1>
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

        {!error && !isLoading && !isComplete && currentQuestion ? (
          <>
            <section className="game-v2-options" role="radiogroup" aria-label="Competition options">
              {currentQuestion.options.map((option, index) => {
                const selected = selectedId === option.slug;
                const isCorrect = result === "correct" && selected;
                const isWrong = result === "wrong" && selected;

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
          </>
        ) : null}
      </section>
    </main>
  );
}
