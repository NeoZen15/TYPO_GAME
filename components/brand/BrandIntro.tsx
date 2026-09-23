"use client";

import { useEffect, useState } from "react";

import styles from "./BrandIntro.module.css";

// Le symbole est dessiné dans un cadre décentré (viewBox "35.7 33.3 770.4
// 584.3"). Pour le faire grandir depuis son milieu il faut d'abord ramener ce
// milieu sur l'origine, sinon il part en biais dès les premières images.
const SYMBOL_CENTER_X = 35.7 + 770.4 / 2;
const SYMBOL_CENTER_Y = 33.3 + 584.3 / 2;

// Le blanc cassé de la marque (--beige-raised). En dur : voir le module CSS.
const SHEET = "#faf9f5";

// Une seconde d'immobilité pour laisser voir la marque, puis 1,9 s d'ouverture.
// La feuille est retirée du document juste après, pour ne pas laisser un calque
// plein écran vivre sur toutes les pages suivantes. Ces deux valeurs suivent le
// délai et la durée déclarés dans le module CSS : les changer là bas sans les
// changer ici laisserait un calque vivant après la fin, ou couperait la fin.
const REMOVE_AFTER_MS = 1000 + 1900 + 100;

// Au delà de cette attente on joue quand même : mieux vaut une intro un peu
// hachée qu'une feuille blanche qui ne part jamais parce que le fil principal
// n'a jamais eu un instant de repos.
const START_TIMEOUT_MS = 1200;

// Lu aussi par le script de tête de app/layout.tsx, sous le même nom.
const SEEN_KEY = "jdt-intro-seen";

function alreadySeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

// Posé au départ de l'animation et non à sa fin : quelqu'un qui quitte la page
// pendant l'ouverture l'a vue, il ne doit pas la revoir.
function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Stockage bloqué : l'intro se rejouera, c'est le seul coût.
  }
}

export default function BrandIntro({ symbol }: { symbol: string }) {
  // Rendue dès le HTML du serveur : décider côté client la ferait arriver APRÈS
  // la première peinture, donc on verrait le site avant l'écran qui le couvre.
  //
  // Elle ne se joue qu'UNE FOIS par visiteur, à sa toute première ouverture du
  // site, quelle que soit la page d'entrée. Décision du propriétaire le
  // 2026-09-23 : la rejouer à chaque retour sur l'accueil était un enfer. Le
  // drapeau vit dans localStorage ; le script de tête de app/layout.tsx le lit
  // avant la première peinture et cache la feuille par CSS.
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);

  // Départ à la première image réellement peinte, et pas au chargement. Deux
  // images d'affilée : la première est demandée avant la peinture, la seconde
  // n'arrive qu'une fois qu'elle a eu lieu. Puis on laisse passer le premier
  // instant de repos du fil principal, faute de quoi l'ouverture se joue pendant
  // l'hydratation et saute.
  useEffect(() => {
    // Déjà vue : on ne démarre rien. La feuille est déjà cachée par la règle
    // CSS data-intro-seen, comme pour le mouvement réduit.
    if (alreadySeen()) return;

    let cancelled = false;
    let idleHandle = 0;

    const start = () => {
      if (cancelled) return;
      markSeen();
      setPlaying(true);
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        if (typeof window.requestIdleCallback === "function") {
          idleHandle = window.requestIdleCallback(start, { timeout: START_TIMEOUT_MS });
          return;
        }
        start();
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      if (idleHandle !== 0 && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setDone(true), REMOVE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [playing]);

  if (done) return null;

  return (
    <div
      className={`${styles.overlay}${playing ? ` ${styles.playing}` : ""}`}
      aria-hidden="true"
    >
      <div className={styles.backdrop} />
      <svg
        className={styles.sheet}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <mask
            id="brand-intro-hole"
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="1000"
            height="1000"
          >
            {/* Dans un masque, blanc veut dire « on garde » et noir « on perce ».
                Ces deux valeurs ne sont pas des couleurs peintes et n'arrivent
                jamais à l'écran. */}
            <rect x="0" y="0" width="1000" height="1000" fill="#fff" />
            <g className={styles.holeShape}>
              <g
                fill="#000"
                transform={`translate(${-SYMBOL_CENTER_X} ${-SYMBOL_CENTER_Y})`}
                dangerouslySetInnerHTML={{ __html: symbol }}
              />
            </g>
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="1000"
          height="1000"
          fill={SHEET}
          mask="url(#brand-intro-hole)"
        />
      </svg>
    </div>
  );
}
