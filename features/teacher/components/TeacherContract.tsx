"use client";

import { CREAM } from "@/features/profile/components/board-system";
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
  { id: "accessible", label: "Accessible", says: "les mauvaises réponses sont franchement différentes" },
  { id: "balanced", label: "Balanced", says: "même grande famille, différences visibles" },
  { id: "challenging", label: "Challenging", says: "typographies très proches" },
  { id: "expert", label: "Expert", says: "reconnaissance très fine, à l'intérieur d'un même cluster" },
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
  { id: "reinforce", label: "Plus de renforcement" },
  { id: "even", label: "Équilibré" },
  { id: "discover", label: "Plus de découverte" },
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
        <h2 className="st-panel__title">Comment ils vont le passer</h2>
        <span className="st-panel__meta">commun à toute la classe</span>
      </div>

      {/* ── Le niveau d'exigence ── */}
      <span className="st-field__label tc-ct__sub">Niveau d&apos;exigence</span>
      <div className="st-choice tc-ct__choice" role="group" aria-label="Niveau d'exigence">
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
      <span className="tc-ct__hint">
        {chosen.says}. La difficulté d&apos;une question ne monte que par la
        ressemblance des mauvaises réponses, jamais par autre chose.
      </span>

      {/* ── L'adaptation par élève ── */}
      <span className="st-field__label tc-ct__sub">Pour qui</span>
      <div className="st-choice tc-ct__choice" role="group" aria-label="Adaptation">
        <button
          type="button"
          className={`st-choice__btn${!value.adaptive ? " is-active" : ""}`}
          aria-pressed={!value.adaptive}
          onClick={() => onChange({ ...value, adaptive: false })}
        >
          Le même pour tous
        </button>
        <button
          type="button"
          className={`st-choice__btn${value.adaptive ? " is-active" : ""}`}
          aria-pressed={value.adaptive}
          onClick={() => onChange({ ...value, adaptive: true })}
        >
          Adapté à chaque élève
        </button>
      </div>
      <span className="tc-ct__hint">
        {value.adaptive
          ? "Même exercice, même périmètre, même longueur : seule la proximité des mauvaises réponses bouge d'un cran selon ce que chacun tient déjà. Leurs résultats ne se comparent donc pas au chiffre près, et l'écran le dira."
          : "Tout le monde reçoit exactement la même difficulté, ce qui est la définition d'une mesure."}
      </span>

      {/* ── Le mix ── */}
      <span className="st-field__label tc-ct__sub">L&apos;équilibre de l&apos;exercice</span>
      <div className="st-choice tc-ct__choice" role="group" aria-label="Équilibre">
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
      <span className="st-seg tc-ct__seg" role="img" aria-label="Composition de l'exercice">
        <span className="st-seg__part st-seg__part--lit" style={{ flexGrow: mix.consolidation }} />
        <span className="st-seg__part st-seg__part--emerging" style={{ flexGrow: mix.upkeep }} />
        <span className="st-seg__part st-seg__part--dormant" style={{ flexGrow: mix.targeted }} />
        <span className="st-seg__part st-seg__part--roadmap" style={{ flexGrow: mix.novelty }} />
      </span>
      <ul className="st-legend">
        <li><span className="st-legend__sw st-legend__sw--lit" /><em>{mix.consolidation}%</em> à consolider</li>
        <li><span className="st-legend__sw st-legend__sw--emerging" /><em>{mix.upkeep}%</em> d&apos;entretien</li>
        <li><span className="st-legend__sw st-legend__sw--dormant" /><em>{mix.targeted}%</em> ciblé</li>
        <li><span className="st-legend__sw st-legend__sw--roadmap" /><em>{mix.novelty}%</em> de nouveau</li>
      </ul>
      <span className="tc-ct__hint">
        Un exercice recommandé ne doit pas être une punition faite de tout ce
        qu&apos;ils ratent. Nouveau veut dire jamais demandé dans vos exercices, et
        pas jamais vu de leur vie.
      </span>

      {/* ── Les confusions retenues ── */}
      <span className="st-field__label tc-ct__sub">Ce qu&apos;ils confondent</span>
      {confusions.length === 0 ? (
        <p className="st-empty">
          Rien de récurrent chez {className} pour l&apos;instant. Ça se remplit avec
          les exercices que vous donnez.
        </p>
      ) : (
        <>
          <p className="tc-ct__hint tc-ct__hint--tight">
            Décochez ce que vous ne voulez pas travailler cette fois. Rien
            n&apos;est ciblé sans que vous l&apos;ayez vu.
          </p>
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
                  {pair.seen.name} pour {pair.chosen.name} <em>{pair.times}×</em>
                </button>
              );
            })}
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: CONTRACT_CSS }} />
    </section>
  );
}

/* Rien que les longueurs propres a ce bloc. Tout le reste vient du systeme. */
const CONTRACT_CSS = `
  .tc-ct__sub { display: block; margin-top: 1.4rem; }
  .tc-ct__sub:first-of-type { margin-top: 0; }
  .tc-ct__choice { margin-top: 0.5rem; flex-wrap: wrap; }
  .tc-ct__hint { display: block; margin-top: 0.5rem; max-width: 62ch; text-wrap: pretty; font-size: 0.78rem; line-height: 1.5; color: rgb(${CREAM} / 0.45); }
  .tc-ct__hint--tight { margin-top: 0.15rem; margin-bottom: 0.6rem; }
  .tc-ct__seg { margin-top: 0.9rem; }
  .tc-ct__pairs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.2rem; }
  .tc-ct__pairs em { font-style: normal; font-variant-numeric: tabular-nums; opacity: 0.55; }
`;
