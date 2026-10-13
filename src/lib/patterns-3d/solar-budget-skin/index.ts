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
import { STROKE } from "../../patterns/shared/math";
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
const SHIFT_X = -4.5;
/**
 * World units per metre. The canvas's OrbitControls clamps the camera to 60 units, so the
 * model is drawn at 60/240 scale: a camera 60 units away frames it as 240 m away would.
 */
const WORLD = 60 / 240;
/** Drawing joint at each end of an element; the engine assumes full cell width. */
const INSET = 0.1;
const GLASS = CELL - 0.08;
const T = 0.07; // element and glass thickness, m (drawing only; engine depth unchanged)
const ZERO: [number, number, number] = [0, 0, 0];

interface Solved {
  key: string;
  result: SolveResult;
  minBare: number; // bare cooling gain range over the cells, kWh/m² yr
  maxBare: number;
}

/** Solve for the 4 solve sliders, remembered for the last input (called per instance). */
let last: Solved | null = null;
function solved(p: P): Solved {
  const key = `${p.orientation}|${p.latitude}|${p.target}|${p.maxDepth}`;
  if (!last || last.key !== key) {
    const result = solve({ orientation: p.orientation, latitude: p.latitude, target: p.target, maxDepth: p.maxDepth });
    const bare = result.cells.map((c) => c.bareCooling);
    last = { key, result, minBare: Math.min(...bare), maxBare: Math.max(...bare) };
  }
  return last;
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
  return { width: (2 * ARRAY_W + GAP) * WORLD, height: ARRAY_H * WORLD };
}

export function getElementTransform(index: number, staticParams: PatternParams): ElementTransform {
  const t = transformInMetres(index, staticParams);
  const w = (v: [number, number, number]): [number, number, number] => [v[0] * WORLD, v[1] * WORLD, v[2] * WORLD];
  return { position: w(t.position), rotation: t.rotation, scale: t.scale && w(t.scale) };
}

function transformInMetres(index: number, staticParams: PatternParams): ElementTransform {
  const p = read(staticParams);
  const cellIndex = Math.floor(index / PARTS);
  const part = index % PARTS;
  const row = Math.floor(cellIndex / COLS), col = cellIndex % COLS;
  const cell = solved(p).result.cells[cellIndex];
  const [x0, y0] = cellOrigin(part === 0 ? 0 : 1, row, col);
  const cx = x0 + CELL / 2, cy = y0 - CELL / 2;
  const none = { position: [cx, cy, 0] as [number, number, number], rotation: ZERO, scale: ZERO };
  if (part <= 1) return { position: [cx, cy, -T / 2], rotation: ZERO, scale: [GLASS, GLASS, T] };
  const d = cell.depth;
  if (d <= 0) return none;
  const blade = cell.type === "blade" || cell.type === "hood";
  const fins = cell.type === "fins" || cell.type === "hood";
  // Drawing joint: elements stop INSET short of the cell edges; the engine assumes full cell width.
  const inner = CELL - 2 * INSET;
  if (part === 2) {
    return blade ? { position: [cx, y0 - INSET - T / 2, d / 2], rotation: ZERO, scale: [inner, T, d] } : none;
  }
  if (!fins) return none;
  const x = part === 3 ? x0 + INSET + T / 2 : x0 + CELL - INSET - T / 2;
  return { position: [x, cy, d / 2], rotation: ZERO, scale: [T, inner, d] };
}

type RGB = [number, number, number];
const BLUE: RGB = [0x3a, 0x5a, 0x8c]; // thumbnail glass at or below the Target
const SKIN_GLASS: RGB = [0xa0, 0xc4, 0xf0]; // 3D skin glass at or below the Target (lit at grazing sun, so brighter)
const WARM: RGB = [0xc4, 0x7a, 0x48]; // bare maximum
const DIM_WARM: RGB = [0x7a, 0x4d, 0x36]; // bare minimum
const ELEMENT = "#c8c8c8";
const CAPPED = "#8f8f8f";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
const css = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/** Bare array, relative exposure scale: min -> max bare cooling gain over the cells, dim warm -> warm. Never blue (no bare cell meets the Target). */
function bareTint(gain: number, s: Solved): RGB {
  const t = s.maxBare > s.minBare ? clamp01((gain - s.minBare) / (s.maxBare - s.minBare)) : 1;
  return mix(DIM_WARM, WARM, t);
}

