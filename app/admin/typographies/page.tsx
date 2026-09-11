import type { Metadata } from "next";

import AdminBars from "@/features/admin/components/AdminBars";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import {
  easiestFaces,
  hardestFaces,
  learningShape,
  SEUIL_POLICE,
  unseenFaces,
} from "@/lib/admin/usage";

export const metadata: Metadata = { title: "Typographies" };

// LA CARTOGRAPHIE DE LA RECONNAISSANCE, ISSUE DE L'USAGE REEL.
//
// L'INTENTION, telle que le proprietaire l'a posee le 2026-09-11 : savoir ce qui
// est reconnu et ce qui resiste, dans le vrai catalogue, avec de vraies personnes.
// C'est le seul endroit du produit ou cette carte peut se dessiner : ni la
// classification editoriale, ni la mesure geometrique ne disent ce qu'un oeil
// humain reconnait.
//
// LES DEUX BOUTS, TOUJOURS. Une carte qui ne montre que ce qui resiste ne dit pas
// ou le regard est deja installe, et c'est la moitie de l'information.
//
// LA COUVERTURE EST AUSSI UN RESULTAT. Une police jamais montree n'est pas une
// police facile : c'est une police absente, et la distinguer d'une police reussie
// est ce qui empeche de croire le catalogue mieux connu qu'il ne l'est.

const LONGUEUR = 15;

export default async function AdminTypographiesPage() {
  const [hard, easy, coverage, shape] = await Promise.all([
    hardestFaces(LONGUEUR),
    easiestFaces(LONGUEUR),
    unseenFaces(),
    learningShape(),
  ]);

  const vues = coverage.playable === 0 ? 0 : (100 * coverage.seen) / coverage.playable;

  // DEUX BOUTS DEMANDENT ASSEZ DE MILIEU. Mesure du 2026-09-11 : seize polices
  // passaient le seuil, et les deux classements de quinze montraient donc les
  // memes polices, une fois a l'endroit et une fois a l'envers. Deux panneaux qui
  // se reflètent ne disent pas deux choses, ils font croire a un classement plus
  // riche qu'il n'est. En dessous du double de la longueur, on n'en montre
  // qu'UN, complet, et on dit pourquoi.
  const assezDeMilieu = shape.faces_above_threshold >= 2 * LONGUEUR;

  return (
    <>
      <AdminPageHead href="/admin/typographies" />

      <section className="st-kpis ad-kpis" aria-label="Couverture">
        <div className="st-kpi">
          <span className="st-kpi__value">{coverage.playable}</span>
          <span className="st-kpi__label">Polices jouables</span>
          <span className="st-kpi__helper">activées dans le catalogue</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{coverage.seen}</span>
          <span className="st-kpi__label">Déjà montrées</span>
          <span className="st-kpi__helper">{Math.round(vues)} % du catalogue</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{coverage.unseen}</span>
          <span className="st-kpi__label">Jamais montrées</span>
          <span className="st-kpi__helper">à personne, pas une seule fois</span>
        </div>
      </section>

      <p className="ad-note">
        Tant que la majorité du catalogue n&apos;a jamais été montrée, les deux
        classements ci-dessous décrivent la partie du catalogue que le moteur
        propose réellement, pas le catalogue entier. C&apos;est une limite de
        couverture, pas une limite de mesure, et elle se comble toute seule à mesure
        que le produit tourne.
      </p>

      {assezDeMilieu ? (
        <>
          <section className="st-panel" aria-label="Ce qui résiste">
            <div className="st-panel__head">
              <h2 className="st-panel__title">Ce qui résiste</h2>
              <span className="st-panel__meta">
                au premier essai, à partir de {SEUIL_POLICE} essais
              </span>
            </div>
            <AdminBars
              rows={hard.map((face) => ({
                key: face.typeface_slug,
                label: face.display_name,
                value: `${face.right_pct} % · ${face.first_tries} essais`,
                pct: face.right_pct,
              }))}
            />
          </section>

          <section className="st-panel" aria-label="Ce qui est acquis">
            <div className="st-panel__head">
              <h2 className="st-panel__title">Ce qui est acquis</h2>
              <span className="st-panel__meta">le même seuil, l&apos;autre bout</span>
            </div>
            <AdminBars
              rows={easy.map((face) => ({
                key: face.typeface_slug,
                label: face.display_name,
                value: `${face.right_pct} % · ${face.first_tries} essais`,
                pct: face.right_pct,
              }))}
            />
            <p className="ad-note">
              Une police reconnue par presque tout le monde n&apos;est pas un succès
              du moteur : c&apos;est une police que les gens connaissaient déjà. Elle
              sert à situer les autres, pas à mesurer l&apos;apprentissage, et le
              temps qu&apos;elle prend à l&apos;écran est du temps pris à une police
              qui apprendrait quelque chose.
            </p>
          </section>
        </>
      ) : (
        <section className="st-panel" aria-label="Du plus résistant au plus acquis">
          <div className="st-panel__head">
            <h2 className="st-panel__title">Du plus résistant au plus acquis</h2>
            <span className="st-panel__meta">
              {shape.faces_above_threshold} polices au dessus de {SEUIL_POLICE} essais
            </span>
          </div>
          {hard.length === 0 ? (
            <p className="st-empty">
              Aucune police n&apos;a encore atteint {SEUIL_POLICE} premiers essais.
              Classer avant ce seuil donnerait du bruit présenté comme un résultat.
            </p>
          ) : (
            <>
              <AdminBars
                rows={hard.map((face) => ({
                  key: face.typeface_slug,
                  label: face.display_name,
                  value: `${face.right_pct} % · ${face.first_tries} essais`,
                  pct: face.right_pct,
                }))}
              />
              <p className="ad-note">
                Une seule liste tant que le catalogue mesuré est petit : avec{" "}
                {shape.faces_above_threshold} polices au dessus du seuil, un classement
                « ce qui résiste » et un classement « ce qui est acquis » montreraient
                les mêmes polices, une fois à l&apos;endroit et une fois à l&apos;envers.
                Les deux bouts se sépareront d&apos;eux-mêmes à {2 * LONGUEUR} polices
                mesurées.
              </p>
            </>
          )}
        </section>
      )}

    </>
  );
}
