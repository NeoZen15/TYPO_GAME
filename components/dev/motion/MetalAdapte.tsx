"use client";

import { useLiquidMetal } from "./useLiquidMetal";
import styles from "./MetalAdapte.module.css";

// Deux façons d'adapter le métal liquide à notre site, à partir de la référence
// du propriétaire.
//
// Trois écarts avec le pen, chacun mesuré et pas choisi au hasard.
//
// 1. Les teintes passent à zéro (`u_shiftRed`, `u_shiftBlue`), ce qui retire le
//    bleu acier et rend un métal neutre, seule façon de tenir la bichromie sans
//    toucher au shader.
// 2. Le FOND passe du transparent au beige de marque. Le métal du pen est
//    sombre en son milieu : il ne tenait que grâce à l'anneau clair et au
//    dégradé interne qui l'entouraient, et sans eux, sur notre page noire, il
//    devenait invisible. Avec un fond clair ce sont les veines qui se lisent.
// 3. Le décalage repasse au centre. Le pen décale sa forme de 10 %, ce qui ne
//    se voit pas dans un carré de 385 px mais sort du cadre dans une pastille.
const BEIGE = [0.957, 0.953, 0.933, 1];

const REGLAGES = {
  u_isImage: false,
  u_colorBack: BEIGE,
  u_repetition: 1.5,
  u_softness: 0.5,
  u_shiftRed: 0,
  u_shiftBlue: 0,
  u_distortion: 0,
  u_contour: 0,
  u_angle: 100,
  u_scale: 1.5,
  u_shape: 1,
  u_offsetX: 0,
  u_offsetY: 0,
};

// Le symbole est dessiné dans un cadre de 770,4 x 584,3 qui commence à
// (35,7 ; 33,3). Pour s'en servir comme découpe en pixels il faut le ramener à
// l'origine puis le mettre à l'échelle de la boîte.
const SYMBOLE_X = 35.7;
const SYMBOLE_Y = 33.3;
const SYMBOLE_W = 770.4;
const DECOUPE_LARGEUR = 320;
const ECHELLE = DECOUPE_LARGEUR / SYMBOLE_W;

const TRANSFORM_DECOUPE = `scale(${ECHELLE}) translate(${-SYMBOLE_X} ${-SYMBOLE_Y})`;

// Un <clipPath> n'accepte QUE des formes. Le dessin de marque arrive enveloppé
// dans un groupe, que le navigateur ignore alors sans rien dire : la découpe se
// retrouve vide et efface tout ce qu'elle devait révéler. On aplatit donc, et on
// pose le transform sur chaque tracé.
//
// Les groupes qui portent eux mêmes un transform sont laissés en place : les
// retirer déplacerait le dessin. Le symbole n'en a pas, mais un autre tracé de
// marque pourrait en avoir, et un aplatissement aveugle serait alors faux.
function tracesDecoupe(symbol: string): string {
  const aplati = symbol
    .replace(/<g(?![^>]*\btransform=)[^>]*>/g, "")
    .replace(/<\/g>/g, "");
  return aplati.replace(/<path/g, `<path transform="${TRANSFORM_DECOUPE}"`);
}

export function PastilleMetal({ children }: { children: string }) {
  const { hote, etat } = useLiquidMetal(REGLAGES);

  return (
    <div className={styles.wrap}>
      <div className={styles.pastille}>
        <div className={styles.carre} ref={hote} />
        <span className={styles.label}>{children}</span>
      </div>
      {etat === "echec" ? <p className={styles.note}>Bibliothèque non chargée.</p> : null}
    </div>
  );
}

// Le métal seulement sur le contour, demandé par le propriétaire. Le bouton
// garde son fond, et l'anneau est obtenu en masquant la surface par la
// différence entre la boîte entière et sa zone de contenu : il ne reste que
// l'épaisseur. La surface est posée en absolu, donc elle couvre aussi cette
// épaisseur, qu'un enfant normal laisserait vide.
export function ContourMetal({ children }: { children: string }) {
  const { hote, etat } = useLiquidMetal(REGLAGES);

  return (
    <div className={styles.wrap}>
      <div className={styles.contour}>
        <div className={styles.anneau}>
          <div className={styles.carre} ref={hote} />
        </div>
        <span className={styles.labelContour}>{children}</span>
      </div>
      {etat === "echec" ? <p className={styles.note}>Bibliothèque non chargée.</p> : null}
    </div>
  );
}

export function SymboleMetal({ symbol }: { symbol: string }) {
  const { hote, etat } = useLiquidMetal(REGLAGES);

  return (
    <div className={styles.wrap}>
      <svg className={styles.clipDefs} aria-hidden="true">
        <defs>
          {/* Le transform est posé SUR LES TRACÉS et pas sur un groupe qui les
              contiendrait : un <g> n'est pas un enfant autorisé d'un <clipPath>,
              le navigateur l'ignore sans rien dire, et la découpe se retrouve
              vide, donc elle efface tout. Un <mask> l'accepte, c'est pourquoi
              l'écran d'intro fonctionne avec la même écriture. */}
          <clipPath
            id="metal-symbol-clip"
            clipPathUnits="userSpaceOnUse"
            dangerouslySetInnerHTML={{ __html: tracesDecoupe(symbol) }}
          />
        </defs>
      </svg>
      <div className={styles.symbole}>
        <div className={styles.surface} ref={hote} />
      </div>
      {etat === "echec" ? <p className={styles.note}>Bibliothèque non chargée.</p> : null}
    </div>
  );
}
