import type { Metadata } from "next";

import AdminBars from "@/features/admin/components/AdminBars";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import {
  clusterDifficulty,
  confusionDistance,
  familyDifficulty,
  SEUIL_PAIRE,
  SEUIL_POLICE,
  topConfusions,
} from "@/lib/admin/usage";

export const metadata: Metadata = { title: "Confusions" };

// QUELLES PAIRES REVIENNENT, ET A QUELLE DISTANCE.
//
// LA MATIERE LA PLUS UTILE DU JOURNAL, et elle n'a jamais demande de colonne
// supplementaire : la reponse choisie est enregistree a cote de la reponse
// attendue depuis le premier jour.
//
// CE QUE LE JOURNAL NE SAIT PAS, ET LA PAGE LE DIT PLUTOT QUE DE FAIRE SEMBLANT.
// Les quatre propositions d'une question ne sont pas enregistrees : seule celle
// qui a ete choisie l'est. On lit donc les leurres qui ont ETE PRIS, jamais ceux
// qui ont ete offerts et refuses. « Ce leurre provoque des confusions » est donc
// aujourd'hui une phrase a moitie mesuree, et la moitie qui manque est le
// denominateur.

const LIBELLE_RELATION: Record<string, string> = {
  cluster: "Même groupe visuel",
  sub: "Même sous-catégorie",
  primary: "Même grande catégorie",
  far: "Rien de commun",
};

const ORDRE_RELATION = ["cluster", "sub", "primary", "far"];

export default async function AdminConfusionsPage() {
  const [pairs, distance, families, clusters] = await Promise.all([
    topConfusions(20),
    confusionDistance(),
    familyDifficulty(),
    clusterDifficulty(),
  ]);

  const erreurs = distance.reduce((sum, row) => sum + row.times, 0);
  const rangees = ORDRE_RELATION.map((relation) => ({
    relation,
    times: distance.find((row) => row.relation === relation)?.times ?? 0,
  }));

  return (
    <>
      <AdminPageHead href="/admin/confusions" />

      {/* ── Le diagnostic de l'échelle des leurres ── */}
      <section className="st-panel" aria-label="Distance des erreurs">
        <div className="st-panel__head">
          <h2 className="st-panel__title">À quelle distance ils se trompent</h2>
          <span className="st-panel__meta">{erreurs} erreurs au premier essai</span>
        </div>
        {erreurs === 0 ? (
          <p className="st-empty">Aucune erreur au premier essai enregistrée.</p>
        ) : (
          <AdminBars
            rows={rangees.map((row) => ({
              key: row.relation,
              label: LIBELLE_RELATION[row.relation] ?? row.relation,
              value: `${row.times} · ${Math.round((100 * row.times) / erreurs)} %`,
              pct: (100 * row.times) / erreurs,
            }))}
          />
        )}
        <p className="ad-note">
          L&apos;échelle des leurres est censée rapprocher les mauvaises réponses de
          la bonne à mesure que la maîtrise monte. Si l&apos;essentiel des erreurs
          tombe dans « rien de commun », ce n&apos;est pas le regard qui échoue,
          c&apos;est l&apos;échelle qui ne propose pas ce qu&apos;elle croit
          proposer. Le journal enregistre la réponse choisie mais pas les trois
          autres propositions : on voit donc quels leurres ont été pris, jamais
          combien de fois ils ont été offerts et refusés.
        </p>
      </section>

      <section className="st-panel" aria-label="Paires">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Ce qu&apos;ils confondent</h2>
          <span className="st-panel__meta">premiers essais, à partir de {SEUIL_PAIRE} fois</span>
        </div>
        {pairs.length === 0 ? (
          <p className="st-empty">
            Aucune paire n&apos;est encore revenue {SEUIL_PAIRE} fois. Il n&apos;y a
            rien à ajouter au journal, seulement à attendre.
          </p>
        ) : (
          <ul className="ad-rows">
            {pairs.map((pair) => (
              <li key={`${pair.seen_name}-${pair.chosen_name}`}>
                <span className="ad-rows__name">
                  <em>{pair.seen_name}</em> lu comme <em>{pair.chosen_name}</em>
                </span>
                <span className="ad-rows__value">{pair.times} fois</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="st-panel" aria-label="Familles">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Les familles qui résistent</h2>
          <span className="st-panel__meta">à partir de {SEUIL_POLICE} essais</span>
        </div>
        {families.length === 0 ? (
          <p className="st-empty">Aucune famille n&apos;atteint encore {SEUIL_POLICE} essais.</p>
        ) : (
          <AdminBars
            rows={families.map((family) => ({
              key: family.sub_category,
              label: family.sub_category,
              value: `${family.right_pct} % · ${family.first_tries} essais`,
              pct: family.right_pct,
            }))}
          />
        )}
      </section>

      <section className="st-panel" aria-label="Groupes visuels">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Les groupes visuels qui résistent</h2>
          <span className="st-panel__meta">la notion du moteur, pas celle du catalogue</span>
        </div>
        {clusters.length === 0 ? (
          <p className="st-empty">
            Aucun groupe visuel n&apos;atteint encore {SEUIL_POLICE} essais.
          </p>
        ) : (
          <ul className="ad-rows">
            {clusters.map((cluster) => (
              <li key={cluster.visual_cluster_id}>
                <span className="ad-rows__name">
                  <em>{cluster.visual_cluster_id}</em>
                  <b>
                    {cluster.members} polices jouables · par exemple {cluster.sample}
                  </b>
                </span>
                <span className="ad-rows__value">
                  {cluster.right_pct} % · {cluster.first_tries} essais
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="ad-note">
          Le groupe visuel est ce qui sert au moteur à choisir un leurre proche.
          Mesurer sa difficulté, c&apos;est donc vérifier qu&apos;il regroupe ce que
          le regard confond vraiment, et pas seulement ce que la mesure géométrique
          a rapproché.
        </p>
      </section>
    </>
  );
}
