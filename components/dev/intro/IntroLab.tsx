"use client";

import { useEffect, useMemo, useState } from "react";

import type { Art } from "@/lib/brand/dwiggins-badge-engine";

import styles from "./IntroLab.module.css";

type IntroKind = "volet" | "contreforme" | "composteur";

// Le cadre commun des intros. Tout est posé dedans en unités de ce cadre, puis
// le SVG recouvre l'écran en "slice", donc la composition tient au format près.
const FRAME_W = 1600;
const FRAME_H = 900;

// Le logo mot occupe 56 % de la largeur, centré. Calculé et pas tâtonné : son
// dessin fait 841.89 x 200.234.
const MARK_W = 841.89;
const MARK_H = 200.234;
const MARK_SCALE = (FRAME_W * 0.56) / MARK_W;
const MARK_X = (FRAME_W - MARK_W * MARK_SCALE) / 2;
const MARK_Y = (FRAME_H - MARK_H * MARK_SCALE) / 2;

// Le symbole est dessiné dans un cadre décentré (viewBox "35.7 33.3 770.4
// 584.3"). Pour le faire grandir depuis son milieu il faut d'abord ramener ce
// milieu sur l'origine, sinon il part en biais dès les premières images.
const SYMBOL_CENTER_X = 35.7 + 770.4 / 2;
const SYMBOL_CENTER_Y = 33.3 + 584.3 / 2;

const SHEET = "#faf9f5";
const LOOP_MS = 3400;

/* 01. La feuille couvre l'écran dès la première image, le logo s'y découvre par
   un balayage, puis la feuille sort par la droite.
   Le blanc des masques n'est pas une couleur peinte : dans un masque, blanc veut
   dire "on garde" et noir "on perce". Rien de tout cela n'arrive à l'écran. */
function Volet({ art }: { art: Art }) {
  return (
    <div className={styles.stage}>
      <svg
        className={`${styles.sheetSvg} ${styles.voletSheet}`}
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <mask
              id="dwiggins-intro-volet"
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={FRAME_W}
              height={FRAME_H}
            >
            <rect x="0" y="0" width={FRAME_W} height={FRAME_H} fill="#fff" />
            <g
              className={styles.voletMark}
              transform={`translate(${MARK_X} ${MARK_Y}) scale(${MARK_SCALE})`}
              fill="#000"
              dangerouslySetInnerHTML={{ __html: art.full }}
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={FRAME_W}
          height={FRAME_H}
          fill={SHEET}
          mask="url(#dwiggins-intro-volet)"
        />
      </svg>
    </div>
  );
}

/* 02. Le symbole est un trou dans la feuille, et il grossit jusqu'à ce que son
   blanc intérieur soit toute la page. La révélation est l'animation elle même. */
function Contreforme({ art }: { art: Art }) {
  return (
    <div className={styles.stage}>
      <svg
        className={styles.sheetSvg}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <mask
              id="dwiggins-intro-hole"
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="1000"
              height="1000"
            >
            <rect x="0" y="0" width="1000" height="1000" fill="#fff" />
            <g className={styles.holeShape}>
              <g
                fill="#000"
                transform={`translate(${-SYMBOL_CENTER_X} ${-SYMBOL_CENTER_Y})`}
                dangerouslySetInnerHTML={{ __html: art.symbol }}
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
          mask="url(#dwiggins-intro-hole)"
        />
      </svg>
    </div>
  );
}

/* 03. Les huit formes du logo sont autant de trous qui montent dans la feuille,
   serrés dans le temps comme des caractères qu'on aligne, puis la feuille part. */
