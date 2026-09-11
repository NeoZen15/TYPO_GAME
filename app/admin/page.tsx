import type { Metadata } from "next";
import Link from "next/link";

import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { accessRequestCounts, accessRequests } from "@/lib/admin/access-requests";
import { dataHealth } from "@/lib/admin/quality";
import { actions, investigations, SEUILS_PROVISOIRES } from "@/lib/admin/signals";
import { productHealth, pulse, sessionShapes } from "@/lib/admin/usage";
import { invitationsToRelaunch, worldCounts } from "@/lib/admin/world";
import { isClerkConfigured } from "@/lib/server/clerk-availability";

export const metadata: Metadata = {
  title: "Vue d'ensemble",
};

// LE COCKPIT, ET PAS UNE PAGE D'ANALYSE.
//
// En dix secondes : est ce que le produit vit, est ce qu'il y a quelque chose
// d'anormal, et ou aller regarder. Tout ce qui demande a etre etudie plutot que
// constate appartient a une autre entree de la barre.
//
// TROIS POIDS, ET PAS SIX TUILES EGALES (arbitrage du proprietaire, 2026-09-12).
// Le pouls domine, le volume suit, le monde scolaire tient sur une ligne. Six
// chiffres de meme taille obligent a tout lire pour savoir ou regarder, ce qui
// est l'inverse d'un cockpit.
//
// LE POULS EST UN COUPLE RECENCE + VOLUME RECENT, et c'est un arbitrage. J'avais
// propose « 0 ont repondu cette semaine » et « 16 jours sans reponse » cote a
// cote : deux manifestations du meme signal, donc l'espace le plus precieux de la
// page depense deux fois pour la meme phrase. Le couple retenu tient dans les
// deux etats du produit : « il y a 16 jours / 78 personnes » aujourd'hui, « il y a
// 2 min / 1 482 personnes » le jour ou ca marche.
//
// CHAQUE CHIFFRE PORTE SA FENETRE DANS SON LIBELLE. Un total depuis le premier
// jour et un compte sur trente jours ne se comparent pas, et rien n'empeche de le
// faire de tete si l'ecran ne le dit pas a l'endroit ou l'oeil passe.
//
// LE MOT « ACTIF » N'APPARAIT NULLE PART. On dit ce qui a ete fait : « ont
// repondu », « ont lance une partie ». Le jour ou la couche audience existera,
// « visiteur » s'ajoutera sans rendre aucun mot ambigu, parce qu'aucun n'aura
// servi deux fois.

/** Depuis combien de temps, en un nombre et son unite. */
const depuis = (seconds: number | null): { valeur: string; unite: string } => {
  if (seconds === null) return { valeur: "—", unite: "aucune réponse enregistrée" };
  if (seconds < 90) return { valeur: `${Math.max(0, seconds)}`, unite: "secondes" };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 90) return { valeur: `${minutes}`, unite: minutes > 1 ? "minutes" : "minute" };
  const heures = Math.floor(minutes / 60);
  if (heures < 48) return { valeur: `${heures}`, unite: heures > 1 ? "heures" : "heure" };
  const jours = Math.floor(heures / 24);
  return { valeur: `${jours}`, unite: jours > 1 ? "jours" : "jour" };
};

