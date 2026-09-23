"use client";

import { useState } from "react";
import { CREAM } from "@/features/profile/components/board-system";
import Why from "@/features/teacher/components/TeacherWhy";
import type { ClassConfusion } from "@/lib/teacher/mock-teacher";

// CE QUE LE PROFESSEUR DONNE, ET QUI EST COMMUN A TOUTE LA CLASSE.
//
// Spec `product/spec-creation-exercice.md`, sections 10, 12, 13 et 14, plus
// l'invariant I-25. Quatre reglages, et ils forment le CONTRAT : le niveau
// d'exigence, l'adaptation ou non, l'equilibre du mix, et les confusions que le
// professeur retient. Le moteur adapte a l'interieur de ce contrat, jamais au
// dela.
//
// COMPOSANT CONTROLE, ET DANS SON PROPRE FICHIER. Il ne garde aucun etat : le
// compositeur possede le contrat et le transmet a l'assignation. C'est aussi ce
// qui permet de le poser sans reecrire le compositeur, qui est edite en parallele.
//
// AUCUNE DA NOUVELLE. Le controle segmente, la barre segmentee, la legende et les
// pastilles de filtre sont ceux du systeme. **Le curseur renforcement contre
// decouverte est ici un controle a trois positions et non une reglette** : une
// reglette est un controle que le produit n'a nulle part, donc son dessin
// appartient au proprietaire. Trois positions disent la meme chose et n'inventent
// rien.

export type Exigence = "accessible" | "balanced" | "challenging" | "expert";
export type MixBias = "reinforce" | "even" | "discover";

export type ExerciseContract = {
  exigence: Exigence;
  adaptive: boolean;
  mixBias: MixBias;
  /** Les paires retenues, par leur couple de slugs. */
  keptConfusions: string[];
};

export const confusionKey = (pair: ClassConfusion) => `${pair.seen.slug}:${pair.chosen.slug}`;

/**
 * LA COULEUR APPARTIENT AU CRAN D'EXIGENCE, et pas au mode.
 *
 * Arbitrage du proprietaire, 2026-09-11. La premiere version teintait la page
 * avec la couleur du mode, donc du vert presque tout le temps : deux modes sur
 * trois sont de l'entrainement. Or la difficulte est la **seule** chose de cet
 * ecran qui ait quatre crans ORDONNES, et la couleur est le seul dispositif qui
 * montre un ordre d'un coup d'oeil.
 *
 * RELEVE AVANT DE DECIDER, sur les cinq ecrans qui les peignent (landing,
 * choix des modes, profil, tableau d'activite, arene) : ces trois teintes n'ont
 * jamais servi qu'a UNE chose, nommer les trois modes de jeu. Les reprendre ici
 * leur donne donc un second emploi, et c'est assumé pour une raison precise :
 * les trois modes SONT deja une echelle d'exigence, entrainement sans pression,
 * competition sous le chrono, expert en reconnaissance fine. La teinte ne
 * change pas de sens, elle change de support.
 *
 * VARIABLES ET NON HEX. `app/globals.css` dit la regle en toutes lettres a
 * `.game-v2-hud` : le vert « a un nom depuis toujours », `--mode-training`, et
 * le reecrire en dur est ce qu'il a fallu defaire une fois deja.
 *
 * TROIS TEINTES POUR QUATRE CRANS, et c'est le creme qui a saute. La premiere
 * version lui donnait le cran par defaut, ce qui rendait la page entierement
 * incolore a l'arrivee, mesure : zero surface teintee sur cinq etapes tant que
 * le professeur ne touchait a rien. Accessible et Balanced partagent donc le
 * vert, les deux crans ou l'on reste en terrain normal, et la couleur apparait
 * des l'ouverture. Challenging serre, Expert porte deja son bleu.
 */
export const EXIGENCE_ACCENT: Record<Exigence, string> = {
  accessible: "var(--mode-training)", // le vert : on avance sans pression
  balanced: "var(--mode-training)", // le cran par defaut : la page est donc teintee au repos
  challenging: "var(--mode-competition)", // l'orange : ca serre
  expert: "var(--mode-expert)", // le bleu qui porte deja ce nom
};

