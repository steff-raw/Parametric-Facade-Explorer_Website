/**
 * Adaptive Panel: static vs kinetic head blade over one sample day (P-0023, Stage 1).
 *
 * Pure TypeScript, no DOM. Concept-stage estimate, not compliance.
 * Sun, sky and blade shading come from the Solar Budget Skin engine (imported, unchanged).
 * Fixed sample inputs: 52N, south facade, clear sky, hourly midpoints, one 1.5 m cell.
 *
 * Control rule (sun-high gate + gain cap), per sun-up hour:
 *  1. beam misses the glass (z <= 0) or profile angle atan(y/z) < 45 deg: d = 0 (open);
 *  2. else the smallest d in {0, 0.1 ... 0.6 m} with gain(h, d) <= cap; if none, 0.6 m.
 */

import { BEAM_SHARE, DIFFUSE_SHARE, DOME, G_VALUE, SAMPLE_DAY, haurwitz, sunPosition, toFacade, unshaded } from "../solar-budget-skin/engine";

const RAD = Math.PI / 180;

export const LAT = 52;
export const ORIENTATION = 180;
export const GATE = 45; // deg, profile angle
/** Day pills 0 / 1 / 2 = 21 Jun, 21 Dec, 21 Mar (month index). */
export const DAY_MONTHS = [5, 11, 2];
export const DEPTHS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
export const MAX_DEPTH = 0.6;
/** Chart, scrubber and play span; day totals use all sun-up hours. */
export const CHART_HOURS = [7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5, 16.5];
/** Occupied glare / sky-view window: 8 bins 09:30 to 16:30. */
export const OCCUPIED_HOURS = [9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5, 16.5];
export const DEFAULTS = { cap: 150, staticDepth: 0.3 };

type Vec = [number, number, number];

/** Sun at a solar hour: altitude (deg) and facade-frame unit vector [x right, y up, z out]. */
export function sun(month: number, hour: number, lat = LAT): { altitude: number; vec: Vec } {
  const s = sunPosition(lat, SAMPLE_DAY[month], hour);
  return { altitude: s.altitude, vec: toFacade(s.vec, ORIENTATION) };
}

/** Beam transmission past the blade; 0 if the sun is behind the facade. */
export function tauB(vec: Vec, d: number): number {
  const [x, y, z] = vec;
  return z <= 0 ? 0 : unshaded("blade", d, y / z, x / z);
}

const LOCAL_DOME = DOME.map((p) => ({ omega: p.omega, v: toFacade(p.vec, ORIENTATION) }));

/** Sky view factor of the glass with a blade of depth d (open = 0.5). */
export function svf(d: number): number {
  let sum = 0;
  for (const { omega, v } of LOCAL_DOME) if (v[2] > 0) sum += omega * v[2] * unshaded("blade", d, v[1] / v[2], v[0] / v[2]);
  return sum / Math.PI;
}

const SVF0 = svf(0);

/** Diffuse transmission relative to open glass. */
export function tauD(d: number): number {
  return svf(d) / SVF0;
}

/** Transmitted gain, W/m2 of glass, at one hour with blade depth d. */
export function gain(month: number, hour: number, d: number, lat = LAT): number {
  const { altitude, vec } = sun(month, hour, lat);
  if (altitude <= 0) return 0;
  const ghi = haurwitz(altitude);
  const beam = ((BEAM_SHARE * ghi) / Math.sin(altitude * RAD)) * Math.max(0, vec[2]) * tauB(vec, d);
  return (beam + DIFFUSE_SHARE * ghi * svf(d)) * G_VALUE;
}

/** Kinetic blade depth by the control rule. */
export function kineticDepth(month: number, hour: number, cap: number, lat = LAT): number {
  const { altitude, vec } = sun(month, hour, lat);
  if (altitude <= 0 || vec[2] <= 0 || Math.atan2(vec[1], vec[2]) / RAD < GATE) return 0;
  return DEPTHS.find((d) => gain(month, hour, d, lat) <= cap) ?? MAX_DEPTH;
}

/** Hourly midpoints with the sun above the horizon. */
function sunUpHours(month: number, lat: number): number[] {
  const out: number[] = [];
  for (let h = 0; h < 24; h++) if (sun(month, h + 0.5, lat).altitude > 0) out.push(h + 0.5);
  return out;
}

/** d(h) for both facades over the sun-up hourly midpoints. */
export function depthSeries(month: number, cap: number, staticDepth: number, lat = LAT) {
  const hours = sunUpHours(month, lat);
  return { hours, kinetic: hours.map((h) => kineticDepth(month, h, cap, lat)), static: hours.map(() => staticDepth) };
}

/** Facade-frame sun unit vectors for every sun-up half-hour (arc points). */
export function sunPath(month: number, lat = LAT): { hour: number; vec: Vec }[] {
  const out: { hour: number; vec: Vec }[] = [];
  for (let k = 0; k < 48; k++) {
    const s = sun(month, k / 2, lat);
    if (s.altitude > 0) out.push({ hour: k / 2, vec: s.vec });
  }
  return out;
}

const total = (month: number, hours: number[], depths: number[], lat: number) =>
  hours.reduce((sum, h, i) => sum + gain(month, h, depths[i], lat), 0) / 1000;

const glare = (month: number, depthAt: (h: number) => number, lat: number) =>
  OCCUPIED_HOURS.filter((h) => {
    const { altitude, vec } = sun(month, h, lat);
    return altitude > 0 && vec[2] > 0 && tauB(vec, depthAt(h)) >= 0.5;
  }).length;

const skyView = (depthAt: (h: number) => number) =>
  (100 * OCCUPIED_HOURS.reduce((sum, h) => sum + tauD(depthAt(h)), 0)) / OCCUPIED_HOURS.length;

/** Day totals (kWh/m2 of glass, all sun-up hours), moves, glare hours and sky view kept (%). */
export function dayResult(month: number, cap: number, staticDepth: number, lat = LAT) {
  const s = depthSeries(month, cap, staticDepth, lat);
  const kineticAt = (h: number) => kineticDepth(month, h, cap, lat);
  const staticAt = () => staticDepth;
  return {
    open: total(month, s.hours, s.hours.map(() => 0), lat),
    static: total(month, s.hours, s.static, lat),
    kinetic: total(month, s.hours, s.kinetic, lat),
    moves: s.kinetic.filter((d, i) => i > 0 && d !== s.kinetic[i - 1]).length,
    glare: { static: glare(month, staticAt, lat), kinetic: glare(month, kineticAt, lat) },
    skyView: { static: skyView(staticAt), kinetic: skyView(kineticAt) },
  };
}

/** Static depth (0 to 0.6 m) whose day total equals the kinetic day total, by bisection. */
export function equalGainDepth(month: number, cap: number, lat = LAT): number {
  const s = depthSeries(month, cap, 0, lat);
  const target = total(month, s.hours, s.kinetic, lat);
  const staticTotal = (d: number) => total(month, s.hours, s.hours.map(() => d), lat);
  if (staticTotal(0) <= target) return 0;
  if (staticTotal(MAX_DEPTH) >= target) return MAX_DEPTH;
  let lo = 0, hi = MAX_DEPTH;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (staticTotal(mid) > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
