import type { Metadata } from "next";

import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { coverageEnd, dataHealth, partitions } from "@/lib/admin/quality";

export const metadata: Metadata = { title: "Données et qualité" };

// CE QUI FAIT DOUTER D'UN CHIFFRE.
//
// UNE PAGE D'ANALYSE NE VAUT QUE SI L'ON SAIT QUAND NE PAS LA CROIRE. Chaque
// ligne ici est un controle avec une valeur attendue explicite, et c'est l'ECART
// qui s'affiche. Un controle sans valeur attendue ne controle rien : il decore.
//
// L'ORDRE EST CELUI DE LA GRAVITE. Un ecart entre le compteur d'une seance et le
// journal met en doute tous les taux de la section Pedagogie. Une police jouable
// sans fichier declare ne casse qu'une question.

const ETAT = (ecart: number) => (ecart === 0 ? "au vert" : "à regarder");

export default async function AdminDonneesPage() {
  const [data, parts] = await Promise.all([dataHealth(), partitions()]);
  const fin = coverageEnd(parts);

  const controles = [
    {
      key: "mismatch",
      quoi: "Séances dont le compteur ne correspond pas au journal",
      attendu: "0",
      valeur: data.sessions_mismatch,
      pourquoi:
        "Le compteur et le journal sont écrits par la même instruction atomique : un écart ne veut pas dire approximation, il veut dire qu'une écriture se passe ailleurs qu'on ne croit.",
    },
    {
      key: "orphan",
      quoi: "Réponses sans séance correspondante",
      attendu: "0",
      valeur: data.events_orphan,
      pourquoi: "Une réponse orpheline est comptée dans les taux et dans aucune séance.",
    },
    {
      key: "partition",
      quoi: "Réponses rangées dans la partition par défaut",
      attendu: "0",
      valeur: data.events_default_partition,
      pourquoi:
        "Les partitions sont déclarées à la main, mois par mois. Une ligne ici veut dire que le mois en cours n'a pas été déclaré.",
    },
    {
      key: "stuck",
      quoi: "Séances ouvertes depuis plus de 24 h",
      attendu: "0",
      valeur: data.sessions_stuck,
      pourquoi:
        "Une séance jamais refermée n'a pas de durée et fausse le taux de séances terminées vers le bas.",
    },
    {
      key: "states",
      quoi: "États de répétition espacée pointant une police inconnue",
      attendu: "0",
      valeur: data.states_orphan,
      pourquoi: "Une police retirée du catalogue laisserait derrière elle des états sans objet.",
    },
    {
      key: "asset",
      quoi: "Polices jouables sans fichier déclaré",
      attendu: "0",
      valeur: data.faces_without_asset,
      pourquoi: "Elle peut être tirée par le moteur et s'affichera dans une autre police que la sienne.",
    },
    {
      key: "alone",
      quoi: "Polices jouables seules dans leur groupe visuel",
      attendu: "0",
      valeur: data.faces_alone_in_cluster,
      pourquoi:
        "Le groupe visuel sert à proposer un leurre proche. Une police seule dans le sien n'a aucun voisin à proposer, et sa question sera toujours plus facile qu'elle ne devrait l'être.",
    },
  ];

  const ecarts = controles.filter((controle) => controle.valeur !== 0).length;

  return (
    <>
      <AdminPageHead href="/admin/donnees" />

      <p className="ad-facts">
        <span><em>{ecarts}</em> contrôles en écart sur {controles.length}</span>
        <span><em>{data.faces_playable}</em> polices jouables</span>
        <span><em>{data.guard_rows}</em> clés d&apos;idempotence gardées</span>
        {data.guard_oldest_days !== null && (
          <span><em>{data.guard_oldest_days}</em> jours pour la plus ancienne</span>
        )}
      </p>

      <section className="st-panel" aria-label="Contrôles">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Les contrôles</h2>
          <span className="st-panel__meta">
            {ecarts === 0 ? "tout au vert" : `${ecarts} à regarder`}
          </span>
        </div>
        <ul className="ad-rows">
          {controles.map((controle) => (
            <li key={controle.key}>
              <span className="ad-rows__name">
                <em>{controle.quoi}</em>
                <b>attendu {controle.attendu}</b>
              </span>
              <span className="ad-rows__value">
                {controle.valeur} · {ETAT(controle.valeur)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="st-panel" aria-label="Partitions">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Jusqu&apos;à quand le journal a de la place</h2>
          <span className="st-panel__meta">
            {fin ? `déclaré jusqu'au ${fin}` : "aucune borne déclarée"}
          </span>
        </div>
        <p className="ad-note">
          Le journal est découpé par mois, et chaque mois doit être déclaré à la
          main. Passée la dernière borne, les réponses continuent d&apos;être
          acceptées mais tombent dans la partition par défaut, où plus rien
          n&apos;est rangé. {parts.length} partitions existent aujourd&apos;hui.
        </p>
        <ul className="ad-rows">
          {parts.map((partition) => (
            <li key={partition.name}>
              <span className="ad-rows__name">
                <em>{partition.name}</em>
              </span>
              <span className="ad-rows__value">{partition.bound}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="ad-note">
        Les contrôles portent sur les écarts qui rendent un chiffre faux ailleurs.
        Les mesures d&apos;apprentissage n&apos;ont de valeur que si cette page est
        au vert : c&apos;est l&apos;ordre dans lequel il faut les lire.
      </p>
    </>
  );
}
