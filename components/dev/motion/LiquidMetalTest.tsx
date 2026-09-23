"use client";

import { useLiquidMetal } from "./useLiquidMetal";
import styles from "./LiquidMetalTest.module.css";

// Essai de la référence donnée par le propriétaire le 2026-09-17
// (codepen.io/Majoramari/pen/pvbzpoa). Le bouton n'est pas une animation de
// clic : c'est une surface de métal liquide calculée en continu par un shader
// WebGL, plus un anneau qui passe du gris à la couleur au survol.
//
// Les réglages sont ceux du pen, repris tels quels : l'essai ne vaut que s'il
// montre l'effet d'origine et pas une version réaccordée par moi.
const REGLAGES_DU_PEN = {
  u_isImage: false,
  u_colorBack: [0, 0, 0, 0],
  u_repetition: 1.5,
  u_softness: 0.5,
  u_shiftRed: 0.3,
  u_shiftBlue: 0.3,
  u_distortion: 0,
  u_contour: 0,
  u_angle: 100,
  u_scale: 1.5,
  u_shape: 1,
  u_offsetX: 0.1,
  u_offsetY: -0.1,
};

export default function LiquidMetalTest() {
  const { hote, etat } = useLiquidMetal(REGLAGES_DU_PEN);

  return (
    <div className={styles.wrap}>
      <svg className={styles.clipDefs} aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="liquid-metal-canvas-clip" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>
        </defs>
      </svg>

      <div className={styles.metal} ref={hote}>
        <div className={styles.outline}>
          <svg className={styles.icon} viewBox="0 0 1024 1024" aria-hidden="true">
            <path d="M843.968 896a51.072 51.072 0 0 1-51.968-52.032V232H180.032A51.072 51.072 0 0 1 128 180.032c0-29.44 22.528-52.032 52.032-52.032h663.936c29.44 0 52.032 22.528 52.032 52.032v663.936c0 29.44-22.528 52.032-52.032 52.032z" />
            <path d="M180.032 896a49.92 49.92 0 0 1-36.48-15.616c-20.736-20.8-20.736-53.76 0-72.832L807.616 143.616c20.864-20.8 53.76-20.8 72.832 0 20.8 20.8 20.8 53.76 0 72.768L216.384 880.384a47.232 47.232 0 0 1-36.352 15.616z" />
          </svg>
        </div>
      </div>

      {etat === "echec" ? (
        <p className={styles.note}>
          La bibliothèque du pen n&apos;a pas pu être chargée. Elle vient du réseau, donc il
          faut être connecté pour voir l&apos;effet.
        </p>
      ) : null}
    </div>
  );
}
