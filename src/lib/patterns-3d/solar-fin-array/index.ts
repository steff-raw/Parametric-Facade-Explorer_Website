/**
 * Solar Fin Array — static-3d
 *
 * A row of vertical fins. Each fin turns across the sun's rays for the chosen
 * facade orientation, month and hour, so the facade closes against sun
 * hitting it and opens when the sun is behind it. Fin depth grades along
 * the facade.
 *
 * Sun model (kept simple on purpose, see plan): solar noon due south
 * (northern hemisphere); azimuth swings 15°/h, wider in summer, narrower in
 * winter. Altitude is ignored: vertical fins answer azimuth.
 *
 * TODO(v2): full sun-path (latitude, altitude) and shadow-hour scoring
 */

import {
  PatternMeta,
  PatternParams,
  defaultsFromMeta,
  staticDefaultsFromMeta,
} from "../../patterns/shared/types";
import { STROKE, STROKE_WIDTH } from "../../patterns/shared/math";
import { ElementTransform, Static3DPatternModule } from "../shared/types";

export const meta: PatternMeta = {
  slug: "solar-fin-array",
  name: "Solar Fin Array",
  description:
    "A row of vertical fins that turn across the sun for the facade's orientation, month and hour. Sun straight on closes the facade; sun behind it opens it. Fin depth grades along the facade.",
  tags: ["Louvre", "Brise-Soleil"],
  type: "static-3d",
  popularity: 80,
  createdAt: "2026-10-12",
  staticParams: [
    { key: "fins", label: "Fins", min: 4, max: 60, step: 1, default: 24 },
    { key: "finHeight", label: "Fin Height", min: 1, max: 8, step: 0.1, default: 4.2, unit: "m*" },
    { key: "finDepth", label: "Fin Depth", min: 0.1, max: 1.2, step: 0.01, default: 0.45, unit: "m*" },
    { key: "finThickness", label: "Fin Thickness", min: 0.01, max: 0.15, step: 0.005, default: 0.04, unit: "m*" },
    { key: "spacing", label: "Spacing", min: 0.15, max: 1.5, step: 0.01, default: 0.4, unit: "m*" },
    { key: "depthGradient", label: "Depth Gradient", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "orientation", label: "Facade Faces", min: 0, max: 359, step: 1, default: 270, unit: "°" },
    { key: "month", label: "Month", min: 1, max: 12, step: 1, default: 6 },
    { key: "hour", label: "Hour", min: 6, max: 20, step: 0.25, default: 16 },
    { key: "tracking", label: "Fins", min: 0, max: 1, step: 1, default: 0, options: ["Follow Sun", "Fixed"] },
    { key: "maxAngle", label: "Max Angle", min: 0, max: 90, step: 1, default: 55, unit: "°" },
  ],
};

export const defaults = defaultsFromMeta(meta);
export const staticDefaults = staticDefaultsFromMeta(meta);

type P = typeof staticDefaults;
const read = (s: PatternParams): P => ({ ...staticDefaults, ...s }) as P;

/** Sun azimuth in degrees from north (90 = east, 180 = south, 270 = west). */
export function sunAzimuth(month: number, hour: number): number {
  // Summer (June) swings wider, winter (December) narrower.
  const season = Math.cos(((month - 6) / 12) * 2 * Math.PI); // 1 in June, -1 in December
  const rate = 15 * (1 + 0.3 * season);
  return 180 + (hour - 12) * rate;
}

/** Sun angle relative to the facade normal, -180..180 (0 = sun straight on). */
export function sunRelative(staticParams: PatternParams): number {
  const p = read(staticParams);
  const rel = sunAzimuth(p.month, p.hour) - p.orientation;
  return ((((rel + 180) % 360) + 360) % 360) - 180;
}

/**
 * Fin angle in degrees from the facade normal. Following the sun, each fin
 * turns across the sun's rays (perpendicular to them) to block it: sun straight
 * on closes the fins, oblique sun needs less turn. Clamped to ±maxAngle; 0
 * (open) when the sun is behind the facade.
 */
export function getFinAngle(staticParams: PatternParams): number {
  const p = read(staticParams);
  const max = Math.max(0, Math.min(90, p.maxAngle));
  if (Math.round(p.tracking) === 1) return max;
  const rel = sunRelative(p);
  if (Math.abs(rel) >= 90) return 0;
  const block = rel >= 0 ? rel - 90 : rel + 90;
  return Math.max(-max, Math.min(max, block));
}

/** Fin depth for fin i: grades from (1 - gradient) × depth to depth along the facade. */
export function getFinDepth(index: number, staticParams: PatternParams): number {
  const p = read(staticParams);
  const n = Math.max(1, Math.round(p.fins));
  const u = n > 1 ? index / (n - 1) : 1;
  return p.finDepth * (1 - p.depthGradient + p.depthGradient * u);
}

export function getElementCount(staticParams: PatternParams): number {
  return Math.max(1, Math.round(read(staticParams).fins));
}

export function getInstanceSize(staticParams: PatternParams): [number, number, number] {
  const p = read(staticParams);
  return [p.finThickness, p.finHeight, p.finDepth];
}

export function getElementTransform(index: number, staticParams: PatternParams): ElementTransform {
  const p = read(staticParams);
  const n = getElementCount(p);
  const x = (index - (n - 1) / 2) * p.spacing;
  const a = (getFinAngle(p) * Math.PI) / 180;
  const s = getFinDepth(index, p) / Math.max(0.0001, p.finDepth);
  return { position: [x, 0, 0], rotation: [0, a, 0], scale: [1, 1, s] };
}

export function getGridExtents(staticParams: PatternParams): { width: number; height: number } {
  const p = read(staticParams);
  const n = getElementCount(p);
  return { width: Math.max(0, n - 1) * p.spacing + p.finDepth, height: p.finHeight };
}

/** Elevation of the fins (visible width = thickness + depth × sin angle) over a plan strip. */
export function generatePreviewSvg(staticParams?: PatternParams): string {
  const p = read(staticParams ?? {});
  const n = Math.min(16, getElementCount(p));
  const size = 800;
  const margin = 70;
  const usable = size - margin * 2;
  const pitch = usable / n;
  const scale = pitch / Math.max(0.0001, p.spacing);
  const a = (getFinAngle(p) * Math.PI) / 180;
  const top = margin;
  const bot = margin + usable * 0.7;
  const planY = margin + usable * 0.82;
  const parts: string[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, o: number) =>
    `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${STROKE}" stroke-opacity="${o}" stroke-width="${STROKE_WIDTH}" vector-effect="non-scaling-stroke" />`;
  const rect = (x: number, y: number, w: number, h: number, o: number) =>
    `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="${STROKE}" stroke-opacity="${o}" stroke-width="${STROKE_WIDTH}" vector-effect="non-scaling-stroke" />`;
  parts.push(line(margin - 10, planY, margin + usable + 10, planY, 0.4));
  for (let i = 0; i < n; i++) {
    const d = Math.min(pitch * 1.6, getFinDepth(i, { ...p, fins: n }) * scale);
    const t = Math.max(1.5, p.finThickness * scale);
    const x = margin + i * pitch + pitch / 2;
    const side = d * Math.abs(Math.sin(a));
    parts.push(rect(x, top, t, bot - top, 0.85));
    if (side > 1) parts.push(rect(Math.sin(a) >= 0 ? x + t : x - side, top, side, bot - top, 0.4));
    parts.push(line(x, planY, x + d * Math.sin(a), planY + d * Math.cos(a), 0.85));
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
