import type { Metadata } from "next";

import AdminBars from "@/features/admin/components/AdminBars";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import {
  exposureCurve,
  learningShape,
  masteryDistribution,
  productHealth,
  repetitionsToStabilise,
  SEUIL_ETATS,
  SEUIL_POLICE,
} from "@/lib/admin/usage";

export const metadata: Metadata = { title: "Progression" };

// EST CE QUE LA REPETITION ESPACEE FAIT SON TRAVAIL.
//
// C'EST LA QUESTION LA PLUS IMPORTANTE DE TOUT CET ESPACE. Un produit
// d'entrainement qui occupe les gens sans leur apprendre quoi que ce soit
// produirait exactement les memes chiffres d'usage qu'un produit qui marche :
// meme nombre de seances, meme nombre de reponses, meme duree. La seule chose qui
// les separe est la courbe d'exposition, et elle est ici.
//
// AGREGE, ET JAMAIS INDIVIDUEL. Rien sur cette page ne nomme quelqu'un ni ne
// permet de le retrouver : on regarde le moteur a travers toute la population.
// La lecture d'UN eleve appartient a son professeur, dans son espace.

// Les cinq crans, dits comme le moteur les fabrique et pas comme on aimerait
// qu'ils sonnent. Une bonne reponse monte d'un cran, une mauvaise en fait
// descendre un : le niveau est donc un solde de bonnes reponses, plafonne a 4.
// « Jamais vue » serait faux au cran 0, qui contient aussi bien les polices
// jamais jouees que celles qui viennent de retomber.
const NIVEAUX = [
  "pas encore acquise, ou retombée",
  "réussie une fois",
  "réussie deux fois",
  "réussie trois fois",
  "stabilisée",
];

