// UNE LIMITE DE DEBIT, ET CE QU'ELLE VAUT VRAIMENT.
//
// CE QU'ELLE EST : un compteur en memoire, par fenetre fixe, dans le processus
// qui traite la requete. Elle arrete une boucle lancee depuis une machine, ce qui
// est exactement l'abus que le produit pouvait subir avant l'audit du
// 2026-09-18 : aucune route n'avait de limite, `POST /api/training/session/start`
// creait un invite et une trentaine de lignes de pool a chaque appel, et
// `/api/teacher/faces` sert un catalogue de 1 279 faces sans demander qui parle.
// Quelques minutes de boucle suffisaient a gonfler la base et la facture Neon.
//
// CE QU'ELLE N'EST PAS : une protection contre un attaquant distribue. La memoire
// n'est pas partagee entre les instances serverless de Vercel, donc la limite
// reelle est « N par instance » et non « N tout court », et une instance qui
// s'endort oublie ses compteurs. La vraie limite partagee demande un magasin
// externe (Vercel KV, Upstash), c'est a dire une decision d'infrastructure et une
// depense : elle appartient au proprietaire, elle n'est pas inventee ici.
//
// LA CLE EST UNE ADRESSE IP, DONC ELLE SE PARTAGE ET SE FALSIFIE. Une classe
// entiere derriere le meme routeur scolaire compte pour une seule adresse : c'est
// la raison pour laquelle les seuils ci dessous sont larges. Un seuil qui gene un
// joueur reel est un bug, pas une securite.

type Fenetre = { compte: number; expireA: number };

const compteurs = new Map<string, Fenetre>();

// Au dela de ce nombre de cles suivies, on jette les fenetres expirees. Sans ce
// balayage, une memoire qui ne connait que des cles nouvelles grandit sans fin.
const SEUIL_DE_BALAYAGE = 10_000;

const balayer = (maintenant: number) => {
  for (const [cle, fenetre] of compteurs) {
    if (fenetre.expireA <= maintenant) compteurs.delete(cle);
  }
};

export type Verdict = { ok: true } | { ok: false; reessayerDansSecondes: number };

/**
 * Consomme un jeton pour cette cle. Rend `ok: false` quand la fenetre est pleine.
 */
export const consommer = (cle: string, limite: number, fenetreMs: number): Verdict => {
  const maintenant = Date.now();

  if (compteurs.size > SEUIL_DE_BALAYAGE) balayer(maintenant);

  const existante = compteurs.get(cle);
  if (!existante || existante.expireA <= maintenant) {
    compteurs.set(cle, { compte: 1, expireA: maintenant + fenetreMs });
    return { ok: true };
  }

  existante.compte += 1;
  if (existante.compte <= limite) return { ok: true };

  return {
    ok: false,
    reessayerDansSecondes: Math.max(1, Math.ceil((existante.expireA - maintenant) / 1000)),
  };
};

/**
 * LES SEUILS, TOUS ICI, PAR ORDRE DE PRECISION.
 *
 * Le premier prefixe qui correspond gagne, donc les chemins precis sont en tete.
 *
 * CES CHIFFRES SONT CALES SUR UNE CLASSE, PAS SUR UNE PERSONNE, et c'est la
 * seule facon de les lire. La cle est une adresse IP, or un etablissement
 * scolaire sort par une seule adresse : trente eleves qui ouvrent le jeu en
 * meme temps sont trente ouvertures sur la MEME cle, a la meme seconde. Les
 * premiers seuils poses le 2026-09-18 valaient vingt ouvertures par cinq
 * minutes, ce qui aurait ferme le produit a une classe entiere en quelques
 * secondes le jour de la premiere seance. Corrige le jour meme, avant toute
 * mise en ligne.
 *
 * CE QUE CES SEUILS ARRETENT : une boucle lancee depuis une machine, qui fait
 * des milliers d'appels par minute. CE QU'ILS N'ARRETENT PAS : un attaquant
 * distribue, ni meme un script patient qui reste sous la barre. Un seuil qui
 * gene un eleve reel est un bug, donc en cas de doute on ouvre, et la vraie
 * reponse le jour ou elle sera necessaire est une limite par COMPTE, une fois
 * que les comptes existent, plutot qu'une limite plus serree par adresse.
 */
const SEUILS: { prefixe: string; limite: number; fenetreMs: number }[] = [
  // Decider d'une demande d'acces est un geste humain, et il ecrit.
  { prefixe: "/api/admin/", limite: 60, fenetreMs: 60_000 },
  // Ouvrir une partie cree un invite et son pool : c'est la route la plus
  // chere, et c'est aussi ce que fait le CHARGEMENT de la page de jeu. Une
  // classe de trente qui ouvre, revient et rouvre tient largement dessous.
  { prefixe: "/api/training/session/start", limite: 300, fenetreMs: 60_000 },
  { prefixe: "/api/competition/session/start", limite: 300, fenetreMs: 60_000 },
  { prefixe: "/api/assigned/session/start", limite: 300, fenetreMs: 60_000 },
  // Le catalogue du compositeur : lourd a servir, ouvert a tous, mais demande
  // par un professeur seul et non par sa classe.
  { prefixe: "/api/teacher/", limite: 120, fenetreMs: 60_000 },
  // Tout le reste de l'API, c'est a dire le rythme des questions et des
  // reponses : trente eleves a cent appels par minute passent encore.
  { prefixe: "/api/", limite: 3000, fenetreMs: 60_000 },
];

export const seuilPour = (chemin: string) => SEUILS.find((seuil) => chemin.startsWith(seuil.prefixe));

/**
 * QUI APPELLE, AU MIEUX DE CE QUE L'HEBERGEUR DIT.
 *
 * `x-real-ip` d'abord : Vercel le pose lui meme depuis la connexion. `x-forwarded-for`
 * ensuite, premiere entree. Les deux sont des en-tetes, donc falsifiables par un
 * client direct ; derriere Vercel ils sont reecrits, et c'est la seule raison pour
 * laquelle on peut s'en servir. Sans rien, une cle commune, ce qui degrade la
 * limite en limite globale plutot qu'en absence de limite.
 */
export const cleDAppelant = (entetes: Headers): string => {
  const reel = entetes.get("x-real-ip");
  if (reel) return reel.trim();

  const transmis = entetes.get("x-forwarded-for");
  if (transmis) {
    const premier = transmis.split(",")[0]?.trim();
    if (premier) return premier;
  }

  return "sans-adresse";
};