/** Ce que chaque cran veut dire, en mots de professeur et jamais en parametres. */
const EXIGENCE: ReadonlyArray<{ id: Exigence; label: string; says: string }> = [
  { id: "accessible", label: "Accessible", says: "the wrong answers are plainly different" },
  { id: "balanced", label: "Balanced", says: "same broad family, visible differences" },
  { id: "challenging", label: "Challenging", says: "faces that sit very close together" },
  { id: "expert", label: "Expert", says: "fine recognition, inside a single visual cluster" },
];

// Les quatre parts, hypothese de V1 mesuree et non verite figee (arbitrage 4 du
// 2026-09-10). Chaque jeu somme a cent, et le professeur ne voit jamais un
// coefficient : il deplace un equilibre.
export const MIX_PRESETS: Record<MixBias, { consolidation: number; upkeep: number; targeted: number; novelty: number }> = {
  reinforce: { consolidation: 55, upkeep: 25, targeted: 15, novelty: 5 },
  even: { consolidation: 45, upkeep: 20, targeted: 20, novelty: 15 },
  discover: { consolidation: 30, upkeep: 15, targeted: 20, novelty: 35 },
};

/** Le mix, dit en trois mots pour la ligne repliee. */
const BIAS_SHORT: Record<MixBias, string> = {
  reinforce: "more reinforcing",
  even: "an even mix",
  discover: "more discovery",
};

const BIAS: ReadonlyArray<{ id: MixBias; label: string }> = [
  { id: "reinforce", label: "More reinforcing" },
  { id: "even", label: "Even" },
  { id: "discover", label: "More discovery" },
];

