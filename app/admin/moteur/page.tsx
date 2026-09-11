import type { Metadata } from "next";
import Link from "next/link";

import AdminBars from "@/features/admin/components/AdminBars";
import AdminGap from "@/features/admin/components/AdminGap";
import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { confusionDistance, engineSignals } from "@/lib/admin/usage";

export const metadata: Metadata = { title: "Moteur" };

// COMMENT LES QUESTIONS SONT COMPOSEES, ET CE QUI CLOCHE.
//
// LA PAGE QUI DIT AUSSI CE QU'ELLE NE PEUT PAS DIRE. Le journal enregistre la
// police montree et la reponse choisie. Il n'enregistre PAS les trois autres
// propositions. On peut donc mesurer quels leurres ont ete pris, jamais combien
// de fois un leurre a ete offert et refuse : le denominateur manque. Toute phrase
// du type « ce leurre provoque 30 % de confusions » est aujourd'hui indemontrable,
// et l'ecrire quand meme serait la premiere donnee inventee de cet espace.
//
// CE QU'ON PEUT MESURER EN ATTENDANT : la distance des erreurs, qui dit deja si
// l'echelle rapproche vraiment les mauvaises reponses de la bonne.

const LIBELLE_RELATION: Record<string, string> = {
  cluster: "Même groupe visuel",
  sub: "Même sous-catégorie",
  primary: "Même grande catégorie",
  far: "Rien de commun",
};

const ORDRE_RELATION = ["cluster", "sub", "primary", "far"];

const taux = (n: number, total: number) => (total === 0 ? "—" : `${((100 * n) / total).toFixed(1)} %`);

// CE QUE `engine_version` CONTIENT VRAIMENT : le nom du composeur ET sa revision,
// dans une seule chaine (« training-provider-v1 »). Deux valeurs distinctes ne
// veulent donc PAS dire deux revisions en vol : l'entrainement et la competition
// signent chacun la sienne, et les voir toutes les deux est l'etat normal. Ce qui
// merite une alerte, c'est deux revisions du MEME composeur, parce que la
// comparaison de deux moyennes cesse alors de porter sur la meme chose.
const composeur = (version: string) => version.replace(/-v\d+$/, "");

export default async function AdminMoteurPage() {
  const [signals, distance] = await Promise.all([engineSignals(), confusionDistance()]);

  const parComposeur = new Map<string, Set<string>>();
  for (const version of signals.versions) {
    const nom = composeur(version.engine_version);
    parComposeur.set(nom, (parComposeur.get(nom) ?? new Set()).add(version.engine_version));
  }
  const revisionsEnVol = [...parComposeur.entries()]
    .filter(([, versions]) => versions.size > 1)
    .map(([nom]) => nom);

  const erreurs = distance.reduce((sum, row) => sum + row.times, 0);
  const rangees = ORDRE_RELATION.map((relation) => ({
    relation,
    times: distance.find((row) => row.relation === relation)?.times ?? 0,
  }));

  return (
    <>
      <AdminPageHead href="/admin/moteur" />

      <section className="st-kpis ad-kpis" aria-label="Signaux du moteur">
        <div className="st-kpi">
          <span className="st-kpi__value">{taux(signals.timeouts, signals.answers)}</span>
          <span className="st-kpi__label">Temps expirés</span>
          <span className="st-kpi__helper">{signals.timeouts} sur {signals.answers} réponses</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{taux(signals.invalid, signals.answers)}</span>
          <span className="st-kpi__label">Réponses invalides</span>
          <span className="st-kpi__helper">question mal formée ou client hors contrat</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{taux(signals.retries, signals.answers)}</span>
          <span className="st-kpi__label">Reprises</span>
          <span className="st-kpi__helper">{signals.retries} deuxièmes chances</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{taux(signals.misread_shown, signals.answers)}</span>
          <span className="st-kpi__label">Misread montré</span>
          <span className="st-kpi__helper">{signals.misread_shown} fois</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{taux(signals.reading_shown, signals.answers)}</span>
          <span className="st-kpi__label">Lecture montrée</span>
          <span className="st-kpi__helper">{signals.reading_shown} fois</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{parComposeur.size}</span>
          <span className="st-kpi__label">Composeurs</span>
          <span className="st-kpi__helper">
            {signals.versions[0]?.engine_version ?? "aucun"} en tête
          </span>
        </div>
      </section>

      <section className="st-panel" aria-label="Qui compose les questions">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Qui compose les questions</h2>
          <span className="st-panel__meta">
            {revisionsEnVol.length === 0
              ? "une seule révision par composeur"
              : `${revisionsEnVol.join(", ")} : plusieurs révisions en vol`}
          </span>
        </div>
        <ul className="ad-rows">
          {signals.versions.map((version) => (
            <li key={version.engine_version}>
              <span className="ad-rows__name">
                <em>{version.engine_version}</em>
              </span>
              <span className="ad-rows__value">{version.n} réponses</span>
            </li>
          ))}
        </ul>
        <p className="ad-note">
          {revisionsEnVol.length === 0
            ? "Chaque composeur signe ses réponses. Voir l'entraînement et la compétition côte à côte est l'état normal : ce sont deux composeurs, pas deux révisions du même."
            : "Deux révisions d'un même composeur expliquent à elles seules une moyenne qui se déplace sans raison : avant de chercher un changement de comportement, vérifier que la comparaison porte bien sur une seule révision."}
        </p>
      </section>

      <section className="st-panel" aria-label="Distance des erreurs">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Est-ce que l&apos;échelle rapproche</h2>
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
          La même mesure se lit dans{" "}
          <Link href="/admin/confusions" className="ad-link">Confusions</Link> du
          point de vue du regard. Ici, elle se lit comme un diagnostic de
          l&apos;échelle des leurres : beaucoup d&apos;erreurs lointaines veulent
          dire que les propositions n&apos;étaient pas assez proches pour que la
          question porte sur la forme des lettres.
        </p>
      </section>

      <AdminGap
        missing="Les quatre propositions d'une question ne sont pas journalisées : seule celle qui a été choisie l'est. On ne peut donc pas dire combien de fois un leurre a été offert, ni lesquels résistent au regard sans jamais être pris."
        fills={[
          "Soit enregistrer les propositions au moment de la composition, ce qui coûte une colonne au journal.",
          "Soit les recalculer à partir de la graine et du numéro de question, ce qui ne coûte aucune colonne mais oblige à garder le composeur reproductible pour toujours.",
          "Le choix n'est pas tranché, et tant qu'il ne l'est pas, cette page mesure les leurres pris et jamais les leurres offerts.",
        ]}
      />
    </>
  );
}
