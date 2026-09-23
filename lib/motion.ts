// UNE SEULE REPONSE A « FAUT-IL REDUIRE LES ANIMATIONS », et c'est ce fichier.
//
// POURQUOI IL EXISTE. Le profil proposait un interrupteur « Reduced motion » qui
// ecrivait `jdt-reduced-motion` dans le navigateur, et les dix ecrans animes du
// site interrogeaient uniquement `matchMedia("(prefers-reduced-motion: reduce)")`,
// c'est a dire le reglage du SYSTEME. Personne ne lisait la cle. L'interrupteur
// etait donc un controle d'accessibilite qui ne faisait rien, ce qui est pire
// qu'un controle absent : quelqu'un qui le pousse croit le probleme regle.
//
// LES DEUX SOURCES S'ADDITIONNENT, ELLES NE SE REMPLACENT PAS. Le reglage du
// systeme est un PLANCHER : qui l'a active a demande moins d'animation partout,
// et aucun reglage de ce site ne doit pouvoir le contredire. L'interrupteur du
// profil ne sait donc qu'ajouter, jamais retirer.
//
// LU SUR L'ELEMENT RACINE ET PAS DANS LE STOCKAGE, parce que le stockage n'est
// pas lisible pendant le rendu serveur et qu'une lecture au montage ferait
// clignoter l'animation avant de la couper. L'attribut est pose avant la
// premiere peinture par le script d'amorcage de `app/layout.tsx`, exactement
// comme le theme.
export const RM_STORAGE_KEY = "jdt-reduced-motion";

export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.reducedMotion === "1") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
};

/** Pose le choix du profil sur la racine, pour que tout le site le voie. */
export const applyReducedMotion = (actif: boolean): void => {
  if (typeof document === "undefined") return;
  if (actif) {
    document.documentElement.dataset.reducedMotion = "1";
  } else {
    delete document.documentElement.dataset.reducedMotion;
  }
};
