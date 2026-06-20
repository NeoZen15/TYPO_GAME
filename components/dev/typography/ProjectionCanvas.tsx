"use client";

import { useEffect, useRef } from "react";
import type { LayoutBox } from "@/lib/typography/anatomy-metrics";
import { waitForTypographyFonts } from "@/lib/typography/anatomy-metrics";

type ProjectionCanvasProps = {
  className?: string;
  family: string;
  sample: string;
  layout: LayoutBox;
  baseline: number;
  width: number;
  height: number;
  weight?: number;
  fillStyle?: string;
};

export default function ProjectionCanvas({
  className,
  family,
  sample,
  layout,
  baseline,
  width,
  height,
  weight = 500,
  fillStyle = "#f6f6f2",
}: ProjectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;
    let cancelled = false;

    const draw = async () => {
      await waitForTypographyFonts();
      if (cancelled) return;

      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = Math.max(width * dpr, 1);
      canvas.height = Math.max(height * dpr, 1);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${weight} ${layout.fontSize}px ${family}`;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillStyle = fillStyle;
      ctx.fillText(sample, layout.drawX, baseline);
    };

    draw().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [baseline, family, fillStyle, height, layout, sample, weight, width]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
