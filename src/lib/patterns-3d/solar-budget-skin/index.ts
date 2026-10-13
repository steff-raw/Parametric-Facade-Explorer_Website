/**
 * Solar Budget Skin — static-3d (P-0014)
 *
 * Bare glass (left) next to a solved skin (right). Each skin cell picks a
 * blade, fins or a hood and its depth from its own solve against a summer-gain
 * Target (see ./engine.ts). Concept-stage estimate, not compliance.
 */

import {
  PatternMeta,
  PatternParams,
  defaultsFromMeta,
  staticDefaultsFromMeta,
} from "../../patterns/shared/types";
import { STROKE, STROKE_WIDTH } from "../../patterns/shared/math";
import { ElementTransform, Static3DPatternModule } from "../shared/types";
import {
  CELL,
  DEFAULT_CONTEXT,
  SAMPLE_DAY,
  SolveResult,
  solve,
  sunPosition,
  toFacade,
} from "./engine";

export const meta: PatternMeta = {
  slug: "solar-budget-skin",
  name: "Solar Budget Skin",
  description:
    "Each glass cell chooses a blade, fins or a hood and solves its depth from its own sun and sky view, until its summer gain meets the Target. Bare glass on the left, the solved skin on the right. Concept-stage estimate, not compliance.",
  tags: ["Performance", "Solar"],
  type: "static-3d",
  popularity: 75,
  createdAt: "2026-10-13",
  staticParams: [
    { key: "orientation", label: "Orientation", min: 0, max: 337.5, step: 22.5, default: 180, unit: "°" },
    { key: "latitude", label: "Latitude", min: -60, max: 60, step: 0.5, default: 51.5, unit: "°" },
    { key: "target", label: "Target", min: 20, max: 300, step: 10, default: 90, unit: "kWh/m²" },
    { key: "maxDepth", label: "Max depth", min: 0.1, max: 0.8, step: 0.05, default: 0.6, unit: "m" },
    { key: "month", label: "Month (sun view, 1-12)", min: 1, max: 12, step: 1, default: 6 },
    { key: "hour", label: "Hour (sun view)", min: 5, max: 19, step: 1, default: 14, unit: "h solar" },
  ],
};

export const defaults = defaultsFromMeta(meta);
export const staticDefaults = staticDefaultsFromMeta(meta);

type P = typeof staticDefaults;
const read = (s: PatternParams): P => ({ ...staticDefaults, ...s }) as P;

const { rows: ROWS, cols: COLS } = DEFAULT_CONTEXT;
const PARTS = 5; // bare glass, skin glass, blade, left fin, right fin
const GAP = 2 * CELL; // between the arrays
const ARRAY_W = COLS * CELL;
const ARRAY_H = ROWS * CELL;
/** Model shifted left so both arrays sit clear of the control panel on the right. */
const SHIFT_X = -5;
const GLASS = CELL - 0.08;
const T = 0.04; // element and glass thickness, m
const ZERO: [number, number, number] = [0, 0, 0];

/** Solve for the 4 solve sliders, remembered for the last input (called per instance). */
let last: { key: string; result: SolveResult } | null = null;
function solved(p: P): SolveResult {
  const key = `${p.orientation}|${p.latitude}|${p.target}|${p.maxDepth}`;
  if (!last || last.key !== key) {
    last = {
      key,
      result: solve({ orientation: p.orientation, latitude: p.latitude, target: p.target, maxDepth: p.maxDepth }),
    };
  }
  return last.result;
}

/** Cell origin (left edge x, top edge y) for an array; side 0 = bare, 1 = skin. */
function cellOrigin(side: number, row: number, col: number): [number, number] {
  const left = SHIFT_X + (side === 0 ? -(GAP / 2 + ARRAY_W) : GAP / 2);
  return [left + col * CELL, ARRAY_H / 2 - row * CELL];
}

export function getElementCount(): number {
  return ROWS * COLS * PARTS;
}

export function getInstanceSize(): [number, number, number] {
  return [1, 1, 1];
}

export function getGridExtents(): { width: number; height: number } {
  return { width: 2 * ARRAY_W + GAP, height: ARRAY_H };
}

