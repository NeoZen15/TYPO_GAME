"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type Specimen = { slug: string; name: string; cat: string };

/**
 * Block 5 typefaces rail. JS-driven so it can BOTH auto-drift AND be scrolled
 * by hand (wheel + drag). The list is duplicated for a seamless infinite loop;
 * scrollLeft wraps at the halfway point. Auto-drift pauses on hover/drag and
 * resumes after a short idle. Each card tilts in 3D toward the pointer.
 * Reduced-motion: no auto-drift (still hand-scrollable), no tilt.
 */
export default function TypefaceRail({ specimens }: { specimens: readonly Specimen[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reducedRef.current = reduced;

    let raf = 0;
    let paused = false;
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startScroll = 0;
    let idleTimer = 0;
    const speed = 0.5; // px / frame

    const half = () => rail.scrollWidth / 2;
    const wrap = () => {
      const h = half();
      if (h <= 0) return;
      if (rail.scrollLeft >= h) rail.scrollLeft -= h;
      else if (rail.scrollLeft <= 0) rail.scrollLeft += h;
    };

    const step = () => {
      if (!paused && !dragging) {
        rail.scrollLeft += speed;
        wrap();
      }
      raf = requestAnimationFrame(step);
    };

    const resumeSoon = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        paused = false;
      }, 1400);
    };

    const onEnter = () => {
      paused = true;
    };
    const onLeave = () => {
      if (!dragging) paused = false;
    };
    const onScroll = () => wrap();

    const onDown = (event: PointerEvent) => {
      dragging = true;
      paused = true;
      moved = false;
      startX = event.clientX;
      startScroll = rail.scrollLeft;
      try {
        rail.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      rail.classList.add("is-dragging");
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      if (Math.abs(dx) > 6) moved = true;
      rail.scrollLeft = startScroll - dx;
    };
    const onUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        rail.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      rail.classList.remove("is-dragging");
      resumeSoon();
    };
    // Suppress the click that follows a real drag so it doesn't navigate.
    const onClick = (event: MouseEvent) => {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
        moved = false;
      }
    };
    // Manual wheel pauses auto-drift briefly.
    const onWheel = () => {
      paused = true;
      resumeSoon();
    };

    rail.addEventListener("pointerenter", onEnter);
    rail.addEventListener("pointerleave", onLeave);
    rail.addEventListener("scroll", onScroll, { passive: true });
    rail.addEventListener("pointerdown", onDown);
    rail.addEventListener("pointermove", onMove);
    rail.addEventListener("pointerup", onUp);
    rail.addEventListener("pointercancel", onUp);
    rail.addEventListener("click", onClick, true);
    rail.addEventListener("wheel", onWheel, { passive: true });

    rail.scrollLeft = 1; // allow scrolling slightly left into the loop
    if (!reduced) raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(idleTimer);
      rail.removeEventListener("pointerenter", onEnter);
      rail.removeEventListener("pointerleave", onLeave);
      rail.removeEventListener("scroll", onScroll);
      rail.removeEventListener("pointerdown", onDown);
      rail.removeEventListener("pointermove", onMove);
      rail.removeEventListener("pointerup", onUp);
      rail.removeEventListener("pointercancel", onUp);
      rail.removeEventListener("click", onClick, true);
      rail.removeEventListener("wheel", onWheel);
    };
  }, []);

  const onCardMove = (event: React.PointerEvent<HTMLAnchorElement>) => {
    if (reducedRef.current) return;
    const el = event.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (event.clientX - r.left) / r.width - 0.5;
    const py = (event.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-py * 10).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * 10).toFixed(2)}deg`);
  };
  const onCardLeave = (event: React.PointerEvent<HTMLAnchorElement>) => {
    const el = event.currentTarget;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <div className="lp-typeface-rail" ref={railRef} aria-label="Typeface specimens">
      <div className="lp-typeface-track">
        {[...specimens, ...specimens].map((s, i) => (
          <Link
            key={`${s.slug}-${i}`}
            href={`/type/${s.slug}`}
            className="lp-typeface-card"
            aria-hidden={i >= specimens.length}
            tabIndex={i >= specimens.length ? -1 : undefined}
            onPointerMove={onCardMove}
            onPointerLeave={onCardLeave}
          >
            <span className="lp-typeface-card__specimen" style={{ fontFamily: `JDT__${s.slug}` }}>
              {s.name}
            </span>
            <span className="lp-typeface-card__row">
              <span className="lp-typeface-card__cat">{s.cat}</span>
              <span className="lp-typeface-card__arrow">→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