export default function TeacherContract({
  value,
  onChange,
  confusions,
  className,
}: {
  value: ExerciseContract;
  onChange: (next: ExerciseContract) => void;
  /** Ce que cette classe confond réellement, arbitré par le professeur. */
  confusions: ClassConfusion[];
  className: string;
}) {
  const mix = MIX_PRESETS[value.mixBias];
  const chosen = EXIGENCE.find((cran) => cran.id === value.exigence) ?? EXIGENCE[1];

  // REPLIE PAR DEFAUT, ET CE N'EST PAS UN ENCHAINEMENT. Arbitrage du
  // proprietaire, 2026-09-11 : il refuse une question a la fois qui n'ouvre la
  // suivante qu'une fois repondu, « trop limitant », et veut voir l'ensemble
  // avant de valider. Un repli ne cache donc rien derriere une reponse : les
  // quatre reglages ont un bon defaut, la ligne dit LEUR VALEUR COURANTE, et un
  // clic ouvre le tout. On lit son exercice sans le derouler, on l'ouvre si on
  // veut le regler.
  const [open, setOpen] = useState(false);
  const saidInOneLine = [
    chosen.label,
    value.adaptive ? "tuned per student" : "the same for all",
    BIAS_SHORT[value.mixBias],
    value.keptConfusions.length > 0
      ? `${value.keptConfusions.length} confusion${value.keptConfusions.length > 1 ? "s" : ""} targeted`
      : "nothing targeted",
  ].join(" · ");

  const toggleConfusion = (pair: ClassConfusion) => {
    const key = confusionKey(pair);
    onChange({
      ...value,
      keptConfusions: value.keptConfusions.includes(key)
        ? value.keptConfusions.filter((k) => k !== key)
        : [...value.keptConfusions, key],
    });
  };

  return (
    <section className="tc-step st-sec" aria-label="How hard, and for whom">
      <div className="tc-step__head">
        <h2 className="tc-step__title">How they will take it</h2>
        <span className="tc-step__meta">the same for the whole class</span>
      </div>

      {/* TOUTE LA LIGNE EST LA COMMANDE, et le mot est colle au texte.
          Le bouton etait pousse au bord droit du panneau par un
          'justify-content: space-between', soit sept cents pixels plus loin que
          la phrase qu'il ouvre : le proprietaire, qui a construit le jeu, ne
          l'avait pas vu. Un bouton d'ouverture se pose a cote de ce qu'il
          ouvre, et la cible est la ligne entiere plutot qu'une pastille. */}
      <button
        type="button"
        className="tc-ct__line"
        aria-expanded={open}
        aria-controls="tc-contract-settings"
        onClick={() => setOpen((was) => !was)}
      >
        <span className="tc-ct__said">{saidInOneLine}</span>
        <span className="tc-ct__toggle">{open ? "Close" : "Adjust"}</span>
      </button>

      <div id="tc-contract-settings" className="tc-ct__body" hidden={!open}>

      {/* LA MEME GRILLE QUE LE BLOC 1, qui est celui que le proprietaire garde :
          deux reglages par rangee, chacun sur toute sa colonne, et pas une ligne
          de prose permanente. Ce panneau empilait quatre reglages sur une seule
          colonne avec leur explication a cote, et c'est celui dont il a dit
          qu'il ne fonctionnait pas du tout. */}
      <div className="tc-ct__pair">
        <div className="tc-set">
          <span className="st-field__label tc-set__row">
            How hard
            <Why>
              A question gets harder only by how much the wrong answers resemble
              the right one, never by anything else. Here: <em>{chosen.says}</em>.
            </Why>
          </span>
          <div className="st-choice" role="group" aria-label="How hard">
            {EXIGENCE.map((cran) => (
              <button
                key={cran.id}
                type="button"
                className={`st-choice__btn${value.exigence === cran.id ? " is-active" : ""}`}
                aria-pressed={value.exigence === cran.id}
                style={{ "--st-accent": EXIGENCE_ACCENT[cran.id] } as React.CSSProperties}
                onClick={() => onChange({ ...value, exigence: cran.id })}
              >
                {cran.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tc-set">
          <span className="st-field__label tc-set__row">
            For whom
            <Why>
              <em>Tuned per student</em>: same exercise, same scope, same length,
              only how close the wrong answers sit moves, by one step, with what
              each of them already holds. Their results are then not comparable
              to the digit, and the screen says so. <em>The same for all</em> is
              the definition of a measurement.
            </Why>
          </span>
          <div className="st-choice" role="group" aria-label="For whom">
            <button
              type="button"
              className={`st-choice__btn${!value.adaptive ? " is-active" : ""}`}
              aria-pressed={!value.adaptive}
              onClick={() => onChange({ ...value, adaptive: false })}
            >
              The same for all
            </button>
            <button
              type="button"
              className={`st-choice__btn${value.adaptive ? " is-active" : ""}`}
              aria-pressed={value.adaptive}
              onClick={() => onChange({ ...value, adaptive: true })}
            >
              Tuned per student
            </button>
          </div>
        </div>

      </div>

      <div className="tc-set tc-set--wide tc-ct__shelf">
          <span className="st-field__label tc-set__row">
            What it is made of
            <Why>
              A recommended exercise must not be a punishment made of everything
              they get wrong. <em>New</em> means never asked in your exercises,
              not never seen in their life.
            </Why>
          </span>
          <div className="st-choice" role="group" aria-label="What it is made of">
            {BIAS.map((bias) => (
              <button
                key={bias.id}
                type="button"
                className={`st-choice__btn${value.mixBias === bias.id ? " is-active" : ""}`}
                aria-pressed={value.mixBias === bias.id}
                onClick={() => onChange({ ...value, mixBias: bias.id })}
              >
                {bias.label}
              </button>
            ))}
          </div>
          {/* La barre et sa legende sont de la donnee, pas de l'explication :
              elles restent a l'ecran. */}
          <span className="st-seg tc-ct__seg" role="img" aria-label="What the exercise is made of">
            <span className="st-seg__part st-seg__part--lit" style={{ flexGrow: mix.consolidation }} />
            <span className="st-seg__part st-seg__part--emerging" style={{ flexGrow: mix.upkeep }} />
            <span className="st-seg__part st-seg__part--dormant" style={{ flexGrow: mix.targeted }} />
            <span className="st-seg__part st-seg__part--roadmap" style={{ flexGrow: mix.novelty }} />
          </span>
          <ul className="st-legend">
            <li><span className="st-legend__sw st-legend__sw--lit" /><em>{mix.consolidation}%</em> to firm up</li>
            <li><span className="st-legend__sw st-legend__sw--emerging" /><em>{mix.upkeep}%</em> upkeep</li>
            <li><span className="st-legend__sw st-legend__sw--dormant" /><em>{mix.targeted}%</em> targeted</li>
            <li><span className="st-legend__sw st-legend__sw--roadmap" /><em>{mix.novelty}%</em> new</li>
          </ul>
      </div>

      <div className="tc-set tc-set--wide tc-ct__shelf">
          <span className="st-field__label tc-set__row">
            What they confuse
            <Why>
              Untick what you do not want to work on this time. Nothing is
              targeted without you having seen it, and this is the only place
              the screen looks at what the class has already done.
            </Why>
          </span>
          {confusions.length === 0 ? (
            <p className="st-empty tc-ct__none">
              Nothing recurring in {className} yet. It fills up with the
              exercises you give.
            </p>
          ) : (
            <div className="tc-ct__pairs">
              {confusions.map((pair) => {
                const key = confusionKey(pair);
                const kept = value.keptConfusions.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`st-filter__btn${kept ? " is-active" : ""}`}
                    aria-pressed={kept}
                    onClick={() => toggleConfusion(pair)}
                  >
                    {pair.seen.name} for {pair.chosen.name} <em>{pair.times}×</em>
                  </button>
                );
              })}
            </div>
          )}
      </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: CONTRACT_CSS }} />
    </section>
  );
}

