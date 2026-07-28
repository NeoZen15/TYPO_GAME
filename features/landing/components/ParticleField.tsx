"use client";

import { useEffect, useRef } from "react";

/**
 * Hero background — a calm monochrome dot field. Each dot twinkles on its
 * OWN pseudo-random phase (so the field never moves "as one block"), and a
 * soft local halo gently follows the pointer. Spirit of the Google
 * Antigravity particle ring, but neutral/restrained per the validated
 * system (no colour). Canvas-based, cross-browser.
 */
export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !parent || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const gap = 30; // px between dots
    const falloff = 150; // px radius of the pointer halo

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let phases = new Float32Array(0); // per-dot twinkle phase (no banding)

    let pointerTX = -9999;
    let pointerTY = -9999;
    let pointerX = -9999;
    let pointerY = -9999;
    let glow = 0; // eased 0..1 presence of the pointer halo
    let pointerIn = false;

    let raf = 0;
    let t = 0;
    let last = 0;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / gap) + 1;
      rows = Math.ceil(height / gap) + 1;

      // Precompute a pseudo-random phase per dot so neighbours twinkle out
      // of sync (avoids visible bands / one big moving block).
      phases = new Float32Array(cols * rows);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const h = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
          phases[i * rows + j] = (h - Math.floor(h)) * Math.PI * 2;
        }
      }
    };

    const baseRgb = () =>
      document.documentElement.dataset.theme === "light" ? "25, 21, 16" : "244, 243, 238";

    const render = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      t += dt;

      // Ease the halo position + presence (smooth, frame-rate independent).
      const ease = 1 - Math.pow(0.0015, dt);
      pointerX += (pointerTX - pointerX) * ease;
      pointerY += (pointerTY - pointerY) * ease;
      glow += ((pointerIn ? 1 : 0) - glow) * (1 - Math.pow(0.02, dt));

      ctx.clearRect(0, 0, width, height);
      const rgb = baseRgb();
      const fadeRadius = Math.hypot(width, height) * 0.6;
      const cx = width / 2;
      const cy = height * 0.42;
      const inv = 1 / (falloff * falloff);

      for (let i = 0; i < cols; i++) {
        const x = i * gap;
        for (let j = 0; j < rows; j++) {
          const y = j * gap;

          // Soft edge fade toward the far corners (from a fixed centre).
          const ed = Math.hypot(x - cx, y - cy);
          let edge = 1 - ed / fadeRadius;
          if (edge <= 0) continue;
          edge = edge * edge * (3 - 2 * edge);

          // Independent gentle twinkle per dot.
          const tw = reduced ? 0.4 : 0.5 + 0.5 * Math.sin(t * 0.8 + phases[i * rows + j]);
          let alpha = (0.04 + tw * 0.08) * edge;
          let r = 0.9 + tw * 0.4;

          // Local pointer halo — soft, additive, no global wave.
          if (glow > 0.001) {
            const dx = x - pointerX;
            const dy = y - pointerY;
            const g = Math.exp(-(dx * dx + dy * dy) * inv) * glow;
            alpha += g * 0.5;
            r += g * 1.1;
          }

          if (alpha <= 0.012) continue;
          ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reduced) raf = requestAnimationFrame(render);
    };

    const onMove = (event: PointerEvent) => {
      // Opt-in quiet zones (e.g. the onboarding content block): suppress the
      // pointer halo so it never glows under the text/cards. The dot-field
      // itself keeps twinkling — only the halo fades out here. No-op on the
      // landing, which has no [data-field-quiet] elements.
      const target = event.target as Element | null;
      if (target && target.closest("[data-field-quiet]")) {
        pointerIn = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      pointerTX = event.clientX - rect.left;
      pointerTY = event.clientY - rect.top;
      if (!pointerIn) {
        // Avoid a halo sweeping in from the corner on first move.
        pointerX = pointerTX;
        pointerY = pointerTY;
        pointerIn = true;
      }
    };

    const onLeave = () => {
      pointerIn = false;
    };

    resize();
    if (reduced) {
      render(0);
    } else {
      raf = requestAnimationFrame(render);
    }
    window.addEventListener("resize", resize);
    parent.addEventListener("pointermove", onMove);
    parent.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      parent.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="lp-particles" aria-hidden="true" />;
}
