"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type MascotStopId = "block-1" | "block-2" | "block-3" | "block-4" | "block-5";

type MascotStop = {
  id: MascotStopId;
  selector: string;
  gazeSelector: string;
  xPercent: number;
  yPercent: number;
  rotation: number;
  scale: number;
};

const LEFT_EYE_BASE = { cx: 43.801, cy: 46.175 };
const RIGHT_EYE_BASE = { cx: 79.53, cy: 46.175 };
const LETTER_CONFETTI_CHARS = "abcdefghijklmnopqrstu";
const SECTION_COMMENTS: Record<MascotStopId, string[]> = {
  "block-1": [
    "If it looks obvious, it probably isn't.",
  ],
  "block-2": [
    "If two fonts confuse you, good. That means you're looking.",
  ],
  "block-3": [
    "Say yes. Your future design career depends on it.",
  ],
  "block-4": [
    "Confused fonts return faster. Your brain hates unfinished business.",
  ],
  "block-5": [
    "You read the word. You missed the letters.",
    "You saw a word. Designers see a structure.",
  ],
};

const MASCOT_STOPS: MascotStop[] = [
  {
    id: "block-1",
    selector: ".block-1",
    gazeSelector: ".block-1-hero",
    xPercent: 84,
    yPercent: 76,
    rotation: -3,
    scale: 1,
  },
  {
    id: "block-2",
    selector: ".block-2",
    gazeSelector: ".block-2 .section-title",
    xPercent: 80,
    yPercent: 28,
    rotation: 2,
    scale: 1.01,
  },
  {
    id: "block-3",
    selector: ".block-3",
    gazeSelector: ".choice-actions",
    xPercent: 14,
    yPercent: 60,
    rotation: 2,
    scale: 1.01,
  },
  {
    id: "block-4",
    selector: ".block-4",
    gazeSelector: ".block-4-reel",
    xPercent: 86,
    yPercent: 70,
    rotation: 1,
    scale: 0.99,
  },
  {
    id: "block-5",
    selector: ".block-5",
    gazeSelector: ".block-5-lockup",
    xPercent: 14,
    yPercent: 74,
    rotation: 2,
    scale: 1.01,
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function ScrollMascot() {
  const mascotRef = useRef<HTMLButtonElement>(null);
  const commentRef = useRef<HTMLSpanElement>(null);
  const confettiLayerRef = useRef<HTMLSpanElement>(null);
  const leftPupilRef = useRef<SVGCircleElement>(null);
  const rightPupilRef = useRef<SVGCircleElement>(null);
  const gazeTargetRef = useRef<HTMLElement | null>(null);
  const activeStopRef = useRef<MascotStopId>("block-1");
  const commentIndexRef = useRef<Record<string, number>>({});
  const rafRef = useRef<number | null>(null);
  const blinkTimeoutRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, seen: false });
  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const hasManualPlacementRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [commentText, setCommentText] = useState("");
  const [commentSide, setCommentSide] = useState<"left" | "right">("left");

  useEffect(() => {
    const comment = commentRef.current;
    if (!comment || commentText.length === 0) return;
    gsap.killTweensOf(comment);
    gsap.fromTo(
      comment,
      { autoAlpha: 0, y: 8, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.24, ease: "power2.out" }
    );
  }, [commentText]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const mascot = mascotRef.current;
    const leftPupil = leftPupilRef.current;
    const rightPupil = rightPupilRef.current;
    if (!mascot || !leftPupil || !rightPupil) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const triggers: ScrollTrigger[] = [];
    let revealTrigger: ScrollTrigger | null = null;
    let hasRevealed = false;
    let travelTl: gsap.core.Timeline | null = null;
    const DRAG_THRESHOLD_PX = 8;

    const clampMascotToViewport = (x: number, y: number) => {
      const rect = mascot.getBoundingClientRect();
      const padding = 4;
      const maxX = Math.max(padding, window.innerWidth - rect.width - padding);
      const maxY = Math.max(padding, window.innerHeight - rect.height - padding);
      return {
        x: clamp(x, padding, maxX),
        y: clamp(y, padding, maxY),
      };
    };
    const pickComment = (stopId: MascotStopId, keyPrefix = "section") => {
      const pool = SECTION_COMMENTS[stopId];
      if (!pool || pool.length === 0) return;

      const key = `${keyPrefix}:${stopId}`;
      const previousIndex = commentIndexRef.current[key];
      let nextIndex = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && nextIndex === previousIndex) {
        nextIndex = (nextIndex + 1) % pool.length;
      }
      commentIndexRef.current[key] = nextIndex;
      setCommentText(pool[nextIndex] ?? pool[0]);
    };

    const applyStop = (
      stop: MascotStop,
      options?: { animate?: boolean; updateComment?: boolean }
    ) => {
      const isSameStop = stop.id === activeStopRef.current;
      if (hasManualPlacementRef.current && isSameStop) {
        gazeTargetRef.current = document.querySelector<HTMLElement>(stop.gazeSelector);
        return;
      }
      if (hasManualPlacementRef.current && !isSameStop) {
        hasManualPlacementRef.current = false;
      }

      const isCompact = window.innerWidth < 768;
      const xPercent = isCompact ? Math.min(stop.xPercent, 76) : stop.xPercent;
      const yPercent = isCompact ? stop.yPercent + 2 : stop.yPercent;
      const targetX = (window.innerWidth * xPercent) / 100;
      const targetY = (window.innerHeight * yPercent) / 100;
      const shouldAnimate =
        options?.animate ?? (!reducedMotion && hasRevealed);
      const shouldUpdateComment = options?.updateComment ?? true;

      activeStopRef.current = stop.id;
      setCommentSide(xPercent > 50 ? "left" : "right");

      if (!shouldAnimate) {
        if (shouldUpdateComment && hasRevealed) {
          pickComment(stop.id);
        }
        travelTl?.kill();
        gsap.set(mascot, {
          x: targetX,
          y: targetY,
          rotation: stop.rotation,
          scale: stop.scale,
        });
      } else {
        if (shouldUpdateComment) {
          setCommentText("");
        }
        const currentX = Number(gsap.getProperty(mascot, "x")) || targetX;
        const currentY = Number(gsap.getProperty(mascot, "y")) || targetY;
        const dx = targetX - currentX;
        const dy = targetY - currentY;
        const distance = Math.hypot(dx, dy);
        const totalDuration = clamp(distance / 560, 0.82, 1.34);
        const arcLift = clamp(distance * 0.06, 8, 30);
        const midX = currentX + dx * 0.5;
        const midY = currentY + dy * 0.5 - arcLift;
        const commentRevealAt = totalDuration * 0.58;

        travelTl?.kill();
        travelTl = gsap
          .timeline({
            defaults: { overwrite: "auto" },
          })
          .to(mascot, {
            x: midX,
            y: midY,
            rotation: stop.rotation * 0.36,
            scale: 1 + (stop.scale - 1) * 0.4,
            duration: totalDuration * 0.36,
            ease: "sine.out",
          })
          .to(mascot, {
            x: targetX,
            y: targetY,
            rotation: stop.rotation,
            scale: stop.scale,
            duration: totalDuration * 0.64,
            ease: "power3.out",
          });

        if (shouldUpdateComment) {
          travelTl.call(
            () => {
              if (hasRevealed) {
                pickComment(stop.id);
              }
            },
            undefined,
            commentRevealAt
          );
        }
      }

      gazeTargetRef.current = document.querySelector<HTMLElement>(stop.gazeSelector);
    };

    const resolveActiveStop = () => {
      const centerY = window.innerHeight / 2;
      for (const stop of MASCOT_STOPS) {
        const node = document.querySelector<HTMLElement>(stop.selector);
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        if (rect.top <= centerY && rect.bottom >= centerY) {
          return stop;
        }
      }
      return MASCOT_STOPS[0];
    };

    const updateEyes = () => {
      const rect = mascot.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const gazeTarget = gazeTargetRef.current;
      let targetX = centerX;
      let targetY = centerY;

      if (mouseRef.current.seen) {
        targetX = mouseRef.current.x;
        targetY = mouseRef.current.y;
      }

      if (gazeTarget) {
        const targetRect = gazeTarget.getBoundingClientRect();
        const contextualX = targetRect.left + targetRect.width / 2;
        const contextualY = targetRect.top + targetRect.height / 2;
        if (mouseRef.current.seen) {
          targetX = targetX * 0.55 + contextualX * 0.45;
          targetY = targetY * 0.55 + contextualY * 0.45;
        } else {
          targetX = contextualX;
          targetY = contextualY;
        }
      }

      const xOffset = clamp((targetX - centerX) / 140, -1, 1) * 2.4;
      const yOffset = clamp((targetY - centerY) / 140, -1, 1) * 1.9;

      leftPupil.setAttribute("cx", String(LEFT_EYE_BASE.cx + xOffset));
      leftPupil.setAttribute("cy", String(LEFT_EYE_BASE.cy + yOffset));
      rightPupil.setAttribute("cx", String(RIGHT_EYE_BASE.cx + xOffset));
      rightPupil.setAttribute("cy", String(RIGHT_EYE_BASE.cy + yOffset));

      rafRef.current = window.requestAnimationFrame(updateEyes);
    };

    const queueBlink = () => {
      gsap.fromTo(
        [leftPupil, rightPupil],
        { scaleY: 1 },
        {
          scaleY: 0.08,
          duration: 0.08,
          transformOrigin: "center center",
          yoyo: true,
          repeat: 1,
          ease: "power2.inOut",
        }
      );

      blinkTimeoutRef.current = window.setTimeout(
        queueBlink,
        1800 + Math.random() * 2400
      );
    };

    const startEyeLoops = () => {
      if (reducedMotion) return;
      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(updateEyes);
      }
      if (blinkTimeoutRef.current === null) {
        queueBlink();
      }
    };

    const revealMascot = () => {
      if (hasRevealed) return;
      hasRevealed = true;
      applyStop(resolveActiveStop(), { animate: false });

      if (reducedMotion) {
        gsap.set(mascot, { autoAlpha: 1, pointerEvents: "auto" });
        return;
      }

      gsap.to(mascot, {
        autoAlpha: 1,
        duration: 0.35,
        ease: "power2.out",
        onComplete: () => {
          gsap.set(mascot, { pointerEvents: "auto" });
        },
      });
      startEyeLoops();
    };

    const hideMascot = () => {
      if (!hasRevealed) return;
      hasRevealed = false;
      isDraggingRef.current = false;
      dragMovedRef.current = false;
      dragPointerIdRef.current = null;
      hasManualPlacementRef.current = false;
      setCommentText("");
      travelTl?.kill();
      gsap.killTweensOf(mascot);
      gsap.set(mascot, { cursor: "pointer" });
      if (leftPupil && rightPupil) {
        gsap.killTweensOf([leftPupil, rightPupil]);
        gsap.set([leftPupil, rightPupil], { scaleX: 1, scaleY: 1 });
      }

      if (reducedMotion) {
        gsap.set(mascot, { autoAlpha: 0, pointerEvents: "none" });
        return;
      }

      gsap.to(mascot, {
        autoAlpha: 0,
        duration: 0.22,
        ease: "power2.out",
        onComplete: () => {
          gsap.set(mascot, { pointerEvents: "none" });
        },
      });
    };

    gsap.set(mascot, {
      autoAlpha: 0,
      pointerEvents: "none",
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
    });
    applyStop(resolveActiveStop(), { animate: false });

    if (!reducedMotion) {
      gsap.to(".site-mascot__svg", {
        y: -2.8,
        rotate: 1.4,
        duration: 1.8,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    }

    if (!reducedMotion) {
      for (const stop of MASCOT_STOPS) {
        const trigger = ScrollTrigger.create({
          trigger: stop.selector,
          start: "top center",
          end: "bottom center",
          onEnter: () => applyStop(stop, { animate: true }),
          onEnterBack: () => applyStop(stop, { animate: true }),
        });
        triggers.push(trigger);
      }
    }

    const handleResize = () => {
      if (hasManualPlacementRef.current) {
        const currentX = Number(gsap.getProperty(mascot, "x")) || 0;
        const currentY = Number(gsap.getProperty(mascot, "y")) || 0;
        const clamped = clampMascotToViewport(currentX, currentY);
        gsap.set(mascot, { x: clamped.x, y: clamped.y });
        return;
      }
      applyStop(resolveActiveStop(), { animate: false });
    };

    const handlePointerMove = (event: PointerEvent) => {
      mouseRef.current = { x: event.clientX, y: event.clientY, seen: true };
    };

    const handleDragStart = (event: PointerEvent) => {
      if (!hasRevealed || event.button !== 0) return;
      if (event.pointerType === "mouse" && event.buttons !== 1) return;

      const currentX = Number(gsap.getProperty(mascot, "x")) || 0;
      const currentY = Number(gsap.getProperty(mascot, "y")) || 0;

      if (travelTl) {
        travelTl.kill();
      }
      gsap.killTweensOf(mascot);

      isDraggingRef.current = true;
      dragMovedRef.current = false;
      dragPointerIdRef.current = event.pointerId;
      dragStartRef.current = { x: event.clientX, y: event.clientY };
      dragOffsetRef.current = {
        x: event.clientX - currentX,
        y: event.clientY - currentY,
      };

      mascot.setPointerCapture(event.pointerId);
      gsap.set(mascot, { cursor: "grabbing" });
      if (leftPupil && rightPupil) {
        gsap.set([leftPupil, rightPupil], {
          scaleX: 1.06,
          scaleY: 0.9,
          transformOrigin: "center center",
        });
      }
    };

    const handleDragMove = (event: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (dragPointerIdRef.current !== event.pointerId) return;

      if (event.cancelable) {
        event.preventDefault();
      }

      const distance = Math.hypot(
        event.clientX - dragStartRef.current.x,
        event.clientY - dragStartRef.current.y
      );
      if (!dragMovedRef.current && distance >= DRAG_THRESHOLD_PX) {
        dragMovedRef.current = true;
        setCommentText("");
      }

      const nextX = event.clientX - dragOffsetRef.current.x;
      const nextY = event.clientY - dragOffsetRef.current.y;
      const clamped = clampMascotToViewport(nextX, nextY);
      const stretch = clamp(distance / 220, 0, 1);
      gsap.set(mascot, { x: clamped.x, y: clamped.y });

      if (leftPupil && rightPupil) {
        gsap.set([leftPupil, rightPupil], {
          scaleX: 1 + stretch * 0.22,
          scaleY: Math.max(0.55, 1 - stretch * 0.35),
          transformOrigin: "center center",
        });
      }
    };

    const finishDrag = (event: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (dragPointerIdRef.current !== event.pointerId) return;

      if (mascot.hasPointerCapture(event.pointerId)) {
        mascot.releasePointerCapture(event.pointerId);
      }

      isDraggingRef.current = false;
      dragPointerIdRef.current = null;
      gsap.set(mascot, { cursor: "pointer" });

      if (!dragMovedRef.current) {
        gsap.to(mascot, {
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          duration: 0.16,
          ease: "power2.out",
          overwrite: true,
        });
        if (leftPupil && rightPupil) {
          gsap.to([leftPupil, rightPupil], {
            scaleX: 1,
            scaleY: 1,
            duration: 0.14,
            transformOrigin: "center center",
            ease: "power2.out",
            overwrite: true,
          });
        }
        return;
      }

      suppressClickRef.current = true;
      hasManualPlacementRef.current = true;
      const releaseRotation = Number(gsap.getProperty(mascot, "rotation")) || 0;

      gsap
        .timeline({ defaults: { overwrite: "auto" } })
        .to(mascot, {
          scaleX: 0.9,
          scaleY: 1.1,
          rotation: releaseRotation * 0.22,
          duration: 0.09,
          ease: "power2.out",
        })
        .to(mascot, {
          scaleX: 1.04,
          scaleY: 0.96,
          rotation: releaseRotation * -0.1,
          duration: 0.1,
          ease: "power2.out",
        })
        .to(mascot, {
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          duration: 0.36,
          ease: "elastic.out(1, 0.5)",
        });

      if (leftPupil && rightPupil) {
        gsap.to([leftPupil, rightPupil], {
          scaleX: 1,
          scaleY: 1,
          duration: 0.26,
          transformOrigin: "center center",
          ease: "back.out(1.8)",
          overwrite: true,
        });
      }

      const rect = mascot.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      setCommentSide(centerX > window.innerWidth / 2 ? "left" : "right");
      dragMovedRef.current = false;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    mascot.addEventListener("pointerdown", handleDragStart);

    revealTrigger = ScrollTrigger.create({
      trigger: ".block-2-copy",
      start: "top 62%",
      onEnter: revealMascot,
      onEnterBack: revealMascot,
      onLeaveBack: hideMascot,
    });

    const revealNode = document.querySelector<HTMLElement>(".block-2-copy");
    if (revealNode) {
      const top = revealNode.getBoundingClientRect().top;
      if (top <= window.innerHeight * 0.62) {
        revealMascot();
      }
    }

    return () => {
      for (const trigger of triggers) {
        trigger.kill();
      }
      revealTrigger?.kill();
      if (travelTl) {
        travelTl.kill();
      }

      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      mascot.removeEventListener("pointerdown", handleDragStart);

      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      if (blinkTimeoutRef.current !== null) {
        window.clearTimeout(blinkTimeoutRef.current);
      }
    };
  }, []);

  const burstLetterConfetti = () => {
    const mascot = mascotRef.current;
    const layer = confettiLayerRef.current;
    if (!mascot || !layer) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const layerRect = layer.getBoundingClientRect();
    const originX = layerRect.width / 2;
    const originY = layerRect.height * 0.14;
    const pieces = reducedMotion ? 20 : 38;
    const maxSpreadX = layerRect.width * 0.44;
    const maxFall = layerRect.height * 0.86;

    for (let index = 0; index < pieces; index += 1) {
      const letter = document.createElement("span");
      letter.className = "site-mascot__letter-confetti";
      const charIndex = Math.floor(
        Math.random() * LETTER_CONFETTI_CHARS.length
      );
      letter.textContent = LETTER_CONFETTI_CHARS[charIndex] ?? "a";
      layer.appendChild(letter);

      const driftX = gsap.utils.random(-maxSpreadX, maxSpreadX);
      const entryDrop = gsap.utils.random(6, 14);
      const fall = gsap.utils.random(maxFall * 0.55, maxFall);
      const sway = gsap.utils.random(-14, 14);
      const spin = gsap.utils.random(-180, 180);
      const delay = gsap.utils.random(0, reducedMotion ? 0.08 : 0.18);

      gsap.set(letter, {
        x: originX + gsap.utils.random(-8, 8),
        y: originY + gsap.utils.random(-4, 2),
        opacity: 0,
        scale: gsap.utils.random(0.76, 1.05),
        rotation: gsap.utils.random(-45, 45),
      });

      gsap
        .timeline({
          defaults: { overwrite: "auto" },
          delay,
          onComplete: () => {
            letter.remove();
          },
        })
        .to(letter, {
          x: originX + driftX * 0.26 + sway,
          y: originY + entryDrop,
          opacity: 1,
          duration: reducedMotion ? 0.1 : 0.14,
          ease: "power1.out",
        })
        .to(letter, {
          x: originX + driftX,
          y: originY + fall,
          rotation: `+=${spin}`,
          opacity: 0,
          duration: reducedMotion ? 0.5 : 0.72,
          ease: "power1.in",
        });
    }
  };

  const handleClick = () => {
    const mascot = mascotRef.current;
    const leftPupil = leftPupilRef.current;
    const rightPupil = rightPupilRef.current;
    if (!mascot) return;
    if (isDraggingRef.current) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    gsap.set(mascot, { scaleX: 1, scaleY: 1 });

    burstLetterConfetti();
    const clickPool = SECTION_COMMENTS[activeStopRef.current];
    if (clickPool) {
      const clickKey = `click:${activeStopRef.current}`;
      const previousIndex = commentIndexRef.current[clickKey];
      let nextIndex = Math.floor(Math.random() * clickPool.length);
      if (clickPool.length > 1 && nextIndex === previousIndex) {
        nextIndex = (nextIndex + 1) % clickPool.length;
      }
      commentIndexRef.current[clickKey] = nextIndex;
      setCommentText(clickPool[nextIndex] ?? clickPool[0] ?? "");
    }
    gsap.killTweensOf([mascot, leftPupil, rightPupil]);

    gsap
      .timeline({ defaults: { overwrite: "auto" } })
      .to(mascot, {
        y: "-=30",
        scale: 1.25,
        rotation: "+=22",
        duration: 0.14,
        ease: "power3.out",
      })
      .to(
        mascot,
        {
          y: "+=34",
          scale: 0.9,
          rotation: "-=36",
          duration: 0.22,
          ease: "bounce.out",
        },
        ">"
      )
      .to(
        mascot,
        {
          x: "-=9",
          duration: 0.06,
          ease: "power2.inOut",
        },
        "<"
      )
      .to(mascot, { x: "+=18", duration: 0.08, ease: "power2.inOut" })
      .to(mascot, { x: "-=9", duration: 0.08, ease: "power2.inOut" })
      .to(
        mascot,
        {
          scale: 1,
          rotation: "+=14",
          duration: 0.44,
          ease: "elastic.out(1.15, 0.42)",
        },
        "<"
      );

    if (leftPupil && rightPupil) {
      gsap.fromTo(
        [leftPupil, rightPupil],
        { scaleX: 1, scaleY: 1 },
        {
          scaleX: 1.32,
          scaleY: 0.24,
          duration: 0.08,
          transformOrigin: "center center",
          yoyo: true,
          repeat: 1,
          ease: "power2.inOut",
        }
      );
    }

  };

  const commentLines = (() => {
    const normalized = commentText.replace(/\s+/g, " ").trim();
    if (!normalized) return [""];

    const sentenceBreak = normalized.match(/^(.+?[.!?])\s+(.+)$/);
    if (sentenceBreak) {
      const firstSentence = sentenceBreak[1] ?? "";
      const rest = sentenceBreak[2] ?? "";
      return [firstSentence, rest];
    }

    const commaBreak = normalized.match(/^(.+?,)\s+(.+)$/);
    if (commaBreak) {
      const firstClause = commaBreak[1] ?? "";
      const rest = commaBreak[2] ?? "";
      return [firstClause, rest];
    }

    return [normalized];
  })();

  return (
    <button
      ref={mascotRef}
      type="button"
      className="site-mascot"
      aria-label="Mascot easter egg"
      onClick={handleClick}
    >
      {commentText ? (
        <span
          ref={commentRef}
          className={`site-mascot__comment site-mascot__comment--${commentSide} is-visible`}
          aria-live="polite"
        >
          <span className="site-mascot__comment-line">{commentLines[0]}</span>
          {commentLines[1] ? (
            <span className="site-mascot__comment-line">{commentLines[1]}</span>
          ) : null}
        </span>
      ) : null}
      <span
        ref={confettiLayerRef}
        className="site-mascot__confetti-local"
        aria-hidden="true"
      />
      <svg
        aria-hidden="true"
        className="site-mascot__svg"
        viewBox="0 0 122.15 117.186"
      >
          <path
            className="site-mascot__body"
            d="M79.315,1.153h-36.995c-2.652,0-5.196,1.054-7.071,2.929L9.09,30.242c-1.875,1.875-2.929,4.419-2.929,7.071v36.995c0,2.652,1.054,5.196,2.929,7.071l26.159,26.159c1.875,1.875,4.419,2.929,7.071,2.929h36.995c2.652,0,5.196-1.054,7.071-2.929l26.159-26.159c1.875-1.875,2.929-4.419,2.929-7.071v-36.995c0-2.652-1.054-5.196-2.929-7.071l-26.159-26.159c-1.875-1.875-4.419-2.929-7.071-2.929Z"
          />
          <path
            className="site-mascot__socket"
            d="M39.099,32.627l-7.541,5.479c-2.804,2.037-3.977,5.648-2.906,8.944l2.88,8.865c1.071,3.296,4.143,5.528,7.608,5.528h9.321c3.466,0,6.537-2.232,7.608-5.528l2.88-8.865c1.071-3.296-.102-6.907-2.906-8.944l-7.541-5.479c-2.804-2.037-6.601-2.037-9.405,0Z"
          />
          <path
            className="site-mascot__socket"
            d="M74.828,32.627l-7.541,5.479c-2.804,2.037-3.977,5.648-2.906,8.944l2.88,8.865c1.071,3.296,4.143,5.528,7.608,5.528h9.321c3.466,0,6.537-2.232,7.608-5.528l2.88-8.865c1.071-3.296-.102-6.907-2.906-8.944l-7.541-5.479c-2.804-2.037-6.601-2.037-9.405,0Z"
          />
          <circle
            ref={leftPupilRef}
            className="site-mascot__pupil"
            cx={LEFT_EYE_BASE.cx}
            cy={LEFT_EYE_BASE.cy}
            r="4.2"
          />
          <circle
            ref={rightPupilRef}
            className="site-mascot__pupil"
            cx={RIGHT_EYE_BASE.cx}
            cy={RIGHT_EYE_BASE.cy}
            r="4.2"
          />
      </svg>
    </button>
  );
}