/* Rien que les longueurs propres a ce bloc. L'anatomie '.tc-set' et le rythme
   viennent du compositeur, qui est le parent et qui est toujours monte. */
const CONTRACT_CSS = `
  .tc-ct__line {
    appearance: none; width: 100%; cursor: pointer; text-align: left;
    display: flex; align-items: baseline; justify-content: flex-start; gap: 0.5rem 0.75rem; flex-wrap: wrap;
    border: none; background: transparent; padding: 0; font: inherit;
  }
  .tc-ct__said { font-size: 0.92rem; line-height: 1.45; color: var(--pf-cream); }
  .tc-ct__toggle {
    flex: none; border: 1px solid rgb(${CREAM} / 0.3); border-radius: var(--radius-pill);
    padding: 0.22rem 0.7rem;
    font-family: var(--pf-mono); font-size: 0.58rem; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: rgb(${CREAM} / 0.7);
    transition: border-color 140ms ease, color 140ms ease, background-color 140ms ease;
  }
  .tc-ct__line:hover .tc-ct__toggle { border-color: rgb(${CREAM} / 0.6); color: var(--pf-cream); background: rgb(${CREAM} / 0.06); }
  .tc-ct__line:focus-visible { outline: 1px solid rgb(${CREAM} / 0.5); outline-offset: 4px; border-radius: var(--radius); }
  .tc-ct__body { margin-top: 1.5rem; }
  .tc-ct__body[hidden] { display: none; }
  /* Les deux reglages courts partagent une rangee, chaque etagere prend la
     sienne : c'est la seule disposition ou aucune rangee ne penche. */
  .tc-ct__pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(1rem, 2vw, 1.5rem) clamp(0.9rem, 2vw, 1.4rem); align-items: start; }
  @media (max-width: 760px) { .tc-ct__pair { grid-template-columns: 1fr; } }
  .tc-ct__shelf { margin-top: 1.5rem; }
  .tc-ct__seg { margin-top: 0.35rem; width: 100%; }
  .tc-ct__seg + .st-legend { margin-top: 0.1rem; }
  .tc-ct__pairs { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tc-ct__pairs em { font-style: normal; font-variant-numeric: tabular-nums; opacity: 0.55; }
  .tc-ct__none { margin: 0; }
`;
