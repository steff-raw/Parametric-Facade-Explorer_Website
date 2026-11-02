/**
 * Facade Yield Map (BIPV): clear-sky module irradiation, cut-off and series-string loss (P-0017, Stage 1).
 *
 * Pure TypeScript, no DOM. Concept-stage estimate, not compliance.
 * Sun, sky and frame maths are imported from the Solar Budget Skin engine (P-0014, not edited).
 *  - samples: one day per week (n = 1, 8, …), 15-min steps while the sun is up, weight 7 d x 0.25 h
 *  - beam: DNI = 0.85 x Haurwitz / sin(alt), traced per sample (ray from module centre vs block wall)
 *  - diffuse: DHI = 0.15 x Haurwitz x sky-view factor F from the 145-patch dome
 *  - strings: series, current-limited: at each sample a string gives n x min G of its on-modules
 *
 * Facade-local frame: x = viewer's right seen from outside, y = up, z = outward normal.
 * Module m = row * 8 + col; row 0 = top, col 0 = left seen from outside.
 */
import {
  BEAM_SHARE,
  CELL,
  DIFFUSE_SHARE,
  DOME,
  haurwitz,
  sunPosition,
  toFacade,
  type Context,
} from "../../patterns-3d/solar-budget-skin/engine";

const RAD = Math.PI / 180;

export const ROWS = 8;
export const COLS = 8;
export const MODULES = ROWS * COLS;
export const EFFICIENCY = 0.2;
export const PERFORMANCE_RATIO = 0.8;
export const MODULE_AREA = CELL * CELL; // 2.25 m²

export type Stringing = "rows" | "cols";

export interface YieldParams {
  orientation: number; // facade-normal azimuth, deg clockwise from north
  latitude: number; // deg, + north
  cutoff: number; // % of the unshaded module H0
  stringing: Stringing;
  blockHeight: number; // m
}

export const DEFAULT_PARAMS: YieldParams = { orientation: 180, latitude: 51.5, cutoff: 76, stringing: "rows", blockHeight: 12 };

/** This page's own context: block 10 m away, 60% wide, flush left. Height comes from the slider. */
export const YIELD_CONTEXT: Context = { rows: ROWS, cols: COLS, blockHeight: 12, blockDistance: 10, blockWidthShare: 0.6 };

export const GRID_HEADER = "Clear-sky kWh/m² yr (upper bound)";
export const CAPTION = "Concept-stage estimate, not compliance";
export const STRING_LABEL = "Series string, no bypass diodes or optimisers: upper bound for this model";
export const LONDON_SOURCE = "https://re.jrc.ec.europa.eu/pvg_tools/en/";
export const LONDON_FOOTNOTE =
  "Engine horizontal about 1,720 kWh/m² yr (clear sky every day) vs 1,084 for London (PVGIS 5.2, EU JRC, horizontal plane, fetched 2026-10-29): about 1.6x on a horizontal surface; the gap is larger on a vertical facade (clear sky has little diffuse light). Real skies also soften shade contrast, so string losses here are on the high side. Use for ranking modules and wiring, not for kWh promises.";

/** Annual module yield, kWh/yr, from irradiation H in kWh/m² yr. */
export function moduleYield(h: number): number {
  return h * EFFICIENCY * PERFORMANCE_RATIO * MODULE_AREA;
}

// ---------------------------------------------------------------- samples

export interface Sample {
  vec: [number, number, number]; // ENU sun direction
  dni: number; // W/m²
  dhi: number; // W/m²
  w: number; // hours represented
}

/** Sun samples: every `dayStep` days, `stepMin` minute steps (mid-step), sun above the horizon. */
export function sunSamples(lat: number, dayStep = 7, stepMin = 15): Sample[] {
  const out: Sample[] = [];
  const dt = stepMin / 60;
  for (let n = 1; n <= 365; n += dayStep) {
    for (let h = dt / 2; h < 24; h += dt) {
      const s = sunPosition(lat, n, h);
      if (s.altitude <= 0) continue;
      const g = haurwitz(s.altitude);
      out.push({ vec: s.vec, dni: (BEAM_SHARE * g) / Math.sin(s.altitude * RAD), dhi: DIFFUSE_SHARE * g, w: dayStep * dt });
    }
  }
  return out;
}

/** Samples and dome in facade-local coordinates for one orientation. */
export interface Frame {
  samples: Sample[];
  sun: [number, number, number][];
  dome: [number, number, number][];
}

export function frame(orientation: number, samples: Sample[]): Frame {
  return {
    samples,
    sun: samples.map((s) => toFacade(s.vec, orientation)),
    dome: DOME.map((p) => toFacade(p.vec, orientation)),
  };
}

/** True if the ray from (x0, y0) towards local direction v hits the block wall. */
function blocked(x0: number, y0: number, v: [number, number, number], ctx: Context): boolean {
  if (ctx.blockHeight <= 0 || v[2] <= 0) return false;
  const t = ctx.blockDistance / v[2];
  const x = x0 + v[0] * t, y = y0 + v[1] * t;
  return x >= 0 && x <= ctx.blockWidthShare * ctx.cols * CELL && y >= 0 && y <= ctx.blockHeight;
}