const jour = (iso: string | null) =>
  iso === null
    ? ""
    : new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default async function AdminOverviewPage() {
  const clerkOn = isClerkConfigured();

  const [counts, pending, vital, health, world, data, shapes, invitations] = await Promise.all([
    accessRequestCounts(),
    accessRequests("pending"),
    pulse(),
    productHealth(),
    worldCounts(),
    dataHealth(),
    sessionShapes(),
    invitationsToRelaunch(),
  ]);

  const seances = shapes.reduce((sum, shape) => sum + shape.n, 0);
  const seancesVides = shapes.reduce((sum, shape) => sum + shape.empty, 0);

  const aFaire = actions({
    demandesEnAttente: counts.pending,
    rapprochementsAConfirmer: pending.filter((r) => r.school_candidates.length > 0).length,
    invitationsARelancer: invitations,
    clerkBranche: clerkOn,
  });

  const aRegarder = investigations({ pulse: vital, data, seances, seancesVides });

  const recence = depuis(vital.seconds_since);

  return (
    <>
      <AdminPageHead href="/admin" />

      {/* ── Rang 0 : ce qu'on FAIT. Jamais une anomalie, seulement des gestes ── */}
      {aFaire.length > 0 && (
        <section className="st-panel" aria-label="Ce qui vous attend">
          <div className="st-panel__head">
            <h2 className="st-panel__title">Ce qui vous attend</h2>
            <span className="st-panel__meta">à faire</span>
          </div>
          <ul className="ad-rows ad-rows--flag">
            {aFaire.map((ligne) => (
              <li key={ligne.key}>
                <span className="ad-rows__name">{ligne.text}</span>
                <Link href={ligne.href} className="ad-rows__value ad-go">y aller</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Rang 1 : le pouls. Récence, puis volume récent ── */}
      <section className="ad-pulse" aria-label="Le pouls du produit">
        <div className="ad-pulse__cell">
          <span className="ad-pulse__head">
            <span className="ad-pulse__value">{recence.valeur}</span>
            <span className="ad-pulse__unit">{recence.unite}</span>
          </span>
          <span className="ad-pulse__label">depuis la dernière réponse</span>
          <span className="ad-pulse__helper">
            {vital.last_answer === null ? "le journal est vide" : `la dernière le ${jour(vital.last_answer)}`}
          </span>
        </div>
        <div className="ad-pulse__cell">
          <span className="ad-pulse__head">
            <span className="ad-pulse__value">{vital.answered_30d}</span>
            <span className="ad-pulse__unit">
              {vital.answered_30d > 1 ? "personnes" : "personne"}
            </span>
          </span>
          <span className="ad-pulse__label">ont répondu · 30 derniers jours</span>
          <span className="ad-pulse__helper">
            {vital.answered_7d} sur 7 jours · {vital.launched_30d} ont lancé une partie
          </span>
        </div>
      </section>

      {/* ── Rang 2 : le volume, chaque chiffre avec sa fenêtre ── */}
      <section className="st-kpis st-kpis--four" aria-label="Le produit">
        <div className="st-kpi">
          <span className="st-kpi__value">{health.accounts}</span>
          <span className="st-kpi__label">Comptes · total</span>
          <span className="st-kpi__helper">{health.accounts_30d} créés sur 30 jours</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{seances}</span>
          <span className="st-kpi__label">Séances · total</span>
          <span className="st-kpi__helper">{health.sessions_completed} terminées depuis le début</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{vital.answers_30d}</span>
          <span className="st-kpi__label">Réponses · 30 jours</span>
          <span className="st-kpi__helper">{vital.answers_7d} sur les 7 derniers jours</span>
        </div>
        <div className="st-kpi">
          <span className="st-kpi__value">{world.assignments}</span>
          <span className="st-kpi__label">Devoirs · total</span>
          <span className="st-kpi__helper">{world.assignments_published} publiés depuis le début</span>
        </div>
      </section>

      {/* ── Rang 3 : le monde scolaire, une ligne tant qu'il est jeune ── */}
      <p className="ad-facts ad-facts--line">
        <span className="ad-facts__title">Le monde scolaire</span>
        <span><em>{world.schools}</em> établissement{world.schools > 1 ? "s" : ""}</span>
        <span><em>{world.classes}</em> classe{world.classes > 1 ? "s" : ""}</span>
        <span><em>{world.teachers}</em> enseignant{world.teachers > 1 ? "s" : ""}</span>
        <span><em>{world.students}</em> élève{world.students > 1 ? "s" : ""} rattaché{world.students > 1 ? "s" : ""}</span>
      </p>

      {/* ── Rang 0 bis : ce qu'on REGARDE. Jamais mélangé avec ce qu'on fait ── */}
      {aRegarder.length > 0 && (
        <section className="st-panel" aria-label="À investiguer">
          <div className="st-panel__head">
            <h2 className="st-panel__title">À investiguer</h2>
            <span className="st-panel__meta">seuils provisoires</span>
          </div>
          <ul className="ad-rows">
            {aRegarder.map((ligne) => (
              <li key={ligne.key}>
                <span className="ad-rows__name">{ligne.text}</span>
                <Link href={ligne.href} className="ad-rows__value ad-go">y aller</Link>
              </li>
            ))}
          </ul>
          <p className="ad-note">
            Ces lignes signalent, elles n&apos;accusent pas : chacune porte son
            ratio, et les seuils qui les déclenchent ({SEUILS_PROVISOIRES.seancesSansQuestion} %
            de séances sans question, {SEUILS_PROVISOIRES.lanceursSansReponse} % de
            personnes qui lancent sans répondre) sont <strong>provisoires</strong>.
            Ils viennent d&apos;un jugement posé sur 99 personnes ayant joué, pas
            d&apos;une norme : ils se règlent en une ligne dans{" "}
            <code>lib/admin/signals.ts</code> et devront être revus quand le produit
            aura de l&apos;usage derrière lui.
          </p>
        </section>
      )}

      <p className="ad-note">
        L&apos;usage dans <Link href="/admin/activite" className="ad-link">Activité</Link>,
        l&apos;apprentissage dans <Link href="/admin/progression" className="ad-link">Progression</Link>,
        la cartographie du catalogue dans <Link href="/admin/typographies" className="ad-link">Typographies</Link>,
        et l&apos;état de la donnée dans <Link href="/admin/donnees" className="ad-link">Données et qualité</Link>.
      </p>
    </>
  );
}
