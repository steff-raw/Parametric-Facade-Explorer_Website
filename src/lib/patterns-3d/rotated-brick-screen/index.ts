/**
 * Rotated Brick Screen — static-3d
 *
 * A running-bond brick lattice. Each brick turns about its own vertical axis;
 * the turn is driven by an attractor point, so the screen opens for light and
 * views near the attractor and stays closed away from it (or the reverse).
 *
 * TODO(v2): image-driven rotation field
 * TODO(v2): promote to kinetic-3d by moving the attractor over time
 */

import {
  PatternMeta,
  PatternParams,
  defaultsFromMeta,
  staticDefaultsFromMeta,
} from "../../patterns/shared/types";
import { STROKE, STROKE_WIDTH } from "../../patterns/shared/math";
import { ElementTransform, Static3DPatternModule } from "../shared/types";

/** 0 Stretcher (half-brick offset) · 1 Stack (no offset) */
export const BONDS = ["Stretcher", "Stack"] as const;

export const meta: PatternMeta = {
  slug: "rotated-brick-screen",
  name: "Rotated Brick Screen",
  description:
    "A brick lattice where every brick turns about its vertical axis. An attractor opens the wall for light and views and keeps it solid elsewhere: a common built masonry screen, set up as a live study.",
  tags: ["Perforated", "Parametric Grid"],
  type: "static-3d",
  popularity: 80,
  createdAt: "2026-10-09",
  staticParams: [
    { key: "rows", label: "Courses", min: 6, max: 40, step: 1, default: 22 },
    { key: "cols", label: "Bricks per course", min: 4, max: 24, step: 1, default: 12 },
    { key: "brickLength", label: "Brick Length", min: 0.3, max: 1.2, step: 0.01, default: 0.5, unit: "m*" },
    { key: "brickHeight", label: "Brick Height", min: 0.08, max: 0.35, step: 0.005, default: 0.15, unit: "m*" },
    { key: "brickDepth", label: "Brick Depth", min: 0.1, max: 0.5, step: 0.01, default: 0.24, unit: "m*" },
    { key: "gapX", label: "Gap (Horizontal)", min: 0, max: 0.5, step: 0.01, default: 0.14, unit: "m*" },
    { key: "jointY", label: "Bed Joint", min: 0, max: 0.12, step: 0.005, default: 0.025, unit: "m*" },
    { key: "bond", label: "Bond", min: 0, max: 1, step: 1, default: 0, options: ["Stretcher", "Stack"] },
    { key: "maxAngle", label: "Max Rotation", min: 0, max: 90, step: 1, default: 75, unit: "°" },
    { key: "attractorX", label: "Attractor X", min: 0, max: 1, step: 0.01, default: 0.4 },
    { key: "attractorY", label: "Attractor Y", min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: "falloff", label: "Falloff", min: 0.1, max: 1.5, step: 0.01, default: 0.55 },
    { key: "invert", label: "Open at", min: 0, max: 1, step: 1, default: 0, options: ["Attractor", "Edges"] },
  ],
};

export const defaults = defaultsFromMeta(meta);
export const staticDefaults = staticDefaultsFromMeta(meta);

type P = typeof staticDefaults;
const read = (s: PatternParams): P => ({ ...staticDefaults, ...s }) as P;

/** Bricks in a course: stretcher bond drops the last brick on offset courses. */
function bricksInRow(row: number, cols: number, bond: number): number {
  return Math.round(bond) === 0 && row % 2 === 1 ? cols - 1 : cols;
}

/** Map a flat index to [row, col] across courses of varying length. */
function indexToCell(index: number, rows: number, cols: number, bond: number): [number, number] {
  let i = index;
  for (let r = 0; r < rows; r++) {
    const n = bricksInRow(r, cols, bond);
    if (i < n) return [r, i];
    i -= n;
  }
  return [rows - 1, 0];
}

/** Brick centre in normalised [0,1] wall coordinates (0,0 = top left). */
function cellUV(row: number, col: number, p: P): [number, number] {
  const rows = Math.round(p.rows);
  const cols = Math.round(p.cols);
  const offset = Math.round(p.bond) === 0 && row % 2 === 1 ? 0.5 : 0;
  const u = cols > 1 ? (col + 0.5 + offset) / cols : 0.5;
  const v = rows > 1 ? row / (rows - 1) : 0.5;
  return [u, v];
}

