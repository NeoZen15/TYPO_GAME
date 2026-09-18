import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const enProduction = process.env.NODE_ENV === "production";

// LE DOMAINE DE CLERK, DEDUIT ET JAMAIS DEVINE.
//
// La cle publiable porte son propre hote d'API en base64 : `pk_live_<hote$>`.
// C'est la seule facon d'autoriser Clerk dans la politique sans ecrire ici un
// domaine que personne n'a encore cree. Sans cle, la liste est vide et la
// politique ne s'ouvre sur rien. Les deux domaines partages de Clerk restent
// declares a cote, parce qu'ils servent aux environnements de developpement de
// n'importe quel projet Clerk et qu'ils ne dependent pas de la cle.
const hoteClerk = (): string[] => {
  const cle = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!cle) return [];
  try {
    const encode = cle.split("_")[2];
    if (!encode) return [];
    const hote = Buffer.from(encode, "base64").toString("utf-8").replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(hote) ? [`https://${hote}`] : [];
  } catch {
    return [];
  }
};

const CLERK = [...hoteClerk(), "https://*.clerk.accounts.dev", "https://*.clerk.com"];

// LES POLICES ADOBE VIENNENT DE DEUX HOTES, MESURE ET PAS SUPPOSE : la feuille
// du kit est servie par `use.typekit.net`, et les fichiers de police qu'elle
// declare par `p.typekit.net` (relevé sur la feuille ozq5yfs le 2026-09-18).
const TYPEKIT = ["https://use.typekit.net", "https://p.typekit.net"];

// LA POLITIQUE DE CONTENU, ET CE QU'ELLE PROTEGE VRAIMENT.
//
// CE QU'ELLE ARRETE : un script charge depuis un domaine tiers, une page mise
// dans une iframe chez quelqu'un d'autre, un formulaire detourne vers un autre
// serveur, une balise `base` qui redirigerait tous les liens relatifs, un plugin.
//
// CE QU'ELLE N'ARRETE PAS, ET IL FAUT LE DIRE : `script-src` garde
// `'unsafe-inline'`, donc un script INJECTE DANS LA PAGE passerait. La version
// qui l'arreterait demande un `nonce` par requete, donc un `headers()` lu dans
// `app/layout.tsx`, ce qui rendrait DYNAMIQUE la totalite des pages aujourd'hui
// pre-rendues en statique. Le produit n'a aucun endroit ou du texte d'un
// visiteur devient du HTML (verifie le 2026-09-18 : les 55 `dangerouslySetInnerHTML`
// ne portent que des constantes de style et des dessins de marque), donc le
// nonce couterait le rendu statique pour fermer une porte qui n'existe pas
// encore. Le jour ou une surface accepte du HTML de l'exterieur, c'est cette
// ligne qu'il faut reprendre en premier.
const politiqueDeContenu = () => {
  const regles: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...CLERK],
    "style-src": ["'self'", "'unsafe-inline'", ...TYPEKIT],
    "font-src": ["'self'", "data:", ...TYPEKIT],
    "img-src": ["'self'", "data:", "blob:", "https://img.clerk.com"],
    "connect-src": [
      "'self'",
      ...TYPEKIT,
      "https://performance.typekit.net",
      ...CLERK,
      "https://clerk-telemetry.com",
    ],
    "worker-src": ["'self'", "blob:"],
    "frame-src": ["'self'", ...CLERK],
    "manifest-src": ["'self'"],
  };

  if (enProduction) {
    regles["upgrade-insecure-requests"] = [];
  } else {
    // LE LABO A BESOIN DE CE QUE LA PRODUCTION REFUSE, et seulement lui. Turbopack
    // evalue du code pour le rechargement a chaud, il ouvre une websocket, et
    // `components/dev/motion` charge un module depuis esm.sh. Ces trois
    // autorisations n'existent qu'ici, donc elles ne peuvent pas partir en ligne.
    regles["script-src"].push("'unsafe-eval'", "https://esm.sh");
    regles["connect-src"].push("https://esm.sh", "ws:", "wss:");
  }

  return Object.entries(regles)
    .map(([nom, valeurs]) => (valeurs.length > 0 ? `${nom} ${valeurs.join(" ")}` : nom))
    .join("; ");
};

// LES EN-TETES DE SECURITE, ET LA RAISON DE CHACUN.
//
// Aucun n'existait avant l'audit du 2026-09-18. Ils ne changent rien a ce que le
// produit fait, ils changent ce qu'un navigateur accepte de faire avec.
const enTetes = [
  { key: "Content-Security-Policy", value: politiqueDeContenu() },
  // Le site ne se met dans l'iframe de personne. `frame-ancestors` le dit deja
  // aux navigateurs recents, celui ci le dit aux autres.
  { key: "X-Frame-Options", value: "DENY" },
  // Un fichier servi en `text/plain` ne doit pas etre execute comme du script
  // parce que son contenu y ressemble.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // L'adresse complete d'une page de devoir ne part pas chez un tiers : seule
  // l'origine sort, et rien du tout en clair.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Le jeu ne demande ni camera, ni micro, ni position, ni paiement. Le declarer
  // ferme ces portes pour tout ce qui serait charge dans la page.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Une fenetre ouverte depuis le site ne garde pas la main sur celle qui l'a
  // ouverte.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // NOS ressources ne s'embarquent pas depuis un autre site. Signale par le
  // scan nuclei du 2026-09-18 ; sans effet sur le chargement des polices Adobe,
  // qui est NOUS qui allons les chercher, pas l'inverse.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Vieux mecanisme Flash / PDF de politique inter-domaines. On dit « aucune »,
  // ce qui ne coute rien et ferme une porte que plus personne n'ouvre.
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // PAS de Cross-Origin-Embedder-Policy, et c'est un choix mesure le 2026-09-18.
  // `require-corp` exigerait que CHAQUE ressource tierce, dont la feuille et les
  // fichiers Adobe, renvoie un en-tete CORP ; si Adobe ne le fait pas, les
  // polices cassent. Le seul gain de COEP est l'isolation cross-origin
  // (SharedArrayBuffer), dont le produit ne se sert pas. Le risque depasse le gain.
];

// HSTS SEULEMENT EN PRODUCTION, ET SANS `preload`. Deux ans de HTTPS obligatoire
// sur le domaine et ses sous domaines, ce que Vercel sert de toute facon.
// `preload` est volontairement absent : il inscrit le domaine dans une liste
// embarquee dans les navigateurs, et en sortir prend des mois. C'est une decision
// du proprietaire, pas un reglage d'audit.
if (enProduction) {
  enTetes.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  });
}

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },

  // ON N'ANNONCE PAS LA TECHNO. `X-Powered-By: Next.js` ne sert qu'a dire a un
  // attaquant quels avis de securite essayer en premier. Retire le 2026-09-18,
  // deuxieme passe de l'auto-pentest.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:chemin*", headers: enTetes }];
  },

  // LES ADRESSES QU'ON A DEPLACEES GARDENT UNE PORTE.
  //
  // `/admin/access` etait l'adresse des demandes d'acces avant que
  // l'administration prenne sa carte a dix-sept entrees, le 2026-09-11. Elle
  // renvoyait 404 depuis. Une adresse qui a existe et qui a ete partagee, mise en
  // favori ou collee dans une note ne doit pas disparaitre en silence : le
  // deplacement est definitif, donc la redirection l'est aussi.
  async redirects() {
    return [{ source: "/admin/access", destination: "/admin/demandes", permanent: true }];
  },
};

export default nextConfig;
