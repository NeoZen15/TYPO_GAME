"use client";

import { useEffect, useRef, useState } from "react";

import LiquidMetalTest from "./LiquidMetalTest";
import { ContourMetal, PastilleMetal, SymboleMetal } from "./MetalAdapte";
import styles from "./MotionLab.module.css";

type Onde = { id: number; x: number; y: number; taille: number };

// Le clic pose une onde qui part du point touché, puis se retire toute seule.
function PilleOnde({ children }: { children: string }) {
  const [ondes, setOndes] = useState<Onde[]>([]);
  const suivant = useRef(0);

  const poser = (event: React.MouseEvent<HTMLButtonElement>) => {
    const boite = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - boite.left;
    const y = event.clientY - boite.top;
    // Le cercle doit atteindre le coin le plus éloigné, sinon l'onde s'arrête
    // avant le bord et on voit qu'elle est ronde.
    const taille =
      2 * Math.hypot(Math.max(x, boite.width - x), Math.max(y, boite.height - y));
    const id = suivant.current;
    suivant.current += 1;
    setOndes((liste) => [...liste, { id, x, y, taille }]);
    window.setTimeout(() => setOndes((liste) => liste.filter((o) => o.id !== id)), 600);
  };

  return (
    <button type="button" className={styles.pill} onClick={poser}>
      {children}
      {ondes.map((onde) => (
        <span
          key={onde.id}
          className={styles.ripple}
          style={{ left: onde.x, top: onde.y, width: onde.taille, height: onde.taille }}
        />
      ))}
    </button>
  );
}

// Une classe posée le temps d'une animation, puis retirée. Sert aux versions
// qui ne peuvent pas tenir sur `:active` seul, parce qu'elles doivent se jouer
// en entier même si le doigt se relève tout de suite.
function useClasseFugace(duree: number): [boolean, () => void] {
  const [actif, setActif] = useState(false);

  useEffect(() => {
    if (!actif) return;
    const timer = window.setTimeout(() => setActif(false), duree);
    return () => window.clearTimeout(timer);
  }, [actif, duree]);

  return [actif, () => setActif(true)];
}

function PilleRepere({ children }: { children: string }) {
  const [actif, lancer] = useClasseFugace(360);

  return (
    <button
      type="button"
      className={`${styles.pill} ${styles.pressRegister}${actif ? ` ${styles.registering}` : ""}`}
      onClick={lancer}
    >
      <span className={styles.registerLabel}>{children}</span>
    </button>
  );
}

function PilleRouleau({ children }: { children: string }) {
  const [actif, lancer] = useClasseFugace(480);

  return (
    <button
      type="button"
      className={`${styles.pill}${actif ? ` ${styles.rolling}` : ""}`}
      onClick={lancer}
    >
      <span className={styles.rollWindow}>
        <span className={styles.rollStack}>
          <span style={{ display: "block" }}>{children}</span>
          <span style={{ display: "block" }}>{children}</span>
        </span>
      </span>
    </button>
  );
}

// Les quatre boutons qui changent de forme. Le morph tient le temps de son
// aller-retour, sauf celui qui attend, qui ne se rouvre qu'à la fin du travail.
function PilleMorph({
  variante,
  children,
}: {
  variante: "point" | "goutte" | "angle" | "attente";
  children: string;
}) {
  const duree = variante === "attente" ? 2200 : variante === "goutte" ? 540 : 620;
  const [actif, lancer] = useClasseFugace(duree);

  const forme =
    variante === "point"
      ? styles.morphDot
      : variante === "goutte"
        ? styles.morphDrop
        : variante === "angle"
          ? styles.morphCorner
          : styles.morphWait;

  return (
    <button
      type="button"
      className={`${styles.pill} ${styles.morph} ${forme}${actif ? ` ${styles.morphing}` : ""}`}
      onClick={lancer}
      disabled={actif && variante === "attente"}
    >
      <span className={styles.morphLabel}>{children}</span>
      {variante === "attente" && actif ? (
        <span className={styles.waitDots} style={{ display: "flex" }}>
          <span className={styles.dot} style={{ animationDelay: "0ms" }} />
          <span className={styles.dot} style={{ animationDelay: "140ms" }} />
          <span className={styles.dot} style={{ animationDelay: "280ms" }} />
        </span>
      ) : null}
    </button>
  );
}

