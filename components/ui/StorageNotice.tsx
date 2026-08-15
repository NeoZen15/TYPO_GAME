"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { storageNoticeCopy } from "@/content/legal";

// UNE NOTICE, PAS UN MUR DE CONSENTEMENT, et c'est un choix argumenté.
//
// Le seul cookie du site, `jdt_guest_user_id`, est strictement nécessaire : il
// EST l'identité qui retient la progression, sans lui le jeu ne peut pas savoir
// où en est le joueur. La directive ePrivacy demande le consentement pour les
// traceurs qui ne sont pas nécessaires au service, et l'information pour ceux
// qui le sont. Aucune mesure d'audience n'existe ici, `users.consent_analytics`
// vaut false par défaut et rien ne le lit.
//
// Poser un bandeau « accepter / refuser » aujourd'hui serait donc un théâtre :
// il n'y aurait rien à refuser, et refuser casserait le jeu. Le jour où une
// mesure d'audience arrive, c'est CE composant qui devient une vraie demande de
// consentement, avec un choix qui a un effet, et `check:legal-docs` devra gagner
// une règle qui l'exige.
//
// LU COMME UN STORE EXTERNE, pas dans un useState initialisé au montage, sur le
// modèle de ThemeSwitch : le serveur ne peut pas lire le localStorage, donc
// l'instantané serveur dit « déjà écartée » et rien ne s'affiche au premier
// rendu. Sans cela, la notice apparaîtrait une fraction de seconde chez
// quelqu'un qui l'a déjà fermée, et l'hydratation ne correspondrait pas.

const DISMISSED_KEY = "jdt-storage-notice-v1";

const listeners = new Set<() => void>();

const readDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Stockage bloqué : on informe quand même, quitte à réafficher. Une page ne
    // doit jamais casser là-dessus.
    return false;
  }
};

const subscribe = (onStoreChange: () => void) => {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
};

// L'événement `storage` ne se déclenche que dans les AUTRES onglets, donc la
// fermeture prévient elle même les abonnés de cet onglet ci.
const dismiss = () => {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Rien à faire : la notice reviendra, ce qui est le moindre mal.
  }
  listeners.forEach((listener) => listener());
};

export default function StorageNotice() {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);

  if (dismissed) return null;

  return (
    <aside className="storage-notice" role="note" aria-label="Information sur les cookies">
      <p className="storage-notice__text">{storageNoticeCopy.message}</p>
      <div className="storage-notice__actions">
        <Link href="/legal/confidentialite" className="storage-notice__link">
          {storageNoticeCopy.linkLabel}
        </Link>
        <button type="button" className="storage-notice__button" onClick={dismiss}>
          {storageNoticeCopy.dismissLabel}
        </button>
      </div>
    </aside>
  );
}
