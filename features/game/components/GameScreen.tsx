"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import ThemeSwitch from "@/components/ui/ThemeSwitch";
import { TRAINING_CORRECT_DELAY_MS } from "@/lib/game/training/catalog";
import {
  type TrainingAnswerResponse,
  type TrainingQuestion,
  type TrainingStartResponse,
} from "@/lib/game/training/contracts";

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

type ProgressState = {
  resolvedCount: number;
  totalRounds: number;
};

const CARD_COLORS = ["#8EA2FF", "#67D6B6", "#F5BF6A", "#F39AB1"] as const;

const getPreferredLocale = () =>
  typeof document !== "undefined" && document.documentElement.lang.startsWith("en")
    ? "en"
    : "fr";

export default function GameScreen() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<TrainingQuestion | null>(null);
  const [progress, setProgress] = useState<ProgressState>({
    resolvedCount: 0,
    totalRounds: 8,
  });
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [wrongAttemptIds, setWrongAttemptIds] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isRoundLocked, setIsRoundLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inlineFeedback, setInlineFeedback] = useState<InlineFeedback>(null);

  const advanceTimerRef = useRef<number | null>(null);
  const attemptStartedAtRef = useRef<number>(0);
  const pendingAdvanceRef = useRef<(() => void) | null>(null);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    pendingAdvanceRef.current = null;
  }, []);

  const beginQuestion = useCallback((nextQuestion: TrainingQuestion) => {
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

  const startSession = useCallback(async () => {
    clearAdvanceTimer();
    setIsLoading(true);
    setError(null);
    setIsComplete(false);
    setSessionId(null);
    setQuestion(null);
    setSelectedId("");
    setResult("idle");
    setWrongAttemptIds([]);
    setInlineFeedback(null);
    setIsRoundLocked(false);

    try {
      const response = await fetch("/api/training/session/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locale: getPreferredLocale() }),
      });

      if (!response.ok) {
        throw new Error("training_session_start_failed");
      }

      const payload = (await response.json()) as TrainingStartResponse;
      setSessionId(payload.sessionId);
      setProgress(payload.progress);
      beginQuestion(payload.question);
    } catch (sessionError) {
      console.error(sessionError);
      setError("Unable to start the training session.");
    } finally {
      setIsLoading(false);
    }
  }, [beginQuestion, clearAdvanceTimer]);

  useEffect(() => {
    void startSession();

    return () => {
      clearAdvanceTimer();
    };
  }, [clearAdvanceTimer, startSession]);

  useEffect(() => {
    window.render_game_to_text = () =>
      JSON.stringify({
        mode: "training",
        status: isLoading ? "loading" : error ? "error" : isComplete ? "complete" : "playing",
        sessionId,
        progress,
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
  }, [error, flushAdvance, isComplete, isLoading, progress, question, result, selectedId, sessionId, wrongAttemptIds]);

  const handleSelect = useCallback(
    async (optionId: string) => {
      if (!sessionId || !question || isComplete || isLoading || isRoundLocked) {
        return;
      }

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
        setProgress(payload.progress);
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

        if (payload.sessionComplete) {
          queueAdvance(() => {
            setIsComplete(true);
            setQuestion(null);
            setSelectedId("");
            setResult("idle");
            setWrongAttemptIds([]);
            setInlineFeedback(null);
            setIsRoundLocked(false);
          }, TRAINING_CORRECT_DELAY_MS);
          return;
        }

        if (payload.nextQuestion) {
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
      }
    },
    [beginQuestion, isComplete, isLoading, isRoundLocked, question, queueAdvance, sessionId]
  );

  const currentQuestion = question;

  return (
    <main className="game-v1-page game-v2-page">
      <ThemeSwitch />
      <section
        className="game-v1-shell game-v2-shell"
        aria-label="Guess the typeface"
        aria-busy={isLoading || isRoundLocked}
      >
        <div className="game-v2-word-wrap">
          {isLoading ? (
            <h1 className="game-v2-word">Loading session</h1>
          ) : isComplete ? (
            <h1 className="game-v2-word">Session complete</h1>
          ) : currentQuestion ? (
            <h1 className="game-v2-word" style={{ fontFamily: currentQuestion.fontFamily }}>
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
          </>
        ) : null}

        {!error && !isLoading && isComplete ? (
          <>
            <p className="game-v2-complete-copy">New round set, new word, same mission.</p>
            <div className="game-v2-actions">
              <button type="button" className="game-v2-validate" onClick={() => void startSession()}>
                Play again
              </button>
              <Link href="/play" className="game-link">
                Back to modes
              </Link>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