// Les deux versions bulle. La longueur ne bouge pas : ce qui change est la
// forme des bords, et pour le liquide, deux gouttes recollées par un filtre.
function PilleBulle({
  variante,
  children,
}: {
  variante: "bulle" | "liquide";
  children: string;
}) {
  const [actif, lancer] = useClasseFugace(700);

  if (variante === "bulle") {
    return (
      <button
        type="button"
        className={`${styles.pill} ${styles.bubble} ${styles.bubbleBlob}${actif ? ` ${styles.morphing}` : ""}`}
        onClick={lancer}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.pill} ${styles.bubble} ${styles.liquidBtn}${actif ? ` ${styles.morphing}` : ""}`}
      onClick={lancer}
    >
      <span className={styles.liquidLayer}>
        <span className={styles.liquidBody} />
        <span className={styles.liquidDrop} data-side="left" />
        <span className={styles.liquidDrop} data-side="right" />
      </span>
      <span className={styles.liquidLabel}>{children}</span>
    </button>
  );
}

// Le bouton part en attente pendant deux secondes, comme une vraie requête.
// Retenu par le propriétaire le 2026-09-17 : les trois points, les deux autres
// versions ont été retirées.
function PilleAttente({ children }: { children: string }) {
  const [attend, setAttend] = useState(false);

  useEffect(() => {
    if (!attend) return;
    const timer = window.setTimeout(() => setAttend(false), 2200);
    return () => window.clearTimeout(timer);
  }, [attend]);

  return (
    <button
      type="button"
      className={`${styles.pill}${attend ? ` ${styles.waiting}` : ""}`}
      onClick={() => setAttend(true)}
      disabled={attend}
    >
      <span className={styles.waitLabel}>{children}</span>
      <span className={styles.waitDots}>
        <span className={styles.dot} style={{ animationDelay: "0ms" }} />
        <span className={styles.dot} style={{ animationDelay: "140ms" }} />
        <span className={styles.dot} style={{ animationDelay: "280ms" }} />
      </span>
    </button>
  );
}

const MOTS = ["Baskerville", "Futura", "Garamond", "Helvetica", "Didot"];

// Le mot du jeu qui laisse la place au suivant.
// Retenu par le propriétaire le 2026-09-17 : le fondu.
function MotQuiChange() {
  const [index, setIndex] = useState(0);

  return (
    <>
      <div className={styles.wordStage}>
        <p key={index} className={`${styles.word} ${styles.wordFade}`}>
          {MOTS[index % MOTS.length]}
        </p>
      </div>
      <button
        type="button"
        className={styles.replay}
        onClick={() => setIndex((value) => value + 1)}
      >
        Question suivante
      </button>
    </>
  );
}

const CHOIX = ["Baskerville", "Caslon", "Bodoni"];
const BONNE = 0;

// Le moment de la réponse. On clique sur un choix, les états se posent, et on
// remet à zéro pour rejouer.
// Retenu par le propriétaire le 2026-09-17 : la bascule, en vert.
function Reponse() {
  const [choisi, setChoisi] = useState<number | null>(null);

  const etat = (index: number): string | undefined => {
    if (choisi === null) return undefined;
    if (index === BONNE) return "correct";
    if (index === choisi) return "wrong";
    return undefined;
  };

  return (
    <>
      <div className={styles.options}>
        {CHOIX.map((nom, index) => (
          <button
            key={nom}
            type="button"
            className={`${styles.option} ${styles.flip}`}
            data-state={etat(index)}
            onClick={() => setChoisi(index)}
            disabled={choisi !== null}
          >
            <span className={styles.optionLabel}>{nom}</span>
          </button>
        ))}
      </div>
      <button type="button" className={styles.replay} onClick={() => setChoisi(null)}>
        Remettre à zéro
      </button>
    </>
  );
}

function Cellule({
  nom,
  note,
  children,
}: {
  nom: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.cell}>
      <p className={styles.cellName}>{nom}</p>
      {children}
      <p className={styles.cellNote}>{note}</p>
    </div>
  );
}

export default function MotionLab({ symbol }: { symbol: string }) {
  return (
    <main className={styles.page}>
      {/* Le filtre gooey : un flou, puis un très fort contraste sur la couche
          alpha. Deux formes proches se rejoignent alors comme deux gouttes. Il
          est déclaré une fois pour la page, dans un SVG sans surface. */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs>
          <filter id="motion-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="flou" />
            <feColorMatrix
              in="flou"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11"
            />
          </filter>
        </defs>
      </svg>

      <header className={styles.head}>
        <p className={styles.kicker}>Labo, rien n&apos;est posé sur le site</p>
        <h1 className={styles.title}>Catalogue de mouvements</h1>
        <p className={styles.lede}>
          Les vrais moments du site, chacun en deux ou trois versions. Clique sur tout. Dis-moi
          ce que tu gardes, je le pose partout.
        </p>
      </header>

      <div className={styles.sections}>
        <section>
          <h2 className={styles.sectionTitle}>Le clic sur un bouton</h2>
          <p className={styles.sectionNote}>
            Aujourd&apos;hui il ne se passe rien du tout quand tu cliques, sur aucun bouton du
            site.
          </p>
          <div className={styles.row}>
            <Cellule nom="Enfoncement" note="Le bouton descend de deux pixels. Sobre, presque invisible, on le sent plus qu'on ne le voit.">
              <button type="button" className={`${styles.pill} ${styles.pressSink}`}>
                Lancer une partie
              </button>
            </Cellule>
            <Cellule nom="Rebond" note="Le bouton se comprime puis revient en dépassant un peu. Plus vivant, plus joueur.">
              <button type="button" className={`${styles.pill} ${styles.pressBounce}`}>
                Lancer une partie
              </button>
            </Cellule>
            <Cellule nom="Onde" note="Un cercle part de l'endroit exact où tu as cliqué. On voit où on a touché.">
              <PilleOnde>Lancer une partie</PilleOnde>
            </Cellule>
            <Cellule nom="Le repérage" note="Les deux passages d'encre se décalent un instant puis se recalent, comme une presse mal calée qui se rattrape.">
              <PilleRepere>Lancer une partie</PilleRepere>
            </Cellule>
            <Cellule nom="Le poinçon" note="La pastille s'écrase d'un coup sec et se relève, comme un caractère qu'on frappe dans le métal.">
              <button type="button" className={`${styles.pill} ${styles.pressPunch}`}>
                Lancer une partie
              </button>
            </Cellule>
            <Cellule nom="Le rouleau" note="Le mot sort par le haut et son jumeau entre par le bas. C'est le plus typographique des six.">
              <PilleRouleau>Lancer une partie</PilleRouleau>
            </Cellule>
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Essai : le bouton métal liquide</h2>
          <p className={styles.sectionNote}>
            Ta référence, reprise telle quelle. Ce n&apos;est pas une animation de clic : la
            surface coule en permanence, calculée image par image par la carte graphique. Passe
            la souris sur l&apos;anneau.
          </p>
          <div className={styles.row}>
            <Cellule nom="Le pen, tel quel" note="Couleurs et réglages d'origine, taille divisée par deux pour tenir ici. Ces couleurs ne sont pas celles de ta charte, c'est volontaire le temps de l'essai.">
              <LiquidMetalTest />
            </Cellule>
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Le même, adapté à nous</h2>
          <p className={styles.sectionNote}>
            Même surface, mais l&apos;habillage du pen est jeté : plus d&apos;anneau qui passe
            en couleur, plus de fond gris, plus de reflet blanc. Le métal est ramené au neutre et
            découpé à nos formes.
          </p>
          <div className={styles.row}>
            <Cellule nom="La pastille, pleine" note="La forme de bouton du site, remplie de métal. Le label garde son encre pour rester lisible quoi qu'il se passe derrière.">
              <PastilleMetal>Lancer une partie</PastilleMetal>
            </Cellule>
            <Cellule nom="La pastille, contour seul" note="Le métal ne prend que l'épaisseur du bord. Le bouton reste un bouton, c'est son contour qui coule.">
              <ContourMetal>Lancer une partie</ContourMetal>
            </Cellule>
            <Cellule nom="Le symbole" note="La marque elle même remplie de métal. C'est la forme que tu as retenue pour l'intro, donc les deux gestes se répondraient.">
              <SymboleMetal symbol={symbol} />
            </Cellule>
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Le clic, version morph</h2>
          <p className={styles.sectionNote}>
            Ici c&apos;est la forme du bouton qui change, pas seulement sa position.
          </p>
          <div className={styles.row}>
            <Cellule nom="Le point" note="La pastille se referme sur elle même jusqu'à devenir un rond, puis se rouvre.">
              <PilleMorph variante="point">Lancer une partie</PilleMorph>
            </Cellule>
            <Cellule nom="La goutte" note="Elle s'écrase, se détend, se recale. Le volume se conserve, c'est ce qui donne la sensation de matière.">
              <PilleMorph variante="goutte">Lancer une partie</PilleMorph>
            </Cellule>
            <Cellule nom="L'angle" note="La pastille perd ses arrondis, devient une plaque nette, et les retrouve.">
              <PilleMorph variante="angle">Lancer une partie</PilleMorph>
            </Cellule>
            <Cellule nom="Le point qui attend" note="La même fermeture, mais elle ne se rouvre qu'une fois le travail fini, et tes trois points respirent dedans.">
              <PilleMorph variante="attente">Lancer une partie</PilleMorph>
            </Cellule>
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Le clic, version bulle</h2>
          <p className={styles.sectionNote}>
            La forme reste en longueur, mais elle devient matière. Deux techniques différentes.
          </p>
          <div className={styles.row}>
            <Cellule nom="La bulle" note="Les quatre coins se déforment chacun de leur côté, la pastille respire, puis tout se recale.">
              <PilleBulle variante="bulle">Lancer une partie</PilleBulle>
            </Cellule>
            <Cellule nom="Le liquide" note="Deux gouttes sortent par les extrémités et se font réabsorber. Un filtre les recolle au corps, donc la matière s'étire au lieu de se détacher.">
              <PilleBulle variante="liquide">Lancer une partie</PilleBulle>
            </Cellule>
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Le bouton qui attend</h2>
          <p className={styles.sectionNote}>
            Quand quelque chose se charge après le clic. Chaque bouton ici attend deux secondes.
          </p>
          <div className={styles.row}>
            <Cellule nom="Les points, retenu" note="Trois points qui respirent à la place du mot.">
              <PilleAttente>Valider</PilleAttente>
            </Cellule>
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Le mot qui change</h2>
          <p className={styles.sectionNote}>
            Le passage d&apos;une question à la suivante. Ni l&apos;une ni l&apos;autre ne touche
            à la taille ou au dessin du mot, qui doivent rester ceux de la police.
          </p>
          <div className={styles.row}>
            <Cellule nom="Le fondu, retenu" note="Le mot monte de dix pixels en apparaissant.">
              <MotQuiChange />
            </Cellule>
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Juste ou faux</h2>
          <p className={styles.sectionNote}>
            Clique sur une réponse. La bonne est la première. Le vert et le rouge sont ceux que ta
            charte réserve déjà à la validation.
          </p>
          <div className={styles.row}>
            <Cellule nom="La bascule, retenu" note="Un volet vert traverse la bonne réponse et la retourne. C'est le geste de l'intro, avec la couleur de la validation.">
              <Reponse />
            </Cellule>
          </div>
        </section>
      </div>
    </main>
  );
}
