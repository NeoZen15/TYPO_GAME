"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Quiet beige starfield (canvas). Inspired by the orbiting-stars CodePen the
// user referenced, but deliberately CALM so it never fights the text: faint
// beige pinpoints that breathe (gentle alpha) and drift just a few pixels — no
// bright glow, NO trails (each frame is cleared), slow. Reads as a still night
// sky that's barely alive, not a busy animation. Sizes to its parent.
// ---------------------------------------------------------------------------

type Star = {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  phase: number;
  drift: number;
  speed: number;
};

export default function StarField({ density = 0.0003 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Cached soft dot (gentle falloff to transparent — no hard edge). Its ink is
    // theme-adaptive: warm-noir on the LIGHT (beige) canvas, beige on the DARK
    // (black) canvas. The sprite is rebuilt whenever the theme flips.
    const SS = 64;
    const sprite = document.createElement("canvas");
    sprite.width = SS;
    sprite.height = SS;
    const sctx = sprite.getContext("2d");
    if (!sctx) return;
    const half = SS / 2;
    const buildSprite = () => {
      // light → warm-noir ink (25,21,16); dark → beige (244,243,238).
      const ink = document.documentElement.dataset.theme === "light" ? "25, 21, 16" : "244, 243, 238";
      sctx.clearRect(0, 0, SS, SS);
      const grad = sctx.createRadialGradient(half, half, 0, half, half, half);
      grad.addColorStop(0.0, `rgba(${ink}, 0.85)`);
      grad.addColorStop(0.35, `rgba(${ink}, 0.18)`);
      grad.addColorStop(1, `rgba(${ink}, 0)`);
      sctx.fillStyle = grad;
      sctx.beginPath();
      sctx.arc(half, half, half, 0, Math.PI * 2);
      sctx.fill();
    };
    buildSprite();

    const rand = (min: number, max: number) => Math.random() * (max - min) + min;

    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let raf = 0;

    const build = () => {
      w = parent.clientWidth;
      h = parent.clientHeight;
      if (w === 0 || h === 0) return;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(140, Math.min(560, Math.round(w * h * density)));
      stars = Array.from({ length: count }, () => ({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(0.7, 2.8), // fine
        baseAlpha: rand(0.16, 0.55), // visible but soft
        phase: rand(0, Math.PI * 2),
        drift: rand(1.2, 3.4), // moves "just a little" — a few px
        speed: rand(0.0005, 0.0016), // slow
      }));
    };

    const paint = (animate: boolean) => {
      ctx.clearRect(0, 0, w, h); // no trails — keeps the text readable
      for (const s of stars) {
        if (animate) s.phase += s.speed;
        const dx = animate ? Math.sin(s.phase) * s.drift : 0;
        const dy = animate ? Math.cos(s.phase * 0.9) * s.drift : 0;
        const a = animate ? s.baseAlpha * (0.55 + 0.45 * Math.sin(s.phase * 1.7)) : s.baseAlpha;
        ctx.globalAlpha = Math.max(0, a);
        const size = s.r * 3.8;
        ctx.drawImage(sprite, s.x + dx - size / 2, s.y + dy - size / 2, size, size);
      }
    };

    const loop = () => {
      paint(true);
      raf = requestAnimationFrame(loop);
    };

    build();
    if (reduce) paint(false);
    else raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => build());
    ro.observe(parent);

    // Rebuild the dot sprite when the theme flips. The animation loop picks the
    // new sprite up on its next frame; when reduced-motion (no loop), repaint now.
    const themeObserver = new MutationObserver(() => {
      buildSprite();
      if (reduce) paint(false);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver.disconnect();
    };
  }, [density]);

  return <canvas ref={ref} className="dw-stars" aria-hidden="true" />;
}