export function getElementTransform(index: number, staticParams: PatternParams): ElementTransform {
  const p = read(staticParams);
  const cellIndex = Math.floor(index / PARTS);
  const part = index % PARTS;
  const row = Math.floor(cellIndex / COLS), col = cellIndex % COLS;
  const cell = solved(p).cells[cellIndex];
  const [x0, y0] = cellOrigin(part === 0 ? 0 : 1, row, col);
  const cx = x0 + CELL / 2, cy = y0 - CELL / 2;
  const none = { position: [cx, cy, 0] as [number, number, number], rotation: ZERO, scale: ZERO };
  if (part <= 1) return { position: [cx, cy, -T / 2], rotation: ZERO, scale: [GLASS, GLASS, T] };
  const d = cell.depth;
  if (d <= 0) return none;
  const blade = cell.type === "blade" || cell.type === "hood";
  const fins = cell.type === "fins" || cell.type === "hood";
  if (part === 2) {
    return blade ? { position: [cx, y0 - T / 2, d / 2], rotation: ZERO, scale: [CELL, T, d] } : none;
  }
  if (!fins) return none;
  const x = part === 3 ? x0 + T / 2 : x0 + CELL - T / 2;
  return { position: [x, cy, d / 2], rotation: ZERO, scale: [T, CELL, d] };
}

const BLUE: [number, number, number] = [0x55, 0x78, 0xb0];
const ORANGE: [number, number, number] = [0xd0, 0x7a, 0x40];
const ELEMENT = "#ffffff";
const CAPPED = "#8f8f8f";

/** Heat tint: blue at or below the Target, orange at the bare maximum. One scale for both arrays. */
function tint(gain: number, target: number, max: number): string {
  const t = max > target ? Math.min(1, Math.max(0, (gain - target) / (max - target))) : 0;
  const c = BLUE.map((b, i) => Math.round(b + (ORANGE[i] - b) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function getInstanceColor(index: number, staticParams: PatternParams): string {
  const p = read(staticParams);
  const res = solved(p);
  const cell = res.cells[Math.floor(index / PARTS)];
  const part = index % PARTS;
  const max = Math.max(...res.cells.map((c) => c.bareCooling));
  if (part === 0) return tint(cell.bareCooling, p.target, max);
  if (part === 1) return tint(cell.cooling, p.target, max);
  return cell.capped ? CAPPED : ELEMENT;
}

/** Front elevation, raised 12° so blades read as trapezoids. */
export function getCameraPosition(): [number, number, number] {
  const distance = 30;
  const a = (12 * Math.PI) / 180;
  return [0, distance * Math.sin(a), distance * Math.cos(a)];
}

/** Light on the analysed sun (Month/Hour); null when the sun is below the horizon or behind the facade. */
export function getLightPosition(staticParams: PatternParams): [number, number, number] | null {
  const p = read(staticParams);
  const sun = sunPosition(p.latitude, SAMPLE_DAY[Math.round(p.month) - 1], p.hour);
  const [x, y, z] = toFacade(sun.vec, p.orientation);
  if (y <= 0 || z <= 0) return null;
  const r = 40;
  return [x * r, y * r, z * r];
}

/** Gallery thumbnail: solved skin at the defaults, heat-tinted glass and element lines. No text. */
export function generatePreviewSvg(staticParams?: PatternParams): string {
  const p = read(staticParams ?? {});
  const res = solved(p);
  const size = 800;
  const margin = 110;
  const s = (size - margin * 2) / ARRAY_W; // px per m
  const max = Math.max(...res.cells.map((c) => c.bareCooling));
  const k = 0.45; // oblique: depth drawn up and to the left
  const at = (x: number, y: number, z: number) => `${(margin + (x - z * k) * s).toFixed(1)},${(margin + (y - z * k) * s).toFixed(1)}`;
  const line = `fill="none" stroke="${STROKE}" stroke-opacity="0.85" stroke-width="${STROKE_WIDTH}" vector-effect="non-scaling-stroke"`;
  const parts: string[] = [];
  for (const c of res.cells) {
    const x = c.col * CELL, y = c.row * CELL;
    parts.push(
      `<rect x="${(margin + (x + 0.04) * s).toFixed(1)}" y="${(margin + (y + 0.04) * s).toFixed(1)}" width="${(GLASS * s).toFixed(1)}" height="${(GLASS * s).toFixed(1)}" fill="${tint(c.cooling, p.target, max)}" fill-opacity="0.45" ${line} />`
    );
    const d = c.depth;
    if (d <= 0) continue;
    if (c.type === "blade" || c.type === "hood") {
      parts.push(`<polygon points="${at(x, y, 0)} ${at(x + CELL, y, 0)} ${at(x + CELL, y, d)} ${at(x, y, d)}" ${line} />`);
    }
    if (c.type === "fins" || c.type === "hood") {
      for (const fx of [x, x + CELL]) {
        parts.push(`<polygon points="${at(fx, y, 0)} ${at(fx, y + CELL, 0)} ${at(fx, y + CELL, d)} ${at(fx, y, d)}" ${line} />`);
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
  getInstanceColor,
  getCameraPosition,
  getLightPosition,
  generatePreviewSvg,
};