/** Skin array, absolute Target scale: blue at or below the Target, warming towards the bare maximum above it. */
function skinTint(gain: number, target: number, s: Solved): RGB {
  const t = s.maxBare > target ? clamp01((gain - target) / (s.maxBare - target)) : 0;
  return mix(SKIN_GLASS, WARM, t);
}

export function getInstanceColor(index: number, staticParams: PatternParams): string {
  const p = read(staticParams);
  const s = solved(p);
  const cell = s.result.cells[Math.floor(index / PARTS)];
  const part = index % PARTS;
  if (part === 0) return css(bareTint(cell.bareCooling, s));
  if (part === 1) return css(skinTint(cell.cooling, p.target, s));
  return cell.capped ? CAPPED : ELEMENT;
}

/** Near-front view from above right (yaw 10°, pitch 22°), long lens (fov 5°) at 240 m so depth faces show and verticals stay near-upright. */
export function getCameraPosition(): [number, number, number] {
  const distance = 240 * WORLD;
  const yaw = (10 * Math.PI) / 180;
  const pitch = (22 * Math.PI) / 180;
  return [
    distance * Math.sin(yaw) * Math.cos(pitch),
    distance * Math.sin(pitch),
    distance * Math.cos(yaw) * Math.cos(pitch),
  ];
}

export function getFov(): number {
  return 5;
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

/** Gallery thumbnail: solved skin at the defaults; glass warmed by bare exposure, element faces in oblique. No text. */
export function generatePreviewSvg(staticParams?: PatternParams): string {
  const p = read(staticParams ?? {});
  const sol = solved(p);
  const size = 800;
  const k = 0.8; // oblique: depth drawn up and to the left
  const margin = 90;
  const s = (size - margin * 2) / (ARRAY_W + p.maxDepth * k); // px per m
  const ox = margin + p.maxDepth * k * s, oy = margin + p.maxDepth * k * s * 0.5;
  const at = (x: number, y: number, z: number) => `${(ox + (x - z * k) * s).toFixed(1)},${(oy + (y - z * k) * s).toFixed(1)}`;
  const quad = (a: string, b: string, c: string, d: string, fill: string) =>
    `<polygon points="${a} ${b} ${c} ${d}" fill="${fill}" stroke="${STROKE}" stroke-opacity="0.9" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`;
  const parts: string[] = [];
  const faces: string[] = [];
  for (const c of sol.result.cells) {
    const x = c.col * CELL, y = c.row * CELL;
    const tb = sol.maxBare > sol.minBare ? (c.bareCooling - sol.minBare) / (sol.maxBare - sol.minBare) : 1;
    const glass = css(mix(BLUE, WARM, 0.6 * tb));
    const g = 0.04;
    parts.push(
      `<rect x="${(ox + (x + g) * s).toFixed(1)}" y="${(oy + (y + g) * s).toFixed(1)}" width="${((CELL - 2 * g) * s).toFixed(1)}" height="${((CELL - 2 * g) * s).toFixed(1)}" fill="${glass}" fill-opacity="0.6" stroke="${STROKE}" stroke-opacity="0.5" stroke-width="1.5" vector-effect="non-scaling-stroke" />`
    );
    const d = c.depth;
    if (d <= 0) continue;
    const el = "#0d0d0d";
    if (c.type === "blade" || c.type === "hood") {
      faces.push(quad(at(x, y, 0), at(x + CELL, y, 0), at(x + CELL, y, d), at(x, y, d), el));
      faces.push(quad(at(x, y, d), at(x + CELL, y, d), at(x + CELL, y + T, d), at(x, y + T, d), el));
    }
    if (c.type === "fins" || c.type === "hood") {
      for (const fx of [x, x + CELL - T]) {
        faces.push(quad(at(fx, y, 0), at(fx, y + CELL, 0), at(fx, y + CELL, d), at(fx, y, d), el));
        faces.push(quad(at(fx, y, d), at(fx + T, y, d), at(fx + T, y + CELL, d), at(fx, y + CELL, d), el));
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">${parts.join("")}${faces.join("")}</svg>`;
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
  getFov,
  getLightPosition,
  generatePreviewSvg,
};
