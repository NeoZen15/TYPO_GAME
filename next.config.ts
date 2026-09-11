import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
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