/** Rotation in degrees for one brick: 0 = closed (flush), maxAngle = fully open. */
export function getBrickAngle(row: number, col: number, staticParams: PatternParams): number {
  const p = read(staticParams);
  const [u, v] = cellUV(row, col, p);
  const d = Math.hypot(u - p.attractorX, v - p.attractorY);
  let t = Math.max(0, 1 - d / Math.max(0.01, p.falloff));
  t = t * t * (3 - 2 * t); // smoothstep: soft edge to the opening
  if (Math.round(p.invert) === 1) t = 1 - t;
  return t * Math.max(0, Math.min(90, p.maxAngle));
}

export function getElementCount(staticParams: PatternParams): number {
  const p = read(staticParams);
  const rows = Math.round(p.rows);
  const cols = Math.round(p.cols);
  let n = 0;
  for (let r = 0; r < rows; r++) n += bricksInRow(r, cols, p.bond);
  return n;
}

export function getInstanceSize(staticParams: PatternParams): [number, number, number] {
  const p = read(staticParams);
  return [p.brickLength, p.brickHeight, p.brickDepth];
}

export function getElementTransform(index: number, staticParams: PatternParams): ElementTransform {
  const p = read(staticParams);
  const rows = Math.round(p.rows);
  const cols = Math.round(p.cols);
  const [row, col] = indexToCell(index, rows, cols, p.bond);
  const pitchX = p.brickLength + p.gapX;
  const pitchY = p.brickHeight + p.jointY;
  const offset = Math.round(p.bond) === 0 && row % 2 === 1 ? pitchX / 2 : 0;
  const x = (col - (cols - 1) / 2) * pitchX + offset;
  const y = ((rows - 1) / 2 - row) * pitchY;
  const a = (getBrickAngle(row, col, p) * Math.PI) / 180;
  return { position: [x, y, 0], rotation: [0, a, 0] };
}

export function getGridExtents(staticParams: PatternParams): { width: number; height: number } {
  const p = read(staticParams);
  const rows = Math.round(p.rows);
  const cols = Math.round(p.cols);
  return {
    width: cols * p.brickLength + Math.max(0, cols - 1) * p.gapX,
    height: rows * p.brickHeight + Math.max(0, rows - 1) * p.jointY,
  };
}

/** Elevation drawing: face of each brick shortens as it turns; the end face appears beside it. */
export function generatePreviewSvg(staticParams?: PatternParams): string {
  const p = read(staticParams ?? {});
  const rows = Math.min(26, Math.round(p.rows));
  const cols = Math.min(12, Math.round(p.cols));
  const size = 800;
  const margin = 70;
  const usable = size - margin * 2;
  const pitchX = usable / cols;
  const L = pitchX * (p.brickLength / (p.brickLength + p.gapX));
  const D = L * (p.brickDepth / p.brickLength);
  const pitchY = usable / rows;
  const H = pitchY * 0.72;
  const parts: string[] = [];
  for (let r = 0; r < rows; r++) {
    const n = bricksInRow(r, cols, p.bond);
    const off = Math.round(p.bond) === 0 && r % 2 === 1 ? pitchX / 2 : 0;
    for (let c = 0; c < n; c++) {
      const a = (getBrickAngle(r, c, { ...p, rows, cols }) * Math.PI) / 180;
      const face = L * Math.cos(a);
      const end = D * Math.sin(a);
      const cx = margin + off + c * pitchX + pitchX / 2;
      const x = cx - (face + end) / 2;
      const y = margin + r * pitchY + (pitchY - H) / 2;
      parts.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${face.toFixed(1)}" height="${H.toFixed(1)}" fill="none" stroke="${STROKE}" stroke-opacity="0.85" stroke-width="${STROKE_WIDTH}" vector-effect="non-scaling-stroke" />`
      );
      if (end > 1) {
        parts.push(
          `<rect x="${(x + face).toFixed(1)}" y="${y.toFixed(1)}" width="${end.toFixed(1)}" height="${H.toFixed(1)}" fill="none" stroke="${STROKE}" stroke-opacity="0.4" stroke-width="${STROKE_WIDTH}" vector-effect="non-scaling-stroke" />`
        );
      }
    }
  }
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
