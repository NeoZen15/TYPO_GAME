// ---------------------------------------------------------------------------
// Le thème clair est-il proposé au joueur ?
//
// Décision du propriétaire, 2026-08-24 : NON au lancement, peut-être plus tard.
// Le raisonnement, pour que la remise en service ne reparte pas de zéro :
//
//   - Le sombre était déjà le défaut servi (`app/layout.tsx`), donc le clair
//     n'avait de public que les joueurs qui cliquaient.
//   - Le clair a été entièrement recalibré le 2026-08-23, 97 textes illisibles
//     ramenés à 0 sur quatre palettes, et `check:contrast` garde ce travail.
//     Il n'est donc PAS supprimé : il est mis en réserve, et le garde continue
//     de tourner pour qu'il soit encore valide le jour où on le rallume.
//   - Le point ouvert avant de le rallumer : le mot du jeu (`.game-v2-word`)
//     change d'apparence selon le fond, or c'est lui la question posée. Un
//     texte clair sur fond sombre gagne du poids apparent. Tant que l'écran de
//     jeu n'impose pas son propre fond, deux joueurs sur deux thèmes ne
//     comparent pas la même chose.
//
// Remettre `true` suffit à réafficher la bascule partout et à faire honorer de
// nouveau une préférence stockée. Le nom du drapeau est aussi lu par le script
// d'amorçage de `app/layout.tsx`, qui l'interpole dans sa chaîne : ne pas le
// renommer sans regarder là bas.
// ---------------------------------------------------------------------------

export const LIGHT_THEME_ENABLED = false;

// Le thème servi quand le clair n'est pas proposé. C'est aussi le défaut du
// serveur, donc l'amorçage n'a rien à corriger au premier rendu.
export const FORCED_THEME = "dark" as const;
