import type { Metadata } from "next";

import AdminPageHead from "@/features/admin/components/AdminPageHead";
import { SEUIL_ETATS, SEUIL_PAIRE, SEUIL_POLICE } from "@/lib/admin/usage";
import { isClerkConfigured } from "@/lib/server/clerk-availability";

export const metadata: Metadata = { title: "Paramètres" };

// CE QUE L'OPERATEUR REGLE, ET RIEN D'AUTRE.
//
// AUCUNE VALEUR DE SECRET N'EST LUE NI AFFICHEE ICI, meme tronquee. Cette page
// dit si une cle est POSEE, jamais ce qu'elle contient : `isClerkConfigured()`
// teste une presence et ne renvoie jamais un contenu. Une valeur imprimee dans
// une page survit dans un cache, un journal et une capture d'ecran, bien apres
// l'usage qu'on en fait.
//
// LES SEUILS SONT DES DECISIONS, DONC ILS SE LISENT. Ils vivent dans le code et
// ne se reglent pas depuis cette page : les voir ecrits evite de se demander
// pourquoi un classement est vide.

const ETAT = (pose: boolean) => (pose ? "posée" : "absente");

export default function AdminParametresPage() {
  const clerk = isClerkConfigured();
  const source = process.env.JDT_TEACHER_SOURCE === "live" ? "base réelle" : "données de démonstration";

  return (
    <>
      <AdminPageHead href="/admin/parametres" />

      <section className="st-panel" aria-label="Ce qui est branché">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Ce qui est branché</h2>
          <span className="st-panel__meta">présence, jamais contenu</span>
        </div>
        <ul className="ad-rows">
          <li>
            <span className="ad-rows__name">
              <em>Authentification</em>
              <b>clé publique Clerk</b>
            </span>
            <span className="ad-rows__value">{ETAT(clerk)}</span>
          </li>
          <li>
            <span className="ad-rows__name">
              <em>Espace professeur</em>
              <b>source des quatre écrans</b>
            </span>
            <span className="ad-rows__value">{source}</span>
          </li>
        </ul>
        <p className="ad-note">
          {clerk
            ? "Les demandes d'accès peuvent être acceptées : accepter crée le compte, l'établissement si besoin, l'appartenance et l'invitation."
            : "Tant que la clé n'est pas posée, le bouton Accepter reste désactivé et le dit : mieux vaut ne rien créer que la moitié d'un professeur."}
        </p>
      </section>

      <section className="st-panel" aria-label="Seuils">
        <div className="st-panel__head">
          <h2 className="st-panel__title">Les seuils de lecture</h2>
          <span className="st-panel__meta">écrits dans le code, pas réglables ici</span>
        </div>
        <ul className="ad-rows">
          <li>
            <span className="ad-rows__name">
              <em>{SEUIL_POLICE} essais</em>
              <b>avant de classer une police ou une famille</b>
            </span>
            <span className="ad-rows__value">Typographies, Confusions, Progression</span>
          </li>
          <li>
            <span className="ad-rows__name">
              <em>{SEUIL_PAIRE} fois</em>
              <b>avant de montrer une paire confondue</b>
            </span>
            <span className="ad-rows__value">Confusions</span>
          </li>
          <li>
            <span className="ad-rows__name">
              <em>{SEUIL_ETATS} personnes</em>
              <b>avant de donner une médiane par police</b>
            </span>
            <span className="ad-rows__value">Progression</span>
          </li>
        </ul>
        <p className="ad-note">
          Sous ces seuils, rien n&apos;est classé et la page le dit. Un écran qui
          annonce « pas encore assez de données » vaut mieux qu&apos;un faux
          résultat, et c&apos;est la règle qui tient tout cet espace.
        </p>
      </section>
    </>
  );
}
