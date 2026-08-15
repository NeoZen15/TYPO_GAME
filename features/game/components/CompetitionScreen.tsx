"use client";

import Link from "next/link";
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

const CARD_COLORS = ["#8EA2FF", "#67D6B6", "#F5BF6A", "#F39AB1"] as const;

const getPreferredLocale = () =>
  typeof document !== "undefined" && document.documentElement.lang.startsWith("en")
    ? "en"
    : "fr";

// On-demand @font-face injection now lives in lib/game/fonts/inject-font-face,
// shared with the training screen: one style element, one dedupe set, one
// mechanism. A face declared here stays declared if the player switches mode.

const formatRemaining = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const competitionScreenStyles = `
  .game-v1-page.game-v2-page {
    --competition-page-bg: #f6f3ee;
    --competition-shell-bg: rgba(255, 252, 248, 0.92);
    --competition-shell-border: rgba(58, 38, 48, 0.1);
    --competition-ink: #2a1a20;
    --competition-muted: rgba(58, 38, 48, 0.58);
    --competition-subtle: rgba(58, 38, 48, 0.46);
    --competition-info: #455cc7;
    --competition-info-soft: rgba(142, 162, 255, 0.13);
    --competition-info-line: rgba(72, 111, 255, 0.22);
    --competition-positive: #21785e;
    --competition-positive-soft: rgba(103, 214, 182, 0.13);
    --competition-positive-line: rgba(66, 186, 147, 0.24);
    --competition-warning: #9b5c0e;
    --competition-warning-soft: rgba(245, 191, 106, 0.14);
    --competition-warning-line: rgba(242, 167, 68, 0.24);
    --competition-negative: #b33636;
    --competition-negative-soft: rgba(179, 54, 54, 0.08);
    --competition-negative-line: rgba(179, 54, 54, 0.24);
    min-height: 100svh;
    width: 100%;
    display: grid;
    place-items: center;
    padding: clamp(0.72rem, 2vw, 1.4rem);
    background: var(--competition-page-bg);
    color: var(--competition-ink);
  }

  :root[data-theme="dark"] .game-v1-page.game-v2-page {
    --competition-page-bg: #111114;
    --competition-shell-bg: rgba(17, 17, 20, 0.86);
    --competition-shell-border: rgba(244, 243, 238, 0.12);
    --competition-ink: #f4f3ee;
    --competition-muted: rgba(244, 243, 238, 0.62);
    --competition-subtle: rgba(244, 243, 238, 0.48);
    --competition-info: #b9c4ff;
    --competition-info-soft: rgba(142, 162, 255, 0.14);
    --competition-info-line: rgba(142, 162, 255, 0.34);
    --competition-positive: #9ef0d4;
    --competition-positive-soft: rgba(103, 214, 182, 0.14);
    --competition-positive-line: rgba(103, 214, 182, 0.34);
    --competition-warning: #ffd79a;
    --competition-warning-soft: rgba(245, 191, 106, 0.15);
    --competition-warning-line: rgba(245, 191, 106, 0.36);
    --competition-negative: #fca5a5;
    --competition-negative-soft: rgba(248, 113, 113, 0.12);
    --competition-negative-line: rgba(248, 113, 113, 0.38);
  }

  .game-v1-shell.competition-v1-shell {
    width: min(96vw, 68rem);
    height: min(94svh, 48rem);
    display: grid;
    grid-template-rows: auto 1fr auto auto;
    gap: 0.76rem;
    padding: clamp(0.82rem, 1.8vw, 1.1rem);
    border-radius: var(--radius);
    border: 1px solid color-mix(in srgb, var(--competition-shell-border) 72%, transparent);
    background: color-mix(in srgb, var(--competition-shell-bg) 58%, transparent);
    box-shadow: 0 0.85rem 2rem rgba(42, 26, 32, 0.045);
    overflow: hidden;
  }

  :root[data-theme="dark"] .game-v1-shell.competition-v1-shell {
    box-shadow: 0 0.85rem 2rem rgba(0, 0, 0, 0.22);
  }

  .game-v1-shell.competition-v1-shell[data-state="complete"] {
    position: relative;
    width: min(96vw, 74rem);
    height: auto;
    min-height: 0;
    align-content: start;
    padding: clamp(1.1rem, 2.4vw, 1.85rem);
    border-radius: var(--radius);
    border: 1px solid rgba(255, 210, 19, 0.22);
    background:
      radial-gradient(circle at top, rgba(255, 210, 19, 0.05), transparent 30%),
      color-mix(in srgb, var(--competition-shell-bg) 58%, transparent);
    box-shadow: 0 0.85rem 2rem rgba(42, 26, 32, 0.05);
    overflow: hidden;
  }

  :root[data-theme="dark"] .game-v1-shell.competition-v1-shell[data-state="complete"] {
    background:
      radial-gradient(circle at top, rgba(255, 210, 19, 0.045), transparent 28%),
      color-mix(in srgb, var(--competition-shell-bg) 58%, transparent);
    box-shadow: 0 0.85rem 2rem rgba(0, 0, 0, 0.24);
  }

  .competition-v1-top {
    width: min(100%, 48rem);
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .game-v1-chip {
    margin: 0;
    min-width: 0;
    width: 100%;
    text-align: center;
    padding: 0.34rem 0.62rem;
    border-radius: var(--radius-pill);
    border: 1px solid rgba(58, 38, 48, 0.16);
    background: rgba(244, 243, 238, 0.66);
    box-shadow: 0 0.12rem 0.3rem rgba(42, 26, 32, 0.04);
    font-size: 0.72rem;
    line-height: 1;
    font-weight: 560;
  }

  .competition-v1-chip--time {
    border-color: var(--competition-info-line);
    background: var(--competition-info-soft);
    color: var(--competition-info);
  }

  .competition-v1-chip--score {
    border-color: var(--competition-positive-line);
    background: var(--competition-positive-soft);
    color: var(--competition-positive);
  }

  .competition-v1-chip--answered {
    border-color: var(--competition-warning-line);
    background: var(--competition-warning-soft);
    color: var(--competition-warning);
  }

  .competition-v1-chip--urgent {
    border-color: var(--competition-negative-line);
    background: var(--competition-negative-soft);
    color: var(--competition-negative);
  }

  .game-v2-word-wrap {
    display: grid;
    align-content: center;
    justify-items: center;
    width: 100%;
    min-height: 0;
  }

  .game-v1-shell.competition-v1-shell[data-state="complete"] .game-v2-word-wrap {
    display: block;
    align-self: stretch;
  }

  .game-v2-word,
  .competition-v1-word {
    margin: 0;
    color: var(--competition-ink);
    text-align: center;
    text-wrap: balance;
  }

  .game-v2-word {
    font-family: Iowan Old Style, Palatino, "Times New Roman", serif;
    font-size: clamp(4rem, 9vw, 6.4rem);
    line-height: 0.92;
    /* Même raison qu'en training : les approches appartiennent au fondeur, pas
       à la mise en page, et le mot est la question posée au joueur. */
    letter-spacing: normal;
    /* Cette feuille est injectée APRÈS globals, elle écrasait donc la règle qui
       y interdit la synthèse. Même raison qu'en training : chaque police du
       catalogue n'a qu'un poids réel, demander 500 laissait le navigateur
       fabriquer la différence et dédoubler les lettres. Un jeu de
       reconnaissance ne montre que des lettres dessinées par leur fondeur. */
    font-weight: 400;
    font-synthesis: none;
  }

  .game-v2-options {
    width: min(100%, 34rem);
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.72rem;
  }

  .game-v2-option {
    position: relative;
    min-height: 5.2rem;
    border-radius: var(--radius);
    border: 1px solid rgba(58, 38, 48, 0.12);
    background: rgba(244, 243, 238, 0.86);
    box-shadow: 0 0.3rem 0.9rem rgba(42, 26, 32, 0.08);
    cursor: pointer;
    transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease;
  }

  .game-v2-option::before {
    content: "";
    position: absolute;
    left: 0.7rem;
    top: 0.72rem;
    bottom: 0.72rem;
    width: 0.22rem;
    border-radius: var(--radius-pill);
    background: var(--card-color, #8ea2ff);
  }

  .game-v2-option:hover,
  .game-v2-option:focus-visible {
    transform: translateY(-1px);
    border-color: rgba(58, 38, 48, 0.2);
    box-shadow: 0 0.45rem 1rem rgba(42, 26, 32, 0.1);
  }

  .game-v2-option.is-selected,
  .game-v2-option.is-correct,
  .game-v2-option.is-wrong {
    border-color: color-mix(in srgb, var(--card-color, #8ea2ff) 44%, rgba(58, 38, 48, 0.14));
  }

  .game-v2-option-label {
    display: grid;
    place-items: center;
    min-height: 100%;
    padding: 1rem 1.2rem 1rem 1.6rem;
    text-align: center;
    font-size: 1.05rem;
    line-height: 1.16;
    font-weight: 620;
    color: var(--competition-ink);
  }

  .game-v2-feedback {
    margin: 0;
    min-height: 1.4rem;
    text-align: center;
    font-size: 0.86rem;
    line-height: 1.35;
    color: var(--competition-muted);
  }

  .game-v2-feedback[data-state="correct"] {
    color: var(--competition-positive);
  }

  .game-v2-feedback[data-state="wrong"] {
    color: var(--competition-negative);
  }

  .game-v2-actions {
    margin-top: 0.25rem;
    display: grid;
    justify-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .game-v2-validate {
    border: none;
    background: transparent;
    color: #3a2630;
    text-decoration: underline;
    text-underline-offset: 0.2rem;
    text-transform: lowercase;
    font-family: Iowan Old Style, Palatino, "Times New Roman", serif;
    font-style: italic;
    font-size: clamp(1.05rem, 2vw, 1.44rem);
    font-weight: 600;
    padding: 0.2rem 0.4rem;
    cursor: pointer;
  }

  :root[data-theme="dark"] .game-v2-validate {
    color: #f4f3ee;
  }

  .game-v2-validate:disabled {
    opacity: 0.34;
    cursor: not-allowed;
  }

  .game-link {
    justify-self: start;
    margin-top: 0.2rem;
    padding: 0.56rem 0.94rem;
    border-radius: var(--radius-pill);
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    text-decoration: none;
    color: currentColor;
    font-size: 0.86rem;
    line-height: 1;
    font-weight: 600;
  }

  @media (max-width: 640px) {
    .game-v1-page.game-v2-page {
      padding: 0.68rem;
    }

    .game-v1-shell.competition-v1-shell {
      width: min(96vw, 32rem);
      height: min(95svh, 42rem);
      padding: 0.88rem 0.74rem;
      gap: 0.72rem;
    }

    .competition-v1-top,
    .game-v2-options {
      grid-template-columns: 1fr;
    }

    .game-v2-word {
      font-size: clamp(3rem, 16vw, 4.4rem);
    }
  }
`;

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

  const getNowMs = useCallback(() => Date.now() + clockOffsetRef.current, []);

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

  const startSession = useCallback(async () => {
    clearAdvanceTimer();
    timeoutTriggeredRef.current = false;
    clockOffsetRef.current = 0;
    setClockNow(Date.now());
    setIsLoading(true);
    setError(null);
    setIsComplete(false);
    setSessionId(null);
    setQuestion(null);
    setStats(null);
    setSummary(null);
    setSelectedId("");
    setResult("idle");
    setInlineFeedback(null);
    setIsRoundLocked(false);

    try {
      const response = await fetch("/api/competition/session/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locale: getPreferredLocale() }),
      });

      if (!response.ok) {
        throw new Error("competition_session_start_failed");
      }

      const payload = (await response.json()) as CompetitionStartResponse;
      setSessionId(payload.sessionId);
      setStats(payload.stats);
      beginQuestion(payload.question);
      setClockNow(getNowMs());
    } catch (sessionError) {
      console.error(sessionError);
      setError("Unable to start the competition session.");
    } finally {
      setIsLoading(false);
    }
  }, [beginQuestion, clearAdvanceTimer, getNowMs]);

  useEffect(() => {
    if (isCompletePreview) {
      const totalDurationMs = 120_000;
      setSessionId("competition-preview-complete");
      setQuestion(null);
      setStats({
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
  }, [clearAdvanceTimer, clearFeedbackTimer, isCompletePreview, startSession]);

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

  const remainingMs = useMemo(() => {
    if (!stats) return 0;
    return Math.max(0, new Date(stats.deadlineUtc).getTime() - clockNow);
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
        setStats(payload.stats);
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
  }, [error, isComplete, isLoading, isRoundLocked, remainingMs, sessionId, stats]);

  const handleSelect = useCallback(
    async (optionId: string) => {
      if (!sessionId || !question || isComplete || isLoading || isRoundLocked) {
        return;
      }

      setSelectedId(optionId);
      setError(null);
      clearFeedbackTimer();
      setInlineFeedback(null);
      setIsRoundLocked(true);

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
        setStats(payload.stats);

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
        }, COMPETITION_FEEDBACK_DELAY_MS);
      } catch (submitError) {
        console.error(submitError);
        setError("Unable to submit this answer.");
        setIsRoundLocked(false);
      }
    },
    [
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
        onPlayAgain={() => void startSession()}
      />
    );
  }

  return (
    <main className="game-v1-page game-v2-page">
      <ThemeSwitch />
      <section
        className="game-v1-shell game-v2-shell competition-v1-shell"
        data-state={isComplete ? "complete" : "playing"}
        aria-label="Competition mode"
        aria-busy={isLoading || isRoundLocked}
      >
        {stats && !isComplete ? (
          <div className="game-v1-top competition-v1-top">
            <p
              className={`game-v1-chip competition-v1-chip competition-v1-chip--time${
                remainingMs <= 30_000 ? " competition-v1-chip--urgent" : ""
              }`}
            >
              Time {formatRemaining(remainingMs)}
            </p>
            <p className="game-v1-chip competition-v1-chip competition-v1-chip--score">
              Score {stats.score}
            </p>
            <p className="game-v1-chip competition-v1-chip competition-v1-chip--answered">
              Answered {stats.answeredCount}
            </p>
          </div>
        ) : null}

        <div className="game-v2-word-wrap">
          {isLoading ? (
            <h1 className="game-v2-word competition-v1-word">Loading competition</h1>
          ) : currentQuestion ? (
            <h1
              className="game-v2-word competition-v1-word"
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
            <h1 className="game-v2-word competition-v1-word">Competition unavailable</h1>
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

        <style jsx global>{competitionScreenStyles}</style>
      </section>
    </main>
  );
}
