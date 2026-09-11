"use client";

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
    <section className="st-panel st-sec" aria-label="How hard, and for whom">
      <div className="st-panel__head">
        <h2 className="st-panel__title">How they will take it</h2>
        <span className="st-panel__meta">the same for the whole class</span>
      </div>

      {/* ── How hard ── */}
      <div className="tc-set">
        <div className="tc-set__main">
          <span className="st-field__label">How hard</span>
          <div className="st-choice" role="group" aria-label="How hard">
            {EXIGENCE.map((cran) => (
              <button
                key={cran.id}
                type="button"
                className={`st-choice__btn${value.exigence === cran.id ? " is-active" : ""}`}
                aria-pressed={value.exigence === cran.id}
                onClick={() => onChange({ ...value, exigence: cran.id })}
              >
                {cran.label}
              </button>
            ))}
          </div>
        </div>
        <p className="tc-set__say">
          <em>{chosen.says}</em>. A question gets harder only by how much the
          wrong answers resemble the right one, never by anything else.
        </p>
      </div>

      {/* ── Adaptive, or the same for everyone ── */}
      <div className="tc-set">
        <div className="tc-set__main">
          <span className="st-field__label">For whom</span>
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
        <p className="tc-set__say">
          {value.adaptive
            ? "Same exercise, same scope, same length: only how close the wrong answers sit moves, by one step, with what each of them already holds. Their results are then not comparable to the digit, and the screen says so."
            : "Everyone gets exactly the same difficulty, which is the definition of a measurement."}
        </p>
      </div>

      {/* ── The mix ── */}
      <div className="tc-set">
        <div className="tc-set__main tc-ct__wide">
          <span className="st-field__label">What it is made of</span>
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
        <p className="tc-set__say">
          A recommended exercise must not be a punishment made of everything they
          get wrong. New means never asked in your exercises, not never seen in
          their life.
        </p>
      </div>

      {/* ── The confusions kept ── */}
      <div className="tc-set">
        <div className="tc-set__main tc-ct__wide">
          <span className="st-field__label">What they confuse</span>
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
        <p className="tc-set__say">
          {confusions.length === 0
            ? "This is the one place the screen looks at what the class has already done, and it is a shortcut, never a default."
            : "Untick what you do not want to work on this time. Nothing is targeted without you having seen it."}
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: CONTRACT_CSS }} />
    </section>
  );
}

/* Rien que les longueurs propres a ce bloc. L'anatomie '.tc-set' et le rythme
   viennent du compositeur, qui est le parent et qui est toujours monte. */
const CONTRACT_CSS = `
  /* Le reglage qui porte une barre ou une nappe de pastilles prend toute sa
     colonne, sinon la barre se lit comme une jauge a moitie pleine. */
  .tc-ct__wide { width: 100%; }
  .tc-ct__seg { margin-top: 0.35rem; width: 100%; }
  .tc-ct__wide .st-legend { margin-top: 0.1rem; }
  .tc-ct__pairs { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tc-ct__pairs em { font-style: normal; font-variant-numeric: tabular-nums; opacity: 0.55; }
  .tc-ct__none { margin: 0; }
`;
