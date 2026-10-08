"use client";

import { useEffect, useRef } from "react";
import { DEFAULT_SPEC, generateStudio, StudioSpec } from "@/lib/studio/engine";

// A small, real Studio output: same engine as /studio, coarse pitch so it renders instantly.
const THUMB_SPEC: StudioSpec = {
  ...DEFAULT_SPEC,
  facadeW: 12000,
  facadeH: 6000,
  pitch: 90,
  holeMin: 8,
  holeMax: 70,
  driver: "radial",
  attractorX: 0.64,
  attractorY: 0.58,
  falloff: 0.55,
  tools: 5,
};

export default function StudioThumbnail({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => {
      const w = cv.clientWidth || 600;
      const h = Math.round((w * THUMB_SPEC.facadeH) / THUMB_SPEC.facadeW);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0d0d0d";
      ctx.fillRect(0, 0, w, h);
      const s = w / THUMB_SPEC.facadeW;
      const result = generateStudio(THUMB_SPEC);
      for (const p of result.panels) {
        const px = p.x * s;
        const py = h - (p.y + p.h) * s;
        ctx.fillStyle = "#1f1f1f";
        ctx.fillRect(px, py, p.w * s, p.h * s);
        ctx.fillStyle = "#e8e8e8";
        ctx.beginPath();
        for (const hole of p.holes) {
          const r = Math.max(0.4, (hole.d / 2) * s);
          const cx = px + hole.x * s;
          const cy = py + (p.h - hole.y) * s;
          ctx.moveTo(cx + r, cy);
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  return (
    <canvas
      ref={ref}
      className={`block aspect-[2/1] w-full bg-canvas ${className}`}
      aria-label="Facade Studio preview: perforated elevation with an attractor gradient, panelled"
    />
  );
}