/** Irradiance G(t), W/m², at one facade point for every sample. */
export function pointSeries(f: Frame, x0: number, y0: number, ctx: Context): Float64Array {
  let sv = 0;
  for (let i = 0; i < f.dome.length; i++) {
    const v = f.dome[i];
    if (v[2] > 1e-9 && !blocked(x0, y0, v, ctx)) sv += DOME[i].omega * v[2];
  }
  sv /= Math.PI;
  const g = new Float64Array(f.samples.length);
  for (let t = 0; t < g.length; t++) {
    const v = f.sun[t], s = f.samples[t];
    g[t] = s.dhi * sv + (v[2] > 1e-9 && !blocked(x0, y0, v, ctx) ? s.dni * v[2] : 0);
  }
  return g;
}

/** Σ w·G / 1000, kWh/m² yr. */
export function annual(g: ArrayLike<number>, samples: Sample[]): number {
  let h = 0;
  for (let t = 0; t < g.length; t++) h += g[t] * samples[t].w;
  return h / 1000;
}

// ---------------------------------------------------------------- solve

export interface Solution {
  orientation: number;
  latitude: number;
  blockHeight: number;
  samples: Sample[];
  G: Float64Array[]; // per module, per sample, W/m²
  H: number[]; // per module, kWh/m² yr
  H0: number; // unshaded module, same orientation and latitude
}

const sampleCache = new Map<number, Sample[]>();

/** Trace all 64 modules (Orientation, Latitude, Block height moves). */
export function solve(orientation: number, latitude: number, blockHeight: number): Solution {
  let samples = sampleCache.get(latitude);
  if (!samples) {
    samples = sunSamples(latitude);
    if (sampleCache.size > 32) sampleCache.clear();
    sampleCache.set(latitude, samples);
  }
  const f = frame(orientation, samples);
  const ctx = { ...YIELD_CONTEXT, blockHeight };
  const G: Float64Array[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) G.push(pointSeries(f, (c + 0.5) * CELL, (ROWS - r - 0.5) * CELL, ctx));
  }
  const H0 = annual(pointSeries(f, 0, 0, { ...ctx, blockHeight: 0 }), samples);
  return { orientation, latitude, blockHeight, samples, G, H: G.map((g) => annual(g, samples)), H0 };
}

// ---------------------------------------------------------------- strings

/** Series string over its modules' G series: output = Σ w·n·min G, ideal = Σ w·Σ G (Wh/m²). */
export function seriesString(series: ArrayLike<number>[], weights: ArrayLike<number>): { out: number; ideal: number; loss: number } {
  let out = 0, ideal = 0;
  if (series.length) {
    for (let t = 0; t < weights.length; t++) {
      let min = Infinity, sum = 0;
      for (const g of series) {
        if (g[t] < min) min = g[t];
        sum += g[t];
      }
      out += weights[t] * series.length * min;
      ideal += weights[t] * sum;
    }
  }
  return { out, ideal, loss: ideal > 0 ? 100 * (1 - out / ideal) : 0 };
}

export interface Wiring {
  strings: number[]; // loss % per string (row 0…7 or col 0…7)
  loss: number; // % vs the on-modules' no-string total
  kwh: number; // layout kWh/yr
}

/** Module indices of string s. */
export function stringModules(s: number, stringing: Stringing): number[] {
  return Array.from({ length: 8 }, (_, j) => (stringing === "rows" ? s * COLS + j : j * COLS + s));
}

export function wire(sol: Solution, on: boolean[], stringing: Stringing): Wiring {
  const weights = sol.samples.map((s) => s.w);
  let out = 0, ideal = 0;
  const strings: number[] = [];
  for (let s = 0; s < (stringing === "rows" ? ROWS : COLS); s++) {
    const r = seriesString(stringModules(s, stringing).filter((m) => on[m]).map((m) => sol.G[m]), weights);
    out += r.out;
    ideal += r.ideal;
    strings.push(r.loss);
  }
  return { strings, loss: ideal > 0 ? 100 * (1 - out / ideal) : 0, kwh: moduleYield(out / 1000) };
}

export interface Layout {
  on: boolean[];
  onCount: number;
  threshold: number; // kWh/m² yr = cutoff% x H0
  rows: Wiring;
  cols: Wiring;
  chosen: Wiring;
  kwh: number; // layout kWh/yr, chosen stringing
  idealKwh: number; // on-modules, no string loss
  naiveKwh: number; // all 64, no cut-off, no string loss
  vsNaive: number; // %
}

/** Module on if H ≥ cut-off % of H0 (tolerance: unobstructed modules equal H0 to float precision). */
export function onMask(sol: Solution, cutoff: number): boolean[] {
  const threshold = (cutoff / 100) * sol.H0;
  return sol.H.map((h) => h >= threshold * (1 - 1e-9));
}

/** Cut-off and stringing re-derive from the cached solution. */
export function layout(sol: Solution, cutoff: number, stringing: Stringing): Layout {
  const threshold = (cutoff / 100) * sol.H0;
  const on = onMask(sol, cutoff);
  const rows = wire(sol, on, "rows"), cols = wire(sol, on, "cols");
  const chosen = stringing === "rows" ? rows : cols;
  const idealKwh = sol.H.reduce((a, h, m) => a + (on[m] ? moduleYield(h) : 0), 0);
  const naiveKwh = sol.H.reduce((a, h) => a + moduleYield(h), 0);
  return {
    on,
    onCount: on.filter(Boolean).length,
    threshold,
    rows,
    cols,
    chosen,
    kwh: chosen.kwh,
    idealKwh,
    naiveKwh,
    vsNaive: naiveKwh > 0 ? 100 * (chosen.kwh / naiveKwh - 1) : 0,
  };
}
