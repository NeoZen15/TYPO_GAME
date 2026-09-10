"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CARD_COLORS } from "@/lib/game/card-colors";
import { ensureGameFontFace, whenGameFontReady } from "@/lib/game/fonts/inject-font-face";
import type { GameFontFace } from "@/lib/game/fonts/contracts";

// L'ECRAN OU UN ELEVE JOUE SON DEVOIR.
//
// AUCUNE DIRECTION ARTISTIQUE NOUVELLE, ET C'EST DELIBERE. Cet ecran compose les
// classes deja en service sur le jeu (`game-v2-*`) et n'en declare aucune : le
// devoir doit ressembler au jeu parce que c'est le meme jeu. Ce qu'il ajoute est
// une ligne de contexte dans le bandeau, « quel devoir, combien de questions,
// jusqu'a quand », sur les classes du bandeau existant. Toute retouche visuelle
// appartient au proprietaire.
//
// IL NE PARLE JAMAIS A LA BASE, ni ne decide rien de pedagogique : il appelle
// trois routes et affiche ce qu'elles rendent. La face demandee, les options et
// le mot voyagent dans un jeton signe qu'il renvoie tel quel, donc il ne peut pas
// choisir la question a laquelle il repond.
//
// LE MOT N'EST MONTE QUE QUAND LA FACE EST PRETE. `font-display: block` empeche
// deja le navigateur de dessiner une police de repli, et cette attente est la
// bretelle : un eleve ne doit jamais juger des lettres qui ne sont pas celles de
// la question.
//
// UN SEUL ENVOI EN VOL. Deux clics sur la meme question derivent le meme indice de
// tentative et le second est ecarte comme doublon : la porte de reentrance evite
// a l'eleve un aller retour pour rien.

type Question = {
  token: string;
  questionId: string;
  typefaceSlug: string;
  displayWord: string;
  fontFamily: string;
  fontFace: GameFontFace | null;
  options: { slug: string; label: string }[];
  progress: { resolved: number; questionCount: number | null };
};

type Session = {
  session_id: string;
  kind: "exercise" | "control" | "competition";
  question_count: number | null;
  resolved: number;
};

const REFUSALS: Record<string, string> = {
  not_a_recipient: "Ce devoir n'a pas été donné à votre compte.",
  not_open_yet: "Ce devoir n'est pas encore ouvert. Revenez à sa date d'ouverture.",
  past_due: "L'échéance est passée. Ce que vous avez déjà répondu est enregistré.",
  budget_spent: "Vous avez terminé ce devoir.",
  unknown_assignment: "Ce devoir n'existe pas, ou il n'est plus ouvert.",
  no_identity: "Il faut être connecté pour ouvrir un devoir.",
};

