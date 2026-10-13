/**
 * Woven Strip Screen — static-3d
 *
 * Horizontal and vertical strips pass over and under each other. At every
 * crossing one strip sits in front (+depth) and the other behind (−depth);
 * between crossings each strip is a straight segment from one to the next,
 * so the screen gets real relief and shadow. Weave type sets the over/under
 * rhythm: plain 1/1, basket 2/2, twill 2/2.
 *
 * TODO(v2): strip twist (needs clearance at crossings)
 * TODO(v2): attractor that opens the gap between strips
 */

import {
  PatternMeta,
  PatternParams,
  defaultsFromMeta,
  staticDefaultsFromMeta,
} from "../../patterns/shared/types";
import { STROKE, STROKE_WIDTH } from "../../patterns/shared/math";
import { ElementTransform, Static3DPatternModule } from "../shared/types";

/** 0 Plain 1/1 · 1 Basket 2/2 · 2 Twill 2/2 */
export const WEAVES = ["Plain", "Basket", "Twill"] as const;

export const meta: PatternMeta = {
  slug: "woven-strip-screen",
  name: "Woven Strip Screen",
  description:
    "Horizontal and vertical strips woven over and under each other, like woven metal or timber cladding. Weave type, strip width, gap and weave depth set the rhythm, the openness and the shadow.",
  tags: ["Woven", "Parametric Grid"],
  type: "static-3d",
  popularity: 80,
  createdAt: "2026-10-13",
  staticParams: [
    { key: "rows", label: "Horizontal Strips", min: 4, max: 30, step: 1, default: 10 },
    { key: "cols", label: "Vertical Strips", min: 4, max: 30, step: 1, default: 10 },
    { key: "stripWidth", label: "Strip Width", min: 0.08, max: 0.8, step: 0.01, default: 0.36, unit: "m*" },
    { key: "gap", label: "Gap", min: 0, max: 0.5, step: 0.01, default: 0.16, unit: "m*" },
    { key: "depth", label: "Weave Depth", min: 0, max: 0.2, step: 0.005, default: 0.09, unit: "m*" },
    { key: "thickness", label: "Strip Thickness", min: 0.005, max: 0.06, step: 0.005, default: 0.02, unit: "m*" },
    { key: "weave", label: "Weave", min: 0, max: 2, step: 1, default: 0, options: ["Plain", "Basket", "Twill"] },
  ],
};

export const defaults = defaultsFromMeta(meta);
export const staticDefaults = staticDefaultsFromMeta(meta);

type P = typeof staticDefaults;
const read = (s: PatternParams): P => ({ ...staticDefaults, ...s }) as P;

/** True when the horizontal strip `row` passes in front of vertical strip `col`. */
export function horizontalOver(row: number, col: number, weave: number): boolean {
  switch (Math.round(weave)) {
    case 1:
      return (Math.floor(row / 2) + Math.floor(col / 2)) % 2 === 0;
    case 2:
      return (((col - row) % 4) + 4) % 4 < 2;
    default:
      return (row + col) % 2 === 0;
  }
}

/** z of a strip at a crossing: horizontal strips take +depth when over, vertical strips the opposite. */
export function crossingZ(row: number, col: number, p: PatternParams, horizontal: boolean): number {
  const q = read(p);
  const over = horizontalOver(row, col, q.weave) === horizontal;
  return over ? q.depth / 2 : -q.depth / 2;
}

/**
 * Each strip is cut into segments: one end overhang, one segment per span
 * between crossings, one end overhang. Horizontal strips first, then vertical.
 */
function segmentsPerHorizontal(p: P): number {
  return Math.round(p.cols) + 1;
}
function segmentsPerVertical(p: P): number {
  return Math.round(p.rows) + 1;
}

export function getElementCount(staticParams: PatternParams): number {
  const p = read(staticParams);
  return Math.round(p.rows) * segmentsPerHorizontal(p) + Math.round(p.cols) * segmentsPerVertical(p);
}

/** Unit-length box along local x; each segment scales x to its own length. */
export function getInstanceSize(staticParams: PatternParams): [number, number, number] {
  const p = read(staticParams);
  return [1, p.stripWidth, p.thickness];
}

/**
 * Segment k of a strip with n crossings at positions s_i and depths z_i:
 * k = 0 and k = n are flat overhangs of half a pitch; 0 < k < n spans s_{k-1}..s_k.
 */