function Composteur({ art }: { art: Art }) {
  // Si la découpe échoue on retombe sur le dessin entier d'un seul bloc, ce qui
  // dégrade l'effet sans casser l'écran.
  const shapes = useMemo(() => art.full.match(/<path[^>]*\/>/g) ?? [art.full], [art.full]);

  return (
    <div className={styles.stage}>
      <svg
        className={`${styles.sheetSvg} ${styles.composteurSheet}`}
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="dwiggins-intro-band">
            <rect
              x={MARK_X}
              y={MARK_Y}
              width={MARK_W * MARK_SCALE}
              height={MARK_H * MARK_SCALE}
            />
          </clipPath>
          <mask
              id="dwiggins-intro-composteur"
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={FRAME_W}
              height={FRAME_H}
            >
            <rect x="0" y="0" width={FRAME_W} height={FRAME_H} fill="#fff" />
            <g clipPath="url(#dwiggins-intro-band)">
              <g
                transform={`translate(${MARK_X} ${MARK_Y}) scale(${MARK_SCALE})`}
                fill="#000"
              >
                {shapes.map((shape, index) => (
                  <g
                    key={index}
                    className={styles.riser}
                    style={{ animationDelay: `${index * 60}ms` }}
                    dangerouslySetInnerHTML={{ __html: shape }}
                  />
                ))}
              </g>
            </g>
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={FRAME_W}
          height={FRAME_H}
          fill={SHEET}
          mask="url(#dwiggins-intro-composteur)"
        />
      </svg>
    </div>
  );
}

function Intro({ kind, art }: { kind: IntroKind; art: Art }) {
  if (kind === "volet") return <Volet art={art} />;
  if (kind === "contreforme") return <Contreforme art={art} />;
  return <Composteur art={art} />;
}

const CARDS: { kind: IntroKind; name: string; note: string }[] = [
  {
    kind: "volet",
    name: "01 / Le volet",
    note: "Une feuille blanche passe sur la page. Le logo est découpé dedans, donc c'est le beige qui le dessine.",
  },
  {
    kind: "contreforme",
    name: "02 / La contreforme",
    note: "Le symbole est un trou dans la feuille. Il grossit jusqu'à ce que son blanc intérieur soit toute la page.",
  },
  {
    kind: "composteur",
    name: "03 / Le composteur",
    note: "Les huit formes du logo montent une par une dans la feuille, comme des caractères qu'on aligne, puis la feuille s'en va.",
  },
];

export default function IntroLab({ art }: { art: Art }) {
  // Les intros se rejouent toutes seules en boucle : jouées une seule fois au
  // montage, elles étaient déjà finies quand on arrivait sur la page.
  const [tick, setTick] = useState(0);
  const [fullscreen, setFullscreen] = useState<IntroKind | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), LOOP_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (fullscreen === null) return;
    const timer = window.setTimeout(() => setFullscreen(null), LOOP_MS);
    return () => window.clearTimeout(timer);
  }, [fullscreen]);

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>Labo, rien n&apos;est posé sur le site</p>
        <h1 className={styles.title}>Trois écrans d&apos;intro</h1>
        <p className={styles.lede}>
          Blanc cassé et beige de marque, rien d&apos;autre. Chacun dure deux secondes et se
          termine en découvrant la page. Ils tournent en boucle, et le plein écran donne la
          vraie échelle.
        </p>
      </header>

      <div className={styles.grid}>
        {CARDS.map((card) => (
          <section key={card.kind} className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <h2 className={styles.cardName}>{card.name}</h2>
                <p className={styles.cardNote}>{card.note}</p>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => setTick((value) => value + 1)}
                >
                  Rejouer
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnStrong}`}
                  onClick={() => setFullscreen(card.kind)}
                >
                  Plein écran
                </button>
              </div>
            </div>

            <div className={styles.viewport}>
              <div className={styles.behind}>
                <p className={styles.behindTitle}>Le site arrive ici</p>
                <p className={styles.behindLine}>ce qu&apos;on découvre à la fin</p>
              </div>
              <Intro key={tick} kind={card.kind} art={art} />
            </div>
          </section>
        ))}
      </div>

      {fullscreen !== null ? (
        <>
          <div className={styles.overlay}>
            <Intro key={`full-${fullscreen}-${tick}`} kind={fullscreen} art={art} />
          </div>
          <p className={styles.overlayHint}>chargement</p>
        </>
      ) : null}
    </main>
  );
}
