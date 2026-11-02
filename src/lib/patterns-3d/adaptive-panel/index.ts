/**
 * Adaptive Panel: static-3d view module (P-0023, Stage 2).
 *
 * Two 1 x 5 glazing walls (static blade left, kinetic blade right) and the sun on its arc, at 1 unit = 1 m.
 * View only: every number comes from ./engine (no new physics). Concept-stage estimate, not compliance.
 */

import { defaultsFromMeta } from "../../patterns/shared/types";
import type { PatternMeta, PatternParams } from "../../patterns/shared/types";
import type { ElementTransform, Static3DPatternModule } from "../shared/types";
import { CELL } from "../solar-budget-skin/engine";
import { CHART_HOURS, DAY_MONTHS, DEFAULTS, depthSeries, gain, kineticDepth, sun } from "./engine";

export { CELL };
export const DAY_LABELS = ["21 Jun", "21 Dec", "21 Mar"];

const fmtHour = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;
export { fmtHour };

export const meta: PatternMeta = {
  slug: "adaptive-panel",
  name: "Adaptive Panel",
  description:
    "A fixed head blade (left) beside a blade that moves by a simple rule (right), over one sample day on a south facade at 52° N. Scrub the hour and compare heat, sky view, glare and moves. The value is seasonal, not hourly. Concept-stage estimate, not compliance.",
  tags: ["Performance", "Solar", "Kinetic"],
  type: "static-3d",
  popularity: 70,
  createdAt: "2026-11-02",
  staticParams: [
    { key: "day", label: "Day", min: 0, max: 2, step: 1, default: 0, options: DAY_LABELS },
    { key: "cap", label: "Gain cap", min: 100, max: 300, step: 10, default: DEFAULTS.cap, format: (v) => `${v} W/m²` },
    { key: "staticDepth", label: "Static blade depth", min: 0, max: 0.6, step: 0.1, default: DEFAULTS.staticDepth, format: (v) => `${v.toFixed(2)} m` },
  ],
};

export const defaults = defaultsFromMeta(meta);

/** Day, cap and static depth from params (static depth snapped to the 0.1 m steps). */
export function readParams(p: PatternParams) {
  const day = Math.min(2, Math.max(0, Math.round(p.day ?? 0)));
  return {
    day,
    month: DAY_MONTHS[day],
    cap: p.cap ?? DEFAULTS.cap,
    staticDepth: Math.round((p.staticDepth ?? DEFAULTS.staticDepth) * 10) / 10,
  };
}

/** Scrubber / chart hours: sun-up hourly midpoints inside 07:30 to 16:30 (21 Dec has 8). */
export function scrubHours(month: number): number[] {
  return depthSeries(month, DEFAULTS.cap, 0).hours.filter((h) => h >= CHART_HOURS[0] && h <= CHART_HOURS[CHART_HOURS.length - 1]);
}

// ---- scene scale (1 unit = 1 m)
export const ROWS = 5;
export const WALL_H = ROWS * CELL;
/** Wall centres: static (west, left) and kinetic (east, right). */
export const WALL_X = [-1.5, 1.5];
export const ARC_RADIUS = 14;
export const SUN_RADIUS = 0.5;
export const LIGHT_DISTANCE = 40;
/** Copied drawing values from the Solar Budget Skin module (module-private there). */
const GLASS = CELL - 0.08;
const T = 0.07;
const INSET = 0.1;
const ZERO: [number, number, number] = [0, 0, 0];

export function glassTransform(wall: number, row: number): ElementTransform {
  return { position: [WALL_X[wall], row * CELL + CELL / 2, -T / 2], rotation: ZERO, scale: [GLASS, GLASS, T] };
}

/** Head blade at the top of a cell, true-scale depth d (m) out of the glass; hidden at d = 0. */
export function bladeTransform(wall: number, row: number, d: number): ElementTransform {
  const top = (row + 1) * CELL;
  if (d <= 0) return { position: [WALL_X[wall], top, 0], rotation: ZERO, scale: [0, 0, 0] };
  return { position: [WALL_X[wall], top - T / 2, d / 2], rotation: ZERO, scale: [CELL - 2 * INSET, T, d] };
}

// ---- camera rule (J2): fixed view direction, distance grows as the viewer gets narrower
const DIR = [-22, 10, 27];
const DIR_LEN = Math.hypot(DIR[0], DIR[1], DIR[2]);
export const CAMERA = { fov: 40, target: [0, 3.5, 3] as [number, number, number], d0: 32, refAspect: 1.34, minDistance: 8, maxDistance: 60 };

export function cameraDistance(aspect: number): number {
  return Math.min(CAMERA.maxDistance, CAMERA.d0 * Math.max(1, CAMERA.refAspect / aspect));
}

export function cameraPosition(aspect = CAMERA.refAspect): [number, number, number] {
  const D = cameraDistance(aspect);
  return CAMERA.target.map((t, i) => t + (DIR[i] / DIR_LEN) * D) as [number, number, number];
}

