"use client";

import { useEffect, useRef } from "react";
import { DEFAULT_SPEC, generateStudio, StudioSpec } from "@/lib/studio/engine";

// A small, real Studio output: same engine as /studio, coarse pitch so it renders instantly.
const THUMB_SPEC: StudioSpec = {
  ...DEFAULT_SPEC,
  facadeW: 9000,
  facadeH: 9000,
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
      ctx.clearRect(0, 0, w, h);
      const s = w / THUMB_SPEC.facadeW;
      const result = generateStudio(THUMB_SPEC);
      for (const p of result.panels) {
        const px = p.x * s;
        const py = h - (p.y + p.h) * s;
        ctx.fillStyle = "#171717";
        ctx.fillRect(px, py, p.w * s, p.h * s);
        ctx.fillStyle = "#8f8f8f";
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
      className={`block h-full w-full ${className}`}
      aria-label="Facade Studio preview: perforated elevation with an attractor gradient, panelled"
    />
  );
}