export default function AssignedScreen({ assignmentId }: { assignmentId: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [specimenReady, setSpecimenReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ kind: "correct" | "wrong"; text: string } | null>(null);
  const answerInFlightRef = useRef(false);

  const post = useCallback(async (path: string, body: unknown) => {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: (await response.json().catch(() => ({}))) as Record<string, unknown> };
  }, []);

  const loadQuestion = useCallback(
    async (sessionId: string) => {
      setSpecimenReady(false);
      setSelected(null);
      setWrong([]);
      setFeedback(null);
      const { data } = await post("/api/assigned/question", { sessionId });
      if (data.done) {
        setDone(true);
        setQuestion(null);
        return;
      }
      const next = data.question as Question | undefined;
      if (!next) return;
      setQuestion(next);
      ensureGameFontFace(next.fontFace);
      // La face d'abord, le mot ensuite. Une face Adobe n'a pas de descripteur :
      // sa famille est deja declaree, donc l'attente rend la main aussitot.
      await whenGameFontReady(next.fontFace);
      setSpecimenReady(true);
    },
    [post],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await post("/api/assigned/session/start", { assignmentId });
      if (!alive) return;
      if (typeof data.refused === "string") {
        setRefused(data.refused);
        return;
      }
      if (typeof data.error === "string") {
        setRefused(data.error);
        return;
      }
      const opened = data as unknown as Session;
      setSession(opened);
      await loadQuestion(opened.session_id);
    })();
    return () => {
      alive = false;
    };
  }, [assignmentId, loadQuestion, post]);

  const answer = async (slug: string) => {
    if (answerInFlightRef.current) return;
    if (!question || !session || !specimenReady) return;
    answerInFlightRef.current = true;
    setSelected(slug);
    try {
      const { data } = await post("/api/assigned/answer", {
        questionToken: question.token,
        answerSlug: slug,
        responseTimeMs: 0,
      });
      const correct = data.isCorrect === true;
      setFeedback(
        correct
          ? { kind: "correct", text: "Juste." }
          : { kind: "wrong", text: "Pas celle là, regardez encore." },
      );
      if (!correct) {
        setWrong((prev) => [...prev, slug]);
        setSelected(null);
        return;
      }
      if (data.finished === true) {
        setDone(true);
        setQuestion(null);
        return;
      }
      await loadQuestion(session.session_id);
    } finally {
      answerInFlightRef.current = false;
    }
  };

  if (refused) {
    return (
      <main className="game-v1-page game-v2-page">
        <div className="game-v1-shell game-v2-shell">
          <div className="game-v2-word-wrap">
            <h1 className="game-v2-status game-v2-status--down">{REFUSALS[refused] ?? "Devoir indisponible."}</h1>
          </div>
          <div className="game-v2-actions">
            <Link href="/profile" className="game-link">Retour au profil</Link>
          </div>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="game-v1-page game-v2-page">
        <div className="game-v1-shell game-v2-shell">
          <div className="game-v2-word-wrap">
            <h1 className="game-v2-status">Devoir terminé</h1>
          </div>
          <div className="game-v2-actions">
            <p className="game-v2-feedback" data-state="correct" aria-live="polite">
              Votre professeur voit ce que cet exercice a produit, et rien d&apos;autre.
            </p>
            <Link href="/profile" className="game-link">Retour au profil</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="game-v1-page game-v2-page">
      <div className="game-v1-shell game-v2-shell">
        <div className="game-v2-hud">
          <span className="game-v2-hud__side game-v2-hud__side--start">
            <span className="game-v2-hud__mode">
              {session?.kind === "control" ? "contrôle" : session?.kind === "competition" ? "compétition" : "devoir"}
            </span>
          </span>
          <span className="game-v2-hud__side game-v2-hud__side--end">
            <span className="game-v2-hud__stat">
              {question ? question.progress.resolved + 1 : (session?.resolved ?? 0) + 1}
              {question?.progress.questionCount ? ` / ${question.progress.questionCount}` : ""}
            </span>
          </span>
        </div>

        <div className="game-v2-word-wrap">
          {question && specimenReady ? (
            <h1
              className="game-v2-word"
              style={{
                fontFamily: question.fontFamily,
                fontWeight: question.fontFace?.weight ?? 400,
              }}
            >
              {question.displayWord}
            </h1>
          ) : (
            <h1 className="game-v2-status">Chargement</h1>
          )}
        </div>

        {question && specimenReady ? (
          <>
            <section className="game-v2-options" role="radiogroup" aria-label="Typeface options">
              {question.options.map((option, index) => (
                <button
                  key={`${question.questionId}-${option.slug}`}
                  type="button"
                  className={`game-v2-option${selected === option.slug ? " is-selected" : ""}${wrong.includes(option.slug) ? " is-wrong" : ""}`}
                  style={{ ["--card-color" as string]: CARD_COLORS[index] ?? CARD_COLORS[0] }}
                  role="radio"
                  aria-checked={selected === option.slug}
                  onClick={() => void answer(option.slug)}
                  disabled={wrong.includes(option.slug)}
                >
                  <span className="game-v2-option-label">{option.label}</span>
                </button>
              ))}
            </section>

            <p className="game-v2-feedback" data-state={feedback?.kind ?? "idle"} aria-live="polite">
              {feedback?.text ?? " "}
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}
