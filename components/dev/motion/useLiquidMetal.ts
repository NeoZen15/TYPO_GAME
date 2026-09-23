"use client";

import { useEffect, useRef, useState } from "react";

// LA BIBLIOTHÈQUE EST INSTALLÉE, elle n'est plus appelée sur le réseau.
//
// Elle venait de `https://esm.sh/@paper-design/shaders`, chargée à l'exécution
// par un `import()` dynamique, avec ce raisonnement : tant que l'essai n'est pas
// tranché, rien n'entre dans les dépendances. Le raisonnement se tient pour la
// propreté du `package.json`, et il coûte trop cher pour ce qu'il évite :
// qui contrôle ce domaine exécute du code dans la page, et l'audit de conformité
// du 2026-09-18 l'a relevé comme le seul tiers du site à faire tourner du code
// plutôt qu'à servir un fichier. Les routes de développement sont gardées, donc
// rien n'était servi au public, mais le garde était la seule chose qui l'en
// empêchait, et un garde est une décision que quelqu'un peut défaire.
//
// `npm install @paper-design/shaders` règle les deux : la version est figée dans
// le verrou, le code est audité comme le reste, et la page n'appelle plus personne.

type Shaders = {
  ShaderMount: new (
    element: HTMLElement,
    fragment: string,
    uniforms: Record<string, unknown>,
    webGlContextAttributes: undefined,
    speed: number
  ) => { dispose?: () => void };
  liquidMetalFragmentShader: string;
};

export type EtatMetal = "charge" | "pret" | "echec";

// Un seul point de montage pour toutes les versions, sinon chaque essai
// recharge le module et on ne compare plus les mêmes conditions.
export function useLiquidMetal(reglages: Record<string, unknown>, vitesse = 0.6) {
  const hote = useRef<HTMLDivElement>(null);
  const [etat, setEtat] = useState<EtatMetal>("charge");
  // Les réglages sont lus une seule fois, au montage : les relire à chaque
  // rendu démonterait le shader dès qu'un parent se redessine.
  const premiers = useRef(reglages);

  useEffect(() => {
    let vivant = true;
    let monte: { dispose?: () => void } | null = null;

    const poser = async () => {
      try {
        const mod = (await import("@paper-design/shaders")) as unknown as Shaders;
        if (!vivant || hote.current === null) return;
        monte = new mod.ShaderMount(
          hote.current,
          mod.liquidMetalFragmentShader,
          premiers.current,
          undefined,
          vitesse
        );
        setEtat("pret");
      } catch {
        if (vivant) setEtat("echec");
      }
    };

    void poser();

    return () => {
      vivant = false;
      monte?.dispose?.();
    };
  }, [vitesse]);

  return { hote, etat };
}
