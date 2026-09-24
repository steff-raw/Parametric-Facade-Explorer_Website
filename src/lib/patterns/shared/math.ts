/**
 * Deterministic PRNG helpers + SVG serialization for static 2D patterns.
 * Display uses React SVG DOM; strings are only for export/thumbnails.
 */

import { SvgPrimitive } from "./types";

/** Mulberry32 — fast, good enough for visual noise */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value noise in [0, 1] from integer grid coords + seed */
export function hash2(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Smoothstep for interpolation */
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 2D value noise with bilinear interpolation */
export function valueNoise2D(
  x: number,
  y: number,
  seed: number
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smoothstep(x - x0);
  const fy = smoothstep(y - y0);

  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);

  const ab = a + (b - a) * fx;
  const cd = c + (d - c) * fx;
  return ab + (cd - ab) * fy;
}

export const SVG_SIZE = 800;
export const SVG_BG = "#0d0d0d";
/** Matches bookofshapes preview stroke */
export const STROKE = "#cccccc";
/** Exact bookofshapes hairline (CSS px via non-scaling-stroke) */
export const STROKE_WIDTH = 0.2;
export const FILL_BG = "none";

const LINE_ATTRS = `stroke="${STROKE}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"`;

function primitiveToMarkup(p: SvgPrimitive): string {
  switch (p.type) {
    case "line":
      return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" ${LINE_ATTRS} />`;
    case "circle": {
      const op =
        p.opacity !== undefined ? ` stroke-opacity="${p.opacity}"` : "";
      return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" ${LINE_ATTRS}${op} />`;
    }
    case "path": {
      const op =
        p.opacity !== undefined ? ` stroke-opacity="${p.opacity}"` : "";
      return `<path d="${p.d}" ${LINE_ATTRS}${op} />`;
    }
    case "rect": {
      const op =
        p.opacity !== undefined ? ` stroke-opacity="${p.opacity}"` : "";
      return `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" ${LINE_ATTRS}${op} />`;
    }
    default:
      return "";
  }
}

/** Build downloadable SVG string from primitives (export / noscript thumbs) */
export function serializePrimitivesToSvg(
  primitives: SvgPrimitive[],
  size = SVG_SIZE
): string {
  const body = primitives.map(primitiveToMarkup).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none">${body}</svg>`;
}

/** @deprecated Prefer primitives + serializePrimitivesToSvg — kept for kinetic previews */
export function svgOpen(
  size = SVG_SIZE,
  extraAttrs = ""
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%" fill="none" ${extraAttrs}>`;
}

export function svgClose(): string {
  return `</svg>`;
}

export function fmt(n: number): string {
  return String(n);
}