// ---- glass tint: live gain vs cap (blue at or below the cap, warming to the day's open-glass peak)
type RGB = [number, number, number];
export const BLUE: RGB = [0x3a, 0x5a, 0x8c];
export const SKIN_GLASS: RGB = [0xa0, 0xc4, 0xf0];
export const WARM: RGB = [0xc4, 0x7a, 0x48];
export const ELEMENT = "#c8c8c8";
export const CAPPED = "#8f8f8f";
export const css = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
export const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;

export function heatT(month: number, hour: number, d: number, cap: number): number {
  const peak = Math.max(...CHART_HOURS.map((h) => gain(month, h, 0)));
  const g = gain(month, hour, d);
  return peak > cap ? Math.min(1, Math.max(0, (g - cap) / (peak - cap))) : 0;
}

// ---- Static3DPatternModule (12:30 view; the live page uses AdaptivePanel3D)
const HOUR = 12.5;

export function getElementCount(): number {
  return 4 * ROWS;
}

export function getInstanceSize(): [number, number, number] {
  return [1, 1, 1];
}

export function getGridExtents() {
  return { width: 2 * WALL_X[1] + CELL, height: WALL_H };
}

export function getElementTransform(index: number, staticParams: PatternParams): ElementTransform {
  const p = readParams(staticParams);
  const wall = Math.floor((index % (2 * ROWS)) / ROWS);
  const row = index % ROWS;
  if (index < 2 * ROWS) return glassTransform(wall, row);
  return bladeTransform(wall, row, wall === 0 ? p.staticDepth : kineticDepth(p.month, HOUR, p.cap));
}

export function getCameraPosition(): [number, number, number] {
  return cameraPosition();
}

export function getFov(): number {
  return CAMERA.fov;
}

export function getLightPosition(staticParams: PatternParams): [number, number, number] | null {
  const { vec } = sun(readParams(staticParams).month, HOUR);
  return vec[1] > 0 && vec[2] > 0 ? (vec.map((v) => v * LIGHT_DISTANCE) as [number, number, number]) : null;
}

/** Gallery thumbnail: both walls in oblique at 12:30, blades at their depths, sun on its arc. No text. */
export function generatePreviewSvg(staticParams?: PatternParams): string {
  const p = readParams(staticParams ?? {});
  const s = 70; // px per m
  const k = 0.8; // oblique: depth drawn up and to the right
  const base = 725;
  const depths = [p.staticDepth, kineticDepth(p.month, HOUR, p.cap)];
  const at = (x: number, y: number, z: number) => `${(400 + (x + z * k) * s).toFixed(1)},${(base - (y + z * k * 0.5) * s).toFixed(1)}`;
  const glass: string[] = [];
  const blades: string[] = [];
  for (let wall = 0; wall < 2; wall++) {
    const d = depths[wall];
    const fill = css(mix(BLUE, WARM, heatT(p.month, HOUR, d, p.cap)));
    for (let row = 0; row < ROWS; row++) {
      const x0 = WALL_X[wall] - CELL / 2 + 0.04, y1 = (row + 1) * CELL - 0.04;
      glass.push(
        `<rect x="${(400 + x0 * s).toFixed(1)}" y="${(base - y1 * s).toFixed(1)}" width="${((CELL - 0.08) * s).toFixed(1)}" height="${((CELL - 0.08) * s).toFixed(1)}" fill="${fill}" fill-opacity="0.85" stroke="#2a2a2a" stroke-width="1.5" vector-effect="non-scaling-stroke" />`,
      );
      if (d <= 0) continue;
      const xa = WALL_X[wall] - CELL / 2 + INSET, xb = WALL_X[wall] + CELL / 2 - INSET, y = (row + 1) * CELL;
      blades.push(
        `<polygon points="${at(xa, y, 0)} ${at(xb, y, 0)} ${at(xb, y, d)} ${at(xa, y, d)}" fill="${d >= 0.6 ? CAPPED : ELEMENT}" stroke="#2a2a2a" stroke-width="1" vector-effect="non-scaling-stroke" />`,
      );
    }
  }
  const sunDot = `<circle cx="400" cy="175" r="14" fill="#c47a48" /><circle cx="400" cy="175" r="24" fill="none" stroke="#c47a48" stroke-width="2" />`;
  const arc = `<path d="M 130 330 Q 400 20 670 330" fill="none" stroke="#969696" stroke-width="2" />`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="100%" height="100%">${arc}${glass.join("")}${blades.join("")}${sunDot}</svg>`;
}

export const static3dModule: Static3DPatternModule = {
  meta,
  defaults,
  getElementCount,
  getElementTransform,
  getInstanceSize,
  getGridExtents,
  getCameraPosition,
  getFov,
  getLightPosition,
  generatePreviewSvg,
};