function segment(k: number, n: number, pitch: number, zAt: (i: number) => number) {
  const s = (i: number) => (i - (n - 1) / 2) * pitch;
  if (k === 0) return { mid: s(0) - pitch / 4, z: zAt(0), len: pitch / 2, slope: 0 };
  if (k === n) return { mid: s(n - 1) + pitch / 4, z: zAt(n - 1), len: pitch / 2, slope: 0 };
  const z0 = zAt(k - 1);
  const z1 = zAt(k);
  return {
    mid: (s(k - 1) + s(k)) / 2,
    z: (z0 + z1) / 2,
    len: Math.hypot(pitch, z1 - z0),
    slope: Math.atan2(z1 - z0, pitch),
  };
}

export function getElementTransform(index: number, staticParams: PatternParams): ElementTransform {
  const p = read(staticParams);
  const rows = Math.round(p.rows);
  const cols = Math.round(p.cols);
  const pitch = p.stripWidth + p.gap;
  const perH = segmentsPerHorizontal(p);

  if (index < rows * perH) {
    // Horizontal strip: long axis x, tilts about y.
    const row = Math.floor(index / perH);
    const k = index % perH;
    const seg = segment(k, cols, pitch, (c) => crossingZ(row, c, p, true));
    const y = ((rows - 1) / 2 - row) * pitch;
    return {
      position: [seg.mid, y, seg.z],
      rotation: [0, -seg.slope, 0],
      scale: [seg.len, 1, 1],
    };
  }

  // Vertical strip: long axis turned to y (Rz 90°), then tilted about x.
  const j = index - rows * perH;
  const perV = segmentsPerVertical(p);
  const col = Math.floor(j / perV);
  const k = j % perV;
  // Walk from bottom (last row) to top so +s is +y.
  const seg = segment(k, rows, pitch, (i) => crossingZ(rows - 1 - i, col, p, false));
  const x = (col - (cols - 1) / 2) * pitch;
  return {
    position: [x, seg.mid, seg.z],
    rotation: [seg.slope, 0, Math.PI / 2],
    scale: [seg.len, 1, 1],
  };
}

export function getGridExtents(staticParams: PatternParams): { width: number; height: number } {
  const p = read(staticParams);
  const pitch = p.stripWidth + p.gap;
  return { width: Math.round(p.cols) * pitch, height: Math.round(p.rows) * pitch };
}

/** Elevation drawing: strips as outlines; at each crossing the strip in front is drawn whole. */
export function generatePreviewSvg(staticParams?: PatternParams): string {
  const p = read(staticParams ?? {});
  const n = Math.min(8, Math.round(p.rows), Math.round(p.cols));
  const size = 800;
  const margin = 70;
  const usable = size - margin * 2;
  const pitch = usable / n;
  const w = pitch * Math.min(0.9, Math.max(0.2, p.stripWidth / (p.stripWidth + p.gap)));
  const inset = (pitch - w) / 2;
  const line = (op: number) =>
    `fill="none" stroke="${STROKE}" stroke-opacity="${op}" stroke-width="${STROKE_WIDTH}" vector-effect="non-scaling-stroke"`;
  const f = (v: number) => v.toFixed(1);
  const end = margin + usable;
  const d: string[] = [];
  // Each strip edge is drawn as runs; a run breaks where the strip passes under.
  for (let i = 0; i < n; i++) {
    const a = margin + i * pitch + inset; // strip near edge
    const b = a + w; // strip far edge
    for (const horizontal of [true, false]) {
      let from = margin;
      for (let k = 0; k < n; k++) {
        const s = margin + k * pitch + inset;
        const under = horizontal ? !horizontalOver(i, k, p.weave) : horizontalOver(k, i, p.weave);
        if (!under) continue;
        for (const e of [a, b]) d.push(horizontal ? `M${f(from)} ${f(e)}H${f(s)}` : `M${f(e)} ${f(from)}V${f(s)}`);
        from = s + w;
      }
      for (const e of [a, b]) d.push(horizontal ? `M${f(from)} ${f(e)}H${f(end)}` : `M${f(e)} ${f(from)}V${f(end)}`);
      d.push(horizontal ? `M${margin} ${f(a)}V${f(b)}M${end} ${f(a)}V${f(b)}` : `M${f(a)} ${margin}H${f(b)}M${f(a)} ${end}H${f(b)}`);
    }
  }
  const parts = [`<path d="${d.join("")}" ${line(0.85)} />`];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">${parts.join("")}</svg>`;
}

export const static3dModule: Static3DPatternModule = {
  meta,
  defaults,
  getElementCount,
  getElementTransform,
  getInstanceSize,
  getGridExtents,
  generatePreviewSvg,
};
