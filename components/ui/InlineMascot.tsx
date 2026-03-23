"use client";

import { useEffect, useRef } from "react";

type InlineMascotProps = {
  className?: string;
  draggable?: boolean;
  comment?: string;
  commentSide?: "auto" | "left" | "right";
};

export default function InlineMascot({
  className,
  draggable = false,
  comment,
  commentSide = "auto",
}: InlineMascotProps) {
  const mascotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mascot = mascotRef.current;
    if (!mascot || !comment) return;

    if (commentSide !== "auto") {
      mascot.dataset.commentSide = commentSide;
      return;
    }

    const rect = mascot.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    mascot.dataset.commentSide = centerX < window.innerWidth / 2 ? "right" : "left";
  }, [comment, commentSide]);

  useEffect(() => {
    const mascot = mascotRef.current;
    if (!mascot) return;

    let frame = 0;

    const resetEyes = () => {
      mascot.style.setProperty("--onb-eye-x", "0px");
      mascot.style.setProperty("--onb-eye-y", "0px");
    };

    const updateEyes = (x: number, y: number) => {
      const rect = mascot.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.hypot(dx, dy);

      if (distance < 0.001) {
        resetEyes();
        return;
      }

      const maxOffset = 2.8;
      const amount = Math.min(maxOffset, distance / 26);
      const ox = (dx / distance) * amount;
      const oy = (dy / distance) * amount;

      mascot.style.setProperty("--onb-eye-x", `${ox.toFixed(2)}px`);
      mascot.style.setProperty("--onb-eye-y", `${oy.toFixed(2)}px`);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        updateEyes(event.clientX, event.clientY);
      });
    };

    const onPointerLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        resetEyes();
      });
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  useEffect(() => {
    const mascot = mascotRef.current;
    if (!mascot || !draggable) return;

    let currentX = 0;
    let currentY = 0;
    let grabOffsetX = 0;
    let grabOffsetY = 0;
    let originLeft = 0;
    let originTop = 0;
    let isDragging = false;

    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));

    const applyOffset = () => {
      mascot.style.setProperty("--inline-mascot-dx", `${currentX.toFixed(2)}px`);
      mascot.style.setProperty("--inline-mascot-dy", `${currentY.toFixed(2)}px`);

      if (commentSide === "auto") {
        const rect = mascot.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        mascot.dataset.commentSide = centerX < window.innerWidth / 2 ? "right" : "left";
      } else {
        mascot.dataset.commentSide = commentSide;
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const rect = mascot.getBoundingClientRect();
      originLeft = rect.left - currentX;
      originTop = rect.top - currentY;
      grabOffsetX = event.clientX - rect.left;
      grabOffsetY = event.clientY - rect.top;
      isDragging = true;
      mascot.classList.add("is-dragging");
      mascot.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging) return;

      const rect = mascot.getBoundingClientRect();
      const viewportPadding = 8;
      const maxLeft = window.innerWidth - rect.width - viewportPadding;
      const maxTop = window.innerHeight - rect.height - viewportPadding;

      const desiredLeft = clamp(
        event.clientX - grabOffsetX,
        viewportPadding,
        maxLeft,
      );
      const desiredTop = clamp(
        event.clientY - grabOffsetY,
        viewportPadding,
        maxTop,
      );

      currentX = desiredLeft - originLeft;
      currentY = desiredTop - originTop;
      applyOffset();
    };

    const stopDragging = (event: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      mascot.classList.remove("is-dragging");
      if (mascot.hasPointerCapture(event.pointerId)) {
        mascot.releasePointerCapture(event.pointerId);
      }
    };

    applyOffset();
    mascot.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      mascot.classList.remove("is-dragging");
      mascot.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [commentSide, draggable]);

  const rootClassName = `onboarding-mascot-inline ${className ?? ""} ${
    draggable ? "is-draggable" : ""
  }`.trim();

  return (
    <div ref={mascotRef} className={rootClassName} aria-hidden="true">
      <svg
        className="onboarding-mascot-svg"
        viewBox="0 0 122.15 117.186"
      >
        <path
          className="onboarding-mascot-body"
          d="M79.315,1.153h-36.995c-2.652,0-5.196,1.054-7.071,2.929L9.09,30.242c-1.875,1.875-2.929,4.419-2.929,7.071v36.995c0,2.652,1.054,5.196,2.929,7.071l26.159,26.159c1.875,1.875,4.419,2.929,7.071,2.929h36.995c2.652,0,5.196-1.054,7.071-2.929l26.159-26.159c1.875-1.875,2.929-4.419,2.929-7.071v-36.995c0-2.652-1.054-5.196-2.929-7.071l-26.159-26.159c-1.875-1.875-4.419-2.929-7.071-2.929Z"
        />
        <path
          className="onboarding-mascot-eye onboarding-mascot-eye--left"
          d="M39.099,32.627l-7.541,5.479c-2.804,2.037-3.977,5.648-2.906,8.944l2.88,8.865c1.071,3.296,4.143,5.528,7.608,5.528h9.321c3.466,0,6.537-2.232,7.608-5.528l2.88-8.865c1.071-3.296-.102-6.907-2.906-8.944l-7.541-5.479c-2.804-2.037-6.601-2.037-9.405,0Z"
        />
        <path
          className="onboarding-mascot-eye onboarding-mascot-eye--right"
          d="M74.828,32.627l-7.541,5.479c-2.804,2.037-3.977,5.648-2.906,8.944l2.88,8.865c1.071,3.296,4.143,5.528,7.608,5.528h9.321c3.466,0,6.537-2.232,7.608-5.528l2.88-8.865c1.071-3.296-.102-6.907-2.906-8.944l-7.541-5.479c-2.804-2.037-6.601-2.037-9.405,0Z"
        />
        <circle className="onboarding-mascot-pupil onboarding-mascot-pupil--left" cx="43.801" cy="46.175" r="5" />
        <circle className="onboarding-mascot-pupil onboarding-mascot-pupil--right" cx="79.53" cy="46.175" r="5" />
      </svg>
      {comment ? <span className="inline-mascot-comment">{comment}</span> : null}
    </div>
  );
}