export default async function AdminProgressionPage() {
  const [shape, levels, curve, repetitions, health] = await Promise.all([
    learningShape(),
    masteryDistribution(),
    exposureCurve(),
    repetitionsToStabilise(),
    productHealth(),
  ]);

  const etats = levels.reduce((sum, level) => sum + level.n, 0);
  const depart = curve[0]?.right_pct ?? null;
  const arrivee = curve.at(-1)?.right_pct ?? null;

  return (
    <>
      <AdminPageHead href="/admin/progression" />

      {/* JUSTES AU PREMIER ESSAI VIT ICI, ET PLUS SUR L'ACCUEIL. Decision du
          proprietaire, 2026-09-12 : le taux est interessant, il n'est pas vital.
          Sa place est a cote des mesures d'apprentissage, ou il se lit contre la
          courbe d'exposition au lieu d'occuper une tuile de cockpit. */}
      <p className="ad-facts">
        <span>
          <em>
            {health.first_try_right_pct === null ? "—" : `${health.first_try_right_pct} %`}
          </em>{" "}
          justes au premier essai, sur {health.first_tries} essais
        </span>
        <span><em>{shape.states}</em> états suivis</span>
        <span><em>{shape.stabilised}</em> stabilisés</span>
        <span><em>{shape.in_pool}</em> dans un pool actif</span>
        <span><em>{shape.relapses}</em> rechutes après stabilisation</span>
        <span><em>{shape.faces_seen}</em> polices vues</span>
      </p>

      {/* ── La courbe qui dit si le produit apprend quelque chose ── */}
      <section className="st-panel" aria-label="Reconnaissance selon l'exposition">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Reconnaître après avoir revu</h2>
          <span className="st-panel__meta">à partir de {SEUIL_POLICE} observations par rang</span>
        </div>
        {curve.length === 0 ? (
          <p className="st-empty">
            Aucun rang d&apos;exposition n&apos;atteint encore {SEUIL_POLICE}{" "}
            observations. Tracer la courbe avant ce seuil dessinerait le hasard.
          </p>
        ) : (
          <>
            <AdminBars
              rows={curve.map((point) => ({
                key: String(point.exposure),
                label:
                  point.exposure === 1
                    ? "1re fois qu'ils la voient"
                    : `${point.exposure}e fois`,
                value: `${point.right_pct} % · ${point.first_tries} essais`,
                pct: point.right_pct,
              }))}
            />
            <p className="ad-note">
              Chaque rang compte les premiers essais d&apos;une même personne sur une
              même police, dans l&apos;ordre où elle l&apos;a rencontrée.
              {depart !== null && arrivee !== null && curve.length > 1
                ? arrivee > depart
                  ? ` De ${depart} % à la première rencontre à ${arrivee} % à la ${curve.at(-1)?.exposure}e : la reconnaissance monte avec l'exposition, ce qui est exactement ce que la répétition espacée doit produire.`
                  : ` De ${depart} % à la première rencontre à ${arrivee} % à la ${curve.at(-1)?.exposure}e : la courbe ne monte pas. Sur ce volume ça peut être du bruit, mais c'est le chiffre à surveiller en premier.`
                : ""}
            </p>
          </>
        )}
      </section>

      {/* ── Où en est la population ── */}
      <section className="st-panel" aria-label="Distribution des niveaux">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Où en sont les polices suivies</h2>
          <span className="st-panel__meta">{etats} états, tous utilisateurs confondus</span>
        </div>
        {etats === 0 ? (
          <p className="st-empty">Aucun état de répétition espacée enregistré.</p>
        ) : (
          <AdminBars
            rows={levels.map((level) => ({
              key: String(level.mastery_level),
              label: `${level.mastery_level} · ${NIVEAUX[level.mastery_level] ?? ""}`,
              value: `${level.n} · ${Math.round((100 * level.n) / etats)} %`,
              pct: (100 * level.n) / etats,
            }))}
          />
        )}
        <p className="ad-note">
          {shape.in_pool === shape.states
            ? "Les états suivis et les états en pool actif sont égaux, et ce n'est pas une erreur : aujourd'hui un état n'existe que pour une police entrée dans un pool. Le premier devoir joué changera ça, en enregistrant la maîtrise de polices choisies par un professeur sans les faire entrer dans le pool. "
            : ""}
          Une pyramide qui s&apos;élargit vers le haut dit que les gens montent.
          Une population entassée au premier niveau dit qu&apos;ils recommencent
          sans jamais consolider, et c&apos;est un réglage d&apos;intervalle, pas un
          problème de regard.
        </p>
      </section>

      {/* ── Le coût réel d'une police ── */}
      <section className="st-panel" aria-label="Répétitions avant stabilisation">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Combien de fois avant que ça tienne</h2>
          <span className="st-panel__meta">
            médiane, à partir de {SEUIL_ETATS} personnes l&apos;ayant stabilisée
          </span>
        </div>
        {repetitions.length === 0 ? (
          <p className="st-empty">
            Aucune police n&apos;a encore été stabilisée par {SEUIL_ETATS} personnes.
            Une médiane sur une ou deux personnes décrirait ces personnes, pas la
            police.
          </p>
        ) : (
          <ul className="ad-rows">
            {repetitions.map((face) => (
              <li key={face.typeface_slug}>
                <span className="ad-rows__name">
                  <em>{face.display_name}</em>
                  <b>{face.people} personnes l&apos;ont stabilisée</b>
                </span>
                <span className="ad-rows__value">{face.median_seen} expositions</span>
              </li>
            ))}
          </ul>
        )}
        <p className="ad-note">
          Cette mesure ne compte que les personnes qui sont allées au bout : mêler
          celles encore en chemin confondrait « difficile » et « pas encore fini ».
          Elle ne se déduit pas du taux de réussite, et c&apos;est ce qui la rend
          utile : une police réussie sept fois sur dix du premier coup et une autre
          réussie sept fois sur dix après douze expositions coûtent très
          différemment au regard.
        </p>
      </section>
    </>
  );
}
